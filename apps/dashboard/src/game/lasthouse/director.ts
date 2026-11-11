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
 *  - Presupuesto de presión (dificultad adaptativa): lo gratis (likes, chat, follows, compartidos) gasta de una
 *    reserva común que se rellena a ritmo fijo; así 10 o 10.000 espectadores aprietan parecido. Los regalos siempre
 *    hacen algo (pueden dejar la reserva en negativo). Si nadie la usa, el propio jardín (o la horda) la gasta solo,
 *    para que también haya partida con pocos espectadores.
 *  - Votaciones: cada cierto tiempo el chat elige entre dos eventos («1» o «2»), un voto por persona.
 */
import type { DefenseGame } from './defense'
import { GUARDIANS, LENGTH, type Game, type GuardianKind, type InvasionEvent } from './sim'
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

/** Lo que «cuesta» cada cosa del presupuesto de presión. */
export const PLANT_UNITS: Record<GuardianKind, number> = { brote: 1, lanzabrotes: 1.5, glacial: 3, raiz: 3.5, hongo: 2, tronco: 3, ancestral: 12 }
export const ZOMBIE_UNITS: Record<ZombieKind, number> = { caminante: 1, corredor: 2, excavador: 5, blindado: 4, coloso: 12, titan: 35 }

/** Coste de los eventos grandes (los regalos los pagan; los de votación también gastan presupuesto). */
const EVENT_UNITS: Record<string, number> = { mareo: 6, tormenta: 15, enjambre: 8, calabazas: 15, enredadera: 10, noche: 12, estampida: 22, tunel: 16, asedio: 42 }

export interface DirectorOptions {
  /** segundos entre votaciones (0 = sin votaciones) */
  voteEvery: number
  voteLength: number
  /** likes que hacen falta para una acción (en Defensa, para un zombi) */
  likesPer: number
  adaptive: boolean
  /** presupuesto: unidades por segundo (0 = el de cada modo) */
  rate: number
}

export const DEFAULT_DIRECTOR: DirectorOptions = { voteEvery: 75, voteLength: 20, likesPer: 12, adaptive: true, rate: 0 }

/** Ritmo de presión por modo (unidades/s), reserva máxima y deuda máxima que pueden dejar los regalos. */
export const PRESSURE = {
  invasion: { rate: 2.5, cap: 10, debt: 25 },
  defensa: { rate: 1.15, cap: 12, debt: 60 },
}

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
  /** reserva del presupuesto de presión */
  tokens = 0
  private lastT = 0
  private autoN = 0
  /** media de unidades pagadas por segundo (regalos, votos) */
  paidRate = 0
  /** cómo va el streamer respecto a un ritmo justo (+ va sobrado, − va mal) */
  err = 0
  private paidAcc = 0
  /** avisos para la interfaz (los consume la página) */
  notices: Notice[] = []

  constructor(
    readonly game: Sim,
    opts: Partial<DirectorOptions> = {},
  ) {
    this.opts = { ...DEFAULT_DIRECTOR, ...opts }
    this.nextVote = this.opts.voteEvery > 0 ? Math.min(40, this.opts.voteEvery) : Infinity
    // se empieza con la reserva casi llena: lo primero que hagan los espectadores tiene efecto al momento
    this.tokens = PRESSURE[game.mode].cap * 0.75
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

  /**
   * Tensión: compara cómo va la partida con un ritmo «justo» (que se decida al final) y sube o baja el ritmo de la
   * presión. Si el streamer va sobrado, el jardín/la horda aprietan más; si va muy mal, aflojan. Nunca anula a nadie.
   */
  get tension(): number {
    const g = this.game
    const f = Math.min(1, g.s.t / g.cfg.duration)
    if (f < 0.08) {
      this.err = 0
      return 1
    }
    let err: number
    if (g.mode === 'invasion') {
      const done = (g.s.assaults + Math.min(1, g.s.king.z / LENGTH) * 0.6) / g.cfg.assaults
      err = done - f
    } else {
      const house = g.s.house / g.cfg.houseHp
      // la casa suele aguantar al principio y sufrir al final
      err = house - (1 - 0.85 * Math.pow(f, 1.8))
    }
    // la horda tarda en llegar a la casa: en Defensa se corrige más suave para no pasarse
    this.err = err
    return g.mode === 'invasion' ? Math.max(0.45, Math.min(2.2, 1 + err * 2.2)) : Math.max(0.5, Math.min(2, 1 + err * 1.2))
  }

  private get pressure() {
    const p = PRESSURE[this.game.mode]
    // en Invasión, con más público un poco más de ritmo (sus defensas son más variadas y menos eficaces que las del jardín)
    return { ...p, rate: (this.opts.rate > 0 ? this.opts.rate : p.rate) * this.tension }
  }

  /**
   * Acción gratis: solo si queda presupuesto. Lo de menos prioridad (likes y comentarios sin palabra clave) solo
   * gasta la mitad alta de la reserva, para que no llenen el jardín de lo más flojo.
   */
  private free(cost: number, low = false): boolean {
    if (!this.opts.adaptive) return true
    if (this.tokens < cost + (low ? this.pressure.cap * 0.5 : 0)) return false
    this.tokens -= cost
    return true
  }

  /** Acción pagada (regalo): siempre ocurre; descuenta del presupuesto hasta un límite de deuda. */
  private paid(cost: number): void {
    this.paidAcc += cost
    if (this.opts.adaptive) this.tokens = Math.max(-this.pressure.debt, this.tokens - cost)
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
    this.paid(EVENT_UNITS[name] ?? 10)
    this.say(owner, EVENT_LABEL[name], 'event')
  }

  /** Con la reserva en el fondo, los regalos pequeños siguen haciendo algo, pero de uno en uno. */
  private get broke(): boolean {
    return this.opts.adaptive && this.tokens <= -this.pressure.debt + 0.01
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

  private plant(g: Game, kind: GuardianKind, who: string, n = 1, gift = false, low = false): void {
    let ok = 0
    if (gift && this.broke) n = 1
    for (let i = 0; i < n; i++) {
      if (gift) this.paid(PLANT_UNITS[kind])
      else if (!this.free(PLANT_UNITS[kind], low)) break
      if (g.plant(kind, who)) ok++
    }
    if (ok) this.say(who, `${ok > 1 ? `${ok} × ` : ''}${GUARDIANS[kind].name}`, 'plant')
  }

  private invasion(g: Game, ev: LiveIn, uid: string, who: string): void {
    const w = this.weight
    switch (ev.type) {
      case 'like': {
        // los likes se suman entre todos; cada N brota una defensa al azar del jardín (si queda presupuesto)
        this.likeBank = Math.min(this.likeBank + Number((ev.payload as { count?: number })?.count ?? 1), this.opts.likesPer * 6)
        let n = 0
        while (this.likeBank >= this.opts.likesPer && n < 6) {
          this.likeBank -= this.opts.likesPer
          n++
          const kind = this.gardenKind()
          if (!this.free(PLANT_UNITS[kind], true)) break
          g.plant(kind, who)
        }
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
        } else if (this.ready(uid, 'brote', 8 * slow)) this.plant(g, 'brote', who, 1, false, true)
        return
      }
      case 'gift': {
        const p = ev.payload as { diamonds: number; count: number }
        const coins = (p.diamonds || 0) * (p.count || 1)
        if (coins >= 1000) {
          this.paid(PLANT_UNITS.ancestral)
          g.plant('ancestral', who)
          this.say(who, 'Guardián Ancestral', 'event')
          this.queueBig('calabazas', who)
        } else if (coins >= 499) this.queueBig('tormenta', who)
        else if (coins >= 299) this.queueBig('enredadera', who)
        else if (coins >= 199) {
          this.queueBig('mareo', who)
          this.plant(g, 'hongo', who, 2, true)
        } else if (coins >= 99) this.queueBig('enjambre', who)
        else if (coins >= 20) this.plant(g, 'hongo', who, 3, true)
        else if (coins >= 5) this.plant(g, 'tronco', who, 1, true)
        else this.plant(g, 'lanzabrotes', who, Math.min(5, Math.max(1, p.count || 1)), true)
        return
      }
      default:
        return
    }
  }

  private horde(g: DefenseGame, kind: ZombieKind, n: number, who: string, gift = false, low = false): void {
    const u = ZOMBIE_UNITS[kind]
    if (gift && this.broke) n = 1
    if (gift) this.paid(u * n)
    else if (this.opts.adaptive) {
      n = Math.min(n, Math.floor(Math.max(0, this.tokens - (low ? this.pressure.cap * 0.5 : 0)) / u))
      this.tokens -= n * u
    }
    if (n <= 0) return
    const k = g.send(kind, n, who)
    if (k > 0) this.say(who, `${k > 1 ? `${k} × ` : ''}${ZOMBIES[kind].name}`, 'horde')
  }

  private defense(g: DefenseGame, ev: LiveIn, uid: string, who: string): void {
    const w = this.weight
    switch (ev.type) {
      case 'like': {
        this.likeBank += Number((ev.payload as { count?: number })?.count ?? 1)
        const per = this.opts.likesPer
        let n = 0
        while (this.likeBank >= per && n < 6) {
          this.likeBank -= per
          n++
        }
        if (this.likeBank > per * 6) this.likeBank = per * 6
        if (n) this.horde(g, 'caminante', n, who, false, true)
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
        } else if (this.ready(uid, 'caminante', 8 * slow)) this.horde(g, 'caminante', 1, who, false, true)
        return
      }
      case 'gift': {
        const p = ev.payload as { diamonds: number; count: number }
        const coins = (p.diamonds || 0) * (p.count || 1)
        if (coins >= 1000) {
          this.horde(g, 'titan', 1, who, true)
          this.queueBig('noche', who)
        } else if (coins >= 499) this.queueBig('asedio', who)
        else if (coins >= 299) this.queueBig('estampida', who)
        else if (coins >= 199) this.horde(g, 'coloso', 1, who, true)
        else if (coins >= 99) this.queueBig('tunel', who)
        else if (coins >= 20) this.horde(g, 'corredor', 5, who, true)
        else if (coins >= 5) this.horde(g, 'blindado', 1, who, true)
        else this.horde(g, 'caminante', Math.min(10, 2 * Math.max(1, p.count || 1)), who, true)
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
    // presupuesto de presión: se rellena; si se llena (nadie lo usa), el jardín o la horda lo gastan solos
    if (this.opts.adaptive) {
      const p = this.pressure
      this.tokens = Math.min(p.cap, this.tokens + p.rate * Math.max(0, t - this.lastT))
      if (this.tokens >= p.cap) this.autoSpend(p.cap * 0.5)
      // poder del streamer: si los regalos superan con creces el ritmo normal, su personaje se hace más fuerte
      const dt = Math.max(0, t - this.lastT)
      if (dt > 0) {
        const k = 1 - Math.exp(-dt / 30)
        this.paidRate += (this.paidAcc / dt - this.paidRate) * k
        this.paidAcc = 0
      }
      const ratio = this.paidRate / p.rate
      // y si va muy por detrás, también (adrenalina): así ninguna partida queda decidida demasiado pronto
      const target = Math.max(1, Math.min(2.4, Math.max(1 + (ratio - 0.6) * 0.9, 1 - Math.min(0, this.err) * (this.game.mode === 'invasion' ? 1.2 : 2.5))))
      this.game.s.power += (target - this.game.s.power) * Math.min(1, dt * 0.2)
    }
    this.lastT = t
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

  /** Lo que planta el jardín por su cuenta (y los likes). */
  private gardenKind(r?: number): GuardianKind {
    if (r === undefined) {
      this.autoN++
      r = ((this.autoN * 0.618034) % 1 + ((this.t * 0.37) % 1)) % 1
    }
    return r < 0.35 ? 'brote' : r < 0.7 ? 'lanzabrotes' : r < 0.82 ? 'tronco' : r < 0.92 ? 'glacial' : 'hongo'
  }

  private autoSpend(units: number): void {
    const g = this.game
    this.autoN++
    const r = ((this.autoN * 0.618034) % 1 + ((this.t * 0.37) % 1)) % 1
    if (g.mode === 'invasion') {
      const kind = this.gardenKind(r)
      const n = Math.max(1, Math.floor(units / PLANT_UNITS[kind]))
      this.tokens -= n * PLANT_UNITS[kind]
      for (let i = 0; i < n; i++) g.plant(kind, '')
    } else {
      const kind: ZombieKind = r < 0.55 ? 'caminante' : r < 0.75 ? 'corredor' : r < 0.9 ? 'blindado' : 'excavador'
      const n = Math.max(1, Math.floor(units / ZOMBIE_UNITS[kind]))
      this.tokens -= n * ZOMBIE_UNITS[kind]
      g.send(kind, n, '')
    }
  }

  get queuedBig(): number {
    return this.big.length
  }
}
