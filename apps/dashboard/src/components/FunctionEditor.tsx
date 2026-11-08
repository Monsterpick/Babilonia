import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, HelpCircle, ImagePlus, LayoutGrid, Play, PlayCircle, Plus, Search, Trash2, Upload, X } from 'lucide-react'
import type { Action, EventRule, Step, Trigger } from '@livearena/shared'
import { api, upload } from '../lib/api'
import { GALLERY, type GalleryCommand } from '../lib/gallery'
import { Check, Field, Media, Modal, Seg } from './ui'
import { GiftPicker } from './GiftPicker'
import { STEP_TYPES, StepFields, TRIGGERS, defaultStep, defaultTrigger } from './RuleEditor'
import { toast } from './Toast'

const MAX_COMMANDS = 30
const clamp = (v: string | number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)))

/** Separa los pasos de la acción en «comandos» (lo principal) y «pasos avanzados». */
function splitSteps(steps: Step[]): { commands: string[]; advanced: Step[] } {
  const commands: string[] = []
  const advanced: Step[] = []
  for (const s of steps) {
    if (s.type === 'minecraft.command' && s.mode === 'all') commands.push(...s.commands)
    else advanced.push(s)
  }
  return { commands, advanced }
}

export const VARIABLES: [string, string][] = [
  ['{player}', 'Tu jugador de Minecraft (también {nick})'],
  ['{nickname}', 'Nombre del espectador en una palabra (para /survival …)'],
  ['{user}', 'Nombre del espectador tal cual (puede tener espacios)'],
  ['{quien}', '@usuario del espectador (también {username}) — el [donador] de MiniLive'],
  ['{gift}', 'Nombre del regalo'],
  ['{gift.count}', 'Cantidad de esta parte de la racha'],
  ['{gift.diamonds}', 'Monedas del regalo'],
  ['{likes}', 'Likes totales de la sala'],
  ['{comment}', 'Texto del comentario'],
  ['{args.0}', 'Primer argumento de un !comando'],
  ['{random:1-10}', 'Número al azar'],
]

export function FunctionEditor({
  initialEvent,
  initialAction,
  isNew,
  sharedWith,
  onCancel,
  onSave,
}: {
  initialEvent: EventRule
  initialAction: Action
  isNew: boolean
  sharedWith: number
  onCancel: () => void
  onSave: (e: EventRule, a: Action) => Promise<void>
}) {
  const split = useMemo(() => splitSteps(initialAction.steps), [initialAction])
  const [ev, setEv] = useState<EventRule>(structuredClone(initialEvent))
  const [ac, setAc] = useState<Action>(structuredClone(initialAction))
  const [commands, setCommands] = useState<string[]>(split.commands.length || split.advanced.length ? split.commands : [''])
  const [advanced, setAdvanced] = useState<Step[]>(split.advanced)
  const [showAdvanced, setShowAdvanced] = useState(split.advanced.length > 0)
  const [gallery, setGallery] = useState(false)
  const [vars, setVars] = useState(false)
  const [busy, setBusy] = useState(false)
  const t = ev.trigger
  const setT = (trigger: Trigger) => setEv({ ...ev, trigger })

  const steps = (): Step[] => [...commands.map((c) => c.trim()).filter(Boolean).map((c) => ({ type: 'minecraft.command' as const, commands: [c], mode: 'all' as const })), ...advanced]

  const testCommand = async (cmd: string) => {
    if (!cmd.trim()) return
    try {
      const r = await api<{ command: string; response: string }>('POST', '/api/minecraft/test-command', { command: cmd.trim().replace(/^\//, '') })
      toast(`${r.command} → ${r.response || 'ok'}`, 'info')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const onMedia = async (f: File | undefined) => {
    if (!f) return
    try {
      const r = await upload('/api/media/upload', f)
      if (r.kind === 'audio') return toast('Para la imagen usa png, jpg, gif, webp o un video', 'error')
      setAc({ ...ac, media: { kind: r.kind, url: r.url } })
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  const onSound = async (f: File | undefined) => {
    if (!f) return
    try {
      const r = await upload('/api/media/upload', f)
      setEv({ ...ev, sound: { file: r.url, volume: ev.sound?.volume ?? 1, every: ev.sound?.every ?? 'first' } })
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <Modal open onClose={onCancel} title={isNew ? 'Nuevo comando' : `Editar · ${ac.name}`} wide>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        {/* ------------------------------ CUÁNDO ------------------------------ */}
        <div className="space-y-4">
          <div className="text-xs font-semibold tracking-widest text-muted">CUÁNDO</div>
          <div className="flex flex-wrap gap-1.5">
            {TRIGGERS.map((x) => (
              <button
                key={x.v}
                onClick={() => setT(defaultTrigger(x.v))}
                className={`rounded-full border px-3 py-1 text-sm ${t.type === x.v ? 'border-accent bg-accent/15' : 'border-line text-muted hover:text-white'}`}
              >
                {x.l}
              </button>
            ))}
          </div>
          {t.type === 'gift' && (
            <>
              <div className="flex flex-wrap gap-2">
                {t.gifts.map((g) => (
                  <span key={g.name} className="flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-sm">
                    {g.name} <span className="text-warn">🪙{g.diamonds ?? '?'}</span>
                    {t.gifts.length > 1 && (
                      <button onClick={() => setT({ ...t, gifts: t.gifts.filter((x) => x.name !== g.name) })}>
                        <X size={13} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              <GiftPicker
                multi
                selected={t.gifts.map((g) => g.name)}
                onPick={(g) => {
                  const has = t.gifts.some((x) => x.name.toLowerCase() === g.name.toLowerCase())
                  if (has && t.gifts.length > 1) setT({ ...t, gifts: t.gifts.filter((x) => x.name.toLowerCase() !== g.name.toLowerCase()) })
                  else if (!has) {
                    const pick = { name: g.name, diamonds: g.diamonds, id: g.id }
                    setT({ ...t, gifts: isNew && t.gifts.length === 1 && t.gifts[0]!.name === 'Rose' ? [pick] : [...t.gifts, pick] })
                  }
                }}
              />
            </>
          )}
          {t.type === 'diamonds' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mínimo (monedas)">
                <input type="number" className="input" value={t.min} onChange={(e) => setT({ ...t, min: clamp(e.target.value, 0, 1e7) })} />
              </Field>
              <Field label="Máximo (vacío = sin límite)">
                <input type="number" className="input" value={t.max ?? ''} onChange={(e) => setT({ ...t, max: e.target.value ? clamp(e.target.value, 0, 1e7) : undefined })} />
              </Field>
            </div>
          )}
          {t.type === 'likes' && (
            <Field label="Cada cuántos likes de una misma persona">
              <input type="number" min={1} className="input w-40" value={t.every} onChange={(e) => setT({ ...t, every: clamp(e.target.value, 1, 1e6) })} />
            </Field>
          )}
          {t.type === 'room_likes' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Primera meta (likes de la sala)">
                <input type="number" className="input" value={t.goal} onChange={(e) => setT({ ...t, goal: clamp(e.target.value, 1, 1e9) })} />
              </Field>
              <Field label="Y luego cada (0 = igual)">
                <input type="number" className="input" value={t.step} onChange={(e) => setT({ ...t, step: clamp(e.target.value, 0, 1e9) })} />
              </Field>
            </div>
          )}
          {t.type === 'command' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Comando del chat (sin !)">
                <input className="input" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value.replace(/^!/, '').toLowerCase() })} />
              </Field>
              <Field label="Alias (coma)">
                <input className="input" value={t.aliases.join(', ')} onChange={(e) => setT({ ...t, aliases: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
              </Field>
            </div>
          )}
          {t.type === 'chat' && (
            <Field label="El comentario contiene (vacío = cualquiera)">
              <input className="input" value={t.contains ?? ''} onChange={(e) => setT({ ...t, contains: e.target.value || undefined })} />
            </Field>
          )}
          {t.type === 'follow' && (
            <Check on={t.oncePerUser} onChange={(v) => setT({ ...t, oncePerUser: v })}>
              Solo una vez por persona
            </Check>
          )}

          <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
            <Field label="Quién">
              <select className="input" value={ev.who} onChange={(e) => setEv({ ...ev, who: e.target.value as EventRule['who'] })}>
                <option value="anyone">Cualquiera</option>
                <option value="followers">Seguidores</option>
                <option value="subscribers">Suscriptores</option>
                <option value="moderators">Moderadores</option>
                <option value="list">Lista de usuarios</option>
              </select>
            </Field>
            {ev.who === 'list' ? (
              <Field label="Usuarios (@, coma)">
                <input className="input" value={ev.users.join(', ')} onChange={(e) => setEv({ ...ev, users: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
              </Field>
            ) : (
              <Field label="Máximo por evento">
                <input type="number" className="input" value={ev.maxPerEvent} onChange={(e) => setEv({ ...ev, maxPerEvent: clamp(e.target.value, 1, 1000) })} />
              </Field>
            )}
            <Field label="Espera global (s)">
              <input type="number" min={0} className="input" value={ev.cooldown.globalMs / 1000} onChange={(e) => setEv({ ...ev, cooldown: { ...ev.cooldown, globalMs: clamp(e.target.value, 0, 3600) * 1000 } })} />
            </Field>
            <Field label="Espera por persona (s)">
              <input type="number" min={0} className="input" value={ev.cooldown.perUserMs / 1000} onChange={(e) => setEv({ ...ev, cooldown: { ...ev.cooldown, perUserMs: clamp(e.target.value, 0, 3600) * 1000 } })} />
            </Field>
          </div>

          <div className="border-t border-line pt-4">
            <span className="label">Sonido</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="btn cursor-pointer">
                <Upload size={14} /> {ev.sound ? 'Cambiar' : 'Subir mp3 / wav'}
                <input type="file" accept="audio/*" className="hidden" onChange={(e) => onSound(e.target.files?.[0])} />
              </label>
              {ev.sound && (
                <>
                  <audio src={ev.sound.file} controls className="h-8 max-w-[220px]" />
                  <button className="text-xs text-muted hover:text-bad" onClick={() => setEv({ ...ev, sound: undefined })}>
                    Quitar
                  </button>
                </>
              )}
            </div>
            {ev.sound && (
              <div className="mt-2 flex items-center gap-3">
                <Seg
                  value={ev.sound.every}
                  onChange={(v) => setEv({ ...ev, sound: { ...ev.sound!, every: v } })}
                  options={[
                    { v: 'first', l: 'Una vez por racha' },
                    { v: 'each', l: 'Cada repetición' },
                  ]}
                />
                <span className="text-xs text-muted">Vol.</span>
                <input type="range" min={0} max={1} step={0.05} value={ev.sound.volume} onChange={(e) => setEv({ ...ev, sound: { ...ev.sound!, volume: Number(e.target.value) } })} className="w-24 accent-[var(--color-accent)]" />
                <span className="w-10 text-xs">{Math.round(ev.sound.volume * 100)}%</span>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------ FUNCIÓN ------------------------------ */}
        <div className="space-y-4">
          <div className="text-xs font-semibold tracking-widest text-muted">FUNCIÓN</div>
          <div className="flex gap-4">
            <label
              className="relative grid h-24 w-24 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed"
              style={{ borderColor: `${ac.color}88`, background: `linear-gradient(160deg, ${ac.color}40, #000)` }}
              title="Imagen o video de la función"
            >
              {ac.media ? <Media media={ac.media} className="absolute inset-0 h-full w-full object-cover" /> : <ImagePlus size={22} className="text-muted" />}
              <input type="file" accept="image/*,video/mp4,video/webm" className="hidden" onChange={(e) => onMedia(e.target.files?.[0])} />
            </label>
            <div className="min-w-0 flex-1 space-y-2">
              <Field label="Nombre de la función">
                <input className="input font-bold uppercase" maxLength={40} value={ac.name} onChange={(e) => setAc({ ...ac, name: e.target.value.toUpperCase() })} />
              </Field>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Check on={!ac.showInOverlay} onChange={(v) => setAc({ ...ac, showInOverlay: !v })}>
                  Ocultar en el overlay
                </Check>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="color" className="h-6 w-8 rounded border border-line bg-bg" value={ac.color} onChange={(e) => setAc({ ...ac, color: e.target.value })} /> Color
                </label>
                <select className="input w-auto py-1 text-xs" value={ac.alignment} onChange={(e) => setAc({ ...ac, alignment: e.target.value as Action['alignment'] })}>
                  <option value="neutral">Tipo: neutro</option>
                  <option value="good">Tipo: ayuda</option>
                  <option value="bad">Tipo: sabotaje</option>
                </select>
                {ac.media && (
                  <button className="text-xs text-muted hover:text-bad" onClick={() => setAc({ ...ac, media: undefined })}>
                    Quitar imagen
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Repeticiones">
              <input type="number" min={1} max={100} className="input" value={ev.multiplier} onChange={(e) => setEv({ ...ev, multiplier: clamp(e.target.value, 1, 100) })} />
            </Field>
            <Field label="Retraso (ms)">
              <input type="number" min={0} max={60000} className="input" value={ev.delayMs} onChange={(e) => setEv({ ...ev, delayMs: clamp(e.target.value, 0, 60000) })} />
            </Field>
            <Field label="Intervalo (ms)">
              <input type="number" min={0} max={10000} className="input" value={ev.intervalMs} onChange={(e) => setEv({ ...ev, intervalMs: clamp(e.target.value, 0, 10000) })} />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <Check on={ev.perUnit} onChange={(v) => setEv({ ...ev, perUnit: v })}>
              Multiplicar por la cantidad
            </Check>
            <span title="Si llegan 10 rosas en una racha, la función se repite 10 × Repeticiones. Desmárcalo para que salga una sola vez por evento." className="text-muted">
              <HelpCircle size={14} />
            </span>
          </div>

          <div className="rounded-xl border border-line bg-bg/60 p-3">
            <div className="mb-2 flex items-center">
              <span className="mr-auto font-semibold">
                Comandos {commands.filter((c) => c.trim()).length}/{MAX_COMMANDS}
              </span>
              <button className="flex items-center gap-1 rounded-md bg-sky-500/15 px-2 py-1 text-xs text-sky-300" onClick={() => setVars(!vars)}>
                <HelpCircle size={13} /> Variables
              </button>
            </div>
            {vars && (
              <div className="mb-3 grid gap-1 rounded-lg bg-black/40 p-2 text-xs">
                {VARIABLES.map(([k, d]) => (
                  <div key={k} className="flex gap-2">
                    <code className="w-28 shrink-0 text-accent">{k}</code>
                    <span className="text-muted">{d}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {commands.map((c, i) => (
                <div key={i} className="rounded-lg border border-line bg-panel">
                  <div className="flex items-center gap-1.5 border-b border-line px-2 py-1">
                    <span className="mr-auto text-xs font-semibold">#{i + 1} Comando</span>
                    <button className="rounded bg-orange-500 p-1 text-white hover:brightness-110" title="Probar con el espectador «Prueba»" onClick={() => testCommand(c)}>
                      <Play size={12} />
                    </button>
                    <button className="rounded bg-red-500/80 p-1 text-white hover:brightness-110" title="Quitar" onClick={() => setCommands(commands.filter((_, k) => k !== i))}>
                      <X size={12} />
                    </button>
                  </div>
                  <textarea
                    className="h-14 w-full resize-y bg-transparent p-2 font-mono text-xs outline-none"
                    value={c}
                    placeholder="/survival zombie null {nickname}"
                    onChange={(e) => setCommands(commands.map((x, k) => (k === i ? e.target.value : x)))}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="btn justify-center bg-sky-600/80 text-white hover:bg-sky-600" disabled={commands.length >= MAX_COMMANDS} onClick={() => setCommands([...commands, ''])}>
                <Plus size={14} /> Comando manual
              </button>
              <button className="btn justify-center bg-sky-600/80 text-white hover:bg-sky-600" disabled={commands.length >= MAX_COMMANDS} onClick={() => setGallery(true)}>
                <LayoutGrid size={14} /> Elegir de la galería
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-line">
            <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted hover:text-white" onClick={() => setShowAdvanced(!showAdvanced)}>
              {showAdvanced ? <ChevronDown size={15} /> : <ChevronRight size={15} />} Pasos avanzados ({advanced.length}) · mobs con nombre, items, efectos, textos, marcador…
            </button>
            {showAdvanced && (
              <div className="space-y-2 p-3 pt-0">
                {advanced.map((s, i) => (
                  <div key={i} className="rounded-lg border border-line bg-bg p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <select className="input w-48" value={s.type} onChange={(e) => setAdvanced(advanced.map((x, k) => (k === i ? defaultStep(e.target.value as Step['type']) : x)))}>
                        {STEP_TYPES.map((x) => (
                          <option key={x.v} value={x.v}>
                            {x.l}
                          </option>
                        ))}
                      </select>
                      <button className="ml-auto text-muted hover:text-bad" onClick={() => setAdvanced(advanced.filter((_, k) => k !== i))}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <StepFields step={s} onChange={(x) => setAdvanced(advanced.map((y, k) => (k === i ? x : y)))} />
                  </div>
                ))}
                <select className="input" value="" onChange={(e) => e.target.value && setAdvanced([...advanced, defaultStep(e.target.value as Step['type'])])}>
                  <option value="">+ Añadir paso avanzado…</option>
                  {STEP_TYPES.map((x) => (
                    <option key={x.v} value={x.v}>
                      {x.l}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {sharedWith > 0 && <p className="rounded-lg bg-warn/10 p-2 text-xs text-warn">Esta función la usan otros {sharedWith} comandos: los cambios les afectan también.</p>}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2 border-t border-line pt-4">
        <button className="btn" onClick={onCancel}>
          Cancelar
        </button>
        <button
          className="btn-accent bg-ok hover:bg-ok/90"
          disabled={busy || !ac.name.trim() || steps().length === 0}
          title={steps().length === 0 ? 'Añade al menos un comando' : undefined}
          onClick={async () => {
            setBusy(true)
            await onSave(ev, { ...ac, steps: steps() })
            setBusy(false)
          }}
        >
          <PlayCircle size={15} /> Guardar
        </button>
      </div>

      {gallery && (
        <GalleryModal
          onClose={() => setGallery(false)}
          onPick={(g) => {
            const empty = commands.findIndex((c) => !c.trim())
            setCommands(empty >= 0 ? commands.map((c, k) => (k === empty ? g.command : c)) : [...commands, g.command].slice(0, MAX_COMMANDS))
            if (ac.name === 'NUEVO') setAc({ ...ac, name: g.name.toUpperCase().slice(0, 40) })
            setGallery(false)
          }}
          onTest={testCommand}
        />
      )}
    </Modal>
  )
}

function GalleryModal({ onClose, onPick, onTest }: { onClose: () => void; onPick: (g: GalleryCommand) => void; onTest: (cmd: string) => void }) {
  const [group, setGroup] = useState<GalleryCommand['group'] | 'all'>('all')
  const [q, setQ] = useState('')
  const list = GALLERY.filter((g) => (group === 'all' || g.group === group) && (!q || `${g.name} ${g.command} ${g.plugin}`.toLowerCase().includes(q.toLowerCase())))
  return (
    <Modal open onClose={onClose} title="Galería de comandos" wide>
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="w-full max-w-md">
          <Seg
            value={group}
            onChange={setGroup}
            options={[
              { v: 'all', l: 'Todos' },
              { v: 'Minecraft', l: 'Minecraft' },
              { v: 's2e-survival', l: 's2e-survival' },
              { v: 'MiniLive', l: 'MiniLive' },
            ]}
          />
        </div>
        <div className="relative min-w-60 flex-1">
          <Search size={15} className="absolute top-2.5 left-3 text-muted" />
          <input className="input pl-9" placeholder="Buscar (zombie, trueno, tnt…)" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
      </div>
      {(group === 'MiniLive' || group === 'all') && (
        <p className="mb-3 rounded-lg bg-warn/10 p-2 text-xs text-warn">
          Los plugins MiniLive comprueban un «pase» de la nube de MineLive: solo funcionan con tu cuenta de MineLive activa. s2e-survival y los de Minecraft funcionan siempre.
        </p>
      )}
      <div className="grid max-h-[60vh] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
        {list.map((g) => (
          <div key={g.group + g.command} className="flex items-start gap-2 rounded-lg border border-line bg-bg p-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{g.name}</span>
                <span className="shrink-0 rounded bg-white/10 px-1.5 text-[10px] text-muted">{g.plugin}</span>
              </div>
              <code className="block truncate text-xs text-accent" title={g.command}>
                /{g.command}
              </code>
              {g.usage && (
                <div className="truncate text-[11px] text-muted" title={g.usage}>
                  {g.usage}
                </div>
              )}
            </div>
            <button className="rounded bg-orange-500 p-1.5 text-white" title="Probar" onClick={() => onTest(g.command)}>
              <Play size={12} />
            </button>
            <button className="btn-accent px-2 py-1 text-xs" onClick={() => onPick(g)}>
              Usar
            </button>
          </div>
        ))}
        {list.length === 0 && <div className="p-6 text-sm text-muted">Nada coincide.</div>}
      </div>
    </Modal>
  )
}
