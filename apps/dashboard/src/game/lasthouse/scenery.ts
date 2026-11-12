/**
 * LAST HOUSE — escenario en estilo dibujo animado (todo propio, construido por código).
 *
 * Jardín por carriles con césped a cuadros de dos verdes, setos redondeados, valla blanca, árboles frondosos de copa
 * en racimo, farolas, buzón, caminito de piedras, flores y la última casa: tejado de tejas redondeadas, chimenea,
 * porche con escalones, ventanas con contraventanas y jardineras.
 *
 * Todo lo que no se mueve se funde en unas pocas mallas (sombreado por escalones + contorno), así el escenario cuesta
 * casi nada aunque tenga cientos de piezas.
 */
import * as THREE from 'three'
import { GLOW, OUTLINE, Piece, TOON } from './models'
import { HALF_W, LANES, LANE_W, LENGTH } from './sim'

export interface Scenery {
  group: THREE.Group
  /** materiales que se iluminan de noche (ventanas, farolas) */
  nightGlow: THREE.MeshBasicMaterial
  /** sitios de las farolas (para poner luces reales en unas pocas) */
  lamps: [number, number, number][]
}

function rand(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Césped a cuadros por carriles, con briznas y rayas de cortacésped (textura de lienzo). */
function lawnTexture(): THREE.CanvasTexture {
  const cell = 64
  const rows = 22
  const cnv = document.createElement('canvas')
  cnv.width = LANES * cell
  cnv.height = rows * cell
  const ctx = cnv.getContext('2d')!
  const r = rand(7)
  for (let i = 0; i < LANES; i++)
    for (let j = 0; j < rows; j++) {
      const light = (i + j) % 2 === 0
      const g = ctx.createLinearGradient(0, j * cell, 0, (j + 1) * cell)
      g.addColorStop(0, light ? '#86d955' : '#6cc444')
      g.addColorStop(1, light ? '#7bd04c' : '#62b83d')
      ctx.fillStyle = g
      ctx.fillRect(i * cell, j * cell, cell, cell)
      // briznas
      for (let k = 0; k < 26; k++) {
        ctx.fillStyle = light ? (r() < 0.5 ? '#9ae866' : '#72c84a') : r() < 0.5 ? '#7fd654' : '#58ad38'
        const x = i * cell + r() * cell
        const y = j * cell + r() * cell
        ctx.fillRect(x, y, 2, 4 + r() * 3)
      }
      // florecillas sueltas
      if (r() < 0.25) {
        ctx.fillStyle = r() < 0.5 ? '#ffffff' : '#ffe066'
        ctx.beginPath()
        ctx.arc(i * cell + 8 + r() * (cell - 16), j * cell + 8 + r() * (cell - 16), 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  // bordes de carril más oscuros
  ctx.fillStyle = 'rgba(30,80,20,0.18)'
  for (let i = 1; i < LANES; i++) ctx.fillRect(i * cell - 1, 0, 2, rows * cell)
  const tex = new THREE.CanvasTexture(cnv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

const GREEN = [0x4fb83c, 0x5cc845, 0x43a838, 0x6ad050]

/** Árbol de copa en racimo (varias esferas) con tronco algo curvado. */
function tree(p: Piece, x: number, z: number, s: number, r: () => number): void {
  p.cyl(0x8a5630, 0.32 * s, 0.5 * s, 3 * s, [x, 1.5 * s, z], { r: [0, 0, (r() - 0.5) * 0.15] }, 8)
  p.sph(0x7a4a28, 0.5 * s, [x, 0.15 * s, z], { s: [1.6, 0.5, 1.6] })
  const n = 5 + Math.floor(r() * 3)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r()
    const d = (0.9 + r() * 0.7) * s
    p.sph(GREEN[i % GREEN.length]!, (1.2 + r() * 0.6) * s, [x + Math.cos(a) * d, (3.6 + r() * 1.2) * s, z + Math.sin(a) * d])
  }
  p.sph(GREEN[1]!, 1.6 * s, [x, 4.6 * s, z])
}

/** Arbusto redondo con flores. */
function bush(p: Piece, x: number, z: number, s: number, flower: number): void {
  p.sph(0x48b03a, 0.8 * s, [x, 0.5 * s, z], { s: [1.2, 0.85, 1] })
  p.sph(0x5cc845, 0.6 * s, [x + 0.6 * s, 0.4 * s, z + 0.2 * s])
  for (let i = 0; i < 4; i++) p.sph(flower, 0.14 * s, [x + Math.cos(i * 1.7) * 0.6 * s, 0.9 * s, z + Math.sin(i * 1.7) * 0.5 * s])
}

export function buildScenery(): Scenery {
  const group = new THREE.Group()
  const r = rand(1337)
  const world = new Piece('world')
  const lit = new Piece('lit')

  // ── suelo exterior: prado verde ondulado y calle con acera
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, LENGTH), new THREE.MeshToonMaterial({ map: lawnTexture(), gradientMap: (TOON as THREE.MeshToonMaterial).gradientMap }))
  lawn.rotation.x = -Math.PI / 2
  lawn.position.set(0, 0.01, LENGTH / 2)
  lawn.receiveShadow = true
  group.add(lawn)
  const meadow = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), new THREE.MeshToonMaterial({ color: 0x5cbf45, gradientMap: (TOON as THREE.MeshToonMaterial).gradientMap }))
  meadow.rotation.x = -Math.PI / 2
  meadow.position.set(0, -0.02, LENGTH / 2)
  meadow.receiveShadow = true
  group.add(meadow)
  world.box(0xe8e0d0, 60, 0.12, 4.6, [0, 0.0, -2.6], {}, 0) // acera
  world.box(0x5a5f6e, 70, 0.06, 10, [0, -0.03, -10], {}, 0) // calle
  for (let x = -30; x < 32; x += 6) world.box(0xf5e8a0, 2.6, 0.02, 0.3, [x, 0.02, -10], {}, 0)
  world.box(0xc9c0ae, 60, 0.2, 0.3, [0, 0.08, -0.35], {}, 0.4) // bordillo

  // ── setos redondeados a cada lado (tramos con «almohadillas» encima) y valla blanca por fuera
  for (const sx of [-1, 1]) {
    const x = sx * (HALF_W + 0.9)
    for (let z = 0; z < LENGTH + 2; z += 4) {
      world.box(z % 8 === 0 ? 0x3e9e36 : 0x45a83b, 1.7, 1.5, 4.2, [x, 0.75, z + 1.5], {}, 0.45)
      world.sph(0x52b844, 0.75, [x, 1.5, z + 0.5], { s: [1.1, 0.6, 1.4] })
      world.sph(0x4aaf3e, 0.7, [x, 1.5, z + 2.5], { s: [1.1, 0.6, 1.4] })
    }
    const fx = sx * (HALF_W + 3.4)
    for (let z = -0.5; z < LENGTH + 1; z += 0.9) {
      world.box(0xfbf6ec, 0.22, 1.1, 0.12, [fx, 0.55, z], {}, 0.25)
      world.cone(0xfbf6ec, 0.16, 0.25, [fx, 1.22, z], { r: [0, Math.PI / 4, 0] }, 4)
    }
    world.box(0xf2ece0, 0.08, 0.12, LENGTH + 2, [fx, 0.75, LENGTH / 2], {}, 0.3)
    world.box(0xf2ece0, 0.08, 0.12, LENGTH + 2, [fx, 0.35, LENGTH / 2], {}, 0.3)
  }

  // ── árboles, arbustos y piedras fuera de la valla
  const FL = [0xff6fb5, 0xffe066, 0xffffff, 0xff8a5a, 0xb08aff]
  for (const sx of [-1, 1])
    for (let z = 2; z < LENGTH + 10; z += 9) {
      tree(world, sx * (HALF_W + 8 + r() * 6), z + r() * 4, 0.9 + r() * 0.5, r)
      if (r() < 0.6) tree(world, sx * (HALF_W + 18 + r() * 14), z + r() * 6, 1 + r() * 0.6, r)
      bush(world, sx * (HALF_W + 4.8 + r() * 1.5), z + 3 + r() * 3, 0.8 + r() * 0.4, FL[Math.floor(r() * FL.length)]!)
      if (r() < 0.5) world.sph(0xa8a8b4, 0.4 + r() * 0.3, [sx * (HALF_W + 6 + r() * 10), 0.15, z + r() * 8], { s: [1.3, 0.6, 1] })
    }

  // ── farolas (bombilla brillante; de noche se encienden unas pocas luces reales)
  const lamps: [number, number, number][] = []
  for (const sx of [-1, 1])
    for (let z = 10; z < LENGTH - 4; z += 22) {
      const x = sx * (HALF_W + 2.3)
      const zz = z + (sx > 0 ? 11 : 0)
      world.cyl(0x3a3a4a, 0.09, 0.14, 3.2, [x, 1.6, zz], {}, 8)
      world.sph(0x3a3a4a, 0.2, [x, 0.1, zz], { s: [1.4, 0.6, 1.4] })
      world.cone(0x3a3a4a, 0.42, 0.3, [x, 3.75, zz], {}, 8)
      lit.sph(0xffe9a8, 0.26, [x, 3.42, zz])
      lamps.push([x, 3.4, zz])
    }

  // ── caminito de piedras hacia la puerta y buzón
  for (let i = 0; i < 6; i++) world.cyl(0xd8d0c0, 0.5, 0.55, 0.08, [((i % 2) - 0.5) * 0.6, 0.04, LENGTH - 7 + i * 1.2], { s: [1, 1, 0.8] }, 10)
  world.cyl(0x8a5630, 0.07, 0.07, 1.3, [HALF_W - 1, 0.65, 0.4], {}, 6)
  world.box(0x4a8ac8, 0.5, 0.42, 0.8, [HALF_W - 1, 1.45, 0.4], {}, 0.45)
  world.box(0xd9463e, 0.06, 0.32, 0.12, [HALF_W - 0.72, 1.6, 0.6], {}, 0.2)

  // ── la última casa
  const H = LENGTH + 6
  world.box(0xfaf0dc, 22, 6.6, 9, [0, 3.3, H], {}, 0.04) // paredes
  world.box(0xe8d4b4, 22.4, 0.6, 9.4, [0, 0.3, H], {}, 0.2) // zócalo
  for (let y = 1.2; y < 6.4; y += 0.6) world.box(0xf0e2c8, 22.02, 0.05, 9.02, [0, y, H], {}, 0) // listones
  // tejado: dos faldones de tejas redondeadas
  for (const sz of [-1, 1]) {
    for (let row = 0; row < 6; row++) {
      const y = 6.9 + row * 0.62
      const z = H + sz * (5.2 - row * 0.85)
      for (let x = -11.6; x <= 11.6; x += 1.2)
        world.box(row % 2 ? 0xd9573e : 0xe06548, 1.26, 0.34, 1.2, [x + (row % 2) * 0.6, y, z], { r: [sz * 0.63, 0, 0] }, 0.45)
    }
  }
  world.box(0xb8432f, 24, 0.5, 0.7, [0, 10.6, H], {}, 0.45) // cumbrera
  world.box(0xb05a40, 1.6, 3.2, 1.6, [7, 10.6, H + 1], {}, 0.15) // chimenea
  world.box(0x8a4a3a, 1.9, 0.4, 1.9, [7, 12.3, H + 1], {}, 0.3)
  // fachada (mira al jardín: −z)
  const F = H - 4.55
  world.box(0x8a4a2a, 2.8, 4.6, 0.3, [0, 2.3, F], {}, 0.12) // puerta
  world.box(0x9a5a34, 2.3, 1.7, 0.08, [0, 3.2, F - 0.18], {}, 0.2).box(0x9a5a34, 2.3, 1.7, 0.08, [0, 1.25, F - 0.18], {}, 0.2)
  world.sph(0xf5c63a, 0.14, [0.9, 2.2, F - 0.25])
  world.box(0xfbf6ec, 3.4, 0.35, 0.5, [0, 4.75, F - 0.1], {}, 0.3)
  lit.cyl(0xffd27a, 0.5, 0.5, 0.06, [0, 4.0, F - 0.2], { r: [Math.PI / 2, 0, 0] }, 16) // ojo de buey de la puerta
  // porche con escalones, columnas y tejadillo
  world.box(0xd8ccb4, 6, 0.4, 2.4, [0, 0.2, F - 1.3], {}, 0.2)
  world.box(0xccbea4, 5, 0.25, 1.0, [0, 0.12, F - 2.9], {}, 0.2)
  for (const x of [-2.6, 2.6]) world.cyl(0xfbf6ec, 0.16, 0.2, 4.6, [x, 2.5, F - 2.2], {}, 10)
  world.box(0xd9573e, 6.4, 0.3, 2.8, [0, 4.95, F - 1.3], { r: [0.12, 0, 0] }, 0.3)
  // ventanas con marco, cruz, contraventanas y jardinera con flores
  for (const x of [-6.5, 6.5]) {
    lit.box(0xffe4a0, 3.0, 2.4, 0.1, [x, 3.6, F - 0.02], {}, 0.1)
    world.box(0xfbf6ec, 3.4, 0.25, 0.3, [x, 4.9, F - 0.1], {}, 0.3).box(0xfbf6ec, 3.4, 0.25, 0.3, [x, 2.3, F - 0.1], {}, 0.3)
    world.box(0xfbf6ec, 0.12, 2.4, 0.16, [x, 3.6, F - 0.08], {}, 0).box(0xfbf6ec, 3.0, 0.12, 0.16, [x, 3.6, F - 0.08], {}, 0)
    for (const sx of [-1, 1]) world.box(0x4a8ac8, 0.9, 2.6, 0.12, [x + sx * 2.05, 3.6, F - 0.12], {}, 0.2)
    world.box(0x9a5a34, 3.2, 0.5, 0.6, [x, 1.95, F - 0.4], {}, 0.3)
    for (let i = 0; i < 5; i++) world.sph(FL[i]!, 0.22, [x - 1.2 + i * 0.6, 2.35, F - 0.4]).sph(0x4fb83c, 0.18, [x - 0.9 + i * 0.6, 2.25, F - 0.5])
  }
  // macetas a los lados de la puerta
  for (const x of [-3.6, 3.6]) {
    world.lathe(0xd4703d, [[0, 0], [0.4, 0], [0.55, 0.7], [0.6, 0.8], [0, 0.8]], [x, 0, F - 0.9])
    world.sph(0x4fb83c, 0.6, [x, 1.15, F - 0.9])
    world.sph(0xff6fb5, 0.18, [x + 0.2, 1.5, F - 1.3])
  }

  // ── fundir en mallas
  const w = world.build()
  const l = lit.build()
  if (w.toon) {
    const m = new THREE.Mesh(w.toon, TOON)
    m.castShadow = true
    m.receiveShadow = true
    group.add(m, new THREE.Mesh(w.toon, OUTLINE))
  }
  const nightGlow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: 0x9a8a70 })
  nightGlow.userData.shared = true
  if (l.glow ?? l.toon) group.add(new THREE.Mesh((l.toon ?? l.glow)!, nightGlow))
  void GLOW
  void LANE_W

  // ── meta: franja dorada a ras de suelo
  const goal = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, 2.2), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.45, toneMapped: false }))
  goal.rotation.x = -Math.PI / 2
  goal.position.set(0, 0.04, LENGTH - 0.6)
  group.add(goal)
  return { group, nightGlow, lamps }
}

/** Nubes de algodón (sombreado plano, se mueven despacio). */
export function buildClouds(): THREE.Group {
  const g = new THREE.Group()
  const r = rand(99)
  const p = new Piece('clouds')
  for (let i = 0; i < 12; i++) {
    const cx = -150 + i * 28 + r() * 10
    const cy = 48 + r() * 18
    const cz = 40 + r() * 180
    const n = 4 + Math.floor(r() * 3)
    for (let j = 0; j < n; j++) p.sph(0xffffff, 4 + r() * 3.5, [cx + j * 5 - n * 2.5, cy + r() * 2.5, cz + (r() - 0.5) * 5], { s: [1.2, 0.8, 1] })
    p.sph(0xeef4ff, 6, [cx, cy - 1.8, cz], { s: [n * 0.5, 0.35, 1] })
  }
  const b = p.build()
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: (TOON as THREE.MeshToonMaterial).gradientMap, fog: false })
  if (b.toon) g.add(new THREE.Mesh(b.toon, m))
  return g
}
