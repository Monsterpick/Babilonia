import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ensureTrackingRange } from '../src/minecraft-service.js'

describe('spigot.yml', () => {
  it('sube solo el radio de seguimiento de entidades', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'la-'))
    await fs.writeFile(path.join(dir, 'spigot.yml'), `world-settings:
  default:
    entity-activation-range:
      animals: 32
      misc: 16
    entity-tracking-range:
      players: 128
      misc: 96
      display: 128
      other: 64
    ticks-per:
      hopper-transfer: 8
`)
    expect(await ensureTrackingRange(dir)).toBe(true)
    const t = await fs.readFile(path.join(dir, 'spigot.yml'), 'utf8')
    expect(t).toContain('      misc: 16')
    expect(t).toContain('      display: 320')
    expect(t).toContain('      misc: 192')
    expect(t).toContain('      other: 128')
    expect(await ensureTrackingRange(dir)).toBe(false)
  })
})
