import { EventEmitter } from 'node:events'
import { PriorityWorker } from '@livearena/core'
import { RconClient, RconError } from './rcon.js'

export type LinkState = 'disconnected' | 'connecting' | 'connected' | 'backoff' | 'error'

export interface LinkStatus {
  state: LinkState
  host: string
  port: number
  message?: string
  retryInMs?: number
  queue: { pending: number; processed: number; dropped: number; failed: number }
}

export interface LinkOptions {
  host: string
  port: number
  password: string
  /** Comandos por segundo (Minecraft aguanta bien ~20). */
  perSecond?: number
  burst?: number
  maxQueue?: number
  autoReconnect?: boolean
}

interface QueuedCommand {
  command: string
  resolve: (r: string) => void
  reject: (e: Error) => void
}

/**
 * Conexión gestionada al servidor de Minecraft:
 *  - reconexión con backoff exponencial (1 s → 30 s) si el servidor se cae o reinicia,
 *  - cola con prioridad + rate limit (un regalo grande adelanta a 200 rosas),
 *  - mientras está desconectado, los comandos esperan en la cola (no se pierden) hasta maxQueue.
 *
 * Eventos: 'status' (LinkStatus), 'command' ({command, response, ms}), 'error' ({command, error}).
 */
export class MinecraftLink extends EventEmitter {
  private client: RconClient | null = null
  private state: LinkState = 'disconnected'
  private message = ''
  private attempts = 0
  private retryTimer: NodeJS.Timeout | null = null
  private retryInMs = 0
  private wanted = false
  private readonly worker: PriorityWorker<QueuedCommand>
  private opts: Required<LinkOptions>

  constructor(opts: LinkOptions) {
    super()
    this.opts = { perSecond: 20, burst: 40, maxQueue: 3000, autoReconnect: true, ...opts }
    this.worker = new PriorityWorker<QueuedCommand>(
      async (q) => {
        const t0 = Date.now()
        try {
          const response = await this.client!.send(q.command)
          this.emit('command', { command: q.command, response, ms: Date.now() - t0 })
          q.resolve(response)
        } catch (err) {
          this.emit('cmdError', { command: q.command, error: (err as Error).message })
          q.reject(err as Error)
          if (err instanceof RconError && err.code === 'closed') this.onLost()
        }
      },
      {
        maxSize: this.opts.maxQueue,
        perSecond: this.opts.perSecond,
        burst: this.opts.burst,
        onDrop: (q) => q.reject(new Error('Cola de Minecraft llena: comando descartado')),
      },
    )
    this.worker.pause()
  }

  configure(opts: Partial<LinkOptions>): void {
    this.opts = { ...this.opts, ...opts }
  }

  status(): LinkStatus {
    const s = this.worker.stats()
    return {
      state: this.state,
      host: this.opts.host,
      port: this.opts.port,
      message: this.message || undefined,
      retryInMs: this.state === 'backoff' ? this.retryInMs : undefined,
      queue: { pending: s.pending, processed: s.processed, dropped: s.dropped, failed: s.failed },
    }
  }

  get isConnected(): boolean {
    return this.state === 'connected'
  }

  async connect(): Promise<void> {
    this.wanted = true
    this.attempts = 0
    await this.open()
  }

  disconnect(): void {
    this.wanted = false
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    this.worker.pause()
    this.client?.close()
    this.client = null
    this.setState('disconnected', '')
  }

  /** Encola un comando. priority alta = antes. */
  enqueue(command: string, priority = 0): Promise<string> {
    return new Promise((resolve, reject) => this.worker.push({ command, resolve, reject }, priority))
  }

  /** Ejecuta YA (sin cola), p. ej. para consultas de estado. Requiere estar conectado. */
  async sendNow(command: string): Promise<string> {
    if (!this.client || !this.isConnected) throw new Error('Minecraft no está conectado')
    return this.client.send(command)
  }

  clearQueue(): number {
    return this.worker.clear()
  }

  private async open(): Promise<void> {
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.client?.close()
    this.setState('connecting', `Conectando a ${this.opts.host}:${this.opts.port}…`)
    const c = new RconClient({ host: this.opts.host, port: this.opts.port, password: this.opts.password })
    try {
      await c.connect()
    } catch (err) {
      const e = err as RconError
      this.client = null
      if (e.code === 'auth') {
        // Contraseña mala: reintentar no sirve.
        this.wanted = false
        this.setState('error', e.message)
        throw e
      }
      this.scheduleRetry(e.message)
      throw e
    }
    c.on('close', () => this.onLost())
    c.on('error', () => undefined)
    this.client = c
    this.attempts = 0
    this.setState('connected', '')
    this.worker.resume()
  }

  private onLost(): void {
    if (this.state !== 'connected') return
    this.worker.pause()
    this.client = null
    if (this.wanted && this.opts.autoReconnect) this.scheduleRetry('Se perdió la conexión con el servidor')
    else this.setState('disconnected', 'Conexión cerrada')
  }

  private scheduleRetry(reason: string): void {
    if (!this.wanted || !this.opts.autoReconnect) {
      this.setState('error', reason)
      return
    }
    this.retryInMs = Math.min(30_000, 1000 * 2 ** this.attempts) + Math.floor(Math.random() * 300)
    this.attempts += 1
    this.setState('backoff', `${reason}. Reintento en ${Math.ceil(this.retryInMs / 1000)} s`)
    this.retryTimer = setTimeout(() => {
      this.open().catch(() => undefined)
    }, this.retryInMs)
  }

  private setState(state: LinkState, message: string): void {
    this.state = state
    this.message = message
    this.emit('status', this.status())
  }
}
