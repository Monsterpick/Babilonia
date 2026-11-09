import { parseVoice, pickBrowserVoice, VOICE_PRESETS, type VoiceEffect } from '@livearena/shared'

/** Voces instaladas (navegador/OBS). En Chrome/OBS para Windows salen las voces de Windows modernas. */
export function browserVoices(): SpeechSynthesisVoice[] {
  return typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis.getVoices() : []
}

let rnd = 0

/** Crea la locución para una voz guardada (personaje, voz del navegador o por defecto). */
export function utterance(text: string, voice: string, rate = 1, volume = 1, random = false): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text)
  const list = browserVoices()
  const spec = parseVoice(voice)
  let pitch = 1
  let r = rate
  if (spec.kind === 'preset') {
    u.voice = pickBrowserVoice(list, spec.preset.lang, spec.preset.gender) ?? null
    pitch = spec.preset.pitch
    r = rate * spec.preset.rate
  } else if (spec.kind === 'browser') {
    u.voice = list.find((v) => v.name === spec.name || v.voiceURI === spec.name) ?? pickBrowserVoice(list, 'es') ?? null
  } else if (random) {
    // Aleatoria: un personaje distinto cada vez.
    const p = VOICE_PRESETS[rnd++ % VOICE_PRESETS.length]!
    u.voice = pickBrowserVoice(list, p.lang, p.gender, rnd) ?? null
    pitch = p.pitch
    r = rate * p.rate
  } else u.voice = pickBrowserVoice(list, 'es') ?? null
  u.pitch = Math.max(0, Math.min(2, pitch))
  u.rate = Math.max(0.1, Math.min(4, r))
  u.volume = volume
  return u
}

/** Lee ya (cancela lo anterior). Para probar en el panel. */
export function speakNow(text: string, voice: string, rate = 1, volume = 1) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance(text, voice, rate, volume))
}

let ctx: AudioContext | null = null

/** Reproduce un .wav (voces de Windows) con un efecto. Resuelve al terminar. */
export async function playAudio(url: string, effect: VoiceEffect = 'none', volume = 1): Promise<void> {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined)
  const buf = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer())
  const src = ctx.createBufferSource()
  src.buffer = buf
  const out = ctx.createGain()
  out.gain.value = volume
  let node: AudioNode = src
  const chain = (n: AudioNode) => {
    node.connect(n)
    node = n
  }
  if (effect === 'grave') src.playbackRate.value = 0.78
  if (effect === 'agudo') src.playbackRate.value = 1.35
  if (effect === 'robot') {
    // Modulación en anillo: el clásico timbre metálico.
    const ring = ctx.createGain()
    ring.gain.value = 0
    const osc = ctx.createOscillator()
    osc.frequency.value = 55
    osc.connect(ring.gain)
    osc.start()
    chain(ring)
    src.onended = () => osc.stop()
  }
  if (effect === 'radio') {
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 500
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 3200
    const sh = ctx.createWaveShaper()
    const curve = new Float32Array(256)
    for (let i = 0; i < 256; i++) curve[i] = Math.tanh(((i / 128 - 1) * 3))
    sh.curve = curve
    chain(hp)
    chain(lp)
    chain(sh)
  }
  if (effect === 'eco') {
    const dry = ctx.createGain()
    const delay = ctx.createDelay(1)
    delay.delayTime.value = 0.28
    const fb = ctx.createGain()
    fb.gain.value = 0.42
    node.connect(dry)
    node.connect(delay)
    delay.connect(fb)
    fb.connect(delay)
    dry.connect(out)
    delay.connect(out)
    out.connect(ctx.destination)
    src.start()
    await new Promise<void>((res) => (src.onended = () => setTimeout(res, 900)))
    return
  }
  chain(out)
  out.connect(ctx.destination)
  src.start()
  await new Promise<void>((res) => {
    const prev = src.onended
    src.onended = (e) => {
      if (typeof prev === 'function') prev.call(src, e)
      res()
    }
  })
}
