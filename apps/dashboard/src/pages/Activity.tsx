import { askConfirm } from '../components/Dialog'
import { useEffect, useRef, useState } from 'react'
import type { LiveEvent, LogLine } from '@livearena/shared'
import { useApp } from '../App'
import { api } from '../lib/api'
import { useLiveState, useOnEvent, useOnLog } from '../lib/live'
import { Avatar, PageHeader, Seg } from '../components/ui'

interface Item {
  id: string
  ts: number
  type: string
  user?: { nickname: string; uniqueId: string; avatarUrl?: string }
  text: string
  simulated?: boolean
  fired?: string[]
}

const describe = (ev: LiveEvent): string => {
  switch (ev.type) {
    case 'gift':
      return `${ev.payload.name} ×${ev.payload.count}${ev.payload.streakTotal > ev.payload.count ? ` (racha ${ev.payload.streakTotal})` : ''} · 🪙${ev.payload.diamonds * ev.payload.count}`
    case 'like':
      return `${ev.payload.count} likes`
    case 'chat':
      return ev.payload.text
    case 'follow':
      return 'te sigue'
    case 'share':
      return 'compartió el live'
    case 'subscribe':
      return 'se suscribió'
    case 'member_join':
      return 'entró al live'
    default:
      return ev.type
  }
}

const ICON: Record<string, string> = { gift: '🎁', like: '❤️', chat: '💬', follow: '➕', share: '🔁', subscribe: '⭐', member_join: '👋', custom: '▶' }

export function ActivityPage() {
  const { state } = useApp()
  const stats = useLiveState<any>('leaderboard')
  const likes = useLiveState<any>('likes')
  const [items, setItems] = useState<Item[]>(() => [...(state?.activity ?? [])].reverse())
  const [logs, setLogs] = useState<LogLine[]>(() => [...(state?.logs ?? [])].filter((l) => l.scope !== 'consola').reverse())
  const [view, setView] = useState<'eventos' | 'logs'>('eventos')
  const [filter, setFilter] = useState<'todo' | 'gift' | 'chat'>('todo')
  const hideJoins = useRef(true)

  useEffect(() => {
    api<Item[]>('GET', '/api/activity').then((a) => setItems([...a].reverse())).catch(() => undefined)
  }, [])
  useOnEvent((ev) => {
    if (ev.type === 'member_join' && hideJoins.current) return
    setItems((x) => [{ id: ev.id, ts: ev.ts, type: ev.type, user: ev.user ?? undefined, text: describe(ev), simulated: ev.simulated }, ...x].slice(0, 300))
  })
  useOnLog((l) => {
    if (l.scope !== 'consola') setLogs((x) => [l, ...x].slice(0, 300))
  })

  const shown = items.filter((i) => filter === 'todo' || i.type === filter)
  const s = stats?.summary

  return (
    <div className="pb-10">
      <PageHeader title="Actividad" subtitle="Todo lo que pasa en tu live, en tiempo real." />
      <div className="mb-4 grid grid-cols-2 gap-3 px-8 md:grid-cols-4">
        <Stat label="Monedas" value={s?.diamonds ?? 0} />
        <Stat label="Regalos" value={s?.gifts ?? 0} />
        <Stat label="Likes" value={likes?.roomLikes ?? 0} />
        <Stat label="Mejor regalo" value={s?.bestLive ? `${s.bestLive.gift} ×${s.bestLive.count}` : '—'} />
      </div>
      <div className="grid gap-4 px-8 xl:grid-cols-[1fr_340px]">
        <div className="card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="w-64">
              <Seg value={view} onChange={setView} options={[{ v: 'eventos', l: 'Eventos' }, { v: 'logs', l: 'Registro' }]} />
            </div>
            {view === 'eventos' && (
              <div className="w-72">
                <Seg value={filter} onChange={setFilter} options={[{ v: 'todo', l: 'Todo' }, { v: 'gift', l: 'Regalos' }, { v: 'chat', l: 'Chat' }]} />
              </div>
            )}
          </div>
          <div className="max-h-[65vh] space-y-1 overflow-y-auto">
            {view === 'eventos'
              ? shown.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5">
                    <span className="w-6 text-center">{ICON[i.type] ?? '•'}</span>
                    <Avatar url={i.user?.avatarUrl} name={i.user?.nickname ?? '?'} size={28} />
                    <span className="w-40 truncate font-semibold">{i.user?.nickname ?? '—'}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-white/80">{i.text}</span>
                    {i.fired && i.fired.length > 0 && <span className="truncate text-xs text-accent">→ {i.fired.join(', ')}</span>}
                    {i.simulated && <span className="rounded bg-white/10 px-1.5 text-[10px] text-muted">simulado</span>}
                    <span className="text-xs text-muted">{new Date(i.ts).toLocaleTimeString()}</span>
                  </div>
                ))
              : logs.map((l, k) => (
                  <div key={k} className={`flex gap-3 px-2 py-1 font-mono text-xs ${l.level === 'error' ? 'text-bad' : l.level === 'warn' ? 'text-warn' : 'text-white/80'}`}>
                    <span className="text-muted">{new Date(l.ts).toLocaleTimeString()}</span>
                    <span className="w-20 shrink-0 text-muted">[{l.scope}]</span>
                    <span className="break-all">{l.msg}</span>
                  </div>
                ))}
            {view === 'eventos' && shown.length === 0 && <div className="p-10 text-center text-sm text-muted">No hay actividad todavía. Conecta tu live o usa el Simulador.</div>}
          </div>
        </div>
        <div className="space-y-4">
          <Ranking title="Top donadores" rows={(stats?.donors ?? []).map((d: any) => ({ ...d, value: `🪙 ${d.diamonds}` }))} />
          <Ranking title="Top likes" rows={(stats?.likers ?? []).map((d: any) => ({ ...d, value: `❤ ${d.likes}` }))} />
          <button className="btn w-full justify-center" onClick={async () => (await askConfirm('¿Empezar una sesión nueva? Se reinician ranking y contadores del live.')) && api('POST', '/api/session/new')}>
            Nueva sesión de estadísticas
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="truncate text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  )
}

function Ranking({ title, rows }: { title: string; rows: { userId: string; nickname: string; avatarUrl?: string; value: string }[] }) {
  return (
    <div className="card p-4">
      <span className="label">{title}</span>
      {rows.length === 0 && <div className="text-sm text-muted">—</div>}
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={r.userId} className="flex items-center gap-2 text-sm">
            <span className="w-5 text-center font-bold text-muted">{i + 1}</span>
            <Avatar url={r.avatarUrl} name={r.nickname} size={26} />
            <span className="flex-1 truncate">{r.nickname}</span>
            <span className="font-semibold">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
