"""Convierte una construcción exportada con Mineways (OBJ + atlas) en una malla compacta que el mod dibuja tal cual
(assets/livearena/mesh/<nombre>.bin.gz + textures/entity/<nombre>_mesh.png).

Formato (big-endian, comprimido con gzip):
  int 'LAM1', int quads, float alto_en_bloques
  por quad: byte normal (0:+X 1:-X 2:+Y 3:-Y 4:+Z 5:-Z), 4 × (short x, short y, short z en 1/64 de bloque,
            ushort u, ushort v en 1/65535)
El suelo de la construcción queda en y=0 y el centro en x=z=0. Un bloque de Minecraft = 1 bloque."""
import gzip, os, struct, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', 'src', 'main', 'resources', 'assets', 'livearena')


def convert(name, obj, png, blocks_per_unit):
    vs, vts, vns, quads = [], [], [], []
    for line in open(obj, encoding='utf-8', errors='ignore'):
        if line.startswith('v '):
            vs.append(tuple(map(float, line.split()[1:4])))
        elif line.startswith('vt '):
            vts.append(tuple(map(float, line.split()[1:3])))
        elif line.startswith('vn '):
            vns.append(tuple(map(float, line.split()[1:4])))
        elif line.startswith('f '):
            pts = []
            for p in line.split()[1:]:
                a = p.split('/')
                vi, ti = int(a[0]), int(a[1]) if len(a) > 1 and a[1] else 0
                ni = int(a[2]) if len(a) > 2 and a[2] else 0
                vi = vi - 1 if vi > 0 else len(vs) + vi
                ti = ti - 1 if ti > 0 else len(vts) + ti
                ni = ni - 1 if ni > 0 else len(vns) + ni
                pts.append((vi, ti, ni))
            if len(pts) == 3:
                pts.append(pts[2])
            if len(pts) == 4:
                quads.append(pts)
    V = np.array(vs) * blocks_per_unit
    mn, mx = V.min(0), V.max(0)
    cx, cz, y0 = (mn[0] + mx[0]) / 2, (mn[2] + mx[2]) / 2, mn[1]
    out = bytearray(struct.pack('>iif', 0x4C414D31, len(quads), float(mx[1] - y0)))
    for q in quads:
        nx, ny, nz = vns[q[0][2]] if vns else (0, 1, 0)
        ax = int(np.argmax(np.abs([nx, ny, nz])))
        normal = ax * 2 + (0 if [nx, ny, nz][ax] > 0 else 1)
        out += struct.pack('>b', normal)
        for vi, ti, _ in q:
            x, y, z = V[vi]
            u, v = vts[ti]
            out += struct.pack('>hhhHH', int(round((x - cx) * 64)), int(round((y - y0) * 64)), int(round((z - cz) * 64)),
                               int(round(min(1, max(0, u)) * 65535)), int(round(min(1, max(0, 1 - v)) * 65535)))
    os.makedirs(os.path.join(ROOT, 'mesh'), exist_ok=True)
    with gzip.open(os.path.join(ROOT, 'mesh', f'{name}.bin.gz'), 'wb', compresslevel=9) as f:
        f.write(out)
    Image.open(png).convert('RGBA').save(os.path.join(ROOT, 'textures', 'entity', f'{name}_mesh.png'))
    print(f'{name}: {len(quads)} caras, {mx[0] - mn[0]:.0f}×{mx[1] - y0:.0f}×{mx[2] - mn[2]:.0f} bloques')


if __name__ == '__main__':
    import tempfile, zipfile, io
    R = os.path.join(HERE, 'referencias', 'santuario_obj')
    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(os.path.join(R, 'sukuna-temple.zip')) as z:
            z.extractall(tmp)
        with zipfile.ZipFile(os.path.join(tmp, 'source', 'Mineways2Skfb_obj.zip')) as z:
            z.extractall(tmp)
        # En la exportación de Mineways el alto total vale 1 y cada bloque mide 1/52.
        convert('santuario', os.path.join(tmp, 'Mineways2Skfb.obj'), os.path.join(tmp, 'textures', 'Mineways2Skfb-RGBA.png'), 52)
