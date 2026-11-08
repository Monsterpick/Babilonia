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

/** URL base para overlays (lo que se pega en OBS / TikTok LIVE Studio). */
export function overlayUrl(name: string, params: Record<string, string> = {}): string {
  const origin = window.location.port === '5173' ? 'http://127.0.0.1:7420' : window.location.origin
  const q = new URLSearchParams(params).toString()
  return `${origin}/overlay/${name}${q ? `?${q}` : ''}`
}
