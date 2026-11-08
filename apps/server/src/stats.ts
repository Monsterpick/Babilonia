import type { DatabaseSync } from 'node:sqlite'
import type { LiveEvent, LiveUser } from '@livearena/shared'

export interface UserTotals {
  userId: string
  uniqueId: string
  nickname: string
  avatarUrl?: string
  diamonds: number
  gifts: number
  likes: number
}

export interface BestGift {
  user: Pick<LiveUser, 'uniqueId' | 'nickname' | 'avatarUrl'>
  gift: string
  diamonds: number
  count: number
  value: number
  imageUrl?: string
  ts: number
}

/**
 * Estadísticas del live (ranking de donadores, likes, mejor regalo) con SQLite.
 * En memoria para responder rápido; se escribe a disco en lotes cada segundo
 * (aguanta ráfagas de cientos de eventos por segundo).
 */
export class StatsStore {
  private db: DatabaseSync
  private sessionId = 0
  private totals = new Map<string, UserTotals>()
  private dirty = new Set<string>()
  private giftLog: [number, number, string, string, number, number][] = []
  private roomLikes = 0
  private bestLive: BestGift | null = null
  private bestEver: BestGift | null = null
  private bestStreak: BestGift | null = null
  private giftCounts = new Map<string, number>()
  /** «Contar la racha completa»: 50 rosas seguidas valen 50 (si no, cuenta cada envío suelto). */
  countFullStreak = true
  private timer: NodeJS.Timeout

  constructor(file: string) {
    // Carga perezosa: así el filtro de avisos (quiet-warnings) ya está activo.
    const { DatabaseSync: DB } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite')
    this.db = new DB(file)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, target TEXT, started_at INTEGER, ended_at INTEGER);
      CREATE TABLE IF NOT EXISTS user_totals (
        session_id INTEGER, user_id TEXT, unique_id TEXT, nickname TEXT, avatar TEXT,
        diamonds INTEGER DEFAULT 0, gifts INTEGER DEFAULT 0, likes INTEGER DEFAULT 0,
        PRIMARY KEY (session_id, user_id));
      CREATE TABLE IF NOT EXISTS gift_log (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER, ts INTEGER, user_id TEXT, gift TEXT, diamonds INTEGER, count INTEGER);
      CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
    `)
    const best = this.db.prepare(`SELECT v FROM kv WHERE k='best_ever'`).get() as { v: string } | undefined
    if (best) this.bestEver = JSON.parse(best.v)
    this.startSession('')
    this.timer = setInterval(() => this.flush(), 1000)
    this.timer.unref()
  }

  startSession(target: string): void {
    this.flush()
    if (this.sessionId) this.db.prepare('UPDATE sessions SET ended_at=? WHERE id=?').run(Date.now(), this.sessionId)
    this.sessionId = Number(this.db.prepare('INSERT INTO sessions (target, started_at) VALUES (?, ?)').run(target, Date.now()).lastInsertRowid)
    this.totals.clear()
    this.roomLikes = 0
    this.bestLive = null
    this.bestStreak = null
    this.giftCounts.clear()
  }

  resetBest(which: 'ever' | 'live' | 'streak' | 'goals'): void {
    if (which === 'ever') {
      this.bestEver = null
      this.db.prepare(`DELETE FROM kv WHERE k='best_ever'`).run()
    } else if (which === 'live') this.bestLive = null
    else if (which === 'streak') this.bestStreak = null
    else this.giftCounts.clear()
  }

  /** Devuelve qué cambió (para publicar solo lo necesario). */
  record(ev: LiveEvent): { leaderboard: boolean; likes: boolean; best: boolean } {
    const out = { leaderboard: false, likes: false, best: false }
    if (ev.type === 'like') {
      this.roomLikes += ev.payload.count
      out.likes = true
    }
    if (!ev.user || (ev.type !== 'gift' && ev.type !== 'like')) return out
    const u = ev.user
    const key = u.id || u.uniqueId
    const t = this.totals.get(key) ?? { userId: key, uniqueId: u.uniqueId, nickname: u.nickname, avatarUrl: u.avatarUrl, diamonds: 0, gifts: 0, likes: 0 }
    t.nickname = u.nickname
    t.avatarUrl = u.avatarUrl ?? t.avatarUrl
    if (ev.type === 'like') t.likes += ev.payload.count
    else {
      const g = ev.payload
      t.diamonds += g.diamonds * g.count
      t.gifts += g.count
      this.giftLog.push([this.sessionId, ev.ts, key, g.name, g.diamonds, g.count])
      out.leaderboard = true
      this.giftCounts.set(g.name, (this.giftCounts.get(g.name) ?? 0) + g.count)
      // Mejor regalo = mayor valor (de la racha completa o de cada envío). Con el mismo valor, gana el último.
      const count = this.countFullStreak ? g.streakTotal : g.count
      const value = g.diamonds * count
      const cand: BestGift = { user: { uniqueId: u.uniqueId, nickname: u.nickname, avatarUrl: u.avatarUrl }, gift: g.name, diamonds: g.diamonds, count, value, imageUrl: g.imageUrl, ts: ev.ts }
      if (!this.bestStreak || g.streakTotal >= this.bestStreak.count) {
        this.bestStreak = { ...cand, count: g.streakTotal, value: g.diamonds * g.streakTotal }
        out.best = true
      }
      if (!this.bestLive || value >= this.bestLive.value) {
        this.bestLive = cand
        out.best = true
      }
      if (!this.bestEver || value >= this.bestEver.value) {
        this.bestEver = cand
        this.db.prepare(`INSERT INTO kv (k, v) VALUES ('best_ever', ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).run(JSON.stringify(cand))
        out.best = true
      }
    }
    this.totals.set(key, t)
    this.dirty.add(key)
    return out
  }

  topDonors(n = 10): UserTotals[] {
    return [...this.totals.values()].filter((t) => t.diamonds > 0).sort((a, b) => b.diamonds - a.diamonds).slice(0, n)
  }

  topLikers(n = 10): UserTotals[] {
    return [...this.totals.values()].filter((t) => t.likes > 0).sort((a, b) => b.likes - a.likes).slice(0, n)
  }

  summary() {
    let diamonds = 0
    let gifts = 0
    for (const t of this.totals.values()) {
      diamonds += t.diamonds
      gifts += t.gifts
    }
    return { sessionId: this.sessionId, roomLikes: this.roomLikes, diamonds, gifts, viewersSeen: this.totals.size, bestLive: this.bestLive, bestEver: this.bestEver, bestStreak: this.bestStreak, giftCounts: Object.fromEntries(this.giftCounts) }
  }

  get likes(): number {
    return this.roomLikes
  }

  flush(): void {
    if (this.dirty.size === 0 && this.giftLog.length === 0) return
    const up = this.db.prepare(`INSERT INTO user_totals (session_id, user_id, unique_id, nickname, avatar, diamonds, gifts, likes)
      VALUES (@s, @userId, @uniqueId, @nickname, @avatarUrl, @diamonds, @gifts, @likes)
      ON CONFLICT(session_id, user_id) DO UPDATE SET nickname=excluded.nickname, avatar=excluded.avatar, diamonds=excluded.diamonds, gifts=excluded.gifts, likes=excluded.likes`)
    const log = this.db.prepare('INSERT INTO gift_log (session_id, ts, user_id, gift, diamonds, count) VALUES (?, ?, ?, ?, ?, ?)')
    this.db.exec('BEGIN')
    try {
      for (const k of this.dirty) {
        const t = this.totals.get(k)
        if (t) up.run({ s: this.sessionId, userId: t.userId, uniqueId: t.uniqueId, nickname: t.nickname, avatarUrl: t.avatarUrl ?? null, diamonds: t.diamonds, gifts: t.gifts, likes: t.likes })
      }
      for (const row of this.giftLog) log.run(...row)
      this.db.exec('COMMIT')
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
    this.dirty.clear()
    this.giftLog = []
  }

  close(): void {
    clearInterval(this.timer)
    this.flush()
    this.db.close()
  }
}
