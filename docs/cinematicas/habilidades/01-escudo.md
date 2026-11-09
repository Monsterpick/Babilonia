# 01 — Escudo (id: `escudo`)

**Concepto:** una cúpula de hexágonos de energía se levanta desde el suelo alrededor del
objetivo y lo protege. Cada golpe que recibe hace "ondas" en la superficie.

## Roles
- Objetivo: jugador protegido (centro de la cúpula; la cúpula le sigue).
- Lanzador: ignorado.
- Jugador cinemático: objetivo (solo durante la formación).
- Duración total: 600 ticks (30 s) · Fase cinemática: 60 ticks (3 s).

## Línea de tiempo
| Tick | Servidor | Cliente |
|---|---|---|
| 0 | Crea el escudo (estado en el contexto) | `DOME_HEX` aparece con radio 0 desde el suelo |
| 0–40 | — | Los hexágonos se "encienden" en anillos de abajo arriba; zumbido creciente |
| 40 | Escudo ACTIVO | Pulso de luz + sonido de activación |
| 60 | Fin fase cinemática | Cámara vuelve |
| 60–580 | Protección (ver lógica); la cúpula sigue al objetivo | Cúpula estable con brillo suave pulsante |
| impacto | Absorbe daño y resta durabilidad | Onda en el punto de impacto (`DOME_HEX.impactos`) |
| 580–600 o rotura | Fin | Si se agota: anim de rotura (hexágonos caen como fragmentos y se desvanecen); si termina por tiempo: se apaga de arriba abajo |

## Cámara
Arranca detrás del objetivo a 6 bloques, sube y orbita 180° a 8 bloques de distancia
mirando al objetivo; FOV 70→80. Curva `EASE_IN_OUT`.

## Actores y assets
Ninguno; todo procedural. Sonidos: `escudo.activar`, `escudo.impacto`, `escudo.romper`.

## Render
`DOME_HEX`: radio 4, color cian (#5CE1FF) con borde blanco; hasta 8 impactos simultáneos.

## Lógica de servidor
- Proyectiles (cualquier `Projectile`) que entran en la esfera desde fuera: se reflejan
  (velocidad invertida respecto a la normal) y se cuenta como impacto.
- Mobs hostiles dentro del radio: empujados hacia fuera (`ForceService.push`).
- Daño entrante al objetivo de origen exterior (proyectil, explosión, mob fuera de la cúpula):
  cancelado; se resta de `durabilidad`. Daño de caída, hambre, ahogo: NO se bloquea.
- Si `durabilidad` llega a 0: el escudo se rompe.

## Config
| Clave | Defecto | Descripción |
|---|---|---|
| radio | 4.0 | Radio de la cúpula |
| duracionTicks | 600 | Duración total |
| durabilidad | 60.0 | Daño absorbible antes de romperse |
| reflejarProyectiles | true | Reflejar o solo destruir |
| empujarMobs | true | Empuje de hostiles |

## Criterios de aceptación
- [ ] La cúpula sigue al objetivo al caminar, sin temblores.
- [ ] Una flecha disparada desde fuera rebota; dentro de la cúpula, el objetivo puede disparar hacia fuera.
- [ ] Una explosión de TNT fuera no daña al objetivo y consume durabilidad.
- [ ] Al romperse se ve la animación de rotura y suena `escudo.romper`.
- [ ] Otros jugadores ven la cúpula.

## Fuera de alcance
No protege a otros jugadores dentro de la cúpula (solo al objetivo). No bloquea bloques.
