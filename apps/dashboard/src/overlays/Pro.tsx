import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { ActionMessage, LiveEvent, VoiceEffect } from '@livearena/shared'
import { playAudio, utterance } from '../lib/speech'
import { findGift, useGifts } from '../lib/catalog'
import { useLiveState, useOnAction, useOnEvent, useTick } from '../lib/live'
import { Avatar } from '../components/ui'

/**
 * Overlays «pro» de LiveArena: contador, cronómetro, vidas, logros, récords, metas, duelo,
 * reset o salvar, destacados, rankings con estilos, MVP y tótems.
 * Todos aceptan ?demo=1 (datos de ejemplo para la vista previa) y ?mini=1 (versión en una línea).
 */
const params = new URLSearchParams(location.search)
export const DEMO = params.get('demo') === '1'
const MINI = params.get('mini') === '1'

const FONT = "'Outfit Variable','Outfit','Segoe UI',sans-serif"
const shadow = '0 3px 0 rgba(0,0,0,.45), 0 0 18px rgba(0,0,0,.35)'
const base: CSSProperties = { fontFamily: FONT, color: '#fff', userSelect: 'none' }
const fmt = (n: number) => n.toLocaleString('es')

type Cfg = Record<string, any>
function useCfg(): Cfg {
  return useLiveState<Cfg>('overlaycfg') ?? {}
}

function GiftImg({ name, url, size = 56 }: { name?: string; url?: string; size?: number }) {
  const gifts = useGifts()
  const src = url ?? (name ? findGift(gifts, name)?.image : undefined)
  if (!src) return <div style={{ width: size, height: size, borderRadius: 12, background: '#ffffff18' }} />
  return <img src={src} alt="" style={{ width: size, height: size, objectFit: 'contain', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.5))' }} />
}

function Coin({ n }: { n: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 12px 2px 4px', borderRadius: 999, background: '#ffcc33', color: '#3a2500', fontWeight: 900, fontSize: 20 }}>
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%,#fff6c2,#f5b301 60%,#b67b00)', border: '2px solid #a86f00' }} />
      {fmt(n)}
    </span>
  )
}

/** Corazón de píxeles (SVG propio). */
function PixelHeart({ size = 40, color = '#ff2d55', beat = false }: { size?: number; color?: string; beat?: boolean }) {
  const px = ['01100110', '11111111', '11111111', '11111111', '01111110', '00111100', '00011000']
  return (
    <svg width={size} height={(size * 7) / 8} viewBox="0 0 8 7" shapeRendering="crispEdges" className={beat ? 'la-beat' : undefined} style={{ filter: `drop-shadow(0 0 6px ${color}aa)` }}>
      {px.flatMap((row, y) => [...row].map((c, x) => (c === '1' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={y < 2 && x > 0 && x < 3 ? '#ffb3c1' : color} /> : null)))}
    </svg>
  )
}

const keyframes = `
@keyframes la-pop { 0%{transform:scale(.4);opacity:0} 60%{transform:scale(1.15);opacity:1} 100%{transform:scale(1)} }
@keyframes la-float { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(-40px);opacity:0} }
@keyframes la-beat-k { 0%,100%{transform:scale(1)} 30%{transform:scale(1.18)} 60%{transform:scale(.96)} }
@keyframes la-slide-down { from{transform:translateY(-120%);opacity:0} to{transform:translateY(0);opacity:1} }
@keyframes la-shine { from{background-position:-200% 0} to{background-position:200% 0} }
@keyframes la-glow { 0%,100%{box-shadow:0 0 24px var(--g)} 50%{box-shadow:0 0 48px var(--g)} }
.la-pop{animation:la-pop .5s cubic-bezier(.2,1.6,.4,1) both}
.la-beat{animation:la-beat-k .9s ease-in-out infinite;transform-origin:center}
.la-slide{animation:la-slide-down .5s cubic-bezier(.2,1.3,.4,1) both}
`
function Styles() {
  return <style>{keyframes}</style>
}

/* -------------------------------- Contador -------------------------------- */

export function ScoreV2() {
  const s = useLiveState<any>('scoreboard')
  const cfg = useCfg()
  const w = DEMO ? 7 : (s?.wins ?? 0)
  const l = DEMO ? 2 : (s?.losses ?? 0)
  if (MINI || cfg.score?.minimal)
    return (
      <div style={{ ...base, display: 'inline-flex', gap: 14, padding: '8px 18px', borderRadius: 999, background: '#0b0b14dd', border: '2px solid #ffffff22', fontWeight: 900, fontSize: 34, textShadow: shadow }}>
        <span style={{ color: '#34e0a1' }}>V {w}</span>
        <span style={{ opacity: 0.4 }}>|</span>
        <span style={{ color: '#ff4d6d' }}>D {l}</span>
      </div>
    )
  const side = (label: string, n: number, c1: string, c2: string, skew: 'l' | 'r') => (
    <div style={{ position: 'relative', padding: '12px 30px 14px', minWidth: 130, textAlign: 'center', background: `linear-gradient(160deg, ${c1}, ${c2})`, clipPath: skew === 'l' ? 'polygon(0 0,100% 0,88% 100%,0 100%)' : 'polygon(12% 0,100% 0,100% 100%,0 100%)' }}>
      <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 4, opacity: 0.85 }}>{label}</div>
      <div key={n} className="la-pop" style={{ fontSize: 64, lineHeight: 1, fontWeight: 900, textShadow: shadow }}>
        {n}
      </div>
    </div>
  )
  return (
    <div style={{ ...base, display: 'inline-flex', borderRadius: 22, overflow: 'hidden', boxShadow: '0 12px 30px #0008', border: '2px solid #ffffff1a' }}>
      <Styles />
      {side('VICTORIAS', w, '#0f5132', '#06281a', 'l')}
      <div style={{ width: 4, background: '#fff', transform: 'skewX(-12deg)', margin: '0 -10px', zIndex: 1 }} />
      {side('DERROTAS', l, '#7a1026', '#2d0610', 'r')}
    </div>
  )
}

/* ------------------------------- Cronómetro ------------------------------- */

export function TimerV2() {
  const s = useLiveState<any>('scoreboard')
  const cfg = useCfg()
  useTick(200)
  const t = s?.timer
  const elapsed = t ? t.accumulatedMs + (t.running ? Date.now() - t.startedAt : 0) : 0
  const down = (t?.mode ?? cfg.timer?.mode) === 'down'
  const ms = DEMO ? 4_179_000 : down ? Math.max(0, (t?.durationMs ?? 0) - elapsed) : elapsed
  const sec = Math.ceil(ms / 1000 - (down ? 0 : 0.999))
  const hh = Math.floor(sec / 3600)
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  const txt = `${hh ? `${String(hh).padStart(2, '0')}:` : ''}${mm}:${ss}`
  const urgent = down && sec <= 10 && t?.running
  const color = urgent ? '#ff4d6d' : '#ffd166'
  const coinSeconds = Number(cfg.timer?.coinSeconds ?? 0)
  const size = Number(params.get('size') ?? cfg.timer?.size ?? 120)
  const showRule = (cfg.timer?.showRule ?? true) && coinSeconds > 0
  if (MINI || cfg.timer?.minimal) return <div style={{ ...base, fontWeight: 900, fontSize: size * 0.42, fontVariantNumeric: 'tabular-nums', color, textShadow: shadow }}>{txt}</div>
  // Añade un «flash» cuando el tiempo sube (subathon).
  const prev = useRef(ms)
  const [bump, setBump] = useState(0)
  useEffect(() => {
    if (ms > prev.current + 1500) setBump(Date.now())
    prev.current = ms
  }, [ms])
  return (
    <div style={{ ...base, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <Styles />
      <div
        key={bump}
        className={bump ? 'la-pop' : undefined}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 14, padding: `${size * 0.08}px ${size * 0.22}px`, borderRadius: 26, background: 'linear-gradient(180deg,#1d1a10,#0b0a06)', border: `2px solid ${color}55`, borderBottom: `5px solid ${color}`, boxShadow: `0 12px 30px #0008, 0 0 30px ${color}33` }}
      >
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: t?.running || DEMO ? color : '#666', boxShadow: t?.running ? `0 0 10px ${color}` : undefined }} />
        <span style={{ fontSize: size, lineHeight: 1, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: 1, textShadow: shadow }}>{txt}</span>
      </div>
      {(cfg.timer?.showProgress ?? true) && (
        <div style={{ width: size * 4, height: 5, borderRadius: 999, background: '#ffffff18', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${((sec % 60) / 60) * 100}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
        </div>
      )}
      {showRule && (
        <div style={{ fontSize: size * 0.12, fontWeight: 900, letterSpacing: 2, color: '#ffcc33', textShadow: shadow }}>
          🪙 1 MONEDA = {coinSeconds} SEGUNDO{coinSeconds === 1 ? '' : 'S'}
        </div>
      )}
    </div>
  )
}

/* ---------------------------------- Vidas ---------------------------------- */

export function LivesV2() {
  const s = useLiveState<any>('scoreboard')
  const cfg = useCfg()
  const lives = DEMO ? 5 : (s?.lives ?? 0)
  const prev = useRef(lives)
  const [delta, setDelta] = useState<{ n: number; k: number } | null>(null)
  useEffect(() => {
    if (lives !== prev.current) setDelta({ n: lives - prev.current, k: Date.now() })
    prev.current = lives
  }, [lives])
  const color = params.get('color') ?? cfg.lives?.color ?? '#ff3d6e'
  const title = params.get('title') ?? cfg.lives?.title ?? 'VIDAS'
  const out = lives <= 0 && !DEMO
  if (MINI || cfg.lives?.minimal)
    return (
      <div style={{ ...base, display: 'inline-flex', alignItems: 'center', gap: 10, fontWeight: 900, fontSize: 40, textShadow: shadow }}>
        <PixelHeart size={44} color={color} /> × {lives}
      </div>
    )
  return (
    <div style={{ ...base, position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', padding: '10px 26px 12px', borderRadius: 26, background: `linear-gradient(180deg, ${color}55, #1a0710ee)`, border: `3px solid ${color}`, boxShadow: `0 10px 30px #0008, 0 0 24px ${color}66` }}>
      <Styles />
      <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 5, opacity: 0.9 }}>{out ? 'SIN VIDAS' : title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 44, fontWeight: 900, textShadow: shadow }}>
        <PixelHeart size={48} color={out ? '#555' : color} beat={!out} />
        <span>× {lives}</span>
      </div>
      {delta && (
        <span key={delta.k} style={{ position: 'absolute', top: -6, right: -8, fontSize: 34, fontWeight: 900, color: delta.n > 0 ? '#ffd84d' : '#ff4d6d', textShadow: shadow, animation: 'la-float 1.6s ease-out forwards' }}>
          {delta.n > 0 ? `+${delta.n}` : delta.n}
        </span>
      )}
    </div>
  )
}

/* --------------------------------- Logros --------------------------------- */

interface Notice {
  key: number
  kind: 'follow' | 'killed' | 'love'
  name: string
  avatar?: string
  gift?: { name: string; imageUrl?: string }
  action?: string
}

/** Seguidores («¡Logro conseguido!»), «¡Te mató!» y Quiéreme (corazón de píxeles). Uno detrás de otro. */
export function NoticesOverlay() {
  const [cur, setCur] = useState<Notice | null>(DEMO ? { key: 1, kind: 'killed', name: 'Espectador de prueba', gift: { name: 'Rose' } } : null)
  const queue = useRef<Notice[]>([])
  const seq = useRef(1)
  const seenFollow = useRef(new Set<string>())
  const sound = params.get('sonido') !== '0'
  const follows = params.get('seguidores') !== '0'
  const push = (n: Omit<Notice, 'key'>) => {
    queue.current.push({ ...n, key: ++seq.current })
    if (queue.current.length > 30) queue.current.splice(0, queue.current.length - 30)
  }
  useOnEvent((ev: LiveEvent) => {
    if (ev.type === 'follow' && follows && ev.user) {
      const id = ev.user.id || ev.user.uniqueId
      if (seenFollow.current.has(id)) return
      seenFollow.current.add(id)
      push({ kind: 'follow', name: ev.user.nickname, avatar: ev.user.avatarUrl })
    }
    if (ev.type === 'gift' && ev.user && /heart ?me|qui[eé]reme/i.test(ev.payload.name) && (ev.payload.phase === 'single' || ev.payload.streakTotal === ev.payload.count))
      push({ kind: 'love', name: ev.user.nickname, avatar: ev.user.avatarUrl, gift: { name: ev.payload.name, imageUrl: ev.payload.imageUrl } })
  })
  useOnAction((a: ActionMessage) => {
    if (a.kind === 'overlay.killed' && a.user) push({ kind: 'killed', name: a.user.nickname, avatar: a.user.avatarUrl, gift: a.gift, action: a.actionName })
  })
  useEffect(() => {
    if (DEMO) return
    let busyUntil = 0
    const i = setInterval(() => {
      if (Date.now() < busyUntil) return
      const n = queue.current.shift()
      if (!n) {
        setCur(null)
        return
      }
      setCur(n)
      busyUntil = Date.now() + (n.kind === 'killed' ? 5000 : 3800)
      if (sound) {
        const f = n.kind === 'follow' ? 880 : n.kind === 'killed' ? 160 : 660
        try {
          const ctx = new AudioContext()
          const o = ctx.createOscillator()
          const g = ctx.createGain()
          o.type = n.kind === 'killed' ? 'sawtooth' : 'square'
          o.frequency.value = f
          g.gain.setValueAtTime(0.08, ctx.currentTime)
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
          o.connect(g).connect(ctx.destination)
          o.start()
          o.stop(ctx.currentTime + 0.5)
        } catch {
          /* sin audio */
        }
      }
    }, 250)
    return () => clearInterval(i)
  }, [sound])
  if (!cur) return <Styles />
  return (
    <div style={{ ...base, width: 600, height: 360, display: 'grid', placeItems: 'center' }}>
      <Styles />
      {cur.kind === 'follow' && (
        <div key={cur.key} className="la-slide" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 22px 12px 12px', background: '#212121', border: '4px solid #555', outline: '3px solid #000', boxShadow: 'inset -4px -4px 0 #111, inset 4px 4px 0 #3a3a3a, 0 12px 30px #000a', imageRendering: 'pixelated' }}>
          <Avatar url={cur.avatar} name={cur.name} size={60} />
          <div>
            <div style={{ color: '#ffff55', fontWeight: 800, fontSize: 20 }}>¡Logro conseguido!</div>
            <div style={{ fontWeight: 700, fontSize: 22 }}>{cur.name} te sigue</div>
          </div>
        </div>
      )}
      {cur.kind === 'killed' && (
        <div key={cur.key} className="la-pop" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 24, borderRadius: 18, background: 'radial-gradient(circle,#7a0d1a,#2a0308 70%)', boxShadow: '0 0 60px #ff1f3d77' }}>
          <div style={{ fontSize: 64, fontWeight: 900, textShadow: '0 4px 0 #5a0010, 0 0 30px #ff2d55' }}>¡Te mató!</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 20px 10px 10px', background: '#140306', border: '3px solid #ff2d55', boxShadow: 'inset 0 0 0 3px #5a0010' }}>
            <Avatar url={cur.avatar} name={cur.name} size={64} />
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#ffcc33' }}>{cur.name}</div>
              {(cur.gift || cur.action) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 20, fontWeight: 800 }}>
                  con {cur.gift ? <GiftImg name={cur.gift.name} url={cur.gift.imageUrl} size={30} /> : null} {cur.gift?.name ?? cur.action}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {cur.kind === 'love' && (
        <div key={cur.key} className="la-pop" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <PixelHeart size={180} beat />
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', paddingBottom: 26 }}>
              <Avatar url={cur.avatar} name={cur.name} size={70} />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, textShadow: shadow }}>{cur.name}</div>
          <div style={{ fontSize: 18, fontWeight: 700, opacity: 0.9 }}>te manda un Quiéreme</div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------ Mejor regalo ------------------------------ */

export function BestV2({ scope }: { scope: 'ever' | 'live' | 'streak' }) {
  const lb = useLiveState<any>('leaderboard')
  const cfg = useCfg()
  const c = scope === 'ever' ? cfg.best : scope === 'live' ? cfg.bestLive : cfg.streak
  const color = params.get('color') ?? c?.color ?? (scope === 'live' ? '#38bdf8' : scope === 'streak' ? '#c084fc' : '#ffb547')
  const title = params.get('title') ?? c?.title ?? (scope === 'live' ? 'TOP REGALO DEL LIVE' : scope === 'streak' ? 'MEJOR RACHA' : 'MEJOR REGALO')
  const demo = { user: { nickname: 'Espectador', avatarUrl: undefined }, gift: 'Corgi', count: scope === 'streak' ? 100 : 1, value: 299, imageUrl: undefined }
  const b = DEMO ? demo : scope === 'ever' ? lb?.summary?.bestEver : scope === 'live' ? lb?.summary?.bestLive : lb?.summary?.bestStreak
  const mini = MINI || c?.minimal
  if (mini)
    return (
      <div style={{ ...base, display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 14px 6px 6px', borderRadius: 999, background: '#0b0b14dd', border: `2px solid ${color}`, fontWeight: 800, fontSize: 20 }}>
        <Avatar url={b?.user.avatarUrl} name={b?.user.nickname ?? '?'} size={36} />
        {b ? (
          <>
            {b.user.nickname} · <GiftImg name={b.gift} url={b.imageUrl} size={28} /> {scope === 'streak' ? `×${b.count}` : <Coin n={b.value} />}
          </>
        ) : (
          'Aún nadie'
        )}
      </div>
    )
  return (
    <div style={{ ...base, display: 'inline-flex', alignItems: 'center', gap: 18, padding: '14px 26px 14px 14px', minWidth: 460, borderRadius: 999, background: `linear-gradient(100deg, #15151f, #0a0a12 60%, ${color}33)`, border: `2px solid ${color}88`, boxShadow: `0 12px 30px #0009, 0 0 30px ${color}44`, position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: -22, left: -6, fontSize: 30, transform: 'rotate(-18deg)' }}>{b ? '👑' : ''}</div>
        <div style={{ padding: 4, borderRadius: '50%', background: b ? color : '#334' }}>
          {b ? <Avatar url={b.user.avatarUrl} name={b.user.nickname} size={88} /> : <div style={{ width: 88, height: 88, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#223', fontSize: 44, fontWeight: 900 }}>?</div>}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 4, color }}>{title}</div>
        <div style={{ fontSize: 38, lineHeight: 1.05, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300, textShadow: shadow }}>{b ? b.user.nickname : 'Aún nadie'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, fontSize: 20, fontWeight: 700 }}>
          {b ? (
            <>
              {b.gift} {scope === 'streak' ? <b style={{ color: '#ffd84d', fontSize: 26 }}>×{fmt(b.count)}</b> : <Coin n={b.value} />}
            </>
          ) : (
            <span style={{ opacity: 0.85 }}>Manda un regalo y apareces aquí</span>
          )}
        </div>
      </div>
      {b && <GiftImg name={b.gift} url={b.imageUrl} size={96} />}
    </div>
  )
}

/* ------------------------------ Meta de regalo ----------------------------- */

function useGiftCount(name?: string): number {
  const lb = useLiveState<any>('leaderboard')
  if (!name) return 0
  const counts = (lb?.summary?.giftCounts ?? {}) as Record<string, number>
  const k = Object.keys(counts).find((x) => x.toLowerCase() === name.toLowerCase())
  return k ? counts[k]! : 0
}

function GoalNumber({ n, target }: { n: number; target: number }) {
  const done = n >= target
  return (
    <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, textShadow: shadow }}>
      <span style={{ color: done ? '#34e0a1' : '#ffcc33' }}>{fmt(n)}</span>
      <span style={{ opacity: 0.9 }}> / {fmt(target)}</span>
    </div>
  )
}

export function GiftGoalOverlay() {
  const cfg = useCfg()
  const g = cfg.giftGoal ?? { gift: 'Rose', target: 100, title: 'META' }
  const real = useGiftCount(g.gift)
  const n = DEMO ? 229 : real
  return (
    <div style={{ ...base, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <Styles />
      <div key={n} className={n ? 'la-pop' : undefined}>
        <GiftImg name={g.gift} size={130} />
      </div>
      <GoalNumber n={n} target={g.target} />
      <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 2, textShadow: shadow }}>{n >= g.target ? '¡META CUMPLIDA!' : g.title}</div>
    </div>
  )
}

/* ---------------------------------- Duelo ---------------------------------- */

export function DuelOverlay() {
  const cfg = useCfg()
  const d = cfg.duel ?? { a: { gift: 'Rose', label: 'EQUIPO 1' }, b: { gift: 'Finger Heart', label: 'EQUIPO 2' }, target: 100 }
  const ra = useGiftCount(d.a.gift)
  const rb = useGiftCount(d.b.gift)
  const a = DEMO ? 60 : ra
  const b = DEMO ? 35 : rb
  const side = (gift: string, n: number, label: string, lead: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transform: lead ? 'scale(1.08)' : undefined, transition: 'transform .3s' }}>
      <div key={n} className={n ? 'la-pop' : undefined}>
        <GiftImg name={gift} size={110} />
      </div>
      <GoalNumber n={n} target={d.target} />
      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2, textShadow: shadow }}>{label}</div>
    </div>
  )
  return (
    <div style={{ ...base, display: 'inline-flex', alignItems: 'center', gap: 26 }}>
      <Styles />
      {side(d.a.gift, a, d.a.label, a > b)}
      <div style={{ fontSize: 56, fontWeight: 900, fontStyle: 'italic', background: 'linear-gradient(180deg,#ffe259,#ff7a59)', WebkitBackgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 3px 0 #0008)' }}>VS</div>
      {side(d.b.gift, b, d.b.label, b > a)}
    </div>
  )
}

/* ----------------------------- Reset o salvar ----------------------------- */

export function ResetSaveOverlay() {
  const cfg = useCfg()
  const rs = cfg.resetSave ?? { resetGift: 'GG', saveGift: 'Rose' }
  const st = useLiveState<any>('resetsave')
  useTick(200)
  const pill = (children: ReactNode, glow: string) => (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '8px 22px 8px 10px', borderRadius: 999, background: '#0b0b14dd', border: `2px solid ${glow}`, boxShadow: `0 0 30px ${glow}55`, fontSize: 40, fontWeight: 900, textShadow: shadow }}>{children}</div>
  )
  if (!st && !DEMO)
    return (
      <div style={{ ...base, display: 'inline-flex', flexDirection: 'column', gap: 10 }}>
        {pill(
          <>
            <GiftImg name={rs.resetGift} size={60} /> = <span style={{ color: '#ff4d6d' }}>RESET</span>
          </>,
          '#ff4d6d',
        )}
        {pill(
          <>
            <GiftImg name={rs.saveGift} size={60} /> = <span style={{ color: '#34e0a1' }}>SALVAR</span>
          </>,
          '#34e0a1',
        )}
      </div>
    )
  const s = st ?? { state: 'waiting', by: 'Espectador', needed: 5, saved: 2, endsAt: Date.now() + 7000 }
  const left = Math.max(0, Math.ceil((s.endsAt - Date.now()) / 1000))
  return (
    <div style={{ ...base, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <Styles />
      {s.state === 'waiting' && (
        <>
          <div style={{ fontSize: 22, fontWeight: 800, textShadow: shadow }}>
            <b style={{ color: '#ffcc33' }}>{s.by}</b> quiere reiniciar
          </div>
          {pill(
            <>
              <span style={{ color: '#ff4d6d' }}>RESET</span> en <span style={{ fontVariantNumeric: 'tabular-nums' }}>{left}s</span>
            </>,
            '#ff4d6d',
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 26, fontWeight: 900, textShadow: shadow }}>
            <GiftImg name={rs.saveGift} size={44} /> {s.saved} / {s.needed} para salvar
          </div>
        </>
      )}
      {s.state === 'saved' && <div className="la-pop">{pill(<span style={{ color: '#34e0a1' }}>¡SALVADO!</span>, '#34e0a1')}</div>}
      {s.state === 'reset' && <div className="la-pop">{pill(<span style={{ color: '#ff4d6d' }}>¡RESET!</span>, '#ff4d6d')}</div>}
    </div>
  )
}

/* --------------------------- Regalos destacados --------------------------- */

interface Feat {
  key: string
  name: string
  avatar?: string
  gift: string
  image?: string
  count: number
  coins: number
  until: number
}

export function FeaturedOverlay() {
  const cfg = useCfg()
  const min = Number(params.get('min') ?? cfg.featured?.minCoins ?? 100)
  const secs = Number(params.get('s') ?? cfg.featured?.seconds ?? 10)
  const [list, setList] = useState<Feat[]>(DEMO ? [{ key: 'd', name: 'Usuario', gift: 'Rose', count: 5, coins: 5, until: Infinity }] : [])
  useTick(500)
  useOnEvent((ev: LiveEvent) => {
    if (ev.type !== 'gift' || !ev.user) return
    const g = ev.payload
    const coins = g.diamonds * g.streakTotal
    if (coins < min) return
    const key = `${ev.user.id || ev.user.uniqueId}:${g.name}`
    setList((l) => {
      const rest = l.filter((x) => x.key !== key)
      return [{ key, name: ev.user!.nickname, avatar: ev.user!.avatarUrl, gift: g.name, image: g.imageUrl, count: g.streakTotal, coins, until: Date.now() + secs * 1000 }, ...rest].slice(0, 6)
    })
  })
  const now = Date.now()
  return (
    <div style={{ ...base, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      <Styles />
      {list
        .filter((x) => x.until > now)
        .map((x) => (
          <div key={x.key + x.count} className="la-pop" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 18px 6px 6px', borderRadius: 999, background: 'linear-gradient(90deg,#8b5cf6dd,#f43f9ecc)', border: '2px solid #ffffff55', boxShadow: '0 8px 20px #0007', fontSize: 20, fontWeight: 800 }}>
            <Avatar url={x.avatar} name={x.name} size={36} />
            {x.name} envió <GiftImg name={x.gift} url={x.image} size={30} /> {x.gift}
            {x.count > 1 && <b style={{ color: '#ffe066' }}>×{x.count}</b>}
          </div>
        ))}
    </div>
  )
}

/* ------------------------------ Rankings top ------------------------------ */

const DEMO_ROWS = ['Santos', 'Lucía', 'Givi', 'Zentic', 'Gaspar', 'Jeshua', 'César', 'Deylor', 'Max', 'Carlos'].map((n, i) => ({ userId: n, nickname: n, diamonds: [500, 101, 49, 39, 15, 13, 6, 5, 5, 4][i]!, likes: [20785, 10953, 10028, 7628, 7419, 4989, 2173, 2048, 1814, 1798][i]! }))

type TopStyle = 'clasico' | 'tarjetas' | 'barras' | 'neon' | 'desfile' | 'minimo' | 'arcade' | 'oro'

export function TopV2({ kind }: { kind: 'donors' | 'likers' }) {
  const lb = useLiveState<any>('leaderboard')
  const cfg = useCfg()
  const style = (params.get('style') ?? cfg.top?.style ?? 'clasico') as TopStyle
  const n = Number(params.get('n') ?? cfg.top?.n ?? 10)
  const rows = (DEMO ? DEMO_ROWS : (lb?.[kind] ?? [])).slice(0, n)
  const right = params.get('align') === 'right'
  const title = params.get('title') ?? (kind === 'donors' ? 'TOP REGALOS' : 'TOP LIKES')
  const S = TOP_STYLES[style] ?? TOP_STYLES.oro
  return (
    <div style={{ ...base, width: 420, display: 'flex', flexDirection: 'column', gap: S.gap, alignItems: right ? 'flex-end' : 'flex-start' }}>
      <div style={{ ...S.title, alignSelf: right ? 'flex-end' : 'flex-start' }}>{title}</div>
      {rows.map((r: any, i: number) => {
        const value = kind === 'donors' ? r.diamonds : r.likes
        return (
          <div key={r.userId} className="la-pop" style={{ ...S.row(i), flexDirection: right ? 'row-reverse' : 'row', textAlign: right ? 'right' : 'left', animationDelay: `${i * 40}ms` }}>
            {S.rank && <span style={{ ...S.rank(i) }}>{i + 1}</span>}
            <div style={{ position: 'relative' }}>
              {i === 0 && <span style={{ position: 'absolute', top: -14, left: 8, fontSize: 20 }}>👑</span>}
              <Avatar url={r.avatarUrl} name={r.nickname} size={S.avatar} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ ...S.name(i), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nickname}</div>
              <div style={{ ...S.value(i) }}>
                {fmt(value)} {kind === 'donors' ? '🪙' : '❤️'}
              </div>
            </div>
          </div>
        )
      })}
      {rows.length === 0 && <div style={{ ...S.row(1), opacity: 0.8 }}>Aún no hay nadie</div>}
    </div>
  )
}

const gold = '#ffcc4d'
const TOP_STYLES: Record<TopStyle, { gap: number; avatar: number; title: CSSProperties; row: (i: number) => CSSProperties; name: (i: number) => CSSProperties; value: (i: number) => CSSProperties; rank?: (i: number) => CSSProperties }> = {
  clasico: {
    gap: 8,
    avatar: 50,
    title: { fontSize: 34, fontWeight: 900, color: gold, textShadow: '0 2px 0 #7a4b00, 0 0 16px #ffb30055' },
    row: (i) => ({ display: 'flex', alignItems: 'center', gap: 12, width: 380, padding: '7px 14px', borderRadius: 16, background: '#0c0c12ee', border: `2px solid ${i === 0 ? gold : '#2a2a40'}`, boxShadow: i === 0 ? `0 0 16px ${gold}55` : '0 6px 16px #0006' }),
    name: (i) => ({ fontSize: 23, fontWeight: 900, color: i === 0 ? gold : '#f0f0ff', textShadow: '0 2px 0 #0008' }),
    value: () => ({ fontSize: 17, fontWeight: 800, color: '#ffe8a3' }),
  },
  oro: {
    gap: 10,
    avatar: 56,
    title: { fontSize: 38, fontWeight: 900, color: gold, textShadow: '0 3px 0 #7a4b00, 0 0 20px #ffb30066' },
    row: () => ({ display: 'flex', alignItems: 'center', gap: 12, width: 380, padding: '8px 14px', borderRadius: 18, background: 'linear-gradient(180deg,#1d1608,#0b0904)', border: `3px solid ${gold}`, boxShadow: `0 0 18px ${gold}66` }),
    name: () => ({ fontSize: 26, fontWeight: 900, color: gold, textShadow: '0 2px 0 #5a3700' }),
    value: () => ({ fontSize: 20, fontWeight: 900, color: '#ffe8a3' }),
  },
  tarjetas: {
    gap: 8,
    avatar: 46,
    title: { fontSize: 30, fontWeight: 900, textShadow: shadow },
    row: (i) => ({ display: 'flex', alignItems: 'center', gap: 12, width: 380, padding: '8px 14px', borderRadius: 16, background: i === 0 ? 'linear-gradient(90deg,#8b5cf6,#f43f9e)' : '#13131fdd', border: '1px solid #ffffff22', boxShadow: '0 8px 20px #0007' }),
    name: () => ({ fontSize: 22, fontWeight: 800 }),
    value: () => ({ fontSize: 16, fontWeight: 700, opacity: 0.85 }),
    rank: () => ({ width: 26, fontSize: 22, fontWeight: 900, opacity: 0.8 }),
  },
  barras: {
    gap: 4,
    avatar: 40,
    title: { fontSize: 28, fontWeight: 900, textShadow: shadow, marginBottom: 4 },
    row: (i) => ({ display: 'flex', alignItems: 'center', gap: 10, width: 400, padding: '6px 12px', background: `linear-gradient(90deg, hsl(${25 - i * 2} 70% ${42 - i * 2}%), hsl(${25 - i * 2} 60% ${22 - i}%))`, clipPath: 'polygon(0 0,100% 0,97% 100%,0 100%)' }),
    name: () => ({ fontSize: 20, fontWeight: 900 }),
    value: () => ({ fontSize: 15, fontWeight: 800, opacity: 0.9 }),
    rank: () => ({ width: 24, fontSize: 20, fontWeight: 900 }),
  },
  neon: {
    gap: 10,
    avatar: 46,
    title: { fontSize: 34, fontWeight: 900, color: '#5ef2ff', textShadow: '0 0 10px #5ef2ff, 0 0 30px #00b3ff' },
    row: () => ({ display: 'flex', alignItems: 'center', gap: 12, width: 380, padding: '8px 14px', borderRadius: 14, background: '#020812cc', border: '2px solid #5ef2ff', boxShadow: '0 0 14px #5ef2ff99, inset 0 0 14px #5ef2ff44' }),
    name: () => ({ fontSize: 22, fontWeight: 800, color: '#dffcff', textShadow: '0 0 8px #5ef2ff' }),
    value: () => ({ fontSize: 16, fontWeight: 700, color: '#9ff8ff' }),
  },
  desfile: {
    gap: 6,
    avatar: 44,
    title: { fontSize: 30, fontWeight: 900, fontStyle: 'italic', color: '#ffd166', textShadow: shadow },
    row: (i) => ({ display: 'flex', alignItems: 'center', gap: 12, width: 380 - i * 14, padding: '6px 14px', borderRadius: 999, background: `linear-gradient(90deg,#ffd16633,#0b0b14dd)`, border: '2px solid #ffd16688' }),
    name: () => ({ fontSize: 21, fontWeight: 800 }),
    value: () => ({ fontSize: 15, fontWeight: 700, color: '#ffd166' }),
  },
  minimo: {
    gap: 4,
    avatar: 34,
    title: { fontSize: 22, fontWeight: 800, letterSpacing: 3, textShadow: shadow },
    row: () => ({ display: 'flex', alignItems: 'center', gap: 10, width: 340, padding: '4px 0', textShadow: shadow }),
    name: () => ({ fontSize: 19, fontWeight: 700 }),
    value: () => ({ fontSize: 14, fontWeight: 600, opacity: 0.85 }),
    rank: () => ({ width: 20, fontSize: 16, fontWeight: 800, opacity: 0.7 }),
  },
  arcade: {
    gap: 6,
    avatar: 40,
    title: { fontSize: 30, fontWeight: 900, color: '#ff4fd8', textShadow: '3px 3px 0 #2b0a3d', letterSpacing: 2 },
    row: () => ({ display: 'flex', alignItems: 'center', gap: 12, width: 380, padding: '6px 12px', background: '#1a0b2e', border: '3px solid #fff', boxShadow: '4px 4px 0 #ff4fd8' }),
    name: () => ({ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: 1 }),
    value: () => ({ fontSize: 15, fontWeight: 800, color: '#ffe066' }),
    rank: () => ({ width: 24, fontSize: 20, fontWeight: 900, color: '#ff4fd8' }),
  },
}

/* ---------------------------------- MVP ---------------------------------- */

export function MvpOverlay({ kind }: { kind: 'donors' | 'likers' }) {
  const lb = useLiveState<any>('leaderboard')
  const r = DEMO ? DEMO_ROWS[0] : lb?.[kind]?.[0]
  const color = kind === 'donors' ? '#ffcc4d' : '#ff4d8d'
  return (
    <div style={{ ...base, display: 'inline-flex', alignItems: 'center', gap: 16, padding: '12px 26px 12px 12px', borderRadius: 999, background: `linear-gradient(100deg,${color}44,#0b0b14ee 60%)`, border: `3px solid ${color}`, boxShadow: `0 0 30px ${color}55` }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', top: -20, left: 14, fontSize: 28 }}>👑</span>
        <Avatar url={r?.avatarUrl} name={r?.nickname ?? '?'} size={76} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 4, color }}>{kind === 'donors' ? 'MVP DE MONEDAS' : 'MVP DE LIKES'}</div>
        <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.05, textShadow: shadow }}>{r?.nickname ?? 'Aún nadie'}</div>
        {r && (
          <div style={{ fontSize: 20, fontWeight: 800 }}>
            {fmt(kind === 'donors' ? r.diamonds : r.likes)} {kind === 'donors' ? '🪙' : '❤️'}
          </div>
        )}
      </div>
    </div>
  )
}

/* --------------------------------- Metas --------------------------------- */

export function GoalBar({ metric }: { metric: 'coins' | 'likes' | 'combined' | 'followers' }) {
  const lb = useLiveState<any>('leaderboard')
  const likes = useLiveState<any>('likes')
  const cfg = useCfg()
  const coins = DEMO ? 1787 : (lb?.summary?.diamonds ?? 0)
  const l = DEMO ? 116222 : (likes?.roomLikes ?? 0)
  const fol = DEMO ? 5693 : (lb?.summary?.follows ?? 0)
  const value = metric === 'coins' ? coins : metric === 'likes' ? l : metric === 'followers' ? fol : coins + l
  const dft = metric === 'coins' ? cfg.goals?.coins : metric === 'followers' ? cfg.goals?.followers : metric === 'combined' ? cfg.goals?.combined : null
  const target = Number(params.get('goal') ?? (metric === 'likes' ? likes?.goal : dft?.target) ?? (metric === 'likes' ? 10000 : 5000)) || 1
  const label = params.get('title') ?? (metric === 'likes' ? likes?.label : dft?.label) ?? (metric === 'coins' ? 'DIAMANTES' : metric === 'followers' ? 'SEGUIDORES' : metric === 'combined' ? 'META DEL LIVE' : 'LIKES')
  const pct = Math.min(100, (value / target) * 100)
  // Colores por métrica (como en la referencia): diamantes oro, likes cian, seguidores violeta.
  const theme = metric === 'coins' ? { a: '#f5b301', b: '#b8860b', pill: '#3a2d00', text: '#fff' } : metric === 'likes' ? { a: '#38e1ff', b: '#17b6d8', pill: '#063442', text: '#00323f' } : metric === 'followers' ? { a: '#c084fc', b: '#9a4dff', pill: '#2a0a4a', text: '#1a0533' } : { a: '#f43f9e', b: '#8b5cf6', pill: '#2a0a2a', text: '#fff' }
  const stripes = `repeating-linear-gradient(115deg, ${theme.a} 0 14px, ${theme.b} 14px 28px)`
  const w = Number(params.get('w') ?? 640)
  return (
    <div style={{ ...base, width: w }}>
      <Styles />
      <div
        key={pct}
        className="la-pop"
        style={{ position: 'relative', display: 'flex', alignItems: 'center', height: 68, borderRadius: 16, overflow: 'hidden', background: '#0b0b14', border: '2px solid #ffffff22', boxShadow: `0 10px 30px #0008, 0 0 24px ${theme.a}44` }}
      >
        {/* relleno con rayas */}
        <div style={{ position: 'absolute', inset: 0, width: `${Math.max(pct, 12)}%`, background: stripes, backgroundSize: '200% 100%', animation: 'la-shine 6s linear infinite', transition: 'width .6s cubic-bezier(.2,1,.3,1)' }} />
        {/* pastilla con el título */}
        <div style={{ position: 'relative', margin: '0 14px', padding: '8px 22px', borderRadius: 999, background: `${theme.pill}cc`, border: `2px solid ${theme.a}`, fontSize: 24, fontWeight: 900, letterSpacing: 1, color: theme.text === '#fff' ? '#fff' : '#fff', textShadow: '0 2px 4px #0009', zIndex: 1 }}>
          {label}
        </div>
        {/* números a la derecha */}
        <div style={{ position: 'relative', marginLeft: 'auto', padding: '6px 18px', borderRadius: 12, background: '#0b0b14cc', border: '1px solid #ffffff22', marginRight: 14, fontSize: 26, fontWeight: 900, zIndex: 1 }}>
          <span>{fmt(value)}</span>
          <span style={{ opacity: 0.5 }}> / {fmt(target)}</span>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------- Tótems --------------------------------- */

export function TotemsOverlay() {
  const mc = useLiveState<any>('minecraft')
  const n = DEMO ? 12 : mc?.totems
  const prev = useRef(n)
  const [k, setK] = useState(0)
  useEffect(() => {
    if (n !== prev.current) setK(Date.now())
    prev.current = n
  }, [n])
  return (
    <div style={{ ...base, display: 'inline-flex', alignItems: 'center', gap: 12, padding: '8px 22px 8px 10px', borderRadius: 999, background: 'linear-gradient(100deg,#3b2a00,#0b0b14ee 70%)', border: '3px solid #ffcc33', boxShadow: '0 0 26px #ffcc3355' }}>
      <Styles />
      <img src="/textures/totem_of_undying.png" alt="" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} style={{ width: 52, height: 52, imageRendering: 'pixelated' }} />
      <div>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 4, color: '#ffcc33' }}>TÓTEMS</div>
        <div key={k} className={k ? 'la-pop' : undefined} style={{ fontSize: 40, lineHeight: 1, fontWeight: 900, textShadow: shadow }}>
          {n ?? '—'}
        </div>
      </div>
    </div>
  )
}

/* ------------------------- Combinado (va rotando) ------------------------- */

export function CombinedOverlay() {
  const [i, setI] = useState(0)
  const secs = Number(params.get('s') ?? 8)
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % 3), secs * 1000)
    return () => clearInterval(t)
  }, [secs])
  return (
    <div key={i} className="la-pop">
      <Styles />
      {i === 0 ? <BestV2 scope="live" /> : i === 1 ? <BestV2 scope="streak" /> : <GiftGoalOverlay />}
    </div>
  )
}

/* ----------------------------------- TTS ----------------------------------- */

/** Lee los comentarios en voz alta: voces del PC (personajes) o voces de Windows con efectos. Añádelo como fuente de navegador. */
export function TtsOverlay() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  type Job = { text: string; voice: string; rate: number; volume: number; random: boolean; audio?: string; effect?: VoiceEffect }
  const queue = useRef<Job[]>([])
  const speaking = useRef(false)
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices())
    load()
    window.speechSynthesis.onvoiceschanged = load
  }, [])
  const done = () => {
    speaking.current = false
    pump()
  }
  const pump = () => {
    if (speaking.current) return
    const job = queue.current.shift()
    if (!job) return
    speaking.current = true
    if (job.audio) {
      playAudio(job.audio, job.effect ?? 'none', job.volume).then(done, done)
      return
    }
    const u = utterance(job.text, job.voice, job.rate, job.volume, job.random)
    u.onend = u.onerror = done
    try {
      window.speechSynthesis.speak(u)
    } catch {
      speaking.current = false
    }
  }
  useOnAction((a) => {
    if (a.kind !== 'tts.speak') return
    const max = Number(a.params.maxQueue ?? 25)
    queue.current.push({
      text: String(a.params.text ?? ''),
      voice: String(a.params.voice ?? ''),
      rate: Number(a.params.rate ?? 1),
      volume: Number(a.params.volume ?? 1),
      random: !!a.params.random,
      audio: a.params.audio ? String(a.params.audio) : undefined,
      effect: (a.params.effect as VoiceEffect) ?? 'none',
    })
    if (queue.current.length > max) queue.current.splice(0, queue.current.length - max)
    pump()
  })
  // Marca pequeña para saber que la fuente está activa (y permitir el autoplay tras un clic si hace falta).
  return (
    <div style={{ ...base, position: 'fixed', bottom: 6, right: 8, fontSize: 11, opacity: 0.35 }} onClick={() => window.speechSynthesis.resume()}>
      🔊 TTS · {voices.length} voces
    </div>
  )
}

/* ------------------------------- Ticker (banda) ------------------------------- */

interface Tick {
  key: number
  kind: string
  name: string
  avatar?: string
  gift?: string
  image?: string
  count?: number
  color: string
}

/** Banda con los últimos eventos del live (regalos, seguidores, likes, compartir). Ideal como barra inferior. */
export function TickerOverlay() {
  const [items, setItems] = useState<Tick[]>(
    DEMO
      ? [
          { key: 1, kind: 'gift', name: 'Santos', gift: 'Corgi', count: 3, color: '#ffcc33' },
          { key: 2, kind: 'follow', name: 'Lucía', color: '#34e0a1' },
          { key: 3, kind: 'gift', name: 'Zentic', gift: 'Rose', count: 5, color: '#ffcc33' },
          { key: 4, kind: 'share', name: 'Givi', color: '#38bdf8' },
        ]
      : [],
  )
  const seq = useRef(0)
  useOnEvent((ev: LiveEvent) => {
    if (!ev.user) return
    let t: Omit<Tick, 'key'> | null = null
    if (ev.type === 'gift' && (ev.payload.phase === 'single' || ev.payload.streakTotal === ev.payload.count))
      t = { kind: 'gift', name: ev.user.nickname, avatar: ev.user.avatarUrl, gift: ev.payload.name, image: ev.payload.imageUrl, count: ev.payload.streakTotal, color: '#ffcc33' }
    else if (ev.type === 'follow') t = { kind: 'follow', name: ev.user.nickname, avatar: ev.user.avatarUrl, color: '#34e0a1' }
    else if (ev.type === 'share') t = { kind: 'share', name: ev.user.nickname, avatar: ev.user.avatarUrl, color: '#38bdf8' }
    else if (ev.type === 'subscribe') t = { kind: 'sub', name: ev.user.nickname, avatar: ev.user.avatarUrl, color: '#f472d0' }
    if (t) setItems((l) => [...l.slice(-30), { ...t!, key: ++seq.current }])
  })
  const vertical = params.get('dir') === 'v'
  const label = (t: Tick) => (t.kind === 'follow' ? 'empezó a seguirte' : t.kind === 'share' ? 'compartió el live' : t.kind === 'sub' ? 'se suscribió' : null)
  return (
    <div
      style={{
        ...base,
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
        gap: 10,
        padding: 10,
        alignItems: vertical ? 'stretch' : 'center',
        overflow: 'hidden',
        width: vertical ? 'auto' : '100%',
      }}
    >
      <Styles />
      {items.slice(vertical ? -8 : -12).map((t) => (
        <div
          key={t.key}
          className="la-pop"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 16px 6px 6px',
            borderRadius: 999,
            background: `linear-gradient(100deg, ${t.color}33, #0b0b14ee 70%)`,
            border: `2px solid ${t.color}aa`,
            boxShadow: `0 6px 18px #0007`,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <Avatar url={t.avatar} name={t.name} size={34} />
          <span style={{ fontWeight: 800, fontSize: 17 }}>{t.name}</span>
          {t.gift ? (
            <>
              {t.image && <img src={t.image} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />}
              <span style={{ fontWeight: 700, fontSize: 15, opacity: 0.9 }}>{t.gift}</span>
              {t.count && t.count > 1 && <b style={{ color: t.color }}>×{t.count}</b>}
            </>
          ) : (
            <span style={{ fontSize: 14, opacity: 0.9 }}>{label(t)}</span>
          )}
        </div>
      ))}
      {items.length === 0 && <div style={{ opacity: 0.5, fontSize: 14 }}>Esperando eventos del live…</div>}
    </div>
  )
}
