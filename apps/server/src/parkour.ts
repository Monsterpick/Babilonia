import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { MinecraftService } from './minecraft-service.js'
import type { ConfigStore } from './config.js'
import type { Logger } from './logger.js'
import { ASSETS_DIR } from './resources.js'
import { parseYamlSettings, writeYamlSettings, type SettingType } from './minigames.js'

/** Plugin del minijuego Parkour LIVE (compilado en CI con Gradle). Puede no existir en desarrollo. */
export const BUNDLED_PARKOUR = path.join(ASSETS_DIR, 'plugins', 'ParkourLive.jar')
const JAR = 'ParkourLive.jar'

/** Lo que devuelve «/pk status» (una línea PKSTATUS clave=valor). */
export interface ParkourGame {
  running: boolean
  built: boolean
  building: boolean
  buildPct: number
  level: number
  levels: number
  /** Progreso total de la torre (0..1) y dentro del nivel actual. */
  progress: number
  levelProgress: number
  falls: number
  time: number
  /** Segundos de límite (0 = sin límite). */
  limit: number
  ganadas: number
  perdidas: number
  queue: number
  shield: boolean
  protected: boolean
  won: boolean
  theme: string
  color: string
  streamer: string
  /** Color de cada nivel (para dibujar la torre en el overlay). */
  colors: string[]
}

export interface ParkourStatus {
  bundled: boolean
  plugin: 'no-server' | 'missing' | 'installed' | 'outdated' | 'disabled'
  loaded: boolean | null
  config: boolean
  game: ParkourGame | null
  error: string | null
}

/** Ajustes de config.yml editables desde la app. */
export const PK_SETTINGS: Record<string, SettingType> = {
  'torre.estilo': 'string',
  'torre.semilla': 'int',
  'torre.niveles': 'int',
  'torre.dificultad': 'number',
  'partida.tiempoLimite': 'int',
  'partida.reiniciarAlGanar': 'bool',
  'partida.segundosCelebracion': 'int',
  'partida.visionNocturna': 'bool',
  'efectos.separacionSegundos': 'number',
  'efectos.empujeFuerza': 'number',
  'efectos.vientoSegundos': 'int',
  'efectos.nieblaSegundos': 'int',
  'efectos.hieloSegundos': 'int',
  'efectos.fantasmaSegundos': 'int',
  'efectos.escudoSegundos': 'int',
  'efectos.caidasParaProteger': 'int',
}

export function parsePkStatus(line: string): ParkourGame | null {
  const m = line.match(/PKSTATUS\s+(.*)/)
  if (!m) return null
  const kv: Record<string, string> = {}
  for (const part of m[1]!.trim().split(/\s+/)) {
    const eq = part.indexOf('=')
    if (eq > 0) kv[part.slice(0, eq)] = part.slice(eq + 1)
  }
  const n = (k: string) => Number(kv[k] ?? 0) || 0
  const hex = (v: string | undefined) => (v && /^[0-9A-Fa-f]{6}$/.test(v) ? `#${v.toUpperCase()}` : '#888888')
  return {
    running: kv.running === '1',
    built: kv.built === '1',
    building: kv.building === '1',
    buildPct: n('buildPct'),
    level: n('level') || 1,
    levels: n('levels') || 50,
    progress: Math.max(0, Math.min(1, n('progress'))),
    levelProgress: Math.max(0, Math.min(1, n('levelProgress'))),
    falls: n('falls'),
    time: n('time'),
    limit: n('limit'),
    ganadas: n('ganadas'),
    perdidas: n('perdidas'),
    queue: n('queue'),
    shield: kv.shield === '1',
    protected: kv.protected === '1',
    won: kv.won === '1',
    theme: (kv.theme ?? '').replace(/_/g, ' '),
    color: hex(kv.color),
    streamer: kv.streamer && kv.streamer !== '-' ? kv.streamer : '',
    colors: (kv.colors ?? '').split(',').filter(Boolean).map(hex),
  }
}

/** Comandos que la app puede mandar por el panel (nada arbitrario). */
const ALLOWED = [
  /^pk (start|stop|reload|status|tp)( [A-Za-z0-9_]{1,16})?$/,
  /^pk marcador reiniciar$/,
  /^pk nivel \d{1,3}$/,
  /^pk torre generar( -?\d{1,18})?$/,
  /^pk test [a-z]{1,20}( \d{1,3})?$/,
]

/** Parkour LIVE: instala el plugin, consulta el estado por RCON y edita los ajustes principales. */
export class ParkourService {
  private game: ParkourGame | null = null
  private loaded: boolean | null = null
  private error: string | null = null
  private polling = false
  previousProfile: string | null = null

  constructor(
    private readonly cfg: ConfigStore,
    private readonly mc: MinecraftService,
    private readonly log: Logger,
    private readonly onChange: () => void,
  ) {
    setInterval(() => void this.poll(), 1500).unref()
  }

  private folder(): string | null {
    return this.cfg.get().minecraft.server.folder || null
  }

  private async pluginState(): Promise<ParkourStatus['plugin']> {
    const folder = this.folder()
    if (!folder) return 'no-server'
    const dir = path.join(folder, 'plugins')
    const cur = await fs.readFile(path.join(dir, JAR)).catch(() => null)
    if (!cur) return (await fs.access(path.join(dir, JAR + '.disabled')).then(() => true, () => false)) ? 'disabled' : 'missing'
    const src = await fs.readFile(BUNDLED_PARKOUR).catch(() => null)
    return src && !src.equals(cur) ? 'outdated' : 'installed'
  }

  private configFile(): string | null {
    const folder = this.folder()
    return folder ? path.join(folder, 'plugins', 'ParkourLive', 'config.yml') : null
  }

  get running(): boolean {
    return !!this.game?.running
  }

  async status(): Promise<ParkourStatus> {
    const cf = this.configFile()
    return {
      bundled: await fs.access(BUNDLED_PARKOUR).then(() => true, () => false),
      plugin: await this.pluginState(),
      loaded: this.loaded,
      config: cf ? await fs.access(cf).then(() => true, () => false) : false,
      game: this.game,
      error: this.error,
    }
  }

  async install(): Promise<{ restartNeeded: boolean }> {
    const folder = this.folder()
    if (!folder) throw new Error('Primero crea o elige tu servidor en la pestaña Servidor')
    const src = await fs.readFile(BUNDLED_PARKOUR).catch(() => null)
    if (!src) throw new Error('Esta versión de la app no trae el plugin Parkour LIVE (descarga la última versión)')
    const dir = path.join(folder, 'plugins')
    await fs.mkdir(dir, { recursive: true })
    await fs.rm(path.join(dir, JAR + '.disabled'), { force: true })
    await fs.writeFile(path.join(dir, JAR), src)
    this.log.info('minijuegos', 'Plugin Parkour LIVE instalado en el servidor')
    this.onChange()
    return { restartNeeded: this.mc.proc.status.state === 'running' || this.mc.link.isConnected }
  }

  async command(cmd: string): Promise<string> {
    const c = cmd.trim().replace(/^\//, '').replace(/\s+/g, ' ')
    if (!ALLOWED.some((r) => r.test(c))) throw new Error('Comando no permitido')
    if (!this.mc.link.isConnected) throw new Error('El servidor de Minecraft no está conectado (RCON)')
    const r = await this.mc.link.enqueue(c, 900)
    const clean = r.replace(/§./g, '').trim()
    void this.poll()
    if (/ERROR/.test(clean)) throw new Error(clean.replace(/^\[Parkour\]\s*ERROR\s*/, ''))
    if (/Unknown or incomplete command|Unknown command/i.test(clean)) throw new Error('El servidor no tiene cargado Parkour LIVE: reinícialo después de instalarlo')
    return clean.replace(/^\[Parkour\]\s*OK\s*/, '')
  }

  async getSettings(): Promise<{ exists: boolean; values: Record<string, string | number> }> {
    const f = this.configFile()
    const text = f ? await fs.readFile(f, 'utf8').catch(() => null) : null
    return { exists: text !== null, values: text ? parseYamlSettings(text, PK_SETTINGS) : {} }
  }

  async saveSettings(values: Record<string, string | number>): Promise<{ reloaded: boolean }> {
    const f = this.configFile()
    const text = f ? await fs.readFile(f, 'utf8').catch(() => null) : null
    if (!f || text === null) throw new Error('Aún no existe la configuración: arranca el servidor una vez con el plugin instalado')
    if (values['torre.estilo'] !== undefined && !['clasica', 'espiral'].includes(String(values['torre.estilo']))) throw new Error('Estilo de mapa desconocido')
    await fs.writeFile(f, writeYamlSettings(text, values, PK_SETTINGS), 'utf8')
    let reloaded = false
    if (this.mc.link.isConnected && this.loaded) {
      await this.mc.link.enqueue('pk reload', 10).catch(() => '')
      reloaded = true
    }
    return { reloaded }
  }

  private async poll(): Promise<void> {
    if (this.polling) return
    this.polling = true
    try {
      if (!this.mc.link.isConnected) {
        const changed = this.loaded !== null || this.game !== null
        this.loaded = null
        this.game = null
        if (changed) this.onChange()
        return
      }
      const plugin = await this.pluginState()
      if (plugin !== 'installed' && plugin !== 'outdated') {
        if (this.loaded !== false || this.game) {
          this.loaded = false
          this.game = null
          this.onChange()
        }
        return
      }
      const r = await this.mc.link.enqueue('pk status', 1)
      const g = parsePkStatus(r.replace(/§./g, ''))
      const before = JSON.stringify([this.loaded, this.game])
      this.loaded = g !== null
      this.game = g
      this.error = null
      if (JSON.stringify([this.loaded, this.game]) !== before) this.onChange()
    } catch (e) {
      this.error = (e as Error).message
    } finally {
      this.polling = false
    }
  }
}
