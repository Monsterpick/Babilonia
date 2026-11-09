import { useEffect, useState } from 'react'
import { CheckCircle2, CircleDashed, Clapperboard, Copy, Download, Loader2, Play, RefreshCw, Square, XCircle } from 'lucide-react'
import { api } from '../lib/api'
import { useLiveState } from '../lib/live'
import { CINE_ABILITIES } from '../lib/cine'
import { PageHeader, Toggle } from '../components/ui'
import { toast } from '../components/Toast'

interface CineStatus {
  mcDir: string | null
  launcher: boolean
  neoforge: boolean
  profile: boolean
  launcherOpen: boolean
  vanilla: boolean
  mod: 'missing' | 'installed' | 'outdated'
  geckolib: boolean
  bundled: boolean
  inGame: boolean | null
  busy: { step: string; message: string; pct?: number } | null
  error: string | null
  versions: { minecraft: string; neoforge: string; geckolib: { fileName: string } }
}

interface CineSettings {
  camaraCinematica: boolean
  romperBloques: boolean
  restaurarBloques: boolean
  segundosRestauracion: number
  bloquesPorTick: number
  colaMax: number
  exists: boolean
}

function Step({ ok, warn, title, detail }: { ok: boolean; warn?: boolean; title: string; detail?: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {ok ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-ok" /> : warn ? <CircleDashed size={20} className="mt-0.5 shrink-0 text-warn" /> : <XCircle size={20} className="mt-0.5 shrink-0 text-muted" />}
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        {detail && <div className="truncate text-xs text-muted">{detail}</div>}
      </div>
    </div>
  )
}

export function CinematicsPage() {
  const live = useLiveState<CineStatus>('cinemod')
  const [status, setStatus] = useState<CineStatus | null>(null)
  const [settings, setSettings] = useState<CineSettings | null>(null)
  const [running, setRunning] = useState<string | null>(null)

  const refresh = async () => {
    try {
      setStatus(await api<CineStatus>('GET', '/api/cine/status'))
      setSettings(await api<CineSettings>('GET', '/api/cine/settings'))
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  useEffect(() => {
    void refresh()
    const t = setInterval(() => void api<CineStatus>('GET', '/api/cine/status').then(setStatus, () => undefined), 6000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (live) setStatus(live)
  }, [live])

  const install = async () => {
    try {
      const s = await api<CineStatus>('POST', '/api/cine/install')
      setStatus(s)
      if (s.error) toast(s.error, 'error')
      else toast('Listo: abre el launcher y elige «LiveArena · NeoForge» en Instalaciones')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const run = async (id: string) => {
    setRunning(id)
    try {
      const r = await api<{ response: string }>('POST', '/api/cine/run', { id, viewer: 'Prueba' })
      if (/no está conectado|desconocida/i.test(r.response)) toast(r.response.replace(/§./g, ''), 'error')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setTimeout(() => setRunning(null), 1200)
    }
  }

  const patch = async (p: Partial<CineSettings>) => {
    if (!settings) return
    setSettings({ ...settings, ...p })
    try {
      setSettings(await api<CineSettings>('PUT', '/api/cine/settings', p))
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const s = status
  const ready = !!s && s.neoforge && s.profile && s.geckolib && s.mod === 'installed'

  return (
    <div className="pb-10">
      <PageHeader title="Cinemáticas" subtitle="Habilidades con cámara de cine, destellos, cielo especial y modelos animados (GeckoLib).">
        <button className="btn" onClick={() => void refresh()}>
          <RefreshCw size={15} /> Actualizar
        </button>
        <button className="btn" onClick={() => void api('POST', '/api/cine/stop').then(() => toast('Cinemáticas detenidas'), (e) => toast(e.message, 'error'))}>
          <Square size={15} /> Detener todas
        </button>
      </PageHeader>

      <div className="grid gap-4 px-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-violet-600/20 via-fuchsia-500/10 to-transparent px-5 py-4">
              <Clapperboard className="text-violet-300" />
              <div className="min-w-0 flex-1">
                <div className="font-bold">Mod «LiveArena Cinemáticas» para tu Minecraft</div>
                <div className="text-xs text-muted">
                  Tu servidor sigue siendo <b>Paper</b> (s2e y tus plugins intactos). Solo tu PC necesita NeoForge {s?.versions.neoforge} + GeckoLib + el mod. En TikTok se ve tu pantalla, así que el resto de jugadores no lo necesita.
                </div>
              </div>
              {ready ? <span className="rounded-full bg-ok/15 px-3 py-1 text-xs font-bold text-ok">Instalado</span> : <span className="rounded-full bg-warn/15 px-3 py-1 text-xs font-bold text-warn">Falta instalar</span>}
            </div>
            <div className="grid gap-x-8 px-5 py-3 md:grid-cols-2">
              <Step ok={!!s?.mcDir && !!s?.launcher} title="Minecraft encontrado" detail={s?.mcDir ?? 'No encuentro .minecraft: abre el launcher oficial una vez'} />
              <Step ok={!!s?.neoforge} title={`NeoForge ${s?.versions.neoforge ?? ''}`} detail="Instalado dentro de tu .minecraft" />
              <Step ok={!!s?.profile} warn={!!s?.neoforge && !s?.profile} title="Perfil «LiveArena · NeoForge» en el launcher" detail={s?.profile ? 'Con su propia carpeta de mods (no se mezcla con Forge u otros perfiles)' : 'Pulsa «Instalar» con el launcher cerrado para crearlo'} />
              <Step
                ok={!!s?.vanilla}
                warn={!!s?.neoforge && !s?.vanilla}
                title={`Minecraft ${s?.versions.minecraft ?? ''} abierto una vez`}
                detail={s?.vanilla ? 'Recursos del juego descargados' : `Antes de NeoForge, juega una vez Minecraft ${s?.versions.minecraft ?? ''} normal (crea una instalación con esa versión) y ciérralo`}
              />
              <Step ok={!!s?.geckolib} title="GeckoLib" detail={s?.versions.geckolib.fileName} />
              <Step ok={s?.mod === 'installed'} warn={s?.mod === 'outdated'} title={s?.mod === 'outdated' ? 'Mod LiveArena (hay versión nueva)' : 'Mod LiveArena Cinemáticas'} detail={s?.bundled ? 'Incluido en esta versión de la app' : 'Esta copia no trae el mod (solo la versión de Windows)'} />
              <Step
                ok={s?.inGame === true}
                warn={s?.inGame === false}
                title={s?.inGame === true ? 'Detectado en el juego' : s?.inGame === false ? 'Conectado SIN el mod' : 'En el juego: sin comprobar'}
                detail={s?.inGame === false ? 'Entra con el perfil «LiveArena · NeoForge» del launcher' : s?.inGame == null ? 'Enciende el servidor y entra para comprobarlo' : 'La cámara cinemática está activa'}
              />
            </div>
            {s?.busy && (
              <div className="border-t border-line px-5 py-3">
                <div className="mb-1 flex items-center gap-2 text-sm">
                  <Loader2 size={15} className="animate-spin" /> {s.busy.message}
                </div>
                {s.busy.pct != null && (
                  <div className="h-1.5 overflow-hidden rounded bg-white/10">
                    <div className="h-full bg-accent transition-all" style={{ width: `${s.busy.pct}%` }} />
                  </div>
                )}
              </div>
            )}
            {s?.launcherOpen && <div className="border-t border-line bg-warn/10 px-5 py-3 text-sm text-warn">El launcher de Minecraft está abierto: ciérralo antes de instalar, o al cerrarse borrará el perfil nuevo.</div>}
            {s?.error && <div className="border-t border-line bg-bad/10 px-5 py-3 text-sm text-bad">{s.error}</div>}
            <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
              <button className="btn-accent" disabled={!!s?.busy} onClick={() => void install()}>
                <Download size={15} /> {ready ? 'Reinstalar / actualizar' : 'Instalar todo en un clic'}
              </button>
              {ready && (
                <button className="btn" onClick={() => void api('POST', '/api/cine/uninstall').then(setStatus as never)}>
                  Quitar el mod
                </button>
              )}
              <span className="text-xs text-muted">Después: abre el launcher → Instalaciones → «LiveArena · NeoForge» → Jugar → Multijugador → tu servidor.</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {CINE_ABILITIES.map((a) => (
              <div key={a.id} className="card group relative overflow-hidden p-4">
                <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-25 blur-2xl transition group-hover:opacity-40" style={{ background: a.color }} />
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl" style={{ background: `${a.color}22`, boxShadow: `inset 0 0 0 1px ${a.color}55` }}>
                    {a.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold" style={{ color: a.color }}>
                      {a.name}
                    </div>
                    <div className="text-[11px] text-muted">
                      {a.seconds} s{a.model ? ' · modelo GeckoLib' : ''}
                    </div>
                  </div>
                </div>
                <p className="mt-2 min-h-[2.5rem] text-xs text-muted">{a.desc}</p>
                <div className="mt-3 flex gap-2">
                  <button className="btn-accent flex-1 justify-center" disabled={running === a.id} onClick={() => void run(a.id)}>
                    {running === a.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Probar
                  </button>
                  <button
                    className="btn"
                    title="Copiar comando para una regla de regalo"
                    onClick={() => void navigator.clipboard.writeText(`la efecto cine_${a.id} {player} {nickname}`).then(() => toast('Comando copiado: pégalo en una acción de comando'))}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <span className="label">Ajustes de las habilidades</span>
            {!settings?.exists && <p className="mb-2 text-xs text-warn">Arranca el servidor una vez para que el plugin cree habilidades.yml.</p>}
            {settings && (
              <div className="space-y-3 text-sm">
                <label className="flex items-center justify-between gap-3">
                  <span>Cámara cinemática (con el mod)</span>
                  <Toggle on={settings.camaraCinematica} onChange={(v) => void patch({ camaraCinematica: v })} />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span>Romper bloques</span>
                  <Toggle on={settings.romperBloques} onChange={(v) => void patch({ romperBloques: v })} />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span>Restaurar el terreno después</span>
                  <Toggle on={settings.restaurarBloques} onChange={(v) => void patch({ restaurarBloques: v })} />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span>Segundos hasta restaurar</span>
                  <input type="number" className="input w-24" min={1} max={3600} value={settings.segundosRestauracion} onChange={(e) => void patch({ segundosRestauracion: Math.max(1, Number(e.target.value)) })} />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span>Bloques por tick (rendimiento)</span>
                  <input type="number" className="input w-24" min={20} max={5000} value={settings.bloquesPorTick} onChange={(e) => void patch({ bloquesPorTick: Math.max(20, Number(e.target.value)) })} />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span>Habilidades en cola por jugador</span>
                  <input type="number" className="input w-24" min={0} max={100} value={settings.colaMax} onChange={(e) => void patch({ colaMax: Math.max(0, Number(e.target.value)) })} />
                </label>
              </div>
            )}
          </div>
          <div className="card space-y-2 p-5 text-xs text-muted">
            <span className="label">Cómo usarlas con regalos</span>
            <p>
              En <b>Plugins</b>, crea una regla y añade una acción de comando con <code className="text-white">la efecto cine_&lt;id&gt; {'{player}'} {'{nickname}'}</code> (o búscala en la galería, grupo LiveArena → «Cinemática: …»).
            </p>
            <p>Si llegan varias a la vez, esperan en cola y se lanzan una detrás de otra.</p>
            <p>
              El golpe final de cada habilidad gasta un tótem (como el resto de efectos). Los números de cada habilidad están en <code className="text-white">plugins/LiveArena/habilidades.yml</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
