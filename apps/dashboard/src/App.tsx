import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Activity, Boxes, FlaskConical, ListChecks, MonitorPlay, Server, Settings, Loader2, Radio, Power, Gamepad2 } from 'lucide-react'
import type { Profile, SourceStatus } from '@livearena/shared'
import { api } from './lib/api'
import { useLiveConnected, useLiveState } from './lib/live'
import { PluginsPage } from './pages/Plugins'
import { OverlaysPage } from './pages/Overlays'
import { KitPage } from './pages/Kit'
import { SimulatorPage } from './pages/Simulator'
import { ServerPage } from './pages/Server'
import { ActivityPage } from './pages/Activity'
import { SettingsPage } from './pages/Settings'
import { Toasts, toast } from './components/Toast'

export interface AppState {
  config: any
  profile: Profile
  profiles: { id: string; name: string; mode: string; actions: number; events: number }[]
  paused: boolean
  queue: any
  stats: any
  activity: any[]
  logs: any[]
}

interface Ctx {
  state: AppState | null
  reload: () => Promise<void>
  profile: Profile | null
  go: (page: string) => void
}
const AppCtx = createContext<Ctx>(null as unknown as Ctx)
export const useApp = () => useContext(AppCtx)

const PAGES: { id: string; label: string; icon: ReactNode; el: () => ReactNode }[] = [
  { id: 'plugins', label: 'Plugins', icon: <ListChecks size={18} />, el: () => <PluginsPage /> },
  { id: 'overlays', label: 'Overlays', icon: <MonitorPlay size={18} />, el: () => <OverlaysPage /> },
  { id: 'kit', label: 'Kit inicial', icon: <Boxes size={18} />, el: () => <KitPage /> },
  { id: 'simulador', label: 'Simulador', icon: <FlaskConical size={18} />, el: () => <SimulatorPage /> },
  { id: 'servidor', label: 'Servidor', icon: <Server size={18} />, el: () => <ServerPage /> },
  { id: 'actividad', label: 'Actividad', icon: <Activity size={18} />, el: () => <ActivityPage /> },
  { id: 'ajustes', label: 'Ajustes', icon: <Settings size={18} />, el: () => <SettingsPage /> },
]

export function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [page, setPage] = useState(() => location.hash.replace('#/', '') || 'plugins')
  const liveProfile = useLiveState<Profile>('profile')

  const reload = useCallback(async () => {
    try {
      setState(await api<AppState>('GET', '/api/state'))
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }, [])

  useEffect(() => {
    void reload()
    const onHash = () => setPage(location.hash.replace('#/', '') || 'plugins')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [reload])

  const go = (p: string) => (location.hash = `#/${p}`)
  const profile = liveProfile ?? state?.profile ?? null
  const current = PAGES.find((p) => p.id === page) ?? PAGES[0]!

  return (
    <AppCtx.Provider value={{ state, reload, profile, go }}>
      <div className="flex h-full">
        <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-panel/60">
          <div className="flex items-center gap-2.5 px-5 py-5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white shadow-[0_0_24px_-4px_var(--color-accent)]">
              <Gamepad2 size={20} />
            </div>
            <div>
              <div className="font-bold leading-tight">LiveArena</div>
              <div className="text-xs text-muted">Consola de show</div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-3">
            {PAGES.map((p) => (
              <button
                key={p.id}
                onClick={() => go(p.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  p.id === current.id ? 'bg-accent/10 text-white ring-1 ring-accent/50' : 'text-muted hover:bg-white/5 hover:text-white'
                }`}
              >
                {p.icon}
                <span className="flex-1 text-left">{p.label}</span>
                {p.id === 'plugins' && profile && <span className="rounded-md bg-white/10 px-1.5 text-xs">{profile.events.length}</span>}
              </button>
            ))}
          </nav>
          <ServerBox />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <div className="min-h-0 flex-1 overflow-y-auto">{state ? current.el() : <Loading />}</div>
        </main>
      </div>
      <Toasts />
    </AppCtx.Provider>
  )
}

function Loading() {
  return (
    <div className="grid h-full place-items-center text-muted">
      <Loader2 className="animate-spin" />
    </div>
  )
}

const SOURCE_TEXT: Record<string, string> = { idle: 'sin live', connecting: 'conectando…', live: 'en vivo', offline: 'offline', backoff: 'reintentando', error: 'error' }

function TopBar() {
  const { state, reload } = useApp()
  const source = useLiveState<SourceStatus>('source')
  const mc = useLiveState<any>('minecraft')
  const wsOk = useLiveConnected()
  const [user, setUser] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => setUser(state?.config?.tiktok?.username ?? ''), [state?.config?.tiktok?.username])
  const st = source?.state ?? 'idle'
  const active = st === 'live' || st === 'connecting' || st === 'backoff' || st === 'offline'

  const toggle = async () => {
    setBusy(true)
    try {
      if (active) await api('POST', '/api/tiktok/disconnect')
      else {
        if (!user.trim()) throw new Error('Escribe tu usuario de TikTok')
        await api('POST', '/api/tiktok/connect', { username: user })
      }
      await reload()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <header className="flex items-center gap-3 border-b border-line px-6 py-3">
      <div className="mr-auto flex items-center gap-2 text-xs text-muted">
        <span className={`h-2 w-2 rounded-full ${wsOk ? 'bg-ok' : 'bg-bad'}`} /> {wsOk ? 'app conectada' : 'reconectando con la app…'}
        {source?.viewers !== undefined && st === 'live' && <span className="ml-3">👁 {source.viewers}</span>}
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm">
        <span className="text-muted">Nick</span>
        <span className="font-semibold">{mc?.player || <span className="text-warn">sin configurar</span>}</span>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1 text-sm">
        <span className="text-muted">TikTok</span>
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !active && toggle()}
          placeholder="@usuario"
          disabled={active}
          className="w-36 bg-transparent font-semibold outline-none"
        />
      </div>
      <div className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs" title={source?.message}>
        <Radio size={12} className={st === 'live' ? 'text-ok' : st === 'error' ? 'text-bad' : 'text-muted'} />
        {SOURCE_TEXT[st]}
      </div>
      <button className={active ? 'btn' : 'btn-accent'} onClick={toggle} disabled={busy}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : null}
        {active ? 'Desconectar' : 'Conectar live'}
      </button>
    </header>
  )
}

const LINK_TEXT: Record<string, string> = { disconnected: 'desvinculado', connecting: 'conectando…', connected: 'vinculado', backoff: 'reintentando', error: 'error' }

function ServerBox() {
  const mc = useLiveState<any>('minecraft')
  const { go } = useApp()
  const link = mc?.link?.state ?? 'disconnected'
  const proc = mc?.server?.state ?? 'stopped'
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }
  const canStart = !!mc?.server?.folder && proc !== 'running' && proc !== 'starting'
  return (
    <div className="m-3 rounded-xl border border-line bg-panel p-3">
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold tracking-widest text-muted">
        MINECRAFT
        <span className="flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 font-normal tracking-normal" title={mc?.link?.message}>
          <span className={`h-1.5 w-1.5 rounded-full ${link === 'connected' ? 'bg-ok' : link === 'error' ? 'bg-bad' : 'bg-muted'}`} />
          {LINK_TEXT[link]}
        </span>
      </div>
      {mc?.server?.folder && (
        <div className="mb-2 text-xs text-muted">
          Servidor: <b className={proc === 'running' ? 'text-ok' : proc === 'crashed' ? 'text-bad' : ''}>{{ stopped: 'apagado', starting: 'arrancando…', running: 'encendido', stopping: 'apagando…', crashed: 'se cayó' }[proc as string]}</b>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {canStart ? (
          <button className="btn-accent justify-center" disabled={busy} onClick={() => run(() => api('POST', '/api/minecraft/server/start'))}>
            <Power size={14} /> Encender
          </button>
        ) : (
          <button
            className="btn-accent justify-center"
            disabled={busy || link === 'connected'}
            onClick={() => run(() => api('POST', '/api/minecraft/connect'))}
          >
            Activar
          </button>
        )}
        <button
          className="btn justify-center"
          disabled={busy}
          onClick={() => run(() => (proc === 'running' || proc === 'starting' ? api('POST', '/api/minecraft/server/stop') : api('POST', '/api/minecraft/disconnect')))}
        >
          {proc === 'running' || proc === 'starting' ? 'Apagar' : 'Desactivar'}
        </button>
      </div>
      <button className="mt-2 flex items-center gap-1.5 text-xs text-muted hover:text-white" onClick={() => go('servidor')}>
        <Settings size={12} /> Ajustes del servidor
      </button>
    </div>
  )
}
