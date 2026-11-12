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
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { buildClouds, buildScenery } from './scenery'
import { FLASH, FROZEN, TOON, guardianDef, heroDef, instantiate, kingDef, zombieDef, type Instance } from './models'

const mat = (color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...opts })

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, cast = true): THREE.Mesh {
  const o = new THREE.Mesh(geo, m)
  o.position.set(x, y, z)
  o.castShadow = cast
  o.receiveShadow = true
  return o
}

/**
 * Geometrías compartidas: las piezas con las mismas medidas se crean una sola vez (cientos de zombis iguales no
 * multiplican la memoria de la tarjeta gráfica). Se marcan como compartidas para no liberarlas al quitar un modelo.
 */
const geoCache = new Map<string, THREE.BufferGeometry>()
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key)
  if (!g) {
    g = make()
    g.userData.shared = true
    geoCache.set(key, g)
  }
  return g
}
const G = {
  box: (w: number, h: number, d: number) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
  sph: (r: number, s = 10) => cached(`s${r},${s}`, () => new THREE.SphereGeometry(r, s, Math.max(6, s - 2))),
  cyl: (a: number, b: number, h: number, s = 10) => cached(`c${a},${b},${h},${s}`, () => new THREE.CylinderGeometry(a, b, h, s)),
  cone: (r: number, h: number, s = 8) => cached(`o${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s)),
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
  /** mallas con sombreado: se les cambia el material para el destello de golpe o el congelado */
  skins?: THREE.Mesh[]
  /** escala propia del modelo (coloso, titán…) */
  scale?: number
  /** material puesto ahora en las pieles */
  look?: THREE.Material
}

// ───────────────────────────── modelos ─────────────────────────────
// Los modelos están en models.ts (estilo dibujo animado: formas redondeadas, sombreado por escalones y contorno).

function bars(root: THREE.Object3D, w: number, top: number): NonNullable<Actor['bar']> {
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.06, 0.16), new THREE.MeshBasicMaterial({ color: 0x1b1226, transparent: true, opacity: 0.85 }))
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.1), new THREE.MeshBasicMaterial({ color: 0x6ee06e, toneMapped: false }))
  bg.position.y = fill.position.y = top
  fill.position.z = 0.002
  bg.visible = fill.visible = false
  bg.renderOrder = 5
  fill.renderOrder = 6
  root.add(bg, fill)
  return { bg, fill, w }
}

function fromInstance(i: Instance, barW?: number): Actor {
  const a: Actor = { root: i.root, parts: i.parts, born: 0, skins: i.skins, scale: i.scale }
  if (barW) a.bar = bars(i.root, barW, i.top)
  return a
}

const kingModel = (crown: number): Actor => fromInstance(instantiate(kingDef(crown)))
const heroModel = (): Actor => fromInstance(instantiate(heroDef()))
const zombieModel = (kind: ZombieKind, id: number): Actor => fromInstance(instantiate(zombieDef(kind, id)), 0.9)
const guardianModel = (kind: GuardianKind): Actor => {
  const def = guardianDef(kind)
  return fromInstance(instantiate(def), Math.max(1, GUARDIANS[kind].radius * 1.8))
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
  kind: 'p' | 'ring' | 'beam' | 'smoke'
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
  private readonly pGeo = new THREE.IcosahedronGeometry(0.16, 1)
  private readonly smokeGeo = new THREE.IcosahedronGeometry(0.5, 1)
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
  private nightGlow!: THREE.MeshBasicMaterial
  private clouds: THREE.Group | null = null
  private composer!: EffectComposer
  private bloom!: UnrealBloomPass
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
    this.renderer.toneMappingExposure = 1.1
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    // resplandor: lo que brilla (ojos, núcleos, ventanas de noche, explosiones) desprende un halo suave
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.92)
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())
    for (const g of [this.pGeo, this.smokeGeo, this.ringGeo, this.shotGeo.semilla, this.shotGeo.mortero, this.shotGeo.warn]) g.userData.shared = true
    for (const m of Object.values(this.shotMat)) m.userData.shared = true
    this.buildWorld()
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false)
    this.composer.setSize(w, h)
    this.composer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
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

    // escenario de dibujo animado (models/scenery.ts): jardín, setos, valla, árboles, farolas y la casa
    const scen = buildScenery()
    sc.add(scen.group)
    this.nightGlow = scen.nightGlow
    this.clouds = buildClouds()
    sc.add(this.clouds)
    // pocas luces reales (caras): delante de la casa y dos farolas; se encienden al anochecer
    const picks: [number, number, number][] = [[-5, 3.6, LENGTH - 6], [5, 3.6, LENGTH - 6], scen.lamps[1] ?? [0, 3, 40], scen.lamps[scen.lamps.length - 2] ?? [0, 3, 70]]
    for (const [x, y, z] of picks) {
      const l = new THREE.PointLight(0xffc870, 0, 26, 1.6)
      l.position.set(x, y, z)
      sc.add(l)
      this.lamps.push(l)
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
    // ventanas y farolas: apagadas de día, encendidas (y con resplandor) de noche
    this.nightGlow.color.setRGB(0.6 + lit * 1.0, 0.54 + lit * 0.9, 0.44 + lit * 0.6)
    if (this.clouds) this.clouds.position.x = Math.sin(this.time * 0.01) * 20
    this.rain.visible = storm
  }

  // ───────────────────────────── efectos ─────────────────────────────

  private pmat(color: number): THREE.MeshBasicMaterial {
    let m = this.pMats.get(color)
    if (!m) {
      // sin mapeo de tonos: los colores vivos (fuego, chispas, energía) se ven intensos y el resplandor los recoge
      m = new THREE.MeshBasicMaterial({ color, toneMapped: false })
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

  /** Bocanadas de humo o polvo: bolas que crecen, suben despacio y se desvanecen. */
  private smoke(x: number, y: number, z: number, n: number, color: number, size = 1, life = 1.2): void {
    for (let i = 0; i < n && this.particles.length < 1100; i++) {
      const m = new THREE.MeshToonMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, gradientMap: (TOON as THREE.MeshToonMaterial).gradientMap })
      const p = new THREE.Mesh(this.smokeGeo, m)
      p.position.set(x + (Math.random() - 0.5) * size, y + Math.random() * size * 0.5, z + (Math.random() - 0.5) * size)
      this.scene.add(p)
      const a = Math.random() * Math.PI * 2
      const l = life * (0.7 + Math.random() * 0.6)
      this.particles.push({ m: p, vx: Math.cos(a) * size * 0.8, vy: 0.6 + Math.random() * 0.8, vz: Math.sin(a) * size * 0.8, life: l, max: l, grav: 0, kind: 'smoke', r: size * (0.8 + Math.random() * 0.6) })
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
          this.smoke(f.x, 0.2, f.z, 3, 0xc9a070, 0.6, 0.6)
          this.burst(f.x, 0.3, f.z, 10, 0x6b4a2b, 2.2, 0.5)
          this.burst(f.x, 0.4, f.z, 6, this.colors[f.kind], 1.6, 0.6)
          this.label(f.owner, f.x, GUARDIANS[f.kind].radius * 2 + 1.4, f.z, 'lh-owner')
          break
        case 'break':
          this.burst(f.x, 0.8, f.z, f.kind === 'ancestral' ? 60 : 16, this.colors[f.kind], 4, 0.8)
          this.burst(f.x, 0.6, f.z, 8, 0x6b4a2b, 3, 0.7)
          this.smoke(f.x, 0.4, f.z, f.kind === 'ancestral' ? 10 : 4, 0xe8dcc0, f.kind === 'ancestral' ? 2.2 : 0.9, 0.9)
          if (f.kind === 'ancestral' || f.kind === 'tronco') this.shake = Math.max(this.shake, 0.4)
          break
        case 'hit':
          this.burst(f.x, 1, f.z, f.big ? 12 : 5, 0xfff2a8, f.big ? 4 : 2.4, 0.35)
          this.burst(f.x, 1, f.z, 3, 0xb8ff6a, 2, 0.25, 0.6, 3)
          break
        case 'kingHurt':
          this.flash = 0.35
          this.shake = Math.max(this.shake, 0.18)
          this.burst(h.x, 1.6, h.z, 6, 0x9ad36a, 2.5, 0.4)
          this.label(`−${Math.round(f.dmg)}`, h.x, 3.4, h.z, 'lh-dmg')
          break
        case 'boom':
          // fogonazo, bola de fuego, chispas, humo que sube y onda
          this.burst(f.x, 0.8, f.z, 10, 0xffffd0, 3, 0.25, 1, 0)
          this.burst(f.x, 0.6, f.z, 34, 0xffa033, 7, 0.7)
          this.burst(f.x, 0.6, f.z, 16, 0xff5a1a, 5, 0.6)
          this.smoke(f.x, 0.5, f.z, 6, 0xffb060, f.r * 0.5, 0.5)
          this.smoke(f.x, 0.8, f.z, 8, 0x8a8494, f.r * 0.6, 1.6)
          this.ring(f.x, f.z, f.r, 0xffc04d, 0.45)
          this.ring(f.x, f.z, f.r * 1.6, 0xffffff, 0.3)
          this.bolt = Math.max(this.bolt, 0.08)
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
          // ¡puf! nube de polvo verdoso y trocitos
          this.burst(f.x, 1, f.z, f.big ? 50 : 12, 0x9fd08a, f.big ? 6 : 3.5, 0.7)
          this.burst(f.x, 1, f.z, f.big ? 20 : 5, 0x6a78c9, 3, 0.7)
          this.smoke(f.x, 0.6, f.z, f.big ? 10 : 3, 0xd8e8c8, f.big ? 2.4 : 0.8, 0.8)
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

  /** Cambia el material de las pieles de un personaje (solo si cambia: no cuesta nada fotograma a fotograma). */
  private skin(a: Actor, m: THREE.Material): void {
    if (!a.skins || a.look === m) return
    a.look = m
    for (const s of a.skins) s.material = m
  }

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
    if (g.kind === 'hongo' && p.cap) {
      const armed = g.fuse > 0
      p.cap.scale.setScalar(armed ? 1 + ((t * 14) % 1) * 0.35 : 1 + Math.sin(t * 3 + g.id) * 0.04)
      this.skin(a, armed && Math.floor(t * 14) % 2 === 0 ? FLASH : TOON)
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
    const spawn = Math.min(1, (t - a.born) / 0.3)
    // aparece con un pequeño rebote y se estira al recibir un golpe
    const squash = t - u.hitAt < 0.12 ? 1 + 0.15 * Math.sin(((t - u.hitAt) / 0.12) * Math.PI) : 1
    a.root.scale.set((a.scale ?? 1) * squash, (a.scale ?? 1) / squash, (a.scale ?? 1) * squash).multiplyScalar(0.3 + 0.7 * spawn)
    p.head!.rotation.z = Math.sin(t * 2 + u.id) * 0.12
    this.skin(a, t - u.hitAt < 0.07 ? FLASH : u.slowed ? FROZEN : TOON)
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
    H.root.scale.setScalar((H.scale ?? 1) * (h.hurt ? 1.08 : 1))
    this.skin(H, h.hurt && Math.floor(t * 20) % 2 === 0 ? FLASH : TOON)
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
        p.m.scale.y *= 1 + Math.min(1.5, Math.abs(p.vy) * 0.08) // se estiran al volar (chispas)
      } else if (p.kind === 'smoke') {
        p.m.position.x += p.vx * dt
        p.m.position.y += p.vy * dt
        p.m.position.z += p.vz * dt
        p.vx *= 1 - dt * 2
        p.vz *= 1 - dt * 2
        p.m.scale.setScalar(p.r * (0.5 + (1 - f) * 1.1))
        ;(p.m.material as THREE.MeshToonMaterial).opacity = Math.min(0.85, f * 1.4)
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
      // un poco más alta que en Invasión: el Guardián queda en el tercio central y se ve la horda llegar
      // por delante de la fachada (nunca dentro de la casa), alta para ver al Guardián y la horda que llega
      target.set(h.x * 0.5, 12, Math.min(h.z + 9, LENGTH - 0.5))
      look.set(h.x * 0.7, 0, h.z - 6)
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
    this.composer.render(dt)
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
