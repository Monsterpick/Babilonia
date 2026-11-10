"""Animaciones de Choso (Sangre Perforante). La geometría sale de su skin (gen_skins.py).
Convención: brazo X negativo = hacia delante; en GeckoLib el giro Y de los brazos va al revés (flip_y)."""
from geo import anim, save_anims
from gen_personajes import flip_y

E_ = 'easeInOutSine'
BI, BD = 'brazo_izquierdo', 'brazo_derecho'
JUNTAS_I, JUNTAS_D = [-84, -50, 0], [-84, 50, 0]
save_anims('choso', flip_y({
    # Sale de un charco de sangre: sube desde el suelo.
    'aparicion': anim(1.6, None, {
        'root': {'position': {0: [0, -30, 0], 1.3: (0, 0, 0, 'easeOutCubic')}},
        BI: {'rotation': {0: [0, 0, -40], 1.6: (0, 0, -8, E_)}},
        BD: {'rotation': {0: [0, 0, 40], 1.6: (0, 0, 8, E_)}},
        'cabeza': {'rotation': {0: [25, 0, 0], 1.6: (0, 0, 0, E_)}},
    }),
    # Junta las manos delante del pecho.
    'juntar_manos': anim(0.9, None, {
        BI: {'rotation': {0: [0, 0, -8], 0.5: (-60, 0, -40, 'easeOutQuad'), 0.9: tuple(JUNTAS_I) + ('easeOutBack',)}},
        BD: {'rotation': {0: [0, 0, 8], 0.5: (-60, 0, 40, 'easeOutQuad'), 0.9: tuple(JUNTAS_D) + ('easeOutBack',)}},
        'cabeza': {'rotation': {0: [0, 0, 0], 0.9: (6, 0, 0, E_)}},
        'pierna_izquierda': {'rotation': {0: [0, 0, 0], 0.9: (0, 0, -8, E_)}},
        'pierna_derecha': {'rotation': {0: [0, 0, 0], 0.9: (0, 0, 8, E_)}},
    }),
    # Mantiene la presión: tiembla un poco.
    'cargar': anim(0.4, True, {
        BI: {'rotation': {0: JUNTAS_I, 0.1: [-86, -52, 0], 0.2: [-83, -49, 0], 0.3: [-85, -51, 0], 0.4: JUNTAS_I}},
        BD: {'rotation': {0: JUNTAS_D, 0.1: [-85, 52, 0], 0.2: [-86, 49, 0], 0.3: [-83, 51, 0], 0.4: JUNTAS_D}},
        'cabeza': {'rotation': {0: [6, 0, 0], 0.4: [6, 0, 0]}},
        'pierna_izquierda': {'rotation': {0: [0, 0, -8], 0.4: [0, 0, -8]}},
        'pierna_derecha': {'rotation': {0: [0, 0, 8], 0.4: [0, 0, 8]}},
    }),
    # Extiende los dedos hacia el objetivo: los brazos se estiran de golpe y el cuerpo retrocede.
    'perforar': anim(0.8, None, {
        BI: {'rotation': {0: JUNTAS_I, 0.12: (-92, -16, 0, 'easeOutExpo'), 0.8: [-90, -14, 0]}},
        BD: {'rotation': {0: JUNTAS_D, 0.12: (-92, 16, 0, 'easeOutExpo'), 0.8: [-90, 14, 0]}},
        'cuerpo': {'rotation': {0: [0, 0, 0], 0.12: (-9, 0, 0, 'easeOutExpo'), 0.5: (-3, 0, 0, E_), 0.8: [-3, 0, 0]}},
        'cabeza': {'rotation': {0: [6, 0, 0], 0.12: [-4, 0, 0], 0.8: [0, 0, 0]}},
        'pierna_izquierda': {'rotation': {0: [0, 0, -8], 0.8: [-14, 0, -8]}},
        'pierna_derecha': {'rotation': {0: [0, 0, 8], 0.8: [16, 0, 8]}},
    }),
    'pose_final': anim(2.0, True, {
        BI: {'rotation': {0: [-10, 0, -10], 1.0: (-12, 0, -11, E_), 2.0: (-10, 0, -10, E_)}},
        BD: {'rotation': {0: [-35, 10, 6], 1.0: (-37, 12, 6, E_), 2.0: (-35, 10, 6, E_)}},
        'cabeza': {'rotation': {0: [-4, 12, 0], 2.0: [-4, 12, 0]}},
    }),
    'idle': anim(2.0, True, {'cuerpo': {'scale': {0: [1, 1, 1], 1.0: (1.01, 1.02, 1.01, E_), 2.0: (1, 1, 1, E_)}}}),
}))
print('choso anims ok')
