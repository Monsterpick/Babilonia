# Generadores de modelos (GeckoLib)

Cada `gen_*.py` crea el modelo (`geckolib/models`), sus animaciones (`geckolib/animations`) y su textura
(`textures/entity`, y `_glowmask` si tiene partes que brillan) dentro de `src/main/resources/assets/livearena`.
Son diseños propios hechos por código (cubos, paneles y texturas procedurales).

```
python3 gen_escudo.py   # cúpula hexagonal del escudo
python3 gen_circulo.py  # círculos arcanos del juicio
python3 gen_meteorito.py
python3 gen_ojo.py
python3 gen_agujero.py
python3 gen_guerrero.py # guerrero de la esfera de energía
python3 gen_aura.py
python3 gen_esfera.py
python3 gen_santuario.py
```

## Usar modelos hechos en Blockbench (sin recompilar)

Los modelos se cargan como recursos normales, así que un **paquete de recursos** puede sustituirlos:

```
MiPaquete/
  pack.mcmeta
  assets/livearena/geckolib/models/<modelo>.geo.json
  assets/livearena/geckolib/animations/<modelo>.animation.json
  assets/livearena/textures/entity/<modelo>.png   (+ <modelo>_glowmask.png si brilla)
```

Los nombres de modelo y de animación deben ser los mismos (ver docs/cinematicas/ASSETS.md).
