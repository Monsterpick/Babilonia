import { describe, expect, it } from 'vitest'
import { DefenseGame, PLANT_COST, type DefenseInput } from '../src/game/lasthouse/defense'
import { Director, PRESSURE, type LiveIn } from '../src/game/lasthouse/director'
import { Game, LENGTH } from '../src/game/lasthouse/sim'
import { crowd, playMatch } from './lasthouse-bots'

const idle: DefenseInput = { mx: 0, mz: 0, attack: false, dash: false, roar: false, summon: false, pick: 'lanzabrotes' }
const runD = (g: DefenseGame, secs: number, input: DefenseInput, d?: Director) => {
  for (let i = 0; i < secs * 60 && g.s.phase === 'playing'; i++) {
    d?.tick()
    g.tick(1 / 60, input)
  }
}
const user = (id: string) => ({ id, nickname: id })

describe('LAST HOUSE · modo Defensa', () => {
  it('sin defenderse, las oleadas automáticas acaban tirando la casa', () => {
    const g = new DefenseGame({ seed: 4, houseHp: 300 })
    runD(g, 300, idle)
    expect(g.s.phase).toBe('ended')
    expect(g.s.winner).toBe('horda')
    expect(g.s.wave).toBeGreaterThan(0)
  })

  it('defendiéndose, la casa aguanta hasta el final', () => {
    const g = new DefenseGame({ seed: 4, duration: 90 })
    for (let i = 0; i < 92 * 60 && g.s.phase === "playing"; i++) {
      // apunta al zombi más cercano moviéndose a su columna
      const z = g.s.zombies.filter((x) => !x.underground).sort((a, b) => b.z - a.z)[0]
      g.tick(1 / 60, { ...idle, attack: true, roar: true, mx: z ? Math.sign(z.x - g.s.hero.x) : 0 })
    }
    expect(g.s.winner).toBe('guardian')
    expect(g.s.kills).toBeGreaterThan(10)
  })

  it('la horda que mandan los espectadores sale poco a poco y respeta el tope', () => {
    const g = new DefenseGame({ seed: 2, maxZombies: 40 })
    expect(g.send('caminante', 2000, 'Ana')).toBe(600) // la cola tiene tope
    runD(g, 5, idle)
    expect(g.s.zombies.length).toBeLessThanOrEqual(40)
    expect(g.s.zombies.length).toBeGreaterThan(20)
    expect(g.s.scores.get('Ana')!.sent).toBe(600)
  })

  it('plantar gasta energía y sin energía no se planta', () => {
    const g = new DefenseGame({ seed: 1 })
    g.s.hero.energy = PLANT_COST.tronco! + 1
    expect(g.plant('tronco')).not.toBeNull()
    expect(g.s.hero.energy).toBeCloseTo(1)
    g.s.t += 1
    expect(g.plant('lanzabrotes')).toBeNull()
  })

  it('el excavador va bajo tierra y sale cerca de la casa', () => {
    const g = new DefenseGame({ seed: 9, waveEvery: 9999 })
    g.s.nextWave = 9999
    g.send('excavador', 1, 'Leo')
    runD(g, 0.2, idle)
    const z = g.s.zombies[0]!
    expect(z.underground).toBe(true)
    let surfaced = false
    for (let i = 0; i < 60 * 60 && !surfaced; i++) {
      g.tick(1 / 60, idle)
      surfaced = g.drainFx().some((f) => f.type === 'surface')
    }
    expect(surfaced).toBe(true)
    expect(z.z).toBeGreaterThanOrEqual(LENGTH - 31)
  })

  it('la vista recibe un estado completo', () => {
    const g = new DefenseGame({ seed: 3 })
    g.send('titan', 1, 'Max')
    runD(g, 1, idle)
    const r = g.render()
    expect(r.mode).toBe('defensa')
    expect(r.house).toBe(1)
    expect(r.units.some((u) => u.kind === 'titan')).toBe(true)
  })
})

describe('LAST HOUSE · director del directo', () => {
  it('cada persona tiene su espera en el chat; varias personas actúan a la vez', () => {
    const g = new Game({ seed: 1 })
    const d = new Director(g, { voteEvery: 0, adaptive: false })
    d.handle({ type: 'chat', user: user('a'), payload: { text: 'tronco' } })
    d.handle({ type: 'chat', user: user('a'), payload: { text: 'tronco' } })
    d.handle({ type: 'chat', user: user('b'), payload: { text: 'tronco' } })
    expect(g.s.guardians.filter((x) => x.kind === 'tronco').length).toBe(2)
  })

  it('lo gratis gasta un presupuesto común; los regalos siempre hacen algo', () => {
    const g = new Game({ seed: 1 })
    const d = new Director(g, { voteEvery: 0 })
    // se empieza con algo de reserva: los primeros comentarios plantan, pero 50 a la vez no plantan 50
    for (let i = 0; i < 50; i++) d.handle({ type: 'chat', user: user(`u${i}`), payload: { text: 'lanza' } })
    const first = g.s.guardians.length
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThanOrEqual(Math.ceil((PRESSURE.invasion.cap * 0.75) / 1.5))
    // …y un regalo siempre hace algo, aunque la reserva esté vacía
    d.handle({ type: 'gift', user: user('rico'), payload: { name: 'Rosa', diamonds: 5, count: 1 } })
    expect(g.s.guardians.length).toBe(first + 1)
    expect(d.tokens).toBeLessThan(0)
    // con el tiempo la reserva se rellena y vuelve a haber acciones gratis
    for (let i = 0; i < 6 * 60; i++) {
      g.s.t += 1 / 60
      d.tick()
    }
    d.handle({ type: 'chat', user: user('z'), payload: { text: 'lanza' } })
    expect(g.s.guardians.some((x) => x.owner === 'z')).toBe(true)
  })

  it('miles de espectadores no multiplican la presión gratuita', () => {
    const count = (n: number) => {
      const g = new Game({ seed: 5, maxGuardians: 100000 })
      const d = new Director(g, { voteEvery: 0 })
      const people = crowd(n, 3)
      let plants = 0
      for (let i = 0; i < 60 * 60; i++) {
        g.s.t += 1 / 60
        people(d, 1 / 60)
        d.tick()
        for (const f of g.drainFx()) if (f.type === 'plant') plants++
      }
      return { plants, d }
    }
    const few = count(20)
    const many = count(5000)
    // con 250 veces más gente, como mucho unas pocas veces más defensas (y el resto lo compensa el poder del streamer)
    expect(many.plants).toBeLessThan(few.plants * 6)
    expect(many.d.game.s.power).toBeGreaterThan(1)
  })

  it('votación: un voto por persona, gana la más votada y se lanza el evento', () => {
    const g = new Game({ seed: 2 })
    const d = new Director(g, { voteEvery: 10, voteLength: 5 })
    for (let i = 0; i < 10 * 60 + 2; i++) {
      g.s.t += 1 / 60
      d.tick()
    }
    expect(d.vote).not.toBeNull()
    const [a, b] = d.vote!.options
    d.handle({ type: 'chat', user: user('x'), payload: { text: '2' } })
    d.handle({ type: 'chat', user: user('x'), payload: { text: '2' } }) // repetido: no cuenta
    d.handle({ type: 'chat', user: user('y'), payload: { text: '2' } })
    d.handle({ type: 'chat', user: user('z'), payload: { text: '1' } })
    expect(d.vote!.counts).toEqual([1, 2])
    for (let i = 0; i < 6 * 60; i++) {
      g.s.t += 1 / 60
      d.tick()
    }
    expect(d.vote).toBeNull()
    expect(d.lastVote?.name).toBe(b)
    expect(d.notices.some((n) => n.who === 'El chat')).toBe(true)
    expect(a).not.toBe(b)
  })

  it('los eventos grandes van en cola con 5 s de separación', () => {
    const g = new DefenseGame({ seed: 2 })
    const d = new Director(g, { voteEvery: 0 })
    for (let i = 0; i < 4; i++) d.handle({ type: 'gift', user: user(`r${i}`), payload: { name: 'Gorra', diamonds: 299, count: 1 } })
    const fired: number[] = []
    for (let i = 0; i < 20 * 60; i++) {
      d.tick()
      g.tick(1 / 60, idle)
      for (const f of g.drainFx()) if (f.type === 'event') fired.push(g.s.t)
    }
    expect(fired.length).toBe(4)
    for (let i = 1; i < fired.length; i++) expect(fired[i]! - fired[i - 1]!).toBeGreaterThanOrEqual(4.9)
  })

  it('sin espectadores el jardín planta solo (también hay partida)', () => {
    const g = new Game({ seed: 8 })
    const d = new Director(g)
    for (let i = 0; i < 30 * 60; i++) {
      g.s.t += 1 / 60
      d.tick()
    }
    expect(g.s.guardians.length).toBeGreaterThan(5)
    expect(g.s.guardians.every((x) => x.owner === '')).toBe(true)
  })
})

describe('LAST HOUSE · carga', () => {
  it('aguanta 20.000 eventos en ráfaga sin pasarse de los topes ni ir lento', () => {
    for (const mode of ['invasion', 'defensa'] as const) {
      const g = mode === 'invasion' ? new Game({ seed: 3 }) : new DefenseGame({ seed: 3 })
      const d = new Director(g)
      const t0 = performance.now()
      for (let i = 0; i < 20000; i++) {
        const u = user(`v${i % 3000}`)
        const k = i % 10
        const ev: LiveIn =
          k < 5 ? { type: 'like', user: u, payload: { count: 15 } } : k < 8 ? { type: 'chat', user: u, payload: { text: i % 2 ? '1' : 'tanque lanza' } } : k < 9 ? { type: 'follow', user: u } : { type: 'gift', user: u, payload: { name: 'X', diamonds: [1, 5, 99, 299, 1000][i % 5]!, count: 1 } }
        d.handle(ev)
        if (i % 100 === 0) {
          d.tick()
          if (g instanceof Game) g.tick(1 / 60, { mx: 0, mz: 1, attack: true, dash: false, roar: false, summon: false })
          else g.tick(1 / 60, { ...idle, attack: true })
          g.drainFx()
        }
      }
      // un minuto de partida con todo eso encima
      const t1 = performance.now()
      for (let i = 0; i < 60 * 60 && g.s.phase === 'playing'; i++) {
        d.tick()
        if (g instanceof Game) g.tick(1 / 60, { mx: 0, mz: 1, attack: true, dash: false, roar: false, summon: false })
        else g.tick(1 / 60, { ...idle, attack: true })
        g.drainFx()
      }
      const perTick = (performance.now() - t1) / (60 * 60)
      expect(performance.now() - t0).toBeLessThan(20000)
      expect(perTick).toBeLessThan(4) // muy por debajo de los 16 ms de un fotograma
      expect(d.queuedBig).toBeLessThanOrEqual(30)
      expect(d.notices.length).toBeLessThanOrEqual(40)
      if (g instanceof Game) expect(g.s.guardians.length).toBeLessThanOrEqual(g.cfg.maxGuardians)
      else {
        expect(g.s.zombies.length).toBeLessThanOrEqual(g.cfg.maxZombies)
        expect(g.s.queue.length).toBeLessThanOrEqual(600)
      }
      expect(g.s.power).toBeLessThanOrEqual(2.4)
      expect(Number.isFinite(d.tokens)).toBe(true)
      void PRESSURE
    }
  }, 60000)
})

// Equilibrio con bots (lento: LH_BALANCE=1 pnpm test). Objetivo: que ninguna partida esté decidida de antemano.
describe.skipIf(!process.env.LH_BALANCE)('LAST HOUSE · equilibrio', () => {
  for (const mode of ['invasion', 'defensa'] as const)
    for (const viewers of [0, 10, 100, 1000])
      it(`${mode} con ${viewers} espectadores: el streamer gana entre el 25 % y el 85 %`, () => {
        let wins = 0
        const N = 16
        for (let s = 1; s <= N; s++) {
          const w = playMatch(mode, viewers, s).winner
          if (w === 'rey' || w === 'guardian') wins++
        }
        expect(wins / N).toBeGreaterThanOrEqual(0.25)
        expect(wins / N).toBeLessThanOrEqual(0.85)
      }, 300000)
})
