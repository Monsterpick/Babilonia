import type { CSSProperties } from 'react'
import type { Layer, Scene } from '@livearena/shared'
import { useLiveState } from '../lib/live'
import { findGift, useGifts } from '../lib/catalog'
import { OverlayRouter } from './OverlayRouter'

/** Renderiza una escena del estudio: capas colocadas en %, cada una con su contenido. */
export function SceneView({ id, inline }: { id?: string; inline?: Scene }) {
  const scenes = useLiveState<Scene[]>('scenes')
  const scene = inline ?? scenes?.find((s) => s.id === id) ?? scenes?.[0]
  if (!scene) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: scene.bg === 'transparent' ? 'transparent' : scene.bg, overflow: 'hidden' }}>
      {scene.layers.filter((l) => !l.hidden).map((l) => (
        <LayerView key={l.id} l={l} />
      ))}
    </div>
  )
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
    pointerEvents: editing ? 'none' : 'none',
    overflow: 'visible',
  }
  return <div style={box}>{content(l)}</div>
}

function content(l: Layer) {
  switch (l.type) {
    case 'image':
      return l.url ? <img src={l.url} alt="" style={{ width: '100%', height: '100%', objectFit: l.fit }} /> : <Placeholder label="imagen" />
    case 'video':
      return l.url ? <video src={l.url} autoPlay loop={l.loop} muted={l.muted} playsInline style={{ width: '100%', height: '100%', objectFit: l.fit }} /> : <Placeholder label="vídeo" />
    case 'text':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: l.align === 'left' ? 'flex-start' : l.align === 'right' ? 'flex-end' : 'center', textAlign: l.align, fontFamily: "'Outfit Variable','Outfit',sans-serif", fontWeight: l.weight, fontSize: l.font, color: l.color, lineHeight: 1.05, textShadow: l.stroke ? '0 3px 0 rgba(0,0,0,.5), 0 0 16px rgba(0,0,0,.4)' : undefined, WebkitTextStroke: l.stroke ? '1px rgba(0,0,0,.35)' : undefined }}>
          {l.text}
        </div>
      )
    case 'icon':
      return <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: Math.min(l.font * 3, 400) }}>{l.icon}</div>
    case 'shape':
      return <div style={{ width: '100%', height: '100%', background: l.color, borderRadius: l.shape === 'circle' ? '50%' : l.radius }} />
    case 'gift':
      return <GiftLayer name={l.gift} fit={l.fit} />
    case 'overlay':
      return (
        <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
          <div style={{ transform: 'scale(1)', transformOrigin: 'center' }}>
            <OverlayRouter name={l.overlay} />
          </div>
        </div>
      )
    default:
      return null
  }
}

function GiftLayer({ name, fit }: { name: string; fit: 'contain' | 'cover' | 'fill' }) {
  const gifts = useGifts()
  const src = findGift(gifts, name)?.image
  return src ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: fit }} /> : <Placeholder label={name} />
}

function Placeholder({ label }: { label: string }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', border: '2px dashed #ffffff44', borderRadius: 8, color: '#ffffff88', fontFamily: 'sans-serif', fontSize: 14 }}>
      {label}
    </div>
  )
}
