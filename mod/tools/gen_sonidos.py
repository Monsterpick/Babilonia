"""Efectos de sonido propios de las cinemáticas, sintetizados desde cero (sin muestras ajenas).
Genera assets/livearena/sounds/sfx/<nombre>.ogg (necesita ffmpeg con libvorbis). Uso: python3 gen_sonidos.py"""
import os, subprocess, tempfile, wave
import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'main', 'resources', 'assets', 'livearena', 'sounds', 'sfx')
rng = np.random.default_rng(7)


def t_(dur):
    return np.arange(int(SR * dur)) / SR


def noise(dur):
    return rng.standard_normal(int(SR * dur))


def spectral(x, lo=0.0, hi=SR / 2, slope=0.0):
    """Filtro en frecuencia: deja pasar [lo, hi] con bordes suaves; slope < 0 oscurece (1/f^k)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo > 0:
        m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi < SR / 2:
        m *= 1 / (1 + (f / hi) ** 4)
    if slope:
        m *= (np.maximum(f, 20) / 1000) ** slope
    return np.fft.irfft(X * m, len(x))


def sweep_filter(x, f0, f1, q=6.0, frames=60):
    """Paso banda que se desplaza de f0 a f1 (por bloques solapados)."""
    n = len(x)
    out = np.zeros(n)
    hop = n // frames
    win = np.hanning(hop * 2)
    for i in range(frames):
        a = i * hop
        seg = x[a:a + hop * 2]
        if len(seg) < hop * 2:
            seg = np.pad(seg, (0, hop * 2 - len(seg)))
        fc = f0 * (f1 / f0) ** (i / max(1, frames - 1))
        y = spectral(seg, fc / (1 + 1 / q), fc * (1 + 1 / q)) * win
        out[a:a + hop * 2] += y[:max(0, min(hop * 2, n - a))]
    return out


def chirp(dur, f0, f1, shape='sin', curve=1.0):
    t = t_(dur)
    k = (t / dur) ** curve
    f = f0 * (f1 / f0) ** k
    ph = 2 * np.pi * np.cumsum(f) / SR
    if shape == 'saw':
        return 2 * ((ph / (2 * np.pi)) % 1) - 1
    if shape == 'square':
        return np.sign(np.sin(ph))
    return np.sin(ph)


def env(dur, a=0.01, d=None, curve=3.0):
    t = t_(dur)
    d = dur - a if d is None else d
    up = np.clip(t / max(a, 1e-4), 0, 1)
    down = np.clip(1 - (t - a) / max(d, 1e-4), 0, 1) ** curve
    return up * np.where(t < a, 1, down)


def reverb(x, size=1.6, mix=0.35, seed=1):
    r = np.random.default_rng(seed)
    n = int(SR * size)
    ir = r.standard_normal(n) * np.exp(-np.arange(n) / (SR * size / 6))
    ir = spectral(ir, 80, 7000, -0.3)
    ir /= np.sqrt((ir ** 2).sum()) + 1e-9
    L = len(x) + n
    y = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)
    return np.concatenate([x, np.zeros(n)]) * (1 - mix) + y * mix * 3


def echo(x, delays=(0.28, 0.56, 0.84), gains=(0.45, 0.25, 0.12)):
    n = len(x) + int(SR * max(delays)) + 1
    y = np.zeros(n)
    y[:len(x)] += x
    for d, g in zip(delays, gains):
        o = int(SR * d)
        y[o:o + len(x)] += spectral(x, 0, 2500) * g
    return y


def pad(x, dur):
    n = int(SR * dur)
    return np.pad(x, (0, max(0, n - len(x))))[:n]


def mix(*parts):
    n = max(len(p) for p in parts)
    return sum(np.pad(p, (0, n - len(p))) for p in parts)


def save(name, x, stereo_width=0.0):
    x = np.asarray(x, dtype=np.float64)
    x = x - np.mean(x)
    x /= np.max(np.abs(x)) + 1e-9
    x *= 0.89
    # Se recorta el silencio del final de la cola de reverberación.
    loud = np.nonzero(np.abs(x) > 0.004)[0]
    if len(loud):
        x = x[:min(len(x), loud[-1] + int(SR * 0.05))]
    fade = int(SR * 0.02)
    x[-fade:] *= np.linspace(1, 0, fade)
    if stereo_width:
        d = int(SR * 0.012)
        r = np.concatenate([np.zeros(d), x[:-d]])
        left, right = x, x * (1 - stereo_width) + r * stereo_width
        data = np.stack([left, right], 1)
    else:
        data = x[:, None]
    pcm = (data * 32767).astype(np.int16)
    os.makedirs(OUT, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        tmp = f.name
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(pcm.shape[1])
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    # Minecraft solo posiciona en 3D los sonidos mono: se exportan en mono.
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-ac', '1', '-c:a', 'libvorbis', '-q:a', '6', os.path.join(OUT, name + '.ogg')], check=True)
    os.remove(tmp)
    print('  ', name, f'{len(x) / SR:.2f} s')


# ---------------------------------------------------------------- ataque orbital

def carga_canon():
    """Zumbido eléctrico que sube de tono durante 3 s, con trémolo que se acelera."""
    d = 3.2
    t = t_(d)
    base = chirp(d, 55, 260, 'saw', 1.6) * 0.6 + chirp(d, 110, 520, 'sin', 1.6) * 0.5 + chirp(d, 220, 1400, 'sin', 2.2) * 0.25
    trem = 0.65 + 0.35 * np.sin(2 * np.pi * np.cumsum(4 + 26 * (t / d) ** 2) / SR)
    whine = chirp(d, 900, 4200, 'sin', 2.5) * 0.12 * (t / d) ** 2
    crackle = spectral(noise(d), 2000, 9000) * (rng.random(len(t)) < 0.002 + 0.02 * (t / d) ** 3) * 3
    x = spectral(base, 40, 3500) * trem + whine + crackle
    x *= np.minimum(1, t / 0.4) * np.minimum(1, (d - t) / 0.08)
    save('carga_canon', reverb(x, 1.2, 0.25))


def laser_disparo():
    """Disparo: chasquido + barrido descendente agresivo + golpe sub."""
    d = 2.6
    zap = chirp(d, 3200, 90, 'saw', 0.35) * env(d, 0.002, 1.2, 2.5)
    zap2 = chirp(d, 1600, 60, 'square', 0.3) * env(d, 0.002, 0.9, 3) * 0.4
    crack = spectral(noise(d), 1500, 12000) * env(d, 0.001, 0.25, 6) * 1.4
    sub = np.sin(2 * np.pi * np.cumsum(np.linspace(70, 28, int(SR * d))) / SR) * env(d, 0.005, 1.8, 2) * 1.2
    roar = spectral(noise(d), 60, 900, -0.5) * env(d, 0.05, 2.4, 1.5) * 0.9
    x = mix(spectral(zap, 40, 9000), zap2, crack, sub, roar)
    save('laser_disparo', reverb(x, 1.8, 0.3))


def explosion_grave():
    """Explosión grave con cola larga y eco del entorno."""
    d = 4.0
    body = spectral(noise(d), 25, 700, -0.9) * env(d, 0.004, 3.6, 2.2) * 1.6
    sub = np.sin(2 * np.pi * np.cumsum(np.linspace(55, 22, int(SR * d))) / SR) * env(d, 0.003, 2.4, 2) * 1.5
    crack = spectral(noise(d), 800, 9000) * env(d, 0.001, 0.4, 5)
    rumble = spectral(noise(d), 20, 160) * env(d, 0.3, 3.7, 1.0) * 1.2
    debris = spectral(noise(d), 1500, 6000) * (rng.random(int(SR * d)) < 0.004) * env(d, 0.3, 3.0, 1.5) * 4
    x = mix(body, sub, crack, rumble, debris)
    x = echo(x, (0.33, 0.7, 1.15), (0.4, 0.22, 0.1))
    save('explosion_grave', reverb(x, 2.4, 0.35))


def objetivo_fijado():
    """Alarma «objetivo fijado»: tres pitidos dobles electrónicos."""
    parts = []
    for k in range(3):
        beep = (chirp(0.1, 1760, 1760, 'square') * 0.5 + chirp(0.1, 2640, 2640, 'sin') * 0.3) * env(0.1, 0.003, 0.097, 0.5)
        beep2 = (chirp(0.16, 1320, 1320, 'square') * 0.5 + chirp(0.16, 1980, 1980, 'sin') * 0.3) * env(0.16, 0.003, 0.157, 1.5)
        parts.append(np.concatenate([spectral(beep, 200, 6000), np.zeros(int(SR * 0.04)), spectral(beep2, 200, 6000), np.zeros(int(SR * 0.12))]))
    save('objetivo_fijado', reverb(np.concatenate(parts), 0.6, 0.18))


def pitido():
    """Pitido corto de la retícula."""
    d = 0.14
    x = (chirp(d, 2400, 2350, 'sin') + 0.3 * chirp(d, 4800, 4700, 'sin')) * env(d, 0.002, d - 0.002, 2)
    save('pitido', reverb(x, 0.4, 0.15))


def whoosh():
    """Subida al espacio: soplido de aire que sube y se aleja (barrido de filtro)."""
    d = 2.0
    t = t_(d)
    x = sweep_filter(noise(d), 180, 4200, 3.5) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.3
    tone = chirp(d, 120, 900, 'sin', 1.4) * 0.15 * np.sin(np.pi * t / d)
    save('whoosh', reverb(mix(x * 1.6, tone), 1.0, 0.2))


# ---------------------------------------------------------------- sangre perforante

def silbido_perforante():
    """Silbido agudísimo a presión: ataque seco que sube a 7 kHz y se corta."""
    d = 1.3
    s1 = chirp(d, 2200, 7200, 'sin', 0.25) * env(d, 0.004, 1.2, 2.2)
    s2 = chirp(d, 4400, 9800, 'sin', 0.25) * env(d, 0.004, 0.8, 3) * 0.4
    hiss = spectral(noise(d), 4000, 14000) * env(d, 0.002, 0.7, 3) * 0.6
    snap = spectral(noise(d), 300, 6000) * env(d, 0.0005, 0.06, 6) * 1.5
    save('silbido_perforante', reverb(mix(s1, s2, hiss, snap), 0.9, 0.22))


def sangre_burbujas():
    """Esfera de sangre: burbujeo espeso y grave (gotas resonantes) sobre un zumbido oscuro."""
    d = 3.0
    x = np.zeros(int(SR * d))
    for _ in range(140):
        at = int(rng.random() * (d - 0.15) * SR)
        bd = 0.03 + rng.random() * 0.07
        f0 = 140 + rng.random() * 420
        b = chirp(bd, f0, f0 * (1.8 + rng.random()), 'sin', 0.7) * env(bd, 0.004, bd - 0.004, 2)
        x[at:at + len(b)] += b * (0.4 + rng.random() * 0.6)
    drone = spectral(noise(d), 40, 260, -0.4) * 0.5 + chirp(d, 48, 52, 'saw') * 0.15
    wet = spectral(noise(d), 600, 2500) * 0.08
    y = mix(x, drone, wet) * np.minimum(1, t_(d) / 0.15) * np.minimum(1, (d - t_(d)) / 0.3)
    save('sangre_burbujas', reverb(y, 0.9, 0.25))


def golpe_impacto():
    """Impacto: golpe seco y profundo + chasquido + salpicadura húmeda."""
    d = 1.6
    thump = np.sin(2 * np.pi * np.cumsum(np.linspace(140, 40, int(SR * d))) / SR) * env(d, 0.001, 0.5, 3) * 1.4
    crack = spectral(noise(d), 1200, 11000) * env(d, 0.0005, 0.09, 5) * 1.3
    body = spectral(noise(d), 80, 1500, -0.6) * env(d, 0.002, 0.6, 3)
    splash = spectral(noise(d), 700, 4000) * env(d, 0.02, 0.9, 2.5) * 0.45 * (0.6 + 0.4 * np.sin(2 * np.pi * 23 * t_(d)))
    save('golpe_impacto', reverb(mix(thump, crack, body, splash), 1.1, 0.25))


# ---------------------------------------------------------------- comunes

def tajo():
    """Tajo de energía: barrido de aire muy rápido con un anillo metálico."""
    d = 0.5
    sw = sweep_filter(noise(d), 6000, 900, 3, 20) * env(d, 0.01, 0.35, 2) * 1.4
    ring = (np.sin(2 * np.pi * 2350 * t_(d)) + 0.5 * np.sin(2 * np.pi * 3720 * t_(d))) * env(d, 0.003, 0.45, 4) * 0.25
    save('tajo', reverb(mix(sw, ring), 0.5, 0.18))


def onda_choque():
    """Onda de choque: golpe de aire grave que pasa de largo."""
    d = 1.8
    t = t_(d)
    boom = np.sin(2 * np.pi * np.cumsum(np.linspace(90, 30, len(t))) / SR) * env(d, 0.002, 0.9, 2.5) * 1.3
    air = sweep_filter(noise(d), 2500, 150, 2.5, 30) * env(d, 0.01, 1.6, 1.6)
    save('onda_choque', reverb(mix(boom, air), 1.4, 0.3))


def aura():
    """Aura que vibra: zumbido de energía grave con batido y chispas sueltas."""
    d = 3.0
    t = t_(d)
    hum = (np.sin(2 * np.pi * 82 * t) + np.sin(2 * np.pi * 83.7 * t) + 0.5 * np.sin(2 * np.pi * 164 * t) + 0.25 * np.sin(2 * np.pi * 247 * t))
    flutter = 0.7 + 0.3 * np.sin(2 * np.pi * 7 * t)
    wind = spectral(noise(d), 200, 1800) * 0.25 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * t))
    sparks = spectral(noise(d), 3000, 12000) * (rng.random(len(t)) < 0.0015) * 3
    x = (hum * flutter * 0.5 + wind + sparks) * np.minimum(1, t / 0.3) * np.minimum(1, (d - t) / 0.6)
    save('aura', reverb(x, 1.0, 0.25))


def desvanecer():
    """Desvanecerse: destellos cristalinos que suben y un soplo suave que se apaga."""
    d = 2.2
    x = np.zeros(int(SR * d))
    for i in range(26):
        at = int((i / 26) * 1.5 * SR + rng.random() * 0.05 * SR)
        f = 900 * 2 ** (i / 26 * 2 + rng.random() * 0.3)
        g = (np.sin(2 * np.pi * f * t_(0.5)) + 0.4 * np.sin(2 * np.pi * f * 2.01 * t_(0.5))) * env(0.5, 0.003, 0.5, 3)
        x[at:at + len(g)] += g[:len(x) - at] * 0.35
    breath = sweep_filter(noise(d), 600, 3000, 2, 25) * np.sin(np.pi * t_(d) / d) * 0.5
    save('desvanecer', reverb(mix(x, breath), 1.8, 0.4))


# ---------------------------------------------------------------- genkidama

def energia_carga():
    """Energía acumulándose: zumbido grave con coro, brillo agudo que sube y chispas (4 s, se encadena)."""
    d = 4.0
    t = t_(d)
    hum = sum(np.sin(2 * np.pi * f * t + p) for f, p in ((65, 0), (65.8, 1.0), (130.4, 2.0), (196.5, 0.5))) * 0.35
    pulse = 0.75 + 0.25 * np.sin(2 * np.pi * 3.2 * t)
    shimmer = chirp(d, 700, 1500, 'sin', 1.0) * 0.12 + chirp(d, 1400, 3000, 'sin', 1.0) * 0.06
    choir = spectral(noise(d), 300, 1200) * 0.25 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.5 * t))
    sparks = spectral(noise(d), 3000, 12000) * (rng.random(len(t)) < 0.003) * 3
    x = (hum * pulse + shimmer + choir + sparks) * np.minimum(1, t / 0.5) * np.minimum(1, (d - t) / 0.5)
    save('energia_carga', reverb(x, 1.5, 0.3))


def viento_energia():
    """Viento de energía que llega de todas partes hacia la esfera."""
    d = 3.5
    t = t_(d)
    a = sweep_filter(noise(d), 300, 2200, 3, 40) * (0.5 + 0.5 * np.sin(np.pi * t / d))
    b = sweep_filter(noise(d), 1800, 500, 3, 40) * 0.6 * np.sin(np.pi * t / d) ** 2
    save('viento_energia', reverb(mix(a, b), 1.2, 0.3))


def genkidama_lanzar():
    """Lanzamiento: golpe de aire enorme y rugido que cae de tono."""
    d = 3.0
    t = t_(d)
    roar = spectral(noise(d), 40, 900, -0.6) * env(d, 0.05, 2.9, 1.6) * 1.3
    tone = chirp(d, 180, 45, 'saw', 0.6) * env(d, 0.02, 2.5, 2) * 0.5
    swoosh = sweep_filter(noise(d), 4000, 200, 3, 40) * env(d, 0.01, 1.6, 1.5)
    sub = np.sin(2 * np.pi * np.cumsum(np.linspace(60, 25, len(t))) / SR) * env(d, 0.01, 2.0, 2) * 1.2
    save('genkidama_lanzar', reverb(mix(spectral(roar + tone, 30, 6000), swoosh, sub), 1.8, 0.3))


def rugido_esfera():
    """La esfera gigante avanzando: rumor grave y continuo con crepitar de energía (2 s, se encadena)."""
    d = 2.2
    t = t_(d)
    rumble = spectral(noise(d), 25, 220, -0.4) * 1.2
    hum = (np.sin(2 * np.pi * 55 * t) + 0.6 * np.sin(2 * np.pi * 82.5 * t)) * 0.4 * (0.8 + 0.2 * np.sin(2 * np.pi * 6 * t))
    crackle = spectral(noise(d), 2500, 10000) * (rng.random(len(t)) < 0.006) * 2.5
    x = (rumble + hum + crackle) * np.minimum(1, t / 0.25) * np.minimum(1, (d - t) / 0.3)
    save('rugido_esfera', reverb(x, 1.2, 0.25))


def destello():
    """Destello rojo en los ojos: «shing» metálico brillante con un soplo grave por debajo (0,9 s)."""
    d = 0.9
    t = t_(d)
    bell = sum(np.sin(2 * np.pi * f * t + i) * a for i, (f, a) in enumerate([(2637, 0.5), (3951, 0.35), (5274, 0.25), (7040, 0.12)]))
    bell = bell * np.exp(-t * 5.5) * (1 + 0.25 * np.sin(2 * np.pi * 14 * t))
    shimmer = sweep_filter(noise(d), 9000, 3000, 6) * np.exp(-t * 7) * 0.5
    air = spectral(noise(d), 60, 600, -0.3) * env(d, 0.005, 0.5, 2.5) * 0.6
    save('destello', reverb(mix(bell, shimmer, air), 1.1, 0.3))


def rayo_espacio():
    """El rayo cruzando el vacío hasta el planeta: zumbido eléctrico que cae de tono (2,4 s)."""
    d = 2.4
    t = t_(d)
    zap = chirp(d, 1400, 160, 'saw', 0.7) * env(d, 0.004, 2.2, 2.2) * 0.35
    buzz = (np.sin(2 * np.pi * 110 * t) * np.sign(np.sin(2 * np.pi * 220 * t))) * 0.25 * env(d, 0.05, 2.3, 1.5)
    hiss = sweep_filter(noise(d), 6000, 400, 3, 50) * env(d, 0.01, 2.0, 1.8)
    save('rayo_espacio', reverb(mix(spectral(zap + buzz, 40, 9000), hiss), 2.2, 0.35))


if __name__ == '__main__':
    print('Sonidos ->', os.path.normpath(OUT))
    for f in (carga_canon, laser_disparo, explosion_grave, objetivo_fijado, pitido, whoosh,
              silbido_perforante, sangre_burbujas, golpe_impacto, tajo, onda_choque, aura, desvanecer, energia_carga, viento_energia, genkidama_lanzar, rugido_esfera, destello, rayo_espacio):
        f()
