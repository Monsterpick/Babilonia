import { promises as fs } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

/** Daño al objetivo de una habilidad: corazones por golpe (-1 = los de la habilidad), golpe final y tótems. */
export const DanioSchema = z.object({
  corazonesGolpe: z.number().min(-1).max(1000),
  corazonesFinal: z.number().min(0).max(1000),
  totemsDurante: z.number().int().min(0).max(1000),
  totemsFinal: z.number().int().min(0).max(1000),
})
export type Danio = z.infer<typeof DanioSchema>

/** Valores por defecto (los mismos que trae el plugin). */
export const DANIO_DEFAULTS: Record<string, Danio> = Object.fromEntries(
  Object.entries({"onda_repulsion": [1, 4], "corona_espadas": [2.5, 5], "super_rayo": [1, 12.5], "trueno_explosion": [3, 15], "carrusel_creepers": [2.5, 10], "ojo_vacio": [1, 12], "agujero_negro": [1, 10], "juicio_arcano": [4, 20], "genkidama": [1, 25], "meteorito": [1, 50], "mil_cortes": [0.5, 15], "vacio_purpura": [1, 15], "akaza": [0.5, 10], "sangre_perforante": [2, 15], "ataque_orbital": [1, 30]} as Record<string, [number, number]>).map(([k, [g, f]]) => [k, { corazonesGolpe: g, corazonesFinal: f, totemsDurante: 0, totemsFinal: 1 }]),
)

/** Ajustes generales de habilidades.yml (plugin LiveArena) que se pueden tocar desde la app. */
export const CineSettingsSchema = z.object({
  camaraCinematica: z.boolean(),
  romperBloques: z.boolean(),
  restaurarBloques: z.boolean(),
  segundosRestauracion: z.number().int().min(1).max(3600),
  bloquesPorTick: z.number().int().min(20).max(5000),
  colaMax: z.number().int().min(0).max(100),
  /** Vida del escudo de energía en corazones (escudo.vidaCorazones). */
  escudoCorazones: z.number().min(1).max(2000),
  /** Daño y tótems por habilidad (sección «danio» de habilidades.yml). */
  danio: z.record(z.string().regex(/^[a-z_]+$/), DanioSchema.partial()),
})
export type CineSettings = z.infer<typeof CineSettingsSchema>

const DEFAULTS: CineSettings = { camaraCinematica: true, romperBloques: true, restaurarBloques: true, segundosRestauracion: 60, bloquesPorTick: 400, colaMax: 10, escudoCorazones: 50, danio: DANIO_DEFAULTS }

const DANIO_KEYS = ['corazonesGolpe', 'corazonesFinal', 'totemsDurante', 'totemsFinal'] as const

/** Lee la sección «danio:» (una línea por habilidad: «  id: { clave: valor, … }»). */
export function parseDanio(text: string): Record<string, Danio> {
  const out: Record<string, Danio> = JSON.parse(JSON.stringify(DANIO_DEFAULTS))
  const start = text.search(/^danio:\s*$/m)
  if (start < 0) return out
  const lines = text.slice(start).split('\n').slice(1)
  for (const line of lines) {
    if (/^\S/.test(line)) break
    const m = line.match(/^\s+([a-z_]+):\s*\{([^}]*)\}/)
    if (!m) continue
    const cur: Danio = { ...(out[m[1]!] ?? { corazonesGolpe: -1, corazonesFinal: 10, totemsDurante: 0, totemsFinal: 1 }) }
    for (const kv of m[2]!.split(',')) {
      const [k, v] = kv.split(':').map((x) => x.trim())
      if (k && (DANIO_KEYS as readonly string[]).includes(k) && v !== undefined && !Number.isNaN(Number(v))) (cur as Record<string, number>)[k] = Number(v)
    }
    out[m[1]!] = cur
  }
  return out
}

/** Reescribe (o añade al final) la sección «danio:» con los valores dados. */
export function writeDanio(text: string, danio: Record<string, Danio>): string {
  const body = Object.entries(danio)
    .map(([id, d]) => `  ${id}: { ${DANIO_KEYS.map((k) => `${k}: ${d[k]}`).join(', ')} }`)
    .join('\n')
  const start = text.search(/^danio:\s*$/m)
  if (start < 0) return `${text.replace(/\s*$/, '')}\n\n# Daño y tótems de cada habilidad (desde la app LiveArena).\ndanio:\n${body}\n`
  const after = text.slice(start).split('\n')
  let n = 1
  while (n < after.length && (after[n] === '' || /^\s/.test(after[n]!))) n++
  // Conserva las líneas en blanco finales del bloque como separación.
  let keep = n
  while (keep > 1 && after[keep - 1] === '') keep--
  return text.slice(0, start) + ['danio:', body, ...after.slice(keep, n), ...after.slice(n)].join('\n')
}

const file = (folder: string) => path.join(folder, 'plugins', 'LiveArena', 'habilidades.yml')

/** Lee la sección general sin un parser YAML completo (claves simples «  clave: valor»). */
export async function readCineSettings(folder: string): Promise<CineSettings & { exists: boolean }> {
  if (!folder) return { ...DEFAULTS, exists: false }
  const text = await fs.readFile(file(folder), 'utf8').catch(() => null)
  if (text == null) return { ...DEFAULTS, exists: false }
  const out: Record<string, unknown> = { ...DEFAULTS }
  out.danio = parseDanio(text)
  const shield = text.match(/^escudo:.*\bvidaCorazones:\s*([\d.]+)/m)
  if (shield) out.escudoCorazones = Number(shield[1])
  for (const key of Object.keys(DEFAULTS) as (keyof CineSettings)[]) {
    if (key === 'escudoCorazones' || key === 'danio') continue
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
    if (key === 'danio') {
      const cur = parseDanio(text)
      for (const [id, d] of Object.entries(value as Record<string, Partial<Danio>>)) cur[id] = { ...(cur[id] ?? DANIO_DEFAULTS[id] ?? { corazonesGolpe: -1, corazonesFinal: 10, totemsDurante: 0, totemsFinal: 1 }), ...d }
      text = writeDanio(text, cur)
      continue
    }
    if (key === 'escudoCorazones') {
      text = text.replace(/^(escudo:\s*\{)(.*)$/m, (_m, a: string, rest: string) =>
        /\bvidaCorazones:/.test(rest) ? `${a}${rest.replace(/\bvidaCorazones:\s*[\d.]+/, `vidaCorazones: ${Number(value)}`)}` : `${a} vidaCorazones: ${Number(value)},${rest}`,
      )
      continue
    }
    const re = new RegExp(`^(\\s+${key}:\\s*)([^#\\n]+?)(\\s*(#.*)?)$`, 'm')
    if (re.test(text)) text = text.replace(re, (_m, a: string, _v: string, c: string) => `${a}${String(value)}${c ?? ''}`)
    else text = text.replace(/^general:\s*$/m, `general:\n  ${key}: ${String(value)}`)
  }
  await fs.writeFile(file(folder), text, 'utf8')
  return readCineSettings(folder)
}
