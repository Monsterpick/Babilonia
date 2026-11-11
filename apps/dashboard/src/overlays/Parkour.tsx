import { useEffect, useRef, useState } from 'react'
import { useLiveState, useTick } from '../lib/live'
import { DEMO } from './Pro'

/**
 * Overlay «Torre de parkour»: la torre de abajo arriba con el color de cada bioma, dónde va el streamer, el nombre del
 * nivel, el progreso, las caídas y el tiempo. Cuando le suben o le bajan de nivel aparece un «+N» / «−N» grande.
 */
interface Game {
  running: boolean
  level: number
  levels: number
  progress: number
  levelProgress: number
  falls: number
  time: number
  limit: number
  ganadas: number
  perdidas: number
  shield: boolean
  protected: boolean
  won: boolean
  theme: string
  color: string
  colors: string[]
}

const FONT = "'Outfit Variable','Outfit','Segoe UI',sans-serif"
const DEMO_COLORS = ['#7CD957', '#E8D27A', '#FF9ECF', '#A5E86A', '#2FBF4A', '#6E8B3D', '#8A3A2E', '#F0A030', '#D9692B', '#B5532A', '#3FE0C5', '#F4E4A0', '#4FD1C5', '#C0392B', '#F28C28', '#D8D4CF', '#E07B1E', '#DDEEFF', '#B9E2F5', '#7FC8FF', '#5DADE2', '#EAF6FF', '#9AA5AB', '#A0785A', '#7CC242', '#B57EDC', '#8F8A7C', '#0FA3A3', '#8B5A2B', '#A68CFF', '#D9774A', '#9E9E9E', '#66CCFF', '#C0213B', '#1FB5A8', '#5FD3E6', '#6E6E78', '#A8321E', '#FFC125', '#FF4500', '#CFCFB0', '#9FE7FF', '#F5F5F5', '#E8F4FF', '#FF5FD2', '#4DFFB8', '#C77DFF', '#8E44FF', '#FFE066', '#FFD700']

const mmss = (s: number) => {
  s = Math.max(0, Math.floor(s))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function useDemo(): Game {
  const [t, setT] = useState(0)
  useEffect(() => {
    const i = setInterval(() => setT((x) => x + 1), 1000)
    return () => clearInterval(i)
  }, [])
  const level = [23, 23, 24, 24, 14, 14, 15, 25][Math.floor(t / 3) % 8]!
  return { running: true, level, levels: 50, progress: (level - 1 + 0.4) / 50, levelProgress: (t % 3) / 3, falls: 7 + Math.floor(t / 9), time: 754 + t, limit: 0, ganadas: 2, perdidas: 1, shield: t % 12 < 4, protected: false, won: false, theme: level === 14 ? 'Isla de Champiñones' : level === 25 ? 'Cuevas Frondosas' : level === 24 ? 'Cueva de Estalactitas' : level === 15 ? 'Bosque de Calabazas' : 'Monte de Piedra', color: DEMO_COLORS[level - 1]!, colors: DEMO_COLORS }
}

export function ParkourOverlay() {
  const st = useLiveState<{ parkour?: { game: Game | null } }>('minigames')
  const demo = useDemo()
  const g: Game | null = DEMO ? demo : (st?.parkour?.game ?? null)
  useTick(1000)
  const prev = useRef<number | null>(null)
  const [jump, setJump] = useState<{ n: number; key: number } | null>(null)
  useEffect(() => {
    if (!g) return
    if (prev.current !== null && g.level !== prev.current) setJump({ n: g.level - prev.current, key: Date.now() })
    prev.current = g.level
  }, [g?.level])
  useEffect(() => {
    if (!jump) return
    const t = setTimeout(() => setJump(null), 2600)
    return () => clearTimeout(t)
  }, [jump])
  if (!g || !g.running) return <div />
  const colors = g.colors.length ? g.colors : DEMO_COLORS
  const n = colors.length
  const top = g.level > g.levels
  const tower = 560
  const seg = tower / n
  const markerY = tower - (Math.min(g.level, n) - 1 + (top ? 1 : g.levelProgress)) * seg
  return (
    <div style={{ fontFamily: FONT, color: '#fff', width: 332, userSelect: 'none', position: 'relative' }}>
      <style>{`
        @keyframes pk-pop { 0%{transform:scale(.3);opacity:0} 25%{transform:scale(1.15);opacity:1} 80%{transform:scale(1);opacity:1} 100%{transform:scale(.9) translateY(-30px);opacity:0} }
        @keyframes pk-glow { 0%,100%{box-shadow:0 0 10px var(--c),0 0 0 2px #fff} 50%{box-shadow:0 0 26px var(--c),0 0 0 2px #fff} }
        @keyframes pk-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
      `}</style>
      <div style={{ display: 'flex', gap: 14, padding: 14, borderRadius: 22, background: 'linear-gradient(160deg,#141826ee,#0b0d16f2)', border: `2px solid ${g.color}66`, boxShadow: `0 14px 40px #000a, 0 0 30px ${g.color}33` }}>
        {/* torre */}
        <div style={{ position: 'relative', width: 46, height: tower, flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column-reverse', gap: 1 }}>
            {colors.map((c, i) => {
              const lv = i + 1
              const done = lv < g.level
              const cur = lv === g.level
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    borderRadius: 3,
                    background: done || cur ? `linear-gradient(90deg, ${c}, ${c}cc)` : `${c}38`,
                    ['--c' as any]: c,
                    animation: cur ? 'pk-glow 1.4s ease-in-out infinite' : undefined,
                    position: 'relative',
                    zIndex: cur ? 2 : 1,
                  }}
                />
              )
            })}
          </div>
          {/* marcador */}
          <div style={{ position: 'absolute', left: -10, top: markerY - 9, width: 66, display: 'flex', alignItems: 'center', transition: 'top .8s cubic-bezier(.2,1.2,.3,1)', zIndex: 3 }}>
            <div style={{ width: 0, height: 0, borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderLeft: `10px solid #fff`, filter: 'drop-shadow(0 0 4px #000)' }} />
            <div style={{ flex: 1 }} />
            <div style={{ width: 0, height: 0, borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderRight: `10px solid #fff`, filter: 'drop-shadow(0 0 4px #000)' }} />
          </div>
          
        </div>
        {/* datos */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: tower }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 3, color: '#ffd45a' }}>TORRE PARKOUR</div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 6 }}>
            {top ? (
              <span style={{ fontSize: 46, fontWeight: 900, color: '#ffd700', textShadow: '0 0 20px #ffb800' }}>¡CIMA!</span>
            ) : (
              <>
                <span style={{ fontSize: 64, lineHeight: 1, fontWeight: 900, color: g.color, textShadow: `0 3px 0 #0008, 0 0 24px ${g.color}88`, fontVariantNumeric: 'tabular-nums' }}>{g.level}</span>
                <span style={{ fontSize: 22, fontWeight: 800, opacity: 0.55 }}>/ {g.levels}</span>
              </>
            )}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: g.color, lineHeight: 1.15, marginTop: 2 }}>{top ? 'Has llegado arriba' : g.theme}</div>
          <div style={{ marginTop: 10, height: 8, borderRadius: 99, background: '#ffffff18', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round((top ? 1 : g.levelProgress) * 100)}%`, background: `linear-gradient(90deg, ${g.color}, #fff)`, borderRadius: 99, transition: 'width .6s' }} />
          </div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4, fontWeight: 700 }}>
            Nivel {Math.round((top ? 1 : g.levelProgress) * 100)}% · Torre {Math.round(g.progress * 100)}%
          </div>
          <div style={{ flex: 1 }} />
          {(g.shield || g.protected) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {g.shield && <div style={{ padding: '6px 10px', borderRadius: 10, background: '#ff7be533', border: '1px solid #ff7be5', fontWeight: 800, fontSize: 13, animation: 'pk-float 1.6s ease-in-out infinite' }}>🛡 Escudo anticaída</div>}
              {g.protected && <div style={{ padding: '6px 10px', borderRadius: 10, background: '#34e0a133', border: '1px solid #34e0a1', fontWeight: 800, fontSize: 13 }}>✚ Protegido</div>}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Box label={g.limit > 0 ? 'QUEDA' : 'TIEMPO'} value={mmss(g.limit > 0 ? g.limit - g.time : g.time)} tone={g.limit > 0 && g.limit - g.time < 60 ? '#ff5a6a' : '#fff'} />
            <Box label="CAÍDAS" value={String(g.falls)} tone="#ffb4b4" />
            <Box label="GANADAS" value={String(g.ganadas)} tone="#7cff9e" />
            <Box label="PERDIDAS" value={String(g.perdidas)} tone="#ff7a7a" />
          </div>
        </div>
      </div>
      {jump && jump.n !== 0 && (
        <div
          key={jump.key}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 230,
            textAlign: 'center',
            fontSize: 72,
            fontWeight: 900,
            color: jump.n > 0 ? '#7cff9e' : '#ff5a6a',
            textShadow: `0 4px 0 #0009, 0 0 30px ${jump.n > 0 ? '#2bff7a' : '#ff1f3d'}`,
            animation: 'pk-pop 2.6s ease-out both',
            pointerEvents: 'none',
          }}
        >
          {jump.n > 0 ? `▲ +${jump.n}` : `▼ ${jump.n}`}
        </div>
      )}
    </div>
  )
}

function Box({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div style={{ padding: '7px 10px', borderRadius: 12, background: '#ffffff0d', border: '1px solid #ffffff14' }}>
      <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, opacity: 0.6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: tone, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}
