/** Color de acento y escala de la interfaz. Se guardan en este equipo (localStorage). */

export interface Palette {
  id: string
  name: string
  swatch: string
  accent: string
  accent2: string
  hot: string
  coral: string
}

export const PALETTES: Palette[] = [
  { id: 'aurora', name: 'Aurora', swatch: '#8b5cf6', accent: '#8b5cf6', accent2: '#a78bfa', hot: '#f43f9e', coral: '#ff7a59' },
  { id: 'aguamarina', name: 'Aguamarina', swatch: '#22d3ee', accent: '#22d3ee', accent2: '#67e8f9', hot: '#14b8a6', coral: '#2dd4bf' },
  { id: 'carmesi', name: 'Carmesí', swatch: '#fb3b6b', accent: '#fb3b6b', accent2: '#ff7aa0', hot: '#e11d48', coral: '#ff6a3d' },
  { id: 'rojo', name: 'Rojo', swatch: '#ef4444', accent: '#ef4444', accent2: '#f87171', hot: '#dc2626', coral: '#fb923c' },
  { id: 'dorado', name: 'Dorado', swatch: '#d4a017', accent: '#e0a500', accent2: '#ffd24d', hot: '#f59e0b', coral: '#ffb020' },
  { id: 'lima', name: 'Lima', swatch: '#4ade2f', accent: '#4ade2f', accent2: '#86efac', hot: '#16a34a', coral: '#a3e635' },
  { id: 'violeta', name: 'Violeta', swatch: '#a855f7', accent: '#a855f7', accent2: '#c084fc', hot: '#7c3aed', coral: '#e879f9' },
  { id: 'ambar', name: 'Ámbar', swatch: '#ff8a1e', accent: '#ff8a1e', accent2: '#ffb259', hot: '#f97316', coral: '#fbbf24' },
  { id: 'zafiro', name: 'Zafiro', swatch: '#3b82f6', accent: '#3b82f6', accent2: '#60a5fa', hot: '#2563eb', coral: '#38bdf8' },
  { id: 'fucsia', name: 'Fucsia', swatch: '#ec28b9', accent: '#ec28b9', accent2: '#f472d0', hot: '#db2777', coral: '#f0abfc' },
  { id: 'esmeralda', name: 'Esmeralda', swatch: '#10b981', accent: '#10b981', accent2: '#34d399', hot: '#059669', coral: '#2dd4bf' },
]

const KEY_COLOR = 'la.palette'
const KEY_SCALE = 'la.scale'

export function getPalette(): string {
  try {
    return localStorage.getItem(KEY_COLOR) ?? 'aurora'
  } catch {
    return 'aurora'
  }
}

export function getScale(): number {
  try {
    return Number(localStorage.getItem(KEY_SCALE)) || 100
  } catch {
    return 100
  }
}

export function applyPalette(id: string): void {
  const p = PALETTES.find((x) => x.id === id) ?? PALETTES[0]!
  const r = document.documentElement.style
  r.setProperty('--color-accent', p.accent)
  r.setProperty('--color-accent-2', p.accent2)
  r.setProperty('--color-hot', p.hot)
  r.setProperty('--color-coral', p.coral)
  try {
    localStorage.setItem(KEY_COLOR, id)
  } catch {
    /* modo privado */
  }
}

export function applyScale(pct: number): void {
  const clamped = Math.max(60, Math.min(200, pct))
  // `zoom` escala todo (Chromium / Electron / navegador de OBS lo soportan).
  ;(document.documentElement.style as unknown as Record<string, string>).zoom = String(clamped / 100)
  try {
    localStorage.setItem(KEY_SCALE, String(clamped))
  } catch {
    /* modo privado */
  }
}

/** Aplica el tema guardado al arrancar (solo en el panel, no en los overlays). */
export function initTheme(): void {
  applyPalette(getPalette())
  applyScale(getScale())
}
