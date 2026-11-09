import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle, Box, CheckCircle2, ChevronDown, ChevronRight, Folder, FolderOpen, Loader2, MessageSquare, Package, Play, Puzzle,
  Send, Settings2, SlidersHorizontal, Square, SquareTerminal, Trash2, Upload, Wifi,
} from 'lucide-react'
import { useApp } from '../App'
import { api, upload } from '../lib/api'
import { desktop } from '../lib/desktop'
import { useLiveState, useOnLog } from '../lib/live'
import { Check, Field, Modal, PageHeader, Seg, Toggle } from '../components/ui'
import { toast } from '../components/Toast'
import { askConfirm } from '../components/Dialog'

type ModalId = 'install' | 'settings' | 'terminal' | 'plugins' | 'rules' | 'chat' | 'properties' | 'adopt' | null

const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await fn()
  } catch (e) {
    toast((e as Error).message, 'error')
    return undefined
  }
}

/** Versión de Minecraft para la que está hecho el plugin LiveArena (tótems, cinemáticas) y el mod. */
export const LIVEARENA_MC = '26.1.2'

/** Aviso si el servidor no es de la versión del plugin LiveArena: Paper no lo cargaría. */
export function VersionWarning({ onInstall }: { onInstall?: () => void }) {
  const { state } = useApp()
  const mc = useLiveState<any>('minecraft')
  const v = state?.config.minecraft.version
  if (!mc?.server?.folder || !v || v === LIVEARENA_MC) return null
  return (
    <div className="card flex items-start gap-3 border-warn/40 bg-warn/10 p-4 text-sm">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" />
      <div className="min-w-0 flex-1">
        <div className="font-bold text-warn">Tu servidor es Paper {v}, pero LiveArena necesita Paper {LIVEARENA_MC}</div>
        <div className="mt-0.5 text-muted">
          Con {v} el plugin LiveArena no se carga: no hay tótems apilables ni cinemáticas, y el mod no puede conectarse. Instala un servidor nuevo con Paper {LIVEARENA_MC} en otra carpeta (el viejo queda intacto).
        </div>
      </div>
      {onInstall && (
        <button className="btn btn-primary shrink-0" onClick={onInstall}>
          Instalar Paper {LIVEARENA_MC}
        </button>
      )}
    </div>
  )
}

export function ServerPage() {
  const mc = useLiveState<any>('minecraft')
  const [modal, setModal] = useState<ModalId>(null)
  const hasServer = !!mc?.server?.folder

  return (
    <div className="pb-10">
      <PageHeader title="Servidor" subtitle="Tu servidor de Minecraft: créalo, enciéndelo y deja que el live lo controle." />
      <div className="grid gap-4 px-8 xl:grid-cols-[440px_1fr]">
        <div className="space-y-4">
          <ServerCard mc={mc} hasServer={hasServer} open={setModal} />
          <PlayerCard />
        </div>
        <div className="space-y-4">
          <VersionWarning onInstall={() => setModal('install')} />
          {!hasServer && (
            <div className="card p-6">
              <h2 className="text-lg font-bold">Aún no tienes servidor</h2>
              <p className="mt-1 text-sm text-muted">
                Créalo en un minuto: descargo Paper (y Java si falta), configuro RCON y lo dejo listo para entrar. O usa uno que ya tengas.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-accent" onClick={() => setModal('install')}>
                  <Box size={15} /> Instalar servidor de Minecraft
                </button>
                <button className="btn" onClick={() => setModal('adopt')}>
                  <FolderOpen size={15} /> Usar uno que ya tengo
                </button>
              </div>
            </div>
          )}
          <Console />
        </div>
      </div>

      {modal === 'install' && <InstallModal onClose={() => setModal(null)} />}
      {modal === 'adopt' && <AdoptModal onClose={() => setModal(null)} />}
      {modal === 'settings' && <SettingsModal onClose={() => setModal(null)} open={setModal} />}
      {modal === 'properties' && <PropertiesModal onClose={() => setModal('settings')} />}
      {modal === 'terminal' && (
        <Modal open onClose={() => setModal(null)} title="Terminal" wide>
          <Console tall />
        </Modal>
      )}
      {modal === 'plugins' && <PluginsModal onClose={() => setModal(null)} />}
      {modal === 'rules' && <RulesModal onClose={() => setModal(null)} />}
      {modal === 'chat' && <ChatModal onClose={() => setModal(null)} />}
    </div>
  )
}

const STATE_TXT: Record<string, [string, string]> = {
  stopped: ['Apagado', 'bg-white/30'],
  starting: ['Arrancando…', 'bg-warn'],
  running: ['Encendido', 'bg-ok'],
  stopping: ['Apagando…', 'bg-warn'],
  crashed: ['Se cayó', 'bg-bad'],
}

function ServerCard({ mc, hasServer, open }: { mc: any; hasServer: boolean; open: (m: ModalId) => void }) {
  const [busy, setBusy] = useState(false)
  const proc = mc?.server?.state ?? 'stopped'
  const link = mc?.link?.state ?? 'disconnected'
  const on = proc === 'running' || proc === 'starting'
  const [txt, dot] = STATE_TXT[proc] ?? STATE_TXT.stopped!
  const go = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    await run(fn)
    setBusy(false)
  }
  const Btn = ({ icon, label, m, disabled }: { icon: ReactNode; label: string; m: ModalId; disabled?: boolean }) => (
    <button className="btn justify-start py-2.5" disabled={disabled} onClick={() => open(m)}>
      {icon} <span className="truncate">{label}</span>
    </button>
  )
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-b from-[#6aa84f] to-[#5b3a1e] text-2xl">⛏</div>
        <div className="min-w-0 flex-1">
          <div className="font-bold">Servidor de Minecraft local</div>
          <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-xs">
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {hasServer ? txt : 'Sin servidor'}
          </span>
        </div>
      </div>
      {hasServer && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-md bg-white/5 px-2 py-1">
            Versión <b>{mc?.version}</b>
          </span>
          <span className="rounded-md bg-white/5 px-2 py-1" title="Desde este PC entra con localhost. Otros en tu red: esta IP.">
            IP <b>{mc?.server?.ip ?? '127.0.0.1'}</b>
            {mc?.server?.port && mc.server.port !== 25565 ? `:${mc.server.port}` : ''}
          </span>
          <span className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1" title={mc?.link?.message}>
            <Wifi size={11} className={link === 'connected' ? 'text-ok' : 'text-muted'} /> RCON {link === 'connected' ? 'vinculado' : link === 'backoff' ? 'reintentando' : 'sin vincular'}
          </span>
        </div>
      )}
      {hasServer ? (
        on ? (
          <button
            disabled={busy || proc === 'stopping'}
            onClick={() => go(() => api('POST', '/api/minecraft/server/stop'))}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-bad to-hot py-3.5 text-lg font-bold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? <Loader2 className="animate-spin" /> : <Square size={20} />} Apagar servidor
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={() => go(() => api('POST', '/api/minecraft/server/start'))}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-ok py-3.5 text-lg font-bold text-[#04130c] shadow-[0_10px_30px_-10px_var(--color-ok)] transition hover:bg-green-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="animate-spin" /> : <Play size={20} />} Encender servidor
          </button>
        )
      ) : (
        <button onClick={() => open('install')} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-ok py-3.5 text-lg font-bold text-[#04130c] shadow-[0_10px_30px_-10px_var(--color-ok)] hover:bg-green-500">
          <Box size={20} /> Instalar servidor
        </button>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Btn icon={<SlidersHorizontal size={15} />} label="Ajustes del servidor" m="settings" disabled={!hasServer} />
        <Btn icon={<SquareTerminal size={15} />} label="Terminal" m="terminal" />
        <Btn icon={<Puzzle size={15} />} label="Plugins" m="plugins" disabled={!hasServer} />
        <button className="btn justify-start py-2.5" disabled={!hasServer} onClick={() => run(() => api('POST', '/api/system/open', { target: 'server' }))}>
          <Folder size={15} /> Abrir carpeta
        </button>
        <Btn icon={<Settings2 size={15} />} label="Reglas del juego" m="rules" disabled={link !== 'connected'} />
        <Btn icon={<MessageSquare size={15} />} label="Chat del juego" m="chat" />
      </div>
      <div className="mt-3 flex flex-wrap gap-3 border-t border-line pt-3 text-xs">
        <button className="text-accent hover:underline" onClick={() => open('install')}>
          Instalar servidor nuevo
        </button>
        <button className="text-muted hover:text-white" onClick={() => open('adopt')}>
          Usar otra carpeta / conexión manual
        </button>
        {link !== 'connected' && hasServer && (
          <button className="ml-auto text-muted hover:text-white" onClick={() => run(() => api('POST', '/api/minecraft/connect'))}>
            Conectar RCON
          </button>
        )}
      </div>
    </div>
  )
}

function PlayerCard() {
  const { state, reload } = useApp()
  const [player, setPlayer] = useState(state!.config.minecraft.player)
  return (
    <div className="card space-y-3 p-5">
      <Field label="Tu nick de Minecraft" hint="El jugador al que le llegan los mobs, items y efectos ({player} / {nick}).">
        <div className="flex gap-2">
          <input className="input" value={player} maxLength={16} onChange={(e) => setPlayer(e.target.value)} placeholder="Steve" />
          <button
            className="btn-accent"
            onClick={() =>
              run(async () => {
                await api('PUT', '/api/config', { player })
                await reload()
                toast('Guardado')
              })
            }
          >
            Guardar
          </button>
        </div>
      </Field>
      <p className="text-xs text-muted">
        Para entrar: Minecraft Java → Multijugador → Añadir servidor → <b className="text-white">localhost</b>
      </p>
    </div>
  )
}

/* --------------------------------- Instalar --------------------------------- */

interface JavaInfo {
  java: { path: string; major: number; version: string } | null
  required: number
}

function InstallModal({ onClose }: { onClose: () => void }) {
  const { state, reload } = useApp()
  const mc = useLiveState<any>('minecraft')
  const creating = mc?.server?.creating as { step: string; pct?: number; message: string } | null
  const [versions, setVersions] = useState<string[]>([])
  const [java, setJava] = useState<JavaInfo | null>(null)
  const [library, setLibrary] = useState<{ file: string; name: string; size: number }[]>([])
  const [more, setMore] = useState(false)
  const [folderCheck, setFolderCheck] = useState<{ ok: boolean; message: string } | null>(null)
  const player = state!.config.minecraft.player
  const isWin = navigator.userAgent.includes('Windows')
  const [o, setO] = useState({
    folder: isWin ? 'C:\\minecraft-server' : '',
    software: 'paper' as 'paper' | 'vanilla',
    mcVersion: LIVEARENA_MC,
    name: 'Servidor LiveArena',
    gamemode: 'survival' as 'survival' | 'creative' | 'adventure',
    difficulty: 'normal' as 'peaceful' | 'easy' | 'normal' | 'hard',
    levelType: 'normal' as 'normal' | 'flat' | 'large_biomes' | 'amplified',
    seed: '',
    maxPlayers: 10,
    xmxMB: 4096,
    xmsMB: 2048,
    onlineMode: false,
    eulaAccepted: false,
    autoStart: true,
    op: true,
    installJava: true,
    viaVersion: true,
    plugins: [] as string[],
  })
  const set = (p: Partial<typeof o>) => setO((x) => ({ ...x, ...p }))
  const loadLib = () => api('GET', '/api/minecraft/plugins').then(setLibrary).catch(() => undefined)

  useEffect(() => {
    api<string[]>('GET', '/api/minecraft/versions').then(setVersions).catch(() => setVersions([LIVEARENA_MC]))
    void loadLib()
  }, [])
  useEffect(() => {
    api<JavaInfo>('GET', `/api/minecraft/java/check?version=${encodeURIComponent(o.mcVersion)}`).then(setJava).catch(() => undefined)
  }, [o.mcVersion])
  useEffect(() => {
    if (!o.folder) return setFolderCheck(null)
    const t = setTimeout(() => api('POST', '/api/minecraft/server/validate', { folder: o.folder }).then(setFolderCheck).catch(() => undefined), 300)
    return () => clearTimeout(t)
  }, [o.folder])

  const busy = !!creating && !['done', 'error'].includes(creating.step)
  const list = versions.length ? versions : [LIVEARENA_MC]
  const newest = list[0]
  const javaOk = !!java?.java
  return (
    <Modal open onClose={onClose} title="Instalar servidor de Minecraft">
      <div className="space-y-4">
        <div className="rounded-lg bg-white/5 p-2.5 text-xs">
          {java === null ? (
            <Loader2 size={14} className="animate-spin" />
          ) : javaOk ? (
            <span className="flex items-center gap-2 text-ok">
              <CheckCircle2 size={14} /> Java instalado: {java.java!.version} · Necesario: Java {java.required}+
            </span>
          ) : (
            <span className="flex items-center gap-2 text-warn">
              <AlertTriangle size={14} /> Falta Java {java.required}+ {o.installJava ? '· lo instalo yo automáticamente' : ''}
            </span>
          )}
        </div>

        <Field label="Servidor">
          <select
            className="input"
            value={`${o.software}|${o.mcVersion}`}
            onChange={(e) => {
              const [software, mcVersion] = e.target.value.split('|') as ['paper' | 'vanilla', string]
              set({ software, mcVersion })
            }}
          >
            {list.map((v) => (
              <option key={v} value={`paper|${v}`}>
                PaperMC ({v}){v === LIVEARENA_MC ? ' · Recomendado: plugin LiveArena, tótems y cinemáticas' : v === '1.20.1' ? ' · solo plugins viejos (sin LiveArena ni cinemáticas)' : v === newest ? ' · el más nuevo (sin cinemáticas)' : ''}
              </option>
            ))}
            {list.slice(0, 6).map((v) => (
              <option key={`v${v}`} value={`vanilla|${v}`}>
                Vanilla ({v}) · sin plugins
              </option>
            ))}
          </select>
        </Field>

        <Field label="Carpeta (obligatoria)">
          <div className="flex gap-2">
            <input className="input font-mono text-xs" value={o.folder} onChange={(e) => set({ folder: e.target.value })} placeholder="Carpeta nueva o vacía" />
            {desktop && (
              <button
                className="btn shrink-0 bg-amber-500 text-black hover:bg-amber-400"
                onClick={async () => {
                  const f = await desktop!.pickFolder('Carpeta para el servidor')
                  if (f) set({ folder: f })
                }}
              >
                Cambiar carpeta
              </button>
            )}
          </div>
          {folderCheck && <p className={`mt-1 text-xs ${folderCheck.ok ? 'text-ok' : 'text-warn'}`}>{folderCheck.message}</p>}
        </Field>

        <div className="space-y-2">
          <Check on={o.op} onChange={(v) => set({ op: v })}>
            Dar OP (admin) a <b>{player || 'tu nick'}</b> {!player && <span className="text-warn">(configura tu nick primero)</span>}
          </Check>
          <Check on={o.installJava} onChange={(v) => set({ installJava: v })}>
            Instalar Java {java?.required ?? ''} si falta (necesario para el servidor)
          </Check>
          {o.software === 'paper' && (
            <Check on={o.viaVersion} onChange={(v) => set({ viaVersion: v })}>
              Instalar el plugin <b>ViaVersion</b> (deja entrar con versiones más nuevas de Minecraft)
            </Check>
          )}
          <Check on={o.autoStart} onChange={(v) => set({ autoStart: v })}>
            Al terminar, encenderlo y conectar LiveArena
          </Check>
          <Check on={o.eulaAccepted} onChange={(v) => set({ eulaAccepted: v })}>
            Acepto el{' '}
            <a className="text-accent underline" href="https://aka.ms/MinecraftEULA" target="_blank" rel="noreferrer">
              EULA de Minecraft
            </a>{' '}
            <span className="text-bad">(obligatorio)</span>
          </Check>
        </div>

        {o.software === 'paper' && (
          <div className="rounded-xl border border-line p-3">
            <div className="mb-2 flex items-center">
              <span className="mr-auto text-sm font-semibold">Plugins a instalar</span>
              <label className="btn cursor-pointer py-1 text-xs">
                <Upload size={13} /> Añadir .jar
                <input
                  type="file"
                  accept=".jar"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    for (const f of Array.from(e.target.files ?? [])) await run(() => upload('/api/minecraft/plugins/upload', f))
                    await loadLib()
                  }}
                />
              </label>
              {library.length > 0 && (
                <button className="btn ml-2 py-1 text-xs" onClick={() => set({ plugins: o.plugins.length === library.length ? [] : library.map((p) => p.file) })}>
                  Todos / ninguno
                </button>
              )}
            </div>
            {library.length === 0 ? (
              <p className="text-xs text-muted">Sube tus .jar (s2e-survival, MiniLive…). Quedan en tu biblioteca para próximos servidores.</p>
            ) : (
              <div className="grid max-h-40 gap-1.5 overflow-y-auto sm:grid-cols-2">
                {library.map((p) => (
                  <label key={p.file} className="flex cursor-pointer items-center gap-2 rounded-md bg-bg px-2 py-1.5 text-xs">
                    <input
                      type="checkbox"
                      className="accent-[var(--color-accent)]"
                      checked={o.plugins.includes(p.file)}
                      onChange={(e) => set({ plugins: e.target.checked ? [...o.plugins, p.file] : o.plugins.filter((x) => x !== p.file) })}
                    />
                    <Package size={12} className="text-muted" /> <span className="truncate">{p.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <button className="flex items-center gap-1 text-sm text-muted hover:text-white" onClick={() => setMore(!more)}>
          {more ? <ChevronDown size={15} /> : <ChevronRight size={15} />} Más opciones (modo, dificultad, mundo, RAM…)
        </button>
        {more && (
          <div className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2">
            <Field label="Nombre (MOTD)">
              <input className="input" value={o.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Modo">
              <Seg value={o.gamemode} onChange={(v) => set({ gamemode: v })} options={[{ v: 'survival', l: 'Superviv.' }, { v: 'creative', l: 'Creativo' }, { v: 'adventure', l: 'Aventura' }]} />
            </Field>
            <Field label="Dificultad">
              <Seg value={o.difficulty} onChange={(v) => set({ difficulty: v })} options={[{ v: 'peaceful', l: 'Pacíf.' }, { v: 'easy', l: 'Fácil' }, { v: 'normal', l: 'Normal' }, { v: 'hard', l: 'Difícil' }]} />
            </Field>
            <Field label="Mundo">
              <Seg value={o.levelType} onChange={(v) => set({ levelType: v })} options={[{ v: 'normal', l: 'Normal' }, { v: 'flat', l: 'Plano' }, { v: 'amplified', l: 'Amplif.' }]} />
            </Field>
            <Field label="Semilla">
              <input className="input" value={o.seed} placeholder="al azar" onChange={(e) => set({ seed: e.target.value })} />
            </Field>
            <Field label="Jugadores máx.">
              <input type="number" className="input" value={o.maxPlayers} onChange={(e) => set({ maxPlayers: Math.max(1, Number(e.target.value)) })} />
            </Field>
            <RamField label="RAM máxima (Xmx)" value={o.xmxMB} onChange={(v) => set({ xmxMB: v, xmsMB: Math.min(o.xmsMB, v) })} />
            <RamField label="RAM mínima (Xms)" value={o.xmsMB} onChange={(v) => set({ xmsMB: Math.min(v, o.xmxMB) })} />
            <Check on={o.onlineMode} onChange={(v) => set({ onlineMode: v })}>
              Online mode (solo cuentas originales)
            </Check>
          </div>
        )}

        {creating && (
          <div>
            <div className={`text-sm ${creating.step === 'error' ? 'text-bad' : creating.step === 'done' ? 'text-ok' : ''}`}>{creating.message}</div>
            {creating.pct !== undefined && creating.step !== 'error' && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-gradient-to-r from-accent via-hot to-coral transition-all" style={{ width: `${creating.pct}%` }} />
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button className="btn" onClick={onClose}>
            Cerrar
          </button>
          <button
            className="btn-accent from-emerald-500 via-emerald-400 to-ok text-[#04130c]"
            disabled={!o.eulaAccepted || busy || !folderCheck?.ok || (!javaOk && !o.installJava)}
            onClick={() =>
              run(async () => {
                await api('POST', '/api/minecraft/server/create', { ...o, seed: o.seed || undefined, opPlayer: o.op && player ? player : undefined })
                toast('Instalando servidor…', 'info')
                await reload()
              })
            }
          >
            {busy && <Loader2 size={15} className="animate-spin" />} Instalar servidor de Minecraft
          </button>
        </div>
      </div>
    </Modal>
  )
}

const RAM_PRESETS = [1024, 2048, 4096, 6144, 8192, 10240]
function RamField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Field label={`${label}: ${value.toLocaleString()} MB`}>
      <input type="number" step={256} className="input" value={value} onChange={(e) => onChange(Math.max(256, Number(e.target.value) || 0))} />
      <div className="mt-1.5 flex flex-wrap gap-1">
        {RAM_PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => onChange(p)} className={`rounded px-1.5 py-0.5 text-[11px] ${value === p ? 'bg-sky-500 text-white' : 'bg-sky-500/15 text-sky-300'}`}>
            {p / 1024}GB
          </button>
        ))}
      </div>
    </Field>
  )
}

/* ---------------------------------- Ajustes ---------------------------------- */

interface Settings {
  folder: string
  jar: string
  jars: string[]
  java: string
  xmxMB: number
  xmsMB: number
  levelName: string
  onlineMode: boolean
  livearenaPlugin: boolean
  motd: string
  maxPlayers: number
  difficulty: string
  pvp: boolean
}

function SettingsModal({ onClose, open }: { onClose: () => void; open: (m: ModalId) => void }) {
  const [s, setS] = useState<Settings | null>(null)
  useEffect(() => {
    void run(() => api<Settings>('GET', '/api/minecraft/server/settings').then(setS))
  }, [])
  if (!s) return null
  const set = (p: Partial<Settings>) => setS({ ...s, ...p })
  const save = (start = false) =>
    run(async () => {
      const { folder: _f, jars: _j, ...body } = s
      await api('PUT', '/api/minecraft/server/settings', body)
      toast(start ? 'Guardado. Encendiendo…' : 'Ajustes guardados (se aplican al reiniciar el servidor)')
      if (start) await api('POST', '/api/minecraft/server/start')
      onClose()
    })
  const sep = s.folder.includes('\\') ? '\\' : '/'
  return (
    <Modal open onClose={onClose} title="Ajustes del servidor de Minecraft">
      <div className="space-y-4">
        <Field label="Archivo del servidor (.jar)">
          <div className="rounded-lg bg-white/5 px-3 py-2 font-mono text-xs break-all">{s.jar ? (/^([A-Za-z]:|\/)/.test(s.jar) ? s.jar : `${s.folder}${sep}${s.jar}`) : '(automático)'}</div>
          <div className="mt-2 flex gap-2">
            <select className="input" value={s.jar} onChange={(e) => set({ jar: e.target.value })}>
              <option value="">Automático</option>
              {s.jars.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
              {s.jar && !s.jars.includes(s.jar) && <option value={s.jar}>{s.jar}</option>}
            </select>
            {desktop && (
              <button
                className="btn shrink-0 border-sky-500 text-sky-300"
                onClick={async () => {
                  const f = await desktop!.pickFile({ title: 'Elegir server.jar', extensions: ['jar'] })
                  if (f) set({ jar: f })
                }}
              >
                Cambiar archivo
              </button>
            )}
          </div>
        </Field>
        <Field label="Nombre del mundo (level-name)">
          <input className="input" value={s.levelName} onChange={(e) => set({ levelName: e.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <RamField label="Xmx (RAM máxima)" value={s.xmxMB} onChange={(v) => set({ xmxMB: v, xmsMB: Math.min(s.xmsMB, v) })} />
          <RamField label="Xms (RAM mínima)" value={s.xmsMB} onChange={(v) => set({ xmsMB: Math.min(v, s.xmxMB) })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="MOTD">
            <input className="input" maxLength={59} value={s.motd} onChange={(e) => set({ motd: e.target.value })} />
          </Field>
          <Field label="Jugadores máx.">
            <input type="number" className="input" value={s.maxPlayers} onChange={(e) => set({ maxPlayers: Math.max(1, Number(e.target.value)) })} />
          </Field>
          <Field label="Dificultad">
            <select className="input" value={s.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
              <option value="peaceful">Pacífica</option>
              <option value="easy">Fácil</option>
              <option value="normal">Normal</option>
              <option value="hard">Difícil</option>
            </select>
          </Field>
          <Field label="Java (vacío = automático)">
            <input className="input font-mono text-xs" value={s.java} onChange={(e) => set({ java: e.target.value })} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6">
          <Check on={s.onlineMode} onChange={(v) => set({ onlineMode: v })}>
            Online mode (<span className="text-ok">solo cuentas originales</span>)
          </Check>
          <Check on={s.pvp} onChange={(v) => set({ pvp: v })}>
            PvP
          </Check>
          <Check on={s.livearenaPlugin} onChange={(v) => set({ livearenaPlugin: v })}>
            Plugin <b>LiveArena</b> (tótems apilables): instalarlo y actualizarlo al encender
          </Check>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button className="text-xs text-sky-300 hover:underline" onClick={() => open('properties')}>
            Editar server.properties
          </button>
          <button
            className="text-xs text-bad hover:underline"
            onClick={async () => {
              if (!(await askConfirm('¿Reiniciar el mundo?\nEl mundo actual se guarda en la carpeta «mundos-anteriores» y al encender se crea uno nuevo.\nÚsalo si el servidor no arranca porque el mundo está dañado.', { danger: true }))) return
              void run(async () => {
                const r = await api<{ moved: string[] }>('POST', '/api/minecraft/server/reset-world')
                toast(r.moved.length ? 'Mundo reiniciado: al encender se crea uno nuevo' : 'No había mundo que reiniciar')
              })
            }}
          >
            Reiniciar mundo
          </button>
          <span className="mr-auto" />
          <button className="btn border-accent/50 bg-accent/15 text-white" onClick={() => open('plugins')}>
            <Puzzle size={14} /> Plugins
          </button>
          <button className="btn" onClick={() => save(false)}>
            Guardar
          </button>
          <button className="btn-accent from-emerald-500 via-emerald-400 to-ok text-[#04130c]" onClick={() => save(true)}>
            <Play size={14} /> Guardar y encender
          </button>
        </div>
      </div>
    </Modal>
  )
}

function PropertiesModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    void run(() => api<{ text: string }>('GET', '/api/minecraft/server/properties').then((r) => setText(r.text)))
  }, [])
  return (
    <Modal open onClose={onClose} title="server.properties" wide>
      {text === null ? (
        <Loader2 className="animate-spin" />
      ) : (
        <>
          <p className="mb-2 text-xs text-muted">Los cambios se aplican al reiniciar el servidor. No borres enable-rcon ni rcon.password: LiveArena los necesita.</p>
          <textarea className="input h-[55vh] font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="btn-accent"
              onClick={() =>
                run(async () => {
                  await api('PUT', '/api/minecraft/server/properties', { text })
                  toast('server.properties guardado')
                  onClose()
                })
              }
            >
              Guardar
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

/* ---------------------------------- Plugins ---------------------------------- */

function PluginsModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<{ file: string; name: string; enabled: boolean; size: number }[] | null>(null)
  const [library, setLibrary] = useState<{ file: string; name: string }[]>([])
  const load = () =>
    run(async () => {
      setList(await api('GET', '/api/minecraft/server/plugins'))
      setLibrary(await api('GET', '/api/minecraft/plugins'))
    })
  useEffect(() => {
    void load()
  }, [])
  const installed = new Set((list ?? []).map((p) => p.file.replace(/\.disabled$/, '')))
  const notInstalled = library.filter((l) => !installed.has(l.file))
  return (
    <Modal open onClose={onClose} title="Plugins del servidor" wide>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="btn-accent cursor-pointer">
          <Upload size={14} /> Subir .jar
          <input
            type="file"
            accept=".jar"
            multiple
            className="hidden"
            onChange={async (e) => {
              for (const f of Array.from(e.target.files ?? [])) await run(() => upload('/api/minecraft/server/plugins/upload', f))
              await load()
            }}
          />
        </label>
        <button className="btn" onClick={() => run(() => api('POST', '/api/system/open', { target: 'plugins' }))}>
          <Folder size={14} /> Abrir carpeta plugins
        </button>
        <span className="ml-auto text-xs text-warn">Reinicia el servidor para aplicar cambios.</span>
      </div>
      {!list ? (
        <Loader2 className="animate-spin" />
      ) : (
        <div className="space-y-1.5">
          {list.length === 0 && <p className="text-sm text-muted">No hay plugins instalados.</p>}
          {list.map((p) => (
            <div key={p.file} className="flex items-center gap-3 rounded-lg border border-line bg-bg px-3 py-2 text-sm">
              <Puzzle size={15} className={p.enabled ? 'text-accent' : 'text-muted'} />
              <span className={`mr-auto truncate ${p.enabled ? '' : 'text-muted line-through'}`}>{p.name}</span>
              <span className="text-xs text-muted">{(p.size / 1024).toFixed(0)} KB</span>
              <Toggle on={p.enabled} onChange={(v) => void run(() => api('POST', '/api/minecraft/server/plugins/toggle', { file: p.file, enabled: v }).then(setList))} />
              <button className="text-muted hover:text-bad" onClick={async () => (await askConfirm(`¿Quitar ${p.name}?`, { danger: true })) && void run(() => api('POST', '/api/minecraft/server/plugins/remove', { file: p.file }).then(setList))}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      {notInstalled.length > 0 && (
        <div className="mt-5">
          <span className="label">En tu biblioteca (sin instalar en este servidor)</span>
          <div className="flex flex-wrap gap-1.5">
            {notInstalled.map((l) => (
              <button key={l.file} className="btn py-1 text-xs" onClick={() => run(() => api('POST', '/api/minecraft/server/plugins/install', { files: [l.file] }).then(setList))}>
                + {l.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ----------------------------------- Reglas ----------------------------------- */

function RulesModal({ onClose }: { onClose: () => void }) {
  const [rules, setRules] = useState<{ id: string; label: string; type: 'bool' | 'int'; value: string | null }[] | null>(null)
  useEffect(() => {
    void run(() => api('GET', '/api/minecraft/gamerules').then(setRules)).then((r) => r === undefined && rules === null && onClose())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const setRule = (id: string, value: string) =>
    run(async () => {
      await api('POST', '/api/minecraft/gamerules', { id, value })
      setRules((rs) => rs?.map((r) => (r.id === id ? { ...r, value } : r)) ?? null)
    })
  return (
    <Modal open onClose={onClose} title="Reglas del juego">
      {!rules ? (
        <Loader2 className="animate-spin" />
      ) : (
        <div className="space-y-2">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-lg bg-bg px-3 py-2 text-sm">
              <span className="mr-auto">
                {r.label} <code className="text-[10px] text-muted">{r.id}</code>
              </span>
              {r.type === 'bool' ? (
                <Toggle on={r.value === 'true'} onChange={(v) => void setRule(r.id, String(v))} />
              ) : (
                <input type="number" className="input w-24" defaultValue={r.value ?? ''} onBlur={(e) => void setRule(r.id, e.target.value)} />
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

/* ------------------------------------ Chat ------------------------------------ */

function ChatModal({ onClose }: { onClose: () => void }) {
  const { state, reload } = useApp()
  const c = state!.config.chat ?? { announce: true, prefix: 'LIVE', showGift: true }
  const [f, setF] = useState({ chatAnnounce: c.announce as boolean, chatPrefix: c.prefix as string, chatShowGift: c.showGift as boolean })
  return (
    <Modal open onClose={onClose} title="Chat del juego">
      <div className="space-y-3">
        <Check on={f.chatAnnounce} onChange={(v) => setF({ ...f, chatAnnounce: v })}>
          Anunciar en el chat de Minecraft cada vez que un espectador activa algo
        </Check>
        <Check on={f.chatShowGift} onChange={(v) => setF({ ...f, chatShowGift: v })}>
          Incluir el regalo y la cantidad
        </Check>
        <Field label="Prefijo">
          <input className="input w-40" maxLength={20} value={f.chatPrefix} onChange={(e) => setF({ ...f, chatPrefix: e.target.value })} />
        </Field>
        <div className="rounded-lg bg-black/60 p-3 font-mono text-sm">
          <span className="font-bold text-fuchsia-400">[{f.chatPrefix || 'LIVE'}] </span>
          <span className="text-yellow-300">Lucía</span> <span className="text-gray-400">→</span> <span className="font-bold text-cyan-300">TRUENO</span>
          {f.chatShowGift && <span className="text-amber-400"> (Rose ×5)</span>}
        </div>
        <div className="flex justify-end">
          <button
            className="btn-accent"
            onClick={() =>
              run(async () => {
                await api('PUT', '/api/config', f)
                await reload()
                toast('Guardado')
                onClose()
              })
            }
          >
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------ Usar existente ------------------------------ */

function AdoptModal({ onClose }: { onClose: () => void }) {
  const { state, reload } = useApp()
  const cfg = state!.config.minecraft
  const [folder, setFolder] = useState<string>(cfg.server.folder)
  const [m, setM] = useState({ mcHost: cfg.host as string, mcPort: cfg.port as number, mcPassword: cfg.password as string })
  return (
    <Modal open onClose={onClose} title="Usar un servidor que ya tengo">
      <div className="space-y-5">
        <div>
          <span className="label">Carpeta del servidor (la que tiene server.properties)</span>
          <div className="flex gap-2">
            <input className="input font-mono text-xs" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="C:\minecraft-server" />
            {desktop && (
              <button
                className="btn shrink-0"
                onClick={async () => {
                  const f = await desktop!.pickFolder('Carpeta del servidor')
                  if (f) setFolder(f)
                }}
              >
                <FolderOpen size={14} /> Elegir
              </button>
            )}
          </div>
          <button
            className="btn-accent mt-2"
            disabled={folder.length < 3}
            onClick={() =>
              run(async () => {
                const r = await api<{ restartNeeded: boolean }>('POST', '/api/minecraft/server/adopt', { folder })
                toast(r.restartNeeded ? 'RCON activado. Si el servidor estaba encendido, reinícialo.' : 'Servidor listo.')
                await reload()
                onClose()
              })
            }
          >
            Usar esta carpeta
          </button>
        </div>
        <div className="border-t border-line pt-4">
          <span className="label">Conexión manual (hosting u otro PC)</span>
          <div className="grid gap-2 sm:grid-cols-3">
            <input className="input" value={m.mcHost} onChange={(e) => setM({ ...m, mcHost: e.target.value })} placeholder="Dirección" />
            <input type="number" className="input" value={m.mcPort} onChange={(e) => setM({ ...m, mcPort: Number(e.target.value) })} placeholder="Puerto RCON" />
            <input type="password" className="input" value={m.mcPassword} onChange={(e) => setM({ ...m, mcPassword: e.target.value })} placeholder="Contraseña RCON" />
          </div>
          <button
            className="btn mt-2"
            onClick={() =>
              run(async () => {
                await api('PUT', '/api/config', m)
                await api('POST', '/api/minecraft/connect')
                await reload()
                onClose()
              })
            }
          >
            Guardar y conectar
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------------------------------- Consola ---------------------------------- */

function Console({ tall }: { tall?: boolean }) {
  const [lines, setLines] = useState<{ msg: string; scope: string; level: string }[]>([])
  const [cmd, setCmd] = useState('')
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    api<string[]>('GET', '/api/minecraft/server/logs')
      .then((l) => setLines(l.map((msg) => ({ msg, scope: 'consola', level: 'info' }))))
      .catch(() => undefined)
  }, [])
  useOnLog((l) => {
    if (l.scope === 'consola' || l.scope === 'minecraft' || l.scope === 'servidor') setLines((x) => [...x.slice(-600), l])
  })
  useEffect(() => {
    box.current?.scrollTo(0, box.current.scrollHeight)
  }, [lines])
  const send = async () => {
    const c = cmd.trim().replace(/^\//, '')
    if (!c) return
    setCmd('')
    setLines((x) => [...x, { msg: `> ${c}`, scope: 'yo', level: 'info' }])
    try {
      const r = await api<{ response: string }>('POST', '/api/minecraft/command', { command: c })
      setLines((x) => [...x, { msg: r.response || '(sin respuesta)', scope: 'rcon', level: 'info' }])
    } catch (e) {
      setLines((x) => [...x, { msg: (e as Error).message, scope: 'rcon', level: 'error' }])
    }
  }
  return (
    <div className={`flex flex-col ${tall ? 'h-[65vh]' : 'card h-[560px] p-4'}`}>
      {!tall && <span className="label">Terminal</span>}
      <div ref={box} className="min-h-0 flex-1 overflow-y-auto rounded-lg bg-black/60 p-3 font-mono text-[11px] leading-relaxed">
        {lines.length === 0 && <div className="text-muted">Aquí verás la consola del servidor y las respuestas de RCON.</div>}
        {lines.map((l, i) => (
          <div key={i} className={l.level === 'error' ? 'text-bad' : l.level === 'warn' ? 'text-warn' : l.scope === 'yo' ? 'text-accent' : 'text-white/80'}>
            {l.msg}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input className="input font-mono text-xs" placeholder="Comando (sin /), ej: time set day" value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="btn" onClick={send}>
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
