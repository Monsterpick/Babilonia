import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Catálogo de items de Minecraft 1.20.1 (id, stack máximo, bloque, comida) para el editor de kit. */
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../packages/minecraft/data/items-1.20.1.json')
export const ITEMS: { id: string; max: number; block: boolean; food: boolean }[] = JSON.parse(fs.readFileSync(file, 'utf8'))
