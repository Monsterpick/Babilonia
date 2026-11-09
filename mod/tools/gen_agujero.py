"""Agujero negro: esfera negra, disco de acreción incandescente (dos planos girando), anillo de fotones y chorros."""
import math
import numpy as np
from PIL import Image
from geo import Geo, anim, save_anims, tex_path, sphere_panels

N = 'agujero_negro'
S = 256
yy, xx = np.mgrid[0:128, 0:128]
r = np.hypot(xx - 63.5, yy - 63.5) / 64
ang = np.arctan2(yy - 63.5, xx - 63.5)


def disk(r_in, r_out, hot):
    t = np.clip((r - r_in) / (r_out - r_in), 0, 1)
    streak = 0.65 + 0.35 * np.sin(ang * 9 + r * 28) * np.sin(ang * 3 - r * 11)
    inside = (r >= r_in) & (r <= r_out)
    col = np.zeros((128, 128, 4))
    # blanco-amarillo dentro → naranja → rojo oscuro fuera
    col[..., 0] = 255 * (1 - 0.15 * t)
    col[..., 1] = (240 - 190 * t) * streak
    col[..., 2] = (200 - 200 * t) * streak * hot
    a = (1 - t) ** 0.7 * 255 * streak
    a *= np.clip((r - r_in) / 0.04, 0, 1)
    col[..., 3] = np.where(inside, a, 0)
    return Image.fromarray(np.clip(col, 0, 255).astype('uint8'), 'RGBA')


img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
img.paste(disk(0.27, 1.0, 1.0), (0, 0))        # disco ancho
img.paste(disk(0.25, 0.42, 1.0), (128, 0))     # anillo de fotones
img.paste(Image.new('RGBA', (32, 32), (0, 0, 0, 255)), (0, 128))  # horizonte
# chorros: degradado azul-blanco vertical
jet = np.zeros((64, 16, 4))
for y in range(64):
    f = y / 63
    jet[y, :, 0] = 200 - 80 * f
    jet[y, :, 1] = 230 - 60 * f
    jet[y, :, 2] = 255
    jet[y, :, 3] = 200 * (1 - f) ** 1.5
xs = np.abs(np.arange(16) - 7.5) / 8
jet[..., 3] *= (1 - xs ** 2)[None, :]
img.paste(Image.fromarray(jet.astype('uint8'), 'RGBA'), (32, 128))
img.save(tex_path(N))

DISK, RING, BLACK, JET = (0, 0, 128, 128), (128, 0, 128, 128), (0, 128, 32, 32), (32, 128, 16, 64)
UPDN = ('up', 'down')
g = Geo(N, S, S, bounds=(6, 6, 0))
g.bone('root')
core = g.bone('horizonte', 'root')
sphere_panels(g, 'horizonte', 'h', 7.0, 110, 2.6, BLACK, thick=0.8)
g.cube(core, (-5, -5, -5), (10, 10, 10), BLACK)
tilt = g.bone('inclinacion', 'root', rotation=(14, 0, 8))
d1 = g.bone('disco', 'inclinacion')
g.cube(d1, (-34, -0.05, -34), (68, 0.1, 68), DISK, faces=UPDN)
d2 = g.bone('disco2', 'inclinacion')
g.cube(d2, (-28, 0.3, -28), (56, 0.1, 56), DISK, faces=UPDN)
ph = g.bone('fotones', 'root', rotation=(90, 0, 0))
g.cube(ph, (-16, -0.05, -16), (32, 0.1, 32), RING, faces=UPDN)
ph2 = g.bone('fotones2', 'root', rotation=(90, 90, 0))
g.cube(ph2, (-16, -0.05, -16), (32, 0.1, 32), RING, faces=UPDN)
jets = g.bone('chorros', 'root')
for sy in (1, -1):
    for k in range(3):
        a = k * 60
        jb = g.bone(f'chorro{sy}_{k}', 'chorros', rotation=(0 if sy > 0 else 180, a, 0))
        g.cube(jb, (-2, 6, 0), (4, 40, 0.05), JET, faces=('north', 'south'))
g.save()

save_anims(N, {
    'aparicion': anim(1.5, False, {
        'root': {'scale': {0: [0.01, 0.01, 0.01], 1.5: (1, 1, 1, 'easeOutCubic')}},
        'disco': {'rotation': {0: [0, 0, 0], 1.5: [0, 540, 0]}},
        'disco2': {'rotation': {0: [0, 0, 0], 1.5: [0, 720, 0]}},
        'chorros': {'scale': {0: [1, 0.01, 1], 1.0: [1, 0.01, 1], 1.5: (1, 1, 1, 'easeOutQuad')}},
    }),
    'idle': anim(2.0, True, {
        'disco': {'rotation': {0: [0, 0, 0], 2.0: [0, 360, 0]}},
        'disco2': {'rotation': {0: [0, 0, 0], 2.0: [0, 540, 0]}},
        'fotones': {'rotation': {0: [0, 0, 0], 2.0: [0, 0, 360]}},
        'chorros': {'rotation': {0: [0, 0, 0], 2.0: [0, 360, 0]}, 'scale': {0: [1, 1, 1], 1.0: (1, 1.15, 1, 'easeInOutSine'), 2.0: (1, 1, 1, 'easeInOutSine')}},
    }),
    'colapso': anim(1.0, None, {
        'root': {'scale': {0: [1, 1, 1], 0.6: [1.25, 0.6, 1.25], 1.0: (0.01, 0.01, 0.01, 'easeInExpo')}},
        'disco': {'rotation': {0: [0, 0, 0], 1.0: [0, 1080, 0]}},
    }),
})
print('agujero ok')
