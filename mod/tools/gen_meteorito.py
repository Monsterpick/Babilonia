"""Meteorito: roca irregular de basalto con grietas de lava brillantes (glowmask) y corteza incandescente."""
import math, random
import numpy as np
from PIL import Image, ImageFilter
from geo import Geo, anim, save_anims, tex_path, fib_sphere
from tex import noise, colorize, cracks

N = 'meteorito'
rnd = random.Random(11)
S = 128
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
# 4 variantes de roca (32x32) con grietas + 1 lava (64,32) + 1 corteza ardiente (96,32)
for k in range(4):
    n = noise(32, 32, 100 + k)
    rock = colorize(n, [(0.0, (22, 18, 20, 255)), (0.45, (48, 40, 40, 255)), (0.7, (78, 64, 58, 255)), (1.0, (110, 92, 80, 255))])
    cr = cracks(32, 32, 200 + k, n=3 + k, color=(255, 120, 20, 255), width=1)
    rock.alpha_composite(cr)
    img.paste(rock, (k * 32, 0))
    gm = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    gm.alpha_composite(cracks(32, 32, 200 + k, n=3 + k, color=(255, 170, 60, 255), width=1))
    glow.paste(gm, (k * 32, 0))
lava = colorize(noise(32, 32, 300, base=3), [(0.0, (180, 30, 0, 255)), (0.5, (255, 110, 10, 255)), (0.8, (255, 200, 60, 255)), (1.0, (255, 250, 200, 255))])
img.paste(lava, (0, 32))
glow.paste(lava, (0, 32))
hot = colorize(noise(32, 32, 301), [(0.0, (60, 20, 10, 255)), (0.5, (150, 50, 10, 255)), (1.0, (255, 130, 30, 255))])
img.paste(hot, (32, 32))
hg = np.asarray(hot).copy()
hg[..., 3] = (np.clip((hg[..., 0].astype(int) - 120) * 2, 0, 255)).astype('uint8')
glow.paste(Image.fromarray(hg, 'RGBA'), (32, 32))
img.save(tex_path(N))
glow.save(tex_path(N, '_glowmask'))

ROCK = [(k * 32, 0, 32, 32) for k in range(4)]
LAVA, HOT = (0, 32, 32, 32), (32, 32, 32, 32)

g = Geo(N, S, S, bounds=(4, 4, 0))
g.bone('root')
core = g.bone('nucleo', 'root')
# núcleo de lava (se ve entre las rocas)
g.cube(core, (-7, -7, -7), (14, 14, 14), LAVA)
g.cube(core, (-6.5, -6.5, -6.5), (13, 13, 13), LAVA, rotation=(45, 45, 0))
# corteza: bloques de roca orientados al azar alrededor
for i, (x, y, z) in enumerate(fib_sphere(46)):
    r = 7.5 + rnd.uniform(-1.2, 1.5)
    s = rnd.uniform(5, 9)
    cx, cy, cz = x * r, y * r, z * r
    rot = (rnd.uniform(-45, 45), rnd.uniform(-45, 45), rnd.uniform(-45, 45))
    sw = HOT if (i % 9 == 0) else ROCK[i % 4]
    g.cube(core, (cx - s / 2, cy - s / 2, cz - s / 2), (s, s * rnd.uniform(0.7, 1.1), s), sw, rotation=rot, pivot=(cx, cy, cz))
# rocas sueltas que orbitan
orb = g.bone('fragmentos', 'root')
for k in range(7):
    a = k * 360 / 7
    b = g.bone(f'frag{k}', 'fragmentos', rotation=(rnd.uniform(-30, 30), a, 0))
    s = rnd.uniform(2, 3.5)
    g.cube(b, (-s / 2, -s / 2, 13), (s, s, s), ROCK[k % 4], rotation=(30, 20, 10), pivot=(0, 0, 14))
g.save()

save_anims(N, {
    'rotar': anim(3.0, True, {
        'nucleo': {'rotation': {0: [0, 0, 0], 3.0: [360, 180, 90]}},
        'fragmentos': {'rotation': {0: [0, 0, 0], 3.0: [0, -360, 0]}},
    }),
    'idle': anim(3.0, True, {
        'nucleo': {'rotation': {0: [0, 0, 0], 3.0: [360, 180, 90]}},
        'fragmentos': {'rotation': {0: [0, 0, 0], 3.0: [0, -360, 0]}},
    }),
})
print('meteorito ok')
