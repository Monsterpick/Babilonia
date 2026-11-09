import { promises as fs } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

/** Ajustes generales de habilidades.yml (plugin LiveArena) que se pueden tocar desde la app. */
export const CineSettingsSchema = z.object({
  camaraCinematica: z.boolean(),
  romperBloques: z.boolean(),
  restaurarBloques: z.boolean(),
  segundosRestauracion: z.number().int().min(1).max(3600),
  bloquesPorTick: z.number().int().min(20).max(5000),
  colaMax: z.number().int().min(0).max(100),
})
export type CineSettings = z.infer<typeof CineSettingsSchema>

const DEFAULTS: CineSettings = { camaraCinematica: true, romperBloques: true, restaurarBloques: true, segundosRestauracion: 60, bloquesPorTick: 400, colaMax: 10 }

const file = (folder: string) => path.join(folder, 'plugins', 'LiveArena', 'habilidades.yml')

/** Lee la sección general sin un parser YAML completo (claves simples «  clave: valor»). */
export async function readCineSettings(folder: string): Promise<CineSettings & { exists: boolean }> {
  if (!folder) return { ...DEFAULTS, exists: false }
  const text = await fs.readFile(file(folder), 'utf8').catch(() => null)
  if (text == null) return { ...DEFAULTS, exists: false }
  const out: Record<string, unknown> = { ...DEFAULTS }
  for (const key of Object.keys(DEFAULTS) as (keyof CineSettings)[]) {
    const m = text.match(new RegExp(`^\\s+${key}:\\s*([^#\\n]+)`, 'm'))
    if (!m) continue
    const raw = m[1]!.trim()
    out[key] = typeof DEFAULTS[key] === 'boolean' ? raw === 'true' : Number(raw)
  }
  return { ...(out as CineSettings), exists: true }
}

export async function writeCineSettings(folder: string, patch: Partial<CineSettings>): Promise<CineSettings & { exists: boolean }> {
  if (!folder) throw new Error('Primero crea o elige tu servidor.')
  let text = await fs.readFile(file(folder), 'utf8').catch(() => null)
  if (text == null) throw new Error('Arranca el servidor una vez para que el plugin cree habilidades.yml.')
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const re = new RegExp(`^(\\s+${key}:\\s*)([^#\\n]+?)(\\s*(#.*)?)$`, 'm')
    if (re.test(text)) text = text.replace(re, (_m, a: string, _v: string, c: string) => `${a}${String(value)}${c ?? ''}`)
    else text = text.replace(/^general:\s*$/m, `general:\n  ${key}: ${String(value)}`)
  }
  await fs.writeFile(file(folder), text, 'utf8')
  return readCineSettings(folder)
}
