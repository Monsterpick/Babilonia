"""Satélite orbital del «Ataque orbital»: diseño propio inspirado en la idea del vídeo de referencia (un cañón
de raíles enorme en órbita), no una copia. Casco largo con módulos iluminados, paneles solares, motor trasero,
cañón de cuatro raíles con núcleo rojo y tres aros en la boca que giran al cargar.
Eje +Z = boca del cañón. Unidades: 1/16 de bloque (el plugin lo escala)."""
import math, random
from PIL import Image, ImageDraw, ImageFilter
from geo import Geo, anim, save_anims, tex_path

N = 'satelite'
rnd = random.Random(11)
S = 512
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d, gd = ImageDraw.Draw(img), ImageDraw.Draw(glow)


def plating(x, y, w, h, base, panel=32, noise=6):
    """Placas metálicas de tonos variados con juntas, remaches y desgaste."""
    for py in range(y, y + h, panel // 2):
        for px in range(x, x + w, panel):
            tone = rnd.randint(-14, 10)
            col = tuple(max(0, min(255, c + tone)) for c in base) + (255,)
            d.rectangle([px, py, min(x + w, px + panel) - 1, min(y + h, py + panel // 2) - 1], fill=col)
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            r, g, b, _ = img.getpixel((xx, yy))
            v = rnd.randint(-noise, noise)
            img.putpixel((xx, yy), (max(0, min(255, r + v)), max(0, min(255, g + v)), max(0, min(255, b + v)), 255))
    dark = tuple(max(0, c - 34) for c in base) + (255,)
    light = tuple(min(255, c + 26) for c in base) + (255,)
    for py in range(y, y + h, panel // 2):
        d.line([(x, py), (x + w - 1, py)], fill=dark)
        d.line([(x, py + 1), (x + w - 1, py + 1)], fill=light)
        for px in range(x + (panel // 2 if (py // (panel // 2)) % 2 else 0), x + w, panel):
            d.line([(px, py), (px, py + panel // 2 - 1)], fill=dark)
    for py in range(y + 3, y + h, panel // 2):
        for px in range(x + 3, x + w, 8):
            img.putpixel((px, py), light)
    return (x, y, w, h)


def stripes(x, y, w, h):
    for k in range(-h, w, 8):
        d.polygon([(x + k, y + h), (x + k + 4, y + h), (x + k + 4 + h, y), (x + k + h, y)], fill=(235, 180, 30, 255))
    d.rectangle([x, y, x + w - 1, y + h - 1], outline=(40, 34, 20, 255))


# Casco: placas grises con franjas de aviso, rejillas y la matrícula «LA-1».
HULL = plating(0, 0, 128, 128, (70, 73, 80))
for _ in range(10):
    gx, gy = rnd.randint(4, 100), rnd.randint(4, 110)
    d.rectangle([gx, gy, gx + rnd.randint(8, 22), gy + rnd.randint(4, 12)], fill=(36, 38, 44, 255), outline=(110, 114, 122, 255))
for k in range(6):
    d.line([(10, 96 + k * 3), (50, 96 + k * 3)], fill=(30, 32, 36, 255))  # rejilla
stripes(60, 100, 60, 10)
d.text((70, 20), 'LA-1', fill=(225, 228, 232, 255))
d.text((71, 21), 'LA-1', fill=(225, 228, 232, 255))
# Módulos con ventanas iluminadas.
HULL2 = plating(128, 0, 128, 128, (104, 107, 114), panel=24)
for row in range(6):
    yy = 8 + row * 20
    for k in range(14):
        xx = 128 + 4 + k * 9
        lit = rnd.random() < 0.78
        col = (255, 236, 196, 255) if lit else (28, 30, 36, 255)
        d.rectangle([xx, yy, xx + 5, yy + 3], fill=col)
        if lit:
            gd.rectangle([xx, yy, xx + 5, yy + 3], fill=(255, 236, 196, 255))
    d.line([(128, yy + 11), (255, yy + 11)], fill=(170, 18, 28, 255), width=2)
    gd.line([(128, yy + 11), (255, yy + 11)], fill=(255, 40, 50, 255), width=2)
# Paneles solares: celdas azules con degradado y marco plateado.
SOLAR = (256, 0, 128, 128)
for yy in range(128):
    for xx in range(128):
        cx, cy = xx % 16, yy % 16
        frame = cx == 0 or cy == 0
        grad = int(30 * (1 - yy / 128))
        v = rnd.randint(-5, 5)
        if frame:
            img.putpixel((256 + xx, yy), (176, 182, 194, 255))
        else:
            sheen = 22 if (cx + cy) % 15 == 7 else 0
            img.putpixel((256 + xx, yy), (14 + v + sheen, 30 + v + grad // 2 + sheen, 92 + grad + v * 2 + sheen, 255))
# Raíles del cañón con conductos rojos.
RAIL = plating(384, 0, 128, 128, (52, 54, 60), panel=16, noise=4)
for k in (34, 92):
    d.line([(384, k), (511, k)], fill=(210, 20, 30, 255), width=3)
    gd.line([(384, k), (511, k)], fill=(255, 50, 60, 255), width=3)
RING = plating(0, 128, 64, 64, (222, 224, 230), panel=16, noise=4)
stripes(0, 180, 64, 8)
RED = (64, 128, 64, 64)
d.rectangle([64, 128, 127, 191], fill=(255, 40, 50, 255))
gd.rectangle([64, 128, 127, 191], fill=(255, 60, 70, 255))
BLACK = plating(128, 128, 64, 64, (20, 20, 24), panel=16, noise=3)
TRUSS = (192, 128, 64, 64)
for k in range(0, 64, 16):
    d.line([(192 + k, 128), (192 + k + 16, 191)], fill=(140, 144, 152, 255), width=3)
    d.line([(192 + k + 16, 128), (192 + k, 191)], fill=(140, 144, 152, 255), width=3)
d.rectangle([192, 128, 255, 191], outline=(160, 164, 170, 255), width=3)
ENGINE = (256, 128, 64, 64)
for yy in range(64):
    for xx in range(64):
        r = math.hypot(xx - 31.5, yy - 31.5) / 32
        if r < 0.78:
            k = max(0, 1 - r / 0.78)
            c = (255, int(90 + 140 * k), int(70 + 150 * k * k), 255)
            img.putpixel((256 + xx, 128 + yy), c)
            glow.putpixel((256 + xx, 128 + yy), c)
        else:
            img.putpixel((256 + xx, 128 + yy), (46, 46, 52, 255))
RADIATOR = (320, 128, 64, 64)
for yy in range(64):
    for xx in range(64):
        img.putpixel((320 + xx, 128 + yy), (232, 234, 238, 255) if xx % 6 else (170, 174, 182, 255))
DISH = (384, 128, 64, 64)
for yy in range(64):
    for xx in range(64):
        r = math.hypot(xx - 31.5, yy - 31.5) / 32
        img.putpixel((384 + xx, 128 + yy), (int(200 + 40 * (1 - r)), int(204 + 40 * (1 - r)), int(212 + 30 * (1 - r)), 255) if r < 1 else (180, 184, 190, 255))
img.save(tex_path(N))
glow.save(tex_path(N, '_glowmask'))

g = Geo(N, S, S, bounds=(16, 16, -8))  # textura de 512 px
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
# Antena parabólica (discos escalonados) sobre un mástil.
antena = g.bone('antena', 'casco', pivot=(0, 17, -70))
g.cube(antena, (-1.5, 17, -71.5), (3, 10, 3), RING)
for k, (rr, hh) in enumerate(((13, 1.2), (10, 1.2), (6, 1.2), (2, 4))):
    g.cube(antena, (-rr, 27 + k * 1.1, -70 - rr), (rr * 2, hh, rr * 2), DISH, rotation=(18, 0, 0), pivot=(0, 27, -70))
# Radiadores blancos a los lados del motor.
for side in (-1, 1):
    rad = g.bone(f'radiador_{"izq" if side < 0 else "der"}', 'casco', pivot=(side * 14, 0, -84))
    x0 = 14 if side > 0 else -14 - 22
    g.cube(rad, (x0, -0.4, -96), (22, 0.8, 18), RADIATOR)
    g.cube(rad, (x0 + (0 if side > 0 else 20), -1, -88), (2, 2, 3), TRUSS)
# Módulos cilíndricos (prismas de 8 caras) debajo del casco.
for z0 in (-60, -22):
    for k in range(8):
        g.cube(casco, (-4, -24, z0), (8, 3.3, 26), HULL2, rotation=(0, 0, k * 45), pivot=(0, -19, z0 + 13))
# Propulsores de maniobra en las esquinas.
for sx in (-1, 1):
    for sz in (-80, 20):
        g.cube(casco, (sx * 15 - 2, 8, sz), (4, 4, 6), BLACK)
        g.cube(casco, (sx * 15 - 1.5, 8.5, sz - 0.5), (3, 3, 0.6), ENGINE)
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
    cargado.update(spin(f'anillo_{i + 1}', 2, 0.5, 1 if i % 2 == 0 else -1))
cargado['nucleo'] = {'scale': {0: [1.6, 1.6, 1], 0.25: [2.2, 2.2, 1], 0.5: [1.6, 1.6, 1]}}
# el cañón entero gira como una ametralladora mientras está cargado
cargado['canon'] = {'position': {0: [0, 0, 12], 0.5: [0, 0, 12]}, 'rotation': {0: [0, 0, 0], 0.5: [0, 0, 180]}}
# cargando: los aros y el cañón empiezan a girar cada vez más rápido (1,5 s) y el núcleo se hincha
cargando = {
    'canon': {'position': {0: [0, 0, 12], 1.5: [0, 0, 12]}, 'rotation': {0: [0, 0, 0], 0.6: (0, 0, 60, 'easeInQuad'), 1.1: (0, 0, 220, 'linear'), 1.5: (0, 0, 360, 'linear')}},
    'nucleo': {'scale': {0: [1, 1, 1], 1.5: (1.6, 1.6, 1, 'easeInQuad')}},
}
for i in range(3):
    sg = 1 if i % 2 == 0 else -1
    cargando[f'anillo_{i + 1}'] = {'rotation': {0: [0, 0, 0], 0.6: (0, 0, sg * 180, 'easeInQuad'), 1.1: (0, 0, sg * 720, 'linear'), 1.5: (0, 0, sg * 1440, 'linear')}}
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
    'cargando': anim(1.5, None, cargando),
    'disparo': anim(0.6, None, disparo),
})
print('satelite ok')
