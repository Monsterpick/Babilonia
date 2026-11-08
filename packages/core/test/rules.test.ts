import { describe, expect, it } from 'vitest'
import { RuleEngine, autoPriority } from '../src/rules.js'
import { renderTemplate } from '../src/template.js'
import { chat, follow, gift, like, profile, user } from './helpers.js'

describe('RuleEngine', () => {
  it('regalo por nombre (sin distinguir mayúsculas/espacios) × cantidad', () => {
    const e = new RuleEngine()
    e.setProfile(profile({ events: [{ id: 'r', trigger: { type: 'gift', gifts: [{ name: 'rose' }] }, actionIds: ['zombie'] }] }))
    const r = e.handle(gift('Rose', 1, 7))
    expect(r.jobs).toHaveLength(1)
    expect(r.jobs[0]!.repetitions).toBe(7)
  })

  it('maxPerEvent recorta y lo informa', () => {
    const e = new RuleEngine()
    e.setProfile(profile({ events: [{ id: 'r', trigger: { type: 'gift', gifts: [{ name: 'Rose' }] }, actionIds: ['zombie'], maxPerEvent: 50 }] }))
    const r = e.handle(gift('Rose', 1, 999))
    expect(r.jobs[0]!.repetitions).toBe(50)
    expect(r.trimmed).toBe(949)
  })

  it('perUnit=false ejecuta una sola vez; multiplier multiplica', () => {
    const e = new RuleEngine()
    e.setProfile(
      profile({
        events: [
          { id: 'a', trigger: { type: 'gift', gifts: [{ name: 'Rose' }] }, actionIds: ['zombie'], perUnit: false },
          { id: 'b', trigger: { type: 'gift', gifts: [{ name: 'Rose' }] }, actionIds: ['zombie'], multiplier: 3 },
        ],
      }),
    )
    const r = e.handle(gift('Rose', 1, 2))
    expect(r.jobs.map((j) => j.repetitions)).toEqual([1, 6])
  })

  it('rango de diamantes', () => {
    const e = new RuleEngine()
    e.setProfile(profile({ events: [{ id: 'r', trigger: { type: 'diamonds', min: 100, max: 999 }, actionIds: ['dragon'] }] }))
    expect(e.handle(gift('Rose', 1)).jobs).toHaveLength(0)
    expect(e.handle(gift('Hand Hearts', 100)).jobs).toHaveLength(1)
    expect(e.handle(gift('Galaxy', 1000)).jobs).toHaveLength(0)
  })

  it('likes por persona: cada N, guarda el resto', () => {
    const e = new RuleEngine()
    e.setProfile(profile({ events: [{ id: 'r', trigger: { type: 'likes', every: 10 }, actionIds: ['zombie'] }] }))
    expect(e.handle(like(7)).jobs).toHaveLength(0)
    expect(e.handle(like(15)).jobs[0]!.repetitions).toBe(2) // 22 → 2, resto 2
    expect(e.handle(like(8)).jobs[0]!.repetitions).toBe(1) // 10
    expect(e.handle(like(9, user('otro'))).jobs).toHaveLength(0)
  })

  it('meta de likes de sala que sube: 100, luego cada 50', () => {
    const e = new RuleEngine()
    e.setProfile(profile({ events: [{ id: 'r', trigger: { type: 'room_likes', goal: 100, step: 50 }, actionIds: ['dragon'] }] }))
    expect(e.handle(like(99)).jobs).toHaveLength(0)
    const r = e.handle(like(1))
    expect(r.jobs[0]!.meta).toMatchObject({ goal: 100, nextGoal: 150 })
    expect(e.handle(like(120)).jobs[0]!.repetitions).toBe(2) // 220 → metas 150 y 200
  })

  it('comando de chat con alias y cooldown por usuario', () => {
    let t = 0
    const e = new RuleEngine(() => t)
    e.setProfile(
      profile({ events: [{ id: 'r', trigger: { type: 'command', name: 'rojo', aliases: ['red'] }, actionIds: ['zombie'], cooldown: { perUserMs: 5000 } }] }),
    )
    expect(e.handle(chat('!ROJO')).jobs).toHaveLength(1)
    expect(e.handle(chat('!red')).skipped[0]!.reason).toBe('cooldown')
    expect(e.handle(chat('!red', user('b'))).jobs).toHaveLength(1)
    t = 6000
    expect(e.handle(chat('!red')).jobs).toHaveLength(1)
    expect(e.handle(chat('hola')).jobs).toHaveLength(0)
  })

  it('follow una sola vez por persona', () => {
    const e = new RuleEngine()
    e.setProfile(profile({ events: [{ id: 'r', trigger: { type: 'follow' }, actionIds: ['zombie'] }] }))
    expect(e.handle(follow()).jobs).toHaveLength(1)
    expect(e.handle(follow()).jobs).toHaveLength(0)
  })

  it('who=list filtra por @handle', () => {
    const e = new RuleEngine()
    e.setProfile(profile({ events: [{ id: 'r', trigger: { type: 'gift', gifts: [{ name: 'Rose' }] }, actionIds: ['zombie'], who: 'list', users: ['@vip'] }] }))
    expect(e.handle(gift('Rose', 1)).jobs).toHaveLength(0)
    expect(e.handle(gift('Rose', 1, 1, user('vip'))).jobs).toHaveLength(1)
  })

  it('un regalo grande tiene más prioridad que muchas rosas', () => {
    expect(autoPriority(gift('Universe', 34999))).toBeGreaterThan(autoPriority(gift('Rose', 1, 200)))
  })

  it('el sonido suena solo con la primera parte de la racha', () => {
    const e = new RuleEngine()
    e.setProfile(profile({ events: [{ id: 'r', trigger: { type: 'gift', gifts: [{ name: 'Rose' }] }, actionIds: ['zombie'], sound: { file: 'a.mp3' } }] }))
    const first = gift('Rose', 1, 3)
    const later = gift('Rose', 1, 2)
    if (later.type === 'gift') {
      later.payload.streakTotal = 5
      later.payload.phase = 'streak'
    }
    expect(e.handle(first).jobs[0]!.playSound).toBe(true)
    expect(e.handle(later).jobs[0]!.playSound).toBe(false)
  })
})

describe('renderTemplate', () => {
  it('sustituye variables y limpia nombres peligrosos', () => {
    const evil = { id: '1', uniqueId: 'x"};op @a', nickname: 'Pepe"}\n/op @a §k' }
    const ev = gift('Rose', 1, 3, evil)
    const out = renderTemplate('summon zombie ~ ~ ~ {CustomName:\'"{user}"\'} # {quien} {gift.count} {nick}', { event: ev, player: 'Steve' })
    expect(out).toBe('summon zombie ~ ~ ~ {CustomName:\'"Pepe/op a k"\'} # xopa 3 Steve')
  })

  it('random y args de comando', () => {
    const out = renderTemplate('{random:5-5} {args.0}', { event: chat('!tp 12 abc'), player: 'S' })
    expect(out).toBe('5 12')
  })
})

describe('variables de comandos de plugins', () => {
  it('{nickname} es una sola palabra y {username} el @', () => {
    const ev = gift('Rose', 1, 1, { id: '1', uniqueId: 'ana_01', nickname: 'Ana Pérez' })
    expect(renderTemplate('survival zombie null {nickname} / {username}', { event: ev, player: 'S' })).toBe('survival zombie null Ana_Pérez / ana_01')
  })
})
