/**
 * Conector de TikTok LIVE.
 *
 * ⚠️ Usa `tiktok-live-connector`, una API NO OFICIAL basada en ingeniería inversa. La firma del
 * WebSocket la hace Euler Stream (API key opcional; sin ella el límite gratuito es muy bajo).
 * Puede romperse cuando TikTok cambie su sistema: por eso es el ÚNICO paquete que importa la
 * librería. El resto de la app solo ve `LiveEvent` / `RawGift`.
 */
import { EventEmitter } from 'node:events'
import { parseCommand, safeDisplayText, type LiveEvent, type LiveUser, type RawGift, type SourceStatus } from '@livearena/shared'

export interface LiveSource extends EventEmitter {
  readonly id: string
  connect(target: string): Promise<void>
  disconnect(): Promise<void>
  status(): SourceStatus
  on(e: 'event', cb: (ev: LiveEvent) => void): this
  on(e: 'gift', cb: (g: RawGift) => void): this
  on(e: 'status', cb: (s: SourceStatus) => void): this
  on(e: 'log', cb: (l: { level: 'info' | 'warn' | 'error'; msg: string }) => void): this
}

export interface TikTokSourceOptions {
  signApiKey?: string
  sessionId?: string
  maxRetries?: number
  /** Espera entre comprobaciones cuando el usuario no está en directo. */
  offlineRetryMs?: number
  /** Sin datos durante este tiempo = conexión sospechosa (se verifica). */
  heartbeatMs?: number
}

type AnyData = Record<string, any>

const int = (v: unknown, d = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : d
}

/* ---------------------------- normalización ---------------------------- */

export function userOf(data: AnyData): LiveUser {
  const u: AnyData = data?.user ?? {}
  const handle = String(u.uniqueId || u.displayId || '').trim()
  const pics: unknown = u.profilePicture?.url ?? u.profilePicture?.urls ?? u.avatarThumb?.urlList ?? u.profilePictureUrl
  const avatar = Array.isArray(pics) ? pics.find((x) => typeof x === 'string' && /^https?:/.test(x)) : typeof pics === 'string' ? pics : undefined
  const follow = u.followInfo?.followStatus ?? data?.followInfo?.followStatus
  return {
    id: String(u.userId ?? u.id ?? handle ?? ''),
    uniqueId: handle || String(u.nickname ?? 'anon'),
    nickname: safeDisplayText(u.nickname || handle || 'Anónimo', 40),
    avatarUrl: avatar,
    isFollower: follow !== undefined ? int(follow) >= 1 : undefined,
    isModerator: u.userAttr?.isAdmin ?? u.isModerator ?? undefined,
    isSubscriber: u.isSubscriber ?? (Array.isArray(u.badges) ? u.badges.some((b: AnyData) => /subscriber/i.test(JSON.stringify(b))) : undefined),
  }
}

export const msgIdOf = (data: AnyData): string | null => {
  const id = data?.common?.msgId ?? data?.msgId
  return id === undefined || id === null || id === '' ? null : String(id)
}

export function rawGiftOf(data: AnyData): RawGift {
  const g: AnyData = data?.gift ?? {}
  const det: AnyData = data?.giftDetails ?? {}
  const ext: AnyData = data?.extendedGiftInfo ?? {}
  const image = g.image?.url?.[0] ?? g.icon?.url?.[0] ?? det.giftImage?.giftPictureUrl ?? ext.image?.url_list?.[0]
  const type = int(g.type ?? det.giftType ?? ext.type, 0)
  return {
    msgId: msgIdOf(data),
    user: userOf(data),
    giftId: int(data?.giftId ?? g.id, 0),
    name: safeDisplayText(g.name || det.giftName || ext.name || 'Regalo', 48),
    imageUrl: typeof image === 'string' ? image : undefined,
    diamonds: Math.max(0, int(g.diamondCount ?? det.diamondCount ?? ext.diamond_count, 0)),
    repeatCount: Math.max(1, int(data?.repeatCount, 1)),
    repeatEnd: data?.repeatEnd === true || int(data?.repeatEnd) === 1,
    streakable: type === 1 || g.combo === true,
    groupId: String(data?.groupId ?? ''),
  }
}

let localSeq = 0
const mkId = (prefix: string, data: AnyData) => msgIdOf(data) ?? `${prefix}-${Date.now().toString(36)}-${(localSeq++).toString(36)}`

/* ---------------------------- fuente TikTok ---------------------------- */

export class TikTokSource extends EventEmitter implements LiveSource {
  readonly id = 'tiktok'
  private conn: AnyData | null = null
  private lib: AnyData | null = null
  private target = ''
  private st: SourceStatus = { state: 'idle', target: '' }
  private wanted = false
  private attempts = 0
  private retryTimer: NodeJS.Timeout | null = null
  private heartbeat: NodeJS.Timeout | null = null
  private lastData = 0
  private readonly opts: Required<Omit<TikTokSourceOptions, 'signApiKey' | 'sessionId'>> & TikTokSourceOptions

  constructor(opts: TikTokSourceOptions = {}) {
    super()
    this.opts = { maxRetries: 8, offlineRetryMs: 30_000, heartbeatMs: 45_000, ...opts }
  }

  configure(opts: Partial<TikTokSourceOptions>): void {
    Object.assign(this.opts, opts)
  }

  status(): SourceStatus {
    return this.st
  }

  async connect(target: string): Promise<void> {
    this.target = target.replace(/^@/, '').trim()
    if (!this.target) throw new Error('Escribe tu usuario de TikTok.')
    this.wanted = true
    this.attempts = 0
    await this.open()
  }

  async disconnect(): Promise<void> {
    this.wanted = false
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.stopHeartbeat()
    await this.release()
    this.set({ state: 'idle', target: this.target, message: 'Desconectado' })
  }

  private set(s: SourceStatus): void {
    this.st = s
    this.emit('status', s)
  }

  private log(level: 'info' | 'warn' | 'error', msg: string): void {
    this.emit('log', { level, msg })
  }

  private async release(): Promise<void> {
    const c = this.conn
    this.conn = null
    if (!c) return
    c.removeAllListeners?.()
    c.on?.('error', () => undefined) // un error tardío no debe tumbar el proceso
    await Promise.resolve(c.disconnect?.()).catch(() => undefined)
  }

  private async open(): Promise<void> {
    if (this.retryTimer) clearTimeout(this.retryTimer)
    await this.release()
    this.set({ state: 'connecting', target: this.target, message: `Conectando con @${this.target}…` })
    this.lib ??= (await import('tiktok-live-connector')) as AnyData
    const { TikTokLiveConnection, WebcastEvent, ControlEvent } = this.lib
    const options: AnyData = { processInitialData: false, enableExtendedGiftInfo: true, fetchRoomInfoOnConnect: true }
    if (this.opts.signApiKey) options.signApiKey = this.opts.signApiKey
    if (this.opts.sessionId) options.session = { cookie: { sessionId: this.opts.sessionId } }
    const conn: AnyData = new TikTokLiveConnection(this.target, options)
    this.conn = conn
    this.wire(conn, WebcastEvent, ControlEvent)
    try {
      const state: AnyData = await conn.connect()
      this.attempts = 0
      this.lastData = Date.now()
      this.startHeartbeat()
      this.set({ state: 'live', target: this.target, roomId: String(state?.roomId ?? ''), message: `Conectado al live de @${this.target}` })
      this.log('info', `Conectado a @${this.target} (sala ${state?.roomId ?? '?'})`)
    } catch (err) {
      this.onFailure(err)
    }
  }

  private wire(c: AnyData, W: AnyData, C: AnyData): void {
    const touch = () => (this.lastData = Date.now())
    const emitEv = (ev: LiveEvent) => {
      touch()
      this.emit('event', ev)
    }
    const base = (data: AnyData, prefix: string) => ({ v: 1 as const, id: mkId(prefix, data), source: 'tiktok', user: userOf(data), ts: Date.now() })

    c.on(W.GIFT, (d: AnyData) => {
      touch()
      this.emit('gift', rawGiftOf(d))
    })
    c.on(W.LIKE, (d: AnyData) =>
      emitEv({ ...base(d, 'like'), type: 'like', payload: { count: Math.max(0, int(d.likeCount ?? d.count, 0)), totalRoomLikes: int(d.totalLikeCount ?? d.total, 0) || undefined } }),
    )
    c.on(W.CHAT, (d: AnyData) => {
      const text = String(d.comment ?? d.content ?? '').slice(0, 300)
      emitEv({ ...base(d, 'chat'), type: 'chat', payload: { text, command: parseCommand(text) } })
    })
    c.on(W.FOLLOW, (d: AnyData) => emitEv({ ...base(d, 'follow'), type: 'follow', payload: {} }))
    c.on(W.SHARE, (d: AnyData) => emitEv({ ...base(d, 'share'), type: 'share', payload: {} }))
    if (W.SUBSCRIBE) c.on(W.SUBSCRIBE, (d: AnyData) => emitEv({ ...base(d, 'sub'), type: 'subscribe', payload: { months: int(d.subMonth, 0) || undefined } }))
    c.on(W.MEMBER, (d: AnyData) => emitEv({ ...base(d, 'join'), type: 'member_join', payload: {} }))
    c.on(W.ROOM_USER, (d: AnyData) => {
      touch()
      const viewers = int(d.viewerCount ?? d.totalUser, 0)
      this.st = { ...this.st, viewers }
      this.emit('status', this.st)
      this.emit('event', { v: 1, id: mkId('stats', d), type: 'room_stats', source: 'tiktok', user: null, ts: Date.now(), payload: { viewers } })
    })
    c.on(W.STREAM_END, () => {
      this.log('warn', `El live de @${this.target} terminó`)
      this.emit('event', { v: 1, id: mkId('end', {}), type: 'live_end', source: 'tiktok', user: null, ts: Date.now(), payload: {} })
      this.stopHeartbeat()
      void this.release()
      this.set({ state: 'offline', target: this.target, message: 'El live terminó. Esperando a que vuelvas a estar en directo…' })
      this.scheduleRetry(this.opts.offlineRetryMs, false)
    })
    c.on(C.DISCONNECTED, () => {
      if (!this.wanted || this.st.state !== 'live') return
      this.log('warn', 'TikTok cerró la conexión; reconectando…')
      this.stopHeartbeat()
      this.scheduleRetry()
    })
    c.on(C.ERROR, (err: unknown) => this.log('warn', `Error del conector: ${describe(err)}`))
  }

  private onFailure(err: unknown): void {
    const L = this.lib ?? {}
    const ex: AnyData = (err as AnyData)?.exception ?? err
    if (L.UserOfflineError && ex instanceof L.UserOfflineError) {
      this.set({ state: 'offline', target: this.target, message: `@${this.target} no está en directo. Reintento en ${this.opts.offlineRetryMs / 1000} s.` })
      return this.scheduleRetry(this.opts.offlineRetryMs, false)
    }
    if (L.InvalidUniqueIdError && ex instanceof L.InvalidUniqueIdError) {
      this.wanted = false
      return this.set({ state: 'error', target: this.target, message: `El usuario @${this.target} no existe.` })
    }
    if (L.SignatureRateLimitError && ex instanceof L.SignatureRateLimitError) {
      const ms = int(ex.retryAfter, 0) || 60_000
      this.log('warn', 'Límite del servicio de firma (Euler Stream). Con una API key propia sube el límite.')
      return this.scheduleRetry(ms, true, 'Límite de Euler Stream alcanzado')
    }
    this.log('error', `No se pudo conectar: ${describe(err)}`)
    this.scheduleRetry(undefined, true, describe(err))
  }

  /** Backoff exponencial con jitter: 2 s, 4 s, 8 s … máx 60 s. */
  private scheduleRetry(ms?: number, countsAsAttempt = true, reason?: string): void {
    if (!this.wanted) return
    if (countsAsAttempt) {
      if (this.attempts >= this.opts.maxRetries) {
        this.wanted = false
        return this.set({ state: 'error', target: this.target, message: `No se pudo conectar tras ${this.attempts} intentos. ${reason ?? ''}`.trim() })
      }
      this.attempts += 1
    }
    const wait = ms ?? Math.min(60_000, 2000 * 2 ** (this.attempts - 1)) + Math.floor(Math.random() * 500)
    if (countsAsAttempt) this.set({ state: 'backoff', target: this.target, retryInMs: wait, message: `${reason ? `${reason}. ` : ''}Reintento ${this.attempts}/${this.opts.maxRetries} en ${Math.ceil(wait / 1000)} s` })
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = setTimeout(() => void this.open(), wait)
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeat = setInterval(() => {
      if (Date.now() - this.lastData > this.opts.heartbeatMs && this.st.state === 'live') {
        this.log('warn', `Sin datos de TikTok en ${this.opts.heartbeatMs / 1000} s: verificando conexión…`)
        this.lastData = Date.now()
        this.stopHeartbeat()
        this.scheduleRetry(500, false)
      }
    }, 5000)
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat)
    this.heartbeat = null
  }

  /** Catálogo de regalos de la sala (nombre, id, diamantes, imagen). Requiere estar conectado. */
  async fetchGiftCatalog(): Promise<{ id: number; name: string; diamonds: number; imageUrl?: string }[]> {
    if (!this.conn) return []
    const raw: AnyData = (await this.conn.fetchAvailableGifts?.()) ?? this.conn.availableGifts
    const list: AnyData[] = Array.isArray(raw) ? raw : raw?.gifts ?? []
    return list.map((g) => ({ id: int(g.id), name: String(g.name ?? ''), diamonds: int(g.diamond_count ?? g.diamondCount), imageUrl: g.image?.url_list?.[0] ?? g.image?.url?.[0] }))
  }
}

function describe(err: unknown): string {
  const e = err as AnyData
  const ex = e?.exception ?? e
  // «no se encontró el live»: la librería prueba 3 vías y solo dice «all sources»; se explica cuál falló
  const subs: AnyData[] = ex?.config?.requestErrs ?? ex?.requestErrs ?? ex?.errors ?? []
  const text = subs.map((s) => String(s?.message ?? s)).join(' | ')
  if (/Room ID/i.test(String(ex?.message)) || subs.length) {
    const euler = /lack of permission/i.test(text) ? ' Euler Stream (la vía de respaldo) pide una API key: ponla en Ajustes → TikTok.' : ''
    const tiktok = /\b(403|405|429|captcha)\b/i.test(text) ? ' TikTok está bloqueando la consulta desde este PC.' : ''
    return `No se encontró tu live en TikTok.${tiktok}${euler}`.replace(/\.$/, '').slice(0, 300)
  }
  return String(ex?.message ?? e ?? 'error desconocido').slice(0, 300)
}
