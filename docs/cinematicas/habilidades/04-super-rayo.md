# 04 — Super rayo (id: `super_rayo`)

**Concepto:** el cielo se oscurece, cae un relámpago colosal y ramificado sobre el objetivo.
Nada que ver con el rayo vanilla.

## Roles
- Objetivo: punto de impacto.
- Lanzador: si existe, el rayo nace de su mano levantada y sube al cielo antes de caer. Sin lanzador: cae directo.
- Jugador cinemático: objetivo.
- Duración total: 100 ticks.

## Línea de tiempo
| Tick | Servidor | Cliente |
|---|---|---|
| 0–40 | — | `SkyOverride TORMENTA` (cielo gris oscuro, rápido); truenos lejanos; pequeños destellos de nubes |
| 30–45 | — | `MARKER` azul bajo el objetivo; chispas eléctricas alrededor de él |
| 45 | IMPACTO: daño, fuego en radio 2, cráter pequeño | `LIGHTNING` desde Y+80 hasta el objetivo, grosor 1.2, 6 ramas; destello blanco total 4 ticks; sacudida máxima; trueno muy fuerte |
| 45–60 | — | El rayo se regenera 3 veces (parpadeo) y se desvanece |
| 60–100 | Arena/grava del cráter → vidrio (fulgurita) si `crearFulguritas` | El cielo vuelve; cámara vuelve |

## Cámara
0–40: desde el suelo a 10 bloques del objetivo, mirando hacia arriba (contrapicado), FOV 75.
44: `CUT` a plano general a 25 bloques.
45: destello + sacudida, plano fijo.

## Actores y assets
Ninguno. Sonidos: `rayo.trueno_lejano`, `rayo.impacto`.

## Lógica de servidor
- Daño directo `danio` al objetivo (ignora armadura si `ignorarArmadura`), daño eléctrico en
  área radio 4 con caída.
- `bowlCrater` radio 3 profundidad 2; fuego con probabilidad 0.3.
- Si se usa el rayo vanilla, SOLO por efectos de sonido/luz, nunca para el daño.

## Config
| Clave | Defecto |
|---|---|
| danio | 25.0 |
| radioArea | 4.0 |
| radioCrater | 3 |
| ignorarArmadura | false |
| crearFulguritas | true |

## Criterios de aceptación
- [ ] El relámpago es ramificado y diferente en cada uso (semilla).
- [ ] Cliente y servidor coinciden en el punto exacto de impacto.
- [ ] Jugadores a 60 bloques ven el rayo y oyen el trueno.
- [ ] El cielo se restaura siempre, también al cancelar.
