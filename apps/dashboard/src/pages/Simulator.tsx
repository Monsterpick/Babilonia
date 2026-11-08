import { useState } from 'react'
import { Heart, MessageSquare, Share2, UserPlus, Zap, Star, LogIn } from 'lucide-react'
import { api } from '../lib/api'
import { useApp } from '../App'
import { GiftPicker } from '../components/GiftPicker'
import { Field, PageHeader } from '../components/ui'
import { toast } from '../components/Toast'

/** Simulador: dispara regalos, likes, comentarios y ráfagas falsas sin estar en vivo. */
export function SimulatorPage() {
  const { profile } = useApp()
  const [user, setUser] = useState('')
  const [count, setCount] = useState(1)
  const [likes, setLikes] = useState(10)
  const [text, setText] = useState('!rojo')
  const [burst, setBurst] = useState({ events: 200, seconds: 3 })
  const sim = (body: object) => api('POST', '/api/simulate', { user: user || undefined, ...body }).catch((e) => toast(e.message, 'error'))
  const used = new Set(profile?.events.flatMap((e) => (e.trigger.type === 'gift' ? e.trigger.gifts.map((g) => g.name) : [])) ?? [])

  return (
    <div className="pb-10">
      <PageHeader title="Simulador" subtitle="Prueba todo antes de salir en vivo. Los eventos falsos pasan por las mismas reglas que los reales." />
      <div className="grid gap-4 px-6 xl:grid-cols-[1fr_380px]">
        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <Field label="Espectador (vacío = al azar)">
              <input className="input w-52" value={user} onChange={(e) => setUser(e.target.value)} placeholder="Nombre" />
            </Field>
            <Field label="Cantidad (racha)">
              <input type="number" min={1} max={5000} className="input w-28" value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value)))} />
            </Field>
            <div className="flex gap-1">
              {[1, 5, 10, 50, 99].map((n) => (
                <button key={n} className={`btn px-2.5 ${count === n ? 'border-accent' : ''}`} onClick={() => setCount(n)}>
                  ×{n}
                </button>
              ))}
            </div>
          </div>
          <span className="label">Haz clic en un regalo para enviarlo (los que tienen comando están marcados)</span>
          <GiftPicker selected={[...used]} onPick={(g) => sim({ type: 'gift', name: g.name, count })} />
        </div>
        <div className="space-y-4">
          <div className="card space-y-3 p-5">
            <span className="label">Interacciones</span>
            <div className="flex gap-2">
              <input type="number" className="input w-24" value={likes} onChange={(e) => setLikes(Math.max(1, Number(e.target.value)))} />
              <button className="btn flex-1 justify-center" onClick={() => sim({ type: 'like', count: likes })}>
                <Heart size={15} className="text-pink-400" /> Enviar likes
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn justify-center" onClick={() => sim({ type: 'follow' })}>
                <UserPlus size={15} /> Seguir
              </button>
              <button className="btn justify-center" onClick={() => sim({ type: 'share' })}>
                <Share2 size={15} /> Compartir
              </button>
              <button className="btn justify-center" onClick={() => sim({ type: 'subscribe' })}>
                <Star size={15} /> Suscripción
              </button>
              <button className="btn justify-center" onClick={() => sim({ type: 'join' })}>
                <LogIn size={15} /> Entra
              </button>
            </div>
            <div className="flex gap-2">
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sim({ type: 'chat', text })} />
              <button className="btn" onClick={() => sim({ type: 'chat', text })}>
                <MessageSquare size={15} />
              </button>
            </div>
          </div>
          <div className="card space-y-3 p-5">
            <span className="label">Ráfaga (prueba de carga)</span>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Eventos">
                <input type="number" className="input" value={burst.events} onChange={(e) => setBurst({ ...burst, events: Math.max(1, Number(e.target.value)) })} />
              </Field>
              <Field label="En segundos">
                <input type="number" className="input" value={burst.seconds} onChange={(e) => setBurst({ ...burst, seconds: Math.max(0, Number(e.target.value)) })} />
              </Field>
            </div>
            <button className="btn-accent w-full justify-center" onClick={() => sim({ type: 'burst', ...burst })}>
              <Zap size={15} /> Lanzar ráfaga
            </button>
            <p className="text-xs text-muted">Mezcla de likes, regalos, comentarios, follows y shares de espectadores al azar. Útil para ver que el servidor y los overlays aguantan.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
