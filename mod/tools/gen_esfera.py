"""Esfera de energía: capas esféricas translúcidas que brillan, bandas que giran y núcleo blanco (radio 1 bloque)."""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from geo import Geo, anim, save_anims, tex_path, fib_sphere, dir_to_angles

N = 'esfera'
img = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
# panel de superficie (0,0,32,32): brillo suave con borde más claro
yy, xx = np.mgrid[0:32, 0:32]
r = np.hypot(xx - 15.5, yy - 15.5) / 16
pan = np.zeros((32, 32, 4))
pan[..., 0] = 170 + 60 * r
pan[..., 1] = 225 + 25 * r
pan[..., 2] = 255
pan[..., 3] = np.clip(70 + 90 * r, 0, 255)
img.paste(Image.fromarray(pan.astype('uint8'), 'RGBA'), (0, 0))
# banda (32,0,32,32): rayas eléctricas
band = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
d = ImageDraw.Draw(band)
for k in range(3):
    pts = [(x, 16 + 8 * math.sin(x * 0.4 + k * 2) + (k - 1) * 4) for x in range(0, 33, 2)]
    d.line(pts, fill=(235, 250, 255, 255), width=2)
img.paste(band.filter(ImageFilter.GaussianBlur(0.6)), (32, 0))
# núcleo (0,32,32,32): blanco intenso
core = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
ImageDraw.Draw(core).ellipse([2, 2, 30, 30], fill=(255, 255, 255, 230))
img.paste(core.filter(ImageFilter.GaussianBlur(3)), (0, 32))
img.save(tex_path(N))

PAN, BAND, CORE = (0, 0, 32, 32), (32, 0, 32, 32), (0, 32, 32, 32)
g = Geo(N, 64, 64, bounds=(3, 3, 0))
g.bone('root')
for layer, (R, n, W) in enumerate([(16, 150, 4.6), (12.5, 90, 4.4)]):
    lb = g.bone(f'capa{layer}', 'root')
    for i, dvec in enumerate(fib_sphere(n)):
        yaw, pitch = dir_to_angles(dvec)
        by = g.bone(f'c{layer}_{i}y', f'capa{layer}', rotation=(0, yaw, 0))
        bp = g.bone(f'c{layer}_{i}', f'c{layer}_{i}y', rotation=(pitch, 0, 0))
        g.cube(bp, (-W / 2, R, -W / 2), (W, 0.1, W), PAN)
for k, rot in enumerate([(0, 0, 0), (60, 0, 30), (-50, 0, -40)]):
    bb = g.bone(f'banda{k}', 'root', rotation=rot)
    for j in range(24):
        a = j * 15
        L = 2 * math.pi * 17 / 24 * 1.05
        g.cube(bb, (-L / 2, -1.5, 16.8), (L, 3, 0.05), BAND, rotation=(0, a, 0), pivot=(0, 0, 0), faces=('north', 'south'))
cb = g.bone('nucleo', 'root')
for rot in [(0, 0, 0), (45, 0, 0), (0, 45, 0), (0, 0, 45)]:
    g.cube(cb, (-6, -6, -6), (12, 12, 12), CORE, rotation=rot, pivot=(0, 0, 0))
g.save()
save_anims(N, {
    'idle': anim(2.0, True, {
        'capa0': {'rotation': {0: [0, 0, 0], 2.0: [0, 180, 0]}},
        'capa1': {'rotation': {0: [0, 0, 0], 2.0: [0, -270, 90]}},
        'banda0': {'rotation': {0: [0, 0, 0], 2.0: [0, 360, 0]}},
        'banda1': {'rotation': {0: [0, 0, 0], 2.0: [0, -360, 0]}},
        'banda2': {'rotation': {0: [0, 0, 0], 2.0: [0, 360, 0]}},
        'nucleo': {'scale': {0: [1, 1, 1], 0.5: [1.15, 1.15, 1.15], 1.0: [1, 1, 1], 1.5: [1.12, 1.12, 1.12], 2.0: [1, 1, 1]}},
    }),
})
print('esfera ok')
