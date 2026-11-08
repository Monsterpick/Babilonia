import { useEffect, useState } from 'react'
import type { EventRule, Trigger } from '@livearena/shared'
import { api } from './api'

export interface GiftInfo {
  id?: number
  name: string
  diamonds: number
  image?: string
}

let giftsCache: GiftInfo[] | null = null
let giftsPromise: Promise<GiftInfo[]> | null = null
export function useGifts(): GiftInfo[] {
  const [g, setG] = useState<GiftInfo[]>(giftsCache ?? [])
  useEffect(() => {
    if (giftsCache) return
    giftsPromise ??= api<GiftInfo[]>('GET', '/api/gifts').then((x) => (giftsCache = x))
    giftsPromise.then(setG).catch(() => undefined)
  }, [])
  return g
}

const norm = (s: string) => s.toLowerCase().replace(/[\s_\-'’.]+/g, '')
export function findGift(gifts: GiftInfo[], name: string): GiftInfo | undefined {
  const n = norm(name)
  return gifts.find((g) => norm(g.name) === n)
}

/** Regalos más usados en lives (para mostrarlos primero). */
export const POPULAR_GIFTS = [
  'Rose', 'TikTok', 'GG', 'Ice Cream Cone', 'Heart Me', 'Finger Heart', 'Perfume', 'Doughnut', 'Hand Hearts', 'Confetti', 'Sunglasses',
  'Corgi', 'Money Gun', 'Galaxy', 'Fireworks', 'Lion', 'Universe', 'Hat And Mustache', 'Rosa', 'Love You', 'Cap', 'Mishka Bear', 'Swan',
]

export interface TriggerLabel {
  label: string
  sub?: string
  image?: string
  icon: 'gift' | 'heart' | 'user-plus' | 'share' | 'message' | 'star' | 'gem' | 'users' | 'log-in'
}

export function triggerLabel(t: Trigger, gifts: GiftInfo[]): TriggerLabel {
  switch (t.type) {
    case 'gift': {
      const g = t.gifts[0]!
      const info = findGift(gifts, g.name)
      return { label: t.gifts.length > 1 ? `${g.name} +${t.gifts.length - 1}` : g.name, sub: String(info?.diamonds ?? g.diamonds ?? ''), image: info?.image, icon: 'gift' }
    }
    case 'diamonds':
      return { label: `${t.min}${t.max ? `–${t.max}` : '+'} monedas`, icon: 'gem' }
    case 'likes':
      return { label: `Likes · ${t.every}`, icon: 'heart' }
    case 'room_likes':
      return { label: `Sala · ${t.goal}`, sub: t.step ? `+${t.step}` : undefined, icon: 'users' }
    case 'command':
      return { label: `!${t.name}`, icon: 'message' }
    case 'chat':
      return { label: t.contains ? `Chat: "${t.contains}"` : 'Comentario', icon: 'message' }
    case 'follow':
      return { label: 'Seguidor', icon: 'user-plus' }
    case 'share':
      return { label: 'Compartir', icon: 'share' }
    case 'subscribe':
      return { label: 'Suscripción', icon: 'star' }
    case 'join':
      return { label: 'Entra al live', icon: 'log-in' }
  }
}

export function ruleSummary(e: EventRule): string {
  const parts: string[] = []
  if (!e.perUnit) parts.push('1 vez por evento')
  if (e.multiplier > 1) parts.push(`×${e.multiplier}`)
  if (e.cooldown.globalMs) parts.push(`espera ${e.cooldown.globalMs / 1000}s`)
  if (e.cooldown.perUserMs) parts.push(`espera ${e.cooldown.perUserMs / 1000}s/persona`)
  if (e.who !== 'anyone') parts.push({ followers: 'seguidores', subscribers: 'suscriptores', moderators: 'moderadores', list: 'lista', anyone: '' }[e.who])
  return parts.join(' · ')
}

export const ENTITIES = [
  'zombie', 'skeleton', 'creeper', 'spider', 'cave_spider', 'enderman', 'witch', 'slime', 'magma_cube', 'blaze', 'ghast', 'phantom', 'drowned',
  'husk', 'stray', 'silverfish', 'endermite', 'pillager', 'vindicator', 'evoker', 'ravager', 'vex', 'piglin', 'piglin_brute', 'hoglin',
  'zoglin', 'zombified_piglin', 'wither_skeleton', 'guardian', 'elder_guardian', 'shulker', 'warden', 'wither', 'ender_dragon', 'iron_golem',
  'snow_golem', 'wolf', 'cat', 'horse', 'pig', 'cow', 'sheep', 'chicken', 'bee', 'axolotl', 'allay', 'tnt', 'lightning_bolt', 'firework_rocket',
]

export const EFFECTS = [
  'speed', 'slowness', 'haste', 'mining_fatigue', 'strength', 'instant_health', 'instant_damage', 'jump_boost', 'nausea', 'regeneration',
  'resistance', 'fire_resistance', 'water_breathing', 'invisibility', 'blindness', 'night_vision', 'hunger', 'weakness', 'poison', 'wither',
  'health_boost', 'absorption', 'saturation', 'glowing', 'levitation', 'luck', 'unluck', 'slow_falling', 'darkness',
]
