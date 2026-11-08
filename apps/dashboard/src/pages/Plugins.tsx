import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Copy, History, Pause, Play, Plus, Trash2, Music, Share2, Download, Layers, Loader2 } from 'lucide-react'
import type { Action, EventRule, Profile } from '@livearena/shared'
import { useApp } from '../App'
import { api } from '../lib/api'
import { triggerLabel, ruleSummary, useGifts } from '../lib/catalog'
import { useOnAction } from '../lib/live'
import { Media, Modal, PageHeader, Toggle, TriggerChip } from '../components/ui'
import { toast } from '../components/Toast'
import { askConfirm, askText } from '../components/Dialog'
import { newRule } from '../components/RuleEditor'
import { FunctionEditor } from '../components/FunctionEditor'

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

export function PluginsPage() {
  const { profile, state, reload } = useApp()
  const gifts = useGifts()
  const [editing, setEditing] = useState<{ event: EventRule; action: Action; isNew: boolean } | null>(null)
  const [fired, setFired] = useState<Record<string, number>>({})
  const [backups, setBackups] = useState(false)
  const [share, setShare] = useState(false)
  const [saving, setSaving] = useState(false)
  const [paused, setPaused] = useState(state?.paused ?? false)

  useOnAction((a) => {
    if (a.kind === 'overlay.card' && a.actionId) setFired((f) => ({ ...f, [a.actionId!]: Date.now() }))
  })

  if (!profile) return null

  const save = async (p: Profile) => {
    setSaving(true)
    try {
      await api('PUT', `/api/profiles/${p.id}`, p)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const patchEvent = (id: string, patch: Partial<EventRule>) => save({ ...profile, events: profile.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) })

  const removeRow = async (ev: EventRule) => {
    if (!(await askConfirm('¿Borrar este comando?', { danger: true }))) return
    const stillUsed = new Set(profile.events.filter((e) => e.id !== ev.id).flatMap((e) => e.actionIds))
    void save({ ...profile, events: profile.events.filter((e) => e.id !== ev.id), actions: profile.actions.filter((a) => stillUsed.has(a.id)) })
  }

  const duplicateRow = (ev: EventRule) => {
    const a = profile.actions.find((x) => x.id === ev.actionIds[0])
    if (!a) return
    const na = { ...structuredClone(a), id: uid('acc') }
    const ne = { ...structuredClone(ev), id: uid('ev'), actionIds: [na.id] }
    const idx = profile.events.findIndex((e) => e.id === ev.id)
    const events = [...profile.events]
    events.splice(idx + 1, 0, ne)
    void save({ ...profile, actions: [...profile.actions, na], events })
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= profile.events.length) return
    const events = [...profile.events]
    const [x] = events.splice(from, 1)
    events.splice(to, 0, x!)
    void save({ ...profile, events })
  }

  const commitEditor = async (event: EventRule, action: Action) => {
    const exists = profile.actions.some((a) => a.id === action.id)
    const actions = exists ? profile.actions.map((a) => (a.id === action.id ? action : a)) : [...profile.actions, action]
    const evExists = profile.events.some((e) => e.id === event.id)
    const events = evExists ? profile.events.map((e) => (e.id === event.id ? event : e)) : [...profile.events, event]
    await save({ ...profile, actions, events })
    setEditing(null)
  }

  const togglePause = async () => {
    const r = await api<{ paused: boolean }>('POST', '/api/actions/pause', { paused: !paused })
    setPaused(r.paused)
  }

  const switchProfile = async (id: string) => {
    await api('POST', `/api/profiles/${id}/activate`)
    await reload()
  }

  const newProfile = async () => {
    const name = await askText('Nombre del nuevo perfil (se copia del actual):', `${profile.name} 2`)
    if (!name) return
    const p = await api<Profile>('POST', `/api/profiles/${profile.id}/duplicate`, { name })
    await switchProfile(p.id)
  }

  return (
    <div>
      <PageHeader title="Plugins" subtitle="Qué pasa en Minecraft cuando llega cada regalo." />
      <div className="flex flex-wrap items-center gap-2 px-6 pb-4">
        <div className="flex items-center gap-1 rounded-lg border border-line bg-panel p-1">
          {state?.profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => switchProfile(p.id)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${p.id === profile.id ? 'bg-accent/15 text-white ring-1 ring-accent/60' : 'text-muted hover:text-white'}`}
            >
              {p.name}
            </button>
          ))}
          <button className="rounded-md px-2 py-1 text-muted hover:text-white" title="Nuevo perfil" onClick={newProfile}>
            <Plus size={16} />
          </button>
        </div>
        <button className="btn" onClick={() => setBackups(true)}>
          <History size={15} /> Copias de seguridad
        </button>
        <button className="btn" onClick={() => setShare(true)}>
          <Share2 size={15} /> Compartir / importar
        </button>
        <div className="ml-auto flex items-center gap-2">
          {saving && <Loader2 size={15} className="animate-spin text-muted" />}
          <button className={paused ? 'btn border-warn/60 text-warn' : 'btn'} onClick={togglePause} title="Deja de ejecutar acciones (el live sigue conectado)">
            {paused ? <Play size={15} /> : <Pause size={15} />} {paused ? 'Reanudar acciones' : 'Pausar acciones'}
          </button>
          <button
            className="btn-accent"
            onClick={() => {
              const { event, action } = newRule()
              setEditing({ event, action, isNew: true })
            }}
          >
            <Plus size={15} /> Nuevo comando
          </button>
        </div>
      </div>

      <div className="space-y-2.5 px-6 pb-10">
        {profile.events.length === 0 && <div className="card p-10 text-center text-muted">Aún no tienes comandos. Crea uno con «Nuevo comando».</div>}
        {profile.events.map((ev, i) => {
          const action = profile.actions.find((a) => a.id === ev.actionIds[0])
          if (!action) return null
          const t = triggerLabel(ev.trigger, gifts)
          const flash = fired[action.id] && Date.now() - fired[action.id]! < 1200
          const cmds = action.steps.flatMap((s) => (s.type === 'minecraft.command' ? s.commands : []))
          const others = action.steps.length - action.steps.filter((s) => s.type === 'minecraft.command').length
          const open = () => setEditing({ event: ev, action, isNew: false })
          const WHO: Record<string, string> = { anyone: 'Cualquiera', followers: 'Seguidores', subscribers: 'Suscriptores', moderators: 'Moderadores', list: 'Lista' }
          return (
            <div
              key={ev.id + (flash ? fired[action.id] : '')}
              className={`card flex items-stretch gap-0 overflow-hidden transition ${ev.enabled ? '' : 'opacity-50'} ${flash ? 'fx-flash ring-1 ring-accent' : ''}`}
            >
              <div className="flex flex-col items-center justify-center gap-1 border-r border-line px-2 text-muted">
                <button onClick={() => move(i, i - 1)} className="rounded p-0.5 hover:bg-white/10 hover:text-white" title="Subir">
                  <ChevronUp size={16} />
                </button>
                <Toggle on={ev.enabled} onChange={(v) => patchEvent(ev.id, { enabled: v })} title="Activar / desactivar" />
                <button onClick={() => move(i, i + 1)} className="rounded p-0.5 hover:bg-white/10 hover:text-white" title="Bajar">
                  <ChevronDown size={16} />
                </button>
              </div>
              <button onClick={open} className="flex w-52 shrink-0 items-center gap-3 border-r border-line px-4 py-3 text-left hover:bg-white/5">
                <TriggerChip t={t} size={46} />
                <div className="sr-only">editar</div>
              </button>
              <div className="flex w-36 shrink-0 flex-col justify-center border-r border-line px-3 text-xs text-muted">
                <span>{WHO[ev.who]}</span>
                <span className="truncate">{ruleSummary(ev) || (ev.perUnit ? 'por cada unidad' : 'una vez')}</span>
              </div>
              <button onClick={open} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left hover:bg-white/5">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg" style={{ background: `linear-gradient(160deg, ${action.color}55, #000)` }}>
                  {action.media ? <Media media={action.media} className="h-full w-full object-cover" /> : <span className="text-2xl font-black" style={{ color: action.color }}>{action.name.slice(0, 1)}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate rounded bg-black/30 px-2 py-0.5 font-extrabold tracking-wide" style={{ color: action.color }}>
                    {action.name}
                    {!action.showInOverlay && <span className="ml-2 text-[10px] font-normal text-muted">(oculta en overlay)</span>}
                  </div>
                  <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 text-xs">
                    <span className="text-muted">
                      Repeticiones: <b className="text-white">{ev.multiplier}</b>
                      {ev.perUnit ? ' ×cant.' : ''}
                    </span>
                    <span className="text-muted">
                      Comandos: <b className="text-white">{cmds.length}</b>
                      {others ? ` +${others} pasos` : ''}
                    </span>
                    <span className="text-muted">
                      Intervalo: <b className="text-white">{ev.intervalMs}</b> · Retraso: <b className="text-white">{ev.delayMs}</b>
                    </span>
                    <code className="truncate text-accent/90">{cmds[0] ? `/${cmds[0].replace(/^\//, '')}` : others ? '(pasos avanzados)' : '—'}</code>
                  </div>
                </div>
              </button>
              <SoundCell ev={ev} onEdit={open} />
              <div className="flex items-center gap-1.5 border-l border-line px-3">
                <button className="rounded-lg bg-orange-500 p-2 text-white hover:brightness-110" title="Probar completo: tarjeta, aviso, sonido y Minecraft" onClick={() => api('POST', `/api/actions/${action.id}/test`, { full: true, eventId: ev.id }).catch((e) => toast(e.message, 'error'))}>
                  <Play size={15} />
                </button>
                <button className="rounded-lg bg-sky-600 p-2 text-white hover:brightness-110" title="Ejecutar solo en Minecraft" onClick={() => api('POST', `/api/actions/${action.id}/test`, { full: false }).catch((e) => toast(e.message, 'error'))}>
                  <Play size={15} />
                </button>
                <button className="rounded-lg bg-white/10 p-2 hover:bg-white/20" title="Duplicar" onClick={() => duplicateRow(ev)}>
                  <Copy size={15} />
                </button>
                <button className="rounded-lg bg-red-500/80 p-2 text-white hover:bg-red-500" title="Borrar" onClick={() => removeRow(ev)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {editing && (
        <FunctionEditor
          key={editing.event.id}
          initialEvent={editing.event}
          initialAction={editing.action}
          isNew={editing.isNew}
          sharedWith={profile.events.filter((e) => e.id !== editing.event.id && e.actionIds.includes(editing.action.id)).length}
          onCancel={() => setEditing(null)}
          onSave={commitEditor}
        />
      )}
      <BackupsModal open={backups} onClose={() => setBackups(false)} profile={profile} />
      <ShareModal open={share} onClose={() => setShare(false)} profile={profile} onImported={reload} />
    </div>
  )
}

function BackupsModal({ open, onClose, profile }: { open: boolean; onClose: () => void; profile: Profile }) {
  const [list, setList] = useState<{ file: string; date: string; actions: number; events: number }[] | null>(null)
  if (open && list === null) api('GET', `/api/profiles/${profile.id}/backups`).then(setList).catch(() => setList([]))
  return (
    <Modal
      open={open}
      onClose={() => {
        setList(null)
        onClose()
      }}
      title={`Copias de seguridad · ${profile.name}`}
    >
      <p className="mb-3 text-sm text-muted">Cada cambio guarda una copia automática (las últimas 30).</p>
      {!list?.length && <div className="text-sm text-muted">Todavía no hay copias.</div>}
      <div className="space-y-2">
        {list?.map((b) => (
          <div key={b.file} className="flex items-center gap-3 rounded-lg border border-line bg-bg px-3 py-2 text-sm">
            <Layers size={15} className="text-muted" />
            <span className="mr-auto">{b.date}</span>
            <span className="text-muted">{b.events} comandos</span>
            <button
              className="btn"
              onClick={async () => {
                if (!(await askConfirm('¿Restaurar esta copia? (lo actual también queda guardado)'))) return
                await api('POST', `/api/profiles/${profile.id}/restore`, { file: b.file })
                toast('Copia restaurada')
                setList(null)
                onClose()
              }}
            >
              Restaurar
            </button>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function ShareModal({ open, onClose, profile, onImported }: { open: boolean; onClose: () => void; profile: Profile; onImported: () => Promise<void> }) {
  const [code, setCode] = useState('')
  const [incoming, setIncoming] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="Compartir / importar perfil">
      <div className="space-y-5">
        <div>
          <span className="label">Exportar «{profile.name}»</span>
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={async () => {
                const r = await api<{ code: string }>('GET', `/api/profiles/${profile.id}/export`)
                setCode(r.code)
                await navigator.clipboard.writeText(r.code).catch(() => undefined)
                toast('Código copiado al portapapeles')
              }}
            >
              <Download size={15} /> Generar código
            </button>
          </div>
          {code && <textarea readOnly className="input mt-2 h-24 font-mono text-xs" value={code} />}
          <p className="mt-1 text-xs text-muted">El código no incluye contraseñas ni claves. Las imágenes subidas no viajan en el código.</p>
        </div>
        <div>
          <span className="label">Importar (pegar código)</span>
          <textarea className="input h-24 font-mono text-xs" placeholder="LA1:…" value={incoming} onChange={(e) => setIncoming(e.target.value)} />
          <button
            className="btn-accent mt-2"
            disabled={!incoming.trim()}
            onClick={async () => {
              try {
                const p = await api<Profile>('POST', '/api/profiles/import', { code: incoming.trim() })
                await api('POST', `/api/profiles/${p.id}/activate`)
                await onImported()
                toast(`Perfil «${p.name}» importado`)
                setIncoming('')
                onClose()
              } catch (e) {
                toast((e as Error).message, 'error')
              }
            }}
          >
            Importar
          </button>
        </div>
      </div>
    </Modal>
  )
}

function SoundCell({ ev, onEdit }: { ev: EventRule; onEdit: () => void }) {
  const [dur, setDur] = useState<number | null>(null)
  useEffect(() => {
    if (!ev.sound) return
    const a = new Audio(ev.sound.file)
    a.onloadedmetadata = () => setDur(a.duration)
  }, [ev.sound])
  if (!ev.sound)
    return (
      <button onClick={onEdit} className="flex w-40 shrink-0 items-center justify-center gap-2 border-l border-line text-xs text-muted hover:bg-white/5 hover:text-white">
        <Plus size={14} /> <Music size={14} /> Sonido
      </button>
    )
  const name = decodeURIComponent(ev.sound.file.split('/').pop() ?? '').replace(/^[a-z0-9]+-/, '')
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`
  return (
    <div className="flex w-40 shrink-0 flex-col justify-center gap-1 border-l border-line px-3 text-xs">
      <span className="truncate font-semibold" title={name}>
        {name}
      </span>
      <div className="flex flex-wrap gap-1 text-[10px] text-muted">
        <span className="rounded bg-white/10 px-1.5">⏱ {dur ? fmt(dur) : '--:--'}</span>
        <span className="rounded bg-white/10 px-1.5">🔊 {Math.round(ev.sound.volume * 100)}%</span>
        <button className="rounded bg-white/10 px-1.5 hover:bg-white/20" onClick={() => { const a = new Audio(ev.sound!.file); a.volume = ev.sound!.volume; void a.play() }}>
          ▶
        </button>
      </div>
    </div>
  )
}
