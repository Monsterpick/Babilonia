import { Copy, ExternalLink } from 'lucide-react'
import { toast } from './Toast'

const copy = (url: string) => navigator.clipboard.writeText(url).then(() => toast('Enlace copiado'), () => toast('No se pudo copiar', 'error'))

function Row({ url, primary }: { url: string; primary?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-line bg-black/30 p-1 pl-3">
      <code className="min-w-0 flex-1 truncate text-[11px] text-[#c4b5fd]">{url || '…'}</code>
      <button className={`${primary ? 'btn-accent' : 'btn'} !px-3`} disabled={!url} onClick={() => copy(url)}>
        <Copy size={13} /> Copiar
      </button>
      <a className="btn !px-3" href={url || undefined} target="_blank" rel="noreferrer" title="Abrir">
        <ExternalLink size={13} />
      </a>
    </div>
  )
}

/**
 * Enlace de un overlay: uno solo y fijo (http://127.0.0.1:7420/<overlay>.html), el mismo para OBS y para
 * TikTok LIVE Studio. No caduca ni cambia al reiniciar la app.
 */
export function OverlayLinks({ url, w, h }: { url: string; w: number; h: number }) {
  return (
    <div className="space-y-2">
      <Row url={url} primary />
      <p className="text-[11px] text-muted">
        <b className="text-white">TikTok LIVE Studio:</b> Añadir fuente → <b className="text-white">Enlace</b>, pega el enlace y ajusta el tamaño a{' '}
        <b className="text-white">{w} × {h}</b>. <b className="text-white">OBS:</b> «Fuente de navegador» con el mismo enlace (fondo transparente).
        El enlace es fijo: no cambia aunque cierres la app.
      </p>
    </div>
  )
}
