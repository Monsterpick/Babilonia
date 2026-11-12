import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Copy, ExternalLink, FlaskConical, Minus, Pause, Play, Plus, RotateCcw, Search, Sparkles, Trash2, X } from 'lucide-react'
import { api, overlayUrl } from '../lib/api'
import { useLiveState } from '../lib/live'
import { Check, Modal, Seg } from '../components/ui'
import { toast } from '../components/Toast'
import { GiftPicker } from '../components/GiftPicker'
import { useGifts } from '../lib/catalog'

type Cfg = Record<string, any>

interface Def {
  id: string
  name: string
  desc: string
  /** Tamaño recomendado de la fuente de navegador (y del marco de la vista previa). */
  w: number
  h: number
  settings?: (cfg: Cfg, set: (patch: Cfg) => void) => ReactNode
  tools?: () => ReactNode
  /** Ocupa toda la fila (para overlays altos como los tops, que necesitan una vista previa grande). */
  wide?: boolean
  /** Arranca con el ejemplo activado (útil en overlays que de otro modo salen vacíos). */
  demoFirst?: boolean
}

/** Overlays que siempre muestran algo (marcadores y metas): no llevan el aviso «vacío hasta el primer evento». */
const ALWAYS_VISIBLE = new Set(['tarjetas', 'contador', 'cronometro', 'vidas', 'totems', 'reset-salvar', 'meta-regalo', 'duelo', 'meta-monedas', 'meta-likes', 'meta-seguidores', 'meta-combinada'])

const copy = (url: string) => navigator.clipboard.writeText(url).then(() => toast('Enlace copiado'), () => toast('No se pudo copiar', 'error'))
const post = (path: string, body: unknown) => api('POST', path, body).catch((e) => toast((e as Error).message, 'error'))

/* ------------------------------ campos pequeños ------------------------------ */

function Txt({ label, value, onChange, w = 'w-44' }: { label: string; value: string; onChange: (v: string) => void; w?: string }) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => setV(value ?? ''), [value])
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <input className={`input !py-1.5 ${w}`} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onChange(v)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
    </label>
  )
}
function Num({ label, value, onChange, min = 0, suffix }: { label: string; value: number; onChange: (v: number) => void; min?: number; suffix?: string }) {
  const [v, setV] = useState(String(value ?? ''))
  useEffect(() => setV(String(value ?? '')), [value])
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-1.5">
        <input type="number" min={min} className="input !w-28 !py-1.5" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => Number(v) !== value && Number.isFinite(Number(v)) && onChange(Math.max(min, Math.round(Number(v))))} />
        {suffix && <span className="text-xs text-muted">{suffix}</span>}
      </span>
    </label>
  )
}
function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-14 cursor-pointer rounded-lg border border-line bg-transparent" />
    </label>
  )
}
function GiftField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <button className="btn" onClick={() => setOpen(true)}>
        {value || 'Elegir regalo'}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={label} wide>
        <GiftPicker
          selected={value ? [value] : []}
          onPick={(g) => {
            onChange(g.name)
            setOpen(false)
          }}
        />
      </Modal>
    </div>
  )
}
function Counter({ label, value, onAdd, color }: { label: string; value: number; onAdd: (d: number) => void; color: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-white/5 bg-black/30 p-3" style={{ boxShadow: `inset 0 3px 0 ${color}` }}>
      <span className="text-[11px] font-bold tracking-[0.2em]" style={{ color }}>
        {label}
      </span>
      <div className="flex items-center gap-3">
        <button className="grid h-8 w-8 place-items-center rounded-full bg-white/10 hover:bg-white/20" onClick={() => onAdd(-1)}>
          <Minus size={14} />
        </button>
        <span className="w-12 text-center text-3xl font-black tabular-nums">{value}</span>
        <button className="grid h-8 w-8 place-items-center rounded-full text-[#06130d]" style={{ background: color }} onClick={() => onAdd(1)}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}

/* --------------------------------- catálogo --------------------------------- */

function ScoreTools() {
  const s = useLiveState<any>('scoreboard')
  return (
    <div className="flex gap-2">
      <Counter label="VICTORIAS" color="#34e0a1" value={s?.wins ?? 0} onAdd={(d) => post('/api/scoreboard', { add: { key: 'wins', delta: d } })} />
      <Counter label="DERROTAS" color="#ff4d6d" value={s?.losses ?? 0} onAdd={(d) => post('/api/scoreboard', { add: { key: 'losses', delta: d } })} />
    </div>
  )
}
function LivesTools() {
  const s = useLiveState<any>('scoreboard')
  return (
    <div className="flex gap-2">
      <Counter label="VIDAS AHORA" color="#ff3d6e" value={s?.lives ?? 0} onAdd={(d) => post('/api/scoreboard', { add: { key: 'lives', delta: d } })} />
      <Counter label="AL EMPEZAR" color="#a78bfa" value={s?.livesStart ?? 3} onAdd={(d) => post('/api/scoreboard', { set: { livesStart: Math.max(0, (s?.livesStart ?? 3) + d) } })} />
    </div>
  )
}
function TimerTools() {
  const s = useLiveState<any>('scoreboard')
  const running = !!s?.timer?.running
  const [exact, setExact] = useState(5)
  const add = (min: number) => post('/api/scoreboard', { timer: { op: 'add', seconds: min * 60 } })
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button className="btn-accent" onClick={() => post('/api/scoreboard', { timer: { op: running ? 'pause' : 'start' } })}>
          {running ? <Pause size={14} /> : <Play size={14} />} {running ? 'Pausar' : 'Iniciar'}
        </button>
        <button className="btn" onClick={() => post('/api/scoreboard', { timer: { op: 'reset' } })}>
          <RotateCcw size={14} /> Reiniciar
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {[-30, -10, -5, -1].map((m) => (
          <button key={m} className="rounded-lg border border-bad/50 px-2.5 py-1 text-xs font-bold text-bad hover:bg-bad/10" onClick={() => add(m)}>
            {m}
          </button>
        ))}
        <span className="px-1 text-xs text-muted">min</span>
        {[1, 5, 10, 30].map((m) => (
          <button key={m} className="rounded-lg border border-ok/50 px-2.5 py-1 text-xs font-bold text-ok hover:bg-ok/10" onClick={() => add(m)}>
            +{m}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button className="rounded-lg border border-bad/50 px-3 py-1 text-xs font-bold text-bad hover:bg-bad/10" onClick={() => add(-exact)}>
          − Quitar
        </button>
        <input type="number" className="input !w-20 !py-1 text-center" value={exact} onChange={(e) => setExact(Math.max(1, Number(e.target.value) || 1))} />
        <span className="text-xs text-muted">min</span>
        <button className="rounded-lg border border-ok/50 px-3 py-1 text-xs font-bold text-ok hover:bg-ok/10" onClick={() => add(exact)}>
          Añadir +
        </button>
      </div>
    </div>
  )
}

const resetBtn = (what: string, label: string) => () => (
  <button className="btn" onClick={() => post('/api/overlays/reset', { what })}>
    <RotateCcw size={14} /> {label}
  </button>
)

const SECTIONS: { title: string; hint: string; items: Def[] }[] = [
  {
    title: 'En directo',
    hint: 'Lo que pasa en el momento: quién manda qué, seguidores y muertes.',
    items: [
      { id: 'avisos', name: 'Avisos de acciones', desc: 'Foto y nombre de quien activa cada plugin, con ×N en las rachas.', w: 520, h: 420 },
      {
        id: 'logros',
        name: 'Logros, «¡Te mató!» y Quiéreme',
        desc: 'Tres avisos en uno: seguidor nuevo = «¡Logro conseguido!» (una vez por persona); al morir, quién te mató (el último que te mandó un mob o trampa en 3 min) o «¡Has muerto!»; y cada Quiéreme, con su corazón de píxeles que late.',
        w: 600,
        h: 360,
      },
      {
        id: 'destacados',
        name: 'Regalos destacados',
        desc: 'Los regalos que pasan de las monedas que elijas, durante unos segundos.',
        w: 520,
        h: 360,
        settings: (c, set) => (
          <>
            <Num label="Desde (monedas)" value={c.featured?.minCoins} min={1} onChange={(v) => set({ featured: { minCoins: v } })} />
            <Num label="Se quedan" suffix="s" value={c.featured?.seconds} min={2} onChange={(v) => set({ featured: { seconds: v } })} />
          </>
        ),
      },
      { id: 'tarjetas', name: 'Tarjetas de plugins', desc: 'Todas tus acciones; la que se activa se anima. Se configura más abajo.', w: 1080, h: 400 },
      { id: 'ticker', name: 'Banda de últimos eventos', desc: 'Feed de regalos, seguidores y compartir. Perfecto como barra inferior (?dir=v para vertical).', w: 1280, h: 100 },
    ],
  },
  {
    title: 'Juego',
    hint: 'Marcadores para tu partida de Minecraft.',
    items: [
      {
        id: 'contador',
        name: 'Contador de victorias y derrotas',
        desc: 'V / D grandes; ?mini=1 para una línea.',
        w: 420,
        h: 160,
        tools: ScoreTools,
        settings: (c, set) => (
          <Check on={!!c.score?.minimal} onChange={(v) => set({ score: { minimal: v } })}>
            Diseño minimalista (una línea)
          </Check>
        ),
      },
      {
        id: 'cronometro',
        name: 'Cronómetro',
        desc: 'Hacia arriba o cuenta atrás, con sonido al llegar a 0.',
        w: 480,
        h: 190,
        tools: TimerTools,
        settings: (c, set) => (
          <>
            <Seg value={c.timer?.mode ?? 'up'} options={[{ v: 'up', l: 'Hacia arriba' }, { v: 'down', l: 'Cuenta atrás' }]} onChange={(v) => set({ timer: { mode: v } })} />
            {c.timer?.mode === 'down' && <Num label="Empieza en" suffix="min" value={Math.round((c.timer?.startSec ?? 600) / 60)} min={1} onChange={(v) => set({ timer: { startSec: v * 60 } })} />}
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">Cuando mueras en Minecraft</span>
              <select className="input !w-44 !py-1.5" value={c.timer?.onDeath ?? 'none'} onChange={(e) => set({ timer: { onDeath: e.target.value } })}>
                <option value="none">No hacer nada</option>
                <option value="reset">Reiniciar</option>
                <option value="pause">Pausar</option>
              </select>
            </label>
            {c.timer?.mode === 'down' && <Txt label="Sonido al terminar (URL)" value={c.timer?.endSound ?? ''} onChange={(v) => set({ timer: { endSound: v } })} />}
            <div className="border-t border-white/5 pt-2">
              <Num label="Reloj extensible: segundos por moneda" suffix="s/🪙" min={0} value={c.timer?.coinSeconds} onChange={(v) => set({ timer: { coinSeconds: v } })} />
              <p className="mt-1 text-[11px] text-muted">0 = apagado. Con un valor, cada moneda/diamante recibido alarga el reloj (subathon).</p>
            </div>
            {Number(c.timer?.coinSeconds ?? 0) > 0 && <Num label="Tope de horas (0 = sin tope)" suffix="h" min={0} value={c.timer?.maxHours} onChange={(v) => set({ timer: { maxHours: v } })} />}
            <Num label="Tamaño del reloj" suffix="px" min={40} value={c.timer?.size} onChange={(v) => set({ timer: { size: v } })} />
            <Check on={c.timer?.showProgress ?? true} onChange={(v) => set({ timer: { showProgress: v } })}>
              Barra de progreso del minuto
            </Check>
            <Check on={!!c.timer?.minimal} onChange={(v) => set({ timer: { minimal: v } })}>
              Diseño minimalista
            </Check>
          </>
        ),
      },
      {
        id: 'vidas',
        name: 'Contador de vidas',
        desc: 'Corazón de píxeles × vidas; al llegar a 0 sale «SIN VIDAS». Muestra +N / −N al cambiar.',
        w: 360,
        h: 180,
        tools: LivesTools,
        settings: (c, set) => (
          <>
            <Txt label="Título" value={c.lives?.title} onChange={(v) => set({ lives: { title: v } })} />
            <Color label="Color" value={c.lives?.color ?? '#ff3d6e'} onChange={(v) => set({ lives: { color: v } })} />
            <Check on={!!c.lives?.minimal} onChange={(v) => set({ lives: { minimal: v } })}>
              Diseño minimalista
            </Check>
          </>
        ),
      },
      { id: 'parkour', name: 'Torre de parkour (Parkour LIVE)', desc: 'Tu nivel en la torre de 50 biomas, progreso, caídas y tiempo. «+N / −N» grande cuando te suben o te bajan.', w: 360, h: 620 },
      { id: 'lasthouse', name: 'Marcador de LAST HOUSE', desc: 'Modo, tiempo, asaltos o vida de la casa, los 3 mejores espectadores y la votación del chat en curso.', w: 360, h: 420 },
      { id: 'lasthouse-regalos', name: 'LAST HOUSE: qué hace cada regalo', desc: 'Lista de qué hacen los likes, comentarios, follows, compartidos y regalos en el modo que estás jugando.', w: 380, h: 380 },
      { id: 'totems', name: 'Tótems (plugin LiveArena)', desc: 'Cuántos tótems apilados te quedan. Necesita el plugin LiveArena en el servidor.', w: 300, h: 120 },
      {
        id: 'reset-salvar',
        name: 'Reset o salvar',
        desc: 'Un regalo pide RESET; si en unos segundos llegan tantos regalos de SALVAR como los del reset, se salva. Si no, se reinicia.',
        w: 520,
        h: 260,
        settings: (c, set) => (
          <>
            <Check on={!!c.resetSave?.enabled} onChange={(v) => set({ resetSave: { enabled: v } })}>
              <b>Activado</b>
            </Check>
            <GiftField label="Regalo de RESET" value={c.resetSave?.resetGift} onChange={(v) => set({ resetSave: { resetGift: v } })} />
            <GiftField label="Regalo de SALVAR" value={c.resetSave?.saveGift} onChange={(v) => set({ resetSave: { saveGift: v } })} />
            <Num label="Tiempo para salvar" suffix="s" min={3} value={c.resetSave?.seconds} onChange={(v) => set({ resetSave: { seconds: v } })} />
            <Check on={!!c.resetSave?.resetTimer} onChange={(v) => set({ resetSave: { resetTimer: v } })}>
              El reset reinicia el cronómetro
            </Check>
            <Check on={!!c.resetSave?.resetLives} onChange={(v) => set({ resetSave: { resetLives: v } })}>
              El reset devuelve las vidas al inicio
            </Check>
            <Txt label="Comando en Minecraft" w="w-56" value={c.resetSave?.command} onChange={(v) => set({ resetSave: { command: v } })} />
          </>
        ),
      },
    ],
  },
  {
    title: 'Récords',
    hint: 'Quién mandó lo más grande. Con el mismo valor, gana el último.',
    items: [
      {
        id: 'mejor-regalo',
        name: 'Mejor regalo (se guarda)',
        desc: 'No es solo de hoy: se queda hasta que alguien lo supere o lo iguale.',
        w: 560,
        h: 180,
        tools: resetBtn('ever', 'Borrar el récord'),
        settings: (c, set) => (
          <>
            <Check on={c.best?.countFullStreak ?? true} onChange={(v) => set({ best: { countFullStreak: v } })}>
              Contar la racha completa (50 rosas seguidas = 50 monedas)
            </Check>
            <Txt label="Título" value={c.best?.title} onChange={(v) => set({ best: { title: v } })} />
            <Color label="Color" value={c.best?.color ?? '#ffb547'} onChange={(v) => set({ best: { color: v } })} />
            <Check on={!!c.best?.minimal} onChange={(v) => set({ best: { minimal: v } })}>
              Diseño minimalista
            </Check>
          </>
        ),
      },
      {
        id: 'mejor-directo',
        name: 'Mejor regalo del directo',
        desc: 'Igual, pero solo de este live: empieza vacío en cada directo.',
        w: 560,
        h: 180,
        tools: resetBtn('live', 'Poner a cero'),
        settings: (c, set) => (
          <>
            <Txt label="Título" value={c.bestLive?.title} onChange={(v) => set({ bestLive: { title: v } })} />
            <Color label="Color" value={c.bestLive?.color ?? '#38bdf8'} onChange={(v) => set({ bestLive: { color: v } })} />
            <Check on={!!c.bestLive?.minimal} onChange={(v) => set({ bestLive: { minimal: v } })}>
              Diseño minimalista
            </Check>
          </>
        ),
      },
      {
        id: 'mejor-racha',
        name: 'Mejor racha',
        desc: 'La racha más larga del live (p. ej. TikTok ×100).',
        w: 560,
        h: 180,
        tools: resetBtn('streak', 'Poner a cero'),
        settings: (c, set) => (
          <>
            <Txt label="Título" value={c.streak?.title} onChange={(v) => set({ streak: { title: v } })} />
            <Color label="Color" value={c.streak?.color ?? '#c084fc'} onChange={(v) => set({ streak: { color: v } })} />
          </>
        ),
      },
      { id: 'combinado', name: 'Combinado', desc: 'Va turnando mejor regalo del directo, mejor racha y meta de regalo.', w: 560, h: 260 },
    ],
  },
  {
    title: 'Metas y duelos',
    hint: 'Objetivos para que el chat empuje.',
    items: [
      {
        id: 'meta-regalo',
        name: 'Meta de regalo',
        desc: 'Cuenta un regalo concreto hasta la meta (p. ej. 229/100 rosas).',
        w: 320,
        h: 260,
        tools: resetBtn('goals', 'Poner a cero'),
        settings: (c, set) => (
          <>
            <GiftField label="Regalo" value={c.giftGoal?.gift} onChange={(v) => set({ giftGoal: { gift: v } })} />
            <Num label="Meta" min={1} value={c.giftGoal?.target} onChange={(v) => set({ giftGoal: { target: v } })} />
            <Txt label="Texto" value={c.giftGoal?.title} onChange={(v) => set({ giftGoal: { title: v } })} />
          </>
        ),
      },
      {
        id: 'duelo',
        name: 'Duelo de regalos',
        desc: 'Dos regalos, dos equipos: gana el que llegue antes a la meta.',
        w: 560,
        h: 260,
        tools: resetBtn('goals', 'Poner a cero'),
        settings: (c, set) => (
          <>
            <GiftField label="Regalo equipo 1" value={c.duel?.a?.gift} onChange={(v) => set({ duel: { a: { gift: v } } })} />
            <Txt label="Nombre equipo 1" value={c.duel?.a?.label} onChange={(v) => set({ duel: { a: { label: v } } })} />
            <GiftField label="Regalo equipo 2" value={c.duel?.b?.gift} onChange={(v) => set({ duel: { b: { gift: v } } })} />
            <Txt label="Nombre equipo 2" value={c.duel?.b?.label} onChange={(v) => set({ duel: { b: { label: v } } })} />
            <Num label="Meta" min={1} value={c.duel?.target} onChange={(v) => set({ duel: { target: v } })} />
          </>
        ),
      },
      {
        id: 'meta-monedas',
        name: 'Meta de monedas',
        desc: 'Barra con las monedas del live.',
        w: 600,
        h: 120,
        settings: (c, set) => (
          <>
            <Num label="Meta" min={1} value={c.goals?.coins?.target} onChange={(v) => set({ goals: { coins: { target: v } } })} />
            <Txt label="Texto" value={c.goals?.coins?.label} onChange={(v) => set({ goals: { coins: { label: v } } })} />
          </>
        ),
      },
      { id: 'meta-likes', name: 'Meta de likes', desc: 'Barra con los likes de la sala (la meta se cambia en Ajustes).', w: 640, h: 100 },
      {
        id: 'meta-seguidores',
        name: 'Meta de seguidores',
        desc: 'Barra de progreso de los seguidores que consigues en el live.',
        w: 640,
        h: 100,
        tools: resetBtn('session', 'Poner a cero'),
        settings: (c, set) => (
          <>
            <Num label="Meta" min={1} value={c.goals?.followers?.target} onChange={(v) => set({ goals: { followers: { target: v } } })} />
            <Txt label="Texto" value={c.goals?.followers?.label} onChange={(v) => set({ goals: { followers: { label: v } } })} />
          </>
        ),
      },
      {
        id: 'meta-combinada',
        name: 'Meta combinada',
        desc: 'Monedas + likes juntos en una sola barra.',
        w: 640,
        h: 100,
        settings: (c, set) => (
          <>
            <Num label="Meta" min={1} value={c.goals?.combined?.target} onChange={(v) => set({ goals: { combined: { target: v } } })} />
            <Txt label="Texto" value={c.goals?.combined?.label} onChange={(v) => set({ goals: { combined: { label: v } } })} />
          </>
        ),
      },
    ],
  },
  {
    title: 'Rankings',
    hint: 'Los que más aportan. Elige el estilo que más te guste.',
    items: [
      { id: 'top-regalos', name: 'Top regalos', desc: 'Quién más monedas ha regalado. ?align=right para alinearlo a la derecha.', w: 440, h: 800, settings: topSettings, wide: true, demoFirst: true },
      { id: 'top-likes', name: 'Top likes', desc: 'Quién más likes ha dado.', w: 440, h: 800, settings: topSettings, wide: true, demoFirst: true },
      { id: 'mvp-monedas', name: 'MVP de monedas', desc: 'Solo el número 1, en grande.', w: 480, h: 150 },
      { id: 'mvp-likes', name: 'MVP de likes', desc: 'Solo el número 1 de likes.', w: 480, h: 150 },
    ],
  },
]

function topSettings(c: Cfg, set: (p: Cfg) => void) {
  const styles = [
    ['clasico', 'Clásico'],
    ['tarjetas', 'Tarjetas'],
    ['barras', 'Barras'],
    ['neon', 'Neón'],
    ['desfile', 'Desfile'],
    ['minimo', 'Mínimo'],
    ['arcade', 'Arcade'],
    ['oro', 'Todo oro'],
  ] as const
  return (
    <>
      <div className="grid grid-cols-4 gap-1.5">
        {styles.map(([v, l]) => (
          <button key={v} onClick={() => set({ top: { style: v } })} className={`rounded-xl border px-2 py-1.5 text-xs font-semibold transition ${c.top?.style === v ? 'border-transparent bg-gradient-to-r from-accent to-hot text-white' : 'border-line text-muted hover:text-white'}`}>
            {l}
          </button>
        ))}
      </div>
      <Num label="Cuántos" min={1} value={c.top?.n} onChange={(v) => set({ top: { n: Math.min(10, v) } })} />
    </>
  )
}

/* ------------------------------ vista previa ------------------------------ */

type Bg = 'cuadros' | 'juego' | 'verde' | 'oscuro' | 'claro'
const BGS: { v: Bg; l: string; css: string }[] = [
  { v: 'cuadros', l: 'Transparente', css: 'repeating-conic-gradient(#171723 0 25%, #0f0f18 0 50%) 0 0/22px 22px' },
  { v: 'juego', l: 'Minecraft', css: 'linear-gradient(180deg,#78a7ff 0%,#a9c8ff 55%,#6aa84f 55.5%,#4f7f37 72%,#7a5a3a 72.5%,#5e4329 100%)' },
  { v: 'verde', l: 'Croma', css: '#00b140' },
  { v: 'oscuro', l: 'Oscuro', css: '#0b0b12' },
  { v: 'claro', l: 'Claro', css: '#e8e8ef' },
]
const bgCss = (b: Bg) => BGS.find((x) => x.v === b)?.css ?? BGS[0]!.css

function useBg(): [Bg, (b: Bg) => void] {
  const [bg, setBg] = useState<Bg>(() => {
    try {
      return (localStorage.getItem('la-ov-bg') as Bg) || 'cuadros'
    } catch {
      return 'cuadros'
    }
  })
  return [
    bg,
    (b) => {
      setBg(b)
      try {
        localStorage.setItem('la-ov-bg', b)
      } catch {
        /* sin almacenamiento */
      }
    },
  ]
}

/**
 * Muestra el overlay ENTERO dentro de la caja (escala «contain»: nunca se recorta), sobre el fondo elegido.
 * Mientras está vacío se ve el marco del tamaño real para saber dónde irá.
 */
function Stage({ id, w, h, nonce, example, bg, height, maxScale = 2 }: { id: string; w: number; h: number; nonce: number; example: boolean; bg: Bg; height: number | string; maxScale?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 380, h: 200 })
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const scale = Math.max(0.05, Math.min(maxScale, (size.w - 24) / w, (size.h - 24) / h))
  return (
    <div ref={box} className="relative grid place-items-center overflow-hidden rounded-xl border border-white/5" style={{ height, background: bgCss(bg) }}>
      <div style={{ width: w * scale, height: h * scale, position: 'relative' }} className="rounded-[3px] outline outline-1 outline-dashed outline-white/20">
        {!example && !ALWAYS_VISIBLE.has(id) && (
          <span className="pointer-events-none absolute bottom-1 left-1.5 text-[10px] font-semibold whitespace-nowrap text-white/30">vacío hasta el primer evento</span>
        )}
        <iframe key={`${nonce}-${example}`} title={id} src={overlayUrl(id, example ? { demo: '1' } : {})} style={{ position: 'absolute', top: 0, left: 0, width: w, height: h, transform: `scale(${scale})`, transformOrigin: 'top left', border: 0, background: 'transparent', pointerEvents: 'none' }} />
      </div>
    </div>
  )
}

/* ---------------------------------- tarjeta ---------------------------------- */

function OverlayCard({ d, bg, onTest }: { d: Def; bg: Bg; onTest: () => void }) {
  const url = overlayUrl(d.id)
  const [example, setExample] = useState(false)
  return (
    <div className="card group flex flex-col overflow-hidden">
      <div className="relative">
        <Stage id={d.id} w={d.w} h={d.h} nonce={0} example={example} bg={bg} height={190} maxScale={1.4} />
        <button
          className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur ${example ? 'bg-accent/80 text-white' : 'bg-black/60 text-muted hover:text-white'}`}
          onClick={() => setExample((e) => !e)}
          title="Ver con datos de ejemplo (solo aquí: tu overlay real sigue vacío)"
        >
          <Sparkles size={10} className="mr-1 inline" />
          {example ? 'Ejemplo' : 'En vivo'}
        </button>
        <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-muted">
          {d.w}×{d.h}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="font-bold tracking-tight">{d.name}</div>
        <div className="line-clamp-2 min-h-[2rem] text-xs text-muted">{d.desc}</div>
        <div className="mt-auto flex items-center gap-1.5">
          <button className="btn-accent flex-1 justify-center" onClick={onTest}>
            <FlaskConical size={14} /> Probar y ajustar
          </button>
          <button className="btn !px-2.5" title="Copiar enlace para OBS / TikTok LIVE Studio" onClick={() => copy(url)}>
            <Copy size={14} />
          </button>
          <a className="btn !px-2.5" href={url} target="_blank" rel="noreferrer" title="Abrir">
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------- probador ---------------------------------- */

function SimButton({ label, emoji, body, hint }: { label: string; emoji: string; body: Record<string, unknown>; hint?: string }) {
  return (
    <button className="flex items-center gap-2 rounded-xl border border-line bg-black/20 px-3 py-2 text-left text-sm transition hover:border-accent/60 hover:bg-accent/10" title={hint} onClick={() => void post('/api/simulate', { ...body, dry: true })}>
      <span className="text-lg">{emoji}</span>
      <span className="font-semibold">{label}</span>
    </button>
  )
}

function Tester({ d, cfg, set, onClose, bg, setBg }: { d: Def; cfg: Cfg; set: (p: Cfg) => void; onClose: () => void; bg: Bg; setBg: (b: Bg) => void }) {
  const url = overlayUrl(d.id)
  const [nonce, setNonce] = useState(0)
  const [example, setExample] = useState(false)
  const gifts = useGifts()
  const cheap = gifts.find((g) => /^rose$/i.test(g.name)) ?? gifts.find((g) => g.diamonds === 1) ?? gifts[0]
  const big = [...gifts].sort((a, b) => b.diamonds - a.diamonds).find((g) => g.diamonds <= 30000) ?? gifts[gifts.length - 1]
  const mid = gifts.find((g) => g.diamonds >= 99 && g.diamonds <= 500) ?? big
  const Tools = d.tools
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-50 flex bg-black/80 p-4 backdrop-blur-sm md:p-6" onClick={onClose}>
      <div className="mx-auto grid h-full w-full max-w-[1600px] gap-4 overflow-hidden rounded-2xl border border-line bg-bg p-4 lg:grid-cols-[minmax(0,1fr)_400px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-auto min-w-0">
              <div className="text-lg font-extrabold tracking-tight">{d.name}</div>
              <div className="text-xs text-muted">
                Fuente de navegador de {d.w} × {d.h} · Esc para cerrar
              </div>
            </div>
            <Seg
              value={example ? 'ej' : 'vivo'}
              options={[
                { v: 'vivo', l: 'En vivo' },
                { v: 'ej', l: 'Ejemplo' },
              ]}
              onChange={(v) => setExample(v === 'ej')}
            />
            <select className="input !w-48 !py-1.5" value={bg} onChange={(e) => setBg(e.target.value as Bg)} title="Fondo de prueba">
              {BGS.map((b) => (
                <option key={b.v} value={b.v}>
                  Fondo: {b.l}
                </option>
              ))}
            </select>
            <button className="btn" title="Recargar" onClick={() => setNonce((n) => n + 1)}>
              <RotateCcw size={14} />
            </button>
            <button className="btn" onClick={onClose}>
              <X size={14} />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <Stage id={d.id} w={d.w} h={d.h} nonce={nonce} example={example} bg={bg} height="100%" />
          </div>
          <div className="rounded-xl border border-white/5 bg-black/20 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm">
              <b>Simular eventos</b>
              <span className="mr-auto text-xs text-muted">Solo se ven en los overlays: no pasa nada en Minecraft.</span>
              <button className="btn !py-1 text-xs" onClick={() => void post('/api/overlays/reset', { what: 'session' })} title="Pone a cero rankings, metas y regalos de este live">
                <Trash2 size={12} /> Borrar pruebas
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
              {cheap && <SimButton emoji="🌹" label={cheap.name} body={{ type: 'gift', name: cheap.name, count: 1 }} />}
              {cheap && <SimButton emoji="🔥" label={`Racha ×15`} body={{ type: 'gift', name: cheap.name, count: 15 }} />}
              {mid && <SimButton emoji="🎁" label={mid.name} body={{ type: 'gift', name: mid.name, count: 1, streak: false }} />}
              {big && <SimButton emoji="🦁" label={big.name} body={{ type: 'gift', name: big.name, count: 1, streak: false }} hint="El regalo más caro del catálogo" />}
              <SimButton emoji="➕" label="Seguidor" body={{ type: 'follow' }} />
              <SimButton emoji="❤️" label="200 likes" body={{ type: 'like', count: 200 }} />
              <SimButton emoji="💬" label="Comentario" body={{ type: 'chat', text: '¡Hola! Saludos desde el chat' }} />
              <SimButton emoji="🌪️" label="Ráfaga" body={{ type: 'burst', events: 40, seconds: 3 }} />
            </div>
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
          <div className="rounded-xl border border-white/5 bg-black/20 p-3 text-sm text-muted">{d.desc}</div>
          {Tools && (
            <div className="rounded-xl border border-white/5 bg-black/20 p-3">
              <span className="label">Controles</span>
              <Tools />
            </div>
          )}
          {d.settings && (
            <div className="space-y-2.5 rounded-xl border border-white/5 bg-black/20 p-3">
              <span className="label">Ajustes</span>
              {d.settings(cfg, set)}
            </div>
          )}
          <div className="mt-auto space-y-2 rounded-xl border border-accent/30 bg-accent/5 p-3">
            <span className="label">Ponerlo en OBS / TikTok LIVE Studio</span>
            <div className="flex items-center gap-1.5 rounded-full border border-line bg-black/30 p-1 pl-3">
              <code className="min-w-0 flex-1 truncate text-[11px] text-[#c4b5fd]">{url}</code>
              <button className="btn-accent !px-3" onClick={() => copy(url)}>
                <Copy size={13} /> Copiar
              </button>
              <a className="btn !px-3" href={url} target="_blank" rel="noreferrer" title="Abrir">
                <ExternalLink size={13} />
              </a>
            </div>
            <p className="text-[11px] text-muted">
              Añade una «Fuente de navegador» de <b className="text-white">{d.w} × {d.h}</b> con este enlace. Fondo transparente: no hace falta croma.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ---------------------------------- catálogo ---------------------------------- */

export function OverlayCatalog() {
  const live = useLiveState<Cfg>('overlaycfg')
  const [cfg, setCfg] = useState<Cfg>({})
  const [cat, setCat] = useState('Todos')
  const [q, setQ] = useState('')
  const [testing, setTesting] = useState<Def | null>(null)
  const [bg, setBg] = useBg()
  useEffect(() => {
    if (live) setCfg(live)
  }, [live])
  const set = (patch: Cfg) => {
    const merge = (a: any, b: any): any => (typeof a === 'object' && a && typeof b === 'object' && b && !Array.isArray(b) ? Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [k, k in b ? merge(a[k], b[k]) : a[k]])) : b)
    setCfg((c) => merge(c, patch))
    api('PUT', '/api/overlays/settings', patch).catch((e) => toast((e as Error).message, 'error'))
  }
  const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const sections = SECTIONS.filter((s) => cat === 'Todos' || s.title === cat)
    .map((s) => ({ ...s, items: s.items.filter((d) => !q || norm(`${d.name} ${d.desc}`).includes(norm(q))) }))
    .filter((s) => s.items.length)
  const total = SECTIONS.reduce((n, s) => n + s.items.length, 0)
  return (
    <div className="px-8 pb-10">
      <div className="sticky top-0 z-20 -mx-8 mb-5 flex flex-wrap items-center gap-2 border-b border-white/5 bg-bg/90 px-8 py-3 backdrop-blur">
        {['Todos', ...SECTIONS.map((s) => s.title)].map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${cat === c ? 'bg-gradient-to-r from-accent to-hot text-white' : 'border border-line text-muted hover:text-white'}`}>
            {c}
            <span className="ml-1.5 text-[11px] opacity-70">{c === 'Todos' ? total : SECTIONS.find((s) => s.title === c)?.items.length}</span>
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={14} className="absolute top-2.5 left-3 text-muted" />
          <input className="input !w-56 !py-1.5 pl-8" placeholder="Buscar overlay…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input !w-48 !py-1.5" value={bg} onChange={(e) => setBg(e.target.value as Bg)} title="Fondo de las vistas previas">
          {BGS.map((b) => (
            <option key={b.v} value={b.v}>
              Fondo: {b.l}
            </option>
          ))}
        </select>
      </div>
      <label className="mb-6 flex items-center gap-2.5 rounded-xl border border-white/5 bg-black/20 px-4 py-2.5 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-[var(--color-hot)]" checked={cfg.resetOnNewLive ?? true} onChange={(e) => set({ resetOnNewLive: e.target.checked })} />
        <span>
          <b>Reiniciar regalos y rankings en cada live nuevo</b> <span className="text-muted">— el «Mejor regalo» histórico no se borra</span>
        </span>
      </label>
      <div className="space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="text-xl font-extrabold tracking-tight">{s.title}</h2>
              <span className="text-sm text-muted">{s.hint}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {s.items.map((d) => (
                <OverlayCard key={d.id} d={d} bg={bg} onTest={() => setTesting(d)} />
              ))}
            </div>
          </section>
        ))}
        {!sections.length && <p className="py-16 text-center text-muted">No hay overlays con «{q}».</p>}
      </div>
      {testing && <Tester d={testing} cfg={cfg} set={set} onClose={() => setTesting(null)} bg={bg} setBg={setBg} />}
    </div>
  )
}
