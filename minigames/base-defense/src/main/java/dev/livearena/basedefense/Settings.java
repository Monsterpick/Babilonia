package dev.livearena.basedefense;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.logging.Logger;
import org.bukkit.NamespacedKey;
import org.bukkit.Registry;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.EntityType;
import org.bukkit.inventory.ItemType;

/** Lectura de config.yml a valores inmutables. Se reconstruye entero en cada /bd reload. */
public final class Settings {
    public record MobDef(String id, EntityType entity, double health, double speed, int damage, String name) {}

    public record BossDef(String id, EntityType entity, double health, double speed, int damage, double scale,
                          double height, String name, double fireballEvery, int fireballBaseDamage, int fireballBossDamage) {
        public boolean flying() {
            return entity == EntityType.WITHER || entity == EntityType.ENDER_DRAGON || entity == EntityType.GHAST
                || entity == EntityType.BLAZE || entity == EntityType.PHANTOM || entity == EntityType.VEX
                || entity == EntityType.ALLAY || entity == EntityType.BEE || entity == EntityType.HAPPY_GHAST;
        }
    }

    public enum WeaponKind { HITSCAN, COHETE, GRANADA }

    public record WeaponDef(String id, int slot, ItemType item, String model, String name, WeaponKind kind, boolean automatic,
                            double damage, double rate, double range, double spread, int magazine, double reload,
                            double radius, double speed, int bounces, double fuse, String sound, float pitch) {
        public int cooldownTicks() {
            return Math.max(1, (int) Math.round(20.0 / Math.max(0.1, rate)));
        }
    }

    // mundo
    public final String worldName, biome, weather;
    public final long time;
    // arena
    public final long seed;
    public final int length, width, forest, groundY, baseHeight, laneLight, blocksPerTick;
    public final double decoDensity;
    // base / ronda
    public final int baseHealth, fallPause, roundSeconds;
    public final boolean clearQueueOnFall, clearOnWin, healOnWin;
    // mobs
    public final int mobCap, spawnPerTick, bigHorde, maxPerCommand, labelsPerHorde, labelsMax;
    public final String label;
    public final Map<String, MobDef> mobs = new LinkedHashMap<>();
    // jefes
    public final double furyPercent, furySpeed;
    public final Map<String, BossDef> bosses = new LinkedHashMap<>();
    // likes
    public final int likesGoal;
    public final String likesBoss, likesDonor;
    // armas
    public final Map<String, WeaponDef> weapons = new LinkedHashMap<>();
    // rendimiento
    public final int particlesPerTick, soundsPerTick, tracePoints, bloodStains, ashPerTick;
    // ambiente
    public final boolean ambientSounds;
    public final int ambientMin, ambientMax;
    public final List<String> ambientList;
    // textos
    private final ConfigurationSection msg;

    public Settings(FileConfiguration c, Logger log) {
        worldName = c.getString("mundo.nombre", "basedefense");
        biome = c.getString("mundo.bioma", "basedefense:ceniza");
        time = c.getLong("mundo.hora", 12400);
        weather = c.getString("mundo.clima", "despejado").toLowerCase(Locale.ROOT);

        seed = c.getLong("arena.semilla", 1337);
        length = clamp(c.getInt("arena.largo", 80), 30, 220);
        width = clamp(c.getInt("arena.ancho", 15), 7, 41);
        forest = clamp(c.getInt("arena.bosque", 13), 5, 30);
        groundY = clamp(c.getInt("arena.altura", 64), -40, 250);
        baseHeight = clamp(c.getInt("arena.alturaBase", 5), 2, 12);
        decoDensity = Math.max(0, Math.min(2, c.getDouble("arena.densidadDecorado", 1.0)));
        laneLight = clamp(c.getInt("arena.luzCarril", 12), 0, 15);
        blocksPerTick = clamp(c.getInt("arena.bloquesPorTick", 12000), 500, 100000);

        baseHealth = Math.max(1, c.getInt("base.vida", 1500));
        fallPause = clamp(c.getInt("base.pausaAlCaer", 6), 0, 60);
        clearQueueOnFall = c.getBoolean("base.vaciarColaAlCaer", false);
        roundSeconds = Math.max(10, c.getInt("ronda.duracion", 900));
        clearOnWin = c.getBoolean("ronda.limpiarAlGanar", true);
        healOnWin = c.getBoolean("ronda.curarAlGanar", true);

        mobCap = clamp(c.getInt("mobs.tope", 300), 1, 2000);
        spawnPerTick = clamp(c.getInt("mobs.spawnPorTick", 6), 1, 50);
        bigHorde = Math.max(1, c.getInt("mobs.hordaGrande", 25));
        maxPerCommand = Math.max(1, c.getInt("mobs.maxPorComando", 500));
        label = c.getString("mobs.etiqueta", "&e[Donante] &a{usuario}");
        labelsPerHorde = Math.max(0, c.getInt("mobs.etiquetasPorHorda", 6));
        labelsMax = Math.max(0, c.getInt("mobs.etiquetasMax", 90));
        ConfigurationSection types = c.getConfigurationSection("mobs.tipos");
        if (types != null) for (String id : types.getKeys(false)) {
            ConfigurationSection s = types.getConfigurationSection(id);
            EntityType et = entity(s == null ? null : s.getString("entidad"), log, "mobs.tipos." + id);
            if (s == null || et == null) continue;
            mobs.put(id.toLowerCase(Locale.ROOT), new MobDef(id.toLowerCase(Locale.ROOT), et, Math.max(1, s.getDouble("vida", 20)),
                Math.max(0.05, s.getDouble("velocidad", 0.23)), Math.max(0, s.getInt("danio", 10)), s.getString("nombre", id)));
        }

        furyPercent = Math.max(0, Math.min(100, c.getDouble("jefes.furia", 35)));
        furySpeed = Math.max(1, c.getDouble("jefes.aceleracionFuria", 1.6));
        ConfigurationSection bt = c.getConfigurationSection("jefes.tipos");
        if (bt != null) for (String id : bt.getKeys(false)) {
            ConfigurationSection s = bt.getConfigurationSection(id);
            EntityType et = entity(s == null ? null : s.getString("entidad"), log, "jefes.tipos." + id);
            if (s == null || et == null) continue;
            bosses.put(id.toLowerCase(Locale.ROOT), new BossDef(id.toLowerCase(Locale.ROOT), et, Math.max(1, s.getDouble("vida", 400)),
                Math.max(0.02, s.getDouble("velocidad", 0.15)), Math.max(0, s.getInt("danio", 200)), Math.max(0.2, Math.min(6, s.getDouble("escala", 1))),
                s.getDouble("altura", 8), s.getString("nombre", id.toUpperCase(Locale.ROOT)), s.getDouble("bolaCada", 0),
                s.getInt("bolaDanioBase", 60), s.getInt("bolaDanioJefe", 80)));
        }

        likesGoal = Math.max(1, c.getInt("likes.meta", 5000));
        likesBoss = c.getString("likes.jefe", "ghast").toLowerCase(Locale.ROOT);
        likesDonor = c.getString("likes.donante", "la comunidad");

        ConfigurationSection ws = c.getConfigurationSection("armas");
        if (ws != null) for (String id : ws.getKeys(false)) {
            ConfigurationSection s = ws.getConfigurationSection(id);
            if (s == null) continue;
            ItemType it = Registry.ITEM.get(key(s.getString("item", "stick")));
            if (it == null) {
                log.warning("armas." + id + ".item desconocido: " + s.getString("item") + " (uso stick)");
                it = ItemType.STICK;
            }
            WeaponKind kind;
            try {
                kind = WeaponKind.valueOf(s.getString("tipo", "hitscan").toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                log.warning("armas." + id + ".tipo debe ser hitscan, cohete o granada");
                kind = WeaponKind.HITSCAN;
            }
            weapons.put(id, new WeaponDef(id, clamp(s.getInt("slot", weapons.size()), 0, 8), it, s.getString("modelo", ""), s.getString("nombre", id), kind,
                s.getBoolean("automatica", false), Math.max(0, s.getDouble("danio", 5)), Math.max(0.1, s.getDouble("cadencia", 4)),
                Math.max(5, s.getDouble("alcance", 100)), Math.max(0, s.getDouble("dispersion", 1)), Math.max(1, s.getInt("cargador", 10)),
                Math.max(0, s.getDouble("recarga", 1.5)), Math.max(0.5, s.getDouble("radio", 4)), Math.max(0.2, s.getDouble("velocidad", 1.5)),
                Math.max(0, s.getInt("rebotes", 2)), Math.max(0.2, s.getDouble("mecha", 2.5)), s.getString("sonido", "entity.firework_rocket.blast"),
                (float) s.getDouble("tono", 1.0)));
        }

        particlesPerTick = clamp(c.getInt("rendimiento.particulasPorTick", 900), 50, 20000);
        soundsPerTick = clamp(c.getInt("rendimiento.sonidosPorTick", 14), 1, 200);
        tracePoints = clamp(c.getInt("rendimiento.puntosTrazo", 18), 2, 80);
        bloodStains = clamp(c.getInt("rendimiento.manchasSangre", 40), 0, 400);
        ashPerTick = clamp(c.getInt("rendimiento.cenizaPorTick", 6), 0, 100);

        ambientSounds = c.getBoolean("ambiente.sonidos", true);
        ambientMin = clamp(c.getInt("ambiente.intervaloMin", 6), 1, 600);
        ambientMax = Math.max(ambientMin, c.getInt("ambiente.intervaloMax", 16));
        ambientList = new ArrayList<>(c.getStringList("ambiente.lista"));

        msg = c.getConfigurationSection("mensajes");
    }

    public String msg(String key) {
        return msg == null ? key : msg.getString(key, key);
    }

    public static NamespacedKey key(String s) {
        NamespacedKey k = NamespacedKey.fromString(s == null ? "" : s.toLowerCase(Locale.ROOT).trim());
        return k == null ? NamespacedKey.minecraft("air") : k;
    }

    private static EntityType entity(String name, Logger log, String where) {
        if (name == null) return null;
        EntityType t = Registry.ENTITY_TYPE.get(key(name));
        if (t == null || !t.isAlive() || !t.isSpawnable()) {
            log.warning(where + ".entidad no válida: " + name);
            return null;
        }
        return t;
    }

    private static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
