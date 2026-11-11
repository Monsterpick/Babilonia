import type { RenderState, Simulation } from './common'

/**
 * LAST HOUSE: Invasión — simulación del juego (sin dibujo: se puede probar sola).
 *
 * Modo «Invasión»: el streamer es el Rey de la Horda y corre por el jardín hasta la puerta de la última casa. Los
 * espectadores son los Guardianes: con likes, comentarios, follows, compartidos y regalos plantan defensas en su camino.
 * Cada vez que el Rey llega a la puerta suma un asalto; gana si completa los asaltos antes de que se acabe el tiempo.
 *
 * Todo es determinista dado el generador de números (semilla): las pruebas reproducen partidas enteras.
 * Unidades: metros y segundos. El jardín va de z = 0 (calle) a z = LENGTH (puerta); x de −HALF_W a +HALF_W.
 */

export const LENGTH = 110
export const HALF_W = 8
export const LANES = 5
export const LANE_W = (HALF_W * 2) / LANES

export type GuardianKind = 'brote' | 'lanzabrotes' | 'tronco' | 'glacial' | 'hongo' | 'raiz' | 'ancestral'

export interface GuardianDef {
  name: string
  hp: number
  radius: number
  /** Bloquea el paso (hay que romperlo o rodearlo). */
  solid: boolean
  /** Segundos que vive si nadie lo rompe (0 = toda la partida). */
  life: number
}

export const GUARDIANS: Record<GuardianKind, GuardianDef> = {
  brote: { name: 'Brote', hp: 34, radius: 0.75, solid: true, life: 45 },
  lanzabrotes: { name: 'Lanzabrotes', hp: 40, radius: 0.7, solid: true, life: 60 },
  tronco: { name: 'Tronco Guardián', hp: 240, radius: 1.25, solid: true, life: 90 },
  glacial: { name: 'Flor Glacial', hp: 50, radius: 0.7, solid: false, life: 40 },
  hongo: { name: 'Hongo Volátil', hp: 20, radius: 0.6, solid: false, life: 60 },
  raiz: { name: 'Raíz Sanadora', hp: 60, radius: 0.7, solid: false, life: 50 },
  ancestral: { name: 'Guardián Ancestral', hp: 900, radius: 2.4, solid: true, life: 70 },
}

export interface Guardian {
  id: number
  kind: GuardianKind
  x: number
  z: number
  hp: number
  maxHp: number
  owner: string
  born: number
  /** Próximo disparo / pulso. */
  next: number
  /** Hongo: cuándo explota una vez activado (−1 = dormido). */
  fuse: number
  /** Aturdido hasta (rugido del Rey). */
  stunUntil: number
  /** Para animar el golpe recibido. */
  hitAt: number
}

export interface Minion {
  id: number
  x: number
  z: number
  hp: number
  hitAt: number
}

export interface Shot {
  id: number
  x: number
  z: number
  y: number
  vx: number
  vz: number
  dmg: number
  life: number
  /** 'semilla' recta; 'mortero' cae en (tx, tz). */
  kind: 'semilla' | 'mortero' | 'rayo'
  tx: number
  tz: number
  t: number
  dur: number
}

/** Cosas que pasan y que la vista convierte en efectos y sonido. */
export type Fx =
  | { type: 'plant'; kind: GuardianKind; x: number; z: number; owner: string }
  | { type: 'break'; kind: GuardianKind; x: number; z: number }
  | { type: 'hit'; x: number; z: number; big: boolean }
  | { type: 'kingHurt'; dmg: number }
  | { type: 'boom'; x: number; z: number; r: number }
  | { type: 'swipe'; x: number; z: number }
  | { type: 'roar'; x: number; z: number }
  | { type: 'dash'; x: number; z: number }
  | { type: 'summon'; x: number; z: number }
  | { type: 'assault'; n: number }
  | { type: 'down' }
  | { type: 'event'; name: string; owner: string }
  | { type: 'end'; winner: 'rey' | 'guardianes' | 'horda' | 'guardian' }
  // modo Defensa
  | { type: 'shoot'; x: number; z: number }
  | { type: 'pulse'; x: number; z: number; r: number }
  | { type: 'zombieDown'; x: number; z: number; big: boolean; owner: string }
  | { type: 'spawn'; x: number; z: number; big: boolean; owner: string; kind: string }
  | { type: 'houseHit'; dmg: number }
  | { type: 'surface'; x: number; z: number }
  | { type: 'wave'; n: number }
  | { type: 'lightning'; x: number; z: number }

export interface Input {
  /** −1..1 lateral y avance (ya normalizados por quien lee el teclado). */
  mx: number
  mz: number
  attack: boolean
  dash: boolean
  roar: boolean
  summon: boolean
}

export interface Config {
  /** Asaltos que necesita el Rey para ganar. */
  assaults: number
  /** Duración de la partida en segundos. */
  duration: number
  /** Likes que hacen falta para que brote un Brote. */
  likesPerSprout: number
  /** Tope de guardianes vivos (rendimiento y equilibrio con muchos espectadores). */
  maxGuardians: number
  seed: number
}

export const DEFAULT_CONFIG: Config = { assaults: 5, duration: 300, likesPerSprout: 12, maxGuardians: 150, seed: 1 }

export interface King {
  x: number
  z: number
  /** Hacia dónde mira (radianes; 0 = hacia la casa). */
  facing: number
  hp: number
  maxHp: number
  /** Recurso para invocar esbirros. */
  rot: number
  speedMul: number
  attackAt: number
  dashAt: number
  dashUntil: number
  roarAt: number
  summonAt: number
  /** Derribado hasta (vuelve a la calle). */
  downUntil: number
  /** Controles al revés hasta (evento de los espectadores). */
  confusedUntil: number
  /** Dentro de la casa, celebrando, hasta. */
  feastUntil: number
  hurtAt: number
  slowed: boolean
  /** Recién levantado: nada le hace daño hasta (evita que lo derriben nada más reaparecer). */
  safeUntil: number
}

/** Eventos que pueden pedir los espectadores en Invasión. */
export type InvasionEvent = 'mareo' | 'tormenta' | 'enjambre' | 'calabazas' | 'enredadera' | 'noche'

export interface State {
  t: number
  phase: 'playing' | 'ended'
  winner: 'rey' | 'guardianes' | null
  king: King
  guardians: Guardian[]
  minions: Minion[]
  shots: Shot[]
  assaults: number
  likeBank: number
  /** Guardianes plantados por cada espectador (marcador). */
  scores: Map<string, { plants: number; damage: number }>
  fx: Fx[]
  nextId: number
  /** Noche de tormenta (evento): rayos que caen cerca del Rey hasta. */
  stormUntil: number
  nextBolt: number
  /** Caídas del Rey en la partida (para logros). */
  downs: number
  /** poder del Rey (1–2,2): sube cuando el chat aprieta mucho (lo ajusta el director) */
  power: number
}

/** Generador determinista (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const KING_SPEED = 6.4
const KING_RADIUS = 0.7
const ATTACK_CD = 0.42
const ATTACK_DMG = 34
const ATTACK_RANGE = 2.6
const DASH_CD = 5
const DASH_TIME = 0.42
const DASH_SPEED = 26
const ROAR_CD = 14
const ROAR_RADIUS = 9
const SUMMON_CD = 3
const SUMMON_COST = 30
const ROT_MAX = 100
const ROT_REGEN = 4.5

export class Game implements Simulation {
  readonly cfg: Config
  readonly s: State
  private readonly rand: () => number

  constructor(cfg: Partial<Config> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg }
    this.rand = rng(this.cfg.seed)
    this.s = {
      t: 0,
      phase: 'playing',
      winner: null,
      king: this.newKing(),
      guardians: [],
      minions: [],
      shots: [],
      assaults: 0,
      likeBank: 0,
      scores: new Map(),
      fx: [],
      nextId: 1,
      stormUntil: 0,
      nextBolt: 0,
      downs: 0,
      power: 1,
    }
  }

  readonly mode = 'invasion' as const

  /** Lo que la vista necesita para dibujar este instante. */
  render(): RenderState {
    const s = this.s
    const k = s.king
    const atk = ATTACK_CD - (k.attackAt - s.t)
    return {
      mode: 'invasion',
      t: s.t,
      phase: s.phase,
      winner: s.winner,
      hero: {
        x: k.x,
        z: k.z,
        facing: k.facing,
        moving: this.moving,
        down: k.downUntil > 0,
        inside: k.feastUntil > 0,
        safe: s.t < k.safeUntil,
        dashing: s.t < k.dashUntil,
        attack: atk >= 0 && atk < 0.25 ? atk / 0.25 : -1,
        hurt: s.t - k.hurtAt < 0.12,
        confused: s.t < k.confusedUntil,
        slowed: k.slowed,
      },
      units: s.minions.map((m) => ({ id: m.id, kind: 'caminante', x: m.x, z: m.z, hp: m.hp, maxHp: 45, hitAt: m.hitAt, underground: false, owner: '', attacking: false, slowed: false })),
      guardians: s.guardians,
      shots: s.shots,
      // anochece con cada asalto (y del todo en la noche de tormenta)
      night: s.t < s.stormUntil ? 1 : Math.min(0.85, (s.assaults / Math.max(1, this.cfg.assaults)) * 0.9 + (s.t / this.cfg.duration) * 0.15),
      storm: s.t < s.stormUntil,
      house: null,
    }
  }

  /** Si el Rey se movió en el último paso (para la animación de correr). */
  private moving = false

  private newKing(): King {
    return { x: 0, z: 2, facing: 0, hp: 100, maxHp: 100, rot: 40, speedMul: 1, attackAt: 0, dashAt: 0, dashUntil: 0, roarAt: 0, summonAt: 0, downUntil: 0, confusedUntil: 0, feastUntil: 0, hurtAt: -9, slowed: false, safeUntil: 0 }
  }

  get timeLeft(): number {
    return Math.max(0, this.cfg.duration - this.s.t)
  }

  /** Vacía y devuelve los efectos pendientes (la vista los consume cada fotograma). */
  drainFx(): Fx[] {
    const out = this.s.fx
    this.s.fx = []
    return out
  }

  // ───────────────────────────── acciones de los espectadores ─────────────────────────────

  private score(owner: string) {
    let sc = this.s.scores.get(owner)
    if (!sc) this.s.scores.set(owner, (sc = { plants: 0, damage: 0 }))
    return sc
  }

  /**
   * Planta un guardián delante del Rey. Si no se indica sitio, cae en un carril al azar entre 8 y 30 m por delante
   * (nunca encima de él ni de otro guardián sólido). Devuelve null si no hay sitio o se alcanzó el tope.
   */
  plant(kind: GuardianKind, owner: string, at?: { x: number; z: number }): Guardian | null {
    const s = this.s
    if (s.phase !== 'playing') return null
    const def = GUARDIANS[kind]
    if (s.guardians.length >= this.cfg.maxGuardians) {
      // sitio para lo nuevo: se retira el brote más viejo
      const i = s.guardians.findIndex((g) => g.kind === 'brote')
      if (i < 0) return null
      s.guardians.splice(i, 1)
    }
    let x = 0
    let z = 0
    let ok = false
    for (let tries = 0; tries < 24 && !ok; tries++) {
      if (at && tries === 0) {
        x = at.x
        z = at.z
      } else {
        // casi la mitad de las veces cae en el carril por el que va el Rey (si no, bastaría con ir recto)
        const kingLane = Math.max(0, Math.min(LANES - 1, Math.floor((s.king.x + HALF_W) / LANE_W)))
        const lane = this.rand() < 0.45 ? kingLane : Math.floor(this.rand() * LANES)
        x = -HALF_W + LANE_W * (lane + 0.5) + (this.rand() - 0.5) * LANE_W * 0.5
        const ahead = kind === 'ancestral' ? 16 + this.rand() * 8 : 8 + this.rand() * 22
        z = s.king.z + ahead
      }
      x = Math.max(-HALF_W + def.radius, Math.min(HALF_W - def.radius, x))
      z = Math.max(6, Math.min(LENGTH - 6, z))
      ok = Math.hypot(x - s.king.x, z - s.king.z) > def.radius + 3
      if (ok && def.solid) for (const g of s.guardians) if (GUARDIANS[g.kind].solid && Math.hypot(g.x - x, g.z - z) < GUARDIANS[g.kind].radius + def.radius + 0.15) ok = false
    }
    if (!ok) return null
    const g: Guardian = { id: s.nextId++, kind, x, z, hp: def.hp, maxHp: def.hp, owner, born: s.t, next: s.t + 0.6 + this.rand() * 0.6, fuse: -1, stunUntil: 0, hitAt: -9 }
    s.guardians.push(g)
    if (owner) this.score(owner).plants++
    s.fx.push({ type: 'plant', kind, x, z, owner })
    return g
  }

  /** Likes: se acumulan entre todos; cada N brota un Brote (así 10 o 10.000 espectadores juegan parecido). */
  likes(count: number, owner: string): void {
    const s = this.s
    s.likeBank += Math.max(0, count)
    let made = 0
    while (s.likeBank >= this.cfg.likesPerSprout && made < 6) {
      s.likeBank -= this.cfg.likesPerSprout
      this.plant('brote', owner)
      made++
    }
    if (s.likeBank > this.cfg.likesPerSprout * 6) s.likeBank = this.cfg.likesPerSprout * 6
  }

  /** Eventos especiales (regalos medianos y grandes, y los que gana una votación). */
  event(name: InvasionEvent, owner: string): void {
    const s = this.s
    if (s.phase !== 'playing') return
    s.fx.push({ type: 'event', name, owner })
    if (name === 'mareo') s.king.confusedUntil = Math.max(s.king.confusedUntil, s.t) + 5
    else if (name === 'tormenta') {
      // lluvia de semillas: 10 morteros que caen alrededor de donde va a estar el Rey
      for (let i = 0; i < 10; i++) {
        const tx = Math.max(-HALF_W, Math.min(HALF_W, s.king.x + (this.rand() - 0.5) * 9))
        const tz = Math.min(LENGTH - 2, s.king.z + 4 + this.rand() * 14)
        s.shots.push({ id: s.nextId++, x: tx, z: tz, y: 30, vx: 0, vz: 0, dmg: 14, life: 9, kind: 'mortero', tx, tz, t: -i * 0.22, dur: 1.4 })
      }
    } else if (name === 'enjambre') {
      // enjambre: cinco lanzabrotes de golpe en abanico
      for (let i = 0; i < 5; i++) this.plant('lanzabrotes', owner, { x: -HALF_W + LANE_W * (i + 0.5), z: Math.min(LENGTH - 8, s.king.z + 14 + (i % 2) * 2) })
    } else if (name === 'calabazas') {
      // bombardeo de calabazas: 22 proyectiles repartidos por todo el tramo que tiene delante
      for (let i = 0; i < 22; i++) {
        const tx = -HALF_W + 1 + this.rand() * (HALF_W * 2 - 2)
        const tz = Math.min(LENGTH - 2, s.king.z + 2 + this.rand() * 26)
        s.shots.push({ id: s.nextId++, x: tx, z: tz, y: 34, vx: 0, vz: 0, dmg: 12, life: 12, kind: 'mortero', tx, tz, t: -i * 0.16, dur: 1.6 })
      }
    } else if (name === 'enredadera') {
      // enredadera: un muro de brotes de lado a lado (con un hueco) a 12 m del Rey
      const z = Math.min(LENGTH - 8, s.king.z + 12)
      const gap = Math.floor(this.rand() * 9)
      for (let i = 0; i < 9; i++) if (i !== gap) this.plant('brote', owner, { x: -HALF_W + 0.9 + i * ((HALF_W * 2 - 1.8) / 8), z })
    } else if (name === 'noche') {
      // noche de tormenta: 20 s de rayos que caen cerca del Rey (con aviso en el suelo)
      s.stormUntil = Math.max(s.stormUntil, s.t) + 20
      s.nextBolt = s.t + 1
    }
  }

  // ───────────────────────────── bucle ─────────────────────────────

  private hurtKing(dmg: number): void {
    const k = this.s.king
    if (this.s.t < k.downUntil || this.s.t < k.feastUntil || this.s.t < k.dashUntil || this.s.t < k.safeUntil) return
    dmg /= this.s.power
    k.hp -= dmg
    k.hurtAt = this.s.t
    this.s.fx.push({ type: 'kingHurt', dmg })
    if (k.hp <= 0) {
      // derribado: vuelve a la calle tras unos segundos (los guardianes ganan tiempo)
      k.hp = 0
      k.downUntil = this.s.t + 3.5
      this.s.downs++
      this.s.fx.push({ type: 'down' })
    }
  }

  private damageGuardian(g: Guardian, dmg: number): void {
    g.hp -= dmg
    g.hitAt = this.s.t
    if (g.hp <= 0) {
      this.s.fx.push({ type: 'break', kind: g.kind, x: g.x, z: g.z })
      const i = this.s.guardians.indexOf(g)
      if (i >= 0) this.s.guardians.splice(i, 1)
    }
  }

  private explode(x: number, z: number, r: number, dmg: number): void {
    const s = this.s
    s.fx.push({ type: 'boom', x, z, r })
    const k = s.king
    const d = Math.hypot(k.x - x, k.z - z)
    if (d < r + KING_RADIUS) {
      this.hurtKing(dmg * (1 - 0.5 * (d / (r + KING_RADIUS))))
      // empujón hacia fuera
      const nx = d > 0.01 ? (k.x - x) / d : 0
      const nz = d > 0.01 ? (k.z - z) / d : -1
      k.x = Math.max(-HALF_W + KING_RADIUS, Math.min(HALF_W - KING_RADIUS, k.x + nx * 2.2))
      k.z = Math.max(1, k.z + nz * 2.2)
    }
    for (const m of [...s.minions]) if (Math.hypot(m.x - x, m.z - z) < r + 0.5) this.hurtMinion(m, dmg)
  }

  private hurtMinion(m: Minion, dmg: number): void {
    m.hp -= dmg
    m.hitAt = this.s.t
    if (m.hp <= 0) {
      const i = this.s.minions.indexOf(m)
      if (i >= 0) this.s.minions.splice(i, 1)
      this.s.fx.push({ type: 'hit', x: m.x, z: m.z, big: true })
    }
  }

  tick(dt: number, input: Input): void {
    const s = this.s
    if (s.phase !== 'playing') return
    dt = Math.min(dt, 0.05)
    s.t += dt
    const k = s.king
    const t = s.t

    if (t >= this.cfg.duration) return this.end('guardianes')

    // ── Rey ──
    if (k.downUntil > 0 && t >= k.downUntil) {
      // se levanta en la calle con la vida llena
      k.downUntil = 0
      k.hp = k.maxHp
      k.x = 0
      k.z = 2
      k.safeUntil = t + 2.5
    }
    if (k.feastUntil > 0 && t >= k.feastUntil) {
      k.feastUntil = 0
      k.x = 0
      k.z = 2
      k.hp = k.maxHp
      k.safeUntil = t + 2.5
    }
    const free = k.downUntil === 0 && k.feastUntil === 0
    k.rot = Math.min(ROT_MAX, k.rot + ROT_REGEN * dt)
    if (free) {
      let mx = Math.max(-1, Math.min(1, input.mx))
      const mz = Math.max(-1, Math.min(1, input.mz))
      if (t < k.confusedUntil) mx = -mx
      // frenado por las Flores Glaciales cercanas
      k.slowed = s.guardians.some((g) => g.kind === 'glacial' && t >= g.stunUntil && Math.hypot(g.x - k.x, g.z - k.z) < 5.5)
      const dashing = t < k.dashUntil
      const speed = dashing ? DASH_SPEED : KING_SPEED * (k.slowed ? 0.5 : 1) * (1 + (s.power - 1) * 0.12)
      let vx = mx
      let vz = mz
      const len = Math.hypot(vx, vz)
      if (dashing) {
        vx = Math.sin(k.facing)
        vz = Math.cos(k.facing)
      } else if (len > 1) {
        vx /= len
        vz /= len
      }
      if (!dashing && len > 0.1) k.facing = Math.atan2(vx, vz)
      this.moving = dashing || len > 0.1
      let nx = k.x + vx * speed * dt
      let nz = k.z + vz * speed * dt
      // choque con guardianes sólidos (embistiendo, los rompe o los daña)
      for (const g of [...s.guardians]) {
        const def = GUARDIANS[g.kind]
        if (!def.solid) continue
        const rr = def.radius + KING_RADIUS
        const dx = nx - g.x
        const dz = nz - g.z
        const d = Math.hypot(dx, dz)
        if (d >= rr) continue
        if (dashing) {
          this.damageGuardian(g, 120 * s.power)
          s.fx.push({ type: 'hit', x: g.x, z: g.z, big: true })
          if (g.hp > 0) k.dashUntil = t // lo que aguanta la embestida la para en seco
        }
        if (g.hp > 0) {
          // se desliza alrededor
          const ux = d > 0.001 ? dx / d : 0
          const uz = d > 0.001 ? dz / d : -1
          nx = g.x + ux * rr
          nz = g.z + uz * rr
        }
      }
      k.x = Math.max(-HALF_W + KING_RADIUS, Math.min(HALF_W - KING_RADIUS, nx))
      k.z = Math.max(1, nz)

      // zarpazo: daña todo lo que tenga delante
      if (input.attack && t >= k.attackAt) {
        k.attackAt = t + ATTACK_CD
        const ax = k.x + Math.sin(k.facing) * 1.4
        const az = k.z + Math.cos(k.facing) * 1.4
        s.fx.push({ type: 'swipe', x: ax, z: az })
        for (const g of [...s.guardians]) {
          if (Math.hypot(g.x - ax, g.z - az) < ATTACK_RANGE * 0.62 + GUARDIANS[g.kind].radius) {
            this.damageGuardian(g, ATTACK_DMG * s.power)
            s.fx.push({ type: 'hit', x: g.x, z: g.z, big: false })
          }
        }
      }
      // embestida
      if (input.dash && t >= k.dashAt) {
        k.dashAt = t + DASH_CD
        k.dashUntil = t + DASH_TIME
        s.fx.push({ type: 'dash', x: k.x, z: k.z })
      }
      // rugido: aturde a los guardianes cercanos y despierta (y gasta) los hongos sin que le dañen
      if (input.roar && t >= k.roarAt) {
        k.roarAt = t + ROAR_CD
        s.fx.push({ type: 'roar', x: k.x, z: k.z })
        for (const g of s.guardians) if (Math.hypot(g.x - k.x, g.z - k.z) < ROAR_RADIUS) g.stunUntil = t + 3
      }
      // esbirros: tres caminantes que avanzan por delante y se comen los disparos
      if (input.summon && t >= k.summonAt && k.rot >= SUMMON_COST && s.minions.length < 12) {
        k.summonAt = t + SUMMON_CD
        k.rot -= SUMMON_COST
        for (let i = -1; i <= 1; i++) {
          const x = Math.max(-HALF_W + 0.5, Math.min(HALF_W - 0.5, k.x + i * 1.6))
          s.minions.push({ id: s.nextId++, x, z: k.z + 1.5, hp: 45, hitAt: -9 })
        }
        s.fx.push({ type: 'summon', x: k.x, z: k.z + 1.5 })
      }
      // puerta
      if (k.z >= LENGTH) {
        s.assaults++
        s.fx.push({ type: 'assault', n: s.assaults })
        if (s.assaults >= this.cfg.assaults) return this.end('rey')
        k.feastUntil = t + 3
        s.minions = []
      }
    }

    if (!free) this.moving = false

    // ── noche de tormenta: rayos con aviso de 1 s ──
    if (t < s.stormUntil && t >= s.nextBolt) {
      s.nextBolt = t + 1.6 + this.rand() * 1.2
      const tx = Math.max(-HALF_W + 1, Math.min(HALF_W - 1, k.x + (this.rand() - 0.5) * 7))
      const tz = Math.min(LENGTH - 2, k.z + this.rand() * 9)
      s.shots.push({ id: s.nextId++, x: tx, z: tz, y: 40, vx: 0, vz: 0, dmg: 18, life: 3, kind: 'rayo', tx, tz, t: 0, dur: 1.0 })
    }

    // ── esbirros ──
    for (const m of [...s.minions]) {
      let blocked: Guardian | null = null
      for (const g of s.guardians) {
        if (!GUARDIANS[g.kind].solid) continue
        if (Math.abs(g.x - m.x) < GUARDIANS[g.kind].radius + 0.45 && g.z > m.z - 0.2 && g.z - m.z < GUARDIANS[g.kind].radius + 0.6) {
          blocked = g
          break
        }
      }
      if (blocked) this.damageGuardian(blocked, 16 * dt)
      else m.z += 3.6 * dt
      if (m.z >= LENGTH) {
        const i = s.minions.indexOf(m)
        if (i >= 0) s.minions.splice(i, 1)
      }
    }

    // ── guardianes ──
    for (const g of [...s.guardians]) {
      const def = GUARDIANS[g.kind]
      if (def.life > 0 && t - g.born > def.life) {
        const i = s.guardians.indexOf(g)
        if (i >= 0) s.guardians.splice(i, 1)
        continue
      }
      if (t < g.stunUntil) continue
      const dk = Math.hypot(g.x - k.x, g.z - k.z)
      switch (g.kind) {
        case 'lanzabrotes': {
          if (t < g.next) break
          // dispara al objetivo más cercano que tenga por delante (hacia la calle) en su franja
          let tx = 0
          let tz = 0
          let best = 26
          const consider = (x: number, z: number) => {
            const dz = g.z - z
            if (dz < -1 || Math.abs(x - g.x) > LANE_W * 0.8) return
            const d = Math.hypot(x - g.x, dz)
            if (d < best) {
              best = d
              tx = x
              tz = z
            }
          }
          if (free) consider(k.x, k.z)
          for (const m of s.minions) consider(m.x, m.z)
          if (best < 26) {
            g.next = t + 1.0
            const d = Math.max(0.01, Math.hypot(tx - g.x, tz - g.z))
            s.shots.push({ id: s.nextId++, x: g.x, z: g.z, y: 1.1, vx: ((tx - g.x) / d) * 17, vz: ((tz - g.z) / d) * 17, dmg: 8, life: 2.2, kind: 'semilla', tx: 0, tz: 0, t: 0, dur: 0 })
          } else g.next = t + 0.25
          break
        }
        case 'hongo': {
          if (g.fuse < 0) {
            let near = free && dk < 2.4
            if (!near) near = s.minions.some((m) => Math.hypot(m.x - g.x, m.z - g.z) < 2)
            if (near) g.fuse = t + 0.55
          } else if (t >= g.fuse) {
            this.explode(g.x, g.z, 3.4, 34)
            const i = s.guardians.indexOf(g)
            if (i >= 0) s.guardians.splice(i, 1)
          }
          break
        }
        case 'raiz': {
          if (t < g.next) break
          g.next = t + 1
          for (const o of s.guardians) if (o !== g && o.hp < o.maxHp && Math.hypot(o.x - g.x, o.z - g.z) < 6.5) o.hp = Math.min(o.maxHp, o.hp + 9)
          break
        }
        case 'ancestral': {
          // golpea el suelo si el Rey se acerca
          if (t >= g.next && free && dk < 5.2) {
            g.next = t + 2.4
            this.explode(g.x, g.z - 1.5, 4.6, 22)
          }
          break
        }
        default:
          break
      }
    }

    // ── disparos ──
    for (const sh of [...s.shots]) {
      const remove = () => {
        const i = s.shots.indexOf(sh)
        if (i >= 0) s.shots.splice(i, 1)
      }
      if (sh.kind === 'mortero' || sh.kind === 'rayo') {
        sh.t += dt
        if (sh.t < 0) continue
        sh.y = 30 * (1 - sh.t / sh.dur)
        if (sh.t >= sh.dur) {
          if (sh.kind === 'rayo') s.fx.push({ type: 'lightning', x: sh.tx, z: sh.tz })
          this.explode(sh.tx, sh.tz, sh.kind === 'rayo' ? 2.2 : 2.8, sh.dmg)
          remove()
        }
        continue
      }
      sh.x += sh.vx * dt
      sh.z += sh.vz * dt
      sh.life -= dt
      if (sh.life <= 0 || sh.z < 0 || Math.abs(sh.x) > HALF_W + 1) {
        remove()
        continue
      }
      let hit = false
      for (const m of s.minions) {
        if (Math.hypot(m.x - sh.x, m.z - sh.z) < 0.6) {
          this.hurtMinion(m, sh.dmg)
          s.fx.push({ type: 'hit', x: sh.x, z: sh.z, big: false })
          hit = true
          break
        }
      }
      if (!hit && free && Math.hypot(k.x - sh.x, k.z - sh.z) < KING_RADIUS + 0.2) {
        this.hurtKing(sh.dmg)
        s.fx.push({ type: 'hit', x: sh.x, z: sh.z, big: false })
        hit = true
      }
      if (hit) remove()
    }
  }

  private end(winner: 'rey' | 'guardianes'): void {
    this.s.phase = 'ended'
    this.s.winner = winner
    this.s.fx.push({ type: 'end', winner })
  }
}
