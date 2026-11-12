"""Lanzabrotes: criatura-planta en maceta con boca de vaina que se infla antes de disparar.
Uso: python lanzabrotes.py <salida_dir> [--preview]"""
import os
import sys
import bpy

sys.path.insert(0, os.path.dirname(__file__))
import creature as C

out = sys.argv[1] if len(sys.argv) > 1 else '.'
C.reset()

verde = C.mat('Brote_Verde', '#4FB548', 0.55)
oscuro = C.mat('Brote_Oscuro', '#2E7D3A', 0.6)
claro = C.mat('Brote_Claro', '#A8E06A', 0.5)
barro = C.mat('Maceta', '#C2643A', 0.85)
franja = C.mat('Maceta_Franja', '#F5C63A', 0.7)
tierra = C.mat('Tierra', '#4A3020', 0.95)
ojo = C.mat('Ojo', '#F4F1E6', 0.3)
pupila = C.mat('Pupila', '#1B1420', 0.3)
flor = C.mat('Flor', '#FF8A3D', 0.5)
centro = C.mat('Flor_Centro', '#F5C63A', 0.5)

import math
arm = C.rig('Lanzabrotes', [
    ('raiz', (0, 0, 0), (0, 0, 0.30), None),
    ('tallo', (0, 0, 0.30), (0, 0, 0.50), 'raiz'),
    ('cuerpo', (0, 0, 0.50), (0, 0, 0.80), 'tallo'),
    ('hoja.L', (0.06, 0, 0.30), (0.40, -0.05, 0.38), 'raiz'),
    ('hoja.R', (-0.06, 0, 0.30), (-0.40, -0.05, 0.38), 'raiz'),
] + [(f'petalo{i}', (0.07 * math.cos(math.radians(45 + 90 * i)), 0.07 * math.sin(math.radians(45 + 90 * i)), 0.86),
      (0.09 * math.cos(math.radians(45 + 90 * i)), 0.09 * math.sin(math.radians(45 + 90 * i)), 1.08), 'cuerpo') for i in range(4)])

P = []
def add(o, bone):
    P.append(o)
    C.attach(o, arm, bone)
    return o

# maceta troncocónica con franja amarilla y grieta
add(C.prim('cone', 'maceta', barro, (0, 0, 0.14), (1, 1, 1), vertices=28, radius1=0.15, radius2=0.21, depth=0.28), 'raiz')
add(C.smooth(C.prim('torus', 'borde', barro, (0, 0, 0.285), (1, 1, 0.8), major_radius=0.215, minor_radius=0.03), 1), 'raiz')
add(C.prim('cone', 'franja', franja, (0, 0, 0.17), (1, 1, 1), vertices=28, radius1=0.183, radius2=0.192, depth=0.03), 'raiz')
add(C.prim('cylinder', 'tierra', tierra, (0, 0, 0.28), (0.2, 0.2, 0.01), vertices=24, depth=2), 'raiz')
add(C.prim('cube', 'grieta', tierra, (0.1, -0.15, 0.1), (0.004, 0.01, 0.06), (0, 0, -35), size=2), 'raiz')
# dos hojas grandes que salen de la tierra
for x, n in ((1, 'L'), (-1, 'R')):
    add(C.smooth(C.prim('uv_sphere', f'hoja.{n}', oscuro, (0.22 * x, -0.03, 0.34), (0.17, 0.08, 0.018), (0, -12 * x, 8 * x), radius=1)), f'hoja.{n}')
    add(C.prim('cylinder', f'nervio.{n}', claro, (0.22 * x, -0.03, 0.352), (0.15, 0.006, 0.004), (0, -12 * x, 8 * x), vertices=6, depth=2), f'hoja.{n}')
# tallo
add(C.prim('cylinder', 'tallo', oscuro, (0, 0, 0.40), (0.045, 0.045, 0.11), vertices=12, depth=2), 'tallo')
# cuerpo en bellota: vientre claro, «capuchón» verde oscuro con escamas
add(C.smooth(C.prim('uv_sphere', 'cuerpo', verde, (0, 0, 0.66), (0.17, 0.16, 0.19), radius=1)), 'cuerpo')
add(C.prim('uv_sphere', 'barriga', claro, (0, -0.07, 0.62), (0.12, 0.11, 0.12), radius=1), 'cuerpo')
add(C.smooth(C.prim('uv_sphere', 'capuchon', oscuro, (0, 0, 0.80), (0.185, 0.175, 0.09), radius=1)), 'cuerpo')
for i in range(10):
    r = math.radians(36 * i)
    add(C.prim('uv_sphere', f'escama{i}', verde, (0.16 * math.cos(r), 0.15 * math.sin(r), 0.79), (0.035, 0.035, 0.02), radius=1), 'cuerpo')
# cara (debajo del capuchón): ojos con cejas, sonrisa
for x, n in ((0.065, 'L'), (-0.065, 'R')):
    add(C.prim('uv_sphere', f'ojo.{n}', ojo, (x, -0.135, 0.70), (0.045, 0.03, 0.05), radius=1), 'cuerpo')
    add(C.prim('uv_sphere', f'pupila.{n}', pupila, (x * 0.85, -0.162, 0.695), (0.022, 0.012, 0.028), radius=1), 'cuerpo')
    add(C.prim('cube', f'ceja.{n}', oscuro, (x, -0.15, 0.765), (0.035, 0.008, 0.008), (0, 18 if x > 0 else -18, 0), size=2), 'cuerpo')
add(C.prim('torus', 'sonrisa', pupila, (0, -0.14, 0.62), (1, 0.5, 0.6), (90, 0, 0), major_radius=0.04, minor_radius=0.008), 'cuerpo')
# corona de 4 pétalos (cerrados = cargando, abiertos = dispara) con brote dentro
for i in range(4):
    r = math.radians(45 + 90 * i)
    add(C.smooth(C.prim('uv_sphere', f'petalo{i}', flor, (0.085 * math.cos(r), 0.085 * math.sin(r), 0.97), (0.05, 0.03, 0.12), (0, 0, 0), radius=1)), f'petalo{i}')
    bpy.context.active_object.rotation_euler = (math.radians(-12) * math.sin(r), math.radians(12) * math.cos(r), 0)
add(C.prim('uv_sphere', 'brote', claro, (0, 0, 0.93), (0.05, 0.05, 0.06), radius=1), 'cuerpo')

def petals(a):  # a = grados de apertura (positivo = abiertos hacia fuera)
    return {f'petalo{i}': ((0, 0, 0) if a == 0 else _open(i, a),) for i in range(4)}

def _open(i, a):
    r = math.radians(45 + 90 * i)
    # el Z local del hueso mira hacia -Y del mundo: abrir = inclinar hacia fuera del centro
    return (-a * math.sin(r), 0, a * math.cos(r)) if False else (a * -math.sin(r) * 0 + a, 0, 0)

C.action(arm, 'Reposo', 48, {f: {
    'tallo': ((0, 0, 5 * s),), 'cuerpo': ((3 * s, 0, 0), None, (1, 1, 1 + 0.03 * abs(s))),
    'hoja.L': ((6 * s, 0, 0),), 'hoja.R': ((-6 * s, 0, 0),),
} for f, s in ((1, 0), (13, 1), (25, 0), (37, -1), (49, 0))})

C.action(arm, 'Cargar', 18, {
    1: {'cuerpo': ((0, 0, 0), None, (1, 1, 1)), **{f'petalo{i}': ((0, 0, 0), None, (1, 1, 1)) for i in range(4)}},
    18: {'cuerpo': ((-8, 0, 0), None, (1.12, 1.12, 0.88)), **{f'petalo{i}': ((0, 0, 0), None, (0.8, 0.85, 0.8)) for i in range(4)}},
}, loop=False)

C.action(arm, 'Disparar', 16, {
    1: {'cuerpo': ((-8, 0, 0), None, (1.12, 1.12, 0.88)), **{f'petalo{i}': ((0, 0, 0), None, (0.8, 0.85, 0.8)) for i in range(4)}},
    4: {'cuerpo': ((6, 0, 0), None, (0.9, 0.9, 1.15)), **{f'petalo{i}': ((0, 0, 0), None, (1.2, 1.25, 1.2)) for i in range(4)}},
    16: {'cuerpo': ((0, 0, 0), None, (1, 1, 1)), **{f'petalo{i}': ((0, 0, 0), None, (1, 1, 1)) for i in range(4)}},
}, loop=False)

C.action(arm, 'Dano', 12, {
    1: {'cuerpo': ((0, 0, 0), None, (1, 1, 1))},
    3: {'cuerpo': ((-18, 0, 8), None, (1.1, 1.1, 0.85))},
    12: {'cuerpo': ((0, 0, 0), None, (1, 1, 1))},
}, loop=False)

C.action(arm, 'Marchitar', 40, {
    1: {'tallo': ((0, 0, 0),), 'cuerpo': ((0, 0, 0), None, (1, 1, 1)), 'hoja.L': ((0, 0, 0),), 'hoja.R': ((0, 0, 0),)},
    40: {'tallo': ((45, 0, 0),), 'cuerpo': ((35, 0, 0), None, (0.9, 0.9, 0.75)), 'hoja.L': ((-25, 0, 0),), 'hoja.R': ((-25, 0, 0),)},
}, loop=False)

os.makedirs(out, exist_ok=True)
C.export_fbx(os.path.join(out, 'Lanzabrotes.fbx'), [arm] + P)
if '--preview' in sys.argv:
    C.stage(target=(0, 0, 0.55), dist=2.1, height=1.0, res=(360, 450), samples=24)
    C.sheet(os.path.join(out, 'lanzabrotes_sheet.png'), arm, [('Reposo', (13,)), ('Cargar', (18,)), ('Disparar', (4,)), ('Marchitar', (40,))])
print('ok', [a.name for a in bpy.data.actions])
