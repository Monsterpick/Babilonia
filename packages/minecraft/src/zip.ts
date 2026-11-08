import fs from 'node:fs/promises'
import zlib from 'node:zlib'

/** Entrada de un .zip/.jar leída del directorio central. */
export interface ZipEntry {
  name: string
  method: number
  compressedSize: number
  size: number
  offset: number
}

/** Lector mínimo de zip (solo lectura, store/deflate). Suficiente para los .jar de Minecraft. */
export class ZipReader {
  private constructor(
    private fh: fs.FileHandle,
    readonly entries: ZipEntry[],
  ) {}

  static async open(file: string): Promise<ZipReader> {
    const fh = await fs.open(file, 'r')
    try {
      const { size } = await fh.stat()
      // El registro de fin de directorio central está en los últimos 64 KB + 22 bytes.
      const tailLen = Math.min(size, 65_557)
      const tail = Buffer.alloc(tailLen)
      await fh.read(tail, 0, tailLen, size - tailLen)
      let eocd = -1
      for (let i = tailLen - 22; i >= 0; i--) {
        if (tail.readUInt32LE(i) === 0x06054b50) {
          eocd = i
          break
        }
      }
      if (eocd < 0) throw new Error('No es un archivo zip/jar válido')
      let count = tail.readUInt16LE(eocd + 10)
      let cdSize = tail.readUInt32LE(eocd + 12)
      let cdOffset = tail.readUInt32LE(eocd + 16)
      // ZIP64
      if (cdOffset === 0xffffffff || count === 0xffff) {
        const loc = eocd - 20
        if (loc >= 0 && tail.readUInt32LE(loc) === 0x07064b50) {
          const z64 = Number(tail.readBigUInt64LE(loc + 8))
          const rec = Buffer.alloc(56)
          await fh.read(rec, 0, 56, z64)
          count = Number(rec.readBigUInt64LE(32))
          cdSize = Number(rec.readBigUInt64LE(40))
          cdOffset = Number(rec.readBigUInt64LE(48))
        }
      }
      const cd = Buffer.alloc(cdSize)
      await fh.read(cd, 0, cdSize, cdOffset)
      const entries: ZipEntry[] = []
      let p = 0
      for (let i = 0; i < count && p + 46 <= cd.length; i++) {
        if (cd.readUInt32LE(p) !== 0x02014b50) break
        const method = cd.readUInt16LE(p + 10)
        let compressedSize = cd.readUInt32LE(p + 20)
        let usize = cd.readUInt32LE(p + 24)
        const nameLen = cd.readUInt16LE(p + 28)
        const extraLen = cd.readUInt16LE(p + 30)
        const commentLen = cd.readUInt16LE(p + 32)
        let offset = cd.readUInt32LE(p + 42)
        const name = cd.toString('utf8', p + 46, p + 46 + nameLen)
        // Campos ZIP64 en el extra
        let e = p + 46 + nameLen
        const eEnd = e + extraLen
        while (e + 4 <= eEnd) {
          const id = cd.readUInt16LE(e)
          const len = cd.readUInt16LE(e + 2)
          if (id === 0x0001) {
            let q = e + 4
            if (usize === 0xffffffff) (usize = Number(cd.readBigUInt64LE(q))), (q += 8)
            if (compressedSize === 0xffffffff) (compressedSize = Number(cd.readBigUInt64LE(q))), (q += 8)
            if (offset === 0xffffffff) offset = Number(cd.readBigUInt64LE(q))
          }
          e += 4 + len
        }
        entries.push({ name, method, compressedSize, size: usize, offset })
        p += 46 + nameLen + extraLen + commentLen
      }
      return new ZipReader(fh, entries)
    } catch (err) {
      await fh.close()
      throw err
    }
  }

  async read(entry: ZipEntry): Promise<Buffer> {
    const head = Buffer.alloc(30)
    await this.fh.read(head, 0, 30, entry.offset)
    if (head.readUInt32LE(0) !== 0x04034b50) throw new Error(`Entrada dañada: ${entry.name}`)
    const start = entry.offset + 30 + head.readUInt16LE(26) + head.readUInt16LE(28)
    const raw = Buffer.alloc(entry.compressedSize)
    await this.fh.read(raw, 0, entry.compressedSize, start)
    if (entry.method === 0) return raw
    if (entry.method === 8) return zlib.inflateRawSync(raw)
    throw new Error(`Compresión no soportada (${entry.method}) en ${entry.name}`)
  }

  close(): Promise<void> {
    return this.fh.close()
  }
}
