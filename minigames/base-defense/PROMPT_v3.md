# BASE DEFENSE (Defensa Zombie LIVE) — Prompt maestro v3

Versión revisada del «Prompt maestro v2» adaptada a lo que ya existe en LiveArena. Sirve para seguir
ampliando el minijuego sin rehacer decisiones. Cada apartado lleva su estado: ✅ hecho y probado en el cliente,
🟡 hecho con límites, ⏳ pendiente.

## 1. Objetivo

Minijuego de TikTok LIVE en Minecraft Java: el streamer defiende su base en primera persona con armas de fuego.
Los espectadores juegan en dos bandos con regalos, likes y chat:

- **Enemigo**: mandan mobs, hordas y jefes.
- **Aliado**: curan la base, mandan suministros y lanzan ataques.

La prioridad es que se juegue bien, que vaya a 20 TPS y que se vea limpio en un directo vertical.

## 2. Arquitectura (cambia respecto a la v2 y por qué)

| v2 pedía | v3 usa | Motivo |
|---|---|---|
| Minecraft 1.21.1 + Paper 1.21.1 | **Paper 26.1.2 + Java 25** | Es la versión del servidor y del mod del streamer. Las fuentes del HUD, `item_model`, los Display y el formato de bioma 26.1 hacen falta. |
| Puente Node.js propio + WebSocket | **App LiveArena** (Node) → **RCON** con comandos tipados `/tt*` | La app ya normaliza los eventos de TikTok, quita duplicados, aplica colas, cooldowns y límites y reconecta. El plugin solo acepta su lista de comandos (`/tt*` y `/bd`): nunca ejecuta texto del chat. |
| Mod de cliente para la interfaz | **Pack de recursos servido por el plugin** | El HUD se dibuja con fuentes bitmap y espacios negativos. Así funciona en cualquier cliente vanilla con el pack. |
| Modelos de jefe con GeckoLib | Jefes vanilla (Wither, Dragón del End, Warden) con ataques propios | Lo pidió el streamer. Los modelos animados quedan como ampliación opcional (ver 9). |

Flujo: `TikTok LIVE → LiveArena (perfil «Base Defense»: regalo → acción) → RCON → /tt* → motor del juego (Paper)`.

## 3. Arena ✅

- Generada por código a partir de una semilla (sin WorldEdit): bosque de ceniza, ruinas, carril con waypoints, portal
  de los mobs, plataforma y base.
- Configurable: largo, ancho, densidad del decorado, luz, bioma, hora y clima.
- Mundo propio, separado del survival: las cinemáticas y los efectos de LiveArena no actúan allí, y los `/tt*` no
  actúan fuera de la partida.

## 4. Bandos

- ✅ **Enemigo**: `ttspawn <mob|horda> <n> <usuario>` y `ttboss <wither|dragon|warden> <usuario>`.
- ✅ **Aliado**: `ttheal`, `ttsuministro` y `ttaliado <misil|bombardeo|rayo>`. Dañan solo a los mobs del juego; a los
  jefes les quitan la mitad.
- ✅ Nombre del donante sobre sus mobs y en la placa del jefe.
- ⏳ Marcador por bando y top de donantes: la app ya tiene overlays de tops y se puede enlazar.

## 5. Hordas ✅

- 5 fases por ronda que van desbloqueando mobs (zombi, esqueleto, araña, piglin, esqueleto wither, vindicador,
  devastador…). Cada fase sube la vida y la velocidad.
- Oleadas automáticas además de las de los regalos.
- Tope de mobs con cola, IA propia por el carril y limpieza al terminar.
- Medido: 300 mobs + jefe a 20 TPS.

## 6. Jefes 🟡

- ✅ Llegan con un portal en espiral, un rayo y el cartel «¡LLEGA EL JEFE!» con el donante.
- ✅ Placa arriba con icono, nombre, donante, vida y FURIA; barra morada sobre el jefe en el mundo.
- ✅ Ataques propios:
  - Wither: calaveras a la base, que se pueden destruir a tiros.
  - Dragón: bolas de fuego que se pueden devolver.
  - Warden: cañón sónico y embestidas.
- ✅ Fase de furia por debajo del 35 % de vida.
- ⏳ Modelos 3D propios con animaciones (spawn, ataque, daño, muerte). Opción recomendada: modelos con
  ItemDisplay y `item_model` del pack, animados por el servidor (sin mod).

## 7. Interfaz ✅

Pantalla limpia, todo en el centro para el recorte vertical:

- **Abajo**:
  - Panel con vida de la base, bajas, tiempo, fase y victorias.
  - Hotbar propia con la munición de cada arma.
  - Lectura grande del arma en mano: balas y reserva, recarga, giro de la minigun, sin balas y daño x2.
  - Hasta 2 avisos cortos.
- **Arriba**: meta de bajas, meta de likes, placas de jefe y carteles grandes (fases, jefes, base caída, ronda
  superada, metas).
- **Centro**: marcador de impacto (blanco, rojo a la cabeza, dorado si mata).
- **Oculto**: corazones, comida, armadura y experiencia.
- Sin pack: versión de texto de respaldo.

## 8. Armas y recompensas ✅

- Pistola, subfusil, ametralladora, lanzagranadas, lanzacohetes y minigun, con modelos 3D y sonidos propios.
- Munición: cargador más reserva.
  - Cajas que sueltan los mobs.
  - Suministros en paracaídas cada fase y con regalo.
  - **Cofre dorado** cada N bajas: munición, +10 % de base y daño doble.

## 9. Pendiente sugerido (por orden de impacto)

1. Modelos animados de jefes con ItemDisplay (sin mod).
2. Marcador de bandos y MVP del directo en el HUD (la app ya cuenta regalos por usuario).
3. Torreta aliada temporal (regalo grande) que dispara sola durante 20 s.
4. Mejoras entre rondas (más cargador, recarga más rápida) elegidas con la meta de likes.

## 10. Reglas de trabajo

- No copiar código, marcas ni assets: texturas, letra, iconos y sonidos se generan con `tools/gen_pack.py` y
  `tools/gen_hud.py`.
- Ningún secreto en el código.
- Nada de apuestas ni premios en dinero real.
- Nada se da por terminado sin probarlo en el cliente: capturas con el servidor de pruebas.
- Las modificaciones del mundo siempre en el hilo principal, y con presupuesto de partículas y sonidos por tick.
