import { useEffect, useState, type ReactNode } from 'react'
import { Copy, ExternalLink, RotateCcw, Sparkles } from 'lucide-react'
import { OverlayStyleSchema, type OverlayStyle } from '@livearena/shared'
import { useApp } from '../App'
import { api, overlayUrl } from '../lib/api'
import { useGifts } from '../lib/catalog'
import { useOnAction } from '../lib/live'
import { Check, PageHeader, Seg } from '../components/ui'
import { toast } from '../components/Toast'
import { CardGrid, useFired } from '../overlays/Cards'

const OVERLAYS = [
  { id: 'tarjetas', name: 'Tarjetas de plugins', desc: 'Todas tus acciones; la que se activa se anima. 1080×400 aprox.' },
  { id: 'avisos', name: 'Avisos', desc: 'Foto y nombre de quien envía + lo que provocó. 500×600' },
  { id: 'top-donadores', name: 'Top donadores', desc: 'Ranking del live por monedas. ?n=5' },
  { id: 'top-likes', name: 'Top likes', desc: 'Ranking del live por likes.' },
  { id: 'meta-likes', name: 'Meta de likes', desc: 'Barra de progreso de likes de la sala.' },
  { id: 'mejor-regalo', name: 'Mejor regalo', desc: 'Récord del directo (?scope=ever para el histórico).' },
  { id: 'marcador', name: 'Marcador W | L', desc: 'Victorias y derrotas.' },
  { id: 'vidas', name: 'Vidas', desc: 'Corazones; baja al morir el jugador.' },
  { id: 'cronometro', name: 'Cronómetro', desc: 'Tiempo sobreviviendo.' },
]

export function OverlaysPage() {
  const { profile } = useApp()
  const gifts = useGifts()
  const [style, setStyle] = useState<OverlayStyle | null>(null)
  const [fired, fire] = useFired()
  useOnAction((a) => a.kind === 'overlay.card' && a.actionId && fire(a.actionId))
  useEffect(() => {
    if (profile && !style) setStyle(profile.overlay)
  }, [profile, style])
  useEffect(() => {
    if (!style || !profile || JSON.stringify(style) === JSON.stringify(profile.overlay)) return
    const t = setTimeout(() => api('PUT', '/api/profile/overlay', style).catch((e) => toast(e.message, 'error')), 400)
    return () => clearTimeout(t)
  }, [style, profile])
  if (!profile || !style) return null
  const set = (p: Partial<OverlayStyle>) => setStyle({ ...style, ...p })

  return (
    <div className="pb-10">
      <PageHeader title="Overlays" subtitle="Pégalos como «Fuente de navegador» en OBS o como «Enlace» en TikTok LIVE Studio." />
      <div className="grid gap-3 px-6 md:grid-cols-2 xl:grid-cols-3">
        {OVERLAYS.map((o) => {
          const url = overlayUrl(o.id)
          return (
            <div key={o.id} className="card p-4">
              <div className="font-semibold">{o.name}</div>
              <div className="mb-2 text-xs text-muted">{o.desc}</div>
              <div className="flex gap-1.5">
                <input readOnly value={url} className="input font-mono text-[11px]" onFocus={(e) => e.target.select()} />
                <button
                  className="btn px-2"
                  title="Copiar"
                  onClick={() => navigator.clipboard.writeText(url).then(() => toast('URL copiada'), () => toast('No se pudo copiar', 'error'))}
                >
                  <Copy size={14} />
                </button>
                <a className="btn px-2" href={url} target="_blank" rel="noreferrer" title="Abrir">
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8 flex items-center px-6">
        <h2 className="mr-auto text-sm font-semibold tracking-widest text-muted">CÓMO SE VEN LAS TARJETAS</h2>
        <button className="btn mr-2" onClick={() => set({ cardStyle: 'minimal', glow: 0, border: 0, background: 0, showGift: true })}>
          <Sparkles size={14} /> Diseño minimalista
        </button>
        <button className="btn" onClick={() => setStyle(OverlayStyleSchema.parse({}))}>
          <RotateCcw size={14} /> Valores por defecto
        </button>
      </div>
      <div className="grid gap-3 px-6 pt-3 md:grid-cols-2 xl:grid-cols-3 min-[1900px]:grid-cols-5">
        <Panel title="Distribución">
          <Row label="Columnas">
            <select className="input" value={String(style.columns)} onChange={(e) => set({ columns: e.target.value === 'auto' ? 'auto' : Number(e.target.value) })}>
              <option value="auto">Las que quepan</option>
              {[2, 3, 4, 5, 6, 8].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Tamaño">
            <Seg value={style.size} onChange={(v) => set({ size: v })} options={[{ v: 'small', l: 'Pequeño' }, { v: 'medium', l: 'Mediano' }, { v: 'large', l: 'Grande' }]} />
          </Row>
          <Row label="Forma">
            <Seg value={style.shape} onChange={(v) => set({ shape: v })} options={[{ v: '16:9', l: '16:9' }, { v: 'standard', l: '4:3' }, { v: 'square', l: 'Cuadrada' }]} />
          </Row>
          <Row label="Dividir">
            <Seg value={style.split ? 'y' : 'n'} onChange={(v) => set({ split: v === 'y' })} options={[{ v: 'n', l: 'No' }, { v: 'y', l: 'Ayuda | Sabotaje' }]} />
          </Row>
        </Panel>
        <Panel title="Tarjeta">
          <Row label="Estilo">
            <Seg value={style.cardStyle} onChange={(v) => set({ cardStyle: v })} options={[{ v: 'glass', l: 'Cristal' }, { v: 'solid', l: 'Sólido' }, { v: 'neon', l: 'Neón' }, { v: 'minimal', l: 'Mínimo' }]} />
          </Row>
          <Slider label="Esquinas" value={style.radius} min={0} max={40} unit="px" onChange={(v) => set({ radius: v })} />
          <Slider label="Borde" value={style.border} min={0} max={8} unit="px" onChange={(v) => set({ border: v })} />
          <Slider label="Brillo" value={Math.round(style.glow * 100)} min={0} max={100} unit="%" onChange={(v) => set({ glow: v / 100 })} />
          <Slider label="Fondo" value={Math.round(style.background * 100)} min={0} max={100} unit="%" onChange={(v) => set({ background: v / 100 })} />
          <Check on={style.showDisabled} onChange={(v) => set({ showDisabled: v })}>
            Mostrar también las apagadas (en gris)
          </Check>
        </Panel>
        <Panel title="Imagen y nombre">
          <Row label="Imagen">
            <Seg value={style.imageFit} onChange={(v) => set({ imageFit: v })} options={[{ v: 'background', l: 'De fondo' }, { v: 'contain', l: 'Completa' }, { v: 'cover', l: 'Llenar' }, { v: 'circle', l: 'Círculo' }]} />
          </Row>
          <Check on={style.showName} onChange={(v) => set({ showName: v })}>
            Mostrar el nombre
          </Check>
          <Slider label="Tamaño del nombre" value={Math.round(style.nameSize * 100)} min={30} max={200} unit="%" onChange={(v) => set({ nameSize: v / 100 })} />
          <Row label="Color">
            <Seg value={style.nameColor} onChange={(v) => set({ nameColor: v })} options={[{ v: 'white', l: 'Blanco' }, { v: 'event', l: 'Del evento' }]} />
          </Row>
          <Row label="Posición">
            <Seg value={style.namePosition} onChange={(v) => set({ namePosition: v })} options={[{ v: 'bottom', l: 'Abajo' }, { v: 'top', l: 'Arriba' }]} />
          </Row>
          <Row label="Letra">
            <Seg value={style.font} onChange={(v) => set({ font: v })} options={[{ v: 'bold', l: 'Gruesa' }, { v: 'impact', l: 'Impacto' }, { v: 'rounded', l: 'Redonda' }]} />
          </Row>
        </Panel>
        <Panel title="Regalo y animación">
          <Check on={style.showGift} onChange={(v) => set({ showGift: v })}>
            Mostrar el regalo que la activa
          </Check>
          <Row label="Esquina">
            <Seg value={style.giftCorner} onChange={(v) => set({ giftCorner: v })} options={[{ v: 'right', l: 'Derecha' }, { v: 'left', l: 'Izquierda' }]} />
          </Row>
          <Slider label="Tamaño del regalo" value={Math.round(style.giftSize * 100)} min={50} max={200} unit="%" onChange={(v) => set({ giftSize: v / 100 })} />
          <Check on={style.animate} onChange={(v) => set({ animate: v })}>
            Animaciones
          </Check>
          <Row label="Al saltar">
            <Seg value={style.onFire} onChange={(v) => set({ onFire: v })} options={[{ v: 'flash', l: 'Destello' }, { v: 'pulse', l: 'Pulso' }, { v: 'shake', l: 'Sacudida' }]} />
          </Row>
        </Panel>
        <Panel title="Temporada">
          <Row label="Tema">
            <Seg value={style.theme} onChange={(v) => set({ theme: v })} options={[{ v: 'normal', l: 'Normal' }, { v: 'halloween', l: 'Halloween' }]} />
          </Row>
        </Panel>
      </div>
      <div className="mx-6 mt-3 rounded-xl border border-line p-4" style={{ background: 'repeating-conic-gradient(#15181e 0 25%, #101216 0 50%) 0 0/24px 24px' }}>
        <CardGrid profile={{ ...profile, overlay: style }} gifts={gifts} fired={fired} />
        <p className="mt-3 text-center text-xs text-muted">Vista previa en vivo: usa ▶ en Plugins o el Simulador para ver la animación.</p>
      </div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card space-y-3 p-4">
      <div className="text-xs font-semibold tracking-widest text-muted">{title.toUpperCase()}</div>
      {children}
    </div>
  )
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-sm text-white/80">{label}</div>
      {children}
    </div>
  )
}
function Slider({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 text-white/80">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-[var(--color-accent)]" />
      <span className="w-12 text-right font-mono text-xs">
        {value}
        {unit}
      </span>
    </div>
  )
}
