import { useEffect, type ReactNode } from 'react'
import { X, Gift, Heart, UserPlus, Share2, MessageSquare, Star, Gem, Users, LogIn } from 'lucide-react'
import type { TriggerLabel } from '../lib/catalog'

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 px-6 pt-6 pb-4">
      <div className="mr-auto">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
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
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className={`fx-in card flex max-h-[90vh] w-full flex-col ${wide ? 'max-w-4xl' : 'max-w-xl'}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center border-b border-line px-5 py-3">
          <h2 className="mr-auto font-semibold">{title}</h2>
          <button className="text-muted hover:text-white" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
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
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-accent' : 'bg-white/10'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

export function Check({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
      {children}
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
      <div className="grid shrink-0 place-items-center rounded-lg bg-white/5" style={{ width: size, height: size }}>
        {t.image ? <img src={t.image} alt="" className="h-[85%] w-[85%] object-contain" /> : <Icon size={size * 0.45} className="text-accent" />}
      </div>
      <div className="min-w-0">
        <div className="truncate font-semibold">{t.label}</div>
        {t.sub && <div className="text-xs text-warn">{t.sub}</div>}
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
