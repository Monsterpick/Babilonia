"""Círculo arcano: varios anillos rúnicos planos que giran en sentidos opuestos + runas en órbita (emisivo)."""
import math, random
from PIL import Image, ImageDraw, ImageFilter
from geo import Geo, anim, save_anims, tex_path

N = 'circulo_arcano'
rnd = random.Random(7)
S = 512
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))

GOLD = (255, 214, 90)
WHITE = (255, 250, 225)
VIOLET = (190, 120, 255)


def glow(layer, radius=3, boost=1.0):
    g = layer.filter(ImageFilter.GaussianBlur(radius))
    out = Image.alpha_composite(g, layer)
    return out


def rune(d, cx, cy, s, col, w=2):
    """Glifo propio: trazos rectos y arcos aleatorios dentro de una caja."""
    pts = [(cx + rnd.uniform(-s, s), cy + rnd.uniform(-s, s)) for _ in range(rnd.randint(3, 5))]
    d.line(pts, fill=col, width=w)
    if rnd.random() < 0.6:
        r = s * rnd.uniform(0.3, 0.7)
        d.arc([cx - r, cy - r, cx + r, cy + r], rnd.randint(0, 360), rnd.randint(0, 360), fill=col, width=w)
    if rnd.random() < 0.5:
        d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=col)


def tile(size, draw_fn, blur=3):
    t = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(t), size)
    return glow(t, blur)


def outer(d, s):
    c = s / 2
    for r, w in ((c - 3, 3), (c - 12, 2), (c - 40, 3), (c - 46, 1)):
        d.ellipse([c - r, c - r, c + r, c + r], outline=GOLD + (255,), width=w)
    # marcas
    for k in range(72):
        a = math.radians(k * 5)
        r0, r1 = c - 12, c - (18 if k % 3 else 24)
        d.line([(c + math.cos(a) * r0, c + math.sin(a) * r0), (c + math.cos(a) * r1, c + math.sin(a) * r1)], fill=WHITE + (230,), width=2)
    # runas en la banda
    for k in range(24):
        a = math.radians(k * 15 + 7)
        rr = c - 31
        rune(d, c + math.cos(a) * rr, c + math.sin(a) * rr, 6, WHITE + (255,), 2)
    # relleno muy suave
    d.ellipse([c - (c - 46), c - (c - 46), c + (c - 46), c + (c - 46)], fill=GOLD + (14,))


def middle(d, s):
    c = s / 2
    R = c - 8
    d.ellipse([c - R, c - R, c + R, c + R], outline=VIOLET + (255,), width=3)
    for off in (0, 30):
        pts = [(c + math.cos(math.radians(off + 60 * k - 90)) * R, c + math.sin(math.radians(off + 60 * k - 90)) * R) for k in range(6)]
        d.polygon([pts[0], pts[2], pts[4]], outline=GOLD + (255,), width=3)
        d.polygon([pts[1], pts[3], pts[5]], outline=GOLD + (255,), width=3)
    r2 = R * 0.5
    d.ellipse([c - r2, c - r2, c + r2, c + r2], outline=WHITE + (255,), width=2)
    for k in range(12):
        a = math.radians(k * 30)
        rune(d, c + math.cos(a) * R * 0.72, c + math.sin(a) * R * 0.72, 7, VIOLET + (255,), 2)


def inner(d, s):
    c = s / 2
    for k in range(4):
        r = c - 6 - k * 12
        d.ellipse([c - r, c - r, c + r, c + r], outline=(WHITE if k % 2 else GOLD) + (255,), width=2)
    for k in range(8):
        a = math.radians(k * 45)
        d.line([(c, c), (c + math.cos(a) * (c - 6), c + math.sin(a) * (c - 6))], fill=GOLD + (200,), width=2)
    d.ellipse([c - 10, c - 10, c + 10, c + 10], fill=WHITE + (255,))


img.alpha_composite(tile(256, outer), (0, 0))
img.alpha_composite(tile(256, middle), (256, 0))
img.alpha_composite(tile(128, inner), (0, 256))
for k in range(8):
    t = tile(64, lambda d, s: (d.ellipse([4, 4, 60, 60], outline=GOLD + (255,), width=2), rune(d, 32, 32, 16, WHITE + (255,), 3)))
    img.alpha_composite(t, (128 + (k % 6) * 64, 256 + (k // 6) * 64))
# brillo central (para el pilar/foco)
core = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
ImageDraw.Draw(core).ellipse([20, 20, 108, 108], fill=WHITE + (200,))
img.alpha_composite(core.filter(ImageFilter.GaussianBlur(14)), (0, 384))
img.save(tex_path(N))

OUT, MID, IN = (0, 0, 256, 256), (256, 0, 256, 256), (0, 256, 128, 128)
CORE = (0, 384, 128, 128)
RUNES = [(128 + (k % 6) * 64, 256 + (k // 6) * 64, 64, 64) for k in range(8)]
UPDN = ('up', 'down')

g = Geo(N, S, S, bounds=(6, 3, 0))
g.bone('root')
ext = g.bone('exterior', 'root')
g.cube(ext, (-32, 0, -32), (64, 0.02, 64), OUT, faces=UPDN)
mid = g.bone('medio', 'root', pivot=(0, 0, 0))
g.cube(mid, (-22, 0.6, -22), (44, 0.02, 44), MID, faces=UPDN)
inn = g.bone('interior', 'root')
g.cube(inn, (-11, 1.2, -11), (22, 0.02, 22), IN, faces=UPDN)
g.cube(inn, (-8, 1.4, -8), (16, 0.02, 16), CORE, faces=UPDN)
orb = g.bone('orbitas', 'root')
for k in range(8):
    a = k * 45
    b = g.bone(f'runa{k}', 'orbitas', rotation=(0, a, 0))
    # runa vertical mirando hacia fuera, flotando sobre el borde
    g.cube(b, (-3, 3, 27), (6, 6, 0.02), RUNES[k], faces=('north', 'south'))
g.save()

save_anims(N, {
    'aparicion': anim(1.2, None, {
        'root': {'scale': {0: [0.01, 1, 0.01], 0.8: (1.08, 1, 1.08, 'easeOutQuad'), 1.2: (1, 1, 1, 'easeInOutSine')}},
        'exterior': {'rotation': {0: [0, -180, 0], 1.2: (0, 0, 0, 'easeOutCubic')}},
        'medio': {'rotation': {0: [0, 180, 0], 1.2: (0, 0, 0, 'easeOutCubic')}},
        'orbitas': {'scale': {0: [0.01, 0.01, 0.01], 0.8: [0.01, 0.01, 0.01], 1.2: (1, 1, 1, 'easeOutBack')}},
    }),
    'idle': anim(12.0, True, {
        'exterior': {'rotation': {0: [0, 0, 0], 12.0: [0, 360, 0]}},
        'medio': {'rotation': {0: [0, 0, 0], 12.0: [0, -720, 0]}},
        'interior': {'rotation': {0: [0, 0, 0], 12.0: [0, 1440, 0]}},
        'orbitas': {'rotation': {0: [0, 0, 0], 12.0: [0, -360, 0]}, 'position': {0: [0, 0, 0], 3: (0, 1.5, 0, 'easeInOutSine'), 6: (0, 0, 0, 'easeInOutSine'), 9: (0, 1.5, 0, 'easeInOutSine'), 12: (0, 0, 0, 'easeInOutSine')}},
    }),
    'disparo': anim(0.4, False, {
        'root': {'scale': {0: [1, 1, 1], 0.1: [1.12, 1, 1.12], 0.4: (1, 1, 1, 'easeOutQuad')}},
    }),
    'desaparecer': anim(1.0, None, {
        'root': {'scale': {0: [1, 1, 1], 0.3: [1.15, 1, 1.15], 1.0: (0.01, 1, 0.01, 'easeInBack')}},
        'exterior': {'rotation': {0: [0, 0, 0], 1.0: [0, 270, 0]}},
    }),
})
print('circulo ok')
