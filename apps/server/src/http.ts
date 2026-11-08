import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import fastifyStatic from '@fastify/static'
import { z } from 'zod'
import { KitSchema, OverlayStyleSchema } from '@livearena/shared'
import { ITEMS } from './items.js'
import { paths } from './config.js'
import { ASSETS_DIR } from './gifts.js'
import { SimRequestSchema, Simulator } from './simulator.js'
import type { App } from './app.js'

const DASHBOARD_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'dashboard', 'dist')

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

const parse = <S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> => {
  const r = schema.safeParse(body)
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  return r.data
}

const MEDIA_EXT = /\.(png|jpe?g|gif|webp|mp4|webm|mp3|wav|ogg)$/i

/**
 * API REST local. Solo escucha en 127.0.0.1. Protección contra webs maliciosas que intenten
 * hablar con localhost desde tu navegador (CSRF / DNS rebinding):
 *  - Host debe ser localhost/127.0.0.1,
 *  - las peticiones que cambian algo exigen JSON (fuerza preflight CORS, que no aceptamos)
 *    y, si traen Origin, debe ser local.
 */
export async function buildHttp(app: App): Promise<FastifyInstance> {
  const f = Fastify({ logger: false, bodyLimit: 2 * 1024 * 1024 })
  const sim = new Simulator(app)
  const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i

  f.addHook('onRequest', async (req, reply) => {
    if (!localHost.test(req.headers.host ?? '')) return reply.code(403).send({ error: 'Host no permitido' })
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      const origin = req.headers.origin
      if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin)) return reply.code(403).send({ error: 'Origen no permitido' })
      const ct = String(req.headers['content-type'] ?? '')
      if (!ct.startsWith('application/json') && !ct.startsWith('application/octet-stream')) return reply.code(415).send({ error: 'Se requiere JSON' })
    }
  })

  f.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    const status = err instanceof HttpError ? err.status : (err.statusCode ?? 500)
    if (status >= 500) app.log.error('api', err.message)
    reply.code(status).send({ error: err.message })
  })

  f.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: 300 * 1024 * 1024 }, (_req, body, done) => done(null, body))

  /* ------------------------------ estáticos ------------------------------ */
  await f.register(fastifyStatic, { root: path.join(ASSETS_DIR, 'gifts'), prefix: '/gifts/', decorateReply: false, maxAge: '7d' })
  await f.register(fastifyStatic, { root: paths.media, prefix: '/media/', decorateReply: false })
  if (fs.existsSync(DASHBOARD_DIST)) {
    await f.register(fastifyStatic, { root: DASHBOARD_DIST, prefix: '/', wildcard: false })
    // SPA: cualquier ruta no-API devuelve index.html (overlays incluidos: /overlay/...)
    f.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'No encontrado' })
      return (reply as FastifyReply & { sendFile: (f: string) => FastifyReply }).sendFile('index.html')
    })
  }

  /* -------------------------------- estado -------------------------------- */
  f.get('/api/state', async () => ({
    version: app.hub.getState('profile') ? '0.1.0' : '0.1.0',
    config: app.cfg.publicView(),
    source: app.tiktok.status(),
    minecraft: app.mc.status(),
    profile: app.activeProfile,
    profiles: app.profiles.list(),
    queue: app.queueStats(),
    paused: app.actionsPaused,
    stats: app.stats.summary(),
    logs: app.log.recent(),
    activity: app.recentActivity(),
    overlays: app.hub.count,
  }))
  f.get('/api/activity', async () => app.recentActivity())
  f.get('/api/gifts', async () => app.gifts.list())
  f.get('/api/items', async () => ITEMS)

  f.put('/api/config', async (req) => {
    const body = parse(
      z.object({
        tiktokUsername: z.string().max(100).optional(),
        signApiKey: z.string().max(200).optional(),
        tiktokAutoConnect: z.boolean().optional(),
        player: z.string().max(16).optional(),
        mcHost: z.string().max(200).optional(),
        mcPort: z.number().int().min(1).max(65535).optional(),
        mcPassword: z.string().max(200).optional(),
        mcVersion: z.string().regex(/^1\.\d+(\.\d+)?$/).optional(),
        mcAutoConnect: z.boolean().optional(),
        commandsPerSecond: z.number().min(1).max(100).optional(),
        maxLiveMobs: z.number().int().min(0).max(5000).optional(),
        watchPlayer: z.boolean().optional(),
        ramGB: z.number().min(1).max(32).optional(),
        java: z.string().max(500).optional(),
        stopOnExit: z.boolean().optional(),
        likeGoal: z.number().int().min(1).optional(),
        likeGoalLabel: z.string().max(60).optional(),
        onDeath: z.object({ loseLife: z.boolean(), addLoss: z.boolean(), resetTimer: z.boolean() }).partial().optional(),
      }),
      req.body,
    )
    if (body.player !== undefined) app.mc.setPlayer(body.player.trim())
    app.cfg.update((c) => {
      if (body.tiktokUsername !== undefined) c.tiktok.username = body.tiktokUsername.replace(/^@/, '').trim()
      if (body.signApiKey !== undefined && body.signApiKey !== '••••') c.tiktok.signApiKey = body.signApiKey.trim()
      if (body.tiktokAutoConnect !== undefined) c.tiktok.autoConnect = body.tiktokAutoConnect
      if (body.mcHost !== undefined) c.minecraft.host = body.mcHost
      if (body.mcPort !== undefined) c.minecraft.port = body.mcPort
      if (body.mcPassword !== undefined && body.mcPassword !== '••••') c.minecraft.password = body.mcPassword
      if (body.mcVersion !== undefined) c.minecraft.version = body.mcVersion
      if (body.mcAutoConnect !== undefined) c.minecraft.autoConnect = body.mcAutoConnect
      if (body.commandsPerSecond !== undefined) c.minecraft.commandsPerSecond = body.commandsPerSecond
      if (body.maxLiveMobs !== undefined) c.minecraft.maxLiveMobs = body.maxLiveMobs
      if (body.watchPlayer !== undefined) c.minecraft.watchPlayer = body.watchPlayer
      if (body.ramGB !== undefined) c.minecraft.server.ramGB = body.ramGB
      if (body.java !== undefined) c.minecraft.server.java = body.java
      if (body.stopOnExit !== undefined) c.minecraft.server.stopOnExit = body.stopOnExit
      if (body.likeGoal !== undefined) c.likeGoal.target = body.likeGoal
      if (body.likeGoalLabel !== undefined) c.likeGoal.label = body.likeGoalLabel
      if (body.onDeath) Object.assign(c.scoreboard.onDeath, body.onDeath)
      c.firstRun = false
    })
    app.hub.setState('minecraft', app.mc.status())
    return app.cfg.publicView()
  })

  /* -------------------------------- TikTok -------------------------------- */
  f.post('/api/tiktok/connect', async (req) => {
    const { username } = parse(z.object({ username: z.string().min(1).max(100) }), req.body)
    app.connectTikTok(username).catch((e) => app.log.warn('tiktok', e.message))
    return { ok: true }
  })
  f.post('/api/tiktok/disconnect', async () => {
    await app.tiktok.disconnect()
    return { ok: true }
  })
  f.post('/api/session/new', async () => {
    app.newSession(app.cfg.get().tiktok.username)
    return { ok: true }
  })

  /* ------------------------------- simulador ------------------------------- */
  f.post('/api/simulate', async (req) => {
    sim.run(parse(SimRequestSchema, req.body))
    return { ok: true }
  })

  /* -------------------------------- perfiles -------------------------------- */
  f.get('/api/profiles', async () => app.profiles.list())
  f.get<{ Params: { id: string } }>('/api/profiles/:id', async (req) => {
    const p = app.profiles.get(req.params.id)
    if (!p) throw new HttpError(404, 'Perfil no encontrado')
    return p
  })
  f.put<{ Params: { id: string } }>('/api/profiles/:id', async (req) => {
    let p
    try {
      p = await app.profiles.save({ ...(req.body as object), id: req.params.id })
    } catch (e) {
      throw new HttpError(400, (e as Error).message)
    }
    if (p.id === app.activeProfile.id) app.setProfile(p)
    return p
  })
  f.post<{ Params: { id: string } }>('/api/profiles/:id/activate', async (req) => {
    const p = app.profiles.get(req.params.id)
    if (!p) throw new HttpError(404, 'Perfil no encontrado')
    app.setProfile(p)
    return p
  })
  f.post<{ Params: { id: string } }>('/api/profiles/:id/duplicate', async (req) => {
    const { name } = parse(z.object({ name: z.string().min(1).max(60) }), req.body)
    return app.profiles.duplicate(req.params.id, name)
  })
  f.delete<{ Params: { id: string } }>('/api/profiles/:id', async (req) => {
    await app.profiles.remove(req.params.id)
    if (app.activeProfile.id === req.params.id) app.setProfile(app.profiles.first())
    return { ok: true }
  })
  f.get<{ Params: { id: string } }>('/api/profiles/:id/backups', async (req) => app.profiles.listBackups(req.params.id))
  f.post<{ Params: { id: string } }>('/api/profiles/:id/restore', async (req) => {
    const { file } = parse(z.object({ file: z.string().min(1) }), req.body)
    const p = await app.profiles.restore(req.params.id, file)
    if (p.id === app.activeProfile.id) app.setProfile(p)
    return p
  })
  f.get<{ Params: { id: string } }>('/api/profiles/:id/export', async (req) => ({ code: app.profiles.exportCode(req.params.id) }))
  f.post('/api/profiles/import', async (req) => {
    const { code, name } = parse(z.object({ code: z.string().min(5), name: z.string().max(60).optional() }), req.body)
    try {
      return await app.profiles.importCode(code, name)
    } catch (e) {
      throw new HttpError(400, (e as Error).message)
    }
  })
  f.put('/api/profile/overlay', async (req) => {
    const style = parse(OverlayStyleSchema, req.body)
    const p = await app.profiles.save({ ...app.activeProfile, overlay: style })
    app.setProfile(p)
    return p.overlay
  })
  f.put('/api/profile/kit', async (req) => {
    const kit = parse(KitSchema, req.body)
    const p = await app.profiles.save({ ...app.activeProfile, kit })
    app.setProfile(p)
    return p.kit
  })

  /* -------------------------------- acciones -------------------------------- */
  f.post<{ Params: { id: string } }>('/api/actions/:id/test', async (req) => {
    app.testAction(req.params.id)
    return { ok: true }
  })
  f.post('/api/actions/pause', async (req) => {
    const { paused } = parse(z.object({ paused: z.boolean() }), req.body)
    app.pauseActions(paused)
    return { paused }
  })
  f.post('/api/queue/clear', async () => app.clearQueues())

  /* -------------------------------- marcador -------------------------------- */
  f.post('/api/scoreboard', async (req) => {
    const b = parse(
      z.object({
        add: z.object({ key: z.enum(['wins', 'losses', 'lives']), delta: z.number().int() }).optional(),
        set: z.object({ wins: z.number().int(), losses: z.number().int(), lives: z.number().int(), livesStart: z.number().int() }).partial().optional(),
        timer: z.object({ op: z.enum(['start', 'pause', 'reset', 'add']), seconds: z.number().int().optional() }).optional(),
      }),
      req.body,
    )
    if (b.add) app.addScore(b.add.key, b.add.delta)
    if (b.set) app.setScore(b.set)
    if (b.timer) app.timerOp(b.timer.op, b.timer.seconds)
    return { ok: true }
  })

  /* -------------------------------- Minecraft -------------------------------- */
  f.post('/api/minecraft/connect', async () => {
    await app.mc.connect()
    return app.mc.status()
  })
  f.post('/api/minecraft/disconnect', async () => {
    app.mc.disconnect()
    return app.mc.status()
  })
  f.post('/api/minecraft/command', async (req) => {
    const { command } = parse(z.object({ command: z.string().min(1).max(2000) }), req.body)
    const response = await app.mc.link.enqueue(command, 1000)
    return { response }
  })
  f.post('/api/minecraft/kit/give', async () => ({ commands: await app.mc.giveKit(app.activeProfile.kit) }))
  f.get('/api/minecraft/java', async () => app.mc.javaInfo())
  f.get('/api/minecraft/plugins', async () => app.mc.listPluginLibrary())
  f.post('/api/minecraft/plugins/upload', async (req: FastifyRequest) => {
    const name = path.basename(String(req.headers['x-filename'] ?? ''))
    if (!/\.jar$/i.test(name)) throw new HttpError(400, 'Solo archivos .jar')
    await fsp.writeFile(path.join(paths.plugins, name), req.body as Buffer)
    return { file: name }
  })
  f.post('/api/minecraft/server/validate', async (req) => {
    const { folder } = parse(z.object({ folder: z.string() }), req.body)
    return app.mc.validateFolder(folder)
  })
  f.post('/api/minecraft/server/create', async (req) => {
    const o = parse(
      z.object({
        folder: z.string().min(3),
        software: z.enum(['paper', 'vanilla']).default('paper'),
        mcVersion: z.string().regex(/^1\.\d+(\.\d+)?$/).default('1.20.1'),
        eulaAccepted: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar el EULA de Minecraft' }) }),
        name: z.string().min(1).max(59).default('Servidor LiveArena'),
        difficulty: z.enum(['peaceful', 'easy', 'normal', 'hard']).default('normal'),
        gamemode: z.enum(['survival', 'creative', 'adventure']).default('survival'),
        levelType: z.enum(['normal', 'flat', 'large_biomes', 'amplified']).default('normal'),
        seed: z.string().max(64).optional(),
        maxPlayers: z.number().int().min(1).max(500).default(10),
        ramGB: z.number().min(1).max(32).default(3),
        plugins: z.array(z.string()).default([]),
        onlineMode: z.boolean().default(true),
        autoStart: z.boolean().default(true),
        opPlayer: z.string().max(16).optional(),
      }),
      req.body,
    )
    const v = await app.mc.validateFolder(o.folder)
    if (!v.ok) throw new HttpError(400, v.message)
    app.mc.create(o).catch((e) => app.log.error('servidor', `No se pudo crear el servidor: ${e.message}`))
    return { ok: true }
  })
  f.post('/api/minecraft/server/adopt', async (req) => {
    const { folder } = parse(z.object({ folder: z.string().min(3) }), req.body)
    try {
      return await app.mc.adoptFolder(folder)
    } catch (e) {
      throw new HttpError(400, `No pude leer server.properties en esa carpeta: ${(e as Error).message}`)
    }
  })
  f.post('/api/minecraft/server/start', async () => {
    await app.mc.start()
    return app.mc.status()
  })
  f.post('/api/minecraft/server/stop', async () => {
    await app.mc.stop()
    return app.mc.status()
  })
  f.get('/api/minecraft/server/logs', async () => app.mc.proc.logs())
  f.post('/api/minecraft/server/console', async (req) => {
    const { command } = parse(z.object({ command: z.string().min(1).max(1000) }), req.body)
    app.mc.proc.console(command)
    return { ok: true }
  })

  /* ---------------------------------- media ---------------------------------- */
  f.get('/api/media', async () => (await fsp.readdir(paths.media)).filter((x) => MEDIA_EXT.test(x)))
  f.post('/api/media/upload', async (req: FastifyRequest) => {
    const raw = path.basename(String(req.headers['x-filename'] ?? ''))
    if (!MEDIA_EXT.test(raw)) throw new HttpError(400, 'Formato no soportado (png, jpg, gif, webp, mp4, webm, mp3, wav, ogg)')
    const name = `${Date.now().toString(36)}-${raw.replace(/[^\w.-]/g, '_')}`
    await fsp.writeFile(path.join(paths.media, name), req.body as Buffer)
    return { url: `/media/${name}`, kind: /\.(mp4|webm)$/i.test(name) ? 'video' : /\.(mp3|wav|ogg)$/i.test(name) ? 'audio' : 'image' }
  })

  return f
}
