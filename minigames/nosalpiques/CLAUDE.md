# No Salpiques (minijuego)

Plugin Paper 26.1.2 (Java 25, Gradle KTS), hecho a partir de Dropper/Parkour LIVE (mismo HUD, pack, efectos en cola y app).
Jar: `build/libs/NoSalpiquesLive.jar`. Pack: `python3 tools/gen_pack.py` → `src/pack` (se sirve en el puerto 25593).

## Reglas
- 8 salas de piscinas («poolrooms», 3–12) en fila por X, unidas por pasillos. Se salta de plataforma en plataforma;
  tocar el agua (salpicar) despierta a la criatura, que persigue hasta llegar a la sala siguiente. Si atrapa, vuelves al
  inicio de la sala. La última sala sube el agua cada `sala.segundosCrecida` y hay que trepar a la puerta dorada (victoria).
- Piedras (bolas de nieve con nombre) distraen a la criatura hacia donde caen; bengalas (huevos) la ciegan.

## Piezas
- `map/Rooms.java`: mapa determinista. Cotas: fondo FLOOR=60, agua hasta WATER_TOP=63, plataformas y cubiertas con la
  cara de arriba en DECK+1 (un bloque sobre el agua: desde el agua se puede volver a subir). Plataformas: FIJA, HUNDE
  (gris; se hunde tras pisarla), PARPADEA (cristal; aparece/desaparece por fases), CORRIENTE (cian; empuja), MEMORIA y
  MEMORIA_TRAMPA (puente de memoria en las salas 4 y 7: brillan las seguras unos segundos). Saltos ≤ 3,6 entre centros.
  **Sube `VERSION` si cambias el mapa** (firma en `datos.yml`; se reconstruye).
- `game/Monster.java`: warden sin IA movido por el plugin (emerge del agua a 6–8 bloques, ruge, persigue por encima del agua).
  El mundo va en dificultad EASY (en pacífico se borra el warden); los spawns naturales están apagados.
- `game/Game.java`: salas, salpicón (cuenta al entrar al agua), atrapado, crecida, piedras/bengalas, protección.
- `game/Effects.java`: `/ttns <efecto> [n] <usuario>`: empujar, despertar, hundir, apagar, resbalar, rapido, piedra,
  bengala, supersalto, puente, escudo, dormir.
- `/ns status` → `NSSTATUS …` (como PKSTATUS + catches y monster). `/ns info <n>` = plataformas de la sala.

## App
- `apps/server/src/parkour.ts` (`NoSalpiquesService`), rutas `/api/minigames/nosalpiques/*`, perfil `noSalpiquesProfile()`,
  pestaña `pages/NoSalpiquesPanel.tsx`, overlay `/overlay/nosalpiques`. Un minijuego a la vez.
