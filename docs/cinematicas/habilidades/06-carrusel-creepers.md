# 06 — Carrusel de creepers (id: `carrusel_creepers`)

**Concepto:** ocho creepers surgen del suelo y empiezan a girar alrededor del objetivo como
un tiovivo, cada vez más rápido y más alto, parpadeando, hasta que se lanzan contra él uno tras otro.

## Roles
- Objetivo: centro del carrusel.
- Lanzador: ignorado.
- Jugador cinemático: objetivo.
- Duración total: 200 ticks.

## Línea de tiempo
| Tick | Servidor | Cliente |
|---|---|---|
| 0–20 | 8 actores `creeper_actor` emergen del suelo en círculo radio 6 | Partículas de tierra; sonido de excavación |
| 20–100 | Giran alrededor del objetivo: velocidad angular 0.5→3 rad/s, altura 0→3 bloques con leve ondulación (sube/baja como caballitos) | Melodía de caja de música acelerándose (sonido propio o provisional); `TRAIL` verde tenue |
| 100–130 | Siguen girando; empiezan a hincharse y parpadear en blanco (como el creeper vanilla a punto de explotar) | Siseo de creeper en estéreo |
| 130–170 | Cada 5 ticks un creeper rompe la órbita y se lanza al objetivo; al llegar explota | Explosión pequeña por creeper; sacudida |
| 170–200 | — | Humo; cámara vuelve |

## Cámara
0–20: plano medio frente al objetivo.
20–130: vista aérea a 14 bloques que gira EN SENTIDO CONTRARIO al carrusel (sensación de vértigo).
130–170: `CUT` a primer plano bajo del objetivo con los creepers llegando.

## Actores y assets
`creeper_actor`: actor propio que REUTILIZA el modelo y la textura vanilla del creeper
(no es un `Creeper` real: sin IA, sin drops, sin explosión vanilla). Debe poder mostrar el
efecto de hinchado y parpadeo blanco del creeper vanilla (estado sincronizado del servidor).
No requiere GeckoLib.

## Lógica de servidor
- Posiciones de órbita calculadas en el servidor cada tick (no física).
- Explosión por creeper: `sphere` radio 2 (restaurable), daño `danioPorCreeper` con caída,
  empuje 0.8. Nunca usa `Level.explode` con destrucción vanilla.
- Si el objetivo muere antes, los creepers restantes explotan donde estén.

## Config
| Clave | Defecto |
|---|---|
| numeroCreepers | 8 |
| radioOrbita | 6.0 |
| velocidadMax | 3.0 |
| danioPorCreeper | 5.0 |
| romperBloques | true |

## Criterios de aceptación
- [ ] El giro es fluido para todos los jugadores (interpolación en cliente, sin saltos).
- [ ] El hinchado/parpadeo se ve igual que en un creeper vanilla.
- [ ] No queda ningún creeper (actor o real) tras terminar o cancelar.
- [ ] Ningún creeper actor puede ser golpeado, empujado o matado por jugadores.
