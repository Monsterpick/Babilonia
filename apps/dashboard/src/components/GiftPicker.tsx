import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { POPULAR_GIFTS, findGift, useGifts, type GiftInfo } from '../lib/catalog'

/** Rejilla de regalos de TikTok con imagen y monedas, búsqueda y populares primero. */
export function GiftPicker({ selected, onPick, multi = false }: { selected: string[]; onPick: (g: GiftInfo) => void; multi?: boolean }) {
  const gifts = useGifts()
  const [q, setQ] = useState('')
  const [maxShown, setMaxShown] = useState(120)
  const list = useMemo(() => {
    // búsqueda sin distinguir tildes ni mayúsculas («corazon» encuentra «Corazón»)
    const plain = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const s = plain(q.trim())
    if (s) return gifts.filter((g) => plain(g.name).includes(s) || String(g.diamonds) === s)
    const popular = POPULAR_GIFTS.map((n) => findGift(gifts, n)).filter((g): g is GiftInfo => !!g)
    // después de los populares: primero los que tienen precio conocido (de menos a más) y al final los que no
    const rest = gifts.filter((g) => !popular.includes(g) && g.image)
    const priced = rest.filter((g) => g.diamonds > 0).sort((a, b) => a.diamonds - b.diamonds || a.name.localeCompare(b.name, 'es'))
    const unpriced = rest.filter((g) => !(g.diamonds > 0)).sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return [...popular, ...priced, ...unpriced]
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
            title={g.diamonds > 0 ? `${g.name} · ${g.diamonds} monedas` : g.name}
            className={`flex flex-col items-center rounded-lg border p-2 text-center transition ${
              sel.has(g.name.toLowerCase()) ? 'border-accent bg-accent/10' : 'border-line bg-bg hover:border-white/25'
            }`}
          >
            {g.image ? <img src={g.image} alt="" loading="lazy" className="h-12 w-12 object-contain" /> : <div className="h-12 w-12 rounded bg-white/5" />}
            <span className="mt-1 line-clamp-1 text-[11px] font-medium">{g.name}</span>
            {g.diamonds > 0 ? <span className="text-[11px] text-warn">🪙 {g.diamonds.toLocaleString('es')}</span> : <span className="text-[10px] text-muted">sin precio</span>}
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
