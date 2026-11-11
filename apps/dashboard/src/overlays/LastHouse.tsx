import { useEffect, useState } from 'react'
import { useLiveState } from '../lib/live'
import { DEMO } from './Pro'

/**
 * Overlays de LAST HOUSE para el directo:
 *  - «lasthouse»: marcador (modo, tiempo, asaltos o vida de la casa, mejores espectadores y la votación abierta).
 *  - «lasthouse-regalos»: qué hace cada cosa del directo en el modo que se está jugando.
 * La página del juego manda el estado al servidor (≈2 veces por segundo) y aquí se dibuja.
 */
export interface LastHouseLive {
  mode: 'invasion' | 'defensa'
  phase: 'intro' | 'playing' | 'ended'
  winner: 'rey' | 'guardianes' | 'horda' | 'guardian' | null
  time: number
  assaults: number
  need: number
  house: number
  wave: number
  kills: number
  viewers: number
  top: { name: string; score: number }[]
  vote: { a: string; b: string; ca: number; cb: number; left: number } | null
}

const FONT = "'Outfit Variable','Outfit','Segoe UI',sans-serif"
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function useDemo(): LastHouseLive {
  const [t, setT] = useState(0)
  useEffect(() => {
    const i = setInterval(() => setT((x) => x + 1), 1000)
    return () => clearInterval(i)
  }, [])
  const def = Math.floor(t / 20) % 2 === 1
  return {
    mode: def ? 'defensa' : 'invasion',
    phase: 'playing',
    winner: null,
    time: 300 - (t % 300),
    assaults: Math.min(4, Math.floor(t / 7) % 5),
    need: 5,
    house: 0.8 - (t % 20) * 0.02,
    wave: 3 + Math.floor(t / 10),
    kills: 40 + t * 3,
    viewers: 87,
    top: [
      { name: 'Sofi', score: 42 + t },
      { name: 'Tomás', score: 31 },
      { name: 'Rocío', score: 18 },
    ],
    vote: t % 20 < 12 ? { a: def ? 'Estampida de corredores' : 'Muro de enredadera', b: def ? 'Túnel de excavadores' : 'Bombardeo de calabazas', ca: 12 + t % 9, cb: 9 + (t % 7) * 2, left: 12 - (t % 20) } : null,
  }
}

const panel: React.CSSProperties = { background: 'linear-gradient(160deg,#141826ee,#0b0d16f2)', border: '2px solid #ffffff22', borderRadius: 18, boxShadow: '0 12px 30px #0009', color: '#fff', fontFamily: FONT }

export function LastHouseOverlay() {
  const live = useLiveState<LastHouseLive>('lasthouse')
  const demo = useDemo()
  const g = DEMO ? demo : live
  if (!g || g.phase === 'intro') return null
  const inv = g.mode === 'invasion'
  const accent = inv ? '#c084fc' : '#7cff9e'
  const total = g.vote ? Math.max(1, g.vote.ca + g.vote.cb) : 1
  return (
    <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...panel, padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 3, color: accent }}>LAST HOUSE</div>
            <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{inv ? 'INVASIÓN' : 'DEFENSA'}</div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: g.time < 30 ? '#ff6b6b' : '#fff' }}>{mmss(g.time)}</div>
        </div>
        {inv ? (
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {Array.from({ length: g.need }, (_, i) => (
              <div key={i} style={{ flex: 1, height: 14, borderRadius: 6, background: i < g.assaults ? 'linear-gradient(180deg,#ffe066,#f59e0b)' : '#ffffff18', border: '2px solid #ffffff2a' }} />
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, opacity: 0.8 }}>
              <span>🏠 Casa</span>
              <span>Oleada {g.wave} · {g.kills} caídos</span>
            </div>
            <div style={{ height: 14, borderRadius: 99, background: '#0007', overflow: 'hidden', marginTop: 4 }}>
              <div style={{ height: '100%', width: `${g.house * 100}%`, background: g.house > 0.5 ? 'linear-gradient(90deg,#34e0a1,#a3e635)' : g.house > 0.25 ? 'linear-gradient(90deg,#f59e0b,#fde047)' : 'linear-gradient(90deg,#ef4444,#fb7185)', transition: 'width .4s' }} />
            </div>
          </div>
        )}
        {g.phase === 'ended' && (
          <div style={{ marginTop: 10, fontSize: 20, fontWeight: 900, textAlign: 'center', color: g.winner === 'rey' || g.winner === 'guardian' ? '#ffe066' : accent }}>
            {g.winner === 'rey' ? '¡La horda entra!' : g.winner === 'guardianes' ? '¡Los guardianes ganan!' : g.winner === 'guardian' ? '¡La casa resiste!' : '¡La horda gana!'}
          </div>
        )}
      </div>
      {g.top.length > 0 && (
        <div style={{ ...panel, padding: '10px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: accent }}>{inv ? 'MEJORES GUARDIANES' : 'MEJORES DE LA HORDA'}</div>
          {g.top.slice(0, 3).map((p, i) => (
            <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, marginTop: 4 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 230 }}>
                {['🥇', '🥈', '🥉'][i]} {p.name}
              </span>
              <span style={{ opacity: 0.85 }}>{p.score}</span>
            </div>
          ))}
        </div>
      )}
      {g.vote && (
        <div style={{ ...panel, padding: '10px 16px', borderColor: '#ffe06655' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 900, letterSpacing: 2, color: '#ffe066' }}>
            <span>VOTA EN EL CHAT</span>
            <span>{Math.ceil(g.vote.left)} s</span>
          </div>
          {([
            ['1', g.vote.a, g.vote.ca],
            ['2', g.vote.b, g.vote.cb],
          ] as const).map(([k, name, c]) => (
            <div key={k} style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800 }}>
                <span>
                  <b style={{ color: '#ffe066' }}>{k}</b> · {name}
                </span>
                <span>{c}</span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: '#0007', overflow: 'hidden', marginTop: 3 }}>
                <div style={{ height: '100%', width: `${(c / total) * 100}%`, background: 'linear-gradient(90deg,#ffe066,#f59e0b)', transition: 'width .4s' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Qué hace cada cosa del directo (para enseñar en pantalla). */
export const LEGEND: Record<'invasion' | 'defensa', [string, string][]> = {
  invasion: [
    ['❤️ Likes', 'Defensas del jardín (entre todos)'],
    ['💬 Comentario', 'Brote · «lanza», «hielo», «raíz», «tronco», «hongo»'],
    ['➕ Follow', 'Flor Glacial'],
    ['🔁 Compartir', 'Raíz Sanadora'],
    ['🎁 1–4 monedas', 'Lanzabrotes'],
    ['🎁 5+', 'Tronco Muralla'],
    ['🎁 20+', '3 Hongos Bomba'],
    ['🎁 99+', 'Batería de Lanzabrotes'],
    ['🎁 199+', 'Esporas del mareo'],
    ['🎁 299+', 'Muro de enredadera'],
    ['🎁 499+', 'Tormenta de semillas'],
    ['🎁 1000+', 'Guardián Ancestral + Calabazas'],
  ],
  defensa: [
    ['❤️ Likes', 'Caminantes (entre todos)'],
    ['💬 Comentario', 'Caminante · «corre», «tanque»'],
    ['➕ Follow', 'Excavador'],
    ['🔁 Compartir', '3 Corredores'],
    ['🎁 1–4 monedas', 'Caminantes'],
    ['🎁 5+', 'Blindado'],
    ['🎁 20+', '5 Corredores'],
    ['🎁 99+', 'Túnel de excavadores'],
    ['🎁 199+', 'Coloso'],
    ['🎁 299+', 'Estampida'],
    ['🎁 499+', 'Asedio de colosos'],
    ['🎁 1000+', 'TITÁN + Noche de tormenta'],
  ],
}

export function LastHouseLegendOverlay() {
  const live = useLiveState<LastHouseLive>('lasthouse')
  const demo = useDemo()
  const mode = (DEMO ? demo : live)?.mode ?? 'invasion'
  const accent = mode === 'invasion' ? '#c084fc' : '#7cff9e'
  return (
    <div style={{ ...panel, width: 360, padding: '12px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 3, color: accent }}>LAST HOUSE · {mode === 'invasion' ? 'AYUDA A LOS GUARDIANES' : 'MANDA LA HORDA'}</div>
      {LEGEND[mode].map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, fontWeight: 700, marginTop: 4 }}>
          <span style={{ whiteSpace: 'nowrap' }}>{k}</span>
          <span style={{ opacity: 0.85, textAlign: 'right' }}>{v}</span>
        </div>
      ))}
    </div>
  )
}
