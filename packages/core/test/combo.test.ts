import { describe, expect, it } from 'vitest'
import { ComboTracker } from '../src/combo.js'
import type { LiveEventOf } from '@livearena/shared'
import { raw, user } from './helpers.js'

function setup() {
  let t = 0
  const timers: { fn: () => void; at: number; id: number }[] = []
  let tid = 0
  const out: LiveEventOf<'gift'>[] = []
  const tracker = new ComboTracker({
    onGift: (e) => out.push(e),
    now: () => t,
    setTimer: (fn, ms) => {
      const id = ++tid
      timers.push({ fn, at: t + ms, id })
      return id
    },
    clearTimer: (id) => {
      const i = timers.findIndex((x) => x.id === id)
      if (i >= 0) timers.splice(i, 1)
    },
  })
  const advance = (ms: number) => {
    t += ms
    for (const tm of [...timers].sort((a, b) => a.at - b.at)) {
      if (tm.at <= t) {
        timers.splice(timers.indexOf(tm), 1)
        tm.fn()
      }
    }
  }
  const counts = () => out.map((e) => e.payload.count)
  const total = () => out.reduce((s, e) => s + e.payload.count, 0)
  return { tracker, out, advance, counts, total }
}

describe('ComboTracker (racha incremental)', () => {
  it('regalo no-racha se entrega una vez con su cantidad', () => {
    const s = setup()
    expect(s.tracker.receive(raw({ streakable: false, repeatCount: 1, name: 'Galaxy', diamonds: 1000 }))).toBe('single')
    expect(s.counts()).toEqual([1])
    expect(s.out[0]!.payload.phase).toBe('single')
  })

  it('entrega solo la diferencia en cada evento de la racha y nada al cerrar si ya está al día', () => {
    const s = setup()
    s.tracker.receive(raw({ repeatCount: 1 }))
    s.tracker.receive(raw({ repeatCount: 3 }))
    s.tracker.receive(raw({ repeatCount: 7 }))
    s.tracker.receive(raw({ repeatCount: 7, repeatEnd: true }))
    expect(s.counts()).toEqual([1, 2, 4])
    expect(s.total()).toBe(7)
  })

  it('cierra por timeout si TikTok nunca manda repeatEnd y no duplica', () => {
    const s = setup()
    s.tracker.receive(raw({ repeatCount: 5 }))
    s.advance(11_000)
    expect(s.total()).toBe(5)
    expect(s.tracker.openStreaks).toBe(0)
  })

  it('el repeatEnd tardío tras un cierre por timeout no duplica', () => {
    const s = setup()
    s.tracker.receive(raw({ repeatCount: 5 }))
    s.advance(11_000)
    expect(s.tracker.receive(raw({ repeatCount: 5, repeatEnd: true }))).toBe('already-closed')
    expect(s.total()).toBe(5)
  })

  it('si después del cierre llega más de la misma racha, entrega solo lo nuevo', () => {
    const s = setup()
    s.tracker.receive(raw({ repeatCount: 5 }))
    s.advance(11_000)
    s.tracker.receive(raw({ repeatCount: 9, repeatEnd: true }))
    expect(s.total()).toBe(9)
  })

  it('eventos fuera de orden: manda el repeatCount más alto', () => {
    const s = setup()
    s.tracker.receive(raw({ repeatCount: 6 }))
    s.tracker.receive(raw({ repeatCount: 4 }))
    s.tracker.receive(raw({ repeatCount: 8, repeatEnd: true }))
    expect(s.total()).toBe(8)
  })

  it('msgId repetido se descarta', () => {
    const s = setup()
    s.tracker.receive(raw({ msgId: 'm1', streakable: false }))
    expect(s.tracker.receive(raw({ msgId: 'm1', streakable: false }))).toBe('duplicate')
    expect(s.total()).toBe(1)
  })

  it('sin groupId, una racha nueva de la misma persona pasado el eco se entrega completa', () => {
    const s = setup()
    s.tracker.receive(raw({ groupId: '', repeatCount: 10, repeatEnd: true }))
    s.advance(70_000)
    s.tracker.receive(raw({ groupId: '', repeatCount: 2 }))
    expect(s.total()).toBe(12)
  })

  it('rachas de usuarios distintos no se mezclan', () => {
    const s = setup()
    s.tracker.receive(raw({ user: user('a'), repeatCount: 3 }))
    s.tracker.receive(raw({ user: user('b'), repeatCount: 2 }))
    s.tracker.receive(raw({ user: user('a'), repeatCount: 4, repeatEnd: true }))
    expect(s.total()).toBe(6)
  })
})
