import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'

/** Carpeta de datos del usuario: config, perfiles, copias, media, plugins, estadísticas. */
export const DATA_DIR = process.env.LIVEARENA_DATA ?? path.join(os.homedir(), '.livearena')

export const paths = {
  config: path.join(DATA_DIR, 'config.json'),
  profiles: path.join(DATA_DIR, 'perfiles'),
  backups: path.join(DATA_DIR, 'copias'),
  media: path.join(DATA_DIR, 'media'),
  plugins: path.join(DATA_DIR, 'plugins'),
  db: path.join(DATA_DIR, 'estadisticas.db'),
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
      autoConnect: z.boolean().default(true),
      commandsPerSecond: z.number().min(1).max(100).default(20),
      /** 0 = sin límite. Mobs invocados por LiveArena vivos a la vez. */
      maxLiveMobs: z.number().int().min(0).default(200),
      watchPlayer: z.boolean().default(true),
      server: z
        .object({
          folder: z.string().default(''),
          java: z.string().default(''),
          ramGB: z.number().min(1).max(32).default(3),
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
