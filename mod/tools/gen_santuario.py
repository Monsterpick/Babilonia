"""Santuario maldito (diseño propio): templo oscuro sobre escalinata de piedra agrietada, pilares con talismanes,
tejado doble con aleros curvados y cuernos, montones de calaveras y faroles rojos que brillan."""
import math, random
import numpy as np
from PIL import Image, ImageDraw
from geo import Geo, anim, save_anims, tex_path
from tex import noise, colorize, cracks

N = 'santuario'
rnd = random.Random(3)
S = 256
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
slots = iter([(x, y) for y in range(0, S, 32) for x in range(0, S, 32)])


def put(im, gl=None):
    x, y = next(slots)
    img.paste(im, (x, y))
    if gl is not None:
        glow.paste(gl, (x, y))
    return (x, y, im.size[0], im.size[1])


stone = colorize(noise(32, 32, 1, base=6), [(0, (18, 16, 20, 255)), (0.5, (36, 32, 38, 255)), (1, (60, 54, 62, 255))])
cr = cracks(32, 32, 2, n=5, color=(220, 20, 30, 255))
stone.alpha_composite(cr)
gcr = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
gcr.alpha_composite(cracks(32, 32, 2, n=5, color=(255, 40, 40, 255)))
STONE = put(stone, gcr)
STONE2 = put(colorize(noise(32, 32, 3, base=6), [(0, (24, 20, 26, 255)), (1, (54, 48, 56, 255))]))
wood = colorize(noise(32, 32, 4, base=3), [(0, (30, 10, 10, 255)), (0.6, (55, 20, 18, 255)), (1, (75, 30, 26, 255))])
wd = ImageDraw.Draw(wood)
for x in range(0, 32, 5):
    wd.line([(x, 0), (x + rnd.randint(-1, 1), 32)], fill=(22, 8, 8, 255))
WOOD = put(wood)
roof = Image.new('RGBA', (32, 32))
rd = ImageDraw.Draw(roof)
for y in range(0, 32, 4):
    for x in range(-(y // 4 % 2) * 2, 32, 4):
        rd.rectangle([x, y, x + 3, y + 3], fill=(110 + rnd.randint(-10, 10), 14, 22, 255), outline=(50, 6, 10, 255))
ROOF = put(roof)
bone = colorize(noise(32, 32, 5), [(0, (190, 180, 160, 255)), (1, (235, 228, 210, 255))])
BONE = put(bone)
skull = bone.copy()
sd = ImageDraw.Draw(skull)
sd.ellipse([5, 9, 13, 18], fill=(15, 5, 5, 255))
sd.ellipse([19, 9, 27, 18], fill=(15, 5, 5, 255))
sd.polygon([(16, 18), (14, 23), (18, 23)], fill=(30, 10, 10, 255))
for x in range(8, 25, 3):
    sd.rectangle([x, 25, x + 1, 29], fill=(40, 20, 20, 255))
sg = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
sgd = ImageDraw.Draw(sg)
sgd.ellipse([7, 11, 11, 16], fill=(255, 40, 30, 255))
sgd.ellipse([21, 11, 25, 16], fill=(255, 40, 30, 255))
sd.ellipse([7, 11, 11, 16], fill=(200, 20, 20, 255))
sd.ellipse([21, 11, 25, 16], fill=(200, 20, 20, 255))
SKULL = put(skull, sg)
paper = Image.new('RGBA', (32, 32), (225, 215, 180, 255))
pd = ImageDraw.Draw(paper)
for k in range(5):
    y = 4 + k * 5
    pd.line([(10 + rnd.randint(-2, 2), y), (22 + rnd.randint(-2, 2), y + rnd.randint(-1, 2))], fill=(170, 10, 15, 255), width=2)
    pd.line([(16, y - 2), (16 + rnd.randint(-3, 3), y + 3)], fill=(170, 10, 15, 255), width=1)
PAPER = put(paper)
lan = colorize(noise(32, 32, 6, base=2), [(0, (200, 30, 10, 255)), (1, (255, 140, 60, 255))])
ld = ImageDraw.Draw(lan)
for y in (3, 28):
    ld.rectangle([0, y, 31, y + 2], fill=(25, 10, 8, 255))
lg = lan.copy()
lgd = ImageDraw.Draw(lg)
for y in (3, 28):
    lgd.rectangle([0, y, 31, y + 2], fill=(0, 0, 0, 0))
LANTERN = put(lan, lg)
GOLD = put(colorize(noise(32, 32, 7), [(0, (140, 100, 30, 255)), (1, (220, 170, 60, 255))]))
DARK = put(Image.new('RGBA', (32, 32), (8, 4, 6, 255)))
inner = Image.new('RGBA', (32, 32), (60, 0, 0, 255))
ig = Image.new('RGBA', (32, 32), (120, 0, 0, 160))
INNER = put(inner, ig)
img.save(tex_path(N))
glow.save(tex_path(N, '_glowmask'))

g = Geo(N, S, S, bounds=(14, 14, 3))
g.bone('root', rotation=(0, 180, 0))  # el modelo mira a -Z; girado para que mire al frente del display
base = g.bone('escalinata', 'root')
for k, (w, h) in enumerate([(72, 4), (60, 4), (50, 4)]):
    y = k * 4
    g.cube(base, (-w / 2, y, -w / 2), (w, h, w), STONE if k % 2 == 0 else STONE2)
# escalera frontal
for k in range(6):
    g.cube(base, (-8, k * 2, -36 - 6 + k * 2), (16, 2, 4), STONE2)
temple = g.bone('templo', 'root', pivot=(0, 12, 0))
# suelo interior y paredes del fondo y laterales
g.cube(temple, (-22, 12, -22), (44, 1, 44), STONE2)
g.cube(temple, (-20, 13, 16), (40, 24, 3), WOOD)
g.cube(temple, (-20, 13, -16), (3, 24, 32), WOOD)
g.cube(temple, (17, 13, -16), (3, 24, 32), WOOD)
g.cube(temple, (-16, 14, 15.5), (32, 20, 0.6), INNER)  # fondo rojo brillante
# pilares con talismanes
for x in (-22, -8, 8, 22):
    for z in (-22, 22):
        if abs(x) == 8 and z > 0:
            continue
        g.cube(temple, (x - 2, 12, z - 2), (4, 26, 4), WOOD)
        g.cube(temple, (x - 2.5, 12, z - 2.5), (5, 2, 5), GOLD)
        g.cube(temple, (x - 2.5, 36, z - 2.5), (5, 2, 5), GOLD)
        g.cube(temple, (x - 1.2, 22 + rnd.randint(-3, 3), z - 2.15), (2.4, 6, 0.1), PAPER)
# viga frontal y tejados
g.cube(temple, (-26, 37, -26), (52, 3, 52), WOOD)
roof = g.bone('tejado', 'templo', pivot=(0, 40, 0))
for k, (w, y, h) in enumerate([(70, 40, 4), (58, 44, 4), (44, 48, 4), (40, 54, 3), (30, 57, 3), (18, 60, 3)]):
    g.cube(roof, (-w / 2, y, -w / 2), (w, h, w), ROOF)
# aleros curvados en las esquinas
for k in range(4):
    a = 45 + k * 90
    eb = g.bone(f'alero{k}', 'tejado', rotation=(0, a, 0), pivot=(0, 40, 0))
    g.cube(eb, (-3, 41, 44), (6, 3, 10), ROOF, rotation=(-25, 0, 0), pivot=(0, 41, 44))
    g.cube(eb, (-2, 45, 52), (4, 3, 6), ROOF, rotation=(-50, 0, 0), pivot=(0, 45, 52))
    g.cube(eb, (-1.5, 44, 42), (3, 3, 3), GOLD)
# cuernos sobre la cumbrera
for side in (-1, 1):
    hb = g.bone(f'cuerno{side}', 'tejado', pivot=(6 * side, 63, 0))
    for j in range(5):
        s = 4 - j * 0.6
        g.cube(hb, (6 * side + side * j * 2.2 - s / 2, 63 + j * 3.2, -s / 2), (s, 3.6, s), BONE, rotation=(0, 0, -side * (15 + j * 10)), pivot=(6 * side + side * j * 2.2, 63 + j * 3.2, 0))
g.cube(roof, (-2, 63, -2), (4, 4, 4), SKULL)
# faroles colgantes
lan = g.bone('faroles', 'templo')
for i, x in enumerate((-15, 15, -30, 30)):
    z = -24 if abs(x) < 20 else -10
    lb = g.bone(f'farol{i}', 'faroles', pivot=(x, 37, z))
    g.cube(lb, (x - 0.2, 31, z - 0.2), (0.4, 6, 0.4), DARK)
    g.cube(lb, (x - 2, 25, z - 2), (4, 6, 4), LANTERN)
# montones de calaveras alrededor
piles = g.bone('calaveras', 'root')
for k in range(26):
    a = rnd.uniform(0, 2 * math.pi)
    r = rnd.uniform(36, 46)
    x, z = math.cos(a) * r, math.sin(a) * r
    if abs(x) < 12 and z < -30:
        continue
    for j in range(rnd.randint(1, 3)):
        s = rnd.uniform(3, 4.5)
        g.cube(piles, (x - s / 2 + rnd.uniform(-2, 2), j * s * 0.8, z - s / 2 + rnd.uniform(-2, 2)), (s, s, s), {'north': SKULL, '*': BONE},
               rotation=(0, math.degrees(-a) + 90, rnd.uniform(-15, 15)), pivot=(x, 0, z))
# torii de la entrada (puerta propia: dos postes y dos travesaños)
gate = g.bone('puerta', 'root')
for x in (-14, 14):
    g.cube(gate, (x - 2, 0, -58), (4, 34, 4), WOOD)
g.cube(gate, (-22, 34, -59), (44, 4, 6), ROOF)
g.cube(gate, (-18, 27, -57.5), (36, 3, 3), WOOD)
g.cube(gate, (-3, 27, -58), (6, 7, 0.1), PAPER)
g.save()

save_anims(N, {
    'aparicion': anim(2.5, False, {
        'root': {'position': {0: [0, -70, 0], 2.0: (0, 2, 0, 'easeOutCubic'), 2.5: (0, 0, 0, 'easeInOutSine')}},
        'puerta': {'position': {0: [0, -40, 0], 1.2: [0, -40, 0], 2.5: (0, 0, 0, 'easeOutBack')}},
        'calaveras': {'scale': {0: [0.01, 0.01, 0.01], 1.5: [0.01, 0.01, 0.01], 2.5: (1, 1, 1, 'easeOutBack')}},
    }),
    'idle': anim(3.0, True, {
        **{f'farol{i}': {'rotation': {0: [0, 0, 0], 0.75 + i * 0.1: (8, 0, 5, 'easeInOutSine'), 1.5: (0, 0, 0, 'easeInOutSine'), 2.25: (-8, 0, -5, 'easeInOutSine'), 3.0: (0, 0, 0, 'easeInOutSine')}} for i in range(4)},
        'templo': {'scale': {0: [1, 1, 1], 1.5: (1.01, 1.01, 1.01, 'easeInOutSine'), 3.0: (1, 1, 1, 'easeInOutSine')}},
    }),
    'desaparecer': anim(2.0, None, {
        'root': {'position': {0: [0, 0, 0], 2.0: (0, -80, 0, 'easeInQuad')}},
    }),
})
print('santuario ok')
