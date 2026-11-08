import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { KitSchema } from '@livearena/shared'
import { RconClient } from '../src/rcon.js'
import { MinecraftLink } from '../src/link.js'
import { PlayerWatcher, parseHealth, parseScore } from '../src/watcher.js'
import { itemSpec, kitCommands, parseVersion, summon, titleCommands } from '../src/commands.js'
import { enableRcon, readRcon, updateProperties } from '../src/properties.js'
import { requiredJava } from '../src/java.js'
import { FakeRcon } from './fake-rcon.js'

let fake: FakeRcon | null = null
afterEach(async () => {
  await fake?.close()
  fake = null
})

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('RconClient', () => {
  it('autentica, ejecuta y junta respuestas troceadas', async () => {
    fake = new FakeRcon()
    const port = await fake.listen()
    const c = new RconClient({ host: '127.0.0.1', port, password: 'secreto' })
    await c.connect()
    expect(await c.send('/say hola')).toBe('ok: say hola')
    expect((await c.send('big')).length).toBe(4106)
    c.close()
  })

  it('contraseña incorrecta → error de auth', async () => {
    fake = new FakeRcon()
    const port = await fake.listen()
    const c = new RconClient({ host: '127.0.0.1', port, password: 'mal' })
    await expect(c.connect()).rejects.toMatchObject({ code: 'auth' })
  })

  it('serializa envíos concurrentes', async () => {
    fake = new FakeRcon()
    const port = await fake.listen()
    const c = new RconClient({ host: '127.0.0.1', port, password: 'secreto' })
    await c.connect()
    const res = await Promise.all(Array.from({ length: 30 }, (_, i) => c.send(`say ${i}`)))
    expect(res[29]).toBe('ok: say 29')
    expect(fake.commands).toHaveLength(30)
    c.close()
  })
})

describe('MinecraftLink', () => {
  it('encola mientras está desconectado, reconecta solo y no pierde comandos', async () => {
    fake = new FakeRcon()
    const port = await fake.listen()
    const link = new MinecraftLink({ host: '127.0.0.1', port, password: 'secreto', perSecond: 200, burst: 200 })
    await link.connect()
    await link.enqueue('say 1')
    fake.dropClients()
    await wait(50)
    expect(link.status().state).toBe('backoff')
    const p = link.enqueue('say 2')
    await wait(1500)
    expect(await p).toBe('ok: say 2')
    expect(link.status().state).toBe('connected')
    link.disconnect()
  })

  it('prioridad: el comando del regalo grande sale antes que las rosas pendientes', async () => {
    fake = new FakeRcon()
    const port = await fake.listen()
    const link = new MinecraftLink({ host: '127.0.0.1', port, password: 'secreto', perSecond: 1000, burst: 1 })
    const all: Promise<string>[] = []
    for (let i = 0; i < 20; i++) all.push(link.enqueue(`rosa ${i}`, 1))
    all.push(link.enqueue('universe', 500))
    await link.connect()
    await Promise.all(all)
    expect(fake.commands[0]).toBe('universe')
    link.disconnect()
  })
})

describe('PlayerWatcher', () => {
  it('detecta muerte y reaparición', async () => {
    fake = new FakeRcon()
    const port = await fake.listen()
    const link = new MinecraftLink({ host: '127.0.0.1', port, password: 'secreto' })
    await link.connect()
    const w = new PlayerWatcher(link, 'Steve', 30)
    const events: string[] = []
    w.on('death', () => events.push('death'))
    w.on('respawn', () => events.push('respawn'))
    w.start()
    await wait(120)
    fake.deaths = 1
    fake.health = 0
    await wait(120)
    fake.health = 20
    await wait(120)
    w.stop()
    link.disconnect()
    expect(events).toEqual(['death', 'respawn'])
  })

  it('parsers', () => {
    expect(parseHealth('Steve has the following entity data: 13.5f')).toBe(13.5)
    expect(parseHealth('No entity was found')).toBeNull()
    expect(parseScore('Steve has 4 [la_deaths]')).toBe(4)
  })
})

describe('Comandos', () => {
  const v120 = parseVersion('1.20.1')
  const v121 = parseVersion('1.21.4')
  const v1215 = parseVersion('1.21.5')

  it('summon con nombre del espectador (1.20.1) y sin coordenadas aleatorias', () => {
    expect(summon(v120, { player: 'Steve', entity: 'zombie', name: 'Ana', radius: 0 })).toBe(
      `execute at Steve run summon minecraft:zombie ~0.0 ~0.0 ~0.0 {CustomName:'{"text":"Ana","color":"gold"}',CustomNameVisible:1b,Tags:["livearena"]}`,
    )
    expect(summon(v1215, { player: 'S', entity: 'zombie', name: 'Ana', radius: 0 })).toContain(`{CustomName:{"text":"Ana","color":"gold"},`)
  })

  it('un nombre malicioso no rompe el NBT', () => {
    const cmd = summon(v120, { player: 'S', entity: 'zombie', name: `x'},Invulnerable:1b,{"a":"`, radius: 0 })
    expect(cmd).toContain(`{CustomName:'{"text":"x,Invulnerable:1b,a:","color":"gold"}'`)
  })

  it('item con encantamientos según versión', () => {
    const it = { item: 'netherite_sword', count: 1, enchantments: { sharpness: 5 }, unbreakable: true }
    expect(itemSpec(v120, it)).toBe('minecraft:netherite_sword{Enchantments:[{id:"minecraft:sharpness",lvl:5s}],Unbreakable:1b}')
    expect(itemSpec(v121, it)).toBe('minecraft:netherite_sword[enchantments={levels:{"minecraft:sharpness":5}},unbreakable={}]')
  })

  it('kit completo', () => {
    const kit = KitSchema.parse({
      enabled: true,
      armor: { head: { item: 'diamond_helmet' }, offhand: { item: 'totem_of_undying' } },
      hotbar: [{ item: 'diamond_sword' }, null, { item: 'cooked_beef', count: 64 }],
      nightVision: true,
      jumpBoost: 2,
    })
    const cmds = kitCommands(v120, kit, 'Steve')
    expect(cmds).toEqual([
      'clear Steve',
      'item replace entity Steve armor.head with minecraft:diamond_helmet 1',
      'item replace entity Steve weapon.offhand with minecraft:totem_of_undying 1',
      'item replace entity Steve hotbar.0 with minecraft:diamond_sword 1',
      'item replace entity Steve hotbar.2 with minecraft:cooked_beef 64',
      'effect give Steve minecraft:night_vision infinite 0 true',
      'effect give Steve minecraft:jump_boost infinite 1 true',
      'gamerule fallDamage true',
    ])
  })

  it('title', () => {
    expect(titleCommands('S', { type: 'minecraft.title', actionbar: 'Hola "x"' })).toEqual(['title S actionbar {"text":"Hola x","color":"yellow"}'])
  })

  it('java requerido', () => {
    expect(requiredJava('1.20.1')).toBe(17)
    expect(requiredJava('1.20.6')).toBe(21)
    expect(requiredJava('1.21.4')).toBe(21)
  })
})

describe('server.properties', () => {
  it('activa RCON sin tocar el resto y genera contraseña segura', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'la-'))
    await fs.writeFile(path.join(dir, 'server.properties'), '#comentario\nmotd=Hola\nenable-rcon=false\nrcon.password=\n')
    const info = await enableRcon(dir)
    expect(info.enabled).toBe(true)
    expect(info.password.length).toBeGreaterThanOrEqual(16)
    const text = await fs.readFile(path.join(dir, 'server.properties'), 'utf8')
    expect(text).toContain('#comentario\nmotd=Hola\nenable-rcon=true')
    await updateProperties(path.join(dir, 'server.properties'), { 'level-type': 'minecraft:flat' })
    expect(await fs.readFile(path.join(dir, 'server.properties'), 'utf8')).toContain('level-type=minecraft\\:flat')
    expect((await readRcon(dir)).port).toBe(25575)
  })
})
