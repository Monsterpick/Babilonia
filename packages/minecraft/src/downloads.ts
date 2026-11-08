import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { downloadFile } from './server-create.js'

const run = promisify(execFile)
const UA = { 'User-Agent': 'LiveArena/0.2 (+streamer tool)' }

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: UA })
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`)
  return (await r.json()) as T
}

/** Versiones conocidas por si no hay internet (la más nueva primero). */
export const FALLBACK_VERSIONS = ['26.1.2', '1.21.11', '1.21.8', '1.21.4', '1.21.1', '1.20.6', '1.20.4', '1.20.1']

/** Versiones de Paper disponibles (estables), más nuevas primero. */
export async function paperVersions(): Promise<string[]> {
  try {
    const d = await getJson<{ versions: Record<string, string[]> }>('https://fill.papermc.io/v3/projects/paper')
    const all = Object.values(d.versions).flat()
    const stable = all.filter((v) => /^\d+\.\d+(\.\d+)?$/.test(v))
    const cmp = (a: string, b: string) => {
      const pa = a.split('.').map(Number)
      const pb = b.split('.').map(Number)
      for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0)
      return 0
    }
    const list = [...new Set(stable)].sort(cmp)
    return list.length ? list : FALLBACK_VERSIONS
  } catch {
    return FALLBACK_VERSIONS
  }
}

/**
 * Instala un JDK de Eclipse Temurin (Adoptium) dentro de la carpeta de datos de LiveArena.
 * Devuelve la ruta del ejecutable java.
 */
export async function installJdk(feature: number, root: string, onPct?: (pct: number) => void): Promise<string> {
  const os = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux'
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x64'
  const ext = os === 'windows' ? 'zip' : 'tar.gz'
  const dest = path.join(root, `jdk-${feature}`)
  const exe = path.join(dest, os === 'mac' ? 'Contents/Home/bin/java' : `bin/java${os === 'windows' ? '.exe' : ''}`)
  try {
    await fs.access(exe)
    return exe
  } catch {
    /* hay que instalarlo */
  }
  await fs.mkdir(root, { recursive: true })
  const meta = await getJson<{ binary: { package: { link: string; checksum: string; name: string } } }[]>(
    `https://api.adoptium.net/v3/assets/latest/${feature}/hotspot?architecture=${arch}&image_type=jdk&os=${os}&vendor=eclipse`,
  )
  const pkg = meta[0]?.binary.package
  if (!pkg) throw new Error(`Adoptium no tiene JDK ${feature} para ${os}/${arch}`)
  const archive = path.join(root, `jdk-${feature}.${ext}`)
  await downloadFile({ url: pkg.link, sha256: pkg.checksum, fileName: pkg.name }, archive, onPct)
  const tmp = path.join(root, `jdk-${feature}-tmp`)
  await fs.rm(tmp, { recursive: true, force: true })
  await fs.mkdir(tmp, { recursive: true })
  // Windows 10+ trae bsdtar (tar.exe), que también descomprime .zip.
  await run('tar', ['-xf', archive, '-C', tmp], { windowsHide: true, maxBuffer: 1 << 26 })
  const [inner] = await fs.readdir(tmp)
  if (!inner) throw new Error('El JDK descargado está vacío')
  await fs.rm(dest, { recursive: true, force: true })
  await fs.rename(path.join(tmp, inner), dest)
  await fs.rm(tmp, { recursive: true, force: true })
  await fs.rm(archive, { force: true })
  return exe
}

/** Descarga la última ViaVersion para Paper desde Modrinth (deja entrar a clientes más nuevos). */
export async function downloadViaVersion(pluginsDir: string): Promise<string> {
  const versions = await getJson<{ version_type: string; files: { url: string; filename: string; primary: boolean; hashes: { sha1: string } }[] }[]>(
    'https://api.modrinth.com/v2/project/viaversion/version?loaders=%5B%22paper%22%5D',
  )
  const v = versions.find((x) => x.version_type === 'release') ?? versions[0]
  const f = v?.files.find((x) => x.primary) ?? v?.files[0]
  if (!f) throw new Error('No encontré ViaVersion en Modrinth')
  await fs.mkdir(pluginsDir, { recursive: true })
  const dest = path.join(pluginsDir, f.filename)
  await downloadFile({ url: f.url, sha1: f.hashes.sha1, fileName: f.filename }, dest)
  return dest
}
