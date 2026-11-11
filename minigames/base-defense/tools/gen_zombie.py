"""Zombis de Base Defense: textura propia (dibujada aquí, píxel a píxel con ruido) y piezas para el desmembramiento.

- assets/minecraft/textures/entity/zombie/zombie.png: piel nueva de 64×64 con el mismo mapa UV estándar de un
  humanoide (cabeza 0,0 · pelo 32,0 · torso 16,16 · brazo 40,16 · pierna 0,16), así el modelo del juego la usa tal cual.
  Piel podrida verdosa, cuencas hundidas con brillo, boca desgarrada, camisa rota con sangre y costillas, pantalón roto.
- Piezas 3D que salen volando al matarlos (cabeza, brazo, pierna, torso) con la misma piel y el muñón en carne viva,
  y trozos genéricos (carne y hueso) para los mobs que no son zombis.

Todo es arte original generado por código; no se copia ninguna textura.
"""
import json, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'src', 'pack')
MC = os.path.join(OUT, 'assets', 'minecraft')
BD = os.path.join(OUT, 'assets', 'basedefense')
R = np.random.default_rng(4242)


def mkdir(p):
    os.makedirs(p, exist_ok=True)
    return p


def noise(w, h, s, seed):
    r = np.random.default_rng(seed)
    g = r.random((h // s + 2, w // s + 2))
    return np.kron(g, np.ones((s, s)))[:h, :w]


SKIN = np.array([(70, 96, 64), (88, 116, 74), (104, 128, 82), (122, 140, 92)], float)
SHIRT = np.array([(46, 58, 74), (58, 72, 90), (70, 86, 104)], float)
PANTS = np.array([(44, 40, 52), (54, 50, 62), (64, 60, 74)], float)
BLOOD = np.array([(92, 8, 10), (120, 14, 14), (70, 4, 6)], float)
FLESH = np.array([(150, 30, 34), (182, 52, 52), (120, 18, 24), (214, 160, 150)], float)


def pick(pal, n):
    i = np.clip((n * len(pal)).astype(int), 0, len(pal) - 1)
    return pal[i]


def region(img, x, y, w, h, pal, seed, grain=2):
    n = noise(w, h, grain, seed) * 0.6 + R.random((h, w)) * 0.4
    img[y:y + h, x:x + w, :3] = pick(pal, n)
    img[y:y + h, x:x + w, 3] = 255


def splat(img, x, y, w, h, chance, pal, seed, alpha=255):
    r = np.random.default_rng(seed)
    blob = noise(w, h, 2, seed + 1) * 0.7 + r.random((h, w)) * 0.3
    m = blob > 1 - chance
    sub = img[y:y + h, x:x + w]
    sub[m, :3] = pal[r.integers(0, len(pal), m.sum())]
    sub[m, 3] = np.maximum(sub[m, 3], alpha)


def box_faces(u, v, w, h, d):
    """Rectángulos (x, y, w, h) de cada cara en el desplegado estándar de una caja."""
    return {
        'up': (u + d, v, w, d), 'down': (u + d + w, v, w, d),
        'right': (u, v + d, d, h), 'front': (u + d, v + d, w, h),
        'left': (u + d + w, v + d, d, h), 'back': (u + 2 * d + w, v + d, w, h),
    }


def skin():
    img = np.zeros((64, 64, 4), float)
    # ── cabeza (8×8×8 en 0,0)
    hf = box_faces(0, 0, 8, 8, 8)
    for k, (x, y, w, h) in hf.items():
        region(img, x, y, w, h, SKIN, 10 + x + y)
    fx, fy = hf['front'][:2]
    # cuencas hundidas y ojos con un brillo amarillento
    for ex in (1, 5):
        img[fy + 3:fy + 5, fx + ex:fx + ex + 2, :3] = (22, 26, 20)
        img[fy + 3, fx + ex + (1 if ex == 1 else 0), :3] = (226, 214, 120)
    img[fy + 2, fx + 1:fx + 7, :3] *= 0.7  # ceño
    img[fy + 5, fx + 3:fx + 5, :3] = (40, 52, 36)  # nariz podrida
    # boca desgarrada con dientes
    img[fy + 6, fx + 2:fx + 7, :3] = (34, 8, 10)
    img[fy + 7, fx + 3:fx + 6, :3] = (60, 10, 12)
    img[fy + 6, fx + 3, :3] = (214, 206, 170)
    img[fy + 6, fx + 5, :3] = (200, 192, 150)
    # herida en la sien con carne
    img[fy + 1:fy + 3, fx + 6:fx + 8, :3] = FLESH[:2].mean(0)
    img[fy + 1, fx + 7, :3] = FLESH[3]
    splat(img, *hf['left'], 0.22, BLOOD, 77)
    splat(img, *hf['up'], 0.18, np.array([(40, 52, 34), (30, 40, 28)]), 78)
    # pelo ralo (capa exterior en 32,0): mechones sueltos arriba y detrás
    pf = box_faces(32, 0, 8, 8, 8)
    hair = np.array([(34, 30, 26), (46, 40, 34), (24, 22, 20)])
    for k in ('up', 'back', 'left', 'right'):
        x, y, w, h = pf[k]
        rows = h if k == 'up' else 3
        splat(img, x, y, w, rows, 0.45, hair, 90 + x)
    # ── torso (8×12×4 en 16,16): camisa rota con sangre y costillas al aire
    tf = box_faces(16, 16, 8, 12, 4)
    for k, (x, y, w, h) in tf.items():
        region(img, x, y, w, h, SHIRT, 200 + x)
    x, y, w, h = tf['front']
    img[y + 2:y + 3, x + 3:x + 5, :3] = SHIRT[0] * 0.7   # cuello roto
    # desgarrón con costillas
    img[y + 4:y + 9, x + 1:x + 5, :3] = (96, 120, 78)
    for ry in (5, 7):
        img[y + ry, x + 1:x + 5, :3] = (222, 210, 180)
    img[y + 6, x + 1:x + 5, :3] = FLESH[0]
    img[y + 8, x + 1:x + 5, :3] = FLESH[2]
    splat(img, x, y, w, h, 0.2, BLOOD, 211)
    img[y + 11, x:x + w, :3] *= 0.6  # bajo deshilachado
    splat(img, *tf['back'], 0.14, BLOOD, 212)
    # ── brazo (4×12×4 en 40,16): manga rota arriba, piel abajo
    af = box_faces(40, 16, 4, 12, 4)
    for k, (x, y, w, h) in af.items():
        region(img, x, y, w, h, SKIN, 300 + x)
        if k not in ('up', 'down'):
            region(img, x, y, w, 4, SHIRT, 310 + x)
            img[y + 4, x:x + w:2, :3] = SHIRT[1]
            splat(img, x, y + 5, w, 7, 0.16, BLOOD, 320 + x)
    x, y, w, h = af['down']
    img[y:y + h, x:x + w, :3] = SKIN[0] * 0.8  # mano
    # ── pierna (4×12×4 en 0,16): pantalón roto con la rodilla al aire
    lf = box_faces(0, 16, 4, 12, 4)
    for k, (x, y, w, h) in lf.items():
        region(img, x, y, w, h, PANTS, 400 + x)
        if k in ('front', 'right', 'left'):
            img[y + 5:y + 7, x + 1:x + 3, :3] = SKIN[1]
            img[y + 7, x + 1:x + 3, :3] = PANTS[0] * 0.7
        img[y + 10:y + 12, x:x + w, :3] = (36, 30, 26)  # zapatos destrozados
    splat(img, lf['front'][0], lf['front'][1], 4, 12, 0.12, BLOOD, 430)
    # volumen: cada cara se aclara arriba y se oscurece abajo y en los bordes; la espalda y la cara de abajo, más oscuras
    for faces in (hf, tf, af, lf):
        for k, (x, y, w, h) in faces.items():
            sub = img[y:y + h, x:x + w, :3]
            if k in ('up', 'down'):
                sub *= 1.08 if k == 'up' else 0.68
                continue
            grad = np.linspace(1.26, 0.92, h)[:, None, None]
            sub *= grad
            sub[:, 0] *= 0.88
            sub[:, -1] *= 0.88
            if k == 'back':
                sub *= 0.9
            elif k in ('left', 'right'):
                sub *= 0.94
    # los ojos siguen brillando después del sombreado
    for ex in (1, 5):
        img[fy + 3, fx + ex + (1 if ex == 1 else 0), :3] = (240, 226, 120)
    return np.clip(img, 0, 255)


def parts_texture(skin_img):
    """La piel + un parche de carne viva (muñón) y otro de hueso en la parte libre de la textura."""
    img = skin_img.copy()
    region(img, 0, 48, 8, 8, FLESH[:3], 501, 1)
    img[50:54, 2:6, :3] = FLESH[3]           # hueso en el centro del muñón
    img[51:53, 3:5, :3] = (236, 228, 206)
    region(img, 8, 48, 8, 8, np.array([(214, 206, 184), (196, 186, 162), (230, 222, 200)]), 502, 1)  # hueso
    region(img, 16, 48, 8, 8, FLESH[:3], 503, 1)                                                     # carne
    return img


def uv(x, y, w, h):
    return [x / 4, y / 4, (x + w) / 4, (y + h) / 4]


STUMP = (0, 48, 8, 8)


def part(fr, to, faces, stump=None):
    """faces: rectángulos de la piel; stump = cara que queda en carne viva."""
    m = {'front': 'north', 'back': 'south', 'right': 'west', 'left': 'east', 'up': 'up', 'down': 'down'}
    f = {}
    for k, rect in faces.items():
        f[m[k]] = {'uv': uv(*(STUMP if k == stump else rect)), 'texture': '#0'}
    return {'from': fr, 'to': to, 'faces': f}


def write_model(name, elements):
    model = {'texture_size': [64, 64], 'textures': {'0': 'basedefense:item/zombi_partes', 'particle': 'basedefense:item/zombi_partes'},
             'elements': elements, 'display': {'fixed': {'scale': [1, 1, 1]}}}
    json.dump(model, open(os.path.join(mkdir(os.path.join(BD, 'models', 'item')), name + '.json'), 'w'), indent=1)
    json.dump({'model': {'type': 'minecraft:model', 'model': 'basedefense:item/' + name}}, open(os.path.join(mkdir(os.path.join(BD, 'items')), name + '.json'), 'w'))


def build():
    s = skin()
    p = os.path.join(mkdir(os.path.join(MC, 'textures', 'entity', 'zombie')), 'zombie.png')
    Image.fromarray(s.astype(np.uint8), 'RGBA').save(p)
    # bebé con la misma piel (su desplegado es otro; aquí basta con el tono para que no desentone)
    pt = parts_texture(s)
    Image.fromarray(pt.astype(np.uint8), 'RGBA').save(os.path.join(mkdir(os.path.join(BD, 'textures', 'item')), 'zombi_partes.png'))
    # piezas centradas en el origen del modelo (8,8,8) para que giren sobre sí mismas
    write_model('parte_cabeza', [part([4, 4, 4], [12, 12, 12], box_faces(0, 0, 8, 8, 8), stump='down'),
                                 part([3.6, 8, 3.6], [12.4, 12.4, 12.4], {k: v for k, v in box_faces(32, 0, 8, 8, 8).items() if k in ('up', 'back')})])
    write_model('parte_brazo', [part([6, 2, 6], [10, 14, 10], box_faces(40, 16, 4, 12, 4), stump='up')])
    write_model('parte_pierna', [part([6, 2, 6], [10, 14, 10], box_faces(0, 16, 4, 12, 4), stump='up')])
    torso = box_faces(16, 16, 8, 12, 4)
    torso_top = {k: (x, y, w, min(h, 7) if k not in ('up', 'down') else h) for k, (x, y, w, h) in torso.items()}
    write_model('parte_torso', [part([4, 4.5, 6], [12, 11.5, 10], torso_top, stump='down')])
    write_model('trozo_carne', [{'from': [6, 6, 6], 'to': [10, 9, 9.5], 'faces': {f: {'uv': uv(16, 48, 4, 4), 'texture': '#0'} for f in ('north', 'south', 'east', 'west', 'up', 'down')}}])
    write_model('trozo_hueso', [{'from': [7, 7, 4], 'to': [9, 9, 12], 'faces': {f: {'uv': uv(8, 48, 2, 6), 'texture': '#0'} for f in ('north', 'south', 'east', 'west', 'up', 'down')}},
                                {'from': [6.5, 6.5, 3], 'to': [9.5, 9.5, 5], 'faces': {f: {'uv': uv(8, 48, 3, 3), 'texture': '#0'} for f in ('north', 'south', 'east', 'west', 'up', 'down')}}])
    print('zombis: piel propia + 6 piezas de desmembramiento')


if __name__ == '__main__':
    build()
