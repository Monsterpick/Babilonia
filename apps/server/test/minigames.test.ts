import { describe, expect, it } from 'vitest'
import { parseBdSettings, parseBdStatus, writeBdSettings } from '../src/minigames.js'

const YML = `# cabecera
mundo:
  nombre: basedefense
  hora: 12400
  clima: despejado
arena:
  semilla: 1337
  densidadDecorado: 1.0   # 0.0 – 2.0
base:
  vida: 1500
mobs:
  tope: 300
  etiqueta: "&e[Donante] &a{usuario}"
  tipos:
    zombie:
      vida: 20
likes:
  meta: 5000
  jefe: ghast
`

describe('Base Defense (app)', () => {
  it('lee el estado de /bd status', () => {
    const g = parseBdStatus('BDSTATUS running=1 arena=1 generating=0 round=3 time=754 paused=0 hp=1200 max=1500 wins=-2 mobs=120 queue=30 bosses=1 kills=55 likes=1234 likesMissing=3766 streamer=Juan tps=19.8')
    expect(g).toMatchObject({ running: true, round: 3, hp: 1200, max: 1500, wins: -2, mobs: 120, queue: 30, bosses: 1, streamer: 'Juan', tps: 19.8 })
    expect(parseBdStatus('Unknown or incomplete command')).toBeNull()
  })

  it('lee y escribe solo las claves conocidas sin tocar el resto', () => {
    const v = parseBdSettings(YML)
    expect(v).toMatchObject({ 'base.vida': 1500, 'mobs.tope': 300, 'likes.jefe': 'ghast', 'mobs.etiqueta': '&e[Donante] &a{usuario}', 'arena.densidadDecorado': 1 })
    const out = writeBdSettings(YML, { 'base.vida': 2000, 'likes.jefe': 'wither', 'arena.densidadDecorado': 1.5 })
    expect(out).toContain('  vida: 2000')
    expect(out).toContain('  jefe: "wither"')
    expect(out).toContain('  densidadDecorado: 1.5   # 0.0 – 2.0')
    // la vida del zombie (tercer nivel) no cambia
    expect(out).toContain('      vida: 20')
    expect(parseBdSettings(out)['base.vida']).toBe(2000)
  })
})
