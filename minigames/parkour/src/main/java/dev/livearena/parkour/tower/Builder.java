package dev.livearena.parkour.tower;

import dev.livearena.parkour.ParkourLive;
import io.papermc.paper.registry.RegistryAccess;
import io.papermc.paper.registry.RegistryKey;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.stream.Stream;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.Color;
import org.bukkit.Location;
import org.bukkit.NamespacedKey;
import org.bukkit.World;
import org.bukkit.block.Biome;
import org.bukkit.entity.Display;
import org.bukkit.entity.Player;
import org.bukkit.entity.TextDisplay;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.util.Transformation;
import org.joml.Quaternionf;
import org.joml.Vector3f;

/**
 * Construye la torre en el mundo: borra el mundo anterior, pone los biomas de cada nivel y coloca los bloques por
 * tandas (sin congelar el servidor). Al terminar pone los carteles de cada plataforma.
 */
public final class Builder {
    private final ParkourLive plugin;
    private int cursor = -1;
    private World world;
    private Runnable done;

    public Builder(ParkourLive plugin) {
        this.plugin = plugin;
    }

    public boolean isBuilt() {
        return cursor < 0 && plugin.settings.towerSignature().equals(plugin.data().getString("torre.firma", ""))
            && plugin.worldFolder().isDirectory();
    }

    public boolean building() {
        return cursor >= 0;
    }

    public double progress() {
        return cursor < 0 ? 1 : cursor / (double) Math.max(1, plugin.tower.places.size());
    }

    /** Vuelve a crear el mundo y la torre desde cero. done se ejecuta al terminar. */
    public void rebuild(Runnable done) {
        if (building()) return;
        plugin.computeTower();
        plugin.temp.restoreAll();
        File folder = plugin.worldFolder();
        World old = Bukkit.getWorld(plugin.settings.worldName);
        if (old != null) {
            World main = Bukkit.getWorlds().getFirst();
            for (Player p : old.getPlayers()) p.teleport(main.getSpawnLocation());
            if (!Bukkit.unloadWorld(old, false)) {
                plugin.getLogger().warning("No se pudo descargar el mundo " + old.getName() + "; se construye encima");
            }
        }
        if (Bukkit.getWorld(plugin.settings.worldName) == null) deleteDir(folder.toPath());
        world = plugin.world(true);
        if (world == null) {
            plugin.getLogger().severe("No se pudo crear el mundo de la torre");
            return;
        }
        Tower t = plugin.tower;
        // mantener cargados los chunks de la torre
        for (int cx = -3; cx <= 2; cx++) for (int cz = -3; cz <= 2; cz++) world.addPluginChunkTicket(cx, cz, plugin);
        biomes(t);
        this.done = done;
        cursor = 0;
        plugin.data().set("torre.firma", "");
        plugin.getLogger().info("Construyendo la torre: " + t.places.size() + " bloques, " + t.levels + " niveles…");
    }

    public void tick() {
        if (cursor < 0 || world == null) return;
        var list = plugin.tower.places;
        int end = Math.min(list.size(), cursor + 8000);
        for (int i = cursor; i < end; i++) {
            Tower.Place p = list.get(i);
            world.getBlockAt(p.x(), p.y(), p.z()).setBlockData(p.data(), false);
        }
        cursor = end;
        if (cursor >= list.size()) finish();
    }

    private void finish() {
        cursor = -1;
        signs(plugin.tower);
        for (int cx = -3; cx <= 2; cx++) for (int cz = -3; cz <= 2; cz++) world.refreshChunk(cx, cz);
        plugin.data().set("torre.firma", plugin.settings.towerSignature());
        plugin.saveData();
        plugin.applyRules(world);
        plugin.getLogger().info("Torre construida.");
        Runnable d = done;
        done = null;
        if (d != null) d.run();
    }

    private void biomes(Tower t) {
        var reg = RegistryAccess.registryAccess().getRegistry(RegistryKey.BIOME);
        for (int lv = 0; lv <= t.levels + 1; lv++) {
            Theme th = Themes.of(Math.max(1, Math.min(t.levels, lv)));
            Biome b = reg.get(NamespacedKey.minecraft(th.biome()));
            if (b == null) b = Biome.PLAINS;
            int y0 = lv == 0 ? world.getMinHeight() : t.pad(lv).y() - 2;
            int y1 = lv == 0 ? t.pad(1).y() - 3 : lv > t.levels ? world.getMaxHeight() - 1 : t.pad(lv + 1).y() - 3;
            for (int y = y0; y <= y1; y += 2)
                for (int x = -48; x < 48; x += 4)
                    for (int z = -48; z < 48; z += 4) world.setBiome(x, y, z, b);
        }
    }

    /** Cartel flotante sobre cada plataforma: número de nivel y nombre del bioma. */
    private void signs(Tower t) {
        for (var e : world.getEntitiesByClass(TextDisplay.class))
            if (e.getPersistentDataContainer().has(plugin.tagKey)) e.remove();
        for (int lv = 1; lv <= t.levels + 1; lv++) {
            Tower.Pad p = t.pad(lv);
            boolean top = lv > t.levels;
            Theme th = Themes.of(Math.min(lv, t.levels));
            Component title = top
                ? Component.text("★ CIMA ★", TextColor.color(0xFFD700)).decorate(TextDecoration.BOLD)
                : Component.text("NIVEL " + lv, TextColor.color(th.rgb())).decorate(TextDecoration.BOLD);
            Component sub = Component.text(top ? "¡Lo has conseguido!" : th.name(), NamedTextColor.WHITE);
            Location at = new Location(world, p.x() + 0.5, p.y() + 3.3, p.z() + 0.5);
            world.spawn(at, TextDisplay.class, d -> {
                d.text(title.append(Component.newline()).append(sub));
                d.setBillboard(Display.Billboard.CENTER);
                d.setBackgroundColor(Color.fromARGB(110, 0, 0, 0));
                d.setShadowed(true);
                d.setViewRange(0.8f);
                d.setBrightness(new Display.Brightness(15, 15));
                d.setTransformation(new Transformation(new Vector3f(), new Quaternionf(), new Vector3f(top ? 2.2f : 1.5f), new Quaternionf()));
                d.getPersistentDataContainer().set(plugin.tagKey, PersistentDataType.BYTE, (byte) 1);
            });
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
