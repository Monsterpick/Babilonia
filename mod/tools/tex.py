"""Texturas procedurales (ruido, grietas, degradados) con numpy + PIL."""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def noise(w, h, seed, octaves=4, base=4):
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w))
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        g = base * 2 ** o
        small = rng.random((g, g))
        img = Image.fromarray((small * 255).astype('uint8')).resize((w, h), Image.BICUBIC)
        out += np.asarray(img) / 255.0 * amp
        tot += amp
        amp *= 0.5
    return out / tot


def colorize(n, stops):
    """stops: [(t, (r,g,b,a)), ...] con t en 0..1."""
    h, w = n.shape
    out = np.zeros((h, w, 4))
    ts = [s[0] for s in stops]
    cs = [np.array(s[1], dtype=float) for s in stops]
    for i in range(len(stops) - 1):
        m = (n >= ts[i]) & (n <= ts[i + 1])
        f = ((n - ts[i]) / max(1e-6, ts[i + 1] - ts[i]))[..., None]
        out[m] = (cs[i] * (1 - f) + cs[i + 1] * f)[m]
    out[n < ts[0]] = cs[0]
    out[n > ts[-1]] = cs[-1]
    return Image.fromarray(np.clip(out, 0, 255).astype('uint8'), 'RGBA')


def cracks(w, h, seed, n=6, color=(255, 140, 30, 255), width=1):
    rng = np.random.default_rng(seed)
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for _ in range(n):
        x, y = rng.random() * w, rng.random() * h
        pts = [(x, y)]
        a = rng.random() * 6.28
        for _ in range(rng.integers(4, 9)):
            a += rng.normal(0, 0.7)
            x += np.cos(a) * w / 8
            y += np.sin(a) * h / 8
            pts.append((x, y))
        d.line(pts, fill=color, width=width)
    return img
