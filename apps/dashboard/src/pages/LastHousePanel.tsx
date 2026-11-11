import { ExternalLink, FlaskConical, Play } from 'lucide-react'

/** Qué hace cada cosa del directo en LAST HOUSE (lo aplica el propio juego: no hay que configurar regalos). */
const ACTIONS: { what: string; how: string; free?: boolean }[] = [
  { what: 'Likes', how: 'Entre todos: cada 12 likes brota un Brote (bloquea el paso)', free: true },
  { what: 'Comentar cualquier cosa', how: 'Un Brote (cada 8 s por persona)', free: true },
  { what: 'Escribir «lanza», «hielo» o «raíz»', how: 'Lanzabrotes, Flor Glacial o Raíz Sanadora (cada 18 s)', free: true },
  { what: 'Escribir «tronco» u «hongo»', how: 'Tronco Guardián u Hongo Volátil (cada 45 s)', free: true },
  { what: 'Seguir', how: 'Flor Glacial: frena al Rey', free: true },
  { what: 'Compartir', how: 'Raíz Sanadora: cura las defensas cercanas', free: true },
  { what: 'Regalo de 1–4 monedas', how: 'Un Lanzabrotes por unidad (hasta 5)' },
  { what: '5–19 monedas', how: 'Tronco Guardián (muro muy resistente)' },
  { what: '20–98 monedas', how: '3 Hongos Volátiles (minas)' },
  { what: '99–198 monedas', how: 'Batería: 5 Lanzabrotes de golpe' },
  { what: '199–498 monedas', how: 'Esporas del mareo: controles al revés 5 s + 2 hongos' },
  { what: '499–999 monedas', how: 'Tormenta de semillas sobre el Rey' },
  { what: '1000 o más', how: 'Guardián Ancestral (árbol gigante) + Tormenta' },
]

export function LastHousePanel() {
  const url = `${location.origin}/juego/lasthouse`
  return (
    <div className="space-y-5 px-8">
      <div className="card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-700/40 via-fuchsia-600/20 to-emerald-500/20" />
        <div className="relative p-6">
          <div className="text-xs font-bold tracking-widest text-violet-300 uppercase">Juego propio · fuera de Minecraft · en desarrollo (fase 1)</div>
          <h2 className="mt-1 text-3xl font-black tracking-tight">LAST HOUSE: Invasión</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/80">
            Tú eres el <b>Rey de la Horda</b> y corres por el jardín hasta la puerta de la última casa. Tus espectadores son los <b>Guardianes</b>: con likes, comentarios, follows, compartidos y regalos plantan defensas en tu camino. Ganas si
            completas 5 asaltos en 5 minutos. No necesita Minecraft: se abre en una ventana y la capturas en TikTok LIVE Studio u OBS.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a className="btn btn-accent" href={url} target="_blank" rel="noreferrer">
              <Play size={15} /> Abrir el juego
            </a>
            <a className="btn" href={`${url}?demo=1`} target="_blank" rel="noreferrer" title="Se juega solo, con espectadores simulados">
              <FlaskConical size={15} /> Ver demostración
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="card p-5">
          <div className="mb-1 font-bold">Qué hace cada espectador</div>
          <div className="mb-3 text-xs text-muted">Todo el mundo puede jugar gratis; los regalos dan efectos más grandes, pero no compran la victoria. Pruébalo con la pestaña Simulador con el juego abierto.</div>
          <div className="divide-y divide-line/60 text-sm">
            {ACTIONS.map((a) => (
              <div key={a.what} className="flex items-center justify-between gap-4 py-1.5">
                <span className="min-w-0">
                  {a.what} {a.free && <span className="ml-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">GRATIS</span>}
                </span>
                <span className="shrink-0 text-right text-xs text-muted">{a.how}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <div className="card p-5 text-sm">
            <div className="mb-2 font-bold">Controles</div>
            <div className="space-y-1 text-muted">
              <div><b className="text-white">W A S D</b> moverte · <b className="text-white">Espacio / clic</b> zarpazo</div>
              <div><b className="text-white">Shift</b> embestida (rompe defensas)</div>
              <div><b className="text-white">E</b> rugido (aturde) · <b className="text-white">Q</b> esbirros</div>
              <div><b className="text-white">C</b> cámara de acción / táctica</div>
            </div>
          </div>
          <div className="card p-5">
            <div className="mb-1 font-bold">Enlace para capturar</div>
            <div className="flex gap-2">
              <input className="input min-w-0 flex-1 font-mono text-xs" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
              <a className="btn" href={url} target="_blank" rel="noreferrer">
                <ExternalLink size={14} />
              </a>
            </div>
            <p className="mt-2 text-xs text-muted">Ábrelo en una ventana, juega ahí con el teclado y captura esa ventana en tu programa de directo.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
