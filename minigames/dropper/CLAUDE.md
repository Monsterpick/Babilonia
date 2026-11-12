# Dropper LIVE (minijuego)

Plugin Paper 26.1.2 (Java 25, Gradle KTS), hecho a partir de Parkour LIVE (mismo HUD, pack, efectos en cola y app).
Jar: `build/libs/DropperLive.jar`. Pack: `python3 tools/gen_pack.py` → `src/pack` (se sirve en el puerto 25592).

## Reglas
- 100 niveles (5–100). Caes por un tubo 9×9; tocar el agua del fondo = siguiente nivel; tocar cualquier bloque =
  vuelves arriba del mismo nivel. Pasar el último nivel = victoria (G-P en `datos.yml`). Tiempo límite opcional.
- Cada nivel empieza sobre un suelo de cristal temporal (`TempBlocks`) que desaparece tras `partida.cuentaAtras`.

## Piezas
- `map/ShaftGen.java`: genera cada nivel (determinista por semilla + nivel). Simula la caída con la física del jugador
  (gravedad 0,08, rozamiento 0,98) para colocar el hueco seguro de cada capa a una distancia alcanzable en el aire
  (0,15 b/tick, por debajo de los ~0,22 reales). Dibujos de capa: placa, barras, tablero, cruz, anillo, rejilla,
  diagonal, islas; el hueco seguro se talla siempre y los pilares (nivel ≥ 12) evitan el pasillo entre huecos.
  **Sube `VERSION` si cambias la generación** (la firma va en `datos.yml` y el mundo se rehace).
- `map/Builder.java`: construye los niveles según se necesitan (el actual ya, y los 3 siguientes en segundo plano,
  6.000 bloques/tick). Guarda en `datos.yml` qué niveles hay construidos.
- `game/Game.java`: cuenta atrás, choque (caja del jugador ampliada 0,07 contra bloques sólidos), agua, escudo (te pasa
  por el hueco seguro de la capa que tocaste), guía (anillos en los huecos de debajo), protección tras N choques.
- `game/Effects.java`: `/ttdr <efecto> [n] <usuario>`: subir, bajar, reiniciar, empujar, viento, niebla, lento, acelerar,
  terremoto, escudo, guia. Los de caída esperan a que se suelte el cristal.
- `/dr status` → `DRSTATUS …` (misma forma que PKSTATUS). `/dr info <n>` = capas y huecos del nivel.

## App
- `apps/server/src/parkour.ts`: `PluginGameService` genérico; `DropperService` con sus comandos permitidos y ajustes.
- Rutas `/api/minigames/dropper/*`, perfil `dropperProfile()`, pestaña `pages/DropperPanel.tsx`, overlay
  `/overlay/dropper` (el de parkour con otros textos). Un minijuego a la vez (bd/pk/dr se paran entre sí).
