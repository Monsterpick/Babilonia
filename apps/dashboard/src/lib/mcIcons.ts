/**
 * Catálogo de imágenes genéricas de Minecraft para las funciones (como hacen otras apps de directos), generadas aquí
 * mismo a partir de las texturas del Minecraft instalado del usuario (la app las importa de su .jar): cabezas de mobs
 * en 3D, bloques isométricos, montones de bloques y objetos, con contorno grueso y brillo. No se reparte ningún
 * recurso del juego: cada usuario las genera con su propia copia.
 */

export type Rect = [number, number, number, number] // x, y, ancho, alto en píxeles de la textura

/** Caja con textura (cabeza de mob o bloque): caras visibles arriba, delante y lado. */
export interface BoxSpec {
  tex: string
  /** Tamaño de la caja en «píxeles de modelo» (ancho, alto, fondo). */
  size: [number, number, number]
  top: Rect
  front: Rect
  side: Rect
  /** Capa exterior (sombrero, capucha…) un poco más grande. */
  overlay?: { top: Rect; front: Rect; side: Rect }
  /** Texturas aparte para cada cara (bloques: tnt_top, tnt_side…). */
  texTop?: string
  texSide?: string
  /** Tinte para texturas en gris (hierba, agua…). */
  tint?: string
  tintTop?: boolean
}

export interface IconDef {
  id: string
  name: string
  cat: 'Mobs' | 'Bloques' | 'Objetos' | 'Packs'
  glow: string
  box?: BoxSpec
  /** Varias cajas en montón (packs ×3). */
  pile?: number
  item?: string
  /** Dos objetos cruzados o repetidos (packs de objetos). */
  items?: string[]
  /** Brillo de encantamiento. */
  glint?: boolean
}

const head = (tex: string, ox = 0, oy = 0, hat = true): Omit<BoxSpec, 'tex'> & { tex: string } => ({
  tex,
  size: [8, 8, 8],
  top: [ox + 8, oy, 8, 8],
  front: [ox + 8, oy + 8, 8, 8],
  side: [ox + 16, oy + 8, 8, 8],
  overlay: hat ? { top: [ox + 40, oy, 8, 8], front: [ox + 40, oy + 8, 8, 8], side: [ox + 48, oy + 8, 8, 8] } : undefined,
})

const block = (tex: string, top?: string, side?: string, extra: Partial<BoxSpec> = {}): BoxSpec => ({
  tex: `block/${tex}.png`,
  texTop: top ? `block/${top}.png` : undefined,
  texSide: side ? `block/${side}.png` : undefined,
  size: [16, 16, 16],
  top: [0, 0, 16, 16],
  front: [0, 0, 16, 16],
  side: [0, 0, 16, 16],
  ...extra,
})

export const ICONS: IconDef[] = [
  // Mobs: cabezas 3D (texturas de entidad del juego)
  { id: 'mob-zombie', name: 'Zombi', cat: 'Mobs', glow: '#4ade80', box: head('entity/zombie/zombie.png') },
  { id: 'mob-creeper', name: 'Creeper', cat: 'Mobs', glow: '#22c55e', box: head('entity/creeper/creeper.png', 0, 0, false) },
  { id: 'mob-skeleton', name: 'Esqueleto', cat: 'Mobs', glow: '#e5e7eb', box: head('entity/skeleton/skeleton.png', 0, 0, false) },
  { id: 'mob-wither-skeleton', name: 'Esqueleto wither', cat: 'Mobs', glow: '#6b7280', box: head('entity/skeleton/wither_skeleton.png', 0, 0, false) },
  { id: 'mob-stray', name: 'Esqueleto glacial', cat: 'Mobs', glow: '#7dd3fc', box: head('entity/skeleton/stray.png', 0, 0, false) },
  { id: 'mob-husk', name: 'Zombi momificado', cat: 'Mobs', glow: '#fbbf24', box: head('entity/zombie/husk.png') },
  { id: 'mob-drowned', name: 'Ahogado', cat: 'Mobs', glow: '#2dd4bf', box: head('entity/zombie/drowned.png') },
  { id: 'mob-enderman', name: 'Enderman', cat: 'Mobs', glow: '#c084fc', box: head('entity/enderman/enderman.png', 0, 0, false) },
  { id: 'mob-spider', name: 'Araña', cat: 'Mobs', glow: '#ef4444', box: { tex: 'entity/spider/spider.png', size: [8, 8, 8], top: [40, 4, 8, 8], front: [40, 12, 8, 8], side: [48, 12, 8, 8] } },
  { id: 'mob-cave-spider', name: 'Araña de cueva', cat: 'Mobs', glow: '#38bdf8', box: { tex: 'entity/spider/cave_spider.png', size: [8, 8, 8], top: [40, 4, 8, 8], front: [40, 12, 8, 8], side: [48, 12, 8, 8] } },
  { id: 'mob-blaze', name: 'Blaze', cat: 'Mobs', glow: '#f59e0b', box: head('entity/blaze/blaze.png|entity/blaze.png', 0, 0, false) },
  { id: 'mob-slime', name: 'Slime', cat: 'Mobs', glow: '#84cc16', box: { tex: 'entity/slime/slime.png', size: [8, 8, 8], top: [8, 0, 8, 8], front: [8, 8, 8, 8], side: [16, 8, 8, 8] } },
  { id: 'mob-piglin', name: 'Piglin', cat: 'Mobs', glow: '#fb923c', box: { tex: 'entity/piglin/piglin.png', size: [10, 8, 8], top: [8, 0, 10, 8], front: [8, 8, 10, 8], side: [18, 8, 8, 8] } },
  { id: 'mob-villager', name: 'Aldeano', cat: 'Mobs', glow: '#a3e635', box: { tex: 'entity/villager/villager.png', size: [8, 10, 8], top: [8, 0, 8, 8], front: [8, 8, 8, 10], side: [16, 8, 8, 10] } },
  { id: 'mob-witch', name: 'Bruja', cat: 'Mobs', glow: '#a855f7', box: { tex: 'entity/witch/witch.png|entity/witch.png', size: [8, 10, 8], top: [8, 0, 8, 8], front: [8, 8, 8, 10], side: [16, 8, 8, 10] } },
  { id: 'mob-iron-golem', name: 'Gólem de hierro', cat: 'Mobs', glow: '#d6d3d1', box: { tex: 'entity/iron_golem/iron_golem.png', size: [8, 10, 8], top: [8, 0, 8, 8], front: [8, 8, 8, 10], side: [16, 8, 8, 10] } },
  { id: 'mob-warden', name: 'Warden', cat: 'Mobs', glow: '#22d3ee', box: { tex: 'entity/warden/warden.png', size: [16, 16, 10], top: [10, 32, 16, 10], front: [10, 42, 16, 16], side: [26, 42, 10, 16] } },
  { id: 'mob-steve', name: 'Jugador', cat: 'Mobs', glow: '#60a5fa', box: head('entity/player/wide/steve.png') },
  { id: 'mob-magma', name: 'Cubo de magma', cat: 'Mobs', glow: '#f97316', box: { tex: 'entity/slime/magmacube.png', size: [8, 8, 8], top: [8, 0, 8, 8], front: [8, 8, 8, 8], side: [16, 8, 8, 8] } },
  { id: 'mob-pig', name: 'Cerdo', cat: 'Mobs', glow: '#f9a8d4', box: { tex: 'entity/pig/pig_temperate.png|entity/pig/pig.png', size: [8, 8, 8], top: [8, 0, 8, 8], front: [8, 8, 8, 8], side: [16, 8, 8, 8] } },
  // Bloques isométricos
  { id: 'blk-tnt', name: 'TNT', cat: 'Bloques', glow: '#ef4444', box: block('tnt_side', 'tnt_top') },
  { id: 'blk-diamond', name: 'Bloque de diamante', cat: 'Bloques', glow: '#67e8f9', box: block('diamond_block') },
  { id: 'blk-gold', name: 'Bloque de oro', cat: 'Bloques', glow: '#facc15', box: block('gold_block') },
  { id: 'blk-emerald', name: 'Bloque de esmeralda', cat: 'Bloques', glow: '#34d399', box: block('emerald_block') },
  { id: 'blk-netherite', name: 'Bloque de netherita', cat: 'Bloques', glow: '#a8a29e', box: block('netherite_block') },
  { id: 'blk-obsidian', name: 'Obsidiana', cat: 'Bloques', glow: '#7c3aed', box: block('obsidian') },
  { id: 'blk-crying', name: 'Obsidiana llorosa', cat: 'Bloques', glow: '#c026d3', box: block('crying_obsidian') },
  { id: 'blk-grass', name: 'Hierba', cat: 'Bloques', glow: '#4ade80', box: block('grass_block_side', 'grass_block_top', undefined, { tint: '#79c05a', tintTop: true }) },
  { id: 'blk-sand', name: 'Arena', cat: 'Bloques', glow: '#fde68a', box: block('sand') },
  { id: 'blk-magma', name: 'Magma', cat: 'Bloques', glow: '#f97316', box: block('magma') },
  { id: 'blk-glowstone', name: 'Piedra luminosa', cat: 'Bloques', glow: '#fde047', box: block('glowstone') },
  { id: 'blk-amethyst', name: 'Amatista', cat: 'Bloques', glow: '#c084fc', box: block('amethyst_block') },
  { id: 'blk-slime', name: 'Bloque de slime', cat: 'Bloques', glow: '#84cc16', box: block('slime_block') },
  { id: 'blk-bedrock', name: 'Piedra base', cat: 'Bloques', glow: '#9ca3af', box: block('bedrock') },
  { id: 'blk-spawner', name: 'Generador de mobs', cat: 'Bloques', glow: '#60a5fa', box: block('spawner') },
  { id: 'blk-crafting', name: 'Mesa de trabajo', cat: 'Bloques', glow: '#d97706', box: block('crafting_table_front', 'crafting_table_top', 'crafting_table_side') },
  { id: 'blk-sculk', name: 'Sculk', cat: 'Bloques', glow: '#06b6d4', box: block('sculk') },
  { id: 'blk-pumpkin', name: 'Calabaza', cat: 'Bloques', glow: '#f97316', box: block('carved_pumpkin', 'pumpkin_top', 'pumpkin_side') },
  { id: 'blk-jack', name: 'Calabaza iluminada', cat: 'Bloques', glow: '#fbbf24', box: block('jack_o_lantern', 'pumpkin_top', 'pumpkin_side') },
  { id: 'blk-ice', name: 'Hielo', cat: 'Bloques', glow: '#93c5fd', box: block('packed_ice') },
  // Packs (montones de 3)
  { id: 'pack-tnt', name: 'Montón de TNT', cat: 'Packs', glow: '#ef4444', box: block('tnt_side', 'tnt_top'), pile: 3 },
  { id: 'pack-diamond', name: 'Montón de diamante', cat: 'Packs', glow: '#67e8f9', box: block('diamond_block'), pile: 3 },
  { id: 'pack-gold', name: 'Montón de oro', cat: 'Packs', glow: '#facc15', box: block('gold_block'), pile: 3 },
  { id: 'pack-obsidian', name: 'Montón de obsidiana', cat: 'Packs', glow: '#7c3aed', box: block('obsidian'), pile: 3 },
  { id: 'pack-zombies', name: 'Horda de zombis', cat: 'Packs', glow: '#4ade80', box: head('entity/zombie/zombie.png'), pile: 3 },
  { id: 'pack-creepers', name: 'Banda de creepers', cat: 'Packs', glow: '#22c55e', box: head('entity/creeper/creeper.png', 0, 0, false), pile: 3 },
  { id: 'pack-skeletons', name: 'Escuadrón de esqueletos', cat: 'Packs', glow: '#e5e7eb', box: head('entity/skeleton/skeleton.png', 0, 0, false), pile: 3 },
  { id: 'pack-arrows', name: 'Lluvia de flechas', cat: 'Packs', glow: '#fbbf24', items: ['arrow', 'arrow', 'arrow'] },
  { id: 'pack-swords', name: 'Espadas cruzadas', cat: 'Packs', glow: '#67e8f9', items: ['diamond_sword', 'netherite_sword'] },
  // Objetos
  { id: 'it-totem', name: 'Tótem', cat: 'Objetos', glow: '#facc15', item: 'totem_of_undying' },
  { id: 'it-gapple', name: 'Manzana dorada', cat: 'Objetos', glow: '#fbbf24', item: 'golden_apple' },
  { id: 'it-egapple', name: 'Manzana encantada', cat: 'Objetos', glow: '#e879f9', item: 'golden_apple', glint: true },
  { id: 'it-dsword', name: 'Espada de diamante', cat: 'Objetos', glow: '#67e8f9', item: 'diamond_sword' },
  { id: 'it-nsword', name: 'Espada de netherita', cat: 'Objetos', glow: '#a8a29e', item: 'netherite_sword' },
  { id: 'it-bow', name: 'Arco', cat: 'Objetos', glow: '#d97706', item: 'bow' },
  { id: 'it-trident', name: 'Tridente', cat: 'Objetos', glow: '#2dd4bf', item: 'trident' },
  { id: 'it-mace', name: 'Mazo', cat: 'Objetos', glow: '#9ca3af', item: 'mace' },
  { id: 'it-pearl', name: 'Perla de ender', cat: 'Objetos', glow: '#14b8a6', item: 'ender_pearl' },
  { id: 'it-eye', name: 'Ojo de ender', cat: 'Objetos', glow: '#22c55e', item: 'ender_eye' },
  { id: 'it-star', name: 'Estrella del Nether', cat: 'Objetos', glow: '#f5f5f4', item: 'nether_star', glint: true },
  { id: 'it-diamond', name: 'Diamante', cat: 'Objetos', glow: '#67e8f9', item: 'diamond' },
  { id: 'it-emerald', name: 'Esmeralda', cat: 'Objetos', glow: '#34d399', item: 'emerald' },
  { id: 'it-gold', name: 'Lingote de oro', cat: 'Objetos', glow: '#facc15', item: 'gold_ingot' },
  { id: 'it-fire', name: 'Carga ígnea', cat: 'Objetos', glow: '#f97316', item: 'fire_charge' },
  { id: 'it-firework', name: 'Cohete', cat: 'Objetos', glow: '#f43f5e', item: 'firework_rocket' },
  { id: 'it-xp', name: 'Botella de experiencia', cat: 'Objetos', glow: '#a3e635', item: 'experience_bottle', glint: true },
  { id: 'it-cake', name: 'Pastel', cat: 'Objetos', glow: '#fda4af', item: 'cake' },
  { id: 'it-beef', name: 'Filete', cat: 'Objetos', glow: '#f97316', item: 'cooked_beef' },
  { id: 'it-bread', name: 'Pan', cat: 'Objetos', glow: '#fbbf24', item: 'bread' },
  { id: 'it-cookie', name: 'Galleta', cat: 'Objetos', glow: '#d97706', item: 'cookie' },
  { id: 'it-elytra', name: 'Élitros', cat: 'Objetos', glow: '#a78bfa', item: 'elytra' },
  { id: 'it-heart', name: 'Corazón del mar', cat: 'Objetos', glow: '#38bdf8', item: 'heart_of_the_sea' },
  { id: 'it-compass', name: 'Brújula', cat: 'Objetos', glow: '#f87171', item: 'compass_00' },
  { id: 'it-clock', name: 'Reloj', cat: 'Objetos', glow: '#facc15', item: 'clock_00' },
  { id: 'it-bucket-lava', name: 'Cubo de lava', cat: 'Objetos', glow: '#f97316', item: 'lava_bucket' },
  { id: 'it-bucket-water', name: 'Cubo de agua', cat: 'Objetos', glow: '#3b82f6', item: 'water_bucket' },
  { id: 'it-snowball', name: 'Bola de nieve', cat: 'Objetos', glow: '#e0f2fe', item: 'snowball' },
  { id: 'it-egg', name: 'Huevo', cat: 'Objetos', glow: '#fef3c7', item: 'egg' },
  { id: 'it-skull', name: 'Cofre del tesoro', cat: 'Objetos', glow: '#fde047', item: 'chest_minecart' },
  { id: 'it-potion', name: 'Poción', cat: 'Objetos', glow: '#f472b6', item: 'potion' },
  { id: 'it-name-tag', name: 'Etiqueta', cat: 'Objetos', glow: '#e7e5e4', item: 'name_tag' },
]

const imgCache = new Map<string, Promise<HTMLImageElement | null>>()

function loadOne(rel: string): Promise<HTMLImageElement | null> {
  let p = imgCache.get(rel)
  if (!p) {
    p = new Promise((res) => {
      const img = new Image()
      img.onload = () => res(img)
      img.onerror = () => res(null)
      img.src = `/textures/raw/${rel}`
    })
    imgCache.set(rel, p)
  }
  return p
}

/** Carga una textura; `rel` puede llevar alternativas separadas por «|» (las rutas cambian entre versiones). */
async function loadTex(rel: string): Promise<HTMLImageElement | null> {
  for (const r of rel.split('|')) {
    const img = await loadOne(r)
    if (img) return img
  }
  return null
}

/** Primer fotograma de una textura animada (tira vertical) en un canvas cuadrado, con tinte opcional. */
function frame(img: HTMLImageElement, tint?: string): HTMLCanvasElement {
  const w = img.width
  const h = img.height > img.width * 1.5 && img.height % img.width === 0 ? img.width : img.height
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.drawImage(img, 0, 0, w, h, 0, 0, w, h)
  if (tint) {
    g.globalCompositeOperation = 'multiply'
    g.fillStyle = tint
    g.fillRect(0, 0, w, h)
    g.globalCompositeOperation = 'destination-in'
    g.drawImage(img, 0, 0, w, h, 0, 0, w, h)
  }
  return c
}

type Vec = [number, number]
const C30 = Math.cos(Math.PI / 6), S30 = 0.5

/** Dibuja una caja isométrica con sus tres caras visibles. (x, y): punto más alto; k: píxeles por unidad. */
function drawBox(g: CanvasRenderingContext2D, x: number, y: number, k: number, s: [number, number, number], faces: { top: [CanvasImageSource, Rect]; front: [CanvasImageSource, Rect]; side: [CanvasImageSource, Rect] }, grow = 1) {
  const [W0, H0, D0] = s
  const W = W0 * grow, H = H0 * grow, D = D0 * grow
  // Caja agrandada desde su centro (capa exterior): desplazamiento en espacio de modelo.
  const ox = -(W - W0) / 2, oy = -(H - H0) / 2, oz = -(D - D0) / 2
  // (x, y) es la esquina superior trasera de la caja original (0, H0, 0).
  const P = (px: number, py: number, pz: number): Vec => [x + (px + ox - (pz + oz)) * C30 * k, y + (px + ox + pz + oz) * S30 * k - (py + oy - H0) * k]
  // Origen: esquina trasera-superior (0, H, 0). Caras: arriba (y=H), delante (z=D), lado (x=W).
  const face = (src: CanvasImageSource, r: Rect, o: Vec, u: Vec, v: Vec, shade: number) => {
    g.save()
    g.setTransform(u[0] / r[2], u[1] / r[2], v[0] / r[3], v[1] / r[3], o[0], o[1])
    g.imageSmoothingEnabled = false
    g.drawImage(src, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3])
    if (shade > 0) {
      g.globalCompositeOperation = 'source-atop'
      g.fillStyle = `rgba(0,0,0,${shade})`
      g.fillRect(0, 0, r[2], r[3])
    }
    g.restore()
  }
  const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]]
  const top0 = P(0, H, 0)
  face(faces.top[0], faces.top[1], top0, sub(P(W, H, 0), top0), sub(P(0, H, D), top0), 0)
  const fr0 = P(0, H, D)
  face(faces.front[0], faces.front[1], fr0, sub(P(W, H, D), fr0), sub(P(0, 0, D), fr0), 0.18)
  const sd0 = P(W, H, D)
  face(faces.side[0], faces.side[1], sd0, sub(P(W, H, 0), sd0), sub(P(W, 0, D), sd0), 0.36)
}

async function boxFaces(b: BoxSpec) {
  const base = await loadTex(b.tex)
  if (!base) return null
  const top = b.texTop ? await loadTex(b.texTop) : null
  const side = b.texSide ? await loadTex(b.texSide) : null
  const isBlock = b.tex.startsWith('block/')
  const f = (img: HTMLImageElement | null, tinted: boolean): CanvasImageSource => (img ? (isBlock ? frame(img, tinted ? b.tint : undefined) : img) : base)
  const baseC = f(base, !!b.tint && !b.tintTop)
  return {
    top: [b.texTop ? f(top, !!b.tint) : baseC, b.top] as [CanvasImageSource, Rect],
    front: [baseC, b.front] as [CanvasImageSource, Rect],
    side: [b.texSide ? f(side, false) : baseC, b.side] as [CanvasImageSource, Rect],
    overlay: b.overlay ? { top: [base, b.overlay.top] as [CanvasImageSource, Rect], front: [base, b.overlay.front] as [CanvasImageSource, Rect], side: [base, b.overlay.side] as [CanvasImageSource, Rect] } : null,
  }
}

/** Contorno grueso y brillo de color alrededor de lo dibujado en `src`. */
function stylize(src: HTMLCanvasElement, glow: string, outline: number): HTMLCanvasElement {
  const N = src.width
  const out = document.createElement('canvas')
  out.width = out.height = N
  const g = out.getContext('2d')!
  // Silueta negra dilatada (contorno).
  const sil = document.createElement('canvas')
  sil.width = sil.height = N
  const sg = sil.getContext('2d')!
  sg.drawImage(src, 0, 0)
  sg.globalCompositeOperation = 'source-in'
  sg.fillStyle = '#000'
  sg.fillRect(0, 0, N, N)
  g.save()
  g.shadowColor = glow
  g.shadowBlur = N * 0.09
  for (let a = 0; a < 16; a++) g.drawImage(sil, Math.cos((a / 16) * Math.PI * 2) * outline, Math.sin((a / 16) * Math.PI * 2) * outline)
  g.restore()
  for (let a = 0; a < 16; a++) g.drawImage(sil, Math.cos((a / 16) * Math.PI * 2) * outline, Math.sin((a / 16) * Math.PI * 2) * outline)
  g.drawImage(src, 0, 0)
  return out
}

/** Destellos pequeños en las esquinas (sin tapar el dibujo). */
function sparkle(g: CanvasRenderingContext2D, N: number, color: string, seed: number) {
  const spots = [
    [0.12, 0.14, 0.03],
    [0.88, 0.2, 0.022],
    [0.1, 0.82, 0.02],
    [0.86, 0.86, 0.028],
  ]
  spots.forEach(([fx, fy, fs], i) => {
    if ((seed + i) % 4 === 3) return
    const x = N * fx!, y = N * fy!, s = N * fs!
    g.fillStyle = i % 2 ? '#fff' : color
    g.beginPath()
    g.moveTo(x, y - s * 2)
    g.lineTo(x + s * 0.45, y - s * 0.45)
    g.lineTo(x + s * 2, y)
    g.lineTo(x + s * 0.45, y + s * 0.45)
    g.lineTo(x, y + s * 2)
    g.lineTo(x - s * 0.45, y + s * 0.45)
    g.lineTo(x - s * 2, y)
    g.lineTo(x - s * 0.45, y - s * 0.45)
    g.fill()
  })
}

/** Genera el icono (PNG transparente de N×N). null si faltan las texturas. */
export async function renderIcon(def: IconDef, N = 256): Promise<HTMLCanvasElement | null> {
  const raw = document.createElement('canvas')
  raw.width = raw.height = N
  const g = raw.getContext('2d')!
  g.imageSmoothingEnabled = false
  if (def.box) {
    const faces = await boxFaces(def.box)
    if (!faces) return null
    const [W, H, D] = def.box.size
    const span = Math.max((W + D) * C30, H + (W + D) * S30)
    const pile = def.pile ?? 1
    const k = (N * (pile > 1 ? 0.5 : 0.7)) / span
    const draw = (cx: number, topY: number, kk: number) => {
      const x = cx - ((W - D) * C30 * kk) / 2
      drawBox(g, x, topY, kk, [W, H, D], faces)
      if (faces.overlay) drawBox(g, x, topY, kk, [W, H, D], faces.overlay, 1.125)
    }
    const h = (H + (W + D) * S30) * k
    if (pile > 1) {
      // Dos abajo y uno encima, desplazados.
      const base = N * 0.86 - h
      draw(N * 0.32, base, k)
      draw(N * 0.68, base, k)
      draw(N * 0.5, base - H * k * 0.82, k)
    } else draw(N / 2, (N - h) / 2, k)
  } else {
    const list = def.items ?? (def.item ? [def.item] : [])
    const imgs = (await Promise.all(list.map((it) => loadTex(`item/${it}.png`)))).filter(Boolean) as HTMLImageElement[]
    if (!imgs.length) return null
    const size = N * (imgs.length > 1 ? 0.62 : 0.72)
    imgs.forEach((img, i) => {
      const fr = frame(img)
      g.save()
      const off = imgs.length === 1 ? 0 : (i - (imgs.length - 1) / 2) * N * 0.17
      g.translate(N / 2 + off, N / 2 + (imgs.length > 2 ? Math.abs(off) * 0.4 : 0))
      if (imgs.length === 2) g.rotate(i === 0 ? 0 : Math.PI / 2)
      g.drawImage(fr, -size / 2, -size / 2, size, size)
      g.restore()
    })
  }
  const out = stylize(raw, def.glow, Math.max(3, N * 0.022))
  const og = out.getContext('2d')!
  if (def.glint) {
    og.save()
    og.globalCompositeOperation = 'source-atop'
    const gr = og.createLinearGradient(0, 0, N, N)
    gr.addColorStop(0.3, 'rgba(200,120,255,0)')
    gr.addColorStop(0.5, 'rgba(220,150,255,0.35)')
    gr.addColorStop(0.7, 'rgba(200,120,255,0)')
    og.fillStyle = gr
    og.fillRect(0, 0, N, N)
    og.restore()
  }
  sparkle(og, N, def.glow, def.id.length * 97 + def.id.charCodeAt(0))
  return out
}

/** Icono como data URL (para las miniaturas del catálogo). */
const urlCache = new Map<string, Promise<string | null>>()
export function iconUrl(def: IconDef, N = 128): Promise<string | null> {
  const key = `${def.id}@${N}`
  let p = urlCache.get(key)
  if (!p) {
    p = renderIcon(def, N).then((c) => (c ? c.toDataURL('image/png') : null))
    urlCache.set(key, p)
  }
  return p
}

/** Icono como archivo PNG (para subirlo como imagen de la función). */
export async function iconFile(def: IconDef): Promise<File | null> {
  const c = await renderIcon(def, 256)
  if (!c) return null
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'))
  return blob ? new File([blob], `${def.id}.png`, { type: 'image/png' }) : null
}
