package dev.livearena.dropper.game;

import dev.livearena.dropper.DropperLive;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.block.data.BlockData;

/** Cambios temporales de bloques (hielo, bloques fantasma, puentes): se guarda el original y se devuelve al acabar. */
public final class TempBlocks {
    private record Change(int x, int y, int z, BlockData original, long until) {}

    private final DropperLive plugin;
    private final Map<Long, Change> changes = new HashMap<>();

    public TempBlocks(DropperLive plugin) {
        this.plugin = plugin;
    }

    /** Cambia un bloque durante ticks ticks. Si ya estaba cambiado, conserva el original y alarga el tiempo. */
    public void set(World w, int x, int y, int z, BlockData data, long ticks) {
        long k = key(x, y, z);
        Block b = w.getBlockAt(x, y, z);
        Change old = changes.get(k);
        BlockData original = old != null ? old.original() : b.getBlockData();
        changes.put(k, new Change(x, y, z, original, plugin.tick() + ticks));
        b.setBlockData(data, false);
    }

    public boolean changed(int x, int y, int z) {
        return changes.containsKey(key(x, y, z));
    }

    public void tick() {
        if (changes.isEmpty()) return;
        World w = plugin.world(false);
        long now = plugin.tick();
        Iterator<Change> it = changes.values().iterator();
        while (it.hasNext()) {
            Change c = it.next();
            if (c.until() > now) continue;
            if (w != null) {
                w.getBlockAt(c.x(), c.y(), c.z()).setBlockData(c.original(), false);
                plugin.fx.particle(new org.bukkit.Location(w, c.x() + 0.5, c.y() + 0.5, c.z() + 0.5), org.bukkit.Particle.WAX_OFF, 2, 0.3, 0);
            }
            it.remove();
        }
    }

    public void restoreAll() {
        World w = plugin.world(false);
        if (w != null) for (Change c : changes.values()) w.getBlockAt(c.x(), c.y(), c.z()).setBlockData(c.original(), false);
        changes.clear();
    }

    static long key(int x, int y, int z) {
        return ((long) (x & 0x3FFFFFF) << 38) | ((long) (z & 0x3FFFFFF) << 12) | (y & 0xFFF);
    }
}
