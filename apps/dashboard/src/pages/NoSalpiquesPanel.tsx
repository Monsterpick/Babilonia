import { useEffect, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, CheckCircle2, Download, Feather, Gift, Loader2, Map as MapIcon, Play, RotateCcw, Save, Shield, Skull, Sparkles, Square, Timer, Trophy, Wind, Zap } from 'lucide-react'
import { api, overlayUrl } from '../lib/api'
import { useLiveState } from '../lib/live'
import { useApp } from '../App'
import { toast } from '../components/Toast'
import { OverlayLinks } from '../components/OverlayLinks'

interface DrGame {
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
  queue: number
  shield: boolean
  protected: boolean
  won: boolean
  theme: string
  color: string
  streamer: string
  colors: string[]
}

interface DrStatus {
  bundled: boolean
  plugin: 'no-server' | 'missing' | 'installed' | 'outdated' | 'disabled'
  loaded: boolean | null
  config: boolean
  game: DrGame | null
  error: string | null
}

const EFFECTS: { cmd: string; name: string; good: boolean; icon: ReactNode }[] = [
  { cmd: 'piedra 2', name: 'Dar piedras', good: true, icon: <Sparkles size={14} /> },
  { cmd: 'bengala', name: 'Dar bengala', good: true, icon: <Sparkles size={14} /> },
  { cmd: 'supersalto', name: 'Supersalto', good: true, icon: <ArrowUp size={14} /> },
  { cmd: 'puente', name: 'Puente', good: true, icon: <Feather size={14} /> },
  { cmd: 'escudo', name: 'Escudo antisalpicón', good: true, icon: <Shield size={14} /> },
  { cmd: 'dormir', name: 'Dormir criatura', good: true, icon: <Shield size={14} /> },
  { cmd: 'empujar', name: 'Empujar al agua', good: false, icon: <Wind size={14} /> },
  { cmd: 'despertar', name: 'Despertar criatura', good: false, icon: <Skull size={14} /> },
  { cmd: 'hundir', name: 'Hundir plataforma', good: false, icon: <ArrowDown size={14} /> },
  { cmd: 'apagar', name: 'Apagar luces', good: false, icon: <Zap size={14} /> },
  { cmd: 'resbalar', name: 'Suelo resbaladizo', good: false, icon: <Zap size={14} /> },
  { cmd: 'salpicar', name: 'Probar: salpicar', good: false, icon: <RotateCcw size={14} /> },
]

const FIELDS: { key: string; label: string; hint?: string; type: 'int' | 'number' | 'bool' }[] = [
  { key: 'mapa.salas', label: 'Salas', hint: '3–12', type: 'int' },
  { key: 'mapa.dificultad', label: 'Dificultad', hint: '0,5 fácil · 1 normal · 1,5 difícil', type: 'number' },
  { key: 'mapa.semilla', label: 'Semilla del mapa', type: 'int' },
  { key: 'partida.tiempoLimite', label: 'Tiempo límite (min)', hint: '0 = sin límite', type: 'int' },
  { key: 'partida.piedrasAlEmpezar', label: 'Piedras al empezar', type: 'int' },
  { key: 'partida.bengalasAlEmpezar', label: 'Bengalas al empezar', type: 'int' },
  { key: 'monstruo.velocidad', label: 'Velocidad de la criatura', hint: 'bloques/tick', type: 'number' },
  { key: 'monstruo.segundosDespertar', label: 'Segundos en despertar', type: 'int' },
  { key: 'monstruo.distanciaAtrapar', label: 'Distancia para atrapar', type: 'number' },
  { key: 'sala.segundosHundir', label: 'Plataforma que se hunde (s)', type: 'number' },
  { key: 'sala.segundosMemoria', label: 'Puente de memoria visible (s)', type: 'int' },
  { key: 'sala.segundosCrecida', label: 'Crecida final cada (s)', type: 'number' },
  { key: 'efectos.empujeFuerza', label: 'Fuerza del empujón', type: 'number' },
  { key: 'efectos.salpiconesParaProteger', label: 'Salpicones seguidos para proteger', hint: '0 = nunca', type: 'int' },
]

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

/** Pestaña del minijuego No Salpiques: salas de piscinas; si tocas el agua, algo despierta y te persigue. */
export function NoSalpiquesPanel() {
  const live = useLiveState<{ nosalpiques?: DrStatus }>('minigames')
  const st = live?.nosalpiques
  const g = st?.game
  const { state } = useApp()
  const [busy, setBusy] = useState<string | null>(null)
  const [player, setPlayer] = useState('')
  const [settings, setSettings] = useState<Record<string, string | number> | null>(null)

  useEffect(() => {
    api<{ exists: boolean; values: Record<string, string | number> }>('GET', '/api/minigames/nosalpiques/settings').then((r) => setSettings(r.exists ? r.values : null), () => setSettings(null))
  }, [st?.config, st?.loaded])

  const run = async (command: string, label = command) => {
    setBusy(label)
    try {
      const r = await api<{ response: string }>('POST', '/api/minigames/nosalpiques/command', { command })
      toast(r.response || 'Hecho')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }
  const install = async () => {
    setBusy('install')
    try {
      const r = await api<{ restartNeeded: boolean }>('POST', '/api/minigames/nosalpiques/install')
      toast(r.restartNeeded ? 'Instalado: reinicia el servidor de Minecraft para cargarlo' : 'Plugin instalado')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }
  const save = async () => {
    if (!settings) return
    setBusy('save')
    try {
      const r = await api<{ reloaded: boolean }>('PUT', '/api/minigames/nosalpiques/settings', settings)
      toast(r.reloaded ? 'Guardado y aplicado' : 'Guardado (se aplica al arrancar el servidor)')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }
  const useProfile = async () => {
    try {
      const r = await api<{ name: string }>('POST', '/api/minigames/nosalpiques/profile')
      toast(`Perfil activo: ${r.name}`)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const ready = st?.plugin === 'installed' || st?.plugin === 'outdated'
  const levels = g?.levels ?? 8
  const url = overlayUrl('nosalpiques')
  const B = (props: { cmd: string; label: ReactNode; accent?: boolean; disabled?: boolean }) => (
    <button className={props.accent ? 'btn-accent' : 'btn'} disabled={!!busy || props.disabled} onClick={() => run(props.cmd)}>
      {busy === props.cmd ? <Loader2 size={14} className="animate-spin" /> : null}
      {props.label}
    </button>
  )

  return (
    <div className="grid gap-4 px-8 pb-12 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-teal-600 text-2xl">💧</div>
            <div className="mr-auto">
              <div className="text-lg font-extrabold">No Salpiques</div>
              <div className="text-xs text-muted">Salta de plataforma en plataforma por {levels} salas de piscinas. Si tocas el agua, algo despierta y te persigue; si te atrapa, vuelves al inicio de la sala. En la última sala el agua sube.</div>
            </div>
            {st?.plugin === 'missing' || st?.plugin === 'disabled' || st?.plugin === 'outdated' ? (
              <button className="btn-accent" disabled={!!busy} onClick={install}>
                <Download size={14} /> {st.plugin === 'outdated' ? 'Actualizar plugin' : 'Instalar plugin'}
              </button>
            ) : st?.plugin === 'installed' ? (
              <span className="chip text-good">
                <CheckCircle2 size={12} /> {st.loaded ? 'cargado' : 'instalado'}
              </span>
            ) : (
              <span className="chip">{st?.plugin === 'no-server' ? 'elige tu servidor en Servidor' : '…'}</span>
            )}
          </div>
          {ready && !st?.loaded && <p className="mt-3 text-xs text-warn">Instalado. Arranca (o reinicia) el servidor de Minecraft para cargarlo.</p>}
          {g && (
            <div className="mt-5 space-y-3">
              <div className="flex items-end gap-4">
                <div>
                  <div className="text-xs text-muted">SALA</div>
                  <div className="text-4xl font-black" style={{ color: g.color }}>
                    {Math.min(g.level, levels)}
                    <span className="text-lg text-muted">/{levels}</span>
                  </div>
                </div>
                <div className="mr-auto text-sm font-bold" style={{ color: g.color }}>
                  {g.won ? '¡COMPLETADO!' : g.theme}
                </div>
                <Stat icon={<Skull size={14} />} label="Salpicones" value={g.falls} />
                <Stat icon={<Skull size={14} />} label="Atrapado" value={(g as DrGame & { catches?: number }).catches ?? 0} />
                <Stat icon={<Timer size={14} />} label="Tiempo" value={fmt(g.limit > 0 ? Math.max(0, g.limit - g.time) : g.time)} />
                <Stat icon={<Trophy size={14} />} label="G-P" value={`${g.ganadas}-${g.perdidas}`} />
                {g.queue > 0 && <Stat icon={<Gift size={14} />} label="En cola" value={g.queue} />}
              </div>
              <div className="flex h-3 overflow-hidden rounded-full bg-black/40">
                {g.colors.map((c, i) => (
                  <div key={i} className="h-full flex-1" style={{ background: i + 1 < g.level ? c : i + 1 === g.level ? '#fff' : `${c}30` }} />
                ))}
              </div>
              <div className="text-[11px] text-muted">
                {(g as DrGame & { monster?: boolean }).monster ? '☠ ¡La criatura te persigue! · ' : ''}Sala {Math.round(g.levelProgress * 100)}% · total {Math.round(g.progress * 100)}%{g.shield ? ' · 🛡 escudo' : ''}
                {g.protected ? ' · ✚ protegido' : ''}
                {g.streamer ? ` · jugando: ${g.streamer}` : ''}
              </div>
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {g?.running ? (
              <B cmd="ns stop" label={<><Square size={14} /> Terminar</>} />
            ) : (
              <>
                <input className="input w-44" placeholder={state?.config?.minecraft?.player || 'Tu nombre en Minecraft'} value={player} onChange={(e) => setPlayer(e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16))} />
                <button className="btn-accent" disabled={!!busy || !st?.loaded} onClick={() => run(`ns start ${player || state?.config?.minecraft?.player || ''}`.trim(), 'start')}>
                  {busy === 'start' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Empezar
                </button>
              </>
            )}
            <B cmd="ns mapa nuevo" label={<><MapIcon size={14} /> Mapa nuevo</>} disabled={g?.running} />
            <B cmd="ns marcador reiniciar" label={<><RotateCcw size={14} /> Marcador 0-0</>} />
            <button className="btn" onClick={useProfile}>
              <Gift size={14} /> Usar perfil de regalos
            </button>
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 font-bold">Probar efectos (sin regalos)</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {EFFECTS.map((e) => (
              <button key={e.cmd} className={`btn justify-start text-xs ${e.good ? 'hover:border-good/60' : 'hover:border-bad/60'}`} disabled={!!busy || !g?.running} onClick={() => run(`ns test ${e.cmd}`)}>
                <span className={e.good ? 'text-good' : 'text-bad'}>{e.icon}</span> {e.name}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted">Cada regalo del perfil «No Salpiques» manda uno de estos efectos con el nombre del espectador. Se aplican en cola, uno detrás de otro.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-5">
          <div className="mb-3 flex items-center">
            <span className="mr-auto font-bold">Ajustes</span>
            <button className="btn-accent" disabled={!settings || !!busy} onClick={save}>
              {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
            </button>
          </div>
          {!settings ? (
            <p className="text-sm text-muted">Arranca el servidor una vez con el plugin instalado para poder cambiar los ajustes.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <label key={f.key} className="block text-sm">
                  <span className="mb-1 block text-xs text-muted">
                    {f.label}
                    {f.hint ? <span className="opacity-60"> · {f.hint}</span> : null}
                  </span>
                  {f.type === 'bool' ? (
                    <select className="input" value={String(settings[f.key] ?? 'true')} onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}>
                      <option value="true">Sí</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <input className="input" type="number" step={f.type === 'number' ? 0.1 : 1} value={settings[f.key] ?? ''} onChange={(e) => setSettings({ ...settings, [f.key]: Number(e.target.value) })} />
                  )}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="card p-5">
          <div className="mb-3 font-bold">Overlay para el directo</div>
          <OverlayLinks url={url} w={420} h={720} />
        </div>
      </div>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="text-right">
      <div className="flex items-center justify-end gap-1 text-[11px] text-muted">
        {icon} {label}
      </div>
      <div className="text-lg font-black tabular-nums">{value}</div>
    </div>
  )
}
