# 10 — Esfera de energía (id: `esfera_energia`)

**Concepto:** el lanzador alza los brazos y la energía de todo lo que le rodea (y de los
jugadores cercanos) fluye hacia una esfera azul que crece hasta ser gigantesca. Después la
lanza lentamente contra el objetivo. (Inspirada en la Genkidama; diseño propio.)

## Roles
- Objetivo: recibe la esfera.
- Lanzador: la esfera se forma sobre su cabeza. Sin lanzador: se forma sobre un actor
  `invocador` (GeckoLib) que aparece a 30 bloques del objetivo.
- Jugador cinemático: objetivo.
- Duración total: 320 ticks.

## Línea de tiempo
| Tick | Servidor | Cliente |
|---|---|---|
| 0–20 | (Sin lanzador) spawnea `invocador`, anim `alzar_brazos` | — |
| 20–180 | La esfera crece radio 0.5→12 sobre el lanzador (centro a altura + radio + 3) | `SPHERE` azul-blanca; `PARTICLE_STREAM` desde: árboles/hojas/agua cercanos (puntos de la semilla), y desde CADA jugador en radio 64 (una línea de luz sale de cada uno); sonido creciente |
| 180–200 | Pausa | La esfera vibra; silencio dramático |
| 200–260 | La esfera avanza hacia el objetivo a velocidad lenta y constante (0.4 b/tick) y baja; destruye bloques que toca (`sphere` del radio actual, presupuesto alto) | Sombra/`MARKER` creciente en el suelo bajo su trayectoria |
| contacto | Al tocar al objetivo: lo empuja hacia abajo y la esfera "excava" 15 ticks | Sacudida continua; viento |
| contacto+15 | **Detonación**: `bowlCrater` radio 14 profundidad 8, daño `danio`, empuje radio 25 | `SPHERE` se expande a 18 y se desvanece; destello blanco largo; `RING_WAVE` 40 |
| final | — | Cámara vuelve |

## Cámara
20–180: desde el suelo a 8 bloques del lanzador en contrapicado, viendo cómo la esfera crece por encima (la cámara se aleja a medida que crece para que siempre quepa en pantalla).
180–200: `CUT` a plano sobre el hombro del objetivo mirando la esfera en el cielo.
200–contacto: sigue la esfera desde atrás-arriba.
Detonación: plano general a 50 bloques.

## Actores y assets
`invocador` (GeckoLib, solo si no hay lanzador): `invocador.geo.json`, `.animation.json`, `.png`.
Animaciones: `aparicion`, `alzar_brazos` (loop al final), `lanzar` (1 s). Hueso: `manos`.
Sonidos: `esfera.carga` (loop), `esfera.lanzar`, `esfera.detonar`.

## Config
| Clave | Defecto |
|---|---|
| radioMax | 12.0 |
| velocidad | 0.4 |
| danio | 50.0 |
| radioCrater | 14 |
| profundidadCrater | 8 |
| energiaDeJugadores | true |

## Criterios de aceptación
- [ ] Cada jugador cercano ve su propia línea de energía saliendo de él hacia la esfera.
- [ ] La esfera sigue cabiendo en pantalla durante el crecimiento.
- [ ] El avance destruye un túnel coherente con su tamaño sin congelar el servidor.
- [ ] El cráter final queda centrado en el punto de detonación.
