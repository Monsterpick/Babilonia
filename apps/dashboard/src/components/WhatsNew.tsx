import { useState } from 'react'
import { Bug, Sparkles, Wrench } from 'lucide-react'
import { NOVEDADES, type Novedad } from '../novedades'
import { Modal } from './ui'

const KEY = 'livearena.novedades.vistas'

function seen(): number {
  try {
    return Number(localStorage.getItem(KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

function List({ icon, title, color, items }: { icon: React.ReactNode; title: string; color: string; items?: string[] }) {
  if (!items?.length) return null
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 text-xs font-extrabold tracking-wider" style={{ color }}>
        {icon} {title}
      </div>
      <ul className="mt-1.5 space-y-1.5 text-sm text-white/90">
        {items.map((t) => (
          <li key={t} className="flex gap-2">
            <span style={{ color }}>•</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Ventana de novedades: sale una vez después de cada actualización con lo nuevo, lo mejorado y lo corregido. */
export function WhatsNew() {
  const last = NOVEDADES[0]?.id ?? 0
  const [list] = useState<Novedad[]>(() => NOVEDADES.filter((n) => n.id > seen()).slice(0, 3))
  const [open, setOpen] = useState(list.length > 0)
  const close = () => {
    try {
      localStorage.setItem(KEY, String(last))
    } catch {
      /* sin almacenamiento: volverá a salir la próxima vez */
    }
    setOpen(false)
  }
  if (!list.length) return null
  return (
    <Modal open={open} onClose={close} title="Novedades de LiveArena" wide>
      <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
        {list.map((n) => (
          <div key={n.id} className="rounded-2xl border border-line bg-black/25 p-4">
            <div className="text-lg font-extrabold">{n.titulo}</div>
            <div className="text-xs text-muted">{n.fecha}</div>
            <List icon={<Sparkles size={13} />} title="NUEVO" color="#a78bfa" items={n.nuevo} />
            <List icon={<Wrench size={13} />} title="MEJORADO" color="#4ade80" items={n.mejorado} />
            <List icon={<Bug size={13} />} title="CORREGIDO" color="#fbbf24" items={n.corregido} />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button className="btn-accent" onClick={close}>
          ¡Entendido!
        </button>
      </div>
    </Modal>
  )
}
