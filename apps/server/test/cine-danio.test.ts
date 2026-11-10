import { describe, expect, it } from 'vitest'
import { DANIO_DEFAULTS, parseDanio, writeDanio } from '../src/cine-settings.js'

const YML = `general:
  romperBloques: true

danio:
  genkidama: { corazonesGolpe: 1, corazonesFinal: 25, totemsDurante: 0, totemsFinal: 1 }
  akaza: { corazonesGolpe: 0.5, corazonesFinal: 10, totemsDurante: 2, totemsFinal: 3 }

sonidos:
  escudo.activar: block.beacon.activate
`

describe('sección danio de habilidades.yml', () => {
  it('lee los valores y completa con los de por defecto', () => {
    const d = parseDanio(YML)
    expect(d.akaza).toEqual({ corazonesGolpe: 0.5, corazonesFinal: 10, totemsDurante: 2, totemsFinal: 3 })
    expect(d.ataque_orbital).toEqual(DANIO_DEFAULTS.ataque_orbital)
  })

  it('reescribe la sección sin tocar lo demás', () => {
    const d = parseDanio(YML)
    d.genkidama = { corazonesGolpe: 2, corazonesFinal: 40, totemsDurante: 1, totemsFinal: 5 }
    const out = writeDanio(YML, d)
    expect(out).toContain('general:\n  romperBloques: true')
    expect(out).toContain('sonidos:\n  escudo.activar: block.beacon.activate')
    expect(parseDanio(out).genkidama).toEqual({ corazonesGolpe: 2, corazonesFinal: 40, totemsDurante: 1, totemsFinal: 5 })
    expect(out.match(/^danio:/gm)?.length).toBe(1)
    expect(out).toMatch(/\}\n\nsonidos:/)
  })

  it('añade la sección si el archivo es antiguo', () => {
    const old = 'general:\n  romperBloques: true\n'
    const out = writeDanio(old, parseDanio(old))
    expect(out).toMatch(/\ndanio:\n {2}onda_repulsion: \{/)
    expect(parseDanio(out).meteorito).toEqual(DANIO_DEFAULTS.meteorito)
  })
})
