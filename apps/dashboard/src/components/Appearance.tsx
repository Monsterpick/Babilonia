import { useState } from 'react'
import { Check } from 'lucide-react'
import { PALETTES, applyPalette, applyScale, getPalette, getScale } from '../lib/theme'

/** Color de la app y escala de la interfaz (se guardan en este equipo). */
export function AppearanceCard() {
  const [pal, setPal] = useState(getPalette())
  const [scale, setScale] = useState(getScale())
  return (
    <div className="card space-y-5 p-5">
      <div>
        <span className="label">Color de la app</span>
        <p className="mb-3 text-xs text-muted">El cambio es instantáneo. Se guarda en este equipo.</p>
        <div className="flex flex-wrap gap-4">
          {PALETTES.map((p) => (
            <button key={p.id} className="flex flex-col items-center gap-1.5" onClick={() => (setPal(p.id), applyPalette(p.id))} title={p.name}>
              <span className="grid h-11 w-11 place-items-center rounded-full ring-2 transition" style={{ background: p.swatch, boxShadow: pal === p.id ? `0 0 16px ${p.swatch}` : 'none', outline: pal === p.id ? '2px solid #fff' : 'none', outlineOffset: 2 }}>
                {pal === p.id && <Check size={18} className="text-white drop-shadow" strokeWidth={3} />}
              </span>
              <span className={`text-[11px] ${pal === p.id ? 'font-bold text-white' : 'text-muted'}`}>{p.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="border-t border-white/5 pt-4">
        <span className="label">Escala de la interfaz</span>
        <p className="mb-3 text-xs text-muted">Agranda todo. Útil en monitores 2K o 4K donde el 100 % se ve pequeño.</p>
        <div className="flex items-center gap-4">
          <input type="range" min={60} max={200} step={5} value={scale} onChange={(e) => (setScale(Number(e.target.value)), applyScale(Number(e.target.value)))} className="flex-1 accent-[var(--color-hot)]" />
          <span className="w-16 rounded-lg border border-line bg-black/30 py-1 text-center font-mono text-sm">{scale}%</span>
        </div>
        <div className="mt-3 flex gap-2">
          {[75, 100, 125, 150].map((v) => (
            <button key={v} className={`btn !px-3 ${scale === v ? 'border-accent/60 text-white' : ''}`} onClick={() => (setScale(v), applyScale(v))}>
              {v}%{v === 100 ? ' (defecto)' : ''}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
