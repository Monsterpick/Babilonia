package dev.livearena.basedefense.arena;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.block.data.BlockData;
import org.bukkit.entity.Display;

/**
 * Lienzo en memoria: el generador escribe aquí y luego {@link BlockPlacer} lo vuelca al mundo por
 * lotes. Las escrituras posteriores pisan a las anteriores (terreno → estructuras → decorado).
 */
public final class Canvas {
    private static final Map<String, BlockData> CACHE = new HashMap<>();
    final LinkedHashMap<Long, BlockData> blocks = new LinkedHashMap<>(1 << 18);
    /** Altura del suelo por columna (y del bloque sólido superior) para colocar piezas encima. */
    private final HashMap<Long, Integer> surface = new HashMap<>();
    /** Decorado con entidades (vagonetas volcadas, huesos, vallas caídas). */
    final List<DisplaySpec> displays = new ArrayList<>();
    int minX = Integer.MAX_VALUE, minY = Integer.MAX_VALUE, minZ = Integer.MAX_VALUE;
    int maxX = Integer.MIN_VALUE, maxY = Integer.MIN_VALUE, maxZ = Integer.MIN_VALUE;

    public record DisplaySpec(double x, double y, double z, Class<? extends Display> type, Consumer<Display> setup) {}

    public static BlockData data(String s) {
        return CACHE.computeIfAbsent(s, k -> Bukkit.createBlockData(k.contains(":") ? k : "minecraft:" + k));
    }

    static long key(int x, int y, int z) {
        return ((long) (x & 0x3FFFFFF) << 38) | ((long) (z & 0x3FFFFFF) << 12) | (y & 0xFFF);
    }

    static int kx(long k) { return (int) (k >> 38); }
    static int kz(long k) { return (int) (k << 26 >> 38); }
    static int ky(long k) { return (int) (k << 52 >> 52); }

    public void set(int x, int y, int z, BlockData d) {
        blocks.put(key(x, y, z), d);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
    }

    public void set(int x, int y, int z, String d) {
        set(x, y, z, data(d));
    }

    /** Solo si allí no hay nada todavía (no pisa estructuras). */
    public void soft(int x, int y, int z, String d) {
        if (!blocks.containsKey(key(x, y, z))) set(x, y, z, data(d));
    }

    public BlockData get(int x, int y, int z) {
        return blocks.get(key(x, y, z));
    }

    public boolean empty(int x, int y, int z) {
        BlockData d = blocks.get(key(x, y, z));
        return d == null || d.getMaterial().isAir();
    }

    public void remove(int x, int y, int z) {
        blocks.remove(key(x, y, z));
    }

    public void surface(int x, int z, int y) {
        surface.put(((long) x << 32) | (z & 0xFFFFFFFFL), y);
    }

    /** Y del bloque de suelo en la columna, o MIN_VALUE si está fuera de la isla. */
    public int top(int x, int z) {
        Integer y = surface.get(((long) x << 32) | (z & 0xFFFFFFFFL));
        return y == null ? Integer.MIN_VALUE : y;
    }

    public void display(double x, double y, double z, Class<? extends Display> type, Consumer<Display> setup) {
        displays.add(new DisplaySpec(x, y, z, type, setup));
    }

    public int size() {
        return blocks.size();
    }

    public Location min(org.bukkit.World w) {
        return new Location(w, minX, minY, minZ);
    }
}
