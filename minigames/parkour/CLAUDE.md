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
