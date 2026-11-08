import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { parseVersion } from './commands.js'

export interface JavaInfo {
  path: string
  major: number
  version: string
}

/** Java mínimo para cada versión de Minecraft. */
export function requiredJava(mcVersion: string): number {
  const v = parseVersion(mcVersion)
  if (v.minor >= 21 || (v.minor === 20 && v.patch >= 5)) return 21
  if (v.minor >= 18) return 17
  if (v.minor === 17) return 16
  return 8
}

function runVersion(bin: string): Promise<JavaInfo | null> {
  return new Promise((resolve) => {
    execFile(bin, ['-version'], { timeout: 8000, windowsHide: true }, (err, stdout, stderr) => {
      if (err) return resolve(null)
      const out = `${stderr}\n${stdout}`
      const m = out.match(/version "([^"]+)"/)
      if (!m) return resolve(null)
      const ver = m[1]!
      const major = ver.startsWith('1.') ? Number(ver.split('.')[1]) : Number.parseInt(ver, 10)
      resolve({ path: bin, major, version: ver })
    })
  })
}

async function listDirs(base: string): Promise<string[]> {
  try {
    return (await fs.readdir(base, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => path.join(base, d.name))
  } catch {
    return []
  }
}

/** Busca todas las instalaciones de Java (PATH, JAVA_HOME y carpetas típicas de Windows/macOS/Linux). */
export async function findJavas(): Promise<JavaInfo[]> {
  const exe = process.platform === 'win32' ? 'java.exe' : 'java'
  const candidates = new Set<string>(['java'])
  if (process.env.JAVA_HOME) candidates.add(path.join(process.env.JAVA_HOME, 'bin', exe))
  const roots =
    process.platform === 'win32'
      ? ['C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Java', 'C:\\Program Files\\Microsoft', 'C:\\Program Files\\Zulu', 'C:\\Program Files\\BellSoft']
      : process.platform === 'darwin'
        ? ['/Library/Java/JavaVirtualMachines']
        : ['/usr/lib/jvm']
  for (const r of roots) {
    for (const d of await listDirs(r)) {
      candidates.add(path.join(d, 'bin', exe))
      candidates.add(path.join(d, 'Contents', 'Home', 'bin', exe))
    }
  }
  const found = (await Promise.all([...candidates].map(runVersion))).filter((x): x is JavaInfo => !!x)
  const seen = new Set<string>()
  return found.filter((j) => (seen.has(j.version) ? false : (seen.add(j.version), true))).sort((a, b) => b.major - a.major)
}

/** El mejor Java que cumple el mínimo para esa versión de Minecraft (o null). */
export async function findJavaFor(mcVersion: string): Promise<{ java: JavaInfo | null; required: number; all: JavaInfo[] }> {
  const required = requiredJava(mcVersion)
  const all = await findJavas()
  return { java: all.find((j) => j.major >= required) ?? null, required, all }
}
