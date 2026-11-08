import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { ZipReader } from './zip.js'

/**
 * Texturas de items: se sacan del Minecraft que ya tienes instalado (el .jar de la versión
 * en .minecraft/versions). No se incluyen en la app: son de Mojang y cada usuario usa las suyas.
 */

export interface ClientJar {
  version: string
  file: string
}

/** Carpetas .minecraft típicas según el sistema (lanzador oficial y compatibles). */
export function minecraftDirs(): string[] {
  const home = os.homedir()
  const appdata = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming')
  if (process.platform === 'win32')
    return [path.join(appdata, '.minecraft'), path.join(appdata, '.tlauncher', 'legacy', 'Minecraft', 'game'), path.join(home, 'curseforge', 'minecraft', 'Install')]
  if (process.platform === 'darwin') return [path.join(home, 'Library', 'Application Support', 'minecraft')]
  return [path.join(home, '.minecraft'), path.join(home, '.var', 'app', 'com.mojang.Minecraft', '.minecraft')]
}

const verKey = (v: string) =>
  (v.match(/\d+/g) ?? []).slice(0, 4).reduce((acc, n, i) => acc + Number(n) * 1000 ** (3 - i), 0)

/** Busca los .jar de cliente instalados (solo versiones de lanzamiento, de la más nueva a la más vieja). */
export async function findClientJars(extraDirs: string[] = []): Promise<ClientJar[]> {
  const out: ClientJar[] = []
  for (const dir of [...extraDirs, ...minecraftDirs()]) {
    const versions = path.join(dir, 'versions')
    let names: string[] = []
    try {
      names = await fs.readdir(versions)
    } catch {
      continue
    }
    for (const v of names) {
      if (!/^\d+\.\d+(\.\d+)?$/.test(v)) continue // sin snapshots, forge, optifine…
      const file = path.join(versions, v, `${v}.jar`)
      try {
        await fs.access(file)
        if (!out.some((j) => j.version === v)) out.push({ version: v, file })
      } catch {
        /* versión sin jar descargado */
      }
    }
  }
  return out.sort((a, b) => verKey(b.version) - verKey(a.version))
}

/** Elige el jar: el de la versión pedida si está, si no el más nuevo. */
export async function pickClientJar(preferVersion?: string, extraDirs: string[] = []): Promise<ClientJar | null> {
  const jars = await findClientJars(extraDirs)
  return jars.find((j) => j.version === preferVersion) ?? jars[0] ?? null
}

const PREFIX = 'assets/minecraft/textures/'

/** Extrae textures/item y textures/block a `dest/item` y `dest/block`. Devuelve cuántas PNG sacó. */
export async function extractTextures(jarFile: string, dest: string, onProgress?: (done: number, total: number) => void): Promise<number> {
  const zip = await ZipReader.open(jarFile)
  try {
    const wanted = zip.entries.filter((e) => e.name.startsWith(PREFIX) && e.name.endsWith('.png') && /^(item|block)\/[^/]+\.png$/.test(e.name.slice(PREFIX.length)))
    if (wanted.length === 0) throw new Error('Ese .jar no tiene texturas (¿es el jar del servidor?). Usa el de .minecraft/versions.')
    await fs.mkdir(path.join(dest, 'item'), { recursive: true })
    await fs.mkdir(path.join(dest, 'block'), { recursive: true })
    let done = 0
    for (const e of wanted) {
      await fs.writeFile(path.join(dest, e.name.slice(PREFIX.length)), await zip.read(e))
      if (++done % 200 === 0) onProgress?.(done, wanted.length)
    }
    onProgress?.(done, wanted.length)
    return done
  } finally {
    await zip.close()
  }
}

/**
 * Archivo de textura para un id de item. Los items normales están en item/<id>.png; los bloques
 * suelen estar en block/ con sufijos (_side, _front, _top…). Algunos casos especiales a mano.
 */
export function textureCandidates(id: string): string[] {
  const n = id.replace(/^minecraft:/, '').toLowerCase()
  const special: Record<string, string[]> = {
    compass: ['item/compass_00.png'],
    recovery_compass: ['item/recovery_compass_00.png'],
    clock: ['item/clock_00.png'],
    crossbow: ['item/crossbow_standby.png'],
    bow: ['item/bow.png'],
    grass_block: ['block/grass_block_side.png'],
    tnt: ['block/tnt_side.png'],
    crafting_table: ['block/crafting_table_front.png'],
    furnace: ['block/furnace_front.png'],
    blast_furnace: ['block/blast_furnace_front.png'],
    smoker: ['block/smoker_front.png'],
    dispenser: ['block/dispenser_front.png'],
    dropper: ['block/dropper_front.png'],
    observer: ['block/observer_front.png'],
    pumpkin: ['block/pumpkin_side.png'],
    carved_pumpkin: ['block/carved_pumpkin.png'],
    jack_o_lantern: ['block/jack_o_lantern.png'],
    melon: ['block/melon_side.png'],
    enchanting_table: ['block/enchanting_table_top.png'],
    bookshelf: ['block/bookshelf.png'],
    honey_block: ['block/honey_block_side.png'],
    slime_block: ['block/slime_block.png'],
    obsidian: ['block/obsidian.png'],
    cobweb: ['item/cobweb.png', 'block/cobweb.png'],
    water_bucket: ['item/water_bucket.png'],
    enchanted_golden_apple: ['item/golden_apple.png'],
    potion: ['item/potion.png'],
    splash_potion: ['item/splash_potion.png'],
    totem_of_undying: ['item/totem_of_undying.png'],
    shield: ['item/shield.png', 'block/oak_planks.png'],
    trident: ['item/trident.png'],
    chest: ['item/chest.png', 'block/oak_planks.png'],
    ender_chest: ['block/obsidian.png'],
  }
  const base = special[n] ?? []
  return [
    ...base,
    `item/${n}.png`,
    `block/${n}.png`,
    `block/${n}_side.png`,
    `block/${n}_front.png`,
    `block/${n}_top.png`,
    `block/${n}_still.png`,
    `item/${n}_00.png`,
    `block/${n.replace(/_wood$/, '_log')}.png`,
    `block/${n.replace(/s$/, '')}.png`,
    `block/${n.replace(/_(slab|stairs|wall|fence|fence_gate|button|pressure_plate)$/, '')}.png`,
    `block/${n.replace(/_(slab|stairs|wall|fence|fence_gate|button|pressure_plate)$/, '')}s.png`,
    `block/${n.replace(/_(slab|stairs|wall|fence|fence_gate|button|pressure_plate)$/, '_planks')}.png`,
  ]
}
