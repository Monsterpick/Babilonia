import { CineModService } from './cine-mod.js'
import { TextureService } from './textures.js'
import { TtsService } from './tts.js'
import { ComboTracker, Deduper, PriorityWorker, RuleEngine, renderTemplate, type Job } from '@livearena/core'
import { effect, give, summon, titleCommands } from '@livearena/minecraft'
import { TikTokSource } from '@livearena/source-tiktok'
import { LiveEventSchema, normalizeTikTokUser, safeDisplayText, type ActionMessage, type LiveEvent, type Profile, type RawGift, type Step } from '@livearena/shared'
import { ConfigStore, paths } from './config.js'
import { Hub } from './hub.js'
import { Logger } from './logger.js'
import { MinecraftService } from './minecraft-service.js'
import { ProfileStore } from './profiles.js'
import { StatsStore } from './stats.js'
import { GiftCatalog } from './gifts.js'

export const VERSION = '0.5.0'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Recuerda las últimas N líneas de actividad para el panel. */
export interface ActivityItem {
  id: string
  ts: number
  type: LiveEvent['type']
  user?: { nickname: string; uniqueId: string; avatarUrl?: string }
  text: string
  simulated?: boolean
  fired: string[]
}

/**
 * Orquestador: fuente de LIVE → dedup → combos → motor de reglas → cola de trabajos → ejecutores
 * (Minecraft por RCON, overlays/juego por WebSocket, sonidos).
 */
export class App {
  readonly cfg = new ConfigStore()
  readonly log = new Logger()
  readonly hub = new Hub(VERSION)
  readonly profiles = new ProfileStore()
  readonly stats = new StatsStore(paths.db)
  readonly gifts = new GiftCatalog()
  readonly textures: TextureService
  readonly tts: TtsService
  readonly mc: MinecraftService
  readonly cine: CineModService
  readonly tiktok: TikTokSource
  private readonly dedup = new Deduper(10_000)
  private readonly combos: ComboTracker
  private readonly engine = new RuleEngine()
  private readonly jobs: PriorityWorker<Job>
  private profile!: Profile
  private activity: ActivityItem[] = []
  private paused = false
  /** Hasta cuándo los eventos simulados son «solo overlays» (no ejecutan nada en Minecraft). */
  private simDryUntil = 0
  private timer = { running: false, startedAt: 0, accumulatedMs: 0, ended: false }
  private lastBad: { user: NonNullable<LiveEvent['user']>; gift?: ActionMessage['gift']; actionName: string; color?: string; ts: number } | null = null
  private resetSave: { state: 'waiting' | 'saved' | 'reset'; by: string; avatar?: string; needed: number; saved: number; endsAt: number; clearAt?: number } | null = null

  constructor() {
    this.log.sink = (l) => this.hub.log(l)
    this.mc = new MinecraftService(this.cfg, this.log)
    this.tiktok = new TikTokSource({ signApiKey: this.cfg.eulerKey() })
    this.combos = new ComboTracker({ onGift: (ev) => this.onEvent(ev) })
    this.jobs = new PriorityWorker<Job>((job) => this.runJob(job), {
      maxSize: 5000,
      onDrop: (j) => this.log.warn('cola', `Cola llena: se descartó "${j.action.name}" (prioridad baja)`),
      onError: (err, j) => this.log.error('cola', `Fallo ejecutando "${j.action.name}": ${(err as Error).message}`),
    })

    this.tiktok.on('gift', (g: RawGift) => this.onRawGift(g))
    this.tiktok.on('event', (ev: LiveEvent) => this.onEvent(ev))
    this.tiktok.on('status', (s) => {
      this.hub.setState('source', s)
      if (s.state === 'live' && s.message?.startsWith('Conectado') && this.cfg.get().overlays.resetOnNewLive) this.newSession(s.target)
    })
    this.tiktok.on('log', (l: { level: 'info' | 'warn' | 'error'; msg: string }) => this.log[l.level]('tiktok', l.msg))

    this.mc.on('status', (s) => this.hub.setState('minecraft', s))
    this.tts = new TtsService(this.cfg, this.hub)
    this.cine = new CineModService(this.cfg, this.mc, this.log, () => void this.cine.status().then((st) => this.hub.setState('cinemod', st)))
    this.textures = new TextureService(this.log)
    this.textures.on('status', (s) => this.hub.setState('textures', s))
    this.mc.on('serverLog', (line: string) => this.hub.log({ level: 'info', scope: 'consola', msg: line, ts: Date.now() }))
    this.mc.on('death', () => this.onPlayerDeath())
    this.mc.setKitProvider(() => this.profile?.kit ?? null)
    this.hub.onReport = (kind, data) => this.log.info('juego', `Reporte del juego: ${kind}`, data)
  }

  async init(): Promise<void> {
    await this.profiles.init()
    await this.gifts.init()
    this.hub.setState('scenes', this.cfg.get().scenes)
    this.tts.publishConfig()
    this.hub.setState('ttshistory', this.tts.getHistory())
    this.hub.setState('textures', this.textures.status)
    void this.textures.init(this.cfg.get().minecraft.version).catch(() => undefined)
    const active = this.profiles.get(this.cfg.get().activeProfileId) ?? this.profiles.first()
    this.setProfile(active)
    this.hub.setState('source', this.tiktok.status())
    this.hub.setState('minecraft', this.mc.status())
    this.publishOverlayCfg()
    this.publishStats(true)
    this.publishScoreboard()
    setInterval(() => this.tickOverlays(), 250).unref()
    const c = this.cfg.get()
    if (c.minecraft.autoConnect && c.minecraft.password) this.mc.connect().catch((e) => this.log.warn('minecraft', `Autoconexión: ${e.message}`))
    if (c.tiktok.autoConnect && c.tiktok.username) this.connectTikTok(c.tiktok.username).catch(() => undefined)
  }

  /* ------------------------------- perfiles ------------------------------- */

  get activeProfile(): Profile {
    return this.profile
  }

  setProfile(p: Profile): void {
    this.profile = p
    this.engine.setProfile(p)
    if (this.cfg.get().activeProfileId !== p.id) this.cfg.update((c) => (c.activeProfileId = p.id))
    this.hub.setState('profile', p)
  }

  /* -------------------------------- TikTok -------------------------------- */

  async connectTikTok(username: string): Promise<void> {
    const u = normalizeTikTokUser(username)
    this.cfg.update((c) => (c.tiktok.username = u))
    this.tiktok.configure({ signApiKey: this.cfg.eulerKey() })
    await this.tiktok.connect(u)
  }

  newSession(target: string): void {
    this.stats.startSession(target)
    this.engine.resetSession()
    this.combos.clear()
    this.publishStats(true)
    this.log.info('live', `Nueva sesión de estadísticas${target ? ` para @${target}` : ''}`)
  }

  /* ------------------------------ ingesta ------------------------------ */

  onRawGift(g: RawGift): void {
    this.gifts.learn(g)
    this.combos.receive(g)
  }

  /** Los próximos eventos simulados (durante `ms`) solo afectan a los overlays. */
  simulateDry(ms = 6000): void {
    this.simDryUntil = Date.now() + ms
  }

  onEvent(ev: LiveEvent): void {
    if (!this.dedup.accept(ev.id)) return
    const ok = LiveEventSchema.safeParse(ev)
    if (!ok.success) {
      this.log.warn('ingesta', `Evento descartado (no cumple el esquema): ${ok.error.issues[0]?.message}`)
      return
    }
    if (ev.type === 'room_stats') {
      this.hub.setState('source', { ...this.tiktok.status(), viewers: ev.payload.viewers })
      return
    }
    this.hub.event(ev)
    if (ev.type === 'chat') this.tts.onChat(ev)
    this.onResetSaveGift(ev)
    if (ev.type === 'follow' && ev.user) {
      this.stats.recordFollow(ev.user.id || ev.user.uniqueId)
      this.publishStats(true)
    }
    if (ev.type === 'gift') this.subathonAdd(ev.payload.diamonds * ev.payload.count)
    const changed = this.stats.record(ev)
    if (changed.leaderboard || changed.best) this.publishStats(true)
    else if (changed.likes) this.publishStats(false)

    if ((ev as { simulated?: boolean }).simulated && Date.now() < this.simDryUntil) (ev as { dry?: boolean }).dry = true
    const res = this.paused ? { jobs: [], skipped: [], trimmed: 0 } : this.engine.handle(ev)
    if (res.trimmed) this.log.warn('reglas', `Se recortaron ${res.trimmed} repeticiones (límite por evento)`)
    for (const j of res.jobs) this.jobs.push(j, j.priority)
    this.pushActivity(ev, res.jobs.map((j) => j.action.name))
  }

  private pushActivity(ev: LiveEvent, fired: string[]): void {
    if (ev.type === 'member_join' && fired.length === 0) return
    const text =
      ev.type === 'gift'
        ? `${ev.payload.name} ×${ev.payload.count}${ev.payload.streakTotal > ev.payload.count ? ` (racha ${ev.payload.streakTotal})` : ''}`
        : ev.type === 'like'
          ? `${ev.payload.count} likes`
          : ev.type === 'chat'
            ? ev.payload.text
            : ev.type === 'follow'
              ? 'te sigue'
              : ev.type === 'share'
                ? 'compartió el live'
                : ev.type === 'subscribe'
                  ? 'se suscribió'
                  : ev.type === 'member_join'
                    ? 'entró'
                    : ev.type
    const item: ActivityItem = {
      id: ev.id,
      ts: ev.ts,
      type: ev.type,
      user: ev.user ? { nickname: ev.user.nickname, uniqueId: ev.user.uniqueId, avatarUrl: ev.user.avatarUrl } : undefined,
      text,
      simulated: ev.simulated,
      fired,
    }
    this.activity.push(item)
    if (this.activity.length > 300) this.activity.shift()
  }

  recentActivity(): ActivityItem[] {
    return this.activity.slice(-200)
  }

  /* ------------------------------ ejecución ------------------------------ */

  pauseActions(p: boolean): void {
    this.paused = p
    this.log.info('cola', p ? 'Acciones en pausa' : 'Acciones reanudadas')
  }

  get actionsPaused(): boolean {
    return this.paused
  }

  queueStats() {
    return { jobs: this.jobs.stats(), minecraft: this.mc.link.status().queue }
  }

  clearQueues(): { jobs: number; minecraft: number } {
    return { jobs: this.jobs.clear(), minecraft: this.mc.link.clearQueue() }
  }

  private testEvent(): LiveEvent {
    return {
      v: 1,
      id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'custom',
      source: 'panel',
      user: { id: 'test', uniqueId: 'prueba', nickname: 'Prueba' },
      ts: Date.now(),
      simulated: true,
      payload: {},
    }
  }

  /**
   * Botones ▶ del panel.
   *  - full=true (naranja): como si un espectador de prueba lo activara: tarjeta, aviso, sonido y Minecraft.
   *  - full=false (azul): solo ejecuta la función en Minecraft.
   */
  testAction(actionId: string, opts: { full?: boolean; eventId?: string } = {}): void {
    const action = this.profile.actions.find((a) => a.id === actionId)
    if (!action) throw new Error('Acción no encontrada')
    const real = opts.eventId ? this.profile.events.find((e) => e.id === opts.eventId) : undefined
    const rule = {
      ...(real ?? {
        id: 'manual',
        enabled: true,
        trigger: { type: 'share' as const },
        actionIds: [actionId],
        perUnit: false,
        multiplier: 1,
        maxPerEvent: 1,
        delayMs: 0,
        intervalMs: 0,
        cooldown: { globalMs: 0, perUserMs: 0 },
        who: 'anyone' as const,
        users: [],
      }),
      delayMs: 0,
      sound: opts.full ? real?.sound : undefined,
    }
    // Ambos botones respetan Repeticiones e Intervalo de la fila (el azul solo omite tarjeta, aviso y sonido).
    const reps = real ? Math.min(real.multiplier, real.maxPerEvent) : 1
    const act = opts.full ? action : { ...action, showInOverlay: false }
    this.jobs.push({ jobId: `manual-${Date.now()}`, rule, action: act, event: this.testEvent(), repetitions: reps, priority: 999, intensity: 0.5, playSound: !!opts.full && !!rule.sound }, 999)
  }

  /** Prueba un comando suelto (con las variables rellenadas como si lo enviara «Prueba»). */
  async testCommand(command: string): Promise<{ command: string; response: string }> {
    const cmd = renderTemplate(command.trim().replace(/^\//, ''), { event: this.testEvent(), player: this.cfg.get().minecraft.player, roomLikes: this.engine.totalRoomLikes })
    const response = await this.mc.link.enqueue(cmd, 1000)
    return { command: cmd, response }
  }

  private async runJob(job: Job): Promise<void> {
    const { action, event, rule } = job
    const user = event.user
    const gift = event.type === 'gift' ? event.payload : undefined
    const base: Omit<ActionMessage, 'kind' | 'params'> = {
      user,
      actionId: action.id,
      actionName: action.name,
      color: action.color,
      media: action.media,
      gift: gift ? { name: gift.name, diamonds: gift.diamonds, count: gift.count, imageUrl: gift.imageUrl ?? this.gifts.imageFor(gift.name) } : undefined,
      intensity: job.intensity,
      priority: job.priority,
    }
    // Tarjeta del overlay (una por trabajo, con ×N).
    if (action.showInOverlay) this.hub.action({ ...base, kind: 'overlay.card', params: { count: job.repetitions, alignment: action.alignment, trigger: rule.trigger.type, meta: job.meta } })
    if (job.playSound && rule.sound) this.hub.action({ ...base, kind: 'sound', params: { file: rule.sound.file, volume: rule.sound.volume } })

    // Prueba de overlays: se ven las tarjetas y sonidos, pero no se ejecuta nada en Minecraft.
    if ((event as { dry?: boolean }).dry) return
    const mcCfg = this.cfg.get().minecraft
    const player = mcCfg.player
    if (action.alignment === 'bad' && user) this.lastBad = { user, gift: base.gift, actionName: action.name, color: action.color, ts: Date.now() }
    this.announce(job)
    if (rule.delayMs > 0) await sleep(rule.delayMs)
    for (let i = 0; i < job.repetitions; i++) {
      for (const step of action.steps) await this.runStep(step, job, player, mcCfg.maxLiveMobs)
      if (rule.sound?.every === 'each' && i > 0) this.hub.action({ ...base, kind: 'sound', params: { file: rule.sound.file, volume: rule.sound.volume } })
      if (rule.intervalMs > 0 && i < job.repetitions - 1) await sleep(rule.intervalMs)
    }
  }

  private async runStep(step: Step, job: Job, player: string, maxLiveMobs: number): Promise<void> {
    const ctx = { event: job.event, player, roomLikes: this.engine.totalRoomLikes }
    const mc = (cmd: string) => {
      if (!player && /\{player\}|\{nick\}/.test(cmd)) return
      void this.mc.link.enqueue(cmd, job.priority).catch(() => undefined)
    }
    const needPlayer = () => {
      if (!player) {
        this.log.warn('minecraft', `"${job.action.name}": configura tu nick de Minecraft para poder ejecutarla`)
        return false
      }
      return true
    }
    switch (step.type) {
      case 'minecraft.command': {
        const list = step.mode === 'random' ? [step.commands[Math.floor(Math.random() * step.commands.length)]!] : step.commands
        for (const c of list) mc(renderTemplate(c, ctx))
        break
      }
      case 'minecraft.summon': {
        if (!needPlayer()) return
        if (maxLiveMobs > 0 && this.mc.link.isConnected && (await this.mc.liveMobs()) >= maxLiveMobs) {
          this.log.warn('minecraft', `Límite de ${maxLiveMobs} mobs vivos alcanzado: "${job.action.name}" no invoca más`)
          return
        }
        const name = step.nameTag ? safeDisplayText(job.event.user?.nickname || job.event.user?.uniqueId || '', 24) : undefined
        for (let k = 0; k < step.count; k++) mc(summon(this.mc.version, { player, entity: step.entity, name, radius: step.radius, heightOffset: step.heightOffset }))
        break
      }
      case 'minecraft.give':
        if (needPlayer()) mc(give(this.mc.version, player, step.item, step.count))
        break
      case 'minecraft.effect':
        if (needPlayer()) mc(effect(player, step.effect, step.seconds, step.amplifier))
        break
      case 'minecraft.title':
        if (needPlayer())
          for (const c of titleCommands(player, {
            ...step,
            title: step.title && renderTemplate(step.title, ctx),
            subtitle: step.subtitle && renderTemplate(step.subtitle, ctx),
            actionbar: step.actionbar && renderTemplate(step.actionbar, ctx),
          }))
            mc(c)
        break
      case 'minecraft.kit':
        await this.mc.giveKit(this.profile.kit, 'start').catch((e) => this.log.warn('minecraft', e.message))
        break
      case 'scoreboard':
        this.addScore(step.key, step.delta)
        break
      case 'timer':
        this.timerOp(step.op, step.seconds)
        break
      case 'overlay.alert':
        this.hub.action({
          kind: 'overlay.alert',
          params: { text: step.text ? renderTemplate(step.text, ctx) : job.action.name, durationMs: step.durationMs },
          user: job.event.user,
          actionId: job.action.id,
          actionName: job.action.name,
          color: job.action.color,
          media: job.action.media,
          intensity: job.intensity,
          priority: job.priority,
        })
        break
      case 'sound':
        this.hub.action({ kind: 'sound', params: { file: step.file, volume: step.volume }, user: job.event.user, intensity: job.intensity, priority: job.priority })
        break
      case 'wait':
        await sleep(step.ms)
        break
      case 'game':
        this.hub.action({ kind: `game.${step.kind}`, params: step.params, user: job.event.user, actionId: job.action.id, intensity: job.intensity, priority: job.priority })
        break
    }
  }

  /** Mensaje en el chat de Minecraft: «[LIVE] Ana → TRUENO (Rose ×5)». */
  private announce(job: Job): void {
    const chat = this.cfg.get().chat
    if (!chat.announce || !this.mc.link.isConnected || job.event.source === 'panel') return
    const name = safeDisplayText(job.event.user?.nickname ?? 'Alguien', 32)
    const g = job.event.type === 'gift' ? job.event.payload : null
    const parts: object[] = [
      { text: `[${safeDisplayText(chat.prefix, 20) || 'LIVE'}] `, color: 'light_purple', bold: true },
      { text: name, color: 'yellow' },
      { text: ' → ', color: 'gray' },
      { text: safeDisplayText(job.action.name, 40), color: 'aqua', bold: true },
    ]
    if (chat.showGift && g) parts.push({ text: ` (${safeDisplayText(g.name, 30)} ×${g.count})`, color: 'gold' })
    void this.mc.link.enqueue(`tellraw @a ${JSON.stringify(['', ...parts])}`, job.priority).catch(() => undefined)
  }

  /* ------------------------ marcador y cronómetro ------------------------ */

  addScore(key: 'wins' | 'losses' | 'lives', delta: number): void {
    this.cfg.update((c) => {
      c.scoreboard[key] = Math.max(0, c.scoreboard[key] + delta)
    })
    this.publishScoreboard()
  }

  setScore(values: Partial<Record<'wins' | 'losses' | 'lives' | 'livesStart', number>>): void {
    this.cfg.update((c) => Object.assign(c.scoreboard, values))
    this.publishScoreboard()
  }

  timerOp(op: 'start' | 'pause' | 'reset' | 'add', seconds = 0): void {
    const t = this.timer
    if (op === 'start' && !t.running) {
      t.running = true
      t.startedAt = Date.now()
    } else if (op === 'pause' && t.running) {
      t.accumulatedMs += Date.now() - t.startedAt
      t.running = false
    } else if (op === 'reset') {
      t.accumulatedMs = 0
      t.startedAt = Date.now()
      t.ended = false
    } else if (op === 'add') t.accumulatedMs += this.cfg.get().overlays.timer.mode === 'down' ? -seconds * 1000 : seconds * 1000
    this.publishScoreboard()
  }

  /** Reloj extensible: suma segundos al cronómetro según las monedas recibidas. */
  private subathonAdd(coins: number): void {
    const tc = this.cfg.get().overlays.timer
    if (!tc.coinSeconds || coins <= 0) return
    const addSec = coins * tc.coinSeconds
    const maxMs = tc.maxHours > 0 ? tc.maxHours * 3600_000 : Infinity
    this.timer.ended = false
    if (!this.timer.running) {
      this.timer.running = true
      this.timer.startedAt = Date.now()
    }
    this.timer.accumulatedMs = Math.min(maxMs, this.timerElapsed() + addSec * 1000) - (Date.now() - this.timer.startedAt)
    this.publishScoreboard()
  }

  private onPlayerDeath(): void {
    const od = this.cfg.get().scoreboard.onDeath
    this.log.info('minecraft', 'El jugador murió')
    if (od.loseLife) this.addScore('lives', -1)
    if (od.addLoss) this.addScore('losses', 1)
    if (od.resetTimer) this.timerOp('reset')
    const td = this.cfg.get().overlays.timer.onDeath
    if (td === 'reset') this.timerOp('reset')
    else if (td === 'pause') this.timerOp('pause')
    // «¡Te mató!»: el último espectador que mandó algo malo en los últimos 2 minutos.
    const k = this.lastBad
    if (k && Date.now() - k.ts < 120_000) {
      this.hub.action({ kind: 'overlay.killed', user: k.user, gift: k.gift, actionName: k.actionName, color: k.color, params: {}, intensity: 1, priority: 900 })
      this.log.info('minecraft', `Te mató ${k.user.nickname} (${k.actionName})`)
    }
  }

  publishOverlayCfg(): void {
    const o = this.cfg.get().overlays
    this.stats.countFullStreak = o.best.countFullStreak
    this.hub.setState('overlaycfg', o)
  }

  private timerElapsed(): number {
    const t = this.timer
    return t.accumulatedMs + (t.running ? Date.now() - t.startedAt : 0)
  }

  /** Cuenta atrás que llega a 0 y la ventana de «Reset o salvar». */
  private tickOverlays(): void {
    const o = this.cfg.get().overlays
    if (o.timer.mode === 'down' && this.timer.running && !this.timer.ended && this.timerElapsed() >= o.timer.startSec * 1000) {
      this.timer.accumulatedMs = o.timer.startSec * 1000
      this.timer.running = false
      this.timer.ended = true
      if (o.timer.endSound) this.hub.action({ kind: 'sound', params: { file: o.timer.endSound, volume: o.timer.endVolume }, user: null, intensity: 1, priority: 900 })
      this.log.info('live', 'La cuenta atrás llegó a 0')
      this.publishScoreboard()
    }
    const r = this.resetSave
    if (!r) return
    if (r.state === 'waiting' && Date.now() >= r.endsAt) {
      r.state = 'reset'
      r.clearAt = Date.now() + 5000
      this.executeReset()
      this.hub.setState('resetsave', r)
    } else if (r.clearAt && Date.now() >= r.clearAt) {
      this.resetSave = null
      this.hub.setState('resetsave', null)
    }
  }

  private executeReset(): void {
    const rs = this.cfg.get().overlays.resetSave
    if (rs.resetTimer) this.timerOp('reset')
    if (rs.resetLives) this.setScore({ lives: this.cfg.get().scoreboard.livesStart })
    if (rs.command.trim()) {
      const cmd = renderTemplate(rs.command.trim().replace(/^\//, ''), { event: this.testEvent(), player: this.cfg.get().minecraft.player, roomLikes: this.engine.totalRoomLikes })
      void this.mc.link.enqueue(cmd, 900).catch(() => undefined)
    }
    this.log.info('live', '¡RESET! Nadie lo salvó a tiempo')
  }

  /** Regalo de «reset» abre una ventana; si llegan tantos regalos de «salvar» como los del reset, se salva. */
  private onResetSaveGift(ev: LiveEvent): void {
    if (ev.type !== 'gift' || !ev.user) return
    const rs = this.cfg.get().overlays.resetSave
    if (!rs.enabled) return
    const name = ev.payload.name.toLowerCase()
    const r = this.resetSave
    if (name === rs.resetGift.toLowerCase()) {
      if (r && r.state === 'waiting') r.needed += ev.payload.count
      else this.resetSave = { state: 'waiting', by: ev.user.nickname, avatar: ev.user.avatarUrl, needed: ev.payload.count, saved: 0, endsAt: Date.now() + rs.seconds * 1000 }
      this.hub.setState('resetsave', this.resetSave)
    } else if (name === rs.saveGift.toLowerCase() && r && r.state === 'waiting') {
      r.saved += ev.payload.count
      if (r.saved >= r.needed) {
        r.state = 'saved'
        r.clearAt = Date.now() + 5000
        this.log.info('live', `¡Salvado! (${r.saved}/${r.needed})`)
      }
      this.hub.setState('resetsave', r)
    }
  }

  publishScoreboard(): void {
    const s = this.cfg.get().scoreboard
    const tc = this.cfg.get().overlays.timer
    this.hub.setState('scoreboard', { wins: s.wins, losses: s.losses, lives: s.lives, livesStart: s.livesStart, timer: { ...this.timer, now: Date.now(), mode: tc.mode, durationMs: tc.startSec * 1000 } })
  }

  /* ----------------------------- estadísticas ----------------------------- */

  publishStatsNow(): void {
    this.publishStats(true)
  }

  private lastLikesPublish = 0
  private publishStats(full: boolean): void {
    const now = Date.now()
    if (!full && now - this.lastLikesPublish < 250) return // likes: como mucho 4 veces/s
    this.lastLikesPublish = now
    const s = this.stats.summary()
    const goal = this.cfg.get().likeGoal
    this.hub.setState('likes', { roomLikes: s.roomLikes, goal: goal.target, label: goal.label })
    if (full) this.hub.setState('leaderboard', { donors: this.stats.topDonors(10), likers: this.stats.topLikers(10), summary: s })
  }

  async shutdown(): Promise<void> {
    await this.tiktok.disconnect().catch(() => undefined)
    if (this.cfg.get().minecraft.server.stopOnExit) await this.mc.stop().catch(() => undefined)
    this.mc.disconnect()
    this.stats.close()
    await this.cfg.flush()
  }
}
