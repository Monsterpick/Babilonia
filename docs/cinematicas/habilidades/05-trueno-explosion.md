# 05 — Trueno + explosión (id: `trueno_explosion`)

**Concepto:** tres rayos de aviso cercan al objetivo en triángulo; luego cae un rayo central
y medio segundo después todo estalla en una bola de fuego.

## Roles
- Objetivo: centro.
- Lanzador: ignorado.
- Jugador cinemático: objetivo.
- Duración total: 140 ticks.
- Reutiliza: `LIGHTNING`, `MARKER`, `SkyOverride TORMENTA` de `super_rayo`; `RING_WAVE`, `SPHERE`.

## Línea de tiempo
| Tick | Servidor | Cliente |
|---|---|---|
| 0–20 | — | Cielo de tormenta; 3 `MARKER` a 6 bloques del objetivo en triángulo |
| 20, 30, 40 | Rayo menor en cada vértice: daño área radio 2, cráter radio 1 | `LIGHTNING` fino, sacudida media |
| 40–60 | El objetivo queda inmovilizado (lentitud alta) | Los 3 puntos se unen con arcos eléctricos (3 `LIGHTNING` horizontales entre vértices, a 1 bloque del suelo) |
| 60 | Rayo central sobre el objetivo, daño `danioRayo` | `LIGHTNING` grueso + destello |
| 70 | EXPLOSIÓN: cráter `bowlCrater` radio 8, fuego, empuje, daño `danioExplosion` | `SPHERE` naranja-blanca 0→9 en 8 ticks y se disipa; `RING_WAVE` radio 25; destello; sacudida máxima |
| 70–140 | Restos ardiendo | Humo; cámara vuelve |

## Cámara
0–40: travelling circular alrededor del objetivo a 12 bloques, altura 4.
40–60: subida lenta a vista cenital a 20 bloques (se ve el triángulo).
69: `CUT` a plano general bajo a 30 bloques para ver la explosión completa.

## Actores y assets
Ninguno. Sonidos: `trueno.menor`, `trueno.mayor`, `explosion.grande`.

## Lógica de servidor
- La explosión NO usa la explosión vanilla: destrucción con `BlockDestructionService.bowlCrater`
  (borde elevado sí), decoración fuego 0.25, magma 0.05.
- Daño explosión con caída por distancia hasta radio 12.

## Config
| Clave | Defecto |
|---|---|
| danioRayoMenor | 6.0 |
| danioRayo | 15.0 |
| danioExplosion | 30.0 |
| radioCrater | 8 |
| inmovilizar | true |

## Criterios de aceptación
- [ ] Los 3 rayos caen exactamente donde estaban los marcadores.
- [ ] La explosión se ve como esfera de fuego (no solo partículas vanilla).
- [ ] El cráter crece de dentro a fuera en pocos ticks sin bajar los TPS por debajo de 18.
