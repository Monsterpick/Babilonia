import { z } from 'zod'

/** Usuario normalizado de cualquier plataforma. */
export const LiveUserSchema = z.object({
  id: z.string(),
  uniqueId: z.string(),
  nickname: z.string(),
  avatarUrl: z.string().optional(),
  isFollower: z.boolean().optional(),
  isModerator: z.boolean().optional(),
  isSubscriber: z.boolean().optional(),
})
export type LiveUser = z.infer<typeof LiveUserSchema>

export const GiftPayloadSchema = z.object({
  giftId: z.number().int(),
  name: z.string(),
  imageUrl: z.string().optional(),
  /** Valor unitario en diamantes (monedas). */
  diamonds: z.number().int().nonnegative(),
  /** Unidades NUEVAS de este evento (delta; nunca el acumulado de la racha). */
  count: z.number().int().positive(),
  /** Total acumulado de la racha hasta este evento. */
  streakTotal: z.number().int().positive(),
  streakId: z.string(),
  phase: z.enum(['single', 'streak', 'streak_end', 'streak_timeout']),
})
export type GiftPayload = z.infer<typeof GiftPayloadSchema>

const base = {
  v: z.literal(1),
  id: z.string().min(1),
  source: z.string(),
  user: LiveUserSchema.nullable(),
  ts: z.number(),
  simulated: z.boolean().optional(),
}

export const LiveEventSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('gift'), payload: GiftPayloadSchema }),
  z.object({ ...base, type: z.literal('like'), payload: z.object({ count: z.number().int().nonnegative(), totalRoomLikes: z.number().int().nonnegative().optional() }) }),
  z.object({
    ...base,
    type: z.literal('chat'),
    payload: z.object({ text: z.string(), command: z.object({ name: z.string(), args: z.array(z.string()) }).optional() }),
  }),
  z.object({ ...base, type: z.literal('follow'), payload: z.object({}).passthrough() }),
  z.object({ ...base, type: z.literal('share'), payload: z.object({}).passthrough() }),
  z.object({ ...base, type: z.literal('subscribe'), payload: z.object({ months: z.number().optional() }) }),
  z.object({ ...base, type: z.literal('member_join'), payload: z.object({}).passthrough() }),
  z.object({ ...base, type: z.literal('room_stats'), payload: z.object({ viewers: z.number().int().nonnegative(), totalLikes: z.number().optional() }) }),
  z.object({ ...base, type: z.literal('live_end'), payload: z.object({}).passthrough() }),
  z.object({ ...base, type: z.literal('custom'), payload: z.record(z.unknown()) }),
])
export type LiveEvent = z.infer<typeof LiveEventSchema>
export type LiveEventType = LiveEvent['type']
export type LiveEventOf<T extends LiveEventType> = Extract<LiveEvent, { type: T }>

/** Evento de regalo ANTES de pasar por el ComboTracker (tal y como llega del proveedor). */
export interface RawGift {
  msgId: string | null
  user: LiveUser
  giftId: number
  name: string
  imageUrl?: string
  diamonds: number
  /** repeatCount: en rachas es acumulado, crece con cada evento. */
  repeatCount: number
  repeatEnd: boolean
  /** true si el regalo admite racha (giftType 1). */
  streakable: boolean
  groupId: string
}

/** Estado de una fuente de LIVE. */
export type SourceState = 'idle' | 'connecting' | 'live' | 'offline' | 'backoff' | 'error'
export interface SourceStatus {
  state: SourceState
  target: string
  message?: string
  roomId?: string
  viewers?: number
  likes?: number
  retryInMs?: number
}

/** Extrae "!rojo 3" → { name: 'rojo', args: ['3'] }. */
export function parseCommand(text: string, prefixes = ['!', '/']): { name: string; args: string[] } | undefined {
  const t = text.trim()
  const p = prefixes.find((x) => t.startsWith(x))
  if (!p) return undefined
  const [name, ...args] = t.slice(p.length).split(/\s+/)
  if (!name) return undefined
  return { name: name.toLowerCase(), args }
}
