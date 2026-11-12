import fs from 'node:fs'
import { publicAllowed } from './tunnel.js'
import { ShortLinks } from './shortlinks.js'
import fsp from 'node:fs/promises'
import path from 'node:path'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import fastifyStatic from '@fastify/static'
import { z } from 'zod'
import { KitSchema, OverlayStyleSchema } from '@livearena/shared'
import { TTS_AUDIO_DIR } from './tts.js'
import { CineSettingsSchema, readCineSettings, writeCineSettings } from './cine-settings.js'
import { ITEMS } from './items.js'
import { ConfigSchema, paths } from './config.js'
import { SceneSchema } from '@livearena/shared'
import { ASSETS_DIR, DASHBOARD_DIST } from './resources.js'
import { SimRequestSchema, Simulator } from './simulator.js'
import { VERSION, type App } from './app.js'
import { baseDefenseProfile, dropperProfile, lastHouseProfile, noSalpiquesProfile, parkourProfile } from './default-profiles.js'
import { LastHouseResultSchema, LastHouseSettingsSchema } from './lasthouse.js'


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
  const shortLinks = new ShortLinks()
  const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i

  f.addHook('onRequest', async (req, reply) => {
    const host = (req.headers.host ?? '').toLowerCase()
    if (app.tunnel.publicHost && host === app.tunnel.publicHost) {
      // Enlace público: solo los overlays (lectura). Nada del panel ni de la API que cambia cosas.
      if (!publicAllowed(req.method, req.url)) return reply.code(403).send({ error: 'Solo overlays' })
      return
    }
    if (!localHost.test(host)) return reply.code(403).send({ error: 'Host no permitido' })
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
    await f.register(fastifyStatic, { root: DASHBOARD_DIST, prefix: '/' })
    // SPA: cualquier ruta no-API devuelve index.html (overlays incluidos: /overlay/...)
    f.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'No encontrado' })
      return (reply as FastifyReply & { sendFile: (f: string) => FastifyReply }).sendFile('index.html')
    })
  }

  /* -------------------------------- estado -------------------------------- */
  /* ---------------------- enlace público y enlaces cortos ---------------------- */
  f.get('/api/tunnel', async () => app.tunnel.state)
  f.post('/api/tunnel/start', async () => app.tunnel.start(Number((f.server.address() as { port?: number } | null)?.port ?? app.cfg.get().port)))
  f.post('/api/tunnel/stop', async () => app.tunnel.stop())
  // Enlace corto: /o/<código> → /overlay/... (algunos programas rechazan enlaces largos con parámetros).
  f.post('/api/shortlinks', async (req) => {
    const target = String((req.body as { path?: string } | null)?.path ?? '')
    if (!/^\/(overlay|juego)\/[^\s]*$/.test(target) || target.length > 4000) throw new HttpError(400, 'Ruta no válida')
    return { code: shortLinks.add(target) }
  })
  f.get('/o/:code', async (req, reply) => {
    const t = shortLinks.get((req.params as { code: string }).code)
    if (!t) return reply.code(404).send('Enlace no encontrado')
    return reply.redirect(t, 302)
  })

  f.get('/api/state', async () => ({
    version: VERSION,
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
  f.get('/api/textures', async () => ({ ...app.textures.status, jars: await app.textures.jars() }))
  f.post('/api/textures/import', async (req) => {
    const { jar } = parse(z.object({ jar: z.string().min(1).max(1000).optional() }), req.body)
    if (jar) {
      if (!/\.jar$/i.test(jar)) throw new HttpError(400, 'Elige un archivo .jar')
      return app.textures.import(jar)
    }
    const found = (await app.textures.jars())[0]
    if (!found) throw new HttpError(404, 'No encontré Minecraft instalado. Abre el juego una vez o elige el .jar a mano.')
    return app.textures.import(found.file, found.version)
  })
  // Textura por ruta (catálogo de imágenes: caras de mobs, bloques, objetos).
  f.get<{ Params: { '*': string } }>('/textures/raw/*', async (req, reply) => {
    const file = await app.textures.raw(req.params['*'])
    if (!file) return reply.code(404).send()
    reply.header('cache-control', 'public, max-age=86400').type('image/png')
    return fsp.readFile(file)
  })
  f.get<{ Params: { id: string } }>('/textures/:id', async (req, reply) => {
    const id = req.params.id.replace(/\.png$/, '')
    if (!/^[a-z0-9_:]{1,80}$/.test(id)) return reply.code(400).send()
    const file = await app.textures.file(id)
    if (!file) return reply.code(404).send()
    reply.header('cache-control', 'public, max-age=86400').type('image/png')
    return fsp.readFile(file)
  })

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
        mcVersion: z.string().regex(/^\d+\.\d+(\.\d+)?$/).optional(),
        mcAutoConnect: z.boolean().optional(),
        commandsPerSecond: z.number().min(1).max(100).optional(),
        maxLiveMobs: z.number().int().min(0).max(5000).optional(),
        watchPlayer: z.boolean().optional(),
        chatAnnounce: z.boolean().optional(),
        chatPrefix: z.string().max(20).optional(),
        chatShowGift: z.boolean().optional(),
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
      if (body.chatAnnounce !== undefined) c.chat.announce = body.chatAnnounce
      if (body.chatPrefix !== undefined) c.chat.prefix = body.chatPrefix
      if (body.chatShowGift !== undefined) c.chat.showGift = body.chatShowGift
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

  /* ------------------------------- overlays ------------------------------- */
  f.get('/api/overlays/settings', async () => app.cfg.get().overlays)
  f.put('/api/overlays/settings', async (req) => {
    const deepMerge = (a: any, b: any): any => {
      if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null || Array.isArray(b)) return b
      const out: any = { ...a }
      for (const k of Object.keys(b)) out[k] = deepMerge(a[k], b[k])
      return out
    }
    const merged = deepMerge(app.cfg.get().overlays, req.body ?? {})
    const parsed = ConfigSchema.shape.overlays.safeParse(merged)
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Ajustes no válidos')
    app.cfg.update((c) => (c.overlays = parsed.data))
    app.publishOverlayCfg()
    app.publishScoreboard()
    return parsed.data
  })
  f.post('/api/overlays/reset', async (req) => {
    const { what } = parse(z.object({ what: z.enum(['ever', 'live', 'streak', 'goals', 'session']) }), req.body)
    if (what === 'session') app.newSession(app.cfg.get().tiktok.username)
    else {
      app.stats.resetBest(what)
      app.publishStatsNow()
    }
    return { ok: true }
  })

  /* -------------------------------- escenas -------------------------------- */
  f.get('/api/scenes', async () => app.cfg.get().scenes)
  f.put('/api/scenes', async (req) => {
    const parsed = SceneSchema.array().safeParse(req.body)
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Escenas no válidas')
    app.cfg.update((c) => (c.scenes = parsed.data))
    app.hub.setState('scenes', parsed.data)
    return parsed.data
  })

  /* --------------------------------- TTS --------------------------------- */
  f.get('/api/tts/settings', async () => app.cfg.get().tts)
  f.get('/api/tts/history', async () => app.tts.getHistory())
  f.put('/api/tts/settings', async (req) => {
    const deepMerge = (a: any, b: any): any => {
      if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null || Array.isArray(b)) return b
      const out: any = { ...a }
      for (const k of Object.keys(b)) out[k] = deepMerge(a[k], b[k])
      return out
    }
    const merged = deepMerge(app.cfg.get().tts, req.body ?? {})
    const parsed = ConfigSchema.shape.tts.safeParse(merged)
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Ajustes no válidos')
    app.cfg.update((c) => (c.tts = parsed.data))
    app.tts.publishConfig()
    return parsed.data
  })
  f.post('/api/tts/clear', async () => {
    app.tts.clearHistory()
    return { ok: true }
  })
  f.post('/api/tts/say', async (req) => {
    const { text, voice } = parse(z.object({ text: z.string().min(1).max(500), voice: z.string().max(160).optional() }), req.body)
    return app.tts.speak(text, voice ?? app.cfg.get().tts.voice, null, null)
  })
  f.get('/api/tts/voices/windows', async () => ({ available: app.tts.sapi.available, voices: await app.tts.sapi.voices(true) }))
  f.post('/api/tts/preview', async (req) => {
    const { voice, text } = parse(z.object({ voice: z.string().min(1).max(160), text: z.string().min(1).max(300) }), req.body)
    return app.tts.preview(voice, text)
  })
  /** Asigna (o quita, con voice vacío) la voz de un usuario. */
  f.put('/api/tts/user', async (req) => {
    const { user, voice } = parse(z.object({ user: z.string().min(1).max(60), voice: z.string().max(160) }), req.body)
    const key = user.replace(/^@/, '').trim().toLowerCase()
    app.cfg.update((c) => {
      if (voice) c.tts.perUser[key] = voice
      else delete c.tts.perUser[key]
    })
    app.tts.publishConfig()
    return app.cfg.get().tts.perUser
  })
  f.get('/tts/audio/:file', async (req, reply) => {
    const file = (req.params as { file: string }).file
    if (!/^[\w.-]+\.wav$/.test(file)) return reply.code(404).send()
    const data = await fsp.readFile(path.join(TTS_AUDIO_DIR, file)).catch(() => null)
    if (!data) return reply.code(404).send()
    return reply.type('audio/wav').header('Cache-Control', 'no-store').send(data)
  })

  /* ------------------------------- simulador ------------------------------- */
  f.post('/api/simulate', async (req) => {
    if ((req.body as { dry?: boolean } | null)?.dry) app.simulateDry()
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
    const o = parse(z.object({ full: z.boolean().default(false), eventId: z.string().optional() }), req.body)
    app.testAction(req.params.id, o)
    return { ok: true }
  })
  f.post('/api/minecraft/test-command', async (req) => {
    const { command } = parse(z.object({ command: z.string().min(1).max(32000) }), req.body)
    return app.testCommand(command)
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
  /* ---------------- habilidades cinemáticas (plugin + mod NeoForge/GeckoLib) ---------------- */
  f.get('/api/cine/status', async () => app.cine.status())
  f.post('/api/cine/install', async () => app.cine.install())
  f.post('/api/cine/uninstall', async () => app.cine.uninstall())
  f.post('/api/cine/run', async (req) => {
    const { id, viewer } = parse(z.object({ id: z.string().regex(/^[a-z_]+$/), viewer: z.string().max(40).default('Prueba') }), req.body)
    const player = app.mc.player
    if (!player) throw new Error('Configura tu nick de Minecraft.')
    const response = await app.mc.link.enqueue(`habilidad ${id} ${player} - ${viewer.replace(/\s+/g, '_') || 'Prueba'}`, 1000)
    return { response }
  })
  f.post('/api/cine/stop', async () => {
    const player = app.mc.player
    if (!player) throw new Error('Configura tu nick de Minecraft.')
    return { response: await app.mc.link.enqueue(`habilidad detener ${player}`, 1000) }
  })
  f.get('/api/cine/settings', async () => readCineSettings(app.cfg.get().minecraft.server.folder))
  f.put('/api/cine/settings', async (req) => {
    const body = parse(CineSettingsSchema.partial(), req.body)
    const out = await writeCineSettings(app.cfg.get().minecraft.server.folder, body)
    await app.mc.link.enqueue('habilidad recargar', 500).catch(() => undefined)
    return out
  })
  /* ---------------- minijuegos (Base Defense) ---------------- */
  f.get('/api/minigames/status', async () => app.minigames.status())
  f.post('/api/minigames/basedefense/install', async () => app.minigames.install())
  f.post('/api/minigames/basedefense/command', async (req) => {
    const { command } = parse(z.object({ command: z.string().min(1).max(120) }), req.body)
    const response = await app.minigames.command(command)
    // Modos separados: al empezar la partida se activa el perfil de regalos de Base Defense; al terminar vuelve el anterior.
    if (/^bd start\b/.test(command.trim())) {
      // un solo minijuego a la vez
      if (app.minigames.parkour?.running) await app.mc.link.enqueue('pk stop', 900).catch(() => '')
      if (app.minigames.dropper?.running) await app.mc.link.enqueue('dr stop', 900).catch(() => '')
      if (app.minigames.nosalpiques?.running) await app.mc.link.enqueue('ns stop', 900).catch(() => '')
      const bd = app.profiles.get('base-defense') ?? (await app.profiles.save(baseDefenseProfile(), false))
      if (app.activeProfile.id !== bd.id) {
        app.minigames.previousProfile = app.activeProfile.id
        app.setProfile(bd)
      }
    } else if (/^bd stop\b/.test(command.trim()) && app.minigames.previousProfile) {
      const prev = app.profiles.get(app.minigames.previousProfile)
      app.minigames.previousProfile = null
      if (prev) app.setProfile(prev)
    }
    return { response }
  })
  f.get('/api/minigames/basedefense/settings', async () => app.minigames.getSettings())
  f.put('/api/minigames/basedefense/settings', async (req) => {
    const values = parse(z.record(z.union([z.string().max(120), z.number()])), req.body)
    return app.minigames.saveSettings(values as never)
  })
  f.post('/api/minigames/basedefense/profile', async () => {
    const p = app.profiles.get('base-defense') ?? (await app.profiles.save(baseDefenseProfile(), false))
    app.setProfile(p)
    return { id: p.id, name: p.name }
  })
  /* ---------------- minijuegos (Parkour LIVE) ---------------- */
  const pk = () => {
    if (!app.minigames.parkour) throw new HttpError(503, 'Parkour no disponible')
    return app.minigames.parkour
  }
  f.post('/api/minigames/parkour/install', async () => pk().install())
  f.post('/api/minigames/parkour/command', async (req) => {
    const { command } = parse(z.object({ command: z.string().min(1).max(120) }), req.body)
    const c = command.trim()
    // un solo minijuego a la vez: al empezar el parkour se para Base Defense
    if (/^pk start\b/.test(c)) {
      const bdGame = (await app.minigames.status()).baseDefense.game
      if (bdGame?.running) await app.mc.link.enqueue('bd stop', 900).catch(() => '')
      if (app.minigames.dropper?.running) await app.mc.link.enqueue('dr stop', 900).catch(() => '')
      if (app.minigames.nosalpiques?.running) await app.mc.link.enqueue('ns stop', 900).catch(() => '')
    }
    const response = await pk().command(command)
    if (/^pk start\b/.test(c)) {
      const p = app.profiles.get('parkour') ?? (await app.profiles.save(parkourProfile(), false))
      if (app.activeProfile.id !== p.id) {
        if (app.activeProfile.id !== 'base-defense') pk().previousProfile = app.activeProfile.id
        else pk().previousProfile = app.minigames.previousProfile
        app.setProfile(p)
      }
    } else if (/^pk stop\b/.test(c) && pk().previousProfile) {
      const prev = app.profiles.get(pk().previousProfile!)
      pk().previousProfile = null
      if (prev) app.setProfile(prev)
    }
    return { response }
  })
  f.get('/api/minigames/parkour/settings', async () => pk().getSettings())
  f.put('/api/minigames/parkour/settings', async (req) => {
    const values = parse(z.record(z.union([z.string().max(120), z.number()])), req.body)
    return pk().saveSettings(values)
  })
  f.post('/api/minigames/parkour/profile', async () => {
    const p = app.profiles.get('parkour') ?? (await app.profiles.save(parkourProfile(), false))
    app.setProfile(p)
    return { id: p.id, name: p.name }
  })
  /* ---------------- minijuegos (Dropper LIVE) ---------------- */
  const dr = () => {
    if (!app.minigames.dropper) throw new HttpError(503, 'Dropper no disponible')
    return app.minigames.dropper
  }
  f.post('/api/minigames/dropper/install', async () => dr().install())
  f.post('/api/minigames/dropper/command', async (req) => {
    const { command } = parse(z.object({ command: z.string().min(1).max(120) }), req.body)
    const c = command.trim()
    // un solo minijuego a la vez
    if (/^dr start\b/.test(c)) {
      const bdGame = (await app.minigames.status()).baseDefense.game
      if (bdGame?.running) await app.mc.link.enqueue('bd stop', 900).catch(() => '')
      if (app.minigames.parkour?.running) await app.mc.link.enqueue('pk stop', 900).catch(() => '')
      if (app.minigames.nosalpiques?.running) await app.mc.link.enqueue('ns stop', 900).catch(() => '')
    }
    const response = await dr().command(command)
    if (/^dr start\b/.test(c)) {
      const p = app.profiles.get('dropper') ?? (await app.profiles.save(dropperProfile(), false))
      if (app.activeProfile.id !== p.id) {
        if (!['base-defense', 'parkour'].includes(app.activeProfile.id)) dr().previousProfile = app.activeProfile.id
        app.setProfile(p)
      }
    } else if (/^dr stop\b/.test(c) && dr().previousProfile) {
      const prev = app.profiles.get(dr().previousProfile!)
      dr().previousProfile = null
      if (prev) app.setProfile(prev)
    }
    return { response }
  })
  f.get('/api/minigames/dropper/settings', async () => dr().getSettings())
  f.put('/api/minigames/dropper/settings', async (req) => {
    const values = parse(z.record(z.union([z.string().max(120), z.number()])), req.body)
    return dr().saveSettings(values)
  })
  f.post('/api/minigames/dropper/profile', async () => {
    const p = app.profiles.get('dropper') ?? (await app.profiles.save(dropperProfile(), false))
    app.setProfile(p)
    return { id: p.id, name: p.name }
  })
  /* ---------------- minijuegos (No Salpiques) ---------------- */
  const ns = () => {
    if (!app.minigames.nosalpiques) throw new HttpError(503, 'No Salpiques no disponible')
    return app.minigames.nosalpiques
  }
  f.post('/api/minigames/nosalpiques/install', async () => ns().install())
  f.post('/api/minigames/nosalpiques/command', async (req) => {
    const { command } = parse(z.object({ command: z.string().min(1).max(120) }), req.body)
    const c = command.trim()
    // un solo minijuego a la vez
    if (/^ns start\b/.test(c)) {
      const bdGame = (await app.minigames.status()).baseDefense.game
      if (bdGame?.running) await app.mc.link.enqueue('bd stop', 900).catch(() => '')
      if (app.minigames.parkour?.running) await app.mc.link.enqueue('pk stop', 900).catch(() => '')
      if (app.minigames.dropper?.running) await app.mc.link.enqueue('dr stop', 900).catch(() => '')
    }
    const response = await ns().command(command)
    if (/^ns start\b/.test(c)) {
      const p = app.profiles.get('nosalpiques') ?? (await app.profiles.save(noSalpiquesProfile(), false))
      if (app.activeProfile.id !== p.id) {
        if (!['base-defense', 'parkour', 'dropper'].includes(app.activeProfile.id)) ns().previousProfile = app.activeProfile.id
        app.setProfile(p)
      }
    } else if (/^ns stop\b/.test(c) && ns().previousProfile) {
      const prev = app.profiles.get(ns().previousProfile!)
      ns().previousProfile = null
      if (prev) app.setProfile(prev)
    }
    return { response }
  })
  f.get('/api/minigames/nosalpiques/settings', async () => ns().getSettings())
  f.put('/api/minigames/nosalpiques/settings', async (req) => {
    const values = parse(z.record(z.union([z.string().max(120), z.number()])), req.body)
    return ns().saveSettings(values)
  })
  f.post('/api/minigames/nosalpiques/profile', async () => {
    const p = app.profiles.get('nosalpiques') ?? (await app.profiles.save(noSalpiquesProfile(), false))
    app.setProfile(p)
    return { id: p.id, name: p.name }
  })
  /* ---------------- LAST HOUSE (juego web propio) ---------------- */
  f.get('/api/lasthouse/settings', async () => app.lasthouse.getSettings())
  f.put('/api/lasthouse/settings', async (req) => app.lasthouse.saveSettings(parse(LastHouseSettingsSchema.partial(), req.body)))
  f.get('/api/lasthouse/progress', async () => app.lasthouse.progress())
  f.post('/api/lasthouse/progress/reset', async () => {
    await app.lasthouse.reset()
    return { ok: true }
  })
  // la página del juego manda aquí una foto del marcador (≈2 por segundo) para el overlay del directo
  f.post('/api/lasthouse/state', async (req) => {
    const body = parse(z.record(z.unknown()), req.body)
    if (JSON.stringify(body).length > 20_000) throw new HttpError(413, 'Estado demasiado grande')
    app.lasthouse.live = body
    app.hub.setState('lasthouse', body)
    return { ok: true }
  })
  f.post('/api/lasthouse/result', async (req) => app.lasthouse.record(parse(LastHouseResultSchema, req.body)))
  // al jugar LAST HOUSE se activa un perfil vacío para que no salte ninguna acción de Minecraft; al salir, vuelve el anterior
  f.post('/api/lasthouse/session', async (req) => {
    const { active } = parse(z.object({ active: z.boolean() }), req.body)
    if (active) {
      const p = app.profiles.get('lasthouse') ?? (await app.profiles.save(lastHouseProfile(), false))
      if (app.activeProfile.id !== p.id) {
        app.lasthouse.previousProfile = app.activeProfile.id
        app.setProfile(p)
      }
    } else if (app.lasthouse.previousProfile) {
      const prev = app.profiles.get(app.lasthouse.previousProfile)
      app.lasthouse.previousProfile = null
      if (prev) app.setProfile(prev)
    }
    return { profile: app.activeProfile.id }
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
        mcVersion: z.string().regex(/^\d+\.\d+(\.\d+)?$/).default('26.1.2'),
        eulaAccepted: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar el EULA de Minecraft' }) }),
        name: z.string().min(1).max(59).default('Servidor LiveArena'),
        difficulty: z.enum(['peaceful', 'easy', 'normal', 'hard']).default('normal'),
        gamemode: z.enum(['survival', 'creative', 'adventure']).default('survival'),
        levelType: z.enum(['normal', 'flat', 'large_biomes', 'amplified']).default('normal'),
        seed: z.string().max(64).optional(),
        maxPlayers: z.number().int().min(1).max(500).default(10),
        xmxMB: z.number().int().min(512).max(65536).default(4096),
        xmsMB: z.number().int().min(256).max(65536).default(2048),
        viaVersion: z.boolean().default(false),
        installJava: z.boolean().default(true),
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

  f.get('/api/minecraft/versions', async () => app.mc.versions())
  f.get<{ Querystring: { version?: string } }>('/api/minecraft/java/check', async (req) => app.mc.javaInfo(req.query.version))
  f.post('/api/minecraft/java/install', async (req) => {
    const { version } = parse(z.object({ version: z.string().regex(/^\d+\.\d+(\.\d+)?$/) }), req.body)
    app.mc.installJava(version).catch((e) => app.log.error('servidor', e.message))
    return { ok: true }
  })
  f.get('/api/minecraft/server/settings', async () => app.mc.getSettings())
  f.put('/api/minecraft/server/settings', async (req) => {
    const v = parse(
      z.object({
        jar: z.string().max(500),
        java: z.string().max(500),
        xmxMB: z.number().int().min(512).max(65536),
        xmsMB: z.number().int().min(256).max(65536),
        levelName: z.string().min(1).max(60),
        onlineMode: z.boolean(),
        motd: z.string().max(59),
        maxPlayers: z.number().int().min(1).max(1000),
        difficulty: z.enum(['peaceful', 'easy', 'normal', 'hard']),
        pvp: z.boolean(),
        livearenaPlugin: z.boolean(),
      }).partial(),
      req.body,
    )
    return app.mc.saveSettings(v)
  })
  f.get('/api/minecraft/server/properties', async () => ({ text: await app.mc.readPropertiesText() }))
  f.put('/api/minecraft/server/properties', async (req) => {
    const { text } = parse(z.object({ text: z.string().max(100000) }), req.body)
    await app.mc.writePropertiesText(text)
    return { ok: true }
  })
  f.get('/api/minecraft/server/plugins', async () => app.mc.listServerPlugins())
  f.post('/api/minecraft/server/plugins/toggle', async (req) => {
    const { file, enabled } = parse(z.object({ file: z.string().min(1), enabled: z.boolean() }), req.body)
    await app.mc.togglePlugin(file, enabled)
    return app.mc.listServerPlugins()
  })
  f.post('/api/minecraft/server/plugins/remove', async (req) => {
    const { file } = parse(z.object({ file: z.string().min(1) }), req.body)
    await app.mc.removePlugin(file)
    return app.mc.listServerPlugins()
  })
  f.post('/api/minecraft/server/plugins/install', async (req) => {
    const { files } = parse(z.object({ files: z.array(z.string().min(1)).min(1) }), req.body)
    for (const file of files) await app.mc.installFromLibrary(file)
    return app.mc.listServerPlugins()
  })
  f.post('/api/minecraft/server/plugins/upload', async (req: FastifyRequest) => {
    const name = path.basename(String(req.headers['x-filename'] ?? ''))
    if (!/\.jar$/i.test(name)) throw new HttpError(400, 'Solo archivos .jar')
    await app.mc.savePluginToServer(name, req.body as Buffer)
    await fsp.writeFile(path.join(paths.plugins, name), req.body as Buffer).catch(() => undefined)
    return app.mc.listServerPlugins()
  })
  f.post('/api/minecraft/server/reset-world', async () => app.mc.resetWorld())
  f.get('/api/minecraft/gamerules', async () => app.mc.getGameRules())
  f.post('/api/minecraft/gamerules', async (req) => {
    const { id, value } = parse(z.object({ id: z.string().min(1).max(60), value: z.string().max(10) }), req.body)
    return { response: await app.mc.setGameRule(id, value) }
  })
  f.post('/api/system/open', async (req) => {
    const { target } = parse(z.object({ target: z.enum(['server', 'plugins', 'data', 'media']) }), req.body)
    return { path: await app.mc.openFolder(target) }
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
