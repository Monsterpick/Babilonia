# 12 — Mil cortes (id: `mil_cortes`)

**Concepto:** cortes invisibles e instantáneos rebanan el espacio alrededor del objetivo:
solo se ve el destello de cada tajo. El terreno queda cortado en líneas perfectas y el
objetivo recibe cientos de golpes. Termina con un corte en cruz gigante.
(Inspirada en las técnicas de Sukuna; diseño propio.)

## Roles
- Objetivo: centro.
- Lanzador: si existe, permanece quieto con un gesto (sin modelo extra); la cámara le dedica un plano. Sin lanzador: los cortes salen de la nada.
- Jugador cinemático: objetivo.
- Duración total: 200 ticks.

## Línea de tiempo
| Tick | Servidor | Cliente |
|---|---|---|
| 0–20 | Objetivo inmovilizado | Silencio absoluto (bajar volumen ambiente); viñeta negra-roja |
| 20–100 | **Ráfaga**: cada tick, `cortesPorTick` cortes con orientación aleatoria (semilla) dentro de una esfera radio 10 centrada en el objetivo. Cada corte: `slabPlane` de 1 bloque de grosor, longitud 4–12, rompe bloques (presupuesto); golpe de `danioCorte` al objetivo cada 2 ticks ignorando frames de invulnerabilidad | `SLASH` blanco por corte (vida 3 ticks), destellos; sonido de tajo rápido superpuesto; partículas de bloque en el plano cortado |
| 100–120 | Pausa | Silencio; los últimos cortes se desvanecen |
| 120 | **Corte final en cruz**: dos `slabPlane` enormes (longitud 30) cruzados en el objetivo; daño `danioFinal`; empuje hacia atrás | Dos `SLASH` gigantes rojo-blancos; destello; sacudida máxima |
| 120–200 | Las mitades superiores de bloques cortados en el plano de la cruz se desplazan 0.3 bloques (solo visual, con `FlyingBlockService.HOVER` breve) y se asientan | Cámara vuelve |

## Cámara
Montaje rápido con `CUT`:
20–100: cambia de ángulo cada 10 ticks entre 6 posiciones predefinidas alrededor del objetivo
(primeros planos, plano cenital, plano del lanzador si existe). Ligera sacudida constante.
100–120: plano fijo frontal medio.
120: `CUT` a plano general lejano para ver la cruz.

## Actores y assets
Ninguno. Sonidos: `cortes.tajo` (varias variaciones), `cortes.final`.

## Lógica de servidor
- Total de cortes ≈ 80 ticks × `cortesPorTick`. Debe respetar el presupuesto de bloques; si
  se excede, se recortan los cortes más lejanos, nunca se congela.
- El daño por corte debe sonar/registrarse aunque haya frames de invulnerabilidad (usar el helper de `DamageService`).
- Otras entidades atravesadas por un corte reciben `danioCorte`.

## Config
| Clave | Defecto |
|---|---|
| radio | 10.0 |
| cortesPorTick | 3 |
| danioCorte | 1.0 |
| danioFinal | 30.0 |
| romperBloques | true |

## Criterios de aceptación
- [ ] Los cortes del terreno son líneas rectas limpias de 1 bloque de grosor en ángulos variados.
- [ ] El objetivo recibe daño continuo visible (enrojecimiento) durante la ráfaga.
- [ ] Los cortes de cámara son instantáneos y sin parpadeo de un frame de la vista normal.
- [ ] TPS ≥ 18 con valores por defecto.
