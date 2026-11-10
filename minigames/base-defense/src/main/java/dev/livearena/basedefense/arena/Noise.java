package dev.livearena.basedefense.arena;

/** Ruido de valor 2D/3D determinista por semilla (fractal), suficiente para terreno y decorado. */
public final class Noise {
    private final long seed;

    public Noise(long seed) {
        this.seed = seed * 0x9E3779B97F4A7C15L + 0x632BE59BD9B4E019L;
    }

    private double hash(int x, int y, int z) {
        long h = seed ^ (x * 0x8DA6B343L) ^ (y * 0xD8163841L) ^ (z * 0xCB1AB31FL);
        h = (h ^ (h >>> 33)) * 0xff51afd7ed558ccdL;
        h = (h ^ (h >>> 33)) * 0xc4ceb9fe1a85ec53L;
        h ^= h >>> 33;
        return (h & 0xFFFFFFL) / (double) 0xFFFFFF;
    }

    private static double fade(double t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    private static double lerp(double a, double b, double t) {
        return a + (b - a) * t;
    }

    /** Valor 0..1. */
    public double value(double x, double z) {
        int x0 = (int) Math.floor(x), z0 = (int) Math.floor(z);
        double fx = fade(x - x0), fz = fade(z - z0);
        return lerp(lerp(hash(x0, 0, z0), hash(x0 + 1, 0, z0), fx), lerp(hash(x0, 0, z0 + 1), hash(x0 + 1, 0, z0 + 1), fx), fz);
    }

    public double value(double x, double y, double z) {
        int x0 = (int) Math.floor(x), y0 = (int) Math.floor(y), z0 = (int) Math.floor(z);
        double fx = fade(x - x0), fy = fade(y - y0), fz = fade(z - z0);
        double a = lerp(lerp(hash(x0, y0, z0), hash(x0 + 1, y0, z0), fx), lerp(hash(x0, y0, z0 + 1), hash(x0 + 1, y0, z0 + 1), fx), fz);
        double b = lerp(lerp(hash(x0, y0 + 1, z0), hash(x0 + 1, y0 + 1, z0), fx), lerp(hash(x0, y0 + 1, z0 + 1), hash(x0 + 1, y0 + 1, z0 + 1), fx), fz);
        return lerp(a, b, fy);
    }

    /** Fractal 0..1 con octavas. */
    public double fbm(double x, double z, double scale, int octaves) {
        double sum = 0, amp = 1, norm = 0, f = 1 / scale;
        for (int i = 0; i < octaves; i++) {
            sum += value(x * f + i * 17.3, z * f - i * 9.1) * amp;
            norm += amp;
            amp *= 0.5;
            f *= 2;
        }
        return sum / norm;
    }

    /** Aleatorio 0..1 fijo por celda. */
    public double cell(int x, int z, int salt) {
        return hash(x, salt, z);
    }
}
