# 11 — Meteorito desde el espacio (id: `meteorito`)

**Concepto:** la cámara sale al espacio y ve una roca incandescente entrar en la atmósfera.
El cielo enrojece, una sombra crece en el suelo y el impacto deja un cráter enorme con borde
elevado, magma y rocas saliendo despedidas.

## Roles
- Objetivo: zona de impacto.
- Lanzador: ignorado.
- Jugador cinemático: objetivo.
- Duración total: 360 ticks.
- Reutiliza el truco espacial del láser orbital (cámara a Y≈320 + cielo `ESPACIO`) si ya
  existe en el motor; si no, añadirlo al motor.

## Línea de tiempo
| Tick | Servidor | Cliente |
|---|---|---|
| 0–40 | — | Cámara sale disparada hacia arriba; `SkyOverride ESPACIO` |
| 40–100 | Spawnea actor `meteorito` lejos (alto y desplazado 150 bloques en horizontal) | Meteorito con anim `rotar`; brillo naranja creciente al "entrar en la atmósfera"; `TRAIL` de fuego |
| 100–200 | El meteorito desciende en diagonal hacia el objetivo (aceleración) | Cielo de vuelta pero teñido de rojo-naranja; `MARKER` (sombra) creciendo bajo el punto de impacto; estruendo creciente |
| 180 | Estampido sónico | Destello, sacudida media para todos en radio 150 |
| 200 | **IMPACTO**: `bowlCrater` radio 18 profundidad 10 con BORDE ELEVADO; decoración magma 0.15, obsidiana 0.1, fuego 0.2; `FlyingBlockService.LAUNCH` de 80 bloques de eyección; daño letal en radio 6 y caída hasta 30; empuje radio 35 | Destello blanco largo; `SPHERE` naranja de fuego 0→22; `RING_WAVE` radio 60; sacudida máxima |
| 200–360 | Restos: magma y humo | Columna de humo; temblor residual; cámara vuelve |

## Cámara
0–40: ascenso vertical rápido desde el objetivo (`EASE_IN_EXPO`).
40–100: desde el "espacio" mirando hacia el planeta, el meteorito pasa por delante.
100–200: `CUT` a plano desde el suelo a 40 bloques del punto de impacto mirando al cielo; se ve venir.
200: plano muy lejano (70 bloques) para ver la onda; luego acercamiento al cráter.

## Actores y assets
`meteorito` (GeckoLib): `meteorito.geo.json`, `.animation.json`, `.png` (con capa emisiva de grietas).
Animaciones: `rotar` (loop). Hueso: `nucleo`. Escala: diámetro ~8 bloques.
Sonidos: `meteorito.entrada`, `meteorito.estampido`, `meteorito.impacto`.

## Config
| Clave | Defecto |
|---|---|
| radioCrater | 18 |
| profundidadCrater | 10 |
| radioLetal | 6.0 |
| radioDanio | 30.0 |
| danioMax | 100.0 |
| bloquesEyeccion | 80 |
| radioSacudida | 150 |

## Criterios de aceptación
- [ ] El cráter tiene forma de cuenco con borde más alto que el terreno original.
- [ ] La destrucción completa termina en ≤ 3 s sin bajar los TPS de 15.
- [ ] Jugadores a 100 bloques notan el temblor y ven el impacto.
- [ ] El meteorito llega exactamente al `MARKER`.
