"""Mobs infectados de Base Defense: texturas propias, dibujadas aquí con ruido y píxel a píxel (no se copia nada).

Solo se respeta el desplegado UV estándar de cada modelo para que el juego las use tal cual:
- husk (64×64, humanoide como el zombi): momia reseca con vendas rotas, pústulas naranjas que brillan y sangre seca.
- skeleton / wither_skeleton (64×32): huesos agrietados con hongos infectados (verde ácido / brasas) que les crecen.
- spider (64×32) + spider_eyes: caparazón con placas, venas que brillan y racimo de ojos rojos.
"""
import os
import numpy as np
from PIL import Image

import gen_zombie as gz

MC = gz.MC
box = gz.box_faces


def paint(img, faces, pal, seed, grain=2):
    for k, (x, y, w, h) in faces.items():
        gz.region(img, x, y, w, h, pal, seed + x * 7 + y, grain)


def shade(img, faces):
    for k, (x, y, w, h) in faces.items():
        sub = img[y:y + h, x:x + w, :3]
        if k in ('up', 'down'):
            sub *= 1.08 if k == 'up' else 0.66
            continue
        sub *= np.linspace(1.24, 0.9, h)[:, None, None]
        sub[:, 0] *= 0.88
        sub[:, -1] *= 0.88
        if k == 'back':
            sub *= 0.9


def pustules(img, faces, chance, core, rim, seed, keys=None):
    """Pústulas: un píxel brillante con un borde oscuro alrededor (se ven a distancia)."""
    r = np.random.default_rng(seed)
    for k, (x, y, w, h) in faces.items():
        if keys and k not in keys:
            continue
        for _ in range(max(1, int(w * h * chance))):
            px, py = x + r.integers(0, w), y + r.integers(0, h)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                qx, qy = px + dx, py + dy
                if x <= qx < x + w and y <= qy < y + h:
                    img[qy, qx, :3] = rim
            img[py, px, :3] = core


def veins(img, faces, col, seed, keys=None, n=2):
    r = np.random.default_rng(seed)
    for k, (x, y, w, h) in faces.items():
        if keys and k not in keys:
            continue
        for _ in range(n):
            px, py = x + r.integers(0, w), y
            while py < y + h:
                img[py, px, :3] = col
                py += 1
                px = int(np.clip(px + r.integers(-1, 2), x, x + w - 1))


SAND = np.array([(138, 118, 84), (156, 134, 96), (172, 150, 108), (120, 100, 72)], float)
WRAP = np.array([(176, 164, 132), (196, 184, 150), (150, 138, 110)], float)
BONE = np.array([(168, 164, 150), (188, 184, 168), (206, 202, 186), (146, 140, 126)], float)
CHAR = np.array([(30, 30, 32), (42, 40, 42), (54, 50, 50), (22, 22, 24)], float)
SHELL = np.array([(38, 30, 34), (50, 38, 42), (62, 46, 48), (28, 22, 26)], float)
ACID = (150, 236, 70)
EMBER = (255, 132, 40)
SICK = np.array([(98, 140, 46), (122, 168, 58), (78, 112, 38)], float)


def husk():
    img = np.zeros((64, 64, 4), float)
    hf, tf = box(0, 0, 8, 8, 8), box(16, 16, 8, 12, 4)
    af, lf = box(40, 16, 4, 12, 4), box(0, 16, 4, 12, 4)
    for f, s in ((hf, 10), (tf, 20), (af, 30), (lf, 40)):
        paint(img, f, SAND, s)
    # vendas rotas en bandas horizontales
    for f in (tf, af, lf):
        for k, (x, y, w, h) in f.items():
            if k in ('up', 'down'):
                continue
            for by in range(y + 1, y + h, 3):
                img[by, x:x + w, :3] = WRAP[(by + x) % 3]
                img[by, x + (by % w), :3] = SAND[3]  # rotura
    fx, fy = hf['front'][:2]
    for ex in (1, 5):
        img[fy + 3:fy + 5, fx + ex:fx + ex + 2, :3] = (26, 18, 14)
        img[fy + 3, fx + ex + (1 if ex == 1 else 0), :3] = EMBER
    img[fy + 6, fx + 2:fx + 6, :3] = (40, 14, 10)
    img[fy + 6, fx + 3, :3] = (220, 206, 168)
    for f, s in ((hf, 1), (tf, 2), (af, 3), (lf, 4)):
        gz.splat(img, *f['front'], 0.12, gz.BLOOD * 0.8, 500 + s)
        pustules(img, f, 0.025, EMBER, (110, 44, 18), 600 + s)
    for f in (hf, tf, af, lf):
        shade(img, f)
    for ex in (1, 5):
        img[fy + 3, fx + ex + (1 if ex == 1 else 0), :3] = (255, 170, 60)
    return np.clip(img, 0, 255)


def skeleton(pal, glow, rim, seed):
    img = np.zeros((32, 64, 4), float)
    hf, tf = box(0, 0, 8, 8, 8), box(16, 16, 8, 12, 4)
    af, lf = box(40, 16, 2, 12, 2), box(0, 16, 2, 12, 2)
    paint(img, hf, pal, seed)
    paint(img, af, pal, seed + 1)
    paint(img, lf, pal, seed + 2)
    # torso: costillas sobre transparente (el modelo deja ver entre ellas)
    for k, (x, y, w, h) in tf.items():
        if k in ('up', 'down'):
            gz.region(img, x, y, w, h, pal, seed + 3)
            continue
        img[y:y + h, x + w // 2 - 1:x + w // 2 + 1, :3] = pal[1]   # columna
        img[y:y + h, x + w // 2 - 1:x + w // 2 + 1, 3] = 255
        for ry in range(y + 1, y + 9, 2):
            img[ry, x:x + w, :3] = pal[(ry + seed) % 3]
            img[ry, x:x + w, 3] = 255
        img[y + 10:y + 12, x:x + w, :3] = pal[3]                 # pelvis
        img[y + 10:y + 12, x:x + w, 3] = 255
    fx, fy = hf['front'][:2]
    img[fy + 2:fy + 5, fx + 1:fx + 3, :3] = (14, 12, 12)
    img[fy + 2:fy + 5, fx + 5:fx + 7, :3] = (14, 12, 12)
    img[fy + 3, fx + 2, :3] = glow
    img[fy + 3, fx + 5, :3] = glow
    img[fy + 5, fx + 3:fx + 5, :3] = (30, 26, 24)
    for tx in range(fx + 1, fx + 7):
        img[fy + 6, tx, :3] = pal[2] if tx % 2 else (24, 20, 18)
    # grietas y hongos infectados que les crecen por el cráneo y los huesos
    veins(img, hf, (60, 54, 48), seed + 10, keys=('front', 'left', 'right', 'up'), n=1)
    for f, s in ((hf, 1), (af, 2), (lf, 3)):
        pustules(img, f, 0.07, glow, rim, seed + 20 + s)
    for f in (hf, af, lf):
        shade(img, f)
    img[fy + 3, fx + 2, :3] = glow
    img[fy + 3, fx + 5, :3] = glow
    return np.clip(img, 0, 255)


def spider():
    img = np.zeros((32, 64, 4), float)
    head, neck = box(32, 4, 8, 8, 8), box(0, 0, 6, 6, 6)
    body, leg = box(0, 12, 10, 8, 12), box(18, 0, 16, 2, 2)
    for f, s in ((head, 1), (neck, 2), (body, 3), (leg, 4)):
        paint(img, f, SHELL, 700 + s)
    # placas del caparazón y venas que brillan
    x, y, w, h = body['up']
    for py in range(y, y + h, 3):
        img[py, x:x + w, :3] *= 0.7
    veins(img, body, ACID, 710, keys=('up', 'left', 'right', 'back'), n=2)
    veins(img, head, (120, 190, 60), 711, keys=('up',), n=1)
    pustules(img, body, 0.04, ACID, (40, 60, 20), 712, keys=('up', 'left', 'right'))
    # patas con franjas
    for k, (lx, ly, lw, lh) in leg.items():
        for px in range(lx, lx + lw, 4):
            img[ly:ly + lh, px, :3] = SICK[1] * 0.6
    for f in (head, neck, body, leg):
        shade(img, f)
    eyes = np.zeros((32, 64, 4), float)
    fx, fy = head['front'][:2]
    for ex, ey in ((1, 1), (6, 1), (2, 3), (5, 3), (3, 2), (4, 2), (1, 4), (6, 4)):
        for t in (img, eyes):
            t[fy + ey, fx + ex, :3] = (255, 40, 30) if t is eyes else (200, 20, 20)
            t[fy + ey, fx + ex, 3] = 255
    return np.clip(img, 0, 255), eyes


def save(arr, *rel):
    p = os.path.join(gz.mkdir(os.path.join(MC, 'textures', 'entity', *rel[:-1])), rel[-1])
    Image.fromarray(arr.astype(np.uint8), 'RGBA').save(p)


def build():
    save(husk(), 'zombie', 'husk.png')
    save(skeleton(BONE, ACID, (40, 70, 20), 800), 'skeleton', 'skeleton.png')
    save(skeleton(CHAR, EMBER, (90, 30, 10), 900), 'skeleton', 'wither_skeleton.png')
    s, e = spider()
    save(s, 'spider', 'spider.png')
    save(e, 'spider', 'spider_eyes.png')
    print('infectados: husk, skeleton, wither_skeleton, spider (+ojos)')


if __name__ == '__main__':
    build()
