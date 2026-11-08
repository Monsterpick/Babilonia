/** Primer import: node:sqlite es estable en la práctica; ocultamos su aviso de "experimental". */
const emit = process.emitWarning.bind(process)
process.emitWarning = ((w: string | Error, ...rest: unknown[]) => {
  if (String(w).includes('SQLite')) return
  return (emit as (...a: unknown[]) => void)(w, ...rest)
}) as typeof process.emitWarning
export {}
