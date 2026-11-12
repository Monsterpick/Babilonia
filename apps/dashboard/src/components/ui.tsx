import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X, Gift, Heart, UserPlus, Share2, MessageSquare, Star, Gem, Users, LogIn } from 'lucide-react'
import type { TriggerLabel } from '../lib/catalog'

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 px-8 pt-8 pb-5">
      <div className="mr-auto">
        <h1 className="text-[34px] leading-none font-extrabold tracking-tight">
          <span className="glow-text">{title}</span>
        </h1>
        {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  // bloquea el desplazamiento de la página mientras está abierta
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])
  if (!open) return null
  // Se dibuja en <body> (portal): si se abre desde una tarjeta con transform/filtro, «fixed» quedaría atrapado en ella
  // y la ventana saldría fuera de la pantalla, bajo un fondo difuminado.
  return createPortal(
    <div className="fixed inset-0 z-40 grid place-items-center bg-[#05050a]/75 p-4 backdrop-blur-md" onMouseDown={onClose}>
      <div className={`fx-in card flex max-h-[90vh] w-full flex-col ${wide ? 'max-w-4xl' : 'max-w-xl'}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center border-b border-white/5 px-6 py-4">
          <h2 className="mr-auto text-lg font-bold tracking-tight">{title}</h2>
          <button className="text-muted hover:text-white" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function Toggle({ on, onChange, title }: { on: boolean; onChange: (v: boolean) => void; title?: string }) {
  return (
    <button
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!on)
      }}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-gradient-to-r from-accent to-hot shadow-[0_0_14px_-4px_var(--color-hot)]' : 'bg-white/10 ring-1 ring-white/10'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

export function Check({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 shrink-0 cursor-pointer rounded accent-[var(--color-hot)]" />
      <span>{children}</span>
    </label>
  )
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; l: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.v)} data-on={o.v === value} onClick={() => onChange(o.v)} type="button">
          {o.l}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

const ICONS = { gift: Gift, heart: Heart, 'user-plus': UserPlus, share: Share2, message: MessageSquare, star: Star, gem: Gem, users: Users, 'log-in': LogIn }

export function TriggerChip({ t, size = 40 }: { t: TriggerLabel; size?: number }) {
  const Icon = ICONS[t.icon]
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-white/10 to-white/[0.02] ring-1 ring-white/10" style={{ width: size, height: size }}>
        {t.image ? <img src={t.image} alt="" className="h-[85%] w-[85%] object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,.5)]" /> : <Icon size={size * 0.45} className="text-accent-2" />}
      </div>
      <div className="min-w-0">
        <div className="truncate font-bold">{t.label}</div>
        {t.sub && <div className="text-xs font-semibold text-warn">{t.sub}</div>}
      </div>
    </div>
  )
}

export function Avatar({ url, name, size = 40 }: { url?: string; name: string; size?: number }) {
  const initials = name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '?'
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0)
  return url ? (
    <img src={url} alt="" referrerPolicy="no-referrer" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="grid shrink-0 place-items-center rounded-full font-bold text-white" style={{ width: size, height: size, background: `hsl(${hue} 60% 40%)`, fontSize: size * 0.38 }}>
      {initials}
    </div>
  )
}

export function Media({ media, className }: { media?: { kind: 'image' | 'video'; url: string }; className?: string }) {
  if (!media) return null
  return media.kind === 'video' ? (
    <video src={media.url} className={className} autoPlay loop muted playsInline />
  ) : (
    <img src={media.url} alt="" className={className} />
  )
}
