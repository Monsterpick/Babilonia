import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { DATA_DIR } from './config.js'

/**
 * LAST HOUSE (juego web propio): ajustes del juego, historial de partidas y progresión entre partidas
 * (récords, tablas históricas de espectadores, logros y cosméticos que no dan ventaja).
 * Todo se guarda en `<datos>/lasthouse.json`; nada sale del equipo.
 */

export const LastHouseSettingsSchema = z.object({
  /** modo con el que arranca la pantalla de inicio */
  mode: z.enum(['invasion', 'defensa']).default('invasion'),
  /** duración de la partida (s) */
  duration: z.number().int().min(120).max(900).default(300),
  /** asaltos que necesita el Rey (Invasión) */
  assaults: z.number().int().min(1).max(10).default(5),
  /** vida de la casa (Defensa) */
  houseHp: z.number().int().min(500).max(6000).default(1500),
  /** likes por cada brote (Invasión) o por cada caminante (Defensa) */
  likesPer: z.number().int().min(1).max(200).default(12),
  /** segundos entre votaciones del chat (0 = sin votaciones) */
  voteEvery: z.number().int().min(0).max(600).default(75),
  /** dificultad que se adapta al número de espectadores activos */
  adaptive: z.boolean().default(true),
  /** HUD en vertical 9:16 (para directos desde el móvil) */
  vertical: z.boolean().default(false),
  volume: z.number().min(0).max(1).default(0.8),
  music: z.boolean().default(true),
  /** corona elegida (cosmético) */
  crown: z.string().max(20).default('oro'),
})
export type LastHouseSettings = z.infer<typeof LastHouseSettingsSchema>

export const LastHouseResultSchema = z.object({
  mode: z.enum(['invasion', 'defensa']),
  winner: z.enum(['rey', 'guardianes', 'horda', 'guardian']),
  /** segundos jugados */
  played: z.number().min(0).max(3600),
  duration: z.number().min(0).max(3600),
  assaults: z.number().int().min(0).max(50).default(0),
  downs: z.number().int().min(0).max(1000).default(0),
  kills: z.number().int().min(0).max(100000).default(0),
  /** vida de la casa al final 0..1 (Defensa) */
  house: z.number().min(0).max(1).default(0),
  titans: z.number().int().min(0).max(1000).default(0),
  /** espectadores que participaron */
  viewers: z.number().int().min(0).max(1000000).default(0),
  /** puntos de cada espectador en esta partida (plantas en Invasión, zombis enviados en Defensa) */
  scores: z.array(z.object({ name: z.string().min(1).max(60), score: z.number().min(0).max(1e7) })).max(500).default([]),
})
export type LastHouseResult = z.infer<typeof LastHouseResultSchema>

export interface Achievement {
  id: string
  name: string
  desc: string
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'primer-asalto', name: 'La puerta cede', desc: 'Gana tu primera partida de Invasión' },
  { id: 'intocable', name: 'Intocable', desc: 'Gana en Invasión sin que te derriben' },
  { id: 'relampago', name: 'Relámpago', desc: 'Gana en Invasión con más de 2 minutos de sobra' },
  { id: 'muralla', name: 'Muralla', desc: 'Gana tu primera partida de Defensa' },
  { id: 'intacta', name: 'Ni un rasguño', desc: 'Gana en Defensa con la casa por encima del 75 %' },
  { id: 'exterminador', name: 'Exterminador', desc: 'Derriba 300 zombis en una partida de Defensa' },
  { id: 'titanicida', name: 'Titanicida', desc: 'Derriba a un Titán' },
  { id: 'multitud', name: 'Multitud', desc: 'Juega una partida con 100 espectadores o más' },
  { id: 'maraton', name: 'Maratón', desc: 'Juega 10 partidas' },
  { id: 'veterano', name: 'Veterano', desc: 'Juega 50 partidas' },
]

/** Coronas del Rey: solo cambian el color; se desbloquean ganando (no dan ninguna ventaja). */
export const CROWNS: { id: string; name: string; color: string; wins: number }[] = [
  { id: 'oro', name: 'Oro', color: '#f2c43d', wins: 0 },
  { id: 'esmeralda', name: 'Esmeralda', color: '#34e08a', wins: 1 },
  { id: 'amatista', name: 'Amatista', color: '#b07cff', wins: 3 },
  { id: 'rubi', name: 'Rubí', color: '#ff4a5e', wins: 5 },
  { id: 'hielo', name: 'Hielo', color: '#9fe7ff', wins: 8 },
  { id: 'diamante', name: 'Diamante', color: '#e8fbff', wins: 12 },
  { id: 'obsidiana', name: 'Obsidiana', color: '#3a2a5a', wins: 20 },
]

interface GameRecord extends Omit<LastHouseResult, 'scores'> {
  at: number
  top: { name: string; score: number }[]
}

interface Stats {
  games: GameRecord[]
  totals: { played: number; invasionWins: number; invasionLosses: number; defenseWins: number; defenseLosses: number }
  records: { fastestInvasion: number | null; mostKills: number; bestHouse: number; mostViewers: number }
  /** tablas históricas de espectadores */
  guardians: Record<string, number>
  horde: Record<string, number>
  achievements: Record<string, number>
}

const emptyStats = (): Stats => ({
  games: [],
  totals: { played: 0, invasionWins: 0, invasionLosses: 0, defenseWins: 0, defenseLosses: 0 },
  records: { fastestInvasion: null, mostKills: 0, bestHouse: 0, mostViewers: 0 },
  guardians: {},
  horde: {},
  achievements: {},
})

const FILE = () => path.join(DATA_DIR, 'lasthouse.json')

/** Recorta una tabla a los N mejores (para que el archivo no crezca sin límite con años de directos). */
function trim(table: Record<string, number>, n: number): Record<string, number> {
  const e = Object.entries(table)
  if (e.length <= n) return table
  return Object.fromEntries(e.sort((a, b) => b[1] - a[1]).slice(0, n))
}

export class LastHouseService {
  private settings: LastHouseSettings = LastHouseSettingsSchema.parse({})
  private stats: Stats = emptyStats()
  private writing: Promise<void> = Promise.resolve()
  previousProfile: string | null = null
  /** última foto del estado de la partida (para el overlay del marcador) */
  live: unknown = null

  constructor() {
    try {
      const raw = JSON.parse(fs.readFileSync(FILE(), 'utf8')) as { settings?: unknown; stats?: Partial<Stats> }
      this.settings = LastHouseSettingsSchema.parse(raw.settings ?? {})
      this.stats = { ...emptyStats(), ...(raw.stats ?? {}) }
      this.stats.totals = { ...emptyStats().totals, ...this.stats.totals }
      this.stats.records = { ...emptyStats().records, ...this.stats.records }
    } catch {
      // primera vez o archivo dañado: valores por defecto (no se pierde nada importante)
    }
  }

  private save(): Promise<void> {
    const data = JSON.stringify({ settings: this.settings, stats: this.stats }, null, 1)
    this.writing = this.writing.then(async () => {
      await fsp.mkdir(DATA_DIR, { recursive: true })
      const tmp = `${FILE()}.tmp`
      await fsp.writeFile(tmp, data)
      await fsp.rename(tmp, FILE())
    })
    return this.writing.catch(() => undefined)
  }

  getSettings(): LastHouseSettings {
    return this.settings
  }

  async saveSettings(patch: Partial<LastHouseSettings>): Promise<LastHouseSettings> {
    const next = LastHouseSettingsSchema.parse({ ...this.settings, ...patch })
    // solo se puede elegir una corona desbloqueada
    if (!this.unlockedCrowns().some((c) => c.id === next.crown)) next.crown = 'oro'
    this.settings = next
    await this.save()
    return next
  }

  private get wins(): number {
    return this.stats.totals.invasionWins + this.stats.totals.defenseWins
  }

  unlockedCrowns() {
    return CROWNS.filter((c) => this.wins >= c.wins)
  }

  /** Lo que enseña el panel y lo que el juego necesita (corona, récords). */
  progress() {
    const s = this.stats
    const top = (t: Record<string, number>) =>
      Object.entries(t)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, score]) => ({ name, score: Math.round(score) }))
    return {
      totals: s.totals,
      records: s.records,
      recent: s.games.slice(-10).reverse(),
      guardians: top(s.guardians),
      horde: top(s.horde),
      achievements: ACHIEVEMENTS.map((a) => ({ ...a, at: s.achievements[a.id] ?? null })),
      crowns: CROWNS.map((c) => ({ ...c, unlocked: this.wins >= c.wins })),
      crown: CROWNS.find((c) => c.id === this.settings.crown)?.color ?? CROWNS[0]!.color,
    }
  }

  /** Registra una partida terminada; devuelve los logros nuevos (para celebrarlos en pantalla). */
  async record(r: LastHouseResult): Promise<{ unlocked: Achievement[]; crowns: string[] }> {
    const s = this.stats
    const crownsBefore = new Set(this.unlockedCrowns().map((c) => c.id))
    const top = [...r.scores].sort((a, b) => b.score - a.score).slice(0, 5)
    const { scores, ...rest } = r
    s.games.push({ ...rest, at: Date.now(), top })
    if (s.games.length > 100) s.games.splice(0, s.games.length - 100)
    s.totals.played++
    const won = r.winner === 'rey' || r.winner === 'guardian'
    if (r.mode === 'invasion') {
      if (won) s.totals.invasionWins++
      else s.totals.invasionLosses++
      if (won && (s.records.fastestInvasion === null || r.played < s.records.fastestInvasion)) s.records.fastestInvasion = Math.round(r.played)
    } else {
      if (won) s.totals.defenseWins++
      else s.totals.defenseLosses++
      s.records.mostKills = Math.max(s.records.mostKills, r.kills)
      if (won) s.records.bestHouse = Math.max(s.records.bestHouse, r.house)
    }
    s.records.mostViewers = Math.max(s.records.mostViewers, r.viewers)
    const table = r.mode === 'invasion' ? s.guardians : s.horde
    for (const p of scores) table[p.name] = (table[p.name] ?? 0) + p.score
    s.guardians = trim(s.guardians, 500)
    s.horde = trim(s.horde, 500)

    const got: Achievement[] = []
    const give = (id: string, cond: boolean) => {
      if (!cond || s.achievements[id]) return
      s.achievements[id] = Date.now()
      const a = ACHIEVEMENTS.find((x) => x.id === id)
      if (a) got.push(a)
    }
    give('primer-asalto', r.mode === 'invasion' && won)
    give('intocable', r.mode === 'invasion' && won && r.downs === 0)
    give('relampago', r.mode === 'invasion' && won && r.duration - r.played > 120)
    give('muralla', r.mode === 'defensa' && won)
    give('intacta', r.mode === 'defensa' && won && r.house > 0.75)
    give('exterminador', r.mode === 'defensa' && r.kills >= 300)
    give('titanicida', r.titans > 0)
    give('multitud', r.viewers >= 100)
    give('maraton', s.totals.played >= 10)
    give('veterano', s.totals.played >= 50)
    await this.save()
    const crowns = this.unlockedCrowns()
      .filter((c) => !crownsBefore.has(c.id))
      .map((c) => c.name)
    return { unlocked: got, crowns }
  }

  async reset(): Promise<void> {
    this.stats = emptyStats()
    await this.save()
  }
}
