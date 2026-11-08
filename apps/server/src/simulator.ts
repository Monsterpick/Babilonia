import { z } from 'zod'
import { parseCommand, type LiveEvent, type LiveUser, type RawGift } from '@livearena/shared'
import type { App } from './app.js'

const NAMES = ['Lucía', 'Mateo', 'Sofía', 'Diego', 'Valentina', 'Santi', 'Camila', 'Leo', 'Martina', 'Hugo', 'Abril', 'Thiago', 'Emma', 'Gael', 'Mía']

let seq = 0
export function fakeUser(name?: string): LiveUser {
  const n = name?.trim() || `${NAMES[Math.floor(Math.random() * NAMES.length)]}${Math.floor(Math.random() * 90 + 10)}`
  const handle = n.toLowerCase().normalize('NFD').replace(/[^a-z0-9_]/g, '')
  return {
    id: `sim-${handle}`,
    uniqueId: handle || 'sim',
    nickname: n,
    isFollower: Math.random() > 0.3,
  }
}

const base = (user: LiveUser | null) => ({ v: 1 as const, id: `sim-${Date.now().toString(36)}-${(seq++).toString(36)}`, source: 'simulator', user, ts: Date.now(), simulated: true })

export const SimRequestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('gift'), name: z.string(), user: z.string().optional(), count: z.number().int().min(1).max(5000).default(1), streak: z.boolean().default(true) }),
  z.object({ type: z.literal('like'), user: z.string().optional(), count: z.number().int().min(1).max(100000).default(10) }),
  z.object({ type: z.literal('chat'), user: z.string().optional(), text: z.string().min(1).max(300) }),
  z.object({ type: z.literal('follow'), user: z.string().optional() }),
  z.object({ type: z.literal('share'), user: z.string().optional() }),
  z.object({ type: z.literal('subscribe'), user: z.string().optional() }),
  z.object({ type: z.literal('join'), user: z.string().optional() }),
  /** Ráfaga: N eventos aleatorios repartidos en `seconds` segundos. */
  z.object({ type: z.literal('burst'), events: z.number().int().min(1).max(10000).default(200), seconds: z.number().min(0).max(60).default(2) }),
])
export type SimRequest = z.infer<typeof SimRequestSchema>

/** Simula exactamente cómo llegan las cosas de TikTok (incluidas las rachas por partes). */
export class Simulator {
  constructor(private readonly app: App) {}

  run(req: SimRequest): void {
    switch (req.type) {
      case 'gift':
        return this.gift(req.name, req.count, fakeUser(req.user), req.streak)
      case 'like':
        return this.app.onEvent({ ...base(fakeUser(req.user)), type: 'like', payload: { count: req.count } })
      case 'chat':
        return this.app.onEvent({ ...base(fakeUser(req.user)), type: 'chat', payload: { text: req.text, command: parseCommand(req.text) } })
      case 'follow':
        return this.app.onEvent({ ...base(fakeUser(req.user)), type: 'follow', payload: {} })
      case 'share':
        return this.app.onEvent({ ...base(fakeUser(req.user)), type: 'share', payload: {} })
      case 'subscribe':
        return this.app.onEvent({ ...base(fakeUser(req.user)), type: 'subscribe', payload: {} })
      case 'join':
        return this.app.onEvent({ ...base(fakeUser(req.user)), type: 'member_join', payload: {} })
      case 'burst':
        return this.burst(req.events, req.seconds)
    }
  }

  /**
   * Regalo: los de 1 diamante (Rose, TikTok…) son de racha → llegan en 2-3 trozos con
   * repeatCount acumulado y un repeatEnd final, como en TikTok de verdad.
   */
  gift(name: string, count: number, user: LiveUser, streak = true): void {
    const info = this.app.gifts.find(name)
    const diamonds = info?.diamonds ?? 1
    const streakable = streak && diamonds < 100
    const groupId = `sim${Date.now()}${Math.random().toString(36).slice(2, 6)}`
    const mk = (repeatCount: number, repeatEnd: boolean): RawGift => ({
      msgId: `sim-g-${(seq++).toString(36)}`,
      user,
      giftId: info?.id ?? 0,
      name: info?.name ?? name,
      imageUrl: info?.image,
      diamonds,
      repeatCount,
      repeatEnd,
      streakable,
      groupId,
    })
    if (!streakable || count === 1) {
      if (streakable) {
        this.app.onRawGift(mk(1, false))
        setTimeout(() => this.app.onRawGift(mk(1, true)), 300)
      } else for (let i = 0; i < Math.min(count, 50); i++) this.app.onRawGift({ ...mk(1, false), msgId: `sim-g-${(seq++).toString(36)}` })
      return
    }
    const a = Math.max(1, Math.floor(count / 3))
    const b = Math.max(a, Math.floor((count * 2) / 3))
    this.app.onRawGift(mk(a, false))
    setTimeout(() => this.app.onRawGift(mk(b, false)), 250)
    setTimeout(() => this.app.onRawGift(mk(count, false)), 500)
    setTimeout(() => this.app.onRawGift(mk(count, true)), 800)
  }

  burst(events: number, seconds: number): void {
    const gifts = ['Rose', 'TikTok', 'GG', 'Finger Heart', 'Perfume', 'Doughnut', 'Hand Hearts', 'Galaxy']
    const step = (seconds * 1000) / events
    for (let i = 0; i < events; i++) {
      setTimeout(() => {
        const r = Math.random()
        const u = fakeUser()
        if (r < 0.45) this.app.onEvent({ ...base(u), type: 'like', payload: { count: 1 + Math.floor(Math.random() * 15) } })
        else if (r < 0.8) this.gift(gifts[Math.floor(Math.random() ** 2 * gifts.length)]!, 1 + Math.floor(Math.random() * 5), u)
        else if (r < 0.9) this.app.onEvent({ ...base(u), type: 'chat', payload: { text: '¡vamos!', command: undefined } })
        else if (r < 0.95) this.app.onEvent({ ...base(u), type: 'follow', payload: {} })
        else this.app.onEvent({ ...base(u), type: 'share', payload: {} })
      }, i * step)
    }
  }
}

export type { LiveEvent }
