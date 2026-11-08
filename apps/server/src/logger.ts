import pino from 'pino'
import type { LogLine } from '@livearena/shared'

type Level = LogLine['level']

/** Logs estructurados (pino, JSON) + reenvío al panel en vivo. */
export class Logger {
  private readonly pino = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.stdout.isTTY ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } : undefined,
  })
  private readonly ring: LogLine[] = []
  sink: (l: LogLine) => void = () => undefined

  private write(level: Level, scope: string, msg: string, data?: unknown): void {
    const line: LogLine = { level, scope, msg, ts: Date.now(), data }
    this.pino[level]({ scope, ...(data ? { data } : {}) }, msg)
    if (level === 'debug') return
    this.ring.push(line)
    if (this.ring.length > 500) this.ring.shift()
    this.sink(line)
  }

  debug(scope: string, msg: string, data?: unknown) {
    this.write('debug', scope, msg, data)
  }
  info(scope: string, msg: string, data?: unknown) {
    this.write('info', scope, msg, data)
  }
  warn(scope: string, msg: string, data?: unknown) {
    this.write('warn', scope, msg, data)
  }
  error(scope: string, msg: string, data?: unknown) {
    this.write('error', scope, msg, data)
  }

  recent(): LogLine[] {
    return [...this.ring]
  }
}
