import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocketServer, type WebSocket } from 'ws'
import {
  HelloSchema,
  PROTOCOL_VERSION,
  makeEnvelope,
  matchesSubscription,
  type ActionMessage,
  type ClientRole,
  type LiveEvent,
  type LogLine,
  type StateKey,
} from '@livearena/shared'

interface Client {
  ws: WebSocket
  role: ClientRole | null
  subs: string[]
  screen?: number
  alive: boolean
}

/**
 * Hub WebSocket (protocolo v1). Overlays, juegos y el panel se conectan aquí.
 * El primer mensaje del cliente debe ser `hello`; si no llega en 5 s se acepta como dashboard.
 */
export class Hub {
  private readonly wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 })
  private readonly clients = new Set<Client>()
  private readonly state = new Map<StateKey, unknown>()
  private readonly sessionId = Math.random().toString(36).slice(2)
  onReport: (kind: string, data: unknown) => void = () => undefined

  constructor(private readonly serverVersion: string) {
    setInterval(() => {
      for (const c of this.clients) {
        if (!c.alive) {
          c.ws.terminate()
          continue
        }
        c.alive = false
        c.ws.ping()
      }
    }, 15_000).unref()
  }

  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.wss.handleUpgrade(req, socket, head, (ws) => this.accept(ws, req))
  }

  get count(): number {
    return this.clients.size
  }

  private accept(ws: WebSocket, req: IncomingMessage): void {
    const url = new URL(req.url ?? '/', 'http://x')
    const c: Client = { ws, role: null, subs: [], alive: true }
    this.clients.add(c)
    ws.on('pong', () => (c.alive = true))
    ws.on('close', () => this.clients.delete(c))
    ws.on('error', () => this.clients.delete(c))
    const roleParam = url.searchParams.get('role')
    const t = setTimeout(() => {
      if (!c.role) this.welcome(c, { role: (roleParam as ClientRole) || 'dashboard', subscribe: [] })
    }, 5000)
    ws.on('message', (raw) => {
      let msg: { type?: string; payload?: unknown }
      try {
        msg = JSON.parse(String(raw))
      } catch {
        return this.send(c, makeEnvelope('error', { code: 'bad_json', message: 'JSON inválido' }))
      }
      if (msg.type === 'hello') {
        clearTimeout(t)
        const h = HelloSchema.safeParse(msg.payload)
        if (!h.success) return this.send(c, makeEnvelope('error', { code: 'bad_hello', message: h.error.message }))
        this.welcome(c, h.data)
      } else if (msg.type === 'ping') {
        this.send(c, makeEnvelope('pong', {}))
      } else if (msg.type === 'game.report') {
        const p = msg.payload as { kind?: string; data?: unknown }
        if (p?.kind) this.onReport(String(p.kind), p.data)
      }
    })
  }

  private welcome(c: Client, h: { role: ClientRole; subscribe: string[]; screen?: number }): void {
    c.role = h.role
    c.subs = h.subscribe
    c.screen = h.screen
    this.send(c, makeEnvelope('welcome', { protocol: PROTOCOL_VERSION, serverVersion: this.serverVersion, sessionId: this.sessionId, state: Object.fromEntries(this.state) }))
  }

  private send(c: Client, env: unknown): void {
    if (c.ws.readyState === c.ws.OPEN) c.ws.send(JSON.stringify(env))
  }

  private broadcast(type: string, payload: unknown, kind?: string, filter?: (c: Client) => boolean): void {
    const data = JSON.stringify(makeEnvelope(type, payload))
    for (const c of this.clients) {
      if (!c.role || c.ws.readyState !== c.ws.OPEN) continue
      if (filter && !filter(c)) continue
      if (!matchesSubscription(c.subs, type, kind)) continue
      // Contrapresión: si un cliente va muy atrasado (OBS congelado), no le acumulamos más.
      if (c.ws.bufferedAmount > 4 * 1024 * 1024) continue
      c.ws.send(data)
    }
  }

  event(ev: LiveEvent): void {
    this.broadcast('event', ev)
  }

  action(a: ActionMessage, screen?: number): void {
    this.broadcast('action', a, a.kind, (c) => screen === undefined || c.screen === undefined || c.screen === screen)
  }

  setState(key: StateKey, value: unknown): void {
    this.state.set(key, value)
    this.broadcast('state', { key, value }, key)
  }

  getState(key: StateKey): unknown {
    return this.state.get(key)
  }

  log(line: LogLine): void {
    this.broadcast('log', line, undefined, (c) => c.role === 'dashboard')
  }
}
