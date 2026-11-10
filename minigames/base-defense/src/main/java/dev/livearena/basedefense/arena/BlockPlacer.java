package dev.livearena.basedefense.arena;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.World;
import org.bukkit.block.Biome;
import org.bukkit.block.Block;
import org.bukkit.block.data.BlockData;
import org.bukkit.entity.Display;
import org.bukkit.entity.Entity;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitTask;
import org.bukkit.util.BoundingBox;

/**
 * Vuelca un {@link Canvas} al mundo (o borra una zona) por lotes repartidos en varios ticks,
 * con barra de progreso. Sin dependencias externas: setBlockData sin físicas, ordenado por chunk.
 */
public final class BlockPlacer {
    private final Plugin plugin;
    private final NamespacedKey arenaTag;
    private BukkitTask task;
    private BossBar bar;

    public BlockPlacer(Plugin plugin, NamespacedKey arenaTag) {
        this.plugin = plugin;
        this.arenaTag = arenaTag;
    }

    public boolean busy() {
        return task != null;
    }

    public void cancel() {
        if (task != null) task.cancel();
        task = null;
        hideBar();
    }

    /** Borra la arena anterior (bloques en la caja y entidades de decorado) y luego construye. */
    public void rebuild(World w, BoundingBox oldBounds, Canvas canvas, Biome biome, int perTick, Runnable done) {
        Runnable build = () -> place(w, canvas, biome, perTick, done);
        if (oldBounds == null) build.run();
        else clear(w, oldBounds, perTick * 3, build);
    }

    public void place(World w, Canvas canvas, Biome biome, int perTick, Runnable done) {
        long[] keys = new long[canvas.blocks.size()];
        BlockData[] data = new BlockData[keys.length];
        Integer[] order = new Integer[keys.length];
        int i = 0;
        for (Map.Entry<Long, BlockData> e : canvas.blocks.entrySet()) {
            keys[i] = e.getKey();
            data[i] = e.getValue();
            order[i] = i;
            i++;
        }
        // por chunk y de abajo arriba: menos cargas de chunk y los soportes antes que lo que apoyan
        Arrays.sort(order, Comparator.<Integer>comparingLong(k -> chunkKey(Canvas.kx(keys[k]), Canvas.kz(keys[k]))).thenComparingInt(k -> Canvas.ky(keys[k])));
        final int total = keys.length;
        final int[] pos = {0};
        showBar("Construyendo la arena");
        Bukkit.getLogger().info("[BaseDefense] Generando arena: " + total + " bloques...");
        int[] lastPct = {-1};
        task = Bukkit.getScheduler().runTaskTimer(plugin, () -> {
            int end = Math.min(total, pos[0] + perTick);
            for (int k = pos[0]; k < end; k++) {
                int idx = order[k];
                long key = keys[idx];
                w.getBlockAt(Canvas.kx(key), Canvas.ky(key), Canvas.kz(key)).setBlockData(data[idx], false);
            }
            pos[0] = end;
            float p = total == 0 ? 1 : pos[0] / (float) total;
            progress(p * 0.95f, "Construyendo la arena");
            int pct = (int) (p * 10);
            if (pct != lastPct[0]) {
                lastPct[0] = pct;
                Bukkit.getLogger().info("[BaseDefense] Arena " + pct * 10 + "%");
            }
            if (pos[0] >= total) {
                task.cancel();
                task = null;
                finish(w, canvas, biome, done);
            }
        }, 1L, 1L);
    }

    private void finish(World w, Canvas canvas, Biome biome, Runnable done) {
        // bioma por celdas de 4x4x4 y reenvío de chunks
        if (biome != null && canvas.minX <= canvas.maxX) {
            for (int x = canvas.minX; x <= canvas.maxX; x += 4)
                for (int z = canvas.minZ; z <= canvas.maxZ; z += 4)
                    for (int y = canvas.minY; y <= canvas.maxY + 24; y += 4) w.setBiome(x, y, z, biome);
            for (int cx = canvas.minX >> 4; cx <= canvas.maxX >> 4; cx++)
                for (int cz = canvas.minZ >> 4; cz <= canvas.maxZ >> 4; cz++) w.refreshChunk(cx, cz);
        }
        for (Canvas.DisplaySpec d : canvas.displays) {
            Display e = w.spawn(new org.bukkit.Location(w, d.x(), d.y(), d.z()), d.type(), ent -> {
                ent.setPersistent(true);
                ent.getPersistentDataContainer().set(arenaTag, PersistentDataType.BYTE, (byte) 1);
                ent.setViewRange(2f);
                d.setup().accept(ent);
            });
            e.setBrightness(new Display.Brightness(7, 9));
        }
        progress(1f, "Arena lista");
        Bukkit.getScheduler().runTaskLater(plugin, this::hideBar, 40L);
        Bukkit.getLogger().info("[BaseDefense] Arena terminada.");
        if (done != null) done.run();
    }

    /** Pone a aire todo lo que no lo sea dentro de la caja y quita las entidades de decorado. */
    public void clear(World w, BoundingBox box, int checksPerTick, Runnable done) {
        removeDecor(w, box);
        int x0 = (int) Math.floor(box.getMinX()), y0 = (int) Math.floor(box.getMinY()), z0 = (int) Math.floor(box.getMinZ());
        int x1 = (int) Math.ceil(box.getMaxX()), y1 = (int) Math.ceil(box.getMaxY()), z1 = (int) Math.ceil(box.getMaxZ());
        List<int[]> columns = new ArrayList<>();
        for (int cx = x0 >> 4; cx <= (x1 - 1) >> 4; cx++)
            for (int cz = z0 >> 4; cz <= (z1 - 1) >> 4; cz++)
                for (int x = Math.max(x0, cx << 4); x < Math.min(x1, (cx << 4) + 16); x++)
                    for (int z = Math.max(z0, cz << 4); z < Math.min(z1, (cz << 4) + 16); z++) columns.add(new int[]{x, z});
        final int height = Math.max(1, y1 - y0);
        final int perTickColumns = Math.max(1, checksPerTick / height);
        final int[] pos = {0};
        BlockData air = Material.AIR.createBlockData();
        showBar("Borrando la arena");
        task = Bukkit.getScheduler().runTaskTimer(plugin, () -> {
            int end = Math.min(columns.size(), pos[0] + perTickColumns);
            for (int k = pos[0]; k < end; k++) {
                int[] col = columns.get(k);
                for (int y = y0; y < y1; y++) {
                    Block b = w.getBlockAt(col[0], y, col[1]);
                    if (!b.getType().isAir()) b.setBlockData(air, false);
                }
            }
            pos[0] = end;
            progress(columns.isEmpty() ? 1 : pos[0] / (float) columns.size(), "Borrando la arena");
            if (pos[0] >= columns.size()) {
                task.cancel();
                task = null;
                hideBar();
                if (done != null) done.run();
            }
        }, 1L, 1L);
    }

    public void removeDecor(World w, BoundingBox box) {
        for (Entity e : w.getNearbyEntities(box.clone().expand(4), e -> e.getPersistentDataContainer().has(arenaTag))) e.remove();
    }

    private static long chunkKey(int x, int z) {
        return ((long) (x >> 4) << 32) ^ ((z >> 4) & 0xFFFFFFFFL);
    }

    private void showBar(String title) {
        if (bar == null) bar = BossBar.bossBar(Component.text(title, NamedTextColor.GOLD), 0f, BossBar.Color.YELLOW, BossBar.Overlay.NOTCHED_20);
        forAdmins(p -> p.showBossBar(bar));
    }

    private void progress(float p, String title) {
        if (bar == null) return;
        p = Math.max(0, Math.min(1, p));
        bar.progress(p);
        bar.name(Component.text(title + " · " + Math.round(p * 100) + "%", NamedTextColor.GOLD));
        forAdmins(pl -> pl.showBossBar(bar));
    }

    private void hideBar() {
        if (bar == null) return;
        BossBar b = bar;
        Bukkit.getOnlinePlayers().forEach(p -> p.hideBossBar(b));
        bar = null;
    }

    private static void forAdmins(Consumer<org.bukkit.entity.Player> f) {
        for (var p : Bukkit.getOnlinePlayers()) if (p.hasPermission("basedefense.admin")) f.accept(p);
    }
}
