# Contrato de assets

Estos nombres son un contrato entre el código y los modelos de Blockbench. No se cambian.
Blockbench: última versión + plugin "GeckoLib Models & Animations" (GeckoLib 5).

Rutas (confirmadas en el mod, espacio de nombres `livearena`):
- Modelos: `assets/livearena/geckolib/models/<nombre>.geo.json`
- Animaciones: `assets/livearena/geckolib/animations/<nombre>.animation.json`
- Texturas: `assets/livearena/textures/entity/<nombre>.png` (+ `<nombre>_glowmask.png` en los que brillan)
- Sonidos: ids de `habilidades.yml → sonidos` (vanilla por defecto; admite varios separados por comas o `livearena:...` de un resource pack)

Todos se pueden sustituir con un **paquete de recursos** con las mismas rutas (no hace falta recompilar el mod).
Los actuales los generan los scripts de `mod/tools/` (diseños propios).

## Modelos GeckoLib
| Modelo | Habilidad | Animaciones | Render | Escala usada |
|---|---|---|---|---|
| `escudo` | escudo | `aparicion`, `idle`, `impacto`, `romper`, `desaparecer` | translúcido + emisivo, tinte por vida | radio/3 |
| `circulo_arcano` | juicio_arcano | `aparicion`, `idle`, `disparo`, `desaparecer` | translúcido + emisivo | 8 (principal), 2.2 (menores) |
| `ojo_vacio` | ojo_vacio | `cerrado`, `abrir`, `idle`, `latido`, `cerrar` (huesos `parpado_a`, `parpado_b`, `iris`, `pupila`) | glowmask | 16 |
| `agujero_negro` | agujero_negro | `aparicion`, `idle`, `colapso` | translúcido + emisivo | 3.6 |
| `guerrero` | esfera_energia (sin lanzador) | `aparicion`, `idle`, `cargar`, `alzar_brazos`, `lanzar` (hueso `manos`) | glowmask (ojos) | 2.2 |
| `aura` | esfera_energia | `aparicion`, `idle`, `desaparecer` | translúcido + emisivo, tinte | 2.4 |
| `esfera` | esfera_energia | `idle` | translúcido + emisivo; el tamaño lo da el servidor | radio en bloques |
| `meteorito` | meteorito | `rotar`, `idle` | glowmask (grietas de lava) | 6.5 |
| `santuario` | mil_cortes | `aparicion`, `idle`, `desaparecer` | glowmask (faroles, grietas) | 3.2 |

La corona de espadas usa las espadas de Minecraft (madera, piedra, hierro, oro, diamante, netherita) y el
carrusel usa creepers cargados reales: no necesitan archivo.
El servidor puede teñir cualquier modelo con la animación especial `color:AARRGGBB`.

## Sonidos
| Grupo | Sonidos |
|---|---|
| escudo | `activar`, `impacto`, `romper` |
| onda | `carga`, `liberar` |
| corona | `aparecer`, `disparo`, `impacto` |
| rayo | `trueno_lejano`, `impacto` |
| trueno | `menor`, `mayor`, `explosion_grande` |
| carrusel | `musica`, `siseo`, `explosion` |
| ojo | `abrir`, `latido`, `zumbido` |
| agujero | `formacion`, `zumbido`, `colapso` |
| juicio | `inicio`, `carga`, `rayo`, `final` |
| esfera | `inicio`, `carga`, `lanzar`, `detonar` |
| meteorito | `entrada`, `estampido`, `impacto` |
| cortes | `dominio`, `ambiente`, `tajo`, `final` |

Mientras falte un `.ogg`, el `SoundEvent` apunta a un sonido vanilla parecido (anotado en `PROGRESO.md`).

## Placeholders
Si un `.geo.json` no existe, Claude Code crea uno con cubos simples, los huesos exactos y
animaciones mínimas con los nombres exactos. Lo marca en `PROGRESO.md` como "placeholder".
