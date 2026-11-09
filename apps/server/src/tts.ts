import { promises as fs } from 'node:fs'
import path from 'node:path'
import { findPreset, parseVoice, voiceLabel, type LiveEvent } from '@livearena/shared'
import type { ConfigStore } from './config.js'
import { paths } from './config.js'
import type { Hub } from './hub.js'
import { SapiService } from './sapi.js'

export interface TtsItem {
  id: number
  ts: number
  user: string
  nick: string
  avatar?: string
  voice: string
  voiceLabel: string
  text: string
}

export const TTS_AUDIO_DIR = path.join(paths.cache, 'tts')

/**
 * Lectura por voz de los comentarios. El servidor decide qué se lee y con qué voz (reglas, filtros,
 * antispam, voz por usuario) y manda la orden a los overlays. Las voces del navegador/OBS suenan allí mismo
 * (sin internet); las voces de Windows (SAPI, incluidas las de 32 bits como Loquendo) se generan aquí en .wav
 * y el overlay reproduce el audio con el efecto elegido.
 */
export class TtsService {
  private history: TtsItem[] = []
  private seq = 0
  private lastByUser = new Map<string, number>()
  private recentTexts: string[] = []
  readonly sapi = new SapiService()

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
  clean(text: string): string | null {
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

  /** Voz de un usuario: la asignada por el streamer (o elegida con !voz), si no la general. */
  voiceFor(user: { uniqueId?: string; id?: string } | null): string {
    const tts = this.cfg.get().tts
    const keys = [user?.uniqueId?.toLowerCase(), user?.id].filter(Boolean) as string[]
    for (const k of keys) if (tts.perUser[k]) return tts.perUser[k]!
    if (tts.random) return ''
    return tts.voice
  }

  /** !voz <personaje>: el espectador elige su voz (si el streamer lo permite). Devuelve true si era el comando. */
  private viewerChoice(ev: Extract<LiveEvent, { type: 'chat' }>, text: string): boolean {
    const tts = this.cfg.get().tts
    const m = text.match(/^!voz\s+(.+)$/i)
    if (!m || !ev.user) return false
    if (!tts.viewerChoice) return true // el comando no se lee aunque esté desactivado
    const preset = findPreset(m[1]!)
    if (!preset) return true
    const key = ev.user.uniqueId.toLowerCase()
    this.cfg.update((c) => (c.tts.perUser[key] = `p:${preset.id}`))
    this.publishConfig()
    void this.speak(`${ev.user.nickname} ahora habla como ${preset.name}`, `p:${preset.id}`, null, null)
    return true
  }

  /** Procesa un comentario; si procede, manda la orden de leerlo. */
  onChat(ev: Extract<LiveEvent, { type: 'chat' }>): void {
    const tts = this.cfg.get().tts
    if (!tts.enabled || !ev.user) return
    let text = ev.payload.text ?? ''
    if (this.viewerChoice(ev, text.trim())) return
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
    const voice = this.voiceFor(ev.user)
    const item: TtsItem = {
      id: ++this.seq,
      ts: now,
      user: ev.user.uniqueId,
      nick: ev.user.nickname,
      avatar: ev.user.avatarUrl,
      voice,
      voiceLabel: voice ? voiceLabel(voice) : tts.random ? 'Aleatoria' : 'Por defecto',
      text: body,
    }
    this.history.unshift(item)
    if (this.history.length > 100) this.history.pop()
    this.hub.setState('ttshistory', this.history.slice(0, 50))
    void this.speak(spoken, voice, ev.user, item.id)
  }

  /**
   * Manda a los overlays la orden de leer. Con voz de Windows genera antes el audio; si falla, lee con la
   * voz por defecto del navegador para no perder el mensaje.
   */
  async speak(text: string, voice: string, user: Extract<LiveEvent, { type: 'chat' }>['user'] | null, id: number | null): Promise<{ audio?: string }> {
    const tts = this.cfg.get().tts
    const params: Record<string, unknown> = { text, voice, rate: tts.rate, volume: tts.volume, maxQueue: tts.antispam.maxQueue, id: id ?? Date.now(), random: !voice && tts.random }
    const spec = parseVoice(voice)
    if (spec.kind === 'windows' && this.sapi.available) {
      try {
        const file = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.wav`
        await this.sapi.speak(text, spec.name, tts.rate, path.join(TTS_AUDIO_DIR, file))
        params.audio = `/tts/audio/${file}`
        params.effect = tts.windowsEffect
        void this.cleanupAudio()
      } catch {
        params.voice = ''
      }
    }
    this.hub.action({ kind: 'tts.speak', user: user ?? null, params, intensity: 0, priority: 1 })
    return { audio: params.audio as string | undefined }
  }

  /** Vista previa de una voz de Windows para el panel. */
  async preview(voice: string, text: string): Promise<{ audio: string }> {
    const spec = parseVoice(voice)
    if (spec.kind !== 'windows') throw new Error('Solo las voces de Windows necesitan vista previa en el servidor.')
    const file = `preview-${Date.now().toString(36)}.wav`
    await this.sapi.speak(text, spec.name, this.cfg.get().tts.rate, path.join(TTS_AUDIO_DIR, file))
    void this.cleanupAudio()
    return { audio: `/tts/audio/${file}` }
  }

  private async cleanupAudio(): Promise<void> {
    const files = await fs.readdir(TTS_AUDIO_DIR).catch(() => [] as string[])
    if (files.length < 80) return
    const stats = await Promise.all(files.map(async (f) => ({ f, t: (await fs.stat(path.join(TTS_AUDIO_DIR, f)).catch(() => null))?.mtimeMs ?? 0 })))
    stats.sort((a, b) => a.t - b.t)
    for (const s of stats.slice(0, stats.length - 50)) await fs.rm(path.join(TTS_AUDIO_DIR, s.f), { force: true })
  }
}
