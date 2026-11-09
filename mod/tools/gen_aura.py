"""Aura de energía: llamas translúcidas alrededor de un cuerpo (se tiñe desde el servidor)."""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from geo import Geo, anim, save_anims, tex_path

N = 'aura'
img = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
# llama (0,0,32,64): forma de lengua de fuego blanca con borde suave
fl = Image.new('RGBA', (32, 64), (0, 0, 0, 0))
d = ImageDraw.Draw(fl)
pts = [(16, 0)] + [(16 + 13 * math.sin(math.pi * t) * (t ** 0.6) + 2 * math.sin(t * 19), 64 * t) for t in np.linspace(0.05, 1, 20)]
pts += [(32 - x, y) for x, y in reversed(pts[1:])]
d.polygon(pts, fill=(255, 255, 255, 70))
d.polygon([(x * 0.6 + 6.4, y * 0.9 + 6) for x, y in pts], fill=(255, 255, 255, 130))
fl = fl.filter(ImageFilter.GaussianBlur(1.5))
img.paste(fl, (0, 0))
# chispa (32,0,16,16)
sp = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
ImageDraw.Draw(sp).ellipse([4, 4, 12, 12], fill=(255, 255, 255, 255))
img.paste(sp.filter(ImageFilter.GaussianBlur(2)), (32, 0))
img.save(tex_path(N))

FL, SP = (0, 0, 32, 64), (32, 0, 16, 16)
NS = ('north', 'south')
g = Geo(N, 64, 64, bounds=(3, 4, 1.5))
g.bone('root')
for layer, (rad, n, h, w) in enumerate([(7, 10, 34, 9), (9.5, 14, 42, 10), (12, 12, 30, 8)]):
    b = g.bone(f'capa{layer}', 'root')
    for k in range(n):
        a = k * 360 / n + layer * 13
        fb = g.bone(f'l{layer}_{k}', f'capa{layer}', rotation=(0, a, 0))
        # plano vertical tangente; la llama apunta hacia arriba (textura invertida en V: punta arriba)
        g.cube(fb, (-w / 2, -2, rad), (w, h, 0.05), FL, faces=NS, rotation=(-8, 0, 0), pivot=(0, -2, rad))
sp = g.bone('chispas', 'root')
for k in range(16):
    a = math.radians(k * 137.5)
    r = 6 + (k % 4) * 2.5
    g.cube(sp, (math.cos(a) * r - 0.5, 4 + (k * 7) % 30, math.sin(a) * r - 0.5), (1, 1, 1), SP)
g.save()

flick = {}
for layer in range(3):
    sp_ = 1.6 + layer * 0.4
    flick[f'capa{layer}'] = {
        'rotation': {0: [0, 0, 0], 2.0: [0, 360 * (1 if layer % 2 == 0 else -1), 0]},
        'scale': {0: [1, 1, 1], 0.25: [1.04, 1.12, 1.04], 0.5: [0.98, 0.92, 0.98], 0.75: [1.03, 1.08, 1.03], 1.0: [1, 1, 1], 1.25: [1.04, 1.14, 1.04], 1.5: [0.98, 0.9, 0.98], 1.75: [1.02, 1.06, 1.02], 2.0: [1, 1, 1]},
    }
flick['chispas'] = {'position': {0: [0, 0, 0], 2.0: [0, 14, 0]}, 'rotation': {0: [0, 0, 0], 2.0: [0, 90, 0]}}
save_anims(N, {
    'aparicion': anim(0.6, False, {'root': {'scale': {0: [0.3, 0.01, 0.3], 0.6: (1, 1, 1, 'easeOutBack')}}}),
    'idle': anim(2.0, True, flick),
    'desaparecer': anim(0.6, None, {'root': {'scale': {0: [1, 1, 1], 0.6: (0.01, 1.4, 0.01, 'easeInQuad')}}}),
})
print('aura ok')
