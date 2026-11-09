"""Copo de la técnica de combate (según la referencia del usuario): 6 brazos principales con ramas, nodos hexagonales
con glifos, terminales circulares y 6 brazos cortos intercalados (12 nodos en total), en neón; más pilares de luz que
suben desde cada nodo. Blanco-azulado: el servidor lo tiñe (azul hielo; rojo en el golpe).
Geometría del patrón (centro C, radio R, ángulo a_k = k·60°):
  brazo principal k:  C → C + R·(cos a_k, sin a_k)          nodo hexagonal en 0.72R, terminal en 0.95R
  brazo corto k:      ángulo a_k + 30°, hasta 0.55R           nodo hexagonal en 0.42R, terminal en 0.55R
  ramas: en cada brazo principal, pares de ramitas a ±40° del brazo en 0.22R, 0.38R y 0.55R."""
import math, random
from PIL import Image, ImageDraw, ImageFilter
from geo import Geo, anim, save_anims, tex_path

N = 'copo'
S = 1024
C = S / 2
R = S / 2 - 30
rnd = random.Random(12)
NEON, CORE = (120, 215, 255, 255), (235, 250, 255, 255)
lines = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(lines)


def P(a, r):
    return (C + math.cos(a) * r, C + math.sin(a) * r)


def hexagon(cx, cy, r, w):
    pts = [(cx + math.cos(math.radians(60 * k + 30)) * r, cy + math.sin(math.radians(60 * k + 30)) * r) for k in range(7)]
    d.line(pts, fill=NEON, width=w)


def glyph(cx, cy, s):
    for _ in range(rnd.randint(3, 5)):
        x0, y0 = cx + rnd.uniform(-s, s), cy + rnd.uniform(-s, s)
        if rnd.random() < 0.5:
            d.line([(x0, y0), (x0 + rnd.uniform(-s, s), y0)], fill=CORE, width=4)
        else:
            d.line([(x0, y0), (x0, y0 + rnd.uniform(-s, s))], fill=CORE, width=4)


def node(cx, cy, r):
    hexagon(cx, cy, r, 7)
    hexagon(cx, cy, r * 0.78, 3)
    glyph(cx, cy, r * 0.45)


def terminal(cx, cy, r):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=NEON, width=6)
    d.ellipse([cx - r * 0.35, cy - r * 0.35, cx + r * 0.35, cy + r * 0.35], fill=CORE)


NODES = []
for k in range(6):
    a = math.radians(k * 60 - 90)
    d.line([P(a, R * 0.08), P(a, R * 0.88)], fill=NEON, width=12)
    d.line([P(a, R * 0.08), P(a, R * 0.88)], fill=CORE, width=4)
    for f in (0.22, 0.38, 0.55):
        for s in (-1, 1):
            b = a + s * math.radians(40)
            base = P(a, R * f)
            d.line([base, (base[0] + math.cos(b) * R * 0.16, base[1] + math.sin(b) * R * 0.16)], fill=NEON, width=8)
    node(*P(a, R * 0.72), R * 0.085)
    terminal(*P(a, R * 0.95), R * 0.035)
    NODES.append((a, 0.72))
    a2 = a + math.radians(30)
    d.line([P(a2, R * 0.1), P(a2, R * 0.5)], fill=NEON, width=8)
    node(*P(a2, R * 0.42), R * 0.065)
    terminal(*P(a2, R * 0.56), R * 0.028)
    NODES.append((a2, 0.42))
d.ellipse([C - R * 0.07, C - R * 0.07, C + R * 0.07, C + R * 0.07], outline=NEON, width=8)
glow = lines.filter(ImageFilter.GaussianBlur(9))
img = Image.alpha_composite(Image.alpha_composite(glow, glow), lines)
# pilar de luz (64x256 abajo a la derecha del atlas): degradado vertical que se desvanece hacia arriba
atlas = Image.new('RGBA', (S + 64, S), (0, 0, 0, 0))
atlas.paste(img, (0, 0))
pil = Image.new('RGBA', (64, 256), (0, 0, 0, 0))
pd = ImageDraw.Draw(pil)
for y in range(256):
    f = 1 - y / 255
    for x in range(64):
        e = 1 - abs(x - 31.5) / 32
        a = int(255 * (f ** 1.5) * (e ** 1.2))
        pd.point((x, 255 - y), fill=(200, 240, 255, a))
atlas.paste(pil, (S, 0))
atlas.save(tex_path(N))

g = Geo(N, S + 64, S, bounds=(10, 8, 2))
g.bone('raiz')
p = g.bone('patron', 'raiz')
g.cube(p, (-32, 0, -32), (64, 0.02, 64), (0, 0, S, S), faces=('up', 'down'))
pil_b = g.bone('pilares', 'raiz')
PIL = (S, 0, 64, 256)
for i, (a, f) in enumerate(NODES):
    # posición del nodo en el modelo (64 unidades = diámetro del patrón); textura «arriba» = −Z del modelo
    x = math.cos(a) * f * 32 * (R / (S / 2))
    z = math.sin(a) * f * 32 * (R / (S / 2))
    b = g.bone(f'pilar{i}', 'pilares', pivot=(x, 0, z))
    h = 26 if f > 0.6 else 16
    w = 3.2 if f > 0.6 else 2.4
    g.cube(b, (x - w / 2, 0, z), (w, h, 0.02), PIL, faces=('north', 'south'))
    g.cube(b, (x, 0, z - w / 2), (0.02, h, w), PIL, faces=('east', 'west'))
g.save()
save_anims(N, {
    # Se traza desde el centro hacia fuera; los pilares suben al final.
    'trazar': anim(1.5, False, {
        'patron': {'scale': {0: [0.01, 1, 0.01], 1.2: (1, 1, 1, 'easeOutCubic')}, 'rotation': {0: [0, -60, 0], 1.2: (0, 0, 0, 'easeOutCubic')}},
        'pilares': {'scale': {0: [1, 0.01, 1], 1.0: [1, 0.01, 1], 1.5: (1, 1, 1, 'easeOutBack')}},
    }),
    'idle': anim(1.0, True, {
        'patron': {'scale': {0: [1, 1, 1], 0.5: (1.02, 1, 1.02, 'easeInOutSine'), 1.0: (1, 1, 1, 'easeInOutSine')}},
        'pilares': {'scale': {0: [1, 1, 1], 0.5: (1, 1.18, 1, 'easeInOutSine'), 1.0: (1, 1, 1, 'easeInOutSine')}},
    }),
    'golpe': anim(0.6, False, {
        'pilares': {'scale': {0: [1, 1, 1], 0.15: [1.4, 2.2, 1.4], 0.6: (1, 1, 1, 'easeOutQuad')}},
        'patron': {'scale': {0: [1, 1, 1], 0.15: [1.12, 1, 1.12], 0.6: (1, 1, 1, 'easeOutQuad')}},
    }),
    'desvanecer': anim(1.0, None, {
        'patron': {'scale': {0: [1, 1, 1], 1.0: (1.3, 1, 1.3, 'easeInQuad')}},
        'pilares': {'scale': {0: [1, 1, 1], 1.0: (1, 0.01, 1, 'easeInQuad')}},
    }),
})
print('copo ok')
