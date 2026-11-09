"""Personaje humanoide detallado (2 bloques = 32 px) con huesos de contrato y ropa por capas.
Cada personaje define su paleta y piezas; los huesos comunes son:
root, cuerpo, cabeza, brazo_izquierdo, brazo_derecho, pierna_izquierda, pierna_derecha
y puntos de anclaje opcionales (manos, mano_izquierda, mano_derecha, mano_proyectil, puno_derecho)."""
import numpy as np
from PIL import Image, ImageDraw
from geo import Geo, tex_path
from tex import noise


class Atlas:
    def __init__(self, name, size=128):
        self.name = name
        self.img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        self.glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        self.x = self.y = 0
        self.size = size
        self.seed = 1

    def _slot(self, w, h):
        if self.x + w > self.size:
            self.x = 0
            self.y += 16
        x, y = self.x, self.y
        self.x += w
        return x, y

    def shade(self, rgb, k=16, w=16, h=16):
        self.seed += 1
        a = noise(w, h, self.seed, base=4)
        arr = np.zeros((h, w, 4))
        for i in range(3):
            arr[..., i] = rgb[i] + (a - 0.5) * k
        arr[..., 3] = 255
        return Image.fromarray(np.clip(arr, 0, 255).astype('uint8'), 'RGBA')

    def add(self, im, glow=None):
        x, y = self._slot(*im.size)
        self.img.paste(im, (x, y))
        if glow is not None:
            self.glow.paste(glow, (x, y))
        return (x, y, im.size[0], im.size[1])

    def solid(self, rgb, k=16):
        return self.add(self.shade(rgb, k))

    def face(self, skin, eye, brow=(40, 30, 35), mouth=(120, 60, 60), glow_eyes=True, marks=None):
        f = self.shade(skin, 8)
        d = ImageDraw.Draw(f)
        d.rectangle([3, 7, 6, 8], fill=eye + (255,))
        d.rectangle([9, 7, 12, 8], fill=eye + (255,))
        d.point([(4, 7), (10, 7)], fill=(255, 255, 255, 255))
        d.line([(2, 5), (6, 6)], fill=brow + (255,))
        d.line([(9, 6), (13, 5)], fill=brow + (255,))
        d.line([(6, 12), (9, 12)], fill=mouth + (255,))
        if marks:
            marks(d)
        g = None
        if glow_eyes:
            g = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
            gd = ImageDraw.Draw(g)
            gd.rectangle([3, 7, 6, 8], fill=eye + (255,))
            gd.rectangle([9, 7, 12, 8], fill=eye + (255,))
        return self.add(f, g)

    def pattern(self, base, fn, k=14, glow_fn=None):
        im = self.shade(base, k)
        fn(ImageDraw.Draw(im))
        g = None
        if glow_fn:
            g = Image.new('RGBA', im.size, (0, 0, 0, 0))
            glow_fn(ImageDraw.Draw(g))
        return self.add(im, g)

    def save(self):
        self.img.save(tex_path(self.name))
        self.glow.save(tex_path(self.name, '_glowmask'))


def body(g, P, hair=None, extra=None, anchors=()):
    """P: dict de regiones de textura: skin, face, top, top_front, top_back, sleeve, hand, belt, pants, shoe, hair, trim."""
    g.bone('root', rotation=(0, 180, 0))
    cuerpo = g.bone('cuerpo', 'root', pivot=(0, 12, 0))
    g.cube(cuerpo, (-4, 12, -2), (8, 12, 4), {'north': P['top_front'], 'south': P['top_back'], '*': P['top']})
    g.cube(cuerpo, (-4.25, 11, -2.25), (8.5, 2.2, 4.5), P['belt'])
    if 'trim' in P:
        g.cube(cuerpo, (-4.2, 22.6, -2.2), (8.4, 1.1, 4.4), P['trim'])
    head = g.bone('cabeza', 'cuerpo', pivot=(0, 24, 0))
    g.cube(head, (-4, 24, -4), (8, 8, 8), {'north': P['face'], '*': P['skin']})
    g.cube(head, (-1.5, 22.5, -1.5), (3, 1.6, 3), P['skin'])  # cuello
    if hair:
        hair(g, head)
    for side, name in ((1, 'brazo_izquierdo'), (-1, 'brazo_derecho')):
        arm = g.bone(name, 'cuerpo', pivot=(5 * side, 22, 0))
        x0 = 4 if side > 0 else -8
        g.cube(arm, (x0, 17, -2), (4, 7, 4), P['sleeve'])
        g.cube(arm, (x0 + 0.25, 12.5, -1.75), (3.5, 4.8, 3.5), P.get('forearm', P['skin']))
        g.cube(arm, (x0 + 0.1, 9.5, -1.9), (3.8, 3.2, 3.8), P['hand'])
        if 'cuff' in P:
            g.cube(arm, (x0 - 0.2, 12.2, -2.2), (4.4, 1.4, 4.4), P['cuff'])
        hand_name = {1: 'mano_izquierda', -1: 'mano_derecha'}[side]
        if hand_name in anchors:
            g.bone(hand_name, name, pivot=(6 * side, 9.5, 0))
        if side < 0 and 'puno_derecho' in anchors:
            g.bone('puno_derecho', name, pivot=(-6, 9.5, 0))
    for side, name in ((1, 'pierna_izquierda'), (-1, 'pierna_derecha')):
        leg = g.bone(name, 'root', pivot=(1.95 * side, 12, 0))
        lx = 0.05 if side > 0 else -3.95
        g.cube(leg, (lx, 3, -2), (3.9, 9.2, 4), P['pants'])
        g.cube(leg, (lx - 0.15, 0, -2.6), (4.2, 3.4, 4.9), P['shoe'])
    if 'manos' in anchors:
        g.bone('manos', anchors['manos'][0], pivot=anchors['manos'][1])
    if 'mano_proyectil' in anchors:
        g.bone('mano_proyectil', anchors['mano_proyectil'][0], pivot=anchors['mano_proyectil'][1])
    if extra:
        extra(g)
