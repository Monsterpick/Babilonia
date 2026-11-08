import fs from 'node:fs/promises'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { isValidPlayerName, type Kit } from '@livearena/shared'
import {
  MinecraftLink,
  PlayerWatcher,
  ServerProcess,
  SERVER_META_FILE,
  createServer,
  enableRcon,
  findJavaFor,
  kitCommands,
  parseVersion,
  readRcon,
  validateFolder,
  type CreateServerOptions,
  type McVersion,
} from '@livearena/minecraft'
import type { ConfigStore } from './config.js'
import { paths } from './config.js'
import type { Logger } from './logger.js'

/**
 * Todo lo de Minecraft: conexión RCON, vigía del jugador, kit, y el servidor local
 * (crear, encender, apagar). Emite 'status' cuando algo cambia.
 */
export class MinecraftService extends EventEmitter {
  readonly link: MinecraftLink
  readonly watcher: PlayerWatcher
  readonly proc = new ServerProcess()
  private creating: { step: string; pct?: number; message: string } | null = null
  private kitProvider: () => Kit | null = () => null
  private liveMobsCache = { at: 0, count: 0 }

  constructor(
    private readonly cfg: ConfigStore,
    private readonly log: Logger,
  ) {
    super()
    const mc = cfg.get().minecraft
    this.link = new MinecraftLink({ host: mc.host, port: mc.port, password: mc.password, perSecond: mc.commandsPerSecond, burst: mc.commandsPerSecond * 2 })
    this.watcher = new PlayerWatcher(this.link, mc.player)

    this.link.on('status', (s) => {
      if (s.state === 'connected') {
        this.log.info('minecraft', `RCON conectado a ${s.host}:${s.port}`)
        void this.onConnected()
      } else if (s.state === 'backoff' || s.state === 'error') this.log.warn('minecraft', s.message ?? s.state)
      this.emitStatus()
    })
    this.link.on('cmdError', (e: { command: string; error: string }) => this.log.warn('minecraft', `Comando falló: ${e.command} → ${e.error}`))
    this.link.on('command', (e: { command: string; response: string }) => {
      if (/Unknown|Incorrect|Expected|Invalid|No player was found|Can't find/i.test(e.response)) this.log.warn('minecraft', `${e.command} → ${e.response}`)
      else this.log.debug('minecraft', `${e.command} → ${e.response}`)
    })

    this.watcher.on('death', ({ player, deaths }) => this.emit('death', { player, deaths }))
    this.watcher.on('respawn', ({ player }) => {
      this.emit('respawn', { player })
      const kit = this.kitProvider()
      if (kit?.enabled && kit.giveOnRespawn) void this.giveKit(kit).catch((err) => this.log.warn('minecraft', `Kit: ${err.message}`))
    })
    this.watcher.on('online', ({ player }) => this.log.info('minecraft', `${player} está en el servidor`))
    this.watcher.on('offline', ({ player }) => this.log.warn('minecraft', `${player} no está en el servidor`))

    this.proc.on('state', (s) => {
      this.log.info('servidor', `Servidor: ${s}`)
      this.emitStatus()
    })
    this.proc.on('log', (line: string) => this.emit('serverLog', line))
    this.proc.on('ready', () => void this.onServerReady())
  }

  setKitProvider(fn: () => Kit | null): void {
    this.kitProvider = fn
  }

  get version(): McVersion {
    return parseVersion(this.cfg.get().minecraft.version)
  }

  get player(): string {
    return this.cfg.get().minecraft.player
  }

  status() {
    const mc = this.cfg.get().minecraft
    return {
      link: this.link.status(),
      player: mc.player,
      version: mc.version,
      server: { ...this.proc.status, folder: mc.server.folder, creating: this.creating },
    }
  }

  private emitStatus(): void {
    this.emit('status', this.status())
  }

  async connect(): Promise<void> {
    const mc = this.cfg.get().minecraft
    if (!mc.password) throw new Error('Falta la contraseña RCON. Créala con el asistente o actívala en una carpeta de servidor.')
    this.link.configure({ host: mc.host, port: mc.port, password: mc.password, perSecond: mc.commandsPerSecond, burst: mc.commandsPerSecond * 2 })
    await this.link.connect()
  }

  disconnect(): void {
    this.watcher.stop()
    this.link.disconnect()
  }

  setPlayer(p: string): void {
    if (p && !isValidPlayerName(p)) throw new Error('Nick de Minecraft inválido (3-16 letras, números o _).')
    this.cfg.update((c) => (c.minecraft.player = p))
    this.watcher.setPlayer(p)
    this.emitStatus()
  }

  private async onConnected(): Promise<void> {
    const mc = this.cfg.get().minecraft
    if (mc.watchPlayer && mc.player) {
      this.watcher.setPlayer(mc.player)
      await this.watcher.prepare().catch(() => undefined)
      this.watcher.start()
    }
    if (mc.server.pendingOp) {
      const r = await this.link.sendNow(`op ${mc.server.pendingOp}`).catch(() => '')
      if (r) {
        this.log.info('minecraft', `OP para ${mc.server.pendingOp}: ${r}`)
        this.cfg.update((c) => (c.minecraft.server.pendingOp = ''))
      }
    }
  }

  /** Cuántos mobs de LiveArena siguen vivos (cacheado 1 s). */
  async liveMobs(): Promise<number> {
    if (Date.now() - this.liveMobsCache.at < 1000) return this.liveMobsCache.count
    const r = await this.link.sendNow('execute if entity @e[tag=livearena]').catch(() => '')
    const m = r.match(/count:?\s*(\d+)/i)
    this.liveMobsCache = { at: Date.now(), count: m ? Number(m[1]) : 0 }
    return this.liveMobsCache.count
  }

  async giveKit(kit: Kit): Promise<number> {
    if (!this.player) throw new Error('Configura tu nick de Minecraft.')
    const cmds = kitCommands(this.version, kit, this.player)
    await Promise.all(cmds.map((c) => this.link.enqueue(c, 900)))
    return cmds.length
  }

  /* ------------------------------ servidor local ------------------------------ */

  async javaInfo() {
    return findJavaFor(this.cfg.get().minecraft.version)
  }

  async listPluginLibrary(): Promise<{ file: string; name: string; size: number }[]> {
    const files = (await fs.readdir(paths.plugins)).filter((f) => f.toLowerCase().endsWith('.jar'))
    return Promise.all(files.map(async (f) => ({ file: f, name: f.replace(/\.jar$/i, ''), size: (await fs.stat(path.join(paths.plugins, f))).size })))
  }

  validateFolder = validateFolder

  async create(o: Omit<CreateServerOptions, 'plugins'> & { plugins: string[]; autoStart: boolean; opPlayer?: string }): Promise<void> {
    if (this.creating && this.creating.step !== 'done' && this.creating.step !== 'error') throw new Error('Ya se está creando un servidor.')
    const plugins = o.plugins.map((f) => path.join(paths.plugins, path.basename(f)))
    this.creating = { step: 'start', message: 'Preparando…' }
    this.emitStatus()
    try {
      const created = await createServer({ ...o, plugins }, (p) => {
        this.creating = p
        this.emitStatus()
      })
      this.cfg.update((c) => {
        c.minecraft.host = '127.0.0.1'
        c.minecraft.port = created.rconPort
        c.minecraft.password = created.rconPassword
        c.minecraft.version = created.mcVersion
        c.minecraft.server.folder = created.folder
        c.minecraft.server.ramGB = created.ramGB
        c.minecraft.server.software = created.software
        if (o.opPlayer && isValidPlayerName(o.opPlayer)) c.minecraft.server.pendingOp = o.opPlayer
      })
      this.log.info('servidor', `Servidor creado en ${created.folder}`)
      if (o.autoStart) await this.start()
    } catch (err) {
      this.creating = { step: 'error', message: (err as Error).message }
      this.emitStatus()
      throw err
    }
  }

  /** Usar una carpeta de servidor existente: activa RCON y guarda la conexión. */
  async adoptFolder(folder: string): Promise<{ restartNeeded: boolean }> {
    const before = await readRcon(folder)
    const info = await enableRcon(folder)
    let meta: { mcVersion?: string } = {}
    try {
      meta = JSON.parse(await fs.readFile(path.join(folder, SERVER_META_FILE), 'utf8'))
    } catch {
      /* servidor no creado por LiveArena */
    }
    this.cfg.update((c) => {
      c.minecraft.host = '127.0.0.1'
      c.minecraft.port = info.port
      c.minecraft.password = info.password
      c.minecraft.server.folder = folder
      if (meta.mcVersion) c.minecraft.version = meta.mcVersion
    })
    this.emitStatus()
    return { restartNeeded: !before.enabled || before.password !== info.password }
  }

  async start(): Promise<void> {
    const mc = this.cfg.get().minecraft
    if (!mc.server.folder) throw new Error('Primero crea o elige la carpeta del servidor.')
    const jars = (await fs.readdir(mc.server.folder)).filter((f) => f.endsWith('.jar'))
    const jar = jars.includes('server.jar') ? 'server.jar' : jars.find((f) => /paper|spigot|purpur|server|minecraft/i.test(f))
    if (!jar) throw new Error('No encuentro el .jar del servidor en esa carpeta.')
    let java = mc.server.java
    if (!java) {
      const j = await this.javaInfo()
      if (!j.java) throw new Error(`Necesitas Java ${j.required} o superior. Descárgalo de adoptium.net e inténtalo de nuevo.`)
      java = j.java.path
    }
    this.creating = null
    this.proc.start({ folder: mc.server.folder, java, jar, ramGB: mc.server.ramGB })
  }

  async stop(): Promise<void> {
    this.watcher.stop()
    if (this.link.isConnected) {
      await this.link.sendNow('save-all').catch(() => undefined)
    }
    await this.proc.stop()
  }

  private async onServerReady(): Promise<void> {
    this.log.info('servidor', 'Servidor listo. Conectando RCON…')
    try {
      await this.connect()
    } catch (err) {
      this.log.warn('servidor', `RCON: ${(err as Error).message}`)
    }
  }
}
