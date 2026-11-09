# Contrato de assets

Estos nombres son un contrato entre el código y los modelos de Blockbench. No se cambian.
Blockbench: última versión + plugin "GeckoLib Models & Animations" (GeckoLib 5).

Rutas:
- Modelos: `assets/cinematicas/geckolib/models/<nombre>.geo.json`
- Animaciones: `assets/cinematicas/geckolib/animations/<nombre>.animation.json`
- Texturas: `assets/cinematicas/textures/entity/<nombre>.png`
- Sonidos: `assets/cinematicas/sounds/<grupo>/<nombre>.ogg` + `assets/cinematicas/sounds.json`
(Claude Code debe confirmar las rutas exactas que espera GeckoLib 5 en el código fuente y corregir esta tabla si difieren.)

## Modelos GeckoLib
| Modelo | Habilidad | Animaciones | Huesos obligatorios | Escala aprox. |
|---|---|---|---|---|
| `espada_espectral` | corona_espadas | `aparecer`, `girar`, `desvanecer` | `punta` | 1.5 bloques |
| `ojo_vacio` | ojo_vacio | `abrir`, `idle`, `latido`, `cerrar` | `parpado_superior`, `parpado_inferior`, `iris`, `pupila` | 16 bloques |
| `invocador` | esfera_energia | `aparicion`, `alzar_brazos`, `lanzar` | `manos` | 2 bloques |
| `meteorito` | meteorito | `rotar` | `nucleo` | 8 bloques |

Modelos de los eventos anteriores (si se migran): `reaper`, `akaza`, `gojo`, `orbital_cannon`
(ver guía v2).

`creeper_actor` reutiliza el modelo vanilla del creeper (no necesita archivo).

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
| juicio | `carga`, `rayo`, `final` |
| esfera | `carga`, `lanzar`, `detonar` |
| meteorito | `entrada`, `estampido`, `impacto` |
| cortes | `tajo` (3 variaciones), `final` |

Mientras falte un `.ogg`, el `SoundEvent` apunta a un sonido vanilla parecido (anotado en `PROGRESO.md`).

## Placeholders
Si un `.geo.json` no existe, Claude Code crea uno con cubos simples, los huesos exactos y
animaciones mínimas con los nombres exactos. Lo marca en `PROGRESO.md` como "placeholder".
