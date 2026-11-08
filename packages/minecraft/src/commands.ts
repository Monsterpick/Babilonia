import { safeDisplayText, type KitItem, type Kit, type Step } from '@livearena/shared'

/**
 * Constructores de comandos de Minecraft. Generan sintaxis según la versión:
 *  - < 1.20.5: NBT clásico (item{Enchantments:[...]}), CustomName como JSON en string.
 *  - ≥ 1.20.5: componentes (item[enchantments={levels:{...}}]).
 *  - ≥ 1.21.5: CustomName como componente SNBT.
 * Por defecto 1.20.1 (la de tus plugins).
 */
export interface McVersion {
  major: number
  minor: number
  patch: number
}

export function parseVersion(v: string): McVersion {
  const [major = 1, minor = 20, patch = 0] = v.split('.').map((x) => Number.parseInt(x, 10) || 0)
  return { major, minor, patch }
}

const atLeast = (v: McVersion, minor: number, patch = 0) => v.major > 1 || v.minor > minor || (v.minor === minor && v.patch >= patch)

export const usesComponents = (v: McVersion) => atLeast(v, 20, 5)
export const usesSnbtText = (v: McVersion) => atLeast(v, 21, 5)

const ns = (id: string) => (id.includes(':') ? id : `minecraft:${id}`).toLowerCase().replace(/[^a-z0-9_:./-]/g, '')

/** Componente de texto JSON seguro (el texto se limpia antes). */
export function textComponent(text: string, color?: string, bold = false): string {
  const c: Record<string, unknown> = { text: safeDisplayText(text, 200) }
  if (color) c.color = /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : safeDisplayText(color, 20)
  if (bold) c.bold = true
  return JSON.stringify(c)
}

function customName(v: McVersion, name: string, color = 'gold'): string {
  const comp = textComponent(name, color)
  // < 1.21.5: string con JSON dentro (comillas simples; el nombre ya no lleva ' ni \).
  return usesSnbtText(v) ? `CustomName:${comp}` : `CustomName:'${comp}'`
}

export interface SummonOpts {
  player: string
  entity: string
  /** Nombre del espectador encima del mob. */
  name?: string
  radius?: number
  heightOffset?: number
  random?: () => number
}

export function summon(v: McVersion, o: SummonOpts): string {
  const rnd = o.random ?? Math.random
  const r = o.radius ?? 0
  const off = () => (r > 0 ? (rnd() * 2 - 1) * r : 0).toFixed(1)
  const dy = (o.heightOffset ?? 0).toFixed(1)
  const nbt: string[] = ['Tags:["livearena"]']
  if (o.name) nbt.unshift(customName(v, o.name), 'CustomNameVisible:1b')
  return `execute at ${o.player} run summon ${ns(o.entity)} ~${off()} ~${dy} ~${off()} {${nbt.join(',')}}`
}

export function itemSpec(v: McVersion, it: KitItem): string {
  const id = ns(it.item)
  const ench = Object.entries(it.enchantments ?? {})
  if (usesComponents(v)) {
    const comps: string[] = []
    if (ench.length) comps.push(`enchantments={levels:{${ench.map(([k, l]) => `"${ns(k)}":${l}`).join(',')}}}`)
    if (it.unbreakable) comps.push('unbreakable={}')
    return comps.length ? `${id}[${comps.join(',')}]` : id
  }
  const tags: string[] = []
  if (ench.length) tags.push(`Enchantments:[${ench.map(([k, l]) => `{id:"${ns(k)}",lvl:${l}s}`).join(',')}]`)
  if (it.unbreakable) tags.push('Unbreakable:1b')
  return tags.length ? `${id}{${tags.join(',')}}` : id
}

export const give = (v: McVersion, player: string, item: string, count = 1) => `give ${player} ${itemSpec(v, { item, count, enchantments: {}, unbreakable: false })} ${count}`

export const effect = (player: string, effectId: string, seconds: number | 'infinite', amplifier = 0, hideParticles = true) =>
  `effect give ${player} ${ns(effectId)} ${seconds} ${amplifier} ${hideParticles}`

export function titleCommands(player: string, s: Extract<Step, { type: 'minecraft.title' }>): string[] {
  const out: string[] = []
  if (s.title || s.subtitle) out.push(`title ${player} times 5 50 15`)
  if (s.subtitle) out.push(`title ${player} subtitle ${textComponent(s.subtitle, s.color ?? 'white')}`)
  if (s.title) out.push(`title ${player} title ${textComponent(s.title, s.color ?? 'gold', true)}`)
  if (s.actionbar) out.push(`title ${player} actionbar ${textComponent(s.actionbar, s.color ?? 'yellow')}`)
  return out
}

const ARMOR_SLOTS: Record<'head' | 'chest' | 'legs' | 'feet' | 'offhand', string> = {
  head: 'armor.head',
  chest: 'armor.chest',
  legs: 'armor.legs',
  feet: 'armor.feet',
  offhand: 'weapon.offhand',
}

/** Comandos para entregar el kit inicial a un jugador (o a @a). */
export function kitCommands(v: McVersion, kit: Kit, player: string): string[] {
  const target = kit.allPlayers ? '@a' : player
  const out: string[] = []
  if (kit.clearBefore) out.push(`clear ${target}`)
  for (const [slot, it] of Object.entries(kit.armor) as [keyof typeof ARMOR_SLOTS, KitItem | undefined][]) {
    if (it) out.push(`item replace entity ${target} ${ARMOR_SLOTS[slot]} with ${itemSpec(v, it)} ${it.count}`)
  }
  kit.hotbar.forEach((it, i) => {
    if (it) out.push(`item replace entity ${target} hotbar.${i} with ${itemSpec(v, it)} ${it.count}`)
  })
  kit.inventory.forEach((it, i) => {
    if (it) out.push(`item replace entity ${target} inventory.${i} with ${itemSpec(v, it)} ${it.count}`)
  })
  if (kit.nightVision) out.push(effect(target, 'night_vision', 'infinite', 0))
  if (kit.jumpBoost > 0) out.push(effect(target, 'jump_boost', 'infinite', kit.jumpBoost - 1))
  out.push(`gamerule fallDamage ${kit.noFallDamage ? 'false' : 'true'}`)
  return out
}
