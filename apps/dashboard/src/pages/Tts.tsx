import { useEffect, useRef, useState } from 'react'
import { Copy, ExternalLink, Mic, Play, Settings2, Trash2, Volume2 } from 'lucide-react'
import { api, overlayUrl } from '../lib/api'
import { useLiveState } from '../lib/live'
import { Check, Modal, PageHeader, Seg } from '../components/ui'
import { toast } from '../components/Toast'

type Cfg = Record<string, any>

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
  return { voices, ordered: [...es, ...rest] }
}

function VoiceSelect({ value, onChange, allowRandom }: { value: string; onChange: (v: string) => void; allowRandom?: boolean }) {
  const { ordered } = useVoices()
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {allowRandom && <option value="">Aleatoria (español)</option>}
      {ordered.map((v) => (
        <option key={v.voiceURI} value={v.name}>
          {v.name} · {v.lang}
        </option>
      ))}
    </select>
  )
}

function speak(text: string, voiceName: string, rate = 1, volume = 1) {
  if (!window.speechSynthesis) return toast('Tu navegador no tiene voces', 'error')
  const list = window.speechSynthesis.getVoices()
  const u = new SpeechSynthesisUtterance(text)
  u.voice = list.find((v) => v.name === voiceName) ?? list.find((v) => v.lang.startsWith('es')) ?? null
  u.rate = rate
  u.volume = volume
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

export function TtsPage() {
  const live = useLiveState<Cfg>('ttscfg')
  const history = useLiveState<any[]>('ttshistory') ?? []
  const [cfg, setCfg] = useState<Cfg>({})
  const [openVoice, setOpenVoice] = useState(false)
  const [openRules, setOpenRules] = useState(false)
  const [genText, setGenText] = useState('')
  useEffect(() => {
    if (live) setCfg(live)
  }, [live])
  const set = (patch: Cfg) => {
    const merge = (a: any, b: any): any => (typeof a === 'object' && a && typeof b === 'object' && b && !Array.isArray(b) ? Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [k, k in b ? merge(a[k], b[k]) : a[k]])) : b)
    setCfg((c) => merge(c, patch))
    api('PUT', '/api/tts/settings', patch).catch((e) => toast((e as Error).message, 'error'))
  }
  const url = overlayUrl('tts')

  return (
    <div className="pb-12">
      <PageHeader title="TTS · Voz" subtitle="Lee los comentarios de tu live en voz alta con las voces de tu PC (también funcionan en OBS).">
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
            <div className="font-bold">Voz</div>
            <p className="text-sm text-muted">Elige la voz, la velocidad y cómo se anuncia cada mensaje.</p>
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
            <p className="text-sm text-muted">Escucha cómo suena con los ajustes actuales.</p>
            <button className="btn-accent mt-1" onClick={() => speak('Hola, soy tu lector de comentarios de LiveArena', cfg.voice ?? '', cfg.rate ?? 1, cfg.volume ?? 1)}>
              <Volume2 size={14} /> Escuchar
            </button>
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
                    <th className="px-3 py-2 text-left font-semibold">Voz</th>
                    <th className="px-3 py-2 text-left font-semibold">Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-white/5">
                      <td className="px-3 py-1.5 text-muted">{new Date(h.ts).toLocaleTimeString('es')}</td>
                      <td className="px-3 py-1.5 font-semibold text-accent-2">@{h.nick}</td>
                      <td className="px-3 py-1.5 text-muted">{h.voice}</td>
                      <td className="px-3 py-1.5">{h.text}</td>
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
          <p className="mb-3 text-sm text-muted">Suena en la fuente de OBS (si está abierta) y en este panel.</p>
          <div className="flex gap-2">
            <input className="input" placeholder="Escribe el texto…" value={genText} onChange={(e) => setGenText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && genText && (speak(genText, cfg.voice ?? '', cfg.rate ?? 1, cfg.volume ?? 1), api('POST', '/api/tts/say', { text: genText }))} />
            <button
              className="btn-accent"
              disabled={!genText}
              onClick={() => {
                speak(genText, cfg.voice ?? '', cfg.rate ?? 1, cfg.volume ?? 1)
                api('POST', '/api/tts/say', { text: genText }).catch(() => undefined)
              }}
            >
              <Play size={14} /> Decir
            </button>
          </div>
        </div>
      </div>

      <Modal open={openVoice} onClose={() => setOpenVoice(false)} title="Voz y lectura" wide>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <span className="label">Voz por defecto</span>
              <VoiceSelect value={cfg.voice ?? ''} onChange={(v) => set({ voice: v })} allowRandom />
            </div>
            <Check on={cfg.random ?? false} onChange={(v) => set({ random: v })}>
              Voz aleatoria (cada mensaje con una voz distinta)
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
                <span className="font-mono">×{(cfg.rate ?? 1).toFixed(1)}</span>
              </div>
              <input type="range" min={0.5} max={2} step={0.1} value={cfg.rate ?? 1} onChange={(e) => set({ rate: Number(e.target.value) })} className="w-full accent-[var(--color-hot)]" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted">Volumen</span>
                <span className="font-mono">{Math.round((cfg.volume ?? 0.9) * 100)}%</span>
              </div>
              <input type="range" min={0} max={1} step={0.05} value={cfg.volume ?? 0.9} onChange={(e) => set({ volume: Number(e.target.value) })} className="w-full accent-[var(--color-hot)]" />
            </div>
            <button className="btn" onClick={() => speak('Prueba de la voz seleccionada', cfg.voice ?? '', cfg.rate ?? 1, cfg.volume ?? 1)}>
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
