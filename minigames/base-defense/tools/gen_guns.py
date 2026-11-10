"""Armas de Base Defense v4: modelos 3D más realistas con texturas de materiales (todo dibujado aquí).

Cada arma tiene su propia textura de 128×128 con 16 materiales de 32×32 px (acero pavonado con desgaste, acero
claro, polímero, goma con estriado, madera con veta, pintura oliva desconchada, arena, latón, cabeza de cohete…).
Las caras se mapean con densidad constante (no se estiran): 2 px de textura por unidad de modelo.

Convención: el cañón apunta a −Z (z bajo), la culata a +Z; x centrado en 8, la línea del cañón a y≈9.
"""
import json, math, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BD = os.path.join(HERE, '..', 'src', 'pack', 'assets', 'basedefense')
rng = np.random.default_rng(4242)
TS = 128          # tamaño de la textura
SW = 32           # tamaño de cada material
UV_PER_UNIT = 0.25  # UV (0..16) por unidad de modelo → 2 px por unidad


def mkdir(p):
    os.makedirs(p, exist_ok=True)
    return p


def noise2(w, h, scale, seed, octaves=3):
    r = np.random.default_rng(seed)
    out = np.zeros((h, w))
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        s = max(1, scale >> o)
        g = r.random((h // s + 2, w // s + 2))
        g = np.kron(g, np.ones((s, s)))[:h, :w]
        out += g * amp
        tot += amp
        amp *= 0.5
    return out / tot


def mat(name, seed):
    """Un material de SW×SW en RGB (0..255)."""
    n = noise2(SW, SW, 8, seed)
    fine = rng.random((SW, SW))
    y, x = np.mgrid[0:SW, 0:SW]

    def base(c, var=12):
        return np.clip(np.array(c, float)[None, None, :] + ((n - 0.5) * 2 * var + (fine - 0.5) * var * 0.6)[..., None], 0, 255)

    if name == 'acero':          # pavonado oscuro con cepillado y arañazos
        img = base((86, 90, 98), 12)
        img += ((np.sin(y * 2.7 + n * 6) * 3))[..., None]
        for _ in range(7):
            yy, xx, ln = rng.integers(0, SW), rng.integers(0, SW), rng.integers(4, 12)
            img[yy, xx:xx + ln] += 38
    elif name == 'acero_claro':  # acero gastado
        img = base((150, 153, 158), 10)
        img += (np.sin(y * 3.1) * 5)[..., None]
    elif name == 'polimero':     # negro mate con punteado
        img = base((52, 53, 56), 7)
        img[(fine > 0.93)] += 14
    elif name == 'goma':         # estriado en rombos
        img = base((44, 44, 46), 5)
        d = ((x + y) % 4 == 0) | ((x - y) % 4 == 0)
        img[d] += 18
    elif name == 'madera':       # nogal con veta
        t = np.sin((y + n * 9) * 0.9) * 0.5 + 0.5
        img = np.stack([120 + t * 40, 74 + t * 26, 40 + t * 16], -1) + ((fine - 0.5) * 8)[..., None]
        img[(n > 0.72)] *= 0.82
    elif name == 'oliva':        # pintura verde oliva con desconchones
        img = base((96, 104, 62), 10)
        chips = noise2(SW, SW, 4, seed + 7) > 0.76
        img[chips] = base((92, 95, 100), 8)[chips]
    elif name == 'arena':        # color arena (FDE)
        img = base((176, 152, 112), 9)
    elif name == 'laton':
        img = base((176, 136, 58), 14)
        img[:, ::3] *= 1.08
    elif name == 'cabeza':       # cabeza del cohete, rojo apagado
        img = base((118, 42, 34), 10)
    elif name == 'mira':         # punto de mira (verde tritio)
        img = base((20, 20, 22), 3)
        img[12:20, 12:20] = (120, 255, 140)
    elif name == 'boca':         # interior del cañón (casi negro)
        img = base((10, 10, 11), 2)
    elif name == 'quemado':      # acero ennegrecido por el calor
        img = base((64, 58, 54), 9)
        img[(n > 0.7)] += (30, 14, 4)
    elif name == 'tela':         # correa
        img = base((80, 76, 58), 7)
        img[:, ::2] *= 0.9
    elif name == 'guante':       # guante táctico negro con nudillos reforzados
        img = base((40, 40, 42), 6)
        img[::6, :] += 10
        img[(fine > 0.9)] += 12
    elif name == 'manga':        # manga de camuflaje ceniza
        c1 = noise2(SW, SW, 8, seed + 3)
        img = np.where((c1 > 0.6)[..., None], np.array([70, 72, 58.]), np.where((c1 < 0.38)[..., None], np.array([118, 112, 92.]), np.array([92, 92, 76.])))
        img = img + ((fine - 0.5) * 10)[..., None]
        img[:, ::5] *= 0.92
    elif name == 'gris':
        img = base((120, 122, 128), 9)
    else:
        img = base((90, 90, 90))
    img = np.clip(img, 0, 255)
    # bisel: borde superior/izquierdo más claro, inferior/derecho más oscuro
    img[0, :] = np.minimum(255, img[0, :] * 1.18)
    img[:, 0] = np.minimum(255, img[:, 0] * 1.12)
    img[-1, :] *= 0.72
    img[:, -1] *= 0.8
    return img


MATS = ['acero', 'acero_claro', 'polimero', 'goma', 'madera', 'oliva', 'arena', 'laton', 'cabeza', 'mira', 'boca', 'quemado', 'tela', 'gris', 'guante', 'manga']


def texture(seed):
    img = np.zeros((TS, TS, 4))
    for i, m in enumerate(MATS):
        cx, cy = i % 4, i // 4
        img[cy * SW:(cy + 1) * SW, cx * SW:(cx + 1) * SW, :3] = mat(m, seed + i * 13)
        img[cy * SW:(cy + 1) * SW, cx * SW:(cx + 1) * SW, 3] = 255
    return img


def face_uv(m, w, h):
    """UV de una cara de w×h unidades dentro del material m, sin estirar (hasta llenar el material)."""
    i = MATS.index(m)
    cx, cy = i % 4, i // 4
    u0, v0 = cx * 4, cy * 4  # cada material ocupa 4×4 en UV (0..16)
    k = min(UV_PER_UNIT, 3.6 / max(w, h, 0.01))
    du, dv = max(0.06, w * k), max(0.06, h * k)
    ou, ov = 0.2, 0.2
    return [round(u0 + ou, 3), round(v0 + ov, 3), round(u0 + ou + du, 3), round(v0 + ov + dv, 3)]


def box(fr, to, m, rot=None, ends=None):
    """Caja con material m. ends = material de las caras norte/sur (p. ej. la boca del cañón)."""
    sx, sy, sz = (to[0] - fr[0]), (to[1] - fr[1]), (to[2] - fr[2])
    faces = {
        'north': face_uv(ends or m, sx, sy), 'south': face_uv(m, sx, sy),
        'east': face_uv(m, sz, sy), 'west': face_uv(m, sz, sy),
        'up': face_uv(m, sx, sz), 'down': face_uv(m, sx, sz),
    }
    e = {'from': [round(v, 3) for v in fr], 'to': [round(v, 3) for v in to], 'faces': {f: {'uv': uv, 'texture': '#0'} for f, uv in faces.items()}}
    if rot:
        e['rotation'] = rot
    return e


def rx(angle, origin):
    return {'angle': angle, 'axis': 'x', 'origin': list(origin)}


def rz(angle, origin):
    return {'angle': angle, 'axis': 'z', 'origin': list(origin)}


def tube(cx, cy, z0, z1, r, m, ends=None):
    """Cilindro aproximado: dos cajas en cruz y una girada 45° (aspecto octogonal)."""
    return [
        box((cx - r, cy - r * 0.42, z0), (cx + r, cy + r * 0.42, z1), m, ends=ends),
        box((cx - r * 0.42, cy - r, z0), (cx + r * 0.42, cy + r, z1), m, ends=ends),
        box((cx - r * 0.72, cy - r * 0.72, z0), (cx + r * 0.72, cy + r * 0.72, z1), m, rz(45, (cx, cy, (z0 + z1) / 2)), ends=ends),
    ]


# ─────────────────────────── armas ───────────────────────────

def pistola():
    e = []
    e += [box((7.05, 8.6, 0.6), (8.95, 10.5, 10.2), 'acero')]                 # corredera
    for z in (7.4, 8.0, 8.6, 9.2):                                             # estrías de agarre de la corredera
        e.append(box((6.95, 8.9, z), (9.05, 10.2, z + 0.3), 'boca'))
    e += [box((8.95, 9.4, 3.0), (9.1, 10.1, 5.6), 'boca')]                     # ventana de expulsión
    e += [box((7.55, 9.05, 0.3), (8.45, 9.95, 0.6), 'boca', ends='boca')]      # boca
    e += [box((7.15, 7.6, 1.8), (8.85, 8.6, 10.0), 'polimero')]               # armazón
    e += [box((7.3, 7.2, 1.8), (8.7, 7.6, 4.2), 'polimero')]                  # riel inferior
    e += [box((7.2, 3.4, 7.0), (8.8, 7.7, 9.9), 'goma', rx(-22.5, (8, 7.7, 8.5)))]  # empuñadura
    e += [box((7.35, 3.0, 7.4), (8.65, 3.5, 9.6), 'polimero', rx(-22.5, (8, 7.7, 8.5)))]  # base del cargador
    e += [box((7.65, 6.0, 5.0), (8.35, 7.6, 5.5), 'acero')]                   # gatillo
    e += [box((7.45, 5.6, 3.8), (8.55, 5.95, 7.2), 'polimero'), box((7.45, 5.6, 3.8), (8.55, 7.6, 4.2), 'polimero')]  # guardamonte
    e += [box((7.7, 10.5, 1.2), (8.3, 11.0, 1.9), 'mira')]                    # mira delantera
    e += [box((7.25, 10.5, 9.2), (7.7, 11.1, 9.9), 'polimero'), box((8.3, 10.5, 9.2), (8.75, 11.1, 9.9), 'polimero')]  # mira trasera
    e += [box((7.6, 9.6, 10.2), (8.4, 10.3, 10.7), 'acero_claro')]            # martillo
    return e


def subfusil():
    e = []
    e += [box((6.9, 8.0, -1.5), (9.1, 10.5, 9.0), 'polimero')]                # cajón
    e += [box((7.0, 10.5, -0.5), (9.0, 10.9, 7.5), 'acero')]                  # riel superior
    for z in range(0, 7, 1):
        e.append(box((6.95, 10.9, z + 0.1), (9.05, 11.1, z + 0.5), 'acero'))
    e += [box((6.75, 7.6, -6.0), (9.25, 10.3, -1.5), 'polimero')]             # guardamanos
    for z in (-5.3, -4.3, -3.3):
        e.append(box((6.7, 8.6, z), (9.3, 9.5, z + 0.4), 'boca'))           # ranuras de ventilación
    e += tube(8, 9.2, -10.5, -6.0, 0.9, 'acero', ends='boca')                 # cañón con supresor
    e += [box((7.25, 2.2, 0.6), (8.75, 8.0, 2.6), 'acero', rx(22.5, (8, 8, 1.6)))]   # cargador curvo (dos tramos)
    e += [box((7.25, 0.4, 1.8), (8.75, 2.6, 3.6), 'acero', rx(22.5, (8, 2.4, 2.6)))]
    e += [box((7.2, 3.6, 6.2), (8.8, 8.0, 8.4), 'goma', rx(-22.5, (8, 8, 7.3)))]  # empuñadura
    e += [box((7.6, 6.6, 4.6), (8.4, 8.0, 5.1), 'acero')]                     # gatillo
    e += [box((7.4, 6.2, 3.8), (8.6, 6.55, 6.4), 'polimero')]
    e += [box((7.5, 8.6, 9.0), (8.5, 9.4, 14.6), 'acero'), box((7.5, 7.0, 9.0), (8.5, 7.8, 14.6), 'acero')]  # culata de varillas
    e += [box((7.1, 6.8, 14.6), (8.9, 9.8, 15.6), 'goma')]                    # cantonera
    e += [box((7.4, 11.1, 2.4), (8.6, 12.4, 6.0), 'polimero'), box((7.6, 12.4, 2.8), (8.4, 12.9, 3.4), 'mira')]  # visor rojo
    e += [box((9.1, 9.0, 2.0), (9.35, 9.8, 4.0), 'boca')]                     # ventana de expulsión
    e += [box((6.65, 9.6, 6.5), (6.9, 10.0, 7.3), 'acero_claro')]             # palanca de carga
    return e


def ametralladora():
    e = []
    e += [box((6.6, 7.8, -2.0), (9.4, 11.0, 11.0), 'oliva')]                  # cajón
    e += [box((6.5, 10.9, -1.5), (9.5, 11.3, 8.0), 'acero')]                  # tapa
    e += [box((6.9, 8.2, -12.0), (9.1, 10.6, -2.0), 'quemado')]               # camisa de refrigeración
    for z in range(-11, -2, 2):
        e.append(box((6.85, 9.0, z), (9.15, 9.8, z + 0.6), 'boca'))          # agujeros de la camisa
    e += tube(8, 9.4, -15.2, -12.0, 0.6, 'acero', ends='boca')               # cañón
    e += [box((7.3, 8.8, -16.0), (8.7, 10.0, -15.2), 'quemado', ends='boca')]  # apagallamas
    e += [box((6.0, 3.6, 0.0), (10.0, 7.8, 4.2), 'oliva'), box((5.95, 6.9, 0.2), (10.05, 7.3, 4.0), 'acero')]  # caja de munición
    for i in range(5):                                                       # cinta de balas
        e.append(box((5.4, 7.2 + i * 0.4, 1.0 + i * 0.2), (6.0, 7.6 + i * 0.4, 3.2 + i * 0.2), 'laton'))
    e += [box((7.2, 3.6, 6.0), (8.8, 7.8, 8.2), 'goma', rx(-22.5, (8, 7.8, 7.1)))]   # empuñadura
    e += [box((7.6, 6.6, 4.8), (8.4, 7.8, 5.3), 'acero'), box((7.4, 6.2, 4.2), (8.6, 6.55, 6.6), 'acero')]
    e += [box((7.0, 7.2, 11.0), (9.0, 10.6, 17.0), 'madera'), box((7.1, 6.4, 13.5), (8.9, 7.2, 17.0), 'madera')]  # culata
    e += [box((6.9, 6.6, 17.0), (9.1, 10.8, 17.6), 'goma')]
    e += [box((7.5, 11.3, 0.5), (8.5, 13.0, 1.3), 'acero'), box((7.5, 12.4, 0.5), (8.5, 13.0, 6.5), 'acero'), box((7.5, 11.3, 5.7), (8.5, 13.0, 6.5), 'acero')]  # asa
    e += [box((7.7, 10.6, -11.4), (8.3, 11.6, -10.8), 'mira')]                # mira
    e += [box((7.5, 4.0, -10.4), (8.1, 8.2, -9.8), 'acero', rx(22.5, (7.8, 8.2, -10.1))), box((7.9, 4.0, -10.4), (8.5, 8.2, -9.8), 'acero', rx(-22.5, (8.2, 8.2, -10.1)))]  # bípode
    e += [box((6.55, 8.6, 9.0), (6.65, 10.4, 11.0), 'tela')]                  # anilla de correa
    return e


def lanzagranadas():
    e = []
    e += tube(8, 9.2, -1.0, 5.0, 2.3, 'acero')                               # tambor de 6
    for a in range(6):                                                       # recámaras visibles
        ang = a * math.pi / 3
        x, y = 8 + math.cos(ang) * 1.45, 9.2 + math.sin(ang) * 1.45
        e.append(box((x - 0.5, y - 0.5, -1.15), (x + 0.5, y + 0.5, -0.95), 'laton'))
    e += [box((7.6, 8.8, -1.0), (8.4, 9.6, 5.0), 'acero_claro')]              # eje
    e += tube(8, 10.6, -7.5, -1.0, 1.25, 'polimero', ends='boca')            # cañón ancho
    e += [box((6.6, 8.6, -6.5), (9.4, 9.6, -1.5), 'polimero')]               # guardamanos inferior
    e += [box((7.6, 7.2, -6.0), (8.4, 8.6, -4.6), 'goma')]                   # empuñadura delantera
    e += [box((7.6, 6.0, -5.9), (8.4, 7.2, -4.7), 'goma', rx(22.5, (8, 7.2, -5.3)))]
    e += [box((7.0, 8.4, 5.0), (9.0, 10.8, 9.5), 'polimero')]                # cuerpo
    e += [box((7.2, 3.6, 6.6), (8.8, 8.4, 8.8), 'goma', rx(-22.5, (8, 8.4, 7.7)))]
    e += [box((7.6, 7.0, 5.6), (8.4, 8.4, 6.1), 'acero')]
    e += [box((7.2, 7.4, 9.5), (8.8, 10.0, 15.5), 'arena'), box((7.1, 6.8, 15.5), (8.9, 10.2, 16.2), 'goma')]  # culata
    e += [box((7.4, 11.8, -0.5), (8.6, 12.8, 3.5), 'acero'), box((7.7, 12.8, 0.0), (8.3, 13.4, 0.6), 'mira')]  # mira de hoja
    return e


def lanzacohetes():
    e = []
    e += tube(8, 9.0, -6.0, 15.5, 2.0, 'oliva')                              # tubo
    e += [box((6.2, 7.2, 4.5), (9.8, 10.8, 7.5), 'madera')]                  # protector térmico de madera
    e += tube(8, 9.0, 15.5, 16.6, 2.2, 'polimero', ends='boca')             # tobera trasera (campana)
    e += tube(8, 9.0, -6.6, -6.0, 2.2, 'polimero', ends='boca')             # boca
    e += tube(8, 9.0, -9.5, -6.6, 1.5, 'cabeza')                            # ojiva
    e += tube(8, 9.0, -11.2, -9.5, 0.9, 'cabeza')
    e += [box((7.7, 8.7, -12.0), (8.3, 9.3, -11.2), 'acero_claro')]          # espoleta
    e += [box((6.3, 7.3, -6.4), (6.6, 10.7, -5.6), 'acero'), box((9.4, 7.3, -6.4), (9.7, 10.7, -5.6), 'acero')]  # aletas
    e += [box((7.2, 2.6, 3.0), (8.8, 7.2, 5.0), 'goma', rx(-22.5, (8, 7.2, 4)))]   # empuñadura con gatillo
    e += [box((7.6, 5.6, 2.0), (8.4, 7.0, 2.5), 'acero')]
    e += [box((7.2, 3.0, 9.0), (8.8, 7.2, 10.6), 'goma')]                    # empuñadura trasera
    e += [box((9.9, 9.6, 1.0), (11.5, 11.6, 5.0), 'polimero')]               # visor óptico
    e += tube(10.7, 10.6, 0.6, 1.0, 0.7, 'boca')
    e += [box((10.2, 11.2, 4.6), (11.2, 11.8, 5.2), 'goma')]                 # ocular
    e += [box((5.9, 8.4, 10.0), (6.1, 9.6, 12.0), 'tela')]
    return e


def minigun():
    e = []
    e += [box((5.6, 6.1, 2.0), (10.4, 11.9, 12.0), 'polimero')]             # carcasa del motor
    for z in (3.5, 5.0, 6.5):
        e.append(box((5.5, 7.0, z), (10.5, 11.0, z + 0.5), 'acero'))       # disipadores
    e += tube(8, 9.0, 0.0, 2.0, 2.9, 'acero')                                # tambor
    for a in range(6):                                                       # 6 cañones giratorios
        ang = a * math.pi / 3
        x, y = 8 + math.cos(ang) * 1.75, 9 + math.sin(ang) * 1.75
        e.append(box((x - 0.45, y - 0.45, -15.0), (x + 0.45, y + 0.45, 0.0), 'quemado', ends='boca'))
    e += tube(8, 9.0, -12.5, -11.6, 2.5, 'acero_claro')                      # abrazaderas
    e += tube(8, 9.0, -5.0, -4.1, 2.5, 'acero_claro')
    e += [box((7.6, 8.6, -15.0), (8.4, 9.4, 0.0), 'acero')]                  # eje central
    e += [box((7.2, 2.4, 7.0), (8.8, 6.1, 9.0), 'goma')]                     # empuñadura
    e += [box((7.6, 5.0, 6.0), (8.4, 6.1, 6.5), 'acero')]
    e += [box((6.4, 11.9, 3.5), (9.6, 12.4, 4.2), 'acero'), box((6.4, 11.9, 9.3), (9.6, 12.4, 10.0), 'acero'), box((6.4, 12.4, 3.5), (9.6, 13.4, 10.0), 'goma')]  # asa
    e += [box((10.4, 3.8, 3.0), (14.2, 9.2, 9.0), 'oliva'), box((10.35, 8.4, 3.2), (14.25, 8.9, 8.8), 'acero')]  # caja de munición
    for i in range(4):
        e.append(box((10.0 - i * 0.3, 8.8 + i * 0.35, 4.2), (10.6 - i * 0.3, 9.2 + i * 0.35, 7.8), 'laton'))  # cinta
    e += [box((7.4, 6.1, 12.0), (8.6, 8.0, 13.2), 'acero_claro')]            # batería
    return e


def caja_municion():
    e = [box((3, 0, 4), (13, 6.6, 12), 'oliva'), box((2.8, 6.0, 3.8), (13.2, 7.2, 12.2), 'acero'),
         box((7, 7.2, 7), (9, 8, 9), 'polimero'), box((3.1, 2.5, 3.9), (12.9, 3.2, 12.1), 'arena')]
    for i in range(4):
        e.append(box((4 + i * 2.2, 6.6, 8.6), (5.2 + i * 2.2, 8.8, 9.8), 'laton'))
    return e


def cohete_vuelo():
    """Cohete en vuelo: la punta mira a +Z (el plugin lo orienta según la velocidad)."""
    e = []
    e += tube(8, 8, 2.0, 11.0, 1.3, 'oliva')
    e += tube(8, 8, 11.0, 13.5, 1.3, 'cabeza')
    e += tube(8, 8, 13.5, 15.2, 0.8, 'cabeza')
    e += [box((7.7, 7.7, 15.2), (8.3, 8.3, 16.0), 'acero_claro')]
    e += [box((5.4, 7.8, 1.0), (10.6, 8.2, 4.0), 'acero'), box((7.8, 5.4, 1.0), (8.2, 10.6, 4.0), 'acero')]  # aletas
    e += [box((7.1, 7.1, 0.4), (8.9, 8.9, 2.0), 'quemado', ends='boca')]
    return e


def granada_vuelo():
    """Proyectil de 40 mm: vaina de latón y ojiva verde."""
    e = []
    e += tube(8, 8, 4.0, 9.0, 1.6, 'laton')
    e += tube(8, 8, 9.0, 11.5, 1.6, 'oliva')
    e += tube(8, 8, 11.5, 12.8, 1.0, 'oliva')
    e += [box((6.3, 6.3, 3.6), (9.7, 9.7, 4.2), 'laton')]
    return e


def avion():
    """Bombardero (la nariz mira a +Z). En el juego va a escala ~5."""
    e = []
    e += tube(8, 8, -12.0, 26.0, 2.6, 'gris')                               # fuselaje
    e += tube(8, 8, 26.0, 30.0, 1.8, 'gris')                                # morro
    e += [box((6.6, 9.4, 18.0), (9.4, 11.4, 24.0), 'boca')]                 # cabina
    e += [box((6.7, 9.6, 18.4), (9.3, 11.2, 23.6), 'mira')]                 # cristal (brillo)
    e += [box((-14.0, 7.3, 4.0), (30.0, 8.3, 13.0), 'gris')]                # alas
    e += [box((-14.0, 7.25, 4.0), (-10.0, 8.35, 13.0), 'cabeza'), box((26.0, 7.25, 4.0), (30.0, 8.35, 13.0), 'cabeza')]  # puntas
    for x in (-3.5, 19.5):                                                   # motores
        e += tube(x, 7.2, 4.0, 15.0, 1.4, 'acero')
        e += [box((x - 0.3, 3.8, 15.0), (x + 0.3, 10.6, 15.4), 'polimero'), box((x - 3.4, 6.9, 15.0), (x + 3.4, 7.5, 15.4), 'polimero')]  # hélices
    e += [box((1.0, 7.6, -12.0), (15.0, 8.4, -6.0), 'gris')]                # estabilizador
    e += [box((7.6, 8.0, -12.0), (8.4, 15.0, -5.0), 'gris')]                # deriva
    e += [box((7.55, 11.0, -11.6), (8.45, 14.0, -9.0), 'cabeza')]           # marca roja
    e += [box((6.0, 5.0, 2.0), (10.0, 5.6, 14.0), 'boca')]                  # compuerta de bombas
    return e


def bomba():
    """Bomba de caída (la punta mira a +Z)."""
    e = []
    e += tube(8, 8, 3.0, 12.0, 1.8, 'oliva')
    e += tube(8, 8, 12.0, 14.5, 1.2, 'oliva')
    e += [box((7.4, 7.4, 14.5), (8.6, 8.6, 15.4), 'acero')]
    e += [box((5.0, 7.8, 0.5), (11.0, 8.2, 4.0), 'acero'), box((7.8, 5.0, 0.5), (8.2, 11.0, 4.0), 'acero')]
    e += [box((6.1, 6.1, 9.0), (9.9, 9.9, 9.6), 'cabeza')]                  # franja
    return e


def bloqueada():
    """Candado (arma aún bloqueada)."""
    e = [box((4.5, 2.5, 6.5), (11.5, 9.5, 9.5), 'gris'),
         box((7.4, 4.5, 6.3), (8.6, 7.0, 6.5), 'boca'),
         box((5.5, 9.5, 7.3), (6.7, 13.5, 8.7), 'acero_claro'), box((9.3, 9.5, 7.3), (10.5, 13.5, 8.7), 'acero_claro'),
         box((5.5, 12.5, 7.3), (10.5, 13.8, 8.7), 'acero_claro')]
    return e


def arms(grip, fore, two_hand=True, fore_top=False):
    """Brazos en primera persona: guante derecho en la empuñadura con el antebrazo saliendo hacia la cámara (abajo a la
    derecha) y guante izquierdo en el guardamanos con el antebrazo cruzando hacia abajo a la izquierda."""
    gx, gy, gz = grip
    e = []
    e += [box((gx - 1.25, gy - 1.6, gz - 1.3), (gx + 1.25, gy + 1.6, gz + 1.3), 'guante')]                       # mano derecha
    e += [box((gx - 0.6, gy + 0.4, gz - 2.2), (gx + 0.2, gy + 1.0, gz - 1.2), 'guante')]                         # dedo en el gatillo
    e += [box((gx - 1.4, gy - 4.0, gz + 0.6), (gx + 1.6, gy - 0.6, gz + 13.0), 'guante', rx(22.5, (gx, gy - 0.6, gz + 0.6)))]  # muñeca
    e += [box((gx - 1.9, gy - 5.2, gz + 6.0), (gx + 2.2, gy - 0.8, gz + 22.0), 'manga', rx(22.5, (gx, gy - 0.6, gz + 0.6)))]   # manga
    if two_hand and fore:
        fx, fy, fz = fore
        if fore_top:
            e += [box((fx - 1.3, fy - 0.4, fz - 1.3), (fx + 1.3, fy + 1.4, fz + 1.3), 'guante')]
            e += [box((fx - 4.2, fy - 1.5, fz + 0.2), (fx - 1.0, fy + 1.2, fz + 14.0), 'manga', rx(22.5, (fx, fy, fz)))]
        else:
            e += [box((fx - 1.6, fy - 1.4, fz - 1.4), (fx + 1.6, fy + 0.6, fz + 1.4), 'guante')]                  # mano izquierda
            e += [box((fx - 3.6, fy - 3.4, fz + 0.4), (fx - 0.8, fy - 0.6, fz + 10.0), 'guante', rx(22.5, (fx, fy - 0.6, fz)))]
            e += [box((fx - 4.3, fy - 4.6, fz + 6.0), (fx - 0.4, fy - 0.6, fz + 21.0), 'manga', rx(22.5, (fx, fy - 0.6, fz)))]
    return e


# empuñadura (mano derecha) y guardamanos (mano izquierda) de cada arma
HANDS = {
    'pistola': ((8, 6.0, 8.6), (8.2, 4.6, 7.2), False),
    'subfusil': ((8, 6.2, 7.4), (8, 7.4, -4.0), False),
    'ametralladora': ((8, 6.2, 7.2), (8, 7.8, -7.0), False),
    'lanzagranadas': ((8, 6.4, 7.8), (8, 6.6, -5.3), False),
    'lanzacohetes': ((8, 5.0, 4.0), (8, 5.2, 9.8), False),
    'minigun': ((8, 4.6, 8.0), (8, 12.9, 6.8), True),
}

GUNS = {
    'pistola': (pistola, 1.2), 'subfusil': (subfusil, 0.95), 'ametralladora': (ametralladora, 0.72),
    'lanzagranadas': (lanzagranadas, 0.88), 'lanzacohetes': (lanzacohetes, 0.7), 'minigun': (minigun, 0.74),
}


def display(k):
    fp = round(1.0 * k, 3)
    return {
        'thirdperson_righthand': {'rotation': [0, 0, 0], 'translation': [0, 2.5, -1.5], 'scale': [0.62 * k] * 3},
        'thirdperson_lefthand': {'rotation': [0, 0, 0], 'translation': [0, 2.5, -1.5], 'scale': [0.62 * k] * 3},
        'firstperson_righthand': {'rotation': [2, 4, 0], 'translation': [-5.5, 4.0, -2.0], 'scale': [fp] * 3},
        'firstperson_lefthand': {'rotation': [0, -5, 0], 'translation': [-0.5, 0.5, -4], 'scale': [fp] * 3},
        'gui': {'rotation': [15, -90, 0], 'translation': [0, 0, 0], 'scale': [0.62 * k] * 3},
        'ground': {'rotation': [0, 0, 0], 'translation': [0, 2, 0], 'scale': [0.5] * 3},
        'fixed': {'rotation': [0, -90, 0], 'translation': [0, 0, 0], 'scale': [0.8] * 3},
    }


def write(name, elements, disp, seed, fp=None):
    img = texture(seed)
    p = os.path.join(BD, 'textures', 'item', name + '.png')
    mkdir(os.path.dirname(p))
    Image.fromarray(img.astype(np.uint8), 'RGBA').save(p)
    model = {'texture_size': [TS, TS], 'textures': {'0': 'basedefense:item/' + name, 'particle': 'basedefense:item/' + name},
             'elements': elements, 'display': disp}
    mp = os.path.join(BD, 'models', 'item', name + '.json')
    mkdir(os.path.dirname(mp))
    json.dump(model, open(mp, 'w'), indent=1)
    ip = os.path.join(BD, 'items', name + '.json')
    mkdir(os.path.dirname(ip))
    base = {'type': 'minecraft:model', 'model': 'basedefense:item/' + name}
    if fp is None:
        json.dump({'model': base}, open(ip, 'w'), indent=1)
        return
    # en primera persona, el modelo con los brazos sujetando el arma
    fpm = dict(model)
    fpm['elements'] = elements + fp
    json.dump(fpm, open(os.path.join(BD, 'models', 'item', name + '_fp.json'), 'w'), indent=1)
    json.dump({'model': {'type': 'minecraft:select', 'property': 'minecraft:display_context',
                         'cases': [{'when': ['firstperson_righthand', 'firstperson_lefthand'], 'model': {'type': 'minecraft:model', 'model': 'basedefense:item/' + name + '_fp'}}],
                         'fallback': base}}, open(ip, 'w'), indent=1)


def guns():
    for i, (name, (fn, k)) in enumerate(GUNS.items()):
        g, f, top = HANDS[name]
        write(name, fn(), display(k), 100 + i * 31, fp=arms(g, f, True, top))
    write('caja_municion', caja_municion(), {'gui': {'rotation': [30, 45, 0], 'scale': [0.62] * 3}, 'ground': {'scale': [0.5] * 3}, 'fixed': {'scale': [0.8] * 3}}, 900)
    write('cohete_vuelo', cohete_vuelo(), {}, 970)
    write('avion', avion(), {}, 990)
    write('bomba', bomba(), {}, 995)
    write('granada_vuelo', granada_vuelo(), {}, 980)
    ip = os.path.join(BD, 'items', 'vacio.json')
    json.dump({'model': {'type': 'minecraft:empty'}}, open(ip, 'w'))
    write('bloqueada', bloqueada(), {'gui': {'rotation': [15, -30, 0], 'scale': [0.8] * 3}, 'firstperson_righthand': {'rotation': [0, -20, 0], 'translation': [2, -1, -2], 'scale': [0.28] * 3},
                                     'thirdperson_righthand': {'scale': [0.4] * 3}, 'ground': {'scale': [0.4] * 3}, 'fixed': {'scale': [0.8] * 3}}, 950)
    print('armas: modelos', len(GUNS) + 2)


if __name__ == '__main__':
    guns()
