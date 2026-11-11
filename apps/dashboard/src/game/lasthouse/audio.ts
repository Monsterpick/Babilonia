/**
 * LAST HOUSE — sonido propio, todo sintetizado con WebAudio (sin archivos de audio de nadie).
 *  - Efectos cortos para cada cosa que pasa en el juego (brotar, disparo, golpe, explosión, rugido, rayo…).
 *  - Música generativa: un bajo y un arpegio en modo menor que suben de intensidad (tempo, capas, percusión)
 *    según lo apretada que esté la partida.
 * El navegador solo deja sonar audio después de una pulsación del usuario: `unlock()` se llama al empezar.
 */
import type { Fx } from './sim'

type Wave = OscillatorType

export class Sound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sfx: GainNode | null = null
  private music: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private muted = false
  private nextNote = 0
  private step = 0
  /** 0..1: lo intensa que suena la música */
  intensity = 0.2
  private lastAt = new Map<string, number>()
  private volume = 0.8

  constructor(volume = 0.8, muted = false) {
    this.volume = volume
    this.muted = muted
  }

  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume()
      return
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : this.volume
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 4
    this.master.connect(comp).connect(ctx.destination)
    this.sfx = ctx.createGain()
    this.sfx.gain.value = 0.7
    this.sfx.connect(this.master)
    this.music = ctx.createGain()
    this.music.gain.value = 0.32
    this.music.connect(this.master)
    const len = ctx.sampleRate
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = this.noiseBuf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    this.nextNote = ctx.currentTime + 0.1
  }

  get isMuted(): boolean {
    return this.muted
  }

  setMuted(m: boolean): void {
    this.muted = m
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05)
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v))
    if (!this.muted) this.setMuted(false)
  }

  dispose(): void {
    void this.ctx?.close()
    this.ctx = null
  }

  // ───────────────────────────── piezas ─────────────────────────────

  /** Evita que 200 golpes en el mismo fotograma saturen: como mucho uno de cada tipo cada `gap` s. */
  private ok(key: string, gap: number): boolean {
    const now = this.ctx?.currentTime ?? 0
    if ((this.lastAt.get(key) ?? -1) + gap > now) return false
    this.lastAt.set(key, now)
    return true
  }

  private tone(freq: number, dur: number, type: Wave, vol: number, slide = 0, at = 0, dest?: AudioNode): void {
    const ctx = this.ctx
    if (!ctx || this.muted) return
    const t = ctx.currentTime + at
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(dest ?? this.sfx!)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  private noise(dur: number, vol: number, freq: number, q = 1, type: BiquadFilterType = 'lowpass', at = 0, dest?: AudioNode, sweep = 0): void {
    const ctx = this.ctx
    if (!ctx || !this.noiseBuf || this.muted) return
    const t = ctx.currentTime + at
    const s = ctx.createBufferSource()
    s.buffer = this.noiseBuf
    s.loop = true
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(freq, t)
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(30, freq * sweep), t + dur)
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    s.connect(f).connect(g).connect(dest ?? this.sfx!)
    s.start(t, Math.random() * 0.5)
    s.stop(t + dur + 0.02)
  }

  // ───────────────────────────── efectos ─────────────────────────────

  play(fx: Fx[]): void {
    if (!this.ctx || this.muted) return
    for (const f of fx) {
      switch (f.type) {
        case 'plant':
          if (this.ok('plant', 0.06)) {
            this.noise(0.12, 0.25, 900, 1, 'lowpass')
            this.tone(330, 0.16, 'triangle', 0.18, 2)
          }
          break
        case 'break':
          if (this.ok('break', 0.08)) {
            this.noise(0.3, 0.4, 1600, 0.8, 'bandpass', 0, undefined, 0.3)
            this.tone(160, 0.25, 'square', 0.08, 0.5)
          }
          break
        case 'hit':
          if (this.ok('hit', 0.045)) this.noise(0.07, f.big ? 0.35 : 0.18, f.big ? 1200 : 2500, 2, 'bandpass')
          break
        case 'kingHurt':
          if (this.ok('hurt', 0.15)) this.tone(140, 0.22, 'sawtooth', 0.14, 0.6)
          break
        case 'boom':
          if (this.ok('boom', 0.07)) {
            this.noise(0.9, 0.7, 700, 0.7, 'lowpass', 0, undefined, 0.12)
            this.tone(70, 0.6, 'sine', 0.5, 0.4)
          }
          break
        case 'swipe':
          if (this.ok('swipe', 0.08)) this.noise(0.14, 0.22, 3000, 1.5, 'bandpass', 0, undefined, 0.35)
          break
        case 'roar':
          this.tone(90, 0.9, 'sawtooth', 0.22, 0.6)
          this.tone(134, 0.9, 'sawtooth', 0.14, 0.55)
          this.noise(0.9, 0.3, 500, 1, 'lowpass')
          break
        case 'pulse':
          this.tone(220, 0.5, 'sine', 0.3, 3)
          this.noise(0.5, 0.25, 2000, 1, 'highpass', 0, undefined, 0.2)
          break
        case 'dash':
          this.noise(0.3, 0.3, 600, 1, 'bandpass', 0, undefined, 4)
          break
        case 'summon':
          for (let i = 0; i < 3; i++) this.tone(196 * (1 + i * 0.5), 0.3, 'triangle', 0.1, 0.7, i * 0.06)
          break
        case 'shoot':
          if (this.ok('shoot', 0.05)) this.tone(520, 0.08, 'square', 0.06, 0.45)
          break
        case 'zombieDown':
          if (this.ok('zdown', 0.06)) {
            this.tone(f.big ? 80 : 200, f.big ? 0.8 : 0.2, 'sawtooth', f.big ? 0.3 : 0.08, 0.4)
            this.noise(f.big ? 0.8 : 0.15, f.big ? 0.5 : 0.15, 800, 1, 'lowpass')
          }
          break
        case 'spawn':
          if (f.big) {
            this.tone(55, 1.4, 'sawtooth', 0.3, 0.7)
            this.tone(82, 1.4, 'square', 0.12, 0.7)
          }
          break
        case 'houseHit':
          if (this.ok('house', 0.25)) {
            this.noise(0.18, 0.3, 400, 3, 'bandpass')
            this.tone(110, 0.15, 'square', 0.08, 0.7)
          }
          break
        case 'surface':
          if (this.ok('surface', 0.2)) this.noise(0.4, 0.35, 300, 1, 'lowpass', 0, undefined, 3)
          break
        case 'lightning':
          if (this.ok('bolt', 0.1)) {
            this.noise(1.4, 0.8, 4000, 0.5, 'lowpass', 0, undefined, 0.05)
            this.tone(50, 1, 'sine', 0.4, 0.5, 0.02)
          }
          break
        case 'assault':
          ;[392, 494, 587, 784].forEach((n, i) => this.tone(n, 0.35, 'square', 0.12, 1, i * 0.09))
          break
        case 'wave':
          this.tone(147, 0.6, 'sawtooth', 0.16, 1.5)
          this.tone(220, 0.6, 'sawtooth', 0.1, 1.5, 0.15)
          break
        case 'event':
          ;[523, 659, 784, 1046].forEach((n, i) => this.tone(n, 0.25, 'triangle', 0.13, 1, i * 0.06))
          break
        case 'down':
          ;[330, 262, 196].forEach((n, i) => this.tone(n, 0.3, 'square', 0.1, 0.9, i * 0.14))
          break
        case 'end':
          {
            const good = f.winner === 'rey' || f.winner === 'guardian'
            const notes = good ? [392, 494, 587, 784, 988] : [392, 370, 330, 262, 196]
            notes.forEach((n, i) => this.tone(n, 0.45, 'square', 0.12, 1, i * 0.16))
          }
          break
        default:
          break
      }
    }
  }

  /** Clic de interfaz (votos, botones). */
  blip(high = false): void {
    this.tone(high ? 880 : 660, 0.08, 'triangle', 0.1)
  }

  // ───────────────────────────── música ─────────────────────────────

  /** Se llama cada fotograma; programa las notas de los próximos 0,2 s. */
  update(playing: boolean): void {
    const ctx = this.ctx
    if (!ctx || !this.music || this.muted || !playing) return
    const k = Math.max(0, Math.min(1, this.intensity))
    const bpm = 96 + k * 50
    const sixteenth = 60 / bpm / 4
    if (this.nextNote < ctx.currentTime - 0.5) this.nextNote = ctx.currentTime + 0.05
    // progresión en La menor: i – VI – III – VII (compás a compás)
    const ROOTS = [110, 87.31, 130.81, 98]
    const ARP = [0, 3, 7, 12, 7, 3, 10, 7]
    while (this.nextNote < ctx.currentTime + 0.2) {
      const at = this.nextNote - ctx.currentTime
      const bar = Math.floor(this.step / 16) % 4
      const s16 = this.step % 16
      const root = ROOTS[bar]!
      // bajo: corcheas (negras si está tranquilo)
      if (s16 % (k > 0.4 ? 2 : 4) === 0) this.tone(root / 2, sixteenth * 1.8, 'triangle', 0.22, 1, at, this.music)
      // arpegio: aparece con algo de tensión
      if (k > 0.25 && s16 % 2 === 0) {
        const semi = ARP[(s16 / 2) % ARP.length]!
        this.tone(root * 2 * Math.pow(2, semi / 12), sixteenth * 1.5, 'square', 0.035 + k * 0.03, 1, at, this.music)
      }
      // percusión: bombo y caja con intensidad media; charles con intensidad alta
      if (k > 0.35 && s16 % 8 === 0) this.tone(60, 0.18, 'sine', 0.35, 0.4, at, this.music)
      if (k > 0.5 && s16 % 8 === 4) this.noise(0.12, 0.18, 1800, 0.8, 'bandpass', at, this.music)
      if (k > 0.7 && s16 % 2 === 1) this.noise(0.04, 0.06, 7000, 1, 'highpass', at, this.music)
      this.nextNote += sixteenth
      this.step++
    }
  }
}
