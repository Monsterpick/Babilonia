/**
 * LAST HOUSE — vista 3D (Three.js). Dibuja el estado de cualquiera de los dos modos (RenderState): jardín, casa,
 * personaje del streamer (Rey de la Horda o Guardián), horda, guardianes, disparos y efectos. Todos los modelos se
 * construyen aquí con formas simples (diseños propios, sin recursos externos) y se animan por código.
 *
 * Rendimiento: geometrías y materiales compartidos para lo que se crea a menudo (partículas, disparos, anillos) y
 * liberación de memoria de cada modelo al quitarlo, para aguantar directos de horas.
 */
import * as THREE from 'three'
import { type HeroView, type Mode, type RenderState, type UnitView, type ZombieKind, ZOMBIES } from './common'
import { GUARDIANS, HALF_W, LANES, LENGTH, type Fx, type Guardian, type GuardianKind } from './sim'

const mat = (color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...opts })

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, cast = true): THREE.Mesh {
  const o = new THREE.Mesh(geo, m)
  o.position.set(x, y, z)
  o.castShadow = cast
  o.receiveShadow = true
  return o
}

const G = {
  box: (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d),
  sph: (r: number, s = 10) => new THREE.SphereGeometry(r, s, Math.max(6, s - 2)),
  cyl: (a: number, b: number, h: number, s = 10) => new THREE.CylinderGeometry(a, b, h, s),
  cone: (r: number, h: number, s = 8) => new THREE.ConeGeometry(r, h, s),
}

/** Libera geometrías y materiales de un modelo (no los compartidos, marcados con userData.shared). */
function disposeTree(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh
    if (!m.isMesh) return
    if (!m.geometry.userData.shared) m.geometry.dispose()
    const mm = m.material as THREE.Material | THREE.Material[]
    for (const x of Array.isArray(mm) ? mm : [mm]) if (!x.userData.shared) x.dispose()
  })
}

interface Actor {
  root: THREE.Group
  parts: Record<string, THREE.Object3D>
  bar?: { bg: THREE.Mesh; fill: THREE.Mesh; w: number }
  born: number
  /** materiales que se tiñen (frío, golpe) */
  tint?: THREE.MeshStandardMaterial[]
}

// ───────────────────────────── modelos ─────────────────────────────

/** El Rey de la Horda: zombi grandullón con corona torcida y capa hecha jirones. */
function kingModel(crown: number): Actor {
  const root = new THREE.Group()
  const skin = mat(0x7fae6a)
  const dark = mat(0x4d7a48)
  const cloth = mat(0x5b2a6e)
  const gold = mat(crown, { metalness: 0.5, roughness: 0.4, emissive: crown, emissiveIntensity: 0.18 })
  const body = new THREE.Group()
  root.add(body)
  body.add(mesh(G.box(1.05, 1.15, 0.62), cloth, 0, 1.45, 0))
  body.add(mesh(G.box(1.1, 0.22, 0.66), mat(0x2f1638), 0, 0.95, 0))
  // hombreras con pinchos
  for (const sx of [-1, 1]) {
    body.add(mesh(G.box(0.42, 0.22, 0.5), mat(0x3a2448), sx * 0.62, 2.0, 0))
    body.add(mesh(G.cone(0.08, 0.26, 4), gold, sx * 0.72, 2.2, 0))
  }
  const head = new THREE.Group()
  head.position.set(0, 2.42, 0.02)
  head.add(mesh(G.box(0.86, 0.8, 0.8), skin))
  head.add(mesh(G.box(0.9, 0.2, 0.84), dark, 0, -0.34, 0))
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xfff27a })
  head.add(mesh(G.box(0.2, 0.2, 0.06), eyeM, -0.2, 0.08, 0.41, false))
  head.add(mesh(G.box(0.14, 0.26, 0.06), eyeM, 0.22, 0.1, 0.41, false))
  head.add(mesh(G.box(0.5, 0.08, 0.06), mat(0x1a0d10), 0, -0.2, 0.41, false))
  const crownG = new THREE.Group()
  crownG.position.set(0.05, 0.5, 0)
  crownG.rotation.z = -0.18
  crownG.add(mesh(G.cyl(0.42, 0.46, 0.2, 8), gold))
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    crownG.add(mesh(G.cone(0.09, 0.26, 4), gold, Math.cos(a) * 0.38, 0.2, Math.sin(a) * 0.38))
  }
  head.add(crownG)
  body.add(head)
  const armL = new THREE.Group()
  armL.position.set(-0.7, 1.95, 0)
  armL.add(mesh(G.box(0.3, 1.05, 0.3), skin, 0, -0.5, 0))
  armL.add(mesh(G.box(0.34, 0.34, 0.36), cloth, 0, -0.05, 0))
  for (let i = 0; i < 3; i++) armL.add(mesh(G.cone(0.05, 0.22, 4), mat(0xe8e2c8), -0.1 + i * 0.1, -1.1, 0.08))
  const armR = armL.clone()
  armR.position.x = 0.7
  body.add(armL, armR)
  const legL = new THREE.Group()
  legL.position.set(-0.27, 0.9, 0)
  legL.add(mesh(G.box(0.36, 0.9, 0.4), mat(0x3a3350), 0, -0.45, 0))
  const legR = legL.clone()
  legR.position.x = 0.27
  root.add(legL, legR)
  const cape = mesh(G.box(1.0, 1.5, 0.08), mat(0x8a2a3c), 0, 1.35, -0.38)
  cape.rotation.x = 0.16
  body.add(cape)
  return { root, parts: { body, head, armL, armR, legL, legR, cape }, born: 0 }
}

/** El Guardián (modo Defensa): jardinero acorazado con capa de hojas y un cañón de semillas. */
function heroModel(): Actor {
  const root = new THREE.Group()
  const skin = mat(0xf0c8a0)
  const armor = mat(0x6f8a9a, { metalness: 0.4, roughness: 0.45 })
  const green = mat(0x3f9a45)
  const body = new THREE.Group()
  root.add(body)
  body.add(mesh(G.box(0.9, 1.0, 0.56), armor, 0, 1.45, 0))
  body.add(mesh(G.box(0.95, 0.2, 0.6), mat(0x6b4a2b), 0, 0.98, 0))
  const head = new THREE.Group()
  head.position.set(0, 2.25, 0)
  head.add(mesh(G.box(0.7, 0.66, 0.66), skin))
  // sombrero de ala ancha con una flor
  head.add(mesh(G.cyl(0.62, 0.66, 0.08, 10), mat(0xc9a25c), 0, 0.36, 0))
  head.add(mesh(G.cyl(0.36, 0.42, 0.3, 10), mat(0xc9a25c), 0, 0.52, 0))
  head.add(mesh(G.sph(0.12, 6), mat(0xff5fd2), 0.3, 0.5, 0.25))
  const eye = new THREE.MeshBasicMaterial({ color: 0x1a1a24 })
  head.add(mesh(G.box(0.1, 0.12, 0.05), eye, -0.15, 0.04, 0.34, false), mesh(G.box(0.1, 0.12, 0.05), eye, 0.15, 0.04, 0.34, false))
  body.add(head)
  // cañón de semillas en brazos
  const gun = new THREE.Group()
  gun.position.set(0.3, 1.5, 0.35)
  const barrel = mesh(G.cyl(0.16, 0.22, 1.3, 10), mat(0x5a3a22), 0, 0, 0.45)
  barrel.rotation.x = Math.PI / 2
  gun.add(barrel)
  gun.add(mesh(G.cyl(0.24, 0.24, 0.16, 10), green, 0, 0, 1.08).rotateX(Math.PI / 2))
  gun.add(mesh(G.sph(0.3, 8), mat(0xe8703a), 0, 0.28, 0.0))
  body.add(gun)
  const armL = new THREE.Group()
  armL.position.set(-0.6, 1.85, 0)
  armL.add(mesh(G.box(0.26, 0.8, 0.26), armor, 0, -0.35, 0.15))
  armL.rotation.x = -1.1
  const armR = armL.clone()
  armR.position.x = 0.6
  body.add(armL, armR)
  const legL = new THREE.Group()
  legL.position.set(-0.24, 0.9, 0)
  legL.add(mesh(G.box(0.32, 0.9, 0.36), mat(0x3d4f2c), 0, -0.45, 0))
  const legR = legL.clone()
  legR.position.x = 0.24
  root.add(legL, legR)
  const cape = new THREE.Group()
  cape.position.set(0, 1.9, -0.32)
  for (let i = 0; i < 5; i++) {
    const l = mesh(G.cone(0.2, 1.1, 4), green, (i - 2) * 0.17, -0.55, 0)
    l.rotation.x = Math.PI
    cape.add(l)
  }
  body.add(cape)
  return { root, parts: { body, head, armL, armR, legL, legR, cape, gun }, born: 0 }
}

const SHIRTS = [0x6a5a8a, 0x8a5a3a, 0x3a6a8a, 0x7a3a4a, 0x4a6a3a]

/** Zombis de la horda (y esbirros del Rey). Mismo esqueleto, con piezas y escala según el tipo. */
function zombieModel(kind: ZombieKind, id: number): Actor {
  const root = new THREE.Group()
  const skinC = kind === 'titan' ? 0x5a7a52 : kind === 'excavador' ? 0x8aa070 : 0x8fbf7a
  const skin = mat(skinC)
  const shirt = mat(kind === 'titan' ? 0x2a1830 : kind === 'coloso' ? 0x6b4a2b : SHIRTS[id % SHIRTS.length]!)
  const pants = mat(0x3a3350)
  const tint = [skin, shirt, pants]
  const body = new THREE.Group()
  root.add(body)
  body.add(mesh(G.box(0.58, 0.66, 0.38), shirt, 0, 0.88, 0))
  const head = new THREE.Group()
  head.position.set(0, 1.45, 0.02)
  head.add(mesh(G.box(0.5, 0.48, 0.46), skin))
  const eyeC = kind === 'titan' ? 0xff3040 : 0xfff27a
  const eye = new THREE.MeshBasicMaterial({ color: eyeC })
  head.add(mesh(G.box(0.1, 0.1, 0.04), eye, -0.12, 0.04, 0.24, false), mesh(G.box(0.08, 0.13, 0.04), eye, 0.12, 0.05, 0.24, false))
  head.add(mesh(G.box(0.26, 0.05, 0.04), mat(0x1a0d10), 0, -0.13, 0.24, false))
  body.add(head)
  const armL = new THREE.Group()
  armL.position.set(-0.38, 1.12, 0)
  armL.add(mesh(G.box(0.17, 0.6, 0.17), skin, 0, -0.25, 0.0))
  armL.rotation.x = -1.35
  const armR = armL.clone()
  armR.position.x = 0.38
  body.add(armL, armR)
  const legL = new THREE.Group()
  legL.position.set(-0.15, 0.55, 0)
  legL.add(mesh(G.box(0.21, 0.55, 0.23), pants, 0, -0.27, 0))
  const legR = legL.clone()
  legR.position.x = 0.15
  root.add(legL, legR)
  switch (kind) {
    case 'corredor':
      head.add(mesh(G.box(0.54, 0.09, 0.5), mat(0xff7a2e), 0, 0.15, 0))
      body.rotation.x = 0.35
      break
    case 'blindado':
      head.add(mesh(G.cyl(0.3, 0.34, 0.38, 8), mat(0x9aa0a8, { metalness: 0.6, roughness: 0.4 }), 0, 0.3, 0))
      armL.add(mesh(G.box(0.7, 0.8, 0.1), mat(0x7a5230), 0.25, -0.5, 0.2))
      break
    case 'excavador':
      {
        const helmet = mesh(G.sph(0.3, 8), mat(0xf2c43d), 0, 0.2, 0)
        helmet.scale.set(1, 0.6, 1)
        head.add(helmet)
      }
      head.add(mesh(G.box(0.1, 0.1, 0.06), new THREE.MeshBasicMaterial({ color: 0xffffcc }), 0, 0.26, 0.28, false))
      armR.add(mesh(G.box(0.05, 0.05, 0.7), mat(0x6b4a2b), 0, -0.55, 0.15), mesh(G.box(0.5, 0.07, 0.07), mat(0x8a8a90), 0, -0.55, 0.5))
      break
    case 'coloso':
      root.scale.setScalar(2.1)
      armR.add(mesh(G.cyl(0.14, 0.22, 1.3, 7), mat(0x6b4a2b), 0, -0.85, 0.1))
      body.add(mesh(G.box(0.7, 0.2, 0.44), mat(0x3a2414), 0, 0.6, 0))
      break
    case 'titan':
      root.scale.setScalar(3.6)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        head.add(mesh(G.cone(0.05, 0.28, 4), mat(0x2a1a10), Math.cos(a) * 0.22, 0.34, Math.sin(a) * 0.22))
      }
      body.add(mesh(G.box(0.7, 0.3, 0.44), mat(0x6a2030), 0, 1.15, 0))
      armL.add(mesh(G.sph(0.22, 7), mat(0x3a3a40, { metalness: 0.5 }), 0, -0.6, 0))
      armR.add(mesh(G.sph(0.22, 7), mat(0x3a3a40, { metalness: 0.5 }), 0, -0.6, 0))
      break
    default:
      break
  }
  // montículo de tierra (excavador bajo tierra)
  const mound = mesh(G.sph(0.6, 8), mat(0x6b4a2b), 0, 0, 0)
  mound.scale.set(1, 0.35, 1.3)
  mound.visible = false
  root.add(mound)
  // barra de vida
  const big = kind === 'coloso' || kind === 'titan'
  const w = big ? 1.4 : 0.8
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.1), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.8 }))
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.07), new THREE.MeshBasicMaterial({ color: 0xe6483c }))
  bg.position.y = fill.position.y = 2.05
  bg.visible = fill.visible = false
  root.add(bg, fill)
  return { root, parts: { body, head, armL, armR, legL, legR, mound }, bar: { bg, fill, w }, born: 0, tint }
}

const leaf = (c = 0x4caf50) => mat(c)

function guardianModel(kind: GuardianKind): Actor {
  const root = new THREE.Group()
  const parts: Record<string, THREE.Object3D> = {}
  const pot = () => root.add(mesh(G.cyl(0.42, 0.3, 0.36, 8), mat(0xa5673f), 0, 0.18, 0))
  switch (kind) {
    case 'brote': {
      const body = mesh(G.sph(0.62, 8), mat(0xc9a25c), 0, 0.62, 0)
      body.scale.set(1, 0.9, 0.95)
      root.add(body)
      const l1 = mesh(G.cone(0.2, 0.5, 4), leaf(0x66bb4a), 0.12, 1.3, 0)
      l1.rotation.z = -0.5
      const l2 = mesh(G.cone(0.18, 0.44, 4), leaf(0x4caf50), -0.14, 1.26, 0)
      l2.rotation.z = 0.55
      root.add(l1, l2)
      const eye = new THREE.MeshBasicMaterial({ color: 0x2a1c0c })
      root.add(mesh(G.box(0.12, 0.16, 0.05), eye, -0.2, 0.75, -0.55, false), mesh(G.box(0.12, 0.16, 0.05), eye, 0.2, 0.75, -0.55, false))
      root.add(mesh(G.box(0.3, 0.05, 0.05), eye, 0, 0.92, -0.55, false))
      parts.body = body
      break
    }
    case 'lanzabrotes': {
      pot()
      root.add(mesh(G.cyl(0.11, 0.14, 0.9, 6), leaf(0x3f9a45), 0, 0.8, 0))
      const head = new THREE.Group()
      head.position.set(0, 1.4, 0)
      head.add(mesh(G.sph(0.4, 8), mat(0xe8703a)))
      for (let i = 0; i < 3; i++) {
        const p = mesh(G.cone(0.2, 0.5, 4), mat(0xffb347), Math.cos((i / 3) * Math.PI * 2) * 0.3, 0.2, Math.sin((i / 3) * Math.PI * 2) * 0.3)
        p.rotation.z = Math.cos((i / 3) * Math.PI * 2) * -0.7
        p.rotation.x = Math.sin((i / 3) * Math.PI * 2) * 0.7
        head.add(p)
      }
      const barrel = mesh(G.cyl(0.16, 0.2, 0.5, 8), mat(0x6b4a2b), 0, 0, -0.5)
      barrel.rotation.x = Math.PI / 2
      head.add(barrel)
      root.add(head)
      parts.head = head
      break
    }
    case 'tronco': {
      const trunk = mesh(G.cyl(1.05, 1.2, 1.9, 10), mat(0x7a5230), 0, 0.95, 0)
      root.add(trunk)
      root.add(mesh(G.cyl(1.0, 1.05, 0.12, 10), mat(0xd9b77e), 0, 1.92, 0))
      root.add(mesh(G.box(1.5, 1.1, 0.25), mat(0x5d3d22), 0, 0.95, -1.05))
      root.add(mesh(G.box(0.5, 0.14, 0.1), leaf(0x3f9a45), -0.4, 1.5, -1.05), mesh(G.box(0.5, 0.14, 0.1), leaf(0x3f9a45), 0.4, 1.5, -1.05))
      root.add(mesh(G.sph(0.3, 6), leaf(0x4caf50), 0.5, 2.05, 0.2))
      parts.body = trunk
      break
    }
    case 'glacial': {
      pot()
      root.add(mesh(G.cyl(0.09, 0.12, 0.8, 6), mat(0x4aa0a8), 0, 0.75, 0))
      const flower = new THREE.Group()
      flower.position.set(0, 1.3, 0)
      const ice = mat(0xa8e6ff, { emissive: 0x2a7fb0, emissiveIntensity: 0.5, roughness: 0.25 })
      flower.add(mesh(G.sph(0.24, 8), mat(0xffffff, { emissive: 0x88ccff, emissiveIntensity: 0.6 })))
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const p = mesh(G.cone(0.16, 0.62, 4), ice, Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42)
        p.rotation.z = Math.cos(a) * -1.3
        p.rotation.x = Math.sin(a) * 1.3
        flower.add(p)
      }
      root.add(flower)
      const ring = new THREE.Mesh(new THREE.RingGeometry(5.3, 5.5, 40), new THREE.MeshBasicMaterial({ color: 0x9fe7ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide }))
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.05
      root.add(ring)
      parts.head = flower
      parts.ring = ring
      break
    }
    case 'hongo': {
      root.add(mesh(G.cyl(0.24, 0.3, 0.5, 8), mat(0xefe2c4), 0, 0.25, 0))
      const cap = mesh(G.sph(0.6, 10), mat(0xb5306a, { emissive: 0x5a0030, emissiveIntensity: 0.4 }), 0, 0.55, 0)
      cap.scale.set(1, 0.6, 1)
      root.add(cap)
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2
        root.add(mesh(G.sph(0.1, 6), mat(0xffe08a, { emissive: 0xffa000, emissiveIntensity: 0.8 }), Math.cos(a) * 0.38, 0.72, Math.sin(a) * 0.38, false))
      }
      parts.body = cap
      break
    }
    case 'raiz': {
      pot()
      const core = mesh(G.sph(0.34, 8), mat(0x7cff9e, { emissive: 0x1f9a4a, emissiveIntensity: 0.8 }), 0, 0.95, 0)
      root.add(core)
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4
        const r = mesh(G.cyl(0.07, 0.11, 1.0, 5), mat(0x8a6a3f), Math.cos(a) * 0.3, 0.6, Math.sin(a) * 0.3)
        r.rotation.z = Math.cos(a) * 0.6
        r.rotation.x = -Math.sin(a) * 0.6
        root.add(r)
      }
      parts.body = core
      break
    }
    case 'ancestral': {
      const trunk = mesh(G.cyl(1.6, 2.1, 4.6, 10), mat(0x5d4027), 0, 2.3, 0)
      root.add(trunk)
      const crown = mesh(G.sph(3.0, 9), leaf(0x2f7d3a), 0, 5.6, 0)
      crown.scale.set(1, 0.7, 1)
      root.add(crown)
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2
        root.add(mesh(G.sph(0.25, 6), mat(0xffd27a, { emissive: 0xffa000, emissiveIntensity: 0.7 }), Math.cos(a) * 2.6, 5.2 + (i % 2) * 0.6, Math.sin(a) * 2.6, false))
      }
      const amber = new THREE.MeshBasicMaterial({ color: 0xffb020 })
      root.add(mesh(G.box(0.42, 0.3, 0.1), amber, -0.6, 3.3, -1.75, false), mesh(G.box(0.42, 0.3, 0.1), amber, 0.6, 3.3, -1.75, false))
      const armL = new THREE.Group()
      armL.position.set(-1.7, 3.2, 0)
      armL.add(mesh(G.cyl(0.32, 0.45, 3.0, 6), mat(0x4a321e), 0, -1.3, -0.6))
      const armR = armL.clone()
      armR.position.x = 1.7
      root.add(armL, armR)
      parts.armL = armL
      parts.armR = armR
      parts.body = trunk
      break
    }
  }
  const def = GUARDIANS[kind]
  const w = Math.max(1, def.radius * 1.8)
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.14), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.8 }))
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.1), new THREE.MeshBasicMaterial({ color: 0x6ee06e }))
  const top = kind === 'ancestral' ? 8 : kind === 'tronco' ? 2.5 : 2.0
  bg.position.y = top
  fill.position.y = top
  fill.position.z = -0.001
  bg.visible = fill.visible = false
  root.add(bg, fill)
  return { root, parts, bar: { bg, fill, w }, born: 0 }
}

// ───────────────────────────── partículas ─────────────────────────────

interface Particle {
  m: THREE.Mesh
  vx: number
  vy: number
  vz: number
  life: number
  max: number
  grav: number
  /** 'p' partícula · 'ring' anillo que crece · 'beam' rayo que se apaga */
  kind: 'p' | 'ring' | 'beam'
  r: number
}

interface Label {
  el: HTMLDivElement
  x: number
  y: number
  z: number
  life: number
}

const DAY = { top: new THREE.Color(0x3d7fe0), bottom: new THREE.Color(0xcfeaff), fog: new THREE.Color(0xcfeaff), sun: new THREE.Color(0xfff1d0), hemi: 1.05, sunI: 2.1 }
const DUSK = { top: new THREE.Color(0x3a2a6e), bottom: new THREE.Color(0xff9a6a), fog: new THREE.Color(0xd88a7a), sun: new THREE.Color(0xff9a50), hemi: 0.75, sunI: 1.5 }
const NIGHT = { top: new THREE.Color(0x05081a), bottom: new THREE.Color(0x1a2450), fog: new THREE.Color(0x141a38), sun: new THREE.Color(0x8aa0ff), hemi: 0.35, sunI: 0.45 }

export interface ViewOptions {
  /** color de la corona del Rey (cosmético que se desbloquea con victorias) */
  crown?: number
}

export class View {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 400)
  private hero: Actor | null = null
  private heroMode: Mode | null = null
  private guardians = new Map<number, Actor & { kind: GuardianKind }>()
  private units = new Map<number, Actor & { kind: ZombieKind }>()
  private shots = new Map<number, THREE.Object3D>()
  private particles: Particle[] = []
  private labels: Label[] = []
  private shake = 0
  private flash = 0
  private bolt = 0
  private camPos = new THREE.Vector3(0, 30, LENGTH + 30)
  private camLook = new THREE.Vector3(0, 0, LENGTH / 2)
  /** 0 = detrás del personaje (acción) · 1 = desde arriba (táctica). */
  cameraMode = 0
  private introStart = -1
  private baseFov = 58
  private readonly pGeo = G.box(0.22, 0.22, 0.22)
  private readonly ringGeo = new THREE.RingGeometry(0.82, 1, 40)
  private readonly pMats = new Map<number, THREE.MeshBasicMaterial>()
  private readonly shotGeo = { semilla: G.sph(0.2, 6), mortero: G.sph(0.45, 8), warn: new THREE.RingGeometry(2.4, 2.8, 32) }
  private readonly shotMat = {
    semilla: mat(0xc8f06a, { emissive: 0x5a8a00, emissiveIntensity: 0.6 }),
    mortero: mat(0xe8703a, { emissive: 0xff7a00, emissiveIntensity: 0.9 }),
    warn: new THREE.MeshBasicMaterial({ color: 0xff4020, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  }
  private readonly labelsEl: HTMLElement
  private sun!: THREE.DirectionalLight
  private hemi!: THREE.HemisphereLight
  private skyU!: { top: { value: THREE.Color }; bottom: { value: THREE.Color } }
  private lamps: THREE.PointLight[] = []
  private lampBulbs: THREE.MeshStandardMaterial[] = []
  private rain!: THREE.Points
  private stars!: THREE.Points
  private readonly opts: ViewOptions
  private time = 0

  constructor(canvas: HTMLCanvasElement, labelsEl: HTMLElement, opts: ViewOptions = {}) {
    this.labelsEl = labelsEl
    this.opts = opts
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    for (const g of [this.pGeo, this.ringGeo, this.shotGeo.semilla, this.shotGeo.mortero, this.shotGeo.warn]) g.userData.shared = true
    for (const m of Object.values(this.shotMat)) m.userData.shared = true
    this.buildWorld()
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / Math.max(1, h)
    // en vertical (9:16) se abre el ángulo para que quepa el jardín
    this.baseFov = this.camera.aspect < 0.8 ? 80 : 58
    this.camera.updateProjectionMatrix()
  }

  /** Cambia la corona del Rey (cosmético). */
  setCrown(color: number): void {
    this.opts.crown = color
    this.heroMode = null
  }

  /** Cinemática de entrada: la cámara baja desde encima de la casa hasta el personaje (3,5 s). */
  intro(): void {
    this.introStart = this.time
  }

  // ───────────────────────────── escenario ─────────────────────────────

  private buildWorld(): void {
    const sc = this.scene
    this.skyU = { top: { value: DAY.top.clone() }, bottom: { value: DAY.bottom.clone() } }
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(300, 20, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: this.skyU,
        vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'varying vec3 p; uniform vec3 top; uniform vec3 bottom; void main(){ float h = clamp(normalize(p).y*1.4+0.15,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h),1.0); }',
      }),
    )
    sc.add(sky)
    sc.fog = new THREE.Fog(DAY.fog.getHex(), 70, 210)
    this.hemi = new THREE.HemisphereLight(0xdff1ff, 0x4f7a3a, DAY.hemi)
    sc.add(this.hemi)
    const sun = new THREE.DirectionalLight(0xfff1d0, DAY.sunI)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const c = sun.shadow.camera
    c.left = -34
    c.right = 34
    c.top = 34
    c.bottom = -34
    c.near = 1
    c.far = 170
    sun.shadow.bias = -0.0005
    sc.add(sun, sun.target)
    this.sun = sun

    // estrellas (se ven de noche)
    const sp = new Float32Array(600 * 3)
    for (let i = 0; i < 600; i++) {
      const a = Math.random() * Math.PI * 2
      const e = 0.15 + Math.random() * 1.2
      sp[i * 3] = Math.cos(a) * Math.cos(e) * 260
      sp[i * 3 + 1] = Math.sin(e) * 260
      sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 260 + LENGTH / 2
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3))
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }))
    sc.add(this.stars)

    // lluvia (noche de tormenta)
    const rp = new Float32Array(1600 * 3)
    for (let i = 0; i < 1600; i++) {
      rp[i * 3] = (Math.random() - 0.5) * 50
      rp[i * 3 + 1] = Math.random() * 30
      rp[i * 3 + 2] = (Math.random() - 0.5) * 60
    }
    const rg = new THREE.BufferGeometry()
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3))
    this.rain = new THREE.Points(rg, new THREE.PointsMaterial({ color: 0xaac8ff, size: 0.12, transparent: true, opacity: 0.6 }))
    this.rain.visible = false
    sc.add(this.rain)

    // suelo y césped a cuadros por carriles
    const ground = mesh(new THREE.PlaneGeometry(500, 500), mat(0x4f9a3f), 0, -0.02, LENGTH / 2, false)
    ground.rotation.x = -Math.PI / 2
    sc.add(ground)
    const cnv = document.createElement('canvas')
    cnv.width = LANES * 32
    cnv.height = 32 * 22
    const ctx = cnv.getContext('2d')!
    for (let i = 0; i < LANES; i++)
      for (let j = 0; j < 22; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? '#63c04a' : '#56b041'
        ctx.fillRect(i * 32, j * 32, 32, 32)
        // briznas para que no sea liso
        ctx.fillStyle = (i + j) % 2 === 0 ? '#6fcc55' : '#4ea53a'
        for (let k = 0; k < 10; k++) ctx.fillRect(i * 32 + ((k * 7 + j * 3) % 30), j * 32 + ((k * 11 + i * 5) % 30), 2, 2)
      }
    const tex = new THREE.CanvasTexture(cnv)
    tex.magFilter = THREE.NearestFilter
    tex.colorSpace = THREE.SRGBColorSpace
    const lawn = mesh(new THREE.PlaneGeometry(HALF_W * 2, LENGTH), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), 0, 0, LENGTH / 2, false)
    lawn.rotation.x = -Math.PI / 2
    sc.add(lawn)
    const side = mesh(new THREE.PlaneGeometry(60, 5), mat(0xd8d2c4), 0, 0.01, -2.5, false)
    side.rotation.x = -Math.PI / 2
    const road = mesh(new THREE.PlaneGeometry(60, 10), mat(0x4a4d55), 0, 0.0, -10, false)
    road.rotation.x = -Math.PI / 2
    sc.add(side, road)
    for (let x = -26; x < 28; x += 6) sc.add(mesh(G.box(2.6, 0.02, 0.3), mat(0xf2e6a0), x, 0.02, -10, false))

    // hierba alta y flores fuera del camino (instanciadas: miles por un solo dibujo)
    const tuft = new THREE.InstancedMesh(G.cone(0.12, 0.5, 3), mat(0x3f9a32), 1400)
    const flower = new THREE.InstancedMesh(G.sph(0.14, 5), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 420)
    const m4 = new THREE.Matrix4()
    const col = new THREE.Color()
    const FLOWERS = [0xff5fd2, 0xffe066, 0xffffff, 0x9fe7ff, 0xff7a59]
    for (let i = 0; i < 1400; i++) {
      const sx = Math.random() < 0.5 ? -1 : 1
      const x = sx * (HALF_W + 2 + Math.random() * 22)
      const z = -2 + Math.random() * (LENGTH + 6)
      m4.makeRotationY(Math.random() * 3).setPosition(x, 0.25, z)
      tuft.setMatrixAt(i, m4)
    }
    for (let i = 0; i < 420; i++) {
      const sx = Math.random() < 0.5 ? -1 : 1
      m4.makeTranslation(sx * (HALF_W + 2 + Math.random() * 18), 0.18, Math.random() * LENGTH)
      flower.setMatrixAt(i, m4)
      flower.setColorAt(i, col.setHex(FLOWERS[i % FLOWERS.length]!))
    }
    tuft.receiveShadow = true
    sc.add(tuft, flower)

    // setos, árboles y farolas
    const hedge = mat(0x2f8a3a)
    const lampGlass = mat(0xffe9a8, { emissive: 0xffc840, emissiveIntensity: 0.4 })
    this.lampBulbs.push(lampGlass)
    for (const sx of [-1, 1]) {
      sc.add(mesh(G.box(1.6, 1.8, LENGTH + 4), hedge, sx * (HALF_W + 0.9), 0.9, LENGTH / 2))
      for (let z = 4; z < LENGTH; z += 11) {
        const off = sx * (HALF_W + 5 + ((z * 7) % 5))
        sc.add(mesh(G.cyl(0.45, 0.6, 3.4, 7), mat(0x6b4a2b), off, 1.7, z))
        const top = mesh(G.sph(2.6, 8), leaf(z % 22 === 4 ? 0x3d9a42 : 0x2f8a3a), off, 4.8, z)
        top.scale.y = 0.85
        sc.add(top)
        if (z % 22 === 4) {
          sc.add(mesh(G.cyl(0.08, 0.1, 2.6, 6), mat(0x2b2b33), sx * (HALF_W + 2.4), 1.3, z + 5))
          sc.add(mesh(G.box(0.36, 0.42, 0.36), lampGlass, sx * (HALF_W + 2.4), 2.75, z + 5, false))
        }
      }
    }
    // pocas luces reales (caras): las de la casa y dos a mitad de camino; se encienden al anochecer
    for (const [x, z] of [[-6, LENGTH - 6], [6, LENGTH - 6], [-HALF_W - 2.4, LENGTH / 2], [HALF_W + 2.4, LENGTH / 2 - 11]] as const) {
      const l = new THREE.PointLight(0xffc870, 0, 24, 1.6)
      l.position.set(x, 3.4, z)
      sc.add(l)
      this.lamps.push(l)
    }

    // la última casa
    const house = new THREE.Group()
    house.position.set(0, 0, LENGTH + 6)
    house.add(mesh(G.box(22, 7, 9), mat(0xf2e6cf), 0, 3.5, 0))
    const roof = mesh(G.box(24, 0.6, 7.2), mat(0xc0452f), 0, 8.6, -1.6)
    roof.rotation.x = 0.6
    const roof2 = mesh(G.box(24, 0.6, 7.2), mat(0xa83a27), 0, 8.6, 1.6)
    roof2.rotation.x = -0.6
    house.add(roof, roof2)
    house.add(mesh(G.box(2.6, 4.4, 0.4), mat(0x5a3a22), 0, 2.2, -4.6))
    house.add(mesh(G.box(3.2, 0.3, 0.6), mat(0xffffff), 0, 4.6, -4.6))
    house.add(mesh(G.box(4, 0.4, 1.4), mat(0xbfb5a2), 0, 0.2, -5.2))
    const glass = mat(0x8fd0ff, { emissive: 0xffd27a, emissiveIntensity: 0.55, roughness: 0.2 })
    this.lampBulbs.push(glass)
    for (const x of [-7, 7]) {
      house.add(mesh(G.box(3.4, 2.6, 0.3), glass, x, 3.6, -4.55, false))
      house.add(mesh(G.box(3.8, 0.24, 0.5), mat(0xffffff), x, 2.2, -4.6))
      house.add(mesh(G.box(3.6, 0.5, 0.6), mat(0x8a5a3a), x, 1.9, -4.9))
      for (let i = 0; i < 4; i++) house.add(mesh(G.sph(0.2, 5), mat(FLOWERS[i % 5]!), x - 1.2 + i * 0.8, 2.25, -4.9, false))
    }
    house.add(mesh(G.box(1.4, 3, 1.4), mat(0x8a4a3a), 7, 10.2, 0))
    sc.add(house)
    const goal = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, 2.2), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.55 }))
    goal.rotation.x = -Math.PI / 2
    goal.position.set(0, 0.03, LENGTH - 0.6)
    sc.add(goal)
    const cloud = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false })
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group()
      for (let j = 0; j < 4; j++) g.add(mesh(G.sph(5 + ((i + j) % 3) * 2, 7), cloud, j * 6 - 9, ((j * 3) % 4) - 1, (j % 2) * 3, false))
      g.position.set(-120 + i * 34, 52 + (i % 3) * 9, 60 + ((i * 53) % 150))
      sc.add(g)
    }
  }

  private setSky(night: number, storm: boolean): void {
    // día → atardecer → noche
    const a = night < 0.5 ? DAY : DUSK
    const b = night < 0.5 ? DUSK : NIGHT
    const k = night < 0.5 ? night * 2 : (night - 0.5) * 2
    this.skyU.top.value.copy(a.top).lerp(b.top, k)
    this.skyU.bottom.value.copy(a.bottom).lerp(b.bottom, k)
    const fog = this.scene.fog as THREE.Fog
    fog.color.copy(a.fog).lerp(b.fog, k)
    this.sun.color.copy(a.sun).lerp(b.sun, k)
    const flashK = this.bolt > 0 ? this.bolt * 3 : 0
    this.sun.intensity = a.sunI + (b.sunI - a.sunI) * k + flashK
    this.hemi.intensity = (a.hemi + (b.hemi - a.hemi) * k) * (storm ? 0.7 : 1) + flashK
    ;(this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, (night - 0.55) * 2.2) * (storm ? 0.2 : 1)
    const lit = Math.max(0, (night - 0.35) / 0.65)
    for (const l of this.lamps) l.intensity = lit * 30
    for (const m of this.lampBulbs) m.emissiveIntensity = 0.4 + lit * 1.6
    this.rain.visible = storm
  }

  // ───────────────────────────── efectos ─────────────────────────────

  private pmat(color: number): THREE.MeshBasicMaterial {
    let m = this.pMats.get(color)
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color })
      m.userData.shared = true
      this.pMats.set(color, m)
    }
    return m
  }

  private burst(x: number, y: number, z: number, n: number, color: number, speed: number, life = 0.7, up = 1, grav = 9): void {
    const m = this.pmat(color)
    for (let i = 0; i < n && this.particles.length < 1100; i++) {
      const p = new THREE.Mesh(this.pGeo, m)
      p.position.set(x, y, z)
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * speed
      this.scene.add(p)
      this.particles.push({ m: p, vx: Math.cos(a) * r, vy: (0.4 + Math.random()) * speed * up, vz: Math.sin(a) * r, life, max: life, grav, kind: 'p', r: 0 })
    }
  }

  private ring(x: number, z: number, r: number, color: number, life = 0.5): void {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }))
    m.rotation.x = -Math.PI / 2
    m.position.set(x, 0.08, z)
    this.scene.add(m)
    this.particles.push({ m, vx: 0, vy: 0, vz: 0, life, max: life, grav: 0, kind: 'ring', r })
  }

  private beam(x: number, z: number): void {
    const m = new THREE.Mesh(G.cyl(0.35, 0.35, 60, 6), new THREE.MeshBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 1 }))
    m.position.set(x, 30, z)
    this.scene.add(m)
    this.particles.push({ m, vx: 0, vy: 0, vz: 0, life: 0.25, max: 0.25, grav: 0, kind: 'beam', r: 0 })
  }

  private label(text: string, x: number, y: number, z: number, cls = ''): void {
    if (!text) return
    if (this.labels.length > 60) {
      const old = this.labels.shift()!
      old.el.remove()
    }
    const el = document.createElement('div')
    el.className = `lh-label ${cls}`
    el.textContent = text
    this.labelsEl.appendChild(el)
    this.labels.push({ el, x, y, z, life: 1.6 })
  }

  private readonly colors: Record<GuardianKind, number> = { brote: 0xc9a25c, lanzabrotes: 0xe8703a, tronco: 0x7a5230, glacial: 0xa8e6ff, hongo: 0xb5306a, raiz: 0x7cff9e, ancestral: 0x2f7d3a }

  private handleFx(list: Fx[], r: RenderState): void {
    const h = r.hero
    for (const f of list) {
      switch (f.type) {
        case 'plant':
          this.burst(f.x, 0.3, f.z, 10, 0x6b4a2b, 2.2, 0.5)
          this.burst(f.x, 0.4, f.z, 6, this.colors[f.kind], 1.6, 0.6)
          this.label(f.owner, f.x, GUARDIANS[f.kind].radius * 2 + 1.4, f.z, 'lh-owner')
          break
        case 'break':
          this.burst(f.x, 0.8, f.z, f.kind === 'ancestral' ? 60 : 16, this.colors[f.kind], 4, 0.8)
          this.burst(f.x, 0.6, f.z, 8, 0x6b4a2b, 3, 0.7)
          if (f.kind === 'ancestral' || f.kind === 'tronco') this.shake = Math.max(this.shake, 0.4)
          break
        case 'hit':
          this.burst(f.x, 1, f.z, f.big ? 12 : 5, 0xfff2a8, f.big ? 4 : 2.4, 0.35)
          break
        case 'kingHurt':
          this.flash = 0.35
          this.shake = Math.max(this.shake, 0.18)
          this.burst(h.x, 1.6, h.z, 6, 0x9ad36a, 2.5, 0.4)
          this.label(`−${Math.round(f.dmg)}`, h.x, 3.4, h.z, 'lh-dmg')
          break
        case 'boom':
          this.burst(f.x, 0.6, f.z, 34, 0xffa033, 7, 0.7)
          this.burst(f.x, 0.6, f.z, 18, 0x3b3b3b, 4, 1.1, 1.4, 2)
          this.ring(f.x, f.z, f.r, 0xffc04d, 0.45)
          this.shake = Math.max(this.shake, 0.5)
          break
        case 'swipe':
          this.burst(f.x, 1.4, f.z, 6, 0xffffff, 2.2, 0.22, 0.4, 0)
          break
        case 'roar':
          this.ring(f.x, f.z, 9, 0xc77dff, 0.6)
          this.ring(f.x, f.z, 6, 0xffffff, 0.45)
          this.shake = Math.max(this.shake, 0.35)
          this.label('¡RUGIDO!', f.x, 4, f.z, 'lh-shout')
          break
        case 'pulse':
          this.ring(f.x, f.z, f.r, 0x7cff9e, 0.55)
          this.ring(f.x, f.z, f.r * 0.6, 0xffffff, 0.4)
          this.burst(f.x, 0.5, f.z, 24, 0x7cff9e, 6, 0.5, 0.3)
          this.shake = Math.max(this.shake, 0.3)
          break
        case 'dash':
          this.burst(f.x, 0.4, f.z, 18, 0xe8e2c8, 3, 0.5, 0.5)
          break
        case 'summon':
          this.ring(f.x, f.z, 3, 0x8a5ad6, 0.5)
          this.burst(f.x, 0.3, f.z, 20, 0x4b2a6e, 3, 0.7)
          break
        case 'shoot':
          this.burst(f.x + Math.sin(h.facing) * 1.4, 1.5, f.z + Math.cos(h.facing) * 1.4, 3, 0xd8ff8a, 1.4, 0.18, 0.3, 0)
          break
        case 'zombieDown':
          this.burst(f.x, 1, f.z, f.big ? 50 : 14, 0x8fbf7a, f.big ? 6 : 3.5, 0.7)
          this.burst(f.x, 1, f.z, f.big ? 20 : 6, 0x6a5a8a, 3, 0.7)
          if (f.big) this.shake = Math.max(this.shake, 0.5)
          break
        case 'spawn':
          this.ring(f.x, 0.5, f.big ? 6 : 2, f.big ? 0xff4060 : 0x8a5ad6, 0.5)
          if (f.owner && f.big) this.label(f.owner, f.x, 5, 1, 'lh-owner')
          break
        case 'houseHit':
          this.shake = Math.max(this.shake, 0.12)
          this.burst((Math.random() - 0.5) * 10, 2 + Math.random() * 3, LENGTH + 1.4, 4, 0xe8dcc0, 2.5, 0.5)
          break
        case 'surface':
          this.burst(f.x, 0.3, f.z, 22, 0x6b4a2b, 4, 0.8)
          this.label('¡EXCAVADOR!', f.x, 3, f.z, 'lh-dmg')
          break
        case 'lightning':
          this.beam(f.x, f.z)
          this.bolt = 0.25
          this.burst(f.x, 0.4, f.z, 20, 0xe8f0ff, 5, 0.4)
          this.shake = Math.max(this.shake, 0.45)
          break
        case 'assault':
          for (let i = 0; i < 6; i++) this.burst((Math.random() - 0.5) * 12, 2 + Math.random() * 4, LENGTH - 2, 16, [0xffe066, 0xff5fd2, 0x7cff9e, 0x66ccff][i % 4]!, 6, 1.2)
          this.shake = Math.max(this.shake, 0.3)
          break
        case 'down':
          this.burst(h.x, 1, h.z, 30, 0x7fae6a, 5, 0.9)
          this.label('¡DERRIBADO!', h.x, 4, h.z, 'lh-shout')
          break
        case 'end':
          for (let i = 0; i < 10; i++) this.burst((Math.random() - 0.5) * 16, 4 + Math.random() * 6, LENGTH - 6 + Math.random() * 6, 14, [0xffe066, 0xff5fd2, 0x7cff9e, 0x66ccff, 0xc084fc][i % 5]!, 7, 1.6)
          break
        default:
          break
      }
    }
  }

  // ───────────────────────────── fotograma ─────────────────────────────

  private bar(a: Actor, f: number, show: boolean): void {
    if (!a.bar) return
    a.bar.bg.visible = a.bar.fill.visible = show
    if (!show) return
    f = Math.max(0, Math.min(1, f))
    a.bar.fill.scale.x = Math.max(0.001, f)
    a.bar.fill.position.x = -(a.bar.w * (1 - f)) / 2
    ;(a.bar.fill.material as THREE.MeshBasicMaterial).color.setHex(f > 0.5 ? 0x6ee06e : f > 0.25 ? 0xf0c83c : 0xe6483c)
    const inv = a.root.quaternion.clone().invert()
    a.bar.bg.quaternion.copy(this.camera.quaternion).premultiply(inv)
    a.bar.fill.quaternion.copy(this.camera.quaternion).premultiply(inv)
  }

  private syncGuardian(g: Guardian, t: number, facing: number): void {
    let a = this.guardians.get(g.id)
    if (!a) {
      const m = guardianModel(g.kind)
      a = { ...m, kind: g.kind, born: t }
      a.root.position.set(g.x, 0, g.z)
      a.root.rotation.y = facing
      this.scene.add(a.root)
      this.guardians.set(g.id, a)
    }
    const age = t - a.born
    const pop = age < 0.35 ? 1.25 * Math.sin((age / 0.35) * Math.PI * 0.62) : 1
    const hit = t - g.hitAt < 0.15 ? 1 + 0.18 * Math.sin(((t - g.hitAt) / 0.15) * Math.PI) : 1
    a.root.scale.setScalar(Math.max(0.01, pop) * hit)
    a.root.rotation.z = t < g.stunUntil ? Math.sin(t * 22) * 0.08 : 0
    const p = a.parts
    if (g.kind === 'lanzabrotes' && p.head) {
      const shotAge = 1.0 - (g.next - t)
      p.head.position.z = shotAge >= 0 && shotAge < 0.18 ? 0.22 * (1 - shotAge / 0.18) : 0
      p.head.rotation.x = Math.sin(t * 2 + g.id) * 0.06
    }
    if (g.kind === 'glacial' && p.head) {
      p.head.rotation.y = t * 0.8
      if (p.ring) p.ring.scale.setScalar(1 + Math.sin(t * 2.5) * 0.02)
    }
    if (g.kind === 'hongo' && p.body) {
      const armed = g.fuse > 0
      p.body.scale.setScalar(armed ? 1 + ((t * 14) % 1) * 0.5 : 1 + Math.sin(t * 3 + g.id) * 0.04)
      p.body.scale.y *= 0.6
    }
    if (g.kind === 'raiz' && p.body) p.body.scale.setScalar(1 + Math.sin(t * 4 + g.id) * 0.12)
    if (g.kind === 'brote' && p.body) p.body.rotation.z = Math.sin(t * 3 + g.id) * 0.05
    if (g.kind === 'ancestral' && p.armL && p.armR) {
      const slam = 2.4 - (g.next - t)
      const k = slam >= 0 && slam < 0.5 ? Math.sin((slam / 0.5) * Math.PI) : 0
      p.armL.rotation.x = p.armR.rotation.x = -0.3 + k * 1.2 + Math.sin(t * 1.3) * 0.05
    }
    this.bar(a, g.hp / g.maxHp, g.hp < g.maxHp)
  }

  private syncUnit(u: UnitView, t: number, mode: Mode): void {
    let a = this.units.get(u.id)
    if (!a) {
      const m = zombieModel(u.kind, u.id)
      a = { ...m, kind: u.kind, born: t }
      this.scene.add(a.root)
      this.units.set(u.id, a)
    }
    a.root.position.set(u.x, 0, u.z)
    a.root.rotation.y = 0 // todos caminan hacia la casa (+z)
    const p = a.parts
    const under = u.underground
    for (const k of ['body', 'legL', 'legR'] as const) p[k]!.visible = !under
    p.mound!.visible = under
    if (under) {
      p.mound!.position.y = 0.05 + Math.abs(Math.sin(t * 8 + u.id)) * 0.08
      if (Math.random() < 0.2) this.burst(u.x, 0.2, u.z - 0.4, 1, 0x6b4a2b, 1, 0.4, 0.5)
      return
    }
    const sp = ZOMBIES[u.kind].speed
    const w = u.attacking ? 0 : Math.sin(t * (4 + sp * 3) + u.id)
    p.legL!.rotation.x = w * 0.7
    p.legR!.rotation.x = -w * 0.7
    const atk = u.attacking ? Math.sin(t * 9 + u.id) : 0
    p.armL!.rotation.x = -1.35 + w * 0.15 - atk * 0.5
    p.armR!.rotation.x = -1.35 - w * 0.15 + atk * 0.5
    p.body!.rotation.z = w * 0.05
    const base = u.kind === 'coloso' ? 2.1 : u.kind === 'titan' ? 3.6 : 1
    const spawn = Math.min(1, (t - a.born) / 0.3)
    a.root.scale.setScalar(base * (t - u.hitAt < 0.1 ? 1.12 : 1) * (0.3 + 0.7 * spawn))
    if (a.tint) {
      const hot = t - u.hitAt < 0.08
      for (const m of a.tint) {
        m.emissive.setHex(hot ? 0xffffff : u.slowed ? 0x2a6aa0 : 0x000000)
        m.emissiveIntensity = hot ? 0.6 : u.slowed ? 0.6 : 0
      }
    }
    this.bar(a, u.hp / u.maxHp, mode === 'defensa' && (u.hp < u.maxHp || u.kind === 'titan' || u.kind === 'coloso'))
  }

  private syncHero(r: RenderState): void {
    if (this.heroMode !== r.mode) {
      if (this.hero) {
        this.scene.remove(this.hero.root)
        disposeTree(this.hero.root)
      }
      this.hero = r.mode === 'invasion' ? kingModel(this.opts.crown ?? 0xf2c43d) : heroModel()
      this.heroMode = r.mode
      this.scene.add(this.hero.root)
    }
    const H = this.hero!
    const h: HeroView = r.hero
    const t = r.t
    H.root.visible = !h.inside && !(h.safe && Math.floor(t * 12) % 2 === 0)
    H.root.position.set(h.x, h.down ? 0.5 : 0, h.z)
    H.root.rotation.y = h.facing
    H.root.rotation.x = h.down ? -Math.PI / 2 : 0
    const run = h.moving && !h.down ? Math.sin(t * 13) : 0
    const p = H.parts
    p.legL!.rotation.x = run * 0.9
    p.legR!.rotation.x = -run * 0.9
    p.body!.position.y = Math.abs(run) * 0.08
    p.head!.rotation.z = Math.sin(t * 2.1) * 0.06
    if (r.mode === 'invasion') {
      const swing = h.attack >= 0 ? Math.sin(h.attack * Math.PI) : 0
      p.armL!.rotation.x = -1.25 + run * 0.25 - swing * 1.3
      p.armR!.rotation.x = -1.25 - run * 0.25 - swing * 1.3
      p.body!.rotation.x = h.dashing ? 0.5 : h.moving ? 0.12 : Math.sin(t * 1.6) * 0.02
      p.cape!.rotation.x = 0.16 + (h.moving ? 0.5 + Math.sin(t * 9) * 0.1 : 0) + (h.dashing ? 0.5 : 0)
    } else {
      const kick = h.attack >= 0 ? 1 - h.attack : 0
      p.gun!.position.z = 0.35 - kick * 0.18
      p.body!.rotation.x = -kick * 0.05
      p.cape!.rotation.x = h.moving ? 0.4 + Math.sin(t * 9) * 0.1 : 0.1
    }
    H.root.scale.setScalar(h.hurt ? 1.08 : 1)
    if (h.dashing && Math.random() < 0.8) this.burst(h.x, 0.3, h.z, 2, 0xe8e2c8, 1.5, 0.35, 0.4)
    if (h.confused && Math.random() < 0.3) this.burst(h.x, 3.2, h.z, 1, 0xc77dff, 1, 0.5, 0.3, 0)
    if (h.slowed && Math.random() < 0.3) this.burst(h.x, 0.4, h.z, 1, 0xa8e6ff, 1, 0.5, 0.6, 1)
  }

  frame(sim: { render(): RenderState; drainFx(): Fx[] }, dt: number): void {
    const r = sim.render()
    this.time += dt
    const t = r.t
    this.syncHero(r)
    this.handleFx(sim.drainFx(), r)
    this.setSky(r.night, r.storm)
    const h = r.hero

    // guardianes (en Invasión miran hacia la calle, a quien llega; en Defensa también)
    const alive = new Set<number>()
    for (const g of r.guardians) {
      alive.add(g.id)
      this.syncGuardian(g, t, Math.PI)
    }
    for (const [id, a] of this.guardians)
      if (!alive.has(id)) {
        this.scene.remove(a.root)
        disposeTree(a.root)
        this.guardians.delete(id)
      }
    // horda
    const au = new Set<number>()
    for (const u of r.units) {
      au.add(u.id)
      this.syncUnit(u, t, r.mode)
    }
    for (const [id, a] of this.units)
      if (!au.has(id)) {
        this.scene.remove(a.root)
        disposeTree(a.root)
        this.units.delete(id)
      }
    // disparos (geometrías y materiales compartidos)
    const as = new Set<number>()
    for (const sh of r.shots) {
      as.add(sh.id)
      let o = this.shots.get(sh.id)
      if (!o) {
        if (sh.kind === 'semilla') o = new THREE.Mesh(this.shotGeo.semilla, this.shotMat.semilla)
        else {
          const g = new THREE.Group()
          if (sh.kind === 'mortero') g.add(new THREE.Mesh(this.shotGeo.mortero, this.shotMat.mortero))
          const warn = new THREE.Mesh(this.shotGeo.warn, this.shotMat.warn)
          warn.rotation.x = -Math.PI / 2
          g.userData.warn = warn
          warn.position.set(sh.tx, 0.06, sh.tz)
          this.scene.add(warn)
          o = g
        }
        this.scene.add(o)
        this.shots.set(sh.id, o)
      }
      if (sh.kind === 'semilla') o.position.set(sh.x, sh.y, sh.z)
      else {
        o.visible = sh.t >= 0
        o.position.set(sh.tx, Math.max(0.3, sh.y), sh.tz)
        const warn = o.userData.warn as THREE.Mesh
        warn.visible = sh.t >= 0
        warn.scale.setScalar(1 + Math.sin(this.time * 20) * 0.06)
        if (sh.kind === 'mortero' && sh.t >= 0 && Math.random() < 0.6) this.burst(sh.tx, sh.y + 0.5, sh.tz, 1, 0xffa033, 0.6, 0.3, 0.2, 0)
      }
    }
    for (const [id, o] of this.shots)
      if (!as.has(id)) {
        if (o.userData.warn) this.scene.remove(o.userData.warn as THREE.Object3D)
        this.scene.remove(o)
        this.shots.delete(id)
      }

    // partículas, anillos y rayos
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!
      p.life -= dt
      if (p.life <= 0) {
        this.scene.remove(p.m)
        if (p.kind !== 'p') (p.m.material as THREE.Material).dispose()
        if (p.kind === 'beam') p.m.geometry.dispose()
        this.particles.splice(i, 1)
        continue
      }
      const f = p.life / p.max
      if (p.kind === 'p') {
        p.vy -= p.grav * dt
        p.m.position.x += p.vx * dt
        p.m.position.y = Math.max(0.05, p.m.position.y + p.vy * dt)
        p.m.position.z += p.vz * dt
        p.m.scale.setScalar(Math.max(0.05, f))
        p.m.rotation.x += dt * 6
        p.m.rotation.y += dt * 4
      } else if (p.kind === 'ring') {
        p.m.scale.setScalar(Math.max(0.01, p.r * (1 - f)))
        ;(p.m.material as THREE.MeshBasicMaterial).opacity = f
      } else (p.m.material as THREE.MeshBasicMaterial).opacity = f
    }
    // lluvia
    if (this.rain.visible) {
      const pos = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - dt * 28
        if (y < 0) y += 30
        pos.setY(i, y)
      }
      pos.needsUpdate = true
      this.rain.position.set(h.x, 0, h.z + (r.mode === 'invasion' ? 12 : -12))
    }
    this.bolt = Math.max(0, this.bolt - dt)

    // cámara
    const sh = this.shake
    this.shake = Math.max(0, this.shake - dt * 1.6)
    const target = new THREE.Vector3()
    const look = new THREE.Vector3()
    const introK = this.introStart >= 0 ? (this.time - this.introStart) / 3.5 : 2
    if (r.phase === 'ended' || h.inside) {
      target.set(Math.sin(this.time * 0.4) * 10, 9, LENGTH - 20)
      look.set(0, 4, LENGTH + 4)
    } else if (r.mode === 'invasion') {
      if (this.cameraMode === 0) {
        target.set(h.x * 0.55, 6.2, h.z - 9.5)
        look.set(h.x * 0.8, 1.6, h.z + 9)
      } else {
        target.set(h.x * 0.3, 27, h.z - 6)
        look.set(h.x * 0.3, 0, h.z + 9)
      }
    } else if (this.cameraMode === 0) {
      target.set(h.x * 0.55, 6.6, h.z + 8.5)
      look.set(h.x * 0.75, 1.4, h.z - 12)
    } else {
      target.set(0, 30, LENGTH + 10)
      look.set(0, 0, LENGTH - 34)
    }
    if (introK < 1) {
      // vuelo de entrada: de encima de la casa (mirando el jardín) hasta el personaje
      const e = introK * introK * (3 - 2 * introK)
      const from = new THREE.Vector3(14, 42, LENGTH + 24)
      const fromLook = new THREE.Vector3(0, 0, LENGTH * 0.35)
      this.camPos.copy(from).lerp(target, e)
      this.camLook.copy(fromLook).lerp(look, e)
    } else {
      const kk = 1 - Math.pow(0.0015, dt)
      this.camPos.lerp(target, kk)
      this.camLook.lerp(look, kk)
    }
    this.camera.position.copy(this.camPos)
    if (sh > 0) this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, 0))
    this.camera.lookAt(this.camLook)
    this.camera.fov = this.baseFov + (h.dashing ? 9 : 0)
    this.camera.updateProjectionMatrix()
    this.sun.position.set(h.x - 30, 50, h.z - 20)
    this.sun.target.position.set(h.x, 0, h.z + (r.mode === 'invasion' ? 8 : -8))

    // rótulos
    const w = this.renderer.domElement.clientWidth
    const hh = this.renderer.domElement.clientHeight
    const v = new THREE.Vector3()
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const l = this.labels[i]!
      l.life -= dt
      l.y += dt * 0.9
      if (l.life <= 0) {
        l.el.remove()
        this.labels.splice(i, 1)
        continue
      }
      v.set(l.x, l.y, l.z).project(this.camera)
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1
      l.el.style.display = visible ? 'block' : 'none'
      l.el.style.transform = `translate(-50%,-50%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * hh}px)`
      l.el.style.opacity = String(Math.min(1, l.life / 0.4))
    }
    this.flash = Math.max(0, this.flash - dt)
    this.renderer.render(this.scene, this.camera)
  }

  /** 0..1: cuánto queda del destello rojo de daño (lo pinta el HUD). */
  get hurtFlash(): number {
    return this.flash / 0.35
  }

  /** Números para la pantalla de rendimiento (fase 9). */
  get stats(): { particles: number; actors: number; labels: number; geometries: number; textures: number } {
    const info = this.renderer.info.memory
    return { particles: this.particles.length, actors: this.units.size + this.guardians.size, labels: this.labels.length, geometries: info.geometries, textures: info.textures }
  }

  /** Quita todo lo de la partida anterior (al empezar otra). */
  clear(): void {
    for (const a of [...this.guardians.values(), ...this.units.values()]) {
      this.scene.remove(a.root)
      disposeTree(a.root)
    }
    this.guardians.clear()
    this.units.clear()
    for (const o of this.shots.values()) {
      if (o.userData.warn) this.scene.remove(o.userData.warn as THREE.Object3D)
      this.scene.remove(o)
    }
    this.shots.clear()
    for (const p of this.particles) {
      this.scene.remove(p.m)
      if (p.kind !== 'p') (p.m.material as THREE.Material).dispose()
    }
    this.particles = []
    for (const l of this.labels) l.el.remove()
    this.labels = []
  }

  dispose(): void {
    this.clear()
    this.renderer.dispose()
  }
}
