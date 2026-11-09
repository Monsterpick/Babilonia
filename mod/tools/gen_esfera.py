"""Esferas de energía de calidad (radio 1 bloque; el servidor da el tamaño y el color):
- «esfera»: núcleo blanco, cuerpo de energía con brillo suave (paneles con degradado radial que se funden), halo
  exterior tenue, corrientes que giran en 3 ejes y chispas en órbita.
- «vacio»: núcleo NEGRO (no se tiñe), anillo brillante a su alrededor, halo y corrientes; tintado de morado queda el
  orbe de la técnica púrpura."""
import math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from geo import Geo, anim, save_anims, tex_path, sphere_panels

rnd = random.Random(4)


def radial(size, inner, outer, a_center, a_edge, power=1.6):
    yy, xx = np.mgrid[0:size, 0:size]
    r = np.hypot(xx - (size - 1) / 2, yy - (size - 1) / 2) / (size / 2)
    t = np.clip(r, 0, 1) ** power
    a = (a_center * (1 - t) + a_edge * t) * (r <= 1)
    col = np.zeros((size, size, 4))
    for i in range(3):
        col[..., i] = inner[i] * (1 - t) + outer[i] * t
    col[..., 3] = a
    return Image.fromarray(np.clip(col, 0, 255).astype('uint8'), 'RGBA')


def streak(w, h, seed):
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = random.Random(seed)
    for k in range(4):
        pts = [(x, h / 2 + math.sin(x * 0.18 + k * 1.7) * h * 0.3 + r.uniform(-2, 2)) for x in range(0, w + 1, 3)]
        d.line(pts, fill=(255, 255, 255, 200 - k * 35), width=2 if k < 2 else 1)
    return im.filter(ImageFilter.GaussianBlur(0.8))


def atlas(core_rgb, dark=False):
    img = Image.new('RGBA', (128, 64), (0, 0, 0, 0))
    img.paste(radial(32, (255, 255, 255), (255, 255, 255), 255, 110, 1.4), (0, 0))       # panel del cuerpo (se funde)
    img.paste(radial(32, (255, 255, 255), (255, 255, 255), 140, 0, 0.9), (32, 0))       # halo
    img.paste(radial(32, core_rgb, core_rgb, 255, 255 if dark else 160, 3), (64, 0))   # núcleo
    img.paste(streak(64, 16, 1), (0, 32))                                              # corrientes
    img.paste(radial(16, (255, 255, 255), (255, 255, 255), 255, 0, 0.8), (64, 32))      # chispa
    ring = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse([2, 2, 29, 29], outline=(255, 255, 255, 255), width=3)
    img.paste(ring.filter(ImageFilter.GaussianBlur(1)), (96, 0))                       # anillo
    return img


BODY, HALO, CORE, STREAK, SPARK, RING = (0, 0, 32, 32), (32, 0, 32, 32), (64, 0, 32, 32), (0, 32, 64, 16), (64, 32, 16, 16), (96, 0, 32, 32)


def build(name, dark):
    atlas((10, 0, 14) if dark else (255, 255, 255), dark).save(tex_path(name))
    g = Geo(name, 128, 64, bounds=(4, 4, 0))
    g.bone('root')
    if dark:
        g.bone('nucleo', 'root')
        sphere_panels(g, 'nucleo', 'n', 9.0, 130, 2.8, CORE, thick=1.0)
        g.cube(g.bones[-1], (-5, -5, -5), (10, 10, 10), CORE) if False else None
    else:
        g.bone('nucleo', 'root')
        sphere_panels(g, 'nucleo', 'n', 9.5, 110, 3.8, CORE, thick=0.6)
    g.bone('cuerpo', 'root')
    sphere_panels(g, 'cuerpo', 'b', 14.5 if not dark else 12.5, 200, 6.5, BODY, thick=0.05)
    g.bone('halo', 'root')
    sphere_panels(g, 'halo', 'h', 17.0, 160, 8.0, HALO, thick=0.05)
    for k, rot in enumerate([(0, 0, 0), (62, 0, 28), (-55, 0, -38)]):
        b = g.bone(f'corriente{k}', 'root', rotation=rot)
        for j in range(20):
            L = 2 * math.pi * 15.5 / 20 * 1.1
            g.cube(b, (-L / 2, -2, 15.5), (L, 4, 0.05), STREAK, rotation=(0, j * 18, 0), pivot=(0, 0, 0), faces=('north', 'south'))
    if dark:
        for k, rot in enumerate([(90, 0, 0), (90, 0, 60), (90, 0, -60)]):
            b = g.bone(f'anillo{k}', 'root', rotation=rot)
            g.cube(b, (-11, -0.05, -11), (22, 0.1, 22), RING, faces=('up', 'down'))
    sp = g.bone('chispas', 'root')
    for k in range(14):
        a = math.radians(k * 137.5)
        el = math.radians(rnd.uniform(-60, 60))
        r = 18 + rnd.uniform(0, 5)
        x, y, z = math.cos(a) * math.cos(el) * r, math.sin(el) * r, math.sin(a) * math.cos(el) * r
        g.cube(sp, (x - 0.6, y - 0.6, z - 0.6), (1.2, 1.2, 1.2), SPARK)
    g.save()
    bones = {
        'cuerpo': {'rotation': {0: [0, 0, 0], 2.0: [0, 360, 0]}, 'scale': {0: [1, 1, 1], 0.25: [1.04, 1.04, 1.04], 0.5: [0.98, 0.98, 0.98], 0.75: [1.03, 1.03, 1.03], 1.0: [1, 1, 1], 1.25: [1.04, 1.04, 1.04], 1.5: [0.98, 0.98, 0.98], 1.75: [1.02, 1.02, 1.02], 2.0: [1, 1, 1]}},
        'halo': {'rotation': {0: [0, 0, 0], 2.0: [0, -180, 90]}, 'scale': {0: [1, 1, 1], 1.0: (1.08, 1.08, 1.08, 'easeInOutSine'), 2.0: (1, 1, 1, 'easeInOutSine')}},
        'corriente0': {'rotation': {0: [0, 0, 0], 2.0: [0, 720, 0]}},
        'corriente1': {'rotation': {0: [0, 0, 0], 2.0: [0, -720, 0]}},
        'corriente2': {'rotation': {0: [0, 0, 0], 2.0: [0, 540, 0]}},
        'chispas': {'rotation': {0: [0, 0, 0], 2.0: [180, 360, 0]}},
        'nucleo': {'scale': {0: [1, 1, 1], 0.5: [1.12, 1.12, 1.12], 1.0: [1, 1, 1], 1.5: [1.1, 1.1, 1.1], 2.0: [1, 1, 1]}},
    }
    if dark:
        bones['anillo0'] = {'rotation': {0: [0, 0, 0], 2.0: [0, 0, 360]}}
        bones['anillo1'] = {'rotation': {0: [0, 0, 0], 2.0: [0, 0, -360]}}
        bones['anillo2'] = {'rotation': {0: [0, 0, 0], 2.0: [0, 0, 360]}}
        bones['nucleo'] = {'scale': {0: [1, 1, 1], 1.0: [0.9, 0.9, 0.9], 2.0: [1, 1, 1]}}
    save_anims(name, {'idle': anim(2.0, True, bones)})


build('esfera', False)
build('vacio', True)
print('esferas ok')
