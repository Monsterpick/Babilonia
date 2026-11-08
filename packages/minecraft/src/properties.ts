import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

/** Lee server.properties preservando orden y comentarios. */
export async function readProperties(file: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let text = ''
  try {
    text = await fs.readFile(file, 'utf8')
  } catch {
    return map
  }
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    map.set(line.slice(0, i).trim(), unescape(line.slice(i + 1)))
  }
  return map
}

const unescape = (v: string) => v.replace(/\\(.)/g, '$1')
const escape = (v: string) => v.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/=/g, '\\=')

/** Escribe/actualiza claves de server.properties sin tocar el resto. */
export async function updateProperties(file: string, values: Record<string, string | number | boolean>): Promise<void> {
  let lines: string[] = []
  try {
    lines = (await fs.readFile(file, 'utf8')).split(/\r?\n/)
  } catch {
    lines = ['#Minecraft server properties', `#Generado por LiveArena ${new Date().toISOString()}`]
  }
  const pending = new Map(Object.entries(values).map(([k, v]) => [k, String(v)]))
  lines = lines.map((line) => {
    const i = line.indexOf('=')
    if (line.startsWith('#') || i < 0) return line
    const k = line.slice(0, i).trim()
    if (!pending.has(k)) return line
    const v = pending.get(k)!
    pending.delete(k)
    return `${k}=${escape(v)}`
  })
  for (const [k, v] of pending) lines.push(`${k}=${escape(v)}`)
  await fs.writeFile(file, lines.filter((l, i, a) => l !== '' || i < a.length - 1).join('\n') + '\n', 'utf8')
}

export function randomPassword(len = 20): string {
  return crypto.randomBytes(len).toString('base64url').slice(0, len)
}

export interface RconInfo {
  folder: string
  enabled: boolean
  port: number
  password: string
  serverPort: number
  motd?: string
}

/** Lee la configuración RCON de una carpeta de servidor. */
export async function readRcon(folder: string): Promise<RconInfo> {
  const p = await readProperties(path.join(folder, 'server.properties'))
  return {
    folder,
    enabled: p.get('enable-rcon') === 'true',
    port: Number(p.get('rcon.port') ?? 25575) || 25575,
    password: p.get('rcon.password') ?? '',
    serverPort: Number(p.get('server-port') ?? 25565) || 25565,
    motd: p.get('motd'),
  }
}

/**
 * Activa RCON en un servidor existente (genera contraseña segura si no tiene).
 * Requiere reiniciar el servidor si estaba encendido.
 */
export async function enableRcon(folder: string, port = 25575): Promise<RconInfo> {
  const cur = await readRcon(folder)
  const password = cur.password && cur.password.length >= 8 ? cur.password : randomPassword()
  await updateProperties(path.join(folder, 'server.properties'), {
    'enable-rcon': true,
    'rcon.port': cur.port || port,
    'rcon.password': password,
    'broadcast-rcon-to-ops': false,
  })
  return readRcon(folder)
}
