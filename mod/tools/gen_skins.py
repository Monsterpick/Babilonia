"""Personajes con las skins de Minecraft (64×64) que aporta el usuario en referencias/skins/.
Geometría de jugador estándar (cabeza, torso, brazos y piernas) más la capa exterior (pelo/gorro, chaqueta,
mangas y pantalón) un poco más grande, con el UV de caja de las skins. Detecta brazos finos (tipo Alex).
Huesos y animaciones del contrato (las animaciones las escribe gen_personajes.py)."""
import os
from PIL import Image
from geo import Geo, tex_path

HERE = os.path.dirname(os.path.abspath(__file__))
ANCHORS = {
    'goku': [('manos', 'root', (0, 40, 0))],
    'gojo': [('mano_izquierda', 'brazo_izquierdo', (6, 10.5, 0)), ('mano_derecha', 'brazo_derecho', (-6, 10.5, 0)), ('mano_proyectil', 'cuerpo', (0, 18, -5))],
    'sukuna': [('manos', 'cuerpo', (0, 19, -5))],
    'akaza': [('puno_derecho', 'brazo_derecho', (-6, 10.5, 0))],
    'choso': [('manos', 'cuerpo', (0, 21, -11))],
}


def slim(img):
    """Brazos de 3 px: la columna 54 de la zona del brazo derecho está vacía."""
    px = img.load()
    return all(px[54, y][3] == 0 for y in range(20, 32))


def box(g, bone, origin, size, uv, inflate=0.0):
    c = {'origin': list(origin), 'size': list(size), 'uv': list(uv)}
    if inflate:
        c['inflate'] = inflate
    bone['cubes'].append(c)


def build(name):
    img = Image.open(os.path.join(HERE, 'referencias', 'skins', f'{name}.png')).convert('RGBA')
    if img.size[1] == 32:  # skin antigua 64×32: se completa con brazo y pierna izquierdos espejados
        new = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        new.paste(img, (0, 0))
        new.paste(img.crop((0, 16, 16, 32)).transpose(Image.FLIP_LEFT_RIGHT), (16, 48))
        new.paste(img.crop((40, 16, 56, 32)).transpose(Image.FLIP_LEFT_RIGHT), (32, 48))
        img = new
    img.save(tex_path(name))
    Image.new('RGBA', (64, 64), (0, 0, 0, 0)).save(tex_path(name, '_glowmask'))
    aw = 3 if slim(img) else 4
    g = Geo(name, 64, 64, bounds=(3, 3, 1.5))
    root = g.bone('root', rotation=(0, 180, 0))
    body = g.bone('cuerpo', 'root', pivot=(0, 12, 0))
    box(g, body, (-4, 12, -2), (8, 12, 4), (16, 16))
    box(g, body, (-4, 12, -2), (8, 12, 4), (16, 32), 0.25)
    head = g.bone('cabeza', 'cuerpo', pivot=(0, 24, 0))
    box(g, head, (-4, 24, -4), (8, 8, 8), (0, 0))
    box(g, head, (-4, 24, -4), (8, 8, 8), (32, 0), 0.5)
    ra = g.bone('brazo_derecho', 'cuerpo', pivot=(-5, 22, 0))
    box(g, ra, (-4 - aw, 12, -2), (aw, 12, 4), (40, 16))
    box(g, ra, (-4 - aw, 12, -2), (aw, 12, 4), (40, 32), 0.25)
    la = g.bone('brazo_izquierdo', 'cuerpo', pivot=(5, 22, 0))
    box(g, la, (4, 12, -2), (aw, 12, 4), (32, 48))
    box(g, la, (4, 12, -2), (aw, 12, 4), (48, 48), 0.25)
    rl = g.bone('pierna_derecha', 'root', pivot=(-1.9, 12, 0))
    box(g, rl, (-3.9, 0, -2), (4, 12, 4), (0, 16))
    box(g, rl, (-3.9, 0, -2), (4, 12, 4), (0, 32), 0.25)
    ll = g.bone('pierna_izquierda', 'root', pivot=(1.9, 12, 0))
    box(g, ll, (-0.1, 0, -2), (4, 12, 4), (16, 48))
    box(g, ll, (-0.1, 0, -2), (4, 12, 4), (0, 48), 0.25)
    for bname, parent, piv in ANCHORS[name]:
        g.bone(bname, parent, pivot=piv)
    g.save()
    print(name, 'brazos', 'finos' if aw == 3 else 'anchos')


if __name__ == '__main__':
    for n in ANCHORS:
        build(n)
