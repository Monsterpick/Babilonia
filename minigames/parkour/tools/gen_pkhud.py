"""HUD propio de Parkour LIVE dibujado con fuentes del pack (mismo sistema que Base Defense, estilo distinto).

Reutiliza el motor de tools/gen_hud.py de Base Defense (letra propia, iconos, atlas y fórmulas medidas en el cliente):
  barra de acción  y = H - 65 - ascent        BossBar nº 0  y = 10 - ascent

- Arriba (título de una BossBar con las barras nativas invisibles): panel con el nivel en grande, el bioma, el % de la
  torre y una tira con un segmento por nivel (cada uno se tiñe con el color de su bioma desde el plugin) + carteles.
- Abajo (barra de acción, donde estaba la hotbar, que aquí no hace falta): progreso del nivel, caídas, tiempo,
  ganadas-perdidas y estado (escudo, protegido, cola); encima, avisos de lo que manda cada espectador.

El pack deja transparentes la hotbar, los corazones, la comida, la experiencia y las barras de jefe nativas.
Genera src/main/resources/hud.json con el avance de cada carácter.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
import importlib.util  # noqa: E402

_spec = importlib.util.spec_from_file_location('bd_gen_hud', os.path.join(HERE, '..', '..', 'base-defense', 'tools', 'gen_hud.py'))
G = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(G)

OUT = os.path.join(HERE, '..', 'src', 'pack')
G.TEX = os.path.join(OUT, 'assets', 'parkour', 'textures', 'font', 'hud')
G.FONTS = os.path.join(OUT, 'assets', 'parkour', 'font')
SPR = os.path.join(OUT, 'assets', 'minecraft', 'textures', 'gui', 'sprites')
METRICS = os.path.join(HERE, '..', 'src', 'main', 'resources', 'hud.json')

GLASS = (15, 17, 27, 228)
GLASS2 = (26, 29, 44, 240)
BORDER = (92, 98, 128, 255)
BORDER_D = (6, 7, 12, 255)
SHINE = (255, 255, 255, 38)
TRACK = (8, 9, 15, 255)
CLEAR = (0, 0, 0, 0)
WHITE = (255, 255, 255, 255)


def glass(w, h):
    """Panel de cristal oscuro con borde fino, brillo arriba y esquinas redondeadas."""
    im = G.canvas(w, h)
    G.rect(im, 0, 0, w, h, BORDER_D)
    G.rect(im, 1, 1, w - 1, h - 1, BORDER)
    G.rect(im, 2, 2, w - 2, h - 2, GLASS)
    G.rect(im, 2, 2, w - 2, 3, SHINE)
    for x, y in ((0, 0), (1, 0), (0, 1), (w - 1, 0), (w - 2, 0), (w - 1, 1), (0, h - 1), (1, h - 1), (0, h - 2), (w - 1, h - 1), (w - 2, h - 1), (w - 1, h - 2)):
        im.putpixel((x, y), CLEAR)
    for x, y in ((1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)):
        im.putpixel((x, y), BORDER_D)
    return im


def track(im, x0, y0, x1, y1):
    G.rect(im, x0, y0, x1, y1, BORDER_D)
    G.rect(im, x0 + 1, y0 + 1, x1 - 1, y1 - 1, TRACK)


def top_panel():
    """206×40: nivel y bioma arriba, tira de la torre abajo."""
    w, h = 206, 40
    im = glass(w, h)
    track(im, 2, 26, w - 2, 37)
    return im


def stat_panel():
    """182×28 donde estaba la hotbar: fila 1 progreso del nivel, fila 2 datos."""
    w, h = 182, 28
    im = glass(w, h)
    track(im, 14, 5, 136, 12)
    G.rect(im, 4, 15, w - 4, 16, (44, 48, 66, 255))
    for x in (46, 96, 132):
        G.rect(im, x, 17, x + 1, 25, (52, 56, 78, 255))
    return im


def plate(h):
    """Placa de ancho variable (tapas de 4 px + tramos de 8 px) con una línea clara abajo."""
    def col(img, x):
        for y in range(h):
            c = BORDER_D if y in (0, h - 1) else BORDER if y in (1, h - 2) else GLASS2
            img.putpixel((x, y), c)
    l, m, r = G.canvas(4, h), G.canvas(8, h), G.canvas(4, h)
    for x in range(4):
        col(l, x)
        col(r, x)
    for x in range(8):
        col(m, x)
    G.rect(l, 0, 0, 1, h, BORDER_D)
    G.rect(l, 1, 1, 2, h - 1, BORDER)
    G.rect(r, 3, 0, 4, h, BORDER_D)
    G.rect(r, 2, 1, 3, h - 1, BORDER)
    for im, x in ((l, 0), (r, 3)):
        im.putpixel((x, 0), CLEAR)
        im.putpixel((x, h - 1), CLEAR)
    return l, m, r


def segment(w, h, bright=False):
    """Segmento de la tira (blanco: el color lo pone el plugin). Con brillo arriba y sombra abajo."""
    im = G.canvas(w, h)
    for y in range(h):
        v = 255 if y == 0 else 150 if y == h - 1 else 222
        if bright:
            v = 255
        for x in range(w):
            im.putpixel((x, y), (v, v, v, 255))
    return im


ICON_EXTRA = {
    'shield': (['  wwwww  ', ' wpppppw ', ' wpppppw ', ' wpppppw ', ' wpppppw ', '  wpppw  ', '   wpw   ', '    w    '], {'w': (255, 255, 255, 255), 'p': (255, 123, 229, 255)}),
    'up': (['    w    ', '   www   ', '  wwwww  ', ' wwwwwww ', '   www   ', '   www   ', '   www   ', '   www   '], {'w': (255, 255, 255, 255)}),
    'down': (['   www   ', '   www   ', '   www   ', '   www   ', ' wwwwwww ', '  wwwww  ', '   www   ', '    w    '], {'w': (255, 255, 255, 255)}),
    'wind': (['         ', ' wwwww   ', '      w  ', 'wwwwwww  ', '         ', ' wwwwwww ', '       w ', '   wwww  '], {'w': (255, 255, 255, 255)}),
    'star': (['    w    ', '    w    ', '   www   ', 'wwwwwwwww', ' wwwwwww ', '  wwwww  ', ' www www ', ' w     w '], {'w': (255, 255, 255, 255)}),
    'mountain': (['    w    ', '   www   ', '   w w   ', '  ww ww  ', '  w   w  ', ' ww   ww ', ' w     w ', 'wwwwwwwww'], {'w': (255, 255, 255, 255)}),
}


def sprites():
    hud = G.mkdir(os.path.join(SPR, 'hud'))
    # la hotbar no hace falta en el parkour: fuera, y en su sitio va el panel de estado
    G.canvas(182, 22).save(os.path.join(hud, 'hotbar.png'))
    G.canvas(24, 23).save(os.path.join(hud, 'hotbar_selection.png'))
    for n in ('hotbar_offhand_left', 'hotbar_offhand_right'):
        G.canvas(29, 24).save(os.path.join(hud, n + '.png'))
    G.canvas(182, 5).save(os.path.join(hud, 'experience_bar_background.png'))
    G.canvas(182, 5).save(os.path.join(hud, 'experience_bar_progress.png'))
    for n in ('armor_empty', 'armor_full', 'armor_half', 'air', 'air_bursting', 'air_empty'):
        G.canvas(9, 9).save(os.path.join(hud, n + '.png'))
    bb = G.mkdir(os.path.join(SPR, 'boss_bar'))
    for c in ('blue', 'green', 'pink', 'purple', 'red', 'white', 'yellow'):
        for k in ('background', 'progress'):
            G.canvas(182, 5).save(os.path.join(bb, f'{c}_{k}.png'))
    for n in (6, 10, 12, 20):
        for k in ('background', 'progress'):
            G.canvas(182, 5).save(os.path.join(bb, f'notched_{n}_{k}.png'))


def build():
    names = {}
    atlas, grid, cell = G.text_atlas()
    G.add_set('txt', atlas, grid, cell)
    G.add_set('txt2', atlas, grid, cell, scale=2)
    atlas_o, grid_o, cell_o = G.text_atlas(outline=True)
    G.add_set('txto', atlas_o, grid_o, cell_o)
    G.add_set('txto2', atlas_o, grid_o, cell_o, scale=2)

    icons = {k: G.ICONS[k] for k in ('skull', 'clock', 'flag', 'trophy', 'warn', 'bolt', 'gift', 'cross', 'like')}
    icons.update(ICON_EXTRA)
    for k, (rows, pal) in icons.items():
        names['i_' + k] = G.single('i_' + k, G.icon(rows, pal))
    icon_names = ['i_' + k for k in icons]

    names['p_top'] = G.single('p_top', top_panel())
    names['p_stat'] = G.single('p_stat', stat_panel())
    for nm, h in (('pill', 14), ('ban', 40)):
        l, m, r = plate(h)
        for suffix, img in (('_l', l), ('_m', m), ('_r', r)):
            names[nm + suffix] = G.single(nm + suffix, img)

    # progreso del nivel: 120×5 en pasos de 2 px
    chs = [G.code() for _ in range(61)]
    G.add_set('b_lvl', G.bar_atlas(120, 5, 60, 'seg'), chs, (120, 5))
    names['b_lvl'] = chs
    # segmentos de la tira de la torre, de 1 a 12 px de ancho (según cuántos niveles haya): normal y «actual»
    seg, segc = {}, {}
    for w in range(1, 13):
        seg[str(w)] = G.single(f'seg{w}', segment(w, 7))
        segc[str(w)] = G.single(f'segc{w}', segment(w, 9, True))
    names['seg'] = {k: [v] for k, v in seg.items()}
    names['segc'] = {k: [v] for k, v in segc.items()}

    spaces, sp = {}, {}
    for i in range(11):
        n = 1 << i
        a, b = chr(0xF800 + i), chr(0xF820 + i)
        spaces[a], spaces[b] = -n, n
        sp[str(-n)], sp[str(n)] = a, b
    spaces[' '] = 4
    names['space'] = sp

    def ab(d):
        return d - 65

    def bb(y):
        return 10 - y

    # ── arriba ──
    G.font('bb_top', 1, [('p_top', bb(2)), ('txt2', bb(3))] + [(f'seg{w}', bb(28)) for w in range(1, 13)] + [(f'segc{w}', bb(27)) for w in range(1, 13)])
    G.font('bb_name', 1, [('txto', bb(2))])
    G.font('bb_sub', 1, [('txto', bb(11))])
    G.font('bb_ban', 1, [('ban_l', bb(48)), ('ban_m', bb(48)), ('ban_r', bb(48)), ('txto2', bb(50))])
    G.font('bb_bansub', 1, [('txto', bb(73))])
    # ── abajo ──
    G.font('ab_panel', 1, [('p_stat', ab(31))])
    G.font('ab_r1', 1, [('i_flag', ab(28)), ('b_lvl', ab(25)), ('txto', ab(29))])
    G.font('ab_r2', 1, [('txto', ab(16))] + [(k, ab(15)) for k in icon_names])
    G.font('ab_n1', 1, [('pill_l', ab(50)), ('pill_m', ab(50)), ('pill_r', ab(50)), ('txt', ab(49))] + [(k, ab(48)) for k in icon_names])

    metrics = G.write_fonts(spaces)
    # el motor escribe con el espacio de nombres de Base Defense: aquí es «parkour»
    for fn in os.listdir(G.FONTS):
        p = os.path.join(G.FONTS, fn)
        s = open(p, encoding='utf8').read().replace('basedefense:font/hud/', 'parkour:font/hud/')
        open(p, 'w', encoding='utf8').write(s)
    metrics = {k.replace('basedefense:', 'parkour:'): v for k, v in metrics.items()}
    sprites()
    json.dump({'fonts': metrics, 'glyphs': names}, open(METRICS, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
    print('hud parkour: fuentes', len(G.FONTDEFS), '· glifos', G.PUA[0] - 0xE000)


if __name__ == '__main__':
    build()
