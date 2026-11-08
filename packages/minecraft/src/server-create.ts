import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { randomPassword, updateProperties } from './properties.js'

export type ServerSoftware = 'paper' | 'vanilla'

export interface CreateServerOptions {
  folder: string
  software: ServerSoftware
  mcVersion: string
  /** Debe ser true: el usuario acepta el EULA de Minecraft explícitamente. */
  eulaAccepted: boolean
  name: string
  difficulty: 'peaceful' | 'easy' | 'normal' | 'hard'
  gamemode: 'survival' | 'creative' | 'adventure'
  levelType: 'normal' | 'flat' | 'large_biomes' | 'amplified'
  seed?: string
  maxPlayers: number
  /** Memoria máxima y mínima en MB (-Xmx / -Xms). */
  xmxMB: number
  xmsMB: number
  /** Java a usar en iniciar.bat (vacío = "java" del sistema). */
  javaPath?: string
  /** Descargar ViaVersion (deja entrar con versiones de Minecraft más nuevas). */
  viaVersion?: boolean
  /** Rutas de .jar de plugins que copiar a /plugins (solo Paper). */
  plugins: string[]
  onlineMode: boolean
  rconPort?: number
  serverPort?: number
}

export interface CreatedServer {
  folder: string
  jar: string
  rconPort: number
  rconPassword: string
  serverPort: number
  software: ServerSoftware
  mcVersion: string
  xmxMB: number
  xmsMB: number
}

export type Progress = (p: { step: string; pct?: number; message: string }) => void

export const SERVER_META_FILE = 'livearena-server.json'

/* ------------------------------ descargas ------------------------------ */

interface DownloadInfo {
  url: string
  sha256?: string
  sha1?: string
  fileName: string
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { 'User-Agent': 'LiveArena/0.1 (+streamer tool)' } })
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`)
  return (await r.json()) as T
}

/** Paper: API Fill v3 y, si falla, la v2 antigua. */
export async function resolvePaper(version: string): Promise<DownloadInfo> {
  try {
    const b = await getJson<{ id: number; downloads: Record<string, { name: string; url: string; checksums: { sha256: string } }> }>(
      `https://fill.papermc.io/v3/projects/paper/versions/${version}/builds/latest`,
    )
    const d = b.downloads['server:default'] ?? Object.values(b.downloads)[0]
    if (d) return { url: d.url, sha256: d.checksums.sha256, fileName: d.name }
  } catch {
    /* probamos v2 */
  }
  const list = await getJson<{ builds: { build: number; channel: string; downloads: { application: { name: string; sha256: string } } }[] }>(
    `https://api.papermc.io/v2/projects/paper/versions/${version}/builds`,
  )
  const builds = list.builds.filter((b) => b.channel === 'default')
  const last = (builds.length ? builds : list.builds).at(-1)
  if (!last) throw new Error(`Paper no tiene builds para ${version}`)
  const app = last.downloads.application
  return {
    url: `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${last.build}/downloads/${app.name}`,
    sha256: app.sha256,
    fileName: app.name,
  }
}

/** Vanilla: manifiesto oficial de Mojang. */
export async function resolveVanilla(version: string): Promise<DownloadInfo> {
  const manifest = await getJson<{ versions: { id: string; url: string }[] }>('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')
  const entry = manifest.versions.find((v) => v.id === version)
  if (!entry) throw new Error(`Mojang no tiene la versión ${version}`)
  const meta = await getJson<{ downloads: { server?: { url: string; sha1: string } } }>(entry.url)
  if (!meta.downloads.server) throw new Error(`La versión ${version} no tiene servidor oficial`)
  return { url: meta.downloads.server.url, sha1: meta.downloads.server.sha1, fileName: `minecraft_server.${version}.jar` }
}

export async function downloadFile(info: DownloadInfo, dest: string, onPct?: (pct: number) => void): Promise<void> {
  const r = await fetch(info.url, { headers: { 'User-Agent': 'LiveArena/0.1' } })
  if (!r.ok || !r.body) throw new Error(`No se pudo descargar ${info.url} (HTTP ${r.status})`)
  const total = Number(r.headers.get('content-length') ?? 0)
  const algo = info.sha256 ? 'sha256' : info.sha1 ? 'sha1' : null
  const hash = algo ? crypto.createHash(algo) : null
  let got = 0
  const tmp = `${dest}.part`
  const body = Readable.fromWeb(r.body as import('node:stream/web').ReadableStream)
  body.on('data', (chunk: Buffer) => {
    got += chunk.length
    hash?.update(chunk)
    if (total && onPct) onPct(Math.round((got / total) * 100))
  })
  await pipeline(body, createWriteStream(tmp))
  if (hash) {
    const digest = hash.digest('hex')
    const expected = info.sha256 ?? info.sha1
    if (digest !== expected) {
      await fs.rm(tmp, { force: true })
      throw new Error('La descarga está corrupta (checksum no coincide). Vuelve a intentarlo.')
    }
  }
  await fs.rename(tmp, dest)
}

/* ------------------------------ creación ------------------------------ */

async function isEmptyOrMissing(folder: string): Promise<boolean> {
  try {
    const items = await fs.readdir(folder)
    return items.filter((x) => !x.startsWith('.')).length === 0
  } catch {
    return true
  }
}

export async function validateFolder(folder: string): Promise<{ ok: boolean; message: string }> {
  if (!folder || !path.isAbsolute(folder)) return { ok: false, message: 'Elige una carpeta (ruta completa).' }
  if (!(await isEmptyOrMissing(folder))) return { ok: false, message: 'La carpeta no está vacía. Elige una nueva o vacía.' }
  return { ok: true, message: 'Carpeta válida.' }
}

/**
 * Crea un servidor listo para usar: descarga el .jar, server.properties con RCON y contraseña
 * aleatoria, EULA (solo si el usuario la aceptó), plugins, y scripts iniciar.bat / iniciar.sh.
 */
export async function createServer(o: CreateServerOptions, progress: Progress = () => undefined): Promise<CreatedServer> {
  if (!o.eulaAccepted) throw new Error('Debes aceptar el EULA de Minecraft para crear un servidor.')
  const v = await validateFolder(o.folder)
  if (!v.ok) throw new Error(v.message)
  await fs.mkdir(o.folder, { recursive: true })

  progress({ step: 'resolve', message: `Buscando ${o.software === 'paper' ? 'Paper' : 'Minecraft'} ${o.mcVersion}…` })
  const info = o.software === 'paper' ? await resolvePaper(o.mcVersion) : await resolveVanilla(o.mcVersion)
  const jar = 'server.jar'
  progress({ step: 'download', pct: 0, message: `Descargando ${info.fileName}…` })
  await downloadFile(info, path.join(o.folder, jar), (pct) => progress({ step: 'download', pct, message: `Descargando… ${pct}%` }))

  progress({ step: 'config', message: 'Configurando el servidor…' })
  const rconPassword = randomPassword()
  const rconPort = o.rconPort ?? 25575
  const serverPort = o.serverPort ?? 25565
  await updateProperties(path.join(o.folder, 'server.properties'), {
    motd: o.name.replace(/[\r\n]/g, ' ').slice(0, 59),
    difficulty: o.difficulty,
    gamemode: o.gamemode,
    'level-type': `minecraft:${o.levelType}`,
    'level-seed': o.seed ?? '',
    'max-players': o.maxPlayers,
    'online-mode': o.onlineMode,
    'server-port': serverPort,
    'enable-rcon': true,
    'rcon.port': rconPort,
    'rcon.password': rconPassword,
    'broadcast-rcon-to-ops': false,
    'enable-command-block': true,
    'spawn-protection': 0,
    'view-distance': 10,
    'simulation-distance': 8,
  })
  await fs.writeFile(
    path.join(o.folder, 'eula.txt'),
    `# Aceptado por el usuario en LiveArena el ${new Date().toISOString()}\n# https://aka.ms/MinecraftEULA\neula=true\n`,
    'utf8',
  )

  if (o.plugins.length) {
    if (o.software !== 'paper') throw new Error('Los plugins .jar necesitan un servidor Paper.')
    progress({ step: 'plugins', message: `Instalando ${o.plugins.length} plugin(s)…` })
    const dir = path.join(o.folder, 'plugins')
    await fs.mkdir(dir, { recursive: true })
    for (const p of o.plugins) await fs.copyFile(p, path.join(dir, path.basename(p)))
  }

  if (o.viaVersion && o.software === 'paper') {
    progress({ step: 'plugins', message: 'Descargando ViaVersion…' })
    try {
      const { downloadViaVersion } = await import('./downloads.js')
      await downloadViaVersion(path.join(o.folder, 'plugins'))
    } catch (err) {
      progress({ step: 'plugins', message: `ViaVersion no se pudo descargar (${(err as Error).message}); sigo sin él.` })
    }
  }

  const xmx = Math.max(512, Math.round(o.xmxMB))
  const xms = Math.max(256, Math.min(xmx, Math.round(o.xmsMB)))
  const java = o.javaPath ? `"${o.javaPath}"` : 'java'
  const args = `-Xms${xms}M -Xmx${xmx}M -jar ${jar} nogui`
  await fs.writeFile(path.join(o.folder, 'iniciar.bat'), `@echo off\r\ncd /d "%~dp0"\r\n${java} ${args}\r\npause\r\n`, 'utf8')
  await fs.writeFile(path.join(o.folder, 'iniciar.sh'), `#!/bin/sh\ncd "$(dirname "$0")"\nexec ${java} ${args}\n`, { encoding: 'utf8', mode: 0o755 })

  const created: CreatedServer = { folder: o.folder, jar, rconPort, rconPassword, serverPort, software: o.software, mcVersion: o.mcVersion, xmxMB: xmx, xmsMB: xms }
  await fs.writeFile(path.join(o.folder, SERVER_META_FILE), JSON.stringify({ ...created, rconPassword: undefined, createdAt: Date.now() }, null, 2))
  progress({ step: 'done', pct: 100, message: 'Servidor creado.' })
  return created
}
