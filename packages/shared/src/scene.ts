import { z } from 'zod'

/** Una capa del estudio de escenas: posición en %, tamaño en %, y datos según el tipo. */
export const LayerSchema = z.object({
  id: z.string(),
  type: z.enum(['overlay', 'image', 'video', 'text', 'icon', 'shape', 'gift']),
  name: z.string().default(''),
  x: z.number().default(10),
  y: z.number().default(10),
  w: z.number().default(30),
  h: z.number().default(20),
  rot: z.number().default(0),
  opacity: z.number().min(0).max(1).default(1),
  hidden: z.boolean().default(false),
  locked: z.boolean().default(false),
  // overlay
  overlay: z.string().default(''),
  overlayParams: z.string().default(''),
  // image/video
  url: z.string().default(''),
  fit: z.enum(['contain', 'cover', 'fill']).default('contain'),
  loop: z.boolean().default(true),
  muted: z.boolean().default(true),
  // text
  text: z.string().default('Texto'),
  font: z.number().default(48),
  color: z.string().default('#ffffff'),
  weight: z.number().default(800),
  align: z.enum(['left', 'center', 'right']).default('center'),
  stroke: z.boolean().default(true),
  // icon (emoji)
  icon: z.string().default('⭐'),
  // shape
  shape: z.enum(['rect', 'circle']).default('rect'),
  radius: z.number().default(12),
  // gift
  gift: z.string().default('Rose'),
})
export type Layer = z.infer<typeof LayerSchema>

export const SceneSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(60).default('Escena'),
  ratio: z.enum(['9:16', '16:9', '1:1', 'free']).default('16:9'),
  bg: z.string().default('transparent'),
  layers: z.array(LayerSchema).default([]),
})
export type Scene = z.infer<typeof SceneSchema>
