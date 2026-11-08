# Protocolo WebSocket v1

Conexión: `ws://127.0.0.1:7420/ws`. Cualquier motor (web, Unity, Godot, Python…) puede conectarse.

## Sobre común

```json
{ "v": 1, "type": "action", "id": "lx3k2a1", "ts": 1731000000000, "payload": {} }
```

- Los campos desconocidos se ignoran (compatibilidad hacia adelante).
- Un cambio incompatible sube `v`.

## Mensajes

| Dirección | `type` | Payload |
|---|---|---|
| C→S | `hello` | `{ "role": "game" \| "overlay" \| "dashboard", "client": "mi-juego@1.0", "subscribe": ["action:game.*", "state:*"], "screen": 1 }` — primer mensaje |
| S→C | `welcome` | `{ "protocol": 1, "serverVersion": "0.1.0", "sessionId": "…", "state": { …último valor de cada state… } }` |
| S→C | `event` | `LiveEvent` normalizado (ver abajo) |
| S→C | `action` | `ActionMessage` (ver abajo) |
| S→C | `state` | `{ "key": "source" \| "minecraft" \| "leaderboard" \| "likes" \| "scoreboard" \| "profile", "value": … }` |
| S→C | `log` | `{ "level", "scope", "msg", "ts" }` (solo dashboard) |
| C→S | `ping` / S→C `pong` | keep-alive (el servidor además hace ping WS cada 15 s) |
| C→S | `game.report` | `{ "kind": "boss_defeated", "data": {…} }` — el juego informa de algo |
| S→C | `error` | `{ "code", "message" }` |

### Suscripciones

`"subscribe"` vacío = todo. Patrones: `"event"`, `"action"`, `"action:overlay.*"`, `"action:game.battle.spawn"`, `"state:*"`, `"state:leaderboard"`.

## LiveEvent

```ts
{
  v: 1, id: string, type: 'gift'|'like'|'chat'|'follow'|'share'|'subscribe'|'member_join'|'room_stats'|'live_end'|'custom',
  source: 'tiktok'|'simulator'|…, ts: number, simulated?: boolean,
  user: { id, uniqueId, nickname, avatarUrl?, isFollower?, isModerator?, isSubscriber? } | null,
  payload: …según type
}
// gift: { giftId, name, imageUrl?, diamonds, count /*unidades NUEVAS*/, streakTotal, streakId, phase: 'single'|'streak'|'streak_end'|'streak_timeout' }
// like: { count, totalRoomLikes? }   chat: { text, command?: { name, args[] } }   room_stats: { viewers }
```

## ActionMessage

```ts
{
  kind: 'overlay.card' | 'overlay.alert' | 'sound' | `game.${string}`,
  params: Record<string, unknown>,       // overlay.card: { count, alignment, trigger }
  user: LiveUser | null,
  actionId?, actionName?, color?, media?: { kind: 'image'|'video', url },
  gift?: { name, diamonds, count, imageUrl? },
  intensity: number,   // 0..1 según el valor del regalo: úsalo para escalar la espectacularidad
  priority: number
}
```

## Ejemplo mínimo (JavaScript)

```js
const ws = new WebSocket('ws://127.0.0.1:7420/ws')
ws.onopen = () => ws.send(JSON.stringify({ v: 1, type: 'hello', id: '1', ts: Date.now(), payload: { role: 'game', client: 'demo', subscribe: ['action:game.*', 'event'] } }))
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.type === 'action') console.log('Acción', msg.payload.kind, msg.payload.user?.nickname, msg.payload.intensity)
}
```

## Ejemplo (Godot 4, GDScript)

```gdscript
var ws := WebSocketPeer.new()
func _ready(): ws.connect_to_url("ws://127.0.0.1:7420/ws")
func _process(_d):
    ws.poll()
    if ws.get_ready_state() == WebSocketPeer.STATE_OPEN and not sent:
        ws.send_text(JSON.stringify({"v":1,"type":"hello","id":"1","ts":0,"payload":{"role":"game","client":"godot","subscribe":["action:game.*"]}}))
        sent = true
    while ws.get_available_packet_count() > 0:
        var msg = JSON.parse_string(ws.get_packet().get_string_from_utf8())
        if msg.type == "action": print(msg.payload.kind, " ", msg.payload.user.nickname)
```

Para que una regla mande acciones a tu juego, añade un paso de tipo `game` con `kind` (p. ej. `battle.spawn`) en el perfil: llegará como `kind: "game.battle.spawn"`.
