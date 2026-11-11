/**
 * LAST HOUSE: modo Defensa — el streamer es el Guardián de la última casa y los espectadores mandan la horda.
 *
 * El Guardián se mueve delante de la puerta y dispara semillas; con la energía planta defensas (las mismas criaturas
 * que plantan los espectadores en Invasión). La horda llega desde la calle: caminantes, corredores, blindados,
 * excavadores (pasan por debajo de las defensas), colosos y el titán. Gana el Guardián si la casa sigue en pie al
 * acabarse el tiempo; gana la horda si la casa cae.
 *
 * Sin espectadores también se juega: hay oleadas automáticas que crecen cada 25 s.
 * Determinista con la misma semilla (las pruebas reproducen partidas).
 */
import { ZOMBIES, type RenderState, type Simulation, type UnitView, type ZombieKind } from './common'
import { GUARDIANS, HALF_W, LANES, LANE_W, LENGTH, rng, type Fx, type Guardian, type GuardianKind, type Shot } from './sim'

export interface Zombie {
  id: number
  kind: ZombieKind
  x: number
  z: number
  hp: number
  maxHp: number
  owner: string
  hitAt: number
  slowUntil: number
  stunUntil: number
  underground: boolean
  attacking: boolean
  /** titán / coloso: próximo golpe de área */
  next: number
}

export interface Hero {
  x: number
  z: number
  facing: number
  hp: number
  maxHp: number
  energy: number
  shootAt: number
  pulseAt: number
  dashAt: number
  dashUntil: number
  dashDir: number
  plantAt: number
  downUntil: number
  hurtAt: number
}

export interface DefenseInput {
  mx: number
  mz: number
  /** disparar */
  attack: boolean
  /** esquiva lateral */
  dash: boolean
  /** onda expansiva */
  roar: boolean
  /** plantar la defensa elegida */
  summon: boolean
  /** defensa elegida (teclas 1–6) */
  pick: GuardianKind
}

/** Lo que cuesta cada defensa en energía (las que planta el Guardián). */
export const PLANT_COST: Partial<Record<GuardianKind, number>> = { brote: 25, lanzabrotes: 50, glacial: 70, hongo: 60, raiz: 80, tronco: 110 }
export const PLANT_ORDER: GuardianKind[] = ['lanzabrotes', 'brote', 'tronco', 'glacial', 'hongo', 'raiz']

export interface DefenseConfig {
  duration: number
  houseHp: number
  /** tope de zombis vivos a la vez (los demás esperan en cola) */
  maxZombies: number
  /** multiplicador de vida de la horda (lo ajusta el director según los espectadores) */
  hpMul: number
  /** cada cuántos segundos llega una oleada automática */
  waveEvery: number
  seed: number
}

export const DEFAULT_DEFENSE: DefenseConfig = { duration: 300, houseHp: 1500, maxZombies: 160, hpMul: 1, waveEvery: 25, seed: 1 }

const HERO_SPEED = 7
const HERO_ZMIN = LENGTH - 26
const HERO_ZMAX = LENGTH - 2.5
const SHOOT_CD = 0.17
const SHOT_DMG = 15
const PULSE_CD = 10
const PULSE_R = 7
const DASH_CD = 3
const ENERGY_MAX = 300
const ENERGY_REGEN = 7

export interface DefenseState {
  t: number
  phase: 'playing' | 'ended'
  winner: 'horda' | 'guardian' | null
  hero: Hero
  house: number
  zombies: Zombie[]
  queue: { kind: ZombieKind; owner: string; x?: number }[]
  guardians: Guardian[]
  shots: Shot[]
  wave: number
  nextWave: number
  kills: number
  /** titanes derribados */
  titans: number
  /** poder del Guardián (1–2,2): sube cuando el chat aprieta mucho (lo ajusta el director) */
  power: number
  /** daño hecho a la casa por cada espectador y zombis enviados */
  scores: Map<string, { sent: number; damage: number }>
  fx: Fx[]
  nextId: number
  stormUntil: number
  spawnAt: number
}

export class DefenseGame implements Simulation {
  readonly mode = 'defensa' as const
  readonly cfg: DefenseConfig
  readonly s: DefenseState
  private readonly rand: () => number
  private moving = false

  constructor(cfg: Partial<DefenseConfig> = {}) {
    this.cfg = { ...DEFAULT_DEFENSE, ...cfg }
    this.rand = rng(this.cfg.seed)
    this.s = {
      t: 0,
      phase: 'playing',
      winner: null,
      hero: { x: 0, z: LENGTH - 8, facing: Math.PI, hp: 100, maxHp: 100, energy: 120, shootAt: 0, pulseAt: 0, dashAt: 0, dashUntil: 0, dashDir: 0, plantAt: 0, downUntil: 0, hurtAt: -9 },
      house: this.cfg.houseHp,
      zombies: [],
      queue: [],
      guardians: [],
      shots: [],
      wave: 0,
      nextWave: 6,
      kills: 0,
      titans: 0,
      power: 1,
      scores: new Map(),
      fx: [],
      nextId: 1,
      stormUntil: 0,
      spawnAt: 0,
    }
  }

  get timeLeft(): number {
    return Math.max(0, this.cfg.duration - this.s.t)
  }

  drainFx(): Fx[] {
    const out = this.s.fx
    this.s.fx = []
    return out
  }

  render(): RenderState {
    const s = this.s
    const h = s.hero
    const atk = SHOOT_CD - (h.shootAt - s.t)
    const units: UnitView[] = s.zombies.map((z) => ({
      id: z.id,
      kind: z.kind,
      x: z.x,
      z: z.z,
      hp: z.hp,
      maxHp: z.maxHp,
      hitAt: z.hitAt,
      underground: z.underground,
      owner: z.owner,
      attacking: z.attacking,
      slowed: s.t < z.slowUntil,
    }))
    return {
      mode: 'defensa',
      t: s.t,
      phase: s.phase,
      winner: s.winner,
      hero: {
        x: h.x,
        z: h.z,
        facing: h.facing,
        moving: this.moving,
        down: h.downUntil > 0,
        inside: false,
        safe: false,
        dashing: s.t < h.dashUntil,
        attack: atk >= 0 && atk < SHOOT_CD ? atk / SHOOT_CD : -1,
        hurt: s.t - h.hurtAt < 0.12,
        confused: false,
        slowed: false,
      },
      units,
      guardians: s.guardians,
      shots: s.shots,
      night: s.t < s.stormUntil ? 1 : Math.min(0.85, (s.t / this.cfg.duration) * 0.9),
      storm: s.t < s.stormUntil,
      house: Math.max(0, s.house / this.cfg.houseHp),
    }
  }

  // ───────────────────────────── lo que mandan los espectadores ─────────────────────────────

  private score(owner: string) {
    let sc = this.s.scores.get(owner)
    if (!sc) this.s.scores.set(owner, (sc = { sent: 0, damage: 0 }))
    return sc
  }

  /** Pone zombis en la cola; salen por la calle poco a poco (como mucho 8 por segundo). */
  send(kind: ZombieKind, n: number, owner: string): number {
    if (this.s.phase !== 'playing') return 0
    const room = 600 - this.s.queue.length
    const k = Math.max(0, Math.min(n, room))
    for (let i = 0; i < k; i++) this.s.queue.push({ kind, owner })
    if (k > 0) this.score(owner).sent += k
    return k
  }

  /** Eventos grandes de la horda. */
  event(name: 'estampida' | 'tunel' | 'noche' | 'asedio', owner: string): void {
    const s = this.s
    if (s.phase !== 'playing') return
    s.fx.push({ type: 'event', name, owner })
    if (name === 'estampida') this.send('corredor', 18, owner)
    else if (name === 'tunel') this.send('excavador', 8, owner)
    else if (name === 'asedio') {
      this.send('coloso', 2, owner)
      this.send('blindado', 6, owner)
    } else {
      // noche de tormenta: rayos sobre las defensas del Guardián durante 20 s
      s.stormUntil = Math.max(s.stormUntil, s.t) + 20
    }
  }

  // ───────────────────────────── Guardián ─────────────────────────────

  /** Planta la defensa elegida delante del Guardián (gastando energía). */
  plant(kind: GuardianKind): Guardian | null {
    const s = this.s
    const h = s.hero
    const cost = PLANT_COST[kind]
    if (cost === undefined || h.energy < cost || s.t < h.plantAt || s.guardians.length >= 120) return null
    const def = GUARDIANS[kind]
    const x = Math.max(-HALF_W + def.radius, Math.min(HALF_W - def.radius, h.x))
    const z = Math.max(8, h.z - 3.2)
    if (def.solid) for (const g of s.guardians) if (GUARDIANS[g.kind].solid && Math.hypot(g.x - x, g.z - z) < GUARDIANS[g.kind].radius + def.radius + 0.1) return null
    h.energy -= cost
    h.plantAt = s.t + 0.35
    const g: Guardian = { id: s.nextId++, kind, x, z, hp: def.hp * 1.4, maxHp: def.hp * 1.4, owner: 'Guardián', born: s.t, next: s.t + 0.5, fuse: -1, stunUntil: 0, hitAt: -9 }
    s.guardians.push(g)
    s.fx.push({ type: 'plant', kind, x, z, owner: '' })
    return g
  }

  private damageZombie(z: Zombie, dmg: number, by: string | null): void {
    const def = ZOMBIES[z.kind]
    z.hp -= dmg * def.armor
    z.hitAt = this.s.t
    if (z.hp > 0) return
    const s = this.s
    const i = s.zombies.indexOf(z)
    if (i >= 0) s.zombies.splice(i, 1)
    s.kills++
    if (z.kind === 'titan') s.titans++
    s.hero.energy = Math.min(ENERGY_MAX, s.hero.energy + def.reward)
    s.fx.push({ type: 'zombieDown', x: z.x, z: z.z, big: z.kind === 'coloso' || z.kind === 'titan', owner: z.owner })
    void by
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

  private explode(x: number, z: number, r: number, dmg: number, hurtsPlants: boolean): void {
    const s = this.s
    s.fx.push({ type: 'boom', x, z, r })
    for (const zb of [...s.zombies]) if (!zb.underground && Math.hypot(zb.x - x, zb.z - z) < r + ZOMBIES[zb.kind].radius) this.damageZombie(zb, dmg, null)
    if (hurtsPlants) for (const g of [...s.guardians]) if (Math.hypot(g.x - x, g.z - z) < r) this.damageGuardian(g, dmg * 0.8)
  }

  private spawnOne(kind: ZombieKind, owner: string): void {
    const s = this.s
    const def = ZOMBIES[kind]
    const lane = Math.floor(this.rand() * LANES)
    const x = Math.max(-HALF_W + def.radius, Math.min(HALF_W - def.radius, -HALF_W + LANE_W * (lane + 0.5) + (this.rand() - 0.5) * LANE_W * 0.6))
    const hp = def.hp * this.cfg.hpMul * (1 + s.wave * 0.04)
    s.zombies.push({ id: s.nextId++, kind, x, z: -1 - this.rand() * 2, hp, maxHp: hp, owner, hitAt: -9, slowUntil: 0, stunUntil: 0, underground: kind === 'excavador', attacking: false, next: s.t + 2 })
    if (kind === 'coloso' || kind === 'titan' || owner) s.fx.push({ type: 'spawn', x, z: 0, big: kind === 'coloso' || kind === 'titan', owner, kind })
  }

  // ───────────────────────────── bucle ─────────────────────────────

  tick(dt: number, input: DefenseInput): void {
    const s = this.s
    if (s.phase !== 'playing') return
    dt = Math.min(dt, 0.05)
    s.t += dt
    const t = s.t
    const h = s.hero
    if (t >= this.cfg.duration) return this.end('guardian')

    // ── oleadas automáticas (sin espectadores también hay partida) ──
    if (t >= s.nextWave) {
      s.wave++
      s.nextWave = t + this.cfg.waveEvery
      s.fx.push({ type: 'wave', n: s.wave })
      const n = 4 + s.wave * 2
      for (let i = 0; i < n; i++) s.queue.push({ kind: s.wave >= 3 && i % 4 === 3 ? 'corredor' : s.wave >= 5 && i % 5 === 4 ? 'blindado' : 'caminante', owner: '' })
      if (s.wave % 4 === 0) s.queue.push({ kind: 'coloso', owner: '' })
    }
    // la cola sale poco a poco (y nunca más del tope a la vez)
    if (s.queue.length && t >= s.spawnAt && s.zombies.length < this.cfg.maxZombies) {
      const q = s.queue.shift()!
      this.spawnOne(q.kind, q.owner)
      s.spawnAt = t + (q.kind === 'titan' || q.kind === 'coloso' ? 0.5 : 0.12)
    }

    // ── Guardián ──
    h.energy = Math.min(ENERGY_MAX, h.energy + ENERGY_REGEN * s.power * dt)
    if (h.downUntil > 0 && t >= h.downUntil) {
      h.downUntil = 0
      h.hp = h.maxHp
    }
    const free = h.downUntil === 0
    this.moving = false
    if (free) {
      const dashing = t < h.dashUntil
      let vx = Math.max(-1, Math.min(1, input.mx))
      let vz = Math.max(-1, Math.min(1, input.mz))
      const len = Math.hypot(vx, vz)
      if (len > 1) {
        vx /= len
        vz /= len
      }
      if (dashing) {
        vx = h.dashDir
        vz = 0
      }
      const sp = dashing ? 22 : HERO_SPEED
      h.x = Math.max(-HALF_W + 0.6, Math.min(HALF_W - 0.6, h.x + vx * sp * dt))
      h.z = Math.max(HERO_ZMIN, Math.min(HERO_ZMAX, h.z + vz * sp * dt))
      this.moving = dashing || len > 0.1
      // siempre mira hacia la calle, apuntando al zombi más cercano de su franja
      let aim: Zombie | null = null
      let best = 1e9
      for (const z of s.zombies) {
        if (z.underground || z.z > h.z) continue
        const d = Math.abs(z.x - h.x) * 3 + (h.z - z.z)
        if (d < best) {
          best = d
          aim = z
        }
      }
      const ax = aim ? aim.x - h.x : 0
      const az = aim ? aim.z - h.z : -1
      h.facing = Math.atan2(ax, az)
      if (input.attack && t >= h.shootAt) {
        h.shootAt = t + SHOOT_CD
        const d = Math.max(0.01, Math.hypot(ax, az))
        s.shots.push({ id: s.nextId++, x: h.x, z: h.z - 0.6, y: 1.4, vx: (ax / d) * 30, vz: (az / d) * 30, dmg: SHOT_DMG * s.power, life: 1.6, kind: 'semilla', tx: 1, tz: 0, t: 0, dur: 0 })
        s.fx.push({ type: 'shoot', x: h.x, z: h.z })
      }
      if (input.dash && t >= h.dashAt && Math.abs(input.mx) > 0.1) {
        h.dashAt = t + DASH_CD
        h.dashUntil = t + 0.25
        h.dashDir = Math.sign(input.mx)
        s.fx.push({ type: 'dash', x: h.x, z: h.z })
      }
      if (input.roar && t >= h.pulseAt) {
        h.pulseAt = t + PULSE_CD / s.power
        s.fx.push({ type: 'pulse', x: h.x, z: h.z, r: PULSE_R })
        for (const z of [...s.zombies]) {
          if (z.underground) continue
          const d = Math.hypot(z.x - h.x, z.z - h.z)
          if (d < PULSE_R) {
            z.z = Math.max(-2, z.z - 4 * (1 - d / PULSE_R))
            z.stunUntil = t + 1.5
            this.damageZombie(z, 45 * s.power, 'Guardián')
          }
        }
      }
      if (input.summon) this.plant(input.pick)
    }

    // ── zombis ──
    for (const z of [...s.zombies]) {
      const def = ZOMBIES[z.kind]
      z.attacking = false
      if (t < z.stunUntil) continue
      let speed = def.speed * (t < z.slowUntil ? 0.45 : 1)
      if (z.underground) {
        z.z += speed * dt
        if (z.z >= LENGTH - 30) {
          z.underground = false
          s.fx.push({ type: 'surface', x: z.x, z: z.z })
        }
        continue
      }
      // la casa
      if (z.z >= LENGTH - 1.2) {
        z.attacking = true
        s.house -= def.dps * dt
        this.score(z.owner || 'Horda').damage += def.dps * dt
        if (Math.floor((t - dt) * 2) !== Math.floor(t * 2)) s.fx.push({ type: 'houseHit', dmg: def.dps / 2 })
        if (s.house <= 0) return this.end('horda')
        continue
      }
      // defensas en su camino
      let block: Guardian | null = null
      for (const g of s.guardians) {
        const gd = GUARDIANS[g.kind]
        if (!gd.solid) continue
        if (Math.abs(g.x - z.x) < gd.radius + def.radius && g.z > z.z - 0.2 && g.z - z.z < gd.radius + def.radius + 0.25) {
          block = g
          break
        }
      }
      if (block) {
        z.attacking = true
        if (z.kind === 'coloso' || z.kind === 'titan') {
          // golpe de área cada 2,5 s
          if (t >= z.next) {
            z.next = t + 2.5
            this.explode(z.x, z.z + def.radius + 0.8, z.kind === 'titan' ? 4 : 2.6, def.dps * 1.5, true)
          }
        } else this.damageGuardian(block, def.dps * dt)
        speed = 0
      }
      // el Guardián: si un zombi le toca, le hace daño
      if (free && Math.hypot(z.x - h.x, z.z - h.z) < def.radius + 0.6) {
        z.attacking = true
        speed = 0
        h.hp -= def.dps * 0.6 * dt
        h.hurtAt = t
        if (h.hp <= 0) {
          h.hp = 0
          h.downUntil = t + 3
          s.fx.push({ type: 'down' })
        }
      }
      z.z += speed * dt
    }

    // ── defensas ──
    for (const g of [...s.guardians]) {
      if (t < g.stunUntil) continue
      switch (g.kind) {
        case 'lanzabrotes': {
          if (t < g.next) break
          let tgt: Zombie | null = null
          let best = 30
          for (const z of s.zombies) {
            if (z.underground || z.z > g.z + 0.5 || Math.abs(z.x - g.x) > LANE_W * 0.7) continue
            const d = g.z - z.z
            if (d < best) {
              best = d
              tgt = z
            }
          }
          if (tgt) {
            g.next = t + 0.9
            const d = Math.max(0.01, Math.hypot(tgt.x - g.x, tgt.z - g.z))
            s.shots.push({ id: s.nextId++, x: g.x, z: g.z, y: 1.1, vx: ((tgt.x - g.x) / d) * 18, vz: ((tgt.z - g.z) / d) * 18, dmg: 12 * s.power, life: 2.2, kind: 'semilla', tx: 1, tz: 0, t: 0, dur: 0 })
          } else g.next = t + 0.2
          break
        }
        case 'glacial':
          for (const z of s.zombies) if (!z.underground && Math.hypot(z.x - g.x, z.z - g.z) < 5.5) z.slowUntil = t + 0.3
          break
        case 'hongo':
          if (g.fuse < 0) {
            if (s.zombies.some((z) => !z.underground && Math.hypot(z.x - g.x, z.z - g.z) < 2.2)) g.fuse = t + 0.5
          } else if (t >= g.fuse) {
            this.explode(g.x, g.z, 3.6, 160, false)
            const i = s.guardians.indexOf(g)
            if (i >= 0) s.guardians.splice(i, 1)
          }
          break
        case 'raiz':
          if (t >= g.next) {
            g.next = t + 1
            for (const o of s.guardians) if (o !== g && Math.hypot(o.x - g.x, o.z - g.z) < 6.5) o.hp = Math.min(o.maxHp, o.hp + 12)
            if (Math.hypot(h.x - g.x, h.z - g.z) < 6.5) h.hp = Math.min(h.maxHp, h.hp + 6)
          }
          break
        default:
          break
      }
    }

    // ── noche de tormenta: rayos sobre las defensas ──
    if (t < s.stormUntil && s.guardians.length && this.rand() < dt * 0.7) {
      const g = s.guardians[Math.floor(this.rand() * s.guardians.length)]!
      s.shots.push({ id: s.nextId++, x: g.x, z: g.z, y: 40, vx: 0, vz: 0, dmg: 60, life: 3, kind: 'rayo', tx: g.x, tz: g.z, t: 0, dur: 1 })
    }

    // ── disparos ──
    for (const sh of [...s.shots]) {
      const remove = () => {
        const i = s.shots.indexOf(sh)
        if (i >= 0) s.shots.splice(i, 1)
      }
      if (sh.kind === 'rayo' || sh.kind === 'mortero') {
        sh.t += dt
        sh.y = 30 * (1 - sh.t / sh.dur)
        if (sh.t >= sh.dur) {
          s.fx.push({ type: 'lightning', x: sh.tx, z: sh.tz })
          this.explode(sh.tx, sh.tz, 2, sh.dmg, true)
          remove()
        }
        continue
      }
      sh.x += sh.vx * dt
      sh.z += sh.vz * dt
      sh.life -= dt
      if (sh.life <= 0 || sh.z < -3 || Math.abs(sh.x) > HALF_W + 1) {
        remove()
        continue
      }
      for (const z of s.zombies) {
        if (z.underground) continue
        if (Math.hypot(z.x - sh.x, z.z - sh.z) < ZOMBIES[z.kind].radius + 0.25) {
          this.damageZombie(z, sh.dmg, 'Guardián')
          s.fx.push({ type: 'hit', x: sh.x, z: sh.z, big: false })
          remove()
          break
        }
      }
    }
  }

  private end(w: 'horda' | 'guardian'): void {
    this.s.phase = 'ended'
    this.s.winner = w
    this.s.fx.push({ type: 'end', winner: w })
  }
}
