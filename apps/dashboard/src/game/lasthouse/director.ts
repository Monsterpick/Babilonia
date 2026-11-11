/**
 * LAST HOUSE — director del directo. Convierte lo que pasa en TikTok (likes, comentarios, follows, compartidos,
 * suscripciones y regalos) en acciones del juego, para los dos modos:
 *  - Invasión: los espectadores son los Guardianes y plantan defensas delante del Rey.
 *  - Defensa: los espectadores son la Horda y mandan zombis contra la casa.
 *
 * Reglas para que sea justo y no se rompa con muchos espectadores:
 *  - Todo lo básico es gratis; los regalos dan efectos más grandes, nunca la victoria directa.
 *  - Esperas por persona en el chat; los likes se suman entre todos.
 *  - Los efectos grandes (≥199 monedas y votaciones) van en una cola común con separación de 5 s.
 *  - Dificultad adaptativa: con muchos espectadores activos cada acción pesa menos.
 *  - Votaciones: cada cierto tiempo el chat elige entre dos eventos («1» o «2»), un voto por persona.
 */
import type { DefenseGame } from './defense'
import { GUARDIANS, type Game, type GuardianKind, type InvasionEvent } from './sim'
import { ZOMBIES, type ZombieKind } from './common'

/** Lo mínimo de un evento del directo (compatible con LiveEvent de LiveArena). */
export type LiveIn =
  | { type: 'like'; user: LiveUserIn | null; payload: { count: number } }
  | { type: 'chat'; user: LiveUserIn | null; payload: { text: string } }
  | { type: 'gift'; user: LiveUserIn | null; payload: { name: string; diamonds: number; count: number } }
  | { type: 'follow' | 'share' | 'subscribe'; user: LiveUserIn | null; payload?: unknown }
  | { type: string; user: LiveUserIn | null; payload?: unknown }

export interface LiveUserIn {
  id: string
  nickname: string
}

export interface Notice {
  who: string
  what: string
  /** plant = defensa · horde = zombis · event = evento grande · vote = votación */
  kind: 'plant' | 'horde' | 'event' | 'vote'
}

export interface DirectorOptions {
  /** segundos entre votaciones (0 = sin votaciones) */
  voteEvery: number
  voteLength: number
  /** likes que hacen falta para una acción (en Defensa, para un zombi) */
  likesPer: number
  adaptive: boolean
}

export const DEFAULT_DIRECTOR: DirectorOptions = { voteEvery: 75, voteLength: 20, likesPer: 12, adaptive: true }

type EventName = InvasionEvent | 'estampida' | 'tunel' | 'noche' | 'asedio'

export const EVENT_LABEL: Record<EventName, string> = {
  mareo: 'Esporas del mareo',
  tormenta: 'Tormenta de semillas',
  enjambre: 'Batería de Lanzabrotes',
  calabazas: 'Bombardeo de calabazas',
  enredadera: 'Muro de enredadera',
  noche: 'Noche de tormenta',
  estampida: 'Estampida de corredores',
  tunel: 'Túnel de excavadores',
  asedio: 'Asedio de colosos',
}

export interface Vote {
  options: [EventName, EventName]
  counts: [number, number]
  endsAt: number
  voters: Set<string>
}

type Sim = Game | DefenseGame

export class Director {
  readonly opts: DirectorOptions
  private cool = new Map<string, number>()
  private seen = new Map<string, number>()
  private big: { name: EventName; owner: string }[] = []
  private bigAt = 0
  private likeBank = 0
  private nextVote: number
  vote: Vote | null = null
  /** último resultado de votación (para enseñarlo un momento) */
  lastVote: { name: EventName; at: number } | null = null
  private voteIndex = 0
  /** avisos para la interfaz (los consume la página) */
  notices: Notice[] = []

  constructor(
    readonly game: Sim,
    opts: Partial<DirectorOptions> = {},
  ) {
    this.opts = { ...DEFAULT_DIRECTOR, ...opts }
    this.nextVote = this.opts.voteEvery > 0 ? Math.min(40, this.opts.voteEvery) : Infinity
  }

  private get t(): number {
    return this.game.s.t
  }

  /** Espectadores que han hecho algo en el último minuto. */
  get active(): number {
    let n = 0
    for (const at of this.seen.values()) if (this.t - at < 60) n++
    return n
  }

  /** Espectadores distintos que han participado en la partida. */
  get participants(): number {
    return this.seen.size
  }

  /** Cuánto pesa cada acción según los espectadores activos (1 con pocos; menos con muchos). */
  get weight(): number {
    if (!this.opts.adaptive) return 1
    return Math.max(0.35, Math.min(1, 1 / Math.sqrt(Math.max(1, this.active / 25))))
  }

  private ready(user: string, key: string, secs: number): boolean {
    const k = `${user}:${key}`
    if ((this.cool.get(k) ?? -1e9) > this.t) return false
    this.cool.set(k, this.t + secs)
    return true
  }

  private say(who: string, what: string, kind: Notice['kind']): void {
    this.notices.push({ who, what, kind })
    if (this.notices.length > 40) this.notices.splice(0, this.notices.length - 40)
  }

  private queueBig(name: EventName, owner: string): void {
    if (this.big.length < 30) this.big.push({ name, owner })
  }

  private runEvent(name: EventName, owner: string): void {
    const g = this.game
    if (g.mode === 'invasion') {
      if (name === 'estampida' || name === 'tunel' || name === 'asedio') return
      g.event(name, owner)
    } else {
      if (name === 'estampida' || name === 'tunel' || name === 'asedio' || name === 'noche') g.event(name, owner)
    }
    this.say(owner, EVENT_LABEL[name], 'event')
  }

  // ───────────────────────────── entrada del directo ─────────────────────────────

  handle(ev: LiveIn): void {
    const g = this.game
    if (g.s.phase !== 'playing') return
    const uid = ev.user?.id ?? ev.user?.nickname ?? 'anon'
    const who = ev.user?.nickname ?? 'Alguien'
    this.seen.set(uid, this.t)
    if (this.seen.size > 5000) for (const [k, at] of this.seen) if (this.t - at > 60) this.seen.delete(k)

    // votación abierta: «1»/«2» o el nombre de la opción
    if (ev.type === 'chat' && this.vote) {
      const txt = String((ev.payload as { text?: string })?.text ?? '').trim().toLowerCase()
      const v = this.vote
      const pick: 0 | 1 | null = /^1\b/.test(txt) || txt.includes(v.options[0]) ? 0 : /^2\b/.test(txt) || txt.includes(v.options[1]) ? 1 : null
      if (pick !== null && !v.voters.has(uid)) {
        v.voters.add(uid)
        v.counts[pick]++
        return
      }
    }
    if (g.mode === 'invasion') this.invasion(g, ev, uid, who)
    else this.defense(g, ev, uid, who)
  }

  private plant(g: Game, kind: GuardianKind, who: string, n = 1): void {
    let ok = 0
    for (let i = 0; i < n; i++) if (g.plant(kind, who)) ok++
    if (ok) this.say(who, `${ok > 1 ? `${ok} × ` : ''}${GUARDIANS[kind].name}`, 'plant')
  }

  private invasion(g: Game, ev: LiveIn, uid: string, who: string): void {
    const w = this.weight
    switch (ev.type) {
      case 'like': {
        // con muchos espectadores hacen falta más likes para cada brote
        g.cfg.likesPerSprout = Math.round(this.opts.likesPer / w)
        g.likes(Number((ev.payload as { count?: number })?.count ?? 1), who)
        return
      }
      case 'follow':
        return this.plant(g, 'glacial', who)
      case 'share':
        if (this.ready(uid, 'share', 20)) this.plant(g, 'raiz', who)
        return
      case 'subscribe':
        return this.plant(g, 'tronco', who)
      case 'chat': {
        const t = String((ev.payload as { text?: string })?.text ?? '').toLowerCase()
        const kind: GuardianKind | null = /tronco|muro/.test(t) ? 'tronco' : /lanza|dispar/.test(t) ? 'lanzabrotes' : /hielo|glacial|fr[ií]o/.test(t) ? 'glacial' : /hongo|bomba/.test(t) ? 'hongo' : /ra[ií]z|cura/.test(t) ? 'raiz' : null
        const slow = 1 / w
        if (kind === 'tronco' || kind === 'hongo') {
          if (this.ready(uid, 'fuerte', 45 * slow)) this.plant(g, kind, who)
        } else if (kind) {
          if (this.ready(uid, 'medio', 18 * slow)) this.plant(g, kind, who)
        } else if (this.ready(uid, 'brote', 8 * slow)) this.plant(g, 'brote', who)
        return
      }
      case 'gift': {
        const p = ev.payload as { diamonds: number; count: number }
        const coins = (p.diamonds || 0) * (p.count || 1)
        if (coins >= 1000) {
          g.plant('ancestral', who)
          this.say(who, 'Guardián Ancestral', 'event')
          this.queueBig('calabazas', who)
        } else if (coins >= 499) this.queueBig('tormenta', who)
        else if (coins >= 299) this.queueBig('enredadera', who)
        else if (coins >= 199) {
          this.queueBig('mareo', who)
          this.plant(g, 'hongo', who, 2)
        } else if (coins >= 99) this.queueBig('enjambre', who)
        else if (coins >= 20) this.plant(g, 'hongo', who, 3)
        else if (coins >= 5) this.plant(g, 'tronco', who)
        else this.plant(g, 'lanzabrotes', who, Math.min(5, Math.max(1, p.count || 1)))
        return
      }
      default:
        return
    }
  }

  private horde(g: DefenseGame, kind: ZombieKind, n: number, who: string): void {
    const k = g.send(kind, n, who)
    if (k > 0) this.say(who, `${k > 1 ? `${k} × ` : ''}${ZOMBIES[kind].name}`, 'horde')
  }

  private defense(g: DefenseGame, ev: LiveIn, uid: string, who: string): void {
    const w = this.weight
    // con muchos espectadores cada zombi tiene menos vida (más cantidad, mismo peso total)
    g.cfg.hpMul = this.opts.adaptive ? Math.max(0.45, w) : 1
    switch (ev.type) {
      case 'like': {
        this.likeBank += Number((ev.payload as { count?: number })?.count ?? 1)
        const per = Math.round(this.opts.likesPer / w)
        let n = 0
        while (this.likeBank >= per && n < 6) {
          this.likeBank -= per
          n++
        }
        if (this.likeBank > per * 6) this.likeBank = per * 6
        if (n) g.send('caminante', n, who)
        return
      }
      case 'follow':
        return this.horde(g, 'excavador', 1, who)
      case 'share':
        if (this.ready(uid, 'share', 20)) this.horde(g, 'corredor', 3, who)
        return
      case 'subscribe':
        return this.horde(g, 'blindado', 2, who)
      case 'chat': {
        const t = String((ev.payload as { text?: string })?.text ?? '').toLowerCase()
        const slow = 1 / w
        if (/corre|r[aá]pido/.test(t)) {
          if (this.ready(uid, 'corredor', 15 * slow)) this.horde(g, 'corredor', 1, who)
        } else if (/tanque|blind|escudo/.test(t)) {
          if (this.ready(uid, 'blindado', 30 * slow)) this.horde(g, 'blindado', 1, who)
        } else if (this.ready(uid, 'caminante', 8 * slow)) this.horde(g, 'caminante', 1, who)
        return
      }
      case 'gift': {
        const p = ev.payload as { diamonds: number; count: number }
        const coins = (p.diamonds || 0) * (p.count || 1)
        if (coins >= 1000) {
          this.horde(g, 'titan', 1, who)
          this.queueBig('noche', who)
        } else if (coins >= 499) this.queueBig('asedio', who)
        else if (coins >= 299) this.queueBig('estampida', who)
        else if (coins >= 199) this.horde(g, 'coloso', 1, who)
        else if (coins >= 99) this.queueBig('tunel', who)
        else if (coins >= 20) this.horde(g, 'corredor', 5, who)
        else if (coins >= 5) this.horde(g, 'blindado', 1, who)
        else this.horde(g, 'caminante', Math.min(10, 2 * Math.max(1, p.count || 1)), who)
        return
      }
      default:
        return
    }
  }

  // ───────────────────────────── cada fotograma ─────────────────────────────

  tick(): void {
    const g = this.game
    if (g.s.phase !== 'playing') return
    const t = this.t
    // cola de efectos grandes: uno cada 5 s
    if (this.big.length && t >= this.bigAt) {
      const e = this.big.shift()!
      this.runEvent(e.name, e.owner)
      this.bigAt = t + 5
    }
    // votaciones
    if (!this.vote && t >= this.nextVote) {
      const pairs: [EventName, EventName][] = g.mode === 'invasion'
        ? [['enredadera', 'calabazas'], ['noche', 'enjambre'], ['calabazas', 'noche'], ['enjambre', 'enredadera']]
        : [['estampida', 'tunel'], ['asedio', 'noche'], ['tunel', 'asedio'], ['noche', 'estampida']]
      this.vote = { options: pairs[this.voteIndex++ % pairs.length]!, counts: [0, 0], endsAt: t + this.opts.voteLength, voters: new Set() }
    }
    if (this.vote && t >= this.vote.endsAt) {
      const v = this.vote
      this.vote = null
      this.nextVote = t + this.opts.voteEvery
      if (v.counts[0] + v.counts[1] > 0) {
        const win = v.counts[1] > v.counts[0] ? v.options[1] : v.options[0]
        this.lastVote = { name: win, at: t }
        this.queueBig(win, 'El chat')
      }
    }
  }

  get queuedBig(): number {
    return this.big.length
  }
}
