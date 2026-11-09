import { useEffect, useState, type CSSProperties } from 'react'
import { sceneSize, type Layer, type Scene } from '@livearena/shared'
import { useLiveState } from '../lib/live'
import { findGift, useGifts } from '../lib/catalog'
import { OverlayRouter } from './OverlayRouter'

/**
 * Renderiza una escena del estudio a su resolución real (1920×1080, 1080×1920…) y la escala para que quepa en
 * la ventana: funciona igual con una fuente de navegador del tamaño exacto o de cualquier otro tamaño.
 */
export function SceneView({ id, inline }: { id?: string; inline?: Scene }) {
  const scenes = useLiveState<Scene[]>('scenes')
  const scene = inline ?? scenes?.find((s) => s.id === id) ?? scenes?.[0]
  const [win, setWin] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const r = () => setWin({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', r)
    return () => window.removeEventListener('resize', r)
  }, [])
  if (!scene) return null
  const size = sceneSize(scene.ratio)
  const k = Math.min(win.w / size.w, win.h / size.h)
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
      <SceneStyles />
      <div style={{ width: size.w * k, height: size.h * k, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: size.w, height: size.h, transform: `scale(${k})`, transformOrigin: 'top left', background: scene.bg === 'transparent' ? 'transparent' : scene.bg, overflow: 'hidden' }}>
          {scene.layers.filter((l) => !l.hidden).map((l) => (
            <LayerView key={l.id} l={l} />
          ))}
        </div>
      </div>
    </div>
  )
}

const FAMILIES: Record<Layer['family'], string> = {
  outfit: "'Outfit Variable','Outfit',system-ui,sans-serif",
  impact: "Impact,'Anton','Arial Black',sans-serif",
  mono: "'JetBrains Mono',ui-monospace,Consolas,monospace",
  serif: "Georgia,'Times New Roman',serif",
  comic: "'Comic Sans MS','Comic Neue',cursive",
  pixel: "'Press Start 2P','Courier New',monospace",
}

/** Animaciones de las capas (entrada o en bucle). */
export function SceneStyles() {
  return (
    <style>{`
@keyframes la-fade{from{opacity:0}to{opacity:1}}
@keyframes la-slide-up{from{opacity:0;transform:translateY(40%)}to{opacity:1;transform:none}}
@keyframes la-slide-left{from{opacity:0;transform:translateX(40%)}to{opacity:1;transform:none}}
@keyframes la-pop{0%{opacity:0;transform:scale(.4)}70%{transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
@keyframes la-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@keyframes la-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6%)}}
@keyframes la-spin{to{transform:rotate(360deg)}}
@keyframes la-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-3%)}40%{transform:translateX(3%)}60%{transform:translateX(-2%)}80%{transform:translateX(2%)}}
@keyframes la-glow{0%,100%{filter:brightness(1) drop-shadow(0 0 0 transparent)}50%{filter:brightness(1.25) drop-shadow(0 0 18px currentColor)}}
`}</style>
  )
}

const LOOP = new Set(['pulse', 'float', 'spin', 'shake', 'glow'])

function animation(l: Layer): string | undefined {
  if (l.anim === 'none') return undefined
  const base = { fade: 0.8, 'slide-up': 0.8, 'slide-left': 0.8, pop: 0.6, pulse: 1.6, float: 3, spin: 6, shake: 0.8, glow: 2 }[l.anim] ?? 1
  const dur = base / (l.animSpeed || 1)
  return LOOP.has(l.anim) ? `la-${l.anim} ${dur}s ${l.anim === 'spin' ? 'linear' : 'ease-in-out'} infinite` : `la-${l.anim} ${dur}s cubic-bezier(.2,.8,.2,1) both`
}

export function LayerView({ l, editing }: { l: Layer; editing?: boolean }) {
  const box: CSSProperties = {
    position: 'absolute',
    left: `${l.x}%`,
    top: `${l.y}%`,
    width: `${l.w}%`,
    height: `${l.h}%`,
    transform: `rotate(${l.rot}deg)`,
    opacity: l.opacity,
    pointerEvents: 'none',
    overflow: 'visible',
    color: l.glow || l.color,
  }
  const inner: CSSProperties = {
    width: '100%',
    height: '100%',
    animation: animation(l),
    borderRadius: l.type === 'shape' && l.shape === 'circle' ? '50%' : l.radius,
    border: l.border ? `${l.border}px solid ${l.borderColor}` : undefined,
    boxShadow: [l.shadow ? '0 14px 40px rgba(0,0,0,.55)' : '', l.glow ? `0 0 28px ${l.glow}, 0 0 60px ${l.glow}88` : ''].filter(Boolean).join(', ') || undefined,
    overflow: l.type === 'image' || l.type === 'video' ? 'hidden' : 'visible',
  }
  return (
    <div style={box}>
      <div style={inner} key={editing ? `${l.anim}-${l.animSpeed}` : undefined}>
        {content(l)}
      </div>
    </div>
  )
}

function content(l: Layer) {
  switch (l.type) {
    case 'image':
      return l.url ? <img src={l.url} alt="" style={{ width: '100%', height: '100%', objectFit: l.fit, display: 'block' }} /> : <Placeholder label="imagen" />
    case 'video':
      return l.url ? <video src={l.url} autoPlay loop={l.loop} muted={l.muted} playsInline style={{ width: '100%', height: '100%', objectFit: l.fit, display: 'block' }} /> : <Placeholder label="vídeo" />
    case 'text':
      return <TextLayer l={l} />
    case 'icon':
      return <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: l.font * 2 }}>{l.icon}</div>
    case 'shape':
      return <div style={{ width: '100%', height: '100%', background: l.color, borderRadius: l.shape === 'circle' ? '50%' : l.radius }} />
    case 'gift':
      return <GiftLayer name={l.gift} fit={l.fit} />
    case 'overlay':
      return (
        <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'visible' }}>
          <div style={{ transform: `scale(${l.scale})`, transformOrigin: 'center' }}>
            <OverlayRouter name={l.overlay} />
          </div>
        </div>
      )
    default:
      return null
  }
}

const fmt = (n: number | undefined) => (n ?? 0).toLocaleString('es')

/** Texto con datos en vivo: {likes}, {monedas}, {regalos}, {seguidores}, {top1}, {top1_monedas}, {espectadores}, {hora}. */
function useTokens(text: string): string {
  const likes = useLiveState<{ roomLikes: number }>('likes')
  const lb = useLiveState<{ donors: { nickname: string; diamonds: number }[]; likers: { nickname: string; likes: number }[]; summary: { diamonds: number; gifts: number; follows: number } }>('leaderboard')
  const source = useLiveState<{ viewers?: number }>('source')
  const [now, setNow] = useState(Date.now())
  const needsClock = text.includes('{hora}')
  useEffect(() => {
    if (!needsClock) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [needsClock])
  if (!text.includes('{')) return text
  const top1 = lb?.donors?.[0]
  const liker1 = lb?.likers?.[0]
  return text
    .replace(/\{likes\}/g, fmt(likes?.roomLikes))
    .replace(/\{monedas\}/g, fmt(lb?.summary?.diamonds))
    .replace(/\{regalos\}/g, fmt(lb?.summary?.gifts))
    .replace(/\{seguidores\}/g, fmt(lb?.summary?.follows))
    .replace(/\{top1\}/g, top1?.nickname ?? '—')
    .replace(/\{top1_monedas\}/g, fmt(top1?.diamonds))
    .replace(/\{top_likes\}/g, liker1?.nickname ?? '—')
    .replace(/\{espectadores\}/g, fmt(source?.viewers))
    .replace(/\{hora\}/g, new Date(now).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }))
}

function TextLayer({ l }: { l: Layer }) {
  const text = useTokens(l.text)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: l.align === 'left' ? 'flex-start' : l.align === 'right' ? 'flex-end' : 'center',
        textAlign: l.align,
        fontFamily: FAMILIES[l.family] ?? FAMILIES.outfit,
        fontWeight: l.weight,
        fontSize: l.font,
        color: l.color,
        lineHeight: 1.05,
        whiteSpace: 'pre-wrap',
        textShadow: l.stroke ? '0 3px 0 rgba(0,0,0,.5), 0 0 16px rgba(0,0,0,.4)' : undefined,
        WebkitTextStroke: l.stroke ? '1px rgba(0,0,0,.35)' : undefined,
      }}
    >
      <span style={l.textBg ? { background: l.textBg, padding: '0.15em 0.45em', borderRadius: '0.35em' } : undefined}>{text}</span>
    </div>
  )
}

function GiftLayer({ name, fit }: { name: string; fit: 'contain' | 'cover' | 'fill' }) {
  const gifts = useGifts()
  const src = findGift(gifts, name)?.image
  return src ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: fit }} /> : <Placeholder label={name} />
}

function Placeholder({ label }: { label: string }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', border: '3px dashed #ffffff44', borderRadius: 12, color: '#ffffff88', fontFamily: 'sans-serif', fontSize: 28 }}>
      {label}
    </div>
  )
}
