import net from 'node:net'
import { encode } from '../src/rcon.js'

/**
 * Servidor RCON falso que imita a Minecraft: autenticación, respuestas, trozos de 4096,
 * y estado mínimo del jugador (vida y muertes) para probar el vigía.
 */
export class FakeRcon {
  readonly commands: string[] = []
  health: number | null = 20
  deaths = 0
  private server: net.Server
  private sockets = new Set<net.Socket>()
  port = 0

  constructor(readonly password = 'secreto') {
    this.server = net.createServer((s) => {
      this.sockets.add(s)
      s.on('close', () => this.sockets.delete(s))
      let buf = Buffer.alloc(0)
      let authed = false
      s.on('data', (d) => {
        buf = Buffer.concat([buf, d])
        while (buf.length >= 4) {
          const len = buf.readInt32LE(0)
          if (buf.length < len + 4) return
          const id = buf.readInt32LE(4)
          const type = buf.readInt32LE(8)
          const body = buf.toString('utf8', 12, 4 + len - 2)
          buf = buf.subarray(len + 4)
          if (type === 3) {
            authed = body === this.password
            s.write(encode(authed ? id : -1, 2, ''))
          } else if (type === 2 && authed) {
            this.commands.push(body)
            for (const chunk of this.respond(body)) s.write(encode(id, 0, chunk))
          }
        }
      })
    })
  }

  private respond(cmd: string): string[] {
    if (cmd === 'big') return ['x'.repeat(4096), 'y'.repeat(10)]
    if (cmd.startsWith('data get entity')) return [this.health === null ? 'No entity was found' : `Steve has the following entity data: ${this.health.toFixed(1)}f`]
    if (cmd.startsWith('scoreboard players get')) return [`Steve has ${this.deaths} [la_deaths]`]
    if (cmd.startsWith('list')) return ['There are 1 of a max of 20 players online: Steve']
    return [`ok: ${cmd}`]
  }

  listen(): Promise<number> {
    return new Promise((r) =>
      this.server.listen(0, '127.0.0.1', () => {
        this.port = (this.server.address() as net.AddressInfo).port
        r(this.port)
      }),
    )
  }

  dropClients(): void {
    for (const s of this.sockets) s.destroy()
  }

  close(): Promise<void> {
    this.dropClients()
    return new Promise((r) => this.server.close(() => r()))
  }
}
