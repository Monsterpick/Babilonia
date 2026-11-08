import { useState } from 'react'
import { useLiveState } from '../lib/live'

interface TexState {
  state: 'none' | 'importing' | 'ready' | 'error'
  version?: string
}

/** Textura del item sacada de tu Minecraft instalado; si no hay, muestra el nombre. */
export function ItemIcon({ id, size = 40, label = true }: { id: string; size?: number; label?: boolean }) {
  const tex = useLiveState<TexState>('textures')
  const [failed, setFailed] = useState<string | null>(null)
  const name = id.replace(/^minecraft:/, '')
  const ready = tex?.state === 'ready'
  if (!ready || failed === `${name}@${tex?.version}`) {
    return label ? <span className="line-clamp-2 px-1 text-[10px] leading-tight capitalize">{name.replace(/_/g, ' ')}</span> : null
  }
  return (
    <img
      src={`/textures/${name}.png?v=${tex?.version ?? ''}`}
      alt={name}
      width={size}
      height={size}
      draggable={false}
      style={{ imageRendering: 'pixelated', width: size, height: size, objectFit: 'contain' }}
      onError={() => setFailed(`${name}@${tex?.version}`)}
    />
  )
}

/** Aviso/estado de las texturas con botones para importarlas (automático o eligiendo el .jar). */
export function TexturesBar() {
  const tex = useLiveState<TexState & { count?: number; pct?: number; message?: string }>('textures')
  const [busy, setBusy] = useState(false)
  const imp = async (jar?: string) => {
    setBusy(true)
    try {
      const { api } = await import('../lib/api')
      await api('POST', '/api/textures/import', jar ? { jar } : {})
    } catch (e) {
      const { toast } = await import('./Toast')
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }
  const pick = async () => {
    const { desktop } = await import('../lib/desktop')
    const f = await desktop?.pickFile({ title: 'Elige el .jar de tu Minecraft (.minecraft/versions/<versión>/<versión>.jar)', extensions: ['jar'] })
    if (f) await imp(f)
  }
  if (tex?.state === 'ready')
    return (
      <p className="text-xs text-muted">
        Texturas de Minecraft {tex.version} ({tex.count} imágenes).{' '}
        <button className="underline hover:text-white" onClick={pick}>
          Cambiar
        </button>
      </p>
    )
  return (
    <div className="card flex flex-wrap items-center gap-3 border-amber-500/40 p-4 text-sm">
      <span className="mr-auto">
        {tex?.state === 'importing'
          ? `Extrayendo texturas de Minecraft ${tex.version ?? ''}… ${tex.pct ?? 0}%`
          : tex?.message ?? 'Los objetos se ven sin textura. Las saco de tu Minecraft instalado (no vienen con la app).'}
      </span>
      <button className="btn-accent" disabled={busy || tex?.state === 'importing'} onClick={() => imp()}>
        Buscar mi Minecraft
      </button>
      <button className="btn" disabled={busy || tex?.state === 'importing'} onClick={pick}>
        Elegir .jar
      </button>
    </div>
  )
}
