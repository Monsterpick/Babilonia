"""Modelos a partir de las hojas de referencia (frente · lado · espalda) que aporta el usuario en tools/referencias/.

Cada pieza (cabeza con pelo, torso, brazos, piernas, faldón…) es un cubo con las proporciones del dibujo; su cara
frontal se recorta de la vista de frente, la trasera de la espalda y los laterales de la vista de lado. El fondo
blanco se vuelve transparente, así el pelo en punta o la silueta del santuario conservan su forma.
Mantiene los huesos y las animaciones del contrato (las animaciones son las de gen_personajes.py).
"""
import json, os
import numpy as np
from PIL import Image
from geo import Geo, tex_path, ROOT

HERE = os.path.dirname(os.path.abspath(__file__))
T = 4  # texeles por unidad de modelo (1 unidad = 1/16 de bloque)


def load(name):
    """Carga la hoja y vuelve transparente SOLO el fondo blanco unido al borde (no la piel clara ni los ojos)."""
    from PIL import ImageDraw
    im = Image.open(os.path.join(HERE, 'referencias', f'{name}.jpg')).convert('RGBA')
    a = np.asarray(im).copy()
    rgb = a[..., :3].astype(int)
    white = (rgb.min(axis=2) > 232) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 22)
    mask = Image.fromarray((white * 255).astype('uint8'), 'L').copy()  # copia: floodfill no escribe en imágenes de solo lectura
    w, h = mask.size
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)] + [(x, 0) for x in range(0, w, 97)] + [(x, h - 1) for x in range(0, w, 97)]:
        if mask.getpixel(seed) == 255:
            ImageDraw.floodfill(mask, seed, 128)
    bg = np.asarray(mask) == 128
    # huecos interiores grandes (entre piernas, bajo los brazos) también son fondo
    a[bg, 3] = 0
    return Image.fromarray(a, 'RGBA')


class Packer:
    def __init__(self, w=1024):
        self.w = w
        self.x = self.y = self.row = 0
        self.items = []

    def add(self, im):
        if self.x + im.size[0] > self.w:
            self.x = 0
            self.y += self.row + 1
            self.row = 0
        pos = (self.x, self.y)
        self.items.append((im, pos))
        self.x += im.size[0] + 1
        self.row = max(self.row, im.size[1])
        return pos

    def image(self):
        h = 1
        while h < self.y + self.row + 1:
            h *= 2
        out = Image.new('RGBA', (self.w, h), (0, 0, 0, 0))
        for im, pos in self.items:
            out.paste(im, pos)
        return out


def crop(img, box, units_w, units_h, flip=False):
    c = img.crop(tuple(int(round(v)) for v in box))
    w, h = max(1, int(round(units_w * T))), max(1, int(round(units_h * T)))
    c = c.resize((w, h), Image.NEAREST)
    return c.transpose(Image.FLIP_LEFT_RIGHT) if flip else c


def build(name, cfg, extra=None):
    img = load(name)
    u = cfg['u']
    cf, cb, scx, base = cfg['front_c'], cfg['back_c'], cfg['side_c'], cfg['base']
    pk = Packer(cfg.get('atlas', 1024))
    cubes = []  # (bone, origin, size, faces{face: (x,y,w,h)})

    def part(bone, box, side, faces=('north', 'south', 'east', 'west', 'up', 'down'), z_off=0.0, depth=None):
        x0, y0, x1, y1 = box
        sx0, sx1 = side
        w, h = (x1 - x0) / u, (y1 - y0) / u
        d = depth if depth is not None else (sx1 - sx0) / u
        # Frente de la imagen a la izquierda = +X en el modelo (se ve igual que el dibujo desde delante).
        mx0 = -(x1 - cf) / u
        my0 = (base - y1) / u
        mz0 = (scx - sx1) / u + z_off if depth is None else -d / 2 + z_off
        uv = {}
        if 'north' in faces:
            uv['north'] = pk.add(crop(img, box, w, h)), w, h
        if 'south' in faces:
            bx0, bx1 = cb - (x1 - cf), cb - (x0 - cf)
            uv['south'] = pk.add(crop(img, (bx0, y0, bx1, y1), w, h)), w, h
        if 'east' in faces:
            uv['east'] = pk.add(crop(img, (sx0, y0, sx1, y1), d, h)), d, h
        if 'west' in faces:
            uv['west'] = pk.add(crop(img, (sx0, y0, sx1, y1), d, h, flip=True)), d, h
        band = max(2, (y1 - y0) * 0.12)
        if 'up' in faces:
            uv['up'] = pk.add(crop(img, (x0, y0 + 2, x1, y0 + band), w, d)), w, d
        if 'down' in faces:
            uv['down'] = pk.add(crop(img, (x0, y1 - band, x1, y1 - 2), w, d)), w, d
        cubes.append((bone, (mx0, my0, mz0), (w, h, d), uv))
        return (mx0, my0, mz0, w, h, d)

    geo = {}
    for bone, spec in cfg['parts'].items():
        geo[bone] = [part(bone, *s) if isinstance(s, tuple) and isinstance(s[0], tuple) else part(bone, **s) for s in spec]
    atlas = pk.image()
    atlas.save(tex_path(name))
    Image.new('RGBA', atlas.size, (0, 0, 0, 0)).save(tex_path(name, '_glowmask'))

    g = Geo(name, atlas.size[0], atlas.size[1], bounds=cfg.get('bounds', (3, 4, 1.5)))
    bones = {}

    def ensure(bname, parent, pivot):
        if bname not in bones:
            bones[bname] = g.bone(bname, parent, pivot=pivot)
        return bones[bname]

    for bname, parent, pivot in cfg['rig']:
        if bname == cfg['rig'][0][0]:
            bones[bname] = g.bone(bname, rotation=(0, 180, 0))
        else:
            ensure(bname, parent, pivot(geo) if callable(pivot) else pivot)
    for bone, origin, size, uv in cubes:
        faces = {f: (p[0], p[1], max(1, int(round(w * T))), max(1, int(round(h * T)))) for f, (p, w, h) in uv.items()}
        g.cube(bones[bone], origin, size, faces, faces=tuple(faces.keys()))
    if extra:
        extra(g, bones, geo)
    g.save()
    return geo


def ub(box_list):
    """Caja (x0,y0,z0,w,h,d) de la primera pieza de un hueso."""
    return box_list[0]


# --------------------------------------------------------------------------- personajes
def humanoid_rig(anchors):
    def top_center(b, down=2.0):
        x0, y0, z0, w, h, d = ub(b)
        return (x0 + w / 2, y0 + h - down, z0 + d / 2)

    rig = [
        ('root', None, (0, 0, 0)),
        ('cuerpo', 'root', lambda G: (0, ub(G['cuerpo'])[1], 0)),
        ('cabeza', 'cuerpo', lambda G: (0, ub(G['cabeza'])[1], ub(G['cabeza'])[2] + ub(G['cabeza'])[5] / 2)),
        ('brazo_izquierdo', 'cuerpo', lambda G: top_center(G['brazo_izquierdo'])),
        ('brazo_derecho', 'cuerpo', lambda G: top_center(G['brazo_derecho'])),
        ('pierna_izquierda', 'root', lambda G: top_center(G['pierna_izquierda'], 0)),
        ('pierna_derecha', 'root', lambda G: top_center(G['pierna_derecha'], 0)),
    ]
    for a in anchors:
        rig.append(a)
    return rig


def hand(side_bone):
    def f(G):
        x0, y0, z0, w, h, d = ub(G[side_bone])
        return (x0 + w / 2, y0 + 1.5, z0 + d / 2)
    return f


AKAZA = dict(
    u=230 / 8, front_c=410.5, back_c=1625, side_c=1010, base=1062,
    parts={
        'cabeza': [((270, 95, 550, 362), (885, 1150))],
        'cuerpo': [((285, 362, 540, 625), (950, 1080))],
        # Brazo de la izquierda de la imagen → +X (brazo «izquierdo» del esqueleto, que está en +X).
        'brazo_izquierdo': [((168, 362, 285, 697), (952, 1078))],
        'brazo_derecho': [((540, 362, 655, 697), (952, 1078))],
        'pierna_izquierda': [((268, 625, 410, 1062), (935, 1100))],
        'pierna_derecha': [((410, 625, 552, 1062), (935, 1100))],
    },
)
GOJO = dict(
    u=230 / 8, front_c=362.5, back_c=1654.5, side_c=1010, base=1079,
    parts={
        'cabeza': [((192, 86, 535, 413), (850, 1168))],
        'cuerpo': [((240, 413, 485, 763), (935, 1092))],
        'brazo_izquierdo': [((95, 425, 245, 760), (940, 1088))],
        'brazo_derecho': [((480, 425, 630, 760), (940, 1088))],
        'pierna_izquierda': [((235, 763, 362, 1079), (950, 1118))],
        'pierna_derecha': [((362, 763, 490, 1079), (950, 1118))],
    },
)
SUKUNA = dict(
    u=240 / 8, front_c=355, back_c=1655.5, side_c=1020, base=1080,
    parts={
        'cabeza': [((198, 79, 505, 360), (872, 1142))],
        'cuerpo': [((225, 360, 480, 680), (955, 1087)),
                   ((228, 680, 477, 962), (955, 1087))],  # faldón de la túnica
        'brazo_izquierdo': [((104, 360, 232, 717), (962, 1082))],
        'brazo_derecho': [((476, 360, 607, 717), (962, 1082))],
        'pierna_izquierda': [((230, 960, 352, 1080), (905, 1082))],
        'pierna_derecha': [((352, 960, 475, 1080), (905, 1082))],
    },
)


def legs_full_height(geo_cfg, leg_top):
    """Las piernas de Sukuna solo asoman bajo la túnica: el hueso nace a la altura de la cadera igualmente."""
    return leg_top


def main():
    for name, cfg, anchors in (
        ('akaza', AKAZA, [('puno_derecho', 'brazo_derecho', hand('brazo_derecho'))]),
        ('gojo', GOJO, [('mano_izquierda', 'brazo_izquierdo', hand('brazo_izquierdo')),
                        ('mano_derecha', 'brazo_derecho', hand('brazo_derecho')),
                        ('mano_proyectil', 'cuerpo', lambda G: (0, ub(G['cuerpo'])[1] + ub(G['cuerpo'])[4] * 0.45, ub(G['cuerpo'])[2] - 6))]),
        ('sukuna', SUKUNA, [('manos', 'cuerpo', lambda G: (0, ub(G['cuerpo'])[1] + ub(G['cuerpo'])[4] * 0.55, ub(G['cuerpo'])[2] - 5))]),
    ):
        cfg['rig'] = humanoid_rig(anchors)
        geo = build(name, cfg)
        top = max(b[1] + b[4] for bs in geo.values() for b in bs)
        print(f'{name}: alto {top / 16:.2f} bloques')


if __name__ == '__main__':
    main()


# --------------------------------------------------------------------------- santuario
def santuario():
    """Santuario con fauces: caja con la silueta del dibujo (frente con la boca, laterales con la vista de lado)
    y una mandíbula inferior aparte (hueso «fauces») que se abre y se cierra."""
    from geo import anim, save_anims
    name = 'santuario'
    img = load(name)
    u = 900 / 80.0                       # 80 unidades = 5 bloques de alto a escala 1
    F = (33, 108, 1010, 1008)            # vista de frente
    S = (1066, 108, 1963, 1008)          # vista de lado
    JAW = (398, 838, 652, 978)           # dientes de abajo
    w, h, d = (F[2] - F[0]) / u, (F[3] - F[1]) / u, (S[2] - S[0]) / u
    pk = Packer(2048)
    front = img.crop(F).copy()
    # Bajo la mandíbula se ve el interior oscuro de la boca (no los dientes repetidos).
    jx0, jy0, jx1, jy1 = JAW[0] - F[0], JAW[1] - F[1], JAW[2] - F[0], JAW[3] - F[1]
    hole = Image.new('RGBA', (int(jx1 - jx0 - 30), int(jy1 - jy0 - 10)), (24, 2, 4, 255))
    front.paste(hole, (int(jx0 + 15), int(jy0)))
    def fit(im, uw, uh, flip=False):
        im = im.resize((max(1, int(round(uw * T))), max(1, int(round(uh * T)))), Image.NEAREST)
        return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
    side = img.crop(S)
    uv = {
        'north': (pk.add(fit(front, w, h)), w, h),
        'south': (pk.add(fit(side, w, h, True)), w, h),
        'east': (pk.add(fit(side, d, h)), d, h),
        'west': (pk.add(fit(side, d, h, True)), d, h),
    }
    jw, jh = (JAW[2] - JAW[0]) / u, (JAW[3] - JAW[1]) / u
    juv = pk.add(fit(img.crop(JAW), jw, jh))
    atlas = pk.image()
    atlas.save(tex_path(name))
    # Brillo: los ojos y grietas rojas intensas del dibujo.
    a = np.asarray(atlas).astype(int)
    glow = np.zeros_like(a)
    red = (a[..., 0] > 150) & (a[..., 1] < 60) & (a[..., 2] < 60) & (a[..., 3] > 0)
    glow[red] = a[red]
    Image.fromarray(glow.astype('uint8'), 'RGBA').save(tex_path(name, '_glowmask'))

    g = Geo(name, atlas.size[0], atlas.size[1], bounds=(16, 16, 6))
    base = g.bone('base', rotation=(0, 180, 0))
    faces = {f: (p[0], p[1], max(1, int(round(fw * T))), max(1, int(round(fh * T)))) for f, (p, fw, fh) in uv.items()}
    g.cube(base, (-w / 2, 0, -d / 2), (w, h, d), faces, faces=tuple(faces.keys()))
    jx = -((JAW[2] - (F[0] + F[2]) / 2) / u)
    jy = (F[3] - JAW[3]) / u
    fa = g.bone('fauces', 'base', pivot=(jx + jw / 2, jy + jh, -d / 2 - 0.4))
    g.cube(fa, (jx, jy, -d / 2 - 0.6), (jw, jh, 0.2), {'north': (juv[0], juv[1], int(round(jw * T)), int(round(jh * T)))}, faces=('north',))
    g.save()
    save_anims(name, {
        'emerger': anim(2.5, False, {'base': {'position': {0: [0, -82, 0], 2.0: (0, 1.5, 0, 'easeOutCubic'), 2.5: (0, 0, 0, 'easeInOutSine')}}}),
        'idle': anim(3.0, True, {'fauces': {'position': {0: [0, 0, 0], 1.5: (0, -3.5, 0, 'easeInOutSine'), 3.0: (0, 0, 0, 'easeInOutSine')}},
                                 'base': {'scale': {0: [1, 1, 1], 1.5: (1.005, 1.01, 1.005, 'easeInOutSine'), 3.0: (1, 1, 1, 'easeInOutSine')}}}),
        'hundirse': anim(2.0, None, {'base': {'position': {0: [0, 0, 0], 2.0: (0, -85, 0, 'easeInQuad')}}}),
    })
    print(f'santuario: {w / 16:.1f} × {h / 16:.1f} × {d / 16:.1f} bloques a escala 1')


if __name__ == '__main__':
    santuario()
