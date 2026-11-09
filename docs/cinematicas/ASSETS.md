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
| `esfera` | genkidama, vacio_purpura | `idle` | translúcido + emisivo, tinte; el tamaño lo da el servidor | radio en bloques |
| `meteorito` | meteorito | `rotar`, `idle` | glowmask (grietas de lava) | 6.5 |
| `copo` | akaza | `trazar`, `idle`, `desvanecer` | translúcido + emisivo | radioCopo / 2 |

## Personajes (contrato de las fichas del kit de personajes)
| Modelo | Habilidad | Huesos obligatorios | Animaciones | Altura en juego |
|---|---|---|---|---|
| `goku` | genkidama | `cabeza`, `brazo_izquierdo`, `brazo_derecho`, `manos` | `aparicion`, `alzar_brazos`, `lanzar`, `pose_final` | 2 bloques |
| `sukuna` | mil_cortes | `cabeza`, `manos`, `brazo_derecho` | `aparicion`, `sello_mano`, `idle_dominio`, `corte_final`, `desaparicion` | 2 bloques |
| `santuario` | mil_cortes | `base`, `fauces` | `emerger`, `idle`, `hundirse` | 14 bloques |
| `gojo` | vacio_purpura | `cabeza`, `mano_izquierda`, `mano_derecha`, `mano_proyectil` | `aparicion`, `carga`, `disparo`, `pose_final` | 2 bloques |
| `akaza` | akaza | `cabeza`, `cuerpo`, `puno_derecho` | `aparicion`, `despliegue_tecnica`, `golpe_suelo`, `pose_final` | 2 bloques |

**Skins**: goku, gojo, sukuna y akaza usan las skins de Minecraft (64×64) de `mod/tools/referencias/skins/`
(`gen_skins.py`: geometría de jugador con capa exterior y los huesos del contrato). Para cambiar un personaje basta con
sustituir su PNG y volver a ejecutar el script.

**Santuario**: es la construcción `referencias/santuario_obj/sukuna-temple.zip` (exportada con Mineways) convertida en
malla por `gen_mesh.py` (`assets/livearena/mesh/santuario.bin.gz`); el mod la dibuja tal cual con sus texturas de
bloques y la anima en código (emerger / hundirse). Ajustes: `alturaSantuario`, `enterrarSantuario`, `distanciaSantuario`.

Antes, los modelos se completaban con `mod/tools/gen_personajes.py` y `gen_santuario.py` (diseños propios con el
esqueleto del contrato). Para usar los tuyos de Blockbench:

```
python3 mod/tools/validar_modelo.py goku modelos_entrada/goku            # comprueba huesos, animaciones y textura
python3 mod/tools/validar_modelo.py goku modelos_entrada/goku --instalar # y los copia al mod
```

Las animaciones pueden llamarse `aparicion` o `animation.goku.aparicion` (como exporta Blockbench): el mod las
traduce solo. Las esferas se anclan en el cliente a los huesos `manos`, `mano_izquierda`, `mano_derecha` y
`mano_proyectil`, así que siguen a las manos aunque cambies la animación. El código usa los nombres desde
constantes (`CineCharacters`), nunca escritos a mano en varios sitios.

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
| genkidama | `aparicion`, `carga`, `lanzar`, `detonar` |
| sukuna | `dominio` |
| gojo | `aparicion`, `carga`, `disparo`, `detonacion` |
| akaza | `aparicion`, `despliegue`, `golpe` |
| meteorito | `entrada`, `estampido`, `impacto` |
| cortes | `dominio`, `ambiente`, `tajo`, `final` |

Mientras falte un `.ogg`, el `SoundEvent` apunta a un sonido vanilla parecido (anotado en `PROGRESO.md`).

## Placeholders
Si un `.geo.json` no existe, Claude Code crea uno con cubos simples, los huesos exactos y
animaciones mínimas con los nombres exactos. Lo marca en `PROGRESO.md` como "placeholder".
