import net from 'node:net'
import { execFile } from 'node:child_process'

/** true si nadie escucha en ese puerto TCP (se prueba en todas las interfaces, igual que Minecraft). */
export function isPortFree(port: number, host = '0.0.0.0'): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.unref()
    srv.once('error', () => resolve(false))
    srv.listen({ port, host, exclusive: true }, () => srv.close(() => resolve(true)))
  })
}

/** Primer puerto libre a partir de `start` (salta los de `avoid`). */
export async function findFreePort(start: number, avoid: number[] = [], tries = 50): Promise<number | null> {
  for (let p = start; p < start + tries && p < 65536; p++) {
    if (avoid.includes(p)) continue
    if (await isPortFree(p)) return p
  }
  return null
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, timeout: 5000 }, (err, out) => resolve(err ? '' : String(out)))
  })
}

/** Intenta averiguar qué programa usa el puerto (solo Windows: netstat + tasklist). */
export async function whoUsesPort(port: number): Promise<{ pid: number; name: string } | null> {
  if (process.platform !== 'win32') return null
  const out = await run('netstat', ['-ano', '-p', 'TCP'])
  for (const line of out.split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/)
    // Proto  Local  Remota  Estado  PID
    if (cols.length >= 5 && cols[1]?.endsWith(`:${port}`) && /LISTEN/i.test(cols[3] ?? '')) {
      const pid = Number(cols[4])
      if (!pid) continue
      const t = await run('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'])
      const name = t.match(/^"([^"]+)"/m)?.[1] ?? 'desconocido'
      return { pid, name }
    }
  }
  return null
}
