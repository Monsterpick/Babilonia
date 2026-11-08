import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { isValidPlayerName, type Kit } from '@livearena/shared'
import {
  MinecraftLink,
  PlayerWatcher,
  ServerProcess,
  SERVER_META_FILE,
  addJavaRoot,
  createServer,
  enableRcon,
  findJavaFor,
  installJdk,
  kitCommands,
  paperVersions,
  parseVersion,
  readProperties,
  readRcon,
  requiredJava,
  updateProperties,
  validateFolder,
  type CreateServerOptions,
  type McVersion,
} from '@livearena/minecraft'
import type { ConfigStore } from './config.js'
import { DATA_DIR, paths } from './config.js'
import type { Logger } from './logger.js'

export interface CreateRequest extends Omit<CreateServerOptions, 'plugins' | 'javaPath'> {
  plugins: string[]
  autoStart: boolean
  opPlayer?: string
  installJava: boolean
}

/** Reglas del juego que se pueden cambiar desde el panel. */
export const GAME_RULES: { id: string; label: string; type: 'bool' | 'int' }[] = [
  { id: 'keepInventory', label: 'Conservar inventario al morir', type: 'bool' },
  { id: 'doDaylightCycle', label: 'Ciclo de día y noche', type: 'bool' },
  { id: 'doWeatherCycle', label: 'Cambios de clima', type: 'bool' },
  { id: 'doMobSpawning', label: 'Aparición natural de mobs', type: 'bool' },
  { id: 'mobGriefing', label: 'Mobs rompen bloques (creepers…)', type: 'bool' },
  { id: 'doFireTick', label: 'El fuego se propaga', type: 'bool' },
  { id: 'fallDamage', label: 'Daño por caída', type: 'bool' },
  { id: 'naturalRegeneration', label: 'Regeneración natural', type: 'bool' },
  { id: 'showDeathMessages', label: 'Mensajes de muerte', type: 'bool' },
  { id: 'announceAdvancements', label: 'Anunciar logros', type: 'bool' },
  { id: 'doImmediateRespawn', label: 'Reaparecer al instante', type: 'bool' },
  { id: 'randomTickSpeed', label: 'Velocidad de crecimiento (randomTickSpeed)', type: 'int' },
  { id: 'playersSleepingPercentage', label: '% de jugadores durmiendo para pasar la noche', type: 'int' },
]

/**
 * Todo lo de Minecraft: conexión RCON, vigía del jugador, kit, y el servidor local
 * (crear, encender, apagar, ajustes, plugins, reglas). Emite 'status' cuando algo cambia.
 */
export class MinecraftService extends EventEmitter {
  readonly link: MinecraftLink
  readonly watcher: PlayerWatcher
  readonly proc = new ServerProcess()
  private creating: { step: string; pct?: number; message: string } | null = null
  private kitProvider: () => Kit | null = () => null
  private liveMobsCache = { at: 0, count: 0 }
  private serverPort = 25565

  constructor(
    private readonly cfg: ConfigStore,
    private readonly log: Logger,
  ) {
    super()
    addJavaRoot(paths.java)
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
      if (/Unknown|Incorrect|Expected|Invalid|No player was found|Can't find|desconocido|pase vigente/i.test(e.response)) this.log.warn('minecraft', `${e.command} → ${e.response}`)
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
      server: { ...this.proc.status, folder: mc.server.folder, creating: this.creating, ip: lanIp(), port: this.serverPort },
    }
  }

  private emitStatus(): void {
    this.emit('status', this.status())
  }

  async connect(): Promise<void> {
    const mc = this.cfg.get().minecraft
    if (!mc.password) throw new Error('Falta la contraseña RCON. Crea un servidor con el asistente o elige la carpeta de uno que ya tengas.')
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

  /* ------------------------------ Java y versiones ------------------------------ */

  async javaInfo(version = this.cfg.get().minecraft.version) {
    return findJavaFor(version)
  }

  versions = paperVersions

  async installJava(version: string): Promise<string> {
    const feature = requiredJava(version)
    this.creating = { step: 'java', pct: 0, message: `Descargando Java ${feature}…` }
    this.emitStatus()
    try {
      const exe = await installJdk(feature, paths.java, (pct) => {
        this.creating = { step: 'java', pct, message: `Descargando Java ${feature}… ${pct}%` }
        this.emitStatus()
      })
      this.cfg.update((c) => (c.minecraft.server.java = exe))
      this.log.info('servidor', `Java ${feature} instalado en ${exe}`)
      this.creating = { step: 'done', pct: 100, message: `Java ${feature} instalado.` }
      this.emitStatus()
      return exe
    } catch (err) {
      this.creating = { step: 'error', message: `No se pudo instalar Java: ${(err as Error).message}` }
      this.emitStatus()
      throw err
    }
  }

  /* ------------------------------ crear / adoptar ------------------------------ */

  validateFolder = validateFolder

  async create(o: CreateRequest): Promise<void> {
    if (this.creating && !['done', 'error'].includes(this.creating.step)) throw new Error('Ya se está creando un servidor.')
    const plugins = o.plugins.map((f) => path.join(paths.plugins, path.basename(f)))
    this.creating = { step: 'start', message: 'Preparando…' }
    this.emitStatus()
    try {
      let javaPath = ''
      const j = await this.javaInfo(o.mcVersion)
      if (j.java) javaPath = j.java.path === 'java' ? '' : j.java.path
      else if (o.installJava) javaPath = await this.installJava(o.mcVersion)
      else throw new Error(`Necesitas Java ${j.required} o superior (marca «Instalar Java» y lo descargo por ti).`)

      const created = await createServer({ ...o, plugins, javaPath }, (p) => {
        this.creating = p
        this.emitStatus()
      })
      this.cfg.update((c) => {
        c.minecraft.host = '127.0.0.1'
        c.minecraft.port = created.rconPort
        c.minecraft.password = created.rconPassword
        c.minecraft.version = created.mcVersion
        c.minecraft.server.folder = created.folder
        c.minecraft.server.jar = created.jar
        c.minecraft.server.xmxMB = created.xmxMB
        c.minecraft.server.xmsMB = created.xmsMB
        c.minecraft.server.software = created.software
        if (javaPath) c.minecraft.server.java = javaPath
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
    const jar = (await this.listJars(folder))[0] ?? ''
    const fromJar = jar.match(/(\d+\.\d+(?:\.\d+)?)/)?.[1]
    this.cfg.update((c) => {
      c.minecraft.host = '127.0.0.1'
      c.minecraft.port = info.port
      c.minecraft.password = info.password
      c.minecraft.server.folder = folder
      c.minecraft.server.jar = jar
      const v = meta.mcVersion ?? fromJar
      if (v) c.minecraft.version = v
    })
    this.emitStatus()
    return { restartNeeded: !before.enabled || before.password !== info.password }
  }

  /* ------------------------------ encender / apagar ------------------------------ */

  private async listJars(folder: string): Promise<string[]> {
    try {
      const jars = (await fs.readdir(folder)).filter((f) => f.toLowerCase().endsWith('.jar'))
      return jars.sort((a, b) => Number(/paper|purpur|spigot|server/i.test(b)) - Number(/paper|purpur|spigot|server/i.test(a)))
    } catch {
      return []
    }
  }

  private async resolveJar(): Promise<string> {
    const s = this.cfg.get().minecraft.server
    if (s.jar) {
      const p = path.isAbsolute(s.jar) ? s.jar : path.join(s.folder, s.jar)
      try {
        await fs.access(p)
        return p
      } catch {
        throw new Error(`No encuentro el .jar del servidor: ${p}`)
      }
    }
    const jar = (await this.listJars(s.folder))[0]
    if (!jar) throw new Error('No encuentro el .jar del servidor en esa carpeta.')
    return path.join(s.folder, jar)
  }

  async start(): Promise<void> {
    const mc = this.cfg.get().minecraft
    if (!mc.server.folder) throw new Error('Primero crea o elige la carpeta del servidor.')
    const jar = await this.resolveJar()
    let java = mc.server.java
    if (java) {
      try {
        await fs.access(java)
      } catch {
        java = ''
      }
    }
    if (!java) {
      const j = await this.javaInfo()
      if (!j.java) throw new Error(`Necesitas Java ${j.required} o superior. Pulsa «Instalar Java» en Servidor y lo descargo por ti.`)
      java = j.java.path
    }
    const props = await readProperties(path.join(mc.server.folder, 'server.properties'))
    this.serverPort = Number(props.get('server-port') ?? 25565) || 25565
    if (props.size > 0 && props.get('enable-rcon') !== 'true') await enableRcon(mc.server.folder)
    await this.syncPluginConfigs()
    this.creating = null
    this.proc.start({ folder: mc.server.folder, java, jar, xmxMB: mc.server.xmxMB, xmsMB: mc.server.xmsMB })
  }

  async stop(): Promise<void> {
    this.watcher.stop()
    if (this.link.isConnected) await this.link.sendNow('save-all').catch(() => undefined)
    await this.proc.stop()
  }

  private async onServerReady(): Promise<void> {
    this.log.info('servidor', 'Servidor listo. Conectando RCON…')
    try {
      const info = await readRcon(this.cfg.get().minecraft.server.folder)
      this.cfg.update((c) => {
        c.minecraft.port = info.port
        if (info.password) c.minecraft.password = info.password
      })
      await this.connect()
    } catch (err) {
      this.log.warn('servidor', `RCON: ${(err as Error).message}`)
    }
  }

  /** Escribe tu nick en la config de plugins que lo necesitan (s2e-survival: player_name). */
  async syncPluginConfigs(): Promise<void> {
    const { folder } = this.cfg.get().minecraft.server
    const player = this.player
    if (!folder || !player) return
    const file = path.join(folder, 'plugins', 's2e-survival', 'config.yml')
    try {
      const text = await fs.readFile(file, 'utf8')
      const next = /^player_name:.*$/m.test(text) ? text.replace(/^player_name:.*$/m, `player_name: '${player}'`) : `player_name: '${player}'\n${text}`
      if (next !== text) {
        await fs.writeFile(file, next, 'utf8')
        this.log.info('servidor', `s2e-survival: player_name = ${player}`)
      }
    } catch {
      /* plugin no instalado o sin config todavía */
    }
  }

  /* ------------------------------ ajustes del servidor ------------------------------ */

  private requireFolder(): string {
    const f = this.cfg.get().minecraft.server.folder
    if (!f) throw new Error('Todavía no hay servidor: créalo o elige su carpeta.')
    return f
  }

  async getSettings() {
    const folder = this.requireFolder()
    const s = this.cfg.get().minecraft.server
    const props = await readProperties(path.join(folder, 'server.properties'))
    return {
      folder,
      jar: s.jar,
      jars: await this.listJars(folder),
      java: s.java,
      xmxMB: s.xmxMB,
      xmsMB: s.xmsMB,
      levelName: props.get('level-name') ?? 'world',
      onlineMode: props.get('online-mode') !== 'false',
      motd: props.get('motd') ?? '',
      maxPlayers: Number(props.get('max-players') ?? 20),
      difficulty: props.get('difficulty') ?? 'normal',
      pvp: props.get('pvp') !== 'false',
      serverPort: Number(props.get('server-port') ?? 25565),
    }
  }

  async saveSettings(
    v: Partial<{ jar: string; java: string; xmxMB: number; xmsMB: number; levelName: string; onlineMode: boolean; motd: string; maxPlayers: number; difficulty: string; pvp: boolean }>,
  ) {
    const folder = this.requireFolder()
    this.cfg.update((c) => {
      if (v.jar !== undefined) c.minecraft.server.jar = v.jar
      if (v.java !== undefined) c.minecraft.server.java = v.java
      if (v.xmxMB !== undefined) c.minecraft.server.xmxMB = v.xmxMB
      if (v.xmsMB !== undefined) c.minecraft.server.xmsMB = Math.min(v.xmsMB, v.xmxMB ?? c.minecraft.server.xmxMB)
    })
    const props: Record<string, string | number | boolean> = {}
    if (v.levelName !== undefined) props['level-name'] = v.levelName.replace(/[\\/:*?"<>|]/g, '_') || 'world'
    if (v.onlineMode !== undefined) props['online-mode'] = v.onlineMode
    if (v.motd !== undefined) props.motd = v.motd.replace(/[\r\n]/g, ' ')
    if (v.maxPlayers !== undefined) props['max-players'] = v.maxPlayers
    if (v.difficulty !== undefined) props.difficulty = v.difficulty
    if (v.pvp !== undefined) props.pvp = v.pvp
    if (Object.keys(props).length) await updateProperties(path.join(folder, 'server.properties'), props)
    const jarVersion = v.jar?.match(/(\d+\.\d+(?:\.\d+)?)/)?.[1]
    if (jarVersion) this.cfg.update((c) => (c.minecraft.version = jarVersion))
    this.emitStatus()
    return this.getSettings()
  }

  async readPropertiesText(): Promise<string> {
    return fs.readFile(path.join(this.requireFolder(), 'server.properties'), 'utf8').catch(() => '')
  }

  async writePropertiesText(text: string): Promise<void> {
    if (text.length > 100_000) throw new Error('Archivo demasiado grande')
    await fs.writeFile(path.join(this.requireFolder(), 'server.properties'), text.replace(/\r\n/g, '\n'), 'utf8')
  }

  /* ------------------------------ plugins del servidor ------------------------------ */

  private pluginsDir(): string {
    return path.join(this.requireFolder(), 'plugins')
  }

  async listServerPlugins(): Promise<{ file: string; name: string; enabled: boolean; size: number }[]> {
    const dir = this.pluginsDir()
    await fs.mkdir(dir, { recursive: true })
    const files = (await fs.readdir(dir)).filter((f) => /\.jar(\.disabled)?$/i.test(f))
    return Promise.all(
      files.map(async (f) => ({ file: f, name: f.replace(/\.jar(\.disabled)?$/i, ''), enabled: !f.endsWith('.disabled'), size: (await fs.stat(path.join(dir, f))).size })),
    )
  }

  async togglePlugin(file: string, enabled: boolean): Promise<void> {
    const dir = this.pluginsDir()
    const base = path.basename(file).replace(/\.disabled$/i, '')
    const from = path.join(dir, path.basename(file))
    const to = path.join(dir, enabled ? base : `${base}.disabled`)
    if (from !== to) await fs.rename(from, to)
  }

  async removePlugin(file: string): Promise<void> {
    await fs.rm(path.join(this.pluginsDir(), path.basename(file)), { force: true })
  }

  async installFromLibrary(file: string): Promise<void> {
    const dir = this.pluginsDir()
    await fs.mkdir(dir, { recursive: true })
    await fs.copyFile(path.join(paths.plugins, path.basename(file)), path.join(dir, path.basename(file)))
  }

  async savePluginToServer(name: string, data: Buffer): Promise<void> {
    const dir = this.pluginsDir()
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, path.basename(name)), data)
  }

  async listPluginLibrary(): Promise<{ file: string; name: string; size: number }[]> {
    const files = (await fs.readdir(paths.plugins)).filter((f) => f.toLowerCase().endsWith('.jar'))
    return Promise.all(files.map(async (f) => ({ file: f, name: f.replace(/\.jar$/i, ''), size: (await fs.stat(path.join(paths.plugins, f))).size })))
  }

  /* ------------------------------ reglas del juego ------------------------------ */

  async getGameRules(): Promise<{ id: string; label: string; type: 'bool' | 'int'; value: string | null }[]> {
    if (!this.link.isConnected) throw new Error('Enciende el servidor (o conecta RCON) para ver las reglas del juego.')
    const out = []
    for (const r of GAME_RULES) {
      const res = await this.link.sendNow(`gamerule ${r.id}`).catch(() => '')
      const m = res.match(/(?:currently set to|set to|:)\s*(\w+)\s*\.?$/i)
      out.push({ ...r, value: m ? m[1]! : null })
    }
    return out
  }

  async setGameRule(id: string, value: string): Promise<string> {
    const rule = GAME_RULES.find((r) => r.id === id)
    if (!rule) throw new Error('Regla desconocida')
    const v = rule.type === 'bool' ? (value === 'true' ? 'true' : 'false') : String(Math.max(0, Math.min(1000, Math.round(Number(value) || 0))))
    return this.link.enqueue(`gamerule ${id} ${v}`, 1000)
  }

  /* ------------------------------ sistema ------------------------------ */

  /** Abre una carpeta conocida en el explorador del sistema (nunca rutas arbitrarias). */
  async openFolder(target: 'server' | 'plugins' | 'data' | 'media'): Promise<string> {
    const dir = target === 'server' ? this.requireFolder() : target === 'plugins' ? this.pluginsDir() : target === 'media' ? paths.media : DATA_DIR
    await fs.mkdir(dir, { recursive: true })
    const cmd = process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open'
    spawn(cmd, [dir], { detached: true, stdio: 'ignore' }).on('error', () => undefined).unref()
    return dir
  }
}

/** IP de la red local (para que otros jugadores de tu casa entren). */
export function lanIp(): string {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list ?? []) if (i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254')) return i.address
  }
  return '127.0.0.1'
}
