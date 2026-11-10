"""Pack de texturas de Base Defense (todo generado aquí, sin copiar texturas ni sonidos ajenos).

- Texturas apocalípticas de los bloques de la arena (tierra ceniza, troncos quemados, ladrillo sucio…), sol rojizo y
  nubes de ceniza.
- Corrección de color (shader): desatura, tiñe a ceniza cálida, sube el contraste y oscurece los bordes de la
  pantalla. Solo mientras el pack está puesto (el plugin lo pone al empezar la partida y lo quita al acabar).
- Modelos 3D de las 6 armas y de la caja de munición.
- Sonidos de disparo, recarga, explosión y sirena sintetizados.

Uso: python3 tools/gen_pack.py  →  src/pack/  (Gradle lo comprime en basedefense-pack.zip dentro del plugin)
"""
import json, math, os, shutil, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'src', 'pack')
MC = os.path.join(OUT, 'assets', 'minecraft')
BD = os.path.join(OUT, 'assets', 'basedefense')
rng = np.random.default_rng(1337)

# Sintetizador de sonidos compartido con el mod de cinemáticas
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', 'mod', 'tools'))
import gen_sonidos as S  # noqa: E402


def mkdir(p):
    os.makedirs(p, exist_ok=True)
    return p


def save_png(arr, path):
    mkdir(os.path.dirname(path))
    a = np.clip(arr, 0, 255).astype(np.uint8)
    Image.fromarray(a, 'RGBA' if a.shape[2] == 4 else 'RGB').save(path)


# ─────────────────────────── ruido y utilidades de píxel ───────────────────────────

def value_noise(w, h, scale, seed, octaves=3):
    r = np.random.default_rng(seed)
    out = np.zeros((h, w))
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        s = max(1, int(scale / (2 ** o)))
        gw, gh = w // s + 2, h // s + 2
        g = r.random((gh, gw))
        ys, xs = np.mgrid[0:h, 0:w]
        fx, fy = xs / s, ys / s
        x0, y0 = fx.astype(int), fy.astype(int)
        tx, ty = fx - x0, fy - y0
        tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
        a = g[y0 % gh, x0 % gw] * (1 - tx) + g[y0 % gh, (x0 + 1) % gw] * tx
        b = g[(y0 + 1) % gh, x0 % gw] * (1 - tx) + g[(y0 + 1) % gh, (x0 + 1) % gw] * tx
        out += (a * (1 - ty) + b * ty) * amp
        norm += amp
        amp *= 0.5
    return out / norm


def palette(t, cols):
    """t (0..1) → color interpolando una lista de colores."""
    cols = np.array(cols, dtype=float)
    n = len(cols) - 1
    i = np.clip((t * n).astype(int), 0, n - 1)
    f = (t * n - i)[..., None]
    return cols[i] * (1 - f) + cols[i + 1] * f


def rgba(rgb, alpha=255):
    a = np.full(rgb.shape[:2] + (1,), alpha, dtype=float)
    return np.concatenate([rgb, a], axis=2)


def speckle(img, chance, col, seed):
    r = np.random.default_rng(seed)
    m = r.random(img.shape[:2]) < chance
    img[m, :3] = col
    return img


# ─────────────────────────── texturas de bloques ───────────────────────────

ASH_DIRT = [(48, 40, 36), (70, 58, 50), (92, 78, 66), (110, 98, 88)]
BURNT = [(18, 15, 14), (34, 28, 25), (52, 43, 37), (70, 60, 52)]


def tex_ground(seed, cols, pebbles=0.0, pebble_col=(120, 116, 110), scale=6):
    n = value_noise(16, 16, scale, seed) * 0.7 + rng.random((16, 16)) * 0.3
    img = rgba(palette(n, cols))
    if pebbles:
        img = speckle(img, pebbles, pebble_col, seed + 1)
        img = speckle(img, pebbles * 0.6, tuple(int(c * 0.6) for c in pebble_col), seed + 2)
    return img


def tex_mud(seed):
    n = value_noise(16, 16, 5, seed)
    img = rgba(palette(n, [(34, 28, 26), (50, 40, 36), (64, 52, 46)]))
    # charcos de sangre seca
    m = value_noise(16, 16, 4, seed + 9) > 0.72
    img[m, :3] = [62, 18, 16]
    return img


def tex_log_side(seed, cols, cracks=(255, 90, 20)):
    img = np.zeros((16, 16, 4))
    for x in range(16):
        base = rng.random() * 0.4 + 0.3
        for y in range(16):
            v = base + (rng.random() - 0.5) * 0.25 + (0.25 if (x % 4 == 0) else 0)
            img[y, x, :3] = palette(np.array([[min(1, max(0, v))]]), cols)[0, 0]
    img[..., 3] = 255
    # brasas en las grietas del tronco quemado
    if cracks:
        for _ in range(3):
            x, y = rng.integers(0, 16), rng.integers(0, 14)
            img[y:y + 2, x, :3] = cracks
    return img


def tex_log_top(seed, cols, ring=(80, 60, 45)):
    img = np.zeros((16, 16, 4))
    for y in range(16):
        for x in range(16):
            d = math.hypot(x - 7.5, y - 7.5)
            v = 0.5 + 0.5 * math.sin(d * 1.4) if d < 6.5 else 0.15
            img[y, x, :3] = palette(np.array([[v]]), cols)[0, 0]
    img[..., 3] = 255
    return img


def tex_planks(seed, cols, nails=True):
    img = np.zeros((16, 16, 4))
    for row in range(4):
        shade = rng.random() * 0.4
        for y in range(row * 4, row * 4 + 4):
            for x in range(16):
                grain = math.sin((x + row * 5) * 0.9 + y * 0.3) * 0.1
                v = 0.35 + shade + grain + (rng.random() - 0.5) * 0.15
                if y == row * 4 + 3:
                    v = 0.05
                img[y, x, :3] = palette(np.array([[min(1, max(0, v))]]), cols)[0, 0]
        cut = rng.integers(3, 13)
        img[row * 4:row * 4 + 3, cut, :3] *= 0.4
        if nails:
            img[row * 4 + 1, 1, :3] = [140, 130, 120]
            img[row * 4 + 1, 14, :3] = [140, 130, 120]
    img[..., 3] = 255
    # chamuscado
    burn = value_noise(16, 16, 6, seed) > 0.68
    img[burn, :3] *= 0.35
    return img


def tex_bricks(seed, cols, cracked=False, moss=None):
    img = np.zeros((16, 16, 4))
    n = value_noise(16, 16, 4, seed)
    for y in range(16):
        for x in range(16):
            row = y // 4
            off = 4 if row % 2 else 0
            mortar = (y % 4 == 3) or ((x + off) % 8 == 7)
            v = 0.1 if mortar else 0.4 + n[y, x] * 0.5
            img[y, x, :3] = palette(np.array([[v]]), cols)[0, 0]
    img[..., 3] = 255
    if cracked:
        x, y = 3, 2
        for _ in range(12):
            img[y % 16, x % 16, :3] = cols[0]
            x += rng.integers(-1, 2)
            y += 1
    if moss is not None:
        m = value_noise(16, 16, 5, seed + 4) > 0.6
        img[m, :3] = img[m, :3] * 0.4 + np.array(moss) * 0.6
    # hollín y manchas de sangre seca
    soot = value_noise(16, 16, 6, seed + 7) > 0.7
    img[soot, :3] *= 0.5
    blood = (value_noise(16, 16, 3, seed + 11) > 0.83)
    img[blood, :3] = img[blood, :3] * 0.3 + np.array([90, 14, 12]) * 0.7
    return img


def tex_leaves(seed):
    img = np.zeros((16, 16, 4))
    n = value_noise(16, 16, 3, seed)
    alive = (n > 0.42) & (rng.random((16, 16)) > 0.25)
    col = palette(rng.random((16, 16)), [(48, 38, 26), (72, 52, 30), (96, 66, 34), (60, 58, 40)])
    img[..., :3] = col
    img[..., 3] = np.where(alive, 255, 0)
    return img


def tex_moss(seed):
    return tex_ground(seed, [(46, 48, 30), (62, 62, 38), (78, 74, 48)], pebbles=0.05, pebble_col=(40, 36, 30))


def blocks():
    T = os.path.join(MC, 'textures', 'block')
    out = {
        'dirt': tex_ground(1, ASH_DIRT, 0.03),
        'coarse_dirt': tex_ground(2, ASH_DIRT, 0.14),
        'rooted_dirt': tex_ground(3, ASH_DIRT, 0.05, (30, 24, 20)),
        'podzol_top': tex_ground(4, [(38, 30, 26), (56, 44, 34), (74, 58, 42), (66, 66, 62)], 0.1, (110, 108, 104)),
        'podzol_side': tex_ground(5, ASH_DIRT, 0.04),
        'gravel': tex_ground(6, [(70, 66, 64), (92, 88, 84), (118, 112, 106)], 0.2, (48, 44, 42), scale=3),
        'mud': tex_mud(7),
        'packed_mud': tex_bricks(8, [(40, 32, 28), (66, 52, 44), (86, 70, 58)]),
        'mud_bricks': tex_bricks(9, [(40, 32, 28), (70, 56, 46), (92, 76, 62)]),
        'dirt_path_top': tex_ground(10, [(70, 60, 52), (88, 76, 64), (104, 92, 80)], 0.08, (52, 46, 40), scale=8),
        'dirt_path_side': tex_ground(11, ASH_DIRT, 0.04),
        'moss_block': tex_moss(12),
        'dark_oak_log': tex_log_side(13, BURNT),
        'dark_oak_log_top': tex_log_top(14, BURNT),
        'spruce_log': tex_log_side(15, [(24, 20, 18), (44, 36, 30), (62, 52, 44)], cracks=None),
        'spruce_log_top': tex_log_top(16, [(30, 24, 20), (70, 58, 46), (96, 80, 62)]),
        'pale_oak_log': tex_log_side(17, [(70, 68, 66), (100, 98, 94), (130, 126, 120)], cracks=None),
        'stripped_dark_oak_log': tex_log_side(18, [(34, 26, 22), (56, 42, 34), (76, 58, 46)], cracks=None),
        'dark_oak_leaves': tex_leaves(19),
        'spruce_planks': tex_planks(20, [(26, 20, 16), (60, 46, 34), (86, 66, 48)]),
        'dark_oak_planks': tex_planks(21, [(18, 14, 12), (42, 32, 24), (62, 48, 36)]),
        'oak_planks': tex_planks(22, [(40, 32, 24), (84, 66, 46), (112, 90, 62)]),
        'stone_bricks': tex_bricks(23, [(40, 40, 40), (84, 82, 80), (112, 110, 106)]),
        'cracked_stone_bricks': tex_bricks(24, [(36, 36, 36), (80, 78, 76), (106, 104, 100)], cracked=True),
        'mossy_stone_bricks': tex_bricks(25, [(40, 40, 40), (84, 82, 80), (112, 110, 106)], moss=(58, 60, 34)),
        'cobblestone': tex_ground(26, [(44, 44, 44), (76, 74, 72), (104, 100, 96), (124, 120, 114)], 0.0, scale=3),
        'mossy_cobblestone': tex_ground(27, [(44, 44, 40), (70, 70, 54), (96, 94, 80)], 0.0, scale=3),
    }
    for name, img in out.items():
        save_png(img, os.path.join(T, name + '.png'))
    # sol rojizo entre la ceniza y nubes de ceniza
    sun = np.zeros((32, 32, 4))
    for y in range(32):
        for x in range(32):
            d = math.hypot(x - 15.5, y - 15.5)
            if d < 9:
                sun[y, x] = (255, 120 + d * 6, 60, 255)
            elif d < 15:
                sun[y, x] = (200, 70, 30, max(0, 200 - (d - 9) * 33))
    save_png(sun, os.path.join(MC, 'textures', 'environment', 'celestial', 'sun.png'))
    cl = value_noise(256, 256, 24, 99, 4)
    clouds = np.zeros((256, 256, 4))
    clouds[..., :3] = 150
    clouds[..., 3] = np.where(cl > 0.55, 255, 0)
    save_png(clouds, os.path.join(MC, 'textures', 'environment', 'clouds.png'))
    print('texturas:', len(out) + 2)


# ─────────────────────────── shader de color ───────────────────────────

GRADE = '''
// ── Base Defense: corrección de color apocalíptica (ceniza cálida, menos saturación, más contraste, viñeta) ──
vec3 bdGrade(vec3 c) {
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(l), c, 0.6);
    c *= vec3(1.07, 0.95, 0.84);
    c = (c - 0.5) * 1.1 + 0.5;
    vec2 uv = gl_FragCoord.xy / ScreenSize - 0.5;
    float v = smoothstep(0.85, 0.25, length(uv * vec2(1.0, 0.8)));
    return clamp(c * mix(0.62, 1.0, v), 0.0, 1.0);
}
'''


def shaders(client_jar):
    import zipfile
    z = zipfile.ZipFile(client_jar)
    D = mkdir(os.path.join(MC, 'shaders', 'core'))
    for name in ('terrain.fsh', 'entity.fsh'):
        src = z.read('assets/minecraft/shaders/core/' + name).decode()
        if '#moj_import <minecraft:globals.glsl>' not in src:
            src = src.replace('#moj_import <minecraft:fog.glsl>', '#moj_import <minecraft:fog.glsl>\n#moj_import <minecraft:globals.glsl>', 1)
        src = src.replace('out vec4 fragColor;', 'out vec4 fragColor;\n' + GRADE, 1)
        i = src.rindex('fragColor = apply_fog(')
        j = src.index(';', i)
        call = src[i:j]
        src = src[:i] + call + ';\n    fragColor.rgb = bdGrade(fragColor.rgb)' + src[j:]
        open(os.path.join(D, name), 'w').write(src)
    print('shaders: terrain + entity')


# ─────────────────────────── armas 3D ───────────────────────────

# 32×32: rejilla de 4×4 muestras de 8 px. Cada cara usa una muestra (uv en unidades de 16).
SWATCH = {
    'negro': (0, 0, [(18, 18, 20), (30, 30, 34), (44, 44, 48)]),
    'metal': (1, 0, [(60, 62, 66), (90, 92, 96), (124, 126, 130)]),
    'claro': (2, 0, [(130, 132, 136), (170, 172, 176), (205, 206, 210)]),
    'madera': (3, 0, [(70, 44, 24), (98, 64, 36), (124, 86, 50)]),
    'goma': (0, 1, [(22, 22, 22), (34, 32, 30), (46, 44, 40)]),
    'oliva': (1, 1, [(56, 62, 34), (74, 82, 44), (92, 100, 58)]),
    'rojo': (2, 1, [(110, 16, 14), (160, 30, 24), (200, 60, 40)]),
    'laton': (3, 1, [(130, 96, 30), (180, 140, 50), (220, 186, 90)]),
    'acento': (0, 2, None),
    'mira': (1, 2, [(255, 60, 40), (255, 120, 80), (255, 200, 160)]),
    'arena': (2, 2, [(110, 96, 70), (140, 124, 92), (170, 152, 116)]),
    'azul': (3, 2, [(30, 40, 70), (50, 66, 110), (80, 100, 150)]),
}


def gun_texture(accent):
    img = np.zeros((32, 32, 4))
    for name, (cx, cy, cols) in SWATCH.items():
        cols = cols or accent
        n = value_noise(8, 8, 3, hash(name) % 1000) * 0.6 + rng.random((8, 8)) * 0.4
        sw = rgba(palette(n, cols))
        sw[0, :, :3] = np.minimum(255, sw[0, :, :3] * 1.25)  # borde biselado
        sw[-1, :, :3] *= 0.7
        img[cy * 8:cy * 8 + 8, cx * 8:cx * 8 + 8] = sw
    return img


def uvs(sw):
    cx, cy, _ = SWATCH[sw]
    return [cx * 4, cy * 4, cx * 4 + 4, cy * 4 + 4]


def box(fr, to, sw, rot=None):
    e = {'from': list(fr), 'to': list(to), 'faces': {f: {'uv': uvs(sw), 'texture': '#0'} for f in ('north', 'south', 'east', 'west', 'up', 'down')}}
    if rot:
        e['rotation'] = rot
    return e


def display(k):
    """k = tamaño relativo del arma. En primera persona el cañón (−Z) apunta al frente, abajo a la derecha."""
    fp = round(0.82 * k, 3)
    return {
        'thirdperson_righthand': {'rotation': [0, 0, 0], 'translation': [0, 2.5, -1.5], 'scale': [0.62 * k] * 3},
        'thirdperson_lefthand': {'rotation': [0, 0, 0], 'translation': [0, 2.5, -1.5], 'scale': [0.62 * k] * 3},
        'firstperson_righthand': {'rotation': [0, 5, 0], 'translation': [-1.5, 1, -4], 'scale': [fp] * 3},
        'firstperson_lefthand': {'rotation': [0, -5, 0], 'translation': [-0.5, 0.5, -4], 'scale': [fp] * 3},
        'gui': {'rotation': [15, -90, 0], 'translation': [0, 0, 0], 'scale': [0.62 * k] * 3},
        'ground': {'rotation': [0, 0, 0], 'translation': [0, 2, 0], 'scale': [0.5] * 3},
        'fixed': {'rotation': [0, -90, 0], 'translation': [0, 0, 0], 'scale': [0.8] * 3},
    }


SIZE = {'pistola': 1.2, 'subfusil': 0.95, 'ametralladora': 0.75, 'lanzagranadas': 0.9, 'lanzacohetes': 0.7, 'minigun': 0.75}

# Las armas apuntan hacia −Z (cañón en z bajo, culata en z alto); x/y centrados en 8.
GUNS = {
    'pistola': ([(200, 170, 40), (230, 200, 70), (250, 230, 120)], [
        box((7, 8.5, 1), (9, 10.5, 10), 'metal'),            # corredera
        box((7.4, 8.8, 0), (8.6, 9.8, 1), 'negro'),          # boca
        box((7.2, 7.5, 3), (8.8, 8.5, 10), 'negro'),         # armazón
        box((7.25, 3.5, 7), (8.75, 7.5, 10), 'goma', {'angle': -22.5, 'axis': 'x', 'origin': [8, 7.5, 8.5]}),  # empuñadura
        box((7.6, 6.2, 5), (8.4, 7.5, 5.6), 'negro'),        # gatillo
        box((7.5, 5.8, 4.2), (8.5, 6.2, 7), 'negro'),        # guardamonte
        box((7.6, 10.5, 1.5), (8.4, 11.1, 2.3), 'mira'),     # mira delantera
        box((7.3, 10.5, 9), (8.7, 11.2, 9.8), 'negro'),      # mira trasera
        box((7.1, 9.4, 4), (8.9, 9.6, 8), 'acento'),         # franja
    ]),
    'subfusil': ([(40, 120, 200), (70, 160, 230), (120, 200, 250)], [
        box((6.8, 8, -2), (9.2, 10.6, 10), 'negro'),          # cajón
        box((7.5, 8.7, -6), (8.5, 9.7, -2), 'metal'),         # cañón
        box((7, 8.4, -4), (9, 10.2, -2), 'metal'),            # supresor corto
        box((7.2, 2.5, 1), (8.8, 8, 3.2), 'negro', {'angle': 22.5, 'axis': 'x', 'origin': [8, 8, 2]}),  # cargador
        box((7.25, 3.5, 6.5), (8.75, 8, 8.5), 'goma', {'angle': -22.5, 'axis': 'x', 'origin': [8, 8, 7.5]}),
        box((7.6, 6.8, 4.5), (8.4, 8, 5.1), 'negro'),
        box((7.6, 8.5, 10), (8.4, 9.4, 15), 'metal'),         # culata plegable (varilla)
        box((7.3, 7, 14), (8.7, 9.6, 15.5), 'goma'),          # cantonera
        box((7.4, 10.6, 3), (8.6, 11.6, 7), 'negro'),         # riel
        box((7.6, 11.6, 4), (8.4, 12.2, 5), 'mira'),
        box((6.7, 9, 0), (9.3, 9.4, 8), 'acento'),
    ]),
    'ametralladora': ([(160, 30, 30), (200, 50, 40), (240, 90, 70)], [
        box((6.5, 7.8, -2), (9.5, 11, 11), 'negro'),          # cajón
        box((7, 8.4, -11), (9, 10.4, -2), 'metal'),           # camisa del cañón
        box((7.5, 8.9, -14), (8.5, 9.9, -11), 'negro'),       # boca
        box((7.2, 8.6, -9), (8.8, 10.2, -8), 'claro'),        # anillos de refrigeración
        box((7.2, 8.6, -6), (8.8, 10.2, -5), 'claro'),
        box((6, 4, 0), (10, 7.8, 4), 'oliva'),                # caja de munición
        box((5.8, 7, 1), (6.4, 9, 3), 'laton'),               # cinta
        box((7.25, 3.5, 6), (8.75, 7.8, 8), 'goma', {'angle': -22.5, 'axis': 'x', 'origin': [8, 7.8, 7]}),
        box((7, 7.2, 11), (9, 10.6, 17), 'madera'),           # culata
        box((7.5, 11, 1), (8.5, 12.8, 2), 'negro'),           # asa
        box((7.5, 12.2, 1), (8.5, 12.8, 7), 'negro'),
        box((7.5, 11, 6), (8.5, 12.8, 7), 'negro'),
        box((7.6, 5.5, -10), (8.4, 8.4, -9.4), 'metal', {'angle': 22.5, 'axis': 'x', 'origin': [8, 8.4, -9.7]}),  # bípode
        box((6.4, 10.2, 0), (9.6, 10.5, 10), 'acento'),
    ]),
    'lanzagranadas': ([(50, 150, 60), (80, 190, 80), (140, 230, 120)], [
        box((5.8, 7.2, -1), (10.2, 11.6, 5), 'oliva'),        # tambor
        box((6.4, 7.8, -1.5), (9.6, 11, 5.5), 'negro'),
        box((6.6, 8, -6), (9.4, 10.8, -1), 'metal'),          # cañón ancho
        box((7, 8.4, -6.4), (9, 10.4, -6), 'negro'),
        box((7, 8.5, 5), (9, 10.5, 10), 'negro'),             # cuerpo
        box((7.25, 3.8, 6.5), (8.75, 8.5, 8.5), 'goma', {'angle': -22.5, 'axis': 'x', 'origin': [8, 8.5, 7.5]}),
        box((7.2, 7.5, 10), (8.8, 10.2, 16), 'oliva'),        # culata
        box((7.6, 11.6, 0), (8.4, 12.4, 1), 'mira'),
        box((5.6, 9, 1), (10.4, 9.6, 3), 'acento'),
    ]),
    'lanzacohetes': ([(230, 120, 30), (250, 160, 60), (255, 200, 110)], [
        box((6, 7, -6), (10, 11, 16), 'oliva'),               # tubo
        box((6.6, 6.4, -6), (9.4, 11.6, 16), 'oliva'),
        box((5.4, 7.6, -6), (10.6, 10.4, 16), 'oliva'),
        box((5.8, 6.8, -7), (10.2, 11.2, -6), 'negro'),       # boca
        box((6.8, 7.8, -9), (9.2, 10.2, -7), 'rojo'),         # cabeza del cohete
        box((7.4, 8.4, -10), (8.6, 9.6, -9), 'rojo'),
        box((7.25, 2.8, 4), (8.75, 7, 6), 'goma'),            # empuñadura
        box((7.25, 3, 9), (8.75, 7, 10.5), 'goma'),
        box((10.2, 9.5, 2), (11.4, 11.5, 6), 'negro'),        # visor
        box((10.4, 10, 2.4), (11.6, 11, 2.8), 'mira'),
        box((5.8, 7.4, 15.4), (10.2, 10.6, 16.4), 'negro'),   # tobera trasera
        box((5.9, 8.6, 3), (10.1, 9.4, 8), 'acento'),
    ]),
    'minigun': ([(180, 60, 220), (210, 100, 240), (240, 160, 255)], [
        box((5.5, 6, 2), (10.5, 12, 12), 'negro'),            # motor
        box((5, 6.5, 0), (11, 11.5, 2), 'metal'),             # tambor delantero
        *[box((7.5 + dx, 8.5 + dy, -14), (8.5 + dx, 9.5 + dy, 0), 'metal') for dx, dy in ((0, 1.8), (1.6, 0.9), (1.6, -0.9), (0, -1.8), (-1.6, -0.9), (-1.6, 0.9))],
        box((5.6, 6.6, -12), (10.4, 11.4, -11), 'claro'),     # abrazadera
        box((5.6, 6.6, -4), (10.4, 11.4, -3), 'claro'),
        box((7.25, 2.5, 7), (8.75, 6, 9), 'goma'),            # empuñadura
        box((6.5, 12, 4), (9.5, 13.5, 10), 'negro'),          # asa superior
        box((10.5, 4, 3), (14, 9, 9), 'oliva'),               # caja de munición
        box((10, 8.6, 4), (11, 10, 8), 'laton'),              # cinta
        box((5.4, 9, 4), (5.6, 10.5, 10), 'acento'),
    ]),
    'caja_municion': ([(220, 190, 40), (240, 210, 70), (250, 230, 120)], [
        box((3, 0, 4), (13, 7, 12), 'oliva'),
        box((2.8, 6, 3.8), (13.2, 7.2, 12.2), 'negro'),
        box((3.2, 3, 3.8), (12.8, 4, 12.2), 'acento'),
        box((7, 7.2, 7), (9, 8, 9), 'negro'),
    ]),
}


def guns():
    for name, (accent, elements) in GUNS.items():
        save_png(gun_texture(accent), os.path.join(BD, 'textures', 'item', name + '.png'))
        disp = display(SIZE.get(name, 1))
        if name == 'caja_municion':
            disp = {'gui': {'rotation': [30, 45, 0], 'scale': [0.62, 0.62, 0.62]}, 'ground': {'scale': [0.5, 0.5, 0.5]}, 'fixed': {'scale': [0.8, 0.8, 0.8]}}
        model = {'textures': {'0': 'basedefense:item/' + name, 'particle': 'basedefense:item/' + name}, 'elements': elements, 'display': disp}
        mp = os.path.join(BD, 'models', 'item', name + '.json')
        mkdir(os.path.dirname(mp))
        json.dump(model, open(mp, 'w'), indent=1)
        ip = os.path.join(BD, 'items', name + '.json')
        mkdir(os.path.dirname(ip))
        json.dump({'model': {'type': 'minecraft:model', 'model': 'basedefense:item/' + name}}, open(ip, 'w'), indent=1)
    print('modelos:', len(GUNS))


# ─────────────────────────── sonidos ───────────────────────────

def gun_sounds():
    D = mkdir(os.path.join(BD, 'sounds', 'arma'))
    S.OUT = D

    def shot(name, dur, crack_hi, body_lo, body_hi, boom, tail=0.6):
        t = S.t_(dur)
        crack = S.spectral(S.noise(dur), crack_hi * 0.4, crack_hi) * np.exp(-t * 60) * 1.4
        body = S.spectral(S.noise(dur), body_lo, body_hi, -0.4) * np.exp(-t * 18) * 1.2
        thump = np.sin(2 * np.pi * np.cumsum(np.linspace(boom, boom * 0.4, len(t))) / S.SR) * np.exp(-t * 22) * 1.3
        x = S.mix(crack, body, thump)
        S.save(name, S.reverb(x, tail, 0.25))

    shot('pistola', 0.45, 9000, 200, 3000, 120)
    shot('subfusil', 0.3, 10000, 300, 4000, 140, 0.4)
    shot('ametralladora', 0.4, 8000, 150, 2600, 90, 0.5)
    shot('minigun', 0.18, 11000, 300, 5000, 160, 0.25)
    # granada: «plop» grave
    d = 0.5
    t = S.t_(d)
    x = np.sin(2 * np.pi * np.cumsum(np.linspace(180, 70, len(t))) / S.SR) * np.exp(-t * 14) * 1.2 + S.spectral(S.noise(d), 200, 1500) * np.exp(-t * 30) * 0.5
    S.save('granada', S.reverb(x, 0.6, 0.2))
    # cohete: silbido que se aleja
    d = 1.4
    t = S.t_(d)
    x = S.sweep_filter(S.noise(d), 600, 5000, 4) * S.env(d, 0.01, 1.3, 1.6) * 1.3 + S.spectral(S.noise(d), 60, 300) * np.exp(-t * 8)
    S.save('cohete', S.reverb(x, 1.0, 0.25))
    # explosión
    d = 2.2
    t = S.t_(d)
    boom = np.sin(2 * np.pi * np.cumsum(np.linspace(70, 28, len(t))) / S.SR) * np.exp(-t * 3.2) * 1.4
    rumble = S.spectral(S.noise(d), 30, 800, -0.6) * np.exp(-t * 2.4) * 1.3
    debris = S.spectral(S.noise(d), 2000, 9000) * (rng.random(len(t)) < 0.003) * 2 * np.exp(-t * 1.5)
    S.save('explosion', S.reverb(S.mix(boom, rumble, debris), 1.8, 0.3))
    # minigun girando
    d = 0.9
    t = S.t_(d)
    f = np.linspace(20, 70, len(t))
    whirr = np.sign(np.sin(2 * np.pi * np.cumsum(f * 6) / S.SR)) * 0.25 + np.sin(2 * np.pi * np.cumsum(f * 3) / S.SR) * 0.3
    S.save('minigun_gira', S.reverb(S.spectral(whirr, 80, 3000) * S.env(d, 0.05, 0.85, 1.5), 0.5, 0.2))
    # recarga: dos clics metálicos
    def click(at, d, hi):
        t = S.t_(d)
        c = S.spectral(S.noise(d), 2000, hi) * np.exp(-t * 90)
        return S.pad(np.concatenate([np.zeros(int(at * S.SR)), c]), at + d)
    S.save('recarga', S.mix(S.pad(click(0, 0.08, 9000), 0.5), S.pad(click(0.22, 0.1, 6000), 0.5)))
    S.save('recarga_fin', S.reverb(S.mix(S.pad(click(0, 0.06, 10000), 0.35), S.pad(click(0.12, 0.12, 7000), 0.35)), 0.3, 0.15))
    S.save('vacia', S.pad(click(0, 0.05, 8000), 0.15))
    # sirena
    D2 = mkdir(os.path.join(BD, 'sounds', 'alerta'))
    S.OUT = D2
    d = 1.2
    t = S.t_(d)
    f = 520 + 260 * np.sin(2 * np.pi * 0.9 * t)
    x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / S.SR)) * 0.25 * S.env(d, 0.05, 1.1, 1.2)
    S.save('sirena', S.reverb(S.spectral(x, 200, 4000), 0.8, 0.25))
    names = {'arma': ['pistola', 'subfusil', 'ametralladora', 'minigun', 'granada', 'cohete', 'explosion', 'minigun_gira', 'recarga', 'recarga_fin', 'vacia'], 'alerta': ['sirena']}
    sounds = {}
    for folder, items in names.items():
        for n in items:
            sounds[f'{folder}.{n}'] = {'sounds': [{'name': f'basedefense:{folder}/{n}'}]}
    json.dump(sounds, open(os.path.join(BD, 'sounds.json'), 'w'), indent=1)
    print('sonidos:', sum(len(v) for v in names.values()))


def main():
    client = sys.argv[1] if len(sys.argv) > 1 else '/root/.gradle/caches/neoformruntime/artifacts/minecraft_26.1.2_client.jar'
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    mkdir(OUT)
    json.dump({'pack': {'description': 'Base Defense · texturas apocalípticas, armas 3D y sonidos (LiveArena)', 'min_format': [84, 0], 'max_format': [200, 0]}},
              open(os.path.join(OUT, 'pack.mcmeta'), 'w'), indent=1)
    blocks()
    shaders(client)
    import gen_guns
    gen_guns.guns()
    import gen_post
    gen_post.post()
    gun_sounds()
    import gen_hud
    gen_hud.build()


if __name__ == '__main__':
    main()
