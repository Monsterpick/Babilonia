import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertTriangle, Upload, FolderOpen, Play, Square, Send, Loader2, Package } from 'lucide-react'
import { useApp } from '../App'
import { api, upload } from '../lib/api'
import { useLiveState, useOnLog } from '../lib/live'
import { Check, Field, PageHeader, Seg } from '../components/ui'
import { toast } from '../components/Toast'

interface JavaInfo {
  java: { path: string; major: number; version: string } | null
  required: number
  all: { path: string; major: number; version: string }[]
}

export function ServerPage() {
  const { state, reload } = useApp()
  const mc = useLiveState<any>('minecraft')
  const cfg = state!.config.minecraft
  const [tab, setTab] = useState<'crear' | 'existente' | 'manual'>(cfg.server.folder ? 'existente' : 'crear')

  return (
    <div className="pb-10">
      <PageHeader title="Servidor" subtitle="Tu servidor de Minecraft: créalo, enciéndelo y deja que el live lo controle." />
      <div className="grid gap-4 px-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <PlayerCard />
          <div className="card p-5">
            <div className="mb-4 w-full max-w-lg">
              <Seg
                value={tab}
                onChange={setTab}
                options={[
                  { v: 'crear', l: 'Crear servidor nuevo' },
                  { v: 'existente', l: 'Usar uno que ya tengo' },
                  { v: 'manual', l: 'Conexión manual' },
                ]}
              />
            </div>
            {tab === 'crear' && <CreateWizard onDone={reload} />}
            {tab === 'existente' && <AdoptFolder current={cfg.server.folder} onDone={reload} />}
            {tab === 'manual' && <ManualConnection cfg={cfg} onDone={reload} />}
          </div>
        </div>
        <div className="space-y-4">
          <StatusCard mc={mc} />
          <Console />
        </div>
      </div>
    </div>
  )
}

function PlayerCard() {
  const { state, reload } = useApp()
  const [player, setPlayer] = useState(state!.config.minecraft.player)
  const [version, setVersion] = useState(state!.config.minecraft.version)
  const save = async () => {
    try {
      await api('PUT', '/api/config', { player, mcVersion: version })
      await reload()
      toast('Guardado')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }
  return (
    <div className="card flex flex-wrap items-end gap-4 p-5">
      <Field label="Tu nick de Minecraft" hint="El jugador al que le llegan los mobs, items y efectos.">
        <input className="input w-56" value={player} maxLength={16} onChange={(e) => setPlayer(e.target.value)} placeholder="Steve" />
      </Field>
      <Field label="Versión de Minecraft" hint="Tus plugins usan 1.20.1.">
        <select className="input w-40" value={version} onChange={(e) => setVersion(e.target.value)}>
          {['1.20.1', '1.20.4', '1.20.6', '1.21.1', '1.21.4', '1.21.8'].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </Field>
      <button className="btn-accent" onClick={save}>
        Guardar
      </button>
    </div>
  )
}

function CreateWizard({ onDone }: { onDone: () => Promise<void> }) {
  const { state } = useApp()
  const mc = useLiveState<any>('minecraft')
  const creating = mc?.server?.creating as { step: string; pct?: number; message: string } | null
  const [java, setJava] = useState<JavaInfo | null>(null)
  const [plugins, setPlugins] = useState<{ file: string; name: string; size: number }[]>([])
  const [folderCheck, setFolderCheck] = useState<{ ok: boolean; message: string } | null>(null)
  const isWin = navigator.userAgent.includes('Windows')
  const [o, setO] = useState({
    folder: isWin ? 'C:\\Users\\TuUsuario\\Documents\\LiveArena\\servidor-1' : '',
    software: 'paper' as 'paper' | 'vanilla',
    mcVersion: state!.config.minecraft.version as string,
    name: 'Servidor LiveArena',
    gamemode: 'survival' as 'survival' | 'creative' | 'adventure',
    difficulty: 'normal' as 'peaceful' | 'easy' | 'normal' | 'hard',
    levelType: 'normal' as 'normal' | 'flat' | 'large_biomes' | 'amplified',
    seed: '',
    maxPlayers: 10,
    ramGB: 3,
    plugins: [] as string[],
    onlineMode: true,
    eulaAccepted: false,
    autoStart: true,
    op: true,
  })
  const set = (p: Partial<typeof o>) => setO((x) => ({ ...x, ...p }))

  const loadPlugins = () => api('GET', '/api/minecraft/plugins').then(setPlugins).catch(() => undefined)
  useEffect(() => {
    api<JavaInfo>('GET', '/api/minecraft/java').then(setJava).catch(() => undefined)
    void loadPlugins()
  }, [])
  useEffect(() => {
    if (!o.folder) return setFolderCheck(null)
    const t = setTimeout(() => api('POST', '/api/minecraft/server/validate', { folder: o.folder }).then(setFolderCheck).catch(() => undefined), 400)
    return () => clearTimeout(t)
  }, [o.folder])

  const busy = !!creating && creating.step !== 'done' && creating.step !== 'error'
  const player = state!.config.minecraft.player

  const create = async () => {
    try {
      await api('POST', '/api/minecraft/server/create', {
        ...o,
        seed: o.seed || undefined,
        opPlayer: o.op && player ? player : undefined,
      })
      toast('Creando servidor…', 'info')
      await onDone()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="label">1 · Modo</span>
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ['survival', 'Supervivencia', 'Vidas, hambre y mobs. Los regalos te ayudan o te complican.'],
              ['creative', 'Creativo', 'Sin morir: ideal para construir mientras el chat te lanza cosas.'],
              ['adventure', 'Aventura', 'No se pueden romper bloques: mapas y retos.'],
            ] as const
          ).map(([v, t, d]) => (
            <button key={v} onClick={() => set({ gamemode: v })} className={`rounded-xl border p-3 text-left transition ${o.gamemode === v ? 'border-accent bg-accent/10' : 'border-line hover:border-white/20'}`}>
              <div className="font-semibold">{t}</div>
              <div className="text-xs text-muted">{d}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line p-4">
          <span className="label">2 · Carpeta</span>
          <input className="input font-mono text-xs" value={o.folder} onChange={(e) => set({ folder: e.target.value })} placeholder="Ruta completa de una carpeta nueva o vacía" />
          {folderCheck && <p className={`mt-1 text-xs ${folderCheck.ok ? 'text-ok' : 'text-warn'}`}>{folderCheck.message}</p>}
          <p className="mt-1 text-xs text-muted">Ahí quedan el mundo, los plugins y un iniciar.bat por si lo quieres abrir a mano.</p>
        </div>
        <div className="rounded-xl border border-line p-4">
          <span className="label">3 · Java</span>
          {!java ? (
            <Loader2 size={16} className="animate-spin text-muted" />
          ) : java.java ? (
            <p className="flex items-center gap-2 text-sm text-ok">
              <CheckCircle2 size={16} /> Java {java.java.major} instalado.
            </p>
          ) : (
            <div className="text-sm">
              <p className="flex items-center gap-2 text-warn">
                <AlertTriangle size={16} /> Necesitas Java {java.required} o más nuevo.
              </p>
              <a className="text-accent underline" href={`https://adoptium.net/es/temurin/releases/?version=${java.required === 17 ? 21 : java.required}`} target="_blank" rel="noreferrer">
                Descargar Java (Adoptium)
              </a>
              <span className="text-muted"> e instálalo; luego vuelve a esta pestaña.</span>
            </div>
          )}
          <p className="mt-1 text-xs text-muted">Minecraft {o.mcVersion} necesita Java {java?.required ?? 17} o más nuevo.</p>
        </div>
      </div>

      <div className="rounded-xl border border-line p-4">
        <span className="label">4 · Opciones</span>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Nombre del servidor">
            <input className="input" value={o.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Software">
            <Seg
              value={o.software}
              onChange={(v) => set({ software: v })}
              options={[
                { v: 'paper', l: 'Paper (plugins)' },
                { v: 'vanilla', l: 'Vanilla' },
              ]}
            />
          </Field>
          <Field label="Versión">
            <select className="input" value={o.mcVersion} onChange={(e) => set({ mcVersion: e.target.value })}>
              {['1.20.1', '1.20.4', '1.20.6', '1.21.1', '1.21.4', '1.21.8'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Dificultad">
            <Seg
              value={o.difficulty}
              onChange={(v) => set({ difficulty: v })}
              options={[
                { v: 'peaceful', l: 'Pacífica' },
                { v: 'easy', l: 'Fácil' },
                { v: 'normal', l: 'Normal' },
                { v: 'hard', l: 'Difícil' },
              ]}
            />
          </Field>
          <Field label="Mundo">
            <Seg
              value={o.levelType}
              onChange={(v) => set({ levelType: v })}
              options={[
                { v: 'normal', l: 'Normal' },
                { v: 'flat', l: 'Plano' },
                { v: 'amplified', l: 'Amplificado' },
              ]}
            />
          </Field>
          <Field label="Jugadores máximos">
            <input type="number" min={1} className="input" value={o.maxPlayers} onChange={(e) => set({ maxPlayers: Math.max(1, Number(e.target.value)) })} />
          </Field>
          <Field label="Semilla (opcional)">
            <input className="input" value={o.seed} placeholder="al azar" onChange={(e) => set({ seed: e.target.value })} />
          </Field>
          <Field label={`Memoria RAM: ${o.ramGB} GB`} hint="Con 2–4 GB va bien para jugar y hacer el live.">
            <input type="range" min={1} max={16} value={o.ramGB} onChange={(e) => set({ ramGB: Number(e.target.value) })} className="w-full accent-[var(--color-accent)]" />
          </Field>
          <div className="pt-5">
            <Check on={o.onlineMode} onChange={(v) => set({ onlineMode: v })}>
              Solo cuentas premium (online-mode)
            </Check>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line p-4">
        <div className="mb-2 flex items-center">
          <span className="label mr-auto mb-0">5 · Plugins</span>
          <label className="btn cursor-pointer">
            <Upload size={14} /> Añadir .jar
            <input
              type="file"
              accept=".jar"
              multiple
              className="hidden"
              onChange={async (e) => {
                for (const f of Array.from(e.target.files ?? [])) {
                  try {
                    await upload('/api/minecraft/plugins/upload', f)
                  } catch (err) {
                    toast((err as Error).message, 'error')
                  }
                }
                await loadPlugins()
              }}
            />
          </label>
          {plugins.length > 0 && (
            <button className="btn ml-2" onClick={() => set({ plugins: o.plugins.length === plugins.length ? [] : plugins.map((p) => p.file) })}>
              Todos / ninguno
            </button>
          )}
        </div>
        {plugins.length === 0 ? (
          <p className="text-sm text-muted">
            Aún no hay plugins en tu biblioteca. Sube aquí tus .jar (MiniLive, etc.) y marca los que quieras instalar. {o.software === 'vanilla' && 'Los plugins necesitan Paper.'}
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {plugins.map((p) => (
              <label key={p.file} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-[var(--color-accent)]"
                  checked={o.plugins.includes(p.file)}
                  onChange={(e) => set({ plugins: e.target.checked ? [...o.plugins, p.file] : o.plugins.filter((x) => x !== p.file) })}
                />
                <Package size={14} className="text-muted" />
                <span className="truncate">{p.name}</span>
                <span className="ml-auto text-xs text-muted">{(p.size / 1024).toFixed(0)} KB</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line p-4">
        <span className="label">6 · Crear</span>
        <div className="space-y-2">
          <Check on={o.eulaAccepted} onChange={(v) => set({ eulaAccepted: v })}>
            Acepto el{' '}
            <a href="https://aka.ms/MinecraftEULA" target="_blank" rel="noreferrer" className="text-accent underline">
              EULA de Minecraft
            </a>{' '}
            (obligatorio para tener un servidor)
          </Check>
          <Check on={o.autoStart} onChange={(v) => set({ autoStart: v })}>
            Al terminar, encenderlo y conectar LiveArena
          </Check>
          <Check on={o.op} onChange={(v) => set({ op: v })}>
            Hacer administrador (OP) a <b>{player || '(configura tu nick arriba)'}</b>: así puedes usar /gamemode, /tp…
          </Check>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className="btn-accent" disabled={!o.eulaAccepted || busy || !folderCheck?.ok || (o.plugins.length > 0 && o.software !== 'paper')} onClick={create}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} Crear servidor
          </button>
          {!o.eulaAccepted && <span className="text-xs text-muted">Acepta el EULA de Minecraft.</span>}
        </div>
        {creating && (
          <div className="mt-4">
            <div className={`text-sm ${creating.step === 'error' ? 'text-bad' : creating.step === 'done' ? 'text-ok' : ''}`}>{creating.message}</div>
            {creating.pct !== undefined && creating.step !== 'error' && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-accent transition-all" style={{ width: `${creating.pct}%` }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AdoptFolder({ current, onDone }: { current: string; onDone: () => Promise<void> }) {
  const [folder, setFolder] = useState(current)
  const [busy, setBusy] = useState(false)
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Elige la carpeta de un servidor que ya tengas (la que contiene <code>server.properties</code>). LiveArena activa RCON con una contraseña segura y guarda la conexión.
      </p>
      <div className="flex gap-2">
        <input className="input font-mono text-xs" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="C:\\Users\\Tu\\Desktop\\MiServidor" />
        <button
          className="btn-accent shrink-0"
          disabled={busy || folder.length < 3}
          onClick={async () => {
            setBusy(true)
            try {
              const r = await api<{ restartNeeded: boolean }>('POST', '/api/minecraft/server/adopt', { folder })
              toast(r.restartNeeded ? 'RCON activado. Reinicia el servidor para aplicarlo.' : 'Servidor listo.')
              await onDone()
            } catch (e) {
              toast((e as Error).message, 'error')
            } finally {
              setBusy(false)
            }
          }}
        >
          <FolderOpen size={15} /> Usar esta carpeta
        </button>
      </div>
    </div>
  )
}

function ManualConnection({ cfg, onDone }: { cfg: any; onDone: () => Promise<void> }) {
  const [f, setF] = useState({ mcHost: cfg.host, mcPort: cfg.port, mcPassword: cfg.password })
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Para servidores en otra máquina o hosting. En server.properties: enable-rcon=true, rcon.port y rcon.password.</p>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Dirección">
          <input className="input" value={f.mcHost} onChange={(e) => setF({ ...f, mcHost: e.target.value })} />
        </Field>
        <Field label="Puerto RCON">
          <input type="number" className="input" value={f.mcPort} onChange={(e) => setF({ ...f, mcPort: Number(e.target.value) })} />
        </Field>
        <Field label="Contraseña RCON">
          <input type="password" className="input" value={f.mcPassword} onChange={(e) => setF({ ...f, mcPassword: e.target.value })} />
        </Field>
      </div>
      <button
        className="btn-accent"
        onClick={async () => {
          try {
            await api('PUT', '/api/config', f)
            await api('POST', '/api/minecraft/connect')
            await onDone()
          } catch (e) {
            toast((e as Error).message, 'error')
          }
        }}
      >
        Guardar y conectar
      </button>
    </div>
  )
}

function StatusCard({ mc }: { mc: any }) {
  const link = mc?.link
  const proc = mc?.server?.state ?? 'stopped'
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="card p-5">
      <span className="label">Estado</span>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">RCON</span>
          <b className={link?.state === 'connected' ? 'text-ok' : link?.state === 'error' ? 'text-bad' : ''}>{link?.state ?? '—'}</b>
        </div>
        {link?.message && <div className="text-xs text-muted">{link.message}</div>}
        <div className="flex justify-between">
          <span className="text-muted">Comandos en cola</span>
          <b>{link?.queue?.pending ?? 0}</b>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Enviados</span>
          <b>{link?.queue?.processed ?? 0}</b>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Servidor local</span>
          <b>{proc}</b>
        </div>
        {mc?.server?.folder && <div className="truncate font-mono text-xs text-muted" title={mc.server.folder}>{mc.server.folder}</div>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {mc?.server?.folder && (proc === 'running' || proc === 'starting' ? (
          <button className="btn" disabled={busy} onClick={() => run(() => api('POST', '/api/minecraft/server/stop'))}>
            <Square size={14} /> Apagar servidor
          </button>
        ) : (
          <button className="btn-accent" disabled={busy} onClick={() => run(() => api('POST', '/api/minecraft/server/start'))}>
            <Play size={14} /> Encender servidor
          </button>
        ))}
        {link?.state === 'connected' ? (
          <>
            <button className="btn" onClick={() => run(() => api('POST', '/api/minecraft/disconnect'))}>
              Desconectar RCON
            </button>
            <button className="btn" onClick={() => run(() => api('POST', '/api/queue/clear').then((r: any) => toast(`Cola vaciada (${r.minecraft} comandos)`)))}>
              Vaciar cola
            </button>
          </>
        ) : (
          <button className="btn" disabled={busy} onClick={() => run(() => api('POST', '/api/minecraft/connect'))}>
            Conectar RCON
          </button>
        )}
      </div>
    </div>
  )
}

function Console() {
  const [lines, setLines] = useState<{ ts: number; msg: string; scope: string; level: string }[]>([])
  const [cmd, setCmd] = useState('')
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    api<string[]>('GET', '/api/minecraft/server/logs')
      .then((l) => setLines(l.map((msg) => ({ ts: 0, msg, scope: 'consola', level: 'info' }))))
      .catch(() => undefined)
  }, [])
  useOnLog((l) => {
    if (l.scope === 'consola' || l.scope === 'minecraft' || l.scope === 'servidor') setLines((x) => [...x.slice(-400), l])
  })
  useEffect(() => {
    box.current?.scrollTo(0, box.current.scrollHeight)
  }, [lines])
  const send = async () => {
    if (!cmd.trim()) return
    const c = cmd.trim().replace(/^\//, '')
    setCmd('')
    setLines((x) => [...x, { ts: Date.now(), msg: `> ${c}`, scope: 'yo', level: 'info' }])
    try {
      const r = await api<{ response: string }>('POST', '/api/minecraft/command', { command: c })
      setLines((x) => [...x, { ts: Date.now(), msg: r.response || '(sin respuesta)', scope: 'rcon', level: 'info' }])
    } catch (e) {
      setLines((x) => [...x, { ts: Date.now(), msg: (e as Error).message, scope: 'rcon', level: 'error' }])
    }
  }
  return (
    <div className="card flex h-[480px] flex-col p-4">
      <span className="label">Consola</span>
      <div ref={box} className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-black/50 p-3 font-mono text-[11px] leading-relaxed">
        {lines.map((l, i) => (
          <div key={i} className={l.level === 'error' ? 'text-bad' : l.level === 'warn' ? 'text-warn' : l.scope === 'yo' ? 'text-accent' : 'text-white/80'}>
            {l.msg}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input className="input font-mono text-xs" placeholder="Comando (sin /) por RCON, ej: time set day" value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="btn" onClick={send}>
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
