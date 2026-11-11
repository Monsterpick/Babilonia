import { useEffect, useState } from 'react'
import { Crown, ExternalLink, FlaskConical, Play, RotateCcw, Save, Smartphone, Trophy } from 'lucide-react'
import { api, overlayUrl } from '../lib/api'
import { toast } from '../components/Toast'
import { LEGEND } from '../overlays/LastHouse'

/**
 * Pestaña LAST HOUSE (juego web propio): abrir el juego, ajustes, qué hace cada espectador en cada modo, overlays,
 * y la progresión entre partidas (récords, tablas históricas, logros y coronas cosméticas).
 */

interface Settings {
  mode: 'invasion' | 'defensa'
  duration: number
  assaults: number
  houseHp: number
  likesPer: number
  voteEvery: number
  adaptive: boolean
  vertical: boolean
  volume: number
  music: boolean
  crown: string
}

interface Progress {
  totals: { played: number; invasionWins: number; invasionLosses: number; defenseWins: number; defenseLosses: number }
  records: { fastestInvasion: number | null; mostKills: number; bestHouse: number; mostViewers: number }
  recent: { at: number; mode: 'invasion' | 'defensa'; winner: string; played: number; top: { name: string; score: number }[] }[]
  guardians: { name: string; score: number }[]
  horde: { name: string; score: number }[]
  achievements: { id: string; name: string; desc: string; at: number | null }[]
  crowns: { id: string; name: string; color: string; wins: number; unlocked: boolean }[]
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function LastHousePanel() {
  const url = `${location.origin}/juego/lasthouse`
  const [st, setSt] = useState<Settings | null>(null)
  const [draft, setDraft] = useState<Settings | null>(null)
  const [pr, setPr] = useState<Progress | null>(null)
  const [tab, setTab] = useState<'invasion' | 'defensa'>('invasion')

  const load = () => {
    api<Settings>('GET', '/api/lasthouse/settings')
      .then((s) => {
        setSt(s)
        setDraft(s)
        setTab(s.mode)
      })
      .catch(() => undefined)
    api<Progress>('GET', '/api/lasthouse/progress')
      .then(setPr)
      .catch(() => undefined)
  }
  useEffect(load, [])

  const save = async (patch?: Partial<Settings>) => {
    if (!draft) return
    try {
      const s = await api<Settings>('PUT', '/api/lasthouse/settings', { ...draft, ...patch })
      setSt(s)
      setDraft(s)
      toast('Ajustes de LAST HOUSE guardados. Se aplican en la siguiente partida.')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const reset = async () => {
    if (!confirm('¿Borrar récords, tablas, logros y partidas de LAST HOUSE? Las coronas desbloqueadas también se pierden.')) return
    await api('POST', '/api/lasthouse/progress/reset')
    load()
    toast('Progresión borrada')
  }

  const dirty = JSON.stringify(st) !== JSON.stringify(draft)
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => draft && setDraft({ ...draft, [k]: v })
  const num = (k: keyof Settings, label: string, min: number, max: number, step = 1, hint?: string) => (
    <label className="block text-sm">
      <span className="text-muted">{label}</span>
      <input className="input mt-1 w-full" type="number" min={min} max={max} step={step} value={Number(draft?.[k] ?? 0)} onChange={(e) => set(k, Math.max(min, Math.min(max, Number(e.target.value) || min)) as never)} />
      {hint && <span className="mt-0.5 block text-[11px] text-muted">{hint}</span>}
    </label>
  )
  const check = (k: 'adaptive' | 'vertical' | 'music', label: string, hint: string) => (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1" checked={!!draft?.[k]} onChange={(e) => set(k, e.target.checked)} />
      <span>
        {label}
        <span className="block text-[11px] text-muted">{hint}</span>
      </span>
    </label>
  )

  const t = pr?.totals
  return (
    <div className="space-y-5 px-8">
      <div className="card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-700/40 via-fuchsia-600/20 to-emerald-500/20" />
        <div className="relative flex flex-wrap items-center gap-6 p-6">
          <img src="/lasthouse/icono.jpg" alt="" className="h-28 w-28 rounded-2xl border-2 border-white/20 object-cover shadow-xl" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold tracking-widest text-violet-300 uppercase">Juego propio · fuera de Minecraft</div>
            <h2 className="mt-1 text-3xl font-black tracking-tight">LAST HOUSE</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              Dos modos: en <b>Invasión</b> eres el Rey de la Horda y tus espectadores plantan defensas para frenarte; en <b>Defensa</b> eres el Guardián de la casa y tus espectadores mandan la horda. Se abre en una ventana y la capturas en
              TikTok LIVE Studio u OBS. Mientras juegas se activa un perfil vacío para que no salte ninguna acción de Minecraft.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a className="btn btn-accent" href={url} target="_blank" rel="noreferrer">
                <Play size={15} /> Abrir el juego
              </a>
              <a className="btn" href={`${url}?vertical=1`} target="_blank" rel="noreferrer" title="Interfaz para directos en vertical (9:16)">
                <Smartphone size={15} /> Vertical 9:16
              </a>
              <a className="btn" href={`${url}?demo=1&modo=${tab}`} target="_blank" rel="noreferrer" title="Se juega solo, con espectadores simulados">
                <FlaskConical size={15} /> Ver demostración
              </a>
            </div>
          </div>
          {t && (
            <div className="grid grid-cols-2 gap-2 text-center text-sm">
              <Stat label="Partidas" value={t.played} />
              <Stat label="Victorias" value={t.invasionWins + t.defenseWins} />
              <Stat label="Invasión" value={`${t.invasionWins}–${t.invasionLosses}`} />
              <Stat label="Defensa" value={`${t.defenseWins}–${t.defenseLosses}`} />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <div className="card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold">Qué hace cada espectador</div>
              <div className="flex gap-1 rounded-xl bg-white/5 p-1 text-xs font-bold">
                {(['invasion', 'defensa'] as const).map((m) => (
                  <button key={m} className={`rounded-lg px-3 py-1 ${tab === m ? 'bg-white/15' : 'text-muted'}`} onClick={() => setTab(m)}>
                    {m === 'invasion' ? 'Invasión (plantan)' : 'Defensa (mandan la horda)'}
                  </button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-line/60 text-sm">
              {LEGEND[tab].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-1.5">
                  <span>{k}</span>
                  <span className="text-right text-xs text-muted">{v}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              Lo gratis (likes, comentarios, follows, compartidos) sale de un presupuesto común que se rellena a ritmo fijo, así que 10 o 10.000 espectadores aprietan parecido y nadie puede inundar la partida. Los regalos siempre hacen algo;
              si llegan muchísimos, tu personaje gana <b>poder</b> para compensar. Los regalos de 99 o más van en una cola con 5 s entre uno y otro. Cada cierto tiempo el chat vota un evento escribiendo <b>1</b> o <b>2</b> (un voto por persona).
            </p>
          </div>

          {pr && (
            <div className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold">
                  <Trophy size={16} /> Logros
                </div>
                <button className="btn px-2.5 py-1 text-xs" onClick={reset} title="Borra récords, tablas y logros">
                  <RotateCcw size={13} /> Reiniciar
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {pr.achievements.map((a) => (
                  <div key={a.id} className={`rounded-xl border p-2.5 text-sm ${a.at ? 'border-amber-300/40 bg-amber-300/10' : 'border-line/60 opacity-55'}`}>
                    <div className="font-bold">
                      {a.at ? '🏆' : '🔒'} {a.name}
                    </div>
                    <div className="text-xs text-muted">{a.desc}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Board title="Mejores guardianes (histórico)" rows={pr.guardians} unit="🌱" />
                <Board title="Mejores de la horda (histórico)" rows={pr.horde} unit="🧟" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
                <Stat label="Invasión más rápida" value={pr.records.fastestInvasion ? mmss(pr.records.fastestInvasion) : '—'} />
                <Stat label="Más zombis derribados" value={pr.records.mostKills} />
                <Stat label="Casa mejor conservada" value={pr.records.bestHouse ? `${Math.round(pr.records.bestHouse * 100)} %` : '—'} />
                <Stat label="Más espectadores" value={pr.records.mostViewers} />
              </div>
              {pr.recent.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1 text-xs font-bold text-muted uppercase">Últimas partidas</div>
                  <div className="divide-y divide-line/60 text-sm">
                    {pr.recent.map((g) => (
                      <div key={g.at} className="flex justify-between gap-3 py-1">
                        <span>
                          {g.mode === 'invasion' ? '👑' : '🛡️'} {g.winner === 'rey' || g.winner === 'guardian' ? <b className="text-emerald-300">Ganaste</b> : <span className="text-rose-300">Perdiste</span>} · {mmss(g.played)}
                        </span>
                        <span className="truncate text-xs text-muted">{g.top[0] ? `MVP: ${g.top[0].name}` : ''} · {new Date(g.at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-5">
          {draft && (
            <div className="card space-y-3 p-5">
              <div className="font-bold">Ajustes del juego</div>
              <label className="block text-sm">
                <span className="text-muted">Modo al abrir</span>
                <select className="input mt-1 w-full" value={draft.mode} onChange={(e) => set('mode', e.target.value as Settings['mode'])}>
                  <option value="invasion">Invasión (tú eres el Rey)</option>
                  <option value="defensa">Defensa (tú eres el Guardián)</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {num('duration', 'Duración (s)', 120, 900, 30)}
                {num('assaults', 'Asaltos para ganar', 1, 10)}
                {num('houseHp', 'Vida de la casa', 500, 6000, 100)}
                {num('likesPer', 'Likes por acción', 1, 200)}
                {num('voteEvery', 'Votación cada (s)', 0, 600, 15, '0 = sin votaciones')}
                <label className="block text-sm">
                  <span className="text-muted">Volumen</span>
                  <input className="mt-3 w-full" type="range" min={0} max={1} step={0.05} value={draft.volume} onChange={(e) => set('volume', Number(e.target.value))} />
                </label>
              </div>
              {check('adaptive', 'Dificultad adaptativa', 'Presupuesto común, tensión y poder del streamer (recomendado)')}
              {check('vertical', 'Interfaz vertical 9:16', 'Para directos desde el móvil')}
              {check('music', 'Música', 'Música propia que sube de intensidad con la partida (M para silenciar)')}
              <button className="btn btn-accent w-full" disabled={!dirty} onClick={() => save()}>
                <Save size={14} /> Guardar ajustes
              </button>
            </div>
          )}

          {pr && draft && (
            <div className="card p-5">
              <div className="mb-1 flex items-center gap-2 font-bold">
                <Crown size={16} /> Corona del Rey
              </div>
              <div className="mb-3 text-xs text-muted">Solo cambia el color (no da ventaja). Se desbloquean ganando partidas.</div>
              <div className="grid grid-cols-4 gap-2">
                {pr.crowns.map((c) => (
                  <button
                    key={c.id}
                    disabled={!c.unlocked}
                    title={c.unlocked ? c.name : `Gana ${c.wins} partidas`}
                    onClick={() => save({ crown: c.id })}
                    className={`rounded-xl border p-2 text-center text-[11px] font-bold ${draft.crown === c.id ? 'border-white/70 bg-white/10' : 'border-line/60'} ${c.unlocked ? '' : 'opacity-40'}`}
                  >
                    <div className="mx-auto mb-1 h-6 w-6 rounded-full border border-black/30" style={{ background: c.color, boxShadow: c.unlocked ? `0 0 10px ${c.color}` : undefined }} />
                    {c.unlocked ? c.name : `🔒 ${c.wins}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card space-y-3 p-5 text-sm">
            <div className="font-bold">Enlaces para capturar</div>
            <LinkRow label="Juego" value={url} />
            <LinkRow label="Overlay: marcador y votación" value={overlayUrl('lasthouse')} />
            <LinkRow label="Overlay: qué hace cada regalo" value={overlayUrl('lasthouse-regalos')} />
            <p className="text-xs text-muted">Abre el juego en una ventana, juega ahí con el teclado y captura esa ventana. Los overlays van como fuente de navegador encima.</p>
          </div>

          <div className="card p-5 text-sm">
            <div className="mb-2 font-bold">Controles</div>
            <div className="space-y-1 text-muted">
              <div><b className="text-white">W A S D</b> moverte · <b className="text-white">Espacio / clic</b> atacar o disparar</div>
              <div><b className="text-white">Shift</b> embestida / esquiva · <b className="text-white">E</b> rugido / onda</div>
              <div><b className="text-white">Q</b> esbirros / plantar · <b className="text-white">1–6</b> elegir defensa (Defensa)</div>
              <div><b className="text-white">C</b> cámara · <b className="text-white">M</b> sonido · <b className="text-white">R</b> otra partida · <b className="text-white">Esc</b> menú</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line/60 bg-black/20 px-3 py-2">
      <div className="text-lg font-black">{value}</div>
      <div className="text-[10px] font-bold tracking-wide text-muted uppercase">{label}</div>
    </div>
  )
}

function Board({ title, rows, unit }: { title: string; rows: { name: string; score: number }[]; unit: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-bold text-muted uppercase">{title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted">Aún nadie.</div>
      ) : (
        rows.map((r, i) => (
          <div key={r.name} className="flex justify-between text-sm">
            <span className="truncate">
              {i + 1}. {r.name}
            </span>
            <span className="text-muted">
              {r.score} {unit}
            </span>
          </div>
        ))
      )}
    </div>
  )
}

function LinkRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-xs text-muted">{label}</div>
      <div className="flex gap-2">
        <input className="input min-w-0 flex-1 font-mono text-xs" readOnly value={value} onFocus={(e) => e.currentTarget.select()} />
        <a className="btn" href={value} target="_blank" rel="noreferrer">
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  )
}
