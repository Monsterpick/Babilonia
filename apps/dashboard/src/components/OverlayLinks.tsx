import { Copy, ExternalLink, Globe, Loader2, MonitorPlay, Power } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useLiveState } from '../lib/live'
import { toast } from './Toast'

type Tunnel = { status: 'off' | 'downloading' | 'starting' | 'on' | 'error'; url?: string; error?: string }

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
 * Enlaces de un overlay: OBS (enlace local completo) y TikTok LIVE Studio (enlace corto con «localhost» y, si
 * LIVE Studio dice que el enlace no es compatible, un enlace público https por túnel que solo sirve overlays).
 */
export function OverlayLinks({ url, w, h }: { url: string; w: number; h: number }) {
  const [tab, setTab] = useState<'obs' | 'tiktok'>('tiktok')
  const [code, setCode] = useState('')
  const live = useLiveState<Tunnel>('tunnel')
  const [tunnel, setTunnel] = useState<Tunnel>({ status: 'off' })
  const [busy, setBusy] = useState(false)
  const u = new URL(url)
  const path = u.pathname + u.search

  useEffect(() => {
    let off = false
    api<{ code: string }>('POST', '/api/shortlinks', { path }).then((r) => !off && setCode(r.code), () => undefined)
    api<Tunnel>('GET', '/api/tunnel').then((t) => !off && setTunnel(t), () => undefined)
    return () => {
      off = true
    }
  }, [path])
  useEffect(() => {
    if (live) setTunnel(live)
  }, [live])

  const short = code ? `http://localhost:${u.port || '7420'}/o/${code}` : ''
  const pub = tunnel.status === 'on' && tunnel.url && code ? `${tunnel.url}/o/${code}` : ''

  const toggle = async () => {
    setBusy(true)
    try {
      setTunnel(await api<Tunnel>('POST', tunnel.status === 'on' ? '/api/tunnel/stop' : '/api/tunnel/start'))
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1 rounded-full border border-line bg-black/30 p-1 text-xs font-bold">
        <button className={`flex-1 rounded-full px-3 py-1.5 ${tab === 'tiktok' ? 'bg-accent text-white' : 'text-muted hover:text-white'}`} onClick={() => setTab('tiktok')}>
          TikTok LIVE Studio
        </button>
        <button className={`flex-1 rounded-full px-3 py-1.5 ${tab === 'obs' ? 'bg-accent text-white' : 'text-muted hover:text-white'}`} onClick={() => setTab('obs')}>
          <MonitorPlay size={12} className="mr-1 inline" /> OBS
        </button>
      </div>
      {tab === 'obs' ? (
        <>
          <Row url={url} primary />
          <p className="text-[11px] text-muted">
            Añade una «Fuente de navegador» de <b className="text-white">{w} × {h}</b> con este enlace. Fondo transparente: no hace falta croma.
          </p>
        </>
      ) : (
        <>
          <span className="text-[11px] font-bold text-white">1 · Enlace corto (recomendado)</span>
          <Row url={short} primary />
          <p className="text-[11px] text-muted">
            En LIVE Studio: <b className="text-white">Añadir fuente → Enlace</b>, pega el enlace y ajusta el tamaño a <b className="text-white">{w} × {h}</b>.
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="flex-1 text-[11px] font-bold text-white">2 · ¿Dice «no compatible»? Enlace público https</span>
            <button className={`btn !px-3 text-xs ${tunnel.status === 'on' ? '' : 'btn-accent'}`} disabled={busy || tunnel.status === 'downloading' || tunnel.status === 'starting'} onClick={toggle}>
              {busy || tunnel.status === 'downloading' || tunnel.status === 'starting' ? <Loader2 size={13} className="animate-spin" /> : tunnel.status === 'on' ? <Power size={13} /> : <Globe size={13} />}
              {tunnel.status === 'on' ? 'Apagar' : tunnel.status === 'downloading' ? 'Descargando…' : tunnel.status === 'starting' ? 'Conectando…' : 'Activar'}
            </button>
          </div>
          {pub && <Row url={pub} />}
          {tunnel.status === 'error' && <p className="text-[11px] text-red-300">{tunnel.error}</p>}
          <p className="text-[11px] text-muted">
            Crea una dirección <b className="text-white">https</b> segura (túnel gratuito de Cloudflare) que solo muestra overlays: nadie puede tocar tu
            panel ni tus comandos por ella. Cambia cada vez que lo activas; la primera vez descarga el programa del túnel (~30 MB).
          </p>
        </>
      )}
    </div>
  )
}
