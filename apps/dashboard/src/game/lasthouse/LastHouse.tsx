import { useEffect, useRef, useState } from 'react'
import type { LiveEvent } from '@livearena/shared'
import { useOnEvent } from '../../lib/live'
import { Game, GUARDIANS, LENGTH, type GuardianKind, type Input } from './sim'
import { View } from './view'

/**
 * LAST HOUSE: Invasión — página del juego (/juego/lasthouse). El streamer juega aquí con el teclado y captura esta
 * ventana en TikTok LIVE Studio u OBS; los espectadores juegan desde el directo (los eventos llegan por LiveArena).
 * Con ?demo=1 unos espectadores de mentira plantan defensas para probar sin estar en directo.
 */

const params = new URLSearchParams(location.search)
const DEMO = params.get('demo') === '1'

interface Feed {
  key: number
  who: string
  what: string
  good: boolean
}

interface Hud {
  hp: number
  rot: number
  assaults: number
  need: number
  time: number
  progress: number
  dash: number
  roar: number
  summon: number
  guardians: number
  down: boolean
  confused: boolean
  slowed: boolean
  phase: 'playing' | 'ended'
  winner: 'rey' | 'guardianes' | null
  top: { name: string; plants: number }[]
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const FONT = "'Outfit Variable','Outfit','Segoe UI',sans-serif"

/** Qué hace cada cosa del directo. Devuelve el texto para el aviso (o null si no hizo nada). */
function applyEvent(game: Game, ev: LiveEvent, cooldown: Map<string, number>): { what: string; good: boolean } | null {
  const who = ev.user?.nickname ?? 'Alguien'
  const now = game.s.t
  const ready = (key: string, secs: number) => {
    const k = `${ev.user?.id ?? who}:${key}`
    if ((cooldown.get(k) ?? -99) > now) return false
    cooldown.set(k, now + secs)
    return true
  }
  const plant = (kind: GuardianKind, n = 1) => {
    let ok = 0
    for (let i = 0; i < n; i++) if (game.plant(kind, who)) ok++
    return ok ? { what: `${n > 1 ? `${ok} × ` : ''}${GUARDIANS[kind].name}`, good: true } : null
  }
  switch (ev.type) {
    case 'like':
      game.likes(ev.payload.count, who)
      return null
    case 'follow':
      return plant('glacial')
    case 'share':
      return ready('share', 20) ? plant('raiz') : null
    case 'subscribe':
      return plant('tronco')
    case 'chat': {
      const t = ev.payload.text.toLowerCase()
      const kind: GuardianKind | null = /tronco|muro/.test(t) ? 'tronco' : /lanza|dispar/.test(t) ? 'lanzabrotes' : /hielo|glacial|fr[ií]o/.test(t) ? 'glacial' : /hongo|bomba/.test(t) ? 'hongo' : /ra[ií]z|cura/.test(t) ? 'raiz' : null
      // con el chat (gratis): los fuertes tienen espera larga por persona; cualquier otro comentario, un brote
      if (kind === 'tronco' || kind === 'hongo') return ready('fuerte', 45) ? plant(kind) : null
      if (kind) return ready('medio', 18) ? plant(kind) : null
      return ready('brote', 8) ? plant('brote') : null
    }
    case 'gift': {
      const coins = ev.payload.diamonds * ev.payload.count
      if (coins >= 1000) {
        game.plant('ancestral', who)
        game.event('tormenta', who)
        return { what: 'Guardián Ancestral + Tormenta de semillas', good: true }
      }
      if (coins >= 499) {
        game.event('tormenta', who)
        return { what: 'Tormenta de semillas', good: true }
      }
      if (coins >= 199) {
        game.event('mareo', who)
        plant('hongo', 2)
        return { what: 'Esporas del mareo (controles al revés)', good: true }
      }
      if (coins >= 99) {
        game.event('enjambre', who)
        return { what: 'Batería de Lanzabrotes', good: true }
      }
      if (coins >= 20) return plant('hongo', 3)
      if (coins >= 5) return plant('tronco')
      return plant('lanzabrotes', Math.min(5, ev.payload.count))
    }
    default:
      return null
  }
}

export function LastHouse() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const labels = useRef<HTMLDivElement>(null)
  const flash = useRef<HTMLDivElement>(null)
  const game = useRef<Game>(new Game({ seed: (Date.now() % 100000) + 1 }))
  const view = useRef<View | null>(null)
  const keys = useRef(new Set<string>())
  const press = useRef({ attack: false, dash: false, roar: false, summon: false })
  const cooldown = useRef(new Map<string, number>())
  const started = useRef(DEMO)
  const [hud, setHud] = useState<Hud | null>(null)
  const [feed, setFeed] = useState<Feed[]>([])
  const [banner, setBanner] = useState<{ text: string; sub: string; key: number } | null>(null)
  const [intro, setIntro] = useState(!DEMO)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  const say = (who: string, what: string, good: boolean) => setFeed((f) => [...f.slice(-4), { key: ++seq.current, who, what, good }])

  const restart = () => {
    game.current = new Game({ seed: (Date.now() % 100000) + 1 })
    cooldown.current.clear()
    setFeed([])
    setBanner(null)
  }

  // eventos del directo
  useOnEvent((ev) => {
    if (!started.current || game.current.s.phase !== 'playing') return
    const r = applyEvent(game.current, ev, cooldown.current)
    if (r && ev.user) say(ev.user.nickname, r.what, r.good)
  })

  useEffect(() => {
    let v: View
    try {
      v = new View(canvas.current!, labels.current!)
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
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault()
      if (e.repeat) return
      keys.current.add(k)
      if (k === 'shift') press.current.dash = true
      if (k === 'e') press.current.roar = true
      if (k === 'q') press.current.summon = true
      if (k === 'c') v.cameraMode = v.cameraMode === 0 ? 1 : 0
      if (k === 'r' && game.current.s.phase === 'ended') restart()
      if (k === 'enter' && !started.current) {
        started.current = true
        setIntro(false)
      }
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    const blur = () => keys.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)

    // espectadores de mentira para probar (solo con ?demo=1)
    const NAMES = ['Sofi', 'Tomás', 'Rocío', 'Leo', 'Ana', 'Max', 'Lucía', 'Mateo', 'Givi', 'Santos']
    let demoAt = 1
    const demo = (g: Game) => {
      if (g.s.t < demoAt) return
      demoAt = g.s.t + 0.35 + Math.random() * 0.5
      const who = NAMES[Math.floor(Math.random() * NAMES.length)]!
      const r = Math.random()
      if (r < 0.5) g.likes(12 + Math.floor(Math.random() * 30), who)
      else {
        const kind: GuardianKind = r < 0.68 ? 'lanzabrotes' : r < 0.78 ? 'tronco' : r < 0.86 ? 'hongo' : r < 0.93 ? 'glacial' : 'raiz'
        if (g.plant(kind, who)) say(who, GUARDIANS[kind].name, true)
      }
      if (Math.random() < 0.012) {
        const evn = (['tormenta', 'mareo', 'enjambre'] as const)[Math.floor(Math.random() * 3)]!
        g.event(evn, who)
        say(who, evn === 'tormenta' ? 'Tormenta de semillas' : evn === 'mareo' ? 'Esporas del mareo' : 'Batería de Lanzabrotes', true)
      }
    }
    // piloto automático de la demo: el Rey avanza, esquiva un poco y pega
    const autopilot = (g: Game): Input => {
      const k = g.s.king
      let mx = 0
      for (const gd of g.s.guardians) {
        if (!GUARDIANS[gd.kind].solid) continue
        const dz = gd.z - k.z
        if (dz > 0 && dz < 4 && Math.abs(gd.x - k.x) < GUARDIANS[gd.kind].radius + 1) mx += gd.x > k.x ? -1 : 1
      }
      return { mx: Math.max(-1, Math.min(1, mx)), mz: 1, attack: true, dash: Math.random() < 0.01, roar: Math.random() < 0.004, summon: Math.random() < 0.02 }
    }

    let raf = 0
    let acc = 0
    const STEP = 1 / 60
    let last = performance.now()
    let hudAt = 0
    let lastPhase = 'playing'
    let lastAssaults = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      // tiempo real del fotograma; la simulación avanza en pasos fijos de 1/60 s (aunque el equipo vaya a pocos FPS
      // el juego no va a cámara lenta; como mucho se recuperan 0,25 s por fotograma)
      const dt = Math.min(0.25, (now - last) / 1000)
      last = now
      const g = game.current
      const ks = keys.current
      let input: Input
      if (DEMO) input = autopilot(g)
      else {
        const mx = (ks.has('d') || ks.has('arrowright') ? 1 : 0) - (ks.has('a') || ks.has('arrowleft') ? 1 : 0)
        const mz = (ks.has('w') || ks.has('arrowup') ? 1 : 0) - (ks.has('s') || ks.has('arrowdown') ? 1 : 0)
        // en la cámara de acción «derecha» en pantalla es −x del mundo (se mira hacia +z)
        input = { mx: -mx, mz, attack: ks.has(' ') || ks.has('j') || press.current.attack, dash: press.current.dash, roar: press.current.roar, summon: press.current.summon }
      }
      press.current.dash = press.current.roar = press.current.summon = false
      if (started.current) {
        acc += dt
        let first = true
        while (acc >= STEP) {
          acc -= STEP
          if (DEMO) demo(g)
          // las pulsaciones de un toque (embestida, rugido, esbirros) solo cuentan en el primer paso
          g.tick(STEP, first ? input : { ...input, dash: false, roar: false, summon: false })
          first = false
        }
      }
      const moving = started.current && (Math.abs(input.mx) > 0.1 || Math.abs(input.mz) > 0.1) && g.s.king.downUntil === 0 && g.s.phase === 'playing'
      // carteles según lo que pasó (se miran antes de que la vista vacíe los efectos)
      for (const f of g.s.fx) {
        if (f.type === 'event') setBanner({ text: f.name === 'tormenta' ? '¡TORMENTA DE SEMILLAS!' : f.name === 'mareo' ? '¡AL REVÉS!' : '¡BATERÍA DE LANZABROTES!', sub: `de ${f.owner}`, key: now })
        if (f.type === 'plant' && f.kind === 'ancestral') setBanner({ text: '¡GUARDIÁN ANCESTRAL!', sub: `de ${f.owner}`, key: now })
      }
      if (g.s.assaults !== lastAssaults) {
        lastAssaults = g.s.assaults
        if (g.s.assaults > 0 && g.s.phase === 'playing') setBanner({ text: '¡ASALTO!', sub: `${g.s.assaults} de ${g.cfg.assaults}`, key: now })
      }
      v.frame(g, dt, moving)
      if (flash.current) flash.current.style.opacity = String(v.hurtFlash * 0.45)
      if (now - hudAt > 100 || g.s.phase !== lastPhase) {
        hudAt = now
        lastPhase = g.s.phase
        const k = g.s.king
        const top = [...g.s.scores.entries()]
          .map(([name, sc]) => ({ name, plants: sc.plants }))
          .sort((a, b) => b.plants - a.plants)
          .slice(0, 5)
        setHud({
          hp: k.hp / k.maxHp,
          rot: k.rot / 100,
          assaults: g.s.assaults,
          need: g.cfg.assaults,
          time: g.timeLeft,
          progress: Math.max(0, Math.min(1, k.z / LENGTH)),
          dash: Math.max(0, k.dashAt - g.s.t),
          roar: Math.max(0, k.roarAt - g.s.t),
          summon: Math.max(0, k.summonAt - g.s.t),
          guardians: g.s.guardians.length,
          down: k.downUntil > 0,
          confused: g.s.t < k.confusedUntil,
          slowed: k.slowed,
          phase: g.s.phase,
          winner: g.s.winner,
          top,
        })
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
    }
  }, [])

  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 2200)
    return () => clearTimeout(t)
  }, [banner])

  const start = () => {
    started.current = true
    setIntro(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b0d16', overflow: 'hidden', fontFamily: FONT, color: '#fff', userSelect: 'none' }}>
      <style>{`
        .lh-label{position:absolute;left:0;top:0;font-weight:900;font-size:15px;text-shadow:0 2px 0 #000a,0 0 8px #000;white-space:nowrap;pointer-events:none}
        .lh-owner{color:#fff;background:#0009;padding:2px 9px;border-radius:99px;font-size:13px;font-weight:800}
        .lh-dmg{color:#ff6b6b;font-size:22px}
        .lh-shout{color:#ffe066;font-size:30px;letter-spacing:1px}
        @keyframes lh-pop{0%{transform:scale(.3);opacity:0}25%{transform:scale(1.12);opacity:1}85%{transform:scale(1);opacity:1}100%{transform:scale(.95);opacity:0}}
        @keyframes lh-in{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}
        .lh-panel{background:linear-gradient(160deg,#141826e6,#0b0d16ee);border:2px solid #ffffff22;border-radius:16px;box-shadow:0 10px 30px #0008}
        .lh-key{display:inline-grid;place-items:center;min-width:26px;height:26px;padding:0 6px;border-radius:7px;background:#ffffff1c;border:1px solid #ffffff33;font-weight:900;font-size:12px}
      `}</style>
      <canvas ref={canvas} style={{ width: '100%', height: '100%', display: 'block' }} onMouseDown={() => (press.current.attack = true)} onMouseUp={() => (press.current.attack = false)} />
      <div ref={labels} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} />
      <div ref={flash} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle, transparent 45%, #ff1f3d 100%)', opacity: 0 }} />

      {error && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 20, padding: 40, textAlign: 'center' }}>{error}</div>}

      {hud && !intro && (
        <>
          {/* arriba izquierda: asaltos y tiempo */}
          <div className="lh-panel" style={{ position: 'absolute', left: 18, top: 16, padding: '10px 16px', display: 'flex', gap: 18, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, opacity: 0.65 }}>ASALTOS</div>
              <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                {Array.from({ length: hud.need }, (_, i) => (
                  <div key={i} style={{ width: 22, height: 22, borderRadius: 6, background: i < hud.assaults ? 'linear-gradient(180deg,#ffe066,#f59e0b)' : '#ffffff18', border: '2px solid #ffffff33', boxShadow: i < hud.assaults ? '0 0 10px #ffc83d' : undefined }} />
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, opacity: 0.65 }}>TIEMPO</div>
              <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: hud.time < 30 ? '#ff6b6b' : '#fff' }}>{mmss(hud.time)}</div>
            </div>
          </div>

          {/* derecha: camino hasta la casa */}
          <div className="lh-panel" style={{ position: 'absolute', right: 18, top: 16, bottom: 150, width: 34, padding: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 18 }}>🏠</div>
            <div style={{ flex: 1, width: 10, borderRadius: 99, background: '#ffffff18', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${hud.progress * 100}%`, borderRadius: 99, background: 'linear-gradient(0deg,#8b5cf6,#f43f9e)' }} />
              <div style={{ position: 'absolute', left: -7, bottom: `calc(${hud.progress * 100}% - 12px)`, fontSize: 18 }}>👑</div>
            </div>
          </div>

          {/* espectadores: lo último que han plantado */}
          <div style={{ position: 'absolute', right: 66, top: 16, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            {feed.map((f) => (
              <div key={f.key} className="lh-panel" style={{ padding: '5px 12px', fontSize: 13, fontWeight: 700, animation: 'lh-in .25s ease-out', borderColor: '#34e0a155' }}>
                <span style={{ color: '#7cff9e', fontWeight: 900 }}>{f.who}</span> <span style={{ opacity: 0.75 }}>planta</span> {f.what}
              </div>
            ))}
          </div>

          {/* mejores guardianes */}
          {hud.top.length > 0 && (
            <div className="lh-panel" style={{ position: 'absolute', left: 18, top: 96, padding: '8px 14px', minWidth: 170 }}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: '#7cff9e' }}>GUARDIANES · {hud.guardians} defensas</div>
              {hud.top.map((p, i) => (
                <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 13, fontWeight: 700, marginTop: 3 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                    {i + 1}. {p.name}
                  </span>
                  <span style={{ opacity: 0.8 }}>{p.plants} 🌱</span>
                </div>
              ))}
            </div>
          )}

          {/* abajo: vida, podredumbre y habilidades */}
          <div className="lh-panel" style={{ position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)', padding: '12px 18px', width: 'min(620px, calc(100vw - 40px))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>👑</span>
              <div style={{ flex: 1 }}>
                <div style={{ height: 16, borderRadius: 99, background: '#00000066', overflow: 'hidden', border: '1px solid #ffffff22' }}>
                  <div style={{ height: '100%', width: `${hud.hp * 100}%`, background: hud.hp > 0.5 ? 'linear-gradient(90deg,#34e0a1,#a3e635)' : hud.hp > 0.25 ? 'linear-gradient(90deg,#f59e0b,#fde047)' : 'linear-gradient(90deg,#ef4444,#fb7185)', transition: 'width .15s' }} />
                </div>
                <div style={{ height: 7, marginTop: 5, borderRadius: 99, background: '#00000066', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${hud.rot * 100}%`, background: 'linear-gradient(90deg,#6d28d9,#c084fc)' }} />
                </div>
              </div>
              {(hud.confused || hud.slowed || hud.down) && (
                <div style={{ fontSize: 12, fontWeight: 900, color: hud.down ? '#ff6b6b' : hud.confused ? '#c77dff' : '#9fe7ff' }}>{hud.down ? 'DERRIBADO' : hud.confused ? '¡AL REVÉS!' : 'FRENADO'}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Ability k="ESPACIO" name="Zarpazo" cd={0} />
              <Ability k="SHIFT" name="Embestida" cd={hud.dash} />
              <Ability k="E" name="Rugido" cd={hud.roar} />
              <Ability k="Q" name="Esbirros" cd={hud.summon} dim={hud.rot < 0.3} />
              <Ability k="C" name="Cámara" cd={0} />
            </div>
          </div>
        </>
      )}

      {banner && (
        <div key={banner.key} style={{ position: 'absolute', left: 0, right: 0, top: '22%', textAlign: 'center', pointerEvents: 'none', animation: 'lh-pop 2.2s ease-out both' }}>
          <div style={{ fontSize: 'min(64px, 9vw)', fontWeight: 900, color: '#ffe066', textShadow: '0 5px 0 #0009, 0 0 30px #f59e0b' }}>{banner.text}</div>
          <div style={{ fontSize: 22, fontWeight: 800, textShadow: '0 2px 0 #000a' }}>{banner.sub}</div>
        </div>
      )}

      {intro && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: '#0b0d16cc', backdropFilter: 'blur(3px)' }}>
          <div className="lh-panel" style={{ padding: '28px 34px', maxWidth: 640, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 4, color: '#c084fc' }}>LAST HOUSE</div>
            <div style={{ fontSize: 46, fontWeight: 900, lineHeight: 1.05, marginTop: 4 }}>INVASIÓN</div>
            <p style={{ opacity: 0.85, marginTop: 12, fontSize: 15, lineHeight: 1.5 }}>
              Eres el <b>Rey de la Horda</b>. Cruza el jardín y llega a la puerta de la última casa <b>5 veces</b> antes de que se acabe el tiempo. Tus espectadores son los <b>Guardianes</b>: con likes, comentarios, follows y regalos
              plantan defensas en tu camino.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16, textAlign: 'left', fontSize: 14 }}>
              <div><span className="lh-key">W A S D</span> moverte</div>
              <div><span className="lh-key">ESPACIO</span> zarpazo (o clic)</div>
              <div><span className="lh-key">SHIFT</span> embestida: rompe lo que pilla</div>
              <div><span className="lh-key">E</span> rugido: aturde a los guardianes</div>
              <div><span className="lh-key">Q</span> invocar esbirros</div>
              <div><span className="lh-key">C</span> cambiar la cámara</div>
            </div>
            <button onClick={start} style={{ marginTop: 22, padding: '12px 34px', borderRadius: 99, border: 0, cursor: 'pointer', fontFamily: FONT, fontSize: 18, fontWeight: 900, color: '#fff', background: 'linear-gradient(90deg,#8b5cf6,#f43f9e,#ff7a59)', boxShadow: '0 8px 24px -8px #f43f9e' }}>
              Empezar (Enter)
            </button>
          </div>
        </div>
      )}

      {hud?.phase === 'ended' && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: '#0b0d16aa' }}>
          <div className="lh-panel" style={{ padding: '28px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: 54, fontWeight: 900, color: hud.winner === 'rey' ? '#c084fc' : '#7cff9e' }}>{hud.winner === 'rey' ? '¡LA HORDA ENTRA!' : '¡LA CASA RESISTE!'}</div>
            <div style={{ fontSize: 18, opacity: 0.85, marginTop: 6 }}>
              {hud.winner === 'rey' ? 'El Rey de la Horda ha completado los asaltos.' : `Los Guardianes aguantaron: ${hud.assaults} de ${hud.need} asaltos.`}
            </div>
            {hud.top[0] && <div style={{ marginTop: 10, fontWeight: 800 }}>Mejor guardián: {hud.top[0].name} ({hud.top[0].plants} 🌱)</div>}
            <button onClick={restart} style={{ marginTop: 18, padding: '10px 28px', borderRadius: 99, border: 0, cursor: 'pointer', fontFamily: FONT, fontSize: 16, fontWeight: 900, color: '#fff', background: 'linear-gradient(90deg,#8b5cf6,#f43f9e)' }}>
              Otra partida (R)
            </button>
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
