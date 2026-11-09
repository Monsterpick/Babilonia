"""Completa los modelos de personaje del kit (goku, sukuna, gojo, akaza) con los huesos y animaciones exactos
de sus fichas. Diseños propios (no reproducen a los personajes con derechos de autor): proporciones de 2 bloques,
ropa por capas, ojos que brillan y poses para cada técnica.
Convención GeckoLib/Blockbench: brazo X negativo = hacia delante; brazo derecho Z positivo = abrir hacia fuera."""
from PIL import ImageDraw
from geo import Geo, anim, save_anims
from humanoid import Atlas, body

E = 'easeInOutSine'


def flip_y(anims, bones=('brazo_izquierdo', 'brazo_derecho')):
    """En GeckoLib el giro Y de los brazos va al revés que en Blockbench: lo invertimos para que las manos se junten delante."""
    for a in anims.values():
        for b in bones:
            rot = a['bones'].get(b, {}).get('rotation')
            if not rot:
                continue
            for k, v in rot.items():
                if isinstance(v, dict):
                    v['vector'][1] = -v['vector'][1]
                else:
                    v[1] = -v[1]
    return anims


def spiky(g, head, P, n=5, h=4):
    g.cube(head, (-4.4, 30.2, -4.4), (8.8, 2.4, 8.8), P['hair'])
    g.cube(head, (-4.4, 25.5, 0.2), (8.8, 5.5, 4.3), P['hair'])
    for i in range(n):
        x = -3.4 + i * (6.8 / (n - 1))
        g.cube(head, (x - 1, 31.5, -2.5), (2, h, 3), P['hair'], rotation=(-20, 0, (x / 3.4) * 22), pivot=(x, 31.5, -1))


# ---------------------------------------------------------------- GOKU (artista marcial)
def goku():
    A = Atlas('goku')
    P = {
        'skin': A.solid((222, 170, 128), 8),
        'face': A.face((222, 170, 128), (80, 220, 255)),
        'hair': A.solid((32, 34, 40), 14),
        'top': A.solid((40, 110, 170), 18),
        'top_front': A.pattern((40, 110, 170), lambda d: (d.polygon([(4, 0), (11, 0), (7.5, 7)], fill=(222, 170, 128, 255)), d.line([(0, 0), (7, 9)], fill=(240, 200, 80, 255), width=2), d.line([(15, 0), (8, 9)], fill=(240, 200, 80, 255), width=2))),
        'top_back': A.pattern((40, 110, 170), lambda d: d.ellipse([4, 3, 11, 10], outline=(240, 200, 80, 255), width=1)),
        'sleeve': A.solid((40, 110, 170), 18),
        'hand': A.solid((222, 170, 128), 8),
        'belt': A.solid((235, 230, 215), 8),
        'pants': A.solid((30, 50, 80), 14),
        'shoe': A.solid((70, 45, 30), 10),
        'cuff': A.solid((240, 200, 80), 20),
        'trim': A.solid((240, 200, 80), 20),
    }
    A.save()
    g = Geo('goku', 128, 128, bounds=(3, 4, 1.5))
    body(g, P, hair=lambda g, h: spiky(g, h, P, 5, 4), anchors={'manos': ('root', (0, 40, 0))})
    g.save()
    BI, BD = 'brazo_izquierdo', 'brazo_derecho'
    save_anims('goku', {
        'aparicion': anim(1.0, None, {
            'root': {'position': {0: [0, 30, 0], 0.55: (0, 0, 0, 'easeInQuad'), 0.7: [0, -1.5, 0], 1.0: (0, 0, 0, 'easeOutQuad')}},
            BI: {'rotation': {0: [-30, 0, -40], 0.55: [-10, 0, -20], 1.0: (0, 0, -8, E)}},
            BD: {'rotation': {0: [-30, 0, 40], 0.55: [-10, 0, 20], 1.0: (0, 0, 8, E)}},
            'pierna_izquierda': {'rotation': {0.55: [0, 0, 0], 0.7: [-35, 0, -6], 1.0: (0, 0, -4, E)}},
            'pierna_derecha': {'rotation': {0.55: [0, 0, 0], 0.7: [-35, 0, 6], 1.0: (0, 0, 4, E)}},
        }),
        # Brazos al cielo: sube en 1 s y se queda arriba (el anclaje «manos» queda entre ambas manos).
        'alzar_brazos': anim(1.0, None, {
            BI: {'rotation': {0: [0, 0, -8], 0.6: (0, 0, -168, 'easeOutBack'), 1.0: (0, 0, -172, E)}},
            BD: {'rotation': {0: [0, 0, 8], 0.6: (0, 0, 168, 'easeOutBack'), 1.0: (0, 0, 172, E)}},
            'cabeza': {'rotation': {0: [0, 0, 0], 1.0: (-28, 0, 0, E)}},
            'cuerpo': {'rotation': {0: [0, 0, 0], 1.0: (-5, 0, 0, E)}},
            'pierna_izquierda': {'rotation': {0: [0, 0, -4], 1.0: (0, 0, -14, E)}},
            'pierna_derecha': {'rotation': {0: [0, 0, 4], 1.0: (0, 0, 14, E)}},
        }),
        'lanzar': anim(1.0, None, {
            BI: {'rotation': {0: [0, 0, -172], 0.3: [25, 0, -178], 0.5: (-100, 0, -8, 'easeOutBack'), 1.0: [-95, 0, -10]}},
            BD: {'rotation': {0: [0, 0, 172], 0.3: [25, 0, 178], 0.5: (-100, 0, 8, 'easeOutBack'), 1.0: [-95, 0, 10]}},
            'cuerpo': {'rotation': {0: [-5, 0, 0], 0.3: [-18, 0, 0], 0.5: (16, 0, 0, 'easeOutQuad'), 1.0: [14, 0, 0]}},
            'cabeza': {'rotation': {0: [-28, 0, 0], 0.5: [-10, 0, 0], 1.0: [-10, 0, 0]}},
            'pierna_izquierda': {'rotation': {0: [0, 0, -14], 0.5: [-30, 0, -8], 1.0: [-30, 0, -8]}},
            'pierna_derecha': {'rotation': {0: [0, 0, 14], 0.5: [28, 0, 8], 1.0: [28, 0, 8]}},
        }),
        'pose_final': anim(2.0, True, {
            BI: {'rotation': {0: [0, 0, -12], 1.0: (0, 0, -16, E), 2.0: (0, 0, -12, E)}},
            BD: {'rotation': {0: [-80, 30, 0], 2.0: [-80, 30, 0]}},  # pulgar arriba / saludo
            'cuerpo': {'scale': {0: [1, 1, 1], 1.0: (1.01, 1.02, 1.01, E), 2.0: (1, 1, 1, E)}},
            'pierna_izquierda': {'rotation': {0: [0, 0, -6], 2.0: [0, 0, -6]}},
            'pierna_derecha': {'rotation': {0: [0, 0, 6], 2.0: [0, 0, 6]}},
        }),
        'idle': anim(2.0, True, {'cuerpo': {'scale': {0: [1, 1, 1], 1.0: (1.01, 1.02, 1.01, E), 2.0: (1, 1, 1, E)}}}),
    })


# ---------------------------------------------------------------- SUKUNA (rey maldito)
def sukuna():
    A = Atlas('sukuna')
    red = (210, 30, 40)

    def marks(d):
        d.line([(3, 10), (5, 10)], fill=(60, 10, 20, 255))
        d.line([(10, 10), (12, 10)], fill=(60, 10, 20, 255))
    P = {
        'skin': A.solid((225, 180, 160), 8),
        'face': A.face((225, 180, 160), (255, 50, 60), mouth=(90, 20, 30), marks=marks),
        'hair': A.solid((235, 150, 160), 14),
        'top': A.solid((236, 232, 222), 10),
        'top_front': A.pattern((236, 232, 222), lambda d: (d.line([(4, 0), (8, 8)], fill=(170, 165, 155, 255), width=2), d.line([(11, 0), (8, 8)], fill=(170, 165, 155, 255), width=2))),
        'top_back': A.solid((236, 232, 222), 10),
        'sleeve': A.solid((236, 232, 222), 10),
        'forearm': A.solid((236, 232, 222), 10),
        'hand': A.pattern((225, 180, 160), lambda d: d.rectangle([0, 12, 15, 15], fill=(40, 10, 15, 255))),  # uñas oscuras
        'belt': A.pattern((40, 30, 40), lambda d: d.line([(0, 8), (15, 8)], fill=red + (255,), width=2)),
        'pants': A.solid((236, 232, 222), 10),
        'shoe': A.solid((30, 25, 28), 8),
        'cuff': A.solid((40, 30, 40), 8),
    }
    A.save()
    g = Geo('sukuna', 128, 128, bounds=(3, 4, 1.5))

    def hair(g, head):
        g.cube(head, (-4.4, 30.4, -4.4), (8.8, 1.8, 8.8), P['hair'])
        for i in range(6):
            x = -3.6 + i * 1.45
            g.cube(head, (x - 0.8, 31.2, -3.5 + (i % 2)), (1.6, 2.4, 6), P['hair'], rotation=(0, 0, (x / 3.6) * 25), pivot=(x, 31, 0))
        g.cube(head, (-4.4, 26.5, 0.5), (8.8, 4, 4), P['hair'])

    def robe(g):
        # faldón de túnica que cae sobre las piernas
        g.cube(g.bones[1], (-4.6, 4, -2.6), (9.2, 7.5, 5.2), P['top'])
    body(g, P, hair=hair, extra=robe, anchors={'manos': ('cuerpo', (0, 18, -5))})
    g.save()
    BI, BD = 'brazo_izquierdo', 'brazo_derecho'
    sign = {BI: {'rotation': {0: [0, 0, 0], 0.8: (-75, -45, 0, 'easeOutBack'), 1.5: [-78, -48, 0]}},
            BD: {'rotation': {0: [0, 0, 0], 0.8: (-75, 45, 0, 'easeOutBack'), 1.5: [-78, 48, 0]}},
            'cabeza': {'rotation': {0: [0, 0, 0], 1.5: (6, 0, 0, E)}}}
    save_anims('sukuna', flip_y({
        'aparicion': anim(1.5, None, {
            'root': {'scale': {0: [0.2, 0.01, 0.2], 0.8: (1.1, 1.1, 1.1, 'easeOutQuad'), 1.5: (1, 1, 1, E)}, 'position': {0: [0, -10, 0], 0.8: (0, 0, 0, 'easeOutQuad')}},
            'cabeza': {'rotation': {0: [20, 0, 0], 1.5: (0, 0, 0, E)}},
        }),
        'sello_mano': anim(1.5, None, sign),
        'idle_dominio': anim(2.0, True, {
            BI: {'rotation': {0: [-78, -48, 0], 2.0: [-78, -48, 0]}},
            BD: {'rotation': {0: [-78, 48, 0], 2.0: [-78, 48, 0]}},
            'cuerpo': {'scale': {0: [1, 1, 1], 1.0: (1.01, 1.025, 1.01, E), 2.0: (1, 1, 1, E)}},
            'cabeza': {'rotation': {0: [6, 0, 0], 1.0: (4, 4, 0, E), 2.0: (6, 0, 0, E)}},
        }),
        'corte_final': anim(1.0, None, {
            BD: {'rotation': {0: [-78, 48, 0], 0.35: (-160, -20, 40, 'easeOutQuad'), 0.6: (-20, 60, -30, 'easeInExpo'), 1.0: [-25, 55, -25]}},
            BI: {'rotation': {0: [-78, -48, 0], 0.6: [-10, 0, -20], 1.0: [-10, 0, -20]}},
            'cuerpo': {'rotation': {0: [0, 0, 0], 0.35: [0, 25, 0], 0.6: (8, -30, 0, 'easeInExpo'), 1.0: [6, -25, 0]}},
        }),
        'desaparicion': anim(1.0, None, {
            'root': {'scale': {0: [1, 1, 1], 0.3: [1.08, 1.08, 1.08], 1.0: (0.01, 1.4, 0.01, 'easeInBack')}},
        }),
        'idle': anim(2.0, True, {'cuerpo': {'scale': {0: [1, 1, 1], 1.0: (1.01, 1.02, 1.01, E), 2.0: (1, 1, 1, E)}}}),
    }))


# ---------------------------------------------------------------- GOJO (hechicero)
def gojo():
    A = Atlas('gojo')
    navy = (24, 28, 48)
    P = {
        'skin': A.solid((235, 200, 175), 8),
        'face': A.face((235, 200, 175), (150, 210, 255)),
        'hair': A.solid((150, 120, 210), 16),
        'top': A.solid(navy, 10),
        'top_front': A.pattern(navy, lambda d: (d.line([(7.5, 0), (7.5, 15)], fill=(60, 66, 100, 255), width=1), [d.point((7, y), fill=(200, 200, 220, 255)) for y in (3, 7, 11)])),
        'top_back': A.solid(navy, 10),
        'sleeve': A.solid(navy, 10),
        'forearm': A.solid(navy, 10),
        'hand': A.solid((245, 245, 250), 6),  # guantes
        'belt': A.solid((14, 16, 30), 6),
        'pants': A.solid((20, 22, 40), 8),
        'shoe': A.solid((10, 10, 14), 6),
        'trim': A.solid((60, 66, 100), 8),
    }
    A.save()
    g = Geo('gojo', 128, 128, bounds=(3, 4, 1.5))

    def hair(g, head):
        g.cube(head, (-4.4, 30, -4.4), (8.8, 2.6, 8.8), P['hair'])
        g.cube(head, (-4.4, 27, -0.5), (8.8, 4, 4.9), P['hair'])
        for i in range(4):
            x = -3 + i * 2
            g.cube(head, (x - 1.1, 31.6, -4), (2.2, 2.2, 7), P['hair'], rotation=(-12, 0, (x / 3) * 14), pivot=(x, 31.6, 0))

    def collar(g):
        # cuello alto del abrigo
        g.cube(g.bones[1], (-4.3, 22.5, -2.4), (8.6, 2.8, 4.8), P['top'])
        g.cube(g.bones[1], (-4.5, 3.5, -2.5), (9, 8, 5), P['top'])  # faldón del abrigo
    body(g, P, hair=hair, extra=collar, anchors={'mano_izquierda': None, 'mano_derecha': None, 'mano_proyectil': ('cuerpo', (0, 17, -6))})
    g.save()
    BI, BD = 'brazo_izquierdo', 'brazo_derecho'
    save_anims('gojo', flip_y({
        'aparicion': anim(1.5, None, {
            'root': {'position': {0: [0, 0, -14], 1.0: (0, 0, 0, 'easeOutExpo')}, 'scale': {0: [0.01, 0.01, 0.01], 0.4: (1, 1, 1, 'easeOutBack')}},
            BI: {'rotation': {0: [0, 0, -30], 1.5: (0, 0, -6, E)}},
            BD: {'rotation': {0: [0, 0, 30], 1.5: (0, 0, 6, E)}},
        }),
        # 0–2 s: brazos abiertos a los lados (azul a la izquierda, rojo a la derecha); 2–3 s: las manos se juntan delante.
        'carga': anim(3.0, None, {
            BI: {'rotation': {0: [0, 0, -6], 0.8: (-80, 0, -70, 'easeOutBack'), 2.0: [-85, 0, -72], 2.8: (-82, -50, 0, 'easeInOutCubic'), 3.0: [-82, -52, 0]}},
            BD: {'rotation': {0: [0, 0, 6], 0.8: (-80, 0, 70, 'easeOutBack'), 2.0: [-85, 0, 72], 2.8: (-82, 50, 0, 'easeInOutCubic'), 3.0: [-82, 52, 0]}},
            'cabeza': {'rotation': {0: [0, 0, 0], 2.0: [5, 0, 0], 3.0: [8, 0, 0]}},
        }),
        'disparo': anim(1.0, None, {
            BD: {'rotation': {0: [-82, 52, 0], 0.15: [-60, 30, 0], 0.3: (-92, 0, 0, 'easeOutBack'), 1.0: [-90, 0, 0]}},
            BI: {'rotation': {0: [-82, -52, 0], 0.3: (-20, 0, -30, 'easeOutQuad'), 1.0: [-15, 0, -25]}},
            'cuerpo': {'rotation': {0: [0, 0, 0], 0.15: [-6, 0, 0], 0.3: (8, -10, 0, 'easeOutQuad'), 1.0: [5, -8, 0]}},
        }),
        'pose_final': anim(2.0, True, {
            BI: {'rotation': {0: [-20, 0, -15], 2.0: [-20, 0, -15]}},
            BD: {'rotation': {0: [-110, -25, 0], 1.0: (-112, -28, 0, E), 2.0: (-110, -25, 0, E)}},
            'cabeza': {'rotation': {0: [-6, 10, 0], 2.0: [-6, 10, 0]}},
        }),
        'idle': anim(2.0, True, {'cuerpo': {'scale': {0: [1, 1, 1], 1.0: (1.01, 1.02, 1.01, E), 2.0: (1, 1, 1, E)}}}),
    }))


# ---------------------------------------------------------------- AKAZA (luchador)
def akaza():
    A = Atlas('akaza')
    cyan = (90, 220, 255)
    P = {
        'skin': A.solid((230, 175, 160), 8),
        'face': A.face((230, 175, 160), (255, 190, 60)),
        'hair': A.solid((200, 70, 110), 16),
        'top': A.solid((40, 40, 60), 10),
        'top_front': A.pattern((40, 40, 60), lambda d: d.line([(7.5, 0), (7.5, 15)], fill=cyan + (255,), width=1), glow_fn=lambda d: d.line([(7.5, 0), (7.5, 15)], fill=cyan + (255,), width=1)),
        'top_back': A.solid((40, 40, 60), 10),
        'sleeve': A.solid((230, 175, 160), 8),  # brazos al aire
        'forearm': A.pattern((230, 175, 160), lambda d: [d.line([(0, y), (15, y + 2)], fill=(60, 120, 200, 255)) for y in (3, 8, 12)]),
        'hand': A.pattern((235, 235, 240), lambda d: d.line([(0, 8), (15, 8)], fill=cyan + (255,), width=2), glow_fn=lambda d: d.line([(0, 8), (15, 8)], fill=cyan + (255,), width=2)),
        'belt': A.pattern((235, 235, 240), lambda d: d.line([(0, 8), (15, 8)], fill=(40, 40, 60, 255), width=1)),
        'pants': A.solid((110, 160, 210), 14),
        'shoe': A.solid((90, 70, 55), 8),
        'cuff': A.pattern((235, 235, 240), lambda d: None),
    }
    A.save()
    g = Geo('akaza', 128, 128, bounds=(3, 4, 1.5))
    body(g, P, hair=lambda g, h: spiky(g, h, P, 4, 3), anchors={'puno_derecho': None})
    g.save()
    BI, BD = 'brazo_izquierdo', 'brazo_derecho'
    stance = {
        'pierna_izquierda': {'rotation': {0: [0, 0, -18], 9: [0, 0, -18]}},
        'pierna_derecha': {'rotation': {0: [0, 0, 18], 9: [0, 0, 18]}},
    }
    save_anims('akaza', {
        'aparicion': anim(1.5, None, {
            'root': {'position': {0: [0, 24, 0], 0.5: (0, -3, 0, 'easeInQuad'), 0.9: (0, -2, 0, E), 1.5: (0, 0, 0, E)}},
            'cuerpo': {'rotation': {0: [0, 0, 0], 0.5: [25, 0, 0], 1.5: (0, 0, 0, E)}},
            BD: {'rotation': {0: [-40, 0, 20], 0.5: [10, 0, 35], 1.5: (0, 0, 8, E)}},
            BI: {'rotation': {0: [-40, 0, -20], 0.5: [10, 0, -35], 1.5: (0, 0, -8, E)}},
            'pierna_izquierda': {'rotation': {0.5: [-50, 0, -10], 1.5: (0, 0, -4, E)}},
            'pierna_derecha': {'rotation': {0.5: [-50, 0, 10], 1.5: (0, 0, 4, E)}},
        }),
        # Despliegue: piernas abiertas, brazos que trazan un círculo y terminan en guardia.
        'despliegue_tecnica': anim(2.0, None, {
            'root': {'position': {0: [0, 0, 0], 0.5: (0, -2, 0, E), 2.0: [0, -2, 0]}},
            BI: {'rotation': {0: [0, 0, -8], 0.6: (-60, 0, -90, E), 1.2: (-150, 0, -40, E), 2.0: (-70, -20, -10, 'easeOutBack')}},
            BD: {'rotation': {0: [0, 0, 8], 0.6: (-60, 0, 90, E), 1.2: (-150, 0, 40, E), 2.0: (-40, 20, 10, 'easeOutBack')}},
            'cabeza': {'rotation': {0: [0, 0, 0], 2.0: (8, 0, 0, E)}},
            'pierna_izquierda': {'rotation': {0: [0, 0, 0], 0.5: (0, 0, -18, E), 2.0: [0, 0, -18]}},
            'pierna_derecha': {'rotation': {0: [0, 0, 0], 0.5: (0, 0, 18, E), 2.0: [0, 0, 18]}},
        }),
        # Golpe al suelo: sube el puño derecho y baja con todo el cuerpo (contacto ≈ 0.75 s).
        'golpe_suelo': anim(1.0, None, {
            'root': {'position': {0: [0, -2, 0], 0.4: (0, 2, 0, 'easeOutQuad'), 0.75: (0, -7, 0, 'easeInExpo'), 1.0: [0, -6, 0]}},
            'cuerpo': {'rotation': {0: [0, 0, 0], 0.4: [-20, 0, 0], 0.75: (50, 0, 0, 'easeInExpo'), 1.0: [45, 0, 0]}},
            BD: {'rotation': {0: [-40, 20, 10], 0.4: (-175, 0, 20, 'easeOutQuad'), 0.75: (-40, 0, 0, 'easeInExpo'), 1.0: [-35, 0, 0]}},
            BI: {'rotation': {0: [-70, -20, -10], 0.75: [10, 0, -40], 1.0: [10, 0, -40]}},
            'pierna_izquierda': {'rotation': {0: [0, 0, -18], 0.75: [-60, 0, -20], 1.0: [-60, 0, -20]}},
            'pierna_derecha': {'rotation': {0: [0, 0, 18], 0.75: [40, 0, 18], 1.0: [40, 0, 18]}},
        }),
        'pose_final': anim(2.0, True, dict(stance, **{
            BI: {'rotation': {0: [-70, -20, -10], 1.0: (-72, -22, -10, E), 2.0: (-70, -20, -10, E)}},
            BD: {'rotation': {0: [-40, 20, 10], 1.0: (-42, 22, 10, E), 2.0: (-40, 20, 10, E)}},
            'cuerpo': {'scale': {0: [1, 1, 1], 1.0: (1.01, 1.02, 1.01, E), 2.0: (1, 1, 1, E)}},
        })),
        'idle': anim(2.0, True, {'cuerpo': {'scale': {0: [1, 1, 1], 1.0: (1.01, 1.02, 1.01, E), 2.0: (1, 1, 1, E)}}}),
    })


for f in (goku, sukuna, gojo, akaza):
    f()
print('personajes ok')
