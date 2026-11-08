import { useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Trash2, Upload, X } from 'lucide-react'
import type { Action, EventRule, Step, Trigger } from '@livearena/shared'
import { upload } from '../lib/api'
import { EFFECTS, ENTITIES } from '../lib/catalog'
import { Check, Field, Media, Modal, Seg } from './ui'
import { GiftPicker } from './GiftPicker'
import { toast } from './Toast'

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

export function newRule(): { event: EventRule; action: Action } {
  const action: Action = {
    id: uid('acc'),
    name: 'NUEVO',
    color: '#22d3ee',
    alignment: 'neutral',
    showInOverlay: true,
    steps: [{ type: 'minecraft.command', commands: ['execute at {player} run summon zombie ~2 ~ ~2'], mode: 'all' }],
  }
  const event: EventRule = {
    id: uid('ev'),
    enabled: true,
    trigger: { type: 'gift', gifts: [{ name: 'Rose', diamonds: 1 }] },
    actionIds: [action.id],
    perUnit: true,
    multiplier: 1,
    maxPerEvent: 100,
    delayMs: 0,
    intervalMs: 100,
    cooldown: { globalMs: 0, perUserMs: 0 },
    who: 'anyone',
    users: [],
  }
  return { event, action }
}

export const TRIGGERS: { v: Trigger['type']; l: string }[] = [
  { v: 'gift', l: 'Regalo' },
  { v: 'diamonds', l: 'Monedas' },
  { v: 'likes', l: 'Likes (persona)' },
  { v: 'room_likes', l: 'Likes (sala)' },
  { v: 'follow', l: 'Seguir' },
  { v: 'share', l: 'Compartir' },
  { v: 'command', l: 'Comando !' },
  { v: 'chat', l: 'Comentario' },
  { v: 'subscribe', l: 'Suscripción' },
  { v: 'join', l: 'Entra' },
]

export function defaultTrigger(t: Trigger['type']): Trigger {
  switch (t) {
    case 'gift':
      return { type: 'gift', gifts: [{ name: 'Rose', diamonds: 1 }] }
    case 'diamonds':
      return { type: 'diamonds', min: 100 }
    case 'likes':
      return { type: 'likes', every: 10 }
    case 'room_likes':
      return { type: 'room_likes', goal: 1000, step: 1000, repeat: true }
    case 'follow':
      return { type: 'follow', oncePerUser: true }
    case 'command':
      return { type: 'command', name: 'ayuda', aliases: [] }
    case 'chat':
      return { type: 'chat' }
    default:
      return { type: t } as Trigger
  }
}

export const STEP_TYPES: { v: Step['type']; l: string }[] = [
  { v: 'minecraft.summon', l: 'Invocar mob' },
  { v: 'minecraft.command', l: 'Comando' },
  { v: 'minecraft.give', l: 'Dar item' },
  { v: 'minecraft.effect', l: 'Efecto' },
  { v: 'minecraft.title', l: 'Texto en pantalla' },
  { v: 'minecraft.kit', l: 'Dar kit' },
  { v: 'scoreboard', l: 'Marcador' },
  { v: 'timer', l: 'Cronómetro' },
  { v: 'overlay.alert', l: 'Alerta overlay' },
  { v: 'sound', l: 'Sonido' },
  { v: 'wait', l: 'Esperar' },
]

export function defaultStep(t: Step['type']): Step {
  switch (t) {
    case 'minecraft.summon':
      return { type: t, entity: 'zombie', count: 1, nameTag: true, radius: 3, heightOffset: 0 }
    case 'minecraft.command':
      return { type: t, commands: ['say {user} envió {gift}'], mode: 'all' }
    case 'minecraft.give':
      return { type: t, item: 'diamond', count: 1 }
    case 'minecraft.effect':
      return { type: t, effect: 'speed', seconds: 10, amplifier: 0 }
    case 'minecraft.title':
      return { type: t, actionbar: '{user} → {gift}' }
    case 'minecraft.kit':
      return { type: t }
    case 'scoreboard':
      return { type: t, key: 'lives', delta: 1 }
    case 'timer':
      return { type: t, op: 'reset' }
    case 'overlay.alert':
      return { type: t, durationMs: 4000 }
    case 'sound':
      return { type: t, file: '', volume: 1 }
    case 'wait':
      return { type: t, ms: 500 }
    case 'game':
      return { type: t, kind: 'battle.spawn', params: {} }
  }
}

export function RuleEditor({
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
  const [ev, setEv] = useState<EventRule>(structuredClone(initialEvent))
  const [ac, setAc] = useState<Action>(structuredClone(initialAction))
  const [tab, setTab] = useState<'cuando' | 'que' | 'opciones'>(isNew ? 'cuando' : 'que')
  const [busy, setBusy] = useState(false)
  const t = ev.trigger
  const setT = (trigger: Trigger) => setEv({ ...ev, trigger })
  const setStep = (i: number, s: Step) => setAc({ ...ac, steps: ac.steps.map((x, k) => (k === i ? s : x)) })

  const onMedia = async (f: File | undefined) => {
    if (!f) return
    try {
      const r = await upload('/api/media/upload', f)
      if (r.kind === 'audio') return toast('Para la tarjeta usa una imagen o video', 'error')
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
      <div className="mb-4">
        <Seg
          value={tab}
          onChange={setTab}
          options={[
            { v: 'cuando', l: '1 · Cuándo' },
            { v: 'que', l: '2 · Qué pasa' },
            { v: 'opciones', l: '3 · Opciones' },
          ]}
        />
      </div>

      {tab === 'cuando' && (
        <div className="space-y-4">
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
                  else if (!has) setT({ ...t, gifts: t.gifts.length === 1 && isNew && t.gifts[0]!.name === 'Rose' ? [{ name: g.name, diamonds: g.diamonds, id: g.id }] : [...t.gifts, { name: g.name, diamonds: g.diamonds, id: g.id }] })
                }}
              />
            </>
          )}
          {t.type === 'diamonds' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mínimo (monedas por regalo)">
                <input type="number" className="input" value={t.min} onChange={(e) => setT({ ...t, min: Number(e.target.value) })} />
              </Field>
              <Field label="Máximo (vacío = sin límite)">
                <input type="number" className="input" value={t.max ?? ''} onChange={(e) => setT({ ...t, max: e.target.value ? Number(e.target.value) : undefined })} />
              </Field>
            </div>
          )}
          {t.type === 'likes' && (
            <Field label="Cada cuántos likes de una misma persona" hint="Ej: 10 → cada 10 likes de alguien se ejecuta una vez.">
              <input type="number" min={1} className="input w-40" value={t.every} onChange={(e) => setT({ ...t, every: Math.max(1, Number(e.target.value)) })} />
            </Field>
          )}
          {t.type === 'room_likes' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Primera meta (likes de toda la sala)">
                <input type="number" className="input" value={t.goal} onChange={(e) => setT({ ...t, goal: Math.max(1, Number(e.target.value)) })} />
              </Field>
              <Field label="Y luego cada" hint="0 = igual que la primera meta">
                <input type="number" className="input" value={t.step} onChange={(e) => setT({ ...t, step: Math.max(0, Number(e.target.value)) })} />
              </Field>
              <Check on={t.repeat} onChange={(v) => setT({ ...t, repeat: v })}>
                Repetir en cada meta
              </Check>
            </div>
          )}
          {t.type === 'command' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Comando (sin !)">
                <input className="input" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value.replace(/^!/, '').toLowerCase() })} />
              </Field>
              <Field label="Alias (separados por coma)">
                <input className="input" value={t.aliases.join(', ')} onChange={(e) => setT({ ...t, aliases: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
              </Field>
            </div>
          )}
          {t.type === 'chat' && (
            <Field label="El comentario contiene (vacío = cualquier comentario)">
              <input className="input" value={t.contains ?? ''} onChange={(e) => setT({ ...t, contains: e.target.value || undefined })} />
            </Field>
          )}
          {t.type === 'follow' && (
            <Check on={t.oncePerUser} onChange={(v) => setT({ ...t, oncePerUser: v })}>
              Solo una vez por persona (evita que sigan/dejen de seguir para spamear)
            </Check>
          )}
        </div>
      )}

      {tab === 'que' && (
        <div className="grid gap-5 md:grid-cols-[260px_1fr]">
          <div className="space-y-3">
            <span className="label">Tarjeta</span>
            <label
              className="relative flex aspect-video cursor-pointer items-end overflow-hidden rounded-xl border-2 border-dashed"
              style={{ borderColor: `${ac.color}88`, background: `linear-gradient(160deg, ${ac.color}40, #000)` }}
            >
              <Media media={ac.media} className="absolute inset-0 h-full w-full object-cover" />
              {!ac.media && (
                <span className="absolute inset-0 grid place-items-center text-xs text-muted">
                  <span className="flex flex-col items-center gap-1">
                    <Upload size={18} /> Imagen o video
                  </span>
                </span>
              )}
              <span className="relative w-full bg-gradient-to-t from-black/80 to-transparent p-2 text-center font-extrabold tracking-wide" style={{ color: ac.color }}>
                {ac.name}
              </span>
              <input type="file" accept="image/*,video/mp4,video/webm" className="hidden" onChange={(e) => onMedia(e.target.files?.[0])} />
            </label>
            {ac.media && (
              <button className="text-xs text-muted hover:text-bad" onClick={() => setAc({ ...ac, media: undefined })}>
                Quitar imagen
              </button>
            )}
            <Field label="Nombre">
              <input className="input font-bold uppercase" maxLength={40} value={ac.name} onChange={(e) => setAc({ ...ac, name: e.target.value.toUpperCase() })} />
            </Field>
            <div className="flex items-end gap-3">
              <Field label="Color">
                <input type="color" className="h-9 w-14 rounded border border-line bg-bg" value={ac.color} onChange={(e) => setAc({ ...ac, color: e.target.value })} />
              </Field>
              <div className="flex-1">
                <span className="label">Tipo</span>
                <Seg
                  value={ac.alignment}
                  onChange={(v) => setAc({ ...ac, alignment: v })}
                  options={[
                    { v: 'good', l: 'Ayuda' },
                    { v: 'neutral', l: '—' },
                    { v: 'bad', l: 'Sabotaje' },
                  ]}
                />
              </div>
            </div>
            <Check on={ac.showInOverlay} onChange={(v) => setAc({ ...ac, showInOverlay: v })}>
              Mostrar en overlays
            </Check>
            {sharedWith > 0 && <p className="rounded-lg bg-warn/10 p-2 text-xs text-warn">Esta acción la usan otros {sharedWith} comandos: los cambios les afectan también.</p>}
          </div>

          <div>
            <span className="label">Pasos (se ejecutan en orden, por cada unidad del regalo)</span>
            <div className="space-y-2">
              {ac.steps.map((s, i) => (
                <div key={i} className="rounded-xl border border-line bg-bg p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <select className="input w-48" value={s.type} onChange={(e) => setStep(i, defaultStep(e.target.value as Step['type']))}>
                      {STEP_TYPES.map((x) => (
                        <option key={x.v} value={x.v}>
                          {x.l}
                        </option>
                      ))}
                    </select>
                    <div className="ml-auto flex gap-1 text-muted">
                      <button disabled={i === 0} onClick={() => setAc({ ...ac, steps: swap(ac.steps, i, i - 1) })}>
                        <ArrowUp size={15} />
                      </button>
                      <button disabled={i === ac.steps.length - 1} onClick={() => setAc({ ...ac, steps: swap(ac.steps, i, i + 1) })}>
                        <ArrowDown size={15} />
                      </button>
                      <button className="hover:text-bad" onClick={() => setAc({ ...ac, steps: ac.steps.filter((_, k) => k !== i) })}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <StepFields step={s} onChange={(x) => setStep(i, x)} />
                </div>
              ))}
            </div>
            <select className="input mt-2" value="" onChange={(e) => e.target.value && setAc({ ...ac, steps: [...ac.steps, defaultStep(e.target.value as Step['type'])] })}>
              <option value="">+ Añadir paso…</option>
              {STEP_TYPES.map((x) => (
                <option key={x.v} value={x.v}>
                  {x.l}
                </option>
              ))}
            </select>
            <p className="mt-3 text-xs text-muted">
              Variables: <code>{'{player}'}</code> tu nick · <code>{'{user}'}</code> nombre del espectador · <code>{'{quien}'}</code> @usuario (una palabra) ·{' '}
              <code>{'{gift}'}</code> · <code>{'{gift.count}'}</code> · <code>{'{random:1-10}'}</code>. Compatibles con tus plugins: <code>{'{nick}'}</code> y <code>{'{quien}'}</code>.
            </p>
          </div>
        </div>
      )}

      {tab === 'opciones' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Repeticiones" hint="Por unidad: 10 rosas = 10 veces. Una vez: un solo disparo por evento.">
            <Seg
              value={ev.perUnit ? 'u' : 'o'}
              onChange={(v) => setEv({ ...ev, perUnit: v === 'u' })}
              options={[
                { v: 'u', l: 'Por unidad' },
                { v: 'o', l: 'Una vez' },
              ]}
            />
          </Field>
          <Field label="Multiplicador">
            <input type="number" min={1} max={100} className="input" value={ev.multiplier} onChange={(e) => setEv({ ...ev, multiplier: clamp(e.target.value, 1, 100) })} />
          </Field>
          <Field label="Máximo por evento" hint="Techo de seguridad para no tumbar el servidor (combo de 999).">
            <input type="number" min={1} max={1000} className="input" value={ev.maxPerEvent} onChange={(e) => setEv({ ...ev, maxPerEvent: clamp(e.target.value, 1, 1000) })} />
          </Field>
          <Field label="Pausa entre repeticiones (ms)">
            <input type="number" min={0} max={10000} className="input" value={ev.intervalMs} onChange={(e) => setEv({ ...ev, intervalMs: clamp(e.target.value, 0, 10000) })} />
          </Field>
          <Field label="Espera global (segundos)">
            <input type="number" min={0} className="input" value={ev.cooldown.globalMs / 1000} onChange={(e) => setEv({ ...ev, cooldown: { ...ev.cooldown, globalMs: clamp(e.target.value, 0, 3600) * 1000 } })} />
          </Field>
          <Field label="Espera por persona (segundos)">
            <input type="number" min={0} className="input" value={ev.cooldown.perUserMs / 1000} onChange={(e) => setEv({ ...ev, cooldown: { ...ev.cooldown, perUserMs: clamp(e.target.value, 0, 3600) * 1000 } })} />
          </Field>
          <Field label="Quién puede activarlo">
            <select className="input" value={ev.who} onChange={(e) => setEv({ ...ev, who: e.target.value as EventRule['who'] })}>
              <option value="anyone">Cualquiera</option>
              <option value="followers">Solo seguidores</option>
              <option value="subscribers">Solo suscriptores</option>
              <option value="moderators">Solo moderadores</option>
              <option value="list">Lista de usuarios</option>
            </select>
          </Field>
          {ev.who === 'list' && (
            <Field label="Usuarios (@, separados por coma)">
              <input className="input" value={ev.users.join(', ')} onChange={(e) => setEv({ ...ev, users: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
            </Field>
          )}
          <Field label="Prioridad (vacío = automática según monedas)">
            <input type="number" min={0} max={1000} className="input" value={ev.priority ?? ''} onChange={(e) => setEv({ ...ev, priority: e.target.value ? clamp(e.target.value, 0, 1000) : undefined })} />
          </Field>
          <div className="md:col-span-2">
            <span className="label">Sonido en el overlay</span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="btn cursor-pointer">
                <Upload size={14} /> {ev.sound ? 'Cambiar sonido' : 'Subir sonido'}
                <input type="file" accept="audio/*" className="hidden" onChange={(e) => onSound(e.target.files?.[0])} />
              </label>
              {ev.sound && (
                <>
                  <audio src={ev.sound.file} controls className="h-8" />
                  <Seg
                    value={ev.sound.every}
                    onChange={(v) => setEv({ ...ev, sound: { ...ev.sound!, every: v } })}
                    options={[
                      { v: 'first', l: 'Una vez por racha' },
                      { v: 'each', l: 'Con cada regalo' },
                    ]}
                  />
                  <button className="text-xs text-muted hover:text-bad" onClick={() => setEv({ ...ev, sound: undefined })}>
                    Quitar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
        <button className="btn" onClick={onCancel}>
          Cancelar
        </button>
        <button
          className="btn-accent"
          disabled={busy || !ac.name.trim() || ac.steps.length === 0}
          onClick={async () => {
            setBusy(true)
            await onSave(ev, ac)
            setBusy(false)
          }}
        >
          Guardar
        </button>
      </div>
    </Modal>
  )
}

const clamp = (v: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)))
function swap<T>(arr: T[], a: number, b: number): T[] {
  const c = [...arr]
  ;[c[a], c[b]] = [c[b]!, c[a]!]
  return c
}

function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{children}</div>
}

export function StepFields({ step: s, onChange }: { step: Step; onChange: (s: Step) => void }) {
  switch (s.type) {
    case 'minecraft.summon':
      return (
        <Row>
          <Field label="Mob">
            <input list="la-entities" className="input" value={s.entity} onChange={(e) => onChange({ ...s, entity: e.target.value })} />
            <datalist id="la-entities">
              {ENTITIES.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </Field>
          <Field label="Cantidad">
            <input type="number" min={1} max={50} className="input" value={s.count} onChange={(e) => onChange({ ...s, count: clamp(e.target.value, 1, 50) })} />
          </Field>
          <Field label="Radio">
            <input type="number" min={0} max={32} className="input" value={s.radius} onChange={(e) => onChange({ ...s, radius: clamp(e.target.value, 0, 32) })} />
          </Field>
          <Field label="Altura">
            <input type="number" className="input" value={s.heightOffset} onChange={(e) => onChange({ ...s, heightOffset: Number(e.target.value) || 0 })} />
          </Field>
          <div className="col-span-2">
            <Check on={s.nameTag} onChange={(v) => onChange({ ...s, nameTag: v })}>
              Nombre del espectador encima del mob
            </Check>
          </div>
        </Row>
      )
    case 'minecraft.command':
      return (
        <div className="space-y-2">
          <textarea
            className="input h-24 font-mono text-xs"
            value={s.commands.join('\n')}
            onChange={(e) => onChange({ ...s, commands: e.target.value.split('\n').length ? e.target.value.split('\n') : [''] })}
            onBlur={() => onChange({ ...s, commands: s.commands.filter((c) => c.trim()).length ? s.commands.filter((c) => c.trim()) : ['say hola'] })}
            placeholder="Un comando por línea, sin /"
          />
          <Seg
            value={s.mode}
            onChange={(v) => onChange({ ...s, mode: v })}
            options={[
              { v: 'all', l: 'Ejecutar todos' },
              { v: 'random', l: 'Uno al azar' },
            ]}
          />
        </div>
      )
    case 'minecraft.give':
      return (
        <Row>
          <Field label="Item (id)">
            <input className="input" value={s.item} onChange={(e) => onChange({ ...s, item: e.target.value })} />
          </Field>
          <Field label="Cantidad">
            <input type="number" min={1} className="input" value={s.count} onChange={(e) => onChange({ ...s, count: clamp(e.target.value, 1, 6400) })} />
          </Field>
        </Row>
      )
    case 'minecraft.effect':
      return (
        <Row>
          <Field label="Efecto">
            <select className="input" value={s.effect} onChange={(e) => onChange({ ...s, effect: e.target.value })}>
              {EFFECTS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Segundos">
            <input type="number" min={1} className="input" value={s.seconds} onChange={(e) => onChange({ ...s, seconds: clamp(e.target.value, 1, 1000000) })} />
          </Field>
          <Field label="Nivel">
            <input type="number" min={1} max={256} className="input" value={s.amplifier + 1} onChange={(e) => onChange({ ...s, amplifier: clamp(e.target.value, 1, 256) - 1 })} />
          </Field>
        </Row>
      )
    case 'minecraft.title':
      return (
        <Row>
          <Field label="Título grande">
            <input className="input" value={s.title ?? ''} onChange={(e) => onChange({ ...s, title: e.target.value || undefined })} />
          </Field>
          <Field label="Subtítulo">
            <input className="input" value={s.subtitle ?? ''} onChange={(e) => onChange({ ...s, subtitle: e.target.value || undefined })} />
          </Field>
          <Field label="Barra de acción">
            <input className="input" value={s.actionbar ?? ''} onChange={(e) => onChange({ ...s, actionbar: e.target.value || undefined })} />
          </Field>
          <Field label="Color">
            <input type="color" className="h-9 w-14 rounded border border-line bg-bg" value={s.color ?? '#ffcc00'} onChange={(e) => onChange({ ...s, color: e.target.value })} />
          </Field>
        </Row>
      )
    case 'minecraft.kit':
      return <p className="text-xs text-muted">Entrega el kit inicial configurado en «Kit inicial».</p>
    case 'scoreboard':
      return (
        <Row>
          <Field label="Contador">
            <select className="input" value={s.key} onChange={(e) => onChange({ ...s, key: e.target.value as 'wins' | 'losses' | 'lives' })}>
              <option value="wins">Victorias</option>
              <option value="losses">Derrotas</option>
              <option value="lives">Vidas</option>
            </select>
          </Field>
          <Field label="Sumar (negativo = restar)">
            <input type="number" className="input" value={s.delta} onChange={(e) => onChange({ ...s, delta: Math.round(Number(e.target.value)) || 0 })} />
          </Field>
        </Row>
      )
    case 'timer':
      return (
        <Row>
          <Field label="Cronómetro">
            <select className="input" value={s.op} onChange={(e) => onChange({ ...s, op: e.target.value as 'start' })}>
              <option value="start">Iniciar</option>
              <option value="pause">Pausar</option>
              <option value="reset">Reiniciar</option>
              <option value="add">Sumar segundos</option>
            </select>
          </Field>
          {s.op === 'add' && (
            <Field label="Segundos">
              <input type="number" className="input" value={s.seconds ?? 0} onChange={(e) => onChange({ ...s, seconds: Math.round(Number(e.target.value)) })} />
            </Field>
          )}
        </Row>
      )
    case 'overlay.alert':
      return (
        <Row>
          <Field label="Texto (vacío = nombre de la acción)">
            <input className="input" value={s.text ?? ''} onChange={(e) => onChange({ ...s, text: e.target.value || undefined })} />
          </Field>
          <Field label="Duración (ms)">
            <input type="number" className="input" value={s.durationMs} onChange={(e) => onChange({ ...s, durationMs: clamp(e.target.value, 500, 30000) })} />
          </Field>
        </Row>
      )
    case 'sound':
      return (
        <Row>
          <Field label="URL del sonido (/media/...)">
            <input className="input" value={s.file} onChange={(e) => onChange({ ...s, file: e.target.value })} />
          </Field>
          <Field label="Volumen">
            <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => onChange({ ...s, volume: Number(e.target.value) })} />
          </Field>
        </Row>
      )
    case 'wait':
      return (
        <Field label="Milisegundos">
          <input type="number" className="input w-40" value={s.ms} onChange={(e) => onChange({ ...s, ms: clamp(e.target.value, 0, 60000) })} />
        </Field>
      )
    case 'game':
      return (
        <Field label="Tipo de acción de juego">
          <input className="input" value={s.kind} onChange={(e) => onChange({ ...s, kind: e.target.value })} />
        </Field>
      )
  }
}
