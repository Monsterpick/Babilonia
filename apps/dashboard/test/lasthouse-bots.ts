/**
 * Bots para las pruebas de equilibrio y carga de LAST HOUSE: un jugador «decente» para cada modo y un público
 * simulado de N espectadores que pasa por el mismo Director que el directo de verdad.
 */
import { DefenseGame, PLANT_COST, type DefenseInput } from '../src/game/lasthouse/defense'
import { Director, type LiveIn } from '../src/game/lasthouse/director'
import { rng, Game, GUARDIANS, LENGTH, type GuardianKind, type Input } from '../src/game/lasthouse/sim'

/** Rey que esquiva lo sólido, pega cuando está bloqueado y usa las habilidades con cabeza. */
export function kingBot(g: Game, r: () => number): Input {
  const k = g.s.king
  let mx = 0
  let blocked = 0
  for (const gd of g.s.guardians) {
    const def = GUARDIANS[gd.kind]
    const dz = gd.z - k.z
    if (def.solid && dz > 0 && dz < 4.5 && Math.abs(gd.x - k.x) < def.radius + 1.1) {
      mx += gd.x > k.x ? -1 : 1
      if (dz < def.radius + 1.3) blocked++
    }
    // se aparta de los hongos armados
    if (gd.kind === 'hongo' && Math.hypot(gd.x - k.x, gd.z - k.z) < 3.5) mx += gd.x > k.x ? -1.5 : 1.5
  }
  if (Math.abs(k.x) > 6.5) mx += k.x > 0 ? -0.6 : 0.6
  return {
    mx: Math.max(-1, Math.min(1, mx)),
    mz: 1,
    attack: true,
    dash: blocked > 0 && r() < 0.05,
    roar: blocked > 1 || (blocked > 0 && r() < 0.01),
    summon: k.rot >= 30 && r() < 0.05,
  }
}

/** Guardián que se coloca donde hay más zombis, dispara siempre y planta cuando le sobra energía. */
export function guardBot(g: DefenseGame, r: () => number): DefenseInput {
  const h = g.s.hero
  let bx = h.x
  let best = -1
  for (const z of g.s.zombies) {
    if (z.underground) continue
    const w = 1 - Math.min(1, (h.z - z.z) / 70)
    if (w > best) {
      best = w
      bx = z.x
    }
  }
  const near = g.s.zombies.filter((z) => !z.underground && Math.hypot(z.x - h.x, z.z - h.z) < 5).length
  const options: GuardianKind[] = ['lanzabrotes', 'lanzabrotes', 'tronco', 'glacial', 'hongo', 'raiz']
  const want = options[Math.floor(r() * options.length)]!
  return {
    mx: Math.abs(bx - h.x) > 0.5 ? Math.sign(bx - h.x) : 0,
    mz: near > 2 ? 1 : h.z > LENGTH - 10 ? -0.5 : 0,
    attack: true,
    dash: near > 3 && r() < 0.1,
    roar: near >= 2,
    summon: h.energy > (PLANT_COST[want] ?? 999) + 20 && r() < 0.08,
    pick: want,
  }
}

const COINS = [1, 1, 1, 1, 1, 5, 5, 5, 10, 20, 30, 99, 199, 299, 499, 1000]

/** Público de `n` espectadores: cada uno hace algo cada ~20 s de media. */
export function crowd(n: number, seed: number) {
  const r = rng(seed)
  const users = Array.from({ length: n }, (_, i) => ({ id: `u${i}`, nickname: `Espectador${i}` }))
  let carry = 0
  return (d: Director, dt: number) => {
    carry += n * dt * 0.05
    while (carry >= 1) {
      carry--
      const user = users[Math.floor(r() * n)]!
      const x = r()
      let ev: LiveIn
      if (d.vote && r() < 0.3) ev = { type: 'chat', user, payload: { text: r() < 0.5 ? '1' : '2' } }
      else if (x < 0.5) ev = { type: 'like', user, payload: { count: 5 + Math.floor(r() * 15) } }
      else if (x < 0.85) ev = { type: 'chat', user, payload: { text: ['hola', 'lanza', 'tronco', 'hielo', 'corre', 'tanque', 'jaja'][Math.floor(r() * 7)]! } }
      else if (x < 0.9) ev = { type: 'follow', user }
      else if (x < 0.93) ev = { type: 'share', user }
      else {
        // los regalos grandes son raros: pesa más la parte baja de la tabla
        const i = Math.floor(Math.pow(r(), 2.2) * COINS.length)
        ev = { type: 'gift', user, payload: { name: 'Regalo', diamonds: COINS[i]!, count: 1 } }
      }
      d.handle(ev)
    }
  }
}

/** Juega una partida entera con bots y devuelve quién ganó. */
export function playMatch(mode: 'invasion' | 'defensa', viewers: number, seed: number): { winner: string; t: number; sim: Game | DefenseGame; d: Director } {
  const r = rng(seed * 7 + 3)
  const sim = mode === 'invasion' ? new Game({ seed }) : new DefenseGame({ seed })
  const d = new Director(sim)
  const audience = crowd(viewers, seed + 11)
  const dt = 1 / 30
  for (let i = 0; i < 400 * 30 && sim.s.phase === 'playing'; i++) {
    audience(d, dt)
    d.tick()
    if (sim instanceof Game) sim.tick(dt, kingBot(sim, r))
    else sim.tick(dt, guardBot(sim, r))
    sim.drainFx()
  }
  return { winner: sim.s.winner ?? 'none', t: sim.s.t, sim, d }
}
