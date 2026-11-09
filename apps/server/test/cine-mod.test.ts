import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CINE, ensureNeoForgeProfile, hasNeoForgeProfile, vanillaReady } from '../src/cine-mod.js'

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

describe('Minecraft normal abierto una vez', () => {
  it('lo detecta por el índice de recursos descargado', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mc-'))
    expect(await vanillaReady(dir)).toBe(false)
    await mkdir(path.join(dir, 'versions', CINE.minecraft), { recursive: true })
    await writeFile(path.join(dir, 'versions', CINE.minecraft, `${CINE.minecraft}.json`), JSON.stringify({ assetIndex: { id: '30' } }))
    expect(await vanillaReady(dir)).toBe(false)
    await mkdir(path.join(dir, 'assets', 'indexes'), { recursive: true })
    await writeFile(path.join(dir, 'assets', 'indexes', '30.json'), '{}')
    expect(await vanillaReady(dir)).toBe(true)
  })
})
