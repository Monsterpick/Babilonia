import { describe, expect, it } from 'vitest'
import { findPreset, parseVoice, pickBrowserVoice, voiceLabel } from '@livearena/shared'
import { parseVoiceList, sapiRate } from '../src/sapi.js'

describe('voces del TTS', () => {
  it('personajes por palabra clave (!voz)', () => {
    expect(findPreset('robot')?.id).toBe('robotica_h')
    expect(findPreset('Ardilla')?.id).toBe('ardilla')
    expect(findPreset('españa')?.id).toBe('espana')
    expect(findPreset('nada-que-ver')).toBeUndefined()
  })

  it('formatos de voz guardada', () => {
    expect(parseVoice('p:gigante')).toMatchObject({ kind: 'preset' })
    expect(parseVoice('w:Loquendo Jorge')).toEqual({ kind: 'windows', name: 'Loquendo Jorge' })
    expect(parseVoice('Microsoft Pablo')).toEqual({ kind: 'browser', name: 'Microsoft Pablo' })
    expect(parseVoice('')).toEqual({ kind: 'default' })
    expect(voiceLabel('p:ardilla')).toContain('Ardilla')
  })

  it('elige voz del PC por idioma y género', () => {
    const voices = [
      { name: 'Microsoft Helena - Spanish (Spain)', lang: 'es-ES' },
      { name: 'Microsoft Pablo - Spanish (Spain)', lang: 'es-ES' },
      { name: 'Microsoft Raul - Spanish (Mexico)', lang: 'es-MX' },
      { name: 'Microsoft David - English (United States)', lang: 'en-US' },
    ]
    expect(pickBrowserVoice(voices, 'es', 'male')?.name).toMatch(/Pablo|Raul/)
    expect(pickBrowserVoice(voices, 'es', 'female')?.name).toContain('Helena')
    expect(pickBrowserVoice(voices, 'es-MX')?.name).toContain('Raul')
    expect(pickBrowserVoice(voices, 'en')?.name).toContain('David')
  })

  it('lista de voces de Windows (32 y 64 bits) y velocidad SAPI', () => {
    expect(parseVoiceList('Microsoft Helena Desktop|Female|es-ES\r\nLoquendo Jorge|Male|es-ES\r\n', '32')).toEqual([
      { name: 'Microsoft Helena Desktop', gender: 'Female', culture: 'es-ES', arch: '32' },
      { name: 'Loquendo Jorge', gender: 'Male', culture: 'es-ES', arch: '32' },
    ])
    expect(sapiRate(1)).toBe(0)
    expect(sapiRate(2)).toBe(6)
    expect(sapiRate(0.5)).toBe(-6)
  })
})
