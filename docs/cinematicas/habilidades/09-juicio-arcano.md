# 09 — Juicio arcano (id: `juicio_arcano`)

**Concepto:** círculos mágicos gigantes se dibujan en el cielo, cargan energía y desatan una
lluvia de rayos arcanos sobre la zona, culminando en un pilar colosal sobre el objetivo.

## Roles
- Objetivo: centro de la zona.
- Lanzador: si existe, un `GLYPH` vertical aparece frente a él con los brazos como origen visual. Sin lanzador: solo los círculos del cielo.
- Jugador cinemático: objetivo.
- Duración total: 260 ticks.

## Línea de tiempo
| Tick | Servidor | Cliente |
|---|---|---|
| 0–60 | — | `GLYPH` principal (radio 16) a Y+30 sobre el objetivo se dibuja trazo a trazo; 6 `GLYPH` menores (radio 4) alrededor a distinta altura; todos giran en sentidos alternos; color dorado/violeta |
| 60–90 | Carga | Brillo creciente; runas que suben desde el suelo (partículas); sonido coral/ascendente |
| 90–190 | **Lluvia**: cada 3 ticks, un punto aleatorio (semilla compartida) en radio 15; `MARKER` 10 ticks antes; luego impacto: daño área radio 2, cráter radio 1 | `BEAM` fino desde el glifo menor más cercano al punto; destello pequeño |
| 200 | **Juicio final**: `MARKER` grande bajo el objetivo durante 20 ticks | Todos los glifos se alinean en una columna sobre el objetivo |
| 220 | Impacto final: daño `danioFinal`, cráter cilíndrico radio 5 profundidad 6 | `BEAM` colosal (radio 3) del glifo principal al suelo; destello; sacudida máxima |
| 220–260 | — | El pilar se estrecha y desaparece; glifos se apagan; cámara vuelve |

## Cámara
0–90: grúa: arranca a nivel del suelo junto al objetivo y sube a 35 bloques mirando el glifo.
90–190: plano picado desde 25 bloques de altura en diagonal, viendo la lluvia.
200–220: `CUT` a contrapicado desde el suelo junto al objetivo mirando la columna de glifos.
220: plano general a 35 bloques.

## Actores y assets
Ninguno; todo procedural (`GLYPH`, `BEAM`, `MARKER`). Sonidos: `juicio.carga`, `juicio.rayo`, `juicio.final`.

## Lógica de servidor
- Puntos de la lluvia generados con la semilla del contexto (cliente y servidor iguales).
- 30% de los rayos de la lluvia apuntan cerca del objetivo (radio 4) para que la tensión sea real.

## Config
| Clave | Defecto |
|---|---|
| radioZona | 15.0 |
| numeroRayos | 33 |
| danioRayo | 8.0 |
| danioFinal | 40.0 |
| radioCraterFinal | 5 |

## Criterios de aceptación
- [ ] Los glifos se dibujan progresivamente y giran suavemente.
- [ ] Cada rayo de lluvia cae exactamente sobre su marcador.
- [ ] Los jugadores pueden esquivar los rayos de la lluvia viendo los marcadores.
