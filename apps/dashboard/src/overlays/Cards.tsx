import { useEffect, useRef, useState } from 'react'
import type { Action, EventRule, OverlayStyle, Profile } from '@livearena/shared'
import { triggerLabel, type GiftInfo } from '../lib/catalog'
import { Media } from '../components/ui'

const SIZE = { small: 150, medium: 200, large: 260 }
const RATIO = { '16:9': 16 / 9, standard: 4 / 3, square: 1 }
const FONT = { bold: "'Arial Black', 'Segoe UI', sans-serif", impact: "Impact, 'Arial Narrow Bold', sans-serif", rounded: "'Nunito', 'Arial Rounded MT Bold', 'Segoe UI', sans-serif" }

export interface CardRow {
  action: Action
  event: EventRule
}

/** Filas para la rejilla de tarjetas: una por evento, con su acción principal. */
export function cardRows(profile: Profile): CardRow[] {
  return profile.events
    .map((event) => ({ event, action: profile.actions.find((a) => a.id === event.actionIds[0])! }))
    .filter((r) => r.action && r.action.showInOverlay && (r.event.enabled || profile.overlay.showDisabled))
}

export function PluginCard({ row, style, gifts, fx }: { row: CardRow; style: OverlayStyle; gifts: GiftInfo[]; fx?: number }) {
  const { action, event } = row
  const t = triggerLabel(event.trigger, gifts)
  const w = SIZE[style.size]
  const h = w / RATIO[style.shape]
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!fx || !style.animate || !ref.current) return
    const el = ref.current
    const cls = { flash: 'fx-flash', pulse: 'fx-pulse', shake: 'fx-shake' }[style.onFire]
    el.classList.remove(cls)
    void el.offsetWidth
    el.classList.add(cls)
  }, [fx, style.animate, style.onFire])

  const bgAlpha = Math.round(style.background * 255).toString(16).padStart(2, '0')
  const halloween = style.theme === 'halloween'
  const baseBg =
    style.cardStyle === 'glass'
      ? `rgba(20,24,32,${style.background * 0.45})`
      : style.cardStyle === 'minimal'
        ? 'transparent'
        : `linear-gradient(160deg, ${action.color}${bgAlpha === '00' ? '00' : '55'}, #0b0d12${bgAlpha})`
  const accent = halloween ? '#ff7a00' : action.color
  return (
    <div
      ref={ref}
      className="relative overflow-hidden"
      style={{
        width: w,
        height: h,
        borderRadius: style.radius,
        border: style.cardStyle === 'minimal' ? 'none' : `${style.border}px solid ${accent}${style.cardStyle === 'neon' ? '' : '88'}`,
        background: baseBg,
        backdropFilter: style.cardStyle === 'glass' ? 'blur(8px)' : undefined,
        boxShadow: style.glow > 0 ? `0 0 ${24 * style.glow}px ${8 * style.glow}px ${accent}${style.cardStyle === 'neon' ? 'aa' : '55'}` : undefined,
        opacity: event.enabled ? 1 : 0.45,
        filter: event.enabled ? undefined : 'grayscale(1)',
      }}
    >
      {action.media &&
        (style.imageFit === 'background' ? (
          <Media media={action.media} className="absolute inset-0 h-full w-full object-cover" />
        ) : style.imageFit === 'circle' ? (
          <div className="absolute inset-0 grid place-items-center">
            <Media media={action.media} className="aspect-square h-[70%] rounded-full object-cover" />
          </div>
        ) : (
          <div className="absolute inset-[8%] grid place-items-center">
            <Media media={action.media} className={`h-full w-full ${style.imageFit === 'contain' ? 'object-contain' : 'object-cover'} rounded-md`} />
          </div>
        ))}
      {style.showName && (
        <div
          className={`absolute inset-x-0 px-2 text-center leading-none ${style.namePosition === 'top' ? 'top-0 bg-gradient-to-b pt-2 pb-5' : 'bottom-0 bg-gradient-to-t pt-5 pb-2'} from-black/85 to-transparent`}
          style={{ fontFamily: FONT[style.font], fontWeight: 900, fontSize: Math.round(w * 0.11 * style.nameSize), color: style.nameColor === 'event' ? accent : '#fff', textShadow: '0 2px 6px #000, 0 0 2px #000', letterSpacing: 0.5 }}
        >
          {action.name}
        </div>
      )}
      {style.showGift && (
        <div
          className={`absolute top-1.5 flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 ${style.giftCorner === 'right' ? 'right-1.5' : 'left-1.5'}`}
          style={{ fontSize: Math.round(11 * style.giftSize), fontFamily: FONT.bold, color: '#fff' }}
        >
          {t.image ? (
            <img src={t.image} alt="" style={{ width: 24 * style.giftSize, height: 24 * style.giftSize }} className="object-contain" />
          ) : (
            <span style={{ color: '#ff4f7a' }}>{t.icon === 'heart' || t.icon === 'users' ? '♥' : t.icon === 'user-plus' ? '+' : t.icon === 'share' ? '↗' : '★'}</span>
          )}
          {/* con imagen, solo el icono del regalo; sin imagen (likes, seguir, compartir…), el símbolo y el texto */}
          {t.image ? null : <span className="max-w-[9em] truncate">{t.label.replace(/^(Likes|Sala) · /, '')}</span>}
        </div>
      )}
    </div>
  )
}

/** Fondos del overlay completo (detrás de las tarjetas o píldoras). */
export const BACKDROPS: Record<string, string> = {
  none: 'transparent',
  ondas: 'linear-gradient(115deg, #f472b6 0 18%, #a855f7 18% 44%, #facc15 44% 66%, #22d3ee 66% 100%)',
  aurora: 'radial-gradient(120% 140% at 0% 0%, #22d3ee 0, transparent 45%), radial-gradient(120% 140% at 100% 100%, #a855f7 0, transparent 50%), linear-gradient(135deg, #0f172a, #1e1b4b)',
  atardecer: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #7c3aed 100%)',
  oceano: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 45%, #1e3a8a 100%)',
  neon: 'linear-gradient(135deg, #050510, #120a2a)',
}

/** Píldora (diseño de lista): imagen de la función, regalo que la activa y nombre debajo. */
export function PillCard({ row, style, gifts, fx, w }: { row: CardRow; style: OverlayStyle; gifts: GiftInfo[]; fx?: number; w: number }) {
  const { action, event } = row
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!fx || !style.animate || !ref.current) return
    const cls = { flash: 'fx-flash', pulse: 'fx-pulse', shake: 'fx-shake' }[style.onFire]
    ref.current.classList.remove(cls)
    void ref.current.offsetWidth
    ref.current.classList.add(cls)
  }, [fx, style.animate, style.onFire])
  const t = triggerLabel(event.trigger, gifts)
  const h = Math.round(w * 0.3)
  const neon = style.backdrop === 'neon' || style.cardStyle === 'neon'
  return (
    <div
      ref={ref}
      className="relative flex items-center justify-center"
      style={{
        width: w,
        height: h,
        borderRadius: h / 2,
        background: style.cardStyle === 'minimal' ? 'transparent' : neon ? 'rgba(10,10,25,0.85)' : `rgba(255,255,255,${0.35 + style.background * 0.45})`,
        border: neon ? `2px solid ${action.color}` : style.border ? `${style.border}px solid rgba(0,0,0,0.25)` : 'none',
        boxShadow: neon ? `0 0 ${18 * (style.glow + 0.3)}px ${action.color}` : style.glow > 0 ? `0 2px ${10 * style.glow}px rgba(0,0,0,.35)` : undefined,
        opacity: event.enabled ? 1 : 0.4,
        gap: h * 0.18,
      }}
    >
      <div className="relative" style={{ width: h * 0.82, height: h * 0.82 }}>
        {action.media ? <Media media={action.media} className="h-full w-full object-contain drop-shadow-[0_2px_2px_rgba(0,0,0,.6)]" /> : <div className="h-full w-full rounded-full" style={{ background: action.color }} />}
        {event.multiplier > 1 && (
          <span className="absolute -bottom-1 -left-2 font-black text-white" style={{ fontSize: h * 0.3, WebkitTextStroke: `${Math.max(1, h * 0.04)}px #7c3aed`, fontFamily: FONT.bold }}>
            {event.multiplier}x
          </span>
        )}
      </div>
      {style.showGift &&
        (t.image ? (
          <img src={t.image} alt="" style={{ width: h * 0.68 * style.giftSize, height: h * 0.68 * style.giftSize }} className="object-contain drop-shadow-[0_2px_2px_rgba(0,0,0,.6)]" />
        ) : (
          <span className="max-w-[55%] truncate font-black whitespace-nowrap" style={{ fontSize: h * 0.2, color: '#ff4f7a', fontFamily: FONT.bold, textShadow: '0 1px 0 #fff8' }}>
            {t.label}
          </span>
        ))}
      {style.showName && (
        <span
          className="pointer-events-none absolute inset-x-2 truncate text-center"
          style={{ bottom: h * 0.02, fontFamily: FONT[style.font], fontWeight: 900, fontSize: Math.round(h * 0.17 * style.nameSize), color: neon || style.nameColor === 'event' ? (neon ? '#fff' : action.color) : '#111', textShadow: neon ? `0 0 6px ${action.color}` : '0 0 2px #fff, 0 0 2px #fff', letterSpacing: 0.3 }}
        >
          {action.name}
        </span>
      )}
    </div>
  )
}

/** Rejilla de tarjetas (lo que se ve en el live): se anima la tarjeta que se activa. */
export function CardGrid({ profile, gifts, fired, width }: { profile: Profile; gifts: GiftInfo[]; fired: Record<string, number>; width?: number }) {
  const style = profile.overlay
  const rows = cardRows(profile)
  const groups = style.split ? [rows.filter((r) => r.action.alignment !== 'bad'), rows.filter((r) => r.action.alignment === 'bad')] : [rows]
  const pills = style.layout === 'pills'
  const w = pills ? SIZE[style.size] * 1.7 : SIZE[style.size]
  const cols = style.columns === 'auto' ? undefined : style.columns
  const bd = BACKDROPS[style.backdrop] ?? 'transparent'
  return (
    <div className="flex flex-col" style={{ gap: 12, width, background: bd, padding: style.backdrop === 'none' ? 0 : 10, borderRadius: style.backdrop === 'none' ? 0 : 14 }}>
      {groups.map((g, gi) => (
        <div key={gi} className="flex flex-wrap justify-center" style={{ gap: pills ? 8 : 6, maxWidth: cols ? cols * (w + (pills ? 8 : 6)) : undefined, margin: '0 auto' }}>
          {g.map((r) =>
            pills ? <PillCard key={r.event.id} row={r} style={style} gifts={gifts} fx={fired[r.action.id]} w={w} /> : <PluginCard key={r.event.id} row={r} style={style} gifts={gifts} fx={fired[r.action.id]} />,
          )}
        </div>
      ))}
    </div>
  )
}

export function useFired(): [Record<string, number>, (id: string) => void] {
  const [fired, setFired] = useState<Record<string, number>>({})
  return [fired, (id: string) => setFired((f) => ({ ...f, [id]: Date.now() }))]
}
