package dev.livearena.dropper.map;

import dev.livearena.dropper.DropperLive;
import io.papermc.paper.registry.RegistryAccess;
import io.papermc.paper.registry.RegistryKey;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import org.bukkit.Bukkit;
import org.bukkit.NamespacedKey;
import org.bukkit.World;
import org.bukkit.block.Biome;
import org.bukkit.entity.Player;

/**
 * Construye los niveles en el mundo según se necesitan (el actual y los dos siguientes), por tandas para no congelar
 * el servidor. Los niveles ya construidos se guardan en datos.yml junto con la firma del mapa: si cambian la semilla,
 * la dificultad o el número de niveles, el mundo se borra y se vuelve a empezar.
 */
public final class Builder {
    private static final int PER_TICK = 6000;
    private final DropperLive plugin;
    private final Map<Integer, Shaft> cache = new HashMap<>();
    private final Set<Integer> built = new HashSet<>();
    private final ArrayDeque<Integer> queue = new ArrayDeque<>();
    private int current = -1, cursor;
    private List<Shaft.Place> work;

    public Builder(DropperLive plugin) {
        this.plugin = plugin;
    }

    public Shaft shaft(int level) {
        int lv = Math.max(1, Math.min(plugin.settings.levels, level));
        return cache.computeIfAbsent(lv, l -> ShaftGen.generate(plugin.settings.seed, l, plugin.settings.difficulty));
    }

    /** Carga qué niveles hay construidos; si la firma no coincide, borra el mundo. */
    public void load() {
        cache.clear();
        built.clear();
        queue.clear();
        current = -1;
        String sig = plugin.data().getString("mapa.firma", "");
        if (sig.equals(plugin.settings.mapSignature()) && plugin.worldFolder().isDirectory()) {
            for (int lv : plugin.data().getIntegerList("mapa.construidos")) built.add(lv);
        } else {
            wipe();
            plugin.data().set("mapa.firma", plugin.settings.mapSignature());
            plugin.data().set("mapa.construidos", List.of());
            plugin.saveData();
        }
    }

    private void wipe() {
        World old = Bukkit.getWorld(plugin.settings.worldName);
        if (old != null) {
            World main = Bukkit.getWorlds().getFirst();
            for (Player p : old.getPlayers()) p.teleport(main.getSpawnLocation());
            Bukkit.unloadWorld(old, false);
        }
        if (Bukkit.getWorld(plugin.settings.worldName) == null) deleteDir(plugin.worldFolder().toPath());
    }

    public boolean isBuilt(int level) {
        return built.contains(level);
    }

    public boolean building() {
        return current >= 0 || !queue.isEmpty();
    }

    public int builtCount() {
        return built.size();
    }

    /** Construye ya (en este tick) el nivel indicado si falta. Unos 5.000 bloques: se nota poco. */
    public void now(int level) {
        if (level < 1 || level > plugin.settings.levels || built.contains(level)) return;
        if (current == level) {
            finishCurrent();
            return;
        }
        queue.remove(level);
        World w = plugin.world(true);
        Shaft s = shaft(level);
        prepare(w, s);
        for (Shaft.Place p : s.places()) w.getBlockAt(p.x(), p.y(), p.z()).setBlockData(p.data(), false);
        markBuilt(level);
    }

    /** Pide en segundo plano los niveles siguientes. */
    public void ahead(int level, int count) {
        for (int lv = level; lv < level + count && lv <= plugin.settings.levels; lv++)
            if (!built.contains(lv) && !queue.contains(lv) && current != lv) queue.addLast(lv);
    }

    public void tick() {
        World w = null;
        if (current < 0) {
            Integer next = queue.pollFirst();
            if (next == null) return;
            if (built.contains(next)) return;
            w = plugin.world(true);
            current = next;
            Shaft s = shaft(next);
            prepare(w, s);
            work = s.places();
            cursor = 0;
        }
        if (w == null) w = plugin.world(true);
        int end = Math.min(work.size(), cursor + PER_TICK);
        for (int i = cursor; i < end; i++) {
            Shaft.Place p = work.get(i);
            w.getBlockAt(p.x(), p.y(), p.z()).setBlockData(p.data(), false);
        }
        cursor = end;
        if (cursor >= work.size()) {
            markBuilt(current);
            current = -1;
            work = null;
        }
    }

    private void finishCurrent() {
        World w = plugin.world(true);
        for (int i = cursor; i < work.size(); i++) {
            Shaft.Place p = work.get(i);
            w.getBlockAt(p.x(), p.y(), p.z()).setBlockData(p.data(), false);
        }
        markBuilt(current);
        current = -1;
        work = null;
    }

    private void markBuilt(int level) {
        built.add(level);
        plugin.data().set("mapa.construidos", built.stream().sorted().toList());
        plugin.saveData();
    }

    /** Chunks cargados y bioma del tema (color del cielo y la niebla). */
    private void prepare(World w, Shaft s) {
        for (int cx = (s.x0() - 3) >> 4; cx <= (s.x0() + Shaft.S + 3) >> 4; cx++)
            for (int cz = (s.z0() - 3) >> 4; cz <= (s.z0() + Shaft.S + 3) >> 4; cz++) {
                w.getChunkAt(cx, cz).load(true);
                w.addPluginChunkTicket(cx, cz, plugin);
            }
        var reg = RegistryAccess.registryAccess().getRegistry(RegistryKey.BIOME);
        Biome b = reg.get(NamespacedKey.minecraft(Themes.of(s.level()).biome()));
        if (b == null) b = Biome.PLAINS;
        for (int x = s.x0() - 4; x < s.x0() + Shaft.S + 4; x += 4)
            for (int z = s.z0() - 4; z < s.z0() + Shaft.S + 4; z += 4)
                for (int y = s.waterY() - 8; y <= s.topY() + 12; y += 4) w.setBiome(x, y, z, b);
    }

    /** Borra todo y empieza de cero (nuevo mapa). */
    public void reset() {
        wipe();
        plugin.data().set("mapa.firma", plugin.settings.mapSignature());
        plugin.data().set("mapa.construidos", List.of());
        plugin.saveData();
        cache.clear();
        built.clear();
        queue.clear();
        current = -1;
        work = null;
    }

    private static void deleteDir(Path dir) {
        if (!Files.isDirectory(dir)) return;
        try (Stream<Path> s = Files.walk(dir)) {
            s.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException ignored) {
                }
            });
        } catch (IOException ignored) {
        }
    }

    @SuppressWarnings("unused")
    private static File unused() {
        return null;
    }
}
