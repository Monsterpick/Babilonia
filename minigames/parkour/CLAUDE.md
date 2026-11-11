# Parkour LIVE (minijuego)

Plugin Paper 26.1.2 (Java 25, Gradle KTS). Jar: `build/libs/ParkourLive.jar`. Pack: `tools/gen_pack.py` → `src/pack`
(Gradle lo mete como `parkour-pack.zip`; el plugin lo sirve en el puerto 25591).

## Piezas
- `tower/Themes.java`: 50 biomas (nombre, bioma real para cielo/niebla, hora, partícula, paleta). Muchos inventados.
- `tower/TowerGen.java`: torre determinista por semilla. Camino en espiral alrededor de una columna; cada salto se
  valida (distancia ≤ 4,6 en llano, ≤ 3,95 subiendo, espacio libre arriba). Piezas: bloque, losa, poste, escalera de
  mano (+3) y bloques que parpadean (nivel ≥ 18). **Sube `VERSION` si cambias el generador** (las torres construidas
  se reconstruyen solas: la firma va en `datos.yml`).
- `tower/Builder.java`: borra y recrea el mundo `parkour_torre` (en Paper 26 está en `world/dimensions/minecraft/`),
  pone biomas por nivel, coloca bloques por tandas y los carteles de cada plataforma.
- `game/Game.java`: checkpoint = nivel de la última plataforma pisada. Caída = pisar un bloque de un nivel inferior,
  caer al vacío o pisar algo desconocido por debajo de la plataforma. Cima = ganada; tiempo límite = perdida.
- `game/Effects.java`: cola de efectos del chat (`/ttpk <efecto> [n] <usuario>`): subir, bajar, empujar, viento,
  niebla, hielo, fantasma, terremoto, lento, supersalto, escudo, guia, puente. Protección tras N caídas seguidas.
- `game/Hud.java`: BossBar (textura propia del pack), sidebar con la torre, barra de XP = progreso del nivel, títulos.
- `/pk status` → línea `PKSTATUS ...` que lee la app (`apps/server/src/parkour.ts`). `/pk info <n>` = depuración.

## App
- `apps/server/src/parkour.ts` (servicio + whitelist de comandos), rutas `/api/minigames/parkour/*`, perfil
  `parkourProfile()` en `default-profiles.ts`, pestaña `pages/ParkourPanel.tsx`, overlay `/overlay/parkour`.
- Un minijuego a la vez: `pk start` para Base Defense y `bd start` para el parkour.

## v2 (auditoría)
- La torre en memoria es siempre la construida: `/pk reload` con partida en marcha no la recalcula; si cambió, se
  reconstruye al terminar. Niveles 2–58 y subida ≥ 5 (se ajusta sola para caber bajo y=319).
- `lastSafe` se borra al cambiar de checkpoint (el escudo no devuelve a un nivel superior). Pisar el camino de un
  nivel superior cuenta como subir. Inventario pendiente se devuelve al reconectar.
- Sin el streamer conectado el bucle no avanza (ni tiempo ni efectos). Igual en Base Defense (mobs sin IA).
- Efectos a la altura de los ojos tapan la pantalla en primera persona: anillos por el suelo y partículas por encima.
- Validación de torres: `scratch pkval.py` sobre la salida de `/pk info <n>` (distancias y techo libre).

## v3 · HUD propio (como Base Defense)
- `tools/gen_pkhud.py` reutiliza el motor de `base-defense/tools/gen_hud.py` (letra, iconos, fórmulas) y genera las
  fuentes `parkour:*` + `src/main/resources/hud.json`. `hud/HudFont.java` compone las líneas.
- Arriba (título de una BossBar; las barras nativas son transparentes): nivel grande, bioma, % de torre y tira con un
  segmento por nivel teñido con su color (`Hud.topLine`); carteles (`banner`) para subir/bajar de nivel, cima y perder.
- Abajo (barra de acción, en el sitio de la hotbar, que el pack oculta): progreso del nivel, caídas, tiempo, G-P y
  estado (escudo / seguro / cola); aviso de cada espectador en una píldora encima (`Hud.notify(p, tipo, …)`).
- Sin pack: versión clásica (BossBar, panel lateral, barra de XP). Con pack no se usa la XP ni el panel lateral.
- El texto de la letra propia solo tiene mayúsculas y signos básicos: `Hud.fit` quita lo demás (emojis, flechas).

## v4 · mapa «espiral» (`torre.estilo: espiral`)
- Mismo generador de camino (radio 16, pasos por nivel según arco ≈ constante) + `TowerGen.spiralShell()`: lecho con
  paisaje 4 bloques bajo el camino (va a `Tower.hazard`: pisarlo = caída), núcleo cilíndrico hueco r≈12 y franjas de
  muro exterior entre vueltas (hueco de 7 para ver la terraza). El camino usa `th.pad()` para distinguirse del paisaje.
- ~91.000 bloques (la clásica ~14.000); tarda unos segundos más en construirse. `pk reload` puede agotar el RCON corto.
