import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'

export type ServerProcState = 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed'

export interface StartOptions {
  folder: string
  java: string
  jar: string
  ramGB: number
}

/**
 * Arranca y detiene el servidor de Minecraft como proceso hijo.
 * Eventos: 'state' (ServerProcState), 'log' (línea), 'ready'.
 */
export class ServerProcess extends EventEmitter {
  private child: ChildProcess | null = null
  private state: ServerProcState = 'stopped'
  private readonly lines: string[] = []

  get status(): { state: ServerProcState; pid?: number } {
    return { state: this.state, pid: this.child?.pid }
  }

  logs(last = 300): string[] {
    return this.lines.slice(-last)
  }

  start(o: StartOptions): void {
    if (this.child) throw new Error('El servidor ya está encendido.')
    const ram = Math.max(1, Math.round(o.ramGB))
    const args = [`-Xms${Math.min(ram, 2)}G`, `-Xmx${ram}G`, '-jar', o.jar, 'nogui']
    this.setState('starting')
    const child = spawn(o.java, args, { cwd: o.folder, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    this.child = child
    let buf = ''
    const onChunk = (d: Buffer) => {
      buf += d.toString('utf8')
      const parts = buf.split(/\r?\n/)
      buf = parts.pop() ?? ''
      for (const line of parts) this.pushLine(line)
    }
    child.stdout!.on('data', onChunk)
    child.stderr!.on('data', onChunk)
    child.on('error', (err) => {
      this.pushLine(`[LiveArena] No se pudo arrancar Java: ${err.message}`)
      this.child = null
      this.setState('crashed')
    })
    child.on('exit', (code) => {
      this.pushLine(`[LiveArena] El servidor se cerró (código ${code}).`)
      this.child = null
      this.setState(this.state === 'stopping' || code === 0 ? 'stopped' : 'crashed')
    })
  }

  /** Envía un comando por la consola del proceso (sin RCON). */
  console(command: string): void {
    this.child?.stdin?.write(`${command.replace(/[\r\n]/g, ' ')}\n`)
  }

  async stop(timeoutMs = 45_000): Promise<void> {
    const child = this.child
    if (!child) return
    this.setState('stopping')
    this.console('stop')
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        child.kill('SIGKILL')
        resolve()
      }, timeoutMs)
      child.once('exit', () => {
        clearTimeout(t)
        resolve()
      })
    })
  }

  private pushLine(line: string): void {
    this.lines.push(line)
    if (this.lines.length > 2000) this.lines.splice(0, this.lines.length - 2000)
    this.emit('log', line)
    if (this.state === 'starting' && /Done \([\d.,]+s\)!/.test(line)) {
      this.setState('running')
      this.emit('ready')
    }
    if (/You need to agree to the EULA/i.test(line)) this.pushLine('[LiveArena] Falta aceptar el EULA en eula.txt.')
    if (/UnsupportedClassVersionError|has been compiled by a more recent version/.test(line))
      this.pushLine('[LiveArena] Tu Java es demasiado antiguo para esta versión de Minecraft.')
  }

  private setState(s: ServerProcState): void {
    this.state = s
    this.emit('state', s)
  }
}
