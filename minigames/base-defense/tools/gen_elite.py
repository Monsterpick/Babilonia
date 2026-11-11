"""Armadura de los enemigos élite de Base Defense (textura propia, generada aquí).

Los élites llevan un equipo con `equippable.asset_id = basedefense:elite`: el cliente dibuja sobre el mob esta
textura en vez de la de netherita. Placas de obsidiana agrietadas con vetas de magma que brillan, cuernos y visor
incandescente: se distinguen de lejos de los enemigos normales.

Uso: lo llama gen_pack.py (build()).
"""
import json, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'src', 'pack', 'assets', 'basedefense')


def noise(w, h, seed, scale):
    r = np.random.default_rng(seed)
    g = r.random((h // scale + 2, w // scale + 2))
    ys, xs = np.mgrid[0:h, 0:w]
    fx, fy = xs / scale, ys / scale
    x0, y0 = fx.astype(int), fy.astype(int)
    tx, ty = fx - x0, fy - y0
    a = g[y0, x0] * (1 - tx) + g[y0, x0 + 1] * tx
    b = g[y0 + 1, x0] * (1 - tx) + g[y0 + 1, x0 + 1] * tx
    return a * (1 - ty) + b * ty


def plate(w, h, seed):
    """Placa oscura con vetas de magma (las vetas siguen las curvas de nivel de un ruido)."""
    n = noise(w, h, seed, 5) * 0.7 + noise(w, h, seed + 1, 2) * 0.3
    base = np.zeros((h, w, 3))
    dark, mid = np.array([26, 20, 26]), np.array([58, 44, 52])
    base[:] = dark + (mid - dark) * n[..., None]
    # vetas: donde el ruido cruza ciertos niveles
    vein = np.minimum(np.abs(n - 0.42), np.abs(n - 0.63))
    glow = np.clip(1 - vein / 0.035, 0, 1) ** 1.5
    hot = np.array([255, 96, 24]) * glow[..., None] + np.array([255, 210, 90]) * (glow[..., None] ** 4) * 0.6
    img = np.clip(base * (1 - glow[..., None] * 0.9) + hot, 0, 255)
    # remaches y borde más claro por arriba de cada placa de 8 px
    ys, xs = np.mgrid[0:h, 0:w]
    img[(ys % 8 == 0)] = np.clip(img[(ys % 8 == 0)] * 1.35 + 12, 0, 255)
    img[(ys % 8 == 7)] *= 0.6
    rivet = ((xs % 8 == 1) | (xs % 8 == 6)) & (ys % 8 == 2)
    img[rivet] = [150, 130, 120]
    return img


def rect(img, x, y, w, h, col):
    img[y:y + h, x:x + w, :3] = col


def build():
    tex = os.path.join(OUT, 'textures', 'entity', 'equipment')
    for layer, seed in (('humanoid', 71), ('humanoid_leggings', 93)):
        img = np.zeros((32, 64, 4))
        img[..., :3] = plate(64, 32, seed)
        img[..., 3] = 255
        if layer == 'humanoid':
            # casco (cara delantera en 8..16 × 8..16): visor incandescente y cresta; cuernos en la parte de arriba (8..16 × 0..8)
            rect(img, 9, 11, 6, 2, [255, 225, 120])
            rect(img, 9, 13, 6, 1, [255, 110, 30])
            rect(img, 11, 8, 2, 3, [200, 40, 20])
            rect(img, 8, 0, 2, 8, [230, 215, 190])
            rect(img, 14, 0, 2, 8, [230, 215, 190])
            # peto (frente en 20..28 × 20..32): núcleo de magma en el pecho con rombo
            for d in range(4):
                rect(img, 24 - d, 22 + d, 2 * d + 0 or 1, 1, [255, 200, 80] if d < 2 else [255, 100, 30])
                rect(img, 24 - d, 28 - d, 2 * d + 0 or 1, 1, [255, 200, 80] if d < 2 else [255, 100, 30])
            # hombreras (brazos 40..56 × 16..20): borde de hueso
            rect(img, 40, 16, 16, 1, [230, 215, 190])
            # botas (0..16 × 16..32, parte baja): suela brillante
            rect(img, 0, 30, 16, 2, [255, 120, 30])
        os.makedirs(os.path.join(tex, layer), exist_ok=True)
        Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGBA').save(os.path.join(tex, layer, 'elite.png'))
    eq = os.path.join(OUT, 'equipment')
    os.makedirs(eq, exist_ok=True)
    json.dump({'layers': {'humanoid': [{'texture': 'basedefense:elite'}], 'humanoid_leggings': [{'texture': 'basedefense:elite'}]}},
              open(os.path.join(eq, 'elite.json'), 'w'), indent=1)
    print('élite: armadura propia')


if __name__ == '__main__':
    build()
