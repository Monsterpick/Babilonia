"""Satélite orbital del «Ataque orbital»: diseño propio inspirado en la idea del vídeo de referencia (un cañón
de raíles enorme en órbita), no una copia. Casco largo con módulos iluminados, paneles solares, motor trasero,
cañón de cuatro raíles con núcleo rojo y tres aros en la boca que giran al cargar.
Eje +Z = boca del cañón. Unidades: 1/16 de bloque (el plugin lo escala)."""
import math, random
from PIL import Image, ImageDraw, ImageFilter
from geo import Geo, anim, save_anims, tex_path

N = 'satelite'
rnd = random.Random(11)
S = 256
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d, gd = ImageDraw.Draw(img), ImageDraw.Draw(glow)


def region(x, y, w, h, base, seams=True, noise=10):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            v = rnd.randint(-noise, noise)
            img.putpixel((xx, yy), tuple(max(0, min(255, c + v)) for c in base) + (255,))
    if seams:
        for k in range(0, w, 16):
            d.line([(x + k, y), (x + k, y + h - 1)], fill=tuple(max(0, c - 22) for c in base) + (255,))
        for k in range(0, h, 16):
            d.line([(x, y + k), (x + w - 1, y + k)], fill=tuple(max(0, c - 22) for c in base) + (255,))
    return (x, y, w, h)


HULL = region(0, 0, 64, 64, (58, 60, 66))
# Greebles en el casco
for _ in range(26):
    gx, gy = rnd.randint(1, 56), rnd.randint(1, 56)
    gw, gh = rnd.randint(3, 8), rnd.randint(2, 6)
    d.rectangle([gx, gy, gx + gw, gy + gh], fill=(40, 42, 48, 255), outline=(84, 88, 96, 255))
HULL2 = region(64, 0, 64, 64, (86, 88, 94))
# Ventanas iluminadas en filas
for row in range(4):
    yy = 6 + row * 16
    for k in range(9):
        xx = 64 + 3 + k * 7
        lit = rnd.random() < 0.8
        col = (255, 235, 200, 255) if lit else (30, 32, 38, 255)
        d.rectangle([xx, yy, xx + 3, yy + 2], fill=col)
        if lit:
            gd.rectangle([xx, yy, xx + 3, yy + 2], fill=(255, 235, 200, 255))
    d.line([(64, yy + 8), (127, yy + 8)], fill=(150, 20, 30, 255))
    gd.line([(64, yy + 8), (127, yy + 8)], fill=(255, 40, 50, 255))
SOLAR = (128, 0, 64, 64)
for yy in range(64):
    for xx in range(64):
        cell = (xx % 8 == 0) or (yy % 8 == 0)
        v = rnd.randint(-6, 6)
        img.putpixel((128 + xx, yy), (150, 156, 168, 255) if cell else (18 + v, 34 + v, 78 + v * 2, 255))
RAIL = region(192, 0, 64, 64, (44, 46, 52), noise=6)
for k in (20, 44):
    d.line([(192, k), (255, k)], fill=(200, 20, 30, 255), width=2)
    gd.line([(192, k), (255, k)], fill=(255, 50, 60, 255), width=2)
RING = region(0, 64, 32, 32, (226, 228, 232), seams=False, noise=6)
d.line([(0, 79), (31, 79)], fill=(160, 164, 170, 255))
RED = (32, 64, 32, 32)
d.rectangle([32, 64, 63, 95], fill=(255, 40, 50, 255))
gd.rectangle([32, 64, 63, 95], fill=(255, 60, 70, 255))
BLACK = region(64, 64, 32, 32, (16, 16, 20), seams=False, noise=4)
TRUSS = (96, 64, 32, 32)
d.rectangle([96, 64, 127, 95], fill=(0, 0, 0, 0))
for k in range(0, 32, 8):
    d.line([(96 + k, 64), (96 + k + 8, 95)], fill=(120, 124, 132, 255), width=2)
    d.line([(96 + k + 8, 64), (96 + k, 95)], fill=(120, 124, 132, 255), width=2)
d.rectangle([96, 64, 127, 95], outline=(140, 144, 150, 255), width=2)
ENGINE = (128, 64, 32, 32)
for yy in range(32):
    for xx in range(32):
        r = math.hypot(xx - 15.5, yy - 15.5) / 16
        c = (255, int(80 + 120 * max(0, 1 - r)), int(60 + 100 * max(0, 1 - r)), 255) if r < 0.75 else (40, 40, 46, 255)
        img.putpixel((128 + xx, 64 + yy), c)
        if r < 0.75:
            glow.putpixel((128 + xx, 64 + yy), c)
img.save(tex_path(N))
glow.save(tex_path(N, '_glowmask'))

g = Geo(N, S, S, bounds=(16, 16, -8))
root = g.bone('root')
casco = g.bone('casco', 'root')
# Casco principal largo con módulos a los lados y arriba.
g.cube(casco, (-14, -11, -90), (28, 22, 130), {'north': BLACK, 'south': BLACK, '*': HULL})
g.cube(casco, (-17, -6, -80), (3, 12, 110), HULL2)
g.cube(casco, (14, -6, -80), (3, 12, 110), HULL2)
g.cube(casco, (-9, 11, -84), (18, 6, 96), HULL2)
g.cube(casco, (-6, 17, -60), (12, 4, 40), HULL)
g.cube(casco, (-10, -15, -70), (20, 4, 80), HULL)
for k in range(6):
    z = -86 + k * 20
    g.cube(casco, (-16, -13, z), (32, 26, 4), HULL)  # costillas
for k in range(14):
    x = rnd.choice((-1, 1)) * rnd.uniform(6, 15)
    z = rnd.uniform(-85, 30)
    g.cube(casco, (x - 2, 11 if rnd.random() < 0.5 else -15, z), (rnd.uniform(2, 5), 4, rnd.uniform(4, 12)), HULL)
# Antenas
g.cube(casco, (-0.5, 21, -40), (1, 24, 1), RING)
g.cube(casco, (-3, 44, -42.5), (6, 1, 6), RED)
g.cube(casco, (4, 21, -10), (1, 14, 1), RING)
# Motor trasero
motor = g.bone('motor', 'casco', pivot=(0, 0, -90))
g.cube(motor, (-12, -12, -104), (24, 24, 14), {'north': ENGINE, '*': HULL})
for k in range(8):
    a = k * 45
    g.cube(motor, (-3, 12, -102), (6, 3, 10), HULL, rotation=(0, 0, a), pivot=(0, 0, -97))
# Paneles solares (dos alas con brazo)
for side, name in ((-1, 'ala_izquierda'), (1, 'ala_derecha')):
    ala = g.bone(name, 'casco', pivot=(side * 17, 0, -40))
    x0 = 17 if side > 0 else -17 - 26
    g.cube(ala, (x0, -1, -42), (26, 2, 4), TRUSS)
    for k in range(3):
        px = (43 + k * 30) if side > 0 else (-43 - 28 - k * 30)
        g.cube(ala, (px, -0.5, -66), (28, 1, 52), {'up': SOLAR, 'down': SOLAR, '*': RING})
        g.cube(ala, (px - (2 if side > 0 else -28), -1, -42), (2, 2, 4), TRUSS)
# Cañón de raíles con núcleo rojo
canon = g.bone('canon', 'casco', pivot=(0, 0, 40))
for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
    g.cube(canon, (sx * 9 - 3, sy * 9 - 3, 40), (6, 6, 92), RAIL)
g.cube(canon, (-12, -12, 40), (24, 24, 10), HULL)
for k in range(4):
    g.cube(canon, (-13, -13, 58 + k * 18), (26, 26, 2), HULL)
nucleo = g.bone('nucleo', 'canon', pivot=(0, 0, 80))
g.cube(nucleo, (-2.5, -2.5, 46), (5, 5, 80), RED)
# Aros de la boca (forma de C) que giran
for i, z in enumerate((104, 116, 128)):
    ring = g.bone(f'anillo_{i + 1}', 'canon', pivot=(0, 0, z))
    R = 19 + i * 1.5
    segs = 12
    for k in range(segs):
        if k in (2, 8):
            continue  # huecos de la C
        a = k * 360 / segs
        w = 2 * math.pi * R / segs + 0.6
        g.cube(ring, (-w / 2, R - 2, z - 2), (w, 4, 4), RING, rotation=(0, 0, a), pivot=(0, 0, z))
        if k % 3 == 0:
            g.cube(ring, (-1, R - 4, z - 1), (2, 2, 2), RED, rotation=(0, 0, a), pivot=(0, 0, z))
g.save()

E_ = 'easeInOutSine'
spin = lambda bone, turns, length, sign=1: {bone: {'rotation': {0: [0, 0, 0], length: [0, 0, sign * 360 * turns]}}}
idle = {}
for i in range(3):
    idle.update(spin(f'anillo_{i + 1}', 1, 8.0, 1 if i % 2 == 0 else -1))
idle['ala_izquierda'] = {'rotation': {0: [0, 0, 0], 4.0: (0, 0, 3, E_), 8.0: (0, 0, 0, E_)}}
idle['ala_derecha'] = {'rotation': {0: [0, 0, 0], 4.0: (0, 0, -3, E_), 8.0: (0, 0, 0, E_)}}
cargado = {}
for i in range(3):
    cargado.update(spin(f'anillo_{i + 1}', 1, 0.5, 1 if i % 2 == 0 else -1))
cargado['nucleo'] = {'scale': {0: [1, 1, 1], 0.25: [1.5, 1.5, 1], 0.5: [1, 1, 1]}}
cargado['canon'] = {'position': {0: [0, 0, 12], 0.5: [0, 0, 12]}}
activar = {
    'canon': {'position': {0: [0, 0, 0], 1.2: (0, 0, 12, 'easeOutBack'), 2.0: [0, 0, 12]}},
    'nucleo': {'scale': {0: [0.3, 0.3, 1], 2.0: (1, 1, 1, 'easeInQuad')}},
    'ala_izquierda': {'rotation': {0: [0, 0, 0], 1.0: (0, 0, 12, E_), 2.0: (0, 0, 8, E_)}},
    'ala_derecha': {'rotation': {0: [0, 0, 0], 1.0: (0, 0, -12, E_), 2.0: (0, 0, -8, E_)}},
}
for i in range(3):
    activar[f'anillo_{i + 1}'] = {'rotation': {0: [0, 0, 0], 2.0: (0, 0, (1 if i % 2 == 0 else -1) * 720, 'easeInQuad')}}
disparo = {
    'canon': {'position': {0: [0, 0, 12], 0.08: [0, 0, -6], 0.6: (0, 0, 12, 'easeOutQuad')}},
    'casco': {'position': {0: [0, 0, 0], 0.08: [0, 0, -4], 0.6: (0, 0, 0, 'easeOutQuad')}},
    'nucleo': {'scale': {0: [2, 2, 1], 0.6: [1, 1, 1]}},
}
save_anims(N, {
    'idle': anim(8.0, True, idle),
    'activar': anim(2.0, None, activar),
    'cargado': anim(0.5, True, cargado),
    'disparo': anim(0.6, None, disparo),
})
print('satelite ok')
