"""Personajes a partir de las hojas de referencia (frente · lado · espalda), con la textura integrada en el volumen.

- Torso, brazos, piernas (y faldón): cubos con las medidas del dibujo. Cada cara usa un recorte ajustado a la pieza
  y «enderezado» fila a fila (el tramo opaco de cada fila se estira a todo el ancho): sin márgenes transparentes,
  sin bordes flotantes y con brazos inclinados del dibujo puestos rectos.
- Cabeza: cubo de la cara (8×8×8) con detalle de 4 texeles por unidad.
- Pelo: volumen real en 3D (casco visual): un vóxel por unidad allí donde la silueta de frente, la de lado y la de
  espalda coinciden, fuera del cubo de la cara. Cada cara del vóxel toma el color de su vista.
Huesos y animaciones del contrato (las animaciones las escribe gen_personajes.py).
"""
import os
import numpy as np
from PIL import Image
from geo import Geo, tex_path
from gen_ref import load, Packer

T = 4  # texeles por unidad


def straighten(img, box):
    """Recorte de la caja con cada fila estirada a su tramo opaco (quita márgenes e inclinación)."""
    c = np.asarray(img.crop(tuple(int(round(v)) for v in box))).copy()
    h, w = c.shape[:2]
    out = np.zeros_like(c)
    rows = [y for y in range(h) if (c[y, :, 3] > 0).any()]
    if not rows:
        return Image.fromarray(c, 'RGBA')
    y0, y1 = rows[0], rows[-1] + 1
    for y in range(h):
        sy = min(max(y, y0), y1 - 1)
        xs = np.where(c[sy, :, 3] > 0)[0]
        if len(xs) == 0:
            # fila sin nada: copia la vecina opaca más cercana
            near = min(rows, key=lambda r: abs(r - sy))
            xs = np.where(c[near, :, 3] > 0)[0]
            sy = near
        a, b = xs[0], xs[-1] + 1
        src = c[sy, a:b]
        idx = np.clip(((np.arange(w) + 0.5) * (b - a) / w).astype(int), 0, b - a - 1)
        out[y] = src[idx]
        out[y, :, 3] = 255
    return Image.fromarray(out[y0:y1] if y1 - y0 > 2 else out, 'RGBA')


def fit(im, uw, uh, flip=False):
    im = im.resize((max(1, int(round(uw * T))), max(1, int(round(uh * T)))), Image.NEAREST)
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im


def build(name, C, anchors):
    img = load(name)
    if C.get('side_front') == 'left':
        # Normalizamos: la vista de lado siempre con la cara hacia la derecha.
        sx0, sx1 = C['side_fig']
        side = img.crop((sx0, 0, sx1, img.size[1])).transpose(Image.FLIP_LEFT_RIGHT)
        img = img.copy()
        img.paste(Image.new('RGBA', side.size, (0, 0, 0, 0)), (sx0, 0))
        img.alpha_composite(side, (sx0, 0))
        flip_x = lambda a, b: (sx0 + sx1 - b, sx0 + sx1 - a)
    else:
        flip_x = lambda a, b: (a, b)
    u, cf, cb, base = C['u'], C['front_c'], C['back_c'], C['base']
    scx = sum(flip_x(*C['side_c2'])) / 2 if 'side_c2' in C else C['side_c']
    pk = Packer(2048)
    cubes = []
    geo = {}

    def back_box(x0, x1):
        return cb - (x1 - cf), cb - (x0 - cf)

    def part(bone, box, side):
        x0, y0, x1, y1 = box
        sx0, sx1 = flip_x(*side)
        w, h, d = (x1 - x0) / u, (y1 - y0) / u, (sx1 - sx0) / u
        mx0, my0, mz0 = -(x1 - cf) / u, (base - y1) / u, (scx - sx1) / u
        bx0, bx1 = back_box(x0, x1)
        fr = straighten(img, box)
        bk = straighten(img, (bx0, y0, bx1, y1))
        sd = straighten(img, (sx0, y0, sx1, y1))
        top = fr.crop((0, 0, fr.size[0], max(1, fr.size[1] // 10)))
        bot = fr.crop((0, fr.size[1] - max(1, fr.size[1] // 10), fr.size[0], fr.size[1]))
        uv = {
            'north': (pk.add(fit(fr, w, h)), w, h),
            'south': (pk.add(fit(bk, w, h)), w, h),
            'east': (pk.add(fit(sd, d, h)), d, h),
            'west': (pk.add(fit(sd, d, h, True)), d, h),
            'up': (pk.add(fit(top, w, d)), w, d),
            'down': (pk.add(fit(bot, w, d)), w, d),
        }
        cubes.append((bone, (mx0, my0, mz0), (w, h, d), uv))
        geo.setdefault(bone, []).append((mx0, my0, mz0, w, h, d))

    for bone, specs in C['parts'].items():
        for box, side in specs:
            part(bone, box, side)

    # ---- cabeza: cubo de la cara + pelo en vóxeles
    fx0, fy0, fx1, fy1 = C['face']
    fsx0, fsx1 = flip_x(*C['face_side'])
    hw, hh, hd = (fx1 - fx0) / u, (fy1 - fy0) / u, (fsx1 - fsx0) / u
    hx0, hy0, hz0 = -(fx1 - cf) / u, (base - fy1) / u, (scx - fsx1) / u
    face_img = img.crop((fx0, fy0, fx1, fy1))
    bfx0, bfx1 = back_box(fx0, fx1)
    uvh = {
        'north': (pk.add(fit(face_img, hw, hh)), hw, hh),
        'south': (pk.add(fit(img.crop((bfx0, fy0, bfx1, fy1)), hw, hh)), hw, hh),
        'east': (pk.add(fit(img.crop((fsx0, fy0, fsx1, fy1)), hd, hh)), hd, hh),
        'west': (pk.add(fit(img.crop((fsx0, fy0, fsx1, fy1)), hd, hh, True)), hd, hh),
        'up': (pk.add(fit(img.crop((fx0, fy0, fx1, fy0 + (fy1 - fy0) * 0.15)), hw, hd)), hw, hd),
        'down': (pk.add(fit(face_img.crop((0, face_img.size[1] - 6, face_img.size[0], face_img.size[1])), hw, hd)), hw, hd),
    }
    cubes.append(('cabeza', (hx0, hy0, hz0), (hw, hh, hd), uvh))
    geo['cabeza'] = [(hx0, hy0, hz0, hw, hh, hd)]

    rx0, ry0, rx1, ry1 = C['head_region']
    rsx0, rsx1 = flip_x(*C['head_side'])
    nx, ny, nz = int(round((rx1 - rx0) / u)), int(round((ry1 - ry0) / u)), int(round((rsx1 - rsx0) / u))
    A = np.asarray(img)
    rbx0, _ = back_box(rx0, rx1)

    def alpha(x, y):
        x, y = int(x), int(y)
        if 0 <= y < A.shape[0] and 0 <= x < A.shape[1]:
            return A[y, x, 3] > 0
        return False

    # Texturas de la región del pelo (frente, espalda, lado) a 4 texeles por unidad.
    fr_img = fit(img.crop((rx0, ry0, rx0 + nx * u, ry0 + ny * u)), nx, ny)
    bx_a, bx_b = back_box(rx0, rx0 + nx * u)
    bk_img = fit(img.crop((bx_a, ry0, bx_b, ry0 + ny * u)), nx, ny)
    sd_img = fit(img.crop((rsx0, ry0, rsx0 + nz * u, ry0 + ny * u)), nz, ny)
    pf, pb, ps = pk.add(fr_img), pk.add(bk_img), pk.add(sd_img)
    pw = pk.add(sd_img.transpose(Image.FLIP_LEFT_RIGHT))
    vox = np.zeros((nx, ny, nz), bool)
    for i in range(nx):
        X = rx0 + (i + 0.5) * u
        bX = cb - (X - cf)
        for j in range(ny):
            Y = ry0 + (j + 0.5) * u
            if not alpha(X, Y):
                continue
            for k in range(nz):
                Z = rsx0 + (k + 0.5) * u
                if alpha(Z, Y) and alpha(bX, Y):
                    vox[i, j, k] = True
    # fuera del cubo de la cara (con 0.5 de margen)
    count = 0
    hair = []
    for i in range(nx):
        for j in range(ny):
            for k in range(nz):
                if not vox[i, j, k]:
                    continue
                X = rx0 + (i + 0.5) * u
                Y = ry0 + (j + 0.5) * u
                Z = rsx0 + (k + 0.5) * u
                inside = fx0 - u * 0.2 <= X <= fx1 + u * 0.2 and fy0 - u * 0.2 <= Y <= fy1 + u * 0.2 and fsx0 - u * 0.2 <= Z <= fsx1 + u * 0.2
                if inside:
                    continue
                # interior: los 6 vecinos llenos → no se ve
                nb = 0
                for di, dj, dk in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
                    a2, b2, c2 = i + di, j + dj, k + dk
                    if 0 <= a2 < nx and 0 <= b2 < ny and 0 <= c2 < nz and vox[a2, b2, c2]:
                        nb += 1
                if nb == 6:
                    continue
                hair.append((i, j, k))
    vx0 = -(rx0 + nx * u - cf) / u
    vy0 = (base - (ry0 + ny * u)) / u
    vz0 = (scx - (rsx0 + nz * u)) / u
    atlas = pk.image()
    atlas.save(tex_path(name))
    Image.new('RGBA', atlas.size, (0, 0, 0, 0)).save(tex_path(name, '_glowmask'))

    g = Geo(name, atlas.size[0], atlas.size[1], bounds=(4, 4, 1.5))
    bones = {'root': g.bone('root', rotation=(0, 180, 0))}

    def ub(b):
        return geo[b][0]

    def top_center(b, down=2.0):
        x0, y0, z0, w, h, d = ub(b)
        return (x0 + w / 2, y0 + h - down, z0 + d / 2)

    bones['cuerpo'] = g.bone('cuerpo', 'root', pivot=(0, ub('cuerpo')[1], 0))
    bones['cabeza'] = g.bone('cabeza', 'cuerpo', pivot=(0, hy0, hz0 + hd / 2))
    for b in ('brazo_izquierdo', 'brazo_derecho'):
        bones[b] = g.bone(b, 'cuerpo', pivot=top_center(b))
    for b in ('pierna_izquierda', 'pierna_derecha'):
        bones[b] = g.bone(b, 'root', pivot=top_center(b, 0))
    for bname, parent, piv in anchors:
        bones[bname] = g.bone(bname, parent, pivot=piv(ub))
    for bone, origin, size, uv in cubes:
        faces = {f: (p[0], p[1], max(1, int(round(w * T))), max(1, int(round(h * T)))) for f, (p, w, h) in uv.items()}
        g.cube(bones[bone], origin, size, faces)
    # vóxeles del pelo (x crece hacia −X del modelo: la izquierda de la imagen queda en +X)
    for i, j, k in hair:
        ox = vx0 + (nx - 1 - i)
        oy = vy0 + (ny - 1 - j)
        oz = vz0 + (nz - 1 - k)
        fu = (pf[0] + i * T, pf[1] + j * T, T, T)
        bu = (pb[0] + (nx - 1 - i) * T, pb[1] + j * T, T, T)
        su = (ps[0] + k * T, ps[1] + j * T, T, T)
        wu = (pw[0] + (nz - 1 - k) * T, pw[1] + j * T, T, T)
        g.cube(bones['cabeza'], (ox, oy, oz), (1, 1, 1), {'north': fu, 'south': bu, 'east': su, 'west': wu, 'up': fu, 'down': fu})
        count += 1
    g.save()
    top = max(y0 + h for bs in geo.values() for (_, y0, _, _, h, _) in bs)
    print(f'{name}: {len(cubes)} piezas + {count} vóxeles de pelo; alto {max(top, vy0 + ny) / 16:.2f} bloques')


def hand(side_bone):
    return lambda ub: (ub(side_bone)[0] + ub(side_bone)[3] / 2, ub(side_bone)[1] + 1.5, ub(side_bone)[2] + ub(side_bone)[5] / 2)


def chest(fy, fz):
    return lambda ub: (0, ub('cuerpo')[1] + ub('cuerpo')[4] * fy, ub('cuerpo')[2] - fz)


CHARS = {
    'akaza': (dict(u=230 / 8, front_c=412.5, back_c=1625, side_c=1015, base=1062,
                   face=(295, 132, 525, 362), face_side=(915, 1145),
                   head_region=(268, 92, 552, 362), head_side=(882, 1160),
                   parts={
                       'cuerpo': [((285, 362, 540, 625), (950, 1080))],
                       'brazo_izquierdo': [((168, 362, 285, 697), (952, 1078))],
                       'brazo_derecho': [((540, 362, 655, 697), (952, 1078))],
                       'pierna_izquierda': [((268, 625, 410, 1062), (935, 1100))],
                       'pierna_derecha': [((410, 625, 552, 1062), (935, 1100))],
                   }),
              [('puno_derecho', 'brazo_derecho', hand('brazo_derecho'))]),
    'gojo': (dict(u=230 / 8, front_c=362.5, back_c=1654.5, side_c=1013, base=1079,
                  face=(250, 183, 480, 413), face_side=(900, 1130),
                  head_region=(190, 84, 538, 413), head_side=(848, 1170),
                  parts={
                      'cuerpo': [((240, 413, 485, 763), (935, 1092))],
                      'brazo_izquierdo': [((95, 425, 245, 760), (940, 1088))],
                      'brazo_derecho': [((480, 425, 630, 760), (940, 1088))],
                      'pierna_izquierda': [((235, 763, 362, 1079), (950, 1118))],
                      'pierna_derecha': [((362, 763, 490, 1079), (950, 1118))],
                  }),
             [('mano_izquierda', 'brazo_izquierdo', hand('brazo_izquierdo')), ('mano_derecha', 'brazo_derecho', hand('brazo_derecho')),
              ('mano_proyectil', 'cuerpo', chest(0.55, 5))]),
    'sukuna': (dict(u=240 / 8, front_c=352.5, back_c=1655.5, side_c=1021, base=1080,
                    face=(235, 120, 475, 360), face_side=(900, 1140),
                    head_region=(196, 76, 507, 360), head_side=(870, 1145),
                    parts={
                        'cuerpo': [((225, 360, 480, 680), (955, 1087)), ((228, 680, 477, 962), (955, 1087))],
                        'brazo_izquierdo': [((104, 360, 232, 717), (962, 1082))],
                        'brazo_derecho': [((476, 360, 607, 717), (962, 1082))],
                        'pierna_izquierda': [((230, 960, 352, 1080), (905, 1082))],
                        'pierna_derecha': [((352, 960, 475, 1080), (905, 1082))],
                    }),
               [('manos', 'cuerpo', chest(0.6, 5))]),
    'goku': (dict(u=20, front_c=239, back_c=995, side_c2=(577, 667), side_front='left', side_fig=(513, 757), base=823,
                  face=(160, 195, 320, 355), face_side=(540, 700),
                  head_region=(55, 85, 408, 355), head_side=(511, 759),
                  parts={
                      'cuerpo': [((158, 355, 320, 595), (577, 667))],
                      'brazo_izquierdo': [((82, 355, 158, 590), (590, 670))],
                      'brazo_derecho': [((320, 355, 398, 590), (590, 670))],
                      'pierna_izquierda': [((158, 595, 240, 823), (580, 665))],
                      'pierna_derecha': [((240, 595, 320, 823), (580, 665))],
                  }),
             [('manos', 'root', lambda ub: (0, 40, 0))]),
}

if __name__ == '__main__':
    for n, (c, an) in CHARS.items():
        build(n, c, an)
