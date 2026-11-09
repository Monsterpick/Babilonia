# 02 — Onda de repulsión (id: `onda_repulsion`)

**Concepto:** el lanzador concentra energía y libera un anillo de fuerza que barre el terreno
y lanza todo por los aires.

## Roles
- Objetivo: centro de la onda (si hay lanzador, el centro es el lanzador y el objetivo es
  solo el jugador cinemático; si no, el centro es el objetivo y él NO recibe daño).
- Jugador cinemático: objetivo.
- Duración total: 80 ticks.

## Línea de tiempo
| Tick | Servidor | Cliente |
|---|---|---|
| 0–25 | Carga: partículas de polvo convergen al centro | Cámara baja y se aleja; viñeta suave; sonido de carga |
| 25 | Liberación | Destello blanco corto; sacudida fuerte; `RING_WAVE` 0→20 en 15 ticks |
| 25–40 | El frente del anillo avanza; a cada entidad se la golpea UNA vez cuando el frente la alcanza | Polvo y partículas de bloque bajo el frente; bloques sueltos saltan (`FlyingBlockService.LAUNCH`, solo visual, opcional) |
| 40–80 | — | Polvo se asienta; cámara vuelve |

## Cámara
Desde tick 0: vista aérea diagonal a 12 bloques de altura y 10 de distancia mirando al centro;
en el tick 25 sube rápido a 18 de altura (vista casi cenital) para ver el anillo entero. `EASE_OUT_EXPO`.

## Actores y assets
Ninguno. Sonidos: `onda.carga`, `onda.liberar`.

## Lógica de servidor
- Golpe por entidad: knockback radial horizontal `fuerzaMax * (1 - d/radio)` + vertical 0.6.
- Daño `danio * (1 - d/radio)` con mínimo 2.
- Destrucción: solo bloques frágiles (cristal, hojas, flores, nieve) en el radio si `romperFragiles`.

## Config
| Clave | Defecto |
|---|---|
| radio | 20.0 |
| fuerzaMax | 3.0 |
| danio | 8.0 |
| ticksExpansion | 15 |
| romperFragiles | true |
| bloquesVoladoresVisuales | true |

## Criterios de aceptación
- [ ] Las entidades salen volando en el momento en que el anillo visual las alcanza (no antes ni después).
- [ ] Cada entidad recibe un solo golpe.
- [ ] El centro (lanzador u objetivo según rol) no recibe daño.
- [ ] Con `romperFragiles=false` no se rompe ningún bloque.
