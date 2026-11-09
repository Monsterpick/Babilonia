import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Activity, Boxes, FlaskConical, ListChecks, Mic, MonitorPlay, Server, Settings, Loader2, Radio, Power, Zap, Pickaxe, Wand2, Clapperboard } from 'lucide-react'
import type { Profile, SourceStatus } from '@livearena/shared'
import { api } from './lib/api'
import { useLiveConnected, useLiveState } from './lib/live'
import { PluginsPage } from './pages/Plugins'
import { OverlaysPage } from './pages/Overlays'
import { KitPage } from './pages/Kit'
import { SimulatorPage } from './pages/Simulator'
import { ServerPage } from './pages/Server'
import { TtsPage } from './pages/Tts'
import { StudioPage } from './pages/Studio'
import { CinematicsPage } from './pages/Cinematics'
import { ActivityPage } from './pages/Activity'
import { SettingsPage } from './pages/Settings'
import { Dialogs } from './components/Dialog'
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
  { id: 'plugins', label: 'Plugins', icon: <ListChecks size={20} />, el: () => <PluginsPage /> },
  { id: 'overlays', label: 'Overlays', icon: <MonitorPlay size={20} />, el: () => <OverlaysPage /> },
  { id: 'cinematicas', label: 'Cinemáticas', icon: <Clapperboard size={20} />, el: () => <CinematicsPage /> },
  { id: 'tts', label: 'TTS', icon: <Mic size={20} />, el: () => <TtsPage /> },
  { id: 'estudio', label: 'Estudio', icon: <Wand2 size={20} />, el: () => <StudioPage /> },
  { id: 'kit', label: 'Kit', icon: <Boxes size={20} />, el: () => <KitPage /> },
  { id: 'simulador', label: 'Simulador', icon: <FlaskConical size={20} />, el: () => <SimulatorPage /> },
  { id: 'servidor', label: 'Servidor', icon: <Server size={20} />, el: () => <ServerPage /> },
  { id: 'actividad', label: 'Actividad', icon: <Activity size={20} />, el: () => <ActivityPage /> },
  { id: 'ajustes', label: 'Ajustes', icon: <Settings size={20} />, el: () => <SettingsPage /> },
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
        <aside className="relative z-10 flex w-[92px] shrink-0 flex-col items-center gap-1 border-r border-white/5 bg-black/30 py-5 backdrop-blur-xl">
          <button onClick={() => go('plugins')} className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent via-hot to-coral text-white shadow-[0_10px_30px_-10px_var(--color-hot)]" title="LiveArena">
            <Zap size={24} strokeWidth={2.5} />
          </button>
          <nav className="flex w-full flex-1 flex-col items-center gap-1 px-2">
            {PAGES.map((p) => {
              const on = p.id === current.id
              return (
                <button
                  key={p.id}
                  onClick={() => go(p.id)}
                  className={`group relative flex w-full flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-[11px] font-medium transition ${on ? 'text-white' : 'text-muted hover:text-white'}`}
                >
                  {on && <span className="absolute top-1/2 -left-2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-accent to-hot" />}
                  <span className={`grid h-10 w-10 place-items-center rounded-xl transition ${on ? 'bg-gradient-to-br from-accent/30 to-hot/20 ring-1 ring-accent/60' : 'group-hover:bg-white/5'}`}>{p.icon}</span>
                  <span className="leading-none">{p.label}</span>
                  {p.id === 'plugins' && profile && <span className="absolute top-1.5 right-2.5 min-w-4 rounded-full bg-hot px-1 text-[9px] leading-4 font-bold text-white">{profile.events.length}</span>}
                </button>
              )
            })}
          </nav>
          <div className="text-[10px] text-muted/60">v{(state as any)?.version ?? ''}</div>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <div className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto w-full max-w-[1680px]">{state ? current.el() : <Loading />}</div></div>
        </main>
      </div>
      <Toasts />
      <Dialogs />
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
    <header className="flex flex-wrap items-center gap-3 border-b border-white/5 bg-black/20 px-8 py-3 backdrop-blur-xl">
      <div className="mr-auto flex items-center gap-3">
        <span className="text-lg font-extrabold tracking-tight">
          Live<span className="glow-text">Arena</span>
        </span>
        <span className="chip" title={wsOk ? 'El panel está conectado con el motor de la app' : 'Reconectando…'}>
          <span className={`h-1.5 w-1.5 rounded-full ${wsOk ? 'bg-ok shadow-[0_0_8px_var(--color-ok)]' : 'bg-bad'}`} /> {wsOk ? 'en línea' : 'reconectando…'}
        </span>
        {source?.viewers !== undefined && st === 'live' && <span className="chip">👁 {source.viewers}</span>}
      </div>
      <MinecraftPill />
      <NickField current={mc?.player ?? state?.config?.minecraft?.player ?? ''} onSaved={reload} />
      <div className={`flex items-center gap-1 rounded-full border p-1 pl-4 text-sm transition ${st === 'live' ? 'border-hot/60 bg-hot/10 shadow-[0_0_24px_-8px_var(--color-hot)]' : 'border-line bg-black/30'}`}>
        <Radio size={14} className={st === 'live' ? 'animate-pulse text-hot' : st === 'error' ? 'text-bad' : 'text-muted'} />
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !active && toggle()}
          placeholder="@usuario de TikTok"
          disabled={active}
          className="ml-1 w-40 bg-transparent font-semibold outline-none placeholder:font-normal placeholder:text-muted/70"
          title={source?.message}
        />
        <span className="px-2 text-xs text-muted">{SOURCE_TEXT[st]}</span>
        <button className={active ? 'btn' : 'btn-accent'} onClick={toggle} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          {active ? 'Desconectar' : 'Conectar'}
        </button>
      </div>
    </header>
  )
}

/** Tu nick de Minecraft, editable desde la barra superior (Enter o salir del campo para guardar). */
function NickField({ current, onSaved }: { current: string; onSaved: () => Promise<void> | void }) {
  const [v, setV] = useState(current)
  useEffect(() => setV(current), [current])
  const save = async () => {
    const nick = v.trim()
    if (nick === current) return
    if (nick && !/^[A-Za-z0-9_]{3,16}$/.test(nick)) {
      toast('El nick de Minecraft lleva de 3 a 16 letras, números o _', 'error')
      setV(current)
      return
    }
    try {
      await api('PUT', '/api/config', { player: nick })
      await onSaved()
      toast(nick ? `Nick guardado: ${nick}` : 'Nick borrado')
    } catch (e) {
      toast((e as Error).message, 'error')
      setV(current)
    }
  }
  return (
    <label className={`flex cursor-text items-center gap-2 rounded-full border bg-black/30 px-4 py-1.5 text-sm transition focus-within:border-accent ${current ? 'border-line' : 'border-warn/60'}`} title="Tu nick de Minecraft: a quién le llegan los mobs y regalos">
      <Pickaxe size={14} className="text-muted" />
      <input
        value={v}
        maxLength={16}
        onChange={(e) => setV(e.target.value.replace(/\s/g, ''))}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        onBlur={save}
        placeholder="sin configurar"
        className="w-32 bg-transparent font-semibold outline-none placeholder:font-normal placeholder:text-warn"
      />
    </label>
  )
}

const LINK_TEXT: Record<string, string> = { disconnected: 'desvinculado', connecting: 'conectando…', connected: 'vinculado', backoff: 'reintentando', error: 'error' }

function MinecraftPill() {
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
  const dot = link === 'connected' ? 'bg-ok shadow-[0_0_8px_var(--color-ok)]' : link === 'error' ? 'bg-bad' : proc === 'starting' ? 'bg-warn animate-pulse' : 'bg-muted'
  const procText = mc?.server?.folder ? { stopped: 'apagado', starting: 'arrancando…', running: 'encendido', stopping: 'apagando…', crashed: 'se cayó' }[proc as string] : 'sin servidor'
  const on = proc === 'running' || proc === 'starting'
  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-black/30 p-1 pl-3 text-sm">
      <button className="flex items-center gap-2 pr-2 text-left" onClick={() => go('servidor')} title={mc?.link?.message ?? 'Ir a Servidor'}>
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="leading-tight">
          <span className="block text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">Minecraft</span>
          <span className="block text-xs font-semibold">
            {procText} · {LINK_TEXT[link]}
          </span>
        </span>
      </button>
      {canStart ? (
        <button className="btn-accent" disabled={busy} onClick={() => run(() => api('POST', '/api/minecraft/server/start'))}>
          <Power size={13} /> Encender
        </button>
      ) : on ? (
        <button className="btn" disabled={busy} onClick={() => run(() => api('POST', '/api/minecraft/server/stop'))}>
          <Power size={13} /> Apagar
        </button>
      ) : link === 'connected' ? (
        <button className="btn" disabled={busy} onClick={() => run(() => api('POST', '/api/minecraft/disconnect'))}>
          Desvincular
        </button>
      ) : (
        <button className="btn" disabled={busy} onClick={() => run(() => api('POST', '/api/minecraft/connect'))}>
          Vincular
        </button>
      )}
    </div>
  )
}
