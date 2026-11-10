# LiveArena

Plataforma de juegos interactivos para **TikTok LIVE**. Los regalos, likes, comentarios, follows y shares de tu live se convierten en acciones dentro de **Minecraft** (mobs con el nombre de quien los envía, truenos, TNT, items, efectos, kit…) y en **overlays** para OBS / TikTok LIVE Studio.

> Estado: **v0.5 · app de escritorio para Windows** (instalador y portable). Incluye plugin propio LiveArena (tótems apilables, 80+ efectos survival en español, efectos espectaculares, Akaza y Gojo, retos), overlays completos con vista previa, TTS, estudio de escenas y temas de color.

## Novedades v0.6

- **Minijuegos → Base Defense** (nueva pestaña): defiende tu base en primera persona con pistola, subfusil, metralleta, lanzacohetes y lanzagranadas mientras los regalos mandan zombis, esqueletos, arañas y creepers por un carril de un bosque muerto postapocalíptico. Jefes con barra de vida propia (Devastador, Blaze, Ghast con bolas de fuego que puedes devolver de un disparo, Wither, Warden y Dragón), rondas de 15:00, victorias que se guardan, meta de likes con jefe y carteles («¡LLEGA LA HORDA!», «¡ESTÁ FURIOSO!», «BASE CAÍDA»). El plugin (Paper 26.1.2, Gradle KTS + run-paper, código en `minigames/base-defense`) **genera la arena él solo** a partir de una semilla: isla flotante con bordes rotos, carril de tierra pisada, árboles muertos y quemados, ruinas, base elevada con barricadas y torre de vigilancia, y un portal en ruinas por el que entran los monstruos, con un bioma propio de ceniza. Probado con 300 mobs + jefe + metralleta sin parar: 20 TPS (7,5 ms/tick).
  - La app lo instala en el servidor, genera la arena, activa el perfil de regalos «Base Defense», lo inicia/detiene, muestra la partida en vivo y deja probar cada regalo sin TikTok. Le pasa sola el total de likes del directo.
  - Con otras apps (TikFinity…) por RCON: `ttspawn <tipo> <n> <usuario>`, `ttboss <jefe> <usuario>`, `ttheal <n> <usuario>`, `ttwin <+n|-n> <usuario>`, `ttlikes <total>`.
- **Cinemáticas v7**: Sangre Perforante sin esfera (manos juntas, zoom a la cara con destellos rojos bajo los ojos, la flecha de sangre se forma entre las palmas y sale disparada) y Ataque orbital rehecho (plano del satélite con la Tierra de fondo, el cañón cargando, el rayo cruzando el espacio hasta el planeta y bajada a la vista del objetivo, sin tinte rojo a pantalla completa).
- Barra lateral que cabe en pantallas de 768 px de alto y estado correcto del servidor cuando lo abres fuera de la app.

## Novedades v0.5

- **Habilidades cinemáticas** (12, según el kit): escudo, onda de repulsión, corona de espadas, súper rayo, trueno + explosión, carrusel de creepers, ojo del vacío, agujero negro, juicio arcano, esfera de energía, meteorito y mil cortes. El servidor sigue siendo **Paper** (plugin LiveArena: línea de tiempo, daño, destrucción con restauración) y tu PC lleva el mod **LiveArena Cinemáticas** (NeoForge 26.1.2 + GeckoLib 5.5): cámara de cine, FOV, franjas, destellos, cielo especial y modelos animados. La app lo instala en un clic (página **Cinemáticas**). Comandos: `/habilidad <id> <jugador>` o `la efecto cine_<id> {player} {nickname}` en tus reglas.
- **Kit**: tótems por paquetes (p. ej. 3 × 120 = 360) al contador del plugin, y hasta 99 por hueco en vanilla.
- **TTS**: voz por usuario, 14 personajes (robótica clásica hombre/mujer, narrador, ardilla…), voces de Windows de 32 y 64 bits (detecta voces instaladas como Loquendo) con efectos, y `!voz` para los espectadores.
- **Overlays**: catálogo por categorías sin recortes y **probador** a pantalla grande con simulación de eventos (solo overlays).
- **Estudio**: lienzo a resolución real, guías e imanes, deshacer, alinear, animaciones, texto en vivo, plantillas e importar/exportar.

## Novedades v0.3–0.4

- **Plugin propio LiveArena** (se instala solo al encender el servidor): tótems apilables con contador, paridad total con el s2e (zombies, creepers, telaraña, caja de TNT…), efectos espectaculares (meteorito, agujero negro, súper rayo, juicio arcano, dragones, onda de repulsión, corona de espadas, mil cortes, la parca, genkidama…), personajes **Akaza** y **Gojo**, y un **reto** con barra de progreso (Buscador de diamantes).
- **Texturas de inventario** sacadas de tu propio Minecraft instalado.
- **Overlays** con vista previa en vivo: avisos, logros/«¡Te mató!»/Quiéreme, contador, cronómetro, vidas, tótems, mejor regalo/racha, meta de regalo, duelo, reset o salvar, destacados, **8 estilos de top**, MVP, metas con rayas (monedas/likes/seguidores/combinada), **reloj extensible (subathon)** y **banda de últimos eventos**.
- **TTS**: lee los comentarios con las voces de tu PC (también en OBS), con reglas, filtros, antispam e historial.
- **Estudio de escenas**: editor de capas (overlays, imágenes, vídeo, texto, regalos, formas) con una sola URL por escena.
- **Ajustes**: 10 colores de la app y escala de interfaz para 2K/4K.

## Descargar (Windows)

En GitHub → pestaña **Actions** → último «Build Windows (.exe)» → artefacto **LiveArena-Windows**. Dentro:
- `LiveArena-Setup-0.2.0.exe` — instalador (crea acceso directo).
- `LiveArena-Portable-0.2.0.exe` — sin instalar, doble clic y listo.

Al publicar una etiqueta `v0.2.0` los `.exe` salen también en **Releases**.

Windows puede mostrar «Windows protegió su PC» porque el ejecutable no está firmado: *Más información → Ejecutar de todas formas*.

## Probarlo paso a paso

1. Abre **LiveArena**. Arriba escribe tu usuario de TikTok (aún no conectes).
2. **Servidor** → escribe tu **nick de Minecraft** → Guardar.
3. **Instalar servidor** → elige versión (PaperMC 1.20.1 para tus plugins MiniLive; la más nueva con ViaVersion si juegas con el cliente nuevo), **Cambiar carpeta** (una vacía), sube tus `.jar` (s2e-survival…) y márcalos, acepta el EULA → **Instalar**. Si falta Java, se descarga solo.
4. Cuando la terminal diga `Done` y salga **RCON vinculado**, abre Minecraft → Multijugador → `localhost`.
5. **Plugins** → pestaña **s2e Survival** (o Supervivencia) → pulsa ▶ naranja en ZOMBIE: aparece el zombie con el nombre «Prueba».
6. **Simulador** → haz clic en una Rosa ×5: sale todo como en el live.
7. **Overlays** → copia las URL a OBS / TikTok LIVE Studio.
8. Empieza tu live en TikTok y pulsa **Conectar live**.

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

**Desde el código (desarrolladores) — Windows:** doble clic en `iniciar.bat` (la primera vez instala todo y prepara el panel). Se abre http://127.0.0.1:7420

**Manual:**
```bash
corepack enable
pnpm install
pnpm build      # compila el panel
pnpm start      # app en http://127.0.0.1:7420
```
Desarrollo con recarga en caliente: `pnpm dev` (panel en http://127.0.0.1:5173).
App de escritorio en desarrollo: `pnpm desktop`. Generar los `.exe`: `pnpm dist:win` (en Linux necesita `wine`).

Opcional: copia `.env.example` a `.env` y pon tu `EULER_API_KEY`.

## Minecraft interactivo en 5 pasos

1. **Servidor →** escribe tu **nick de Minecraft** y guarda.
2. **Crear servidor nuevo →** elige modo, carpeta vacía, opciones y plugins (sube tus `.jar` con «Añadir .jar»). Acepta el EULA → **Crear servidor**. Se descarga Paper, se configura RCON y se enciende solo. (¿Ya tienes servidor? «Usar uno que ya tengo» y elige su carpeta.)
3. Entra al servidor desde tu Minecraft: `localhost`.
4. **Plugins →** revisa qué hace cada regalo (el perfil «Supervivencia» trae 15 de ejemplo) y prueba cada uno con ▶ o desde el **Simulador**.
5. Escribe tu usuario de TikTok arriba y pulsa **Conectar live**. Listo: a esperar regalos.

### Tus plugins (.jar)
Súbelos al instalar el servidor o en **Servidor → Plugins** (quedan también en tu biblioteca para próximos servidores). En el editor de cada comando, **Elegir de la galería** trae 112 comandos listos: Minecraft estándar, **s2e-survival** (`/survival …`) y **MiniLive**.

Variables: `{player}`/`{nick}` = tu jugador · `{nickname}` = nombre del espectador en una palabra (el `<name>` de s2e) · `{quien}`/`{username}` = @ del espectador (el `[donador]` de MiniLive) · `{user}` · `{gift}` · `{gift.count}` · `{random:1-10}`.
```
survival zombie null {nickname}
trueno {nick} {quien}
```
- **s2e-survival:** LiveArena escribe tu nick en `plugins/s2e-survival/config.yml` (`player_name`) al encender el servidor.
- **MiniLive:** estos plugins validan un «pase» firmado por la nube de MineLive; solo funcionan con una cuenta de MineLive activa. LiveArena no lo falsifica ni lo salta.

## Overlays en OBS / TikTok LIVE Studio

En **Overlays** copia la URL con un clic.

- **OBS:** Fuentes → + → *Navegador* → pega la URL. Ancho/alto según el overlay (p. ej. tarjetas 1080×400, avisos 500×600). Marca «Actualizar el navegador cuando la escena se active». El fondo ya es transparente.
- **TikTok LIVE Studio:** Añadir fuente → *Enlace* (o *Navegador*) → pega la URL.

Parámetros: `?scale=1.3` (tamaño), `?align=right` (avisos), `?n=5` (rankings), `?goal=5000` (meta), `?scope=ever` (mejor regalo histórico), `?sound=0` (silenciar ese overlay).

## Pruebas

```bash
pnpm test        # 53 tests: combos, reglas, colas, carga (5.000+ eventos), RCON, kit, server.properties y e2e
pnpm typecheck
pnpm sim gift Rose 10 Ana     # con la app abierta
pnpm sim burst 300 3
```
Sin Minecraft: `npx tsx apps/server/test/fake-mc.ts` levanta un RCON falso (contraseña `demo-password`).

## Arquitectura

```
apps/server       Fastify + WebSocket (protocolo v1) + orquestación. Solo escucha en 127.0.0.1
apps/dashboard    React + Vite + Tailwind: panel y overlays (/overlay/*)
apps/desktop      Electron: arranca el servidor dentro de la app, ventana del panel, selector de carpetas; empaquetado con electron-builder
packages/shared   Tipos y esquemas Zod: LiveEvent, perfil (acciones+eventos), protocolo WS
packages/core     Dedup, ComboTracker, motor de reglas, cola de prioridad, token bucket (sin I/O, 100% testeado)
packages/minecraft RCON, cola gestionada, constructores de comandos seguros, vigía, Java, creador y proceso del servidor
packages/source-tiktok  ÚNICO paquete que importa tiktok-live-connector (dependencia no oficial aislada)
```
Protocolo para conectar otros motores (Unity, Godot…): [docs/protocol.md](docs/protocol.md).

Datos del usuario: en la app de escritorio `%APPDATA%/LiveArena/datos/`; desde el código `~/.livearena/`: `config.json`, `perfiles/`, `copias/`, `media/`, `plugins/`, `estadisticas.db` (SQLite).

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
