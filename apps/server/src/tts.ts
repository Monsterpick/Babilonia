import type { LiveEvent } from '@livearena/shared'
import type { ConfigStore } from './config.js'
import type { Hub } from './hub.js'

export interface TtsItem {
  id: number
  ts: number
  user: string
  nick: string
  avatar?: string
  voice: string
  text: string
}

/**
 * Lectura por voz de los comentarios. El servidor decide qué se lee y con qué voz (reglas, filtros,
 * antispam) y manda la orden a los overlays, que usan la síntesis de voz del navegador (sin internet).
 */
export class TtsService {
  private history: TtsItem[] = []
  private seq = 0
  private lastByUser = new Map<string, number>()
  private recentTexts: string[] = []

  constructor(
    private cfg: ConfigStore,
    private hub: Hub,
  ) {}

  publishConfig(): void {
    this.hub.setState('ttscfg', this.cfg.get().tts)
  }

  getHistory(): TtsItem[] {
    return this.history
  }

  clearHistory(): void {
    this.history = []
    this.hub.setState('ttshistory', this.history)
  }

  private allowedUser(ev: Extract<LiveEvent, { type: 'chat' }>): boolean {
    const who = this.cfg.get().tts.who
    if (who.everyone) return true
    const u = ev.user as { isFollower?: boolean; isSubscriber?: boolean; isModerator?: boolean } | null
    if (!u) return false
    return !!((who.followers && u.isFollower) || (who.subscribers && u.isSubscriber) || (who.moderators && u.isModerator))
  }

  /** Limpia el texto según los filtros; devuelve null si no hay nada que leer. */
  private clean(text: string): string | null {
    const f = this.cfg.get().tts.filters
    let t = text
    if (f.ignoreTiktokEmojis) t = t.replace(/\[[a-zA-Z0-9_]+\]/g, ' ')
    if (f.stripEmojis) t = t.replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/gu, ' ').replace(/[^\p{L}\p{N}\p{P}\p{Zs}]/gu, ' ')
    if (f.ignoredWords.length) {
      const re = new RegExp(`\\b(${f.ignoredWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi')
      t = t.replace(re, ' ')
    }
    t = t.replace(/\s+/g, ' ').trim()
    return t.length ? t : null
  }

  private pickVoice(userId: string): string {
    const tts = this.cfg.get().tts
    if (tts.perUser[userId]) return tts.perUser[userId]!
    if (tts.random) return '' // el overlay elige una al azar
    return tts.voice
  }

  /** Procesa un comentario; si procede, manda la orden de leerlo. */
  onChat(ev: Extract<LiveEvent, { type: 'chat' }>): void {
    const tts = this.cfg.get().tts
    if (!tts.enabled || !ev.user) return
    let text = ev.payload.text ?? ''
    if (tts.mode === 'prefix') {
      if (!text.startsWith(tts.prefix)) return
      text = text.slice(tts.prefix.length)
    }
    if (!this.allowedUser(ev)) return
    const cleaned = this.clean(text)
    if (!cleaned) return
    const uid = ev.user.id || ev.user.uniqueId
    const now = Date.now()
    // Antispam: turno por usuario y no-repetir.
    if (tts.antispam.turnSeconds > 0 && now - (this.lastByUser.get(uid) ?? 0) < tts.antispam.turnSeconds * 1000) return
    if (tts.antispam.noRepeat && this.recentTexts.includes(cleaned.toLowerCase())) return
    this.lastByUser.set(uid, now)
    this.recentTexts.push(cleaned.toLowerCase())
    if (this.recentTexts.length > 40) this.recentTexts.shift()

    const body = cleaned.slice(0, tts.antispam.maxLen)
    const spoken = tts.template
      .replace(/\{username\}|\{usuario\}/g, ev.user.nickname)
      .replace(/\{nickname\}|\{nick\}/g, ev.user.nickname)
      .replace(/\{comment\}|\{mensaje\}/g, body)
    const item: TtsItem = { id: ++this.seq, ts: now, user: ev.user.uniqueId, nick: ev.user.nickname, avatar: ev.user.avatarUrl, voice: this.pickVoice(uid) || tts.voice || '(aleatoria)', text: body }
    this.history.unshift(item)
    if (this.history.length > 100) this.history.pop()
    this.hub.setState('ttshistory', this.history.slice(0, 50))
    this.hub.action({
      kind: 'tts.speak',
      user: ev.user,
      params: { text: spoken, voice: this.pickVoice(uid), rate: tts.rate, volume: tts.volume, maxQueue: tts.antispam.maxQueue, id: item.id },
      intensity: 0,
      priority: 1,
    })
  }
}
