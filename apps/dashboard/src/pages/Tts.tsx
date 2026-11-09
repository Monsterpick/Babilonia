import { useEffect, useMemo, useState } from 'react'
import { Copy, ExternalLink, Mic, Play, Settings2, Sparkles, Trash2, UserPlus, Users, Volume2, X } from 'lucide-react'
import { VOICE_PRESETS, guessGender, parseVoice, voiceLabel, type VoiceEffect } from '@livearena/shared'
import { api, overlayUrl } from '../lib/api'
import { useLiveState } from '../lib/live'
import { playAudio, speakNow } from '../lib/speech'
import { Check, Modal, PageHeader, Seg, Toggle } from '../components/ui'
import { toast } from '../components/Toast'

type Cfg = Record<string, any>
interface WinVoice {
  name: string
  gender: string
  culture: string
  arch: '64' | '32'
}

/** Voces instaladas en este equipo (las que también usará OBS). */
function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis?.getVoices?.() ?? [])
    load()
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = load
  }, [])
  const es = voices.filter((v) => v.lang.toLowerCase().startsWith('es'))
  const rest = voices.filter((v) => !v.lang.toLowerCase().startsWith('es'))
  return [...es, ...rest]
}

let winCache: { available: boolean; voices: WinVoice[] } | null = null
function useWindowsVoices() {
  const [data, setData] = useState(winCache)
  useEffect(() => {
    if (!winCache) api<{ available: boolean; voices: WinVoice[] }>('GET', '/api/tts/voices/windows').then((d) => setData((winCache = d)), () => setData({ available: false, voices: [] }))
  }, [])
  return data
}

const isLoquendo = (n: string) => /loquendo|\b(jorge|carmen|diego|soledad|francisca|javier|esperanza|leonor)\b/i.test(n)

/** Escucha una voz guardada (personaje, del PC o de Windows). */
async function preview(voice: string, text: string, rate: number, volume: number, effect: VoiceEffect) {
  const spec = parseVoice(voice)
  if (spec.kind === 'windows') {
    try {
      const r = await api<{ audio: string }>('POST', '/api/tts/preview', { voice, text })
      await playAudio(r.audio, effect, volume)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
    return
  }
  if (!window.speechSynthesis) return toast('Este navegador no tiene voces', 'error')
  speakNow(text, voice, rate, volume)
}

function VoicePicker({ value, onChange, allowDefault = true }: { value: string; onChange: (v: string) => void; allowDefault?: boolean }) {
  const browser = useVoices()
  const win = useWindowsVoices()
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {allowDefault && <option value="">Por defecto</option>}
      <optgroup label="Personajes">
        {VOICE_PRESETS.map((p) => (
          <option key={p.id} value={`p:${p.id}`}>
            {p.emoji} {p.name}
          </option>
        ))}
      </optgroup>
      {!!win?.voices.length && (
        <optgroup label="Voces de Windows">
          {win.voices.map((v) => (
            <option key={v.name} value={`w:${v.name}`}>
              {isLoquendo(v.name) ? '⭐ ' : '🪟 '}
              {v.name} · {v.culture}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="Voces del navegador / OBS">
        {browser.map((v) => (
          <option key={v.voiceURI} value={`b:${v.name}`}>
            {v.name} · {v.lang}
          </option>
        ))}
      </optgroup>
      {value && !value.startsWith('p:') && !value.startsWith('w:') && !value.startsWith('b:') && <option value={value}>{value}</option>}
    </select>
  )
}

export function TtsPage() {
  const live = useLiveState<Cfg>('ttscfg')
  const history = useLiveState<any[]>('ttshistory') ?? []
  const [cfg, setCfg] = useState<Cfg>({})
  const [openVoice, setOpenVoice] = useState(false)
  const [openRules, setOpenRules] = useState(false)
  const [genText, setGenText] = useState('')
  const [newUser, setNewUser] = useState('')
  const [newVoice, setNewVoice] = useState('p:robotica_h')
  const win = useWindowsVoices()
  const browser = useVoices()
  useEffect(() => {
    if (live) setCfg(live)
  }, [live])
  const set = (patch: Cfg) => {
    const merge = (a: any, b: any): any => (typeof a === 'object' && a && typeof b === 'object' && b && !Array.isArray(b) ? Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [k, k in b ? merge(a[k], b[k]) : a[k]])) : b)
    setCfg((c) => merge(c, patch))
    api('PUT', '/api/tts/settings', patch).catch((e) => toast((e as Error).message, 'error'))
  }
  const setUserVoice = async (user: string, voice: string) => {
    try {
      const perUser = await api<Record<string, string>>('PUT', '/api/tts/user', { user, voice })
      setCfg((c) => ({ ...c, perUser }))
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  const url = overlayUrl('tts')
  const rate = cfg.rate ?? 1
  const volume = cfg.volume ?? 0.9
  const effect = (cfg.windowsEffect ?? 'none') as VoiceEffect
  const perUser: Record<string, string> = cfg.perUser ?? {}
  const knownUsers = useMemo(() => [...new Set(history.map((h) => String(h.user).toLowerCase()))].filter((u) => !perUser[u]), [history, perUser])
  const loquendo = win?.voices.filter((v) => isLoquendo(v.name)) ?? []
  const esVoices = browser.filter((v) => v.lang.toLowerCase().startsWith('es'))

  return (
    <div className="pb-12">
      <PageHeader title="TTS · Voz" subtitle="Lee los comentarios de tu live en voz alta. Cada usuario puede tener su propia voz.">
        <Check on={cfg.enabled ?? false} onChange={(v) => set({ enabled: v })}>
          <b>{cfg.enabled ? 'Activado' : 'Desactivado'}</b>
        </Check>
      </PageHeader>

      <div className="space-y-4 px-8">
        <div className="card flex flex-wrap items-center gap-3 border-accent/30 p-4 text-sm">
          <Volume2 size={18} className="text-accent-2" />
          <span className="mr-auto">
            Añade esta fuente de navegador a OBS para que suene el TTS: <code className="text-[#c4b5fd]">{url}</code>
          </span>
          <button className="btn-accent" onClick={() => navigator.clipboard.writeText(url).then(() => toast('Enlace copiado'))}>
            <Copy size={14} /> Copiar
          </button>
          <a className="btn" href={url} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Abrir
          </a>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <button className="card flex flex-col items-start gap-2 p-5 text-left transition hover:border-accent/40" onClick={() => setOpenVoice(true)}>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent-2">
              <Mic size={20} />
            </div>
            <div className="font-bold">Voz general</div>
            <p className="text-sm text-muted">
              Ahora: <b className="text-white">{cfg.random ? 'Aleatoria' : voiceLabel(cfg.voice)}</b> · velocidad ×{rate.toFixed(1)}
            </p>
            <span className="mt-1 text-sm text-accent-2">Configurar voz →</span>
          </button>
          <button className="card flex flex-col items-start gap-2 p-5 text-left transition hover:border-accent/40" onClick={() => setOpenRules(true)}>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent-2">
              <Settings2 size={20} />
            </div>
            <div className="font-bold">Reglas</div>
            <p className="text-sm text-muted">Decide quién puede activar el TTS y qué mensajes se leen.</p>
            <span className="mt-1 text-sm text-accent-2">Configurar reglas →</span>
          </button>
          <div className="card flex flex-col items-start gap-2 p-5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent-2">
              <Play size={20} />
            </div>
            <div className="font-bold">Probar la voz</div>
            <p className="text-sm text-muted">
              {VOICE_PRESETS.length} personajes · {browser.length} voces del PC · {win?.voices.length ?? 0} de Windows
            </p>
            <button className="btn-accent mt-1" onClick={() => void preview('Hola, soy tu lector de comentarios de LiveArena', cfg.voice ?? '', rate, volume, effect)}>
              <Volume2 size={14} /> Escuchar
            </button>
          </div>
        </div>

        {/* ------------------------------ personajes ------------------------------ */}
        <div className="card p-5">
          <div className="mb-1 flex items-center gap-2">
            <Sparkles size={18} className="text-accent-2" />
            <h2 className="mr-auto text-lg font-bold">Personajes de voz</h2>
            <span className="text-xs text-muted">Usan las voces de tu PC con otro tono y velocidad</span>
          </div>
          {esVoices.length === 0 && browser.length > 0 && (
            <p className="mb-2 text-xs text-warn">No tienes voces en español instaladas: Windows → Configuración → Hora e idioma → Voz → Agregar voces (Español).</p>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {VOICE_PRESETS.map((p) => {
              const id = `p:${p.id}`
              const active = cfg.voice === id && !cfg.random
              return (
                <div key={p.id} className={`group rounded-xl border p-3 transition ${active ? 'border-accent bg-accent/10' : 'border-line hover:border-white/25'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{p.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{p.name}</div>
                      <div className="truncate text-[11px] text-muted">!voz {p.keywords[0]}</div>
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-2 min-h-[2rem] text-[11px] text-muted">{p.desc}</p>
                  <div className="mt-2 flex gap-1.5">
                    <button className="btn flex-1 justify-center py-1 text-xs" onClick={() => void preview(`Hola, así sueno como ${p.name}`, id, rate, volume, effect)}>
                      <Play size={12} /> Escuchar
                    </button>
                    <button className={`flex-1 justify-center py-1 text-xs ${active ? 'btn-accent' : 'btn'}`} onClick={() => set({ voice: id, random: false })}>
                      {active ? 'En uso' : 'Usar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* ------------------------------ por usuario ------------------------------ */}
          <div className="card p-5">
            <div className="mb-3 flex items-center gap-2">
              <Users size={18} className="text-accent-2" />
              <h2 className="mr-auto text-lg font-bold">Voz por usuario</h2>
              <span className="text-xs text-muted">{Object.keys(perUser).length} asignadas</span>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <input className="input min-w-40 flex-1" list="tts-users" placeholder="@usuario de TikTok" value={newUser} onChange={(e) => setNewUser(e.target.value)} />
              <datalist id="tts-users">
                {knownUsers.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
              <div className="min-w-52 flex-1">
                <VoicePicker value={newVoice} onChange={setNewVoice} allowDefault={false} />
              </div>
              <button
                className="btn-accent"
                disabled={!newUser.trim()}
                onClick={() => {
                  void setUserVoice(newUser, newVoice)
                  setNewUser('')
                }}
              >
                <UserPlus size={14} /> Asignar
              </button>
            </div>
            {Object.keys(perUser).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Nadie tiene voz propia todavía. Asigna una arriba o desde el historial.</p>
            ) : (
              <div className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/5">
                {Object.entries(perUser).map(([user, voice]) => (
                  <div key={user} className="flex items-center gap-2 px-3 py-2">
                    <span className="w-40 truncate font-semibold text-accent-2">@{user}</span>
                    <div className="flex-1">
                      <VoicePicker value={voice} onChange={(v) => void setUserVoice(user, v)} allowDefault={false} />
                    </div>
                    <button className="btn px-2" title="Escuchar" onClick={() => void preview(`Hola, soy ${user}`, voice, rate, volume, effect)}>
                      <Play size={14} />
                    </button>
                    <button className="btn px-2 text-bad" title="Quitar" onClick={() => void setUserVoice(user, '')}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <Toggle on={cfg.viewerChoice ?? false} onChange={(v) => set({ viewerChoice: v })} />
              <div className="text-sm">
                <b>Los espectadores eligen su voz</b> escribiendo <code className="text-accent-2">!voz robot</code>, <code className="text-accent-2">!voz ardilla</code>…
                <div className="mt-1 flex flex-wrap gap-1">
                  {VOICE_PRESETS.map((p) => (
                    <span key={p.id} className="chip text-[11px]">
                      {p.emoji} {p.keywords[0]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------------ Windows ------------------------------ */}
          <div className="card p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">🪟</span>
              <h2 className="mr-auto text-lg font-bold">Voces de Windows</h2>
            </div>
            {!win ? (
              <p className="text-sm text-muted">Buscando voces…</p>
            ) : !win.available ? (
              <p className="text-sm text-muted">Solo en Windows. Ahí aparecen todas las voces SAPI instaladas, también las de 32 bits.</p>
            ) : (
              <>
                {loquendo.length > 0 ? (
                  <p className="mb-3 rounded-lg bg-ok/10 p-2 text-xs text-ok">⭐ Detectadas voces de estilo Loquendo: {loquendo.map((v) => v.name).join(', ')}. Elígelas en cualquier selector de voz.</p>
                ) : (
                  <p className="mb-3 rounded-lg bg-white/5 p-2 text-xs text-muted">
                    Las voces Loquendo (Jorge, Carmen…) son de pago y no se pueden incluir en la app. Si las tienes instaladas en Windows aparecerán aquí con ⭐. Mientras tanto, los personajes «Robótica clásica» imitan ese estilo.
                  </p>
                )}
                <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                  {win.voices.map((v) => (
                    <div key={v.name} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/5">
                      <span className="flex-1 truncate text-sm">
                        {isLoquendo(v.name) ? '⭐ ' : ''}
                        {v.name}
                      </span>
                      <span className="text-[11px] text-muted">
                        {v.culture} · {v.gender === 'Male' ? 'hombre' : v.gender === 'Female' ? 'mujer' : guessGender(v.name) ?? ''} · {v.arch} bits
                      </span>
                      <button className="btn px-2 py-0.5" onClick={() => void preview('Hola, soy una voz de Windows', `w:${v.name}`, rate, volume, effect)}>
                        <Play size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <span className="label">Efecto para voces de Windows</span>
                  <Seg
                    value={effect}
                    options={[
                      { v: 'none', l: 'Ninguno' },
                      { v: 'robot', l: 'Robot' },
                      { v: 'eco', l: 'Eco' },
                      { v: 'radio', l: 'Radio' },
                      { v: 'grave', l: 'Grave' },
                      { v: 'agudo', l: 'Agudo' },
                    ]}
                    onChange={(v) => set({ windowsEffect: v })}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="mr-auto text-lg font-bold">Historial</h2>
            <button className="btn" onClick={() => api('POST', '/api/tts/clear')}>
              <Trash2 size={14} /> Limpiar
            </button>
          </div>
          {history.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Aún no se ha leído nada. Conecta tu live o escribe en el chat.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/5">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Hora</th>
                    <th className="px-3 py-2 text-left font-semibold">Usuario</th>
                    <th className="px-3 py-2 text-left font-semibold">Mensaje</th>
                    <th className="w-60 px-3 py-2 text-left font-semibold">Voz de este usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-white/5">
                      <td className="px-3 py-1.5 text-muted">{new Date(h.ts).toLocaleTimeString('es')}</td>
                      <td className="px-3 py-1.5 font-semibold text-accent-2">@{h.nick}</td>
                      <td className="px-3 py-1.5">{h.text}</td>
                      <td className="px-3 py-1">
                        <VoicePicker value={perUser[String(h.user).toLowerCase()] ?? ''} onChange={(v) => void setUserVoice(String(h.user), v)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-2 flex items-center gap-2">
            <Volume2 size={18} className="text-accent-2" />
            <h2 className="font-bold">Decir algo ahora</h2>
          </div>
          <p className="mb-3 text-sm text-muted">Suena en la fuente de OBS con la voz general.</p>
          <div className="flex gap-2">
            <input className="input" placeholder="Escribe el texto…" value={genText} onChange={(e) => setGenText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && genText && void api('POST', '/api/tts/say', { text: genText })} />
            <button className="btn-accent" disabled={!genText} onClick={() => void api('POST', '/api/tts/say', { text: genText }).catch(() => undefined)}>
              <Play size={14} /> Decir
            </button>
          </div>
        </div>
      </div>

      <Modal open={openVoice} onClose={() => setOpenVoice(false)} title="Voz general y lectura" wide>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <span className="label">Voz general</span>
              <VoicePicker value={cfg.voice ?? ''} onChange={(v) => set({ voice: v })} />
            </div>
            <Check on={cfg.random ?? false} onChange={(v) => set({ random: v })}>
              Voz aleatoria (cada mensaje con un personaje distinto; los usuarios con voz propia la conservan)
            </Check>
            <div>
              <span className="label">Formato del mensaje</span>
              <input className="input" value={cfg.template ?? ''} onChange={(e) => set({ template: e.target.value })} placeholder="{username} dice: {comment}" />
              <p className="mt-1 text-xs text-muted">Variables: {'{username}'}, {'{nickname}'}, {'{comment}'}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted">Velocidad</span>
                <span className="font-mono">×{rate.toFixed(1)}</span>
              </div>
              <input type="range" min={0.5} max={2} step={0.1} value={rate} onChange={(e) => set({ rate: Number(e.target.value) })} className="w-full accent-[var(--color-hot)]" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted">Volumen</span>
                <span className="font-mono">{Math.round(volume * 100)}%</span>
              </div>
              <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => set({ volume: Number(e.target.value) })} className="w-full accent-[var(--color-hot)]" />
            </div>
            <button className="btn" onClick={() => void preview('Prueba de la voz seleccionada', cfg.voice ?? '', rate, volume, effect)}>
              <Volume2 size={14} /> Probar sonido
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={openRules} onClose={() => setOpenRules(false)} title="Reglas del TTS" wide>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <h3 className="font-bold">Quién puede activarlo</h3>
            <Check on={cfg.who?.everyone ?? true} onChange={(v) => set({ who: { everyone: v } })}>
              <b>Todos los usuarios</b> (ignora los filtros de abajo)
            </Check>
            <div className={cfg.who?.everyone ? 'pointer-events-none space-y-2 opacity-40' : 'space-y-2'}>
              <Check on={cfg.who?.followers ?? false} onChange={(v) => set({ who: { followers: v } })}>
                Seguidores
              </Check>
              <Check on={cfg.who?.subscribers ?? false} onChange={(v) => set({ who: { subscribers: v } })}>
                Suscriptores
              </Check>
              <Check on={cfg.who?.moderators ?? false} onChange={(v) => set({ who: { moderators: v } })}>
                Moderadores
              </Check>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="font-bold">Qué se lee</h3>
            <div>
              <span className="label">Activación</span>
              <Seg
                value={cfg.mode ?? 'all'}
                options={[
                  { v: 'all', l: 'Todos los comentarios' },
                  { v: 'prefix', l: 'Solo con prefijo' },
                ]}
                onChange={(v) => set({ mode: v })}
              />
              {cfg.mode === 'prefix' && (
                <input className="input mt-2 w-24" value={cfg.prefix ?? '!'} onChange={(e) => set({ prefix: e.target.value })} placeholder="!" />
              )}
            </div>
            <Check on={cfg.filters?.stripEmojis ?? true} onChange={(v) => set({ filters: { stripEmojis: v } })}>
              Quitar emojis y otros alfabetos
            </Check>
            <Check on={cfg.filters?.ignoreTiktokEmojis ?? true} onChange={(v) => set({ filters: { ignoreTiktokEmojis: v } })}>
              Ignorar los códigos de TikTok tipo [laughcry]
            </Check>
            <div className="border-t border-white/5 pt-3">
              <h3 className="mb-2 font-bold">Antirrepetición</h3>
              <Check on={cfg.antispam?.noRepeat ?? false} onChange={(v) => set({ antispam: { noRepeat: v } })}>
                No repetir el mismo mensaje
              </Check>
              <div className="mt-2">
                <span className="label">Turno para otros</span>
                <Seg value={cfg.antispam?.turnSeconds ?? 5} options={[{ v: 0, l: 'No' }, { v: 5, l: '5 s' }, { v: 15, l: '15 s' }, { v: 30, l: '30 s' }]} onChange={(v) => set({ antispam: { turnSeconds: v } })} />
              </div>
              <div className="mt-2">
                <span className="label">Máximo en cola</span>
                <Seg value={cfg.antispam?.maxQueue ?? 25} options={[{ v: 10, l: '10' }, { v: 25, l: '25' }, { v: 50, l: '50' }, { v: 100, l: '100' }]} onChange={(v) => set({ antispam: { maxQueue: v } })} />
              </div>
              <div className="mt-2">
                <span className="label">Largo máximo</span>
                <Seg value={cfg.antispam?.maxLen ?? 200} options={[{ v: 100, l: '100' }, { v: 200, l: '200' }, { v: 300, l: '300' }, { v: 500, l: '500' }]} onChange={(v) => set({ antispam: { maxLen: v } })} />
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
