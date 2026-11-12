"""Pack de Dropper LIVE (todo generado aquí; nada copiado).

- Barra superior (BossBar) con textura propia: cristal oscuro con borde y relleno degradado con brillo y rayas
  para cada color (el plugin elige el color según el bioma del nivel).
- Sonidos sintetizados: checkpoint, subir/bajar de nivel, empujón, viento, hielo, fantasma, terremoto, cima…

Uso: python3 tools/gen_pack.py  →  src/pack/  (Gradle lo comprime en dropper-pack.zip dentro del plugin)
"""
import json, os, shutil, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'src', 'pack')
MC = os.path.join(OUT, 'assets', 'minecraft')
PK = os.path.join(OUT, 'assets', 'dropper')
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', 'mod', 'tools'))
import gen_sonidos as S  # noqa: E402

rng = np.random.default_rng(77)


def mkdir(p):
    os.makedirs(p, exist_ok=True)
    return p


# ─────────────────────────── barra superior ───────────────────────────

K = 4                      # resolución ×4 (el juego la dibuja a 182×5)
W, H = 182 * K, 5 * K
COLORS = {
    'green': ((60, 230, 120), (20, 150, 90)),
    'blue': ((90, 190, 255), (40, 90, 230)),
    'red': ((255, 90, 80), (190, 30, 50)),
    'yellow': ((255, 220, 80), (240, 140, 20)),
    'purple': ((200, 120, 255), (110, 50, 220)),
    'pink': ((255, 130, 210), (220, 60, 150)),
    'white': ((245, 245, 255), (160, 175, 200)),
}


def rounded_mask():
    y, x = np.mgrid[0:H, 0:W]
    r = H / 2
    cx = np.clip(x, r, W - r)
    d = np.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - r) ** 2)
    return np.clip(r - d + 0.5, 0, 1)


def background():
    m = rounded_mask()
    y = np.mgrid[0:H, 0:W][0] / (H - 1)
    img = np.zeros((H, W, 4))
    base = 18 + 16 * (1 - y)
    img[..., 0] = base
    img[..., 1] = base + 2
    img[..., 2] = base + 10
    img[..., 3] = 200 * m
    # borde claro
    inner = rounded_mask_shrink(m)
    edge = (m > 0.5) & (inner < 0.5)
    img[edge, :3] = (120, 130, 150)
    img[edge, 3] = 230
    return img


def rounded_mask_shrink(m):
    s = np.zeros_like(m)
    s[1:-1, 1:-1] = np.minimum.reduce([m[:-2, 1:-1], m[2:, 1:-1], m[1:-1, :-2], m[1:-1, 2:], m[1:-1, 1:-1]])
    return s


def progress(a, b):
    m = rounded_mask()
    yy, xx = np.mgrid[0:H, 0:W]
    t = xx / (W - 1)
    col = np.array(b, float)[None, None, :] * (1 - t[..., None]) + np.array(a, float)[None, None, :] * t[..., None]
    # brillo superior y sombra inferior (aspecto de cristal)
    v = yy / (H - 1)
    shade = 1.25 - 0.55 * v
    col = col * shade[..., None]
    gloss = (v < 0.35) * 70
    col += gloss[..., None]
    # rayas diagonales suaves
    stripes = ((xx + yy * 1.0) // (3 * K)) % 2 == 0
    col[stripes] *= 0.9
    img = np.zeros((H, W, 4))
    img[..., :3] = np.clip(col, 0, 255)
    img[..., 3] = 255 * m
    return img


def save(img, path):
    mkdir(os.path.dirname(path))
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGBA').save(path)


def bossbars():
    d = os.path.join(MC, 'textures', 'gui', 'sprites', 'boss_bar')
    bg = background()
    for name, (a, b) in COLORS.items():
        save(bg, os.path.join(d, f'{name}_background.png'))
        save(progress(a, b), os.path.join(d, f'{name}_progress.png'))
    print('barras: 7 colores')


# ─────────────────────────── sonidos ───────────────────────────

def tone(f, dur, decay=4.0, harm=(1, 0.4, 0.15)):
    t = S.t_(dur)
    x = sum(a * np.sin(2 * np.pi * f * (i + 1) * t) for i, a in enumerate(harm))
    return x * np.exp(-t * decay)


def seq(notes, step, dur, decay=5.0):
    total = step * len(notes) + dur
    out = np.zeros(int(total * S.SR))
    for i, f in enumerate(notes):
        n = tone(f, dur, decay)
        s = int(i * step * S.SR)
        out[s:s + len(n)] += n
    return out


def whoosh(d=0.7):
    t = S.t_(d)
    return S.sweep_filter(S.noise(d), 400, 3500, 4) * S.env(d, 0.08, 0.6, 1.6) * 0.9


def sounds():
    D = mkdir(os.path.join(PK, 'sounds'))
    S.OUT = D
    S.save('checkpoint', S.reverb(seq([659, 784, 988, 1319], 0.07, 0.6), 1.2, 0.3) * 0.7)
    S.save('nivel', S.reverb(S.mix(whoosh() * 0.5, S.pad(seq([523, 659, 784], 0.09, 0.8), 1.2)), 1.4, 0.3))
    d = 1.0
    t = S.t_(d)
    up = np.sin(2 * np.pi * np.cumsum(np.linspace(300, 1400, len(t))) / S.SR) * S.env(d, 0.05, 0.95, 1.4) * 0.5
    sparkle = S.spectral(S.noise(d), 4000, 12000) * (rng.random(len(t)) < 0.004) * 3
    S.save('subir', S.reverb(S.mix(up, sparkle), 1.0, 0.3))
    S.save('llegada', S.reverb(seq([784, 988, 1175, 1568], 0.05, 0.9, 3.5), 1.4, 0.35) * 0.7)
    down = np.sin(2 * np.pi * np.cumsum(np.linspace(900, 90, len(t))) / S.SR) * S.env(d, 0.02, 0.95, 1.2) * 0.6
    S.save('bajar', S.reverb(S.mix(down, S.spectral(S.noise(d), 60, 400) * S.env(d, 0.3, 0.7, 2) * 0.6), 1.2, 0.3))
    d = 0.8
    t = S.t_(d)
    thud = np.sin(2 * np.pi * np.cumsum(np.linspace(110, 40, len(t))) / S.SR) * np.exp(-t * 7) * 1.3
    S.save('impacto', S.reverb(S.mix(thud, S.spectral(S.noise(d), 80, 1200) * np.exp(-t * 12) * 0.8), 0.8, 0.25))
    S.save('empujon', S.reverb(whoosh(), 0.6, 0.2))
    d = 2.0
    S.save('viento', S.reverb(S.sweep_filter(S.noise(d), 300, 1800, 3) * S.env(d, 0.4, 1.6, 1.5) * 0.9, 1.2, 0.3))
    d = 2.2
    t = S.t_(d)
    drone = (np.sin(2 * np.pi * 55 * t) + 0.5 * np.sin(2 * np.pi * 82.4 * t)) * S.env(d, 0.4, 1.8, 1.5) * 0.6
    S.save('niebla', S.reverb(drone, 1.8, 0.4))
    d = 0.7
    t = S.t_(d)
    crack = S.mix(S.spectral(S.noise(d), 3000, 11000) * np.exp(-t * 18), S.pad(seq([2093, 2637], 0.04, 0.5, 8), d) * 0.4)
    S.save('hielo', S.reverb(crack, 0.9, 0.3))
    d = 1.6
    t = S.t_(d)
    eerie = np.sin(2 * np.pi * (600 + 80 * np.sin(2 * np.pi * 5 * t)) * t) * S.env(d, 0.2, 1.4, 1.5) * 0.4
    S.save('fantasma', S.reverb(eerie, 1.6, 0.45))
    d = 2.5
    t = S.t_(d)
    S.save('terremoto', S.reverb(S.spectral(S.noise(d), 25, 300, -0.6) * S.env(d, 0.1, 2.3, 1.4) * 1.5, 1.0, 0.2))
    d = 1.0
    t = S.t_(d)
    wob = np.sin(2 * np.pi * np.cumsum(220 + 60 * np.sin(2 * np.pi * 3 * t)) / S.SR) * S.env(d, 0.05, 0.9, 1.5) * 0.5
    S.save('lento', S.reverb(wob, 0.7, 0.25))
    S.save('ayuda', S.reverb(seq([1047, 1319, 1568, 2093], 0.05, 0.7, 4), 1.2, 0.35) * 0.6)
    S.save('escudo', S.reverb(S.mix(tone(880, 1.0, 3, (1, 0.6, 0.3, 0.2)), tone(1320, 1.0, 3)), 1.2, 0.3) * 0.6)
    d = 0.6
    t = S.t_(d)
    S.save('caida', S.reverb(np.sin(2 * np.pi * np.cumsum(np.linspace(700, 200, len(t))) / S.SR) * S.env(d, 0.01, 0.55, 1.4) * 0.5, 0.6, 0.25))
    fan = S.mix(S.pad(seq([523, 659, 784, 1047], 0.12, 1.4, 2.0), 2.4), S.pad(seq([392, 523, 659, 784], 0.12, 1.4, 2.0) * 0.6, 2.4))
    S.save('cima', S.reverb(fan, 2.0, 0.35) * 0.8)
    S.save('perder', S.reverb(seq([392, 349, 311, 262], 0.22, 0.9, 3), 1.4, 0.3) * 0.6)
    names = ['checkpoint', 'nivel', 'subir', 'llegada', 'bajar', 'impacto', 'empujon', 'viento', 'niebla', 'hielo', 'fantasma',
             'terremoto', 'lento', 'ayuda', 'escudo', 'caida', 'cima', 'perder']
    json.dump({n: {'sounds': [{'name': f'dropper:{n}'}]} for n in names}, open(os.path.join(PK, 'sounds.json'), 'w'), indent=1)
    print('sonidos:', len(names))


def hide_vitals(client):
    """Corazones y comida transparentes (en la torre no hay daño ni hambre); la barra de experiencia se queda
    porque el plugin la usa como progreso del nivel actual."""
    import zipfile
    blank = Image.new('RGBA', (9, 9), (0, 0, 0, 0))
    n = 0
    with zipfile.ZipFile(client) as z:
        for name in z.namelist():
            if name.startswith('assets/minecraft/textures/gui/sprites/hud/heart/') and name.endswith('.png') or \
               (name.startswith('assets/minecraft/textures/gui/sprites/hud/food_') and name.endswith('.png')):
                p = os.path.join(OUT, name)
                mkdir(os.path.dirname(p))
                blank.save(p)
                n += 1
    print('ocultos:', n, 'sprites de vida/comida')


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    mkdir(OUT)
    json.dump({'pack': {'description': 'Dropper LIVE · interfaz y sonidos (LiveArena)', 'min_format': [84, 0], 'max_format': [200, 0]}},
              open(os.path.join(OUT, 'pack.mcmeta'), 'w'), indent=1)
    import gen_drhud
    gen_drhud.build()   # HUD propio (fuentes) y sprites nativos transparentes
    client = sys.argv[1] if len(sys.argv) > 1 else '/root/.gradle/caches/neoformruntime/artifacts/minecraft_26.1.2_client.jar'
    if os.path.isfile(client):
        hide_vitals(client)
    sounds()


if __name__ == '__main__':
    main()
