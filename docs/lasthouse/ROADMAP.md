# LAST HOUSE: Invasión — Roadmap

Juego propio de LiveArena, **fuera de Minecraft**: 3D en el navegador (Three.js) dentro de la app. El streamer juega
con el teclado en `/juego/lasthouse` y captura esa ventana; los espectadores juegan desde el directo (likes,
comentarios, follows, compartidos y regalos llegan por LiveArena, como en los overlays).

Regla de cada fase: no se pasa a la siguiente sin cumplir sus criterios de aceptación.

| Fase | Qué | Estado |
|---|---|---|
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

## Fase 2 · Modo Defensa
El streamer es un Guardián con disparo propio defendiendo la puerta; los espectadores mandan la horda.
- Likes → caminantes; comentarios → corredor/blindado con espera; follow → excavador; regalos → oleadas, coloso, titán.
- Vida de la casa, oleadas con descanso, el streamer planta sus propias defensas con un recurso (sol/energía).
- Selector de modo en la pantalla de inicio.
- Aceptación: partida de 5–8 min ganable y perdible; 300 enemigos en pantalla a 60 FPS en un equipo normal.

## Fase 3 · Equilibrio
- Registro de cada partida (duración, asaltos, defensas por tipo, caídas) para ajustar con datos.
- Dificultad que se adapta al número de espectadores activos (ya hay tope de defensas y likes agregados).
- Límites por persona y por minuto para regalos repetidos; cola visible.
- Aceptación: en 20 partidas simuladas con 10, 100 y 1.000 espectadores, el Rey gana entre el 35 % y el 65 %.

## Fase 4 · Arte y animación
- Personajes con más piezas y animaciones por estados (aparecer, andar, atacar, daño, caer, celebrar).
- Cinemáticas cortas: entrada al jardín, asalto conseguido (dentro de la casa), victoria y derrota.
- Sombras suaves, hierba y flores, cielo con hora del día por asalto (día → atardecer → noche).

## Fase 5 · Sonido
- Efectos y música sintetizados (como en el resto del proyecto): pasos, zarpazo, brotar, disparo, explosión,
  rugido, asalto, victoria/derrota; música que sube de intensidad con cada asalto.

## Fase 6 · Eventos y votaciones
- Regalos grandes con espectáculo propio: bombardeo de calabazas, enredadera gigante, noche de tormenta.
- Votación del chat entre dos eventos cada cierto tiempo (se cuenta por persona, no por mensaje).

## Fase 7 · App
- Ajustes del juego en la app (duración, asaltos, likes por brote, qué hace cada regalo).
- Overlay de marcador para el directo y disposición vertical 9:16 del HUD.
- Perfil de regalos propio y aviso de qué regalo hace qué para enseñar en pantalla.

## Fase 8 · Progresión
- Récords, tabla histórica de guardianes, logros; cosméticos del Rey que no dan ventaja.

## Fase 9 · Pruebas y pulido
- Ráfagas de miles de eventos, sesiones de 2 horas, memoria estable, equipos modestos, pantallas pequeñas.
- Lista de «cero errores» antes de darlo por terminado.
