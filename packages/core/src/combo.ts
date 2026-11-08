import type { GiftPayload, LiveEventOf, RawGift } from '@livearena/shared'

/**
 * DECISIÓN: procesamiento INCREMENTAL de rachas de regalos.
 *
 * TikTok manda un evento por cada toque de una racha con `repeatCount` acumulado y, en teoría,
 * uno final con `repeatEnd`. Esperar al final añade segundos de latencia y algunos regalos
 * nunca mandan `repeatEnd`. Por eso:
 *  - Cada evento entrega SOLO lo nuevo: count = repeatCount − yaEntregado (latencia mínima).
 *  - La racha se cierra con `repeatEnd` o por inactividad (timeoutMs); el cierre solo entrega
 *    lo que faltara.
 *  - Una racha cerrada se recuerda `lateMs`: si llega más de la misma racha (ecos, repeatEnd
 *    tardío) solo se entrega lo nuevo, nunca se repite lo ya entregado.
 *  - Clave = usuario + regalo + groupId. Si TikTok no manda groupId y llega un repeatCount
 *    menor que lo entregado (pasado `echoMs`), se trata como una racha nueva.
 *  - Eventos fuera de orden: manda el repeatCount más alto visto.
 */
export interface ComboTrackerOptions {
  onGift: (ev: LiveEventOf<'gift'>) => void
  source?: string
  timeoutMs?: number
  echoMs?: number
  lateMs?: number
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (t: unknown) => void
}

interface OpenStreak {
  delivered: number
  last: RawGift
  timer: unknown
}

const MAX_REMEMBERED = 2000

export type ComboResult = 'single' | 'streak' | 'end' | 'duplicate' | 'already-closed' | 'nothing-new'

export class ComboTracker {
  private readonly open = new Map<string, OpenStreak>()
  private readonly closed = new Map<string, { at: number; delivered: number }>()
  private readonly seenMsg = new Set<string>()
  private readonly opts: Required<Omit<ComboTrackerOptions, 'onGift'>> & Pick<ComboTrackerOptions, 'onGift'>
  private seq = 0

  constructor(opts: ComboTrackerOptions) {
    this.opts = {
      source: 'tiktok',
      timeoutMs: 10_000,
      echoMs: 1_500,
      lateMs: 60_000,
      now: Date.now,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (t) => clearTimeout(t as NodeJS.Timeout),
      ...opts,
    }
  }

  static keyOf(g: RawGift): string {
    return `${g.user.id || g.user.uniqueId}:${g.giftId}:${g.groupId}`
  }

  receive(g: RawGift): ComboResult {
    if (g.msgId) {
      if (this.seenMsg.has(g.msgId)) return 'duplicate'
      this.seenMsg.add(g.msgId)
      if (this.seenMsg.size > MAX_REMEMBERED) this.seenMsg.delete(this.seenMsg.values().next().value!)
    }
    const total = Math.max(1, Math.trunc(g.repeatCount) || 1)

    if (!g.streakable) {
      this.emit(g, total, total, 'single')
      return 'single'
    }

    const key = ComboTracker.keyOf(g)
    const now = this.opts.now()
    const wasClosed = this.closed.get(key)
    let delivered = 0
    if (wasClosed) {
      const ago = now - wasClosed.at
      if (ago < this.opts.lateMs && total > wasClosed.delivered) {
        // Más de la misma racha tras cerrarla: continúa desde lo ya entregado.
        this.closed.delete(key)
        delivered = wasClosed.delivered
      } else if (g.repeatEnd && ago < this.opts.lateMs) {
        return 'already-closed'
      } else if (ago < this.opts.echoMs) {
        return 'already-closed'
      } else {
        this.closed.delete(key) // racha nueva de la misma persona y regalo
      }
    }

    const prev = this.open.get(key)
    if (prev) delivered = prev.delivered
    const best: RawGift = prev && prev.last.repeatCount > total ? { ...g, repeatCount: prev.last.repeatCount } : { ...g, repeatCount: total }

    if (g.repeatEnd) {
      this.close(key, best, 'streak_end', delivered)
      return 'end'
    }

    if (prev) this.opts.clearTimer(prev.timer)
    const entry: OpenStreak = {
      delivered,
      last: best,
      timer: this.opts.setTimer(() => {
        const cur = this.open.get(key)
        if (cur) this.close(key, cur.last, 'streak_timeout', cur.delivered)
      }, this.opts.timeoutMs),
    }
    this.open.set(key, entry)
    const n = best.repeatCount - entry.delivered
    if (n < 1) return 'nothing-new'
    entry.delivered = best.repeatCount
    this.emit(best, n, best.repeatCount, 'streak')
    return 'streak'
  }

  private close(key: string, g: RawGift, phase: GiftPayload['phase'], delivered: number): void {
    const prev = this.open.get(key)
    if (prev) this.opts.clearTimer(prev.timer)
    this.open.delete(key)
    const n = g.repeatCount - delivered
    if (n > 0) this.emit(g, n, g.repeatCount, phase)
    this.closed.set(key, { at: this.opts.now(), delivered: Math.max(delivered, g.repeatCount) })
    if (this.closed.size > MAX_REMEMBERED) this.closed.delete(this.closed.keys().next().value!)
  }

  private emit(g: RawGift, count: number, streakTotal: number, phase: GiftPayload['phase']): void {
    this.seq += 1
    this.opts.onGift({
      v: 1,
      id: `${g.msgId ?? 'gift'}:${phase}:${streakTotal}:${this.seq}`,
      type: 'gift',
      source: this.opts.source,
      user: g.user,
      ts: this.opts.now(),
      payload: {
        giftId: g.giftId,
        name: g.name,
        imageUrl: g.imageUrl,
        diamonds: g.diamonds,
        count,
        streakTotal,
        streakId: `${g.user.id || g.user.uniqueId}:${g.giftId}:${g.groupId}`,
        phase,
      },
    })
  }

  get openStreaks(): number {
    return this.open.size
  }

  clear(): void {
    for (const s of this.open.values()) this.opts.clearTimer(s.timer)
    this.open.clear()
    this.closed.clear()
    this.seenMsg.clear()
  }
}
