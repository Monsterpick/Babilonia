import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { POPULAR_GIFTS, findGift, useGifts, type GiftInfo } from '../lib/catalog'

/** Rejilla de regalos de TikTok con imagen y monedas, búsqueda y populares primero. */
export function GiftPicker({ selected, onPick, multi = false }: { selected: string[]; onPick: (g: GiftInfo) => void; multi?: boolean }) {
  const gifts = useGifts()
  const [q, setQ] = useState('')
  const [maxShown, setMaxShown] = useState(120)
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s) return gifts.filter((g) => g.name.toLowerCase().includes(s) || String(g.diamonds) === s)
    const popular = POPULAR_GIFTS.map((n) => findGift(gifts, n)).filter((g): g is GiftInfo => !!g)
    const rest = gifts.filter((g) => !popular.includes(g) && g.image)
    return [...popular, ...rest]
  }, [gifts, q])
  const sel = new Set(selected.map((s) => s.toLowerCase()))
  return (
    <div>
      <div className="relative mb-3">
        <Search size={15} className="absolute top-2.5 left-3 text-muted" />
        <input className="input pl-9" placeholder={`Buscar entre ${gifts.length} regalos (nombre o monedas)…`} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid max-h-80 grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2 overflow-y-auto pr-1">
        {list.slice(0, maxShown).map((g) => (
          <button
            key={`${g.name}-${g.diamonds}`}
            onClick={() => onPick(g)}
            className={`flex flex-col items-center rounded-lg border p-2 text-center transition ${
              sel.has(g.name.toLowerCase()) ? 'border-accent bg-accent/10' : 'border-line bg-bg hover:border-white/25'
            }`}
          >
            {g.image ? <img src={g.image} alt="" loading="lazy" className="h-12 w-12 object-contain" /> : <div className="h-12 w-12 rounded bg-white/5" />}
            <span className="mt-1 line-clamp-1 text-[11px] font-medium">{g.name}</span>
            <span className="text-[11px] text-warn">🪙 {g.diamonds}</span>
          </button>
        ))}
      </div>
      {list.length > maxShown && (
        <button className="btn mt-2 w-full justify-center" onClick={() => setMaxShown((m) => m + 240)}>
          Ver más ({list.length - maxShown})
        </button>
      )}
      {multi && <p className="mt-2 text-xs text-muted">Puedes elegir varios regalos para el mismo evento.</p>}
    </div>
  )
}
