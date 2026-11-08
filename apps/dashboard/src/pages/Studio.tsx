import { useEffect, useRef, useState } from 'react'
import { Copy, Eye, EyeOff, GripVertical, Image as ImageIcon, Layers, Lock, MonitorPlay, Play, Plus, Shapes, Sparkles, Trash2, Type, Unlock, Video, Gift as GiftIcon, Smile } from 'lucide-react'
import type { Layer, Scene } from '@livearena/shared'
import { api, overlayUrl } from '../lib/api'
import { PageHeader, Seg } from '../components/ui'
import { toast } from '../components/Toast'
import { LayerView } from '../overlays/Scene'
import { GiftPicker } from '../components/GiftPicker'
import { Modal } from '../components/ui'

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

const OVERLAY_OPTS = [
  ['avisos', 'Avisos'], ['logros', 'Logros / Te mató'], ['destacados', 'Destacados'], ['contador', 'Contador V/D'], ['cronometro', 'Cronómetro'], ['vidas', 'Vidas'], ['totems', 'Tótems'],
  ['mejor-regalo', 'Mejor regalo'], ['mejor-directo', 'Mejor del directo'], ['mejor-racha', 'Mejor racha'], ['meta-regalo', 'Meta de regalo'], ['duelo', 'Duelo'], ['reset-salvar', 'Reset o salvar'],
  ['meta-monedas', 'Meta de monedas'], ['meta-likes', 'Meta de likes'], ['meta-seguidores', 'Meta de seguidores'], ['meta-combinada', 'Meta combinada'], ['top-regalos', 'Top regalos'], ['top-likes', 'Top likes'], ['mvp-monedas', 'MVP monedas'], ['mvp-likes', 'MVP likes'],
] as const

const RATIOS: Record<string, number> = { '9:16': 9 / 16, '16:9': 16 / 9, '1:1': 1, free: 16 / 9 }

function newLayer(type: Layer['type']): Layer {
  const base = { id: uid('l'), type, name: '', x: 30, y: 30, w: 40, h: 25, rot: 0, opacity: 1, hidden: false, locked: false, overlay: 'avisos', overlayParams: '', url: '', fit: 'contain' as const, loop: true, muted: true, text: 'Texto', font: 56, color: '#ffffff', weight: 800, align: 'center' as const, stroke: true, icon: '⭐', shape: 'rect' as const, radius: 16, gift: 'Rose' }
  if (type === 'text') return { ...base, name: 'Texto', w: 50, h: 15 }
  if (type === 'shape') return { ...base, name: 'Forma', color: '#8b5cf6' }
  if (type === 'icon') return { ...base, name: 'Icono', w: 15, h: 20 }
  if (type === 'gift') return { ...base, name: 'Regalo', w: 20, h: 25 }
  if (type === 'overlay') return { ...base, name: 'Overlay' }
  return { ...base, name: type }
}

export function StudioPage() {
  const [scenes, setScenes] = useState<Scene[]>([])
  const [curId, setCurId] = useState('')
  const [sel, setSel] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [giftFor, setGiftFor] = useState<string | null>(null)
  const canvas = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    api<Scene[]>('GET', '/api/scenes')
      .then((s) => {
        setScenes(s)
        setCurId(s[0]?.id ?? '')
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const cur = scenes.find((s) => s.id === curId)
  const persist = (next: Scene[]) => {
    setScenes(next)
    clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => api('PUT', '/api/scenes', next).catch((e) => toast((e as Error).message, 'error')), 400)
  }
  const patchScene = (p: Partial<Scene>) => cur && persist(scenes.map((s) => (s.id === cur.id ? { ...s, ...p } : s)))
  const patchLayer = (id: string, p: Partial<Layer>) => cur && patchScene({ layers: cur.layers.map((l) => (l.id === id ? { ...l, ...p } : l)) })
  const addLayer = (type: Layer['type']) => {
    if (!cur) return
    const l = newLayer(type)
    patchScene({ layers: [...cur.layers, l] })
    setSel(l.id)
  }
  const removeLayer = (id: string) => cur && (patchScene({ layers: cur.layers.filter((l) => l.id !== id) }), setSel(''))
  const move = (id: string, dir: -1 | 1) => {
    if (!cur) return
    const i = cur.layers.findIndex((l) => l.id === id)
    const j = i + dir
    if (j < 0 || j >= cur.layers.length) return
    const arr = [...cur.layers]
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
    patchScene({ layers: arr })
  }
  const newScene = () => {
    const s: Scene = { id: uid('scene'), name: `Escena ${scenes.length + 1}`, ratio: '16:9', bg: 'transparent', layers: [] }
    persist([...scenes, s])
    setCurId(s.id)
    setSel('')
  }

  // Arrastrar / redimensionar en el lienzo
  const drag = (e: React.PointerEvent, l: Layer, mode: 'move' | 'resize') => {
    if (l.locked) return
    e.preventDefault()
    e.stopPropagation()
    setSel(l.id)
    const rect = canvas.current!.getBoundingClientRect()
    const start = { mx: e.clientX, my: e.clientY, x: l.x, y: l.y, w: l.w, h: l.h }
    const onMove = (ev: PointerEvent) => {
      const dx = ((ev.clientX - start.mx) / rect.width) * 100
      const dy = ((ev.clientY - start.my) / rect.height) * 100
      if (mode === 'move') patchLayer(l.id, { x: Math.round(start.x + dx), y: Math.round(start.y + dy) })
      else patchLayer(l.id, { w: Math.max(3, Math.round(start.w + dx)), h: Math.max(3, Math.round(start.h + dy)) })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  if (!loaded) return null
  const url = cur ? overlayUrl('escena', { s: cur.id }) : ''
  const selLayer = cur?.layers.find((l) => l.id === sel)

  return (
    <div className="pb-10">
      <PageHeader title="Estudio de escenas" subtitle="Monta tu escena del directo: arrastra capas, ponles overlays, imágenes o texto y copia una sola URL.">
        <button className="btn" onClick={newScene}>
          <Plus size={15} /> Nueva escena
        </button>
      </PageHeader>

      {scenes.length === 0 ? (
        <div className="px-8">
          <div className="card grid place-items-center gap-3 p-16 text-center">
            <Sparkles className="text-accent-2" />
            <p className="text-muted">Crea tu primera escena para empezar a montarla.</p>
            <button className="btn-accent" onClick={newScene}>
              <Plus size={15} /> Nueva escena
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 px-8">
          {/* barra superior: escena + ratio + añadir */}
          <div className="card flex flex-wrap items-center gap-2 p-3">
            <select className="input !w-auto" value={curId} onChange={(e) => (setCurId(e.target.value), setSel(''))}>
              {scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {cur && <input className="input !w-44" value={cur.name} onChange={(e) => patchScene({ name: e.target.value })} />}
            {cur && (
              <Seg value={cur.ratio} options={[{ v: '16:9', l: '16:9' }, { v: '9:16', l: '9:16' }, { v: '1:1', l: '1:1' }, { v: 'free', l: 'Libre' }]} onChange={(v) => patchScene({ ratio: v })} />
            )}
            <span className="mr-auto" />
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs text-muted">Añadir:</span>
              {([['overlay', MonitorPlay, 'Overlay'], ['image', ImageIcon, 'Imagen'], ['video', Video, 'Vídeo'], ['text', Type, 'Texto'], ['icon', Smile, 'Icono'], ['shape', Shapes, 'Forma'], ['gift', GiftIcon, 'Regalo']] as const).map(([t, Ico, label]) => (
                <button key={t} className="btn !px-2.5" title={label} onClick={() => addLayer(t)}>
                  <Ico size={15} />
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[220px_1fr_270px]">
            {/* capas */}
            <div className="card flex flex-col p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                <Layers size={16} /> Capas <span className="ml-auto text-xs text-muted">{cur?.layers.length ?? 0}</span>
              </div>
              <div className="flex-1 space-y-1 overflow-y-auto">
                {[...(cur?.layers ?? [])].reverse().map((l) => (
                  <div key={l.id} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm ${sel === l.id ? 'bg-accent/15 ring-1 ring-accent/50' : 'hover:bg-white/5'}`} onClick={() => setSel(l.id)}>
                    <GripVertical size={13} className="text-muted" />
                    <span className="flex-1 truncate">{l.name || l.type}</span>
                    <button className="text-muted hover:text-white" onClick={(e) => (e.stopPropagation(), patchLayer(l.id, { hidden: !l.hidden }))}>
                      {l.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button className="text-muted hover:text-white" onClick={(e) => (e.stopPropagation(), patchLayer(l.id, { locked: !l.locked }))}>
                      {l.locked ? <Lock size={13} /> : <Unlock size={13} />}
                    </button>
                  </div>
                ))}
                {cur?.layers.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted">Sin capas. Añade una arriba.</p>}
              </div>
            </div>

            {/* lienzo */}
            <div className="grid place-items-center">
              <div
                ref={canvas}
                className="relative w-full overflow-hidden rounded-xl border border-white/10"
                style={{ aspectRatio: cur ? (cur.ratio === 'free' ? '16 / 9' : cur.ratio.replace(':', ' / ')) : '16 / 9', maxWidth: cur?.ratio === '9:16' ? 420 : '100%', background: 'repeating-conic-gradient(#14141f 0 25%, #0e0e17 0 50%) 0 0/26px 26px' }}
                onPointerDown={() => setSel('')}
              >
                {cur?.layers.filter((l) => !l.hidden).map((l) => (
                  <div
                    key={l.id}
                    onPointerDown={(e) => drag(e, l, 'move')}
                    style={{ position: 'absolute', left: `${l.x}%`, top: `${l.y}%`, width: `${l.w}%`, height: `${l.h}%`, cursor: l.locked ? 'default' : 'move', outline: sel === l.id ? '2px solid var(--color-hot)' : '1px dashed #ffffff22', outlineOffset: 0 }}
                  >
                    <div style={{ pointerEvents: 'none', width: '100%', height: '100%' }}>
                      <LayerView l={{ ...l, x: 0, y: 0, w: 100, h: 100 }} editing />
                    </div>
                    {sel === l.id && !l.locked && (
                      <span
                        onPointerDown={(e) => drag(e, l, 'resize')}
                        style={{ position: 'absolute', right: -6, bottom: -6, width: 14, height: 14, borderRadius: 4, background: 'var(--color-hot)', cursor: 'nwse-resize', border: '2px solid #fff' }}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex w-full items-center gap-1.5 rounded-full border border-line bg-black/30 p-1 pl-3">
                <MonitorPlay size={14} className="text-accent-2" />
                <code className="min-w-0 flex-1 truncate text-[11px] text-[#c4b5fd]">{url}</code>
                <button className="btn-accent !px-3" onClick={() => navigator.clipboard.writeText(url).then(() => toast('Enlace de la escena copiado'))}>
                  <Copy size={13} /> Copiar
                </button>
                <a className="btn !px-3" href={url} target="_blank" rel="noreferrer">
                  <Play size={13} />
                </a>
              </div>
            </div>

            {/* propiedades */}
            <div className="card p-4">
              {!selLayer ? (
                <p className="py-8 text-center text-sm text-muted">Selecciona una capa para editar sus propiedades.</p>
              ) : (
                <Props l={selLayer} patch={(p) => patchLayer(selLayer.id, p)} onDelete={() => removeLayer(selLayer.id)} move={(d) => move(selLayer.id, d)} pickGift={() => setGiftFor(selLayer.id)} />
              )}
            </div>
          </div>
        </div>
      )}

      <Modal open={!!giftFor} onClose={() => setGiftFor(null)} title="Elegir regalo" wide>
        <GiftPicker
          selected={[]}
          onPick={(g) => {
            if (giftFor) patchLayer(giftFor, { gift: g.name })
            setGiftFor(null)
          }}
        />
      </Modal>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  )
}

function Props({ l, patch, onDelete, move, pickGift }: { l: Layer; patch: (p: Partial<Layer>) => void; onDelete: () => void; move: (d: -1 | 1) => void; pickGift: () => void }) {
  const num = (v: string, min = -200, max = 400) => Math.max(min, Math.min(max, Number(v) || 0))
  return (
    <div className="space-y-3 text-sm">
      <input className="input" value={l.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Nombre de la capa" />

      {l.type === 'overlay' && (
        <>
          <Row label="Overlay">
            <select className="input !w-44 !py-1.5" value={l.overlay} onChange={(e) => patch({ overlay: e.target.value })}>
              {OVERLAY_OPTS.map(([v, lab]) => (
                <option key={v} value={v}>
                  {lab}
                </option>
              ))}
            </select>
          </Row>
        </>
      )}
      {(l.type === 'image' || l.type === 'video') && (
        <>
          <input className="input" value={l.url} onChange={(e) => patch({ url: e.target.value })} placeholder="URL del archivo (https://…)" />
          <Row label="Ajuste">
            <Seg value={l.fit} options={[{ v: 'contain', l: 'Caber' }, { v: 'cover', l: 'Llenar' }, { v: 'fill', l: 'Estirar' }]} onChange={(v) => patch({ fit: v })} />
          </Row>
        </>
      )}
      {l.type === 'text' && (
        <>
          <textarea className="input" rows={2} value={l.text} onChange={(e) => patch({ text: e.target.value })} />
          <Row label="Tamaño">
            <input type="number" className="input !w-24 !py-1.5" value={l.font} onChange={(e) => patch({ font: num(e.target.value, 8, 400) })} />
          </Row>
          <Row label="Color">
            <input type="color" value={l.color} onChange={(e) => patch({ color: e.target.value })} className="h-8 w-14 rounded border border-line bg-transparent" />
          </Row>
          <Row label="Alineación">
            <Seg value={l.align} options={[{ v: 'left', l: '⟸' }, { v: 'center', l: '≡' }, { v: 'right', l: '⟹' }]} onChange={(v) => patch({ align: v })} />
          </Row>
        </>
      )}
      {l.type === 'icon' && <input className="input text-center text-2xl" value={l.icon} onChange={(e) => patch({ icon: e.target.value })} maxLength={4} />}
      {l.type === 'shape' && (
        <>
          <Row label="Forma">
            <Seg value={l.shape} options={[{ v: 'rect', l: 'Rectángulo' }, { v: 'circle', l: 'Círculo' }]} onChange={(v) => patch({ shape: v })} />
          </Row>
          <Row label="Color">
            <input type="color" value={l.color} onChange={(e) => patch({ color: e.target.value })} className="h-8 w-14 rounded border border-line bg-transparent" />
          </Row>
        </>
      )}
      {l.type === 'gift' && (
        <button className="btn w-full justify-center" onClick={pickGift}>
          Regalo: <b>{l.gift}</b>
        </button>
      )}

      <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-3">
        <Row label="X %">
          <input type="number" className="input !w-20 !py-1" value={l.x} onChange={(e) => patch({ x: num(e.target.value) })} />
        </Row>
        <Row label="Y %">
          <input type="number" className="input !w-20 !py-1" value={l.y} onChange={(e) => patch({ y: num(e.target.value) })} />
        </Row>
        <Row label="Ancho %">
          <input type="number" className="input !w-20 !py-1" value={l.w} onChange={(e) => patch({ w: num(e.target.value, 2) })} />
        </Row>
        <Row label="Alto %">
          <input type="number" className="input !w-20 !py-1" value={l.h} onChange={(e) => patch({ h: num(e.target.value, 2) })} />
        </Row>
      </div>
      <Row label="Giro">
        <input type="range" min={-180} max={180} value={l.rot} onChange={(e) => patch({ rot: Number(e.target.value) })} className="w-32 accent-[var(--color-hot)]" />
      </Row>
      <Row label="Opacidad">
        <input type="range" min={0} max={1} step={0.05} value={l.opacity} onChange={(e) => patch({ opacity: Number(e.target.value) })} className="w-32 accent-[var(--color-hot)]" />
      </Row>
      <div className="flex gap-2 border-t border-white/5 pt-3">
        <button className="btn flex-1 justify-center" onClick={() => move(1)}>
          Subir
        </button>
        <button className="btn flex-1 justify-center" onClick={() => move(-1)}>
          Bajar
        </button>
        <button className="btn justify-center text-bad" onClick={onDelete}>
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}
