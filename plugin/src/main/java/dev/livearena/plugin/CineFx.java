package dev.livearena.plugin;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Random;
import org.bukkit.Color;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.World;
import org.bukkit.block.data.BlockData;
import org.bukkit.entity.BlockDisplay;
import org.bukkit.entity.Display;
import org.bukkit.entity.Entity;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.inventory.ItemStack;
import org.bukkit.util.Transformation;
import org.bukkit.util.Vector;
import org.joml.Quaternionf;
import org.joml.Vector3f;

/**
 * Primitivas visuales de servidor del motor cinemático (las ve cualquier jugador, con o sin mod):
 * rayos (BEAM), esferas (SPHERE), ondas (RING_WAVE), relámpagos ramificados (LIGHTNING), cortes (SLASH),
 * marcadores de suelo (MARKER), círculos mágicos (GLYPH), discos de acreción (DISK), cúpulas hexagonales
 * (DOME_HEX) y flujos de partículas (PARTICLE_STREAM). Los displays tienen vida en ticks y se borran solos.
 */
final class CineFx {
    static final String TAG = "livearena_cine";

    private record Timed(Entity e, long dieAt) {}

    private final List<Timed> timed = new ArrayList<>();
    private long now;

    /** Lo llama el motor cada tick. */
    void tick(long tick) {
        now = tick;
        for (Iterator<Timed> it = timed.iterator(); it.hasNext(); ) {
            Timed t = it.next();
            if (!t.e().isValid()) it.remove();
            else if (t.dieAt() <= now) {
                t.e().remove();
                it.remove();
            }
        }
    }

    void clearAll() {
        for (Timed t : timed) if (t.e().isValid()) t.e().remove();
        timed.clear();
    }

    <E extends Entity> E life(E e, int ticks) {
        if (ticks > 0) timed.add(new Timed(e, now + ticks));
        return e;
    }

    /* ------------------------------------ utilidades ------------------------------------ */

    static Particle.DustOptions dust(int rgb, float size) {
        return new Particle.DustOptions(Color.fromRGB((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255), size);
    }

    /** Datos por defecto para partículas que los necesitan (en 26.x algunas piden color o número). */
    static Object defaultData(Particle p) {
        Class<?> t = p.getDataType();
        if (t == Void.class) return null;
        if (t == Color.class) return Color.WHITE;
        if (t == Float.class) return 1f;
        if (t == Integer.class) return 0;
        if (t == Particle.DustOptions.class) return dust(0xffffff, 1f);
        if (t == BlockData.class) return Material.STONE.createBlockData();
        return null;
    }

    static void part(World w, Particle p, Location l, int count, double spread, double speed) {
        w.spawnParticle(p, l, count, spread, spread, spread, speed, defaultData(p), true);
    }

    static void part(World w, Particle p, Location l, int count, double dx, double dy, double dz, double speed, Object data) {
        w.spawnParticle(p, l, count, dx, dy, dz, speed, data == null ? defaultData(p) : data, true);
    }

    static void dot(World w, Location l, int rgb, float size) {
        w.spawnParticle(Particle.DUST, l, 1, 0, 0, 0, 0, dust(rgb, size), true);
    }

    /** Partícula que sale disparada en una dirección (truco count=0 + offset = dirección). */
    static void shoot(World w, Particle p, Location from, Vector dir, double speed) {
        w.spawnParticle(p, from, 0, dir.getX(), dir.getY(), dir.getZ(), speed, defaultData(p), true);
    }

    /** Rotación que lleva el eje +Y a la dirección dada. */
    static Quaternionf towards(Vector dir) {
        Vector3f d = new Vector3f((float) dir.getX(), (float) dir.getY(), (float) dir.getZ());
        if (d.lengthSquared() < 1e-6f) return new Quaternionf();
        d.normalize();
        return new Quaternionf().rotationTo(new Vector3f(0, 1, 0), d);
    }

    BlockDisplay blockDisplay(Location at, BlockData data, int glowRgb, int life) {
        BlockDisplay d = at.getWorld().spawn(at, BlockDisplay.class, e -> {
            e.setBlock(data);
            e.setPersistent(false);
            e.addScoreboardTag(TAG);
            e.setViewRange(8f);
            e.setBrightness(new Display.Brightness(15, 15));
            e.setTeleportDuration(2);
            if (glowRgb >= 0) {
                e.setGlowing(true);
                e.setGlowColorOverride(Color.fromRGB(glowRgb & 0xffffff));
            }
        });
        return life(d, life);
    }

    ItemDisplay itemDisplay(Location at, ItemStack item, float scale, int life) {
        ItemDisplay d = at.getWorld().spawn(at, ItemDisplay.class, e -> {
            e.setItemStack(item);
            e.setPersistent(false);
            e.addScoreboardTag(TAG);
            e.setViewRange(8f);
            e.setBrightness(new Display.Brightness(15, 15));
            e.setTeleportDuration(2);
            e.setTransformation(new Transformation(new Vector3f(), new Quaternionf(), new Vector3f(scale, scale, scale), new Quaternionf()));
        });
        return life(d, life);
    }

    /** Cambia la forma de un display con interpolación suave. */
    static void shape(Display d, Vector3f translation, Quaternionf rot, Vector3f scale, int interpTicks) {
        d.setInterpolationDelay(0);
        d.setInterpolationDuration(Math.max(0, interpTicks));
        d.setTransformation(new Transformation(translation, rot, scale, new Quaternionf()));
    }

    /* --------------------------------------- BEAM --------------------------------------- */

    /** Pilar/rayo de bloque estirado de `a` a `b` con núcleo brillante. Devuelve el display (para reescalarlo). */
    BlockDisplay beam(Location a, Location b, float radius, Material mat, int glowRgb, int life) {
        Vector dir = b.toVector().subtract(a.toVector());
        float len = (float) dir.length();
        BlockDisplay d = blockDisplay(a, mat.createBlockData(), glowRgb, life);
        Quaternionf q = towards(dir);
        // El bloque va de (0,0,0) a (1,1,1): lo centramos en X/Z y lo estiramos en Y.
        Vector3f t = new Vector3f(-radius, 0, -radius);
        q.transform(t);
        d.setTransformation(new Transformation(t, q, new Vector3f(radius * 2, len, radius * 2), new Quaternionf()));
        return d;
    }

    /** Reescala el grosor de un rayo creado con {@link #beam} (para que se estreche o pulse). */
    static void beamRadius(BlockDisplay d, Location a, Location b, float radius, int interp) {
        Vector dir = b.toVector().subtract(a.toVector());
        Quaternionf q = towards(dir);
        Vector3f t = new Vector3f(-radius, 0, -radius);
        q.transform(t);
        shape(d, t, q, new Vector3f(radius * 2, (float) dir.length(), radius * 2), interp);
    }

    /* -------------------------------------- SPHERE -------------------------------------- */

    /** Esfera facetada: tres cubos girados que juntos parecen un orbe + concha de partículas al pulsar. */
    final class Orb {
        final List<BlockDisplay> parts = new ArrayList<>();
        Location center;
        float radius;

        Orb(Location c, float r, Material core, Material shell, int glow, int life) {
            center = c.clone();
            radius = r;
            for (int i = 0; i < FACETS; i++) parts.add(blockDisplay(c, (i == 0 ? core : shell).createBlockData(), i == 0 ? glow : -1, life));
            for (int i = 0; i < FACETS; i++) parts.get(i).setTransformation(orbT(r, facet(i, 0)));
        }

        /** Cinco cubos con giros distintos: juntos se ven casi como una esfera. */
        static final int FACETS = 5;

        private static Quaternionf facet(int i, float spin) {
            return switch (i) {
                case 0 -> new Quaternionf().rotateY(spin);
                case 1 -> new Quaternionf().rotateXYZ(0.785f, 0.785f + spin, 0);
                case 2 -> new Quaternionf().rotateXYZ(0.615f, -spin, 0.785f);
                case 3 -> new Quaternionf().rotateXYZ(0, 0.785f + spin * 0.5f, 0.785f);
                default -> new Quaternionf().rotateXYZ(0.785f, -spin * 0.5f, 0.3f);
            };
        }

        private static Transformation orbT(float r, Quaternionf q) {
            float s = r * 1.25f;
            Vector3f t = new Vector3f(-s / 2, -s / 2, -s / 2);
            q.transform(t);
            return new Transformation(t, q, new Vector3f(s, s, s), new Quaternionf());
        }

        void move(Location c) {
            center = c.clone();
            for (BlockDisplay d : parts) if (d.isValid()) d.teleport(c);
        }

        /** Cambia el radio (interpolado) y gira un poco las facetas. */
        void radius(float r, float spin, int interp) {
            radius = r;
            for (int i = 0; i < parts.size(); i++) {
                BlockDisplay d = parts.get(i);
                if (!d.isValid()) continue;
                Transformation tr = orbT(r, facet(i, spin));
                shape(d, tr.getTranslation(), tr.getLeftRotation(), tr.getScale(), interp);
            }
        }

        void remove() {
            for (BlockDisplay d : parts) if (d.isValid()) d.remove();
        }
    }

    Orb orb(Location c, float r, Material core, Material shell, int glow, int life) {
        return new Orb(c, r, core, shell, glow, life);
    }

    static void sphereShell(World w, Location c, double r, int points, int rgb, float size) {
        double g = Math.PI * (3 - Math.sqrt(5));
        for (int i = 0; i < points; i++) {
            double y = 1 - (i / (double) Math.max(1, points - 1)) * 2;
            double rr = Math.sqrt(Math.max(0, 1 - y * y));
            double a = g * i;
            dot(w, c.clone().add(Math.cos(a) * rr * r, y * r, Math.sin(a) * rr * r), rgb, size);
        }
    }

    /* ------------------------------------ RING_WAVE ------------------------------------ */

    static void ring(World w, Location c, double r, int rgb, float size, double phase) {
        int points = (int) Math.max(12, Math.min(220, r * 9));
        for (int i = 0; i < points; i++) {
            double a = phase + i * Math.PI * 2 / points;
            dot(w, c.clone().add(Math.cos(a) * r, 0.15, Math.sin(a) * r), rgb, size);
        }
    }

    /** Frente de onda: anillo de polvo + nubes que se levantan del suelo. */
    static void wave(World w, Location c, double r, int rgb) {
        ring(w, c, r, rgb, 2.2f, 0);
        ring(w, c, Math.max(0, r - 0.6), 0xffffff, 1.4f, 0.1);
        int n = (int) Math.min(60, 6 + r * 2);
        for (int i = 0; i < n; i++) {
            double a = i * Math.PI * 2 / n;
            Location l = c.clone().add(Math.cos(a) * r, 0.2, Math.sin(a) * r);
            w.spawnParticle(Particle.CLOUD, l, 1, 0.2, 0.1, 0.2, 0.02, null, true);
        }
    }

    /* ------------------------------------ LIGHTNING ------------------------------------ */

    /** Polilínea de relámpago por desplazamiento del punto medio (con semilla: siempre igual para la misma semilla). */
    static List<Vector> bolt(Vector a, Vector b, double jitter, int depth, Random r) {
        List<Vector> pts = new ArrayList<>();
        pts.add(a.clone());
        pts.add(b.clone());
        double j = jitter;
        for (int d = 0; d < depth; d++) {
            List<Vector> next = new ArrayList<>();
            for (int i = 0; i < pts.size() - 1; i++) {
                Vector p = pts.get(i), q = pts.get(i + 1);
                Vector mid = p.clone().add(q).multiply(0.5);
                mid.add(new Vector((r.nextDouble() * 2 - 1) * j, (r.nextDouble() * 2 - 1) * j * 0.3, (r.nextDouble() * 2 - 1) * j));
                next.add(p);
                next.add(mid);
            }
            next.add(pts.get(pts.size() - 1));
            pts = next;
            j *= 0.55;
        }
        return pts;
    }

    /** Relámpago visible: segmentos finos de bloque brillante (con halo) + chispas. Devuelve los displays. */
    List<BlockDisplay> lightning(World w, Location from, Location to, float thickness, int branches, long seed, int glowRgb, int life) {
        Random r = new Random(seed);
        List<BlockDisplay> out = new ArrayList<>();
        double len = from.distance(to);
        List<Vector> main = bolt(from.toVector(), to.toVector(), len * 0.18, 5, r);
        segs(w, main, thickness, glowRgb, life, out);
        for (int b = 0; b < branches; b++) {
            int idx = 1 + r.nextInt(Math.max(1, main.size() - 3));
            Vector start = main.get(idx);
            Vector dir = to.toVector().subtract(from.toVector()).normalize();
            Vector side = new Vector(r.nextDouble() * 2 - 1, -0.3 - r.nextDouble() * 0.6, r.nextDouble() * 2 - 1).normalize();
            Vector end = start.clone().add(dir.multiply(len * 0.08).add(side.multiply(len * (0.08 + r.nextDouble() * 0.15))));
            segs(w, bolt(start, end, len * 0.05, 3, r), thickness * 0.45f, glowRgb, life, out);
        }
        return out;
    }

    private void segs(World w, List<Vector> pts, float th, int glow, int life, List<BlockDisplay> out) {
        for (int i = 0; i < pts.size() - 1; i++) {
            Location a = pts.get(i).toLocation(w);
            Location b = pts.get(i + 1).toLocation(w);
            out.add(beam(a, b, th / 2, Material.WHITE_CONCRETE, glow, life));
            if (i % 3 == 0) part(w, Particle.ELECTRIC_SPARK, a, 2, 0.15, 0.05);
        }
    }

    /* -------------------------------------- SLASH -------------------------------------- */

    /** Corte: lámina muy fina y larga que aparece un instante. `normal` es la normal del plano del corte. */
    BlockDisplay slash(Location center, Vector along, Vector normal, float length, float width, Material mat, int glow, int life) {
        BlockDisplay d = blockDisplay(center, mat.createBlockData(), glow, life);
        Vector3f x = new Vector3f((float) along.getX(), (float) along.getY(), (float) along.getZ()).normalize();
        Vector3f n = new Vector3f((float) normal.getX(), (float) normal.getY(), (float) normal.getZ()).normalize();
        Vector3f y = new Vector3f(n).cross(x).normalize();
        Quaternionf q = new Quaternionf().setFromNormalized(new org.joml.Matrix3f(x, y, n));
        Vector3f t = new Vector3f(-length / 2, -width / 2, -0.02f);
        q.transform(t);
        d.setTransformation(new Transformation(t, q, new Vector3f(length, width, 0.04f), new Quaternionf()));
        return d;
    }

    /* -------------------------------------- MARKER -------------------------------------- */

    /** Círculo de aviso en el suelo que se va llenando (fill 0..1). */
    static void marker(World w, Location c, double radius, int rgb, double fill) {
        ring(w, c, radius, rgb, 1.6f, 0);
        double inner = radius * Math.max(0, Math.min(1, fill));
        if (inner > 0.3) ring(w, c, inner, rgb, 1.2f, 0.3);
        if (fill > 0.85) part(w, Particle.ELECTRIC_SPARK, c.clone().add(0, 0.3, 0), 3, radius * 0.4, 0.02);
    }

    /* --------------------------------------- GLYPH --------------------------------------- */

    /**
     * Círculo mágico procedural en el plano horizontal: anillos, polígono estrellado y runas.
     * progress 0..1 lo «dibuja» trazo a trazo; spin gira todo.
     */
    static void glyph(World w, Location c, double r, int layers, long seed, double progress, double spin, int rgb, int rgb2) {
        Random rr = new Random(seed);
        double p = Math.max(0, Math.min(1, progress));
        int ringPts = (int) Math.max(24, r * 8);
        for (int L = 0; L < layers; L++) {
            double rad = r * (1 - L * 0.22);
            if (rad <= 0.5) break;
            int draw = (int) (ringPts * p);
            double dir = L % 2 == 0 ? 1 : -1;
            for (int i = 0; i < draw; i++) {
                double a = spin * dir + i * Math.PI * 2 / ringPts;
                dot(w, c.clone().add(Math.cos(a) * rad, 0, Math.sin(a) * rad), L % 2 == 0 ? rgb : rgb2, L == 0 ? 1.8f : 1.2f);
            }
        }
        int n = 5 + rr.nextInt(3) * 1;
        int skip = n == 7 ? 3 : 2;
        int lines = (int) Math.ceil(n * p);
        double sr = r * 0.78;
        for (int i = 0; i < lines; i++) {
            double a1 = spin + i * Math.PI * 2 / n;
            double a2 = spin + ((i + skip) % n) * Math.PI * 2 / n;
            Location a = c.clone().add(Math.cos(a1) * sr, 0, Math.sin(a1) * sr);
            Location b = c.clone().add(Math.cos(a2) * sr, 0, Math.sin(a2) * sr);
            line(w, a, b, 0.45, rgb2, 1.1f);
        }
        if (p >= 1) {
            int runes = 12 + rr.nextInt(8);
            for (int i = 0; i < runes; i++) {
                double a = -spin * 1.5 + i * Math.PI * 2 / runes;
                Location l = c.clone().add(Math.cos(a) * r * 0.9, 0, Math.sin(a) * r * 0.9);
                w.spawnParticle(Particle.ENCHANT, l, 1, 0, 0.1, 0, 0, null, true);
            }
        }
    }

    static void line(World w, Location a, Location b, double step, int rgb, float size) {
        Vector dir = b.toVector().subtract(a.toVector());
        double len = dir.length();
        if (len < 0.001) return;
        dir.normalize().multiply(step);
        Location l = a.clone();
        for (double s = 0; s <= len; s += step) {
            dot(w, l, rgb, size);
            l.add(dir);
        }
    }

    /* --------------------------------------- DISK --------------------------------------- */

    /** Disco de acreción horizontal que gira (gradiente de dentro a fuera). */
    static void disk(World w, Location c, double r0, double r1, double phase, int inner, int outer) {
        int rings = 5;
        for (int k = 0; k < rings; k++) {
            double f = k / (double) (rings - 1);
            double r = r0 + (r1 - r0) * f;
            int col = lerpRgb(inner, outer, f);
            int pts = (int) (r * 7);
            double ph = phase * (1.6 - f);
            for (int i = 0; i < pts; i++) {
                double a = ph + i * Math.PI * 2 / pts;
                dot(w, c.clone().add(Math.cos(a) * r, Math.sin(a * 3 + phase) * 0.08, Math.sin(a) * r), col, 1.5f);
            }
        }
    }

    static int lerpRgb(int a, int b, double f) {
        int r = (int) (((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * f);
        int g = (int) (((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * f);
        int bl = (int) ((a & 255) + ((b & 255) - (a & 255)) * f);
        return (r << 16) | (g << 8) | bl;
    }

    /* ------------------------------------- DOME_HEX ------------------------------------- */

    /** Cúpula de hexágonos: rejilla en latitud/longitud; `grow` 0..1 la enciende de abajo arriba. */
    static void domeHex(World w, Location c, double r, double grow, int rgb, int edge, double phase) {
        int rows = 7;
        for (int row = 0; row < rows; row++) {
            double f = row / (double) rows;
            if (f > grow) break;
            double lat = f * Math.PI / 2;
            double y = Math.sin(lat) * r;
            double rr = Math.cos(lat) * r;
            int cells = Math.max(6, (int) (rr * 2.2));
            for (int i = 0; i < cells; i++) {
                double a = phase * 0.2 + (i + (row % 2) * 0.5) * Math.PI * 2 / cells;
                Location l = c.clone().add(Math.cos(a) * rr, y, Math.sin(a) * rr);
                dot(w, l, row == rows - 1 ? edge : rgb, 1.3f);
            }
        }
        if (grow >= 1) dot(w, c.clone().add(0, r, 0), edge, 1.6f);
    }

    /** Onda de impacto sobre la cúpula en el punto `hit`. */
    static void domeImpact(World w, Location c, double r, Location hit, int rgb) {
        Vector n = hit.toVector().subtract(c.toVector());
        if (n.lengthSquared() < 1e-4) return;
        n.normalize();
        Vector u = n.clone().crossProduct(new Vector(0, 1, 0));
        if (u.lengthSquared() < 1e-4) u = new Vector(1, 0, 0);
        u.normalize();
        Vector v = n.clone().crossProduct(u).normalize();
        Location p = c.clone().add(n.clone().multiply(r));
        for (double rad = 0.4; rad <= 1.6; rad += 0.6)
            for (int i = 0; i < 12; i++) {
                double a = i * Math.PI / 6;
                dot(w, p.clone().add(u.clone().multiply(Math.cos(a) * rad)).add(v.clone().multiply(Math.sin(a) * rad)), rgb, 1.2f);
            }
        part(w, Particle.ELECTRIC_SPARK, p, 8, 0.4, 0.1);
    }

    /* ---------------------------------- PARTICLE_STREAM ---------------------------------- */

    static void stream(World w, Location from, Location to, Particle p, int count) {
        Vector dir = to.toVector().subtract(from.toVector());
        double len = dir.length();
        if (len < 0.01) return;
        dir.normalize();
        for (int i = 0; i < count; i++) {
            Location l = from.clone().add(dir.clone().multiply(Math.random() * len * 0.3));
            shoot(w, p, l, dir, Math.min(2.5, len / 18));
        }
    }
}
