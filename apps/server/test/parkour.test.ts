import { describe, expect, it } from 'vitest'
import { parsePkStatus, PK_SETTINGS } from '../src/parkour.js'
import { parseYamlSettings, writeYamlSettings } from '../src/minigames.js'
import { parkourProfile } from '../src/default-profiles.js'

const YML = `torre:
  semilla: 2026
  niveles: 50            # cada nivel tiene su propio bioma
  dificultad: 1.0
partida:
  tiempoLimite: 0
  reiniciarAlGanar: true
  visionNocturna: false
efectos:
  empujeFuerza: 1.15
`

describe('parkour', () => {
  it('lee la línea PKSTATUS', () => {
    const g = parsePkStatus('PKSTATUS running=1 built=1 building=0 buildPct=100 level=23 levels=50 progress=0.452 levelProgress=0.300 falls=7 time=754 limit=0 ganadas=2 perdidas=1 queue=3 shield=1 protected=0 won=0 theme=Monte_de_Piedra color=9AA5AB streamer=Juan colors=7CD957,E8D27A,FF9ECF')!
    expect(g.running).toBe(true)
    expect(g.level).toBe(23)
    expect(g.theme).toBe('Monte de Piedra')
    expect(g.color).toBe('#9AA5AB')
    expect(g.colors).toEqual(['#7CD957', '#E8D27A', '#FF9ECF'])
    expect(g.shield).toBe(true)
    expect(g.progress).toBeCloseTo(0.452)
    expect(g.streamer).toBe('Juan')
    expect(parsePkStatus('Unknown or incomplete command')).toBeNull()
  })

  it('lee y escribe ajustes (incluidos sí/no) sin tocar comentarios', () => {
    const v = parseYamlSettings(YML, PK_SETTINGS)
    expect(v['torre.niveles']).toBe(50)
    expect(v['partida.reiniciarAlGanar']).toBe(1)
    expect(v['partida.visionNocturna']).toBe(0)
    const out = writeYamlSettings(YML, { 'torre.niveles': 40, 'partida.visionNocturna': 1, 'efectos.empujeFuerza': 1.5 }, PK_SETTINGS)
    expect(out).toContain('  niveles: 40            # cada nivel tiene su propio bioma')
    expect(out).toContain('  visionNocturna: true')
    expect(parseYamlSettings(out, PK_SETTINGS)['efectos.empujeFuerza']).toBe(1.5)
  })

  it('el perfil manda los efectos pedidos', () => {
    const p = parkourProfile()
    const cmds = p.actions.flatMap((a) => a.steps.flatMap((s: any) => s.commands ?? []))
    for (const c of ['ttpk subir 1 {user}', 'ttpk bajar 1 {user}', 'ttpk subir 10 {user}', 'ttpk bajar 10 {user}', 'ttpk empujar {user}']) expect(cmds).toContain(c)
    expect(p.events.length).toBeGreaterThan(10)
  })
})
