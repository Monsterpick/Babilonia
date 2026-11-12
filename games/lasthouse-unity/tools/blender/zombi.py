"""Zombi base del jardín: flaco, desgarbado, con peto de jardinero. Uso:
python zombi.py <salida_dir> [--preview]"""
import os
import sys
import bpy

sys.path.insert(0, os.path.dirname(__file__))
import creature as C

out = sys.argv[1] if len(sys.argv) > 1 else '.'
C.reset()

# esqueleto (x lateral, y fondo, z arriba); el personaje mira hacia -Y
N = [
    ('cadera', (0, 0.02, 0.92), (0.17, 0.13), None),
    ('vientre', (0, 0.0, 1.12), (0.16, 0.12), 'cadera'),
    ('pecho', (0, 0.05, 1.34), (0.19, 0.13), 'vientre'),
    ('cuello', (0, 0.06, 1.50), 0.06, 'pecho'),
    ('cabeza', (0, 0.02, 1.66), (0.15, 0.17), 'cuello'),
    ('coronilla', (0, 0.0, 1.86), 0.09, 'cabeza'),
    ('hombro.L', (0.21, 0.06, 1.40), 0.085, 'pecho'),
    ('codo.L', (0.30, 0.02, 1.13), 0.065, 'hombro.L'),
    ('mano.L', (0.34, -0.06, 0.88), 0.08, 'codo.L'),
    ('dedos.L', (0.35, -0.10, 0.78), 0.045, 'mano.L'),
    ('hombro.R', (-0.21, 0.06, 1.40), 0.085, 'pecho'),
    ('codo.R', (-0.29, 0.03, 1.13), 0.065, 'hombro.R'),
    ('mano.R', (-0.33, -0.04, 0.88), 0.08, 'codo.R'),
    ('dedos.R', (-0.34, -0.08, 0.78), 0.045, 'mano.R'),
    ('muslo.L', (0.10, 0.02, 0.86), 0.095, 'cadera'),
    ('rodilla.L', (0.12, -0.01, 0.48), 0.07, 'muslo.L'),
    ('tobillo.L', (0.13, 0.03, 0.10), 0.06, 'rodilla.L'),
    ('pie.L', (0.14, -0.13, 0.05), (0.07, 0.05), 'tobillo.L'),
    ('muslo.R', (-0.10, 0.02, 0.86), 0.095, 'cadera'),
    ('rodilla.R', (-0.12, -0.01, 0.48), 0.07, 'muslo.R'),
    ('tobillo.R', (-0.13, 0.03, 0.10), 0.06, 'rodilla.R'),
    ('pie.R', (-0.14, -0.13, 0.05), (0.07, 0.05), 'tobillo.R'),
]
ob, arm = C.body('Zombi', N, subdiv=2)

piel = C.mat('Zombi_Piel', '#8C7AA0', 0.8)
manchas = C.mat('Zombi_Piel2', '#B5E37A', 0.8)
peto = C.mat('Zombi_Peto', '#3F6E9E', 0.9)
camisa = C.mat('Zombi_Camisa', '#C9A15A', 0.9)
zapato = C.mat('Zombi_Zapato', '#4A3528', 0.7)
C.paint_by(ob, {
    'cadera': peto, 'vientre': peto, 'muslo.L': peto, 'muslo.R': peto, 'rodilla.L': peto,
    'pecho': camisa, 'hombro.L': camisa, 'hombro.R': camisa,
    'pie.L': zapato, 'pie.R': zapato, 'tobillo.R': zapato,
    'mano.L': manchas, 'dedos.R': manchas,
}, piel)

# cara: ojos desiguales (uno grande), pupilas, boca, mechón
blanco = C.mat('Ojo', '#F4F1E6', 0.35)
pupila = C.mat('Pupila', '#1B1420', 0.3)
boca = C.mat('Boca', '#3A1830', 0.6)
pelo = C.mat('Pelo', '#3B2A3F', 0.9)
parts = [
    C.sphere('ojo.L', (0.065, -0.135, 1.70), 0.052, blanco),
    C.sphere('ojo.R', (-0.06, -0.13, 1.68), 0.038, blanco),
    C.sphere('pupila.L', (0.07, -0.18, 1.705), 0.02, pupila),
    C.sphere('pupila.R', (-0.055, -0.165, 1.675), 0.016, pupila),
    C.sphere('boca', (0.01, -0.145, 1.585), 0.055, boca, scale=(1.3, 0.35, 0.45)),
    C.sphere('mechon', (0.03, -0.02, 1.86), 0.07, pelo, scale=(0.6, 1.3, 1.2)),
    C.sphere('bolsillo', (0.0, -0.13, 1.06), 0.07, C.mat('Zombi_Peto2', '#2F5680', 0.9), scale=(1.2, 0.25, 0.9)),
]
for p in parts:
    C.attach(p, arm, 'cabeza' if p.name != 'bolsillo' else 'vientre')

# animaciones (30 fps). Cada hueso se llama como la articulación donde TERMINA:
#   brazo = codo.X, antebrazo = mano.X, muslo = rodilla.X, espinilla = tobillo.X, cabeza = cabeza.
# Ángulo X positivo = hacia delante.
def walk_pose(s, down):
    return {
        'rodilla.L': ((28 * s, 0, 0), None), 'rodilla.R': ((-28 * s, 0, 0), None),
        'tobillo.L': ((-35 if s < 0 else -8, 0, 0), None), 'tobillo.R': ((-35 if s > 0 else -8, 0, 0), None),
        'codo.L': ((75 - 10 * s, 0, 0), None), 'codo.R': ((75 + 10 * s, 0, 0), None),
        'mano.L': ((10, 0, 0), None), 'mano.R': ((15, 0, 0), None),
        'pecho': ((14, 0, 6 * s), None), 'cabeza': ((-8, 0, -10 * s), None),
        'cadera': ((0, 0, 6 * s), (0, 0, -0.03 if down else 0.0)),
    }
C.action(arm, 'Andar', 32, {f: walk_pose(s, d) for f, s, d in ((1, 1, 0), (9, 0, 1), (17, -1, 0), (25, 0, 1), (33, 1, 0))})

C.action(arm, 'Reposo', 40, {f: {
    'pecho': ((10 + 5 * s, 0, 0), None), 'cabeza': ((-6 * s, 0, 12 * s - 6), None),
    'codo.L': ((20 + 8 * s, 0, 0), None), 'codo.R': ((15 + 5 * s, 0, 0), None),
    'mano.L': ((15, 0, 0), None), 'mano.R': ((10, 0, 0), None),
} for f, s in ((1, 0), (21, 1), (41, 0))})

rest = {'codo.L': ((70, 0, 0), None), 'codo.R': ((70, 0, 0), None), 'pecho': ((10, 0, 0), None)}
C.action(arm, 'Atacar', 24, {
    1: rest,
    9: {'codo.L': ((160, 0, 0), None), 'codo.R': ((160, 0, 0), None), 'pecho': ((-15, 0, 0), None)},
    13: {'codo.L': ((55, 0, 0), None), 'codo.R': ((55, 0, 0), None), 'pecho': ((35, 0, 0), None)},
    24: rest,
}, loop=False)

C.action(arm, 'Dano', 14, {
    1: {'pecho': ((10, 0, 0), None), 'cabeza': ((0, 0, 0), None)},
    4: {'pecho': ((-25, 0, 12), None), 'cabeza': ((-30, 0, 0), None)},
    14: {'pecho': ((10, 0, 0), None), 'cabeza': ((0, 0, 0), None)},
}, loop=False)

C.action(arm, 'Morir', 40, {
    1: {'cadera': ((0, 0, 0), (0, 0, 0)), 'pecho': ((10, 0, 0), None), 'tobillo.L': ((0, 0, 0), None), 'tobillo.R': ((0, 0, 0), None)},
    12: {'cadera': ((0, 0, 0), (0, 0, -0.3)), 'pecho': ((-20, 0, 10), None), 'tobillo.L': ((-80, 0, 0), None), 'tobillo.R': ((-70, 0, 0), None), 'rodilla.L': ((40, 0, 0), None), 'rodilla.R': ((35, 0, 0), None)},
    28: {'cadera': ((-85, 0, 0), (0, 0, -0.75)), 'pecho': ((-10, 0, 0), None), 'tobillo.L': ((-20, 0, 0), None), 'tobillo.R': ((-10, 0, 0), None), 'rodilla.L': ((10, 0, 0), None), 'rodilla.R': ((5, 0, 0), None)},
    40: {'cadera': ((-90, 0, 0), (0, 0, -0.8)), 'pecho': ((-5, 0, 0), None), 'tobillo.L': ((-10, 0, 0), None), 'tobillo.R': ((-5, 0, 0), None), 'rodilla.L': ((5, 0, 0), None), 'rodilla.R': ((0, 0, 0), None)},
}, loop=False)

os.makedirs(out, exist_ok=True)
C.export_fbx(os.path.join(out, 'Zombi.fbx'), [ob, arm] + parts)
if '--preview' in sys.argv:
    C.stage(target=(0, 0, 0.95), dist=3.8, height=1.4, res=(360, 450), samples=24)
    C.sheet(os.path.join(out, 'zombi_sheet.png'), arm, [('Andar', (1, 9, 17)), ('Reposo', (21,)), ('Atacar', (9, 13)), ('Dano', (4,)), ('Morir', (40,))])
print('ok', [a.name for a in bpy.data.actions])
