import fs from 'node:fs'
import { ITEMS_FILE } from './resources.js'

/** Catálogo de items de Minecraft (id, stack máximo, bloque, comida) para el editor de kit. */
export const ITEMS: { id: string; max: number; block: boolean; food: boolean }[] = JSON.parse(fs.readFileSync(ITEMS_FILE, 'utf8'))
