# LAST HOUSE (Unity) ↔ LiveArena — protocolo

El juego de Unity usa **lo mismo que ya usa la versión web**; la app no necesita cambios para hablar con él.

## Entrada: eventos del directo (WebSocket)

1. Conectar a `ws://127.0.0.1:7420/ws`.
2. Primer mensaje (antes de 5 s):
   ```json
   { "v": 1, "type": "hello", "id": "1", "ts": 0, "payload": { "role": "game", "client": "lasthouse-unity", "subscribe": ["event"] } }
   ```
3. Llega `welcome` y después un sobre por evento: `{ "v": 1, "type": "event", "payload": LiveEvent }`.
   `LiveEvent` (`packages/shared/src/events.ts`): `{ type, user: { id, nickname, ... }, payload }` con
   `type` = `gift` (`name`, `diamonds`, `count`, `imageUrl?`), `like` (`count`), `chat` (`text`), `follow`,
   `share`, `subscribe`, `member_join`, `room_stats` (`viewers`), `live_end`.
4. Campos desconocidos se ignoran. Si se cae la conexión: reintentar cada 2 s y seguir en modo demo mientras tanto.
5. `{"type":"ping"}` cada 20 s; el servidor contesta `pong`.

## Salida: estado y resultados (HTTP, misma app)

| Llamada | Cuándo | Cuerpo |
|---|---|---|
| `POST /api/lasthouse/session` | al empezar / salir de una partida | `{ "active": true \| false }` (activa el perfil de regalos «LAST HOUSE» y restaura el anterior al salir) |
| `POST /api/lasthouse/state` | ~2 veces por segundo | foto del marcador para los overlays (máx. 20 KB, mismo formato que la versión web) |
| `POST /api/lasthouse/result` | al terminar | `LastHouseResultSchema` (`apps/server/src/lasthouse.ts`) |
| `GET /api/lasthouse/settings` | al abrir | ajustes del streamer (votos, likes por punto, adaptativo…) |
| `GET /api/lasthouse/progress` | al abrir | progreso (corona, logros) |

## Modo demo

`LastHouse.exe -demo` (o sin app abierta): espectadores simulados que pasan por el mismo director que los reales,
igual que `?demo=1` en la web.
