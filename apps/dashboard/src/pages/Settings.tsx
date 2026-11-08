import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useApp } from '../App'
import { api } from '../lib/api'
import { Check, Field, PageHeader } from '../components/ui'
import { toast } from '../components/Toast'

export function SettingsPage() {
  const { state, reload } = useApp()
  const c = state!.config
  const [f, setF] = useState({
    tiktokUsername: c.tiktok.username,
    signApiKey: c.tiktok.signApiKey,
    tiktokAutoConnect: c.tiktok.autoConnect,
    mcAutoConnect: c.minecraft.autoConnect,
    commandsPerSecond: c.minecraft.commandsPerSecond,
    maxLiveMobs: c.minecraft.maxLiveMobs,
    watchPlayer: c.minecraft.watchPlayer,
    stopOnExit: c.minecraft.server.stopOnExit,
    likeGoal: c.likeGoal.target,
    likeGoalLabel: c.likeGoal.label,
    onDeath: c.scoreboard.onDeath,
  })
  const save = async () => {
    try {
      await api('PUT', '/api/config', f)
      await reload()
      toast('Ajustes guardados')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  return (
    <div className="pb-10">
      <PageHeader title="Ajustes">
        <button className="btn-accent" onClick={save}>
          Guardar
        </button>
      </PageHeader>
      <div className="grid gap-4 px-6 lg:grid-cols-2">
        <div className="card space-y-3 p-5">
          <span className="label">TikTok LIVE</span>
          <Field label="Usuario">
            <input className="input" value={f.tiktokUsername} onChange={(e) => setF({ ...f, tiktokUsername: e.target.value })} placeholder="@tuusuario" />
          </Field>
          <Field
            label="API key de Euler Stream (opcional)"
            hint={c.tiktok.hasEnvKey ? 'Se está usando la clave de EULER_API_KEY del archivo .env.' : 'Sin clave el límite gratuito es bajo. Consíguela en eulerstream.com. Se guarda solo en tu PC.'}
          >
            <input type="password" className="input" value={f.signApiKey} onChange={(e) => setF({ ...f, signApiKey: e.target.value })} placeholder="euler_…" />
          </Field>
          <Check on={f.tiktokAutoConnect} onChange={(v) => setF({ ...f, tiktokAutoConnect: v })}>
            Conectar el live al abrir la app
          </Check>
          <div className="flex gap-2 rounded-lg bg-warn/10 p-3 text-xs text-warn">
            <ShieldAlert size={16} className="shrink-0" />
            La conexión usa una API no oficial (tiktok-live-connector). Solo lee tu live; nunca publica nada con tu cuenta. Puede dejar de funcionar si TikTok cambia su sistema.
          </div>
        </div>
        <div className="card space-y-3 p-5">
          <span className="label">Minecraft</span>
          <Check on={f.mcAutoConnect} onChange={(v) => setF({ ...f, mcAutoConnect: v })}>
            Conectar RCON al abrir la app
          </Check>
          <Check on={f.watchPlayer} onChange={(v) => setF({ ...f, watchPlayer: v })}>
            Vigilar al jugador (muertes, reaparición, kit al reaparecer)
          </Check>
          <Check on={f.stopOnExit} onChange={(v) => setF({ ...f, stopOnExit: v })}>
            Apagar el servidor local al cerrar la app
          </Check>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Comandos por segundo" hint="20 es seguro para casi todos los servidores.">
              <input type="number" min={1} max={100} className="input" value={f.commandsPerSecond} onChange={(e) => setF({ ...f, commandsPerSecond: Number(e.target.value) })} />
            </Field>
            <Field label="Máx. mobs vivos" hint="0 = sin límite. Evita que el servidor se arrastre.">
              <input type="number" min={0} className="input" value={f.maxLiveMobs} onChange={(e) => setF({ ...f, maxLiveMobs: Number(e.target.value) })} />
            </Field>
          </div>
        </div>
        <div className="card space-y-3 p-5">
          <span className="label">Marcador al morir</span>
          <Check on={f.onDeath.loseLife} onChange={(v) => setF({ ...f, onDeath: { ...f.onDeath, loseLife: v } })}>
            Restar una vida
          </Check>
          <Check on={f.onDeath.addLoss} onChange={(v) => setF({ ...f, onDeath: { ...f.onDeath, addLoss: v } })}>
            Sumar una derrota
          </Check>
          <Check on={f.onDeath.resetTimer} onChange={(v) => setF({ ...f, onDeath: { ...f.onDeath, resetTimer: v } })}>
            Reiniciar el cronómetro
          </Check>
        </div>
        <div className="card space-y-3 p-5">
          <span className="label">Meta de likes (overlay)</span>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Meta">
              <input type="number" className="input" value={f.likeGoal} onChange={(e) => setF({ ...f, likeGoal: Number(e.target.value) })} />
            </Field>
            <Field label="Texto">
              <input className="input" value={f.likeGoalLabel} onChange={(e) => setF({ ...f, likeGoalLabel: e.target.value })} />
            </Field>
          </div>
        </div>
      </div>
    </div>
  )
}
