import './quiet-warnings.js'
import { App, VERSION } from './app.js'
import { buildHttp } from './http.js'
import { DATA_DIR } from './config.js'

export interface RunningServer {
  app: App
  port: number
  url: string
  close: () => Promise<void>
}

/** Arranca LiveArena (API + WebSocket + panel). Lo usan la consola (main.ts) y la app de escritorio. */
export async function startServer(opts: { port?: number } = {}): Promise<RunningServer> {
  const app = new App()
  // Un fallo inesperado nunca debe tumbar el juego en pleno directo: se registra y seguimos.
  process.on('unhandledRejection', (err) => app.log.error('proceso', `Promesa sin manejar: ${(err as Error)?.message ?? err}`))
  process.on('uncaughtException', (err) => app.log.error('proceso', `Excepción: ${err.message}`))

  await app.init()
  const http = await buildHttp(app)
  http.server.on('upgrade', (req, socket, head) => {
    const host = req.headers.host ?? ''
    const pub = app.tunnel.publicHost !== null && host.toLowerCase() === app.tunnel.publicHost
    if ((!pub && !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)) || !req.url?.startsWith('/ws')) return socket.destroy()
    app.hub.handleUpgrade(req, socket, head)
  })
  const port = opts.port ?? Number(process.env.PORT ?? app.cfg.get().port)
  try {
    await http.listen({ host: '127.0.0.1', port })
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    await app.shutdown()
    throw new Error(e.code === 'EADDRINUSE' ? `El puerto ${port} ya está en uso: ¿LiveArena ya está abierto?` : `No se pudo iniciar: ${e.message}`)
  }
  app.log.info('servidor', `LiveArena ${VERSION} en http://127.0.0.1:${port}  (datos: ${DATA_DIR})`)
  let closed = false
  return {
    app,
    port,
    url: `http://127.0.0.1:${port}`,
    close: async () => {
      if (closed) return
      closed = true
      app.log.info('servidor', 'Cerrando…')
      await http.close().catch(() => undefined)
      await app.shutdown()
    },
  }
}
