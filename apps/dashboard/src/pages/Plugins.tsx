import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, ChevronDown, ChevronUp, Copy, History, PencilLine, Pause, Pickaxe, Play, Plus, Trash2, Music, Share2, Download, Layers, Loader2 } from 'lucide-react'
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
import { CardOverlaySettings } from './Overlays'

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

  const renameProfile = async () => {
    const name = await askText('Nuevo nombre del perfil:', profile.name)
    if (!name || name === profile.name) return
    await api('PUT', `/api/profiles/${profile.id}`, { ...profile, name })
    await reload()
    toast('Perfil renombrado')
  }

  const deleteProfile = async () => {
    if ((state?.profiles.length ?? 0) <= 1) return toast('Debe quedar al menos un perfil.', 'error')
    if (!(await askConfirm(`¿Eliminar el perfil «${profile.name}»? Se guarda una copia de seguridad por si te arrepientes.`, { danger: true }))) return
    try {
      await api('DELETE', `/api/profiles/${profile.id}`)
      await reload()
      toast('Perfil eliminado')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
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
      <div className="flex flex-wrap items-center gap-2 px-8 pb-5">
        <div className="flex items-center gap-1 rounded-full border border-line bg-black/30 p-1">
          {state?.profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => switchProfile(p.id)}
              className={`rounded-full px-4 py-1 text-sm font-medium transition ${p.id === profile.id ? 'bg-gradient-to-r from-accent to-hot text-white shadow-[0_4px_14px_-6px_var(--color-hot)]' : 'text-muted hover:text-white'}`}
            >
              {p.name}
            </button>
          ))}
          <button className="rounded-full px-2 py-1 text-muted hover:text-white" title="Nuevo perfil" onClick={newProfile}>
            <Plus size={16} />
          </button>
        </div>
        <button className="btn !px-2.5" title="Renombrar este perfil" onClick={renameProfile}>
          <PencilLine size={15} />
        </button>
        <button className="btn !px-2.5 hover:border-red-400/60 hover:text-red-300" title="Eliminar este perfil" onClick={deleteProfile}>
          <Trash2 size={15} />
        </button>
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

      <div className="grid gap-4 px-8 pb-12 lg:grid-cols-2 2xl:grid-cols-3">
        {profile.events.length === 0 && <div className="card col-span-full p-12 text-center text-muted">Aún no tienes comandos. Crea uno con «Nuevo comando».</div>}
        {profile.events.map((ev, i) => {
          const action = profile.actions.find((a) => a.id === ev.actionIds[0])
          if (!action) return null
          const t = triggerLabel(ev.trigger, gifts)
          const flash = fired[action.id] && Date.now() - fired[action.id]! < 1200
          const cmds = action.steps.flatMap((s) => (s.type === 'minecraft.command' ? s.commands : []))
          const others = action.steps.length - action.steps.filter((s) => s.type === 'minecraft.command').length
          const open = () => setEditing({ event: ev, action, isNew: false })
          const WHO: Record<string, string> = { anyone: 'Cualquiera', followers: 'Seguidores', subscribers: 'Suscriptores', moderators: 'Moderadores', list: 'Lista' }
          const c = action.color
          return (
            <div
              key={ev.id + (flash ? fired[action.id] : '')}
              className={`card group relative flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-white/15 ${ev.enabled ? '' : 'opacity-45 saturate-50'} ${flash ? 'fx-flash' : ''}`}
              style={{ boxShadow: flash ? `0 0 0 2px ${c}, 0 0 40px -6px ${c}` : undefined }}
            >
              <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-30 blur-3xl" style={{ background: c }} />
              <div className="relative flex items-center gap-3 px-5 pt-4">
                <span className="text-[11px] font-bold text-muted/70 tabular-nums">#{String(i + 1).padStart(2, '0')}</span>
                <span className="chip">{WHO[ev.who]}</span>
                <span className="chip">{ruleSummary(ev) || (ev.perUnit ? 'por cada unidad' : 'una vez')}</span>
                <div className="ml-auto">
                  <Toggle on={ev.enabled} onChange={(v) => patchEvent(ev.id, { enabled: v })} title="Activar / desactivar" />
                </div>
              </div>
              <button onClick={open} className="relative flex items-center gap-3 px-5 pt-4 pb-3 text-left">
                <div className="min-w-0 flex-1">
                  <TriggerChip t={t} size={52} />
                </div>
                <ArrowRight size={18} className="shrink-0 text-muted/60" />
                <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                  <div className="min-w-0 text-right">
                    <div className="truncate text-lg leading-tight font-extrabold tracking-tight" style={{ color: c }}>
                      {action.name}
                    </div>
                    <div className="text-[11px] text-muted">{action.showInOverlay ? 'se ve en el overlay' : 'oculta en el overlay'}</div>
                  </div>
                  <div className="grid h-[52px] w-[52px] shrink-0 place-items-center overflow-hidden rounded-2xl ring-1 ring-white/10" style={{ background: `radial-gradient(circle at 30% 20%, ${c}aa, ${c}22 60%, #0000)` }}>
                    {action.media ? <Media media={action.media} className="h-full w-full object-cover" /> : <span className="text-2xl font-black text-white drop-shadow">{action.name.slice(0, 1)}</span>}
                  </div>
                </div>
              </button>
              <button onClick={open} className="relative mx-5 rounded-xl border border-white/5 bg-black/40 px-3 py-2 text-left font-mono text-[12px] text-[#c4b5fd] hover:border-accent/40">
                <div className="truncate">{cmds[0] ? `/${cmds[0].replace(/^\//, '')}` : others ? 'pasos avanzados' : 'sin comandos'}</div>
                {cmds.length + others > 1 && <div className="mt-0.5 text-[11px] text-muted">+{cmds.length - 1 + others} más</div>}
              </button>
              <div className="relative flex flex-wrap items-center gap-1.5 px-5 pt-3">
                <span className="chip" title="Repeticiones">
                  ×{ev.multiplier}
                  {ev.perUnit ? ' por unidad' : ''}
                </span>
                <span className="chip" title="Intervalo entre repeticiones">⏱ {ev.intervalMs} ms</span>
                {ev.delayMs > 0 && <span className="chip" title="Retraso">⌛ {ev.delayMs} ms</span>}
                <SoundChip ev={ev} onEdit={open} />
              </div>
              <div className="relative mt-auto flex items-center gap-1.5 border-t border-white/5 px-4 py-3 pt-3">
                <button className="btn-accent !px-3" title="Probar completo: tarjeta, aviso, sonido y Minecraft" onClick={() => api('POST', `/api/actions/${action.id}/test`, { full: true, eventId: ev.id }).catch((e) => toast(e.message, 'error'))}>
                  <Play size={14} /> Probar
                </button>
                <button className="btn !px-3" title="Ejecutar solo en Minecraft" onClick={() => api('POST', `/api/actions/${action.id}/test`, { full: false, eventId: ev.id }).catch((e) => toast(e.message, 'error'))}>
                  <Pickaxe size={14} /> Solo Minecraft
                </button>
                <div className="ml-auto flex items-center gap-0.5 text-muted">
                  <IconBtn title="Mover antes" onClick={() => move(i, i - 1)}>
                    <ChevronUp size={16} className="-rotate-90" />
                  </IconBtn>
                  <IconBtn title="Mover después" onClick={() => move(i, i + 1)}>
                    <ChevronDown size={16} className="-rotate-90" />
                  </IconBtn>
                  <IconBtn title="Duplicar" onClick={() => duplicateRow(ev)}>
                    <Copy size={15} />
                  </IconBtn>
                  <IconBtn title="Borrar" danger onClick={() => removeRow(ev)}>
                    <Trash2 size={15} />
                  </IconBtn>
                </div>
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
      {/* superposición de las donaciones: enlace, estilo y vista previa, a mano junto a las funciones */}
      <CardOverlaySettings />
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

function IconBtn({ children, title, onClick, danger }: { children: ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick} className={`grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/10 ${danger ? 'hover:text-bad' : 'hover:text-white'}`}>
      {children}
    </button>
  )
}

function SoundChip({ ev, onEdit }: { ev: EventRule; onEdit: () => void }) {
  if (!ev.sound)
    return (
      <button onClick={onEdit} className="chip hover:border-accent/50 hover:text-white">
        <Plus size={11} /> <Music size={11} /> sonido
      </button>
    )
  const name = decodeURIComponent(ev.sound.file.split('/').pop() ?? '').replace(/^[a-z0-9]+-/, '')
  return (
    <button
      className="chip max-w-48 border-accent/40 text-[#d8ccff] hover:text-white"
      title={`${name} · ${Math.round(ev.sound.volume * 100)}% — clic para escuchar`}
      onClick={() => {
        const a = new Audio(ev.sound!.file)
        a.volume = ev.sound!.volume
        void a.play()
      }}
    >
      <Music size={11} /> <span className="truncate">{name}</span>
    </button>
  )
}
