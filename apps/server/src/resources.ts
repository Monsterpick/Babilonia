import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Rutas de recursos. En desarrollo salen del monorepo; en la app empaquetada (Electron)
 * se pasan con LIVEARENA_RESOURCES (carpeta con assets/, dashboard/ e items-1.20.1.json).
 */
const here = path.dirname(fileURLToPath(import.meta.url))
const res = process.env.LIVEARENA_RESOURCES

export const ASSETS_DIR = res ? path.join(res, 'assets') : path.resolve(here, '..', 'assets')
export const DASHBOARD_DIST = res ? path.join(res, 'dashboard') : path.resolve(here, '..', '..', 'dashboard', 'dist')
export const ITEMS_FILE = res ? path.join(res, 'items-1.20.1.json') : path.resolve(here, '../../../packages/minecraft/data/items-1.20.1.json')
