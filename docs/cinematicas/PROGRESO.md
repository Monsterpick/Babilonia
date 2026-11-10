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
| 01 escudo | ✅ | Vida propia en corazones (50 por defecto, editable en la app), barra de vida, cúpula de paneles hexagonales |
| 04 super_rayo | ✅ | |
| 05 trueno_explosion | ✅ | |
| 03 corona_espadas | ✅ | Espadas de Minecraft de madera a netherita |
| 06 carrusel_creepers | ✅ | Creepers cargados por rayos; explosiones con onda, tierra volando y gran final (no funcionan en pacífico) |
| 09 juicio_arcano | ✅ | Círculos arcanos animados (modelo) y sonido desde el inicio |
| 10 genkidama (alias esfera_energia) | ✅ | Actor `goku`; la esfera se ancla al hueso `manos` y crece sobre las manos alzadas; túnel por la cola con presupuesto |
| 11 meteorito | ✅ | Roca de basalto con grietas de lava que brillan; nace a 70 bloques para estar en zona cargada |
| 08 agujero_negro | ✅ | Horizonte, disco de acreción, anillo de fotones y chorros (modelo) |
| 07 ojo_vacio | ✅ | Ojo con párpados, iris brillante, pupila rasgada, tentáculos y cristales |
| 12 mil_cortes | ✅ | Actores `sukuna` y `santuario` (14 bloques); sello, dominio, ráfaga 110–190, cruz en 220 con mitades desplazadas |
| 13 akaza | ✅ | Actor `akaza`; copo de 12 puntas (modelo plano a la altura de sus pies), impacto visual en el tick 85 (configurable) |
| 14 vacio_purpura (alias gojo) | ✅ | Actor `gojo`; esferas azul y roja ancladas a las manos, fusión en `mano_proyectil`, orbe que borra y atrae |

Los modelos son diseños propios generados por `mod/tools/` y se pueden sustituir por modelos de Blockbench con un
paquete de recursos (ver ASSETS.md). Los sonidos son vanilla en capas; se cambian en `habilidades.yml → sonidos`.
Sin DamageType propio en JSON: el servidor es Paper (los plugins no registran tipos de daño); se usa el daño del
motor con el «golpe letal final» de LiveArena.
Durante las habilidades Paper no expulsa por «volar» (y la app pone allow-flight=true).

## v4 — Efectos con shaders propios y voces

- **Motor de efectos del mod (`CineVfx`)**: esferas de plasma, halos, ondas expansivas, haces, tajos, auras de llamas,
  vórtices, rayos, estelas y partículas propias, dibujados con shaders (`assets/livearena/shaders/core/fx.*`).
  El plugin los crea como un modelo más: `fx_azul`, `fx_rojo`, `fx_purpura`, `fx_genki`, `fx_aura`, `fx_onda`, `fx_pilar`,
  `fx_cortes`, `fx_brujula`, `fx_golpe`, `fx_cometa`, `fx_rayos` (escala = tamaño, animación = estado, color = tinte).
- **Brújula de Akaza**: calco sobre el terreno bloque a bloque (sigue el relieve, sin parpadeos). Textura: `tools/gen_brujula.py`.
- **Voces**: `assets/livearena/sounds/voz/*.ogg` (audios aportados por el usuario). Las líneas de tiempo de genkidama,
  mil_cortes, vacio_purpura y akaza están sincronizadas con ellas. Se configuran en `habilidades.yml → voces`.
- Sin el mod se siguen viendo los efectos de respaldo (partículas y displays) y los sonidos de Minecraft.
