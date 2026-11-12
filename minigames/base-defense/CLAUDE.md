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

## v3 (HUD propio y pantalla limpia)

- **HUD con fuentes del pack** (`tools/gen_hud.py` → fuentes `basedefense:*` + `src/main/resources/hud.json` con el avance
  de cada carácter). Nada de mods de cliente: el servidor compone texto con fuentes propias y espacios negativos.
  - Barra de acción (abajo): panel de estado (vida de la base, bajas, tiempo, fase, victorias), munición de cada hueco
    sobre la hotbar, lectura grande del arma en mano (recarga/giro/sin balas/daño x2) y hasta 2 avisos cortos.
  - Título de **una sola** BossBar (arriba; las barras nativas del pack son transparentes): meta de bajas, meta de likes,
    placas de jefe (hasta 2) y carteles grandes.
  - Título (centro): marcador de impacto (blanco, rojo a la cabeza, dorado si mata).
  - TextDisplay/nombre: barras de vida dibujadas (verde/amarillo/rojo; moradas en jefes).
  - Fórmulas medidas en el cliente 26.1.2 (borde superior del glifo): barra de acción `y = H − 65 − ascent`,
    BossBar 0 `y = 10 − ascent`, título `y = H/2 − 12 − 4·ascent`. Avance bitmap = `round(ancho_recortado·escala) + 1`.
  - El pack oculta corazones, comida, armadura y experiencia; hotbar y mira propias; viñeta más marcada.
  - Sin pack (si lo rechaza): versión de texto (BossBar de la base, barras de jefes, munición en la barra de acción).
  - `Hud.update()` solo marca sucio; `Hud.tick()` (desde `Game.tick`) redibuja cada 2 ticks como mucho.
- Sin marcador lateral ni varias BossBars: oleadas, regalos pequeños, rachas y avisos de jefe van como avisos cortos;
  los carteles grandes quedan para fases, jefes, base caída, ronda superada y metas.
- **Meta de bajas** (`recompensa.*`): cada N bajas cae un cofre dorado (munición, +10 % base, daño doble X s).
- **Bando aliado** (`/ttaliado misil|bombardeo|rayo <usuario>`, `game/Allies`): daño controlado solo a mobs del juego.
- Jefes: llegan con portal en espiral + rayo (`Fx.portal`).
- La rueda del ratón salta de la 6.ª arma a la 1.ª (no se seleccionan huecos vacíos) y el HUD dice el nombre del arma.
- Desarrollo del pack sin reiniciar: `plugins/BaseDefense/pack.zip` sustituye al del .jar; `/bd pack` lo reenvía.
- `copyDefaults`: las claves nuevas de config.yml se añaden solas al del servidor (lo cambiado por el usuario se queda).

## v4 (dificultad de verdad)

- **Asedio** (`dificultad.asedio`): el mob que llega a la base se queda golpeándola cada `golpeCada` s (daño = `danio` del
  tipo) hasta que lo matan; los creepers explotan una vez. Antes cada mob restaba una vez y desaparecía.
- **Élites**: probabilidad `eliteBase + elitePorFase·(fase−1)` (+ amenaza): ×`eliteVida`, ×`eliteVelocidad`, armadura de
  netherita, golpean ×1,6 y llevan «ÉLITE» sobre la barra.
- **Escalado**: vida = base × fase × (1 + `porRonda`·(ronda−1)) × amenaza; las oleadas también crecen por ronda y amenaza.
- **Amenaza** (`game/Threat`): puntos por mob/jefe donado (`/ttspawn`, `/ttboss`), bajan solos; niveles 1..5 → vida,
  velocidad, tamaño de oleada y élites. HUD: píldora «AMENAZA N» bajo la franja de arriba (desde el nivel 2).
- **Armas por fase** (`armas.*.desbloqueo`): las bloqueadas salen con candado (`basedefense:bloqueada`); se desbloquean al
  llegar a su fase (cartel «¡NUEVA ARMA!» y cargador lleno). Al caer la base vuelven a la fase 1; al ganar se conservan.
- **Munición escasa**: reservas pequeñas, cajas al 5 %, suministro cada 240 s con 1 cargador por arma desbloqueada.
- **Jefes**: más vida y el doble de rápidos, ataques más seguidos (Wither ráfagas de 2-4 calaveras, Dragón 2-3 bolas),
  `blindaje` (las balas hacen menos; explosivos completo) e `invocar` (esbirros cada X s con portal y rayo).
- **Arena** 55×13 (antes 80×15): si el tamaño de la config no coincide con el de la arena construida, `bd start` la
  reconstruye sola y pide volver a iniciar.
- **Marcador**: `ganadas` (ronda sobrevivida) y `perdidas` (base destruida) en datos.yml, contados solos; HUD «G-P»;
  `bd marcador reiniciar`. La v3 guardaba un solo número: se reparte al leerlo.
- **Migración**: config sin `dificultad.version` (ignorando los valores por defecto del .jar) → `config-v3.yml` + nueva.
- **Shader de cámara**: `post_effect basedefense:apocalipsis` en el pack (grano, aberración, gradación, viñeta); lo
  activa el mod LiveArena mientras el pack está cargado (`CineClient.minigamePost`).
- **Armas**: `tools/gen_guns.py` (modelos con más piezas y texturas de materiales 128×128 sin estirar).

## v5 (táctico)

- **Primera persona** (mod LiveArena, `client/BdGuns`): FOV ×0,86 en el minijuego; **Shift = apuntar** (arma al centro,
  zoom y −70 % de dispersión en el servidor); animaciones de retroceso, recarga, desenfundar y balanceo. Se detectan por
  los sonidos `basedefense:arma.*` que suenan junto al jugador (sin paquetes nuevos).
- **Modelos en primera persona con brazos** (guantes y mangas): `items/<arma>.json` usa `select` por `display_context`
  → `<arma>_fp` (arma + brazos) en primera persona; el resto ve el arma sola.
- **Proyectiles**: cohete y granada de 40 mm en 3D montados en el proyectil y orientados por su velocidad (el snowball
  lleva el modelo vacío `basedefense:vacio`); estelas, explosiones `Fx.blast` (fogonazo, onda expansiva, escombros,
  humo), agujeros de bala con chispas y casquillos.
- **Jefes**: estelas de calaveras/bolas de fuego, impactos grandes con onda; Warden con anillos sónicos, onda en la
  base y oscuridad breve; proyectiles más rápidos.

## v6 · zombis variados y desmembramiento
- `tools/gen_zombie.py`: piel propia del zombi (`assets/minecraft/textures/entity/zombie/zombie.png`, mapa UV estándar
  64×64) y modelos `basedefense:parte_cabeza|brazo|pierna|torso`, `trozo_carne`, `trozo_hueso` (textura `zombi_partes`).
- Variantes (solo familia zombi): CORREDOR (rápido, frágil, «»» en la barra) y BRUTO (enorme, lento, mucha vida, golpe ×2.2,
  desde la fase 2). Config en `zombis:`.
- `fx/Gore.java`: piezas ItemDisplay con física propia (gravedad, rebote, sangre, se encogen al final). Tiro a la
  cabeza = sale la cabeza; explosión o bruto = cuerpo entero en piezas (la entidad se quita). Sin pack: solo sangre.
- `MobManager.damage(gm, dmg, by, head, blast, from)` guarda cómo fue el golpe. Prueba: `/bd test despiece`.

## v7 · dragón del End
- `Bosses`: llegada con grieta de luz (3 BlockDisplay de cristal que se abren/cierran, doble hélice, anillos), ataque
  con carga de 26 ticks (orbes que crecen junto a la boca, `dragonOrb`), anillo-portal al soltar (`dragonRing`), bola
  `DragonFireball` (se cancela su nube con `EnderDragonFireballHitEvent`), estela `Fx.trail("dragon")` e impacto violeta.
- Pack: `post_effect basedefense:vacio` (gradación violeta). El mod lo pone mientras haya un EnderDragon a <200 bloques
  (`CineClient.minigamePost`) y da un «tirón» de FOV al aparecer (`dragonPunch`). Sin mod: solo los efectos del plugin.

## v13 (controles de shooter, dificultad nivelada, jefes y bombardeo)

- **Controles de shooter**: con el mod LiveArena (≥ 0.8.0) clic izquierdo dispara (mantenido en automáticas), clic derecho
  apunta y R/F recargan. El mod manda un byte con el estado del ratón por el canal de plugin `livearena:bd`
  (`Weapons.onPluginMessageReceived`) y cancela los clics de vanilla con un arma en la mano. Sin el mod no hay forma de
  saber que el clic izquierdo sigue pulsado, así que se conservan los controles clásicos (clic derecho dispara, Shift apunta).
- **Dificultad v5** (`dificultad.version: 5`; la config anterior queda en `config-v4.yml`): ~35 % menos vida en mobs y
  ~45 % menos en jefes, menos blindaje, armas más fuertes, más reserva y más cajas, élites y amenaza más suaves.
- **Jefes** (`Bosses.step`): wither y warden se mueven con aceleración y giro progresivo. Wither: aparece formándose
  (cuenta atrás de `invulnerableTicks` a mano, porque sin IA no baja sola), cabezas laterales siguen al streamer, se
  desliza de lado a lado, carga con partículas dirigidas (count 0) y descarga las calaveras de una en una con retroceso.
  Warden: sale de la tierra (`Pose.EMERGING`), usa su animación de cañón (`EntityEffect.WARDEN_SONIC_ATTACK`, disparo a
  los 34 ticks), ruge (`Pose.ROARING`) al llegar, al enfurecerse y cada tres embestidas, y golpea con `ENTITY_ATTACK`.
- **Bombardeo**: puntos de impacto marcados antes, escuadrilla de 3 aviones con estelas y alabeo, bombas dirigidas a su
  marca con estela, onda dorada, columna de fuego, secundarias y brasas; onda final por el carril.
- **Élites**: armadura completa con `equippable.asset_id = basedefense:elite` (`tools/gen_elite.py`); los que no llevan
  armadura (arañas, devastador) van con contorno rojo (equipo `bd_elite`). Sueltan brasas.
- Arreglo: `MobManager.tick` recorre una copia (un golpe de asedio que tumbaba la base vaciaba la colección a mitad).

## v14 · a ras de suelo y dificultad más suave
- `arena.alturaBase: 0` (antes 5): el streamer defiende a la altura del carril tras una barricada baja de sacos y
  tablones (centro despejado); los mobs que la crucen se devuelven al carril (`MobManager.steer`). Cambiar la altura
  regenera la arena al pulsar Iniciar (`arenaAltura` en datos.yml).
- Arena 46×9 (antes 55×13) para que todo quepa en el recorte vertical 9:16; FOV del mod ×0,74 (antes ×0,86).
- Config v6 (la anterior queda en `config-v5.yml`): pistola 15 de daño, subfusil 8 con munición infinita y menos
  dispersión, mobs de las primeras fases con menos vida, base 1500, asedio cada 2,4 s, menos élites y amenaza más lenta.
- v14 F5: dragón con vuelo propio (`Bosses.dragonStep`: rumbo continuo con giro máximo por tick, órbita alargada sobre el
  carril, picado sobre la base cada 20 s con aliento) a ≥24 bloques sobre el suelo, por encima de las copas. Todos los
  jefes llevan contorno morado (equipo `bd_jefe`): son casi negros y el escenario es oscuro. El wither vuela a ≤2,5 bloques
  (más arriba quedaba entre las copas y detrás de la placa del jefe).
- v14 F6: `tools/gen_infected.py` (lo llama gen_pack): texturas propias de husk, esqueleto, esqueleto wither y araña (+ojos)
  «infectados», dibujadas por código sobre el desplegado UV estándar.
