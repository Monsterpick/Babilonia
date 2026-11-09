import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { downloadFile, findJavaFor, minecraftDirs } from '@livearena/minecraft'
import type { MinecraftService } from './minecraft-service.js'
import type { ConfigStore } from './config.js'
import type { Logger } from './logger.js'
import { ASSETS_DIR } from './resources.js'
import { paths } from './config.js'

/** Mod cliente «LiveArena Cinemáticas» (compilado en CI). Puede no existir en desarrollo. */
export const BUNDLED_MOD = path.join(ASSETS_DIR, 'mods', 'LiveArena-Cinematicas.jar')
export const MOD_FILE = 'LiveArena-Cinematicas.jar'

/** Versiones probadas juntas: Minecraft 26.1.2 + NeoForge + GeckoLib. */
export const CINE = {
  minecraft: '26.1.2',
  neoforge: '26.1.2.126',
  installer: {
    url: 'https://maven.neoforged.net/releases/net/neoforged/neoforge/26.1.2.126/neoforge-26.1.2.126-installer.jar',
    sha1: 'b1c3eec3468ae94f61d79ea716131eff1d8dbbf5',
    fileName: 'neoforge-26.1.2.126-installer.jar',
  },
  geckolib: {
    url: 'https://cdn.modrinth.com/data/8BmcQJ2H/versions/xfVfPcoC/geckolib-neoforge-26.1.2-5.5.2.jar',
    sha1: '2108a1175f8edb52f30a9b3d6dd42eccf045623f',
    fileName: 'geckolib-neoforge-26.1.2-5.5.2.jar',
  },
}

export interface CineModStatus {
  /** Carpeta .minecraft detectada (null si no hay Minecraft instalado). */
  mcDir: string | null
  launcher: boolean
  neoforge: boolean
  /** ¿Aparece el perfil de NeoForge en el launcher? */
  profile: boolean
  launcherOpen: boolean
  /** ¿Minecraft 26.1.2 normal ya se abrió una vez (recursos/assets descargados)? */
  vanilla: boolean
  mod: 'missing' | 'installed' | 'outdated'
  geckolib: boolean
  bundled: boolean
  /** ¿El jugador conectado tiene el mod cargado? (null = no se sabe: servidor apagado o sin jugador). */
  inGame: boolean | null
  busy: { step: string; message: string; pct?: number } | null
  error: string | null
  versions: typeof CINE
}

const exists = (p: string) => fs.access(p).then(() => true, () => false)

/** Archivos de perfiles: el launcher clásico usa el primero; el de Microsoft Store / Xbox, el segundo. */
export const PROFILE_FILES = ['launcher_profiles.json', 'launcher_profiles_microsoft_store.json']
export const PROFILE_KEY = 'livearena-neoforge'

/** ¿Hay algún perfil del launcher que arranque nuestra versión de NeoForge? */
export async function hasNeoForgeProfile(dir: string): Promise<boolean> {
  for (const f of PROFILE_FILES) {
    const j = await fs.readFile(path.join(dir, f), 'utf8').then((t) => JSON.parse(t) as { profiles?: Record<string, { lastVersionId?: string }> }, () => null)
    if (j?.profiles && Object.values(j.profiles).some((p) => p?.lastVersionId === `neoforge-${CINE.neoforge}`)) return true
  }
  return false
}

/**
 * Añade (o arregla) el perfil «LiveArena · NeoForge» en todos los archivos de perfiles que existan.
 * El instalador oficial solo escribe en launcher_profiles.json, pero el launcher nuevo de Microsoft/Xbox lee
 * launcher_profiles_microsoft_store.json; por eso sin esto el perfil no aparece.
 */
export async function ensureNeoForgeProfile(dir: string): Promise<string[]> {
  const written: string[] = []
  const now = new Date().toISOString()
  let any = false
  for (const f of PROFILE_FILES) {
    const file = path.join(dir, f)
    if (await exists(file)) any = true
  }
  for (const f of PROFILE_FILES) {
    const file = path.join(dir, f)
    if (!(await exists(file)) && !(f === PROFILE_FILES[0] && !any)) continue
    const j = await fs.readFile(file, 'utf8').then((t) => JSON.parse(t) as Record<string, unknown>, () => ({}) as Record<string, unknown>)
    const profiles = (j.profiles ?? {}) as Record<string, Record<string, unknown>>
    const prev = profiles[PROFILE_KEY]
    profiles[PROFILE_KEY] = {
      ...(prev ?? {}),
      name: 'LiveArena · NeoForge',
      type: 'custom',
      lastVersionId: `neoforge-${CINE.neoforge}`,
      icon: 'Furnace_On',
      created: (prev?.created as string) ?? now,
      lastUsed: now,
    }
    j.profiles = profiles
    await fs.writeFile(file, JSON.stringify(j, null, 2), 'utf8')
    written.push(f)
  }
  return written
}

/** ¿Está abierto el launcher de Minecraft? (si lo está, al cerrarse puede borrar el perfil nuevo). */
/** Carpeta y archivo de la versión de NeoForge dentro de .minecraft. */
export const neoforgeJson = (dir: string) => path.join(dir, 'versions', `neoforge-${CINE.neoforge}`, `neoforge-${CINE.neoforge}.json`)

/**
 * ¿La versión de NeoForge está bien? Si una instalación se cortó, el .json queda vacío o roto y el launcher
 * falla con «Unable to prepare assets for download» (no ve las librerías ni los recursos de 26.1.2).
 */
export async function neoforgeValid(dir: string): Promise<boolean> {
  try {
    const raw = (await fs.readFile(neoforgeJson(dir), 'utf8')).replace(/^\uFEFF/, '')
    const j = JSON.parse(raw) as { id?: string; inheritsFrom?: string; libraries?: unknown[] }
    return j.id === `neoforge-${CINE.neoforge}` && j.inheritsFrom === CINE.minecraft && Array.isArray(j.libraries) && j.libraries.length > 0
  } catch {
    return false
  }
}

/** Lee un archivo de dentro de un .jar/.zip (sin dependencias). */
export function readZipEntry(zip: Buffer, name: string): Buffer | null {
  let eocd = -1
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return null
  const count = zip.readUInt16LE(eocd + 10)
  let p = zip.readUInt32LE(eocd + 16)
  for (let n = 0; n < count && zip.readUInt32LE(p) === 0x02014b50; n++) {
    const method = zip.readUInt16LE(p + 10)
    const size = zip.readUInt32LE(p + 20)
    const nameLen = zip.readUInt16LE(p + 28)
    const extraLen = zip.readUInt16LE(p + 30)
    const commentLen = zip.readUInt16LE(p + 32)
    const local = zip.readUInt32LE(p + 42)
    if (zip.toString('utf8', p + 46, p + 46 + nameLen) === name) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
      const data = zip.subarray(start, start + size)
      return method === 0 ? Buffer.from(data) : method === 8 ? inflateRawSync(data) : null
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return null
}

/**
 * El launcher nuevo falla con «Unable to prepare assets for download» si el perfil de NeoForge se abre antes
 * de haber jugado una vez la versión normal: comprobamos que el índice de recursos ya esté descargado.
 */
export async function vanillaReady(dir: string): Promise<boolean> {
  try {
    const v = JSON.parse(await fs.readFile(path.join(dir, 'versions', CINE.minecraft, `${CINE.minecraft}.json`), 'utf8')) as { assetIndex?: { id?: string } }
    const id = v.assetIndex?.id
    return !!id && (await exists(path.join(dir, 'assets', 'indexes', `${id}.json`)))
  } catch {
    return false
  }
}

export async function launcherRunning(): Promise<boolean> {
  if (process.platform !== 'win32') return false
  const out = await new Promise<string>((res) => {
    const p = spawn('tasklist', ['/FO', 'CSV', '/NH'], { windowsHide: true })
    let o = ''
    p.stdout.on('data', (d) => (o += d.toString()))
    p.on('close', () => res(o))
    p.on('error', () => res(''))
  })
  return /"(MinecraftLauncher|Minecraft)\.exe"/i.test(out)
}

/**
 * Instala la parte de cliente de las cinemáticas en el Minecraft del streamer:
 * 1) NeoForge (instalador oficial en modo consola: crea el perfil «NeoForge» en el launcher),
 * 2) GeckoLib y el mod LiveArena en .minecraft/mods.
 * El servidor sigue siendo Paper (plugins y s2e incluidos): el mod se conecta por un canal opcional.
 */
export class CineModService {
  private busy: CineModStatus['busy'] = null
  private error: string | null = null
  private inGameCache = { at: 0, value: null as boolean | null }

  constructor(
    private readonly cfg: ConfigStore,
    private readonly mc: MinecraftService,
    private readonly log: Logger,
    private readonly onChange: () => void,
  ) {}

  async mcDir(): Promise<string | null> {
    const custom = this.cfg.get().minecraft.clientDir
    if (custom && (await exists(custom))) return custom
    for (const d of minecraftDirs()) for (const f of PROFILE_FILES) if (await exists(path.join(d, f))) return d
    for (const d of minecraftDirs()) if (await exists(d)) return d
    return null
  }

  private async sameFile(a: string, b: string): Promise<boolean> {
    const [x, y] = await Promise.all([fs.readFile(a).catch(() => null), fs.readFile(b).catch(() => null)])
    return !!x && !!y && x.equals(y)
  }

  async inGame(): Promise<boolean | null> {
    if (Date.now() - this.inGameCache.at < 5000) return this.inGameCache.value
    let value: boolean | null = null
    const player = this.mc.player
    if (player && this.mc.link.isConnected) {
      const r = await this.mc.link.sendNow(`habilidad mod ${player}`).catch(() => '')
      if (/MOD \S+ si/i.test(r)) value = true
      else if (/MOD \S+ no/i.test(r)) value = false
    }
    this.inGameCache = { at: Date.now(), value }
    return value
  }

  async status(): Promise<CineModStatus> {
    const dir = await this.mcDir()
    const mods = dir ? path.join(dir, 'mods') : null
    const bundled = await exists(BUNDLED_MOD)
    let mod: CineModStatus['mod'] = 'missing'
    if (mods && (await exists(path.join(mods, MOD_FILE)))) mod = bundled && !(await this.sameFile(BUNDLED_MOD, path.join(mods, MOD_FILE))) ? 'outdated' : 'installed'
    return {
      mcDir: dir,
      launcher: !!dir && ((await exists(path.join(dir, PROFILE_FILES[0]!))) || (await exists(path.join(dir, PROFILE_FILES[1]!)))),
      profile: !!dir && (await hasNeoForgeProfile(dir)),
      launcherOpen: await launcherRunning(),
      vanilla: !!dir && (await vanillaReady(dir)),
      neoforge: !!dir && (await neoforgeValid(dir)),
      mod,
      geckolib: !!mods && (await exists(path.join(mods, CINE.geckolib.fileName))),
      bundled,
      inGame: await this.inGame(),
      busy: this.busy,
      error: this.error,
      versions: CINE,
    }
  }

  private step(step: string, message: string, pct?: number) {
    this.busy = { step, message, pct }
    this.onChange()
  }

  private async java(): Promise<string> {
    const configured = this.cfg.get().minecraft.server.java
    if (configured && (await exists(configured))) return configured
    const found = await findJavaFor(CINE.minecraft)
    if (found.java) return found.java.path
    this.step('java', 'Instalando Java 25…')
    return this.mc.installJava(CINE.minecraft)
  }

  private run(java: string, args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const p = spawn(java, args, { cwd, windowsHide: true })
      let out = ''
      p.stdout.on('data', (d) => (out += d.toString()))
      p.stderr.on('data', (d) => (out += d.toString()))
      p.on('error', reject)
      p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(out.split('\n').slice(-6).join('\n') || `código ${code}`))))
    })
  }

  /** Instala (o actualiza) todo lo necesario. Se puede repetir sin problema. */
  async install(): Promise<CineModStatus> {
    if (this.busy) throw new Error('Ya hay una instalación en marcha.')
    this.error = null
    try {
      const dir = await this.mcDir()
      if (!dir) throw new Error('No encuentro tu carpeta .minecraft. Abre el launcher oficial de Minecraft una vez y vuelve a intentarlo.')
      if (await launcherRunning()) throw new Error('Cierra el launcher de Minecraft antes de instalar (si está abierto, al cerrarse borra el perfil nuevo). Luego pulsa otra vez «Instalar».')
      // El instalador oficial necesita launcher_profiles.json aunque uses el launcher de Microsoft/Xbox.
      if (!(await exists(path.join(dir, PROFILE_FILES[0]!)))) await fs.writeFile(path.join(dir, PROFILE_FILES[0]!), JSON.stringify({ profiles: {}, settings: {}, version: 3 }, null, 2), 'utf8')
      if (!(await exists(BUNDLED_MOD))) throw new Error('Esta copia de LiveArena no incluye el mod (solo viene en la versión compilada para Windows).')
      const cache = paths.cache
      await fs.mkdir(cache, { recursive: true })

      if (!(await neoforgeValid(dir))) {
        // Instalación anterior cortada: se borra la versión rota y se vuelve a instalar entera.
        await fs.rm(path.dirname(neoforgeJson(dir)), { recursive: true, force: true })
        const java = await this.java()
        const inst = path.join(cache, CINE.installer.fileName)
        if (!(await exists(inst))) await downloadFile(CINE.installer, inst, (pct) => this.step('neoforge', `Descargando NeoForge ${CINE.neoforge}… ${pct}%`, pct))
        this.step('neoforge', `Instalando NeoForge ${CINE.neoforge} en tu Minecraft (descarga Minecraft ${CINE.minecraft} si hace falta)…`)
        await this.run(java, ['-jar', inst, '--install-client', dir], cache)
        this.log.info('cinematicas', `NeoForge ${CINE.neoforge} instalado en ${dir}`)
      }
      if (!(await neoforgeValid(dir))) {
        // Último recurso: el .json de la versión va dentro del instalador; lo escribimos nosotros.
        const inst = path.join(cache, CINE.installer.fileName)
        const v = (await exists(inst)) ? readZipEntry(await fs.readFile(inst), 'version.json') : null
        if (v) {
          await fs.mkdir(path.dirname(neoforgeJson(dir)), { recursive: true })
          await fs.writeFile(neoforgeJson(dir), v)
          this.log.info('cinematicas', 'Archivo de versión de NeoForge reparado desde el instalador')
        }
      }
      if (!(await neoforgeValid(dir))) throw new Error('El instalador de NeoForge no terminó bien (el archivo de la versión está roto). Cierra el launcher y vuelve a pulsar «Instalar».')
      this.step('perfil', 'Creando el perfil «LiveArena · NeoForge» en el launcher…')
      const files = await ensureNeoForgeProfile(dir)
      this.log.info('cinematicas', `Perfil del launcher añadido en: ${files.join(', ')}`)

      const mods = path.join(dir, 'mods')
      await fs.mkdir(mods, { recursive: true })
      // Quita versiones viejas de GeckoLib para 26.1.2 y del mod.
      for (const f of await fs.readdir(mods)) {
        if (/^geckolib-neoforge-26\.1\.2-.*\.jar$/i.test(f) && f !== CINE.geckolib.fileName) await fs.rm(path.join(mods, f), { force: true })
        if (/^LiveArena-Cinematicas.*\.jar$/i.test(f) && f !== MOD_FILE) await fs.rm(path.join(mods, f), { force: true })
      }
      const gecko = path.join(mods, CINE.geckolib.fileName)
      if (!(await exists(gecko))) await downloadFile(CINE.geckolib, gecko, (pct) => this.step('geckolib', `Descargando GeckoLib… ${pct}%`, pct))
      this.step('mod', 'Copiando el mod LiveArena Cinemáticas…')
      await fs.copyFile(BUNDLED_MOD, path.join(mods, MOD_FILE))
      this.log.info('cinematicas', `Mod LiveArena Cinemáticas y GeckoLib copiados en ${mods}`)
    } catch (err) {
      this.error = (err as Error).message
      this.log.warn('cinematicas', this.error)
    } finally {
      this.busy = null
      this.onChange()
    }
    return this.status()
  }

  /** Quita el mod y GeckoLib de .minecraft/mods (NeoForge se queda; no molesta al Minecraft normal). */
  async uninstall(): Promise<CineModStatus> {
    const dir = await this.mcDir()
    if (dir) {
      await fs.rm(path.join(dir, 'mods', MOD_FILE), { force: true })
      await fs.rm(path.join(dir, 'mods', CINE.geckolib.fileName), { force: true })
    }
    return this.status()
  }
}
