package dev.livearena.parkour.tower;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.block.data.BlockData;

/** Torre ya calculada: plataformas de cada nivel, camino en orden, bloques que parpadean y lo que hay que colocar. */
public final class Tower {
    /** Plataforma de inicio de un nivel (la de levels+1 es la cima). y = bloque sobre el que se pisa. */
    public record Pad(int level, int x, int y, int z, int radius) {
        public Location spawn(World w, float yaw) {
            return new Location(w, x + 0.5, y + 1, z + 0.5, yaw, 0);
        }

        public boolean contains(double px, double py, double pz) {
            return Math.abs(px - (x + 0.5)) <= radius + 0.8 && Math.abs(pz - (z + 0.5)) <= radius + 0.8 && py >= y + 0.5 && py <= y + 3.5;
        }
    }

    /** Bloque del camino sobre el que se pisa. kind: block, slab, post, ladder, blink. */
    public record Step(int level, int index, int x, int y, int z, String kind) {}

    public record Blink(int x, int y, int z, BlockData data, int phase) {}

    public record Place(int x, int y, int z, BlockData data) {}

    public final long seed;
    public final int levels;
    public final Pad[] pads;
    public final List<List<Step>> steps = new ArrayList<>();
    public final List<Blink> blinks = new ArrayList<>();
    public final List<Place> places = new ArrayList<>();
    /** Bloque → nivel (camino y plataformas), para saber si te has caído a un nivel inferior. */
    public final Map<Long, Integer> levelOf = new HashMap<>();
    /** Bloque → paso del camino (para el progreso dentro del nivel). */
    public final Map<Long, Step> stepAt = new HashMap<>();
    public int minY, maxY;
    /** Saltos que el generador tuvo que resolver con la pieza de último recurso (debería ser 0 o muy pocos). */
    public int fallbacks;

    Tower(long seed, int levels) {
        this.seed = seed;
        this.levels = levels;
        this.pads = new Pad[levels + 2];
        for (int i = 0; i <= levels; i++) steps.add(new ArrayList<>());
    }

    public static long key(int x, int y, int z) {
        return ((long) (x & 0x3FFFFFF) << 38) | ((long) (z & 0x3FFFFFF) << 12) | (y & 0xFFF);
    }

    public Pad pad(int level) {
        return pads[Math.max(1, Math.min(levels + 1, level))];
    }

    public List<Step> steps(int level) {
        return level >= 1 && level <= levels ? steps.get(level) : List.of();
    }

    /** Ángulo (grados de yaw) para mirar desde la plataforma hacia el primer salto del nivel. */
    public float yawAt(int level) {
        Pad p = pad(level);
        List<Step> s = steps(level);
        if (s.isEmpty()) return 0;
        Step f = s.getFirst();
        return (float) Math.toDegrees(Math.atan2(-(f.x() - p.x()), f.z() - p.z()));
    }
}
