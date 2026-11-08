/** Memoria LRU acotada de ids ya vistos. O(1) por operación. */
export class Deduper {
  private readonly seen = new Set<string>()
  constructor(private readonly max = 5000) {}

  /** true si el id es nuevo (y lo recuerda); false si es duplicado. */
  accept(id: string | null | undefined): boolean {
    if (!id) return true
    if (this.seen.has(id)) return false
    this.seen.add(id)
    if (this.seen.size > this.max) {
      const oldest = this.seen.values().next().value
      if (oldest !== undefined) this.seen.delete(oldest)
    }
    return true
  }

  clear(): void {
    this.seen.clear()
  }

  get size(): number {
    return this.seen.size
  }
}
