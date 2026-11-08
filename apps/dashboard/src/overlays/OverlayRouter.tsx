import { useEffect, useRef, useState } from 'react'
import type { ActionMessage, Profile } from '@livearena/shared'
import { useGifts } from '../lib/catalog'
import { useLiveState, useOnAction, useTick } from '../lib/live'
import { Avatar, Media } from '../components/ui'
import { CardGrid, useFired } from './Cards'
import { SceneView } from './Scene'
import { BestV2, CombinedOverlay, TtsOverlay, DuelOverlay, FeaturedOverlay, GiftGoalOverlay, GoalBar, LivesV2, MvpOverlay, NoticesOverlay, ResetSaveOverlay, ScoreV2, TimerV2, TopV2, TotemsOverlay } from './Pro'

/**
 * Overlays para "fuente de navegador" de OBS / TikTok LIVE Studio. Fondo transparente.
 * Parámetros comunes por URL: ?scale=1.2  ?align=left|center|right
 */
const params = new URLSearchParams(location.search)
const scale = Number(params.get('scale') ?? 1) || 1

export function OverlayRouter({ name }: { name: string }) {
  const el = (() => {
    switch (name) {
      case 'tarjetas':
        return <CardsOverlay />
      case 'avisos':
        return <AlertsOverlay />
      case 'top-donadores':
      case 'top-regalos':
        return <TopV2 kind="donors" />
      case 'top-likes':
        return <TopV2 kind="likers" />
      case 'meta-likes':
        return <GoalBar metric="likes" />
      case 'meta-monedas':
        return <GoalBar metric="coins" />
      case 'meta-combinada':
        return <GoalBar metric="combined" />
      case 'meta-seguidores':
        return <GoalBar metric="followers" />
      case 'marcador':
      case 'contador':
        return <ScoreV2 />
      case 'vidas':
        return <LivesV2 />
      case 'cronometro':
        return <TimerV2 />
      case 'mejor-regalo':
        return params.get('scope') === 'live' ? <BestV2 scope="live" /> : <BestV2 scope="ever" />
      case 'mejor-directo':
        return <BestV2 scope="live" />
      case 'mejor-racha':
        return <BestV2 scope="streak" />
      case 'logros':
        return <NoticesOverlay />
      case 'meta-regalo':
        return <GiftGoalOverlay />
      case 'duelo':
        return <DuelOverlay />
      case 'reset-salvar':
        return <ResetSaveOverlay />
      case 'destacados':
        return <FeaturedOverlay />
      case 'mvp-monedas':
        return <MvpOverlay kind="donors" />
      case 'mvp-likes':
        return <MvpOverlay kind="likers" />
      case 'totems':
        return <TotemsOverlay />
      case 'combinado':
        return <CombinedOverlay />
      case 'tts':
        return <TtsOverlay />
      case 'escena':
        return <SceneView id={params.get('s') ?? undefined} />
      case 'legacy-top':
        return <TopOverlay kind="donors" />
      case 'legacy-meta':
        return <LikeGoalOverlay />
      case 'legacy-marcador':
        return <ScoreOverlay />
      case 'legacy-vidas':
        return <LivesOverlay />
      case 'legacy-cronometro':
        return <TimerOverlay />
      case 'legacy-mejor':
        return <BestGiftOverlay />
      default:
        return <div style={{ color: '#fff', font: '20px sans-serif' }}>Overlay desconocido: {name}</div>
    }
  })()
  return <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: `${100 / scale}%`, padding: Number(params.get('pad') ?? 14), boxSizing: 'border-box' }}>{el}</div>
}

function useSounds(): void {
  useOnAction((a) => {
    if (a.kind !== 'sound' || params.get('sound') === '0') return
    const file = String(a.params.file ?? '')
    if (!file) return
    const audio = new Audio(file)
    audio.volume = Math.max(0, Math.min(1, Number(a.params.volume ?? 1)))
    void audio.play().catch(() => undefined)
  })
}

function CardsOverlay() {
  const profile = useLiveState<Profile>('profile')
  const gifts = useGifts()
  const [fired, fire] = useFired()
  useSounds()
  useOnAction((a) => a.kind === 'overlay.card' && a.actionId && fire(a.actionId))
  if (!profile) return null
  return (
    <div style={{ padding: profile.overlay ? 4 : 0 }}>
      <CardGrid profile={profile} gifts={gifts} fired={fired} />
    </div>
  )
}

interface Alert {
  key: number
  a: ActionMessage
  leaving?: boolean
  bump?: number
}

/**
 * Avisos: foto + nombre del espectador + lo que provocó. Cola legible (uno cada ~1,2 s, primero lo más valioso).
 * Las partes de una misma racha (mismo espectador y acción) se juntan en un solo aviso con ×N.
 */
function AlertsOverlay() {
  const [shown, setShown] = useState<Alert[]>([])
  const shownRef = useRef<Alert[]>([])
  const timers = useRef(new Map<number, number[]>())
  const queue = useRef<ActionMessage[]>([])
  const seq = useRef(0)
  const max = Number(params.get('max') ?? 4)
  useSounds()

  const update = (fn: (s: Alert[]) => Alert[]) => {
    shownRef.current = fn(shownRef.current)
    setShown(shownRef.current)
  }
  const schedule = (key: number, a: ActionMessage) => {
    for (const t of timers.current.get(key) ?? []) clearTimeout(t)
    const dur = Number(a.params.durationMs ?? 0) || 2500 + a.intensity * 4000
    timers.current.set(key, [
      window.setTimeout(() => update((s) => s.map((x) => (x.key === key ? { ...x, leaving: true } : x))), dur),
      window.setTimeout(() => {
        update((s) => s.filter((x) => x.key !== key))
        timers.current.delete(key)
      }, dur + 450),
    ])
  }
  const same = (x: ActionMessage, y: ActionMessage) => x.kind === y.kind && x.actionId === y.actionId && (x.user?.id ?? '') === (y.user?.id ?? '')
  const addCount = (target: ActionMessage, a: ActionMessage) => ({ ...target, params: { ...target.params, count: Number(target.params.count ?? 1) + Number(a.params.count ?? 1) } })

  useOnAction((a) => {
    if (a.kind !== 'overlay.card' && a.kind !== 'overlay.alert') return
    const live = shownRef.current.find((x) => !x.leaving && same(x.a, a))
    if (live) {
      const merged = addCount(live.a, a)
      update((s) => s.map((x) => (x.key === live.key ? { ...x, a: merged, bump: Date.now() } : x)))
      schedule(live.key, merged)
      return
    }
    const qi = queue.current.findIndex((x) => same(x, a))
    if (qi >= 0) queue.current[qi] = addCount(queue.current[qi]!, a)
    else queue.current.push(a)
    if (queue.current.length > 50) queue.current.sort((x, y) => y.priority - x.priority).splice(50)
  })
  useEffect(() => {
    if (params.get('demo') === '1')
      queue.current.push({ kind: 'overlay.card', params: { count: 5 }, user: { id: 'demo', uniqueId: 'demo', nickname: 'Espectador' }, actionName: 'CREEPER', color: '#16a34a', gift: { name: 'Rose', diamonds: 1, count: 5 }, intensity: 0.4, priority: 1 } as ActionMessage)
    const i = setInterval(() => {
      const next = queue.current.sort((x, y) => y.priority - x.priority).shift()
      if (!next) return
      const key = ++seq.current
      update((s) => [...s.slice(-(max - 1)), { key, a: next }])
      schedule(key, next)
    }, 1200)
    return () => clearInterval(i)
  }, [max])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10, alignItems: params.get('align') === 'right' ? 'flex-end' : 'flex-start' }}>
      {shown.map(({ key, a, leaving, bump }) => {
        const big = a.intensity > 0.6
        const count = Number(a.params.count ?? 1)
        return (
          <div
            key={`${key}-${bump ?? 0}`}
            className={`${leaving ? 'fx-out' : bump ? 'fx-pulse' : 'fx-in'} ${big && !leaving && !bump ? 'fx-shake' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 16px 10px 10px',
              borderRadius: 16,
              minWidth: 320,
              background: `linear-gradient(100deg, ${a.color ?? '#ff6a3d'}dd, #0b0d12ee 70%)`,
              border: `2px solid ${a.color ?? '#ff6a3d'}`,
              boxShadow: `0 0 ${big ? 40 : 16}px ${a.color ?? '#ff6a3d'}88`,
              color: '#fff',
              fontFamily: "'Nunito','Segoe UI',sans-serif",
              transform: big ? 'scale(1.1)' : undefined,
              transformOrigin: 'left center',
            }}
          >
            <Avatar url={a.user?.avatarUrl} name={a.user?.nickname ?? '?'} size={big ? 64 : 52} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: big ? 22 : 18, textShadow: '0 2px 4px #000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
                {a.user?.nickname ?? 'Alguien'}
              </div>
              <div style={{ fontSize: 15, opacity: 0.95, display: 'flex', alignItems: 'center', gap: 6 }}>
                {a.gift ? (
                  <>
                    envió {a.gift.imageUrl && <img src={a.gift.imageUrl} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />} <b>{a.gift.name}</b>
                    {count > 1 ? <b style={{ color: '#ffd84d' }}> ×{count}</b> : ''}
                  </>
                ) : (
                  <span>{String(a.params.text ?? (a.params.trigger === 'likes' || a.params.trigger === 'room_likes' ? 'dio likes' : a.params.trigger === 'follow' ? 'te sigue' : a.params.trigger === 'share' ? 'compartió' : 'activó'))}{count > 1 ? ` ×${count}` : ''}</span>
                )}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
              {a.media ? <Media media={a.media} className="h-14 w-24 rounded-lg object-cover" /> : null}
              <div style={{ fontWeight: 900, fontSize: big ? 22 : 17, color: '#fff', textShadow: `0 0 10px ${a.color}` }}>{a.actionName}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const box = { color: '#fff', fontFamily: "'Nunito','Segoe UI',sans-serif", textShadow: '0 2px 6px #000' } as const

function TopOverlay({ kind }: { kind: 'donors' | 'likers' }) {
  const lb = useLiveState<any>('leaderboard')
  const n = Number(params.get('n') ?? 5)
  const rows = (lb?.[kind] ?? []).slice(0, n)
  return (
    <div style={{ ...box, padding: 12, width: 340 }}>
      <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 8, letterSpacing: 1 }}>{params.get('title') ?? (kind === 'donors' ? 'TOP DONADORES' : 'TOP LIKES')}</div>
      {rows.map((r: any, i: number) => (
        <div key={r.userId} className="fx-in" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', marginBottom: 6, borderRadius: 12, background: i === 0 ? 'linear-gradient(90deg,#f5b301cc,#0008)' : 'linear-gradient(90deg,#ffffff22,#0006)' }}>
          <b style={{ width: 22, fontSize: 18 }}>{i + 1}</b>
          <Avatar url={r.avatarUrl} name={r.nickname} size={36} />
          <span style={{ flex: 1, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nickname}</span>
          <b>{kind === 'donors' ? `🪙 ${r.diamonds.toLocaleString()}` : `❤ ${r.likes.toLocaleString()}`}</b>
        </div>
      ))}
    </div>
  )
}

function LikeGoalOverlay() {
  const l = useLiveState<any>('likes')
  const likes = l?.roomLikes ?? 0
  const goal = Math.max(1, Number(params.get('goal') ?? l?.goal ?? 10000))
  const pct = Math.min(100, (likes / goal) * 100)
  return (
    <div style={{ ...box, padding: 12, width: 520 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 18, marginBottom: 6 }}>
        <span>❤ {l?.label ?? 'Meta de likes'}</span>
        <span>
          {likes.toLocaleString()} / {goal.toLocaleString()}
        </span>
      </div>
      <div style={{ height: 26, borderRadius: 14, background: '#000a', border: '2px solid #fff4', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#ff2d6f,#ff8a5c)', boxShadow: '0 0 20px #ff2d6f', transition: 'width .4s ease' }} />
      </div>
    </div>
  )
}

function ScoreOverlay() {
  const s = useLiveState<any>('scoreboard')
  return (
    <div style={{ ...box, display: 'flex', gap: 16, padding: 12, fontWeight: 900, fontSize: 44 }}>
      <span style={{ color: '#4ade80' }}>W {s?.wins ?? 0}</span>
      <span style={{ opacity: 0.6 }}>|</span>
      <span style={{ color: '#f87171' }}>L {s?.losses ?? 0}</span>
    </div>
  )
}

function LivesOverlay() {
  const s = useLiveState<any>('scoreboard')
  const lives = s?.lives ?? 0
  const start = Math.max(lives, s?.livesStart ?? 3)
  return (
    <div style={{ ...box, display: 'flex', gap: 6, padding: 12, fontSize: 48 }}>
      {Array.from({ length: Math.min(start, 20) }, (_, i) => (
        <span key={i} style={{ filter: i < lives ? 'drop-shadow(0 0 8px #f00)' : 'grayscale(1) opacity(.35)' }}>
          ❤️
        </span>
      ))}
      {start > 20 && <b style={{ fontSize: 40 }}>×{lives}</b>}
    </div>
  )
}

function TimerOverlay() {
  const s = useLiveState<any>('scoreboard')
  useTick(250)
  const t = s?.timer
  const ms = t ? t.accumulatedMs + (t.running ? Date.now() - t.startedAt : 0) : 0
  const sec = Math.floor(ms / 1000)
  const hh = Math.floor(sec / 3600)
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  return <div style={{ ...box, padding: 12, fontWeight: 900, fontSize: 56, fontVariantNumeric: 'tabular-nums' }}>{hh ? `${hh}:` : ''}{mm}:{ss}</div>
}

function BestGiftOverlay() {
  const lb = useLiveState<any>('leaderboard')
  const b = params.get('scope') === 'ever' ? lb?.summary?.bestEver : lb?.summary?.bestLive
  if (!b) return null
  return (
    <div className="fx-in" style={{ ...box, display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, background: 'linear-gradient(100deg,#7c3aedcc,#000a)', width: 380 }}>
      <Avatar url={b.user.avatarUrl} name={b.user.nickname} size={56} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, opacity: 0.8 }}>{params.get('scope') === 'ever' ? 'MEJOR REGALO DE LA HISTORIA' : 'MEJOR REGALO DEL DIRECTO'}</div>
        <div style={{ fontWeight: 900, fontSize: 20, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.user.nickname}</div>
        <div style={{ fontSize: 15 }}>
          {b.gift} ×{b.count} · 🪙 {b.value.toLocaleString()}
        </div>
      </div>
      {b.imageUrl && <img src={b.imageUrl} alt="" style={{ width: 56, height: 56, objectFit: 'contain' }} />}
    </div>
  )
}
