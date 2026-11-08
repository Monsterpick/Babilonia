import net from 'node:net'
import { EventEmitter } from 'node:events'

/**
 * Cliente RCON de Minecraft (protocolo Source RCON).
 * Paquete: [len int32LE][id int32LE][type int32LE][body][0x00][0x00]
 * Minecraft procesa un comando cada vez: este cliente serializa los envíos (1 en vuelo).
 * Respuestas de más de 4096 bytes llegan troceadas: se acumulan mientras el trozo sea de 4096.
 */
const TYPE_AUTH = 3
const TYPE_EXEC = 2
const TYPE_RESPONSE = 0
const MAX_CHUNK = 4096

export class RconError extends Error {
  constructor(
    message: string,
    readonly code: 'auth' | 'timeout' | 'closed' | 'connect' | 'too-long',
  ) {
    super(message)
  }
}

interface Pending {
  id: number
  resolve: (body: string) => void
  reject: (err: Error) => void
  chunks: string[]
  timer: NodeJS.Timeout
}

export interface RconOptions {
  host: string
  port: number
  password: string
  timeoutMs?: number
}

export class RconClient extends EventEmitter {
  private socket: net.Socket | null = null
  private buffer = Buffer.alloc(0)
  private nextId = 1
  private pending: Pending | null = null
  private chain: Promise<unknown> = Promise.resolve()
  private authed = false

  constructor(private readonly opts: RconOptions) {
    super()
  }

  get connected(): boolean {
    return this.authed && !!this.socket && !this.socket.destroyed
  }

  async connect(): Promise<void> {
    const { host, port, password } = this.opts
    const timeoutMs = this.opts.timeoutMs ?? 5000
    await new Promise<void>((resolve, reject) => {
      const s = net.createConnection({ host, port })
      const t = setTimeout(() => {
        s.destroy()
        reject(new RconError(`No responde ${host}:${port}`, 'timeout'))
      }, timeoutMs)
      s.once('connect', () => {
        clearTimeout(t)
        resolve()
      })
      s.once('error', (err) => {
        clearTimeout(t)
        reject(new RconError(`No se pudo conectar a ${host}:${port} (${(err as NodeJS.ErrnoException).code ?? err.message})`, 'connect'))
      })
      this.socket = s
    })
    const s = this.socket!
    s.setNoDelay(true)
    s.on('data', (d: Buffer) => this.onData(d))
    s.on('close', () => this.onClose())
    s.on('error', (err) => this.emit('error', err))

    const id = this.nextId++
    const res = await this.request(id, TYPE_AUTH, password, timeoutMs, true)
    if (res === 'AUTH_FAIL') {
      this.close()
      throw new RconError('Contraseña RCON incorrecta', 'auth')
    }
    this.authed = true
  }

  /** Ejecuta un comando (sin "/" inicial) y devuelve la respuesta del servidor. */
  send(command: string): Promise<string> {
    const cmd = command.replace(/^\//, '').replace(/[\r\n]+/g, ' ')
    if (Buffer.byteLength(cmd, 'utf8') > 1446 * 22) return Promise.reject(new RconError('Comando demasiado largo', 'too-long'))
    const run = () => {
      if (!this.connected) return Promise.reject(new RconError('RCON desconectado', 'closed'))
      return this.request(this.nextId++, TYPE_EXEC, cmd, this.opts.timeoutMs ?? 5000)
    }
    const p = this.chain.then(run, run)
    this.chain = p.catch(() => undefined)
    return p
  }

  close(): void {
    this.authed = false
    this.socket?.destroy()
    this.socket = null
  }

  private request(id: number, type: number, body: string, timeoutMs: number, isAuth = false): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null
        reject(new RconError('El servidor no respondió a tiempo', 'timeout'))
      }, timeoutMs)
      this.pending = { id: isAuth ? -id : id, resolve, reject, chunks: [], timer }
      this.socket!.write(encode(id, type, body))
    })
  }

  private onData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data])
    while (this.buffer.length >= 4) {
      const len = this.buffer.readInt32LE(0)
      if (this.buffer.length < len + 4) return
      const id = this.buffer.readInt32LE(4)
      const type = this.buffer.readInt32LE(8)
      const body = this.buffer.toString('utf8', 12, 4 + len - 2)
      this.buffer = this.buffer.subarray(len + 4)
      this.onPacket(id, type, body)
    }
  }

  private onPacket(id: number, type: number, body: string): void {
    const p = this.pending
    if (!p) return
    if (p.id < 0) {
      // Respuesta de autenticación: type 2 con id = petición (ok) o -1 (fallo). Puede venir antes un type 0 vacío.
      if (type === TYPE_RESPONSE) return
      clearTimeout(p.timer)
      this.pending = null
      p.resolve(id === -1 ? 'AUTH_FAIL' : 'OK')
      return
    }
    if (id !== p.id) return
    p.chunks.push(body)
    if (Buffer.byteLength(body, 'utf8') >= MAX_CHUNK) return // vienen más trozos
    clearTimeout(p.timer)
    this.pending = null
    p.resolve(p.chunks.join(''))
  }

  private onClose(): void {
    const wasAuthed = this.authed
    this.authed = false
    this.socket = null
    if (this.pending) {
      clearTimeout(this.pending.timer)
      this.pending.reject(new RconError('Conexión RCON cerrada', 'closed'))
      this.pending = null
    }
    if (wasAuthed) this.emit('close')
  }
}

export function encode(id: number, type: number, body: string): Buffer {
  const b = Buffer.from(body, 'utf8')
  const buf = Buffer.alloc(14 + b.length)
  buf.writeInt32LE(10 + b.length, 0)
  buf.writeInt32LE(id, 4)
  buf.writeInt32LE(type, 8)
  b.copy(buf, 12)
  return buf
}
