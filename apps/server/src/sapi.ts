import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'

/**
 * Voces de Windows (SAPI) a través de PowerShell + System.Speech.
 * Se consultan las dos versiones de PowerShell: la de 64 bits (voces modernas de Windows) y la de 32 bits
 * (SysWOW64), que es donde aparecen voces antiguas instaladas aparte, como las de Loquendo.
 * El texto, la voz y la ruta se pasan por variables de entorno: nunca se meten en el script.
 */
export interface SapiVoice {
  name: string
  gender: string
  culture: string
  arch: '64' | '32'
}

const root = process.env.SystemRoot ?? 'C:\\Windows'
export const POWERSHELL = {
  '64': path.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
  '32': path.join(root, 'SysWOW64', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
} as const

const PRELUDE = '[Console]::OutputEncoding=[Text.Encoding]::UTF8; Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer;'
export const LIST_SCRIPT = `${PRELUDE} $s.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object { $v = $_.VoiceInfo; "$($v.Name)|$($v.Gender)|$($v.Culture.Name)" }`
export const SPEAK_SCRIPT = `${PRELUDE} $s.SelectVoice($env:LA_VOICE); $s.Rate = [int]$env:LA_RATE; $s.Volume = 100; $s.SetOutputToWaveFile($env:LA_OUT); $s.Speak($env:LA_TEXT); $s.Dispose()`

function ps(exe: string, script: string, env: Record<string, string> = {}, timeoutMs = 20000): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(exe, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true, env: { ...process.env, ...env } })
    let out = ''
    let err = ''
    const t = setTimeout(() => p.kill(), timeoutMs)
    p.stdout.on('data', (d) => (out += d.toString('utf8')))
    p.stderr.on('data', (d) => (err += d.toString('utf8')))
    p.on('error', (e) => {
      clearTimeout(t)
      reject(e)
    })
    p.on('close', (code) => {
      clearTimeout(t)
      code === 0 ? resolve(out) : reject(new Error(err.trim().split('\n').slice(-2).join(' ') || `PowerShell salió con ${code}`))
    })
  })
}

export function parseVoiceList(text: string, arch: '64' | '32'): SapiVoice[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name = '', gender = '', culture = ''] = l.split('|')
      return { name: name.trim(), gender: gender.trim(), culture: culture.trim(), arch }
    })
    .filter((v) => v.name)
}

/** SAPI rate va de -10 a 10; nuestra velocidad de 0.5 a 2. */
export const sapiRate = (rate: number) => Math.max(-10, Math.min(10, Math.round(Math.log2(Math.max(0.25, rate)) * 6)))

export class SapiService {
  private cache: { at: number; voices: SapiVoice[] } | null = null

  get available(): boolean {
    return process.platform === 'win32'
  }

  async voices(force = false): Promise<SapiVoice[]> {
    if (!this.available) return []
    if (!force && this.cache && Date.now() - this.cache.at < 60_000) return this.cache.voices
    const out: SapiVoice[] = []
    for (const arch of ['64', '32'] as const) {
      const exe = POWERSHELL[arch]
      if (!(await fs.access(exe).then(() => true, () => false))) continue
      const list = await ps(exe, LIST_SCRIPT).then((t) => parseVoiceList(t, arch), () => [])
      for (const v of list) if (!out.some((o) => o.name === v.name)) out.push(v)
    }
    this.cache = { at: Date.now(), voices: out }
    return out
  }

  /** Genera un .wav con la voz pedida. Devuelve la ruta. */
  async speak(text: string, voice: string, rate: number, outFile: string): Promise<string> {
    const list = await this.voices()
    const v = list.find((x) => x.name === voice)
    if (!v) throw new Error(`No encuentro la voz de Windows «${voice}»`)
    await fs.mkdir(path.dirname(outFile), { recursive: true })
    await ps(POWERSHELL[v.arch], SPEAK_SCRIPT, { LA_VOICE: v.name, LA_RATE: String(sapiRate(rate)), LA_OUT: outFile, LA_TEXT: text.slice(0, 600) })
    return outFile
  }
}
