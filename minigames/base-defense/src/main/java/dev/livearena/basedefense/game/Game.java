package dev.livearena.basedefense.game;

import dev.livearena.basedefense.BaseDefense;
import dev.livearena.basedefense.mob.GameMob;
import dev.livearena.basedefense.util.Txt;
import java.io.File;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import net.kyori.adventure.title.Title;
import org.bukkit.Bukkit;
import org.bukkit.Color;
import org.bukkit.FireworkEffect;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.World;
import org.bukkit.attribute.Attribute;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Firework;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.ItemStack;

/** Partida: rondas con cuenta atrás, vida de la base, victorias persistentes y el streamer. */
public final class Game implements Listener {
    private final BaseDefense plugin;
    private boolean running;
    private UUID streamer;
    private int round = 1;
    private int ticksLeft;
    private double baseHp;
    private long pausedUntil;
    private long lastHitFx;
    private long roundStartedTick;

    public Game(BaseDefense plugin) {
        this.plugin = plugin;
        this.baseHp = plugin.settings.baseHealth;
    }

    public boolean running() {
        return running;
    }

    public boolean paused() {
        return plugin.tick() < pausedUntil;
    }

    public int round() {
        return round;
    }

    public int secondsLeft() {
        return (ticksLeft + 19) / 20;
    }

    public double baseHp() {
        return baseHp;
    }

    public int baseMax() {
        return plugin.settings.baseHealth;
    }

    /** Rondas sobrevividas (se cuentan solas: la ronda llega a 0 con la base en pie). */
    public int wins() {
        migrateScore();
        return plugin.data().getInt("ganadas", 0);
    }

    /** Bases destruidas (se cuentan solas al caer la base). */
    public int losses() {
        migrateScore();
        return plugin.data().getInt("perdidas", 0);
    }

    /** Balance (compatibilidad con la v3: ganadas − perdidas). */
    public int victories() {
        return wins() - losses();
    }

    /** La v3 guardaba un único número (+1 al ganar, −1 al perder): se reparte en ganadas/perdidas. */
    private void migrateScore() {
        var d = plugin.data();
        if (d.contains("ganadas") || d.contains("perdidas")) return;
        int v = d.getInt("victorias", 0);
        d.set("ganadas", Math.max(0, v));
        d.set("perdidas", Math.max(0, -v));
        d.set("victorias", null);
    }

    public void addWins(int n) {
        plugin.data().set("ganadas", Math.max(0, wins() + n));
        plugin.saveData();
        plugin.hud.update();
    }

    public void addLosses(int n) {
        plugin.data().set("perdidas", Math.max(0, losses() + n));
        plugin.saveData();
        plugin.hud.update();
    }

    public void resetScore() {
        plugin.data().set("ganadas", 0);
        plugin.data().set("perdidas", 0);
        plugin.saveData();
        plugin.hud.update();
    }

    public UUID streamerId() {
        return streamer;
    }

    public Player streamer() {
        return streamer == null ? null : Bukkit.getPlayer(streamer);
    }

    /** Quien ve el HUD y los carteles: todos los jugadores del mundo del juego. */
    public List<Player> viewers() {
        World w = plugin.world(false);
        List<Player> out = new ArrayList<>();
        if (w != null) out.addAll(w.getPlayers());
        Player s = streamer();
        if (s != null && !out.contains(s)) out.add(s);
        return out;
    }

    // ───────────────────────────── INICIO / FIN ─────────────────────────────

    /** Devuelve null si arrancó, o el motivo del error. */
    public String start(Player who) {
        if (running) return "el juego ya está en marcha";
        if (plugin.placer.busy()) return "la arena se está generando, espera a que termine";
        if (plugin.arena == null || !plugin.arena.valid()) return "no hay arena: usa /bd arena generate";
        if (who == null) return "no hay ningún jugador conectado para defender la base";
        // la arena es de otro tamaño que el de la config (p. ej. de la versión anterior): se reconstruye sola
        if (plugin.data().getInt("arenaLargo", -1) != plugin.settings.length || plugin.data().getInt("arenaAncho", -1) != plugin.settings.width) {
            Bukkit.dispatchCommand(Bukkit.getConsoleSender(), "bd arena regen");
            return "la arena se está reconstruyendo con el tamaño nuevo (" + plugin.settings.length + " bloques); espera unos segundos y vuelve a pulsar Iniciar";
        }
        World w = plugin.world(true);
        streamer = who.getUniqueId();
        plugin.data().set("streamer", streamer.toString());
        running = true;
        round = 1;
        ticksLeft = plugin.settings.roundSeconds * 20;
        baseHp = plugin.settings.baseHealth;
        roundStartedTick = plugin.tick();
        plugin.mobs.kills = 0;
        plugin.mobs.purgeStrays(w);
        tickets(w, true);
        prepare(who, true);
        plugin.waves.reset();
        plugin.loot.resetGoal();
        plugin.threat.reset();
        plugin.pack.send(who);
        plugin.hud.show();
        banner("&c&lBASE DEFENSE", "&7¡Defiende la base! &eRonda 1", Sound.EVENT_RAID_HORN, 1f);
        plugin.getLogger().info("Partida iniciada por " + who.getName());
        return null;
    }

    /** Lleva al streamer a la base con sus armas. saveInv=true guarda su inventario de antes. */
    public void prepare(Player p, boolean saveInv) {
        World w = plugin.world(true);
        if (saveInv && !plugin.inGameWorld(p)) saveInventory(p);
        p.teleport(plugin.arena.spawn(w));
        p.setGameMode(GameMode.ADVENTURE);
        var max = p.getAttribute(Attribute.MAX_HEALTH);
        p.setHealth(max == null ? 20 : max.getValue());
        p.setFoodLevel(20);
        p.setSaturation(20);
        p.setFireTicks(0);
        p.setFallDistance(0);
        p.setAllowFlight(false);
        p.getInventory().clear();
        plugin.weapons.give(p);
        plugin.hud.attach(p);
    }

    public void stop(boolean announce) {
        if (!running) return;
        running = false;
        pausedUntil = 0;
        World w = plugin.world(false);
        if (w != null) tickets(w, false);
        plugin.mobs.removeAll(false);
        plugin.mobs.clearQueue();
        plugin.bosses.removeAllBalls();
        plugin.weapons.clearProjectiles();
        plugin.fx.clearStains();
        plugin.loot.clear();
        plugin.allies.clear();
        plugin.hud.hide();
        Player p = streamer();
        if (p != null) {
            restoreInventory(p);
            plugin.pack.remove(p);
        }
        plugin.saveData();
        if (announce) plugin.getLogger().info("Partida detenida.");
    }

    /** Mantiene cargados los chunks de la arena durante la partida (los mobs del portal siguen vivos
     *  aunque la distancia de visión del servidor sea corta). */
    private void tickets(World w, boolean add) {
        if (plugin.arena == null || plugin.arena.bounds == null) return;
        var b = plugin.arena.bounds;
        for (int cx = (int) Math.floor(b.getMinX()) >> 4; cx <= (int) Math.floor(b.getMaxX()) >> 4; cx++)
            for (int cz = (int) Math.floor(b.getMinZ()) >> 4; cz <= (int) Math.floor(b.getMaxZ()) >> 4; cz++) {
                if (add) w.addPluginChunkTicket(cx, cz, plugin);
                else w.removePluginChunkTicket(cx, cz, plugin);
            }
    }

    // ───────────────────────────── TICK ─────────────────────────────

    public void tick() {
        if (!running) return;
        long now = plugin.tick();
        if (!paused()) {
            ticksLeft--;
            if (ticksLeft <= 0) roundWon();
            else if (ticksLeft <= 200 && ticksLeft % 20 == 0) {
                Player p = streamer();
                if (p != null) p.playSound(p.getLocation(), Sound.BLOCK_NOTE_BLOCK_HAT, 1f, 1.6f);
            }
        }
        if (now % 10 == 0) confine();
        plugin.hud.tick();
    }

    /** El streamer no puede salir de la plataforma (ni caer al carril o al vacío). */
    private void confine() {
        Player p = streamer();
        if (p == null || plugin.arena == null || plugin.arena.platform == null) return;
        if (!plugin.inGameWorld(p)) return;
        if (p.getGameMode() == GameMode.CREATIVE || p.getGameMode() == GameMode.SPECTATOR) return;
        Location l = p.getLocation();
        if (!plugin.arena.platform.clone().expand(0.6, 2, 0.6).contains(l.toVector())) {
            Location back = plugin.arena.spawn(p.getWorld());
            back.setYaw(l.getYaw());
            back.setPitch(l.getPitch());
            p.teleport(back);
            p.setFallDistance(0);
        }
    }

    // ───────────────────────────── BASE ─────────────────────────────

    public void damageBase(double amount, GameMob from) {
        if (!running || amount <= 0 || paused()) return;
        baseHp -= amount;
        long now = plugin.tick();
        Player p = streamer();
        // golpes pequeños (asedio) con efecto como mucho cada 1,2 s; los grandes siempre
        if (p != null && now - lastHitFx > (amount < 20 ? 24 : 6)) {
            lastHitFx = now;
            p.playSound(p.getLocation(), Sound.BLOCK_ANVIL_LAND, 0.6f, 0.6f);
            p.playSound(p.getLocation(), Sound.ENTITY_PLAYER_HURT, 0.9f, 0.8f);
            // destello rojo breve: viñeta de borde del mundo + partículas en la puerta
            redFlash(8);
            if (amount >= 40) shake();
            Location gate = plugin.arena.baseCenter().toLocation(p.getWorld());
            plugin.fx.particle(gate, Particle.DUST, 30, 3, 1, 1, 0, new Particle.DustOptions(Color.RED, 2f), true);
        }
        plugin.hud.update();
        if (baseHp <= 0) baseFallen();
    }

    /** Pantalla teñida de rojo durante unos ticks. */
    public void redFlash(int ticks) {
        Player p = streamer();
        if (p == null) return;
        p.setWorldBorder(redFlash(p));
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            Player q = streamer();
            if (q != null) q.setWorldBorder(null);
        }, ticks);
    }

    /** Sacudida de cámara (la animación de daño del jugador, sin daño). */
    public void shake() {
        Player p = streamer();
        if (p != null) p.playHurtAnimation(plugin.fx.rnd().nextFloat() * 360);
    }

    /** Un borde de mundo diminuto y lejano tiñe la pantalla de rojo (efecto de daño). */
    private org.bukkit.WorldBorder redFlash(Player p) {
        org.bukkit.WorldBorder b = Bukkit.createWorldBorder();
        b.setCenter(p.getLocation());
        b.setSize(59_000_000);
        b.setWarningDistance(Integer.MAX_VALUE);
        return b;
    }

    public void heal(double amount) {
        baseHp = Math.min(plugin.settings.baseHealth, baseHp + amount);
        plugin.hud.update();
        Player p = streamer();
        if (p != null) {
            Location gate = plugin.arena.baseCenter().toLocation(p.getWorld());
            plugin.fx.particle(gate.add(0, 2, 0), Particle.HAPPY_VILLAGER, 50, 4, 1.5, 1.5, 0, null, true);
            plugin.fx.particle(p.getLocation().add(0, 1, 0), Particle.HEART, 8, 0.8, 0.5, 0.8, 0, null, true);
            p.playSound(p.getLocation(), Sound.BLOCK_BEACON_POWER_SELECT, 1f, 1.4f);
        }
    }

    private void baseFallen() {
        addLosses(1);
        int v = victories();
        plugin.saveData();
        World w = plugin.world(false);
        if (w != null) {
            Location gate = plugin.arena.baseCenter().toLocation(w);
            for (int i = 0; i < 5; i++) plugin.fx.explosion(gate.clone().add((i - 2) * 3, 1 + i % 2, 0), 6, true);
            plugin.fx.particle(gate, Particle.FLASH, 3, 0, 0, 0, 0, Color.RED, true);
            w.playSound(gate, Sound.ENTITY_GENERIC_EXPLODE, 6f, 0.5f);
            w.playSound(gate, Sound.ENTITY_WITHER_DEATH, 2f, 0.6f);
        }
        banner(plugin.settings.msg("baseCaidaTitulo"), plugin.settings.msg("baseCaidaSubtitulo"), Sound.ENTITY_LIGHTNING_BOLT_THUNDER, 0.6f, "victorias", v, "ganadas", wins(), "perdidas", losses());
        plugin.mobs.removeAll(true);
        plugin.bosses.removeAllBalls();
        if (plugin.settings.clearQueueOnFall) plugin.mobs.clearQueue();
        pausedUntil = plugin.tick() + plugin.settings.fallPause * 20L;
        baseHp = plugin.settings.baseHealth;
        ticksLeft = plugin.settings.roundSeconds * 20;
        roundStartedTick = plugin.tick();
        plugin.waves.reset(false);
        plugin.mobs.kills = 0;
        plugin.getLogger().info("BASE CAÍDA → " + wins() + "-" + losses());
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            if (running) banner("&6Ronda " + round, "&7¡La base vuelve a estar en pie!", Sound.EVENT_RAID_HORN, 1f);
        }, Math.max(1, plugin.settings.fallPause * 20L));
    }

    private void roundWon() {
        addWins(1);
        int v = victories();
        plugin.saveData();
        banner(plugin.settings.msg("rondaGanadaTitulo"), plugin.settings.msg("rondaGanadaSubtitulo"), Sound.UI_TOAST_CHALLENGE_COMPLETE, 1f, "victorias", v, "ganadas", wins(), "perdidas", losses());
        fireworks();
        if (plugin.settings.clearOnWin) {
            plugin.mobs.removeAll(true);
            plugin.bosses.removeAllBalls();
        }
        if (plugin.settings.healOnWin) baseHp = plugin.settings.baseHealth;
        round++;
        ticksLeft = plugin.settings.roundSeconds * 20;
        roundStartedTick = plugin.tick();
        plugin.waves.reset(false, false); // las armas desbloqueadas se conservan al ganar
        plugin.mobs.kills = 0;
        pausedUntil = plugin.tick() + 100;
    }

    private void fireworks() {
        World w = plugin.world(false);
        if (w == null) return;
        Location c = plugin.arena.spawn(w).add(0, 2, 6);
        for (int i = 0; i < 6; i++) {
            Location at = c.clone().add((i - 2.5) * 3, 0, i % 2 * 4);
            w.spawn(at, Firework.class, f -> {
                var m = f.getFireworkMeta();
                m.addEffect(FireworkEffect.builder().with(FireworkEffect.Type.BALL_LARGE).withColor(Color.YELLOW, Color.ORANGE, Color.LIME).withFade(Color.WHITE).trail(true).flicker(true).build());
                m.setPower(1);
                f.setFireworkMeta(m);
                f.setPersistent(false);
            });
        }
    }

    public void addVictories(int delta) {
        if (delta > 0) addWins(delta);
        else addLosses(-delta);
        plugin.hud.update();
    }

    public void onKill(GameMob gm) {
        plugin.alerts.onKill();
        plugin.loot.countKill();
        // reservado para estadísticas por donante
    }

    /** Fuerza la caída de la base (pruebas). */
    public void forceFall() {
        if (running) damageBase(baseHp + 1, null);
    }

    public void forceWin() {
        if (running) ticksLeft = 1;
    }

    public long roundStartedTick() {
        return roundStartedTick;
    }

    // ───────────────────────────── CARTELES ─────────────────────────────

    public void banner(String title, String subtitle, Sound sound, float pitch, Object... kv) {
        plugin.hud.banner(title, subtitle, kv);
        if (sound != null) for (Player p : viewers()) p.playSound(p.getLocation(), sound, 1f, pitch);
    }

    // ───────────────────────── INVENTARIO DEL STREAMER ─────────────────────────

    private File invFile(Player p) {
        return new File(plugin.getDataFolder(), "inventarios/" + p.getUniqueId() + ".yml");
    }

    private void saveInventory(Player p) {
        YamlConfiguration y = new YamlConfiguration();
        y.set("contenido", p.getInventory().getContents());
        y.set("lugar", p.getLocation());
        y.set("modo", p.getGameMode().name());
        try {
            File f = invFile(p);
            f.getParentFile().mkdirs();
            y.save(f);
        } catch (IOException e) {
            plugin.getLogger().warning("No se pudo guardar el inventario de " + p.getName() + ": " + e);
        }
    }

    private void restoreInventory(Player p) {
        File f = invFile(p);
        p.getInventory().clear();
        if (!f.isFile()) return;
        YamlConfiguration y = YamlConfiguration.loadConfiguration(f);
        List<?> list = y.getList("contenido");
        if (list != null) p.getInventory().setContents(list.stream().map(o -> o instanceof ItemStack i ? i : null).toArray(ItemStack[]::new));
        try {
            p.setGameMode(GameMode.valueOf(y.getString("modo", "SURVIVAL")));
        } catch (IllegalArgumentException ignored) {
        }
        Location back = y.getLocation("lugar");
        if (back != null && back.getWorld() != null) p.teleport(back);
        f.delete();
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent e) {
        Player p = e.getPlayer();
        if (running && p.getUniqueId().equals(streamer)) Bukkit.getScheduler().runTaskLater(plugin, () -> {
            if (running && p.isOnline()) prepare(p, false);
        }, 10L);
        else if (!running && invFile(p).isFile() && plugin.inGameWorld(p)) Bukkit.getScheduler().runTaskLater(plugin, () -> restoreInventory(p), 10L);
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent e) {
        plugin.hud.detach(e.getPlayer());
    }
}
