import { z } from 'zod'

/* ------------------------------------------------------------------ *
 * Perfil = Acciones (funciones reutilizables, con su tarjeta visual)
 *        + Eventos (qué dispara cada acción)
 * ------------------------------------------------------------------ */

const id = z.string().min(1).max(64)

export const StepSchema = z.discriminatedUnion('type', [
  /** Uno o varios comandos de Minecraft. mode=random elige uno al azar en cada ejecución. */
  z.object({
    type: z.literal('minecraft.command'),
    commands: z.array(z.string().min(1).max(32000)).min(1),
    mode: z.enum(['all', 'random']).default('all'),
  }),
  z.object({
    type: z.literal('minecraft.summon'),
    entity: z.string().min(1),
    count: z.number().int().min(1).max(50).default(1),
    /** Pone el nombre del espectador encima del mob. */
    nameTag: z.boolean().default(true),
    /** Distancia aleatoria alrededor del jugador. */
    radius: z.number().min(0).max(32).default(3),
    heightOffset: z.number().min(-10).max(100).default(0),
  }),
  z.object({ type: z.literal('minecraft.give'), item: z.string().min(1), count: z.number().int().min(1).max(6400).default(1) }),
  z.object({
    type: z.literal('minecraft.effect'),
    effect: z.string().min(1),
    seconds: z.number().int().min(1).max(1000000).default(10),
    amplifier: z.number().int().min(0).max(255).default(0),
  }),
  z.object({
    type: z.literal('minecraft.title'),
    title: z.string().max(200).optional(),
    subtitle: z.string().max(200).optional(),
    actionbar: z.string().max(200).optional(),
    color: z.string().optional(),
  }),
  z.object({ type: z.literal('minecraft.kit') }),
  z.object({ type: z.literal('scoreboard'), key: z.enum(['wins', 'losses', 'lives']), delta: z.number().int() }),
  z.object({ type: z.literal('timer'), op: z.enum(['start', 'pause', 'reset', 'add']), seconds: z.number().int().optional() }),
  z.object({ type: z.literal('overlay.alert'), text: z.string().max(200).optional(), durationMs: z.number().int().min(500).max(30000).default(4000) }),
  z.object({ type: z.literal('sound'), file: z.string().min(1), volume: z.number().min(0).max(1).default(1) }),
  z.object({ type: z.literal('wait'), ms: z.number().int().min(0).max(60000) }),
  /** Acción que interpreta un módulo de juego (Batalla de equipos, etc.). */
  z.object({ type: z.literal('game'), kind: z.string().min(1), params: z.record(z.unknown()).default({}) }),
])
export type Step = z.infer<typeof StepSchema>
export type StepType = Step['type']

export const ActionSchema = z.object({
  id,
  /** Nombre corto que sale en la tarjeta del overlay (TRUENO, ZOMBIE...). */
  name: z.string().min(1).max(40),
  color: z.string().default('#22d3ee'),
  /** Imagen o video de la tarjeta (URL relativa a /media o absoluta). */
  media: z.object({ kind: z.enum(['image', 'video']), url: z.string() }).optional(),
  /** Para el overlay dividido Buenos | Malos. */
  alignment: z.enum(['good', 'bad', 'neutral']).default('neutral'),
  showInOverlay: z.boolean().default(true),
  steps: z.array(StepSchema).default([]),
})
export type Action = z.infer<typeof ActionSchema>

export const GiftRefSchema = z.object({ id: z.number().int().optional(), name: z.string().min(1), diamonds: z.number().int().optional() })
export type GiftRef = z.infer<typeof GiftRefSchema>

export const TriggerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('gift'), gifts: z.array(GiftRefSchema).min(1) }),
  z.object({ type: z.literal('diamonds'), min: z.number().int().min(0), max: z.number().int().min(0).optional() }),
  /** Cada N likes de una misma persona. */
  z.object({ type: z.literal('likes'), every: z.number().int().min(1).default(10) }),
  /** Meta de likes de toda la sala: goal, luego goal+step, goal+2·step... */
  z.object({
    type: z.literal('room_likes'),
    goal: z.number().int().min(1),
    step: z.number().int().min(0).default(0),
    repeat: z.boolean().default(true),
  }),
  z.object({ type: z.literal('command'), name: z.string().min(1).max(32), aliases: z.array(z.string()).default([]) }),
  z.object({ type: z.literal('chat'), contains: z.string().optional() }),
  z.object({ type: z.literal('follow'), oncePerUser: z.boolean().default(true) }),
  z.object({ type: z.literal('share') }),
  z.object({ type: z.literal('subscribe') }),
  z.object({ type: z.literal('join') }),
])
export type Trigger = z.infer<typeof TriggerSchema>
export type TriggerType = Trigger['type']

export const EventRuleSchema = z.object({
  id,
  enabled: z.boolean().default(true),
  trigger: TriggerSchema,
  actionIds: z.array(id).min(1),
  /** true: 10 rosas = 10 ejecuciones. false: una sola ejecución por evento. */
  perUnit: z.boolean().default(true),
  multiplier: z.number().int().min(1).max(100).default(1),
  /** Techo de seguridad por evento (un combo de 999 rosas no tumba el servidor). */
  maxPerEvent: z.number().int().min(1).max(1000).default(100),
  /** Prioridad fija 0..1000. Sin valor = automática según diamantes. */
  priority: z.number().int().min(0).max(1000).optional(),
  /** Pausa entre repeticiones de la misma regla (ms). */
  intervalMs: z.number().int().min(0).max(10000).default(0),
  cooldown: z.object({ globalMs: z.number().int().min(0).default(0), perUserMs: z.number().int().min(0).default(0) }).default({}),
  who: z.enum(['anyone', 'followers', 'subscribers', 'moderators', 'list']).default('anyone'),
  users: z.array(z.string()).default([]),
  sound: z
    .object({ file: z.string().min(1), volume: z.number().min(0).max(1).default(1), every: z.enum(['first', 'each']).default('first') })
    .optional(),
})
export type EventRule = z.infer<typeof EventRuleSchema>

export const OverlayStyleSchema = z.object({
  columns: z.union([z.literal('auto'), z.number().int().min(1).max(12)]).default('auto'),
  size: z.enum(['small', 'medium', 'large']).default('small'),
  shape: z.enum(['16:9', 'standard', 'square']).default('16:9'),
  split: z.boolean().default(false),
  cardStyle: z.enum(['glass', 'solid', 'neon', 'minimal']).default('solid'),
  radius: z.number().int().min(0).max(40).default(10),
  border: z.number().int().min(0).max(8).default(1),
  glow: z.number().min(0).max(1).default(0.2),
  background: z.number().min(0).max(1).default(1),
  showDisabled: z.boolean().default(false),
  imageFit: z.enum(['background', 'contain', 'cover', 'circle']).default('background'),
  showName: z.boolean().default(true),
  nameSize: z.number().min(0.3).max(2).default(0.8),
  nameColor: z.enum(['white', 'event']).default('white'),
  namePosition: z.enum(['bottom', 'top']).default('bottom'),
  font: z.enum(['bold', 'impact', 'rounded']).default('rounded'),
  showGift: z.boolean().default(true),
  giftCorner: z.enum(['right', 'left']).default('right'),
  giftSize: z.number().min(0.5).max(2).default(1.15),
  animate: z.boolean().default(true),
  onFire: z.enum(['flash', 'pulse', 'shake']).default('shake'),
  theme: z.enum(['normal', 'halloween']).default('normal'),
})
export type OverlayStyle = z.infer<typeof OverlayStyleSchema>

export const KitItemSchema = z.object({
  item: z.string().min(1),
  count: z.number().int().min(1).max(127).default(1),
  /** Encantamientos: { sharpness: 5 } */
  enchantments: z.record(z.number().int().min(1).max(255)).default({}),
  unbreakable: z.boolean().default(false),
})
export type KitItem = z.infer<typeof KitItemSchema>

export const KitSchema = z.object({
  enabled: z.boolean().default(false),
  giveOnRespawn: z.boolean().default(true),
  clearBefore: z.boolean().default(true),
  allPlayers: z.boolean().default(false),
  armor: z
    .object({
      head: KitItemSchema.optional(),
      chest: KitItemSchema.optional(),
      legs: KitItemSchema.optional(),
      feet: KitItemSchema.optional(),
      offhand: KitItemSchema.optional(),
    })
    .default({}),
  /** 9 huecos de barra rápida (null = vacío). */
  hotbar: z.array(KitItemSchema.nullable()).max(9).default([]),
  /** 27 huecos de mochila. */
  inventory: z.array(KitItemSchema.nullable()).max(27).default([]),
  nightVision: z.boolean().default(false),
  /** Nivel de salto mejorado (0 = normal). */
  jumpBoost: z.number().int().min(0).max(10).default(0),
  noFallDamage: z.boolean().default(false),
})
export type Kit = z.infer<typeof KitSchema>

export const ProfileSchema = z.object({
  schema: z.literal(1).default(1),
  id,
  name: z.string().min(1).max(60),
  mode: z.string().default('supervivencia'),
  actions: z.array(ActionSchema).default([]),
  events: z.array(EventRuleSchema).default([]),
  overlay: OverlayStyleSchema.default({}),
  kit: KitSchema.default({}),
  /** Comandos de chat de TikTok que se pueden leer en TTS, etc. (futuro). */
  notes: z.string().optional(),
})
export type Profile = z.infer<typeof ProfileSchema>
export type ProfileInput = z.input<typeof ProfileSchema>

export function parseProfile(raw: unknown): Profile {
  return ProfileSchema.parse(raw)
}
