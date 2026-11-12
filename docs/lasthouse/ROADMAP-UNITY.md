# LAST HOUSE en Unity — roadmap de la nueva construcción

Sustituye a las fases 8–9 de `AUDITORIA-2.0.md` (que proponían seguir con Three.js). Decisión del streamer: el
juego se rehace en **Unity (URP)** para tener libertad con modelos 3D, más potencia gráfica y mejores efectos, y se
abre **desde LiveArena**. La versión actual (Three.js) sigue funcionando hasta que la de Unity la iguale.

## Cómo encaja con la app

```
TikTok LIVE ──► LiveArena (app de escritorio)
                 ├─ conector de TikTok, perfiles, regalos → acciones, TTS, overlays
                 ├─ pestaña Minijuegos → LAST HOUSE: Instalar / Actualizar / Jugar
                 └─ ws://127.0.0.1:7420/ws  ◄──────────────┐
                                                           │ eventos del directo (regalos, likes, comentarios,
LastHouse.exe (Unity, Windows) ── WebSocket local ─────────┘ seguidores, votos) y estado de la partida de vuelta
```

- **El juego es un programa de Windows aparte** (lo instala y lo actualiza la app, como los plugins de Minecraft) y
  la app lo **abre con un botón**. Así tiene toda la potencia de la tarjeta gráfica.
- **Captura para el directo**: en TikTok LIVE Studio u OBS, «Captura de juego/ventana» de LastHouse. Admite modo
  vertical 9:16 (1080×1920) y horizontal.
- La app sigue siendo el cerebro: recibe el directo, decide qué regalo hace qué (perfil «LAST HOUSE») y se lo manda
  al juego. El juego devuelve el estado (asaltos, vida de la casa, ranking) para los overlays de la app.
- Alternativa descartada por ahora: compilar Unity para navegador (WebGL) y meterlo dentro de la ventana de la app.
  Se ve dentro de LiveArena, pero pierde gran parte de la potencia gráfica, que es justo lo que se busca.

## Fases

### U0 · Preparación (infraestructura)
- Proyecto Unity 6 URP 3D en `games/lasthouse-unity/` del repositorio, con git y su `.gitignore` (sin `Library/`).
- Paquetes: Cinemachine (cámaras), Input System, TextMeshPro / UI Toolkit (HUD), Visual Effect Graph (efectos),
  NativeWebSocket o equivalente (conexión con la app).
- Compilación automática en GitHub Actions (imagen de Unity de GameCI) → `LastHouse-Windows.zip` en cada release.
  **Necesita tu licencia de Unity como secretos del repositorio** (ver «Lo que necesito de ti»).
- Protocolo app ↔ juego documentado (`docs/lasthouse/PROTOCOLO.md`): mensajes `evento`, `accion`, `estado`,
  `voto`, con versión, y un modo demo que simula espectadores sin la app.

### U1 · Prueba visual (punto de validación)
Un trozo del juego al nivel final, para que digas «sí, ese es el camino» antes de hacer el resto:
- un carril del jardín con seto, valla, flores con viento y un trozo de la casa;
- el **Rey de la Horda** (jugable con WASD), un **zombi** y el **Lanzabrotes**, con esqueleto y animaciones: reposo,
  andar, atacar, cargar, recibir daño, celebrar y morir;
- iluminación URP con sombras suaves, oclusión ambiental, bloom y gradación de color; partículas de disparo,
  impacto y muerte; sonido;
- medición de FPS en tu PC y comparación lado a lado con la versión actual.

### U2 · Jugabilidad completa
- Pasar a C# la simulación actual (`sim.ts`, `defense.ts`, `director.ts`): modos Invasión y Defensa, 5 carriles,
  asaltos, esbirros, habilidades del Rey, los 7 guardianes, votos y el director que equilibra según la audiencia.
- Mismas reglas de juego limpio: lo básico (likes, comentarios, follow, compartir) cuenta; los regalos dan efectos
  más grandes, nunca la victoria; la dificultad no crece en línea con la audiencia.
- Pruebas automáticas de la simulación (modo de juego de Unity Test Framework).

### U3 · Conexión con LiveArena
- El juego se conecta solo a la app al abrirse; si la app se cierra, sigue en modo demo y reconecta.
- En la app, pestaña Minijuegos → LAST HOUSE: Instalar, Actualizar, **Jugar**, opciones (vertical/horizontal,
  calidad, volumen) y el perfil de regalos «LAST HOUSE».
- Nombres de los espectadores sobre las defensas y los esbirros, carteles de regalos grandes y ranking dentro
  del juego; los overlays de la app (marcador, votación, «qué hace cada regalo») leen el estado que manda el juego.

### U4 · Producción artística
- Todos los guardianes, la horda con variantes (complexiones y ropa), los jefes y el escenario completo, sin clones
  idénticos (variaciones, rotación, escala, objetos que cuentan la historia).
- Estilo propio «jardín encantado al atardecer» (paleta y formas de `AUDITORIA-2.0.md`). Nada de personajes,
  nombres, siluetas, texturas, sonidos ni interfaz de otros juegos.
- Modelos: tus diseños si los tienes en Unity o en archivos 3D. Si no, modelos generados y retocados (ForgeGUI:
  modelo, rig y animaciones) y piezas propias.
- Efectos con VFX Graph (disparos, explosiones, congelado, curación, aparición de jefes) y música y sonidos propios.

### U5 · Rendimiento y calidad
- LOD, oclusión, instancing de hierba y flores, atlas de texturas y presupuesto de partículas.
- Calidad Baja/Media/Alta con ajuste automático; objetivo 60 FPS en gama media **mientras emites**.
- Prueba larga (una hora de directo simulado) sin caídas ni fugas de memoria.

### U6 · Distribución y actualizaciones
- La release de GitHub incluye `LastHouse-Windows.zip`; la app lo instala y lo actualiza sola (igual que el resto),
  y lo anuncia en la ventana de novedades.
- Cuando la versión de Unity iguale a la actual, se retira la de Three.js (o queda como «modo ligero»).

### U7 · Cierre
- Pasada completa en tu PC con TikTok LIVE Studio, notas de versión y guía corta para el streamer.

## Lo que necesito de ti

1. **Licencia de Unity.** Unity exige una cuenta y una licencia (la **Personal es gratis**). Hay dos caminos y uno
   no quita el otro:
   - **Compilar en GitHub (recomendado):** activas Unity Personal en tu PC una vez y añades tres secretos al
     repositorio (Settings → Secrets → Actions): `UNITY_LICENSE` (el contenido del archivo `.ulf`), `UNITY_EMAIL`
     y `UNITY_PASSWORD`. Te guío paso a paso. Nunca van en el código ni en el chat.
   - **Trabajar aquí con el Editor:** instalo Unity en mi entorno y tú completas el inicio de sesión en la página
     de Unity que te abro. Así puedo hacer capturas y probar el juego mientras lo construyo.
2. **Tus diseños**, si ya tienes algo hecho en Unity (proyecto, modelos, escenas): pásamelos y parto de ellos.
3. Tu visto bueno en la **prueba visual (U1)** antes de producir todo lo demás.
