import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Loader2, RefreshCw, X } from 'lucide-react'
import { desktop } from '../lib/desktop'

/**
 * Aviso de actualización (solo en la app de escritorio). La app busca versiones nuevas en GitHub al abrirse y cada
 * 30 minutos; la versión instalada la descarga sola y aquí se ofrece reiniciar para aplicarla.
 */
type UpdateState =
  | { state: 'checking' | 'none' }
  | { state: 'available'; version: string; portable: boolean; url: string }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }

export function UpdateBanner() {
  const [st, setSt] = useState<UpdateState | null>(null)
  const [hidden, setHidden] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!desktop?.onUpdate) return
    void desktop.updateGet?.().then((s) => setSt(s as UpdateState))
    return desktop.onUpdate((s) => setSt(s as UpdateState))
  }, [])
  if (!st || (st.state !== 'available' && st.state !== 'downloading' && st.state !== 'ready')) return null
  if (hidden === `${st.state}:${st.version}`) return null
  const ready = st.state === 'ready'
  return createPortal(
    <div className="fx-in fixed right-5 bottom-5 z-[60] w-[360px] rounded-2xl border border-accent/40 bg-[#14121f]/95 p-4 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-hot text-white">
          {st.state === 'downloading' ? <Loader2 size={20} className="animate-spin" /> : ready ? <RefreshCw size={20} /> : <Download size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold">{ready ? 'Actualización lista' : st.state === 'downloading' ? 'Descargando actualización…' : 'Hay una versión nueva'}</div>
          <div className="text-xs text-muted">
            LiveArena {st.version}
            {ready ? ' · se instala en unos segundos y la app se vuelve a abrir. Tus datos no se tocan.' : st.state === 'downloading' ? ` · ${st.percent} %` : ' · la versión portable no se actualiza sola: descárgala y sustituye el .exe.'}
          </div>
          {st.state === 'downloading' && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-gradient-to-r from-accent to-hot transition-all" style={{ width: `${st.percent}%` }} />
            </div>
          )}
          {ready && (
            <button
              className="btn-accent mt-3 w-full"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                void desktop?.updateInstall?.()
              }}
            >
              <RefreshCw size={14} /> Reiniciar y actualizar
            </button>
          )}
          {st.state === 'available' && (
            <a className="btn-accent mt-3 w-full" href={st.url} target="_blank" rel="noreferrer">
              <Download size={14} /> Descargar la nueva versión
            </a>
          )}
        </div>
        {st.state !== 'downloading' && (
          <button className="text-muted hover:text-white" title="Más tarde" onClick={() => setHidden(`${st.state}:${st.version}`)}>
            <X size={16} />
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
