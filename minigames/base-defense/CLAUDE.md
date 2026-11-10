# Base Defense — notas para desarrollo

Plugin de Paper **26.1.2** (Java **25**) con Gradle Kotlin DSL. Minijuego de defender la base para
TikTok LIVE: la app (LiveArena, TikFinity…) solo ejecuta comandos `/tt*` por RCON.

## Comandos de build

```bash
./gradlew build          # → build/libs/BaseDefense.jar
./gradlew runServer      # servidor Paper 26.1.2 de prueba en run/ con el plugin (run-paper)
./gradlew build -PpaperVersion=26.1.2.build.NN-stable   # otra build de paper-api
```

En CI (`.github/workflows/build-windows.yml`) se compila y el .jar viaja dentro de la app
(`apps/server/assets/plugins/BaseDefense.jar`).

## Verificado contra la API real de 26.1.2 (no de memoria)

- `paper-plugin.yml` + `PluginBootstrap` (datapack del bioma con `LifecycleEvents.DATAPACK_DISCOVERY`).
- Comandos con Brigadier: `getLifecycleManager().registerEventHandler(LifecycleEvents.COMMANDS, …)`.
- Gamerules nuevas: `org.bukkit.GameRules` (`ADVANCE_TIME`, `SPAWN_MOBS`, …). Las constantes de
  `GameRule.DO_*` están marcadas para borrado.
- Partículas: `EXPLOSION`/`EXPLOSION_EMITTER`, `TRAIL` (con `Particle.Trail`), `FLASH` (lleva `Color`).
- Atributos sin prefijo: `Attribute.MAX_HEALTH`, `Attribute.SCALE`, `Attribute.MOVEMENT_SPEED`.
- Bioma propio: formato 26.1 con `attributes` (`minecraft:visual/fog_color`, `minecraft:visual/ambient_particles`…).
- MobGoals: `Bukkit.getMobGoals().removeAllGoals(mob)` + un `Goal<Mob>` propio (`LaneGoal`).

## Arquitectura

```
dev.livearena.basedefense
├─ BaseDefense        main: mundo, gamerules, bucle central (1 tarea por tick para todo)
├─ BdBootstrap        datapack interno (bioma basedefense:ceniza)
├─ Settings           config.yml → valores inmutables (recarga con /bd reload)
├─ arena/             generador por código (sin WorldEdit)
│  ├─ ArenaGenerator  diseño en memoria (Canvas) a partir de la semilla
│  ├─ Pieces          piezas reutilizables: árboles, ruinas, restos, base
│  ├─ BlockPlacer     vuelca el Canvas por lotes (bloques/tick) con barra de progreso
│  ├─ ArenaData       lo único que se guarda: spawn, waypoints, spawn de mobs, región base
│  └─ VoidGenerator   mundo vacío con el bioma de la config
├─ game/              Game (rondas, base, victorias, inventario del streamer), Hud, LikeGoal, Protection
├─ mob/               MobManager (colección propia, cola, detección de base, LaneGoal), Bosses
├─ weapon/            Weapons (hitscan con 1 ray trace, cohetes, granadas con rebote)
├─ fx/                Fx (presupuesto de partículas/sonidos por tick, sangre), Ambience
└─ cmd/               BdCommands (Brigadier: /bd y /tt*)
```

Decisiones:

- **Una sola colección de mobs** (`MobManager.mobs`), marcados con PDC. Nada recorre las entidades del mundo
  (solo `purgeStrays` al arrancar, para limpiar restos de una caída del servidor).
- **Vida virtual** (`GameMob.hp`): los jefes pueden tener más de 1024 de vida; el daño de las armas
  se aplica sin invulnerabilidad y sin knockback (la metralleta no pierde balas).
- **IA**: se quitan todos los goals y targets vanilla y se añade un único `LaneGoal`. Los mobs con
  "cerebro" (warden, piglins…) no usan goals: se detecta y se mueven a mano por el carril, como los
  jefes voladores (wither, ghast, blaze con IA apagada; el dragón en fase HOVER porque sin IA el
  cliente no interpola su posición).
- **Etiquetas de donante**: TextDisplay como pasajero (se ve hasta ~150 bloques, el cliente lo mueve
  con el mob). En hordas grandes solo se etiquetan `etiquetasPorHorda` y como mucho `etiquetasMax`.
- **Chunks de la arena** con ticket de plugin durante la partida: los mobs del portal siguen vivos aunque
  la distancia de visión del servidor sea corta.
- **Sin colisión entre mobs** (`setCollidable(false)`) y `MAX_ENTITY_CRAMMING=0`.
- El streamer no puede salir de la plataforma: barreras laterales/traseras + comprobación cada 10 ticks
  (el frente no lleva barrera para no bloquear los proyectiles).

## v2 (feedback del streamer)

- **Modos separados**: el mundo del juego lleva la marca PDC `basedefense:juego`; el plugin LiveArena no ejecuta
  cinemáticas, efectos survival ni la barra de tótems ahí (`plugin/.../Minijuego.java`), y los /tt* solo actúan con
  la partida en marcha. La app cambia al perfil «Base Defense» al empezar y recupera el anterior al terminar.
- **Armas**: pistola, subfusil, ametralladora, lanzagranadas, lanzacohetes y minigun (gira antes de disparar,
  2 balas/tick). Munición = cargador (barrita de durabilidad en la hotbar) + reserva; loot de cajas que vuelan hasta
  el jugador (`game/Loot`) y suministros en paracaídas (cada fase, cada `suministroCada` s y `/ttsuministro`).
- **Fases** (`game/Waves`): 5 por ronda; desbloquean mobs (`fase`, `peso` en config), suben vida/velocidad y lanzan
  oleadas automáticas además de los regalos. `/ttspawn horda <n>` = mezcla de la fase.
- **Jefes** (`mob/Bosses`): Wither (calaveras, destruibles a tiros), Dragón del End (bolas de fuego devolvibles) y
  Warden (cañón sónico + embestidas en la base). No desaparecen al llegar: atacan hasta morir.
- **Vida visible**: barra de 10 tramos como nombre del mob (o bajo el nombre del donante).
- **Pack de texturas** (`tools/gen_pack.py` → `src/pack` → `basedefense-pack.zip` dentro del jar, servido por
  `pack/PackServer` en el puerto `paquete.puerto`): texturas propias generadas, shader de color (terrain/entity
  .fsh), modelos 3D de las armas (`item_model`) y sonidos sintetizados. Se pone al empezar y se quita al terminar.
- Migración: un config.yml sin `oleadas` (v1) se guarda como `config-v1.yml` y se escribe el nuevo.

## Medido en el servidor de pruebas

300 mobs vivos + 94 en cola + jefe + metralleta disparando sin parar: **20 TPS, MSPT medio 7,5 ms
(máx. 20 ms)**, 458 entidades en el mundo.
