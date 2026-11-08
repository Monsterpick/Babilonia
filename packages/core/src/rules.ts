import type { Action, EventRule, GiftRef, LiveEvent, Profile, Trigger } from '@livearena/shared'

export interface Job {
  jobId: string
  rule: EventRule
  action: Action
  event: LiveEvent
  /** Veces que hay que ejecutar la acción (ya multiplicadas y recortadas). */
  repetitions: number
  priority: number
  /** 0..1 según el valor del regalo. */
  intensity: number
  /** Si este trabajo debe tocar el sonido de la regla. */
  playSound: boolean
  /** Información extra del disparo (meta de likes alcanzada, etc.). */
  meta?: Record<string, unknown>
}

export interface Skip {
  ruleId: string
  reason: 'cooldown' | 'who' | 'once' | 'missing-action'
}

export interface RuleResult {
  jobs: Job[]
  skipped: Skip[]
  /** Repeticiones recortadas por maxPerEvent. */
  trimmed: number
}

const norm = (s: string) => s.toLowerCase().replace(/[\s_\-'’.]+/g, '')

export function giftMatches(refs: GiftRef[], gift: { giftId: number; name: string; diamonds: number }): boolean {
  return refs.some((r) => {
    if (r.id !== undefined && r.id > 0 && gift.giftId > 0) return r.id === gift.giftId
    return norm(r.name) === norm(gift.name)
  })
}

/** Prioridad automática: log del valor en diamantes. Un Universe pasa delante de 200 rosas. */
export function autoPriority(ev: LiveEvent): number {
  switch (ev.type) {
    case 'gift':
      return Math.min(1000, 20 + Math.round(100 * Math.log10(1 + ev.payload.diamonds * ev.payload.count)))
    case 'follow':
    case 'share':
    case 'subscribe':
      return 15
    case 'chat':
      return 10
    default:
      return 5
  }
}

export function intensityOf(ev: LiveEvent): number {
  if (ev.type !== 'gift') return ev.type === 'subscribe' ? 0.4 : 0.1
  const v = ev.payload.diamonds * ev.payload.count
  return Math.max(0.05, Math.min(1, Math.log10(1 + v) / Math.log10(1 + 30000)))
}

/**
 * Motor de reglas: convierte LiveEvents en trabajos (acción × repeticiones).
 * Lleva el estado necesario: likes por persona, metas de likes de sala, cooldowns y follows ya premiados.
 * No hace I/O: es determinista y fácil de probar.
 */
export class RuleEngine {
  private profile: Profile | null = null
  private actions = new Map<string, Action>()
  private likesPerUser = new Map<string, number>()
  private roomLikes = 0
  private roomMilestones = new Map<string, number>()
  private lastGlobal = new Map<string, number>()
  private lastPerUser = new Map<string, number>()
  private rewardedFollows = new Set<string>()
  private seq = 0

  constructor(private readonly now: () => number = Date.now) {}

  setProfile(p: Profile): void {
    this.profile = p
    this.actions = new Map(p.actions.map((a) => [a.id, a]))
  }

  get totalRoomLikes(): number {
    return this.roomLikes
  }

  /** Reinicia contadores de sesión (nuevo live). */
  resetSession(): void {
    this.likesPerUser.clear()
    this.roomLikes = 0
    this.roomMilestones.clear()
    this.lastGlobal.clear()
    this.lastPerUser.clear()
    this.rewardedFollows.clear()
  }

  handle(ev: LiveEvent): RuleResult {
    const res: RuleResult = { jobs: [], skipped: [], trimmed: 0 }
    if (ev.type === 'like') this.roomLikes += ev.payload.count
    if (!this.profile) return res

    for (const rule of this.profile.events) {
      if (!rule.enabled) continue
      const hit = this.match(rule, rule.trigger, ev)
      if (!hit) continue
      if (!this.whoAllows(rule, ev)) {
        res.skipped.push({ ruleId: rule.id, reason: 'who' })
        continue
      }
      if (rule.trigger.type === 'follow' && rule.trigger.oncePerUser && ev.user) {
        const k = `${rule.id}:${ev.user.id || ev.user.uniqueId}`
        if (this.rewardedFollows.has(k)) {
          res.skipped.push({ ruleId: rule.id, reason: 'once' })
          continue
        }
        this.rewardedFollows.add(k)
      }
      if (!this.cooldownAllows(rule, ev)) {
        res.skipped.push({ ruleId: rule.id, reason: 'cooldown' })
        continue
      }

      let reps = (rule.perUnit ? hit.units : 1) * rule.multiplier
      if (reps > rule.maxPerEvent) {
        res.trimmed += reps - rule.maxPerEvent
        reps = rule.maxPerEvent
      }
      if (reps < 1) continue

      const priority = rule.priority ?? autoPriority(ev)
      const intensity = intensityOf(ev)
      const firstOfStreak = ev.type !== 'gift' || ev.payload.phase === 'single' || ev.payload.streakTotal === ev.payload.count
      const playSound = !!rule.sound && (rule.sound.every === 'each' || firstOfStreak)

      let soundAssigned = false
      for (const actionId of rule.actionIds) {
        const action = this.actions.get(actionId)
        if (!action) {
          res.skipped.push({ ruleId: rule.id, reason: 'missing-action' })
          continue
        }
        res.jobs.push({
          jobId: `j${++this.seq}`,
          rule,
          action,
          event: ev,
          repetitions: reps,
          priority,
          intensity,
          playSound: playSound && !soundAssigned,
          meta: hit.meta,
        })
        soundAssigned = true
      }
    }
    return res
  }

  /** Devuelve cuántas "unidades" aporta el evento a la regla, o null si no casa. */
  private match(rule: EventRule, t: Trigger, ev: LiveEvent): { units: number; meta?: Record<string, unknown> } | null {
    switch (t.type) {
      case 'gift':
        return ev.type === 'gift' && giftMatches(t.gifts, ev.payload) ? { units: ev.payload.count } : null
      case 'diamonds':
        if (ev.type !== 'gift') return null
        if (ev.payload.diamonds < t.min) return null
        if (t.max !== undefined && t.max > 0 && ev.payload.diamonds > t.max) return null
        return { units: ev.payload.count }
      case 'likes': {
        if (ev.type !== 'like' || !ev.user) return null
        const k = `${rule.id}:${ev.user.id || ev.user.uniqueId}`
        const acc = (this.likesPerUser.get(k) ?? 0) + ev.payload.count
        const n = Math.floor(acc / t.every)
        this.likesPerUser.set(k, acc - n * t.every)
        return n > 0 ? { units: n } : null
      }
      case 'room_likes': {
        if (ev.type !== 'like') return null
        const step = t.step > 0 ? t.step : t.goal
        const reached = this.roomLikes < t.goal ? 0 : Math.floor((this.roomLikes - t.goal) / step) + 1
        const prev = this.roomMilestones.get(rule.id) ?? 0
        if (reached <= prev) return null
        this.roomMilestones.set(rule.id, reached)
        const n = t.repeat ? reached - prev : prev === 0 ? 1 : 0
        const goal = t.goal + (reached - 1) * step
        return n > 0 ? { units: n, meta: { goal, nextGoal: goal + step, roomLikes: this.roomLikes } } : null
      }
      case 'command': {
        if (ev.type !== 'chat' || !ev.payload.command) return null
        const names = [t.name, ...t.aliases].map((x) => x.toLowerCase().replace(/^[!/]/, ''))
        return names.includes(ev.payload.command.name) ? { units: 1 } : null
      }
      case 'chat':
        if (ev.type !== 'chat') return null
        if (t.contains && !ev.payload.text.toLowerCase().includes(t.contains.toLowerCase())) return null
        return { units: 1 }
      case 'follow':
        return ev.type === 'follow' ? { units: 1 } : null
      case 'share':
        return ev.type === 'share' ? { units: 1 } : null
      case 'subscribe':
        return ev.type === 'subscribe' ? { units: 1 } : null
      case 'join':
        return ev.type === 'member_join' ? { units: 1 } : null
    }
  }

  private whoAllows(rule: EventRule, ev: LiveEvent): boolean {
    const u = ev.user
    switch (rule.who) {
      case 'anyone':
        return true
      case 'followers':
        return !!u?.isFollower
      case 'subscribers':
        return !!u?.isSubscriber
      case 'moderators':
        return !!u?.isModerator
      case 'list': {
        if (!u) return false
        const list = rule.users.map((x) => x.replace(/^@/, '').toLowerCase())
        return list.includes(u.uniqueId.toLowerCase())
      }
    }
  }

  private cooldownAllows(rule: EventRule, ev: LiveEvent): boolean {
    const now = this.now()
    const { globalMs, perUserMs } = rule.cooldown
    if (globalMs > 0 && now - (this.lastGlobal.get(rule.id) ?? -Infinity) < globalMs) return false
    const uk = ev.user ? `${rule.id}:${ev.user.id || ev.user.uniqueId}` : null
    if (perUserMs > 0 && uk && now - (this.lastPerUser.get(uk) ?? -Infinity) < perUserMs) return false
    if (globalMs > 0) this.lastGlobal.set(rule.id, now)
    if (perUserMs > 0 && uk) this.lastPerUser.set(uk, now)
    return true
  }
}
