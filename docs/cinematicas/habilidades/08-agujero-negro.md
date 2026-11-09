# 08 — Agujero negro (id: `agujero_negro`)

**Concepto:** una singularidad aparece frente al objetivo con un disco de acreción
brillante. Arranca el terreno en espiral, arrastra todo hacia su horizonte y al final
colapsa en un destello que lo empuja todo hacia fuera.

## Roles
- Objetivo: arrastrado.
- Lanzador: si existe, el agujero aparece entre ambos (a 60% de la distancia desde el lanzador). Sin lanzador: a 12 bloques delante y 6 arriba del objetivo.
- Jugador cinemático: objetivo.
- Duración total: 300 ticks.

## Línea de tiempo
| Tick | Servidor | Cliente |
|---|---|---|
| 0–30 | Se crea el punto singular | `SPHERE` negra (núcleo opaco negro, sin halo brillante) crece 0→2; `DISK` naranja-blanco (radio 2.5→7) se forma; viñeta oscura |
| 30–230 | **Atracción**: `ForceService.pull` radio 25 con fuerza creciente; bloques en radio 10 se arrancan de fuera a dentro y viajan en `SPIRAL_IN`; al cruzar el horizonte (radio 2) se eliminan | `PARTICLE_STREAM` de polvo hacia el centro; el disco gira y se ilumina más; sonido grave creciente |
| núcleo | Entidad dentro del radio 2: fijada en el centro (`hold`) y daño `danioTick` cada 10 ticks (ignorando frames de invulnerabilidad) | Pantalla oscureciéndose para el objetivo |
| 230–250 | Contracción | Esfera y disco se encogen a 0 |
| 250 | **Colapso**: `push` radio 25 fuerte, daño `danioColapso`, todas las entidades liberadas | Destello blanco total; `RING_WAVE` radio 30; sacudida máxima |
| 250–300 | — | Cámara vuelve |

## Cámara
0–30: plano general lateral a 25 bloques que enmarca agujero y objetivo.
30–230: la cámara se va acercando sola al agujero (de 25 a 8 bloques), con ligero roll de 10° oscilante.
250: `CUT` a plano lejano a 40 bloques para ver la onda.

## Actores y assets
Ninguno; todo procedural. Si la distorsión de la luz (lente gravitacional) es viable con un
post-proceso sencillo, proponerla como opcional; si no, sustituirla por la viñeta oscura.
Sonidos: `agujero.formacion`, `agujero.zumbido` (loop), `agujero.colapso`.

## Lógica de servidor
- Presupuesto: como máximo `maxBloquesAbsorbidos` bloques arrancados en total y respetar el
  límite global de `FlyingBlockService`.
- Los bloques absorbidos se pueden restaurar con el resto.
- Los ítems sueltos en el radio también se atraen y se destruyen al llegar (configurable).

## Config
| Clave | Defecto |
|---|---|
| radioAtraccion | 25.0 |
| radioArranque | 10.0 |
| radioHorizonte | 2.0 |
| fuerzaMax | 0.25 |
| danioTick | 2.0 |
| danioColapso | 20.0 |
| maxBloquesAbsorbidos | 600 |
| destruirItems | true |

## Criterios de aceptación
- [ ] La atracción es más fuerte cerca del centro pero las entidades no "rebotan" al otro lado.
- [ ] Los bloques viajan en espiral visible, no en línea recta.
- [ ] TPS ≥ 18 durante toda la habilidad con valores por defecto.
- [ ] Tras el colapso todas las entidades quedan libres y el terreno se restaura según config.
