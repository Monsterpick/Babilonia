import { LayerSchema, sceneSize, type Layer, type Scene } from '@livearena/shared'

/** Tamaño natural de cada overlay (px), el mismo que se recomienda para OBS. */
export const OVERLAY_SIZES: Record<string, [number, number, string]> = {
  avisos: [520, 420, 'Avisos de acciones'],
  logros: [600, 360, 'Logros / Te mató'],
  destacados: [520, 360, 'Regalos destacados'],
  tarjetas: [1080, 400, 'Tarjetas de plugins'],
  ticker: [1280, 90, 'Banda de eventos'],
  contador: [420, 160, 'Contador V/D'],
  cronometro: [420, 160, 'Cronómetro'],
  vidas: [360, 180, 'Vidas'],
  totems: [300, 120, 'Tótems'],
  'reset-salvar': [520, 260, 'Reset o salvar'],
  'mejor-regalo': [560, 180, 'Mejor regalo'],
  'mejor-directo': [560, 180, 'Mejor del directo'],
  'mejor-racha': [560, 180, 'Mejor racha'],
  combinado: [560, 260, 'Combinado'],
  'meta-regalo': [320, 260, 'Meta de regalo'],
  duelo: [560, 260, 'Duelo'],
  'meta-monedas': [600, 120, 'Meta de monedas'],
  'meta-likes': [640, 90, 'Meta de likes'],
  'meta-seguidores': [640, 90, 'Meta de seguidores'],
  'meta-combinada': [640, 90, 'Meta combinada'],
  'top-regalos': [440, 800, 'Top regalos'],
  'top-likes': [440, 800, 'Top likes'],
  'mvp-monedas': [480, 150, 'MVP monedas'],
  'mvp-likes': [480, 150, 'MVP likes'],
  tts: [300, 40, 'TTS (sonido)'],
}

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
const pct = (v: number, total: number) => Math.round((v / total) * 1000) / 10

export function layer(p: Partial<Layer> & { type: Layer['type'] }): Layer {
  return LayerSchema.parse({ id: uid('l'), ...p })
}

/** Capa de overlay colocada en píxeles de la escena (x, y = esquina superior izquierda). */
export function overlayLayer(id: string, x: number, y: number, ratio: Scene['ratio'], scale = 1): Layer {
  const S = sceneSize(ratio)
  const [w, h, name] = OVERLAY_SIZES[id] ?? [400, 200, id]
  return layer({ type: 'overlay', overlay: id, name, x: pct(x, S.w), y: pct(y, S.h), w: pct(w * scale, S.w), h: pct(h * scale, S.h), scale })
}

const text = (t: string, x: number, y: number, w: number, h: number, extra: Partial<Layer> = {}) => layer({ type: 'text', name: 'Texto', text: t, x, y, w, h, ...extra })

export interface SceneTemplate {
  id: string
  name: string
  desc: string
  ratio: Scene['ratio']
  build: () => Layer[]
}

export const SCENE_TEMPLATES: SceneTemplate[] = [
  {
    id: 'vertical-survival',
    name: 'TikTok vertical · Supervivencia',
    desc: 'Top de regalos, meta de likes, avisos, vidas, tótems, cronómetro y banda inferior.',
    ratio: '9:16',
    build: () => [
      overlayLayer('meta-likes', 220, 40, '9:16'),
      overlayLayer('top-regalos', 20, 160, '9:16', 0.7),
      overlayLayer('avisos', 280, 700, '9:16'),
      overlayLayer('vidas', 40, 1460, '9:16'),
      overlayLayer('totems', 740, 1490, '9:16'),
      overlayLayer('cronometro', 620, 160, '9:16'),
      overlayLayer('ticker', 0, 1780, '9:16', 0.85),
    ],
  },
  {
    id: 'horizontal-minecraft',
    name: 'Horizontal · Minecraft clásico',
    desc: 'Top a la derecha, avisos arriba, mejor regalo y meta de monedas abajo.',
    ratio: '16:9',
    build: () => [
      overlayLayer('top-regalos', 1460, 40, '16:9', 0.75),
      overlayLayer('avisos', 700, 20, '16:9'),
      overlayLayer('mejor-regalo', 30, 30, '16:9', 0.8),
      overlayLayer('meta-monedas', 660, 950, '16:9'),
      overlayLayer('contador', 40, 900, '16:9'),
      overlayLayer('logros', 660, 420, '16:9'),
    ],
  },
  {
    id: 'subathon',
    name: 'Subathon',
    desc: 'Reloj extensible enorme, meta combinada, mejor regalo y top.',
    ratio: '16:9',
    build: () => [
      overlayLayer('cronometro', 660, 40, '16:9', 1.4),
      text('Cada moneda alarga el directo ⏳', 25, 24, 50, 7, { font: 44, color: '#ffd166', anim: 'pulse' }),
      overlayLayer('meta-combinada', 640, 960, '16:9'),
      overlayLayer('mejor-directo', 30, 30, '16:9', 0.8),
      overlayLayer('top-regalos', 1480, 60, '16:9', 0.7),
      overlayLayer('destacados', 700, 420, '16:9'),
    ],
  },
  {
    id: 'alertas',
    name: 'Solo alertas',
    desc: 'Avisos, logros y regalos destacados en el centro; ideal encima de otra escena.',
    ratio: '16:9',
    build: () => [overlayLayer('avisos', 700, 60, '16:9'), overlayLayer('logros', 660, 520, '16:9'), overlayLayer('destacados', 700, 600, '16:9')],
  },
  {
    id: 'duelo',
    name: 'Duelo de regalos',
    desc: 'Duelo grande en el centro, meta de regalo y tops de regalos y likes.',
    ratio: '16:9',
    build: () => [
      text('⚔️ ¡DUELO!', 30, 3, 40, 10, { font: 90, color: '#ffffff', anim: 'pop', family: 'impact' }),
      overlayLayer('duelo', 680, 160, '16:9', 1.2),
      overlayLayer('meta-regalo', 1560, 700, '16:9'),
      overlayLayer('top-regalos', 30, 140, '16:9', 0.7),
      overlayLayer('top-likes', 1520, 40, '16:9', 0.55),
    ],
  },
  {
    id: 'vertical-minimal',
    name: 'Vertical minimalista',
    desc: 'Lo justo: meta de likes arriba, MVP y banda de eventos.',
    ratio: '9:16',
    build: () => [
      overlayLayer('meta-likes', 220, 60, '9:16'),
      overlayLayer('mvp-monedas', 300, 180, '9:16'),
      text('Likes: {likes}  ·  Monedas: {monedas}', 5, 16, 90, 4, { font: 40, textBg: '#00000088' }),
      overlayLayer('ticker', 0, 1800, '9:16', 0.85),
    ],
  },
]
