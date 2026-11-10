import fs from 'node:fs/promises'
import path from 'node:path'
import type { RawGift } from '@livearena/shared'

import { ASSETS_DIR } from './resources.js'
export { ASSETS_DIR }

export interface GiftInfo {
  id?: number
  name: string
  diamonds: number
  /** URL servible: /gifts/archivo.webp (local) o la de TikTok. */
  image?: string
  /** El icono incluido es genérico (no es el de TikTok): se sustituye por el real en cuanto se ve en un directo. */
  generic?: boolean
}

const norm = (s: string) => s.toLowerCase().replace(/[\s_\-'’.]+/g, '')

/**
 * Catálogo de regalos de TikTok: imágenes incluidas en la app (funciona sin conexión y en el
 * simulador) + lo que se aprende en vivo del conector (id real, imagen actual, regalos nuevos).
 */
export class GiftCatalog {
  private byName = new Map<string, GiftInfo>()
  /** Iconos reales aprendidos de TikTok (nombre normalizado → datos); se guardan para la próxima vez. */
  private learned = new Map<string, { id?: number; name: string; diamonds: number; image: string }>()
  private saveTimer: NodeJS.Timeout | null = null

  /** `learnedFile`: dónde recordar los iconos reales aprendidos en directo (opcional). */
  constructor(private readonly learnedFile?: string) {}

  async init(): Promise<void> {
    try {
      const list = JSON.parse(await fs.readFile(path.join(ASSETS_DIR, 'gifts.json'), 'utf8')) as { name: string; diamonds: number; image: string | null; generic?: boolean }[]
      for (const g of list) {
        const key = norm(g.name)
        const prev = this.byName.get(key)
        // Si hay varios con el mismo nombre (regiones), nos quedamos con el de más diamantes > 0.
        if (!prev || (prev.diamonds <= 1 && g.diamonds > prev.diamonds)) this.byName.set(key, { name: g.name, diamonds: g.diamonds, image: g.image ? `/gifts/${g.image}` : undefined, ...(g.generic ? { generic: true } : {}) })
      }
    } catch {
      /* sin catálogo local */
    }
    if (!this.learnedFile) return
    try {
      const saved = JSON.parse(await fs.readFile(this.learnedFile, 'utf8')) as Record<string, { id?: number; name: string; diamonds: number; image: string }>
      for (const [key, g] of Object.entries(saved)) {
        if (!g?.name || typeof g.image !== 'string' || !/^https:\/\//.test(g.image)) continue
        this.learned.set(key, g)
        const prev = this.byName.get(key)
        if (!prev || prev.generic || !prev.image) this.byName.set(key, { id: g.id ?? prev?.id, name: prev?.name ?? g.name, diamonds: prev?.diamonds || g.diamonds || 0, image: g.image })
      }
    } catch {
      /* aún no se ha aprendido nada */
    }
  }

  learn(g: RawGift): void {
    this.learnOne({ id: g.giftId, name: g.name, diamonds: g.diamonds, imageUrl: g.imageUrl })
  }

  /** Catálogo completo de la sala (al conectar): corrige de una vez todos los iconos genéricos o que falten. */
  learnMany(list: { id?: number; name: string; diamonds: number; imageUrl?: string }[]): void {
    for (const g of list) this.learnOne(g)
  }

  private learnOne(g: { id?: number; name: string; diamonds: number; imageUrl?: string }): void {
    if (!g.name) return
    const key = norm(g.name)
    const prev = this.byName.get(key)
    const live = typeof g.imageUrl === 'string' && /^https:\/\//.test(g.imageUrl) ? g.imageUrl : undefined
    // El icono incluido en la app manda, salvo que sea genérico o no exista: entonces se usa (y se recuerda) el de TikTok.
    const useLive = !!live && (!prev?.image || prev.generic === true)
    this.byName.set(key, { id: g.id || prev?.id, name: g.name, diamonds: g.diamonds || prev?.diamonds || 0, image: useLive ? live : prev?.image ?? live })
    if (useLive && live && this.learned.get(key)?.image !== live) {
      this.learned.set(key, { id: g.id || undefined, name: g.name, diamonds: g.diamonds || 0, image: live })
      this.scheduleSave()
    }
  }

  private scheduleSave(): void {
    if (!this.learnedFile || this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      const file = this.learnedFile!
      fs.mkdir(path.dirname(file), { recursive: true })
        .then(() => fs.writeFile(file, JSON.stringify(Object.fromEntries(this.learned)), 'utf8'))
        .catch(() => undefined)
    }, 1500)
    this.saveTimer.unref?.()
  }

  find(name: string): GiftInfo | undefined {
    return this.byName.get(norm(name))
  }

  imageFor(name: string): string | undefined {
    return this.find(name)?.image
  }

  list(): GiftInfo[] {
    return [...this.byName.values()].sort((a, b) => a.diamonds - b.diamonds || a.name.localeCompare(b.name))
  }
}
