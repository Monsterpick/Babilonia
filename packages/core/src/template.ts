import { safeDisplayText, safeIdent, type LiveEvent } from '@livearena/shared'

export interface TemplateContext {
  event: LiveEvent
  /** Nick del jugador de Minecraft del streamer. */
  player: string
  /** Total de likes de la sala (para {likes}). */
  roomLikes?: number
  random?: () => number
}

/**
 * Sustituye variables en textos y comandos. Todos los valores que vienen de espectadores pasan
 * por limpieza (sin comillas, llaves, @, §, saltos de línea) para que no puedan romper ni
 * inyectar nada en un comando de Minecraft.
 *
 * Variables:
 *   {player} {nick}                      → jugador de Minecraft del streamer
 *   {user} {nombre} {user.nickname}      → nombre visible del espectador (limpio, puede tener espacios)
 *   {nickname}                           → nombre visible como UNA palabra (espacios → _), para argumentos de comandos
 *   {quien} {usuario} {username} {user.uniqueId} → @handle del espectador como una sola palabra [A-Za-z0-9_.]
 *   {gift} {gift.name} {gift.count} {gift.diamonds} {gift.total} {gift.value}
 *   {likes} {comment} {args.0} {random:1-10}
 * Compatibles con tus plugins de MineLive: {nick} y {quien}.
 */
export function renderTemplate(text: string, ctx: TemplateContext): string {
  const ev = ctx.event
  const u = ev.user
  const gift = ev.type === 'gift' ? ev.payload : null
  const chat = ev.type === 'chat' ? ev.payload : null
  const rnd = ctx.random ?? Math.random
  const handle = safeIdent(u?.uniqueId || u?.nickname)
  const display = safeDisplayText(u?.nickname || u?.uniqueId || 'Anónimo', 32) || handle

  return text.replace(/\{([a-zA-Z][a-zA-Z0-9.]*)(?::(-?\d+)-(-?\d+))?\}/g, (whole, key: string, a?: string, b?: string) => {
    switch (key) {
      case 'player':
      case 'nick':
        return ctx.player
      case 'user':
      case 'nombre':
      case 'user.nickname':
        return display
      case 'nickname':
        return display.replace(/\s+/g, '_')
      case 'quien':
      case 'usuario':
      case 'username':
      case 'user.uniqueId':
        return handle
      case 'gift':
      case 'gift.name':
      case 'regalo':
        return gift ? safeDisplayText(gift.name, 40) : ''
      case 'gift.count':
      case 'cantidad':
        return gift ? String(gift.count) : ev.type === 'like' ? String(ev.payload.count) : '1'
      case 'gift.total':
        return gift ? String(gift.streakTotal) : ''
      case 'gift.diamonds':
      case 'monedas':
        return gift ? String(gift.diamonds) : '0'
      case 'gift.value':
        return gift ? String(gift.diamonds * gift.count) : '0'
      case 'likes':
        return String(ctx.roomLikes ?? (ev.type === 'like' ? ev.payload.count : 0))
      case 'comment':
      case 'comentario':
        return chat ? safeDisplayText(chat.text, 120) : ''
      case 'random': {
        const lo = Number(a ?? 1)
        const hi = Number(b ?? 10)
        return String(Math.floor(lo + rnd() * (hi - lo + 1)))
      }
      default: {
        const m = key.match(/^args\.(\d+)$/)
        if (m && chat?.command) return safeIdent(chat.command.args[Number(m[1])] ?? '', 32)
        if (key === 'args' && chat?.command) return chat.command.args.map((x) => safeIdent(x, 32)).join(' ')
        return whole
      }
    }
  })
}
