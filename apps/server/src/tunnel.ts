import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from './config.js'

/**
 * Enlace público HTTPS para los overlays (TikTok LIVE Studio no acepta algunos enlaces locales).
 *
 * Usa un «túnel rápido» de Cloudflare (`cloudflared`, se descarga la primera vez desde su página oficial de GitHub):
 * da una dirección https://xxxx.trycloudflare.com que apunta a esta app. Por ese túnel SOLO se sirven los overlays
 * (páginas, imágenes y datos de solo lectura): el panel, la API que cambia cosas y los comandos quedan bloqueados
 * (ver `publicAllowed`). La dirección cambia cada vez que se activa el túnel.
 */
export type TunnelState = { status: 'off' | 'downloading' | 'starting' | 'on' | 'error'; url?: string; error?: string }

const BIN_DIR = path.join(DATA_DIR, 'bin')

function binaryInfo(): { file: string; url: string } | null {
  const base = 'https://github.com/cloudflare/cloudflared/releases/latest/download/'
  if (process.platform === 'win32') return { file: 'cloudflared.exe', url: base + (process.arch === 'ia32' ? 'cloudflared-windows-386.exe' : 'cloudflared-windows-amd64.exe') }
  if (process.platform === 'linux') return { file: 'cloudflared', url: base + (process.arch === 'arm64' ? 'cloudflared-linux-arm64' : 'cloudflared-linux-amd64') }
  return null
}

export class TunnelService {
  private st: TunnelState = { status: 'off' }
  private proc: ChildProcess | null = null
  private host: string | null = null
  onChange: (s: TunnelState) => void = () => {}

  get state(): TunnelState {
    return { ...this.st }
  }

  /** Host público del túnel (p. ej. abc.trycloudflare.com) o null. */
  get publicHost(): string | null {
    return this.host
  }

  private set(s: TunnelState): void {
    this.st = s
    this.onChange(this.state)
  }

  async start(port: number): Promise<TunnelState> {
    if (this.proc && (this.st.status === 'on' || this.st.status === 'starting')) return this.state
    const info = binaryInfo()
    if (!info) {
      this.set({ status: 'error', error: 'El enlace público solo está disponible en Windows y Linux.' })
      return this.state
    }
    const bin = path.join(BIN_DIR, info.file)
    try {
      if (!fs.existsSync(bin) || fs.statSync(bin).size < 1_000_000) {
        this.set({ status: 'downloading' })
        fs.mkdirSync(BIN_DIR, { recursive: true })
        const r = await fetch(info.url, { redirect: 'follow' })
        if (!r.ok || !r.body) throw new Error(`No se pudo descargar cloudflared (${r.status})`)
        const buf = Buffer.from(await r.arrayBuffer())
        fs.writeFileSync(bin + '.part', buf)
        fs.renameSync(bin + '.part', bin)
        if (process.platform !== 'win32') fs.chmodSync(bin, 0o755)
      }
    } catch (err) {
      this.set({ status: 'error', error: (err as Error).message })
      return this.state
    }
    this.set({ status: 'starting' })
    return new Promise((resolve) => {
      const p = spawn(bin, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`], { windowsHide: true })
      this.proc = p
      let done = false
      const finish = (s: TunnelState): void => {
        this.set(s)
        if (!done) {
          done = true
          resolve(this.state)
        }
      }
      const timer = setTimeout(() => finish({ status: 'error', error: 'El túnel no respondió en 40 s. Revisa tu conexión o el cortafuegos.' }), 40_000)
      const onData = (d: Buffer): void => {
        const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i.exec(String(d))
        if (m && this.st.status !== 'on') {
          clearTimeout(timer)
          this.host = new URL(m[0]).host.toLowerCase()
          finish({ status: 'on', url: m[0] })
        }
      }
      p.stdout?.on('data', onData)
      p.stderr?.on('data', onData)
      p.on('error', (err) => {
        clearTimeout(timer)
        finish({ status: 'error', error: err.message })
      })
      p.on('exit', () => {
        clearTimeout(timer)
        this.proc = null
        this.host = null
        if (this.st.status !== 'error') finish({ status: 'off' })
      })
    })
  }

  stop(): TunnelState {
    this.proc?.kill()
    this.proc = null
    this.host = null
    this.set({ status: 'off' })
    return this.state
  }
}

/** Rutas que se pueden pedir por el enlace público: solo lectura y solo lo que usan los overlays. */
export function publicAllowed(method: string, url: string): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false
  const p = url.split('?')[0] ?? ''
  if (p === '/favicon.ico' || p === '/favicon.svg') return true
  if (/^\/(overlay|juego|o|assets|gifts|media|lasthouse|fonts|catalogo)\//.test(p)) return true
  return ['/api/overlays/settings', '/api/profile/overlay', '/api/scoreboard', '/api/lasthouse/state', '/api/lasthouse/settings', '/api/lasthouse/progress'].includes(p)
}
