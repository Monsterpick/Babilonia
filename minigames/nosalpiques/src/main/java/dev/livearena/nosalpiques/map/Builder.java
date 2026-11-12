package dev.livearena.nosalpiques.map;

import dev.livearena.nosalpiques.NoSalpiquesLive;
import io.papermc.paper.registry.RegistryAccess;
import io.papermc.paper.registry.RegistryKey;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.stream.Stream;
import org.bukkit.Bukkit;
import org.bukkit.NamespacedKey;
import org.bukkit.World;
import org.bukkit.block.Biome;
import org.bukkit.entity.Player;

/** Construye todas las salas por tandas (sin congelar el servidor) y guarda la firma del mapa en datos.yml. */
public final class Builder {
    private final NoSalpiquesLive plugin;
    private int cursor = -1;
    private World world;
    private Runnable done;

    public Builder(NoSalpiquesLive plugin) {
        this.plugin = plugin;
    }

    public boolean isBuilt() {
        return cursor < 0 && plugin.settings.mapSignature().equals(plugin.data().getString("mapa.firma", "")) && plugin.worldFolder().isDirectory();
    }

    public boolean building() {
        return cursor >= 0;
    }

    public double progress() {
        return cursor < 0 ? 1 : cursor / (double) Math.max(1, plugin.rooms.places.size());
    }

    public void rebuild(Runnable done) {
        if (building()) return;
        plugin.computeRooms();
        plugin.temp.restoreAll();
        World old = Bukkit.getWorld(plugin.settings.worldName);
        if (old != null) {
            World main = Bukkit.getWorlds().getFirst();
            for (Player p : old.getPlayers()) p.teleport(main.getSpawnLocation());
            Bukkit.unloadWorld(old, false);
        }
        if (Bukkit.getWorld(plugin.settings.worldName) == null) deleteDir(plugin.worldFolder().toPath());
        world = plugin.world(true);
        if (world == null) return;
        Rooms m = plugin.rooms;
        int maxX = Rooms.roomX(m.rooms) + Rooms.L + 2;
        for (int cx = -1; cx <= (maxX >> 4) + 1; cx++)
            for (int cz = -1; cz <= 2; cz++) {
                world.getChunkAt(cx, cz).load(true);
                world.addPluginChunkTicket(cx, cz, plugin);
            }
        var reg = RegistryAccess.registryAccess().getRegistry(RegistryKey.BIOME);
        Biome b = reg.get(NamespacedKey.minecraft("warm_ocean"));
        if (b == null) b = Biome.PLAINS;
        for (int x = -4; x < maxX + 4; x += 4)
            for (int z = -4; z < Rooms.W + 4; z += 4)
                for (int y = Rooms.FLOOR - 4; y <= Rooms.DECK + Rooms.H + 16; y += 4) world.setBiome(x, y, z, b);
        this.done = done;
        cursor = 0;
        plugin.data().set("mapa.firma", "");
        plugin.getLogger().info("Construyendo las salas: " + m.places.size() + " bloques…");
    }

    public void tick() {
        if (cursor < 0 || world == null) return;
        var list = plugin.rooms.places;
        int end = Math.min(list.size(), cursor + 8000);
        for (int i = cursor; i < end; i++) {
            Rooms.Place p = list.get(i);
            world.getBlockAt(p.x(), p.y(), p.z()).setBlockData(p.data(), false);
        }
        cursor = end;
        if (cursor >= list.size()) {
            cursor = -1;
            plugin.data().set("mapa.firma", plugin.settings.mapSignature());
            plugin.saveData();
            plugin.applyRules(world);
            plugin.getLogger().info("Salas construidas.");
            Runnable d = done;
            done = null;
            if (d != null) d.run();
        }
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
}
