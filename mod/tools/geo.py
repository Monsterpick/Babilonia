"""Utilidades para generar modelos GeckoLib (Bedrock geo 1.12) y animaciones desde Python."""
import json, math, os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src', 'main', 'resources', 'assets', 'livearena')
FACES = ('north', 'south', 'east', 'west', 'up', 'down')


class Geo:
    def __init__(self, name, tw=256, th=256, bounds=(8, 8, 0)):
        self.name, self.tw, self.th, self.bounds = name, tw, th, bounds
        self.bones = []
        self._names = set()

    def bone(self, name, parent=None, pivot=(0, 0, 0), rotation=None):
        assert name not in self._names, name
        self._names.add(name)
        b = {'name': name, 'pivot': [round(v, 4) for v in pivot]}
        if parent:
            b['parent'] = parent
        if rotation and any(rotation):
            b['rotation'] = [round(v, 4) for v in rotation]
        b['cubes'] = []
        self.bones.append(b)
        return b

    def cube(self, bone, origin, size, sw, rotation=None, pivot=None, inflate=0, faces=None):
        """sw = (u, v, w, h): región de la textura que se estira sobre cada cara."""
        u, v, w, h = sw
        fs = faces or FACES
        c = {
            'origin': [round(x, 4) for x in origin],
            'size': [round(max(x, 0.0001), 4) for x in size],
            'uv': {f: {'uv': [u, v], 'uv_size': [w, h]} for f in fs},
        }
        if inflate:
            c['inflate'] = inflate
        if rotation and any(rotation):
            c['rotation'] = [round(x, 4) for x in rotation]
            c['pivot'] = [round(x, 4) for x in (pivot or (0, 0, 0))]
        bone['cubes'].append(c)
        return c

    def save(self):
        for b in self.bones:
            if not b['cubes']:
                del b['cubes']
        bw, bh, by = self.bounds
        geo = {
            'format_version': '1.12.0',
            'minecraft:geometry': [{
                'description': {
                    'identifier': f'geometry.{self.name}', 'texture_width': self.tw, 'texture_height': self.th,
                    'visible_bounds_width': bw, 'visible_bounds_height': bh, 'visible_bounds_offset': [0, by, 0],
                },
                'bones': self.bones,
            }],
        }
        p = os.path.join(ROOT, 'geckolib', 'models', f'{self.name}.geo.json')
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'w') as f:
            json.dump(geo, f, separators=(',', ':'))
        return p


def save_anims(name, anims):
    out = {'format_version': '1.8.0', 'animations': anims, 'geckolib_format_version': 2}
    p = os.path.join(ROOT, 'geckolib', 'animations', f'{name}.animation.json')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w') as f:
        json.dump(out, f, separators=(',', ':'))


def anim(length, loop, bones):
    """bones: {bone: {'rotation'|'position'|'scale': {t: [x,y,z] | (x,y,z,'easing')}}}"""
    out = {}
    for b, chans in bones.items():
        out[b] = {}
        for ch, keys in chans.items():
            kk = {}
            for t, val in sorted(keys.items()):
                if isinstance(val, tuple) and len(val) == 4:
                    kk[f'{t:.3f}'] = {'vector': list(val[:3]), 'easing': val[3]}
                else:
                    kk[f'{t:.3f}'] = list(val)
            out[b][ch] = kk
    a = {'animation_length': length, 'bones': out}
    if loop:
        a['loop'] = True
    elif loop is None:
        a['loop'] = 'hold_on_last_frame'
    return a


def tex_path(name, suffix=''):
    p = os.path.join(ROOT, 'textures', 'entity', f'{name}{suffix}.png')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


def fib_sphere(n):
    """n direcciones repartidas uniformemente en la esfera."""
    pts = []
    ga = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        y = 1 - (i / (n - 1)) * 2
        r = math.sqrt(max(0, 1 - y * y))
        th = ga * i
        pts.append((math.cos(th) * r, y, math.sin(th) * r))
    return pts


def dir_to_angles(d):
    """(yaw, pitch) en grados para llevar el eje +Y a la dirección d con hueso padre yaw (Y) e hijo pitch (X)."""
    x, y, z = d
    pitch = math.degrees(math.acos(max(-1, min(1, y))))
    yaw = math.degrees(math.atan2(x, z))
    return yaw, pitch
