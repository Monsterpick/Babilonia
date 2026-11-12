/**
 * LAST HOUSE — modelos 3D (todos propios, construidos por código: ningún recurso externo).
 *
 * Estilo: dibujo animado. Formas redondeadas (esferas, cápsulas, cajas de cantos redondos, piezas torneadas),
 * sombreado «toon» por escalones, contorno oscuro alrededor de cada pieza y ojos grandes con brillo.
 *
 * Rendimiento: cada pieza móvil de un personaje (cuerpo, cabeza, brazo…) funde todas sus formas en UNA geometría con
 * color por vértice, así un personaje son ~6 piezas en vez de ~40 mallas. Las plantillas se construyen una vez por
 * tipo y todas las copias comparten geometrías y materiales.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ZombieKind } from './common'
import type { GuardianKind } from './sim'

type V3 = [number, number, number]
interface Tf {
  /** rotación (radianes) */
  r?: V3
  /** escala */
  s?: V3 | number
}

// ───────────────────────────── materiales compartidos ─────────────────────────────

function gradient(): THREE.DataTexture {
  const d = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255])
  const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat)
  t.minFilter = t.magFilter = THREE.NearestFilter
  t.needsUpdate = true
  return t
}

const shared = <T extends THREE.Material>(m: T): T => {
  m.userData.shared = true
  return m
}

const GRAD = gradient()
/** Sombreado de dibujo animado con el color de cada vértice. */
export const TOON = shared(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRAD }))
/** Igual, teñido de azul (enemigo congelado). */
export const FROZEN = shared(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRAD, color: 0x8fd0ff, emissive: 0x1a4f8a, emissiveIntensity: 0.5 }))
/** Destello blanco al recibir un golpe. */
export const FLASH = shared(new THREE.MeshBasicMaterial({ color: 0xffffff }))
/** Piezas que brillan (ojos, núcleos, hielo): sin sombreado y fuera del mapeo de tonos para que el resplandor las recoja. */
export const GLOW = shared(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }))
/** Contorno: la misma pieza un poco hinchada y vista por dentro. */
export const OUTLINE = shared(new THREE.MeshBasicMaterial({ color: 0x1b1226, side: THREE.BackSide }))
OUTLINE.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize(normal) * 0.035;')
}

// ───────────────────────────── constructor de piezas ─────────────────────────────

const col = new THREE.Color()
const m4 = new THREE.Matrix4()
const q = new THREE.Quaternion()
const eu = new THREE.Euler()

function place(g: THREE.BufferGeometry, color: number, p: V3, tf: Tf = {}): THREE.BufferGeometry {
  let geo = g.index ? g.toNonIndexed() : g.clone()
  if (g.index) g.dispose()
  geo.deleteAttribute('uv')
  const s = tf.s === undefined ? [1, 1, 1] : typeof tf.s === 'number' ? [tf.s, tf.s, tf.s] : tf.s
  const r = tf.r ?? [0, 0, 0]
  m4.compose(new THREE.Vector3(...p), q.setFromEuler(eu.set(r[0], r[1], r[2])), new THREE.Vector3(s[0]!, s[1]!, s[2]!))
  geo.applyMatrix4(m4)
  col.setHex(color, THREE.SRGBColorSpace)
  const n = geo.getAttribute('position').count
  const c = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    c[i * 3] = col.r
    c[i * 3 + 1] = col.g
    c[i * 3 + 2] = col.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3))
  geo = geo.index ? geo.toNonIndexed() : geo
  return geo
}

/** Una pieza de un modelo: se le van añadiendo formas y al final se funden en una geometría (más otra para lo que brilla). */
export class Piece {
  private toon: THREE.BufferGeometry[] = []
  private glow: THREE.BufferGeometry[] = []
  private target: 'toon' | 'glow' = 'toon'
  pos: V3 = [0, 0, 0]
  rot: V3 = [0, 0, 0]
  parent = ''

  constructor(
    readonly name: string,
    pos: V3 = [0, 0, 0],
    parent = '',
    rot: V3 = [0, 0, 0],
  ) {
    this.pos = pos
    this.parent = parent
    this.rot = rot
  }

  /** Lo siguiente que se añada brillará (ojos, núcleos). */
  get lit(): this {
    this.target = 'glow'
    return this
  }

  private add(g: THREE.BufferGeometry, color: number, p: V3, tf?: Tf): this {
    ;(this.target === 'glow' ? this.glow : this.toon).push(place(g, color, p, tf))
    this.target = 'toon'
    return this
  }

  sph(color: number, r: number, p: V3, tf?: Tf): this {
    return this.add(new THREE.SphereGeometry(r, 14, 10), color, p, tf)
  }

  box(color: number, w: number, h: number, d: number, p: V3, tf?: Tf, round = 0.3): this {
    const rad = Math.min(w, h, d) * round
    return this.add(rad > 0.005 ? new RoundedBoxGeometry(w, h, d, 3, rad) : new THREE.BoxGeometry(w, h, d), color, p, tf)
  }

  cyl(color: number, top: number, bottom: number, h: number, p: V3, tf?: Tf, seg = 14): this {
    return this.add(new THREE.CylinderGeometry(top, bottom, h, seg), color, p, tf)
  }

  cone(color: number, r: number, h: number, p: V3, tf?: Tf, seg = 10): this {
    return this.add(new THREE.ConeGeometry(r, h, seg), color, p, tf)
  }

  cap(color: number, r: number, len: number, p: V3, tf?: Tf): this {
    return this.add(new THREE.CapsuleGeometry(r, len, 4, 10), color, p, tf)
  }

  torus(color: number, r: number, tube: number, p: V3, tf?: Tf): this {
    return this.add(new THREE.TorusGeometry(r, tube, 8, 18), color, p, tf)
  }

  /** Pieza torneada a partir de un perfil (radio, altura). */
  lathe(color: number, profile: [number, number][], p: V3, tf?: Tf): this {
    // el perfil va siempre de abajo arriba: si no, las caras quedan del revés (se vería el contorno por dentro)
    const pts = profile[0]![1] > profile[profile.length - 1]![1] ? [...profile].reverse() : profile
    return this.add(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 16), color, p, tf)
  }

  /** Ojo de dibujo animado: blanco, pupila y brillo. `look` desplaza la pupila. */
  eye(p: V3, r: number, pupil = 0x1b1226, white = 0xffffff, look: [number, number] = [0, 0]): this {
    this.sph(white, r, p, { s: [1, 1.1, 0.7] })
    this.sph(pupil, r * 0.5, [p[0] + look[0] * r, p[1] + look[1] * r, p[2] + r * 0.55], { s: [1, 1.1, 0.6] })
    this.lit.sph(0xffffff, r * 0.18, [p[0] + look[0] * r + r * 0.2, p[1] + look[1] * r + r * 0.25, p[2] + r * 0.82])
    return this
  }

  build(): { toon: THREE.BufferGeometry | null; glow: THREE.BufferGeometry | null } {
    const fuse = (list: THREE.BufferGeometry[]) => {
      if (!list.length) return null
      const g = mergeGeometries(list, false)
      for (const x of list) x.dispose()
      if (g) g.userData.shared = true
      return g
    }
    return { toon: fuse(this.toon), glow: fuse(this.glow) }
  }
}

interface PartDef {
  name: string
  parent: string
  pos: V3
  rot: V3
  toon: THREE.BufferGeometry | null
  glow: THREE.BufferGeometry | null
}

export interface ModelDef {
  parts: PartDef[]
  scale: number
  /** altura a la que va la barra de vida */
  top: number
}

const TEMPLATES = new Map<string, ModelDef>()

function template(key: string, make: () => { pieces: Piece[]; scale?: number; top: number }): ModelDef {
  let d = TEMPLATES.get(key)
  if (!d) {
    const m = make()
    d = { parts: m.pieces.map((p) => ({ name: p.name, parent: p.parent, pos: p.pos, rot: p.rot, ...p.build() })), scale: m.scale ?? 1, top: m.top }
    TEMPLATES.set(key, d)
  }
  return d
}

export interface Instance {
  root: THREE.Group
  parts: Record<string, THREE.Group>
  /** mallas con sombreado (para el destello de golpe y el tinte de congelado) */
  skins: THREE.Mesh[]
  scale: number
  top: number
}

/** Crea una copia de un modelo (comparte geometrías y materiales con todas las demás). */
export function instantiate(def: ModelDef, outline = true): Instance {
  const root = new THREE.Group()
  const parts: Record<string, THREE.Group> = {}
  const skins: THREE.Mesh[] = []
  const outer: Record<string, THREE.Group> = {}
  for (const p of def.parts) {
    // dos niveles: el exterior lleva la posición de la articulación; el interior (el que se anima) lleva la rotación
    // de reposo, así la vista puede poner posiciones como desplazamientos y rotaciones absolutas
    const o = new THREE.Group()
    o.position.set(...p.pos)
    const g = new THREE.Group()
    g.rotation.set(...p.rot)
    o.add(g)
    outer[p.name] = o
    if (p.toon) {
      const m = new THREE.Mesh(p.toon, TOON)
      m.castShadow = true
      g.add(m)
      skins.push(m)
      if (outline) g.add(new THREE.Mesh(p.toon, OUTLINE))
    }
    if (p.glow) g.add(new THREE.Mesh(p.glow, GLOW))
    parts[p.name] = g
  }
  for (const p of def.parts) (p.parent ? parts[p.parent]! : root).add(outer[p.name]!)
  root.scale.setScalar(def.scale)
  return { root, parts, skins, scale: def.scale, top: def.top }
}

// ───────────────────────────── paleta ─────────────────────────────

const C = {
  skin: 0x9fd08a,
  skinDark: 0x6fa565,
  skinPale: 0xb9dca6,
  bone: 0xf2ead2,
  dark: 0x1b1226,
  wood: 0x9a6236,
  woodDark: 0x6f4526,
  woodLight: 0xd9a86a,
  leaf: 0x58c043,
  leafDark: 0x3a9a35,
  leafLight: 0x8fe05a,
  pot: 0xd4703d,
  potDark: 0xa9532b,
  gold: 0xf5c63a,
  red: 0xd9463e,
  purple: 0x6d3a94,
  white: 0xffffff,
  metal: 0x9aa6b4,
  metalDark: 0x5e6878,
}

const SHIRTS = [0x6a78c9, 0xc98a4a, 0x4aa6a0, 0xb85a78, 0x7a9a48, 0x8a6ac0]
const PANTS = [0x3d4a6e, 0x5a4636, 0x3a5a50, 0x4a3a5a]

// ───────────────────────────── horda ─────────────────────────────

/**
 * Zombi de la horda: cabezón de cantos redondos, ojos amarillos que brillan, sonrisa torcida con un diente, brazos
 * por delante. Cada tipo añade lo suyo.
 */
export function zombieDef(kind: ZombieKind, variant: number): ModelDef {
  const v = kind === 'caminante' ? variant % SHIRTS.length : 0
  return template(`z:${kind}:${v}`, () => {
    const skin = kind === 'titan' ? 0x7f9a78 : kind === 'excavador' ? 0xb0c890 : kind === 'coloso' ? 0x8fbf8a : C.skin
    const skinD = kind === 'titan' ? 0x566e52 : C.skinDark
    const shirt = kind === 'titan' ? 0x3a2a4a : kind === 'coloso' ? 0x9a5a3a : kind === 'corredor' ? 0xe0603a : kind === 'blindado' ? 0x596a80 : kind === 'excavador' ? 0x8a6a3a : SHIRTS[v]!
    const pants = PANTS[v % PANTS.length]!
    const eyeC = kind === 'titan' ? 0xff4a3a : 0xffe45a

    const body = new Piece('body', [0, 0.58, 0])
    body.box(shirt, 0.66, 0.62, 0.44, [0, 0.3, 0], {}, 0.35)
    body.box(C.white, 0.2, 0.16, 0.05, [0, 0.5, 0.22], {}, 0.2) // cuello de la camisa
    body.box(C.red, 0.09, 0.3, 0.04, [0, 0.33, 0.235], { r: [0, 0, 0.08] }, 0.3) // corbata torcida
    body.box(pants, 0.68, 0.16, 0.46, [0, 0.02, 0], {}, 0.35)

    const head = new Piece('head', [0, 0.66, 0.02], 'body')
    head.box(skin, 0.74, 0.66, 0.66, [0, 0.33, 0], {}, 0.32)
    head.box(skinD, 0.76, 0.2, 0.68, [0, 0.06, 0], {}, 0.4) // mandíbula
    head.sph(skinD, 0.09, [-0.4, 0.34, 0], { s: [0.6, 1, 0.8] }).sph(skinD, 0.09, [0.4, 0.34, 0], { s: [0.6, 1, 0.8] }) // orejas
    // ojos que brillan (uno más grande: mirada torcida)
    head.lit.sph(eyeC, 0.13, [-0.17, 0.42, 0.31], { s: [1, 1.05, 0.5] })
    head.lit.sph(eyeC, 0.1, [0.18, 0.44, 0.31], { s: [1, 1.05, 0.5] })
    head.sph(C.dark, 0.05, [-0.15, 0.41, 0.37], { s: [1, 1, 0.5] }).sph(C.dark, 0.04, [0.17, 0.43, 0.36], { s: [1, 1, 0.5] })
    // cejas
    head.box(C.dark, 0.2, 0.05, 0.06, [-0.18, 0.57, 0.33], { r: [0, 0, -0.3] }, 0.4)
    head.box(C.dark, 0.17, 0.05, 0.06, [0.18, 0.58, 0.33], { r: [0, 0, 0.35] }, 0.4)
    // boca torcida con un diente
    head.box(C.dark, 0.32, 0.09, 0.05, [0.02, 0.17, 0.33], { r: [0, 0, 0.1] }, 0.45)
    head.box(C.bone, 0.07, 0.08, 0.05, [-0.05, 0.2, 0.345], {}, 0.2)
    // tres pelos
    for (let i = 0; i < 3; i++) head.cone(C.dark, 0.035, 0.2, [-0.1 + i * 0.1, 0.72, 0.05], { r: [0.2 * (i - 1), 0, 0.35 * (i - 1)] }, 6)

    const arm = (name: string, sx: number) => {
      const a = new Piece(name, [sx * 0.42, 0.52, 0], 'body', [-1.35, 0, 0])
      a.cap(shirt, 0.11, 0.16, [0, -0.1, 0])
      a.cap(skin, 0.095, 0.26, [0, -0.38, 0])
      a.sph(skin, 0.13, [0, -0.6, 0], { s: [1, 1, 0.8] })
      return a
    }
    const armL = arm('armL', -1)
    const armR = arm('armR', 1)
    const leg = (name: string, sx: number) => {
      const l = new Piece(name, [sx * 0.17, 0.58, 0])
      l.cap(pants, 0.115, 0.26, [0, -0.25, 0])
      l.box(0x4a3426, 0.24, 0.16, 0.36, [0, -0.5, 0.05], {}, 0.4)
      return l
    }
    const legL = leg('legL', -1)
    const legR = leg('legR', 1)
    const mound = new Piece('mound')
    mound.sph(0x7a5230, 0.7, [0, 0, 0], { s: [1, 0.4, 1.3] }).sph(0x5a3a20, 0.3, [0.3, 0.15, 0.2]).sph(0x8a623a, 0.24, [-0.35, 0.12, -0.3])

    let scale = 1
    let top = 2.25
    switch (kind) {
      case 'corredor':
        // cinta en la frente con la punta al viento y zapatillas
        head.box(0xffffff, 0.78, 0.1, 0.7, [0, 0.52, 0], {}, 0.4)
        head.box(0xffffff, 0.08, 0.06, 0.3, [0.3, 0.52, -0.45], { r: [0.3, 0.2, 0] }, 0.3)
        legL.box(0xffffff, 0.25, 0.06, 0.37, [0, -0.56, 0.05], {}, 0.4)
        legR.box(0xffffff, 0.25, 0.06, 0.37, [0, -0.56, 0.05], {}, 0.4)
        body.rot = [0.35, 0, 0]
        break
      case 'blindado':
        // tapa de olla remachada como escudo y casco de cacerola con asa
        head.lathe(C.metal, [[0.0, 0.34], [0.3, 0.3], [0.44, 0.12], [0.46, 0.0], [0.5, -0.02]], [0, 0.6, 0])
        head.torus(C.metalDark, 0.1, 0.03, [0, 0.96, 0], { r: [0, Math.PI / 2, 0] })
        armL.cyl(C.metal, 0.46, 0.46, 0.07, [0.05, -0.55, 0.16], { r: [Math.PI / 2 + 1.35, 0, 0] }, 18)
        armL.sph(C.metalDark, 0.09, [0.05, -0.6, 0.2])
        body.box(C.metalDark, 0.7, 0.34, 0.48, [0, 0.36, 0], {}, 0.3)
        break
      case 'excavador':
        // gafas de buceo con tubo y pala de jardín
        head.box(0x2a6a8a, 0.6, 0.2, 0.1, [0, 0.43, 0.32], {}, 0.45)
        head.cyl(0xff8a3a, 0.035, 0.035, 0.5, [0.36, 0.7, 0], {}, 8)
        head.sph(0xff8a3a, 0.06, [0.36, 0.96, 0.03])
        armR.cyl(C.wood, 0.035, 0.035, 0.8, [0, -0.6, 0.2], { r: [Math.PI / 2, 0, 0] }, 8)
        armR.box(C.metal, 0.26, 0.04, 0.32, [0, -0.6, 0.72], {}, 0.3)
        break
      case 'coloso':
        // grandullón barrigón con un buzón arrancado como garrote
        scale = 2.2
        top = 2.4
        body.sph(shirt, 0.48, [0, 0.2, 0.08], { s: [1, 0.85, 0.9] })
        body.box(0x3a2414, 0.74, 0.1, 0.5, [0, 0.0, 0], {}, 0.4)
        armR.cyl(C.woodDark, 0.05, 0.05, 1.0, [0, -0.7, 0.4], { r: [Math.PI / 2, 0, 0] }, 8)
        armR.box(0x3a78c8, 0.34, 0.3, 0.46, [0, -0.7, 1.0], {}, 0.3)
        armR.box(C.red, 0.03, 0.14, 0.2, [0.19, -0.6, 1.05], {}, 0.2)
        break
      case 'titan':
        // gigante con cuernos, placas de piedra y un núcleo que brilla en el pecho
        scale = 3.7
        top = 2.5
        head.cone(C.bone, 0.11, 0.42, [-0.3, 0.82, 0], { r: [0, 0, 0.5] }, 8).cone(C.bone, 0.11, 0.42, [0.3, 0.82, 0], { r: [0, 0, -0.5] }, 8)
        body.box(0x5a5a68, 0.82, 0.3, 0.52, [0, 0.5, 0], {}, 0.3)
        body.sph(0x5a5a68, 0.2, [-0.42, 0.56, 0]).sph(0x5a5a68, 0.2, [0.42, 0.56, 0])
        body.lit.sph(0xff5a2a, 0.13, [0, 0.3, 0.2], { s: [1, 1, 0.6] })
        armL.sph(0x5a5a68, 0.2, [0, -0.62, 0])
        armR.sph(0x5a5a68, 0.2, [0, -0.62, 0])
        break
      default:
        break
    }
    return { pieces: [body, head, armL, armR, legL, legR, mound], scale, top }
  })
}

/** El Rey de la Horda: zombi grandullón con corona torcida de puntas con bola, cuello de piel y capa real hecha jirones. */
export function kingDef(crown: number): ModelDef {
  return template(`king:${crown}`, () => {
    const body = new Piece('body', [0, 0.6, 0])
    body.lathe(0x7a2a4a, [[0.0, 0.72], [0.36, 0.7], [0.42, 0.4], [0.46, 0.05], [0.5, -0.06], [0.0, -0.06]], [0, 0, 0]) // túnica
    body.box(crown, 0.12, 0.6, 0.04, [0, 0.36, 0.43], {}, 0.3) // franja dorada
    body.torus(C.bone, 0.36, 0.13, [0, 0.72, 0], { r: [Math.PI / 2, 0, 0] }) // cuello de piel
    for (let i = 0; i < 6; i++) body.sph(C.dark, 0.035, [Math.cos((i / 6) * Math.PI * 2) * 0.4, 0.78, Math.sin((i / 6) * Math.PI * 2) * 0.4])
    body.sph(crown, 0.08, [-0.2, 0.62, 0.36]).sph(crown, 0.08, [0.2, 0.62, 0.36]) // broches

    const head = new Piece('head', [0, 0.82, 0.02], 'body')
    head.box(C.skin, 0.8, 0.72, 0.72, [0, 0.36, 0], {}, 0.32)
    head.box(C.skinDark, 0.82, 0.22, 0.74, [0, 0.07, 0], {}, 0.4)
    head.lit.sph(0xffe45a, 0.14, [-0.19, 0.44, 0.34], { s: [1, 1, 0.5] })
    head.lit.sph(0xffe45a, 0.14, [0.19, 0.44, 0.34], { s: [1, 1, 0.5] })
    head.sph(C.dark, 0.05, [-0.17, 0.43, 0.4], { s: [1, 1, 0.5] }).sph(C.dark, 0.05, [0.17, 0.43, 0.4], { s: [1, 1, 0.5] })
    head.box(C.dark, 0.24, 0.06, 0.06, [-0.2, 0.6, 0.36], { r: [0, 0, -0.4] }, 0.4).box(C.dark, 0.24, 0.06, 0.06, [0.2, 0.6, 0.36], { r: [0, 0, 0.4] }, 0.4)
    head.box(C.dark, 0.4, 0.12, 0.05, [0, 0.19, 0.36], {}, 0.45)
    for (let i = 0; i < 4; i++) head.box(C.bone, 0.07, 0.07, 0.05, [-0.13 + i * 0.09, 0.22, 0.375], {}, 0.2)
    head.sph(0x5a8a52, 0.035, [0.26, 0.3, 0.37]) // verruga

    const crownP = new Piece('crown', [0.04, 0.72, 0], 'head', [0, 0, -0.2])
    crownP.cyl(crown, 0.36, 0.32, 0.2, [0, 0.1, 0], {}, 16)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      crownP.cone(crown, 0.09, 0.3, [Math.cos(a) * 0.3, 0.33, Math.sin(a) * 0.3], {}, 8)
      crownP.sph(crown, 0.06, [Math.cos(a) * 0.3, 0.5, Math.sin(a) * 0.3])
    }
    crownP.lit.sph(0xff4a6a, 0.06, [0, 0.12, 0.34])

    const arm = (name: string, sx: number) => {
      const a = new Piece(name, [sx * 0.52, 0.6, 0], 'body', [-1.25, 0, 0])
      a.cap(0x7a2a4a, 0.14, 0.2, [0, -0.12, 0])
      a.cap(C.skin, 0.11, 0.3, [0, -0.45, 0])
      a.sph(C.skin, 0.16, [0, -0.72, 0])
      for (let i = 0; i < 3; i++) a.cone(C.bone, 0.035, 0.16, [-0.08 + i * 0.08, -0.88, 0.02], { r: [Math.PI, 0, 0] }, 6)
      return a
    }
    const leg = (name: string, sx: number) => {
      const l = new Piece(name, [sx * 0.2, 0.6, 0])
      l.cap(0x3d4a6e, 0.13, 0.26, [0, -0.25, 0])
      l.box(0x4a3426, 0.28, 0.18, 0.42, [0, -0.5, 0.06], {}, 0.4)
      return l
    }
    const cape = new Piece('cape', [0, 0.7, -0.36], 'body', [0.16, 0, 0])
    cape.box(0xb83a4a, 0.9, 1.0, 0.07, [0, -0.5, 0], {}, 0.3)
    for (let i = 0; i < 4; i++) cape.cone(0xb83a4a, 0.12, 0.3, [-0.33 + i * 0.22, -1.1, 0], { r: [Math.PI, 0, 0] }, 4)
    cape.box(C.bone, 0.94, 0.1, 0.09, [0, -0.02, 0], {}, 0.4)
    return { pieces: [body, head, crownP, arm('armL', -1), arm('armR', 1), leg('legL', -1), leg('legR', 1), cape], scale: 1.45, top: 2.6 }
  })
}

/** El Guardián (modo Defensa): jardinera con sombrero de paja, peto y un cañón de semillas hecho con una regadera. */
export function heroDef(): ModelDef {
  return template('hero', () => {
    const body = new Piece('body', [0, 0.6, 0])
    body.box(0x4a8ac8, 0.6, 0.62, 0.42, [0, 0.3, 0], {}, 0.35) // peto vaquero
    body.box(0xf2e2b0, 0.64, 0.3, 0.44, [0, 0.52, 0], {}, 0.35) // camisa
    body.box(0x4a8ac8, 0.09, 0.3, 0.05, [-0.17, 0.52, 0.21], {}, 0.3).box(0x4a8ac8, 0.09, 0.3, 0.05, [0.17, 0.52, 0.21], {}, 0.3)
    body.sph(C.gold, 0.04, [-0.17, 0.4, 0.24]).sph(C.gold, 0.04, [0.17, 0.4, 0.24])
    body.box(0x3a6aa0, 0.3, 0.2, 0.04, [0, 0.2, 0.22], {}, 0.3) // bolsillo
    body.cone(C.leaf, 0.06, 0.2, [0.06, 0.36, 0.24], { r: [0, 0, -0.3] }, 5)

    const head = new Piece('head', [0, 0.7, 0], 'body')
    head.sph(0xf5c9a0, 0.36, [0, 0.34, 0], { s: [1, 0.95, 0.95] })
    head.eye([-0.14, 0.38, 0.28], 0.1, 0x3a2a1a).eye([0.14, 0.38, 0.28], 0.1, 0x3a2a1a)
    head.sph(0xf0a890, 0.07, [-0.24, 0.26, 0.24], { s: [1, 0.6, 0.4] }).sph(0xf0a890, 0.07, [0.24, 0.26, 0.24], { s: [1, 0.6, 0.4] }) // coloretes
    head.box(0x8a3a3a, 0.14, 0.04, 0.04, [0, 0.2, 0.33], {}, 0.45)
    head.sph(0x8a4a2a, 0.2, [-0.28, 0.2, -0.1]).sph(0x8a4a2a, 0.2, [0.28, 0.2, -0.1]) // coletas
    head.sph(0x8a4a2a, 0.37, [0, 0.38, -0.04], { s: [1, 0.95, 0.95] })
    // sombrero de paja de ala ancha con una flor
    head.cyl(0xe8c870, 0.62, 0.66, 0.06, [0, 0.6, 0], {}, 20)
    head.lathe(0xe8c870, [[0.0, 0.26], [0.2, 0.24], [0.33, 0.1], [0.36, 0.0]], [0, 0.62, 0])
    head.torus(0xd9463e, 0.345, 0.035, [0, 0.66, 0], { r: [Math.PI / 2, 0, 0] })
    for (let i = 0; i < 5; i++) head.sph(0xff7ab8, 0.07, [0.3 + Math.cos((i / 5) * Math.PI * 2) * 0.08, 0.72 + Math.sin((i / 5) * Math.PI * 2) * 0.08, 0.2])
    head.lit.sph(0xffe45a, 0.05, [0.3, 0.72, 0.24])

    // cañón: regadera reconvertida, con depósito de semillas
    const gun = new Piece('gun', [0.24, 0.36, 0.3], 'body')
    gun.cyl(0x6ab04a, 0.2, 0.2, 0.5, [0, 0, 0.1], { r: [Math.PI / 2, 0, 0] }, 14)
    gun.cyl(0x4a8a3a, 0.09, 0.13, 0.6, [0, 0.02, 0.6], { r: [Math.PI / 2, 0, 0] }, 12)
    gun.cyl(0x3a6a2a, 0.17, 0.12, 0.1, [0, 0.02, 0.92], { r: [Math.PI / 2, 0, 0] }, 12)
    gun.torus(0x4a8a3a, 0.16, 0.035, [0, 0.14, -0.12], { r: [0, Math.PI / 2, 0] })
    gun.sph(0xd9a86a, 0.2, [0, 0.26, 0.1], { s: [1, 0.8, 1] })
    gun.lit.sph(0xc8f06a, 0.07, [0, 0.02, 0.97])

    const arm = (name: string, sx: number) => {
      const a = new Piece(name, [sx * 0.38, 0.56, 0], 'body', [-1.1, 0, sx * -0.25])
      a.cap(0xf2e2b0, 0.09, 0.16, [0, -0.1, 0])
      a.cap(0xf5c9a0, 0.075, 0.2, [0, -0.34, 0])
      a.sph(0x8a5a3a, 0.1, [0, -0.5, 0]) // guantes
      return a
    }
    const leg = (name: string, sx: number) => {
      const l = new Piece(name, [sx * 0.16, 0.6, 0])
      l.cap(0x4a8ac8, 0.11, 0.24, [0, -0.24, 0])
      l.box(0xd9463e, 0.24, 0.26, 0.34, [0, -0.46, 0.03], {}, 0.4) // botas de agua
      return l
    }
    const cape = new Piece('cape', [0, 0.6, -0.24], 'body')
    for (let i = 0; i < 3; i++) cape.sph(C.leaf, 0.2, [(i - 1) * 0.2, -0.2 - (i % 2) * 0.08, 0], { s: [0.8, 1.4, 0.3], r: [0, 0, (i - 1) * 0.3] })
    return { pieces: [body, head, gun, arm('armL', -1), arm('armR', 1), leg('legL', -1), leg('legR', 1), cape], scale: 1.25, top: 2.3 }
  })
}

// ───────────────────────────── guardianes ─────────────────────────────

const potPiece = (p: Piece, y = 0): Piece =>
  p
    .lathe(C.pot, [[0.0, 0.0], [0.3, 0.0], [0.42, 0.34], [0.46, 0.36], [0.46, 0.44], [0.36, 0.44], [0.34, 0.38], [0.0, 0.38]], [0, y, 0])
    .cyl(0x5a3a22, 0.35, 0.35, 0.04, [0, y + 0.4, 0], {}, 14)

export function guardianDef(kind: GuardianKind): ModelDef {
  return template(`g:${kind}`, () => {
    switch (kind) {
      case 'brote': {
        // semilla regordeta con dos hojas, ojazos y pies diminutos
        const body = new Piece('body', [0, 0.14, 0])
        body.sph(0xe0aa62, 0.62, [0, 0.56, 0], { s: [1, 0.95, 0.95] })
        body.sph(0xeec088, 0.3, [-0.16, 0.76, 0.34], { s: [1, 0.8, 0.5] }) // brillo
        body.eye([-0.2, 0.62, 0.48], 0.15, C.dark, C.white, [0.1, 0]).eye([0.2, 0.62, 0.48], 0.15, C.dark, C.white, [-0.1, 0])
        body.box(C.dark, 0.16, 0.04, 0.04, [0, 0.4, 0.58], {}, 0.45)
        body.sph(0xf0a890, 0.08, [-0.36, 0.46, 0.42], { s: [1, 0.6, 0.4] }).sph(0xf0a890, 0.08, [0.36, 0.46, 0.42], { s: [1, 0.6, 0.4] })
        body.cyl(C.leafDark, 0.04, 0.05, 0.2, [0, 1.2, 0], {}, 8)
        body.sph(C.leaf, 0.26, [-0.26, 1.34, 0], { s: [1.3, 0.3, 0.7], r: [0, 0, 0.5] }).sph(C.leafLight, 0.24, [0.26, 1.36, 0], { s: [1.3, 0.3, 0.7], r: [0, 0, -0.5] })
        const feet = new Piece('feet')
        feet.sph(0xc08a4a, 0.18, [-0.26, 0.1, 0.08], { s: [1, 0.6, 1.2] }).sph(0xc08a4a, 0.18, [0.26, 0.1, 0.08], { s: [1, 0.6, 1.2] })
        return { pieces: [body, feet], top: 1.9 }
      }
      case 'lanzabrotes': {
        // maceta, tallo y cabeza redonda con collar de pétalos, ceño fruncido y cañón de madera
        const base = potPiece(new Piece('base'))
        base.cyl(C.leafDark, 0.07, 0.09, 0.7, [0, 0.76, 0], { r: [0.12, 0, 0] }, 8)
        base.sph(C.leaf, 0.22, [0.26, 0.6, 0], { s: [1.4, 0.3, 0.7], r: [0, 0, -0.5] }).sph(C.leaf, 0.2, [-0.24, 0.72, 0], { s: [1.4, 0.3, 0.7], r: [0, 0, 0.6] })
        const head = new Piece('head', [0, 1.3, 0.06])
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2
          head.sph(i % 2 ? 0xffc93a : 0xffa62a, 0.2, [Math.cos(a) * 0.44, Math.sin(a) * 0.44, -0.08], { s: [1, 1, 0.4] })
        }
        head.sph(0xf08a2a, 0.42, [0, 0, 0])
        head.sph(0xf8a84a, 0.2, [-0.14, 0.18, 0.26], { s: [1, 0.8, 0.5] })
        head.eye([-0.17, 0.12, 0.33], 0.1).eye([0.17, 0.12, 0.33], 0.1)
        head.box(C.dark, 0.2, 0.05, 0.05, [-0.17, 0.26, 0.36], { r: [0, 0, -0.45] }, 0.4).box(C.dark, 0.2, 0.05, 0.05, [0.17, 0.26, 0.36], { r: [0, 0, 0.45] }, 0.4)
        head.cyl(C.wood, 0.17, 0.2, 0.42, [0, -0.1, 0.52], { r: [Math.PI / 2, 0, 0] }, 12)
        head.torus(C.woodDark, 0.19, 0.035, [0, -0.1, 0.72])
        head.cyl(C.dark, 0.13, 0.13, 0.02, [0, -0.1, 0.735], { r: [Math.PI / 2, 0, 0] }, 12)
        return { pieces: [base, head], top: 2.1 }
      }
      case 'tronco': {
        // tocón con anillos, escudo de tablas, cejas de hoja, ceño y un brote
        const body = new Piece('body')
        body.lathe(0xa5683a, [[0.0, 0.0], [1.25, 0.0], [1.12, 0.3], [1.05, 1.5], [1.1, 1.78], [0.0, 1.78]], [0, 0, 0])
        body.cyl(0xe0b47a, 0.98, 0.98, 0.04, [0, 1.8, 0], {}, 18)
        body.torus(0xc08a4a, 0.6, 0.03, [0, 1.82, 0], { r: [Math.PI / 2, 0, 0] }).torus(0xc08a4a, 0.3, 0.03, [0, 1.82, 0], { r: [Math.PI / 2, 0, 0] })
        for (let i = -1; i <= 1; i++) body.box(i ? 0x8a5630 : 0x9a6236, 0.44, 1.0, 0.16, [i * 0.46, 0.75, 1.02], {}, 0.2)
        body.box(0x6f4526, 1.46, 0.12, 0.2, [0, 1.1, 1.04], {}, 0.3).box(0x6f4526, 1.46, 0.12, 0.2, [0, 0.4, 1.04], {}, 0.3)
        body.sph(C.leaf, 0.24, [-0.42, 1.52, 1.0], { s: [1.5, 0.5, 0.4], r: [0, 0, -0.4] }).sph(C.leaf, 0.24, [0.42, 1.52, 1.0], { s: [1.5, 0.5, 0.4], r: [0, 0, 0.4] })
        body.sph(C.dark, 0.09, [-0.4, 1.36, 1.06], { s: [1, 1, 0.5] }).sph(C.dark, 0.09, [0.4, 1.36, 1.06], { s: [1, 1, 0.5] })
        body.cyl(C.leafDark, 0.04, 0.05, 0.3, [0.3, 1.96, 0.1], {}, 8)
        body.sph(C.leafLight, 0.18, [0.16, 2.16, 0.1], { s: [1.3, 0.3, 0.7], r: [0, 0, 0.5] }).sph(C.leaf, 0.18, [0.44, 2.16, 0.1], { s: [1.3, 0.3, 0.7], r: [0, 0, -0.5] })
        for (let i = 0; i < 5; i++) body.sph(0x8a5630, 0.26, [Math.cos(i * 1.3) * 1.15, 0.1, Math.sin(i * 1.3) * 1.15], { s: [1.4, 0.5, 1] }) // raíces
        return { pieces: [body], top: 2.7 }
      }
      case 'glacial': {
        // flor de cristales de hielo con cara dormilona
        const base = potPiece(new Piece('base'))
        base.cyl(0x4ab0b8, 0.06, 0.08, 0.6, [0, 0.72, 0], {}, 8)
        const head = new Piece('head', [0, 1.3, 0])
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2
          head.lit.cone(0xbfefff, 0.17, 0.7, [Math.cos(a) * 0.46, 0, Math.sin(a) * 0.46], { r: [Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3] }, 5)
          head.lit.cone(0x7fd0ff, 0.1, 0.4, [Math.cos(a + 0.52) * 0.36, 0.14, Math.sin(a + 0.52) * 0.36], { r: [Math.sin(a + 0.52) * 0.9, 0, -Math.cos(a + 0.52) * 0.9] }, 5)
        }
        head.sph(0xe8fbff, 0.3, [0, 0.05, 0])
        head.sph(0x2a6a9a, 0.045, [-0.11, 0.1, 0.27]).sph(0x2a6a9a, 0.045, [0.11, 0.1, 0.27])
        head.box(0x2a6a9a, 0.08, 0.03, 0.03, [0, 0.0, 0.29], {}, 0.45)
        const ring = new Piece('ring')
        ring.lit.torus(0x9fe7ff, 5.4, 0.05, [0, 0.06, 0], { r: [Math.PI / 2, 0, 0] })
        return { pieces: [base, head, ring], top: 2.1 }
      }
      case 'hongo': {
        // seta gorda con manchas que brillan y sonrisa traviesa
        const body = new Piece('body')
        body.lathe(0xf2e6c8, [[0.0, 0.0], [0.3, 0.0], [0.34, 0.2], [0.26, 0.5], [0.0, 0.5]], [0, 0, 0])
        body.eye([-0.12, 0.3, 0.26], 0.08).eye([0.12, 0.3, 0.26], 0.08)
        body.box(C.dark, 0.16, 0.05, 0.04, [0, 0.14, 0.31], {}, 0.45)
        const cap = new Piece('cap', [0, 0.46, 0])
        cap.sph(0xc93a7a, 0.62, [0, 0.06, 0], { s: [1, 0.62, 1] })
        cap.cyl(0xf2e6c8, 0.5, 0.56, 0.06, [0, 0.0, 0], {}, 16)
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2
          cap.lit.sph(0xffd24a, 0.11, [Math.cos(a) * 0.4, 0.28, Math.sin(a) * 0.4], { s: [1, 0.5, 1] })
        }
        cap.lit.sph(0xffd24a, 0.13, [0, 0.43, 0], { s: [1, 0.5, 1] })
        cap.cyl(0x5a3a22, 0.02, 0.02, 0.22, [0, 0.54, 0], {}, 6)
        cap.lit.sph(0xff8a2a, 0.06, [0, 0.68, 0])
        return { pieces: [body, cap], top: 1.6 }
      }
      case 'raiz': {
        // maceta con raíces trenzadas que sostienen un corazón verde que late
        const base = potPiece(new Piece('base'))
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.4
          base.cap(0x9a7a4a, 0.055, 0.5, [Math.cos(a) * 0.24, 0.72, Math.sin(a) * 0.24], { r: [-Math.sin(a) * 0.45, 0, Math.cos(a) * 0.45] })
        }
        base.sph(C.leaf, 0.2, [0.34, 0.5, 0], { s: [1.4, 0.3, 0.7], r: [0, 0, -0.6] })
        const core = new Piece('body', [0, 1.12, 0])
        core.lit.sph(0x8affae, 0.3, [0, 0, 0])
        core.lit.sph(0xd8ffe2, 0.14, [-0.08, 0.1, 0.18])
        core.box(0xffffff, 0.2, 0.06, 0.04, [0, 0, 0.3], {}, 0.3).box(0xffffff, 0.06, 0.2, 0.04, [0, 0, 0.3], {}, 0.3)
        return { pieces: [base, core], top: 2.0 }
      }
      default: {
        // Guardián Ancestral: roble enorme con cara, copa frondosa con frutos de luz y dos brazos de rama
        const body = new Piece('body')
        body.lathe(0x7a5230, [[0.0, 0.0], [2.3, 0.0], [1.8, 0.6], [1.5, 2.6], [1.7, 4.4], [0.0, 4.6]], [0, 0, 0])
        for (let i = 0; i < 6; i++) body.sph(0x6a4526, 0.5, [Math.cos(i * 1.05) * 2.1, 0.2, Math.sin(i * 1.05) * 2.1], { s: [1.5, 0.5, 1] })
        const crown: [number, number, number, number][] = [[0, 6.2, 0, 2.6], [-1.9, 5.4, 0.4, 1.7], [1.9, 5.5, -0.3, 1.8], [0.3, 5.3, 1.8, 1.6], [-0.4, 5.4, -1.8, 1.6], [0, 7.6, 0, 1.5]]
        crown.forEach(([x, y, z, r], i) => body.sph(i % 2 ? C.leaf : C.leafDark, r, [x, y, z], { s: [1, 0.85, 1] }))
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2
          body.lit.sph(0xffd86a, 0.24, [Math.cos(a) * 2.7, 5.4 + (i % 2) * 0.9, Math.sin(a) * 2.7])
        }
        body.lit.sph(0xffb020, 0.3, [-0.62, 3.2, 1.5], { s: [1, 0.8, 0.5] })
        body.lit.sph(0xffb020, 0.3, [0.62, 3.2, 1.5], { s: [1, 0.8, 0.5] })
        body.box(0x4a321e, 0.7, 0.12, 0.1, [-0.62, 3.7, 1.52], { r: [0, 0, -0.4] }, 0.4).box(0x4a321e, 0.7, 0.12, 0.1, [0.62, 3.7, 1.52], { r: [0, 0, 0.4] }, 0.4)
        body.box(0x3a2414, 1.0, 0.3, 0.1, [0, 2.3, 1.56], {}, 0.45)
        body.sph(C.leafLight, 0.5, [0, 2.0, 1.55], { s: [1.4, 0.6, 0.3] }) // bigote de musgo
        const arm = (name: string, sx: number) => {
          const a = new Piece(name, [sx * 1.7, 3.4, 0], '', [-0.3, 0, 0])
          a.cap(0x6a4526, 0.36, 2.0, [0, -1.2, 0.4], { r: [0.3, 0, 0] })
          a.sph(0x6a4526, 0.6, [0, -2.5, 0.8])
          a.sph(C.leaf, 0.4, [0, -0.3, 0.2])
          return a
        }
        return { pieces: [body, arm('armL', -1), arm('armR', 1)], top: 8.6 }
      }
    }
  })
}

// ───────────────────────────── proyectiles ─────────────────────────────

export function seedDef(): ModelDef {
  return template('seed', () => {
    const p = new Piece('body')
    p.lit.sph(0xd8ff7a, 0.2, [0, 0, 0], { s: [0.8, 0.8, 1.3] })
    return { pieces: [p], top: 0 }
  })
}

/** Lo que cae del cielo en la tormenta de semillas y el bombardeo: una calabaza con cara de pocos amigos. */
export function pumpkinDef(): ModelDef {
  return template('pumpkin', () => {
    const p = new Piece('body')
    for (let i = 0; i < 6; i++) p.sph(i % 2 ? 0xf08a2a : 0xe0782a, 0.36, [Math.cos((i / 6) * Math.PI * 2) * 0.2, 0, Math.sin((i / 6) * Math.PI * 2) * 0.2], { s: [1, 1.1, 1] })
    p.cyl(0x5a8a3a, 0.05, 0.07, 0.2, [0, 0.42, 0], {}, 6)
    p.lit.sph(0xffe45a, 0.09, [-0.16, 0.06, 0.5], { s: [1, 0.7, 0.4] })
    p.lit.sph(0xffe45a, 0.09, [0.16, 0.06, 0.5], { s: [1, 0.7, 0.4] })
    p.lit.box(0xffe45a, 0.3, 0.07, 0.05, [0, -0.14, 0.52], {}, 0.3)
    return { pieces: [p], top: 0 }
  })
}
