import fs from 'node:fs'
import { App, VERSION } from './app.js'
import { buildHttp } from './http.js'
import { DATA_DIR } from './config.js'

if (fs.existsSync('.env')) process.loadEnvFile('.env')
else if (fs.existsSync('../../.env')) process.loadEnvFile('../../.env')

const app = new App()

// Un fallo inesperado nunca debe tumbar el juego en pleno directo: se registra y seguimos.
process.on('unhandledRejection', (err) => app.log.error('proceso', `Promesa sin manejar: ${(err as Error)?.message ?? err}`))
process.on('uncaughtException', (err) => app.log.error('proceso', `Excepción: ${err.message}`))

await app.init()
const http = await buildHttp(app)
http.server.on('upgrade', (req, socket, head) => {
  const host = req.headers.host ?? ''
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host) || !req.url?.startsWith('/ws')) return socket.destroy()
  app.hub.handleUpgrade(req, socket, head)
})
const port = Number(process.env.PORT ?? app.cfg.get().port)
await http.listen({ host: '127.0.0.1', port })
app.log.info('servidor', `LiveArena ${VERSION} en http://127.0.0.1:${port}  (datos: ${DATA_DIR})`)

let closing = false
const shutdown = async () => {
  if (closing) return
  closing = true
  app.log.info('servidor', 'Cerrando…')
  await http.close().catch(() => undefined)
  await app.shutdown()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
