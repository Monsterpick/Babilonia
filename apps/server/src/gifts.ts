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
}

const norm = (s: string) => s.toLowerCase().replace(/[\s_\-'’.]+/g, '')

/**
 * Catálogo de regalos de TikTok: imágenes incluidas en la app (funciona sin conexión y en el
 * simulador) + lo que se aprende en vivo del conector (id real, imagen actual, regalos nuevos).
 */
export class GiftCatalog {
  private byName = new Map<string, GiftInfo>()

  async init(): Promise<void> {
    try {
      const list = JSON.parse(await fs.readFile(path.join(ASSETS_DIR, 'gifts.json'), 'utf8')) as { name: string; diamonds: number; image: string | null }[]
      for (const g of list) {
        const key = norm(g.name)
        const prev = this.byName.get(key)
        // Si hay varios con el mismo nombre (regiones), nos quedamos con el de más diamantes > 0.
        if (!prev || (prev.diamonds <= 1 && g.diamonds > prev.diamonds)) this.byName.set(key, { name: g.name, diamonds: g.diamonds, image: g.image ? `/gifts/${g.image}` : undefined })
      }
    } catch {
      /* sin catálogo local */
    }
  }

  learn(g: RawGift): void {
    if (!g.name) return
    const key = norm(g.name)
    const prev = this.byName.get(key)
    this.byName.set(key, { id: g.giftId || prev?.id, name: g.name, diamonds: g.diamonds || prev?.diamonds || 0, image: prev?.image ?? g.imageUrl })
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
