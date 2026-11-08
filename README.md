# LiveArena

Plataforma de juegos interactivos para **TikTok LIVE**. Los regalos, likes, comentarios, follows y shares de tu live se convierten en acciones dentro de **Minecraft** (mobs con el nombre de quien los envía, truenos, TNT, items, efectos, kit…) y en **overlays** para OBS / TikTok LIVE Studio.

> Estado: **base funcional (fases 1-3 + panel)**. Minecraft interactivo listo para probar en vivo. El juego web «Batalla de equipos» y el instalador de escritorio llegan en las siguientes fases.

## Qué incluye

| Parte | Qué hace |
|---|---|
| **Conector TikTok** | `tiktok-live-connector` + Euler Stream, reconexión con backoff, detección de «no estás en directo» y heartbeat. |
| **Motor de reglas** | Regalo concreto, rango de monedas, likes por persona, metas de likes de sala, `!comandos`, follow (1 vez por persona), share, suscripción. Multiplicador, máximo por evento, cooldown global y por persona, filtro de quién. |
| **Combos de regalos** | Procesamiento **incremental**: cada parte de una racha se entrega al instante y nunca se duplica (ver «Decisiones»). |
| **Colas con prioridad** | Un Universe adelanta a 200 rosas. Minecraft a 20 comandos/s (configurable); si el servidor se reinicia los comandos esperan y no se pierden. |
| **Minecraft** | Cliente RCON propio, vigía de muertes y reapariciones, kit inicial al reaparecer, límite de mobs vivos y **asistente para crear tu servidor Paper** (descarga, RCON con contraseña segura, EULA, plugins, OP, iniciar.bat). |
| **Panel** | Plugins (regalo → acción con tarjeta de imagen/video), Overlays con editor de estilo, Kit inicial, Simulador, Servidor (crear / usar existente / manual + consola), Actividad con rankings, Ajustes. Copias de seguridad automáticas y perfiles exportables por código. |
| **Overlays** | Tarjetas de plugins, avisos con foto del espectador, top donadores, top likes, meta de likes, mejor regalo, marcador W/L, vidas y cronómetro. |
| **Catálogo de regalos** | 1.600+ regalos de TikTok con imagen y monedas incluidos (funciona sin conexión y en el simulador) + lo que llega en vivo del conector. |

## Requisitos

- **Node.js 22+** (https://nodejs.org) — pnpm se activa solo con `corepack`.
- **Java 17+** para Minecraft 1.20.1 (Java 21 para 1.20.5+). El asistente te avisa si falta: https://adoptium.net
- Windows 10/11, macOS o Linux.

## Instalación y arranque

**Windows:** doble clic en `iniciar.bat` (la primera vez instala todo y prepara el panel). Se abre http://127.0.0.1:7420

**Manual:**
```bash
corepack enable
pnpm install
pnpm build      # compila el panel
pnpm start      # app en http://127.0.0.1:7420
```
Desarrollo con recarga en caliente: `pnpm dev` (panel en http://127.0.0.1:5173).

Opcional: copia `.env.example` a `.env` y pon tu `EULER_API_KEY`.

## Minecraft interactivo en 5 pasos

1. **Servidor →** escribe tu **nick de Minecraft** y guarda.
2. **Crear servidor nuevo →** elige modo, carpeta vacía, opciones y plugins (sube tus `.jar` con «Añadir .jar»). Acepta el EULA → **Crear servidor**. Se descarga Paper, se configura RCON y se enciende solo. (¿Ya tienes servidor? «Usar uno que ya tengo» y elige su carpeta.)
3. Entra al servidor desde tu Minecraft: `localhost`.
4. **Plugins →** revisa qué hace cada regalo (el perfil «Supervivencia» trae 15 de ejemplo) y prueba cada uno con ▶ o desde el **Simulador**.
5. Escribe tu usuario de TikTok arriba y pulsa **Conectar live**. Listo: a esperar regalos.

### Tus plugins (.jar)
Súbelos en **Servidor → 5 · Plugins** (quedan en tu biblioteca `~/.livearena/plugins`). Para usarlos desde un regalo, crea un comando con el paso **Comando** y escribe el comando del plugin. Las variables `{nick}` (tu jugador) y `{quien}` (el @ del espectador) son compatibles con los comandos de MineLive, por ejemplo:
```
trueno {nick} {quien}
minigun {nick} {quien} tipo=electrica balas=100
```

## Overlays en OBS / TikTok LIVE Studio

En **Overlays** copia la URL con un clic.

- **OBS:** Fuentes → + → *Navegador* → pega la URL. Ancho/alto según el overlay (p. ej. tarjetas 1080×400, avisos 500×600). Marca «Actualizar el navegador cuando la escena se active». El fondo ya es transparente.
- **TikTok LIVE Studio:** Añadir fuente → *Enlace* (o *Navegador*) → pega la URL.

Parámetros: `?scale=1.3` (tamaño), `?align=right` (avisos), `?n=5` (rankings), `?goal=5000` (meta), `?scope=ever` (mejor regalo histórico), `?sound=0` (silenciar ese overlay).

## Pruebas

```bash
pnpm test        # 49 tests: combos, reglas, colas, carga (5.000+ eventos), RCON, kit, server.properties y e2e
pnpm typecheck
pnpm sim gift Rose 10 Ana     # con la app abierta
pnpm sim burst 300 3
```
Sin Minecraft: `npx tsx apps/server/test/fake-mc.ts` levanta un RCON falso (contraseña `demo-password`).

## Arquitectura

```
apps/server       Fastify + WebSocket (protocolo v1) + orquestación. Solo escucha en 127.0.0.1
apps/dashboard    React + Vite + Tailwind: panel y overlays (/overlay/*)
packages/shared   Tipos y esquemas Zod: LiveEvent, perfil (acciones+eventos), protocolo WS
packages/core     Dedup, ComboTracker, motor de reglas, cola de prioridad, token bucket (sin I/O, 100% testeado)
packages/minecraft RCON, cola gestionada, constructores de comandos seguros, vigía, Java, creador y proceso del servidor
packages/source-tiktok  ÚNICO paquete que importa tiktok-live-connector (dependencia no oficial aislada)
```
Protocolo para conectar otros motores (Unity, Godot…): [docs/protocol.md](docs/protocol.md).

Datos del usuario en `~/.livearena/`: `config.json`, `perfiles/`, `copias/`, `media/`, `plugins/`, `estadisticas.db` (SQLite).

## Decisiones

- **Combos incrementales:** TikTok manda cada toque de una racha con `repeatCount` acumulado y, a veces, nunca manda `repeatEnd`. Esperar al final añade segundos de retraso, así que se entrega la diferencia en cada evento, se cierra por `repeatEnd` o por 10 s sin actividad, y las rachas cerradas se recuerdan 60 s para que los ecos no dupliquen nada.
- **Una sola cola de trabajos + cola RCON con prioridad:** las tarjetas/avisos salen al instante; los comandos de Minecraft se dosifican a 20/s, con prioridad por monedas.
- **Seguridad de comandos:** los nombres de espectadores se limpian (sin comillas, llaves, `@`, `§`, saltos de línea) antes de entrar en cualquier comando o NBT; `{quien}` es siempre una sola palabra `[A-Za-z0-9_.]`.
- **Servidor local protegido:** solo `127.0.0.1`, comprobación de `Host`/`Origin` y JSON obligatorio en peticiones que cambian algo (evita que una web maliciosa controle tu app).
- **Perfiles en JSON + estadísticas en SQLite:** los perfiles son fáciles de respaldar y compartir; las estadísticas aguantan ráfagas escribiendo en lotes cada segundo.

## Legal y plataforma

Lee [docs/legal.md](docs/legal.md). Resumen:
- La conexión a TikTok usa una **API no oficial** (ingeniería inversa) y puede dejar de funcionar si TikTok cambia; está aislada en `packages/source-tiktok`. La app **solo lee** tu live: nunca publica ni actúa con tu cuenta.
- Sin apuestas ni premios con valor real. Revisa las Normas de la comunidad y las políticas de LIVE / Regalos de TikTok vigentes.
- El EULA de Minecraft lo aceptas tú explícitamente al crear un servidor.
