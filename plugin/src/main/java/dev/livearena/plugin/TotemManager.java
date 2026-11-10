package dev.livearena.plugin;

import java.io.File;
import java.io.IOException;
import java.time.Duration;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.sound.Sound;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.title.Title;
import org.bukkit.Bukkit;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;

/** Contador de tótems guardados por jugador (por nombre, en data.yml) y su barra en pantalla. */
final class TotemManager {
    private final LiveArenaPlugin plugin;
    private final File file;
    private final Map<String, Integer> counts = new HashMap<>();
    private final Map<String, BossBar> bars = new HashMap<>();
    private boolean dirty;

    TotemManager(LiveArenaPlugin plugin) {
        this.plugin = plugin;
        this.file = new File(plugin.getDataFolder(), "data.yml");
    }

    private static String key(String name) {
        return name.toLowerCase(Locale.ROOT);
    }

    private FileConfiguration cfg() {
        return plugin.getConfig();
    }

    int max() {
        return Math.max(0, cfg().getInt("totems.max", 0));
    }

    void load() {
        counts.clear();
        if (!file.exists()) return;
        YamlConfiguration y = YamlConfiguration.loadConfiguration(file);
        for (String k : y.getKeys(false)) counts.put(k, Math.max(0, y.getInt(k)));
        // Guardado periódico (cada 30 s) si hubo cambios.
        Bukkit.getScheduler().runTaskTimer(plugin, () -> {
            if (dirty) save();
        }, 600L, 600L);
    }

    void save() {
        YamlConfiguration y = new YamlConfiguration();
        for (Map.Entry<String, Integer> e : counts.entrySet()) if (e.getValue() > 0) y.set(e.getKey(), e.getValue());
        try {
            plugin.getDataFolder().mkdirs();
            y.save(file);
            dirty = false;
        } catch (IOException ex) {
            plugin.getLogger().warning("No pude guardar data.yml: " + ex.getMessage());
        }
    }

    int get(String name) {
        return counts.getOrDefault(key(name), 0);
    }

    /** Fija el total (respetando el máximo). Devuelve el total final. */
    int set(String name, int value) {
        int v = Math.max(0, value);
        int m = max();
        if (m > 0) v = Math.min(v, m);
        counts.put(key(name), v);
        dirty = true;
        Player p = Bukkit.getPlayerExact(name);
        if (p != null) refresh(p);
        return v;
    }

    /** Suma (o resta si es negativo). Devuelve cuántos se aplicaron realmente. */
    int add(String name, int amount) {
        int before = get(name);
        int after = set(name, before + amount);
        return after - before;
    }

    Map<String, String> vars(String jugador, int cantidad, String espectador) {
        int total = get(jugador);
        int m = max();
        Map<String, String> v = new HashMap<>();
        v.put("jugador", jugador);
        v.put("cantidad", String.valueOf(Math.abs(cantidad)));
        v.put("total", String.valueOf(total));
        v.put("espectador", espectador == null || espectador.isBlank() ? "Alguien" : espectador);
        v.put("max", m > 0 ? String.valueOf(m) : "∞");
        v.put("max_texto", m > 0 ? " / " + m : "");
        v.put("plural", Math.abs(cantidad) == 1 ? "" : "S");
        return v;
    }

    String msg(String path) {
        return cfg().getString("totems.mensajes." + path, "");
    }

    /* ---------------------------- avisos en pantalla ---------------------------- */

    void announceGiven(Player p, int amount, String viewer) {
        Map<String, String> v = vars(p.getName(), amount, viewer);
        // En los mensajes de chat la variable plural va en minúscula.
        Map<String, String> chatVars = new HashMap<>(v);
        chatVars.put("plural", amount == 1 ? "" : "s");
        p.showTitle(Title.title(Text.render(msg("recibidos-titulo"), v), Text.render(msg("recibidos-subtitulo"), v),
                Title.Times.times(Duration.ofMillis(150), Duration.ofMillis(1600), Duration.ofMillis(400))));
        p.playSound(Sound.sound(Key.key("minecraft", "entity.player.levelup"), Sound.Source.MASTER, 0.8f, 1.6f));
        Component chat = Text.render(msg("recibidos-chat"), chatVars);
        Bukkit.getServer().sendMessage(chat);
    }

    void announceRemoved(Player p, int amount, String viewer) {
        Map<String, String> v = vars(p.getName(), amount, viewer);
        v.put("plural", amount == 1 ? "" : "s");
        p.playSound(Sound.sound(Key.key("minecraft", "entity.item.break"), Sound.Source.MASTER, 1f, 0.8f));
        Bukkit.getServer().sendMessage(Text.render(msg("quitados-chat"), v));
    }

    void announceUsed(Player p) {
        Map<String, String> v = vars(p.getName(), 1, "");
        p.showTitle(Title.title(Text.render(msg("usado-titulo"), v), Text.render(msg("usado-subtitulo"), v),
                Title.Times.times(Duration.ofMillis(100), Duration.ofMillis(1500), Duration.ofMillis(500))));
        Bukkit.getServer().sendMessage(Text.render(msg("usado-chat"), v));
    }

    /* ---------------------------------- barra ---------------------------------- */

    void refresh(Player p) {
        String k = key(p.getName());
        int total = get(p.getName());
        boolean show = cfg().getBoolean("totems.barra.mostrar", true) && (total > 0 || cfg().getBoolean("totems.barra.mostrar-con-cero", false)) && !Minijuego.en(p);
        BossBar bar = bars.get(k);
        if (!show) {
            if (bar != null) {
                p.hideBossBar(bar);
                bars.remove(k);
            }
            return;
        }
        Component name = Text.render(cfg().getString("totems.barra.texto", "Tótems: <total>"), vars(p.getName(), 0, ""));
        int m = max();
        float progress = m > 0 ? Math.min(1f, total / (float) m) : 1f;
        BossBar.Color color;
        try {
            color = BossBar.Color.valueOf(cfg().getString("totems.barra.color", "YELLOW").toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            color = BossBar.Color.YELLOW;
        }
        if (bar == null) {
            bar = BossBar.bossBar(name, progress, color, BossBar.Overlay.PROGRESS);
            bars.put(k, bar);
            p.showBossBar(bar);
        } else {
            bar.name(name);
            bar.progress(progress);
            bar.color(color);
        }
    }

    void hide(Player p) {
        BossBar bar = bars.remove(key(p.getName()));
        if (bar != null) p.hideBossBar(bar);
    }

    void refreshAll() {
        for (Player p : Bukkit.getOnlinePlayers()) {
            hide(p);
            refresh(p);
        }
    }

    void hideAll() {
        for (Player p : Bukkit.getOnlinePlayers()) hide(p);
    }
}
