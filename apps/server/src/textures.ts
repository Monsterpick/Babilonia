import fs from 'node:fs/promises'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { extractTextures, findClientJars, pickClientJar, textureCandidates } from '@livearena/minecraft'
import { paths } from './config.js'
import type { Logger } from './logger.js'

export interface TextureStatus {
  state: 'none' | 'importing' | 'ready' | 'error'
  version?: string
  source?: string
  count?: number
  pct?: number
  message?: string
}

interface Info {
  version: string
  source: string
  count: number
  /** 2: también incluye texturas de entidades (entity/). */
  layout?: number
}

/** Texturas de items sacadas del Minecraft instalado del usuario, en caché en datos/texturas. */
export class TextureService extends EventEmitter {
  private st: TextureStatus = { state: 'none' }
  private resolved = new Map<string, string | null>()
  private dir = ''

  constructor(private log: Logger) {
    super()
  }

  get status(): TextureStatus {
    return this.st
  }

  private set(s: TextureStatus): void {
    this.st = s
    this.emit('status', s)
  }

  /** Al arrancar: usa la caché si existe; si no, intenta importarlas solas en segundo plano. */
  async init(preferVersion?: string): Promise<void> {
    try {
      const info = JSON.parse(await fs.readFile(path.join(paths.textures, 'info.json'), 'utf8')) as Info
      this.dir = path.join(paths.textures, info.version)
      await fs.access(path.join(this.dir, 'item'))
      this.set({ state: 'ready', ...info })
      // Cachés antiguas sin texturas de mobs: se reimportan en segundo plano desde el mismo .jar.
      if ((info.layout ?? 1) < 2) void fs.access(info.source).then(() => this.import(info.source, info.version)).catch(() => undefined)
      return
    } catch {
      /* sin caché */
    }
    const jar = await pickClientJar(preferVersion).catch(() => null)
    if (!jar) {
      this.set({ state: 'none', message: 'No encontré Minecraft instalado. Abre el juego una vez con el lanzador o elige el .jar a mano.' })
      return
    }
    void this.import(jar.file, jar.version).catch(() => undefined)
  }

  async jars() {
    return findClientJars()
  }

  /** Importa desde un .jar concreto (de .minecraft/versions/<v>/<v>.jar). */
  async import(jarFile: string, version?: string): Promise<TextureStatus> {
    if (this.st.state === 'importing') throw new Error('Ya estoy importando las texturas.')
    const v = version ?? path.basename(jarFile, '.jar').replace(/[^\w.-]/g, '') ?? 'manual'
    const dest = path.join(paths.textures, v)
    this.set({ state: 'importing', version: v, source: jarFile, pct: 0, message: 'Extrayendo texturas…' })
    try {
      await fs.rm(dest, { recursive: true, force: true })
      const count = await extractTextures(jarFile, dest, (done, total) => this.set({ ...this.st, pct: Math.round((done / total) * 100) }))
      const info: Info = { version: v, source: jarFile, count, layout: 2 }
      await fs.writeFile(path.join(paths.textures, 'info.json'), JSON.stringify(info, null, 2))
      this.dir = dest
      this.resolved.clear()
      this.set({ state: 'ready', ...info })
      this.log.info('servidor', `Texturas de Minecraft ${v}: ${count} imágenes`)
      return this.st
    } catch (err) {
      this.set({ state: 'error', message: (err as Error).message })
      this.log.warn('servidor', `Texturas: ${(err as Error).message}`)
      throw err
    }
  }

  /** Ruta de una textura por su ruta relativa (block/x.png, entity/zombie/zombie.png…), o null. */
  async raw(rel: string): Promise<string | null> {
    if (this.st.state !== 'ready' || !this.dir) return null
    if (!/^(item|block|entity)\/[a-z0-9_/]+\.png$/.test(rel) || rel.includes('..')) return null
    const f = path.join(this.dir, rel)
    try {
      await fs.access(f)
      return f
    } catch {
      return null
    }
  }

  /** Ruta del PNG para un item, o null si no hay textura. */
  async file(id: string): Promise<string | null> {
    if (this.st.state !== 'ready' || !this.dir) return null
    if (this.resolved.has(id)) return this.resolved.get(id)!
    let found: string | null = null
    for (const rel of textureCandidates(id)) {
      const f = path.join(this.dir, rel)
      try {
        await fs.access(f)
        found = f
        break
      } catch {
        /* siguiente */
      }
    }
    this.resolved.set(id, found)
    return found
  }
}
