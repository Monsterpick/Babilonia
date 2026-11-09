import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { readCineSettings, writeCineSettings } from '../src/cine-settings.js'

const YML = `general:
  camaraCinematica: true       # tomar la cámara del objetivo
  bloquesPorTick: 400
  romperBloques: true
  restaurarBloques: true
  segundosRestauracion: 60
  colaMax: 10

escudo:            { radio: 4.0 }
`

describe('habilidades.yml desde la app', () => {
  it('lee y escribe la sección general sin romper comentarios ni el resto', async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), 'cine-'))
    await mkdir(path.join(folder, 'plugins', 'LiveArena'), { recursive: true })
    const file = path.join(folder, 'plugins', 'LiveArena', 'habilidades.yml')
    await writeFile(file, YML)
    const s = await readCineSettings(folder)
    expect(s).toMatchObject({ exists: true, camaraCinematica: true, bloquesPorTick: 400, colaMax: 10 })
    const after = await writeCineSettings(folder, { camaraCinematica: false, segundosRestauracion: 120 })
    expect(after).toMatchObject({ camaraCinematica: false, segundosRestauracion: 120, romperBloques: true })
    const text = await readFile(file, 'utf8')
    expect(text).toContain('camaraCinematica: false       # tomar la cámara del objetivo')
    expect(text).toContain('escudo:            { radio: 4.0 }')
  })

  it('sin servidor devuelve los valores por defecto', async () => {
    expect(await readCineSettings('')).toMatchObject({ exists: false, camaraCinematica: true })
  })
})
