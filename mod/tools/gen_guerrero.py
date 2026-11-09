"""Guerrero de energía (diseño propio): artista marcial con gi verde azulado, ribetes dorados, coleta plateada
y ojos que brillan; poses para cargar, alzar los brazos y lanzar. Mira hacia -Z (norte)."""
import numpy as np
from PIL import Image, ImageDraw
from geo import Geo, anim, save_anims, tex_path
from tex import noise, colorize

N = 'guerrero'
S = 128
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))


def sw(x, y, im):
    img.paste(im, (x, y))
    return (x, y, im.size[0], im.size[1])


def shade(rgb, n=16, seed=0, k=18):
    a = noise(n, n, seed, base=4)
    arr = np.zeros((n, n, 4))
    for i in range(3):
        arr[..., i] = rgb[i] + (a - 0.5) * k
    arr[..., 3] = 255
    return Image.fromarray(np.clip(arr, 0, 255).astype('uint8'), 'RGBA')


SKIN = sw(0, 0, shade((214, 160, 120), seed=1, k=10))
HAIR = sw(16, 0, shade((215, 220, 230), seed=2, k=30))
GI = sw(32, 0, shade((30, 120, 120), seed=3, k=22))
GID = sw(48, 0, shade((22, 40, 52), seed=4, k=16))
GOLD = sw(64, 0, shade((230, 180, 60), seed=5, k=30))
SASH = sw(80, 0, shade((240, 236, 225), seed=6, k=10))
BOOT = sw(96, 0, shade((60, 40, 30), seed=7, k=12))
# cara: piel + ojos azules brillantes + cejas
face = shade((214, 160, 120), seed=8, k=8)
fd = ImageDraw.Draw(face)
fd.rectangle([3, 6, 6, 7], fill=(90, 230, 255, 255))
fd.rectangle([9, 6, 12, 7], fill=(90, 230, 255, 255))
fd.line([(2, 4), (6, 5)], fill=(60, 50, 60, 255), width=1)
fd.line([(9, 5), (13, 4)], fill=(60, 50, 60, 255), width=1)
fd.line([(6, 12), (9, 12)], fill=(150, 90, 70, 255), width=1)
FACE = sw(0, 16, face)
gm = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
gd = ImageDraw.Draw(gm)
gd.rectangle([3, 6, 6, 7], fill=(150, 245, 255, 255))
gd.rectangle([9, 6, 12, 7], fill=(150, 245, 255, 255))
glow.paste(gm, (0, 16))
# pecho del gi con cruce en V y ribete dorado
chest = shade((30, 120, 120), seed=9, k=20)
cd = ImageDraw.Draw(chest)
cd.line([(0, 0), (8, 9)], fill=(230, 180, 60, 255), width=2)
cd.line([(15, 0), (7, 9)], fill=(230, 180, 60, 255), width=2)
cd.polygon([(3, 0), (12, 0), (8, 7)], fill=(214, 160, 120, 255))
CHEST = sw(16, 16, chest)
# emblema propio en la espalda
back = shade((30, 120, 120), seed=10, k=20)
bd = ImageDraw.Draw(back)
bd.ellipse([4, 3, 11, 10], outline=(230, 180, 60, 255), width=1)
bd.line([(7.5, 4), (7.5, 9)], fill=(230, 180, 60, 255), width=1)
BACK = sw(32, 16, back)
img.save(tex_path(N))
glow.save(tex_path(N, '_glowmask'))

g = Geo(N, S, S, bounds=(3, 4, 1.5))
g.bone('root', rotation=(0, 180, 0))  # el modelo mira a -Z; girado para que mire al frente del display
body = g.bone('cuerpo', 'root', pivot=(0, 12, 0))
g.cube(body, (-4, 12, -2), (8, 12, 4), {'north': CHEST, 'south': BACK, '*': GI})
g.cube(body, (-4.3, 11, -2.3), (8.6, 2, 4.6), SASH)  # cinturón
g.cube(body, (-1, 9.5, -2.6), (2, 2.5, 0.6), SASH)    # nudo
g.cube(body, (-4.2, 21.5, -2.2), (8.4, 1, 4.4), GOLD)  # hombros
head = g.bone('cabeza', 'cuerpo', pivot=(0, 24, 0))
g.cube(head, (-4, 24, -4), (8, 8, 8), {'north': FACE, '*': SKIN})
g.cube(head, (-4.4, 30, -4.4), (8.8, 2.6, 8.8), HAIR)
g.cube(head, (-4.4, 26, 0), (8.8, 5, 4.4), HAIR)
g.cube(head, (-4.5, 27, -4.5), (1.2, 3.5, 5), HAIR)
g.cube(head, (3.3, 27, -4.5), (1.2, 3.5, 5), HAIR)
g.cube(head, (-4.4, 28.5, -4.6), (8.8, 0.8, 0.4), GOLD)  # cinta
for x, rz in ((-3, -20), (0, 0), (3, 20)):
    g.cube(head, (x - 1, 31.5, -2), (2, 3, 3), HAIR, rotation=(-25, 0, rz), pivot=(x, 31, 0))
tail = g.bone('coleta', 'cabeza', pivot=(0, 29, 4))
g.cube(tail, (-1.2, 22, 4), (2.4, 7, 2), HAIR, rotation=(18, 0, 0), pivot=(0, 29, 4.5))
g.cube(tail, (-0.9, 17, 5.5), (1.8, 6, 1.6), HAIR, rotation=(28, 0, 0), pivot=(0, 23, 5.5))
g.cube(tail, (-1.4, 28.4, 4.1), (2.8, 1.2, 2.2), GOLD)
for side, name in ((-1, 'brazo_der'), (1, 'brazo_izq')):
    px = 5 * side
    arm = g.bone(name, 'cuerpo', pivot=(px, 22, 0))
    x0 = 4 if side > 0 else -8
    g.cube(arm, (x0, 18, -2), (4, 6, 4), GI)
    g.cube(arm, (x0, 13, -2), (4, 5, 4), SKIN)
    g.cube(arm, (x0 - 0.3, 11.5, -2.3), (4.6, 3, 4.6), GOLD)  # brazalete
    g.cube(arm, (x0, 10, -2), (4, 2, 4), SKIN)
    leg = g.bone('pierna_der' if side < 0 else 'pierna_izq', 'root', pivot=(1.9 * side, 12, 0))
    lx = 0 if side > 0 else -4
    g.cube(leg, (lx - 0.1, 3, -2.1), (4.2, 9, 4.2), GID)
    g.cube(leg, (lx - 0.2, 0, -2.6), (4.4, 3.5, 5), BOOT)
manos = g.bone('manos', 'root', pivot=(0, 40, 0))
g.save()

A, B = 'brazo_der', 'brazo_izq'
save_anims(N, {
    'idle': anim(3.0, True, {
        'cuerpo': {'scale': {0: [1, 1, 1], 1.5: (1.01, 1.02, 1.01, 'easeInOutSine'), 3.0: (1, 1, 1, 'easeInOutSine')}},
        A: {'rotation': {0: [0, 0, 8], 1.5: (0, 0, 11, 'easeInOutSine'), 3.0: (0, 0, 8, 'easeInOutSine')}},
        B: {'rotation': {0: [0, 0, -8], 1.5: (0, 0, -11, 'easeInOutSine'), 3.0: (0, 0, -8, 'easeInOutSine')}},
        'coleta': {'rotation': {0: [0, 0, 0], 1.5: (6, 0, 3, 'easeInOutSine'), 3.0: (0, 0, 0, 'easeInOutSine')}},
    }),
    'aparicion': anim(1.0, False, {
        'root': {'position': {0: [0, 30, 0], 0.7: (0, 0, 0, 'easeInQuad')}, 'scale': {0.7: [1, 1, 1], 0.8: [1.08, 0.9, 1.08], 1.0: (1, 1, 1, 'easeOutQuad')}},
        'pierna_der': {'rotation': {0.7: [0, 0, 0], 0.8: [-30, 0, 0], 1.0: [0, 0, 0]}},
        'pierna_izq': {'rotation': {0.7: [0, 0, 0], 0.8: [-30, 0, 0], 1.0: [0, 0, 0]}},
    }),
    # Pose de carga: piernas abiertas, puños a la cadera, temblor.
    'cargar': anim(0.4, True, {
        'root': {'position': {0: [0, -1.5, 0], 0.1: [0.25, -1.5, 0], 0.2: [-0.25, -1.5, 0], 0.4: [0, -1.5, 0]}},
        'cuerpo': {'rotation': {0: [10, 0, 0], 0.4: [10, 0, 0]}},
        'cabeza': {'rotation': {0: [-18, 0, 0], 0.4: [-18, 0, 0]}},
        A: {'rotation': {0: [40, 0, 25], 0.4: [40, 0, 25]}},
        B: {'rotation': {0: [40, 0, -25], 0.4: [40, 0, -25]}},
        'pierna_der': {'rotation': {0: [0, 0, 18], 0.4: [0, 0, 18]}},
        'pierna_izq': {'rotation': {0: [0, 0, -18], 0.4: [0, 0, -18]}},
    }),
    # Brazos en alto sosteniendo la esfera.
    'alzar_brazos': anim(2.0, True, {
        A: {'rotation': {0: [0, 0, 160], 1.0: (0, 0, 166, 'easeInOutSine'), 2.0: (0, 0, 160, 'easeInOutSine')}},
        B: {'rotation': {0: [0, 0, -160], 1.0: (0, 0, -166, 'easeInOutSine'), 2.0: (0, 0, -160, 'easeInOutSine')}},
        'cabeza': {'rotation': {0: [-25, 0, 0], 2.0: [-25, 0, 0]}},
        'cuerpo': {'rotation': {0: [-6, 0, 0], 2.0: [-6, 0, 0]}},
        'pierna_der': {'rotation': {0: [0, 0, 12], 2.0: [0, 0, 12]}},
        'pierna_izq': {'rotation': {0: [0, 0, -12], 2.0: [0, 0, -12]}},
    }),
    # Lanzamiento: echa el cuerpo atrás y empuja los brazos hacia delante.
    'lanzar': anim(0.8, None, {
        A: {'rotation': {0: [0, 0, 160], 0.25: [-20, 0, 175], 0.45: (95, 0, 10, 'easeOutBack'), 0.8: [92, 0, 12]}},
        B: {'rotation': {0: [0, 0, -160], 0.25: [-20, 0, -175], 0.45: (95, 0, -10, 'easeOutBack'), 0.8: [92, 0, -12]}},
        'cuerpo': {'rotation': {0: [-6, 0, 0], 0.25: [-18, 0, 0], 0.45: (16, 0, 0, 'easeOutQuad'), 0.8: [14, 0, 0]}},
        'pierna_der': {'rotation': {0: [0, 0, 12], 0.45: [30, 0, 10], 0.8: [30, 0, 10]}},
        'pierna_izq': {'rotation': {0: [0, 0, -12], 0.45: [-25, 0, -10], 0.8: [-25, 0, -10]}},
    }),
})
print('guerrero ok')
