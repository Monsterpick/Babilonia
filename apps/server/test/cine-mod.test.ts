import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CINE, ensureNeoForgeProfile, hasNeoForgeProfile } from '../src/cine-mod.js'

describe('perfil de NeoForge en el launcher', () => {
  it('lo añade también al archivo del launcher de Microsoft/Xbox sin tocar los demás perfiles', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mc-'))
    await writeFile(path.join(dir, 'launcher_profiles_microsoft_store.json'), JSON.stringify({ profiles: { abc: { name: 'Última versión', type: 'latest-release' } }, settings: { x: 1 }, version: 3 }))
    expect(await hasNeoForgeProfile(dir)).toBe(false)
    const files = await ensureNeoForgeProfile(dir)
    expect(files).toEqual(['launcher_profiles_microsoft_store.json'])
    const j = JSON.parse(await readFile(path.join(dir, 'launcher_profiles_microsoft_store.json'), 'utf8'))
    expect(j.profiles.abc.name).toBe('Última versión')
    expect(j.settings).toEqual({ x: 1 })
    expect(j.profiles['livearena-neoforge'].lastVersionId).toBe(`neoforge-${CINE.neoforge}`)
    expect(await hasNeoForgeProfile(dir)).toBe(true)
  })

  it('con los dos archivos, escribe en ambos', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mc-'))
    for (const f of ['launcher_profiles.json', 'launcher_profiles_microsoft_store.json']) await writeFile(path.join(dir, f), JSON.stringify({ profiles: {} }))
    expect(await ensureNeoForgeProfile(dir)).toHaveLength(2)
  })
})
