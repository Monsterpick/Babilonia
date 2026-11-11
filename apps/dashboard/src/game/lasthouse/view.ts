/**
 * LAST HOUSE — vista 3D (Three.js). Dibuja el estado de la simulación: jardín, casa, Rey de la Horda, guardianes,
 * esbirros, disparos y efectos. Todos los modelos se construyen aquí con formas simples (diseños propios, sin
 * recursos externos) y se animan por código.
 */
import * as THREE from 'three'
import { GUARDIANS, HALF_W, LANES, LANE_W, LENGTH, type Fx, type Game, type Guardian, type GuardianKind } from './sim'

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

interface Actor {
  root: THREE.Group
  /** Partes que se animan (opcional). */
  parts: Record<string, THREE.Object3D>
  bar?: { bg: THREE.Mesh; fill: THREE.Mesh }
  born: number
}

// ───────────────────────────── modelos ─────────────────────────────

/** El Rey de la Horda: zombi grandullón con corona torcida y capa hecha jirones. */
function kingModel(): Actor {
  const root = new THREE.Group()
  const skin = mat(0x7fae6a)
  const dark = mat(0x4d7a48)
  const cloth = mat(0x5b2a6e)
  const gold = mat(0xf2c43d, { metalness: 0.5, roughness: 0.4, emissive: 0x6b4a00, emissiveIntensity: 0.4 })
  const body = new THREE.Group()
  root.add(body)
  body.add(mesh(G.box(1.05, 1.15, 0.62), cloth, 0, 1.45, 0))
  body.add(mesh(G.box(1.1, 0.22, 0.66), mat(0x2f1638), 0, 0.95, 0)) // cinturón
  const head = new THREE.Group()
  head.position.set(0, 2.42, 0.02)
  head.add(mesh(G.box(0.86, 0.8, 0.8), skin))
  head.add(mesh(G.box(0.9, 0.2, 0.84), dark, 0, -0.34, 0)) // mandíbula
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xfff27a })
  head.add(mesh(G.box(0.2, 0.2, 0.06), eyeM, -0.2, 0.08, 0.41, false))
  head.add(mesh(G.box(0.14, 0.26, 0.06), eyeM, 0.22, 0.1, 0.41, false))
  // corona torcida
  const crown = new THREE.Group()
  crown.position.set(0.05, 0.5, 0)
  crown.rotation.z = -0.18
  crown.add(mesh(G.cyl(0.42, 0.46, 0.2, 8), gold))
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    crown.add(mesh(G.cone(0.09, 0.26, 4), gold, Math.cos(a) * 0.38, 0.2, Math.sin(a) * 0.38))
  }
  head.add(crown)
  body.add(head)
  const armL = new THREE.Group()
  armL.position.set(-0.7, 1.95, 0)
  armL.add(mesh(G.box(0.3, 1.05, 0.3), skin, 0, -0.5, 0))
  armL.add(mesh(G.box(0.34, 0.34, 0.36), cloth, 0, -0.05, 0))
  const armR = armL.clone()
  armR.position.x = 0.7
  body.add(armL, armR)
  const legL = new THREE.Group()
  legL.position.set(-0.27, 0.9, 0)
  legL.add(mesh(G.box(0.36, 0.9, 0.4), mat(0x3a3350), 0, -0.45, 0))
  const legR = legL.clone()
  legR.position.x = 0.27
  root.add(legL, legR)
  // capa
  const cape = mesh(G.box(1.0, 1.5, 0.08), mat(0x8a2a3c), 0, 1.35, -0.38)
  cape.rotation.x = 0.16
  body.add(cape)
  return { root, parts: { body, head, armL, armR, legL, legR, cape }, born: 0 }
}

function minionModel(): Actor {
  const root = new THREE.Group()
  const skin = mat(0x8fbf7a)
  root.add(mesh(G.box(0.55, 0.62, 0.36), mat(0x6a5a8a), 0, 0.85, 0))
  const head = mesh(G.box(0.5, 0.46, 0.46), skin, 0, 1.4, 0)
  root.add(head)
  const armL = new THREE.Group()
  armL.position.set(-0.37, 1.1, 0)
  armL.add(mesh(G.box(0.16, 0.55, 0.16), skin, 0, -0.2, 0.2))
  armL.rotation.x = -1.2
  const armR = armL.clone()
  armR.position.x = 0.37
  const legL = new THREE.Group()
  legL.position.set(-0.15, 0.52, 0)
  legL.add(mesh(G.box(0.2, 0.52, 0.22), mat(0x3a3350), 0, -0.26, 0))
  const legR = legL.clone()
  legR.position.x = 0.15
  root.add(armL, armR, legL, legR)
  return { root, parts: { head, legL, legR }, born: 0 }
}

const leaf = (c = 0x4caf50) => mat(c)

function guardianModel(kind: GuardianKind): Actor {
  const root = new THREE.Group()
  const parts: Record<string, THREE.Object3D> = {}
  const pot = () => root.add(mesh(G.cyl(0.42, 0.3, 0.36, 8), mat(0xa5673f), 0, 0.18, 0))
  switch (kind) {
    case 'brote': {
      // bulbo regordete con dos hojitas y ceño
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
      parts.body = body
      break
    }
    case 'lanzabrotes': {
      pot()
      const stem = mesh(G.cyl(0.11, 0.14, 0.9, 6), leaf(0x3f9a45), 0, 0.8, 0)
      root.add(stem)
      const head = new THREE.Group()
      head.position.set(0, 1.4, 0)
      // capullo con tres pétalos y un «cañón» de madera
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
      // escudo de corteza y cejas de musgo
      root.add(mesh(G.box(1.5, 1.1, 0.25), mat(0x5d3d22), 0, 0.95, -1.05))
      root.add(mesh(G.box(0.5, 0.14, 0.1), leaf(0x3f9a45), -0.4, 1.5, -1.05), mesh(G.box(0.5, 0.14, 0.1), leaf(0x3f9a45), 0.4, 1.5, -1.05))
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
      // aro que marca el alcance del frío
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
      const core = mesh(G.sph(0.34, 8), mat(0x7CFF9E, { emissive: 0x1f9a4a, emissiveIntensity: 0.8 }), 0, 0.95, 0)
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
      // árbol viejo con brazos de rama y ojos de ámbar
      const trunk = mesh(G.cyl(1.6, 2.1, 4.6, 10), mat(0x5d4027), 0, 2.3, 0)
      root.add(trunk)
      const crown = mesh(G.sph(3.0, 9), leaf(0x2f7d3a), 0, 5.6, 0)
      crown.scale.set(1, 0.7, 1)
      root.add(crown)
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
  // barra de vida (solo se ve cuando está dañado)
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
  return { root, parts, bar: { bg, fill }, born: 0 }
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
  shrink: boolean
}

interface Label {
  el: HTMLDivElement
  x: number
  y: number
  z: number
  life: number
}

export class View {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 400)
  private king = kingModel()
  private guardians = new Map<number, Actor & { kind: GuardianKind }>()
  private minions = new Map<number, Actor>()
  private shots = new Map<number, THREE.Mesh>()
  private particles: Particle[] = []
  private labels: Label[] = []
  private shake = 0
  private flash = 0
  private camPos = new THREE.Vector3(0, 6, -8)
  private camLook = new THREE.Vector3(0, 1.5, 8)
  /** 0 = detrás del Rey (acción) · 1 = desde arriba (táctica). */
  cameraMode = 0
  private readonly pGeo = G.box(0.22, 0.22, 0.22)
  private readonly labelsEl: HTMLElement
  private sun!: THREE.DirectionalLight

  constructor(canvas: HTMLCanvasElement, labelsEl: HTMLElement) {
    this.labelsEl = labelsEl
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.buildWorld()
    this.scene.add(this.king.root)
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / Math.max(1, h)
    this.camera.updateProjectionMatrix()
  }

  // ───────────────────────────── escenario ─────────────────────────────

  private buildWorld(): void {
    const sc = this.scene
    // cielo en degradado
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(300, 20, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { top: { value: new THREE.Color(0x3d7fe0) }, bottom: { value: new THREE.Color(0xcfeaff) } },
        vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'varying vec3 p; uniform vec3 top; uniform vec3 bottom; void main(){ float h = clamp(normalize(p).y*1.4+0.15,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h),1.0); }',
      }),
    )
    sc.add(sky)
    sc.fog = new THREE.Fog(0xcfeaff, 70, 210)
    sc.add(new THREE.HemisphereLight(0xdff1ff, 0x4f7a3a, 1.05))
    const sun = new THREE.DirectionalLight(0xfff1d0, 2.1)
    sun.position.set(-30, 50, -20)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const c = sun.shadow.camera
    c.left = -32
    c.right = 32
    c.top = 32
    c.bottom = -32
    c.near = 1
    c.far = 160
    sun.shadow.bias = -0.0005
    sc.add(sun, sun.target)
    this.sun = sun

    // suelo general y césped a cuadros por carriles
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
      }
    const tex = new THREE.CanvasTexture(cnv)
    tex.magFilter = THREE.NearestFilter
    tex.colorSpace = THREE.SRGBColorSpace
    const lawn = mesh(new THREE.PlaneGeometry(HALF_W * 2, LENGTH), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), 0, 0, LENGTH / 2, false)
    lawn.rotation.x = -Math.PI / 2
    sc.add(lawn)
    // acera y calle
    const side = mesh(new THREE.PlaneGeometry(60, 5), mat(0xd8d2c4), 0, 0.01, -2.5, false)
    side.rotation.x = -Math.PI / 2
    const road = mesh(new THREE.PlaneGeometry(60, 10), mat(0x4a4d55), 0, 0.0, -10, false)
    road.rotation.x = -Math.PI / 2
    sc.add(side, road)
    // setos a los lados y árboles
    const hedge = mat(0x2f8a3a)
    for (const sx of [-1, 1]) {
      sc.add(mesh(G.box(1.6, 1.8, LENGTH + 4), hedge, sx * (HALF_W + 0.9), 0.9, LENGTH / 2))
      for (let z = 4; z < LENGTH; z += 11) {
        const off = sx * (HALF_W + 5 + ((z * 7) % 5))
        sc.add(mesh(G.cyl(0.45, 0.6, 3.4, 7), mat(0x6b4a2b), off, 1.7, z))
        const top = mesh(G.sph(2.6, 8), leaf(z % 22 === 4 ? 0x3d9a42 : 0x2f8a3a), off, 4.8, z)
        top.scale.y = 0.85
        sc.add(top)
        // farolas del sendero
        if (z % 22 === 4) {
          sc.add(mesh(G.cyl(0.08, 0.1, 2.6, 6), mat(0x2b2b33), sx * (HALF_W + 2.4), 1.3, z + 5))
          sc.add(mesh(G.box(0.36, 0.42, 0.36), mat(0xffe9a8, { emissive: 0xffc840, emissiveIntensity: 0.9 }), sx * (HALF_W + 2.4), 2.75, z + 5, false))
        }
      }
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
    const glass = mat(0x8fd0ff, { emissive: 0xffd27a, emissiveIntensity: 0.55, roughness: 0.2 })
    for (const x of [-7, 7]) {
      house.add(mesh(G.box(3.4, 2.6, 0.3), glass, x, 3.6, -4.55, false))
      house.add(mesh(G.box(3.8, 0.24, 0.5), mat(0xffffff), x, 2.2, -4.6))
    }
    house.add(mesh(G.box(1.4, 3, 1.4), mat(0x8a4a3a), 7, 10.2, 0))
    sc.add(house)
    // felpudo luminoso: la meta
    const goal = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, 2.2), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.55 }))
    goal.rotation.x = -Math.PI / 2
    goal.position.set(0, 0.03, LENGTH - 0.6)
    sc.add(goal)
    // nubes
    const cloud = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false })
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group()
      for (let j = 0; j < 4; j++) g.add(mesh(G.sph(5 + ((i + j) % 3) * 2, 7), cloud, j * 6 - 9, ((j * 3) % 4) - 1, (j % 2) * 3, false))
      g.position.set(-120 + i * 34, 52 + (i % 3) * 9, 60 + ((i * 53) % 150))
      sc.add(g)
    }
  }

  // ───────────────────────────── efectos ─────────────────────────────

  private burst(x: number, y: number, z: number, n: number, color: number, speed: number, life = 0.7, up = 1, grav = 9): void {
    const m = new THREE.MeshBasicMaterial({ color })
    for (let i = 0; i < n && this.particles.length < 900; i++) {
      const p = new THREE.Mesh(this.pGeo, m)
      p.position.set(x, y, z)
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * speed
      this.scene.add(p)
      this.particles.push({ m: p, vx: Math.cos(a) * r, vy: (0.4 + Math.random()) * speed * up, vz: Math.sin(a) * r, life, max: life, grav, shrink: true })
    }
  }

  private ring(x: number, z: number, r: number, color: number, life = 0.5): void {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }))
    m.rotation.x = -Math.PI / 2
    m.position.set(x, 0.08, z)
    m.userData.r = r
    this.scene.add(m)
    this.particles.push({ m, vx: 0, vy: 0, vz: 0, life, max: life, grav: 0, shrink: false })
  }

  private label(text: string, x: number, y: number, z: number, cls = ''): void {
    const el = document.createElement('div')
    el.className = `lh-label ${cls}`
    el.textContent = text
    this.labelsEl.appendChild(el)
    this.labels.push({ el, x, y, z, life: 1.6 })
  }

  private readonly colors: Record<GuardianKind, number> = { brote: 0xc9a25c, lanzabrotes: 0xe8703a, tronco: 0x7a5230, glacial: 0xa8e6ff, hongo: 0xb5306a, raiz: 0x7cff9e, ancestral: 0x2f7d3a }

  handleFx(list: Fx[], game: Game): void {
    const k = game.s.king
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
          this.burst(k.x, 1.6, k.z, 6, 0x9ad36a, 2.5, 0.4)
          this.label(`−${Math.round(f.dmg)}`, k.x, 3.4, k.z, 'lh-dmg')
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
        case 'dash':
          this.burst(f.x, 0.4, f.z, 18, 0xe8e2c8, 3, 0.5, 0.5)
          break
        case 'summon':
          this.ring(f.x, f.z, 3, 0x8a5ad6, 0.5)
          this.burst(f.x, 0.3, f.z, 20, 0x4b2a6e, 3, 0.7)
          break
        case 'assault':
          for (let i = 0; i < 6; i++) this.burst((Math.random() - 0.5) * 12, 2 + Math.random() * 4, LENGTH - 2, 16, [0xffe066, 0xff5fd2, 0x7cff9e, 0x66ccff][i % 4]!, 6, 1.2)
          this.shake = Math.max(this.shake, 0.3)
          break
        case 'down':
          this.burst(k.x, 1, k.z, 30, 0x7fae6a, 5, 0.9)
          this.label('¡DERRIBADO!', k.x, 4, k.z, 'lh-shout')
          break
        case 'event':
          break
        case 'end':
          break
      }
    }
  }

  // ───────────────────────────── fotograma ─────────────────────────────

  private syncGuardian(g: Guardian, t: number): void {
    let a = this.guardians.get(g.id)
    if (!a) {
      const m = guardianModel(g.kind)
      a = { ...m, kind: g.kind, born: t }
      a.root.position.set(g.x, 0, g.z)
      a.root.rotation.y = Math.PI // miran hacia la calle
      this.scene.add(a.root)
      this.guardians.set(g.id, a)
    }
    // brota del suelo con rebote
    const age = t - a.born
    const pop = age < 0.35 ? 1.25 * Math.sin((age / 0.35) * Math.PI * 0.62) : 1
    const hit = t - g.hitAt < 0.15 ? 1 + 0.18 * Math.sin(((t - g.hitAt) / 0.15) * Math.PI) : 1
    const stunned = t < g.stunUntil
    a.root.scale.setScalar(Math.max(0.01, pop) * hit)
    a.root.rotation.z = stunned ? Math.sin(t * 22) * 0.08 : 0
    const p = a.parts
    if (g.kind === 'lanzabrotes' && p.head) {
      const shotAge = 1.0 - (g.next - t)
      p.head.position.z = shotAge >= 0 && shotAge < 0.18 ? 0.22 * (1 - shotAge / 0.18) : 0
      p.head.rotation.x = Math.sin(t * 2 + g.id) * 0.06
    }
    if (g.kind === 'glacial' && p.head) {
      p.head.rotation.y = t * 0.8
      if (p.ring) (p.ring as THREE.Mesh).scale.setScalar(1 + Math.sin(t * 2.5) * 0.02)
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
    if (a.bar) {
      const show = g.hp < g.maxHp
      a.bar.bg.visible = a.bar.fill.visible = show
      if (show) {
        const f = Math.max(0, g.hp / g.maxHp)
        a.bar.fill.scale.x = Math.max(0.001, f)
        const w = (a.bar.fill.geometry as THREE.PlaneGeometry).parameters.width
        a.bar.fill.position.x = -(w * (1 - f)) / 2
        ;(a.bar.fill.material as THREE.MeshBasicMaterial).color.setHex(f > 0.5 ? 0x6ee06e : f > 0.25 ? 0xf0c83c : 0xe6483c)
        a.bar.bg.quaternion.copy(this.camera.quaternion)
        a.bar.fill.quaternion.copy(this.camera.quaternion)
        // la raíz del actor está girada: se compensa
        a.bar.bg.quaternion.premultiply(a.root.quaternion.clone().invert())
        a.bar.fill.quaternion.premultiply(a.root.quaternion.clone().invert())
      }
    }
  }

  frame(game: Game, dt: number, moving: boolean): void {
    const s = game.s
    const t = s.t
    const k = s.king
    this.handleFx(game.drainFx(), game)

    // Rey
    const K = this.king
    const down = k.downUntil > 0
    const feast = k.feastUntil > 0
    // recién levantado parpadea: es intocable unos segundos
    K.root.visible = !feast && !(t < k.safeUntil && Math.floor(t * 12) % 2 === 0)
    K.root.position.set(k.x, 0, k.z)
    K.root.rotation.y = k.facing
    const run = moving && !down ? Math.sin(t * 13) : 0
    const dashing = t < k.dashUntil
    K.parts.legL!.rotation.x = run * 0.9
    K.parts.legR!.rotation.x = -run * 0.9
    const atk = 0.42 - (k.attackAt - t)
    const swing = atk >= 0 && atk < 0.25 ? Math.sin((atk / 0.25) * Math.PI) : 0
    K.parts.armL!.rotation.x = -1.25 + run * 0.25 - swing * 1.3
    K.parts.armR!.rotation.x = -1.25 - run * 0.25 - swing * 1.3
    K.parts.body!.position.y = Math.abs(run) * 0.08
    K.parts.body!.rotation.x = dashing ? 0.5 : moving ? 0.12 : Math.sin(t * 1.6) * 0.02
    K.parts.head!.rotation.z = Math.sin(t * 2.1) * 0.06
    K.parts.cape!.rotation.x = 0.16 + (moving ? 0.5 + Math.sin(t * 9) * 0.1 : 0) + (dashing ? 0.5 : 0)
    K.root.rotation.x = down ? -Math.PI / 2 : 0
    K.root.position.y = down ? 0.5 : 0
    const hurt = t - k.hurtAt < 0.12
    K.root.scale.setScalar(hurt ? 1.08 : 1)
    if (dashing && Math.random() < 0.8) this.burst(k.x, 0.3, k.z, 2, 0xe8e2c8, 1.5, 0.35, 0.4)
    if (t < k.confusedUntil && Math.random() < 0.3) this.burst(k.x, 3.2, k.z, 1, 0xc77dff, 1, 0.5, 0.3, 0)
    if (k.slowed && Math.random() < 0.3) this.burst(k.x, 0.4, k.z, 1, 0xa8e6ff, 1, 0.5, 0.6, 1)

    // guardianes
    const alive = new Set<number>()
    for (const g of s.guardians) {
      alive.add(g.id)
      this.syncGuardian(g, t)
    }
    for (const [id, a] of this.guardians)
      if (!alive.has(id)) {
        this.scene.remove(a.root)
        this.guardians.delete(id)
      }
    // esbirros
    const am = new Set<number>()
    for (const m of s.minions) {
      am.add(m.id)
      let a = this.minions.get(m.id)
      if (!a) {
        a = minionModel()
        this.scene.add(a.root)
        this.minions.set(m.id, a)
      }
      a.root.position.set(m.x, 0, m.z)
      const w = Math.sin(t * 9 + m.id)
      a.parts.legL!.rotation.x = w * 0.7
      a.parts.legR!.rotation.x = -w * 0.7
      a.root.rotation.z = w * 0.05
      a.root.scale.setScalar(t - m.hitAt < 0.1 ? 1.15 : 1)
    }
    for (const [id, a] of this.minions)
      if (!am.has(id)) {
        this.scene.remove(a.root)
        this.minions.delete(id)
      }
    // disparos
    const as = new Set<number>()
    for (const sh of s.shots) {
      as.add(sh.id)
      let m = this.shots.get(sh.id)
      if (!m) {
        m = sh.kind === 'mortero' ? mesh(G.sph(0.45, 8), mat(0x6b4a2b, { emissive: 0xff7a00, emissiveIntensity: 0.9 })) : mesh(G.sph(0.2, 6), mat(0xc8f06a, { emissive: 0x5a8a00, emissiveIntensity: 0.6 }))
        this.scene.add(m)
        this.shots.set(sh.id, m)
        if (sh.kind === 'mortero') {
          // sombra-aviso donde va a caer
          const warn = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.8, 32), new THREE.MeshBasicMaterial({ color: 0xff4020, transparent: true, opacity: 0.8, side: THREE.DoubleSide }))
          warn.rotation.x = -Math.PI / 2
          warn.position.set(0, 0.06 - 0, 0)
          m.userData.warn = warn
          warn.position.set(sh.tx, 0.06, sh.tz)
          this.scene.add(warn)
        }
      }
      m.visible = sh.kind !== 'mortero' || sh.t >= 0
      m.position.set(sh.x, sh.kind === 'mortero' ? Math.max(0.3, sh.y) : sh.y, sh.z)
      if (sh.kind === 'mortero' && sh.t >= 0 && Math.random() < 0.6) this.burst(sh.x, sh.y + 0.5, sh.z, 1, 0xffa033, 0.6, 0.3, 0.2, 0)
    }
    for (const [id, m] of this.shots)
      if (!as.has(id)) {
        if (m.userData.warn) this.scene.remove(m.userData.warn as THREE.Object3D)
        this.scene.remove(m)
        this.shots.delete(id)
      }

    // partículas
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!
      p.life -= dt
      if (p.life <= 0) {
        this.scene.remove(p.m)
        if (!p.shrink) {
          p.m.geometry.dispose()
          ;(p.m.material as THREE.Material).dispose()
        }
        this.particles.splice(i, 1)
        continue
      }
      const f = p.life / p.max
      if (p.shrink) {
        p.vy -= p.grav * dt
        p.m.position.x += p.vx * dt
        p.m.position.y = Math.max(0.05, p.m.position.y + p.vy * dt)
        p.m.position.z += p.vz * dt
        p.m.scale.setScalar(Math.max(0.05, f))
        p.m.rotation.x += dt * 6
        p.m.rotation.y += dt * 4
      } else {
        const r = (p.m.userData.r as number) * (1 - f)
        p.m.scale.setScalar(Math.max(0.01, r))
        ;(p.m.material as THREE.MeshBasicMaterial).opacity = f
      }
    }

    // cámara: detrás del Rey (con adelanto) o táctica desde arriba
    const sh = this.shake > 0 ? this.shake : 0
    this.shake = Math.max(0, this.shake - dt * 1.6)
    const target = new THREE.Vector3()
    const look = new THREE.Vector3()
    if (feast || s.phase === 'ended') {
      target.set(Math.sin(t * 0.4) * 10, 9, LENGTH - 20)
      look.set(0, 4, LENGTH + 4)
    } else if (this.cameraMode === 0) {
      target.set(k.x * 0.55, 6.2, k.z - 9.5)
      look.set(k.x * 0.8, 1.6, k.z + 9)
    } else {
      target.set(k.x * 0.3, 27, k.z - 6)
      look.set(k.x * 0.3, 0, k.z + 9)
    }
    const kk = 1 - Math.pow(0.0015, dt)
    this.camPos.lerp(target, kk)
    this.camLook.lerp(look, kk)
    this.camera.position.copy(this.camPos)
    if (sh > 0) this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, 0))
    this.camera.lookAt(this.camLook)
    this.camera.fov = 58 + (dashing ? 9 : 0)
    this.camera.updateProjectionMatrix()
    // el sol sigue al Rey para que las sombras tengan detalle en todo el jardín
    this.sun.position.set(k.x - 30, 50, k.z - 20)
    this.sun.target.position.set(k.x, 0, k.z + 8)

    // rótulos
    const w = this.renderer.domElement.clientWidth
    const h = this.renderer.domElement.clientHeight
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
      l.el.style.transform = `translate(-50%,-50%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`
      l.el.style.opacity = String(Math.min(1, l.life / 0.4))
    }
    this.flash = Math.max(0, this.flash - dt)
    this.renderer.render(this.scene, this.camera)
  }

  /** 0..1: cuánto queda del destello rojo de daño (lo pinta el HUD). */
  get hurtFlash(): number {
    return this.flash / 0.35
  }

  dispose(): void {
    for (const l of this.labels) l.el.remove()
    this.renderer.dispose()
  }
}
