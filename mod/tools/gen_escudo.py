"""Escudo: cúpula de paneles hexagonales de energía (translúcida y emisiva) con anillo de escaneo."""
import math
from PIL import Image, ImageDraw, ImageFilter
from geo import Geo, anim, save_anims, tex_path, fib_sphere, dir_to_angles

N = 'escudo'
R = 48.0  # 3 bloques de radio (el servidor escala a su radio)

# ---- textura 64x64 casi blanca: el servidor la tiñe según la vida del escudo: hexágono (0,0), anillo (32,0), núcleo (0,32)
img = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
def hexagon(cx, cy, r):
    return [(cx + r * math.cos(math.radians(60 * k + 30)), cy + r * math.sin(math.radians(60 * k + 30))) for k in range(6)]
d.rectangle([0, 0, 31, 31], fill=(200, 230, 255, 34))
d.polygon(hexagon(16, 16, 15.5), fill=(210, 235, 255, 64))
d.polygon(hexagon(16, 16, 15.5), outline=(255, 255, 255, 255), width=2)
d.polygon(hexagon(16, 16, 10), outline=(230, 245, 255, 120), width=1)
# anillo brillante
for y in range(32):
    a = int(255 * (1 - abs(y - 15.5) / 16) ** 0.6)
    d.line([(32, y), (63, y)], fill=(255, 255, 255, a))
# núcleo suave
glow = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([2, 2, 29, 29], fill=(240, 250, 255, 120))
glow = glow.filter(ImageFilter.GaussianBlur(4))
img.paste(glow, (0, 32))
img.save(tex_path(N))

HEX, RING = (0, 0, 32, 32), (32, 0, 32, 32)

g = Geo(N, 64, 64, bounds=(8, 7, 2))
root = g.bone('root')
spin = g.bone('giro', 'root')
W = 9.4
i = 0
for dx, dy, dz in fib_sphere(380):
    if dy < -0.12:
        continue
    yaw, pitch = dir_to_angles((dx, dy, dz))
    by = g.bone(f'p{i}y', 'giro', rotation=(0, yaw, 0))
    bp = g.bone(f'p{i}', f'p{i}y', rotation=(pitch, 0, 0))
    g.cube(bp, (-W / 2, R, -W / 2), (W, 0.25, W), HEX)
    i += 1
# anillo de base y anillo de escaneo
for name, rad, thick in (('base', R * 0.995, 1.6), ('scan', R * 0.97, 1.0)):
    b = g.bone(name, 'root')
    seg = 64
    L = 2 * math.pi * rad / seg * 1.08
    for k in range(seg):
        a = 360.0 * k / seg
        g.cube(b, (-L / 2, 0, rad - 0.4), (L, thick, 0.8), RING, rotation=(0, a, 0), pivot=(0, 0, 0))
g.save()

E = 'easeOutBack'
save_anims(N, {
    'aparicion': anim(1.0, None, {
        'root': {'scale': {0: [0.01, 0.01, 0.01], 0.55: (1.12, 1.12, 1.12, 'easeOutQuad'), 1.0: (1, 1, 1, 'easeInOutSine')}},
        'giro': {'rotation': {0: [0, -120, 0], 1.0: (0, 0, 0, 'easeOutQuad')}},
        'scan': {'position': {0: [0, 0, 0], 1.0: [0, R * 0.9, 0]}},
    }),
    'idle': anim(8.0, True, {
        'giro': {'rotation': {0: [0, 0, 0], 8.0: [0, 360, 0]}},
        'scan': {'position': {0: [0, R * 0.9, 0], 4.0: (0, 2, 0, 'easeInOutSine'), 8.0: (0, R * 0.9, 0, 'easeInOutSine')}},
        'root': {'scale': {0: [1, 1, 1], 1.0: (1.015, 1.015, 1.015, 'easeInOutSine'), 2.0: (1, 1, 1, 'easeInOutSine'), 3.0: (1.015, 1.015, 1.015, 'easeInOutSine'), 4.0: (1, 1, 1, 'easeInOutSine'), 5.0: (1.015, 1.015, 1.015, 'easeInOutSine'), 6.0: (1, 1, 1, 'easeInOutSine'), 7.0: (1.015, 1.015, 1.015, 'easeInOutSine'), 8.0: (1, 1, 1, 'easeInOutSine')}},
    }),
    'impacto': anim(0.35, False, {
        'root': {'scale': {0: [1, 1, 1], 0.08: [1.06, 0.97, 1.06], 0.35: (1, 1, 1, 'easeOutElastic')}},
    }),
    'romper': anim(0.7, None, {
        'root': {'scale': {0: [1, 1, 1], 0.15: [1.25, 1.25, 1.25], 0.7: (0.01, 0.01, 0.01, 'easeInQuad')}},
        'giro': {'rotation': {0: [0, 0, 0], 0.7: [0, 140, 0]}},
    }),
    'desaparecer': anim(0.9, None, {
        'root': {'scale': {0: [1, 1, 1], 0.9: (0.01, 0.01, 0.01, 'easeInBack')}},
    }),
})
print('escudo:', i, 'paneles')
