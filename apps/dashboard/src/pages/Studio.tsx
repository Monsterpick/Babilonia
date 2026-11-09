import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  CopyPlus,
  Download,
  Eye,
  EyeOff,
  Gift as GiftIcon,
  Grid3x3,
  Image as ImageIcon,
  LayoutTemplate,
  Lock,
  Magnet,
  MonitorPlay,
  Play,
  Plus,
  Redo2,
  Shapes,
  Smile,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
  Video,
  ZoomIn,
} from 'lucide-react'
import { sceneSize, type Layer, type Scene } from '@livearena/shared'
import { api, overlayUrl, upload } from '../lib/api'
import { PageHeader, Seg, Modal } from '../components/ui'
import { toast } from '../components/Toast'
import { askConfirm } from '../components/Dialog'
import { LayerView, SceneStyles } from '../overlays/Scene'
import { GiftPicker } from '../components/GiftPicker'
import { OVERLAY_SIZES, SCENE_TEMPLATES, layer as mkLayer, overlayLayer } from '../lib/sceneTemplates'

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const r1 = (v: number) => Math.round(v * 10) / 10

type Ref = 'cuadros' | 'juego' | 'verde' | 'oscuro' | 'claro' | 'imagen'
const REF_BG: Record<Exclude<Ref, 'imagen'>, string> = {
  cuadros: 'repeating-conic-gradient(#171723 0 25%, #0f0f18 0 50%) 0 0/40px 40px',
  juego: 'linear-gradient(180deg,#78a7ff 0%,#a9c8ff 55%,#6aa84f 55.3%,#4f7f37 72%,#7a5a3a 72.3%,#5e4329 100%)',
  verde: '#00b140',
  oscuro: '#0b0b12',
  claro: '#e8e8ef',
}

const TYPE_ICON: Record<Layer['type'], ReactNode> = {
  overlay: <MonitorPlay size={13} />,
  image: <ImageIcon size={13} />,
  video: <Video size={13} />,
  text: <Type size={13} />,
  icon: <Smile size={13} />,
  shape: <Shapes size={13} />,
  gift: <GiftIcon size={13} />,
}

const TOKENS = ['{likes}', '{monedas}', '{regalos}', '{seguidores}', '{top1}', '{top1_monedas}', '{top_likes}', '{espectadores}', '{hora}']
const EMOJIS = ['⭐', '🔥', '❤️', '💎', '👑', '⚔️', '🛡️', '💀', '🎁', '🌹', '⚡', '🏆', '🎯', '🧨', '🐉', '⛏️']
const ANIMS: [Layer['anim'], string][] = [
  ['none', 'Ninguna'],
  ['fade', 'Aparecer'],
  ['slide-up', 'Subir'],
  ['slide-left', 'Entrar'],
  ['pop', 'Pop'],
  ['pulse', 'Latido ∞'],
  ['float', 'Flotar ∞'],
  ['glow', 'Brillar ∞'],
  ['shake', 'Temblar ∞'],
  ['spin', 'Girar ∞'],
]

type Box = { x: number; y: number; w: number; h: number }
const bounds = (ls: Layer[]): Box => {
  const x = Math.min(...ls.map((l) => l.x))
  const y = Math.min(...ls.map((l) => l.y))
  return { x, y, w: Math.max(...ls.map((l) => l.x + l.w)) - x, h: Math.max(...ls.map((l) => l.y + l.h)) - y }
}

export function StudioPage() {
  const [scenes, setScenes] = useState<Scene[]>([])
  const [curId, setCurId] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [giftFor, setGiftFor] = useState<string | null>(null)
  const [picker, setPicker] = useState<'overlay' | 'template' | null>(null)
  const [zoom, setZoom] = useState<'fit' | number>('fit')
  const [grid, setGrid] = useState(false)
  const [snap, setSnap] = useState(true)
  const [ref, setRef] = useState<Ref>('cuadros')
  const [refImg, setRefImg] = useState('')
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] })
  const [renaming, setRenaming] = useState<string | null>(null)
  const [tab, setTab] = useState<'contenido' | 'estilo' | 'posicion'>('contenido')
  const [replay, setReplay] = useState(0)
  const past = useRef<Scene[][]>([])
  const future = useRef<Scene[][]>([])
  const clip = useRef<Layer[]>([])
  const dragRow = useRef({ id: '' }).current
  const area = useRef<HTMLDivElement>(null)
  const [areaSize, setAreaSize] = useState({ w: 900, h: 600 })
  const saveTimer = useRef<number | undefined>(undefined)
  const scenesRef = useRef(scenes)
  scenesRef.current = scenes

  useEffect(() => {
    api<Scene[]>('GET', '/api/scenes')
      .then((s) => {
        setScenes(s)
        setCurId(s[0]?.id ?? '')
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  useEffect(() => {
    const el = area.current
    if (!el) return
    const ro = new ResizeObserver(() => setAreaSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [loaded, scenes.length > 0])

  const cur = scenes.find((s) => s.id === curId)
  const size = sceneSize(cur?.ratio ?? '16:9')
  const fit = Math.max(0.05, Math.min((areaSize.w - 40) / size.w, (areaSize.h - 40) / size.h))
  const k = zoom === 'fit' ? fit : zoom

  /* ---------------------------- historial y guardado ---------------------------- */

  const save = (next: Scene[]) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => api('PUT', '/api/scenes', next).catch((e) => toast((e as Error).message, 'error')), 350)
  }
  const persist = useCallback((next: Scene[], record = true) => {
    if (record) {
      past.current.push(scenesRef.current)
      if (past.current.length > 80) past.current.shift()
      future.current = []
    }
    setScenes(next)
    save(next)
  }, [])
  const undo = () => {
    const prev = past.current.pop()
    if (!prev) return
    future.current.push(scenesRef.current)
    setScenes(prev)
    save(prev)
  }
  const redo = () => {
    const nx = future.current.pop()
    if (!nx) return
    past.current.push(scenesRef.current)
    setScenes(nx)
    save(nx)
  }
  const snapshot = () => {
    past.current.push(scenesRef.current)
    future.current = []
  }

  const patchScene = (p: Partial<Scene>, record = true) => cur && persist(scenesRef.current.map((s) => (s.id === cur.id ? { ...s, ...p } : s)), record)
  const patchLayers = (ids: string[], f: (l: Layer) => Partial<Layer>, record = true) => {
    const c = scenesRef.current.find((s) => s.id === curId)
    if (!c) return
    persist(
      scenesRef.current.map((s) => (s.id === c.id ? { ...s, layers: s.layers.map((l) => (ids.includes(l.id) ? { ...l, ...f(l) } : l)) } : s)),
      record,
    )
  }
  const patchLayer = (id: string, p: Partial<Layer>) => patchLayers([id], () => p)
  const addLayers = (ls: Layer[]) => {
    if (!cur) return
    patchScene({ layers: [...cur.layers, ...ls] })
    setSel(ls.map((l) => l.id))
  }
  const removeSel = () => {
    if (!cur || !sel.length) return
    patchScene({ layers: cur.layers.filter((l) => !sel.includes(l.id)) })
    setSel([])
  }
  const duplicateSel = () => {
    if (!cur || !sel.length) return
    const copies = cur.layers.filter((l) => sel.includes(l.id)).map((l) => ({ ...structuredClone(l), id: uid('l'), x: r1(l.x + 2), y: r1(l.y + 2), name: `${l.name || l.type} copia` }))
    addLayers(copies)
  }
  const reorder = (id: string, to: 'front' | 'back' | number) => {
    if (!cur) return
    const arr = [...cur.layers]
    const i = arr.findIndex((l) => l.id === id)
    if (i < 0) return
    const [it] = arr.splice(i, 1)
    const j = to === 'front' ? arr.length : to === 'back' ? 0 : clamp(to, 0, arr.length)
    arr.splice(j, 0, it!)
    patchScene({ layers: arr })
  }

  /* --------------------------------- escenas --------------------------------- */

  const newScene = (ratio: Scene['ratio'] = '16:9', layers: Layer[] = [], name?: string) => {
    const s: Scene = { id: uid('scene'), name: name ?? `Escena ${scenes.length + 1}`, ratio, bg: 'transparent', layers }
    persist([...scenesRef.current, s])
    setCurId(s.id)
    setSel([])
  }
  const duplicateScene = () => cur && newScene(cur.ratio, cur.layers.map((l) => ({ ...structuredClone(l), id: uid('l') })), `${cur.name} (copia)`)
  const deleteScene = async () => {
    if (!cur || !(await askConfirm(`¿Borrar la escena «${cur.name}»?`, { danger: true }))) return
    const next = scenes.filter((s) => s.id !== cur.id)
    persist(next)
    setCurId(next[0]?.id ?? '')
    setSel([])
  }
  const exportScene = () => {
    if (!cur) return
    const blob = new Blob([JSON.stringify(cur, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${cur.name.replace(/[^\w-]+/g, '_')}.escena.json`
    a.click()
  }
  const importScene = async (file: File) => {
    try {
      const s = JSON.parse(await file.text()) as Scene
      if (!Array.isArray(s.layers)) throw new Error('No es una escena de LiveArena')
      newScene(s.ratio ?? '16:9', s.layers.map((l) => ({ ...l, id: uid('l') })), s.name ?? 'Importada')
      toast('Escena importada')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  /* ------------------------------ ratón: mover y redimensionar ------------------------------ */

  const others = (ids: string[]) => cur?.layers.filter((l) => !ids.includes(l.id) && !l.hidden) ?? []

  /** Ajusta una caja a guías (bordes, centro, otras capas) y a la cuadrícula. */
  const snapBox = (b: Box, ids: string[], mode: 'move' | 'resize'): { b: Box; v: number[]; h: number[] } => {
    const T = 0.8
    const v: number[] = []
    const h: number[] = []
    let { x, y, w, hh } = { x: b.x, y: b.y, w: b.w, hh: b.h }
    if (grid && snap) {
      x = Math.round(x / 2.5) * 2.5
      y = Math.round(y / 2.5) * 2.5
      if (mode === 'resize') {
        w = Math.max(1, Math.round((b.x + b.w) / 2.5) * 2.5 - x)
        hh = Math.max(1, Math.round((b.y + b.h) / 2.5) * 2.5 - y)
      }
    }
    if (snap) {
      const vx = [0, 50, 100]
      const hy = [0, 50, 100]
      for (const o of others(ids)) {
        vx.push(o.x, o.x + o.w / 2, o.x + o.w)
        hy.push(o.y, o.y + o.h / 2, o.y + o.h)
      }
      const best = (edges: number[], lines: number[]) => {
        let d = Infinity
        let line = 0
        let edge = 0
        for (const e of edges)
          for (const L of lines)
            if (Math.abs(L - e) < Math.abs(d)) {
              d = L - e
              line = L
              edge = e
            }
        return Math.abs(d) <= T ? { d, line, edge } : null
      }
      if (mode === 'move') {
        const bx = best([x, x + w / 2, x + w], vx)
        if (bx) {
          x += bx.d
          v.push(bx.line)
        }
        const by = best([y, y + hh / 2, y + hh], hy)
        if (by) {
          y += by.d
          h.push(by.line)
        }
      } else {
        const bx = best([x + w], vx)
        if (bx) {
          w += bx.d
          v.push(bx.line)
        }
        const by = best([y + hh], hy)
        if (by) {
          hh += by.d
          h.push(by.line)
        }
      }
    }
    return { b: { x: r1(x), y: r1(y), w: r1(Math.max(0.5, w)), h: r1(Math.max(0.5, hh)) }, v, h }
  }

  const startMove = (e: React.PointerEvent, l: Layer) => {
    e.stopPropagation()
    if (e.button !== 0) return
    let ids = sel
    if (e.shiftKey) {
      ids = sel.includes(l.id) ? sel.filter((x) => x !== l.id) : [...sel, l.id]
      setSel(ids)
      return
    }
    if (!sel.includes(l.id)) {
      ids = [l.id]
      setSel(ids)
    }
    const moving = cur!.layers.filter((x) => ids.includes(x.id) && !x.locked)
    if (!moving.length) return
    e.preventDefault()
    const start = { mx: e.clientX, my: e.clientY, pos: new Map(moving.map((m) => [m.id, { x: m.x, y: m.y }])), box: bounds(moving) }
    let recorded = false
    const onMove = (ev: PointerEvent) => {
      const dx = ((ev.clientX - start.mx) / (size.w * k)) * 100
      const dy = ((ev.clientY - start.my) / (size.h * k)) * 100
      if (!recorded) {
        if (Math.abs(dx) + Math.abs(dy) < 0.2) return
        snapshot()
        recorded = true
      }
      const s = snapBox({ ...start.box, x: start.box.x + dx, y: start.box.y + dy }, ids, 'move')
      const ox = s.b.x - start.box.x
      const oy = s.b.y - start.box.y
      setGuides({ v: s.v, h: s.h })
      patchLayers(moving.map((m) => m.id), (m) => ({ x: r1(start.pos.get(m.id)!.x + ox), y: r1(start.pos.get(m.id)!.y + oy) }), false)
    }
    const onUp = () => {
      setGuides({ v: [], h: [] })
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startResize = (e: React.PointerEvent, l: Layer, handle: string) => {
    e.stopPropagation()
    e.preventDefault()
    snapshot()
    const start = { mx: e.clientX, my: e.clientY, x: l.x, y: l.y, w: l.w, h: l.h }
    const ratio = l.w / l.h
    const onMove = (ev: PointerEvent) => {
      const dx = ((ev.clientX - start.mx) / (size.w * k)) * 100
      const dy = ((ev.clientY - start.my) / (size.h * k)) * 100
      let { x, y, w, h } = start
      if (handle.includes('e')) w = start.w + dx
      if (handle.includes('s')) h = start.h + dy
      if (handle.includes('w')) {
        w = start.w - dx
        x = start.x + dx
      }
      if (handle.includes('n')) {
        h = start.h - dy
        y = start.y + dy
      }
      if (ev.shiftKey && handle.length === 2) h = w / ratio
      w = Math.max(1, w)
      h = Math.max(1, h)
      const s = handle === 'se' ? snapBox({ x, y, w, h }, [l.id], 'resize') : { b: { x: r1(x), y: r1(y), w: r1(w), h: r1(h) }, v: [], h: [] }
      setGuides({ v: s.v, h: s.h })
      patchLayers([l.id], () => s.b, false)
    }
    const onUp = () => {
      setGuides({ v: [], h: [] })
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startRotate = (e: React.PointerEvent, l: Layer, el: HTMLElement) => {
    e.stopPropagation()
    e.preventDefault()
    snapshot()
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const onMove = (ev: PointerEvent) => {
      let a = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90
      if (a > 180) a -= 360
      if (ev.shiftKey || snap) a = Math.round(a / (ev.shiftKey ? 15 : 1)) * (ev.shiftKey ? 15 : 1)
      patchLayers([l.id], () => ({ rot: Math.round(a) }), false)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  /* ------------------------------ alinear y distribuir ------------------------------ */

  const selLayers = cur?.layers.filter((l) => sel.includes(l.id)) ?? []
  const align = (how: 'l' | 'c' | 'r' | 't' | 'm' | 'b') => {
    if (!selLayers.length) return
    const B = selLayers.length > 1 ? bounds(selLayers) : { x: 0, y: 0, w: 100, h: 100 }
    patchLayers(sel, (l) => {
      if (how === 'l') return { x: r1(B.x) }
      if (how === 'c') return { x: r1(B.x + B.w / 2 - l.w / 2) }
      if (how === 'r') return { x: r1(B.x + B.w - l.w) }
      if (how === 't') return { y: r1(B.y) }
      if (how === 'm') return { y: r1(B.y + B.h / 2 - l.h / 2) }
      return { y: r1(B.y + B.h - l.h) }
    })
  }
  const distribute = (axis: 'x' | 'y') => {
    if (selLayers.length < 3) return toast('Selecciona 3 capas o más (Mayús + clic)')
    const sorted = [...selLayers].sort((a, b) => a[axis] - b[axis])
    const first = sorted[0]!
    const last = sorted[sorted.length - 1]!
    const dim = axis === 'x' ? 'w' : 'h'
    const total = sorted.reduce((n, l) => n + l[dim], 0)
    const gap = (last[axis] + last[dim] - first[axis] - total) / (sorted.length - 1)
    let pos = first[axis]
    const target = new Map<string, number>()
    for (const l of sorted) {
      target.set(l.id, r1(pos))
      pos += l[dim] + gap
    }
    patchLayers(sel, (l) => ({ [axis]: target.get(l.id)! }))
  }

  /* --------------------------------- teclado --------------------------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateSel()
      } else if (mod && e.key.toLowerCase() === 'c') {
        clip.current = selLayers.map((l) => structuredClone(l))
      } else if (mod && e.key.toLowerCase() === 'v') {
        if (clip.current.length) addLayers(clip.current.map((l) => ({ ...structuredClone(l), id: uid('l'), x: r1(l.x + 2), y: r1(l.y + 2) })))
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSel(cur?.layers.map((l) => l.id) ?? [])
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (sel.length) {
          e.preventDefault()
          removeSel()
        }
      } else if (e.key === 'Escape') setSel([])
      else if (e.key.startsWith('Arrow') && sel.length) {
        e.preventDefault()
        const step = e.shiftKey ? 5 : 0.5
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        patchLayers(sel, (l) => (l.locked ? {} : { x: r1(l.x + dx), y: r1(l.y + dy) }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* ---------------------------------- render ---------------------------------- */

  if (!loaded) return null
  const url = cur ? overlayUrl('escena', { s: cur.id }) : ''
  const single = selLayers.length === 1 ? selLayers[0]! : null

  if (!cur)
    return (
      <div className="pb-10">
        <PageHeader title="Estudio de escenas" subtitle="Monta tu escena del directo con capas: overlays, imágenes, vídeo, texto en vivo y animaciones. Una sola URL para OBS." />
        <div className="space-y-4 px-8">
          <div className="card p-6 text-center">
            <Sparkles className="mx-auto mb-2 text-accent-2" />
            <p className="mb-4 text-muted">Empieza con una plantilla o con una escena vacía.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button className="btn" onClick={() => newScene('16:9')}>
                <Plus size={15} /> Vacía 16:9
              </button>
              <button className="btn" onClick={() => newScene('9:16')}>
                <Plus size={15} /> Vacía 9:16 (TikTok)
              </button>
            </div>
          </div>
          <TemplateGrid onPick={(t) => newScene(t.ratio, t.build(), t.name)} />
        </div>
      </div>
    )

  return (
    <div className="flex h-full flex-col pb-4">
      <SceneStyles />
      <PageHeader title="Estudio de escenas" subtitle="Arrastra, alinea y anima capas. Lo que ves es exactamente lo que saldrá en OBS.">
        <button className="btn" onClick={() => setPicker('template')}>
          <LayoutTemplate size={15} /> Plantillas
        </button>
        <button className="btn" onClick={() => newScene(cur.ratio)}>
          <Plus size={15} /> Nueva escena
        </button>
      </PageHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-8">
        {/* ------------------------------ escenas ------------------------------ */}
        <div className="flex flex-wrap items-center gap-1.5">
          {scenes.map((s) => (
            <button
              key={s.id}
              onClick={() => (setCurId(s.id), setSel([]))}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${s.id === curId ? 'bg-gradient-to-r from-accent to-hot text-white' : 'border border-line text-muted hover:text-white'}`}
            >
              {s.name} <span className="text-[10px] opacity-70">{s.ratio}</span>
            </button>
          ))}
          <span className="mr-auto" />
          <input className="input !w-44 !py-1.5" value={cur.name} onChange={(e) => patchScene({ name: e.target.value }, false)} title="Nombre de la escena" />
          <Seg value={cur.ratio} options={[{ v: '16:9', l: '16:9' }, { v: '9:16', l: '9:16' }, { v: '1:1', l: '1:1' }]} onChange={(v) => patchScene({ ratio: v })} />
          <button className="btn !px-2.5" title="Duplicar escena" onClick={duplicateScene}>
            <CopyPlus size={15} />
          </button>
          <button className="btn !px-2.5" title="Exportar (.json)" onClick={exportScene}>
            <Download size={15} />
          </button>
          <label className="btn cursor-pointer !px-2.5" title="Importar escena (.json)">
            <Upload size={15} />
            <input type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && void importScene(e.target.files[0])} />
          </label>
          <button className="btn !px-2.5 text-bad" title="Borrar escena" onClick={() => void deleteScene()}>
            <Trash2 size={15} />
          </button>
        </div>

        {/* ------------------------------ barra de herramientas ------------------------------ */}
        <div className="card flex flex-wrap items-center gap-1 p-2">
          <span className="px-1 text-xs text-muted">Añadir</span>
          <ToolBtn title="Overlay de LiveArena" onClick={() => setPicker('overlay')}>
            <MonitorPlay size={15} /> Overlay
          </ToolBtn>
          <UploadBtn kind="image" onDone={(url) => addLayers([mkLayer({ type: 'image', name: 'Imagen', url, x: 35, y: 30, w: 30, h: 30 })])} />
          <UploadBtn kind="video" onDone={(url) => addLayers([mkLayer({ type: 'video', name: 'Vídeo', url, x: 30, y: 25, w: 40, h: 40 })])} />
          <ToolBtn title="Texto" onClick={() => addLayers([mkLayer({ type: 'text', name: 'Texto', text: 'Tu texto', x: 30, y: 40, w: 40, h: 10, font: 72 })])}>
            <Type size={15} />
          </ToolBtn>
          <ToolBtn title="Texto en vivo (likes, monedas…)" onClick={() => addLayers([mkLayer({ type: 'text', name: 'Contador en vivo', text: '❤️ {likes}   💎 {monedas}', x: 25, y: 5, w: 50, h: 8, font: 56, textBg: '#00000088' })])}>
            <Sparkles size={15} />
          </ToolBtn>
          <ToolBtn title="Icono" onClick={() => addLayers([mkLayer({ type: 'icon', name: 'Icono', x: 45, y: 40, w: 10, h: 15, font: 80 })])}>
            <Smile size={15} />
          </ToolBtn>
          <ToolBtn title="Forma" onClick={() => addLayers([mkLayer({ type: 'shape', name: 'Forma', color: '#8b5cf6', x: 35, y: 35, w: 30, h: 20, opacity: 0.85 })])}>
            <Shapes size={15} />
          </ToolBtn>
          <ToolBtn title="Imagen de un regalo" onClick={() => addLayers([mkLayer({ type: 'gift', name: 'Regalo', x: 42, y: 35, w: 16, h: 25 })])}>
            <GiftIcon size={15} />
          </ToolBtn>
          <Sep />
          <ToolBtn title="Deshacer (Ctrl+Z)" onClick={undo} disabled={!past.current.length}>
            <Undo2 size={15} />
          </ToolBtn>
          <ToolBtn title="Rehacer (Ctrl+Y)" onClick={redo} disabled={!future.current.length}>
            <Redo2 size={15} />
          </ToolBtn>
          <Sep />
          <ToolBtn title={sel.length > 1 ? 'Alinear a la izquierda' : 'Pegar al borde izquierdo'} onClick={() => align('l')} disabled={!sel.length}>
            <AlignStartVertical size={15} />
          </ToolBtn>
          <ToolBtn title="Centrar en horizontal" onClick={() => align('c')} disabled={!sel.length}>
            <AlignCenterVertical size={15} />
          </ToolBtn>
          <ToolBtn title="Alinear a la derecha" onClick={() => align('r')} disabled={!sel.length}>
            <AlignEndVertical size={15} />
          </ToolBtn>
          <ToolBtn title="Alinear arriba" onClick={() => align('t')} disabled={!sel.length}>
            <AlignStartHorizontal size={15} />
          </ToolBtn>
          <ToolBtn title="Centrar en vertical" onClick={() => align('m')} disabled={!sel.length}>
            <AlignCenterHorizontal size={15} />
          </ToolBtn>
          <ToolBtn title="Alinear abajo" onClick={() => align('b')} disabled={!sel.length}>
            <AlignEndHorizontal size={15} />
          </ToolBtn>
          <ToolBtn title="Repartir en horizontal" onClick={() => distribute('x')} disabled={sel.length < 3}>
            <AlignHorizontalSpaceAround size={15} />
          </ToolBtn>
          <ToolBtn title="Repartir en vertical" onClick={() => distribute('y')} disabled={sel.length < 3}>
            <AlignVerticalSpaceAround size={15} />
          </ToolBtn>
          <Sep />
          <ToolBtn title="Duplicar (Ctrl+D)" onClick={duplicateSel} disabled={!sel.length}>
            <CopyPlus size={15} />
          </ToolBtn>
          <ToolBtn title="Al frente" onClick={() => single && reorder(single.id, 'front')} disabled={!single}>
            <ArrowUpToLine size={15} />
          </ToolBtn>
          <ToolBtn title="Al fondo" onClick={() => single && reorder(single.id, 'back')} disabled={!single}>
            <ArrowDownToLine size={15} />
          </ToolBtn>
          <ToolBtn title="Borrar (Supr)" onClick={removeSel} disabled={!sel.length} danger>
            <Trash2 size={15} />
          </ToolBtn>
          <span className="mr-auto" />
          <ToolBtn title="Cuadrícula" onClick={() => setGrid((g) => !g)} active={grid}>
            <Grid3x3 size={15} />
          </ToolBtn>
          <ToolBtn title="Imanes y guías" onClick={() => setSnap((s) => !s)} active={snap}>
            <Magnet size={15} />
          </ToolBtn>
          <select className="input !w-auto !py-1 text-xs" value={String(zoom)} onChange={(e) => setZoom(e.target.value === 'fit' ? 'fit' : Number(e.target.value))} title="Zoom">
            <option value="fit">Ajustar</option>
            <option value="0.25">25%</option>
            <option value="0.5">50%</option>
            <option value="0.75">75%</option>
            <option value="1">100%</option>
          </select>
          <select className="input !w-auto !py-1 text-xs" value={ref} onChange={(e) => setRef(e.target.value as Ref)} title="Fondo de referencia (solo en el editor)">
            <option value="cuadros">Fondo: transparente</option>
            <option value="juego">Fondo: Minecraft</option>
            <option value="verde">Fondo: croma</option>
            <option value="oscuro">Fondo: oscuro</option>
            <option value="claro">Fondo: claro</option>
            <option value="imagen">Fondo: mi captura…</option>
          </select>
          {ref === 'imagen' && <UploadBtn kind="image" label="Captura" onDone={setRefImg} />}
        </div>

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[230px_minmax(0,1fr)_300px]">
          {/* ------------------------------ capas ------------------------------ */}
          <div className="card flex min-h-0 flex-col p-2.5">
            <div className="mb-2 flex items-center px-1 text-sm font-bold">
              Capas <span className="ml-auto text-xs font-normal text-muted">{cur.layers.length} · Mayús+clic = varias</span>
            </div>
            <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
              {[...cur.layers].reverse().map((l) => (
                <div
                  key={l.id}
                  draggable
                  onDragStart={() => (dragRow.id = l.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (!dragRow.id || dragRow.id === l.id) return
                    reorder(dragRow.id, cur.layers.findIndex((x) => x.id === l.id))
                    dragRow.id = ''
                  }}
                  onClick={(e) => setSel(e.shiftKey ? (sel.includes(l.id) ? sel.filter((x) => x !== l.id) : [...sel, l.id]) : [l.id])}
                  onDoubleClick={() => setRenaming(l.id)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm ${sel.includes(l.id) ? 'bg-accent/15 ring-1 ring-accent/50' : 'hover:bg-white/5'} ${l.hidden ? 'opacity-50' : ''}`}
                >
                  <span className="text-muted">{TYPE_ICON[l.type]}</span>
                  {renaming === l.id ? (
                    <input autoFocus className="input !py-0.5 text-xs" defaultValue={l.name} onBlur={(e) => (patchLayer(l.id, { name: e.target.value }), setRenaming(null))} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
                  ) : (
                    <span className="flex-1 truncate">{l.name || l.type}</span>
                  )}
                  <button className="text-muted hover:text-white" title={l.hidden ? 'Mostrar' : 'Ocultar'} onClick={(e) => (e.stopPropagation(), patchLayer(l.id, { hidden: !l.hidden }))}>
                    {l.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button className="text-muted hover:text-white" title={l.locked ? 'Desbloquear' : 'Bloquear'} onClick={(e) => (e.stopPropagation(), patchLayer(l.id, { locked: !l.locked }))}>
                    {l.locked ? <Lock size={13} /> : <Unlock size={13} />}
                  </button>
                </div>
              ))}
              {cur.layers.length === 0 && (
                <div className="px-2 py-6 text-center text-xs text-muted">
                  Sin capas. Añade una arriba o
                  <button className="mt-2 block w-full text-accent-2" onClick={() => setPicker('template')}>
                    usa una plantilla →
                  </button>
                </div>
              )}
            </div>
            <div className="mt-2 border-t border-white/5 px-1 pt-2 text-[10px] leading-relaxed text-muted">
              Flechas mueven (Mayús ×10) · Supr borra · Ctrl+D duplica · Ctrl+C/V copia · Ctrl+Z deshace · doble clic renombra · arrastra para reordenar
            </div>
          </div>

          {/* ------------------------------ lienzo ------------------------------ */}
          <div className="flex min-h-0 flex-col gap-2">
            <div ref={area} className="relative min-h-[420px] flex-1 overflow-auto rounded-xl border border-white/5 bg-black/30" onPointerDown={() => setSel([])}>
              <div className="grid min-h-full min-w-full place-items-center p-5">
                <div style={{ width: size.w * k, height: size.h * k, position: 'relative', flexShrink: 0 }} className="shadow-2xl">
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: size.w,
                      height: size.h,
                      transform: `scale(${k})`,
                      transformOrigin: 'top left',
                      background: ref === 'imagen' && refImg ? `center/cover no-repeat url(${refImg})` : REF_BG[ref === 'imagen' ? 'cuadros' : ref],
                      overflow: 'hidden',
                      outline: '1px solid #ffffff22',
                    }}
                  >
                    {cur.bg !== 'transparent' && <div style={{ position: 'absolute', inset: 0, background: cur.bg }} />}
                    {grid && (
                      <div
                        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(#ffffff14 1px, transparent 1px), linear-gradient(90deg, #ffffff14 1px, transparent 1px)', backgroundSize: `${size.w / 40}px ${size.h / 40}px` }}
                      />
                    )}
                    {cur.layers.map((l) =>
                      l.hidden ? null : (
                        <div key={`${l.id}-${replay}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                          <LayerView l={l} editing />
                        </div>
                      ),
                    )}
                    {/* zonas de interacción encima del contenido */}
                    {cur.layers.map((l) =>
                      l.hidden ? null : (
                        <Handles key={l.id} l={l} k={k} selected={sel.includes(l.id)} single={single?.id === l.id} onMove={(e) => startMove(e, l)} onResize={(e, h) => startResize(e, l, h)} onRotate={(e, el) => startRotate(e, l, el)} />
                      ),
                    )}
                    {guides.v.map((x, i) => (
                      <div key={`v${i}`} style={{ position: 'absolute', left: `${x}%`, top: 0, bottom: 0, width: 2 / k, background: '#f43f9e', pointerEvents: 'none' }} />
                    ))}
                    {guides.h.map((y, i) => (
                      <div key={`h${i}`} style={{ position: 'absolute', top: `${y}%`, left: 0, right: 0, height: 2 / k, background: '#f43f9e', pointerEvents: 'none' }} />
                    ))}
                  </div>
                </div>
              </div>
              <span className="pointer-events-none absolute right-3 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-muted">
                {size.w}×{size.h} · {Math.round(k * 100)}%
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-line bg-black/30 p-1 pl-3">
                <MonitorPlay size={14} className="shrink-0 text-accent-2" />
                <code className="min-w-0 flex-1 truncate text-[11px] text-[#c4b5fd]">{url}</code>
                <button className="btn-accent !px-3" onClick={() => navigator.clipboard.writeText(url).then(() => toast(`Enlace copiado: fuente de navegador de ${size.w}×${size.h}`))}>
                  <Copy size={13} /> Copiar
                </button>
                <a className="btn !px-3" href={url} target="_blank" rel="noreferrer" title="Abrir la escena">
                  <Play size={13} />
                </a>
              </div>
              <span className="text-xs text-muted">Simular:</span>
              {(
                [
                  ['🌹', { type: 'gift', name: 'Rose', count: 10 }],
                  ['🦁', { type: 'gift', name: 'Lion', count: 1, streak: false }],
                  ['➕', { type: 'follow' }],
                  ['❤️', { type: 'like', count: 300 }],
                  ['🌪️', { type: 'burst', events: 40, seconds: 3 }],
                ] as const
              ).map(([e, body]) => (
                <button key={e} className="btn !px-2.5" title="Simular (solo overlays)" onClick={() => void api('POST', '/api/simulate', { ...body, dry: true }).catch((err) => toast((err as Error).message, 'error'))}>
                  {e}
                </button>
              ))}
              <button className="btn !px-2.5 text-xs" title="Borrar pruebas" onClick={() => void api('POST', '/api/overlays/reset', { what: 'session' })}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* ------------------------------ propiedades ------------------------------ */}
          <div className="card min-h-0 overflow-y-auto p-3.5">
            {!selLayers.length ? (
              <SceneProps cur={cur} patch={patchScene} />
            ) : selLayers.length > 1 ? (
              <div className="space-y-3 text-sm">
                <div className="font-bold">{selLayers.length} capas seleccionadas</div>
                <p className="text-xs text-muted">Muévelas juntas, alinéalas o repártelas con la barra de arriba.</p>
                <Row label="Opacidad">
                  <input type="range" min={0} max={1} step={0.05} defaultValue={1} onChange={(e) => patchLayers(sel, () => ({ opacity: Number(e.target.value) }), false)} className="w-32 accent-[var(--color-hot)]" />
                </Row>
                <Row label="Animación">
                  <select className="input !w-36 !py-1" onChange={(e) => patchLayers(sel, () => ({ anim: e.target.value as Layer['anim'] }))}>
                    {ANIMS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Row>
              </div>
            ) : (
              single && (
                <>
                  <input className="input mb-2" value={single.name} onChange={(e) => patchLayers([single.id], () => ({ name: e.target.value }), false)} placeholder="Nombre de la capa" />
                  <div className="mb-3">
                    <Seg
                      value={tab}
                      options={[
                        { v: 'contenido', l: 'Contenido' },
                        { v: 'estilo', l: 'Estilo' },
                        { v: 'posicion', l: 'Posición' },
                      ]}
                      onChange={setTab}
                    />
                  </div>
                  {tab === 'contenido' && <ContentProps l={single} patch={(p) => patchLayer(single.id, p)} pickGift={() => setGiftFor(single.id)} sceneSize={size} />}
                  {tab === 'estilo' && <StyleProps l={single} patch={(p) => patchLayer(single.id, p)} replay={() => setReplay((r) => r + 1)} />}
                  {tab === 'posicion' && <PosProps l={single} patch={(p) => patchLayer(single.id, p)} size={size} />}
                </>
              )
            )}
          </div>
        </div>
      </div>

      <Modal open={!!giftFor} onClose={() => setGiftFor(null)} title="Elegir regalo" wide>
        <GiftPicker
          selected={[]}
          onPick={(g) => {
            if (giftFor) patchLayer(giftFor, { gift: g.name })
            setGiftFor(null)
          }}
        />
      </Modal>
      <Modal open={picker === 'overlay'} onClose={() => setPicker(null)} title="Añadir overlay" wide>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(OVERLAY_SIZES).map(([id, [w, h, name]]) => (
            <button
              key={id}
              className="rounded-xl border border-line p-3 text-left transition hover:border-accent/60 hover:bg-accent/10"
              onClick={() => {
                const sw = (w / size.w) * 100
                const sh = (h / size.h) * 100
                const scale = Math.min(1, 90 / sw, 90 / sh)
                const l = overlayLayer(id, ((100 - sw * scale) / 200) * size.w, ((100 - sh * scale) / 200) * size.h, cur.ratio, r1(scale))
                addLayers([l])
                setPicker(null)
              }}
            >
              <div className="font-semibold">{name}</div>
              <div className="text-xs text-muted">
                {w} × {h} px
              </div>
            </button>
          ))}
        </div>
      </Modal>
      <Modal open={picker === 'template'} onClose={() => setPicker(null)} title="Plantillas de escena" wide>
        <TemplateGrid
          onPick={(t) => {
            newScene(t.ratio, t.build(), t.name)
            setPicker(null)
          }}
        />
      </Modal>
    </div>
  )
}

/* ------------------------------------ piezas ------------------------------------ */

function ToolBtn({ children, title, onClick, disabled, active, danger }: { children: ReactNode; title: string; onClick: () => void; disabled?: boolean; active?: boolean; danger?: boolean }) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition disabled:opacity-30 ${active ? 'bg-accent/20 text-accent-2' : 'hover:bg-white/10'} ${danger ? 'text-bad' : ''}`}
    >
      {children}
    </button>
  )
}
const Sep = () => <span className="mx-1 h-5 w-px bg-white/10" />

function UploadBtn({ kind, onDone, label }: { kind: 'image' | 'video'; onDone: (url: string) => void; label?: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <label className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm hover:bg-white/10 ${busy ? 'opacity-50' : ''}`} title={kind === 'image' ? 'Subir imagen (png, jpg, gif, webp)' : 'Subir vídeo (mp4, webm)'}>
      {kind === 'image' ? <ImageIcon size={15} /> : <Video size={15} />}
      {label}
      <input
        type="file"
        hidden
        accept={kind === 'image' ? 'image/png,image/jpeg,image/gif,image/webp' : 'video/mp4,video/webm'}
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (!f) return
          setBusy(true)
          try {
            const r = await upload('/api/media/upload', f)
            onDone(r.url)
          } catch (err) {
            toast((err as Error).message, 'error')
          } finally {
            setBusy(false)
            e.target.value = ''
          }
        }}
      />
    </label>
  )
}

/** Marco de selección con 8 tiradores y el de giro. */
function Handles({ l, k, selected, single, onMove, onResize, onRotate }: { l: Layer; k: number; selected: boolean; single: boolean; onMove: (e: React.PointerEvent) => void; onResize: (e: React.PointerEvent, h: string) => void; onRotate: (e: React.PointerEvent, el: HTMLElement) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const hs = 12 / k
  const pos: Record<string, React.CSSProperties> = {
    nw: { left: -hs / 2, top: -hs / 2, cursor: 'nwse-resize' },
    n: { left: `calc(50% - ${hs / 2}px)`, top: -hs / 2, cursor: 'ns-resize' },
    ne: { right: -hs / 2, top: -hs / 2, cursor: 'nesw-resize' },
    e: { right: -hs / 2, top: `calc(50% - ${hs / 2}px)`, cursor: 'ew-resize' },
    se: { right: -hs / 2, bottom: -hs / 2, cursor: 'nwse-resize' },
    s: { left: `calc(50% - ${hs / 2}px)`, bottom: -hs / 2, cursor: 'ns-resize' },
    sw: { left: -hs / 2, bottom: -hs / 2, cursor: 'nesw-resize' },
    w: { left: -hs / 2, top: `calc(50% - ${hs / 2}px)`, cursor: 'ew-resize' },
  }
  return (
    <div
      ref={ref}
      onPointerDown={onMove}
      style={{
        position: 'absolute',
        left: `${l.x}%`,
        top: `${l.y}%`,
        width: `${l.w}%`,
        height: `${l.h}%`,
        transform: `rotate(${l.rot}deg)`,
        cursor: l.locked ? 'not-allowed' : 'move',
        outline: selected ? `${2 / k}px solid #f43f9e` : `${1 / k}px dashed #ffffff30`,
      }}
    >
      {single && !l.locked && (
        <>
          {Object.entries(pos).map(([h, st]) => (
            <span key={h} onPointerDown={(e) => onResize(e, h)} style={{ position: 'absolute', width: hs, height: hs, borderRadius: 3 / k, background: '#fff', border: `${2 / k}px solid #f43f9e`, ...st }} />
          ))}
          <span
            onPointerDown={(e) => ref.current && onRotate(e, ref.current)}
            title="Girar (Mayús = de 15 en 15)"
            style={{ position: 'absolute', left: `calc(50% - ${hs / 2}px)`, top: -36 / k, width: hs, height: hs, borderRadius: '50%', background: '#f43f9e', border: `${2 / k}px solid #fff`, cursor: 'grab' }}
          />
        </>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  )
}

function TemplateGrid({ onPick }: { onPick: (t: (typeof SCENE_TEMPLATES)[number]) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {SCENE_TEMPLATES.map((t) => {
        const s = sceneSize(t.ratio)
        const layers = t.build()
        return (
          <button key={t.id} onClick={() => onPick(t)} className="card group overflow-hidden text-left transition hover:border-accent/60">
            <div className="grid h-40 place-items-center bg-black/40">
              <div className="relative overflow-hidden rounded border border-white/10" style={{ height: 130, aspectRatio: `${s.w} / ${s.h}`, background: 'repeating-conic-gradient(#171723 0 25%, #0f0f18 0 50%) 0 0/12px 12px' }}>
                {layers.map((l) => (
                  <div key={l.id} className="absolute rounded-sm border border-accent/60 bg-accent/25" style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.w}%`, height: `${l.h}%` }} />
                ))}
              </div>
            </div>
            <div className="p-3">
              <div className="font-bold">
                {t.name} <span className="text-xs font-normal text-muted">{t.ratio}</span>
              </div>
              <div className="text-xs text-muted">{t.desc}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function SceneProps({ cur, patch }: { cur: Scene; patch: (p: Partial<Scene>) => void }) {
  const size = sceneSize(cur.ratio)
  return (
    <div className="space-y-3 text-sm">
      <div className="font-bold">Escena</div>
      <p className="text-xs text-muted">
        En OBS añade una fuente de navegador de <b className="text-white">{size.w}×{size.h}</b> con el enlace de abajo. Si la pones de otro tamaño, la escena se escala sola.
      </p>
      <Row label="Fondo">
        <span className="flex items-center gap-2">
          <select className="input !w-32 !py-1" value={cur.bg === 'transparent' ? 'transparent' : 'color'} onChange={(e) => patch({ bg: e.target.value === 'transparent' ? 'transparent' : '#101018' })}>
            <option value="transparent">Transparente</option>
            <option value="color">Color</option>
          </select>
          {cur.bg !== 'transparent' && <input type="color" value={cur.bg} onChange={(e) => patch({ bg: e.target.value })} className="h-8 w-10 rounded border border-line bg-transparent" />}
        </span>
      </Row>
      <p className="border-t border-white/5 pt-3 text-xs text-muted">Selecciona una capa para editarla. Con Mayús+clic eliges varias.</p>
    </div>
  )
}

function ContentProps({ l, patch, pickGift, sceneSize: S }: { l: Layer; patch: (p: Partial<Layer>) => void; pickGift: () => void; sceneSize: { w: number; h: number } }) {
  const num = (v: string, min: number, max: number) => clamp(Number(v) || 0, min, max)
  return (
    <div className="space-y-3 text-sm">
      {l.type === 'overlay' && (
        <>
          <Row label="Overlay">
            <select className="input !w-44 !py-1" value={l.overlay} onChange={(e) => patch({ overlay: e.target.value, name: OVERLAY_SIZES[e.target.value]?.[2] ?? l.name })}>
              {Object.entries(OVERLAY_SIZES).map(([v, [, , name]]) => (
                <option key={v} value={v}>
                  {name}
                </option>
              ))}
            </select>
          </Row>
          <Row label={`Escala ×${l.scale.toFixed(2)}`}>
            <input type="range" min={0.2} max={3} step={0.05} value={l.scale} onChange={(e) => patch({ scale: Number(e.target.value) })} className="w-32 accent-[var(--color-hot)]" />
          </Row>
          <button
            className="btn w-full justify-center text-xs"
            onClick={() => {
              const [w, h] = OVERLAY_SIZES[l.overlay] ?? [400, 200]
              patch({ w: r1(((w * l.scale) / S.w) * 100), h: r1(((h * l.scale) / S.h) * 100) })
            }}
          >
            Ajustar la caja al tamaño del overlay
          </button>
        </>
      )}
      {(l.type === 'image' || l.type === 'video') && (
        <>
          <input className="input" value={l.url} onChange={(e) => patch({ url: e.target.value })} placeholder="URL (https://…) o sube un archivo" />
          <div className="flex justify-end">
            <UploadBtn kind={l.type} label="Subir archivo" onDone={(url) => patch({ url })} />
          </div>
          <Row label="Ajuste">
            <Seg value={l.fit} options={[{ v: 'contain', l: 'Caber' }, { v: 'cover', l: 'Llenar' }, { v: 'fill', l: 'Estirar' }]} onChange={(v) => patch({ fit: v })} />
          </Row>
          {l.type === 'video' && (
            <Row label="Sonido">
              <Seg value={l.muted ? 'off' : 'on'} options={[{ v: 'off', l: 'Silencio' }, { v: 'on', l: 'Con sonido' }]} onChange={(v) => patch({ muted: v === 'off' })} />
            </Row>
          )}
        </>
      )}
      {l.type === 'text' && (
        <>
          <textarea className="input" rows={3} value={l.text} onChange={(e) => patch({ text: e.target.value })} />
          <div className="flex flex-wrap gap-1">
            {TOKENS.map((t) => (
              <button key={t} className="chip text-[10px]" title="Dato en vivo" onClick={() => patch({ text: `${l.text} ${t}`.trim() })}>
                {t}
              </button>
            ))}
          </div>
          <Row label="Fuente">
            <select className="input !w-36 !py-1" value={l.family} onChange={(e) => patch({ family: e.target.value as Layer['family'] })}>
              <option value="outfit">Moderna</option>
              <option value="impact">Impacto</option>
              <option value="pixel">Píxel</option>
              <option value="mono">Monoespaciada</option>
              <option value="serif">Clásica</option>
              <option value="comic">Cómic</option>
            </select>
          </Row>
          <Row label="Tamaño (px)">
            <input type="number" className="input !w-24 !py-1" value={l.font} onChange={(e) => patch({ font: num(e.target.value, 8, 600) })} />
          </Row>
          <Row label="Grosor">
            <Seg value={l.weight >= 800 ? 'b' : l.weight >= 600 ? 'm' : 'n'} options={[{ v: 'n', l: 'Normal' }, { v: 'm', l: 'Medio' }, { v: 'b', l: 'Negrita' }]} onChange={(v) => patch({ weight: v === 'b' ? 900 : v === 'm' ? 600 : 400 })} />
          </Row>
          <Row label="Color">
            <input type="color" value={l.color} onChange={(e) => patch({ color: e.target.value })} className="h-8 w-14 rounded border border-line bg-transparent" />
          </Row>
          <Row label="Fondo del texto">
            <span className="flex items-center gap-1.5">
              <input type="color" value={(l.textBg || '#000000').slice(0, 7)} onChange={(e) => patch({ textBg: `${e.target.value}aa` })} className="h-8 w-10 rounded border border-line bg-transparent" />
              {l.textBg && (
                <button className="text-xs text-muted hover:text-white" onClick={() => patch({ textBg: '' })}>
                  quitar
                </button>
              )}
            </span>
          </Row>
          <Row label="Alineación">
            <Seg value={l.align} options={[{ v: 'left', l: '⟸' }, { v: 'center', l: '≡' }, { v: 'right', l: '⟹' }]} onChange={(v) => patch({ align: v })} />
          </Row>
          <Row label="Contorno">
            <Seg value={l.stroke ? 'on' : 'off'} options={[{ v: 'on', l: 'Sí' }, { v: 'off', l: 'No' }]} onChange={(v) => patch({ stroke: v === 'on' })} />
          </Row>
        </>
      )}
      {l.type === 'icon' && (
        <>
          <input className="input text-center text-2xl" value={l.icon} onChange={(e) => patch({ icon: e.target.value })} maxLength={4} />
          <div className="grid grid-cols-8 gap-1">
            {EMOJIS.map((e) => (
              <button key={e} className="rounded-lg py-1 text-xl hover:bg-white/10" onClick={() => patch({ icon: e })}>
                {e}
              </button>
            ))}
          </div>
          <Row label="Tamaño">
            <input type="number" className="input !w-24 !py-1" value={l.font} onChange={(e) => patch({ font: num(e.target.value, 8, 600) })} />
          </Row>
        </>
      )}
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
        <>
          <button className="btn w-full justify-center" onClick={pickGift}>
            Regalo: <b>{l.gift}</b>
          </button>
          <Row label="Ajuste">
            <Seg value={l.fit} options={[{ v: 'contain', l: 'Caber' }, { v: 'cover', l: 'Llenar' }]} onChange={(v) => patch({ fit: v })} />
          </Row>
        </>
      )}
    </div>
  )
}

function StyleProps({ l, patch, replay }: { l: Layer; patch: (p: Partial<Layer>) => void; replay: () => void }) {
  return (
    <div className="space-y-3 text-sm">
      <Row label={`Opacidad ${Math.round(l.opacity * 100)}%`}>
        <input type="range" min={0} max={1} step={0.05} value={l.opacity} onChange={(e) => patch({ opacity: Number(e.target.value) })} className="w-32 accent-[var(--color-hot)]" />
      </Row>
      <Row label={`Esquinas ${l.radius}px`}>
        <input type="range" min={0} max={200} value={l.radius} onChange={(e) => patch({ radius: Number(e.target.value) })} className="w-32 accent-[var(--color-hot)]" />
      </Row>
      <Row label={`Borde ${l.border}px`}>
        <span className="flex items-center gap-1.5">
          <input type="range" min={0} max={40} value={l.border} onChange={(e) => patch({ border: Number(e.target.value) })} className="w-20 accent-[var(--color-hot)]" />
          <input type="color" value={l.borderColor} onChange={(e) => patch({ borderColor: e.target.value })} className="h-7 w-9 rounded border border-line bg-transparent" />
        </span>
      </Row>
      <Row label="Sombra">
        <Seg value={l.shadow ? 'on' : 'off'} options={[{ v: 'off', l: 'No' }, { v: 'on', l: 'Sí' }]} onChange={(v) => patch({ shadow: v === 'on' })} />
      </Row>
      <Row label="Brillo (resplandor)">
        <span className="flex items-center gap-1.5">
          <input type="color" value={l.glow || '#8b5cf6'} onChange={(e) => patch({ glow: e.target.value })} className="h-7 w-9 rounded border border-line bg-transparent" />
          {l.glow && (
            <button className="text-xs text-muted hover:text-white" onClick={() => patch({ glow: '' })}>
              quitar
            </button>
          )}
        </span>
      </Row>
      <div className="border-t border-white/5 pt-3">
        <span className="label">Animación</span>
        <div className="grid grid-cols-2 gap-1">
          {ANIMS.map(([v, label]) => (
            <button key={v} onClick={() => (patch({ anim: v }), replay())} className={`rounded-lg border px-2 py-1 text-xs ${l.anim === v ? 'border-accent bg-accent/15 text-white' : 'border-line text-muted hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
        <Row label={`Velocidad ×${l.animSpeed.toFixed(1)}`}>
          <input type="range" min={0.2} max={4} step={0.1} value={l.animSpeed} onChange={(e) => patch({ animSpeed: Number(e.target.value) })} className="mt-2 w-32 accent-[var(--color-hot)]" />
        </Row>
        <button className="btn mt-2 w-full justify-center text-xs" onClick={replay}>
          <Play size={12} /> Ver la animación otra vez
        </button>
      </div>
    </div>
  )
}

function PosProps({ l, patch, size }: { l: Layer; patch: (p: Partial<Layer>) => void; size: { w: number; h: number } }) {
  const num = (v: string, min = -200, max = 400) => r1(clamp(Number(v) || 0, min, max))
  const px = (p: number, total: number) => Math.round((p / 100) * total)
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ['x', 'X'],
            ['y', 'Y'],
            ['w', 'Ancho'],
            ['h', 'Alto'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-xs text-muted">
            {label} %
            <input type="number" step={0.5} className="input mt-0.5 !py-1" value={l[key]} onChange={(e) => patch({ [key]: num(e.target.value, key === 'w' || key === 'h' ? 0.5 : -200) })} />
            <span className="text-[10px]">{px(l[key], key === 'x' || key === 'w' ? size.w : size.h)} px</span>
          </label>
        ))}
      </div>
      <Row label={`Giro ${l.rot}°`}>
        <input type="range" min={-180} max={180} value={l.rot} onChange={(e) => patch({ rot: Number(e.target.value) })} className="w-32 accent-[var(--color-hot)]" />
      </Row>
      <div className="flex gap-2">
        <button className="btn flex-1 justify-center text-xs" onClick={() => patch({ x: r1(50 - l.w / 2), y: r1(50 - l.h / 2) })}>
          <ZoomIn size={12} /> Centrar
        </button>
        <button className="btn flex-1 justify-center text-xs" onClick={() => patch({ x: 0, y: 0, w: 100, h: 100, rot: 0 })}>
          Pantalla completa
        </button>
      </div>
      <Row label="Bloqueada">
        <Seg value={l.locked ? 'on' : 'off'} options={[{ v: 'off', l: 'No' }, { v: 'on', l: 'Sí' }]} onChange={(v) => patch({ locked: v === 'on' })} />
      </Row>
    </div>
  )
}
