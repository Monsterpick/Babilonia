/**
 * Voces del TTS.
 * Una «voz» se guarda como texto:
 *   p:<id>      personaje (voz del PC + tono/velocidad/efecto)
 *   b:<nombre>  voz del navegador/OBS tal cual
 *   w:<nombre>  voz de Windows (SAPI, 32 y 64 bits: aquí aparecen voces instaladas aparte, como Loquendo)
 *   <nombre>    (formato antiguo) = b:<nombre>
 *   ''          la voz por defecto (o aleatoria si está activado)
 */
export type VoiceEffect = 'none' | 'robot' | 'eco' | 'radio' | 'grave' | 'agudo'

export interface VoicePreset {
  id: string
  name: string
  emoji: string
  desc: string
  /** Pistas para elegir la voz del PC: idioma y género. */
  lang: string
  gender?: 'male' | 'female'
  pitch: number
  rate: number
  /** Solo se aplica a voces de Windows (audio generado en el PC). */
  effect: VoiceEffect
  /** Palabras que valen para !voz <palabra>. */
  keywords: string[]
}

export const VOICE_PRESETS: VoicePreset[] = [
  { id: 'robotica_h', name: 'Robótica clásica · hombre', emoji: '🤖', desc: 'Voz grave y mecánica, al estilo de los lectores robóticos de los 2000.', lang: 'es', gender: 'male', pitch: 0.72, rate: 1.18, effect: 'robot', keywords: ['robot', 'robotico', 'loquendo', 'jorge', 'hombre'] },
  { id: 'robotica_m', name: 'Robótica clásica · mujer', emoji: '🤖', desc: 'Voz aguda y mecánica, al estilo de los lectores robóticos de los 2000.', lang: 'es', gender: 'female', pitch: 1.22, rate: 1.18, effect: 'robot', keywords: ['robotica', 'carmen', 'mujer'] },
  { id: 'narrador', name: 'Narrador', emoji: '🎙️', desc: 'Grave y pausado, como un tráiler de cine.', lang: 'es', gender: 'male', pitch: 0.82, rate: 0.92, effect: 'none', keywords: ['narrador', 'cine'] },
  { id: 'presentadora', name: 'Presentadora', emoji: '📺', desc: 'Clara y con energía.', lang: 'es', gender: 'female', pitch: 1.05, rate: 1.08, effect: 'none', keywords: ['presentadora', 'tele'] },
  { id: 'ardilla', name: 'Ardilla', emoji: '🐿️', desc: 'Aguda y rapidísima.', lang: 'es', pitch: 2, rate: 1.4, effect: 'agudo', keywords: ['ardilla', 'chipmunk'] },
  { id: 'gigante', name: 'Gigante', emoji: '🗿', desc: 'Muy grave y lenta.', lang: 'es', gender: 'male', pitch: 0.1, rate: 0.78, effect: 'grave', keywords: ['gigante', 'grave', 'monstruo'] },
  { id: 'nino', name: 'Niño', emoji: '🧒', desc: 'Aguda y alegre.', lang: 'es', gender: 'female', pitch: 1.7, rate: 1.12, effect: 'none', keywords: ['nino', 'niño', 'peque'] },
  { id: 'abuelo', name: 'Abuelo', emoji: '👴', desc: 'Grave y muy despacio.', lang: 'es', gender: 'male', pitch: 0.55, rate: 0.7, effect: 'none', keywords: ['abuelo', 'anciano', 'viejo'] },
  { id: 'fantasma', name: 'Fantasma', emoji: '👻', desc: 'Lenta, grave y con eco.', lang: 'es', pitch: 0.4, rate: 0.62, effect: 'eco', keywords: ['fantasma', 'eco', 'terror'] },
  { id: 'radio', name: 'Radio antigua', emoji: '📻', desc: 'Como una radio o un walkie.', lang: 'es', pitch: 1, rate: 1.05, effect: 'radio', keywords: ['radio', 'walkie'] },
  { id: 'turbo', name: 'Turbo', emoji: '⚡', desc: 'Lee el doble de rápido.', lang: 'es', pitch: 1.1, rate: 1.9, effect: 'none', keywords: ['turbo', 'rapido'] },
  { id: 'mexico', name: 'Acento mexicano', emoji: '🇲🇽', desc: 'Usa una voz de México si la tienes instalada.', lang: 'es-MX', pitch: 1, rate: 1, effect: 'none', keywords: ['mexico', 'mexicano'] },
  { id: 'espana', name: 'Acento de España', emoji: '🇪🇸', desc: 'Usa una voz de España si la tienes instalada.', lang: 'es-ES', pitch: 1, rate: 1, effect: 'none', keywords: ['espana', 'españa', 'español'] },
  { id: 'gringo', name: 'Gringo', emoji: '🇺🇸', desc: 'Una voz en inglés leyendo en español (muy graciosa).', lang: 'en', pitch: 1, rate: 1, effect: 'none', keywords: ['gringo', 'ingles', 'english'] },
]

export const presetById = (id: string) => VOICE_PRESETS.find((p) => p.id === id)

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Busca un personaje por id, nombre o palabra clave (para !voz <palabra>). */
export function findPreset(word: string): VoicePreset | undefined {
  const w = norm(word.trim())
  if (!w) return undefined
  return VOICE_PRESETS.find((p) => p.id === w || norm(p.name).startsWith(w) || p.keywords.some((k) => norm(k) === w))
}

export type VoiceSpec = { kind: 'preset'; preset: VoicePreset } | { kind: 'browser'; name: string } | { kind: 'windows'; name: string } | { kind: 'default' }

export function parseVoice(v: string | undefined | null): VoiceSpec {
  const s = (v ?? '').trim()
  if (!s) return { kind: 'default' }
  if (s.startsWith('p:')) {
    const preset = presetById(s.slice(2))
    return preset ? { kind: 'preset', preset } : { kind: 'default' }
  }
  if (s.startsWith('w:')) return { kind: 'windows', name: s.slice(2) }
  if (s.startsWith('b:')) return { kind: 'browser', name: s.slice(2) }
  return { kind: 'browser', name: s }
}

/** Nombre legible de una voz guardada. */
export function voiceLabel(v: string | undefined | null): string {
  const p = parseVoice(v)
  if (p.kind === 'preset') return `${p.preset.emoji} ${p.preset.name}`
  if (p.kind === 'windows') return `🪟 ${p.name}`
  if (p.kind === 'browser') return p.name
  return 'Por defecto'
}

/* --------------------- elegir una voz del navegador por pistas --------------------- */

const MALE = /\b(pablo|raul|raúl|jorge|diego|juan|enrique|miguel|alvaro|álvaro|carlos|andres|andrés|gonzalo|jose|josé|antonio|federico|tomas|tomás|hombre|male|david|mark|guy|daniel|alex|fred)\b/i
const FEMALE = /\b(helena|sabina|laura|monica|mónica|paulina|elvira|dalia|lucia|lucía|conchita|penelope|penélope|elena|carmen|dolores|ximena|paloma|marisol|mujer|female|zira|susan|samantha|google español|google español de estados unidos|isabela|valentina)\b/i

export function guessGender(name: string): 'male' | 'female' | undefined {
  if (FEMALE.test(name)) return 'female'
  if (MALE.test(name)) return 'male'
  return undefined
}

export interface BasicVoice {
  name: string
  lang: string
}

/** Elige la mejor voz instalada para un personaje (idioma exacto > idioma > género). */
export function pickBrowserVoice<V extends BasicVoice>(voices: V[], lang: string, gender?: 'male' | 'female', seed = 0): V | undefined {
  const l = lang.toLowerCase()
  const base = l.split('-')[0]!
  const byLang = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(l))
  const byBase = byLang.length ? byLang : voices.filter((v) => v.lang.toLowerCase().startsWith(base))
  const pool = byBase.length ? byBase : voices
  if (!pool.length) return undefined
  const g = gender ? pool.filter((v) => guessGender(v.name) === gender) : []
  const list = g.length ? g : pool
  return list[Math.abs(seed) % list.length]
}
