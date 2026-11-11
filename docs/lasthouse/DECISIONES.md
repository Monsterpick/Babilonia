# LAST HOUSE — decisiones de diseño

Responde a `03_DECISIONES_DE_DISENO_PENDIENTES.md` del paquete de prompts. Estado: **propuesta** hasta que el
streamer las confirme jugando; lo ya construido las sigue.

| Decisión | Elegido | Por qué | Descartado |
|---|---|---|---|
| Plataforma | Web 3D (Three.js) dentro de LiveArena | Control total de cámara, personajes e interfaz; los eventos del directo ya llegan a la app; sin instalar mods ni servidor de Minecraft | Minecraft + NeoForge + GeckoLib: cámara y HUD limitados, más piezas que mantener |
| Cámara | Detrás del personaje (acción), con tecla para vista táctica desde arriba | Es la de los dos vídeos de referencia y la que da espectáculo; la táctica recupera la lectura «de tablero» | Isométrica fija: menos emoción al esquivar |
| Terreno | Jardín de 5 carriles con movimiento libre | Los carriles ordenan dónde caen las defensas y se leen bien; moverse libre deja esquivar | Campo abierto (caótico), carriles rígidos (poco que hacer con el teclado) |
| Control del invasor | Híbrido: control directo del Rey + esbirros invocados | Se aprende en segundos (WASD) y los esbirros dan la parte de «comandante» | Solo comandante: poco que mirar en un directo |
| Modos | Invasión primero; Defensa en la fase 2 | Invasión es el modo estrella del encargo («yo soy el Rey de la Horda») | Los dos a la vez: más riesgo |
| Duración | 5 min y 5 asaltos (ajustable) | Partidas cortas encajan con el ritmo de TikTok; se ajustará con datos | 8–12 min: largo para un directo vertical |
| Participación | Todo lo básico es gratis (likes, comentarios, follow, compartir); los regalos dan efectos más grandes, nunca la victoria | Regla 6 del prompt y sentido común: el juego tiene que ser divertido con cero monedas | — |
| Equilibrio con muchos espectadores | Likes agregados entre todos, espera por persona en el chat, tope de defensas vivas | La dificultad no puede crecer en línea con la audiencia | — |
| Persistencia | Fase 8 (récords, mejores guardianes, cosméticos sin ventaja) | No bloquea el juego base | — |

## Universo propio
- **Rey de la Horda**: zombi grandullón con corona torcida y capa hecha jirones.
- **Guardianes** (plantas-criatura propias): Brote, Lanzabrotes, Tronco Guardián, Flor Glacial, Hongo Volátil,
  Raíz Sanadora y Guardián Ancestral.
- Nada de nombres, siluetas, texturas, sonidos ni interfaz de otros juegos. El género (defensa por carriles) es común;
  el contenido es nuestro.
