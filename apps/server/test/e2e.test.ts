import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from 'ws'
import { FakeRcon } from '../../../packages/minecraft/test/fake-rcon.js'

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'livearena-e2e-'))
process.env.LIVEARENA_DATA = dataDir
process.env.LOG_LEVEL = 'warn'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

let fake: FakeRcon
let base = ''
let app: import('../src/app.js').App
let http: import('fastify').FastifyInstance

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api(method: string, url: string, body?: unknown): Promise<any> {
  const send = method !== 'GET'
  const r = await fetch(base + url, { method, headers: send ? { 'content-type': 'application/json' } : {}, body: send ? JSON.stringify(body ?? {}) : undefined })
  const j = await r.json()
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j)}`)
  return j
}

beforeAll(async () => {
  fake = new FakeRcon('pw-test')
  const port = await fake.listen()
  const { App } = await import('../src/app.js')
  const { buildHttp } = await import('../src/http.js')
  app = new App()
  await app.init()
  http = await buildHttp(app)
  http.server.on('upgrade', (req, socket, head) => app.hub.handleUpgrade(req, socket, head))
  await http.listen({ host: '127.0.0.1', port: 0 })
  base = `http://127.0.0.1:${(http.server.address() as import('node:net').AddressInfo).port}`
  await api('PUT', '/api/config', { player: 'Steve', mcHost: '127.0.0.1', mcPort: port, mcPassword: 'pw-test', maxLiveMobs: 0, watchPlayer: false })
  await api('POST', '/api/minecraft/connect')
})

afterAll(async () => {
  await http?.close()
  await app?.shutdown()
  await fake?.close()
})

describe('LiveArena de punta a punta (simulador → reglas → RCON)', () => {
  it('estado inicial con el perfil Supervivencia', async () => {
    const s = await api('GET', '/api/state')
    expect(s.profile.id).toBe('supervivencia')
    expect(s.minecraft.link.state).toBe('connected')
    expect(s.config.minecraft.password).toBe('••••')
  })

  it('una racha de 5 rosas lanza 5 truenos (sin duplicar al cerrar la racha)', async () => {
    fake.commands.length = 0
    await api('POST', '/api/simulate', { type: 'gift', name: 'Rose', count: 5, user: 'Ana' })
    await wait(1500)
    const bolts = fake.commands.filter((c) => c.includes('lightning_bolt'))
    expect(bolts).toHaveLength(5)
    expect(fake.commands.some((c) => c.startsWith('title Steve actionbar') && c.includes('Ana'))).toBe(true)
  })

  it('el creeper sale con el nombre del espectador', async () => {
    fake.commands.length = 0
    await api('POST', '/api/simulate', { type: 'gift', name: 'TikTok', count: 1, user: 'Pepe' })
    await wait(800)
    expect(fake.commands.find((c) => c.includes('summon minecraft:creeper'))).toContain('"text":"Pepe"')
  })

  it('likes por persona: 25 likes = 2 zombies', async () => {
    fake.commands.length = 0
    await api('POST', '/api/simulate', { type: 'like', count: 25, user: 'Luz' })
    await wait(500)
    expect(fake.commands.filter((c) => c.includes('summon minecraft:zombie'))).toHaveLength(2)
  })

  it('overlays reciben la tarjeta por WebSocket con el regalo y el usuario', async () => {
    const ws = new WebSocket(base.replace('http', 'ws') + '/ws')
    const msgs: { type: string; payload: { kind?: string; user?: { nickname: string }; gift?: { name: string; imageUrl?: string } } }[] = []
    ws.on('message', (d) => msgs.push(JSON.parse(String(d))))
    await new Promise((r) => ws.on('open', r))
    ws.send(JSON.stringify({ v: 1, type: 'hello', id: '1', ts: Date.now(), payload: { role: 'overlay', client: 'test', subscribe: ['action:overlay.*'] } }))
    await wait(100)
    await api('POST', '/api/simulate', { type: 'gift', name: 'Galaxy', count: 1, user: 'Rico' })
    await wait(500)
    ws.close()
    expect(msgs[0]!.type).toBe('welcome')
    const card = msgs.find((m) => m.type === 'action' && m.payload.kind === 'overlay.card')
    expect(card?.payload.user?.nickname).toBe('Rico')
    expect(card?.payload.gift?.imageUrl).toMatch(/^\/gifts\/.*\.webp$/)
  })

  it('ranking de donadores y mejor regalo', async () => {
    const s = await api('GET', '/api/state')
    expect(s.stats.diamonds).toBeGreaterThanOrEqual(1006)
    expect(s.stats.bestLive.gift).toBe('Galaxy')
  })

  it('ráfaga de 300 eventos en 1 s sin perder el regalo grande', async () => {
    fake.commands.length = 0
    await api('POST', '/api/simulate', { type: 'burst', events: 300, seconds: 1 })
    await api('POST', '/api/simulate', { type: 'gift', name: 'Galaxy', count: 1, user: 'Grande' })
    await wait(2500)
    expect(fake.commands.some((c) => c.includes('summon minecraft:wither') && c.includes('Grande'))).toBe(true)
  })

  it('rechaza peticiones de otros orígenes (protección CSRF)', async () => {
    const r = await fetch(base + '/api/minecraft/command', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: JSON.stringify({ command: 'op x' }) })
    expect(r.status).toBe(403)
    const r2 = await fetch(base + '/api/minecraft/command', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' })
    expect(r2.status).toBe(415)
  })

  it('incluye el perfil s2e Survival con comandos /survival', async () => {
    const p = await api('GET', '/api/profiles/s2e-survival')
    expect(p.actions.find((a: { id: string }) => a.id === 's2e-zombie').steps[0].commands[0]).toBe('survival zombie null {nickname}')
  })

  it('probar un comando rellena las variables con el espectador «Prueba»', async () => {
    fake.commands.length = 0
    const r = await api('POST', '/api/minecraft/test-command', { command: '/survival zombie null {nickname}' })
    expect(r.command).toBe('survival zombie null Prueba')
    expect(fake.commands).toContain('survival zombie null Prueba')
  })

  it('perfil: exportar e importar por código', async () => {
    const { code } = await api('GET', '/api/profiles/supervivencia/export')
    expect(code).toMatch(/^LA1:/)
    const p = await api('POST', '/api/profiles/import', { code, name: 'Copia' })
    expect(p.id).toBe('copia')
    expect(p.actions.length).toBeGreaterThan(5)
  })
})
