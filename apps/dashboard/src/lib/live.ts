import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ActionMessage, ClientRole, LiveEvent, LogLine } from '@livearena/shared'

type Listener = () => void
type ActionHandler = (a: ActionMessage) => void
type EventHandler = (e: LiveEvent) => void
type LogHandler = (l: LogLine) => void

/**
 * Conexión WebSocket (protocolo v1) compartida por toda la página, con reconexión automática.
 * Guarda el último valor de cada `state` y reparte acciones/eventos/logs a quien escuche.
 */
class LiveClient {
  private ws: WebSocket | null = null
  private state: Record<string, unknown> = {}
  private listeners = new Set<Listener>()
  private actionHandlers = new Set<ActionHandler>()
  private eventHandlers = new Set<EventHandler>()
  private logHandlers = new Set<LogHandler>()
  connected = false
  private retry = 500

  constructor(
    private role: ClientRole,
    private subscribe: string[] = [],
  ) {}

  start(): void {
    if (this.ws) return
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/ws?role=${this.role}`)
    this.ws = ws
    ws.onopen = () => {
      this.retry = 500
      ws.send(JSON.stringify({ v: 1, type: 'hello', id: 'h', ts: Date.now(), payload: { role: this.role, client: `web-${this.role}`, subscribe: this.subscribe } }))
    }
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data)
      switch (msg.type) {
        case 'welcome':
          this.connected = true
          this.state = { ...this.state, ...msg.payload.state }
          this.notify()
          break
        case 'state':
          this.state = { ...this.state, [msg.payload.key]: msg.payload.value }
          this.notify()
          break
        case 'action':
          for (const h of this.actionHandlers) h(msg.payload)
          break
        case 'event':
          for (const h of this.eventHandlers) h(msg.payload)
          break
        case 'log':
          for (const h of this.logHandlers) h(msg.payload)
          break
      }
    }
    ws.onclose = () => {
      this.ws = null
      this.connected = false
      this.notify()
      setTimeout(() => this.start(), this.retry)
      this.retry = Math.min(5000, this.retry * 2)
    }
  }

  private notify(): void {
    for (const l of this.listeners) l()
  }

  subscribeState = (l: Listener) => {
    this.listeners.add(l)
    return () => void this.listeners.delete(l)
  }
  getState = () => this.state
  onAction(h: ActionHandler) {
    this.actionHandlers.add(h)
    return () => void this.actionHandlers.delete(h)
  }
  onEvent(h: EventHandler) {
    this.eventHandlers.add(h)
    return () => void this.eventHandlers.delete(h)
  }
  onLog(h: LogHandler) {
    this.logHandlers.add(h)
    return () => void this.logHandlers.delete(h)
  }
}

let client: LiveClient | null = null
export function initLive(role: ClientRole, subscribe: string[] = []): LiveClient {
  client ??= new LiveClient(role, subscribe)
  client.start()
  return client
}
const live = () => client ?? initLive('dashboard')

export function useLiveState<T = any>(key: string): T | undefined {
  const st = useSyncExternalStore(live().subscribeState, live().getState)
  return st[key] as T | undefined
}

export function useLiveConnected(): boolean {
  useSyncExternalStore(live().subscribeState, live().getState)
  return live().connected
}

export function useOnAction(h: ActionHandler): void {
  const ref = useRef(h)
  ref.current = h
  useEffect(() => live().onAction((a) => ref.current(a)), [])
}

export function useOnEvent(h: EventHandler): void {
  const ref = useRef(h)
  ref.current = h
  useEffect(() => live().onEvent((e) => ref.current(e)), [])
}

export function useOnLog(h: LogHandler): void {
  const ref = useRef(h)
  ref.current = h
  useEffect(() => live().onLog((l) => ref.current(l)), [])
}

/** Fuerza un re-render cada `ms` (cronómetros). */
export function useTick(ms: number): number {
  const [t, setT] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => setT(Date.now()), ms)
    return () => clearInterval(i)
  }, [ms])
  return t
}
