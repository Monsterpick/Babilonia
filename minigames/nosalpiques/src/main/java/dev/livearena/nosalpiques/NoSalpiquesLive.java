package dev.livearena.nosalpiques;

import dev.livearena.nosalpiques.cmd.NsCommands;
import dev.livearena.nosalpiques.fx.Fx;
import dev.livearena.nosalpiques.game.Effects;
import dev.livearena.nosalpiques.game.Game;
import dev.livearena.nosalpiques.game.Hud;
import dev.livearena.nosalpiques.game.Protection;
import dev.livearena.nosalpiques.game.TempBlocks;
import dev.livearena.nosalpiques.pack.PackServer;
import dev.livearena.nosalpiques.game.Monster;
import dev.livearena.nosalpiques.map.Builder;
import dev.livearena.nosalpiques.map.Rooms;
import io.papermc.paper.plugin.lifecycle.event.types.LifecycleEvents;
import java.io.File;
import java.io.IOException;
import org.bukkit.Bukkit;
import org.bukkit.Difficulty;
import org.bukkit.GameRules;
import org.bukkit.NamespacedKey;
import org.bukkit.World;
import org.bukkit.WorldCreator;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

/**
 * No Salpiques: salas de piscinas enormes y vacías. El streamer salta de plataforma en plataforma; si toca el agua, algo
 * despierta y le persigue. El público, con sus regalos, le ayuda a saltar o le empuja al agua (comandos /ttns por RCON).
 */
@SuppressWarnings("UnstableApiUsage")
public final class NoSalpiquesLive extends JavaPlugin {
    public Settings settings;
    public Builder builder;
    public Rooms rooms;
    public Monster monster;
    public Fx fx;
    public Game game;
    public Hud hud;
    public Effects effects;
    public TempBlocks temp;
    public PackServer pack;
    public NamespacedKey tagKey;
    private YamlConfiguration data;
    private BukkitTask loop;
    private long tick;

    public long tick() {
        return tick;
    }

    @Override
    public void onEnable() {
        tagKey = new NamespacedKey(this, "pieza");
        saveDefaultConfig();
        getConfig().options().copyDefaults(true);
        saveConfig();
        settings = new Settings(getConfig());
        data = YamlConfiguration.loadConfiguration(new File(getDataFolder(), "datos.yml"));
        fx = new Fx(this);
        temp = new TempBlocks(this);
        builder = new Builder(this);
        hud = new Hud(this);
        effects = new Effects(this);
        game = new Game(this);
        pack = new PackServer(this);
        pack.start();
        monster = new Monster(this);
        computeRooms();
        getServer().getPluginManager().registerEvents(new Protection(this), this);
        getServer().getPluginManager().registerEvents(game, this);
        getServer().getPluginManager().registerEvents(pack, this);
        getLifecycleManager().registerEventHandler(LifecycleEvents.COMMANDS, e -> new NsCommands(this).register(e.registrar()));
        loop = Bukkit.getScheduler().runTaskTimer(this, this::tickAll, 1L, 1L);
        // si las salas no están construidas (o cambió el mapa), se construyen al arrancar
        Bukkit.getScheduler().runTaskLater(this, () -> {
            if (!builder.isBuilt()) builder.rebuild(null);
            else world(true);
        }, 40L);
        getLogger().info("No Salpiques listo: " + settings.levels + " salas.");
    }

    @Override
    public void onDisable() {
        if (loop != null) loop.cancel();
        if (game != null) game.stop(false);
        if (monster != null) monster.sleep(false);
        if (temp != null) temp.restoreAll();
        if (pack != null) pack.stop();
        saveData();
    }

    private void tickAll() {
        // sin el streamer conectado el reloj de la partida no corre (una desconexión no gasta el tiempo límite)
        if (game.running() && game.player() == null) return;
        tick++;
        try {
            temp.tick();
            builder.tick();
            game.tick();
            effects.tick();
        } catch (Throwable t) {
            getLogger().log(java.util.logging.Level.SEVERE, "Error en el bucle de No Salpiques", t);
        }
    }

    /** Calcula el mapa (rápido y determinista: no toca el mundo). */
    public void computeRooms() {
        rooms = new Rooms(settings.seed, settings.levels, settings.difficulty);
    }

    public void reload() {
        reloadConfig();
        getConfig().options().copyDefaults(true);
        settings = new Settings(getConfig());
        pack.start();
        if (!game.running() && !builder.building() && !settings.mapSignature().equals(data.getString("mapa.firma", ""))) builder.rebuild(null);
        hud.refresh();
    }

    // ───────────────────────────── mundo ─────────────────────────────

    public World world(boolean create) {
        World w = Bukkit.getWorld(settings.worldName);
        if (w == null && (create || worldFolder().isDirectory())) {
            w = new WorldCreator(settings.worldName).generator(new VoidGenerator()).generateStructures(false).createWorld();
        }
        if (w != null) applyRules(w);
        return w;
    }

    /** Carpeta del mundo (en Paper 26 los mundos extra van en world/dimensions/minecraft/<nombre>). */
    public File worldFolder() {
        World w = Bukkit.getWorld(settings.worldName);
        if (w != null) return w.getWorldFolder();
        File container = Bukkit.getWorldContainer();
        File modern = new File(container, Bukkit.getWorlds().getFirst().getName() + "/dimensions/minecraft/" + settings.worldName);
        if (modern.isDirectory()) return modern;
        return new File(container, settings.worldName);
    }

    public void applyRules(World w) {
        w.setGameRule(GameRules.ADVANCE_TIME, false);
        w.setGameRule(GameRules.ADVANCE_WEATHER, false);
        w.setGameRule(GameRules.SPAWN_MOBS, false);
        w.setGameRule(GameRules.SPAWN_MONSTERS, false);
        w.setGameRule(GameRules.SPAWN_PATROLS, false);
        w.setGameRule(GameRules.SPAWN_PHANTOMS, false);
        w.setGameRule(GameRules.SPAWN_WANDERING_TRADERS, false);
        w.setGameRule(GameRules.SPAWN_WARDENS, false);
        w.setGameRule(GameRules.RANDOM_TICK_SPEED, 0);
        w.setGameRule(GameRules.FALL_DAMAGE, false);
        w.setGameRule(GameRules.KEEP_INVENTORY, true);
        w.setGameRule(GameRules.SHOW_ADVANCEMENT_MESSAGES, false);
        w.setGameRule(GameRules.MOB_GRIEFING, false);
        w.setGameRule(GameRules.FIRE_SPREAD_RADIUS_AROUND_PLAYER, 0);
        w.setGameRule(GameRules.SPREAD_VINES, false);
        w.setGameRule(GameRules.LOCATOR_BAR, false);
        w.setGameRule(GameRules.SEND_COMMAND_FEEDBACK, false);
        w.setGameRule(GameRules.LOG_ADMIN_COMMANDS, false);
        // EASY: en pacífico el juego borra al warden de la criatura (no aparece nada más: no hay spawns naturales)
        w.setDifficulty(Difficulty.EASY);
        w.setStorm(false);
        w.setThundering(false);
        w.setClearWeatherDuration(Integer.MAX_VALUE);
        w.setSpawnFlags(false, false);
        // el plugin LiveArena (cinemáticas, efectos de supervivencia) no actúa en los mundos de minijuegos
        w.getPersistentDataContainer().set(new NamespacedKey("basedefense", "juego"), org.bukkit.persistence.PersistentDataType.BYTE, (byte) 1);
        w.setSpawnLocation(new org.bukkit.Location(w, 1.5, Rooms.DECK + 1, Rooms.W / 2.0));
    }

    public boolean inWorld(org.bukkit.entity.Entity e) {
        return e.getWorld().getName().equals(settings.worldName);
    }

    // ───────────────────────────── datos ─────────────────────────────

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
