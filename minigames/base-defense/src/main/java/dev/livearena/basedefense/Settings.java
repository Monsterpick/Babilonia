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
    public record MobDef(String id, EntityType entity, double health, double speed, int damage, String name, int phase, int weight) {}

    /** Jefe: se queda a `attackDistance` bloques de la base y ataca cada `attackEvery` s (y embiste si llega). */
    public record BossDef(String id, EntityType entity, double health, double speed, double scale, double height, String name,
                          double attackDistance, double attackEvery, int attackDamage, int returnDamage, int ramDamage, double ramEvery,
                          double armor, String summonType, int summonCount, double summonEvery) {
        public boolean flying() {
            return entity == EntityType.WITHER || entity == EntityType.ENDER_DRAGON || entity == EntityType.GHAST
                || entity == EntityType.BLAZE || entity == EntityType.PHANTOM || entity == EntityType.VEX
                || entity == EntityType.ALLAY || entity == EntityType.BEE || entity == EntityType.HAPPY_GHAST;
        }

        public int damage() {
            return ramDamage;
        }
    }

    public enum WeaponKind { HITSCAN, COHETE, GRANADA }

    public record WeaponDef(String id, int slot, ItemType item, String model, String name, WeaponKind kind, boolean automatic,
                            double damage, double rate, double range, double spread, int magazine, double reload,
                            double radius, double speed, int bounces, double fuse, String sound, float pitch,
                            int reserve, int shotsPerTick, double warmup, int unlockPhase) {
        /** Sonido del pack (antes de «|») o el vanilla de respaldo (después). */
        public String sound(boolean pack) {
            int i = sound.indexOf('|');
            if (i < 0) return sound;
            return pack ? sound.substring(0, i) : sound.substring(i + 1);
        }

        public boolean infinite() {
            return reserve < 0;
        }

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
    // oleadas
    public final boolean waves;
    public final int phases, waveEvery, waveSize, waveGrowth;
    public final double healthPerPhase, speedPerPhase;
    // munición
    public final double ammoChance, ammoChanceBoss;
    public final boolean supplyOnPhase;
    public final int supplyEvery;
    public final int rewardKills, rewardGrowth, rewardBoostSeconds;
    public final double ammoBoxMags, supplyMags;
    // dificultad
    public final boolean siege;
    public final double siegeEvery, eliteBase, elitePerPhase, eliteHp, eliteSpeed, perRound;
    public final double threatPerMob, threatPerBoss, threatPerLevel, threatDecay, threatHp, threatSpeed, threatWave, threatElite;
    public final int threatLevels;
    // zombis: variantes y desmembramiento
    public final double varRunner, varRunnerSpeed, varBrute, varBruteHp, varBruteScale;
    public final int varBrutePhase;
    public final boolean gore;
    public final int goreMax, goreSeconds;
    // pack
    public final boolean packEnabled, packRequired;
    public final int packPort;
    public final String packUrl;
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
                Math.max(0.05, s.getDouble("velocidad", 0.23)), Math.max(0, s.getInt("danio", 10)), s.getString("nombre", id),
                Math.max(1, s.getInt("fase", 1)), Math.max(0, s.getInt("peso", 5))));
        }

        waves = c.getBoolean("oleadas.activadas", true);
        phases = clamp(c.getInt("oleadas.fases", 5), 1, 20);
        waveEvery = clamp(c.getInt("oleadas.cada", 35), 5, 3600);
        waveSize = clamp(c.getInt("oleadas.tamano", 5), 0, 500);
        waveGrowth = clamp(c.getInt("oleadas.crecimiento", 3), 0, 500);
        healthPerPhase = Math.max(0, c.getDouble("oleadas.vidaPorFase", 0.15));
        speedPerPhase = Math.max(0, c.getDouble("oleadas.velocidadPorFase", 0.04));
        ammoChance = Math.max(0, Math.min(1, c.getDouble("municion.probabilidadCaja", 0.10)));
        ammoChanceBoss = Math.max(0, Math.min(1, c.getDouble("municion.probabilidadCajaJefe", 1.0)));
        supplyOnPhase = c.getBoolean("municion.suministroAlEmpezarFase", true);
        supplyEvery = Math.max(0, c.getInt("municion.suministroCada", 150));
        ammoBoxMags = Math.max(0.05, c.getDouble("municion.cajaCargadores", 0.35));
        supplyMags = Math.max(0.1, c.getDouble("municion.suministroCargadores", 1.0));
        siege = c.getBoolean("dificultad.asedio", true);
        siegeEvery = Math.max(0.3, c.getDouble("dificultad.golpeCada", 1.4));
        eliteBase = Math.max(0, c.getDouble("dificultad.eliteBase", 0.04));
        elitePerPhase = Math.max(0, c.getDouble("dificultad.elitePorFase", 0.04));
        eliteHp = Math.max(1, c.getDouble("dificultad.eliteVida", 2.6));
        eliteSpeed = Math.max(1, c.getDouble("dificultad.eliteVelocidad", 1.2));
        perRound = Math.max(0, c.getDouble("dificultad.porRonda", 0.35));
        varRunner = clampD(c.getDouble("zombis.corredor.probabilidad", 0.24), 0, 1);
        varRunnerSpeed = Math.max(1, c.getDouble("zombis.corredor.velocidad", 1.7));
        varBrute = clampD(c.getDouble("zombis.bruto.probabilidad", 0.12), 0, 1);
        varBruteHp = Math.max(1, c.getDouble("zombis.bruto.vida", 2.8));
        varBruteScale = Math.max(1, Math.min(3, c.getDouble("zombis.bruto.tamano", 1.55)));
        varBrutePhase = clamp(c.getInt("zombis.bruto.desdeFase", 2), 1, 9);
        gore = c.getBoolean("zombis.desmembrar", true);
        goreMax = clamp(c.getInt("zombis.maxPiezas", 70), 0, 400);
        goreSeconds = clamp(c.getInt("zombis.segundosPiezas", 4), 1, 30);
        threatPerMob = Math.max(0, c.getDouble("dificultad.amenaza.porMob", 1));
        threatPerBoss = Math.max(0, c.getDouble("dificultad.amenaza.porJefe", 30));
        threatPerLevel = Math.max(1, c.getDouble("dificultad.amenaza.porNivel", 35));
        threatLevels = clamp(c.getInt("dificultad.amenaza.niveles", 5), 1, 10);
        threatDecay = Math.max(0, c.getDouble("dificultad.amenaza.bajadaPorSegundo", 0.6));
        threatHp = Math.max(0, c.getDouble("dificultad.amenaza.vida", 0.18));
        threatSpeed = Math.max(0, c.getDouble("dificultad.amenaza.velocidad", 0.06));
        threatWave = Math.max(0, c.getDouble("dificultad.amenaza.oleada", 0.3));
        threatElite = Math.max(0, c.getDouble("dificultad.amenaza.elite", 0.05));
        rewardKills = Math.max(0, c.getInt("recompensa.bajas", 40));
        rewardGrowth = Math.max(0, c.getInt("recompensa.incremento", 10));
        rewardBoostSeconds = Math.max(0, c.getInt("recompensa.danioDobleSegundos", 20));
        packEnabled = c.getBoolean("paquete.activado", true);
        packRequired = c.getBoolean("paquete.obligatorio", false);
        packPort = clamp(c.getInt("paquete.puerto", 25590), 1024, 65535);
        packUrl = c.getString("paquete.url", "http://127.0.0.1:{puerto}/basedefense.zip").replace("{puerto}", String.valueOf(packPort));

        furyPercent = Math.max(0, Math.min(100, c.getDouble("jefes.furia", 35)));
        furySpeed = Math.max(1, c.getDouble("jefes.aceleracionFuria", 1.6));
        ConfigurationSection bt = c.getConfigurationSection("jefes.tipos");
        if (bt != null) for (String id : bt.getKeys(false)) {
            ConfigurationSection s = bt.getConfigurationSection(id);
            EntityType et = entity(s == null ? null : s.getString("entidad"), log, "jefes.tipos." + id);
            if (s == null || et == null) continue;
            bosses.put(id.toLowerCase(Locale.ROOT), new BossDef(id.toLowerCase(Locale.ROOT), et, Math.max(1, s.getDouble("vida", 400)),
                Math.max(0.02, s.getDouble("velocidad", 0.15)), Math.max(0.2, Math.min(6, s.getDouble("escala", 1))),
                s.getDouble("altura", 8), s.getString("nombre", id.toUpperCase(Locale.ROOT)),
                Math.max(2, s.getDouble("distanciaAtaque", 24)), Math.max(0.3, s.getDouble("ataqueCada", 3)), Math.max(0, s.getInt("danioAtaque", 40)),
                Math.max(0, s.getInt("danioDevuelta", 80)), Math.max(0, s.getInt("danioEmbestida", s.getInt("danio", 80))), Math.max(0.3, s.getDouble("embestidaCada", 2.5)),
                Math.max(0.05, Math.min(1, s.getDouble("blindaje", 1))), s.getString("invocar.tipo", ""), Math.max(0, s.getInt("invocar.cantidad", 0)),
                Math.max(2, s.getDouble("invocar.cada", 15))));
        }

        likesGoal = Math.max(1, c.getInt("likes.meta", 5000));
        likesBoss = c.getString("likes.jefe", "wither").toLowerCase(Locale.ROOT);
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
                (float) s.getDouble("tono", 1.0), s.getInt("reserva", -1), clamp(s.getInt("balasPorTick", 1), 1, 5), Math.max(0, s.getDouble("calentamiento", 0)),
                clamp(s.getInt("desbloqueo", 1), 1, 50)));
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
        // sin valor por defecto explícito: así las claves nuevas salen del config.yml del .jar aunque el del
        // servidor sea de una versión anterior
        String v = msg == null ? null : msg.getString(key);
        return v == null ? key : v;
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

    private static double clampD(double v, double lo, double hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
