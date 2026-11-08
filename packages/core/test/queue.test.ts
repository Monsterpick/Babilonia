import { describe, expect, it } from 'vitest'
import { PriorityQueue, PriorityWorker } from '../src/queue.js'
import { RuleEngine } from '../src/rules.js'
import { gift, like, profile, user } from './helpers.js'

describe('PriorityQueue', () => {
  it('mayor prioridad primero, FIFO a igualdad', () => {
    const q = new PriorityQueue<string>()
    q.push('a', 1)
    q.push('b', 5)
    q.push('c', 1)
    q.push('d', 5)
    expect([q.pop(), q.pop(), q.pop(), q.pop()]).toEqual(['b', 'd', 'a', 'c'])
  })

  it('llena: descarta lo de menor prioridad, nunca lo grande', () => {
    const q = new PriorityQueue<string>(3)
    q.push('rosa1', 1)
    q.push('rosa2', 1)
    q.push('rosa3', 1)
    expect(q.push('universe', 500).dropped).toBe('rosa3')
    expect(q.push('rosa4', 1).dropped).toBe('rosa4')
    expect(q.pop()).toBe('universe')
  })
})

describe('PriorityWorker', () => {
  it('procesa en orden de prioridad y un fallo no detiene la cola', async () => {
    const done: string[] = []
    const w = new PriorityWorker<string>(
      async (x) => {
        if (x === 'boom') throw new Error('x')
        done.push(x)
      },
      { maxSize: 100 },
    )
    w.pause()
    w.push('low', 1)
    w.push('boom', 50)
    w.push('high', 100)
    w.resume()
    await w.drain()
    expect(done).toEqual(['high', 'low'])
    expect(w.stats().failed).toBe(1)
  })
})

describe('Carga: ráfaga de eventos', () => {
  it('200 rosas + 1 Universe + 5000 likes a la vez: el Universe sale primero y nada se congela', async () => {
    const engine = new RuleEngine()
    engine.setProfile(
      profile({
        events: [
          { id: 'rosa', trigger: { type: 'gift', gifts: [{ name: 'Rose' }] }, actionIds: ['zombie'] },
          { id: 'uni', trigger: { type: 'gift', gifts: [{ name: 'Universe' }] }, actionIds: ['dragon'] },
          { id: 'likes', trigger: { type: 'likes', every: 50 }, actionIds: ['zombie'] },
        ],
      }),
    )
    const order: string[] = []
    const w = new PriorityWorker<{ id: string }>(async (j) => void order.push(j.id), { maxSize: 5000 })
    w.pause()
    const t0 = performance.now()
    for (let i = 0; i < 200; i++) for (const j of engine.handle(gift('Rose', 1, 1, user(`u${i}`))).jobs) w.push({ id: j.action.id }, j.priority)
    for (let i = 0; i < 5000; i++) for (const j of engine.handle(like(1, user(`l${i % 100}`))).jobs) w.push({ id: j.action.id }, j.priority)
    for (const j of engine.handle(gift('Universe', 34999)).jobs) w.push({ id: j.action.id }, j.priority)
    const elapsed = performance.now() - t0
    w.resume()
    await w.drain()
    expect(order[0]).toBe('dragon')
    expect(order.length).toBe(1 + 200 + 100)
    expect(elapsed).toBeLessThan(500) // 5.201 eventos evaluados en < 0,5 s
  })
})
