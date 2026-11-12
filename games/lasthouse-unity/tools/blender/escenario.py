"""Piezas del escenario del jardín (cada pieza es un objeto raíz con su nombre, en el origen).
Uso: python escenario.py <salida_dir> [--preview]"""
import math
import os
import random
import sys
import bpy

sys.path.insert(0, os.path.dirname(__file__))
import creature as C

out = sys.argv[1] if len(sys.argv) > 1 else '.'
C.reset()
random.seed(7)

M = {k: C.mat(f'Esc_{k}', v[0], v[1], *v[2:]) for k, v in {
    'pared': ('#F2E3C6', 0.85), 'tejado': ('#C2452F', 0.7), 'madera': ('#8A5A36', 0.8), 'madera2': ('#6B4226', 0.85),
    'blanco': ('#F4F1E6', 0.6), 'cristal': ('#FFD58A', 0.2, 0.0, '#FFB84D', 2.5), 'piedra': ('#9A9A92', 0.9),
    'piedra2': ('#7E7F7A', 0.9), 'hoja': ('#4FB548', 0.75), 'hoja2': ('#2E7D3A', 0.8), 'hoja3': ('#A8E06A', 0.7),
    'rosa': ('#E58BC2', 0.7), 'tronco': ('#6E4A2E', 0.9), 'metal': ('#2C2C33', 0.4, 0.8),
    'luz': ('#FFE2A0', 0.3, 0.0, '#FFC566', 8.0), 'flor_a': ('#F5C63A', 0.6), 'flor_b': ('#FF8A3D', 0.6),
    'flor_c': ('#A770E0', 0.6), 'flor_d': ('#F4F1E6', 0.6), 'ladrillo': ('#B5643F', 0.85),
}.items()}

ROOTS = []


def root(name):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    ROOTS.append(o)
    return o


def put(par, kind, m, loc, scale=(1, 1, 1), rot=(0, 0, 0), sub=0, **kw):
    o = C.prim(kind, f'{par.name}_{kind}', M[m], loc, scale, rot, **kw)
    if sub:
        C.smooth(o, sub)
    o.parent = par
    return o


def blob(par, m, loc, r, n=5, spread=0.5):
    """Copa de árbol / arbusto: racimo de esferas deformadas (silueta irregular)."""
    for i in range(n):
        a = random.uniform(0, 6.28)
        d = random.uniform(0, spread) * r
        put(par, 'ico_sphere', m, (loc[0] + d * math.cos(a), loc[1] + d * math.sin(a), loc[2] + random.uniform(-0.3, 0.4) * r),
            (r * random.uniform(0.75, 1.0),) * 3, sub=1, subdivisions=2, radius=1)


# casa (fachada que se ve desde el jardín)
h = root('Casa')
put(h, 'cube', 'pared', (0, 0, 1.6), (3.2, 2.2, 1.6), size=2)
put(h, 'cube', 'ladrillo', (0, 0, 0.12), (3.25, 2.25, 0.12), size=2)
roof = put(h, 'cone', 'tejado', (0, 0, 4.1), (1, 0.72, 1), (0, 0, 45), vertices=4, radius1=4.8, depth=1.9)
put(h, 'cube', 'madera2', (0, -2.21, 0.95), (0.55, 0.05, 0.95), size=2)
for x in (-1.9, 1.9):
    put(h, 'cube', 'cristal', (x, -2.21, 1.9), (0.5, 0.04, 0.55), size=2)
    put(h, 'cube', 'blanco', (x, -2.25, 1.9), (0.58, 0.03, 0.06), size=2)
    put(h, 'cube', 'blanco', (x, -2.25, 1.9), (0.06, 0.03, 0.62), size=2)
put(h, 'cube', 'cristal', (0, -2.21, 3.0), (0.4, 0.04, 0.4), size=2)
put(h, 'cube', 'ladrillo', (2.0, 0.6, 4.6), (0.3, 0.3, 0.9), size=2)
put(h, 'cube', 'madera', (0, -2.6, 0.08), (0.9, 0.4, 0.08), size=2)

# valla blanca (tramo de 2 m) y valla rota
for name, broken in (('Valla', False), ('VallaRota', True)):
    v = root(name)
    for i in range(5):
        if broken and i in (2, 3):
            if i == 2:
                put(v, 'cube', 'blanco', (-1 + i * 0.5, 0.15, 0.08), (0.06, 0.4, 0.03), (0, 0, 70), size=2)
            continue
        hgt = 0.5 + 0.03 * (i % 2)
        put(v, 'cube', 'blanco', (-1 + i * 0.5, 0, hgt), (0.07, 0.03, hgt), size=2)
        put(v, 'cone', 'blanco', (-1 + i * 0.5, 0, 2 * hgt + 0.06), (1, 0.43, 1), (0, 0, 45), vertices=4, radius1=0.1, depth=0.14)
    for z in (0.3, 0.75):
        put(v, 'cube', 'blanco', (0, 0.04, z), (1.05 if not broken else 0.45, 0.02, 0.05), size=2).location.x = 0 if not broken else -0.6

# farola
f = root('Farola')
put(f, 'cylinder', 'metal', (0, 0, 1.4), (0.06, 0.06, 1.4), vertices=12, depth=2)
put(f, 'cylinder', 'metal', (0, 0, 0.1), (0.18, 0.18, 0.1), vertices=12, depth=2)
put(f, 'cube', 'luz', (0, 0, 2.95), (0.16, 0.16, 0.2), size=2)
put(f, 'cone', 'metal', (0, 0, 3.25), (1, 1, 1), (0, 0, 45), vertices=4, radius1=0.28, depth=0.22)

# árboles redondos (verde y rosa) y pino
for name, m, m2 in (('Arbol', 'hoja', 'hoja2'), ('ArbolRosa', 'rosa', 'hoja3')):
    t = root(name)
    put(t, 'cylinder', 'tronco', (0, 0, 1.0), (0.18, 0.18, 1.0), vertices=10, depth=2)
    put(t, 'cylinder', 'tronco', (0.25, 0, 1.6), (0.07, 0.07, 0.4), (0, 40, 0), vertices=8, depth=2)
    blob(t, m, (0, 0, 2.6), 1.0, n=6)
    blob(t, m2, (0, 0.2, 2.2), 0.7, n=3)
p = root('Pino')
put(p, 'cylinder', 'tronco', (0, 0, 0.5), (0.15, 0.15, 0.5), vertices=10, depth=2)
for i, (z, r) in enumerate(((1.2, 1.1), (2.0, 0.85), (2.7, 0.6), (3.3, 0.35))):
    put(p, 'cone', 'hoja2' if i % 2 else 'hoja', (0, 0, z), (1, 1, 1), vertices=10, radius1=r, depth=1.0, sub=1)

# setos con 3 variantes de forma
for k in range(3):
    s = root(f'Seto{k}')
    blob(s, 'hoja2', (0, 0, 0.45), 0.55, n=4 + k, spread=0.9)
    blob(s, 'hoja', (0.1, -0.15, 0.6), 0.4, n=3)

# matas de flores (4 colores)
for k, fm in enumerate(('flor_a', 'flor_b', 'flor_c', 'flor_d')):
    fl = root(f'Flores{k}')
    blob(fl, 'hoja2', (0, 0, 0.12), 0.18, n=3, spread=1.2)
    for i in range(7):
        a, d = random.uniform(0, 6.28), random.uniform(0, 0.22)
        put(fl, 'uv_sphere', fm, (d * math.cos(a), d * math.sin(a), 0.28 + random.uniform(0, 0.08)), (0.055,) * 3, radius=1, segments=10, ring_count=6)

# rocas, caja, cartel
for k in range(2):
    r = root(f'Roca{k}')
    o = put(r, 'ico_sphere', 'piedra' if k else 'piedra2', (0, 0, 0.15), (0.45, 0.35, 0.28), sub=1, subdivisions=1, radius=1)
c = root('Caja')
put(c, 'cube', 'madera', (0, 0, 0.4), (0.4, 0.4, 0.4), size=2)
for z in (0.05, 0.75):
    put(c, 'cube', 'madera2', (0, 0, z), (0.42, 0.42, 0.05), size=2)
put(c, 'cube', 'madera2', (0, -0.41, 0.4), (0.05, 0.02, 0.4), (0, 45, 0), size=2)
sg = root('Cartel')
put(sg, 'cube', 'madera2', (0, 0, 0.6), (0.06, 0.06, 0.6), size=2)
put(sg, 'cube', 'madera', (0.25, 0, 1.0), (0.4, 0.04, 0.14), size=2)
put(sg, 'cone', 'madera', (0.7, 0, 1.0), (1, 0.4, 1), (0, 90, 0), vertices=3, radius1=0.2, depth=0.1)

# cada pieza en su sitio para la vista previa; en el FBX se exportan todas en el origen
if '--preview' in sys.argv:
    for i, r in enumerate(ROOTS):
        r.location = ((i % 6) * 3.2 - 8, (i // 6) * 3.5, 0)
    C.stage(target=(0, 3, 1.2), dist=16, height=7, res=(1100, 650), samples=24)
    C.render_only(os.path.join(out, 'escenario_preview.png'))
    for r in ROOTS:
        r.location = (0, 0, 0)

os.makedirs(out, exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for r in ROOTS:
    r.select_set(True)
    for ch in r.children_recursive:
        ch.select_set(True)
bpy.ops.export_scene.fbx(filepath=os.path.join(out, 'Escenario.fbx'), use_selection=True, apply_scale_options='FBX_SCALE_ALL',
                         axis_forward='-Z', axis_up='Y', mesh_smooth_type='FACE', bake_anim=False)
print('ok', [r.name for r in ROOTS])
