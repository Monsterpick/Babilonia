"""Textura de la brújula (copo de 12 puntas con hexágonos) para el calco del suelo: líneas de neón con halo.
Canal rojo = núcleo de la línea (blanco caliente), alfa = intensidad total. El color lo pone el shader."""
import math, os
from PIL import Image, ImageDraw, ImageFilter

N = 1024
SS = 2
S = N * SS
C = S / 2
img = Image.new("L", (S, S), 0)
d = ImageDraw.Draw(img)

def P(a, r):
    return (C + math.cos(a) * r * C, C + math.sin(a) * r * C)

def line(a0, r0, a1, r1, w):
    d.line([P(a0, r0), P(a1, r1)], fill=255, width=int(w * SS))

def poly(cx, cy, r, n, rot, w):
    pts = [(cx + math.cos(rot + i * 2 * math.pi / n) * r * C, cy + math.sin(rot + i * 2 * math.pi / n) * r * C) for i in range(n + 1)]
    d.line(pts, fill=255, width=int(w * SS), joint="curve")

def branch(a, r, length, w):
    """Rama en V que sale del brazo en ángulo a, a distancia r."""
    x, y = P(a, r)
    for s in (-1, 1):
        b = a + s * math.radians(58)
        d.line([(x, y), (x + math.cos(b) * length * C, y + math.sin(b) * length * C)], fill=255, width=int(w * SS))

for k in range(12):
    a = math.radians(k * 30 - 90)
    if k % 2 == 0:
        # Brazo principal: doble línea con ramas de copo de nieve y punta de flecha.
        line(a, 0.12, a, 0.95, 9)
        for r, l in ((0.30, 0.10), (0.44, 0.15), (0.58, 0.13), (0.72, 0.10), (0.84, 0.06)):
            branch(a, r, l, 6)
        x, y = P(a, 0.95)
        d.ellipse([x - 9 * SS, y - 9 * SS, x + 9 * SS, y + 9 * SS], outline=255, width=4 * SS)
    else:
        # Brazo secundario: termina en un hexágono con una marca dentro.
        line(a, 0.12, a, 0.56, 6)
        x, y = P(a, 0.68)
        poly(x, y, 0.12, 6, a, 7)
        poly(x, y, 0.085, 6, a, 3)
        for j in range(3):
            b = a + j * math.pi / 3
            d.line([(x - math.cos(b) * 0.05 * C, y - math.sin(b) * 0.05 * C), (x + math.cos(b) * 0.05 * C, y + math.sin(b) * 0.05 * C)], fill=255, width=4 * SS)
        line(a, 0.80, a, 0.90, 5)
        branch(a, 0.36, 0.08, 5)
# Centro: hexágonos y anillos.
poly(C, C, 0.12, 6, math.radians(0), 8)
poly(C, C, 0.19, 6, math.radians(30), 5)
poly(C, C, 0.06, 12, 0, 4)
for r, w in ((0.985, 5), (0.26, 3)):
    poly(C, C, r, 96, 0, w)
# Estrella interior que une los brazos.
for k in range(6):
    a0, a1 = math.radians(k * 60 - 90), math.radians((k + 2) * 60 - 90)
    line(a0, 0.26, a1, 0.26, 3)

core = img.resize((N, N), Image.LANCZOS)
g1 = core.filter(ImageFilter.GaussianBlur(5))
g2 = core.filter(ImageFilter.GaussianBlur(16))
cp, p1, p2 = core.load(), g1.load(), g2.load()
out = Image.new("RGBA", (N, N))
op = out.load()
for y in range(N):
    for x in range(N):
        c = cp[x, y]
        a = min(255, int(c + p1[x, y] * 1.3 + p2[x, y] * 1.1))
        r = math.hypot(x - N / 2, y - N / 2) / (N / 2)
        if r > 1:
            a = 0
        op[x, y] = (c, c, c, a)
dst = os.path.join(os.path.dirname(__file__), "../src/main/resources/assets/livearena/textures/fx/brujula.png")
out.save(dst)
print("ok", dst)
