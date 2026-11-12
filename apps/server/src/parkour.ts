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
  /** No Salpiques: veces que te atrapó la criatura y si te persigue ahora. */
  catches?: number
  monster?: boolean
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

export function parsePkStatus(line: string, tag = 'PKSTATUS'): ParkourGame | null {
  const m = line.match(new RegExp(`${tag}\\s+(.*)`))
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
    catches: n('catches'),
    monster: kv.monster === '1',
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

/** Lo que cambia entre los minijuegos de este tipo (Parkour LIVE, Dropper LIVE…): plugin, comando y ajustes. */
export interface PluginGameOptions {
  /** Nombre del juego para los mensajes. */
  label: string
  /** Jar incluido en la app y nombre en plugins/. */
  bundled: string
  jar: string
  /** Carpeta de datos del plugin (plugins/<carpeta>/config.yml). */
  dataFolder: string
  /** Comando principal (pk, dr) y etiqueta de la línea de estado (PKSTATUS, DRSTATUS). */
  cmd: string
  statusTag: string
  /** Prefijo de las respuestas ([Parkour], [Dropper]). */
  reply: string
  settings: Record<string, SettingType>
  allowed: RegExp[]
  validate?: (values: Record<string, string | number>) => void
}

const PARKOUR_OPTIONS: PluginGameOptions = {
  label: 'Parkour LIVE',
  bundled: BUNDLED_PARKOUR,
  jar: JAR,
  dataFolder: 'ParkourLive',
  cmd: 'pk',
  statusTag: 'PKSTATUS',
  reply: 'Parkour',
  settings: PK_SETTINGS,
  allowed: ALLOWED,
  validate: (values) => {
    if (values['torre.estilo'] !== undefined && !['clasica', 'espiral'].includes(String(values['torre.estilo']))) throw new Error('Estilo de mapa desconocido')
  },
}

/** Juego hecho con un plugin propio: instala el plugin, consulta el estado por RCON y edita los ajustes principales. */
export class PluginGameService {
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
    readonly opts: PluginGameOptions = PARKOUR_OPTIONS,
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
    const jar = this.opts.jar
    const cur = await fs.readFile(path.join(dir, jar)).catch(() => null)
    if (!cur) return (await fs.access(path.join(dir, jar + '.disabled')).then(() => true, () => false)) ? 'disabled' : 'missing'
    const src = await fs.readFile(this.opts.bundled).catch(() => null)
    return src && !src.equals(cur) ? 'outdated' : 'installed'
  }

  private configFile(): string | null {
    const folder = this.folder()
    return folder ? path.join(folder, 'plugins', this.opts.dataFolder, 'config.yml') : null
  }

  get running(): boolean {
    return !!this.game?.running
  }

  async status(): Promise<ParkourStatus> {
    const cf = this.configFile()
    return {
      bundled: await fs.access(this.opts.bundled).then(() => true, () => false),
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
    const src = await fs.readFile(this.opts.bundled).catch(() => null)
    if (!src) throw new Error(`Esta versión de la app no trae el plugin ${this.opts.label} (descarga la última versión)`)
    const dir = path.join(folder, 'plugins')
    await fs.mkdir(dir, { recursive: true })
    await fs.rm(path.join(dir, this.opts.jar + '.disabled'), { force: true })
    await fs.writeFile(path.join(dir, this.opts.jar), src)
    this.log.info('minijuegos', `Plugin ${this.opts.label} instalado en el servidor`)
    this.onChange()
    return { restartNeeded: this.mc.proc.status.state === 'running' || this.mc.link.isConnected }
  }

  async command(cmd: string): Promise<string> {
    const c = cmd.trim().replace(/^\//, '').replace(/\s+/g, ' ')
    if (!this.opts.allowed.some((r) => r.test(c))) throw new Error('Comando no permitido')
    if (!this.mc.link.isConnected) throw new Error('El servidor de Minecraft no está conectado (RCON)')
    const r = await this.mc.link.enqueue(c, 900)
    const clean = r.replace(/§./g, '').trim()
    void this.poll()
    const tag = this.opts.reply
    if (/ERROR/.test(clean)) throw new Error(clean.replace(new RegExp(`^\\[${tag}\\]\\s*ERROR\\s*`), ''))
    if (/Unknown or incomplete command|Unknown command/i.test(clean)) throw new Error(`El servidor no tiene cargado ${this.opts.label}: reinícialo después de instalarlo`)
    return clean.replace(new RegExp(`^\\[${tag}\\]\\s*OK\\s*`), '')
  }

  async getSettings(): Promise<{ exists: boolean; values: Record<string, string | number> }> {
    const f = this.configFile()
    const text = f ? await fs.readFile(f, 'utf8').catch(() => null) : null
    return { exists: text !== null, values: text ? parseYamlSettings(text, this.opts.settings) : {} }
  }

  async saveSettings(values: Record<string, string | number>): Promise<{ reloaded: boolean }> {
    const f = this.configFile()
    const text = f ? await fs.readFile(f, 'utf8').catch(() => null) : null
    if (!f || text === null) throw new Error('Aún no existe la configuración: arranca el servidor una vez con el plugin instalado')
    this.opts.validate?.(values)
    await fs.writeFile(f, writeYamlSettings(text, values, this.opts.settings), 'utf8')
    let reloaded = false
    if (this.mc.link.isConnected && this.loaded) {
      await this.mc.link.enqueue(`${this.opts.cmd} reload`, 10).catch(() => '')
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
      const r = await this.mc.link.enqueue(`${this.opts.cmd} status`, 1)
      const g = parsePkStatus(r.replace(/§./g, ''), this.opts.statusTag)
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

/** Parkour LIVE (torre de 50 niveles). */
export class ParkourService extends PluginGameService {}

/* ─────────────────────────────── Dropper LIVE ─────────────────────────────── */

export const BUNDLED_DROPPER = path.join(ASSETS_DIR, 'plugins', 'DropperLive.jar')

export const DR_SETTINGS: Record<string, SettingType> = {
  'mapa.semilla': 'int',
  'mapa.niveles': 'int',
  'mapa.dificultad': 'number',
  'partida.tiempoLimite': 'int',
  'partida.reiniciarAlGanar': 'bool',
  'partida.segundosCelebracion': 'int',
  'partida.cuentaAtras': 'int',
  'efectos.separacionSegundos': 'number',
  'efectos.empujeFuerza': 'number',
  'efectos.vientoSegundos': 'int',
  'efectos.nieblaSegundos': 'int',
  'efectos.lentoSegundos': 'int',
  'efectos.escudoSegundos': 'int',
  'efectos.guiaSegundos': 'int',
  'efectos.choquesParaProteger': 'int',
}

/** Dropper LIVE: 100 niveles de caída hasta el agua sin tocar ningún bloque. */
export class DropperService extends PluginGameService {
  constructor(cfg: ConfigStore, mc: MinecraftService, log: Logger, onChange: () => void) {
    super(cfg, mc, log, onChange, {
      label: 'Dropper LIVE',
      bundled: BUNDLED_DROPPER,
      jar: 'DropperLive.jar',
      dataFolder: 'DropperLive',
      cmd: 'dr',
      statusTag: 'DRSTATUS',
      reply: 'Dropper',
      settings: DR_SETTINGS,
      allowed: [
        /^dr (start|stop|reload|status)( [A-Za-z0-9_]{1,16})?$/,
        /^dr marcador reiniciar$/,
        /^dr nivel \d{1,3}$/,
        /^dr mapa nuevo( -?\d{1,18})?$/,
        /^dr test [a-z]{1,20}( \d{1,3})?$/,
      ],
    })
  }
}

/* ─────────────────────────────── No Salpiques ─────────────────────────────── */

export const BUNDLED_NOSALPIQUES = path.join(ASSETS_DIR, 'plugins', 'NoSalpiquesLive.jar')

export const NS_SETTINGS: Record<string, SettingType> = {
  'mapa.semilla': 'int',
  'mapa.salas': 'int',
  'mapa.dificultad': 'number',
  'partida.tiempoLimite': 'int',
  'partida.reiniciarAlGanar': 'bool',
  'partida.piedrasAlEmpezar': 'int',
  'partida.bengalasAlEmpezar': 'int',
  'monstruo.velocidad': 'number',
  'monstruo.segundosDespertar': 'int',
  'monstruo.distanciaAtrapar': 'number',
  'sala.segundosHundir': 'number',
  'sala.segundosMemoria': 'int',
  'sala.segundosCrecida': 'number',
  'efectos.separacionSegundos': 'number',
  'efectos.empujeFuerza': 'number',
  'efectos.escudoSegundos': 'int',
  'efectos.salpiconesParaProteger': 'int',
}

/** No Salpiques: salas de piscinas; si tocas el agua, la criatura despierta y te persigue. */
export class NoSalpiquesService extends PluginGameService {
  constructor(cfg: ConfigStore, mc: MinecraftService, log: Logger, onChange: () => void) {
    super(cfg, mc, log, onChange, {
      label: 'No Salpiques',
      bundled: BUNDLED_NOSALPIQUES,
      jar: 'NoSalpiquesLive.jar',
      dataFolder: 'NoSalpiquesLive',
      cmd: 'ns',
      statusTag: 'NSSTATUS',
      reply: 'NoSalpiques',
      settings: NS_SETTINGS,
      allowed: [
        /^ns (start|stop|reload|status)( [A-Za-z0-9_]{1,16})?$/,
        /^ns marcador reiniciar$/,
        /^ns sala \d{1,2}$/,
        /^ns mapa nuevo( -?\d{1,18})?$/,
        /^ns test [a-z]{1,20}( \d{1,3})?$/,
      ],
    })
  }
}
