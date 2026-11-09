# 03 — Corona de espadas (id: `corona_espadas`)

**Concepto:** doce espadas espectrales aparecen formando una corona giratoria sobre el lanzador,
apuntan una a una al objetivo y se disparan en ráfaga.

## Roles
- Objetivo: blanco de las espadas.
- Lanzador: la corona aparece sobre su cabeza. Sin lanzador: la corona aparece a 15 bloques sobre
  el objetivo y las espadas caen en picado.
- Jugador cinemático: objetivo.
- Duración total: 140 ticks.

## Línea de tiempo
| Tick | Servidor | Cliente |
|---|---|---|
| 0–30 | Spawnea 12 actores `espada_espectral` en anillo (radio 2.5, 1.5 sobre la cabeza); anim `aparecer` escalonada cada 2 ticks | Sonido metálico por espada |
| 30–60 | La corona gira (1 vuelta/s) | Brillo pulsante |
| 60–70 | Cada espada rota para apuntar al objetivo | — |
| 70–100 | Dispara una espada cada 3 ticks hacia la posición ACTUAL del objetivo | `TRAIL` por espada; silbido |
| impacto | Daño, empuje leve; la espada queda clavada 40 ticks y se desvanece | Chispas; si da en bloque, rompe 1 bloque |
| 100–140 | Limpieza | Cámara vuelve |

## Cámara
0–60: contrapicado cerca del lanzador mirando la corona (FOV 60).
60–70: `CUT` a vista sobre el hombro del lanzador hacia el objetivo.
70–100: sigue a la primera espada en vuelo de lado, luego `CUT` a plano frontal del objetivo recibiendo las demás.
Sin lanzador: plano desde el suelo junto al objetivo mirando la corona en el cielo.

## Actores y assets
`espada_espectral` (GeckoLib): `espada_espectral.geo.json`, `.animation.json`, `.png` (semitransparente, emisiva).
Animaciones: `aparecer` (0.5 s), `girar` (loop), `desvanecer` (0.5 s). Hueso de punta: `punta`.
El proyectil en vuelo puede ser el mismo actor con física propia.

## Lógica de servidor
- Vuelo: velocidad 1.8 bloques/tick con corrección de rumbo leve (máx. 5° por tick).
- Impacto con entidad: `danioPorEspada`, knockback 0.4.
- Impacto con bloque: rompe ese bloque (restaurable) y se clava.

## Config
| Clave | Defecto |
|---|---|
| numeroEspadas | 12 |
| danioPorEspada | 5.0 |
| intervaloDisparoTicks | 3 |
| velocidad | 1.8 |
| romperBloqueAlImpactar | true |

## Criterios de aceptación
- [ ] La corona se forma de manera visible espada por espada.
- [ ] Las espadas apuntan con la punta (hueso `punta`) hacia el objetivo antes de salir.
- [ ] Si el objetivo se mueve, las espadas corrigen su rumbo pero pueden fallar.
- [ ] Ninguna espada queda en el mundo al terminar o cancelar.
