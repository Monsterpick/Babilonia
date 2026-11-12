package dev.livearena.dropper.game;

import dev.livearena.dropper.DropperLive;
import dev.livearena.dropper.map.Shaft;
import dev.livearena.dropper.map.Theme;
import dev.livearena.dropper.map.Themes;
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
import org.bukkit.util.BoundingBox;
import org.bukkit.util.Vector;

/**
 * La partida: un solo jugador (el streamer) cae nivel a nivel. Cada nivel empieza sobre un suelo de cristal que
 * desaparece tras una cuenta atrás; tocar el agua del fondo = siguiente nivel; tocar cualquier bloque = vuelve arriba
 * del mismo nivel. Pasar el último nivel suma una victoria. Si hay tiempo límite y se acaba, cuenta como perdida.
 */
public final class Game implements Listener {
    private final DropperLive plugin;
    private UUID streamer;
    private boolean running;
    private int level = 1;
    private int hits, levelHits, hitStreak;
    private long startedAt, wonAt = -1, releaseAt, levelStartedAt;
    private long shieldUntil, protectedUntil, guideUntil;
    private boolean released;
    private double lastY;
    private int lastTime = -1;
    private Location returnTo;
    private GameMode returnMode;
    private int returnLevel;
    private float returnExp;

    public Game(DropperLive plugin) {
        this.plugin = plugin;
    }

    // ───────────────────────────── estado ─────────────────────────────

    public boolean running() {
        return running;
    }

    public Player player() {
        return streamer == null ? null : Bukkit.getPlayer(streamer);
    }

    /** Nivel actual (levels + 1 = completado). */
    public int checkpoint() {
        return level;
    }

    /** Choques totales de la partida. */
    public int falls() {
        return hits;
    }

    public int levelHits() {
        return levelHits;
    }

    public boolean celebrating() {
        return wonAt >= 0;
    }

    public boolean released() {
        return released;
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

    public int seconds() {
        return running ? (int) ((plugin.tick() - startedAt) / 20) : 0;
    }

    /** Cuánto ha bajado en el nivel actual (0..1). */
    public double levelProgress() {
        Player p = player();
        if (p == null || level > plugin.settings.levels || !released) return 0;
        return plugin.builder.shaft(level).progress(p.getLocation().getY());
    }

    public double totalProgress() {
        int lv = plugin.settings.levels;
        if (level > lv) return 1;
        return Math.min(1, (level - 1 + levelProgress()) / lv);
    }

    public Theme theme() {
        return Themes.of(Math.min(level, plugin.settings.levels));
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

    // ───────────────────────────── empezar / terminar ─────────────────────────────

    public String start(Player p) {
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
        hits = 0;
        wonAt = -1;
        shieldUntil = protectedUntil = guideUntil = 0;
        startedAt = plugin.tick();
        plugin.temp.restoreAll();
        goLevel(p, 1, true, false);
        plugin.fx.sound(p, "dropper:nivel", Sound.BLOCK_BEACON_ACTIVATE, 1f, 1f);
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
            for (PotionEffectType t : new PotionEffectType[] {PotionEffectType.NIGHT_VISION, PotionEffectType.SLOW_FALLING, PotionEffectType.DARKNESS, PotionEffectType.BLINDNESS})
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

    // ───────────────────────────── niveles ─────────────────────────────

    /**
     * Lleva al jugador arriba del nivel lv sobre un suelo de cristal que desaparece tras la cuenta atrás.
     * retry: vuelve a empezar el mismo nivel tras un choque (cuenta atrás corta).
     */
    public void goLevel(Player p, int lv, boolean announce, boolean retry) {
        int max = plugin.settings.levels;
        lv = Math.max(1, Math.min(max + 1, lv));
        if (lv > max) {
            level = lv;
            win(p);
            return;
        }
        boolean changed = lv != level || !retry;
        level = lv;
        if (changed) {
            levelHits = 0;
            hitStreak = 0;
            levelStartedAt = plugin.tick();
        }
        plugin.builder.now(lv);
        plugin.builder.ahead(lv + 1, 3);
        World w = plugin.world(true);
        Shaft s = plugin.builder.shaft(lv);
        int count = retry ? Math.min(1, plugin.settings.countdown) : plugin.settings.countdown;
        long glass = count * 20L + 6;
        Material floor = Material.matchMaterial(theme().pad().name().contains("GLASS") ? "WHITE_STAINED_GLASS" : "LIGHT_BLUE_STAINED_GLASS");
        for (int x = 0; x < Shaft.S; x++)
            for (int z = 0; z < Shaft.S; z++)
                plugin.temp.set(w, s.x0() + x, s.topY() - 1, s.z0() + z, (floor == null ? Material.GLASS : floor).createBlockData(), glass);
        Location at = new Location(w, s.cx(), s.topY(), s.cz(), p.getLocation().getYaw(), 60f);
        p.teleport(at);
        p.setVelocity(new Vector());
        p.setFallDistance(0);
        released = false;
        releaseAt = plugin.tick() + glass;
        lastY = at.getY();
        setTime(w, theme().time(), !changed);
        p.addPotionEffect(new PotionEffect(PotionEffectType.NIGHT_VISION, 20 * 3600, 0, true, false, false));
        if (announce && changed) plugin.hud.levelTitle(p, lv, true);
        plugin.hud.update();
    }

    /** Lo usan los efectos de subir/bajar nivel. */
    public void setCheckpoint(int lv, boolean teleport) {
        Player p = player();
        if (p == null) return;
        int before = level;
        goLevel(p, lv, false, false);
        if (lv <= plugin.settings.levels) plugin.hud.levelTitle(p, level, level > before);
    }

    private void complete(Player p, Shaft s) {
        Location l = p.getLocation();
        Theme th = theme();
        hitStreak = 0;
        // chapuzón: salpicadura, anillos de agua y fuego artificial en la boca del tubo
        plugin.fx.particle(l.clone().add(0, 0.6, 0), Particle.SPLASH, 120, 1.2, 0.4);
        plugin.fx.particle(l.clone().add(0, 0.4, 0), Particle.BUBBLE_POP, 40, 1.0, 0.1);
        for (int i = 0; i < 5; i++) {
            int k = i;
            Bukkit.getScheduler().runTaskLater(plugin, () -> plugin.fx.ring(l.clone().add(0, 0.2, 0), k % 2 == 0 ? th.color() : Color.WHITE, 0.8 + k * 0.9, 24 + k * 6, 1.4f), i * 2L);
        }
        plugin.fx.sound(p, "dropper:checkpoint", Sound.ENTITY_PLAYER_SPLASH_HIGH_SPEED, 1f, 1.2f);
        int next = level + 1;
        if (next > plugin.settings.levels) {
            level = next;
            win(p);
            return;
        }
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            if (!running || wonAt >= 0) return;
            Player q = player();
            if (q == null) return;
            goLevel(q, next, true, false);
            Shaft n2 = plugin.builder.shaft(next);
            Location top = new Location(q.getWorld(), n2.cx(), n2.topY() + 4, n2.cz());
            plugin.fx.firework(top, Themes.of(next).color(), Color.WHITE, FireworkEffect.Type.BALL, 0);
        }, 12L);
        released = false; // mientras espera el siguiente nivel no cuenta nada
    }

    private void win(Player p) {
        if (wonAt >= 0) return;
        wonAt = plugin.tick();
        addWins(1);
        plugin.hud.win(p);
        plugin.fx.sound(p, "dropper:cima", Sound.UI_TOAST_CHALLENGE_COMPLETE, 1f, 1f);
        Location at = p.getLocation();
        for (int i = 0; i < 14; i++) {
            int k = i;
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                double a = k * 0.9;
                Location c = at.clone().add(Math.cos(a) * 3, 2, Math.sin(a) * 3);
                plugin.fx.firework(c, Color.fromRGB(Themes.of(1 + plugin.fx.rnd().nextInt(50)).rgb()), Color.fromRGB(0xFFD700),
                    k % 3 == 0 ? FireworkEffect.Type.STAR : FireworkEffect.Type.BALL_LARGE, 1);
                plugin.fx.particle(at.clone().add(0, 1, 0), Particle.TOTEM_OF_UNDYING, 30, 1.2, 0.4);
            }, i * 8L);
        }
        plugin.hud.update();
    }

    public void lose(Player p, String why) {
        addLosses(1);
        plugin.hud.lose(p, why);
        plugin.fx.sound(p, "dropper:perder", Sound.ENTITY_WITHER_DEATH, 0.6f, 1.2f);
        newRun(p, p.getWorld());
    }

    /** Choque con un bloque: vuelve arriba del mismo nivel (o el escudo le salta el obstáculo). */
    private void hit(Player p, Shaft s) {
        Location l = p.getLocation();
        if (shielded()) {
            shieldUntil = 0;
            // el escudo le pasa por el hueco seguro de la capa que tocó y sigue cayendo
            int k = 0;
            for (int i = 0; i < s.layers().size(); i++) if (s.layers().get(i) <= l.getY() + 0.6) {
                k = i;
                break;
            }
            double[] h = s.holes().get(k);
            Location to = new Location(l.getWorld(), h[0], s.layers().get(k) - 1.9, h[1], l.getYaw(), l.getPitch());
            p.teleport(to);
            p.setVelocity(new Vector(0, -0.3, 0));
            plugin.fx.spiral(to.clone().add(0, -0.5, 0), Color.fromRGB(0xFF7BE5), false, 2.2, 2, Particle.END_ROD);
            plugin.fx.sound(p, "dropper:escudo", Sound.ITEM_SHIELD_BLOCK, 1f, 1.2f);
            plugin.hud.flash(p, "&d🛡 ¡El escudo te salvó!");
            return;
        }
        hits++;
        levelHits++;
        hitStreak++;
        { var bd = l.clone().add(0, -0.3, 0).getBlock().getBlockData(); if (bd.getMaterial().isAir()) bd = Material.STONE.createBlockData(); l.getWorld().spawnParticle(Particle.BLOCK, l.clone().add(0, 0.2, 0), 40, 0.5, 0.2, 0.5, 0.1, bd); }
        plugin.fx.particle(l.clone().add(0, 0.5, 0), Particle.CLOUD, 20, 0.4, 0.05);
        plugin.fx.sound(p, "dropper:caida", Sound.ENTITY_PLAYER_BIG_FALL, 1f, 0.8f);
        if (plugin.settings.protectHits > 0 && hitStreak >= plugin.settings.protectHits && !isProtected()) {
            protectedUntil = plugin.tick() + plugin.settings.protectS * 20L;
            hitStreak = 0;
            plugin.hud.flash(p, "&a✚ Protegido " + plugin.settings.protectS + " s: sin sabotajes");
        }
        goLevel(p, level, false, true);
    }

    /** ¿El jugador toca algún bloque sólido (suelo, techo o lados)? */
    private boolean touching(Player p) {
        BoundingBox bb = p.getBoundingBox().expand(0.07, 0.07, 0.07);
        World w = p.getWorld();
        for (int x = (int) Math.floor(bb.getMinX()); x <= (int) Math.floor(bb.getMaxX()); x++)
            for (int y = (int) Math.floor(bb.getMinY()); y <= (int) Math.floor(bb.getMaxY()); y++)
                for (int z = (int) Math.floor(bb.getMinZ()); z <= (int) Math.floor(bb.getMaxZ()); z++) {
                    Block b = w.getBlockAt(x, y, z);
                    Material m = b.getType();
                    if (m.isAir() || m == Material.WATER || !m.isSolid()) continue;
                    if (b.getBoundingBox().overlaps(bb)) return true;
                }
        return false;
    }

    private static boolean inWater(Player p) {
        if (p.isInWater()) return true;
        Location l = p.getLocation();
        return l.getBlock().getType() == Material.WATER || l.clone().add(0, -0.3, 0).getBlock().getType() == Material.WATER;
    }

    // ───────────────────────────── bucle ─────────────────────────────

    public void tick() {
        if (!running) return;
        Player p = player();
        if (p == null || !plugin.inWorld(p)) return;
        long now = plugin.tick();
        if (p.getFoodLevel() < 20) p.setFoodLevel(20);
        if (wonAt >= 0) {
            if (now % 10 == 0) plugin.fx.particle(p.getLocation().add(0, 1, 0), Particle.END_ROD, 6, 1.5, 0.05);
            if (now % 5 == 0) plugin.hud.update();
            if (plugin.settings.restartOnWin && now - wonAt > plugin.settings.celebrateSeconds * 20L) newRun(p, p.getWorld());
            return;
        }
        Shaft s = plugin.builder.shaft(level);
        Location l = p.getLocation();
        // cuenta atrás sobre el cristal
        if (!released) {
            long left = releaseAt - now;
            if (left > 0 && left % 20 == 0 && left <= 60) {
                plugin.hud.flash(p, "&f¡" + (left / 20) + "!");
                plugin.fx.sound(l, Sound.BLOCK_NOTE_BLOCK_HAT, 1f, 1.4f);
            }
            if (now >= releaseAt && l.getY() < s.topY() - 0.4) {
                released = true;
                plugin.fx.sound(l, Sound.BLOCK_GLASS_BREAK, 1f, 0.9f);
                l.getWorld().spawnParticle(Particle.BLOCK, l.clone().add(0, 0.3, 0), 30, 2, 0.1, 2, 0.1, Material.GLASS.createBlockData());
            } else if (now > releaseAt + 60 && l.getY() >= s.topY() - 0.4) {
                // el cristal ya no está y sigue arriba (se quedó en el borde): se le baja al hueco
                p.teleport(new Location(l.getWorld(), s.cx(), s.topY() - 1.5, s.cz(), l.getYaw(), l.getPitch()));
            }
            if (now % 5 == 0) plugin.hud.update();
            return;
        }
        // agua = siguiente nivel
        if (inWater(p)) {
            complete(p, s);
            return;
        }
        // fuera del tubo o por debajo del agua (algo raro): se repite el nivel
        if (!s.inside(l.getX(), l.getZ()) || l.getY() < s.waterY() - 4) {
            goLevel(p, level, false, true);
            return;
        }
        if (touching(p)) {
            hit(p, s);
            return;
        }
        // estela del color del tema mientras cae, y viento de velocidad
        if (now % 2 == 0) plugin.fx.dustTo(l.clone().add(0, 2.4, 0), theme().color(), Color.WHITE, 1.0f, 2, 0.25);
        if (now % 6 == 0) plugin.fx.ambient(theme(), l.clone().add(0, 3.5, 0), 3, 2.5);
        if (now < guideUntil && now % 4 == 0) guide(p, s);
        lastY = l.getY();
        if (plugin.settings.timeLimitMin > 0 && seconds() >= plugin.settings.timeLimitMin * 60) {
            lose(p, "¡SE ACABÓ EL TIEMPO!");
            return;
        }
        if (now % 4 == 0) plugin.hud.update();
    }

    /** Guía: anillos dorados en el hueco seguro de las capas que tiene debajo. */
    private void guide(Player p, Shaft s) {
        Color c = Color.fromRGB(0xFFE066);
        double y = p.getLocation().getY();
        int shown = 0;
        for (int i = 0; i < s.layers().size() && shown < 3; i++) {
            int ly = s.layers().get(i);
            if (ly >= y) continue;
            double[] h = s.holes().get(i);
            Location at = new Location(p.getWorld(), h[0], ly + 1.1, h[1]);
            plugin.fx.ring(at, c, 0.9, 18, 1.4f);
            plugin.fx.particle(at, Particle.END_ROD, 2, 0.2, 0.01);
            shown++;
        }
    }

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
        if (!(running && p.getUniqueId().equals(streamer)) && invFile(p.getUniqueId()).isFile()) {
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                if (!p.isOnline() || (running && p.getUniqueId().equals(streamer))) return;
                restoreInventory(p);
                if (plugin.inWorld(p)) {
                    p.teleport(Bukkit.getWorlds().getFirst().getSpawnLocation());
                    p.setGameMode(Bukkit.getDefaultGameMode());
                }
            }, 10L);
            return;
        }
        if (running && p.getUniqueId().equals(streamer)) {
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                p.setGameMode(GameMode.ADVENTURE);
                goLevel(p, level, false, true);
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
