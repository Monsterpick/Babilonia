/**
 * Cola de prioridad (montículo binario). Mayor prioridad sale antes; a igual prioridad, FIFO.
 * Si se llena, se descarta el elemento de MENOR prioridad (nunca un regalo grande por 200 rosas).
 */
export class PriorityQueue<T> {
  private heap: { item: T; priority: number; seq: number }[] = []
  private seq = 0

  constructor(private readonly maxSize = Infinity) {}

  get size(): number {
    return this.heap.length
  }

  /** Devuelve el elemento descartado si la cola estaba llena. */
  push(item: T, priority: number): { dropped?: T } {
    const node = { item, priority, seq: this.seq++ }
    if (this.heap.length >= this.maxSize) {
      const minIdx = this.indexOfLowest()
      const lowest = this.heap[minIdx]!
      if (this.compare(node, lowest) <= 0) return { dropped: item }
      this.removeAt(minIdx)
      this.insert(node)
      return { dropped: lowest.item }
    }
    this.insert(node)
    return {}
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined
    const top = this.heap[0]!
    const last = this.heap.pop()!
    if (this.heap.length > 0) {
      this.heap[0] = last
      this.down(0)
    }
    return top.item
  }

  peek(): T | undefined {
    return this.heap[0]?.item
  }

  clear(): T[] {
    const items = this.heap.map((n) => n.item)
    this.heap = []
    return items
  }

  toArray(): T[] {
    return [...this.heap].sort((a, b) => -this.compare(a, b)).map((n) => n.item)
  }

  /** >0 si a debe salir antes que b. */
  private compare(a: { priority: number; seq: number }, b: { priority: number; seq: number }): number {
    return a.priority !== b.priority ? a.priority - b.priority : b.seq - a.seq
  }

  private insert(node: { item: T; priority: number; seq: number }): void {
    this.heap.push(node)
    this.up(this.heap.length - 1)
  }

  private indexOfLowest(): number {
    let idx = 0
    for (let i = 1; i < this.heap.length; i++) if (this.compare(this.heap[i]!, this.heap[idx]!) < 0) idx = i
    return idx
  }

  private removeAt(i: number): void {
    const last = this.heap.pop()!
    if (i < this.heap.length) {
      this.heap[i] = last
      this.down(i)
      this.up(i)
    }
  }

  private up(i: number): void {
    const h = this.heap
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.compare(h[i]!, h[p]!) <= 0) break
      ;[h[i], h[p]] = [h[p]!, h[i]!]
      i = p
    }
  }

  private down(i: number): void {
    const h = this.heap
    for (;;) {
      const l = 2 * i + 1
      const r = l + 1
      let best = i
      if (l < h.length && this.compare(h[l]!, h[best]!) > 0) best = l
      if (r < h.length && this.compare(h[r]!, h[best]!) > 0) best = r
      if (best === i) return
      ;[h[i], h[best]] = [h[best]!, h[i]!]
      i = best
    }
  }
}

/** Token bucket: `perSecond` de media con ráfagas de hasta `burst`. */
export class TokenBucket {
  private tokens: number
  private last: number

  constructor(
    private readonly perSecond: number,
    private readonly burst: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = burst
    this.last = now()
  }

  /** Milisegundos a esperar antes de poder consumir 1 token (0 = ya). */
  waitTime(): number {
    this.refill()
    if (this.tokens >= 1) return 0
    return Math.ceil(((1 - this.tokens) / this.perSecond) * 1000)
  }

  tryTake(): boolean {
    this.refill()
    if (this.tokens >= 1) {
      this.tokens -= 1
      return true
    }
    return false
  }

  private refill(): void {
    const t = this.now()
    this.tokens = Math.min(this.burst, this.tokens + ((t - this.last) / 1000) * this.perSecond)
    this.last = t
  }
}

export interface WorkerStats {
  pending: number
  processed: number
  dropped: number
  failed: number
  running: boolean
  paused: boolean
}

/**
 * Consume una PriorityQueue de trabajos asíncronos, de uno en uno (orden legible en pantalla),
 * respetando un token bucket. Un fallo de un trabajo no detiene la cola.
 */
export class PriorityWorker<T> {
  private readonly queue: PriorityQueue<T>
  private readonly bucket: TokenBucket | null
  private running = false
  private paused = false
  private processed = 0
  private dropped = 0
  private failed = 0
  private wake: (() => void) | null = null

  constructor(
    private readonly handler: (item: T) => Promise<void>,
    opts: { maxSize?: number; perSecond?: number; burst?: number; onDrop?: (item: T) => void; onError?: (err: unknown, item: T) => void } = {},
  ) {
    this.queue = new PriorityQueue<T>(opts.maxSize ?? 2000)
    this.bucket = opts.perSecond ? new TokenBucket(opts.perSecond, opts.burst ?? opts.perSecond) : null
    this.onDrop = opts.onDrop
    this.onError = opts.onError
  }

  private readonly onDrop?: (item: T) => void
  private readonly onError?: (err: unknown, item: T) => void

  push(item: T, priority: number): void {
    const { dropped } = this.queue.push(item, priority)
    if (dropped !== undefined) {
      this.dropped += 1
      this.onDrop?.(dropped)
    }
    this.kick()
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
    this.kick()
  }

  clear(): number {
    return this.queue.clear().length
  }

  pending(): T[] {
    return this.queue.toArray()
  }

  stats(): WorkerStats {
    return { pending: this.queue.size, processed: this.processed, dropped: this.dropped, failed: this.failed, running: this.running, paused: this.paused }
  }

  /** Resuelve cuando la cola queda vacía (útil en tests). */
  async drain(): Promise<void> {
    while (this.queue.size > 0 || this.running) await new Promise((r) => setTimeout(r, 5))
  }

  private kick(): void {
    if (this.wake) {
      const w = this.wake
      this.wake = null
      w()
    }
    if (!this.running) void this.loop()
  }

  private async loop(): Promise<void> {
    this.running = true
    try {
      while (this.queue.size > 0 && !this.paused) {
        if (this.bucket) {
          const wait = this.bucket.waitTime()
          if (wait > 0) {
            await new Promise<void>((r) => {
              const t = setTimeout(r, wait)
              this.wake = () => {
                clearTimeout(t)
                r()
              }
            })
            continue
          }
          this.bucket.tryTake()
        }
        const item = this.queue.pop()
        if (item === undefined) break
        try {
          await this.handler(item)
          this.processed += 1
        } catch (err) {
          this.failed += 1
          this.onError?.(err, item)
        }
      }
    } finally {
      this.running = false
    }
  }
}
