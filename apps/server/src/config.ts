import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import { SceneSchema } from '@livearena/shared'

/** Carpeta de datos del usuario: config, perfiles, copias, media, plugins, estadísticas. */
export const DATA_DIR = process.env.LIVEARENA_DATA ?? path.join(os.homedir(), '.livearena')

export const paths = {
  config: path.join(DATA_DIR, 'config.json'),
  profiles: path.join(DATA_DIR, 'perfiles'),
  backups: path.join(DATA_DIR, 'copias'),
  media: path.join(DATA_DIR, 'media'),
  plugins: path.join(DATA_DIR, 'plugins'),
  db: path.join(DATA_DIR, 'estadisticas.db'),
  java: path.join(DATA_DIR, 'java'),
  textures: path.join(DATA_DIR, 'texturas'),
  cache: path.join(DATA_DIR, 'cache'),
}

export const ConfigSchema = z.object({
  port: z.number().int().default(7420),
  tiktok: z
    .object({
      username: z.string().default(''),
      /** Euler Stream API key (también EULER_API_KEY en .env, que tiene prioridad). */
      signApiKey: z.string().default(''),
      autoConnect: z.boolean().default(false),
    })
    .default({}),
  minecraft: z
    .object({
      player: z.string().default(''),
      host: z.string().default('127.0.0.1'),
      port: z.number().int().default(25575),
      password: z.string().default(''),
      version: z.string().default('1.20.1'),
      /** Carpeta .minecraft del juego (vacío = autodetectar). La usa el instalador del mod cinemático. */
      clientDir: z.string().default(''),
      autoConnect: z.boolean().default(true),
      commandsPerSecond: z.number().min(1).max(100).default(20),
      /** 0 = sin límite. Mobs invocados por LiveArena vivos a la vez. */
      maxLiveMobs: z.number().int().min(0).default(200),
      watchPlayer: z.boolean().default(true),
      server: z
        .object({
          folder: z.string().default(''),
          java: z.string().default(''),
          /** .jar del servidor (nombre dentro de la carpeta o ruta completa). Vacío = autodetectar. */
          jar: z.string().default(''),
          xmxMB: z.number().int().min(512).max(65536).default(4096),
          xmsMB: z.number().int().min(256).max(65536).default(2048),
          /** Instalar y mantener actualizado el plugin propio LiveArena (tótems apilables…). */
          livearenaPlugin: z.boolean().default(true),
          software: z.enum(['paper', 'vanilla']).default('paper'),
          /** Apagar el servidor al cerrar la app. */
          stopOnExit: z.boolean().default(true),
          /** Dar OP a este jugador al primer arranque. */
          pendingOp: z.string().default(''),
        })
        .default({}),
    })
    .default({}),
  activeProfileId: z.string().default('supervivencia'),
  scoreboard: z
    .object({
      wins: z.number().int().default(0),
      losses: z.number().int().default(0),
      lives: z.number().int().default(3),
      livesStart: z.number().int().min(0).default(3),
      /** Al morir: restar vida / sumar derrota / reiniciar cronómetro. */
      onDeath: z.object({ loseLife: z.boolean().default(true), addLoss: z.boolean().default(false), resetTimer: z.boolean().default(false) }).default({}),
    })
    .default({}),
  /** Ajustes de los overlays (los lee cada overlay en vivo). */
  overlays: z
    .object({
      timer: z
        .object({
          mode: z.enum(['up', 'down']).default('up'),
          startSec: z.number().int().min(0).max(359999).default(600),
          onDeath: z.enum(['none', 'reset', 'pause']).default('none'),
          endSound: z.string().max(500).default(''),
          endVolume: z.number().min(0).max(1).default(0.8),
          minimal: z.boolean().default(false),
          /** Reloj extensible (subathon): cada moneda/diamante suma segundos; 0 = desactivado. */
          coinSeconds: z.number().min(0).max(60).default(0),
          maxHours: z.number().int().min(0).max(999).default(0),
          showRule: z.boolean().default(true),
          showProgress: z.boolean().default(true),
          size: z.number().int().min(40).max(400).default(120),
        })
        .default({}),
      score: z.object({ minimal: z.boolean().default(false) }).default({}),
      lives: z.object({ title: z.string().max(30).default('VIDAS'), color: z.string().max(20).default('#ff3d6e'), minimal: z.boolean().default(false) }).default({}),
      best: z.object({ title: z.string().max(40).default('MEJOR REGALO'), color: z.string().max(20).default('#ffb547'), countFullStreak: z.boolean().default(true), minimal: z.boolean().default(false) }).default({}),
      bestLive: z.object({ title: z.string().max(40).default('TOP REGALO DEL LIVE'), color: z.string().max(20).default('#38bdf8'), minimal: z.boolean().default(false) }).default({}),
      streak: z.object({ title: z.string().max(40).default('MEJOR RACHA'), color: z.string().max(20).default('#c084fc') }).default({}),
      giftGoal: z.object({ gift: z.string().max(80).default('Rose'), target: z.number().int().min(1).default(100), title: z.string().max(40).default('META') }).default({}),
      duel: z
        .object({
          a: z.object({ gift: z.string().max(80).default('Rose'), label: z.string().max(30).default('EQUIPO 1') }).default({}),
          b: z.object({ gift: z.string().max(80).default('Finger Heart'), label: z.string().max(30).default('EQUIPO 2') }).default({}),
          target: z.number().int().min(1).default(100),
        })
        .default({}),
      resetSave: z
        .object({
          enabled: z.boolean().default(false),
          resetGift: z.string().max(80).default('GG'),
          saveGift: z.string().max(80).default('Rose'),
          seconds: z.number().int().min(3).max(120).default(10),
          /** Qué hace el reset si nadie lo salva. */
          resetTimer: z.boolean().default(true),
          resetLives: z.boolean().default(false),
          command: z.string().max(500).default(''),
        })
        .default({}),
      featured: z.object({ minCoins: z.number().int().min(1).default(100), seconds: z.number().int().min(2).max(600).default(10) }).default({}),
      goals: z
        .object({
          coins: z.object({ target: z.number().int().min(1).default(5000), label: z.string().max(40).default('META DE MONEDAS') }).default({}),
          combined: z.object({ target: z.number().int().min(1).default(20000), label: z.string().max(40).default('META DEL LIVE') }).default({}),
          followers: z.object({ target: z.number().int().min(1).default(6000), label: z.string().max(40).default('SEGUIDORES') }).default({}),
        })
        .default({}),
      top: z.object({ style: z.enum(['clasico', 'tarjetas', 'barras', 'neon', 'desfile', 'minimo', 'arcade', 'oro']).default('clasico'), n: z.number().int().min(1).max(10).default(10) }).default({}),
      /** Reiniciar regalos y rankings al conectar un live nuevo. */
      resetOnNewLive: z.boolean().default(true),
    })
    .default({}),
  /** Lectura por voz (TTS) de los comentarios del live. */
  tts: z
    .object({
      enabled: z.boolean().default(false),
      voice: z.string().default(''),
      random: z.boolean().default(false),
      template: z.string().max(200).default('{username} dice: {comment}'),
      rate: z.number().min(0.5).max(2).default(1),
      volume: z.number().min(0).max(1).default(0.9),
      mode: z.enum(['all', 'prefix']).default('all'),
      prefix: z.string().max(8).default('!'),
      who: z.object({
        everyone: z.boolean().default(true),
        followers: z.boolean().default(false),
        subscribers: z.boolean().default(false),
        moderators: z.boolean().default(false),
      }).default({}),
      filters: z.object({
        stripEmojis: z.boolean().default(true),
        ignoreTiktokEmojis: z.boolean().default(true),
        ignoredWords: z.array(z.string().max(40)).max(200).default([]),
      }).default({}),
      antispam: z.object({
        noRepeat: z.boolean().default(false),
        turnSeconds: z.number().int().min(0).max(60).default(5),
        maxQueue: z.number().int().min(1).max(200).default(25),
        maxLen: z.number().int().min(20).max(500).default(200),
      }).default({}),
      /** Voz por usuario: clave = usuario de TikTok en minúsculas (o id antiguo), valor = voz (p:, b:, w:). */
      perUser: z.record(z.string(), z.string()).default({}),
      /** Permitir que los espectadores elijan su voz con «!voz <personaje>». */
      viewerChoice: z.boolean().default(false),
      /** Efecto para las voces de Windows (las del navegador no admiten efectos). */
      windowsEffect: z.enum(['none', 'robot', 'eco', 'radio', 'grave', 'agudo']).default('none'),
    })
    .default({}),
  /** Escenas del estudio (editor de capas). */
  scenes: z.array(SceneSchema).default([]),
  /** Mensajes en el chat de Minecraft cuando un espectador activa algo. */
  chat: z
    .object({
      announce: z.boolean().default(true),
      prefix: z.string().max(20).default('LIVE'),
      showGift: z.boolean().default(true),
    })
    .default({}),
  likeGoal: z.object({ target: z.number().int().min(1).default(10000), label: z.string().default('Meta de likes') }).default({}),
  firstRun: z.boolean().default(true),
})
export type AppConfig = z.infer<typeof ConfigSchema>

export class ConfigStore {
  private cfg: AppConfig
  private saveTimer: NodeJS.Timeout | null = null

  constructor() {
    for (const p of [DATA_DIR, paths.profiles, paths.backups, paths.media, paths.plugins]) fs.mkdirSync(p, { recursive: true })
    let raw: unknown = {}
    try {
      raw = JSON.parse(fs.readFileSync(paths.config, 'utf8'))
    } catch {
      /* primera vez */
    }
    const parsed = ConfigSchema.safeParse(raw)
    this.cfg = parsed.success ? parsed.data : ConfigSchema.parse({})
    this.saveNow()
  }

  get(): AppConfig {
    return this.cfg
  }

  /** Clave de Euler: .env manda sobre config. */
  eulerKey(): string | undefined {
    return process.env.EULER_API_KEY || this.cfg.tiktok.signApiKey || undefined
  }

  update(patch: (c: AppConfig) => void): AppConfig {
    patch(this.cfg)
    this.cfg = ConfigSchema.parse(this.cfg)
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.saveNow(), 300)
    return this.cfg
  }

  /** Vista para el panel: sin secretos en claro. */
  publicView(): unknown {
    const c = structuredClone(this.cfg)
    return {
      ...c,
      tiktok: { ...c.tiktok, signApiKey: c.tiktok.signApiKey ? '••••' : '', hasEnvKey: !!process.env.EULER_API_KEY },
      minecraft: { ...c.minecraft, password: c.minecraft.password ? '••••' : '' },
    }
  }

  saveNow(): void {
    const tmp = `${paths.config}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(this.cfg, null, 2), { mode: 0o600 })
    fs.renameSync(tmp, paths.config)
  }

  async flush(): Promise<void> {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveNow()
    await fsp.access(paths.config)
  }
}
