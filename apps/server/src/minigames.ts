import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { MinecraftService } from './minecraft-service.js'
import type { ConfigStore } from './config.js'
import type { Logger } from './logger.js'
import { ASSETS_DIR } from './resources.js'

/** Plugin del minijuego Base Defense (compilado en CI con Gradle). Puede no existir en desarrollo. */
export const BUNDLED_BASE_DEFENSE = path.join(ASSETS_DIR, 'plugins', 'BaseDefense.jar')
const JAR = 'BaseDefense.jar'

/** Lo que devuelve «/bd status» (una línea BDSTATUS clave=valor). */
export interface BaseDefenseGame {
  running: boolean
  arena: boolean
  generating: boolean
  round: number
  time: number
  paused: boolean
  hp: number
  max: number
  wins: number
  /** Rondas sobrevividas y bases destruidas (el plugin las cuenta solo). */
  ganadas: number
  perdidas: number
  /** Nivel de amenaza por donaciones (1 = sin donaciones). */
  amenaza: number
  mobs: number
  queue: number
  bosses: number
  phase: number
  wave: number
  kills: number
  likes: number
  likesMissing: number
  streamer: string
  tps: number
}

export interface MinigamesStatus {
  baseDefense: {
    /** ¿La app trae el .jar del plugin? */
    bundled: boolean
    /** Estado del .jar en la carpeta plugins/ del servidor. */
    plugin: 'no-server' | 'missing' | 'installed' | 'outdated' | 'disabled'
    /** ¿El servidor lo tiene cargado ahora mismo? (null = no se sabe: servidor apagado o sin RCON) */
    loaded: boolean | null
    /** ¿Existe plugins/BaseDefense/config.yml? (el plugin lo crea al arrancar la primera vez) */
    config: boolean
    game: BaseDefenseGame | null
    error: string | null
  }
}

/** Ajustes de config.yml que se pueden cambiar desde la app (ruta YAML → tipo). */
export const BD_SETTINGS = {
  'base.vida': 'int',
  'ronda.duracion': 'int',
  'base.pausaAlCaer': 'int',
  'mobs.tope': 'int',
  'mobs.hordaGrande': 'int',
  'mobs.etiqueta': 'string',
  'recompensa.bajas': 'int',
  'recompensa.incremento': 'int',
  'recompensa.danioDobleSegundos': 'int',
  'likes.meta': 'int',
  'likes.jefe': 'string',
  'mundo.hora': 'int',
  'mundo.clima': 'string',
  'mundo.bioma': 'string',
  'arena.semilla': 'int',
  'arena.largo': 'int',
  'arena.ancho': 'int',
  'arena.densidadDecorado': 'number',
  'arena.luzCarril': 'int',
} as const
export type BdSettingKey = keyof typeof BD_SETTINGS
export type BdSettings = Partial<Record<BdSettingKey, string | number>>

/* ---------------------------- YAML mínimo (2 niveles) ---------------------------- */

/** Busca «seccion:\n  clave: valor» y devuelve el índice de la línea de la clave (o -1). */
function findKey(lines: string[], key: string): number {
  const [sec, k] = key.split('.') as [string, string]
  let inSec = false
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!
    if (/^\S/.test(l) && !l.startsWith('#')) inSec = l.trim() === `${sec}:`
    else if (inSec && new RegExp(`^  ${k}:`).test(l)) return i
  }
  return -1
}

function unquote(v: string): string {
  v = v.replace(/\s+#.*$/, '').trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  return v
}

export function parseBdSettings(text: string): BdSettings {
  const lines = text.split(/\r?\n/)
  const out: BdSettings = {}
  for (const [key, type] of Object.entries(BD_SETTINGS) as [BdSettingKey, string][]) {
    const i = findKey(lines, key)
    if (i < 0) continue
    const raw = unquote(lines[i]!.slice(lines[i]!.indexOf(':') + 1))
    out[key] = type === 'string' ? raw : Number(raw)
  }
  return out
}

/** Cambia solo los valores indicados, respetando comentarios y el resto del archivo. */
export function writeBdSettings(text: string, values: BdSettings): string {
  const lines = text.split(/\r?\n/)
  for (const [key, value] of Object.entries(values) as [BdSettingKey, string | number][]) {
    const type = BD_SETTINGS[key]
    if (!type || value === undefined || value === null || value === '') continue
    const i = findKey(lines, key)
    if (i < 0) continue
    let v: string
    if (type === 'string') v = JSON.stringify(String(value).slice(0, 120))
    else {
      const n = Number(value)
      if (!Number.isFinite(n)) continue
      v = type === 'int' ? String(Math.round(n)) : String(n)
    }
    const k = key.split('.')[1]!
    const comment = lines[i]!.match(/\s+#.*$/)?.[0] ?? ''
    lines[i] = `  ${k}: ${v}${comment}`
  }
  return lines.join('\n')
}

export function parseBdStatus(line: string): BaseDefenseGame | null {
  const m = line.match(/BDSTATUS\s+(.*)/)
  if (!m) return null
  const kv: Record<string, string> = {}
  for (const part of m[1]!.trim().split(/\s+/)) {
    const eq = part.indexOf('=')
    if (eq > 0) kv[part.slice(0, eq)] = part.slice(eq + 1)
  }
  const n = (k: string) => Number(kv[k] ?? 0) || 0
  return {
    running: kv.running === '1',
    arena: kv.arena === '1',
    generating: kv.generating === '1',
    round: n('round'),
    time: n('time'),
    paused: kv.paused === '1',
    hp: n('hp'),
    max: n('max'),
    wins: n('wins'),
    ganadas: kv.ganadas !== undefined ? n('ganadas') : Math.max(0, n('wins')),
    perdidas: kv.perdidas !== undefined ? n('perdidas') : Math.max(0, -n('wins')),
    amenaza: n('amenaza') || 1,
    mobs: n('mobs'),
    queue: n('queue'),
    bosses: n('bosses'),
    phase: n('phase') || 1,
    wave: n('wave'),
    kills: n('kills'),
    likes: n('likes'),
    likesMissing: n('likesMissing'),
    streamer: kv.streamer && kv.streamer !== '-' ? kv.streamer : '',
    tps: n('tps'),
  }
}

/** Comandos que la app puede mandar por el panel (nada arbitrario). */
const ALLOWED = [
  /^bd (start|stop|reload|status|tp|armas)( [A-Za-z0-9_]{1,16})?$/,
  /^bd marcador reiniciar$/,
  /^bd arena (generate|regen|clear)( -?\d{1,18})?$/,
  /^bd test [a-z_]{1,20}( [a-z0-9_]{1,20})?$/,
]

/**
 * Minijuegos (por ahora Base Defense): instala el plugin en el servidor, consulta el estado de la partida por RCON,
 * reenvía el total de likes del directo (/ttlikes) y edita los ajustes principales de config.yml.
 */
export class MinigamesService {
  private game: BaseDefenseGame | null = null
  private loaded: boolean | null = null
  private error: string | null = null
  private lastLikesSent = -1
  private lastLikesAt = 0
  private polling = false
  /** Perfil que estaba activo antes de empezar Base Defense (se recupera al terminar). */
  previousProfile: string | null = null

  constructor(
    private readonly cfg: ConfigStore,
    private readonly mc: MinecraftService,
    private readonly log: Logger,
    private readonly roomLikes: () => number,
    private readonly onChange: () => void,
  ) {
    setInterval(() => void this.poll(), 2000).unref()
  }

  private folder(): string | null {
    return this.cfg.get().minecraft.server.folder || null
  }

  private async pluginState(): Promise<MinigamesStatus['baseDefense']['plugin']> {
    const folder = this.folder()
    if (!folder) return 'no-server'
    const dir = path.join(folder, 'plugins')
    const cur = await fs.readFile(path.join(dir, JAR)).catch(() => null)
    if (!cur) return (await fs.access(path.join(dir, JAR + '.disabled')).then(() => true, () => false)) ? 'disabled' : 'missing'
    const src = await fs.readFile(BUNDLED_BASE_DEFENSE).catch(() => null)
    return src && !src.equals(cur) ? 'outdated' : 'installed'
  }

  private configFile(): string | null {
    const folder = this.folder()
    return folder ? path.join(folder, 'plugins', 'BaseDefense', 'config.yml') : null
  }

  async status(): Promise<MinigamesStatus> {
    const cf = this.configFile()
    return {
      baseDefense: {
        bundled: await fs.access(BUNDLED_BASE_DEFENSE).then(() => true, () => false),
        plugin: await this.pluginState(),
        loaded: this.loaded,
        config: cf ? await fs.access(cf).then(() => true, () => false) : false,
        game: this.game,
        error: this.error,
      },
    }
  }

  /** Copia (o actualiza) BaseDefense.jar en plugins/. Hace falta reiniciar el servidor para cargarlo. */
  async install(): Promise<{ restartNeeded: boolean }> {
    const folder = this.folder()
    if (!folder) throw new Error('Primero crea o elige tu servidor en la pestaña Servidor')
    const src = await fs.readFile(BUNDLED_BASE_DEFENSE).catch(() => null)
    if (!src) throw new Error('Esta versión de la app no trae el plugin Base Defense (descarga la última versión)')
    const dir = path.join(folder, 'plugins')
    await fs.mkdir(dir, { recursive: true })
    await fs.rm(path.join(dir, JAR + '.disabled'), { force: true })
    await fs.writeFile(path.join(dir, JAR), src)
    this.log.info('minijuegos', 'Plugin Base Defense instalado en el servidor')
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
    if (/ERROR/.test(clean)) throw new Error(clean.replace(/^\[BaseDefense\]\s*ERROR\s*/, ''))
    if (/Unknown or incomplete command|Unknown command/i.test(clean)) throw new Error('El servidor no tiene cargado Base Defense: reinícialo después de instalarlo')
    return clean.replace(/^\[BaseDefense\]\s*OK\s*/, '')
  }

  async getSettings(): Promise<{ exists: boolean; values: BdSettings }> {
    const f = this.configFile()
    const text = f ? await fs.readFile(f, 'utf8').catch(() => null) : null
    return { exists: text !== null, values: text ? parseBdSettings(text) : {} }
  }

  async saveSettings(values: BdSettings): Promise<{ reloaded: boolean }> {
    const f = this.configFile()
    const text = f ? await fs.readFile(f, 'utf8').catch(() => null) : null
    if (!f || text === null) throw new Error('Aún no existe la configuración: arranca el servidor una vez con el plugin instalado')
    await fs.writeFile(f, writeBdSettings(text, values), 'utf8')
    let reloaded = false
    if (this.mc.link.isConnected && this.loaded) {
      await this.mc.link.enqueue('bd reload', 10).catch(() => '')
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
      const r = await this.mc.link.enqueue('bd status', 1)
      const g = parseBdStatus(r.replace(/§./g, ''))
      const before = JSON.stringify([this.loaded, this.game])
      this.loaded = g !== null
      this.game = g
      this.error = null
      if (JSON.stringify([this.loaded, this.game]) !== before) this.onChange()
      // Meta de likes: el plugin la lleva; la app le pasa el total del directo (como mucho cada 1,5 s).
      if (g?.running) {
        const likes = this.roomLikes()
        if (likes !== this.lastLikesSent && Date.now() - this.lastLikesAt > 1500) {
          this.lastLikesSent = likes
          this.lastLikesAt = Date.now()
          await this.mc.link.enqueue(`ttlikes ${Math.max(0, Math.floor(likes))}`, 2).catch(() => '')
        }
      }
    } catch (e) {
      this.error = (e as Error).message
    } finally {
      this.polling = false
    }
  }
}
