import { Loader2, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { ICONS, iconFile, iconUrl, type IconDef } from '../lib/mcIcons'
import { useLiveState } from '../lib/live'
import { Modal } from './ui'
import { toast } from './Toast'

type TexStatus = { state: 'none' | 'importing' | 'ready' | 'error'; pct?: number; message?: string; version?: string }
const CATS = ['Todos', 'Mobs', 'Bloques', 'Packs', 'Objetos'] as const

function Tile({ def, onPick, busy }: { def: IconDef; onPick: (d: IconDef) => void; busy: boolean }) {
  const [src, setSrc] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let off = false
    iconUrl(def, 128).then((u) => !off && setSrc(u))
    return () => {
      off = true
    }
  }, [def])
  if (src === null) return null // la versión de Minecraft no tiene esa textura
  return (
    <button
      className="group relative grid aspect-square place-items-center rounded-xl border border-white/5 bg-black/25 p-1.5 transition hover:-translate-y-0.5 hover:border-accent/60 hover:bg-accent/10 disabled:opacity-50"
      title={def.name}
      disabled={busy}
      onClick={() => onPick(def)}
    >
      {src ? <img src={src} alt={def.name} className="h-full w-full object-contain" /> : <Loader2 size={16} className="animate-spin text-muted" />}
      <span className="pointer-events-none absolute inset-x-1 bottom-1 truncate rounded bg-black/70 px-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100">{def.name}</span>
    </button>
  )
}

/**
 * Catálogo de imágenes listas para las funciones: cabezas de mobs, bloques, montones y objetos de Minecraft,
 * generadas con las texturas del juego del propio usuario. Al elegir una se guarda como imagen de la función.
 */
export function ImageCatalog({ open, onClose, onPicked }: { open: boolean; onClose: () => void; onPicked: (media: { kind: 'image'; url: string }) => void }) {
  const live = useLiveState<TexStatus>('textures')
  const [st, setSt] = useState<TexStatus | null>(null)
  const [cat, setCat] = useState<(typeof CATS)[number]>('Todos')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) api<TexStatus>('GET', '/api/textures').then(setSt, () => undefined)
  }, [open])
  useEffect(() => {
    if (live) setSt(live)
  }, [live])
  const list = useMemo(() => ICONS.filter((d) => (cat === 'Todos' || d.cat === cat) && (!q || d.name.toLowerCase().includes(q.toLowerCase()))), [cat, q])

  const pick = async (d: IconDef) => {
    setBusy(true)
    try {
      const f = await iconFile(d)
      if (!f) throw new Error('No se pudo generar la imagen')
      const fd = await fetch('/api/media/upload', { method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-filename': f.name }, body: f })
      const r = (await fd.json()) as { kind: string; url: string; error?: string }
      if (!fd.ok) throw new Error(r.error ?? 'Error al guardar')
      onPicked({ kind: 'image', url: r.url })
      onClose()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const importTex = async () => {
    try {
      setSt(await api<TexStatus>('POST', '/api/textures/import', {}))
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Catálogo de imágenes · Minecraft" wide>
      {st?.state !== 'ready' ? (
        <div className="grid place-items-center gap-3 p-10 text-center text-sm text-muted">
          {st?.state === 'importing' ? (
            <>
              <Loader2 className="animate-spin" /> Preparando las imágenes con tu Minecraft… {st.pct ?? 0}%
            </>
          ) : (
            <>
              <p className="max-w-md">
                Las imágenes se crean con las texturas de <b className="text-white">tu</b> Minecraft (no se descarga nada). Ábrelo una vez con el lanzador y
                pulsa el botón.
              </p>
              {st?.message && <p className="text-xs text-warn">{st.message}</p>}
              <button className="btn-accent" onClick={importTex}>
                Preparar imágenes
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-full border border-line bg-black/30 p-1 text-xs font-bold">
              {CATS.map((c) => (
                <button key={c} className={`rounded-full px-3 py-1 ${cat === c ? 'bg-accent text-white' : 'text-muted hover:text-white'}`} onClick={() => setCat(c)}>
                  {c}
                </button>
              ))}
            </div>
            <label className="ml-auto flex items-center gap-2 rounded-full border border-line bg-black/30 px-3 py-1.5 text-sm">
              <Search size={14} className="text-muted" />
              <input className="w-44 bg-transparent outline-none" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            {busy && <Loader2 size={16} className="animate-spin text-muted" />}
          </div>
          <div className="grid max-h-[60vh] grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6 lg:grid-cols-8">
            {list.map((d) => (
              <Tile key={d.id} def={d} onPick={pick} busy={busy} />
            ))}
          </div>
          <p className="text-[11px] text-muted">Creadas con las texturas de tu Minecraft {st.version}. Se guardan como imagen de la función (también sirven tus propias imágenes o vídeos).</p>
        </div>
      )}
    </Modal>
  )
}
