# 07 — Ojo del vacío (id: `ojo_vacio`)

**Concepto:** el cielo se tiñe de púrpura y un ojo colosal de anillos concéntricos se abre
sobre el objetivo. Todo a su alrededor empieza a flotar, y cuando el ojo late, todo es
aplastado contra el suelo. (Inspirado en el Rinnegan; diseño propio de anillos.)

## Roles
- Objetivo: bajo el ojo.
- Lanzador: ignorado.
- Jugador cinemático: objetivo.
- Duración total: 260 ticks.

## Línea de tiempo
| Tick | Servidor | Cliente |
|---|---|---|
| 0–30 | Spawnea actor `ojo_vacio` a Y+40 sobre el objetivo, mirando hacia abajo | `SkyOverride TINTE` púrpura (#4B1F6F); `GLYPH` enorme (radio 18) se dibuja detrás del ojo |
| 30–60 | anim `abrir` | Viñeta púrpura; sonido grave |
| 60–160 | **Levitación**: entidades vivas en radio 15 flotan hasta +6 (lento, `ForceService.hold` hacia altura objetivo); bloques de superficie se arrancan (hasta `maxBloquesFlotantes`) y flotan girando (`FlyingBlockService.HOVER`/`ORBIT`); el ojo sigue al objetivo con la pupila (hueso `pupila` mira hacia él) | Silencio inquietante con zumbido; partículas moradas subiendo |
| 160 | anim `latido` | Pulso: destello púrpura, sacudida fuerte, `RING_WAVE` desde el suelo |
| 162 | **Aplastamiento**: todo lo flotante cae con fuerza hacia abajo; daño `danio` al objetivo y caída a otros; los bloques flotantes caen y se rompen (no se colocan); cráter `bowlCrater` radio 6 poco profundo bajo el objetivo | Polvo masivo |
| 180–230 | anim `cerrar` | El glifo se desvanece |
| 230–260 | Actor eliminado | Cielo vuelve; cámara vuelve |

## Cámara
0–60: detrás del objetivo, cerca del suelo, mirando hacia el ojo (contrapicado extremo), FOV 80.
60–160: dolly zoom lento hacia el ojo (FOV 80→50 mientras la cámara retrocede) — efecto vértigo.
160: `CUT` a plano general lateral a 30 bloques para ver la caída.

## Actores y assets
`ojo_vacio` (GeckoLib): `ojo_vacio.geo.json`, `.animation.json`, `.png` (emisivo).
Animaciones: `abrir` (1.5 s), `idle` (loop), `latido` (0.5 s), `cerrar` (2 s).
Huesos: `parpado_superior`, `parpado_inferior`, `iris`, `pupila`.
Escala del render: diámetro ~16 bloques.
Sonidos: `ojo.abrir`, `ojo.latido`, `ojo.zumbido`.

## Config
| Clave | Defecto |
|---|---|
| radio | 15.0 |
| alturaLevitacion | 6.0 |
| maxBloquesFlotantes | 120 |
| danio | 24.0 |
| radioCrater | 6 |

## Criterios de aceptación
- [ ] La pupila sigue al objetivo de forma suave.
- [ ] Los jugadores flotando no sufren rubber-banding ni pueden escapar volando.
- [ ] No hay daño por caída duplicado (el aplastamiento sustituye la caída).
- [ ] Los bloques flotantes se ven girando y caen en el latido; el terreno se restaura si la config lo indica.
