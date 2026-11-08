import { parseProfile, type LiveEvent, type LiveUser, type ProfileInput, type RawGift } from '@livearena/shared'

export const user = (n = 'ana'): LiveUser => ({ id: `id-${n}`, uniqueId: n, nickname: n.toUpperCase() })

export function raw(over: Partial<RawGift> = {}): RawGift {
  return {
    msgId: null,
    user: user(),
    giftId: 5655,
    name: 'Rose',
    diamonds: 1,
    repeatCount: 1,
    repeatEnd: false,
    streakable: true,
    groupId: 'g1',
    ...over,
  }
}

let n = 0
export function gift(name: string, diamonds: number, count = 1, u = user()): LiveEvent {
  return {
    v: 1,
    id: `e${++n}`,
    type: 'gift',
    source: 'test',
    user: u,
    ts: 0,
    payload: { giftId: 0, name, diamonds, count, streakTotal: count, streakId: 's', phase: 'single' },
  }
}
export const like = (count: number, u = user()): LiveEvent => ({ v: 1, id: `e${++n}`, type: 'like', source: 'test', user: u, ts: 0, payload: { count } })
export const chat = (text: string, u = user()): LiveEvent => {
  const m = text.match(/^!(\S+)\s*(.*)$/)
  return {
    v: 1,
    id: `e${++n}`,
    type: 'chat',
    source: 'test',
    user: u,
    ts: 0,
    payload: { text, command: m ? { name: m[1]!.toLowerCase(), args: m[2] ? m[2].split(/\s+/) : [] } : undefined },
  }
}
export const follow = (u = user()): LiveEvent => ({ v: 1, id: `e${++n}`, type: 'follow', source: 'test', user: u, ts: 0, payload: {} })

export function profile(p: Partial<ProfileInput> = {}) {
  return parseProfile({
    id: 'p',
    name: 'Test',
    actions: [
      { id: 'zombie', name: 'ZOMBIE', steps: [{ type: 'minecraft.command', commands: ['summon zombie'] }] },
      { id: 'dragon', name: 'DRAGON', steps: [{ type: 'minecraft.command', commands: ['summon ender_dragon'] }] },
    ],
    ...p,
  })
}
