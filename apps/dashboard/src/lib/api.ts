/** Cliente de la API local. Siempre manda JSON en peticiones que cambian algo (protección CSRF). */
export async function api<T = any>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown): Promise<T> {
  const send = method !== 'GET'
  const r = await fetch(url, {
    method,
    headers: send ? { 'content-type': 'application/json' } : undefined,
    body: send ? JSON.stringify(body ?? {}) : undefined,
  })
  const text = await r.text()
  const data = text ? JSON.parse(text) : null
  if (!r.ok) throw new Error(data?.error ?? `Error ${r.status}`)
  return data as T
}

export async function upload(url: string, file: File): Promise<any> {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-filename': file.name }, body: file })
  const data = await r.json()
  if (!r.ok) throw new Error(data?.error ?? `Error ${r.status}`)
  return data
}

/**
 * Enlace fijo de un overlay para OBS y TikTok LIVE Studio: http://127.0.0.1:<puerto>/<overlay>.html
 * (LIVE Studio rechaza «localhost»; con 127.0.0.1 y .html lo acepta). No cambia nunca: mismo overlay, mismo enlace.
 * Una escena va como /escena-<id>.html. Los parámetros extra (p. ej. demo=1, solo para vistas previas) van detrás.
 */
export function overlayUrl(name: string, params: Record<string, string> = {}): string {
  const port = window.location.port && window.location.port !== '5173' ? window.location.port : '7420'
  const rest = { ...params }
  let file = name
  if (name === 'escena' && rest.s) {
    file = `escena-${rest.s}`
    delete rest.s
  }
  const q = new URLSearchParams(rest).toString()
  return `http://127.0.0.1:${port}/${file}.html${q ? `?${q}` : ''}`
}
