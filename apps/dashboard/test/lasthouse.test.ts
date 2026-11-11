import { describe, expect, it } from 'vitest'
import { Game, GUARDIANS, LENGTH, type Input } from '../src/game/lasthouse/sim'

const idle: Input = { mx: 0, mz: 0, attack: false, dash: false, roar: false, summon: false }
const forward: Input = { ...idle, mz: 1, attack: true }
const run = (g: Game, secs: number, input: Input) => {
  for (let i = 0; i < secs * 60; i++) g.tick(1 / 60, input)
}

describe('LAST HOUSE · simulación', () => {
  it('sin defensas, el Rey llega a la puerta y suma asaltos hasta ganar', () => {
    const g = new Game({ assaults: 2, duration: 120, seed: 7 })
    run(g, 60, forward)
    expect(g.s.phase).toBe('ended')
    expect(g.s.winner).toBe('rey')
    expect(g.s.assaults).toBe(2)
  })

  it('si se acaba el tiempo ganan los guardianes', () => {
    const g = new Game({ duration: 5, seed: 7 })
    run(g, 6, idle)
    expect(g.s.winner).toBe('guardianes')
  })

  it('los likes se acumulan entre todos y brotan defensas', () => {
    const g = new Game({ likesPerSprout: 10, seed: 3 })
    g.likes(4, 'Ana')
    expect(g.s.guardians.length).toBe(0)
    g.likes(7, 'Leo')
    expect(g.s.guardians.length).toBe(1)
    expect(g.s.guardians[0]!.kind).toBe('brote')
    expect(g.s.scores.get('Leo')!.plants).toBe(1)
  })

  it('un tronco bloquea el paso y se puede romper a zarpazos', () => {
    const g = new Game({ seed: 5 })
    const t = g.plant('tronco', 'Ana', { x: 0, z: 10 })!
    expect(t).not.toBeNull()
    run(g, 1.2, { ...idle, mz: 1 })
    expect(g.s.king.z).toBeLessThan(10 - GUARDIANS.tronco.radius) // no lo atraviesa
    run(g, 6, forward)
    expect(g.s.guardians.find((x) => x.id === t.id)).toBeUndefined()
  })

  it('los lanzabrotes hacen daño y un Rey sin vida cae y vuelve a la calle', () => {
    const g = new Game({ seed: 9, duration: 600 })
    for (let i = 0; i < 5; i++) g.plant('lanzabrotes', 'Ana', { x: (i - 2) * 1.5, z: 18 + (i % 2) * 2 })
    run(g, 3, idle)
    expect(g.s.king.hp).toBeLessThan(100)
    g.s.king.hp = 1
    run(g, 3, idle)
    expect(g.s.king.downUntil).toBeGreaterThan(0)
    run(g, 2, idle) // se levanta a los 3,5 s de caer y es intocable 2,5 s más
    expect(g.s.king.z).toBeLessThan(4)
    expect(g.s.king.hp).toBe(100)
    expect(g.s.king.safeUntil).toBeGreaterThan(g.s.t)
  })

  it('el hongo explota al acercarse y el rugido aturde', () => {
    const g = new Game({ seed: 2 })
    g.plant('hongo', 'Ana', { x: 0, z: 8 })
    run(g, 2, { ...idle, mz: 1 })
    expect(g.s.king.hp).toBeLessThan(100)
    const l = g.plant('lanzabrotes', 'Ana', { x: g.s.king.x + 4, z: g.s.king.z + 4 })!
    g.tick(1 / 60, { ...idle, roar: true })
    expect(l.stunUntil).toBeGreaterThan(g.s.t)
  })

  it('respeta el tope de defensas y nunca planta encima del Rey', () => {
    const g = new Game({ maxGuardians: 20, seed: 4 })
    for (let i = 0; i < 200; i++) g.plant('brote', 'Spam')
    expect(g.s.guardians.length).toBeLessThanOrEqual(20)
    for (const x of g.s.guardians) expect(Math.hypot(x.x - g.s.king.x, x.z - g.s.king.z)).toBeGreaterThan(2)
    expect(LENGTH).toBeGreaterThan(50)
  })

  it('es determinista con la misma semilla', () => {
    const play = () => {
      const g = new Game({ seed: 42 })
      for (let i = 0; i < 600; i++) {
        if (i % 20 === 0) g.likes(15, 'A')
        if (i % 90 === 0) g.plant('lanzabrotes', 'B')
        g.tick(1 / 60, forward)
      }
      return JSON.stringify([g.s.king.x, g.s.king.z, g.s.king.hp, g.s.guardians.length])
    }
    expect(play()).toBe(play())
  })
})
