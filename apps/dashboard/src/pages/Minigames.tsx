import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Crown,
  Download,
  Gamepad2,
  Gift,
  Heart,
  Loader2,
  Map as MapIcon,
  Play,
  Power,
  RefreshCw,
  Save,
  Shield,
  Skull,
  Square,
  Swords,
  Timer,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react'
import { api } from '../lib/api'
import { useLiveState } from '../lib/live'
import { useApp } from '../App'
import { PageHeader } from '../components/ui'
import { toast } from '../components/Toast'

interface Game {
  running: boolean
  arena: boolean
  generating: boolean
  round: number
  time: number
  paused: boolean
  hp: number
  max: number
  ganadas?: number
  perdidas?: number
  amenaza?: number
  wins: number
  mobs: number
  queue: number
  bosses: number
  phase?: number
  wave?: number
  kills: number
  likes: number
  likesMissing: number
  streamer: string
  tps: number
}

interface Status {
  baseDefense: {
    bundled: boolean
    plugin: 'no-server' | 'missing' | 'installed' | 'outdated' | 'disabled'
    loaded: boolean | null
    config: boolean
    game: Game | null
    error: string | null
  }
}

type Settings = Record<string, string | number>

const BOSSES = [
  { id: 'wither', name: 'Wither' },
  { id: 'dragon', name: 'Dragón del End' },
  { id: 'warden', name: 'Warden' },
]

const MOBS = [
  { id: 'zombie', name: 'Zombis' },
  { id: 'skeleton', name: 'Esqueletos' },
  { id: 'spider', name: 'Arañas' },
  { id: 'piglin', name: 'Piglins' },
  { id: 'wither_skeleton', name: 'Esq. wither' },
]

/** Regalos del perfil «Base Defense» (se editan en Plugins). */
const GIFT_MAP: { gift: string; coins: number; what: string }[] = [
  { gift: 'Rose', coins: 1, what: '2 zombis' },
  { gift: 'TikTok', coins: 1, what: '1 esqueleto' },
  { gift: 'GG', coins: 1, what: '2 arañas' },
  { gift: 'Finger Heart', coins: 5, what: '2 piglins' },
  { gift: 'Perfume', coins: 20, what: 'Horda de 10 (mezcla de la fase)' },
  { gift: 'Doughnut', coins: 30, what: 'Cura +100 la base' },
  { gift: 'Hand Hearts', coins: 100, what: 'Horda grande (30)' },
  { gift: 'Confetti', coins: 100, what: '3 esqueletos wither' },
  { gift: 'Corgi', coins: 299, what: '3 piglins brutos' },
  { gift: 'Cap', coins: 99, what: 'Aliado: misil sobre el grupo más denso' },
  { gift: 'Sunglasses', coins: 199, what: 'Aliado: bombardeo por el carril' },
  { gift: 'Money Gun', coins: 500, what: 'Caja de suministros (minigun)' },
  { gift: 'Swan', coins: 699, what: 'Aliado: rayo orbital que barre el carril' },
  { gift: 'Galaxy', coins: 1000, what: 'Jefe: Wither' },
  { gift: '3.000–4.999 monedas', coins: 3000, what: 'Jefe: Warden' },
  { gift: '5.000+ monedas', coins: 5000, what: 'Jefe: Dragón del End' },
  { gift: 'Seguir', coins: 0, what: 'Repara +25 la base' },
  { gift: 'Compartir', coins: 0, what: '1 esqueleto' },
  { gift: 'Meta de likes', coins: 0, what: 'Jefe Wither (la lleva el plugin)' },
]

const FIELDS: { key: string; label: string; hint?: string; type: 'int' | 'number' | 'text' | 'select'; options?: { v: string; l: string }[]; arena?: boolean; min?: number; max?: number; step?: number }[] = [
  { key: 'base.vida', label: 'Vida de la base', type: 'int', min: 1, hint: 'Por defecto 1500' },
  { key: 'ronda.duracion', label: 'Duración de la ronda (segundos)', type: 'int', min: 10, hint: '900 = 15:00' },
  { key: 'base.pausaAlCaer', label: 'Pausa al caer la base (s)', type: 'int', min: 0, max: 60 },
  { key: 'mobs.tope', label: 'Máximo de mobs a la vez', type: 'int', min: 1, max: 2000, hint: 'Lo que pase de aquí espera en la cola' },
  { key: 'mobs.hordaGrande', label: 'Cartel «¡LLEGA LA HORDA!» desde', type: 'int', min: 1 },
  { key: 'mobs.etiqueta', label: 'Nombre sobre los mobs', type: 'text', hint: '{usuario} = el donante · colores con &' },
  { key: 'recompensa.bajas', label: 'Meta de bajas (cofre dorado)', type: 'int', min: 0, hint: 'Bajas para el primer cofre: munición, +10 % de base y daño doble. 0 = sin metas' },
  { key: 'recompensa.incremento', label: 'La meta sube por cofre', type: 'int', min: 0 },
  { key: 'recompensa.danioDobleSegundos', label: 'Segundos de daño doble', type: 'int', min: 0, max: 120 },
  { key: 'likes.meta', label: 'Meta de likes', type: 'int', min: 1, hint: 'Al llegar sale un jefe y la meta se reinicia' },
  { key: 'likes.jefe', label: 'Jefe de la meta de likes', type: 'select', options: BOSSES.map((b) => ({ v: b.id, l: b.name })) },
  { key: 'mundo.hora', label: 'Hora fija', type: 'select', options: [
    { v: '12400', l: 'Atardecer dorado' },
    { v: '12900', l: 'Atardecer' },
    { v: '13400', l: 'Anochecer' },
    { v: '18000', l: 'Medianoche' },
    { v: '6000', l: 'Mediodía' },
  ] },
  { key: 'mundo.clima', label: 'Clima', type: 'select', options: [
    { v: 'despejado', l: 'Despejado' },
    { v: 'lluvia', l: 'Lluvia' },
    { v: 'tormenta', l: 'Tormenta' },
  ] },
  { key: 'mundo.bioma', label: 'Ambiente (bioma)', type: 'select', arena: true, options: [
    { v: 'basedefense:ceniza', l: 'Ceniza (propio: niebla apagada y ceniza)' },
    { v: 'minecraft:pale_garden', l: 'Jardín pálido (gris)' },
    { v: 'minecraft:basalt_deltas', l: 'Deltas de basalto (morado)' },
    { v: 'minecraft:dark_forest', l: 'Bosque oscuro (verde)' },
  ] },
  { key: 'arena.semilla', label: 'Semilla de la arena', type: 'int', arena: true, hint: 'La misma semilla da siempre el mismo mapa' },
  { key: 'arena.largo', label: 'Largo del carril', type: 'int', arena: true, min: 30, max: 220 },
  { key: 'arena.ancho', label: 'Ancho del carril', type: 'int', arena: true, min: 7, max: 41 },
  { key: 'arena.densidadDecorado', label: 'Decorado (0 – 2)', type: 'number', arena: true, min: 0, max: 2, step: 0.1 },
  { key: 'arena.luzCarril', label: 'Luz del carril (0 – 15)', type: 'int', arena: true, min: 0, max: 15, hint: 'Súbela si los mobs se ven oscuros en el stream' },
]

function Step({ ok, warn, title, detail, action }: { ok: boolean; warn?: boolean; title: string; detail?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/[0.03]">
      {ok ? <CheckCircle2 size={22} className="shrink-0 text-ok" /> : warn ? <CircleDashed size={22} className="shrink-0 text-warn" /> : <XCircle size={22} className="shrink-0 text-muted/60" />}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        {detail && <div className="text-xs text-muted">{detail}</div>}
      </div>
      {action}
    </div>
  )
}

function Stat({ icon, label, value, tone = 'text-white' }: { icon: ReactNode; label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted">
        {icon}
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  )
}

const mmss = (s: number) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.max(0, s) % 60).padStart(2, '0')}`

export function MinigamesPage() {
  const { state, profile, reload, go } = useApp()
  const live = useLiveState<Status>('minigames')
  const [status, setStatus] = useState<Status | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [draft, setDraft] = useState<Settings>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)

  const refresh = async () => {
    try {
      setStatus(await api<Status>('GET', '/api/minigames/status'))
      const s = await api<{ exists: boolean; values: Settings }>('GET', '/api/minigames/basedefense/settings')
      setSettings(s.exists ? s.values : null)
      setDraft({})
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  useEffect(() => {
    void refresh()
  }, [])
  useEffect(() => {
    if (live) setStatus(live)
  }, [live])
  // la config aparece cuando el plugin arranca la primera vez
  useEffect(() => {
    if (status?.baseDefense.config && !settings) void api<{ exists: boolean; values: Settings }>('GET', '/api/minigames/basedefense/settings').then((s) => s.exists && setSettings(s.values), () => undefined)
  }, [status?.baseDefense.config])

  const bd = status?.baseDefense
  const g = bd?.game ?? null
  const rcon = bd?.loaded !== null && bd?.loaded !== undefined
  const profileActive = profile?.id === 'base-defense'

  const cmd = async (command: string, okMsg?: string) => {
    setBusy(command)
    try {
      const r = await api<{ response: string }>('POST', '/api/minigames/basedefense/command', { command })
      toast(okMsg ?? r.response ?? 'Hecho')
      setTimeout(() => void refresh(), 600)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setTimeout(() => setBusy(null), 400)
    }
  }

  const install = async () => {
    setBusy('install')
    try {
      const r = await api<{ restartNeeded: boolean }>('POST', '/api/minigames/basedefense/install')
      toast(r.restartNeeded ? 'Plugin instalado. Reinicia el servidor para cargarlo.' : 'Plugin instalado. Se cargará al encender el servidor.')
      await refresh()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const restartServer = async () => {
    setBusy('restart')
    try {
      await api('POST', '/api/minecraft/server/stop').catch(() => undefined)
      toast('Reiniciando el servidor…')
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 1000))
        const s = await api<any>('GET', '/api/state').catch(() => null)
        if (s?.minecraft?.server?.state !== 'running' && s?.minecraft?.server?.state !== 'stopping') break
      }
      await api('POST', '/api/minecraft/server/start')
      toast('Servidor encendido: Base Defense se carga en unos segundos')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const activateProfile = async () => {
    setBusy('profile')
    try {
      await api('POST', '/api/minigames/basedefense/profile')
      await reload()
      toast('Perfil «Base Defense» activo: los regalos ya mandan hordas y jefes')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const merged = useMemo(() => ({ ...(settings ?? {}), ...draft }), [settings, draft])
  const dirty = Object.keys(draft).length > 0
  const arenaDirty = Object.keys(draft).some((k) => FIELDS.find((f) => f.key === k)?.arena)

  const save = async () => {
    setBusy('save')
    try {
      const r = await api<{ reloaded: boolean }>('PUT', '/api/minigames/basedefense/settings', draft)
      toast(arenaDirty ? 'Guardado. Los cambios del mapa se ven al regenerar la arena.' : r.reloaded ? 'Guardado y aplicado en el juego' : 'Guardado: se aplica al encender el servidor')
      await refresh()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const pluginOk = bd?.plugin === 'installed' || bd?.plugin === 'outdated'
  const loaded = bd?.loaded === true
  const hpPct = g && g.max > 0 ? Math.max(0, Math.min(100, (g.hp / g.max) * 100)) : 0
  const hpTone = hpPct > 60 ? 'from-emerald-500 to-lime-400' : hpPct > 30 ? 'from-amber-500 to-yellow-300' : 'from-red-600 to-rose-400'
  const likesPct = g && settings?.['likes.meta'] ? Math.max(0, Math.min(100, 100 - (g.likesMissing / Number(settings['likes.meta'])) * 100)) : 0

  return (
    <div className="pb-10">
      <PageHeader title="Minijuegos" subtitle="Juegos completos para tu directo: los regalos de TikTok se convierten en hordas, jefes y curas.">
        <button className="btn" onClick={() => void refresh()}>
          <RefreshCw size={15} /> Actualizar
        </button>
      </PageHeader>

      <div className="space-y-5 px-8">
        {/* Portada */}
        <div className="card relative overflow-hidden">
          <img src="/minijuegos/base-defense.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/10" />
          <div className="relative grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-red-300 uppercase">
                <Shield size={14} /> Minijuego · Paper 26.1.2
              </div>
              <h2 className="mt-1 text-3xl font-black tracking-tight">Base Defense</h2>
              <p className="mt-2 max-w-xl text-sm text-white/80">
                Defiende tu base en primera persona con pistola, subfusil, ametralladora, lanzagranadas, lanzacohetes y minigun. Oleadas por fases que mezclan zombis, esqueletos, arañas, piglins, esqueletos wither y más,
                y con los regalos grandes, jefes que atacan la base: el Wither con sus calaveras, el Dragón del End con bolas de fuego (¡devuélveselas!) y el Warden con su cañón sónico y sus embestidas.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                {['HUD propio limpio', 'Meta de bajas → cofre', '5 fases por ronda', 'Munición y suministros', 'Vida visible en cada mob', 'Pack de texturas + armas 3D', 'Hasta 300 mobs a 20 TPS', 'Modo separado del survival'].map((t) => (
                  <span key={t} className="rounded-full bg-white/10 px-2.5 py-1 font-semibold text-white/90 ring-1 ring-white/10">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <img src="/minijuegos/base-defense-jefe.jpg" alt="Jefe llegando por el carril" className="hidden rounded-xl object-cover shadow-2xl ring-1 ring-white/10 lg:block" />
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-5">
            {/* Pasos */}
            <div className="card p-3">
              <div className="px-3 pt-2 pb-1 text-xs font-bold tracking-wider text-muted uppercase">Preparación (una sola vez)</div>
              <Step
                ok={pluginOk}
                warn={bd?.plugin === 'outdated'}
                title={bd?.plugin === 'outdated' ? 'Plugin Base Defense (hay versión nueva)' : 'Plugin Base Defense en tu servidor'}
                detail={
                  bd?.plugin === 'no-server'
                    ? 'Primero crea o elige tu servidor en la pestaña Servidor'
                    : !bd?.bundled
                      ? 'Esta copia de la app no trae el plugin (solo la versión de Windows)'
                      : bd?.plugin === 'disabled'
                        ? 'Está desactivado en el gestor de plugins'
                        : pluginOk
                          ? 'BaseDefense.jar está en plugins/'
                          : 'Copia BaseDefense.jar a la carpeta plugins/ del servidor'
                }
                action={
                  bd?.plugin !== 'installed' && bd?.plugin !== 'no-server' && bd?.bundled ? (
                    <button className="btn btn-accent" disabled={busy === 'install'} onClick={() => void install()}>
                      {busy === 'install' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} {bd?.plugin === 'outdated' ? 'Actualizar' : 'Instalar'}
                    </button>
                  ) : bd?.plugin === 'no-server' ? (
                    <button className="btn" onClick={() => go('servidor')}>
                      Ir a Servidor
                    </button>
                  ) : null
                }
              />
              <Step
                ok={loaded}
                warn={pluginOk && !loaded}
                title="Cargado en el servidor"
                detail={loaded ? 'Base Defense responde por RCON' : !rcon ? 'Enciende el servidor (y conecta RCON) para comprobarlo' : 'Instalado pero no cargado: reinicia el servidor'}
                action={
                  pluginOk && !loaded && rcon ? (
                    <button className="btn" disabled={busy === 'restart'} onClick={() => void restartServer()}>
                      {busy === 'restart' ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />} Reiniciar servidor
                    </button>
                  ) : null
                }
              />
              <Step
                ok={!!g?.arena}
                warn={!!g?.generating}
                title={g?.generating ? 'Construyendo la arena…' : 'Arena generada'}
                detail={g?.arena ? 'Isla flotante con carril, bosque muerto, ruinas, base elevada y portal' : 'El plugin construye el mapa él solo en un mundo vacío (tarda unos segundos)'}
                action={
                  loaded && !g?.arena && !g?.generating ? (
                    <button className="btn btn-accent" disabled={!!busy} onClick={() => void cmd('bd arena generate', 'Generando la arena… entra al servidor y usa «Ver la arena»')}>
                      <MapIcon size={15} /> Generar arena
                    </button>
                  ) : g?.generating ? (
                    <Loader2 size={18} className="animate-spin text-warn" />
                  ) : null
                }
              />
              <Step
                ok={profileActive}
                warn={!profileActive}
                title="Regalos conectados al juego"
                detail={profileActive ? 'Perfil «Base Defense» activo' : `Ahora está activo «${profile?.name ?? '—'}». Activa el perfil de Base Defense para que los regalos manden hordas.`}
                action={
                  !profileActive ? (
                    <button className="btn" disabled={busy === 'profile'} onClick={() => void activateProfile()}>
                      <Gift size={15} /> Activar perfil
                    </button>
                  ) : null
                }
              />
            </div>

            {/* Partida */}
            <div className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-line bg-gradient-to-r from-red-600/25 via-orange-500/10 to-transparent px-5 py-4">
                <Swords className="text-red-300" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold">Partida</div>
                  <div className="text-xs text-muted">
                    {g?.running ? `En marcha · streamer ${g.streamer || '—'}` : loaded ? 'Lista para empezar: te lleva a la base con las armas (tu inventario se guarda y se devuelve al terminar)' : 'Disponible cuando el plugin esté cargado'}
                  </div>
                </div>
                {g?.running ? (
                  <button className="btn" disabled={!!busy} onClick={() => void cmd('bd stop', 'Partida detenida')}>
                    <Square size={15} /> Detener
                  </button>
                ) : (
                  <button
                    className="btn btn-accent"
                    disabled={!loaded || !g?.arena || !!busy}
                    onClick={() => void cmd(`bd start${state?.config?.minecraft?.player ? ` ${state.config.minecraft.player}` : ''}`, '¡A defender la base!')}
                  >
                    <Play size={15} /> Empezar partida
                  </button>
                )}
                {loaded && g?.arena && (
                  <button className="btn" disabled={!!busy || !state?.config?.minecraft?.player} onClick={() => void cmd(`bd tp ${state?.config?.minecraft?.player ?? ''}`, 'Te llevé a la base')} title="Te lleva a la base sin empezar la partida">
                    <MapIcon size={15} /> Ver la arena
                  </button>
                )}
              </div>
              {g && !g.running ? (
                <div className="grid grid-cols-3 gap-2 p-5">
                  <Stat icon={<Trophy size={12} />} label="Ganadas · perdidas" value={`${g.ganadas ?? 0} – ${g.perdidas ?? 0}`} tone="text-amber-300" />
                  <Stat icon={<Heart size={12} />} label="Likes del directo" value={g.likes.toLocaleString('es')} />
                  <Stat icon={<Zap size={12} />} label="TPS del servidor" value={g.tps.toFixed(1)} tone={g.tps < 18 ? 'text-red-400' : 'text-emerald-300'} />
                </div>
              ) : g ? (
                <div className="space-y-4 p-5">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-bold tracking-wide text-red-300">VIDA DE LA BASE</span>
                      <span className="tabular-nums text-muted">
                        {g.hp.toLocaleString('es')} / {g.max.toLocaleString('es')} · {Math.round(hpPct)}%
                      </span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/5">
                      <div className={`h-full rounded-full bg-gradient-to-r ${hpTone} transition-all duration-500`} style={{ width: `${hpPct}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat icon={<Timer size={12} />} label={`Ronda ${g.round} · fase ${g.phase ?? 1} · oleada ${g.wave ?? 0}`} value={g.paused ? 'Pausa' : mmss(g.time)} tone={g.time <= 10 ? 'text-red-400' : 'text-white'} />
                    <Stat icon={<Trophy size={12} />} label="Ganadas · perdidas" value={`${g.ganadas ?? 0} – ${g.perdidas ?? 0}`} tone="text-amber-300" />
                    <Stat icon={<Zap size={12} />} label="Amenaza (donaciones)" value={`Nivel ${g.amenaza ?? 1}`} tone={(g.amenaza ?? 1) >= 4 ? 'text-red-400' : (g.amenaza ?? 1) >= 2 ? 'text-orange-300' : 'text-white'} />
                    <Stat icon={<Skull size={12} />} label="Mobs vivos" value={g.mobs} />
                    <Stat icon={<Gamepad2 size={12} />} label="En cola" value={g.queue} />
                    <Stat icon={<Crown size={12} />} label="Jefes" value={g.bosses} tone={g.bosses ? 'text-fuchsia-300' : 'text-white'} />
                    <Stat icon={<Swords size={12} />} label="Bajas (ronda)" value={g.kills} />
                    <Stat icon={<Heart size={12} />} label="Likes del directo" value={g.likes.toLocaleString('es')} />
                    <Stat icon={<Zap size={12} />} label="TPS del servidor" value={g.tps.toFixed(1)} tone={g.tps < 18 ? 'text-red-400' : 'text-emerald-300'} />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-muted">
                      <span>
                        Faltan <b className="text-white">{g.likesMissing.toLocaleString('es')}</b> likes para el jefe
                      </span>
                      <span>{Math.round(likesPct)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-black/40">
                      <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-400 transition-all duration-500" style={{ width: `${likesPct}%` }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-5 py-6 text-sm text-muted">{bd?.error ? bd.error : 'Sin datos todavía.'}</div>
              )}
            </div>

            {/* Pruebas */}
            <div className="card p-5">
              <div className="mb-1 font-bold">Probar sin TikTok</div>
              <div className="mb-3 text-xs text-muted">Simula los regalos con la partida en marcha. Cada prueba usa un donante «PruebaNN».</div>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {MOBS.map((m) => (
                    <button key={m.id} className="btn" disabled={!g?.running || !!busy} onClick={() => void cmd(`bd test ${m.id} 5`, `5 ${m.name.toLowerCase()} en camino`)}>
                      <Skull size={14} /> 5 {m.name}
                    </button>
                  ))}
                  <button className="btn btn-accent" disabled={!g?.running || !!busy} onClick={() => void cmd('bd test horda 60', '¡Horda de 60!')}>
                    <Swords size={14} /> Horda de 60 (mezcla)
                  </button>
                  <button className="btn" disabled={!g?.running || !!busy} onClick={() => void cmd('bd test suministro', 'Suministros en camino')}>
                    <Gift size={14} /> Suministros
                  </button>
                  <button className="btn" disabled={!g?.running || !!busy} onClick={() => void cmd('bd test misil', 'Misil aliado')}>
                    <Zap size={14} /> Misil
                  </button>
                  <button className="btn" disabled={!g?.running || !!busy} onClick={() => void cmd('bd test bombardeo', 'Bombardeo aliado')}>
                    <Zap size={14} /> Bombardeo
                  </button>
                  <button className="btn" disabled={!g?.running || !!busy} onClick={() => void cmd('bd test rayo', 'Rayo orbital aliado')}>
                    <Zap size={14} /> Rayo orbital
                  </button>
                  <button className="btn" disabled={!g?.running || !!busy} onClick={() => void cmd('bd test despiece', 'Zombis normal, corredor y bruto que revientan')}>
                    <Zap size={14} /> Despiece zombis
                  </button>
                  <button className="btn" disabled={!g?.running || !!busy} onClick={() => void cmd('bd test meta', 'Meta de bajas cumplida: cofre dorado')}>
                    <Trophy size={14} /> Cofre dorado
                  </button>
                  <button className="btn" disabled={!g?.running || !!busy} onClick={() => void cmd('bd test municion', '+3 cargadores para cada arma')}>
                    <Zap size={14} /> Munición
                  </button>
                  <button className="btn" disabled={!g?.running || !!busy} onClick={() => void cmd('bd test lleno', 'Carga máxima (300 mobs)')} title="Prueba de rendimiento: llena hasta el tope">
                    <Zap size={14} /> Carga máxima
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {BOSSES.map((b) => (
                    <button key={b.id} className="btn" disabled={!g?.running || !!busy} onClick={() => void cmd(`bd test jefe ${b.id}`, `Jefe: ${b.name}`)}>
                      <Crown size={14} /> {b.name}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn" disabled={!g?.running || !!busy} onClick={() => void cmd('bd test curar 150', 'Base curada +150')}>
                    <Heart size={14} /> Curar +150
                  </button>
                  <button className="btn" disabled={!g?.running || !!busy} onClick={() => void cmd('bd test likes', 'Likes simulados')}>
                    <Heart size={14} /> +¼ de la meta de likes
                  </button>
                  <button className="btn" disabled={!g?.running || !!busy} onClick={() => void cmd('bd test ganar', '+1 ganada')}>
                    <Trophy size={14} /> +1 ganada
                  </button>
                  <button className="btn" disabled={!g?.running || !!busy} onClick={() => void cmd('bd test perder', '+1 perdida')}>
                    <Trophy size={14} /> +1 perdida
                  </button>
                  <button className="btn" disabled={!!busy} onClick={() => { if (confirm('¿Poner el marcador de ganadas y perdidas a 0-0?')) void cmd('bd marcador reiniciar', 'Marcador a 0-0') }}>
                    <Trophy size={14} /> Marcador a 0-0
                  </button>
                  <button className="btn" disabled={!g?.running || !!busy} onClick={() => void cmd('bd test ronda', 'Fin de ronda')}>
                    <Timer size={14} /> Terminar ronda
                  </button>
                  <button className="btn" disabled={!g?.running || !!busy} onClick={() => void cmd('bd test caer', 'BASE CAÍDA')}>
                    <Shield size={14} /> Hacer caer la base
                  </button>
                </div>
              </div>
            </div>
            {/* Ajustes */}
            <div className="card p-5">
              <div className="mb-1 font-bold">Ajustes del juego</div>
              {!settings ? (
                <div className="text-sm text-muted">Aparecen cuando el servidor arranca una vez con el plugin instalado.</div>
              ) : (
                <>
                  <div className="mb-3 text-xs text-muted">Se aplican al momento. Los marcados con 🗺 cambian el mapa: pulsa «Regenerar arena» después.</div>
                  <div className="grid gap-x-4 gap-y-2.5 md:grid-cols-2">
                    {FIELDS.map((f) => {
                      const v = merged[f.key]
                      return (
                        <label key={f.key} className="block">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="font-semibold text-white/90">
                              {f.label} {f.arena && <span title="Cambia el mapa">🗺</span>}
                            </span>
                            {f.hint && <span className="text-[10px] text-muted">{f.hint}</span>}
                          </div>
                          {f.type === 'select' ? (
                            <select className="input w-full" value={String(v ?? '')} onChange={(e) => setDraft({ ...draft, [f.key]: f.key === 'mundo.hora' ? Number(e.target.value) : e.target.value })}>
                              {!f.options!.some((o) => o.v === String(v)) && v !== undefined && <option value={String(v)}>{String(v)}</option>}
                              {f.options!.map((o) => (
                                <option key={o.v} value={o.v}>
                                  {o.l}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="input w-full"
                              type={f.type === 'text' ? 'text' : 'number'}
                              min={f.min}
                              max={f.max}
                              step={f.step ?? 1}
                              value={String(v ?? '')}
                              onChange={(e) => setDraft({ ...draft, [f.key]: f.type === 'text' ? e.target.value : e.target.value === '' ? '' : Number(e.target.value) })}
                            />
                          )}
                        </label>
                      )
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button className="btn btn-accent" disabled={!dirty || busy === 'save'} onClick={() => void save()}>
                      {busy === 'save' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar
                    </button>
                    <button
                      className="btn"
                      disabled={!loaded || !!g?.running || !!busy}
                      title={g?.running ? 'Detén la partida antes' : 'Reconstruye el mapa con los ajustes actuales'}
                      onClick={() => void cmd('bd arena regen', 'Regenerando la arena…')}
                    >
                      <MapIcon size={15} /> Regenerar arena
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>

          <div className="space-y-5">
            {/* Regalos */}
            <div className="card p-5">
              <div className="mb-1 flex items-center gap-2 font-bold">
                <Gift size={16} className="text-pink-300" /> Regalos → juego
              </div>
              <div className="mb-3 text-xs text-muted">Perfil «Base Defense». Cámbialo como cualquier otro en la pestaña Plugins (cada Rosa = 2 zombis, 10 rosas = 20).</div>
              <div className="divide-y divide-line/60 text-sm">
                {GIFT_MAP.map((r) => (
                  <div key={r.gift} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="min-w-0 truncate">
                      {r.gift}
                      {r.coins > 0 && r.coins < 3000 && <span className="ml-1.5 text-[11px] text-amber-300/80">{r.coins} 🪙</span>}
                    </span>
                    <span className="shrink-0 text-right text-xs text-muted">{r.what}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button className="btn flex-1" onClick={() => go('plugins')}>
                  Editar regalos
                </button>
                {!profileActive && (
                  <button className="btn btn-accent flex-1" disabled={busy === 'profile'} onClick={() => void activateProfile()}>
                    Activar
                  </button>
                )}
              </div>
            </div>

            {/* Guía */}
            <div className="card">
              <button className="flex w-full items-center justify-between px-5 py-4 text-left font-bold" onClick={() => setShowGuide(!showGuide)}>
                Cómo se juega y comandos
                <ChevronDown size={16} className={`transition ${showGuide ? 'rotate-180' : ''}`} />
              </button>
              {showGuide && (
                <div className="space-y-3 border-t border-line px-5 py-4 text-xs leading-relaxed text-muted">
                  <p>
                    <b className="text-white">Armas:</b> teclas 1–6 (pistola, subfusil, ametralladora, lanzagranadas, lanzacohetes y minigun). Clic derecho dispara (mantén pulsado para ráfaga; la minigun gira antes de disparar), clic izquierdo o <b>F</b> recarga. A la cabeza hace ×1,6. Munición: cajas que sueltan los mobs, suministros en paracaídas (tócalos) y el cofre dorado de la meta de bajas. Dispara a las calaveras del Wither para romperlas y a las bolas de fuego del Dragón para devolvérselas.
                  </p>
                  <p>
                    <b className="text-white">Rondas:</b> el marcador se lleva solo: si el tiempo llega a 0 con la base en pie suma una <b>ganada</b>; si la base cae suma una <b>perdida</b>, se limpian los mobs y la ronda vuelve a empezar (y las armas vuelven a las de la fase 1). Los mobs que llegan a la puerta se quedan golpeando la base hasta que los matas. Las armas se desbloquean por fase. La <b>amenaza</b> sube con lo que donan y endurece todo (más vida, velocidad, élites y oleadas más grandes).
                  </p>
                  <p>
                    <b className="text-white">Con otra app (TikFinity, etc.) por RCON:</b>
                  </p>
                  <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] text-white/85">{`ttspawn <tipo> <cantidad> <usuario>
ttboss <jefe> <usuario>
ttheal <cantidad> <usuario>
ttaliado <misil|bombardeo|rayo> <usuario>
ttwin <+n|-n> <usuario>
ttlikes <total de likes>`}</pre>
                  <p>Tipos: zombie, skeleton, spider, creeper. Jefes: ravager, blaze, ghast, wither, warden, dragon. El usuario va al final y puede tener espacios y emojis. LiveArena ya envía los likes sola.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
