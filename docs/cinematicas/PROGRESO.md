# Progreso — habilidades cinemáticas

Arquitectura elegida: **servidor Paper + plugin LiveArena** (manda en el tiempo, daño, destrucción y física) y
**mod cliente «LiveArena Cinemáticas» (NeoForge 26.1.2 + GeckoLib 5.5)** (cámara, FOV, franjas, destellos, viñeta,
cielo, rótulos y modelos animados). Así se conservan s2e y el resto de plugins de Paper, y el mod solo hace falta
en el PC del streamer. Sin el mod, todo se ve igual salvo la cámara y los modelos (se ven displays y partículas).

Probado en Minecraft 26.1.2 real (NeoForge 26.1.2.126 + GeckoLib 5.5.2 contra Paper 26.1.2 build 74), con capturas.

| Fase / Habilidad | Estado | Notas |
|---|---|---|
| F1 Motor núcleo | ✅ | `/habilidad`, línea de tiempo por ticks, cola por jugador, cancelación (desconexión, muerte, cambio de mundo, detener, apagado), cámara por fotogramas con Catmull-Rom y curvas, salvavidas de 10 s en el cliente |
| F2 Primitivas y servicios | ✅ | BEAM, SPHERE, RING_WAVE, LIGHTNING, SLASH, MARKER, GLYPH, DISK, DOME_HEX, PARTICLE_STREAM; destrucción con presupuesto y restauración; bloques voladores; fuerzas; daño; `/habilidad debug` |
| 02 onda_repulsion | ✅ | |
| 01 escudo | ✅ | Persistente 30 s tras 3 s de cinemática |
| 04 super_rayo | ✅ | |
| 05 trueno_explosion | ✅ | |
| 03 corona_espadas | ✅ | Modelo GeckoLib `espada_espectral` (provisional) |
| 06 carrusel_creepers | ✅ | Creepers reales sin IA ni explosión (no funcionan en dificultad pacífica) |
| 09 juicio_arcano | ✅ | Sin el glifo vertical delante del lanzador |
| 10 esfera_energia | ✅ | Modelo GeckoLib `invocador` (provisional) si no hay lanzador |
| 11 meteorito | ✅ | Modelo GeckoLib `meteorito` (provisional); nace a 70 bloques para estar en zona cargada |
| 08 agujero_negro | ✅ | Sin lente gravitacional (viñeta oscura) |
| 07 ojo_vacio | ✅ | Modelo GeckoLib `ojo_vacio` (provisional) |
| 12 mil_cortes | ✅ | |

Provisional: los 4 modelos GeckoLib (cubos con los huesos y animaciones exactos de ASSETS.md) y los sonidos
(vanilla parecidos; se cambian en `habilidades.yml → sonidos`).
