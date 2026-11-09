import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { CINE, ensureNeoForgeProfile, hasNeoForgeProfile, neoforgeJson, neoforgeValid, readZipEntry, vanillaReady } from '../src/cine-mod.js'

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

/** Zip mínimo con una entrada comprimida (deflate), como los .jar. */
function makeZip(name: string, content: string): Buffer {
  const data = deflateRawSync(Buffer.from(content))
  const n = Buffer.from(name)
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(8, 8)
  local.writeUInt32LE(data.length, 18)
  local.writeUInt32LE(content.length, 22)
  local.writeUInt16LE(n.length, 26)
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(8, 10)
  central.writeUInt32LE(data.length, 20)
  central.writeUInt32LE(content.length, 24)
  central.writeUInt16LE(n.length, 28)
  central.writeUInt32LE(0, 42)
  const cdStart = 30 + n.length + data.length
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(1, 8)
  eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(46 + n.length, 12)
  eocd.writeUInt32LE(cdStart, 16)
  return Buffer.concat([local, n, data, central, n, eocd])
}

describe('versión de NeoForge rota', () => {
  it('detecta el .json vacío o roto y acepta el bueno', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mc-'))
    expect(await neoforgeValid(dir)).toBe(false)
    await mkdir(path.dirname(neoforgeJson(dir)), { recursive: true })
    await writeFile(neoforgeJson(dir), '')
    expect(await neoforgeValid(dir)).toBe(false)
    await writeFile(neoforgeJson(dir), '\uFEFF' + JSON.stringify({ id: `neoforge-${CINE.neoforge}`, inheritsFrom: CINE.minecraft, libraries: [{ name: 'x' }] }))
    expect(await neoforgeValid(dir)).toBe(true)
  })

  it('saca version.json de dentro del instalador', () => {
    const zip = makeZip('version.json', '{"id":"neoforge"}')
    expect(readZipEntry(zip, 'version.json')?.toString()).toBe('{"id":"neoforge"}')
    expect(readZipEntry(zip, 'otro.json')).toBeNull()
  })
})
