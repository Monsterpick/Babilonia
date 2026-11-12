# Roadmap v14 — Base Defense, cinemáticas y LAST HOUSE 2.0

Orden pensado para entregar primero lo que más molesta en directo y dejar lo más grande (LAST HOUSE) con
puntos de validación. Cada fase termina con pruebas en el cliente real (capturas o secuencias de fotogramas),
un commit, una compilación y una versión nueva que la app instala sola.

Reglas de siempre: nada copiado (código, modelos, texturas, sonidos, nombres); TacZ y los vídeos solo como
referencia de calidad; ningún secreto en el código; nada de apuestas ni dinero real.

---

## Fase 0 — Banco de pruebas de animación (base de todo lo demás)

El fallo del cañón orbital («a veces bien, a veces mal») indica que hace falta probar cada animación muchas
veces y no una sola.

- Script que lanza una habilidad o un ataque de jefe N veces en el cliente de pruebas y guarda una tira de
  fotogramas por ejecución (p. ej. 1 cada 2 ticks).
- Comparación entre ejecuciones: si una sale distinta, se marca.
- Registro de ticks del servidor y del cliente durante la animación (latencia, paquetes, chunks cargados).

**Hecho cuando:** se puede lanzar `orbital ×20` y obtener 20 tiras comparables.

## Fase 1 — Cinemáticas (4 arreglos)

| # | Problema | Plan |
|---|----------|------|
| 1.1 | **Choso**: la flecha de sangre sale después del empujón | Reordenar la línea de tiempo: frase → disparo de la flecha → impacto → empujón **causado por** el impacto (no antes). Comprobar que el texto, el sonido y el modelo usan el mismo tick de inicio. |
| 1.2 | **Cañón orbital** inconsistente | Buscar la causa con la Fase 0 (sospechas: modelos que aparecen antes de que el cliente cargue el chunk o la entidad, interpolación de teletransporte, cámara que se adelanta). Hacer que cada paso espere a que el anterior esté visible en el cliente en vez de ir por tiempo fijo. 20/20 ejecuciones correctas. |
| 1.3 | **Escudo** demasiado grande | Cúpula ceñida al cuerpo (≈1,3 × 2,2 bloques, forma de cápsula), que sigue al jugador sin retraso; impactos y rotura adaptados al nuevo tamaño. |
| 1.4 | **Juicio arcano** → **magia de fuego** | Habilidad nueva de fuego (nombre propio): carga con runas ígneas y columna de calor → lluvia de meteoros/llamaradas → núcleo que se comprime → **gran explosión final** con onda de choque, destello, humo, brasas, temblor de cámara y cráter temporal. Modelos y texturas nuevos en el mod, con alternativa de partículas sin mod. |

**Hecho cuando:** cada habilidad se ve igual en 20 ejecuciones seguidas, y con capturas de cada fase.

## Fase 2 — Base Defense: dificultad

- Medir el tiempo para matar (TTK) real de cada mob con pistola y subfusil, y el daño por segundo que llega a
  la base, con un simulador numérico más una partida de prueba.
- Objetivo: con las 2 armas iniciales se aguanta la fase 1 sin regalos. Los regalos ayudan, pero no son
  obligatorios para sobrevivir.
- Ajustes: más daño de las armas iniciales, menos vida en las primeras fases, menos daño a la base, munición
  más generosa y una curva de fases más suave. Elites y jefes siguen exigiendo trabajo.
- Migración de configuración (v6) para quien ya tenga la anterior.

**Hecho cuando:** una partida de prueba sin regalos llega a la fase 3 con más del 50 % de la base.

## Fase 3 — Base Defense: cámara, arena y posición del jugador

- **Fuera la plataforma elevada.** Propuesta: el jugador defiende **a ras de suelo** detrás de una barricada
  baja (sacos y vallas) frente a la base. Los zombis llegan cara a cara y la barricada recibe golpes y se
  agrieta. Como alternativa, una trinchera.
- **Acercamiento de cámara**: zoom suave al apuntar (clic derecho) en el mod, y cámara más cerca de la acción.
  Habrá que confirmar si te referías a otra cosa, por ejemplo a la cámara del directo.
- **Recorte para vertical**: arena más estrecha y profunda, pensada para 9:16. Lo importante (carril, base,
  jefes y HUD) queda dentro del encuadre central, y una guía muestra el recorte.

**Hecho cuando:** hay capturas en 16:9 y en el recorte 9:16 con todo legible.

## Fase 4 — Base Defense: armas al nivel de la referencia

Calidad tipo TacZ, pero con todo creado desde cero.

- **Modelos 3D nuevos y detallados** de las 6 armas: piezas separadas (corredera, cargador, gatillo, cerrojo,
  cañón giratorio de la minigun) y texturas con desgaste, metal, polímero y madera.
- **Animaciones en primera persona por fotogramas clave** en el mod, en vez de rotaciones globales:
  - desenfundar;
  - inspeccionar;
  - disparo con retroceso y corredera;
  - **recarga por fases**: soltar cargador → cargador nuevo → montar, con una versión táctica y otra en vacío;
  - apuntar;
  - correr;
  - balanceo y respiración.
- **Efectos**: fogonazo animado, trazadoras, casquillos que saltan, humo del cañón, impactos distintos según
  el material (sangre, chispas, polvo) y sonidos por capas (disparo, cola, mecánica).

**Hecho cuando:** hay tiras de fotogramas de cada animación de cada arma, revisadas contra la referencia.

## Fase 5 — Base Defense: jefes rehechos

- **Dragón**:
  - Sin la IA de vuelo de vanilla, que es la que se bugea. Vuelo propio por curvas suaves, con giros
    inclinados y aterrizajes.
  - Ataques con anticipación clara: picado, aliento de fuego en barrido y bolas de fuego.
  - Furia, caída y muerte.
- **Wither**:
  - Movimiento y cabezas con interpolación.
  - Ataques con preparación visible: andanada de calaveras, rayo cargado y embestida.
  - Escudo de furia y muerte encadenada.
- Si las entidades de vanilla no permiten algo, se usan modelos propios del mod con alternativa sin mod.

**Hecho cuando:** 10 apariciones de cada jefe sin bugs, con tiras de fotogramas de cada ataque.

## Fase 6 — Base Defense: mobs infectados

- Texturas nuevas «infectadas» o agresivas para esqueletos, arañas, piglins, vindicadores, devastadores y
  esqueletos wither: venas, pústulas, ojos brillantes, carne expuesta, y variantes por fase.
- Mejoras de animación de los zombis: tambaleo, embestida, golpe con anticipación y muertes variadas.

## Fase 7 — LAST HOUSE 2.0: auditoría y propuesta (sin tocar el juego)

- Auditoría con capturas: modelos simples, geometría repetida, personajes sin personalidad, vegetación
  clonada, texturas planas, iluminación, sombras, animaciones rígidas y composición.
- **Comparativa de motor**: seguir con Three.js frente a Unity URP, Godot, Babylon.js o PlayCanvas. Se valoran
  el rendimiento en gama media, el navegador frente a ejecutable, OBS, el coste, el tiempo y la integración con
  LiveArena.
- Arquitectura separada en tres partes (simulación ↔ comunicación ↔ representación), para poder cambiar de
  motor sin tocar mecánicas.
- Propuesta de estilo propio: paleta, formas, materiales e iluminación.
- **Entregable: documento con la propuesta. No se migra nada sin tu visto bueno.**

## Fase 8 — LAST HOUSE 2.0: prueba visual

- Un invasor, una planta (el Lanzabrotes) y un fragmento del escenario al nivel final:
  - modelos con esqueleto y animaciones (reposo, andar, ataque, carga, impacto, daño, celebración y derrota);
  - movimiento secundario de hojas y ropa;
  - materiales PBR estilizados, sombras suaves, oclusión ambiental y partículas.
- Medición de FPS en gama media y comparación antes/después.
- **Punto de validación: me dices si ese es el camino antes de aplicarlo a todo.**

## Fase 9 — LAST HOUSE 2.0: producción completa

- Todas las plantas, los invasores (con variantes), los jefes y el escenario completo sin clones idénticos.
- Cámara con acercar y alejar sin romper controles ni la participación del chat.
- Optimización:
  - LOD, culling, instancing y atlas de texturas;
  - presupuesto de partículas;
  - ajuste de calidad (bajo, medio y alto) automático.
- Las mecánicas, el director, los votos y los regalos se conservan; las pruebas automáticas siguen en verde.

## Fase 10 — Cierre

- Pasada completa en el cliente y en el navegador, notas de versión, actualización automática y comprobación
  de que el instalador anterior se actualiza solo.
