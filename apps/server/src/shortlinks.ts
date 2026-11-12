import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from './config.js'

/** Enlaces cortos de overlays (/o/<código>): se guardan en enlaces-cortos.json y no caducan. */
export class ShortLinks {
  private readonly file = path.join(DATA_DIR, 'enlaces-cortos.json')
  private map: Record<string, string> = {}

  constructor() {
    try {
      this.map = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Record<string, string>
    } catch {
      this.map = {}
    }
  }

  add(target: string): string {
    for (const [k, v] of Object.entries(this.map)) if (v === target) return k
    // Código estable para la misma ruta (así el mismo overlay da siempre el mismo enlace).
    let code = crypto.createHash('sha1').update(target).digest('base64url').slice(0, 7).toLowerCase().replace(/[^a-z0-9]/g, 'x')
    while (this.map[code] && this.map[code] !== target) code += 'x'
    this.map[code] = target
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true })
      fs.writeFileSync(this.file, JSON.stringify(this.map, null, 1))
    } catch {
      /* sin disco: el enlace vale hasta cerrar la app */
    }
    return code
  }

  get(code: string): string | undefined {
    return this.map[code]
  }
}
