package dev.livearena.basedefense;

import dev.livearena.basedefense.arena.ArenaData;
import dev.livearena.basedefense.arena.BlockPlacer;
import dev.livearena.basedefense.arena.VoidGenerator;
import dev.livearena.basedefense.cmd.BdCommands;
import dev.livearena.basedefense.fx.Ambience;
import dev.livearena.basedefense.fx.Fx;
import dev.livearena.basedefense.game.Game;
import dev.livearena.basedefense.game.Alerts;
import dev.livearena.basedefense.game.Hud;
import dev.livearena.basedefense.game.Loot;
import dev.livearena.basedefense.game.Waves;
import dev.livearena.basedefense.pack.PackServer;
import dev.livearena.basedefense.game.LikeGoal;
import dev.livearena.basedefense.game.Protection;
import dev.livearena.basedefense.mob.Bosses;
import dev.livearena.basedefense.mob.MobManager;
import dev.livearena.basedefense.weapon.Weapons;
import io.papermc.paper.plugin.lifecycle.event.types.LifecycleEvents;
import io.papermc.paper.registry.RegistryAccess;
import io.papermc.paper.registry.RegistryKey;
import java.io.File;
import java.io.IOException;
import org.bukkit.Bukkit;
import org.bukkit.Difficulty;
import org.bukkit.GameRules;
import org.bukkit.NamespacedKey;
import org.bukkit.World;
import org.bukkit.WorldCreator;
import org.bukkit.block.Biome;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

/**
 * Base Defense: el streamer defiende su base en primera persona de las hordas que envían los
 * espectadores con regalos. La app (LiveArena o similar) solo ejecuta comandos /tt* por RCON.
 *
 * <p>Una tarea central por tick reparte el trabajo: cola de spawn + detección de base (mobs),
 * jefes, armas (fuego automático y proyectiles), HUD y ambiente.
 */
@SuppressWarnings("UnstableApiUsage")
public final class BaseDefense extends JavaPlugin {
    public NamespacedKey mobKey, arenaKey, weaponKey, projKey;
    public Settings settings;
    public ArenaData arena;
    public Fx fx;
    public Game game;
    public Hud hud;
    public MobManager mobs;
    public Bosses bosses;
    public Weapons weapons;
    public Ambience ambience;
    public Waves waves;
    public Loot loot;
    public Alerts alerts;
    public dev.livearena.basedefense.game.Allies allies;
    public PackServer pack;
    public BlockPlacer placer;
    private BukkitTask loop;
    private long tick;
    private YamlConfiguration data;
    private LikeGoal likes;

    public LikeGoal likes() {
        return likes;
    }

    public long tick() {
        return tick;
    }

    @Override
    public void onEnable() {
        mobKey = new NamespacedKey(this, "mob");
        arenaKey = new NamespacedKey(this, "arena");
        weaponKey = new NamespacedKey(this, "arma");
        projKey = new NamespacedKey(this, "proyectil");
        saveDefaultConfig();
        // config.yml de la versión 1 (sin fases, sin minigun, jefes antiguos): se guarda aparte y se pone la nueva
        if (!getConfig().contains("oleadas")) {
            File cfg = new File(getDataFolder(), "config.yml");
            if (cfg.renameTo(new File(getDataFolder(), "config-v1.yml"))) {
                saveDefaultConfig();
                reloadConfig();
                getLogger().info("config.yml actualizada a la v2 (la anterior queda en config-v1.yml)");
            }
        }
        // añade al config.yml del servidor las claves nuevas de esta versión (conserva lo que el usuario cambió)
        getConfig().options().copyDefaults(true);
        saveConfig();
        settings = new Settings(getConfig(), getLogger());
        loadData();
        likes = new LikeGoal(this);
        arena = ArenaData.load(new File(getDataFolder(), "arena.yml"));
        placer = new BlockPlacer(this, arenaKey);
        fx = new Fx(this);
        hud = new Hud(this);
        mobs = new MobManager(this);
        bosses = new Bosses(this);
        weapons = new Weapons(this);
        waves = new Waves(this);
        loot = new Loot(this);
        alerts = new Alerts(this);
        allies = new dev.livearena.basedefense.game.Allies(this);
        pack = new PackServer(this);
        pack.start();
        game = new Game(this);
        ambience = new Ambience(this);
        getServer().getPluginManager().registerEvents(new Protection(this), this);
        getServer().getPluginManager().registerEvents(mobs, this);
        getServer().getPluginManager().registerEvents(weapons, this);
        getServer().getPluginManager().registerEvents(bosses, this);
        getServer().getPluginManager().registerEvents(game, this);
        getServer().getPluginManager().registerEvents(pack, this);
        getLifecycleManager().registerEventHandler(LifecycleEvents.COMMANDS, e -> new BdCommands(this).register(e.registrar()));
        World w = world(true);
        if (w != null) mobs.purgeStrays(w);
        loop = Bukkit.getScheduler().runTaskTimer(this, this::tickAll, 1L, 1L);
        getLogger().info("Base Defense listo. Arena " + (arena != null && arena.valid() ? "cargada" : "sin generar: usa /bd arena generate") + ".");
    }

    @Override
    public void onDisable() {
        if (loop != null) loop.cancel();
        placer.cancel();
        if (game != null) game.stop(false);
        if (pack != null) pack.stop();
        saveData();
    }

    private void tickAll() {
        tick++;
        fx.beginTick();
        try {
            mobs.tick();
            bosses.tick();
            weapons.tick();
            game.tick();
            waves.tick();
            loot.tick();
            if (tick % 20 == 0) alerts.tick();
            ambience.tick();
        } catch (Throwable t) {
            getLogger().log(java.util.logging.Level.SEVERE, "Error en el bucle de Base Defense", t);
        }
    }

    public void reload() {
        reloadConfig();
        settings = new Settings(getConfig(), getLogger());
        World w = world(false);
        if (w != null) applyWorldRules(w);
        weapons.refreshItems();
        pack.start();
        hud.refresh();
    }

    // ───────────────────────────── Mundo ─────────────────────────────

    public Biome biome() {
        Biome b = RegistryAccess.registryAccess().getRegistry(RegistryKey.BIOME).get(Settings.key(settings.biome));
        if (b == null) {
            getLogger().warning("Bioma " + settings.biome + " no existe; uso minecraft:pale_garden");
            b = Biome.PALE_GARDEN;
        }
        return b;
    }

    /** Mundo del juego; con create=true lo crea (vacío) si no existe. */
    public World world(boolean create) {
        World w = Bukkit.getWorld(settings.worldName);
        if (w == null && (create || new File(Bukkit.getWorldContainer(), settings.worldName).isDirectory())) {
            WorldCreator wc = new WorldCreator(settings.worldName).generator(new VoidGenerator(biome())).generateStructures(false);
            w = wc.createWorld();
        }
        if (w != null) {
            applyWorldRules(w);
            // marca del minijuego: el plugin LiveArena (cinemáticas, efectos survival) no actúa en este mundo
            w.getPersistentDataContainer().set(new NamespacedKey("basedefense", "juego"), org.bukkit.persistence.PersistentDataType.BYTE, (byte) 1);
        }
        return w;
    }

    public void applyWorldRules(World w) {
        w.setGameRule(GameRules.ADVANCE_TIME, false);
        w.setGameRule(GameRules.ADVANCE_WEATHER, false);
        w.setGameRule(GameRules.SPAWN_MOBS, false);
        w.setGameRule(GameRules.SPAWN_MONSTERS, false);
        w.setGameRule(GameRules.SPAWN_PATROLS, false);
        w.setGameRule(GameRules.SPAWN_PHANTOMS, false);
        w.setGameRule(GameRules.SPAWN_WANDERING_TRADERS, false);
        w.setGameRule(GameRules.SPAWN_WARDENS, false);
        w.setGameRule(GameRules.RAIDS, false);
        w.setGameRule(GameRules.MOB_GRIEFING, false);
        w.setGameRule(GameRules.FIRE_SPREAD_RADIUS_AROUND_PLAYER, 0);
        w.setGameRule(GameRules.RANDOM_TICK_SPEED, 0);
        w.setGameRule(GameRules.MOB_DROPS, false);
        w.setGameRule(GameRules.ENTITY_DROPS, false);
        w.setGameRule(GameRules.BLOCK_DROPS, false);
        w.setGameRule(GameRules.KEEP_INVENTORY, true);
        w.setGameRule(GameRules.FALL_DAMAGE, false);
        w.setGameRule(GameRules.SHOW_ADVANCEMENT_MESSAGES, false);
        w.setGameRule(GameRules.MAX_ENTITY_CRAMMING, 0);
        w.setGameRule(GameRules.TNT_EXPLODES, false);
        w.setGameRule(GameRules.PROJECTILES_CAN_BREAK_BLOCKS, false);
        w.setGameRule(GameRules.WATER_SOURCE_CONVERSION, false);
        w.setGameRule(GameRules.LOCATOR_BAR, false);
        w.setGameRule(GameRules.SPREAD_VINES, false);
        w.setGameRule(GameRules.SEND_COMMAND_FEEDBACK, false);
        w.setGameRule(GameRules.LOG_ADMIN_COMMANDS, false);
        w.setDifficulty(Difficulty.NORMAL);
        w.setTime(settings.time);
        w.setSpawnFlags(false, false);
        switch (settings.weather) {
            case "lluvia" -> { w.setStorm(true); w.setThundering(false); w.setWeatherDuration(Integer.MAX_VALUE); }
            case "tormenta" -> { w.setStorm(true); w.setThundering(true); w.setWeatherDuration(Integer.MAX_VALUE); w.setThunderDuration(Integer.MAX_VALUE); }
            default -> { w.setStorm(false); w.setThundering(false); w.setClearWeatherDuration(Integer.MAX_VALUE); }
        }
        if (arena != null && arena.valid()) w.setSpawnLocation(arena.spawn(w));
    }

    public boolean inGameWorld(org.bukkit.entity.Entity e) {
        return e.getWorld().getName().equals(settings.worldName);
    }

    public boolean inGameWorld(World w) {
        return w != null && w.getName().equals(settings.worldName);
    }

    public void saveArena(ArenaData a) {
        arena = a;
        try {
            a.save(new File(getDataFolder(), "arena.yml"));
        } catch (IOException e) {
            getLogger().warning("No se pudo guardar arena.yml: " + e);
        }
        World w = world(false);
        if (w != null) applyWorldRules(w);
    }

    // ─────────────────────── Datos persistentes ───────────────────────

    private void loadData() {
        File f = new File(getDataFolder(), "datos.yml");
        data = YamlConfiguration.loadConfiguration(f);
    }

    public YamlConfiguration data() {
        return data;
    }

    public void saveData() {
        if (data == null) return;
        try {
            data.save(new File(getDataFolder(), "datos.yml"));
        } catch (IOException e) {
            getLogger().warning("No se pudo guardar datos.yml: " + e);
        }
    }
}
