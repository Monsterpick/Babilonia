package dev.livearena.parkour;

import dev.livearena.parkour.cmd.PkCommands;
import dev.livearena.parkour.fx.Fx;
import dev.livearena.parkour.game.Effects;
import dev.livearena.parkour.game.Game;
import dev.livearena.parkour.game.Hud;
import dev.livearena.parkour.game.Protection;
import dev.livearena.parkour.game.TempBlocks;
import dev.livearena.parkour.pack.PackServer;
import dev.livearena.parkour.tower.Builder;
import dev.livearena.parkour.tower.Tower;
import dev.livearena.parkour.tower.TowerGen;
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
 * Parkour LIVE: una torre de 50 niveles (cada uno con su bioma) que el streamer sube en directo mientras el chat, con
 * sus regalos, le sube o le baja de nivel, le empuja o le pone trampas. La app solo manda comandos /ttpk por RCON.
 */
@SuppressWarnings("UnstableApiUsage")
public final class ParkourLive extends JavaPlugin {
    public Settings settings;
    public Tower tower;
    public Builder builder;
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
        computeTower();
        getServer().getPluginManager().registerEvents(new Protection(this), this);
        getServer().getPluginManager().registerEvents(game, this);
        getServer().getPluginManager().registerEvents(pack, this);
        getLifecycleManager().registerEventHandler(LifecycleEvents.COMMANDS, e -> new PkCommands(this).register(e.registrar()));
        loop = Bukkit.getScheduler().runTaskTimer(this, this::tickAll, 1L, 1L);
        // si la torre no está construida (o la config cambió), se construye al arrancar
        Bukkit.getScheduler().runTaskLater(this, () -> {
            if (!builder.isBuilt()) builder.rebuild(null);
            else world(true);
        }, 40L);
        getLogger().info("Parkour LIVE listo: torre de " + settings.levels + " niveles.");
    }

    @Override
    public void onDisable() {
        if (loop != null) loop.cancel();
        if (game != null) game.stop(false);
        if (temp != null) temp.restoreAll();
        if (pack != null) pack.stop();
        saveData();
    }

    private void tickAll() {
        tick++;
        try {
            temp.tick();
            builder.tick();
            game.tick();
            effects.tick();
        } catch (Throwable t) {
            getLogger().log(java.util.logging.Level.SEVERE, "Error en el bucle de Parkour LIVE", t);
        }
    }

    /** Calcula la torre (rápido y determinista: no toca el mundo). */
    public void computeTower() {
        tower = TowerGen.generate(settings.seed, new TowerGen.Options(settings.levels, settings.baseY, settings.rise, settings.radius, settings.difficulty));
    }

    public void reload() {
        reloadConfig();
        getConfig().options().copyDefaults(true);
        settings = new Settings(getConfig());
        pack.start();
        // La torre en memoria debe ser siempre la que está construida en el mundo: si los ajustes la cambian con una
        // partida en marcha, se deja la actual y la nueva se construye al terminar (al arrancar o con «Nuevo mapa»).
        String built = data.getString("torre.firma", "");
        if (!built.equals(settings.towerSignature())) {
            if (!game.running() && !builder.building()) builder.rebuild(null);
        }
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
        w.setDifficulty(Difficulty.PEACEFUL);
        w.setStorm(false);
        w.setThundering(false);
        w.setClearWeatherDuration(Integer.MAX_VALUE);
        w.setSpawnFlags(false, false);
        // el plugin LiveArena (cinemáticas, efectos de supervivencia) no actúa en los mundos de minijuegos
        w.getPersistentDataContainer().set(new NamespacedKey("basedefense", "juego"), org.bukkit.persistence.PersistentDataType.BYTE, (byte) 1);
        if (tower != null) w.setSpawnLocation(tower.pad(1).spawn(w, tower.yawAt(1)));
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
