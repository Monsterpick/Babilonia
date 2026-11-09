"""Ojo del vacío: globo ocular gigante que mira hacia abajo, iris brillante, pupila rasgada, párpados y tentáculos."""
import math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from geo import Geo, anim, save_anims, tex_path, fib_sphere, sphere_panels
from tex import noise, colorize, cracks

N = 'ojo_vacio'
rnd = random.Random(5)
S = 128
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))

# esclerótica (0,0,32,32) con venas
scl = colorize(noise(32, 32, 1), [(0, (200, 180, 215, 255)), (0.6, (225, 210, 235, 255)), (1, (245, 235, 250, 255))])
scl.alpha_composite(cracks(32, 32, 2, n=7, color=(150, 30, 90, 255)))
img.paste(scl, (0, 0))
# iris (32,0,64,64): radial
iris = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
yy, xx = np.mgrid[0:64, 0:64]
r = np.hypot(xx - 31.5, yy - 31.5) / 32
ang = np.arctan2(yy - 31.5, xx - 31.5)
streak = 0.5 + 0.5 * np.sin(ang * 23 + r * 6)
v = np.clip(1 - r, 0, 1)
col = np.zeros((64, 64, 4))
col[..., 0] = 120 + 120 * v + 30 * streak
col[..., 1] = 20 + 60 * v * streak
col[..., 2] = 180 + 75 * v
col[..., 3] = 255
ring = (r > 0.9)
col[ring] = (40, 0, 60, 255)
iris = Image.fromarray(np.clip(col, 0, 255).astype('uint8'), 'RGBA')
img.paste(iris, (32, 0))
gi = np.asarray(iris).copy()
gi[ring] = (0, 0, 0, 0)
glow.paste(Image.fromarray(gi, 'RGBA'), (32, 0))
# pupila (0,32,16,16)
img.paste(Image.new('RGBA', (16, 16), (6, 0, 10, 255)), (0, 32))
# párpado (96,0,32,32): piel escamosa oscura
lid = colorize(noise(32, 32, 9, base=8), [(0, (20, 8, 28, 255)), (0.5, (45, 20, 60, 255)), (1, (80, 40, 100, 255))])
d = ImageDraw.Draw(lid)
for y in range(0, 32, 6):
    for x in range((y // 6 % 2) * 3, 32, 6):
        d.arc([x - 3, y - 3, x + 3, y + 3], 0, 180, fill=(15, 5, 20, 255))
img.paste(lid, (96, 0))
# tentáculo (96,32,32,32)
ten = colorize(noise(32, 32, 12), [(0, (25, 5, 35, 255)), (1, (70, 20, 90, 255))])
img.paste(ten, (96, 32))
# cristal brillante (16,32,16,16)
cry = colorize(noise(16, 16, 13, base=2), [(0, (150, 60, 255, 255)), (1, (240, 200, 255, 255))])
img.paste(cry, (16, 32))
glow.paste(cry, (16, 32))
img.save(tex_path(N))
glow.save(tex_path(N, '_glowmask'))

SCL, IRIS, PUP, LID, TEN, CRY = (0, 0, 32, 32), (32, 0, 64, 64), (0, 32, 16, 16), (96, 0, 32, 32), (96, 32, 32, 32), (16, 32, 16, 16)
R = 12.0
g = Geo(N, S, S, bounds=(5, 4, -0.5))
g.bone('root')
eye = g.bone('globo', 'root')
# esfera lisa de paneles + relleno interior
sphere_panels(g, 'globo', 'e', R, 170, 3.6, SCL, thick=0.8)
g.cube(eye, (-R * 0.55, -R * 0.55, -R * 0.55), (R * 1.1, R * 1.1, R * 1.1), SCL)
# iris (mira hacia -Y): discos en varios giros
irisb = g.bone('iris', 'globo')
for k in range(4):
    s = R * 1.05
    g.cube(irisb, (-s / 2, -R - 0.15, -s / 2), (s, 0.4, s), IRIS, rotation=(0, k * 22.5, 0), pivot=(0, 0, 0), faces=('down', 'up'))
pup = g.bone('pupila', 'iris')
g.cube(pup, (-0.9, -R - 0.5, -4.5), (1.8, 0.4, 9), PUP)
g.cube(pup, (-0.5, -R - 0.55, -5.5), (1.0, 0.4, 11), PUP)
# párpados: arcos de losas tangentes (posición de reposo: abiertos)
for side, name in ((1, 'parpado_a'), (-1, 'parpado_b')):
    lb = g.bone(name, 'globo', rotation=(105 * side, 0, 0))
    for k in range(7):
        th = (k * 14 + 6) * side
        sb = g.bone(f'{name}{k}', name, rotation=(th, 0, 0))
        g.cube(sb, (-R - 1.5, -R - 2.2, -2.2), (2 * R + 3, 1.8, 4.4), LID)
    # pinchos en el borde
    eb = g.bone(f'{name}_borde', name, rotation=(1 * side, 0, 0))
    for x in range(-10, 11, 4):
        g.cube(eb, (x - 0.6, -R - 4.5, -0.6), (1.2, 2.6, 1.2), LID, rotation=(0, 45, 0), pivot=(x, -R - 3, 0))
# tentáculos que cuelgan alrededor
tent = g.bone('tentaculos', 'root')
for k in range(10):
    a = k * 36
    tb = g.bone(f'tent{k}', 'tentaculos', rotation=(0, a, 0))
    seg = g.bone(f'tent{k}s', f'tent{k}', pivot=(0, -4, R + 1))
    for j in range(5):
        w = 2.4 - j * 0.35
        g.cube(seg, (-w / 2, -6 - j * 4, R + 0.5 + j * 0.8), (w, 4.2, w), TEN)
# corona de cristales flotantes
cr = g.bone('cristales', 'root')
for k in range(12):
    a = math.radians(k * 30)
    x, z = math.cos(a) * (R + 7), math.sin(a) * (R + 7)
    g.cube(cr, (x - 1, -1 + (k % 2) * 2, z - 1), (2, 4, 2), CRY, rotation=(20, k * 30, 15), pivot=(x, 0, z))
g.save()

sway = {}
for k in range(10):
    ph = k * 0.3
    sway[f'tent{k}s'] = {'rotation': {0: [0, 0, 0], 1.0 + ph * 0.1: (12, 0, 6, 'easeInOutSine'), 2.0: (0, 0, 0, 'easeInOutSine'), 3.0 - ph * 0.1: (-10, 0, -6, 'easeInOutSine'), 4.0: (0, 0, 0, 'easeInOutSine')}}
idle = dict(sway)
idle['iris'] = {'rotation': {0: [0, 0, 0], 4.0: [0, 360, 0]}}
idle['cristales'] = {'rotation': {0: [0, 0, 0], 4.0: [0, -90, 0]}}
save_anims(N, {
    'cerrado': anim(0.1, None, {'parpado_a': {'rotation': {0: [-105, 0, 0], 0.1: [-105, 0, 0]}}, 'parpado_b': {'rotation': {0: [105, 0, 0], 0.1: [105, 0, 0]}}}),
    'abrir': anim(1.6, False, {
        'parpado_a': {'rotation': {0: [-105, 0, 0], 0.3: [-96, 0, 0], 0.5: [-100, 0, 0], 1.6: (0, 0, 0, 'easeOutBack')}},
        'parpado_b': {'rotation': {0: [105, 0, 0], 0.3: [96, 0, 0], 0.5: [100, 0, 0], 1.6: (0, 0, 0, 'easeOutBack')}},
        'globo': {'scale': {0: [0.9, 0.9, 0.9], 1.6: (1, 1, 1, 'easeOutQuad')}},
        'pupila': {'scale': {0: [1, 1, 0.3], 1.0: [1, 1, 0.3], 1.6: (1.3, 1, 1.1, 'easeOutBack')}},
    }),
    'idle': anim(4.0, True, idle),
    'latido': anim(0.8, False, {
        'globo': {'scale': {0: [1, 1, 1], 0.12: [1.15, 1.15, 1.15], 0.3: [0.97, 0.97, 0.97], 0.8: (1, 1, 1, 'easeOutElastic')}},
        'pupila': {'scale': {0: [1, 1, 1], 0.12: [2.2, 1, 0.6], 0.8: (1, 1, 1, 'easeOutQuad')}},
    }),
    'cerrar': anim(1.2, None, {
        'parpado_a': {'rotation': {0: [0, 0, 0], 1.2: (-105, 0, 0, 'easeInQuad')}},
        'parpado_b': {'rotation': {0: [0, 0, 0], 1.2: (105, 0, 0, 'easeInQuad')}},
        'globo': {'scale': {0: [1, 1, 1], 1.2: (0.9, 0.9, 0.9, 'linear')}},
    }),
})
print('ojo ok')
