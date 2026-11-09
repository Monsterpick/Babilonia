# Hoja de ruta

El orden no es arbitrario: cada fase construye piezas que reutilizan las siguientes.
No avances de fase hasta que la anterior compile y se haya probado en el juego.

| Fase | Contenido | Por qué en este orden |
|---|---|---|
| F0 | Preparación del entorno y repo | Sin esto Claude Code no puede compilar |
| F1 | Motor común: comando, línea de tiempo, cámara, red, config, seguridad | Base de las 12 habilidades |
| F2 | Primitivas de render + servicios de servidor + comando de previsualización | Cada efecto visual se escribe una sola vez |
| F3 | Onda de repulsión · Escudo · Super rayo | Las más simples: validan motor y primitivas |
| F4 | Trueno + explosión · Corona de espadas · Carrusel de creepers | Reutilizan rayo/onda y añaden proyectiles y actores en grupo |
| F5 | Juicio arcano · Esfera de energía · Meteorito | Efectos masivos y destrucción grande |
| F6 | Agujero negro · Ojo del vacío · Mil cortes | Las más complejas (bloques voladores, cortes de cámara, golpes rápidos) |
| F7 | Revisión global, rendimiento y pruebas multijugador | Pulido final |

## F0 — Preparación (la haces tú, ~30 min)
1. Instala **JDK 25** y comprueba `java -version`.
2. Descarga el MDK de NeoForge para 26.1.2 (plantilla ModDevGradle) y descomprímelo en la carpeta del proyecto.
3. Copia en la raíz del proyecto el contenido de este kit: `CLAUDE.md`, `docs/`, `.claude/`.
4. Sustituye en `CLAUDE.md` los marcadores `[NEOFORGE_VERSION]`, `[GECKOLIB_VERSION]` y `[tunombre]`.
5. `git init` y primer commit.
6. Abre Claude Code en la carpeta y ejecuta el **Prompt de arranque** de `docs/PROMPTS.md`.

## F1 — Motor común
Comando en Claude Code: `/fase-motor F1`
Entregable: comando `/habilidad`, `CinematicManager`, `AbilityTimeline`, controlador de cámara,
payloads, config, cancelación segura y una habilidad de prueba `test` (cámara orbitando 5 s).
Prueba en juego: `/habilidad test @s` → la cámara orbita y vuelve; repetir desconectando a mitad.

## F2 — Primitivas y servicios
Comando: `/fase-motor F2`
Entregable: todo lo de `docs/MOTOR.md` secciones B y C, más `/habilidad debug <primitiva>`
para ver cada efecto aislado delante del jugador.
Prueba en juego: ver cada primitiva con `/habilidad debug ...`.

## F3 a F6 — Habilidades
Por cada habilidad, en una sesión limpia de Claude Code (`/clear`):
`/implementar-habilidad 02-onda-repulsion` (por ejemplo)
Orden recomendado:
1. 02-onda-repulsion
2. 01-escudo
3. 04-super-rayo
4. 05-trueno-explosion
5. 03-corona-espadas
6. 06-carrusel-creepers
7. 09-juicio-arcano
8. 10-esfera-energia
9. 11-meteorito
10. 08-agujero-negro
11. 07-ojo-vacio
12. 12-mil-cortes

Después de cada una: pruébala en el juego y, si algo no va, usa `/corregir` con lo que viste.

## F7 — Revisión final
Comando: `/revision-final`
