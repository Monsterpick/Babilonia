"""HUD propio de Base Defense dibujado con fuentes del pack (sin mods de cliente).

Todo se compone en el servidor como texto con fuentes propias:
- Barra de acción (abajo): panel de estado (vida de la base, bajas, tiempo, fase, victorias), munición de cada arma
  sobre la hotbar, lectura grande del arma en mano y avisos cortos.
- Título de una única BossBar (arriba): meta de bajas, meta de likes, placa del jefe y carteles grandes.
- Título (centro): marcador de impacto.
- TextDisplay (en el mundo): barras de vida de mobs y jefes.

La posición vertical de cada fila sale de `ascent`; la horizontal, de caracteres de espacio con avance negativo.
Las fórmulas se midieron en el cliente 26.1.2 (borde superior del glifo):
  barra de acción  y = H - 65 - ascent          (H = alto de la pantalla en píxeles de GUI)
  BossBar nº 0     y = 10 - ascent
  título (×4)      y = H/2 - 12 - 4·ascent
  Avance de un glifo de mapa de bits = round(ancho_recortado · escala) + 1.

Genera también src/main/resources/hud.json con el avance de cada carácter de cada fuente: el plugin lo usa
para saber dónde queda cada cosa (y que todo el texto mida 0 y quede centrado en la pantalla).
"""
import json, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'src', 'pack')
TEX = os.path.join(OUT, 'assets', 'basedefense', 'textures', 'font', 'hud')
FONTS = os.path.join(OUT, 'assets', 'basedefense', 'font')
SPR = os.path.join(OUT, 'assets', 'minecraft', 'textures', 'gui', 'sprites')
METRICS = os.path.join(HERE, '..', 'src', 'main', 'resources', 'hud.json')

# ─────────────────────────── paleta ───────────────────────────
INK = (14, 15, 18, 235)       # fondo de los paneles
INK2 = (28, 30, 36, 240)      # interior
EDGE = (64, 68, 78, 255)      # bisel claro
EDGE_D = (6, 6, 8, 255)       # borde oscuro
AMBER = (242, 182, 50, 255)
AMBER_D = (150, 98, 18, 255)
BLACK = (18, 16, 12, 255)
TRACK = (40, 12, 12, 255)
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)


def mkdir(p):
    os.makedirs(p, exist_ok=True)
    return p


def canvas(w, h, col=CLEAR):
    return Image.new('RGBA', (w, h), col)


def rect(im, x0, y0, x1, y1, col):
    """Rectángulo relleno [x0,x1) × [y0,y1)."""
    px = im.load()
    for y in range(max(0, y0), min(im.height, y1)):
        for x in range(max(0, x0), min(im.width, x1)):
            px[x, y] = col


def frame(im, x0, y0, x1, y1, col):
    rect(im, x0, y0, x1, y0 + 1, col)
    rect(im, x0, y1 - 1, x1, y1, col)
    rect(im, x0, y0, x0 + 1, y1, col)
    rect(im, x1 - 1, y0, x1, y1, col)


def hazard(im, x0, y0, x1, y1, phase=0, a=AMBER, b=BLACK):
    """Franjas diagonales de peligro."""
    px = im.load()
    for y in range(y0, y1):
        for x in range(x0, x1):
            px[x, y] = a if ((x + y + phase) // 3) % 2 == 0 else b


def panel(w, h, stripes=True, rounded=True):
    """Panel oscuro con bisel; con franjas de peligro arriba y abajo."""
    im = canvas(w, h)
    rect(im, 0, 0, w, h, EDGE_D)
    rect(im, 1, 1, w - 1, h - 1, INK)
    rect(im, 1, 1, w - 1, 2, EDGE)
    if stripes:
        hazard(im, 1, 1, w - 1, 3)
        hazard(im, 1, h - 3, w - 1, h - 1, 1)
    if rounded:
        for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
            im.putpixel((x, y), CLEAR)
    return im


# ─────────────────────────── letra propia 5×7 ───────────────────────────
# Cada carácter: 7 filas de hasta 5 columnas ('#' = píxel). Diseño propio, mayúsculas de estilo militar.
GLYPHS = {
    'A': [' ### ', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
    'B': ['#### ', '#   #', '#   #', '#### ', '#   #', '#   #', '#### '],
    'C': [' ####', '#    ', '#    ', '#    ', '#    ', '#    ', ' ####'],
    'D': ['#### ', '#   #', '#   #', '#   #', '#   #', '#   #', '#### '],
    'E': ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#####'],
    'F': ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#    '],
    'G': [' ####', '#    ', '#    ', '#  ##', '#   #', '#   #', ' ### '],
    'H': ['#   #', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
    'I': ['###', ' # ', ' # ', ' # ', ' # ', ' # ', '###'],
    'J': ['  ###', '    #', '    #', '    #', '    #', '#   #', ' ### '],
    'K': ['#   #', '#  # ', '# #  ', '##   ', '# #  ', '#  # ', '#   #'],
    'L': ['#    ', '#    ', '#    ', '#    ', '#    ', '#    ', '#####'],
    'M': ['#   #', '## ##', '# # #', '# # #', '#   #', '#   #', '#   #'],
    'N': ['#   #', '##  #', '# # #', '#  ##', '#   #', '#   #', '#   #'],
    'O': [' ### ', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
    'P': ['#### ', '#   #', '#   #', '#### ', '#    ', '#    ', '#    '],
    'Q': [' ### ', '#   #', '#   #', '#   #', '# # #', '#  # ', ' ## #'],
    'R': ['#### ', '#   #', '#   #', '#### ', '# #  ', '#  # ', '#   #'],
    'S': [' ####', '#    ', '#    ', ' ### ', '    #', '    #', '#### '],
    'T': ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '  #  '],
    'U': ['#   #', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
    'V': ['#   #', '#   #', '#   #', '#   #', ' # # ', ' # # ', '  #  '],
    'W': ['#   #', '#   #', '#   #', '# # #', '# # #', '## ##', '#   #'],
    'X': ['#   #', '#   #', ' # # ', '  #  ', ' # # ', '#   #', '#   #'],
    'Y': ['#   #', '#   #', ' # # ', '  #  ', '  #  ', '  #  ', '  #  '],
    'Z': ['#####', '    #', '   # ', '  #  ', ' #   ', '#    ', '#####'],
    '0': [' ### ', '#   #', '#  ##', '# # #', '##  #', '#   #', ' ### '],
    '1': [' # ', '## ', ' # ', ' # ', ' # ', ' # ', '###'],
    '2': [' ### ', '#   #', '    #', '   # ', '  #  ', ' #   ', '#####'],
    '3': ['#### ', '    #', '    #', ' ### ', '    #', '    #', '#### '],
    '4': ['#   #', '#   #', '#   #', '#####', '    #', '    #', '    #'],
    '5': ['#####', '#    ', '#    ', '#### ', '    #', '    #', '#### '],
    '6': [' ### ', '#    ', '#    ', '#### ', '#   #', '#   #', ' ### '],
    '7': ['#####', '    #', '   # ', '  #  ', '  #  ', '  #  ', '  #  '],
    '8': [' ### ', '#   #', '#   #', ' ### ', '#   #', '#   #', ' ### '],
    '9': [' ### ', '#   #', '#   #', ' ####', '    #', '    #', ' ### '],
    '.': [' ', ' ', ' ', ' ', ' ', ' ', '#'],
    ',': ['  ', '  ', '  ', '  ', '  ', ' #', '# '],
    ':': [' ', ' ', '#', ' ', ' ', '#', ' '],
    ';': ['  ', '  ', ' #', '  ', '  ', ' #', '# '],
    '!': ['#', '#', '#', '#', '#', ' ', '#'],
    '¡': ['#', ' ', '#', '#', '#', '#', '#'],
    '?': [' ### ', '#   #', '    #', '   # ', '  #  ', '     ', '  #  '],
    '¿': ['  #  ', '     ', '  #  ', ' #   ', '#    ', '#   #', ' ### '],
    '-': ['    ', '    ', '    ', '####', '    ', '    ', '    '],
    '+': ['     ', '  #  ', '  #  ', '#####', '  #  ', '  #  ', '     '],
    '/': ['    #', '    #', '   # ', '  #  ', ' #   ', '#    ', '#    '],
    '%': ['##  #', '##  #', '   # ', '  #  ', ' #   ', '#  ##', '#  ##'],
    '(': [' #', '# ', '# ', '# ', '# ', '# ', ' #'],
    ')': ['# ', ' #', ' #', ' #', ' #', ' #', '# '],
    "'": ['#', '#', ' ', ' ', ' ', ' ', ' '],
    '"': ['# #', '# #', '   ', '   ', '   ', '   ', '   '],
    '#': [' # # ', ' # # ', '#####', ' # # ', '#####', ' # # ', ' # # '],
    '×': ['     ', '     ', '#   #', ' # # ', '  #  ', ' # # ', '#   #'],
    '*': ['     ', '# # #', ' ### ', '#####', ' ### ', '# # #', '     '],
    '<': ['   #', '  # ', ' #  ', '#   ', ' #  ', '  # ', '   #'],
    '>': ['#   ', ' #  ', '  # ', '   #', '  # ', ' #  ', '#   '],
    '=': ['    ', '    ', '####', '    ', '####', '    ', '    '],
    '_': ['    ', '    ', '    ', '    ', '    ', '    ', '####'],
    '·': [' ', ' ', ' ', '#', ' ', ' ', ' '],
    '@': [' ### ', '#   #', '# ###', '# # #', '# ###', '#    ', ' ####'],
    '&': [' ##  ', '#  # ', '# #  ', ' #   ', '# # #', '#  # ', ' ## #'],
    '$': ['  #  ', ' ####', '# #  ', ' ### ', '  # #', '#### ', '  #  '],
    '[': ['##', '# ', '# ', '# ', '# ', '# ', '##'],
    ']': ['##', ' #', ' #', ' #', ' #', ' #', '##'],
    '|': ['#', '#', '#', '#', '#', '#', '#'],
    '~': ['     ', '     ', ' #  #', '# ## ', '     ', '     ', '     '],
    '∞': ['     ', '     ', ' # # ', '# # #', ' # # ', '     ', '     '],
    '→': ['     ', '   # ', '    #', '#####', '    #', '   # ', '     '],
    '♥': ['     ', ' # # ', '#####', '#####', ' ### ', '  #  ', '     '],
    '★': ['  #  ', '  #  ', '#####', ' ### ', ' # # ', '#   #', '     '],
}
ACCENTS = {'Á': ('A', 'acute'), 'É': ('E', 'acute'), 'Í': ('I', 'acute'), 'Ó': ('O', 'acute'), 'Ú': ('U', 'acute'),
           'Ü': ('U', 'diaer'), 'Ñ': ('N', 'tilde'), 'À': ('A', 'grave'), 'È': ('E', 'grave'), 'Ò': ('O', 'grave'),
           'Ç': ('C', 'cedil'), 'Ã': ('A', 'tilde'), 'Õ': ('O', 'tilde'), 'Â': ('A', 'circ'), 'Ê': ('E', 'circ'), 'Ô': ('O', 'circ')}
MARKS = {'acute': ['  #', ' # '], 'grave': ['#  ', ' # '], 'diaer': ['# #', '   '], 'tilde': [' ##', '## '], 'circ': [' # ', '# #'],
         'cedil': None}
TEXT_CHARS = list(GLYPHS.keys()) + list(ACCENTS.keys())
CELL_W, CELL_H = 6, 10   # 2 filas para tildes, 7 de cuerpo, 1 para la cedilla
BODY = 2                  # fila donde empieza el cuerpo de la letra


def glyph_image(ch):
    """Glifo en una celda 6×10: tildes en filas 0-1, cuerpo en 2-8."""
    im = canvas(CELL_W, CELL_H)
    base, mark = (ch, None)
    if ch in ACCENTS:
        base, mark = ACCENTS[ch]
    rows = GLYPHS[base]
    w = max(len(r) for r in rows)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c == '#':
                im.putpixel((x, BODY + y), WHITE)
    if mark == 'cedil':
        im.putpixel((w // 2, BODY + 7), WHITE)
    elif mark:
        m = MARKS[mark]
        off = max(0, (w - 3) // 2)
        for y, r in enumerate(m):
            for x, c in enumerate(r):
                if c == '#':
                    im.putpixel((off + x, y), WHITE)
    return im


def text_atlas(scale=1, outline=False):
    """Atlas 16 columnas de la letra propia (opcionalmente ampliada o con contorno oscuro de 1 px)."""
    cols = 16
    rows = (len(TEXT_CHARS) + cols - 1) // cols
    cw, chh = CELL_W * scale, CELL_H * scale
    if outline:
        cw, chh = cw + 2, chh + 2
    im = canvas(cw * cols, chh * rows)
    grid = []
    for i, ch in enumerate(TEXT_CHARS):
        g = glyph_image(ch)
        if scale != 1:
            g = g.resize((CELL_W * scale, CELL_H * scale), Image.NEAREST)
        if outline:
            o = canvas(cw, chh)
            a = np.array(g)[..., 3] > 0
            dark = canvas(g.width, g.height, (10, 8, 6, 230))
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    if dx or dy:
                        m = Image.fromarray((a * 255).astype(np.uint8), 'L')
                        o.paste(dark, (1 + dx, 1 + dy), m)
            o.alpha_composite(g, (1, 1))
            g = o
        im.alpha_composite(g, ((i % cols) * cw, (i // cols) * chh))
    for r in range(rows):
        s = ''.join(TEXT_CHARS[r * cols:(r + 1) * cols])
        grid.append(s + '\u0000' * (cols - len(s)))
    return im, grid, (cw, chh)


# dígitos diminutos 3×5 para la munición de cada hueco
TINY = {
    '0': ['###', '# #', '# #', '# #', '###'], '1': [' # ', '## ', ' # ', ' # ', '###'], '2': ['###', '  #', '###', '#  ', '###'],
    '3': ['###', '  #', ' ##', '  #', '###'], '4': ['# #', '# #', '###', '  #', '  #'], '5': ['###', '#  ', '###', '  #', '###'],
    '6': ['###', '#  ', '###', '# #', '###'], '7': ['###', '  #', ' # ', ' # ', ' # '], '8': ['###', '# #', '###', '# #', '###'],
    '9': ['###', '# #', '###', '  #', '###'], '/': ['  #', '  #', ' # ', '#  ', '#  '], '-': ['   ', '   ', '###', '   ', '   '],
    '∞': ['     ', '## ##', '# # #', '## ##', '     '], 'x': ['   ', '# #', ' # ', '# #', '   '],
}


def tiny_atlas():
    chars = list(TINY.keys())
    cw, chh = 6, 7  # con contorno
    im = canvas(cw * len(chars), chh)
    for i, ch in enumerate(chars):
        rows = TINY[ch]
        a = np.zeros((chh, cw), bool)
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                if c == '#':
                    a[1 + y, 1 + x] = True
        ox = i * cw
        for y in range(chh):
            for x in range(cw):
                if a[y, x]:
                    im.putpixel((ox + x, y), WHITE)
                elif any(0 <= y + dy < chh and 0 <= x + dx < cw and a[y + dy, x + dx] for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                    im.putpixel((ox + x, y), (8, 8, 10, 220))
    return im, [''.join(chars)], (cw, chh)


# ─────────────────────────── iconos ───────────────────────────

def icon(rows, pal):
    h, w = len(rows), max(len(r) for r in rows)
    im = canvas(w, h)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != ' ' and c in pal:
                im.putpixel((x, y), pal[c])
    return im


ICONS = {
    # escudo-corazón de la base
    'base': (['  oooo   ', ' orrrrro ', 'orrwrrrro', 'orwrrrrro', 'orrrrrrro', ' orrrrro ', '  orrro  ', '   oro   ', '    o    '],
             {'o': (40, 6, 6, 255), 'r': (226, 48, 48, 255), 'w': (255, 200, 200, 255)}),
    'skull': (['  ooooo  ', ' owwwwwo ', 'owwwwwwwo', 'ow  w  wo', 'ow  w  wo', 'owwwowwwo', ' owwwwwo ', '  owowo  ', '  ooooo  '],
              {'o': (20, 18, 16, 255), 'w': (236, 232, 220, 255)}),
    'clock': (['  ooooo  ', ' owwwwwo ', 'owwwkwwwo', 'owwwkwwwo', 'owwwkkkwo', 'owwwwwwwo', 'owwwwwwwo', ' owwwwwo ', '  ooooo  '],
              {'o': (20, 18, 16, 255), 'w': (236, 214, 150, 255), 'k': (30, 24, 16, 255)}),
    'flag': (['ok       ', 'okrrrrr  ', 'okrrrrrr ', 'okrrrrrrr', 'okrrrrrr ', 'okrrrrr  ', 'ok       ', 'ok       ', 'ooo      '],
             {'o': (20, 18, 16, 255), 'k': (120, 110, 100, 255), 'r': (242, 182, 50, 255)}),
    'trophy': (['ooooooooo', 'oyyyyyyyo', ' oyyyyyo ', ' oyyyyyo ', '  oyyyo  ', '   oyo   ', '   oyo   ', '  oyyyo  ', ' ooooooo '],
               {'o': (40, 26, 4, 255), 'y': (250, 210, 70, 255)}),
    'like': (['         ', ' oo   oo ', 'oppo oppo', 'oppppwppo', 'opppppppo', ' opppppo ', '  opppo  ', '   opo   ', '    o    '],
             {'o': (60, 10, 40, 255), 'p': (255, 92, 170, 255), 'w': (255, 210, 235, 255)}),
    'crate': (['ooooooooo', 'obbbbbbbo', 'obobobobo', 'obbbbbbbo', 'oyyyyyyyo', 'obbbbbbbo', 'obobobobo', 'obbbbbbbo', 'ooooooooo'],
              {'o': (30, 20, 10, 255), 'b': (150, 100, 50, 255), 'y': (242, 182, 50, 255)}),
    'warn': (['    o    ', '   oyo   ', '   oyo   ', '  oykyo  ', '  oykyo  ', ' oyykyyo ', ' oyyyyyo ', 'oyyykyyyo', 'ooooooooo'],
             {'o': (40, 26, 4, 255), 'y': (250, 200, 40, 255), 'k': (30, 20, 6, 255)}),
    'bolt': (['     oo  ', '    oyo  ', '   oyo   ', '  oyyyoo ', ' ooooyyo ', '    oyo  ', '   oyo   ', '  oyo    ', '  oo     '],
             {'o': (40, 26, 4, 255), 'y': (255, 230, 90, 255)}),
    'gift': (['  o   o  ', ' oro oro ', 'ooooooooo', 'ogggrgggo', 'ooooooooo', 'ogggrgggo', 'ogggrgggo', 'ogggrgggo', 'ooooooooo'],
             {'o': (20, 30, 20, 255), 'g': (60, 190, 90, 255), 'r': (230, 60, 60, 255)}),
    'bullet': (['    o    ', '   oyo   ', '   oyo   ', '  oyyyo  ', '  oyyyo  ', '  obbbo  ', '  obbbo  ', '  obbbo  ', '  ooooo  '],
               {'o': (30, 20, 6, 255), 'y': (255, 210, 120, 255), 'b': (190, 130, 40, 255)}),
    'cross': (['  ooooo  ', '  owwwo  ', 'oooowoooo', 'owwwwwwwo', 'oooowoooo', '  owwwo  ', '  owwwo  ', '  owwwo  ', '  ooooo  '],
              {'o': (20, 50, 20, 255), 'w': (120, 240, 120, 255)}),
}


def boss_icon(kind):
    """Iconos 16×16 de los jefes (dibujo propio, no texturas de Minecraft)."""
    im = canvas(16, 16)
    px = im.load()
    rect(im, 0, 0, 16, 16, (10, 8, 10, 255))
    if kind == 'wither':
        rect(im, 1, 1, 15, 15, (36, 34, 38, 255))
        for x, y in ((4, 6), (5, 6), (10, 6), (11, 6), (4, 7), (11, 7)):
            px[x, y] = (230, 230, 240, 255)
        rect(im, 4, 6, 6, 8, (240, 240, 250, 255))
        rect(im, 10, 6, 12, 8, (240, 240, 250, 255))
        rect(im, 5, 11, 11, 12, (10, 10, 12, 255))
        for x in range(5, 11, 2):
            px[x, 12] = (180, 180, 186, 255)
        frame(im, 1, 1, 15, 15, (70, 66, 74, 255))
    elif kind == 'dragon':
        rect(im, 1, 1, 15, 15, (24, 18, 34, 255))
        for x in range(3, 13):
            px[x, 4] = (50, 36, 64, 255)
        rect(im, 3, 7, 6, 8, (220, 90, 255, 255))
        rect(im, 10, 7, 13, 8, (220, 90, 255, 255))
        rect(im, 2, 11, 14, 13, (40, 30, 52, 255))
        px[4, 2], px[11, 2] = (90, 80, 100, 255), (90, 80, 100, 255)
        frame(im, 1, 1, 15, 15, (90, 60, 120, 255))
    else:  # warden
        rect(im, 1, 1, 15, 15, (10, 40, 48, 255))
        rect(im, 3, 3, 13, 13, (14, 58, 70, 255))
        rect(im, 6, 7, 10, 10, (90, 230, 240, 255))
        px[1, 5], px[14, 5] = (90, 230, 240, 255), (90, 230, 240, 255)
        rect(im, 0, 3, 2, 7, (40, 120, 130, 255))
        rect(im, 14, 3, 16, 7, (40, 120, 130, 255))
        frame(im, 1, 1, 15, 15, (30, 110, 120, 255))
    return im


def hitmarker(col):
    im = canvas(16, 16)
    px = im.load()
    for i in range(4):
        for (x, y) in ((3 + i, 3 + i), (12 - i, 3 + i), (3 + i, 12 - i), (12 - i, 12 - i)):
            px[x, y + 1] = (0, 0, 0, 140)
            px[x, y] = col
    return im


# ─────────────────────────── barras ───────────────────────────

def bar_fill(w, h, filled, style):
    """Relleno blanco con brillo; el color lo pone el texto (verde/amarillo/rojo…)."""
    im = canvas(w, h)
    if filled <= 0:
        return im
    for y in range(h):
        v = 255 if y == 0 else (215 if y < h - 1 else 150)
        for x in range(filled):
            seg = style == 'seg' and x % 6 == 5
            c = int(v * (0.72 if seg else 1.0))
            im.putpixel((x, y), (c, c, c, 255))
    return im


def bar_atlas(w, h, steps, style):
    """Atlas vertical: fila i = barra llena al i/steps (en el 0 el glifo no ocupa nada)."""
    im = canvas(w, h * (steps + 1))
    for i in range(steps + 1):
        im.alpha_composite(bar_fill(w, h, round(w * i / steps), style), (0, i * h))
    return im


def world_bar(w, filled, col):
    """Barra de vida de los mobs en el mundo, con marco propio (va en un TextDisplay)."""
    im = canvas(w + 2, 5)
    rect(im, 0, 0, w + 2, 5, (8, 6, 6, 230))
    rect(im, 1, 1, w + 1, 4, (60, 14, 14, 255))
    for x in range(filled):
        for y in range(3):
            c = tuple(min(255, int(v * (1.15 if y == 0 else 1 if y == 1 else 0.7))) for v in col)
            im.putpixel((1 + x, 1 + y), c + (255,))
    return im


# ─────────────────────────── fuentes ───────────────────────────
PUA = [0xE000]


def code():
    c = chr(PUA[0])
    PUA[0] += 1
    return c


class Set:
    """Una imagen (o atlas) y sus caracteres. scale = píxeles de GUI por píxel de la imagen."""

    def __init__(self, name, img, chars, cell, scale=1):
        self.name, self.img, self.chars, self.cell, self.scale = name, img, chars, cell, scale
        self.files = {}

    def advance(self, ch, unit=1):
        r = next(i for i, row in enumerate(self.chars) if ch in row)
        c = self.chars[r].index(ch)
        cw, chh = self.cell
        a = np.array(self.img)[r * chh:(r + 1) * chh, c * cw:(c + 1) * cw, 3]
        cols = np.where(a.max(axis=0) > 0)[0]
        width = 0 if len(cols) == 0 else cols.max() + 1
        return int(0.5 + width * self.scale / unit) + 1

    def all_chars(self):
        return [ch for row in self.chars for ch in row if ch != '\u0000']


SETS = {}


def add_set(name, img, chars, cell, scale=1):
    SETS[name] = Set(name, img, chars, cell, scale)
    return SETS[name]


def single(name, img, scale=1):
    ch = code()
    add_set(name, img, [ch], img.size, scale)
    return ch


FONTDEFS = {}


def font(name, unit, items):
    """items: (set, borde superior en unidades de la fuente). unit = píxeles de GUI por unidad."""
    FONTDEFS[name] = (unit, items)


def write_fonts(spaces):
    mkdir(TEX)
    mkdir(FONTS)
    metrics = {}
    for fname, (unit, items) in FONTDEFS.items():
        providers = []
        adv = {}
        for set_name, ascent in items:
            s = SETS[set_name]
            cw, chh = s.cell
            rows = len(s.chars)
            # alto en unidades de la fuente para que 1 px de la imagen = scale px de GUI
            height = chh * s.scale / unit
            pad = 0
            # Minecraft exige ascent <= height: si hace falta se rellena la parte de abajo de cada celda
            while height + pad * s.scale / unit < ascent or abs((chh + pad) * s.scale / unit - round((chh + pad) * s.scale / unit)) > 1e-6:
                pad += 1
            key = (set_name, pad)
            if key not in s.files:
                img = s.img
                if pad:
                    img = canvas(cw * len(s.chars[0]), (chh + pad) * rows)
                    for r in range(rows):
                        img.alpha_composite(s.img.crop((0, r * chh, s.img.width, (r + 1) * chh)), (0, r * (chh + pad)))
                fn = f'{set_name}{"_p" + str(pad) if pad else ""}.png'
                img.save(os.path.join(TEX, fn))
                s.files[key] = fn
            providers.append({'type': 'bitmap', 'file': f'basedefense:font/hud/{s.files[key]}',
                              'height': int(round((chh + pad) * s.scale / unit)), 'ascent': int(ascent), 'chars': s.chars})
            for ch in s.all_chars():
                adv[ch] = s.advance(ch, unit)
        providers.append({'type': 'space', 'advances': {k: v for k, v in spaces.items()}})
        adv.update(spaces)
        json.dump({'providers': providers}, open(os.path.join(FONTS, fname + '.json'), 'w'), ensure_ascii=False)
        metrics['basedefense:' + fname] = adv
    return metrics


# ─────────────────────────── sprites del HUD de Minecraft ───────────────────────────

def sprites():
    hud = mkdir(os.path.join(SPR, 'hud'))
    empty = canvas(9, 9)
    # corazones, comida, armadura, aire y experiencia: fuera (la vida importante es la de la base)
    for sub in ('heart',):
        d = mkdir(os.path.join(hud, sub))
        for n in ('container', 'container_blinking', 'container_hardcore', 'container_hardcore_blinking', 'vehicle_container', 'vehicle_full', 'vehicle_half'):
            empty.save(os.path.join(d, n + '.png'))
        for kind in ('', 'absorbing_', 'frozen_', 'poisoned_', 'withered_'):
            for hc in ('', 'hardcore_'):
                for f in ('full', 'half'):
                    for bl in ('', '_blinking'):
                        empty.save(os.path.join(d, f'{kind}{hc}{f}{bl}.png'))
    for n in ('food_empty', 'food_empty_hunger', 'food_full', 'food_full_hunger', 'food_half', 'food_half_hunger',
              'armor_empty', 'armor_full', 'armor_half', 'air', 'air_bursting', 'air_empty'):
        empty.save(os.path.join(hud, n + '.png'))
    canvas(182, 5).save(os.path.join(hud, 'experience_bar_background.png'))
    canvas(182, 5).save(os.path.join(hud, 'experience_bar_progress.png'))

    # hotbar: 6 huecos de armas + panel de lectura de munición a la derecha (los huecos 7-9 no se usan)
    hb = canvas(182, 22)
    rect(hb, 0, 0, 182, 22, EDGE_D)
    rect(hb, 1, 1, 181, 21, INK)
    hazard(hb, 1, 1, 181, 2)
    for i in range(6):
        x = 1 + i * 20
        rect(hb, x + 1, 2, x + 19, 20, INK2)
        frame(hb, x + 1, 2, x + 19, 20, (52, 55, 64, 255))
        rect(hb, x + 2, 3, x + 18, 4, (70, 74, 84, 255))
    rect(hb, 122, 2, 181, 21, (20, 21, 26, 245))
    frame(hb, 122, 2, 181, 21, (52, 55, 64, 255))
    rect(hb, 121, 2, 122, 21, AMBER_D)
    for x, y in ((0, 0), (181, 0), (0, 21), (181, 21)):
        hb.putpixel((x, y), CLEAR)
    hb.save(os.path.join(hud, 'hotbar.png'))
    sel = canvas(24, 23)
    frame(sel, 0, 0, 24, 24, (20, 10, 0, 255))
    frame(sel, 1, 1, 23, 23, AMBER)
    frame(sel, 2, 2, 22, 22, (255, 230, 140, 255))
    for x, y in ((1, 1), (22, 1)):
        sel.putpixel((x, y), (255, 245, 200, 255))
    sel.save(os.path.join(hud, 'hotbar_selection.png'))

    # mira propia: cruz fina con hueco
    ch = canvas(15, 15)
    for i in (0, 1, 2, 3):
        for (x, y) in ((7, i), (7, 14 - i), (i, 7), (14 - i, 7)):
            ch.putpixel((x, y), WHITE)
    ch.putpixel((7, 7), WHITE)
    ch.save(os.path.join(hud, 'crosshair.png'))

    # las barras de jefe nativas no se ven: todo el HUD de arriba va en el título de una sola barra
    bb = mkdir(os.path.join(SPR, 'boss_bar'))
    for c in ('blue', 'green', 'pink', 'purple', 'red', 'white', 'yellow'):
        for k in ('background', 'progress'):
            canvas(182, 5).save(os.path.join(bb, f'{c}_{k}.png'))
    for n in (6, 10, 12, 20):
        for k in ('background', 'progress'):
            canvas(182, 5).save(os.path.join(bb, f'notched_{n}_{k}.png'))

    # viñeta más marcada (oscurece los bordes de la pantalla)
    w, h = 256, 256
    ys, xs = np.mgrid[0:h, 0:w]
    r = np.sqrt(((xs - w / 2) / (w / 2)) ** 2 + ((ys - h / 2) / (h / 2)) ** 2)
    v = np.clip((r - 0.55) / 0.75, 0, 1) ** 1.6
    g = (255 * (1 - 0.85 * v)).astype(np.uint8)
    vig = np.stack([g, g, g, np.full_like(g, 255)], axis=2)
    d = mkdir(os.path.join(OUT, 'assets', 'minecraft', 'textures', 'misc'))
    Image.fromarray(vig, 'RGBA').save(os.path.join(d, 'vignette.png'))


# ─────────────────────────── composición ───────────────────────────

def build():
    names = {}
    # letra propia normal, ×2 y con contorno (para escribir sobre el mundo)
    atlas, grid, cell = text_atlas()
    add_set('txt', atlas, grid, cell)
    add_set('txt2', atlas, grid, cell, scale=2)
    atlas_o, grid_o, cell_o = text_atlas(outline=True)
    add_set('txto', atlas_o, grid_o, cell_o)
    add_set('txto2', atlas_o, grid_o, cell_o, scale=2)
    t, tg, tc = tiny_atlas()
    add_set('tiny', t, tg, tc)

    for k, (rows, pal) in ICONS.items():
        names['i_' + k] = single('i_' + k, icon(rows, pal))
    for k in ('wither', 'dragon', 'warden'):
        names['boss_' + k] = single('boss_' + k, boss_icon(k))
    hm = hitmarker((255, 255, 255, 255))
    names['hit'] = single('hit', hm, scale=1)

    # paneles
    names['p_status'] = single('p_status', status_panel())
    names['p_strip'] = single('p_strip', strip_panel())
    names['p_boss'] = single('p_boss', boss_panel())
    # placas de ancho variable (tapa izquierda, tramo de 8 px, tapa derecha)
    for nm, h, acc in (('pill', 14, AMBER), ('ban', 40, AMBER)):
        l, m, r = plate_pieces(h, acc)
        names[nm + '_l'] = single(nm + '_l', l)
        names[nm + '_m'] = single(nm + '_m', m)
        names[nm + '_r'] = single(nm + '_r', r)

    # barras: vida de la base 118×5 (pasos de 2 px), mini 38×3, jefe 172×5 (pasos de 2 px), recarga 54×3
    bars = {'b_base': (118, 5, 59, 'seg'), 'b_mini': (38, 3, 38, 'plain'), 'b_boss': (172, 5, 86, 'seg'), 'b_reload': (54, 3, 54, 'plain')}
    for k, (w, h, steps, style) in bars.items():
        chs = [code() for _ in range(steps + 1)]
        add_set(k, bar_atlas(w, h, steps, style), chs, (w, h))
        names[k] = chs
    # barras del mundo (TextDisplay): 3 colores × 21 pasos
    world = {}
    for col_name, col in (('g', (90, 220, 90)), ('y', (240, 200, 60)), ('r', (230, 60, 50)), ('p', (200, 90, 255))):
        chs = [code() for _ in range(21)]
        im = canvas(34, 5 * 21)
        for i in range(21):
            im.alpha_composite(world_bar(32, round(32 * i / 20), col), (0, i * 5))
        add_set('w_' + col_name, im, chs, (34, 5))
        world[col_name] = chs
    names['world'] = world
    chs = [code() for _ in range(41)]
    im = canvas(62, 7 * 41)
    for i in range(41):
        b = canvas(62, 7)
        rect(b, 0, 0, 62, 7, (8, 6, 6, 235))
        rect(b, 1, 1, 61, 6, (60, 14, 14, 255))
        f = round(60 * i / 40)
        for x in range(f):
            for y in range(5):
                v = (1.2, 1.05, 1, 0.85, 0.65)[y]
                b.putpixel((1 + x, 1 + y), (min(255, int(170 * v)), min(255, int(70 * v)), min(255, int(255 * v)), 255))
        im.alpha_composite(b, (0, i * 7))
    add_set('w_boss', im, chs, (62, 7))
    names['world_boss'] = chs

    # espacios: potencias de 2 en ambos sentidos
    spaces = {}
    sp = {}
    for i in range(11):
        n = 1 << i
        a, b = chr(0xF800 + i), chr(0xF820 + i)
        spaces[a], spaces[b] = -n, n
        sp[str(-n)], sp[str(n)] = a, b
    spaces[' '] = 4
    names['space'] = sp

    # ── filas de la barra de acción (borde superior y = H - d  →  ascent = d - 65) ──
    def ab(d):
        return d - 65
    font('ab_panel', 1, [('p_status', ab(56))])
    font('ab_r1', 1, [('i_base', ab(52)), ('b_base', ab(50)), ('txto', ab(53))])
    font('ab_r2', 1, [('txto', ab(41))] + [(k, ab(40)) for k in ('i_skull', 'i_clock', 'i_flag', 'i_trophy')])
    font('ab_slot', 1, [('tiny', ab(9))])
    font('ab_amm_big', 1, [('txt2', ab(20))])
    font('ab_amm_small', 1, [('txto', ab(12))] + [('i_bullet', ab(20))])
    font('ab_amm_label', 1, [('txto', ab(21)), ('b_reload', ab(9))])
    font('ab_n1', 1, [('pill_l', ab(72)), ('pill_m', ab(72)), ('pill_r', ab(72)), ('txt', ab(71))]
         + [(k, ab(70)) for k in ('i_skull', 'i_crate', 'i_warn', 'i_bolt', 'i_gift', 'i_bullet', 'i_cross', 'i_base', 'i_like', 'i_trophy')])
    font('ab_n2', 1, [('pill_l', ab(87)), ('pill_m', ab(87)), ('pill_r', ab(87)), ('txt', ab(86))]
         + [(k, ab(85)) for k in ('i_skull', 'i_crate', 'i_warn', 'i_bolt', 'i_gift', 'i_bullet', 'i_cross', 'i_base', 'i_like', 'i_trophy')])

    # ── filas del título de la BossBar (borde superior y  →  ascent = 10 - y) ──
    def bb(y):
        return 10 - y
    font('bb_strip', 1, [('p_strip', bb(2)), ('txto', bb(3)), ('i_skull', bb(5)), ('i_like', bb(5)), ('i_trophy', bb(5)), ('b_mini', bb(11))])
    for i, y0 in enumerate((22, 50)):
        font(f'bb_boss{i}', 1, [('p_boss', bb(y0)), ('boss_wither', bb(y0 + 3)), ('boss_dragon', bb(y0 + 3)), ('boss_warden', bb(y0 + 3)),
                                ('txto', bb(y0 + 1)), ('b_boss', bb(y0 + 15))])
    font('bb_ban', 1, [('ban_l', bb(82)), ('ban_m', bb(82)), ('ban_r', bb(82)), ('txto2', bb(82 + 2))])
    font('bb_bansub', 1, [('txto', bb(82 + 25))])

    # ── título (×4): marcador de impacto centrado en la mira ──
    SETS['hit'].scale = 1
    font('ti_hit', 4, [('hit', -1)])

    # ── en el mundo (TextDisplay): barras de vida ──
    font('w_bar', 1, [('w_g', 7), ('w_y', 7), ('w_r', 7), ('w_p', 7), ('w_boss', 7)] + [(f'boss_{k}', 12) for k in ('wither', 'dragon', 'warden')])

    metrics = write_fonts(spaces)
    sprites()
    out = {'fonts': metrics, 'glyphs': names}
    json.dump(out, open(METRICS, 'w'), ensure_ascii=False, indent=0)
    print('hud: fuentes', len(FONTDEFS), '· glifos', PUA[0] - 0xE000)


def status_panel():
    """Panel de estado 182×30 sobre la hotbar: fila 1 vida de la base, fila 2 bajas/tiempo/fase/victorias."""
    w, h = 182, 30
    im = panel(w, h)
    # carril de la barra de vida (x 12..132 en el panel)
    rect(im, 13, 5, 133, 12, EDGE_D)
    rect(im, 14, 6, 132, 11, TRACK)
    # separadores de la fila 2
    for x in (47, 97, 141):
        rect(im, x, 16, x + 1, 26, (52, 55, 64, 255))
    rect(im, 3, 14, w - 3, 15, (40, 42, 50, 255))
    return im


def strip_panel():
    w, h = 182, 15
    im = panel(w, h, stripes=False)
    hazard(im, 1, h - 3, w - 1, h - 1)
    rect(im, 90, 3, 91, 11, (52, 55, 64, 255))
    for x0 in (48, 139):
        rect(im, x0, 8, x0 + 40, 13, EDGE_D)
        rect(im, x0 + 1, 9, x0 + 39, 12, TRACK)
    return im


def boss_panel():
    w, h = 206, 24
    im = panel(w, h, stripes=False)
    hazard(im, 1, h - 3, w - 1, h - 1, 0, (150, 40, 220, 255), BLACK)
    rect(im, 2, 2, 20, 20, EDGE_D)
    rect(im, 23, 14, 23 + 174, 21, EDGE_D)
    rect(im, 24, 15, 24 + 172, 20, TRACK)
    return im


def plate_pieces(h, acc):
    """Placa de ancho variable: tapas de 4 px y tramo de 8 px con franja de color abajo."""
    def col(x_is_edge, img, x):
        for y in range(h):
            if y == 0 or y == h - 1:
                c = EDGE_D
            elif y == 1:
                c = EDGE
            elif y >= h - (3 if h >= 20 else 2):
                c = acc if ((x + y) // 3) % 2 == 0 else BLACK
            else:
                c = INK
            img.putpixel((x, y), c)
    l = canvas(4, h)
    for x in range(4):
        col(x == 0, l, x)
    rect(l, 0, 0, 1, h, EDGE_D)
    l.putpixel((0, 0), CLEAR)
    l.putpixel((0, h - 1), CLEAR)
    m = canvas(8, h)
    for x in range(8):
        col(False, m, x)
    r = canvas(4, h)
    for x in range(4):
        col(x == 3, r, x)
    rect(r, 3, 0, 4, h, EDGE_D)
    r.putpixel((3, 0), CLEAR)
    r.putpixel((3, h - 1), CLEAR)
    return l, m, r


if __name__ == '__main__':
    build()
