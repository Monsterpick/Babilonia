# Prompt maestro · «Parkour LIVE» (borrador v1)

> Documento vivo: lo vamos completando juntos antes de programarlo. Las secciones marcadas **[DECIDIR]** son las
> preguntas abiertas para el streamer. Todo lo demás es la propuesta por defecto.

## 1. Idea en una frase

Un parkour vertical por **etapas** (zonas temáticas) que el streamer sube en directo mientras el chat, con sus regalos,
le **pone trampas** o le **ayuda**. Gana si llega a la cima antes de que acabe el tiempo; pierde si se le acaban las
vidas. El marcador de ganadas/perdidas es automático, como en Base Defense.

## 2. Reglas fijas (heredadas del proyecto)

- Plugin Paper propio (Java 25, Gradle KTS), en `minigames/parkour/`, mismo estilo que `minigames/base-defense/`.
- Nada copiado: ni código, ni mapas, ni texturas, ni sonidos, ni nombres de otros servidores o minijuegos. Las
  imágenes o vídeos de referencia son solo inspiración.
- Sin secretos en el código (`.env` y almacenamiento seguro de la app).
- Nada que actúe con la cuenta del streamer sin su permiso explícito; nada que parezca apuestas ni premios en dinero.
- Mutuamente excluyente con supervivencia/cinemáticas y con Base Defense (la app ya gestiona esto para BD).
- Texto en español; todo configurable en `config.yml` y desde la sección **Minijuegos** de la app.

## 3. El recorrido

- **Generado por código** con semilla (como la arena de BD): misma semilla = mismo parkour; botón «nuevo mapa» en
  la app.
- **Etapas** (orden por defecto, cada una con su paleta de bloques, ambiente y música propia sintetizada):
  1. Ruinas del bosque (saltos básicos, troncos, hojas)
  2. Cuevas de cristal (techos bajos, saltos con poca luz, slime)
  3. Fábrica (cintas transportadoras con bloques móviles, pistones, plataformas que caen)
  4. Hielo (bloques resbaladizos, saltos largos, viento lateral)
  5. Nether (lava abajo, plataformas que se desmoronan, magma)
  6. Cielo / End (plataformas flotantes, levitación corta, saltos a ciegas con niebla)
- Cada etapa: 8-14 «saltos» con dificultad creciente y un **checkpoint** al final (bandera + luz + sonido). **[DECIDIR]**
  ¿cuántas etapas por partida (4, 6, o configurable)?
- Generador por «piezas» (módulos de salto): salto de 2/3/4, neo, escalera de vallas, escalera de cuerda, salto con
  pared, bloque de slime, trampilla, cadenas, plataforma móvil (BlockDisplay que se mueve y lleva al jugador), etc.
  Cada pieza declara su dificultad (1-5) y qué necesita (sprint, salto, cabeza libre…). Se comprueba que cada salto es
  posible (distancia y altura máximas reales del jugador) antes de colocarlo.
- Paredes laterales decorativas y una «torre» central visible desde lejos, para que el stream entienda dónde está.

## 4. Vidas, tiempo y resultado

- Vidas: **5** por defecto (overlay «Vidas» de la app). Caer al vacío o a la lava = −1 vida y vuelta al último
  checkpoint con una transición corta (fundido + sonido), sin pantalla de muerte.
- Tiempo límite por partida: **20 min** (overlay «Cronómetro» en cuenta atrás). Opcional: los regalos suman/restan
  tiempo.
- Gana: llega a la cima → fuegos artificiales, banner «¡CIMA!», +1 ganada. Pierde: 0 vidas o tiempo agotado → +1
  perdida, se reinicia en la etapa 1 (o en la etapa actual si así se configura).

## 5. Lo que hace el chat (regalos → efectos)

Todo con **cola**, **enfriamiento** y **tope por minuto** para que el juego siga siendo jugable. Nombre y foto de quien
lo manda en el overlay «Avisos». Mapeo de regalos editable en la app (como en BD).

**Trampas (sabotaje):**
- Empujón (knockback suave en dirección aleatoria; nunca directo al vacío desde una pieza difícil).
- Viento: 5 s de empuje lateral constante.
- Niebla / oscuridad 8 s.
- Bloques fantasma: los 3 próximos saltos parpadean (visibles 1 s, invisibles 1 s).
- Lento / sin sprint 6 s.
- Controles invertidos 5 s (solo izquierda/derecha; se avisa con un icono grande).
- «Terremoto»: la cámara tiembla 4 s.
- Mobs de estorbo (phantom/vex sin daño o con daño mínimo) que empujan.
- Gran trampa (regalo caro): la plataforma actual se desmorona en 3 s, o vuelve al checkpoint anterior.

**Ayudas:**
- +1 vida, escudo anticaída 15 s (la siguiente caída no cuenta), plataforma de rescate bajo los pies, impulso
  (salto extra alto una vez), «linterna» (marca el siguiente salto con partículas), +60 s de tiempo, saltar la pieza
  actual (teletransporta al inicio de la siguiente).

**Likes:** cada N likes = mini‑ayuda (marcador de salto); meta de likes = checkpoint gratis.
**Seguidores / Quiéreme / compartir:** pequeños efectos visuales (confeti, corazón en el cielo) sin afectar al juego.

**[DECIDIR]** ¿Más trampas que ayudas? ¿Los mismos regalos que en BD para que la audiencia ya los conozca?

## 6. Dificultad inteligente (como la «amenaza» de BD)

- Nivel de **sabotaje** (1-5) que sube con las trampas recibidas y baja solo con el tiempo. A más nivel: trampas más
  largas, menos enfriamiento y piezas generadas más difíciles en las etapas siguientes.
- Protección del streamer: tras 3 caídas seguidas en la misma pieza, 10 s de inmunidad a trampas y la pieza se
  marca con partículas guía. Nunca dos trampas a la vez.

## 7. Presentación (calidad Base Defense o mejor)

- Pack de recursos propio del minijuego (generado por scripts Python como en BD): texturas por etapa, cielo, nubes,
  sonidos (saltos, checkpoint, caída, trampas), música ambiente por etapa.
- **HUD con fuentes del pack** (mismo sistema que BD, `HudFont`): panel inferior con vidas, tiempo, etapa x/6,
  progreso (barra de altura), ganadas‑perdidas; notificaciones de trampas/ayudas con icono; sin desorden.
- Shader de cámara suave por etapa (frío en hielo, cálido en nether) con el mod, solo mientras el pack está puesto.
- Barra de progreso vertical a la derecha (altura actual / cima) y marcadores de checkpoints.
- Cinemática corta al empezar (vuelo de cámara de la base a la cima) y al ganar (cámara orbitando la cima).
- Fantasma del mejor intento (ArmorStand/Display translúcido que repite el mejor recorrido) **[DECIDIR]**.

## 8. Integración con la app

- Minijuegos → Parkour: instalar, iniciar/parar, semilla y «nuevo mapa», vidas, tiempo, nº de etapas, mapeo de
  regalos, botones de prueba de cada trampa/ayuda, estado en vivo (etapa, vidas, tiempo, nivel de sabotaje).
- Comandos solo de la lista blanca (`/pk start|stop|status|test <evento>`, `/ttpk <efecto> <usuario>`), como `/bd`.
- Overlays reutilizados: Vidas, Cronómetro, Contador (ganadas/perdidas), Avisos, Meta de likes. Nuevo overlay
  opcional: «Altura» (barra vertical con el progreso y los checkpoints).

## 9. Entrega por fases (para ir probando)

1. Generador del recorrido + checkpoints + vidas/tiempo + comandos de prueba (sin regalos).
2. HUD con fuentes, sonidos y texturas por etapa.
3. Trampas y ayudas con cola/enfriamientos + integración con la app.
4. Sabotaje inteligente, cinemáticas, shader por etapa y pulido.
5. Auditoría completa en el servidor de pruebas (capturas de cada trampa y etapa).

## 10. Preguntas para el streamer **[DECIDIR]**

1. ¿Parkour vertical (torre) u horizontal (camino largo)? Propuesta: vertical, se entiende mejor en directo.
2. ¿Cuántas etapas y cuánto tiempo por partida?
3. ¿Qué regalos concretos para cada trampa/ayuda? (Podemos partir de los de BD.)
4. ¿Al perder se vuelve al inicio o a la etapa actual?
5. ¿Quieres modo «carrera» con espectadores dentro del servidor, o siempre solo el streamer?
6. ¿Algún tema de etapa que quieras añadir o quitar?
