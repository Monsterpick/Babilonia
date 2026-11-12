# LAST HOUSE: Invasión — Roadmap

Juego propio de LiveArena, **fuera de Minecraft**: 3D en el navegador (Three.js) dentro de la app. El streamer juega
con el teclado en `/juego/lasthouse` y captura esa ventana; los espectadores juegan desde el directo (likes,
comentarios, follows, compartidos y regalos llegan por LiveArena, como en los overlays).

Regla de cada fase: no se pasa a la siguiente sin cumplir sus criterios de aceptación.

| Fase | Qué | Estado |
|---|---|---|
| 0 | Diseño: análisis de referencias, decisiones, plataforma | ✅ hecho |
| 1 | Prototipo jugable del modo **Invasión** (tú eres el Rey de la Horda) | ✅ hecho |
| 2 | Modo **Defensa** (tú eres el Guardián; los espectadores mandan la horda) | ✅ hecho |
| 3 | Equilibrio con datos, dificultad adaptativa, anti-spam | ✅ hecho (con bots; falta validar con directos reales) |
| 4 | Arte y animación: personajes, zombis por tipo, día→noche, tormenta, cinemática de entrada | ✅ hecho (modelos por código; ver notas) |
| 5 | Sonido y música propios | ✅ hecho (sintetizado) |
| 6 | Eventos grandes de regalos y votaciones del chat | ✅ hecho |
| 7 | Integración en la app: ajustes, overlays, vertical 9:16, perfil vacío | ✅ hecho |
| 8 | Progresión: récords, tablas históricas, logros, coronas cosméticas | ✅ hecho |
| 9 | Pruebas de carga, resistencia y pulido | ✅ hecho (falta probar en un PC con GPU real) |

---|---|---|
| 0 | Diseño: análisis de referencias, decisiones, plataforma | ✅ hecho |
| 1 | Prototipo jugable del modo **Invasión** (tú eres el Rey de la Horda) | ✅ hecho |
| 2 | Modo **Defensa** (tú eres el Guardián; los espectadores mandan la horda) | pendiente |
| 3 | Equilibrio con datos, dificultad adaptativa, anti-spam | pendiente |
| 4 | Arte y animación: personajes con más detalle, cinemáticas de entrada/asalto/victoria | pendiente |
| 5 | Sonido y música propios | pendiente |
| 6 | Eventos grandes de regalos (bombardeo, jefe, clima) y votaciones del chat | pendiente |
| 7 | Integración completa en la app: ajustes, regalos editables, overlay de marcador, modo vertical | pendiente |
| 8 | Progresión entre partidas: récords, mejores guardianes, logros, cosméticos | pendiente |
| 9 | Pruebas de carga (miles de eventos), rendimiento en equipos modestos, pulido final | pendiente |

---

## Fase 0 · Diseño ✅
- Analizados los 2 vídeos de referencia y el paquete de prompts (ver `VIDEO_ANALYSIS.md`).
- Decisiones cerradas (ver `DECISIONES.md`): plataforma web, cámara detrás del personaje con alternativa táctica,
  jardín por carriles con movimiento libre, control directo del Rey + esbirros, dos modos (Invasión y Defensa).
- Universo y criaturas propios: nada de nombres, diseños ni recursos de otros juegos.

## Fase 1 · Prototipo de Invasión ✅
Hecho:
- `apps/dashboard/src/game/lasthouse/sim.ts`: simulación determinista y probada (8 tests).
- `view.ts`: escenario, casa, Rey, 7 guardianes, esbirros, disparos, partículas, cámara de acción y táctica.
- `LastHouse.tsx`: controles, HUD, avisos de espectadores, carteles, pantalla de inicio y final, eventos del directo.
- Pestaña «LAST HOUSE» en Minijuegos y `?demo=1` (se juega solo con espectadores simulados).

Criterios cumplidos: una partida completa de principio a fin sin errores; los eventos del Simulador de la app plantan
defensas; funciona sin WebGL acelerado (probado con renderizado por software).

Pendiente dentro de lo ya hecho: probarlo jugando a mano con mando real de teclado (aquí solo se ha probado con el
piloto automático) y ajustar el equilibrio (fase 3).

## Fase 2 · Modo Defensa ✅
- `defense.ts`: el Guardián dispara solo al zombi más cercano de su franja, esquiva (Shift), onda expansiva (E) y planta
  defensas con energía (teclas 1–6 + Q). Seis zombis: caminante, corredor, blindado (armadura), excavador (va bajo
  tierra y sale cerca de la casa), coloso y titán (golpes de área). Oleadas automáticas cada 25 s aunque no haya público.
- Gana el Guardián si la casa sigue en pie al acabar el tiempo; gana la horda si la tira.
- Selector de modo en la pantalla de inicio (`?modo=defensa` para abrir directamente).

## Fase 3 · Equilibrio ✅
- **Presupuesto de presión** (`director.ts`): lo gratis gasta una reserva común que se rellena a ritmo fijo; los
  likes y comentarios sin palabra clave solo usan la mitad alta. Así 10 o 10.000 espectadores aprietan parecido.
- **Los regalos siempre hacen algo**; pueden dejar la reserva en negativo. Si se llega al fondo, los regalos pequeños
  hacen su efecto de uno en uno.
- **Sin público**, el jardín (o la horda) gasta la reserva solo: siempre hay partida.
- **Tensión**: compara la partida con un ritmo «justo» y sube o baja la presión.
- **Poder del streamer** (×1–2,4): sube si llegan muchísimos regalos o si va muy por detrás.
- Esperas por persona en el chat, cola de eventos grandes (5 s entre uno y otro, máximo 30).
- Resultado con bots (24 partidas por caso): el streamer gana el 46–75 % según público y modo
  (`LH_BALANCE=1 pnpm test` lo comprueba con margen 25–85 %). El objetivo de 35–65 % se cumple en la mayoría de
  casos; Invasión con 10 espectadores y Defensa sin público salen algo fáciles con el bot. Hay que ajustarlo con
  partidas reales (los bots no juegan como una persona).

## Fase 4 · Arte y animación ✅
- Zombis distintos por tipo (casco, escudo, pala y casco de minero, garrote, pinchos…), barras de vida, tinte al
  recibir golpe y al estar congelados, montículo de tierra del excavador.
- El Guardián (sombrero, cañón de semillas, capa de hojas) y el Rey con corona del color elegido.
- Día → atardecer → noche a lo largo de la partida; estrellas; farolas que se encienden; noche de tormenta con lluvia
  y rayos; vuelo de cámara de entrada; cámara del final sobre la casa.
- Iconos generados con ForgeGUI (diseños propios): icono del juego, Brote, Lanzabrotes y Tronco. El resto de iconos
  y los modelos 3D/música por ForgeGUI no se pudieron hacer: el plan actual no incluye 3D, música ni sonido, y los
  créditos de imagen se agotaron.

### v2 de los gráficos (estilo dibujo animado)
- `models.ts`: todos los personajes rehechos con formas redondeadas (esferas, cápsulas, cajas de cantos redondos,
  piezas torneadas), sombreado por escalones (toon), contorno oscuro y ojos grandes con brillo. Cada pieza móvil funde
  sus formas en una sola geometría con color por vértice: un personaje son ~6 piezas y todas las copias comparten
  geometría y material (300 zombis siguen siendo baratos).
- `scenery.ts`: césped a cuadros con briznas, setos redondeados, valla blanca, árboles de copa en racimo, arbustos con
  flores, farolas, buzón, caminito de piedras y la casa con tejas, chimenea, porche y jardineras. Todo lo estático va
  fundido en un par de mallas.
- Resplandor (bloom) para ojos, núcleos, ventanas de noche y explosiones; partículas redondas, chispas que se estiran,
  humo que crece y sube, fogonazos.
- `?galeria=1`: todos los modelos quietos delante de la cámara, para revisar el arte.

## Fase 5 · Sonido ✅
- `audio.ts`: todos los efectos sintetizados (brotar, disparo, golpe, explosión, rugido, rayo, oleada, asalto,
  victoria/derrota) con límite por tipo para que no sature. Música generativa en La menor que sube de tempo y de capas
  con la tensión. M silencia.

## Fase 6 · Eventos y votaciones ✅
- Invasión: tormenta de semillas, mareo, batería de lanzabrotes, bombardeo de calabazas, muro de enredadera, noche de
  tormenta. Defensa: estampida, túnel de excavadores, asedio de colosos, noche de tormenta, titán.
- Votación del chat cada 75 s (configurable): «1» o «2» o el nombre, un voto por persona; gana la más votada y se
  lanza como «lo ha votado el chat».

## Fase 7 · App ✅
- Pestaña LAST HOUSE: ajustes (modo, duración, asaltos, vida de la casa, likes por acción, votaciones, adaptativa,
  vertical, volumen, música), tabla de qué hace cada regalo por modo, enlaces.
- Overlays `lasthouse` (marcador + votación) y `lasthouse-regalos` (qué hace cada cosa).
- `?vertical=1` o ajuste: HUD para 9:16.
- Al empezar una partida se activa un perfil vacío (`lasthouse`) para que no salte nada de Minecraft; al cerrar la
  ventana vuelve el perfil anterior.

## Fase 8 · Progresión ✅
- `<datos>/lasthouse.json`: últimas 100 partidas, récords (invasión más rápida, más zombis, casa mejor conservada,
  más espectadores), tablas históricas de guardianes y de la horda, 10 logros, 7 coronas que se desbloquean ganando
  (solo cambian el color).

## Fase 9 · Pruebas y pulido ✅
- Pruebas automáticas: 20.000 eventos en ráfaga por modo (topes respetados, menos de 4 ms por paso de simulación).
- Resistencia: demo alternando modos 7,5 minutos sin errores y con memoria estable; las geometrías en la GPU suben y
  bajan con los personajes (sin fugas). Las piezas repetidas comparten geometría (de ~650 a ~90 con 70 personajes).
- Pendiente fuera de este entorno: medir FPS en un PC normal con tarjeta gráfica (aquí solo hay renderizado por
  software) y una sesión real de 2 horas.
