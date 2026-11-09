# Motor común (`...cinematicas.engine`)

Todas las habilidades se construyen con estas piezas. Si una habilidad necesita algo que no
está aquí, se añade aquí de forma genérica (no dentro de la habilidad).

---
## A. Núcleo (fase F1)

### A1. Habilidades y línea de tiempo (servidor)
- `Ability` (abstracta): `id()`, `duracionTicks()`, `jugadorCinematico(ctx)`,
  `start(ctx)`, `tick(ctx, t)`, `end(ctx, cancelada)`.
- `AbilityContext`: nivel, objetivo, lanzador opcional, posición de origen, semilla aleatoria
  (para que cliente y servidor generen el mismo patrón), lista de actores y efectos creados
  (para limpiarlos), y un mapa de datos propio de la habilidad.
- `TimelineBuilder` (azúcar): `at(tick, acción)`, `between(desde, hasta, acciónPorTick)`,
  `every(n, desde, hasta, acción)`. Las fichas describen sus líneas de tiempo en este formato.
- `AbilityRegistry`: registro por id. `/habilidad lista` lo usa.
- `CinematicManager`: avanza las habilidades activas en `ServerTickEvent.Post`; aplica las
  reglas de cancelación (desconexión, muerte, cambio de dimensión, `/habilidad detener`,
  apagado del servidor). Garantiza que `end()` se llama siempre una sola vez.
- Habilidades con **efecto persistente** (ej. Escudo dura 30 s pero la cinemática 3 s):
  la cámara se devuelve al acabar la fase cinemática y la habilidad sigue activa sin cámara.
  `Ability` expone `duracionCinematicaTicks()` además de `duracionTicks()`.

### A2. Red
Payloads servidor→cliente (registrados en un único `NetworkSetup`):
- `CameraStartPayload(abilityId, origen, seed)` / `CameraKeyframesPayload(lista)` /
  `CameraEndPayload`
- `CameraShakePayload(intensidad, duracionTicks, decaimiento)`
- `ScreenFxPayload(tipo: FLASH|VIGNETTE|TINT, color, alpha, entrada, mantener, salida)`
- `SkyOverridePayload(modo: NORMAL|ESPACIO|TORMENTA|TINTE, color, ticks)`
- `RenderFxPayload(tipoPrimitiva, idInstancia, parámetros, ticksVida)` → crea/actualiza/borra
  primitivas de render en clientes cercanos (radio de seguimiento configurable, 128 bloques).
- `SoundCuePayload` solo si un sonido debe sonar solo para el jugador cinemático.

### A3. Cámara (cliente) — `CinematicCameraController`
- Keyframes: posición (absoluta o relativa a una entidad/punto), yaw, pitch, roll, FOV, tick,
  curva (`LINEAR`, `EASE_IN_OUT`, `EASE_IN_EXPO`, `EASE_OUT_EXPO`, `CUT` = cambio instantáneo).
- Modos de "mirar a": punto fijo, entidad (seguimiento suave), o libre.
- Interpolación por frame con `partialTick`; Catmull-Rom para trayectorias de más de 2 puntos.
- Sacudida: ruido suave (no aleatorio puro) con intensidad y decaimiento.
- Durante la cinemática: HUD y mano ocultos, input de movimiento/ataque/uso bloqueado,
  chat permitido. Todo se restaura al terminar o si llega `CameraEndPayload`.
- Salvavidas en cliente: si no llega ningún paquete de la habilidad en 10 s, se restaura sola.
- Elegir y justificar el método de anclaje (mixin en `Camera.setup` / evento de ángulos de
  cámara, o entidad cámara de cliente). Requisito: el chunk del jugador sigue cargado.

### A4. Config — `CinematicasConfig`
Sección `general` (presupuestos, restauración, bloques protegidos, radio de seguimiento)
y una sección por habilidad con los valores de su ficha.

---
## B. Primitivas de render de cliente (fase F2)
Todas: `RenderType` translúcido aditivo, full-bright, sin escritura en profundidad cuando
proceda, visibles para cualquier jugador dentro del radio de seguimiento, con
`ticksVida` y fundido de entrada/salida. Se dibujan en `RenderLevelStageEvent`
(etapa tras translúcidos) gestionadas por un `FxRenderManager`.

| Id | Primitiva | Parámetros clave | La usan |
|---|---|---|---|
| `BEAM` | Rayo/pilar: núcleo + capas, ondulación de grosor, textura desplazándose | inicio, fin, radio, colores, velocidad textura | Juicio, Meteorito (estela), Láser |
| `SPHERE` | Esfera brillante: núcleo + halo Fresnel + pulso | centro, radio, colores, pulso | Esfera de energía, Agujero negro, Explosión |
| `DOME_HEX` | Cúpula de hexágonos con ondas de impacto | centro, radio, color, impactos[] | Escudo |
| `RING_WAVE` | Anillo de onda expansiva sobre el terreno | centro, radioInicial→final, grosor, color | Onda, Trueno, Meteorito, Agujero negro |
| `GLYPH` | Círculo mágico procedural (anillos, runas, polígonos) que se "dibuja" y gira | centro, normal, radio, capas, semilla | Juicio, Ojo del vacío |
| `LIGHTNING` | Relámpago procedural con ramas (desplazamiento del punto medio), se regenera cada N ticks | inicio, fin, grosor, ramas, semilla | Super rayo, Trueno |
| `SLASH` | Corte: quad fino que aparece y se desvanece con estela | centro, dirección, longitud, grosor | Mil cortes, Corona |
| `DISK` | Disco de acreción giratorio con gradiente | centro, normal, radioInterior/Exterior, colores | Agujero negro |
| `TRAIL` | Estela que sigue a una entidad | entidad, longitud, color | Corona, Meteorito, Carrusel |
| `MARKER` | Círculo de aviso en el suelo que se llena | centro, radio, color, ticksHastaImpacto | Trueno, Juicio, Meteorito |
| `PARTICLE_STREAM` | Flujo de partículas desde puntos hacia un objetivo | orígenes[], destino, cantidad | Esfera de energía, Agujero negro |

Efectos de pantalla (solo jugador indicado o todos en radio): destello, viñeta, tinte, y
override de cielo (espacio negro con estrellas, tormenta oscura, tinte de color).

---
## C. Servicios de servidor (fase F2)

### C1. `BlockDestructionService`
- Formas: `sphere`, `bowlCrater` (cuenco con borde elevado opcional), `arc` (sector),
  `slabPlane` (plano fino orientado, para cortes), `cylinder`, `column`.
- Cola con presupuesto por tick; orden de destrucción configurable (de fuera a dentro o de
  dentro a fuera, para que se vea "crecer").
- Respeta bloques protegidos; sin drops; snapshot para restaurar.
- Opciones de decoración del cráter: fuego, magma, obsidiana, vidrio, con probabilidad.
- `RestoreService`: restaura snapshots tras `segundosRestauracion`, gradualmente.

### C2. `FlyingBlockService` (bloques voladores)
Bloques arrancados que vuelan como entidad visual (actor ligero que renderiza un `BlockState`),
con trayectorias: `LAUNCH` (balística), `ORBIT` (gira alrededor de un punto), `SPIRAL_IN`
(espiral hacia un punto), `HOVER` (flota). Límite global configurable; al exceder, se omiten
los visuales pero la destrucción sigue. No colocan bloques al caer salvo que se indique.

### C3. `ForceService`
- `pull(centro, radio, fuerzaMax, amortiguación)` y `push(...)`, con caída por distancia.
- `launch(entidad, vector)` para knockback dirigido.
- `hold(entidad, punto)` para fijar en un punto (atrapado).
- Para jugadores: enviar la actualización de velocidad correctamente para evitar
  rubber-banding; documentar el método elegido.

### C4. `DamageService`
- `damage(entidad, DamageType, cantidad, opciones)` con opciones: ignorar armadura,
  ignorar frames de invulnerabilidad (para golpes rápidos), no matar (dejar a 1 corazón)
  si la config `danioNoLetal` está activa.
- `areaDamage(centro, radio, máx, caída)`.
- Nunca daña al lanzador ni a jugadores en modo creativo/espectador.

### C5. `ActorEntity` (base de actores)
Base común para actores (GeckoLib o no): sin IA, sin gravedad salvo que se pida,
invulnerable, sin guardar en disco, se elimina si su habilidad no existe.
AABB de render ampliada para modelos gigantes (no desaparecer por culling).
Helper para disparar animaciones GeckoLib desde el servidor por nombre.

### C6. `SoundService`
Reproducir sonidos posicionales con volumen/tono, y secuencias programadas.

### C7. `/habilidad debug <primitiva|servicio>`
Muestra cada primitiva o prueba cada servicio delante del jugador, con valores por defecto.
Es la herramienta de pruebas visuales del usuario.
