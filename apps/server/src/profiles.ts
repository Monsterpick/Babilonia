import fs from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'
import { ProfileSchema, type Profile } from '@livearena/shared'
import { paths } from './config.js'
import { defaultProfiles } from './default-profiles.js'

const safeId = (id: string) => id.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 64) || 'perfil'

/**
 * Perfiles en archivos JSON (fáciles de leer, copiar y respaldar).
 * Cada guardado deja una copia de seguridad con fecha (se conservan las últimas 30 por perfil).
 */
export class ProfileStore {
  private cache = new Map<string, Profile>()

  async init(): Promise<void> {
    const files = (await fs.readdir(paths.profiles)).filter((f) => f.endsWith('.json'))
    for (const f of files) {
      try {
        const p = ProfileSchema.parse(JSON.parse(await fs.readFile(path.join(paths.profiles, f), 'utf8')))
        this.cache.set(p.id, p)
      } catch (err) {
        console.warn(`Perfil inválido ignorado: ${f}: ${(err as Error).message}`)
      }
    }
    if (this.cache.size === 0) for (const p of defaultProfiles()) await this.save(p, false)
  }

  list(): { id: string; name: string; mode: string; actions: number; events: number }[] {
    return [...this.cache.values()].map((p) => ({ id: p.id, name: p.name, mode: p.mode, actions: p.actions.length, events: p.events.length }))
  }

  get(id: string): Profile | undefined {
    return this.cache.get(id)
  }

  first(): Profile {
    const p = this.cache.values().next().value
    if (!p) throw new Error('No hay perfiles')
    return p
  }

  async save(raw: unknown, backup = true): Promise<Profile> {
    const p = ProfileSchema.parse(raw)
    p.id = safeId(p.id)
    const ids = new Set(p.actions.map((a) => a.id))
    for (const e of p.events) {
      const missing = e.actionIds.filter((x) => !ids.has(x))
      if (missing.length) throw new Error(`El evento ${e.id} apunta a acciones que no existen: ${missing.join(', ')}`)
    }
    const file = path.join(paths.profiles, `${p.id}.json`)
    if (backup && this.cache.has(p.id)) await this.backup(p.id)
    await fs.writeFile(`${file}.tmp`, JSON.stringify(p, null, 2))
    await fs.rename(`${file}.tmp`, file)
    this.cache.set(p.id, p)
    return p
  }

  async remove(id: string): Promise<void> {
    if (this.cache.size <= 1) throw new Error('Debe quedar al menos un perfil.')
    await this.backup(id)
    await fs.rm(path.join(paths.profiles, `${safeId(id)}.json`), { force: true })
    this.cache.delete(id)
  }

  async duplicate(id: string, name: string): Promise<Profile> {
    const src = this.cache.get(id)
    if (!src) throw new Error('Perfil no encontrado')
    let newId = safeId(name)
    for (let i = 2; this.cache.has(newId); i++) newId = `${safeId(name)}-${i}`
    return this.save({ ...structuredClone(src), id: newId, name }, false)
  }

  /* ------------------------- copias de seguridad ------------------------- */

  private async backup(id: string): Promise<void> {
    const p = this.cache.get(id)
    if (!p) return
    const dir = path.join(paths.backups, safeId(id))
    await fs.mkdir(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    await fs.writeFile(path.join(dir, `${stamp}.json`), JSON.stringify(p, null, 2))
    const all = (await fs.readdir(dir)).sort()
    for (const old of all.slice(0, Math.max(0, all.length - 30))) await fs.rm(path.join(dir, old), { force: true })
  }

  async listBackups(id: string): Promise<{ file: string; date: string; actions: number; events: number }[]> {
    const dir = path.join(paths.backups, safeId(id))
    try {
      const files = (await fs.readdir(dir)).sort().reverse()
      return Promise.all(
        files.map(async (f) => {
          const p = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8')) as Profile
          return { file: f, date: f.replace('.json', '').replace(/T(\d\d)-(\d\d)-(\d\d)-\d+Z$/, ' $1:$2:$3'), actions: p.actions?.length ?? 0, events: p.events?.length ?? 0 }
        }),
      )
    } catch {
      return []
    }
  }

  async restore(id: string, file: string): Promise<Profile> {
    const f = path.basename(file)
    const raw = JSON.parse(await fs.readFile(path.join(paths.backups, safeId(id), f), 'utf8'))
    return this.save({ ...raw, id })
  }

  /* -------------------- compartir por código (texto) -------------------- */

  exportCode(id: string): string {
    const p = this.cache.get(id)
    if (!p) throw new Error('Perfil no encontrado')
    return `LA1:${zlib.deflateRawSync(Buffer.from(JSON.stringify(p))).toString('base64url')}`
  }

  async importCode(code: string, asName?: string): Promise<Profile> {
    const m = code.trim().match(/^LA1:([A-Za-z0-9_-]+)$/)
    if (!m) throw new Error('Código no válido.')
    const raw = JSON.parse(zlib.inflateRawSync(Buffer.from(m[1]!, 'base64url')).toString('utf8'))
    const p = ProfileSchema.parse(raw)
    const name = asName || `${p.name} (importado)`
    let id = safeId(name)
    for (let i = 2; this.cache.has(id); i++) id = `${safeId(name)}-${i}`
    return this.save({ ...p, id, name }, false)
  }
}
