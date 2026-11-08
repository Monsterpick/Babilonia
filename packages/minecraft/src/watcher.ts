import { EventEmitter } from 'node:events'
import type { MinecraftLink } from './link.js'

/**
 * Vigía del jugador (solo comandos vanilla, sin plugins):
 *  - muertes: objetivo de marcador `deathCount` (fiable aunque mueras y reaparezcas rápido),
 *  - reaparición: Health > 0 después de una muerte,
 *  - online/offline del jugador.
 * Eventos: 'death' {player, deaths}, 'respawn' {player}, 'online' {player}, 'offline' {player}.
 */
const OBJECTIVE = 'la_deaths'

export class PlayerWatcher extends EventEmitter {
  private timer: NodeJS.Timeout | null = null
  private deaths: number | null = null
  private waitingRespawn = false
  private online: boolean | null = null
  private busy = false

  constructor(
    private readonly link: MinecraftLink,
    private player: string,
    private readonly intervalMs = 1000,
  ) {
    super()
  }

  setPlayer(p: string): void {
    if (p !== this.player) {
      this.player = p
      this.deaths = null
      this.online = null
      this.waitingRespawn = false
    }
  }

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => void this.tick(), this.intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.deaths = null
    this.online = null
  }

  /** Crea el objetivo de muertes (idempotente). Llamar al conectar. */
  async prepare(): Promise<void> {
    await this.link.sendNow(`scoreboard objectives add ${OBJECTIVE} deathCount`).catch(() => undefined)
  }

  private async tick(): Promise<void> {
    if (this.busy || !this.link.isConnected || !this.player) return
    this.busy = true
    try {
      const health = parseHealth(await this.link.sendNow(`data get entity ${this.player} Health`))
      const isOnline = health !== null
      if (isOnline !== this.online) {
        if (this.online !== null || isOnline) this.emit(isOnline ? 'online' : 'offline', { player: this.player })
        this.online = isOnline
        if (isOnline) await this.prepare()
      }
      if (!isOnline) return

      const deaths = parseScore(await this.link.sendNow(`scoreboard players get ${this.player} ${OBJECTIVE}`))
      if (deaths !== null) {
        if (this.deaths !== null && deaths > this.deaths) {
          this.waitingRespawn = true
          this.emit('death', { player: this.player, deaths })
        }
        this.deaths = deaths
      } else if (this.deaths === null) {
        this.deaths = 0
      }

      if (this.waitingRespawn && health !== null && health > 0) {
        this.waitingRespawn = false
        this.emit('respawn', { player: this.player })
      }
    } catch {
      // desconexión: el link se encarga de reconectar
    } finally {
      this.busy = false
    }
  }
}

/** "Steve has the following entity data: 20.0f" → 20 ; "No entity was found" → null */
export function parseHealth(res: string): number | null {
  const m = res.match(/entity data:\s*(-?[\d.]+)f?/i)
  return m ? Number.parseFloat(m[1]!) : null
}

/** "Steve has 3 [la_deaths]" → 3 ; "Can't get value..." → null */
export function parseScore(res: string): number | null {
  const m = res.match(/has (-?\d+) \[/)
  return m ? Number.parseInt(m[1]!, 10) : null
}
