/**
 * Utilidades de texto seguras para meter datos de espectadores en comandos y overlays.
 * Los nicknames de TikTok pueden traer comillas, llaves, @, §, saltos de línea, emojis...
 */

/** Quita controles, saltos de línea y caracteres que rompen comandos/NBT. Mantiene acentos y emojis. */
export function safeDisplayText(value: unknown, max = 32): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, '')
    .replace(/[§"'\\{}[\]@`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** Identificador plano (para usar como nombre de jugador/objetivo): solo [A-Za-z0-9_.]. */
export function safeIdent(value: unknown, max = 24): string {
  const s = String(value ?? '')
    .replace(/[^A-Za-z0-9_.]/g, '')
    .slice(0, max)
  return s || 'anon'
}

/** Nick de Minecraft Java: 3-16 caracteres [A-Za-z0-9_]. */
export const MC_PLAYER_RE = /^[A-Za-z0-9_]{3,16}$/
export function isValidPlayerName(name: string): boolean {
  return MC_PLAYER_RE.test(name)
}

/** Normaliza "@usuario", "https://www.tiktok.com/@usuario/live" → "usuario". */
export function normalizeTikTokUser(value: string): string {
  const s = String(value ?? '').trim()
  const fromUrl = s.match(/tiktok\.com\/@([^/?#\s]+)/i)
  return (fromUrl ? fromUrl[1]! : s).replace(/^@/, '').trim()
}
