"""Copo de 12 puntas (técnica de combate): patrón geométrico plano y emisivo para el suelo.
Vértices: punta k en ángulo a_k = k·30°, posición (cos a_k·R, sin a_k·R); las líneas unen puntas alternas (k → k+2)
formando dos hexagramas superpuestos; los anillos concéntricos marcan 0.25R, 0.55R y R."""
import math
from PIL import Image, ImageDraw, ImageFilter
from geo import Geo, anim, save_anims, tex_path

N = 'copo'
S = 512
C = S / 2
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
ICE, WHITE = (127, 216, 255, 255), (240, 252, 255, 255)
R = C - 12


def pt(k, r):
    a = math.radians(k * 30 - 90)        # 12 puntas cada 30°, la primera hacia arriba
    return (C + math.cos(a) * r, C + math.sin(a) * r)


for rr, w in ((R, 5), (R * 0.55, 4), (R * 0.25, 3)):
    d.ellipse([C - rr, C - rr, C + rr, C + rr], outline=ICE, width=w)
for k in range(12):
    d.line([pt(k, R * 0.25), pt(k, R)], fill=WHITE, width=4)          # radios
    d.line([pt(k, R), pt(k + 2, R)], fill=ICE, width=3)                # puntas alternas → hexagramas
    # punta en forma de rombo
    d.polygon([pt(k, R * 1.0), pt(k + 0.18, R * 0.86), pt(k, R * 0.72), pt(k - 0.18, R * 0.86)], outline=WHITE, fill=(127, 216, 255, 90))
    # ramitas del copo
    for f in (0.45, 0.68):
        base = pt(k, R * f)
        d.line([base, pt(k + 0.35, R * (f + 0.1))], fill=ICE, width=2)
        d.line([base, pt(k - 0.35, R * (f + 0.1))], fill=ICE, width=2)
d.ellipse([C - 14, C - 14, C + 14, C + 14], fill=WHITE)
img = Image.alpha_composite(img.filter(ImageFilter.GaussianBlur(4)), img)
img.save(tex_path(N))

g = Geo(N, S, S, bounds=(8, 1, 0))
g.bone('raiz')
p = g.bone('patron', 'raiz')
g.cube(p, (-32, 0, -32), (64, 0.02, 64), (0, 0, S, S), faces=('up', 'down'))
g.save()
save_anims(N, {
    # Se «traza» desde el centro hacia fuera (escala 0 → 1) y luego late.
    'trazar': anim(1.5, False, {'patron': {'scale': {0: [0.01, 1, 0.01], 1.5: (1, 1, 1, 'easeOutCubic')}, 'rotation': {0: [0, -60, 0], 1.5: (0, 0, 0, 'easeOutCubic')}}}),
    'idle': anim(1.0, True, {'patron': {'scale': {0: [1, 1, 1], 0.5: (1.03, 1, 1.03, 'easeInOutSine'), 1.0: (1, 1, 1, 'easeInOutSine')}}}),
    'desvanecer': anim(1.0, None, {'patron': {'scale': {0: [1, 1, 1], 1.0: (1.3, 1, 1.3, 'easeInQuad')}}}),
})
print('copo ok')
