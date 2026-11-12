import { z } from 'zod'
import type { LiveEvent, LiveUser, SourceStatus } from './events.js'

/**
 * Protocolo WebSocket v1 (ws://127.0.0.1:7420/ws).
 * Sobre común: { v: 1, type, id, ts, payload }.
 * - Los campos desconocidos se ignoran (compatibilidad hacia adelante).
 * - Un cambio incompatible sube `v`.
 * Ver docs/protocol.md.
 */
export const PROTOCOL_VERSION = 1

export type ClientRole = 'dashboard' | 'overlay' | 'game'

export interface Envelope<T extends string = string, P = unknown> {
  v: 1
  type: T
  id: string
  ts: number
  payload: P
}

export const HelloSchema = z.object({
  role: z.enum(['dashboard', 'overlay', 'game']),
  client: z.string().max(100).default('unknown'),
  /** Patrones de suscripción: "event", "action", "action:game.*", "state:*". Vacío = todo. */
  subscribe: z.array(z.string()).default([]),
  screen: z.number().int().optional(),
})
export type Hello = z.infer<typeof HelloSchema>

/** Acción ya resuelta que se envía a overlays y juegos. */
export interface ActionMessage {
  /** "overlay.alert" | "overlay.card" | "game.<kind>" | "sound" */
  kind: string
  params: Record<string, unknown>
  user: LiveUser | null
  actionId?: string
  actionName?: string
  color?: string
  media?: { kind: 'image' | 'video'; url: string }
  gift?: { name: string; diamonds: number; count: number; imageUrl?: string }
  /** 0..1: espectacularidad sugerida según el valor del regalo. */
  intensity: number
  priority: number
}

export type StateKey = 'source' | 'minecraft' | 'server' | 'leaderboard' | 'likes' | 'scoreboard' | 'profile' | 'queue' | 'goal' | 'textures' | 'overlaycfg' | 'resetsave' | 'ttscfg' | 'ttshistory' | 'scenes' | 'cinemod' | 'minigames' | 'lasthouse' | 'tunnel'

export type ServerMessage =
  | Envelope<'welcome', { protocol: number; serverVersion: string; sessionId: string; state: Record<string, unknown> }>
  | Envelope<'event', LiveEvent>
  | Envelope<'action', ActionMessage>
  | Envelope<'state', { key: StateKey; value: unknown }>
  | Envelope<'log', LogLine>
  | Envelope<'pong', Record<string, never>>
  | Envelope<'error', { code: string; message: string }>

export type ClientMessage =
  | Envelope<'hello', Hello>
  | Envelope<'ack', { actionId: string; ok: boolean; error?: string }>
  | Envelope<'game.report', { kind: string; data?: unknown }>
  | Envelope<'ping', Record<string, never>>

export interface LogLine {
  level: 'debug' | 'info' | 'warn' | 'error'
  scope: string
  msg: string
  ts: number
  data?: unknown
}

export type { SourceStatus }

let seq = 0
export function makeEnvelope<T extends string, P>(type: T, payload: P): Envelope<T, P> {
  seq = (seq + 1) % Number.MAX_SAFE_INTEGER
  return { v: 1, type, id: `${Date.now().toString(36)}${seq.toString(36)}`, ts: Date.now(), payload }
}

/** "action:game.*" casa con type=action, kind=game.battle.spawn */
export function matchesSubscription(subs: string[], type: string, kind?: string): boolean {
  if (subs.length === 0) return true
  return subs.some((s) => {
    const [t, pattern] = s.split(':')
    if (t !== type && t !== '*') return false
    if (!pattern || pattern === '*') return true
    if (!kind) return false
    if (pattern.endsWith('*')) return kind.startsWith(pattern.slice(0, -1))
    return kind === pattern
  })
}
