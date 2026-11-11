package dev.livearena.parkour.game;

import dev.livearena.parkour.ParkourLive;
import dev.livearena.parkour.tower.Theme;
import dev.livearena.parkour.tower.Themes;
import dev.livearena.parkour.tower.Tower;
import java.io.File;
import java.io.IOException;
import java.util.UUID;
import org.bukkit.Bukkit;
import org.bukkit.Color;
import org.bukkit.FireworkEffect;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;

/**
 * La partida: un solo jugador (el streamer) sube la torre. El checkpoint es el nivel cuya plataforma pisó por última
 * vez; si cae a un nivel inferior o al vacío vuelve al inicio de ese nivel. Los espectadores pueden cambiarle el
 * checkpoint (subir/bajar niveles). Llegar a la cima = ganada; acabarse el tiempo (si hay límite) = perdida.
 */
public final class Game implements Listener {
    private final ParkourLive plugin;
    private UUID streamer;
    private boolean running;
    private int checkpoint = 1;
    private int furthest = -1;
    private int falls, fallStreak;
    private long startedAt, wonAt = -1;
    private Location lastSafe;
    private long shieldUntil, protectedUntil, guideUntil;
    private int lastBlinkPhase = -1;
    private int lastTime = -1;
    private Location returnTo;
    private GameMode returnMode;
    private int returnLevel;
    private float returnExp;

    public Game(ParkourLive plugin) {
        this.plugin = plugin;
    }

    // ───────────────────────────── estado ─────────────────────────────

    public boolean running() {
        return running;
    }

    public Player player() {
        return streamer == null ? null : Bukkit.getPlayer(streamer);
    }

    public int checkpoint() {
        return checkpoint;
    }

    public int falls() {
        return falls;
    }

    public boolean celebrating() {
        return wonAt >= 0;
    }

    public int wins() {
        return plugin.data().getInt("ganadas", 0);
    }

    public int losses() {
        return plugin.data().getInt("perdidas", 0);
    }

    public void addWins(int n) {
        plugin.data().set("ganadas", Math.max(0, wins() + n));
        plugin.saveData();
    }

    public void addLosses(int n) {
        plugin.data().set("perdidas", Math.max(0, losses() + n));
        plugin.saveData();
    }

    public void resetScore() {
        plugin.data().set("ganadas", 0);
        plugin.data().set("perdidas", 0);
        plugin.saveData();
    }

    /** Segundos de partida. */
    public int seconds() {
        return running ? (int) ((plugin.tick() - startedAt) / 20) : 0;
    }

    /** Progreso dentro del nivel actual (0..1). */
    public double levelProgress() {
        int n = plugin.tower.steps(checkpoint).size();
        if (n == 0 || furthest < 0) return 0;
        return Math.min(1, (furthest + 1) / (double) (n + 1));
    }

    /** Progreso total de la torre (0..1). */
    public double totalProgress() {
        int lv = plugin.tower.levels;
        if (checkpoint > lv) return 1;
        return Math.min(1, (checkpoint - 1 + levelProgress()) / lv);
    }

    public Theme theme() {
        return Themes.of(Math.min(checkpoint, plugin.tower.levels));
    }

    public boolean shielded() {
        return plugin.tick() < shieldUntil;
    }

    public boolean isProtected() {
        return plugin.tick() < protectedUntil;
    }

    public void shield(int seconds) {
        shieldUntil = plugin.tick() + seconds * 20L;
    }

    public void guide(int seconds) {
        guideUntil = plugin.tick() + seconds * 20L;
    }

    public int furthest() {
        return furthest;
    }

    // ───────────────────────────── empezar / terminar ─────────────────────────────

    public String start(Player p) {
        if (plugin.builder.building()) return "la torre se está construyendo, espera unos segundos";
        if (!plugin.builder.isBuilt()) {
            plugin.builder.rebuild(() -> {
                Player again = Bukkit.getPlayer(p.getUniqueId());
                if (again != null) start(again);
            });
            return "construyendo la torre; la partida empieza al terminar";
        }
        World w = plugin.world(true);
        if (running && streamer != null && !streamer.equals(p.getUniqueId())) stop(false);
        if (!running) {
            returnTo = p.getLocation();
            returnMode = p.getGameMode();
            returnLevel = p.getLevel();
            returnExp = p.getExp();
            saveInventory(p);
        }
        streamer = p.getUniqueId();
        running = true;
        p.getInventory().clear();
        p.setGameMode(GameMode.ADVENTURE);
        heal(p);
        newRun(p, w);
        plugin.pack.send(p);
        plugin.hud.show(p);
        return "partida iniciada · " + p.getName();
    }

    private void newRun(Player p, World w) {
        checkpoint = 1;
        furthest = -1;
        falls = 0;
        fallStreak = 0;
        wonAt = -1;
        shieldUntil = protectedUntil = guideUntil = 0;
        startedAt = plugin.tick();
        plugin.temp.restoreAll();
        Tower.Pad pad = plugin.tower.pad(1);
        p.teleport(pad.spawn(w, plugin.tower.yawAt(1)));
        p.setVelocity(new org.bukkit.util.Vector());
        setTime(w, theme().time(), true);
        plugin.hud.levelTitle(p, 1, true);
        plugin.fx.sound(p, "parkour:nivel", Sound.BLOCK_BEACON_ACTIVATE, 1f, 1f);
    }

    public void stop(boolean announce) {
        Player p = player();
        running = false;
        wonAt = -1;
        plugin.effects.clear();
        plugin.temp.restoreAll();
        if (p != null) {
            plugin.hud.hide(p);
            plugin.pack.remove(p);
            for (PotionEffectType t : new PotionEffectType[] {PotionEffectType.NIGHT_VISION, PotionEffectType.JUMP_BOOST, PotionEffectType.SLOWNESS, PotionEffectType.DARKNESS, PotionEffectType.SLOW_FALLING})
                p.removePotionEffect(t);
            restoreInventory(p);
            p.setLevel(returnLevel);
            p.setExp(returnExp);
            if (returnMode != null) p.setGameMode(returnMode);
            if (returnTo != null && returnTo.getWorld() != null && !returnTo.getWorld().getName().equals(plugin.settings.worldName)) p.teleport(returnTo);
            else p.teleport(Bukkit.getWorlds().getFirst().getSpawnLocation());
        }
        streamer = null;
    }

    private void heal(Player p) {
        var hp = p.getAttribute(org.bukkit.attribute.Attribute.MAX_HEALTH);
        p.setHealth(hp != null ? hp.getValue() : 20);
        p.setFoodLevel(20);
        p.setSaturation(20);
        p.setFireTicks(0);
    }

    // ───────────────────────────── nivel ─────────────────────────────

    /** Pone el checkpoint en level y lleva al jugador al inicio de ese nivel (efectos de subir/bajar). */
    public void setCheckpoint(int level, boolean teleport) {
        Player p = player();
        int max = plugin.tower.levels + 1;
        int lv = Math.max(1, Math.min(max, level));
        int before = checkpoint;
        checkpoint = lv;
        furthest = -1;
        fallStreak = 0;
        if (p == null) return;
        World w = p.getWorld();
        if (teleport) {
            Tower.Pad pad = plugin.tower.pad(lv);
            p.teleport(pad.spawn(w, lv > plugin.tower.levels ? p.getYaw() : plugin.tower.yawAt(lv)));
            p.setVelocity(new org.bukkit.util.Vector());
            p.setFallDistance(0);
        }
        if (lv > plugin.tower.levels) {
            win(p);
            return;
        }
        if (lv != before) {
            setTime(w, theme().time(), false);
            plugin.hud.levelTitle(p, lv, lv > before);
        }
        plugin.hud.update();
    }

    private void levelUp(Player p, int lv) {
        checkpoint = lv;
        furthest = -1;
        fallStreak = 0;
        Tower.Pad pad = plugin.tower.pad(lv);
        Location c = new Location(p.getWorld(), pad.x() + 0.5, pad.y() + 1.1, pad.z() + 0.5);
        if (lv > plugin.tower.levels) {
            win(p);
            return;
        }
        Theme th = theme();
        // checkpoint: anillo de luz, fuego artificial del color del nuevo bioma y campanilla
        plugin.fx.firework(c.clone().add(0, 1.5, 0), th.color(), Color.WHITE, FireworkEffect.Type.BALL_LARGE, 0);
        for (int i = 0; i < 3; i++) {
            int k = i;
            Bukkit.getScheduler().runTaskLater(plugin, () -> plugin.fx.ring(c.clone().add(0, 0.1 + k * 0.6, 0), th.color(), 1.6 + k * 0.5, 40, 1.6f), i * 3L);
        }
        plugin.fx.particle(c, Particle.TOTEM_OF_UNDYING, 40, 0.6, 0.35);
        plugin.fx.sound(p, "parkour:checkpoint", Sound.ENTITY_PLAYER_LEVELUP, 1f, 1.2f);
        setTime(p.getWorld(), th.time(), false);
        plugin.hud.levelTitle(p, lv, true);
        plugin.hud.update();
    }

    private void win(Player p) {
        if (wonAt >= 0) return;
        wonAt = plugin.tick();
        addWins(1);
        checkpoint = plugin.tower.levels + 1;
        plugin.hud.win(p);
        plugin.fx.sound(p, "parkour:cima", Sound.UI_TOAST_CHALLENGE_COMPLETE, 1f, 1f);
        Location top = p.getLocation();
        for (int i = 0; i < 14; i++) {
            int k = i;
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                double a = k * 0.9;
                Location l = top.clone().add(Math.cos(a) * 4, 1, Math.sin(a) * 4);
                Color c1 = Color.fromRGB(Themes.of(1 + plugin.fx.rnd().nextInt(50)).rgb());
                plugin.fx.firework(l, c1, Color.fromRGB(0xFFD700), k % 3 == 0 ? FireworkEffect.Type.STAR : FireworkEffect.Type.BALL_LARGE, 1);
                plugin.fx.particle(top.clone().add(0, 1, 0), Particle.TOTEM_OF_UNDYING, 30, 1.2, 0.4);
            }, i * 8L);
        }
        plugin.hud.update();
    }

    private void lose(Player p, String why) {
        addLosses(1);
        plugin.hud.lose(p, why);
        plugin.fx.sound(p, "parkour:perder", Sound.ENTITY_WITHER_DEATH, 0.6f, 1.2f);
        newRun(p, p.getWorld());
    }

    /** Caída: al inicio del nivel del checkpoint (o donde estaba, si tiene escudo). */
    private void fall(Player p) {
        World w = p.getWorld();
        Location from = p.getLocation();
        plugin.fx.particle(from, Particle.CLOUD, 20, 0.4, 0.05);
        if (shielded() && lastSafe != null) {
            shieldUntil = 0;
            p.teleport(lastSafe);
            p.setVelocity(new org.bukkit.util.Vector());
            p.setFallDistance(0);
            plugin.fx.spiral(lastSafe.clone().add(0, -0.2, 0), Color.fromRGB(0xFF7BE5), true, 2.2, 2, Particle.END_ROD);
            plugin.fx.sound(p, "parkour:escudo", Sound.ITEM_SHIELD_BLOCK, 1f, 1.2f);
            plugin.hud.flash(p, "&d🛡 ¡El escudo te salvó!");
            return;
        }
        falls++;
        fallStreak++;
        Tower.Pad pad = plugin.tower.pad(checkpoint);
        Location to = pad.spawn(w, plugin.tower.yawAt(checkpoint));
        p.teleport(to);
        p.setVelocity(new org.bukkit.util.Vector());
        p.setFallDistance(0);
        furthest = -1;
        plugin.fx.spiral(to.clone().add(0, -0.2, 0), theme().color(), true, 2.4, 2, Particle.WAX_ON);
        plugin.fx.sound(p, "parkour:caida", Sound.ENTITY_ENDERMAN_TELEPORT, 0.8f, 0.8f);
        if (plugin.settings.protectFalls > 0 && fallStreak >= plugin.settings.protectFalls && !isProtected()) {
            protectedUntil = plugin.tick() + plugin.settings.protectS * 20L;
            fallStreak = 0;
            plugin.hud.flash(p, "&a✚ Protegido " + plugin.settings.protectS + " s: sin sabotajes");
        }
        plugin.hud.update();
    }

    // ───────────────────────────── bucle ─────────────────────────────

    public void tick() {
        blinks();
        if (!running) return;
        Player p = player();
        if (p == null || !plugin.inWorld(p)) return;
        long now = plugin.tick();
        if (p.getFoodLevel() < 20) p.setFoodLevel(20);
        // celebración en la cima
        if (wonAt >= 0) {
            if (now % 10 == 0) plugin.fx.particle(p.getLocation().add(0, 1, 0), Particle.END_ROD, 6, 1.5, 0.05);
            if (plugin.settings.restartOnWin && now - wonAt > plugin.settings.celebrateSeconds * 20L) newRun(p, p.getWorld());
            return;
        }
        Tower t = plugin.tower;
        Location l = p.getLocation();
        // plataformas: llegar a una de un nivel superior = checkpoint
        for (int lv = checkpoint + 1; lv <= Math.min(t.levels + 1, checkpoint + 3); lv++) {
            if (t.pad(lv).contains(l.getX(), l.getY(), l.getZ()) && p.isOnGround()) {
                levelUp(p, lv);
                return;
            }
        }
        Tower.Pad cur = t.pad(checkpoint);
        if (l.getY() < cur.y() - 30 || l.getY() < t.minY - 12) {
            fall(p);
            return;
        }
        if (p.isOnGround()) {
            Block under = l.clone().add(0, -0.2, 0).getBlock();
            long k = Tower.key(under.getX(), under.getY(), under.getZ());
            Integer lvOf = t.levelOf.get(k);
            if (lvOf == null && under.getType() == Material.AIR) {
                under = l.clone().add(0, -0.7, 0).getBlock();
                k = Tower.key(under.getX(), under.getY(), under.getZ());
                lvOf = t.levelOf.get(k);
            }
            if (lvOf != null && lvOf < checkpoint) {
                fall(p);
                return;
            }
            if (lvOf == null && l.getY() < cur.y() - 2.5) {
                fall(p);
                return;
            }
            Tower.Step s = t.stepAt.get(k);
            if (s != null && s.level() == checkpoint && s.index() > furthest) {
                furthest = s.index();
                if (s.index() % 3 == 2) plugin.fx.sound(l, Sound.BLOCK_NOTE_BLOCK_CHIME, 0.4f, 0.8f + furthest * 0.06f);
            }
            if (lvOf != null && lvOf >= checkpoint) {
                lastSafe = l.clone();
                if (fallStreak > 0 && s != null && s.index() >= 2) fallStreak = 0;
            }
        }
        // ambiente del bioma, guía y faro de la siguiente plataforma
        if (now % 4 == 0) {
            Theme th = theme();
            plugin.fx.ambient(th, l.clone().add(0, 1.5, 0), 3, 3.5);
            if (now % 12 == 0) beacon(p, t.pad(checkpoint + 1), th);
        }
        if (now < guideUntil && now % 5 == 0) guidePath(p);
        if (plugin.settings.nightVision && now % 40 == 0) {
            int time = theme().time();
            boolean dark = time > 12800 && time < 23200;
            if (dark) p.addPotionEffect(new PotionEffect(PotionEffectType.NIGHT_VISION, 400, 0, true, false, false));
            else p.removePotionEffect(PotionEffectType.NIGHT_VISION);
        }
        if (theme().name().equals("Torre de Tormenta") && now % 90 == 0 && plugin.fx.rnd().nextInt(3) == 0) {
            double a = plugin.fx.rnd().nextDouble() * Math.PI * 2;
            p.getWorld().strikeLightningEffect(l.clone().add(Math.cos(a) * 22, -4, Math.sin(a) * 22));
        }
        // límite de tiempo
        if (plugin.settings.timeLimitMin > 0 && seconds() >= plugin.settings.timeLimitMin * 60) {
            lose(p, "¡SE ACABÓ EL TIEMPO!");
            return;
        }
        if (now % 5 == 0) plugin.hud.update();
    }

    /** Columna de luz sobre la plataforma a la que hay que llegar. */
    private void beacon(Player p, Tower.Pad pad, Theme th) {
        Location c = new Location(p.getWorld(), pad.x() + 0.5, pad.y() + 1.2, pad.z() + 0.5);
        for (int i = 0; i < 6; i++) plugin.fx.dust(c.clone().add(0, i * 0.7, 0), th.color(), 1.6f, 1, 0.05);
        plugin.fx.particle(c.clone().add(0, 4.5, 0), Particle.END_ROD, 2, 0.15, 0.02);
    }

    private void guidePath(Player p) {
        var steps = plugin.tower.steps(checkpoint);
        Location prev = p.getLocation().add(0, 0.2, 0);
        int from = Math.max(0, furthest + 1);
        Color c = Color.fromRGB(0xFFE066);
        for (int i = from; i < Math.min(steps.size(), from + 6); i++) {
            Tower.Step s = steps.get(i);
            Location at = new Location(p.getWorld(), s.x() + 0.5, s.y() + 1.15, s.z() + 0.5);
            plugin.fx.line(prev, at, c, 0.5, 0.8f);
            plugin.fx.ring(at, c, 0.45, 10, 1f);
            prev = at;
        }
    }

    /** Bloques que aparecen y desaparecen cada 2 s (en grupos alternos). */
    private void blinks() {
        Tower t = plugin.tower;
        if (t == null || t.blinks.isEmpty() || plugin.builder.building()) return;
        int phase = (int) ((plugin.tick() / 40) % 2);
        if (phase == lastBlinkPhase) {
            // aviso: chispas medio segundo antes de que desaparezcan
            if (plugin.tick() % 40 == 30 && running) {
                World w = plugin.world(false);
                Player p = player();
                if (w != null && p != null)
                    for (Tower.Blink b : t.blinks)
                        if (b.phase() == phase && Math.abs(b.y() - p.getLocation().getY()) < 12)
                            plugin.fx.particle(new Location(w, b.x() + 0.5, b.y() + 1.05, b.z() + 0.5), Particle.ELECTRIC_SPARK, 4, 0.3, 0.02);
            }
            return;
        }
        lastBlinkPhase = phase;
        World w = plugin.world(false);
        if (w == null) return;
        for (Tower.Blink b : t.blinks) {
            if (plugin.temp.changed(b.x(), b.y(), b.z())) continue;
            boolean on = b.phase() == phase;
            w.getBlockAt(b.x(), b.y(), b.z()).setBlockData(on ? b.data() : Material.AIR.createBlockData(), false);
        }
    }

    /** Cambio de hora suave al pasar a otro bioma. */
    private void setTime(World w, int target, boolean instant) {
        if (instant || lastTime < 0) {
            w.setTime(target);
            lastTime = target;
            return;
        }
        long from = w.getTime();
        long diff = Math.floorMod(target - from, 24000L);
        if (diff > 12000) diff -= 24000;
        long d = diff;
        lastTime = target;
        for (int i = 1; i <= 20; i++) {
            int k = i;
            Bukkit.getScheduler().runTaskLater(plugin, () -> w.setTime(Math.floorMod(from + d * k / 20, 24000L)), i * 2L);
        }
    }

    // ───────────────────────────── inventario ─────────────────────────────

    private File invFile(UUID id) {
        return new File(plugin.getDataFolder(), "inventarios/" + id + ".yml");
    }

    private void saveInventory(Player p) {
        YamlConfiguration y = new YamlConfiguration();
        y.set("items", p.getInventory().getContents());
        File f = invFile(p.getUniqueId());
        f.getParentFile().mkdirs();
        try {
            y.save(f);
        } catch (IOException e) {
            plugin.getLogger().warning("No se pudo guardar el inventario: " + e);
        }
    }

    private void restoreInventory(Player p) {
        File f = invFile(p.getUniqueId());
        if (!f.isFile()) return;
        YamlConfiguration y = YamlConfiguration.loadConfiguration(f);
        Object raw = y.get("items");
        if (raw instanceof java.util.List<?> list) {
            ItemStack[] items = new ItemStack[p.getInventory().getSize()];
            for (int i = 0; i < Math.min(items.length, list.size()); i++) if (list.get(i) instanceof ItemStack it) items[i] = it;
            p.getInventory().setContents(items);
        }
        f.delete();
    }

    // ───────────────────────────── eventos ─────────────────────────────

    @EventHandler
    public void onJoin(PlayerJoinEvent e) {
        Player p = e.getPlayer();
        if (running && p.getUniqueId().equals(streamer)) {
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                World w = plugin.world(true);
                p.teleport(plugin.tower.pad(checkpoint).spawn(w, plugin.tower.yawAt(checkpoint)));
                p.setGameMode(GameMode.ADVENTURE);
                plugin.pack.send(p);
                plugin.hud.show(p);
            }, 10L);
        }
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent e) {
        if (running && e.getPlayer().getUniqueId().equals(streamer)) plugin.hud.hide(e.getPlayer());
    }
}
