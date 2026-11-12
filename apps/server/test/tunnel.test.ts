import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'livearena-tunnel-'))
process.env.LIVEARENA_DATA = dataDir
process.env.LOG_LEVEL = 'warn'

let app: import('../src/app.js').App
let http: import('fastify').FastifyInstance
const PUB = 'prueba-abc.trycloudflare.com'

beforeAll(async () => {
  const { App } = await import('../src/app.js')
  const { buildHttp } = await import('../src/http.js')
  app = new App()
  await app.init()
  http = await buildHttp(app)
  // Simula un túnel activo con ese host público.
  ;(app.tunnel as unknown as { host: string }).host = PUB
})

afterAll(async () => {
  ;(app.tunnel as unknown as { host: string | null }).host = null
  await http?.close()
  await app?.shutdown()
})

const get = (url: string, host: string) => http.inject({ method: 'GET', url, headers: { host } })

describe('enlace público de overlays', () => {
  it('sirve overlays y sus datos de solo lectura', async () => {
    expect((await get('/api/overlays/settings', PUB)).statusCode).toBe(200)
    expect((await get('/api/scoreboard', PUB)).statusCode).not.toBe(403)
    // catálogo de regalos (imágenes de las tarjetas) y enlaces fijos /<overlay>.html
    expect((await get('/api/gifts', PUB)).statusCode).toBe(200)
    expect((await get('/tarjetas.html', PUB)).statusCode).not.toBe(403)
    expect((await get('/index.html', PUB)).statusCode).toBe(403)
  })

  it('bloquea el panel, la API privada y cualquier cambio', async () => {
    expect((await get('/api/config', PUB)).statusCode).toBe(403)
    expect((await get('/api/profiles', PUB)).statusCode).toBe(403)
    expect((await get('/api/tunnel', PUB)).statusCode).toBe(403)
    expect((await get('/', PUB)).statusCode).toBe(403)
    const post = await http.inject({ method: 'POST', url: '/api/simulate', headers: { host: PUB, 'content-type': 'application/json' }, payload: '{"type":"follow"}' })
    expect(post.statusCode).toBe(403)
    const put = await http.inject({ method: 'PUT', url: '/api/overlays/settings', headers: { host: PUB, 'content-type': 'application/json' }, payload: '{}' })
    expect(put.statusCode).toBe(403)
  })

  it('otros hosts siguen bloqueados y el local funciona', async () => {
    expect((await get('/api/overlays/settings', 'malicioso.example.com')).statusCode).toBe(403)
    expect((await get('/api/profiles', '127.0.0.1:7420')).statusCode).toBe(200)
  })

  it('enlaces cortos redirigen al overlay (también por el enlace público)', async () => {
    const r = await http.inject({ method: 'POST', url: '/api/shortlinks', headers: { host: '127.0.0.1', 'content-type': 'application/json' }, payload: JSON.stringify({ path: '/overlay/tarjetas?a=1' }) })
    const { code } = r.json() as { code: string }
    const red = await get(`/o/${code}`, PUB)
    expect(red.statusCode).toBe(302)
    expect(red.headers.location).toBe('/overlay/tarjetas?a=1')
    const bad = await http.inject({ method: 'POST', url: '/api/shortlinks', headers: { host: '127.0.0.1', 'content-type': 'application/json' }, payload: JSON.stringify({ path: 'https://evil.example/' }) })
    expect(bad.statusCode).toBe(400)
  })

  it('el perfil Minecraft Survival Épico sustituye a LiveArena Épico', () => {
    const ids = app.profiles.list().map((p) => p.id)
    expect(ids).toContain('mc-survival-epico')
    expect(ids).not.toContain('la-epico')
  })
})
