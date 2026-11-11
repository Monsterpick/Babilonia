import { useEffect, useRef, useState } from 'react'
import { useOnEvent } from '../../lib/live'
import type { Mode, RenderState } from './common'
import { DefenseGame, PLANT_COST, PLANT_ORDER, type DefenseInput } from './defense'
import { Director, EVENT_LABEL, type LiveIn, type Notice } from './director'
import { Sound } from './audio'
import { Game, GUARDIANS, LENGTH, type Fx, type GuardianKind, type Input } from './sim'
import { View } from './view'

/**
 * LAST HOUSE — página del juego (/juego/lasthouse). El streamer juega aquí con el teclado y captura esta ventana en
 * TikTok LIVE Studio u OBS; los espectadores juegan desde el directo (los eventos llegan por LiveArena).
 *  - Invasión: el streamer es el Rey de la Horda; los espectadores plantan defensas.
 *  - Defensa: el streamer es el Guardián de la casa; los espectadores mandan la horda.
 * ?demo=1 juega solo (piloto automático y espectadores simulados) · ?modo=defensa · ?vertical=1 (9:16).
 */

const params = new URLSearchParams(location.search)
const DEMO = params.get('demo') === '1'

interface Settings {
  mode: Mode
  duration: number
  assaults: number
  houseHp: number
  likesPer: number
  voteEvery: number
  adaptive: boolean
  vertical: boolean
  volume: number
  music: boolean
}

const DEFAULTS: Settings = { mode: 'invasion', duration: 300, assaults: 5, houseHp: 1500, likesPer: 12, voteEvery: 75, adaptive: true, vertical: false, volume: 0.8, music: true }

type Sim = Game | DefenseGame

interface Feed extends Notice {
  key: number
}

interface Hud {
  mode: Mode
  hp: number
  bar2: number
  time: number
  phase: 'playing' | 'ended'
  winner: RenderState['winner']
  // invasión
  assaults: number
  need: number
  progress: number
  // defensa
  house: number
  energy: number
  wave: number
  kills: number
  queue: number
  zombies: number
  pick: GuardianKind
  // comunes
  cds: [number, number, number]
  guardians: number
  down: boolean
  confused: boolean
  slowed: boolean
  top: { name: string; score: number }[]
  viewers: number
  vote: { a: string; b: string; ca: number; cb: number; left: number } | null
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const FONT = "'Outfit Variable','Outfit','Segoe UI',sans-serif"
const seed = () => (Date.now() % 100000) + 1

async function call<T>(method: 'GET' | 'POST', url: string, body?: unknown): Promise<T | null> {
  try {
    const r = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
    return r.ok ? ((await r.json()) as T) : null
  } catch {
    return null
  }
}

function makeSim(mode: Mode, st: Settings): Sim {
  return mode === 'invasion' ? new Game({ seed: seed(), duration: st.duration, assaults: st.assaults, likesPerSprout: st.likesPer }) : new DefenseGame({ seed: seed(), duration: st.duration, houseHp: st.houseHp })
}

const BANNER_EVENT: Record<string, string> = { tormenta: '¡TORMENTA DE SEMILLAS!', mareo: '¡AL REVÉS!', enjambre: '¡BATERÍA DE LANZABROTES!', calabazas: '¡BOMBARDEO DE CALABAZAS!', enredadera: '¡MURO DE ENREDADERA!', noche: '¡NOCHE DE TORMENTA!', estampida: '¡ESTAMPIDA!', tunel: '¡TÚNEL DE EXCAVADORES!', asedio: '¡ASEDIO!' }

export function LastHouse() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const labels = useRef<HTMLDivElement>(null)
  const flash = useRef<HTMLDivElement>(null)
  const settings = useRef<Settings>({ ...DEFAULTS, mode: params.get('modo') === 'defensa' ? 'defensa' : 'invasion', vertical: params.get('vertical') === '1' })
  const sim = useRef<Sim>(makeSim(settings.current.mode, settings.current))
  const director = useRef(new Director(sim.current, { voteEvery: DEMO ? 45 : DEFAULTS.voteEvery }))
  const view = useRef<View | null>(null)
  const sound = useRef(new Sound(DEFAULTS.volume))
  const keys = useRef(new Set<string>())
  const press = useRef({ attack: false, dash: false, roar: false, summon: false })
  const pick = useRef<GuardianKind>('lanzabrotes')
  const started = useRef(DEMO)
  const [mode, setMode] = useState<Mode>(settings.current.mode)
  const [vertical, setVertical] = useState(settings.current.vertical)
  const [hud, setHud] = useState<Hud | null>(null)
  const [feed, setFeed] = useState<Feed[]>([])
  const [banner, setBanner] = useState<{ text: string; sub: string; key: number; color?: string } | null>(null)
  const [intro, setIntro] = useState(!DEMO)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ unlocked: { name: string; desc: string }[]; crowns: string[] } | null>(null)
  const crown = useRef<number>(0xf2c43d)
  const seq = useRef(0)

  // ajustes y corona elegida (si la app no responde, valores por defecto)
  useEffect(() => {
    void call<Settings>('GET', '/api/lasthouse/settings').then((s) => {
      if (!s) return
      const keepMode = params.get('modo')
      settings.current = { ...DEFAULTS, ...s, mode: keepMode === 'defensa' || keepMode === 'invasion' ? keepMode : s.mode, vertical: params.get('vertical') === '1' || s.vertical }
      setVertical(settings.current.vertical)
      sound.current.setVolume(s.volume)
      if (!started.current) {
        setMode(settings.current.mode)
        reset(settings.current.mode)
      }
    })
    void call<{ crown: string }>('GET', '/api/lasthouse/progress').then((p) => {
      if (p?.crown) {
        crown.current = parseInt(p.crown.slice(1), 16)
        view.current?.setCrown(crown.current)
      }
    })
    const leave = () => {
      if (!DEMO) navigator.sendBeacon?.('/api/lasthouse/session', new Blob([JSON.stringify({ active: false })], { type: 'application/json' }))
    }
    window.addEventListener('pagehide', leave)
    return () => {
      window.removeEventListener('pagehide', leave)
      leave()
    }
  }, [])

  const reset = (m: Mode) => {
    const st = settings.current
    sim.current = makeSim(m, st)
    director.current = new Director(sim.current, { voteEvery: DEMO ? 45 : st.voteEvery, likesPer: st.likesPer, adaptive: st.adaptive })
    view.current?.clear()
    setFeed([])
    setBanner(null)
    setResult(null)
    setHud(null)
  }

  const begin = (m: Mode) => {
    if (sim.current.mode !== m || sim.current.s.t > 0) reset(m)
    setMode(m)
    started.current = true
    setIntro(false)
    sound.current.unlock()
    view.current?.intro()
    if (!DEMO) void call('POST', '/api/lasthouse/session', { active: true })
  }

  const toMenu = () => {
    started.current = false
    reset(sim.current.mode)
    setIntro(true)
  }

  // eventos del directo
  useOnEvent((ev) => {
    if (!started.current) return
    director.current.handle(ev as unknown as LiveIn)
  })

  useEffect(() => {
    let v: View
    try {
      v = new View(canvas.current!, labels.current!, { crown: crown.current })
    } catch (e) {
      setError(`No se pudo iniciar el 3D (WebGL): ${(e as Error).message}`)
      return
    }
    view.current = v
    const onResize = () => v.resize(window.innerWidth, window.innerHeight)
    onResize()
    window.addEventListener('resize', onResize)
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault()
      if (e.repeat) return
      keys.current.add(k)
      if (k === 'shift') press.current.dash = true
      if (k === 'e') press.current.roar = true
      if (k === 'q' || k === 'f') press.current.summon = true
      if (k === 'c') v.cameraMode = v.cameraMode === 0 ? 1 : 0
      if (k === 'm') {
        sound.current.setMuted(!sound.current.isMuted)
        setMuted(sound.current.isMuted)
      }
      const n = Number(k)
      if (n >= 1 && n <= PLANT_ORDER.length) pick.current = PLANT_ORDER[n - 1]!
      if (k === 'r' && sim.current.s.phase === 'ended') begin(sim.current.mode)
      if ((k === 'escape' || k === 'tab') && (sim.current.s.phase === 'ended' || !started.current)) toMenu()
      if (k === 'enter' && !started.current) begin(sim.current.mode)
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    const blur = () => keys.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)

    // espectadores de mentira (solo ?demo=1): pasan por el mismo director que los de verdad
    const NAMES = ['Sofi', 'Tomás', 'Rocío', 'Leo', 'Ana', 'Max', 'Lucía', 'Mateo', 'Givi', 'Santos', 'Nora', 'Iker', 'Valen', 'Bruno', 'Abril', 'Hugo']
    let demoAt = 1
    const demo = (d: Director, t: number) => {
      if (t < demoAt) return
      demoAt = t + 0.25 + Math.random() * 0.45
      const who = NAMES[Math.floor(Math.random() * NAMES.length)]!
      const user = { id: who, nickname: who }
      const r = Math.random()
      if (d.vote && Math.random() < 0.5) d.handle({ type: 'chat', user, payload: { text: Math.random() < 0.55 ? '1' : '2' } })
      else if (r < 0.45) d.handle({ type: 'like', user, payload: { count: 10 + Math.floor(Math.random() * 25) } })
      else if (r < 0.8) d.handle({ type: 'chat', user, payload: { text: ['hola', 'lanza', 'tronco', 'hielo', 'corre', 'tanque', 'vamos'][Math.floor(Math.random() * 7)]! } })
      else if (r < 0.88) d.handle({ type: 'follow', user })
      else if (r < 0.93) d.handle({ type: 'share', user })
      else {
        const coins = [1, 1, 1, 5, 5, 20, 99, 199, 299, 499, 1000][Math.floor(Math.random() * (Math.random() < 0.85 ? 6 : 11))]!
        d.handle({ type: 'gift', user, payload: { name: 'Regalo', diamonds: coins, count: 1 } })
      }
    }
    // pilotos automáticos de la demo
    const kingPilot = (g: Game): Input => {
      const k = g.s.king
      let mx = 0
      for (const gd of g.s.guardians) {
        if (!GUARDIANS[gd.kind].solid) continue
        const dz = gd.z - k.z
        if (dz > 0 && dz < 4 && Math.abs(gd.x - k.x) < GUARDIANS[gd.kind].radius + 1) mx += gd.x > k.x ? -1 : 1
      }
      return { mx: Math.max(-1, Math.min(1, mx)), mz: 1, attack: true, dash: Math.random() < 0.01, roar: Math.random() < 0.004, summon: Math.random() < 0.02 }
    }
    const guardPilot = (g: DefenseGame): DefenseInput => {
      const h = g.s.hero
      // va hacia la columna con más zombis cerca
      let best = 0
      let bx = 0
      for (const z of g.s.zombies) {
        const w = Math.max(0, 1 - (h.z - z.z) / 60)
        if (w > best) {
          best = w
          bx = z.x
        }
      }
      const mx = Math.abs(bx - h.x) > 0.6 ? Math.sign(bx - h.x) : 0
      const want: GuardianKind = h.energy > 150 ? (Math.random() < 0.5 ? 'tronco' : 'glacial') : 'lanzabrotes'
      return { mx, mz: h.z > LENGTH - 9 ? -0.4 : 0, attack: true, dash: false, roar: g.s.zombies.some((z) => Math.hypot(z.x - h.x, z.z - h.z) < 3), summon: h.energy > (PLANT_COST[want] ?? 999) + 30 && Math.random() < 0.05, pick: want }
    }

    let raf = 0
    let acc = 0
    const STEP = 1 / 60
    let last = performance.now()
    let hudAt = 0
    let postAt = 0
    let lastPhase = 'playing'
    let lastAssaults = 0
    let lastNotice = 0
    let reported: Sim | null = null
    let endedAt = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      // la simulación avanza en pasos fijos de 1/60 s (aunque el equipo vaya a pocos FPS no va a cámara lenta)
      const dt = Math.min(0.25, (now - last) / 1000)
      last = now
      const g = sim.current
      const d = director.current
      const ks = keys.current
      const sx = (ks.has('d') || ks.has('arrowright') ? 1 : 0) - (ks.has('a') || ks.has('arrowleft') ? 1 : 0)
      const sz = (ks.has('w') || ks.has('arrowup') ? 1 : 0) - (ks.has('s') || ks.has('arrowdown') ? 1 : 0)
      const attack = ks.has(' ') || ks.has('j') || press.current.attack
      const one = { dash: press.current.dash, roar: press.current.roar, summon: press.current.summon }
      press.current.dash = press.current.roar = press.current.summon = false
      let moving = false
      if (started.current) {
        acc += dt
        let first = true
        while (acc >= STEP) {
          acc -= STEP
          if (DEMO) demo(d, g.s.t)
          d.tick()
          // las pulsaciones de un toque solo cuentan en el primer paso
          const o = first ? one : { dash: false, roar: false, summon: false }
          if (g instanceof Game) {
            // cámara detrás del Rey mirando a +z: «derecha» en pantalla es −x del mundo
            const input: Input = DEMO ? kingPilot(g) : { mx: -sx, mz: sz, attack, ...o }
            if (!first && DEMO) Object.assign(input, { dash: false, roar: false, summon: false })
            g.tick(STEP, input)
            moving = Math.abs(input.mx) > 0.1 || Math.abs(input.mz) > 0.1
          } else {
            // cámara detrás del Guardián mirando a −z: «derecha» es +x y «adelante» es −z
            const input: DefenseInput = DEMO ? guardPilot(g) : { mx: sx, mz: -sz, attack, ...o, pick: pick.current }
            if (!first && DEMO) Object.assign(input, { dash: false, roar: false, summon: false })
            g.tick(STEP, input)
            moving = Math.abs(input.mx) > 0.1 || Math.abs(input.mz) > 0.1
          }
          first = false
        }
      }
      void moving
      const r = g.render()
      const fx: Fx[] = g.drainFx()
      // carteles y sonido según lo que pasó
      for (const f of fx) {
        if (f.type === 'event') setBanner({ text: BANNER_EVENT[f.name] ?? f.name.toUpperCase(), sub: f.owner === 'El chat' ? 'lo ha votado el chat' : `de ${f.owner}`, key: now })
        else if (f.type === 'plant' && f.kind === 'ancestral') setBanner({ text: '¡GUARDIÁN ANCESTRAL!', sub: `de ${f.owner}`, key: now, color: '#7cff9e' })
        else if (f.type === 'spawn' && f.big && f.owner) setBanner({ text: f.kind === 'titan' ? '¡TITÁN!' : '¡COLOSO!', sub: `de ${f.owner}`, key: now, color: '#ff6b6b' })
        else if (f.type === 'wave' && f.n > 1) setBanner({ text: `OLEADA ${f.n}`, sub: f.n % 4 === 0 ? 'con un Coloso' : '', key: now, color: '#ffb347' })
      }
      if (g instanceof Game && g.s.assaults !== lastAssaults) {
        lastAssaults = g.s.assaults
        if (g.s.assaults > 0 && g.s.phase === 'playing') setBanner({ text: '¡ASALTO!', sub: `${g.s.assaults} de ${g.cfg.assaults}`, key: now, color: '#c084fc' })
      }
      sound.current.play(fx)
      v.frame({ render: () => r, drainFx: () => fx }, dt)
      if (flash.current) flash.current.style.opacity = String(v.hurtFlash * 0.45)
      // música: más intensa cuanto más apretada está la partida
      if (g instanceof Game) sound.current.intensity = 0.2 + (g.s.assaults / g.cfg.assaults) * 0.5 + (g.timeLeft < 60 ? 0.3 : 0) + (g.s.king.z / LENGTH) * 0.15
      else sound.current.intensity = 0.2 + Math.min(0.5, g.s.zombies.length / 60) + (1 - (r.house ?? 1)) * 0.4
      sound.current.update(started.current && r.phase === 'playing' && settings.current.music)
      // avisos del director
      if (d.notices.length) {
        const add = d.notices.splice(0)
        lastNotice = now
        setFeed((f) => [...f, ...add.slice(-5).map((n) => ({ ...n, key: ++seq.current }))].slice(-5))
      }
      if (now - lastNotice > 9000 && lastNotice) {
        lastNotice = 0
        setFeed([])
      }
      // final: guardar la partida (récords, logros) una vez
      if (r.phase === 'ended' && reported !== g && started.current) {
        reported = g
        const scores = g instanceof Game ? [...g.s.scores.entries()].map(([name, sc]) => ({ name, score: sc.plants })) : [...g.s.scores.entries()].filter(([n]) => n !== 'Horda').map(([name, sc]) => ({ name, score: sc.sent }))
        const body = {
          mode: g.mode,
          winner: r.winner,
          played: g.s.t,
          duration: g.cfg.duration,
          assaults: g instanceof Game ? g.s.assaults : 0,
          downs: g instanceof Game ? g.s.downs : 0,
          kills: g instanceof DefenseGame ? g.s.kills : 0,
          house: r.house ?? 0,
          titans: g instanceof DefenseGame ? g.s.titans : 0,
          viewers: d.participants,
          scores: scores.filter((x) => x.score > 0).slice(0, 500),
        }
        if (!DEMO) void call<{ unlocked: { name: string; desc: string }[]; crowns: string[] }>('POST', '/api/lasthouse/result', body).then((res) => res && setResult(res))
      }
      // la demo vuelve a empezar sola (sirve para dejarla horas como prueba de resistencia)
      if (DEMO && r.phase === 'ended') {
        if (!endedAt) endedAt = now
        else if (now - endedAt > 6000) {
          endedAt = 0
          reset(params.get('alternar') === '1' ? (g.mode === 'invasion' ? 'defensa' : 'invasion') : g.mode)
        }
      }
      if (now - hudAt > 100 || r.phase !== lastPhase) {
        hudAt = now
        lastPhase = r.phase
        const v0 = d.vote
        const vote = v0 ? { a: EVENT_LABEL[v0.options[0]], b: EVENT_LABEL[v0.options[1]], ca: v0.counts[0], cb: v0.counts[1], left: Math.max(0, v0.endsAt - g.s.t) } : null
        const base = { mode: g.mode, time: g.timeLeft, phase: r.phase, winner: r.winner, guardians: r.guardians.length, viewers: d.active, vote, pick: pick.current }
        let h: Hud
        if (g instanceof Game) {
          const k = g.s.king
          h = {
            ...base,
            hp: k.hp / k.maxHp,
            bar2: k.rot / 100,
            assaults: g.s.assaults,
            need: g.cfg.assaults,
            progress: Math.max(0, Math.min(1, k.z / LENGTH)),
            house: 1,
            energy: 0,
            wave: 0,
            kills: 0,
            queue: 0,
            zombies: 0,
            cds: [Math.max(0, k.dashAt - g.s.t), Math.max(0, k.roarAt - g.s.t), Math.max(0, k.summonAt - g.s.t)],
            down: k.downUntil > 0,
            confused: g.s.t < k.confusedUntil,
            slowed: k.slowed,
            top: [...g.s.scores.entries()].map(([name, sc]) => ({ name, score: sc.plants })).sort((a, b) => b.score - a.score).slice(0, 5),
          }
        } else {
          const hh = g.s.hero
          h = {
            ...base,
            hp: hh.hp / hh.maxHp,
            bar2: hh.energy / 300,
            assaults: 0,
            need: 0,
            progress: 0,
            house: r.house ?? 0,
            energy: hh.energy,
            wave: g.s.wave,
            kills: g.s.kills,
            queue: g.s.queue.length,
            zombies: g.s.zombies.length,
            cds: [Math.max(0, hh.dashAt - g.s.t), Math.max(0, hh.pulseAt - g.s.t), 0],
            down: hh.downUntil > 0,
            confused: false,
            slowed: false,
            top: [...g.s.scores.entries()].filter(([n]) => n !== 'Horda').map(([name, sc]) => ({ name, score: sc.sent })).sort((a, b) => b.score - a.score).slice(0, 5),
          }
        }
        setHud(h)
        // marcador para el overlay del directo (≈2 por segundo)
        if (now - postAt > 500 || r.phase === 'ended') {
          postAt = now
          void call('POST', '/api/lasthouse/state', { mode: h.mode, phase: started.current ? h.phase : 'intro', winner: h.winner, time: h.time, assaults: h.assaults, need: h.need, house: h.house, wave: h.wave, kills: h.kills, viewers: d.participants, top: h.top.slice(0, 3), vote: h.vote })
        }
      }
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      v.dispose()
      sound.current.dispose()
    }
  }, [])

  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 2200)
    return () => clearTimeout(t)
  }, [banner])

  const inv = hud?.mode === 'invasion'
  const accent = inv ? '#c084fc' : '#7cff9e'
  const V = vertical
  const panelPad = V ? '8px 12px' : '10px 16px'

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b0d16', overflow: 'hidden', fontFamily: FONT, color: '#fff', userSelect: 'none' }}>
      <style>{`
        .lh-label{position:absolute;left:0;top:0;font-weight:900;font-size:15px;text-shadow:0 2px 0 #000a,0 0 8px #000;white-space:nowrap;pointer-events:none}
        .lh-owner{color:#fff;background:#0009;padding:2px 9px;border-radius:99px;font-size:13px;font-weight:800}
        .lh-dmg{color:#ff6b6b;font-size:22px}
        .lh-shout{color:#ffe066;font-size:30px;letter-spacing:1px}
        @keyframes lh-pop{0%{transform:scale(.3);opacity:0}25%{transform:scale(1.12);opacity:1}85%{transform:scale(1);opacity:1}100%{transform:scale(.95);opacity:0}}
        @keyframes lh-in{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}
        @keyframes lh-glow{0%,100%{box-shadow:0 0 0 #ffe06600}50%{box-shadow:0 0 18px #ffe066aa}}
        .lh-panel{background:linear-gradient(160deg,#141826e6,#0b0d16ee);border:2px solid #ffffff22;border-radius:16px;box-shadow:0 10px 30px #0008}
        .lh-key{display:inline-grid;place-items:center;min-width:24px;height:24px;padding:0 6px;border-radius:7px;background:#ffffff1c;border:1px solid #ffffff33;font-weight:900;font-size:12px}
        .lh-mode{cursor:pointer;transition:transform .15s, border-color .15s}
        .lh-mode:hover{transform:translateY(-3px)}
      `}</style>
      <canvas ref={canvas} style={{ width: '100%', height: '100%', display: 'block' }} onMouseDown={() => (press.current.attack = true)} onMouseUp={() => (press.current.attack = false)} onMouseLeave={() => (press.current.attack = false)} />
      <div ref={labels} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} />
      <div ref={flash} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle, transparent 45%, #ff1f3d 100%)', opacity: 0 }} />

      {error && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 20, padding: 40, textAlign: 'center' }}>{error}</div>}

      {hud && !intro && (
        <>
          {/* arriba: tiempo y objetivo */}
          <div className="lh-panel" style={{ position: 'absolute', left: V ? 10 : 18, right: V ? 10 : undefined, top: V ? 10 : 16, padding: panelPad, display: 'flex', gap: 16, alignItems: 'center', justifyContent: V ? 'space-between' : undefined }}>
            {inv ? (
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, opacity: 0.65 }}>ASALTOS</div>
                <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                  {Array.from({ length: hud.need }, (_, i) => (
                    <div key={i} style={{ width: V ? 18 : 22, height: V ? 18 : 22, borderRadius: 6, background: i < hud.assaults ? 'linear-gradient(180deg,#ffe066,#f59e0b)' : '#ffffff18', border: '2px solid #ffffff33', boxShadow: i < hud.assaults ? '0 0 10px #ffc83d' : undefined }} />
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ minWidth: V ? 0 : 260, flex: V ? 1 : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 900, letterSpacing: 2 }}>
                  <span style={{ opacity: 0.65 }}>🏠 LA CASA</span>
                  <span style={{ color: '#ffb347' }}>OLEADA {hud.wave}</span>
                </div>
                <div style={{ height: 16, borderRadius: 99, background: '#00000066', overflow: 'hidden', border: '1px solid #ffffff22', marginTop: 4 }}>
                  <div style={{ height: '100%', width: `${hud.house * 100}%`, background: hud.house > 0.5 ? 'linear-gradient(90deg,#34e0a1,#a3e635)' : hud.house > 0.25 ? 'linear-gradient(90deg,#f59e0b,#fde047)' : 'linear-gradient(90deg,#ef4444,#fb7185)', transition: 'width .2s' }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.7, marginTop: 3 }}>
                  {hud.kills} caídos · {hud.zombies} en el jardín{hud.queue ? ` · ${hud.queue} en camino` : ''}
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, opacity: 0.65 }}>TIEMPO</div>
              <div style={{ fontSize: V ? 24 : 28, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: hud.time < 30 ? '#ff6b6b' : '#fff' }}>{mmss(hud.time)}</div>
            </div>
          </div>

          {/* invasión: camino hasta la casa */}
          {inv && !V && (
            <div className="lh-panel" style={{ position: 'absolute', right: 18, top: 16, bottom: 150, width: 34, padding: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 18 }}>🏠</div>
              <div style={{ flex: 1, width: 10, borderRadius: 99, background: '#ffffff18', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${hud.progress * 100}%`, borderRadius: 99, background: 'linear-gradient(0deg,#8b5cf6,#f43f9e)' }} />
                <div style={{ position: 'absolute', left: -7, bottom: `calc(${hud.progress * 100}% - 12px)`, fontSize: 18 }}>👑</div>
              </div>
            </div>
          )}

          {/* lo último que han hecho los espectadores */}
          <div style={{ position: 'absolute', right: V ? 10 : inv ? 66 : 18, left: V ? 10 : undefined, top: V ? 96 : 16, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            {feed.map((f) => (
              <div key={f.key} className="lh-panel" style={{ padding: '5px 12px', fontSize: V ? 12 : 13, fontWeight: 700, animation: 'lh-in .25s ease-out', borderColor: f.kind === 'horde' ? '#ff6b6b55' : f.kind === 'event' ? '#ffe06666' : '#34e0a155', maxWidth: '100%' }}>
                <span style={{ color: f.kind === 'horde' ? '#ff8a8a' : f.kind === 'event' ? '#ffe066' : '#7cff9e', fontWeight: 900 }}>{f.who}</span> <span style={{ opacity: 0.75 }}>{f.kind === 'plant' ? 'planta' : f.kind === 'horde' ? 'manda' : '→'}</span> {f.what}
              </div>
            ))}
          </div>

          {/* mejores espectadores */}
          {hud.top.length > 0 && !V && (
            <div className="lh-panel" style={{ position: 'absolute', left: 18, top: inv ? 96 : 118, padding: '8px 14px', minWidth: 180 }}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: accent }}>{inv ? `GUARDIANES · ${hud.guardians} defensas` : `HORDA · ${hud.viewers} activos`}</div>
              {hud.top.map((p, i) => (
                <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 13, fontWeight: 700, marginTop: 3 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                    {i + 1}. {p.name}
                  </span>
                  <span style={{ opacity: 0.8 }}>
                    {p.score} {inv ? '🌱' : '🧟'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* votación del chat */}
          {hud.vote && (
            <div className="lh-panel" style={{ position: 'absolute', left: V ? 10 : 18, right: V ? 10 : undefined, top: V ? undefined : inv ? 270 : 290, bottom: V ? 190 : undefined, padding: '8px 14px', width: V ? undefined : 250, borderColor: '#ffe06666', animation: 'lh-glow 1.6s infinite' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 900, letterSpacing: 2, color: '#ffe066' }}>
                <span>VOTA EN EL CHAT</span>
                <span>{Math.ceil(hud.vote.left)} s</span>
              </div>
              {([
                ['1', hud.vote.a, hud.vote.ca],
                ['2', hud.vote.b, hud.vote.cb],
              ] as const).map(([k, name, c]) => (
                <div key={k} style={{ marginTop: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800 }}>
                    <span>
                      <b style={{ color: '#ffe066' }}>{k}</b> · {name}
                    </span>
                    <span>{c}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: '#0007', overflow: 'hidden', marginTop: 2 }}>
                    <div style={{ height: '100%', width: `${(c / Math.max(1, hud.vote!.ca + hud.vote!.cb)) * 100}%`, background: 'linear-gradient(90deg,#ffe066,#f59e0b)', transition: 'width .3s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* abajo: vida, barra secundaria y habilidades */}
          <div className="lh-panel" style={{ position: 'absolute', left: V ? 10 : '50%', right: V ? 10 : undefined, bottom: V ? 10 : 16, transform: V ? undefined : 'translateX(-50%)', padding: V ? '10px 12px' : '12px 18px', width: V ? undefined : 'min(660px, calc(100vw - 40px))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{inv ? '👑' : '🛡️'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ height: 14, borderRadius: 99, background: '#00000066', overflow: 'hidden', border: '1px solid #ffffff22' }}>
                  <div style={{ height: '100%', width: `${hud.hp * 100}%`, background: hud.hp > 0.5 ? 'linear-gradient(90deg,#34e0a1,#a3e635)' : hud.hp > 0.25 ? 'linear-gradient(90deg,#f59e0b,#fde047)' : 'linear-gradient(90deg,#ef4444,#fb7185)', transition: 'width .15s' }} />
                </div>
                <div style={{ height: 7, marginTop: 5, borderRadius: 99, background: '#00000066', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(1, hud.bar2) * 100}%`, background: inv ? 'linear-gradient(90deg,#6d28d9,#c084fc)' : 'linear-gradient(90deg,#f59e0b,#ffe066)' }} />
                </div>
              </div>
              {!inv && <div style={{ fontSize: 14, fontWeight: 900, color: '#ffe066', fontVariantNumeric: 'tabular-nums' }}>⚡{Math.floor(hud.energy)}</div>}
              {(hud.confused || hud.slowed || hud.down) && (
                <div style={{ fontSize: 12, fontWeight: 900, color: hud.down ? '#ff6b6b' : hud.confused ? '#c77dff' : '#9fe7ff' }}>{hud.down ? 'DERRIBADO' : hud.confused ? '¡AL REVÉS!' : 'FRENADO'}</div>
              )}
            </div>
            {!inv && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {PLANT_ORDER.map((k, i) => {
                  const cost = PLANT_COST[k]!
                  const sel = hud.pick === k
                  const can = hud.energy >= cost
                  return (
                    <div key={k} style={{ padding: '4px 8px', borderRadius: 10, minWidth: V ? 52 : 74, textAlign: 'center', background: sel ? '#7cff9e26' : '#ffffff0d', border: `2px solid ${sel ? '#7cff9e' : '#ffffff18'}`, opacity: can ? 1 : 0.45, fontSize: V ? 10 : 12, fontWeight: 800 }}>
                      <div>
                        <span style={{ color: '#ffe066' }}>{i + 1}</span> {GUARDIANS[k].name.split(' ')[0]}
                      </div>
                      <div style={{ opacity: 0.8 }}>⚡{cost}</div>
                    </div>
                  )
                })}
              </div>
            )}
            {!V && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                {inv ? (
                  <>
                    <Ability k="ESPACIO" name="Zarpazo" cd={0} />
                    <Ability k="SHIFT" name="Embestida" cd={hud.cds[0]} />
                    <Ability k="E" name="Rugido" cd={hud.cds[1]} />
                    <Ability k="Q" name="Esbirros" cd={hud.cds[2]} dim={hud.bar2 < 0.3} />
                  </>
                ) : (
                  <>
                    <Ability k="ESPACIO" name="Disparar" cd={0} />
                    <Ability k="SHIFT" name="Esquiva" cd={hud.cds[0]} />
                    <Ability k="E" name="Onda" cd={hud.cds[1]} />
                    <Ability k="Q" name="Plantar" cd={0} />
                  </>
                )}
                <Ability k="C" name="Cámara" cd={0} />
                <Ability k="M" name={muted ? 'Sin sonido' : 'Sonido'} cd={0} dim={muted} />
              </div>
            )}
          </div>
        </>
      )}

      {banner && (
        <div key={banner.key} style={{ position: 'absolute', left: 0, right: 0, top: V ? '30%' : '22%', textAlign: 'center', pointerEvents: 'none', animation: 'lh-pop 2.2s ease-out both' }}>
          <div style={{ fontSize: V ? 'min(44px, 11vw)' : 'min(64px, 9vw)', fontWeight: 900, color: banner.color ?? '#ffe066', textShadow: `0 5px 0 #0009, 0 0 30px ${banner.color ?? '#f59e0b'}` }}>{banner.text}</div>
          {banner.sub && <div style={{ fontSize: 22, fontWeight: 800, textShadow: '0 2px 0 #000a' }}>{banner.sub}</div>}
        </div>
      )}

      {intro && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: '#0b0d16cc', backdropFilter: 'blur(3px)', overflowY: 'auto', padding: 16 }}>
          <div className="lh-panel" style={{ padding: V ? '20px 18px' : '28px 34px', maxWidth: 760, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 4, color: '#ffe066' }}>LAST HOUSE</div>
            <div style={{ fontSize: V ? 32 : 44, fontWeight: 900, lineHeight: 1.05, marginTop: 4 }}>Elige tu bando</div>
            <div style={{ display: 'grid', gridTemplateColumns: V ? '1fr' : '1fr 1fr', gap: 14, marginTop: 18, textAlign: 'left' }}>
              {(['invasion', 'defensa'] as const).map((m) => {
                const sel = mode === m
                const c = m === 'invasion' ? '#c084fc' : '#7cff9e'
                return (
                  <div key={m} className="lh-panel lh-mode" onClick={() => setMode(m)} onDoubleClick={() => begin(m)} style={{ padding: 16, borderColor: sel ? c : '#ffffff22', boxShadow: sel ? `0 0 24px -6px ${c}` : undefined }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: c }}>{m === 'invasion' ? '👑 INVASIÓN' : '🛡️ DEFENSA'}</div>
                    <p style={{ fontSize: 14, lineHeight: 1.45, opacity: 0.9, marginTop: 6 }}>
                      {m === 'invasion' ? (
                        <>
                          Eres el <b>Rey de la Horda</b>: cruza el jardín y entra en la casa <b>{settings.current.assaults} veces</b>. Tus espectadores son los <b>Guardianes</b> y plantan defensas para frenarte.
                        </>
                      ) : (
                        <>
                          Eres el <b>Guardián</b> de la casa: dispara, planta defensas con tu energía y aguanta hasta el final. Tus espectadores son la <b>Horda</b> y mandan zombis.
                        </>
                      )}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 5, marginTop: 10, fontSize: 13 }}>
                      <div>
                        <span className="lh-key">W A S D</span> moverte
                      </div>
                      {m === 'invasion' ? (
                        <>
                          <div><span className="lh-key">ESPACIO</span> zarpazo · <span className="lh-key">SHIFT</span> embestida</div>
                          <div><span className="lh-key">E</span> rugido · <span className="lh-key">Q</span> esbirros</div>
                        </>
                      ) : (
                        <>
                          <div><span className="lh-key">ESPACIO</span> disparar · <span className="lh-key">SHIFT</span> esquiva</div>
                          <div><span className="lh-key">E</span> onda · <span className="lh-key">1-6</span> elegir · <span className="lh-key">Q</span> plantar</div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 12 }}>
              <span className="lh-key">C</span> cámara · <span className="lh-key">M</span> sonido · <span className="lh-key">R</span> otra partida · <span className="lh-key">ESC</span> menú
            </div>
            <button onClick={() => begin(mode)} style={{ marginTop: 16, padding: '12px 34px', borderRadius: 99, border: 0, cursor: 'pointer', fontFamily: FONT, fontSize: 18, fontWeight: 900, color: '#0b0d16', background: mode === 'invasion' ? 'linear-gradient(90deg,#c084fc,#f43f9e)' : 'linear-gradient(90deg,#7cff9e,#34e0a1)', boxShadow: '0 8px 24px -8px #000' }}>
              Empezar {mode === 'invasion' ? 'Invasión' : 'Defensa'} (Enter)
            </button>
          </div>
        </div>
      )}

      {hud?.phase === 'ended' && !intro && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: '#0b0d16aa', padding: 16 }}>
          <div className="lh-panel" style={{ padding: V ? '22px 18px' : '28px 40px', textAlign: 'center', maxWidth: 620 }}>
            <div style={{ fontSize: V ? 36 : 54, fontWeight: 900, color: hud.winner === 'rey' || hud.winner === 'guardian' ? '#ffe066' : accent }}>
              {hud.winner === 'rey' ? '¡LA HORDA ENTRA!' : hud.winner === 'guardianes' ? '¡LA CASA RESISTE!' : hud.winner === 'guardian' ? '¡LA CASA SIGUE EN PIE!' : '¡LA CASA HA CAÍDO!'}
            </div>
            <div style={{ fontSize: 18, opacity: 0.85, marginTop: 6 }}>
              {hud.winner === 'rey'
                ? 'El Rey de la Horda ha completado los asaltos.'
                : hud.winner === 'guardianes'
                  ? `Los Guardianes aguantaron: ${hud.assaults} de ${hud.need} asaltos.`
                  : hud.winner === 'guardian'
                    ? `Aguantaste ${hud.wave} oleadas y derribaste ${hud.kills} zombis.`
                    : `La horda tumbó la puerta en la oleada ${hud.wave}.`}
            </div>
            {hud.top[0] && (
              <div style={{ marginTop: 10, fontWeight: 800 }}>
                {inv ? 'Mejor guardián' : 'Líder de la horda'}: {hud.top[0].name} ({hud.top[0].score} {inv ? '🌱' : '🧟'})
              </div>
            )}
            {result && (result.unlocked.length > 0 || result.crowns.length > 0) && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.unlocked.map((a) => (
                  <div key={a.name} className="lh-panel" style={{ padding: '6px 12px', borderColor: '#ffe06666', fontSize: 14 }}>
                    🏆 <b>Logro: {a.name}</b> — <span style={{ opacity: 0.8 }}>{a.desc}</span>
                  </div>
                ))}
                {result.crowns.map((c) => (
                  <div key={c} className="lh-panel" style={{ padding: '6px 12px', borderColor: '#c084fc66', fontSize: 14 }}>
                    👑 <b>Corona desbloqueada: {c}</b> <span style={{ opacity: 0.8 }}>(elígela en la app)</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
              <button onClick={() => begin(sim.current.mode)} style={{ padding: '10px 28px', borderRadius: 99, border: 0, cursor: 'pointer', fontFamily: FONT, fontSize: 16, fontWeight: 900, color: '#fff', background: 'linear-gradient(90deg,#8b5cf6,#f43f9e)' }}>
                Otra partida (R)
              </button>
              <button onClick={toMenu} style={{ padding: '10px 22px', borderRadius: 99, border: '2px solid #ffffff33', cursor: 'pointer', fontFamily: FONT, fontSize: 16, fontWeight: 800, color: '#fff', background: 'transparent' }}>
                Cambiar de modo (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Ability({ k, name, cd, dim }: { k: string; name: string; cd: number; dim?: boolean }) {
  const waiting = cd > 0.05
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 10, background: '#ffffff0d', border: '1px solid #ffffff18', opacity: waiting || dim ? 0.45 : 1, fontSize: 13, fontWeight: 800 }}>
      <span className="lh-key">{k}</span>
      {name}
      {waiting && <span style={{ fontVariantNumeric: 'tabular-nums', color: '#ffd45a' }}>{cd.toFixed(1)}</span>}
    </div>
  )
}
