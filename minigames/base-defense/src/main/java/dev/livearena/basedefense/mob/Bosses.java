package dev.livearena.basedefense.mob;

import dev.livearena.basedefense.BaseDefense;
import dev.livearena.basedefense.Settings;
import dev.livearena.basedefense.util.Txt;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.text.Component;
import org.bukkit.Color;
import org.bukkit.Location;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.World;
import org.bukkit.attribute.Attribute;
import org.bukkit.entity.Entity;
import org.bukkit.entity.EntityType;
import org.bukkit.entity.LargeFireball;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.ExplosionPrimeEvent;
import org.bukkit.event.entity.ProjectileHitEvent;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.util.Vector;

/**
 * Jefes: vida propia en BossBar, nombre del donante, furia al bajar de vida y la mecánica del
 * Ghast (bolas de fuego hacia la base que el streamer puede devolver de un disparo).
 */
public final class Bosses implements Listener {
    private final BaseDefense plugin;
    private final List<GameMob> bosses = new ArrayList<>();
    private final Map<UUID, Ball> balls = new LinkedHashMap<>();
    private long lastReturnTitle;

    /** Bola de fuego del Ghast controlada por el plugin. */
    public static final class Ball {
        final LargeFireball e;
        final GameMob owner;
        boolean returned;
        final long born;

        Ball(LargeFireball e, GameMob owner, long born) {
            this.e = e;
            this.owner = owner;
            this.born = born;
        }

        public LargeFireball entity() {
            return e;
        }

        public boolean returned() {
            return returned;
        }
    }

    public Bosses(BaseDefense plugin) {
        this.plugin = plugin;
    }

    public List<GameMob> all() {
        return bosses;
    }

    public java.util.Collection<Ball> balls() {
        return balls.values();
    }

    /** Pide un jefe. Devuelve false si no se pudo crear. */
    public boolean spawn(Settings.BossDef def, String donor) {
        World w = plugin.world(false);
        if (w == null) return false;
        return plugin.mobs.spawnBoss(w, def, donor, gm -> registered(gm, def, donor));
    }

    private void registered(GameMob gm, Settings.BossDef def, String donor) {
        gm.bar = BossBar.bossBar(barTitle(gm), 1f, color(def), BossBar.Overlay.NOTCHED_10);
        gm.nextFireball = plugin.tick() + 60;
        bosses.add(gm);
        plugin.hud.relayout();
        plugin.game.banner(plugin.settings.msg("jefeTitulo"), plugin.settings.msg("jefeSubtitulo"), Sound.ENTITY_WITHER_SPAWN, 0.7f, "jefe", def.name(), "usuario", donor);
        Location l = gm.entity.getLocation();
        plugin.fx.particle(l, Particle.SONIC_BOOM, 1, 0, 0, true);
        plugin.fx.particle(l.clone().add(0, 1, 0), Particle.SOUL_FIRE_FLAME, 60, 1.5, 1.5, 1.5, 0.05, null, true);
    }

    private static BossBar.Color color(Settings.BossDef def) {
        return switch (def.entity().name()) {
            case "WITHER" -> BossBar.Color.WHITE;
            case "ENDER_DRAGON" -> BossBar.Color.PURPLE;
            case "BLAZE" -> BossBar.Color.YELLOW;
            case "WARDEN" -> BossBar.Color.BLUE;
            default -> BossBar.Color.RED;
        };
    }

    private Component barTitle(GameMob gm) {
        String hp = String.valueOf((int) Math.ceil(Math.max(0, gm.hp)));
        return Txt.fmt("&4☠ &c&l{jefe} &7de &e{usuario} &8· &f{vida}" + (gm.furious ? " &4&lFURIOSO" : ""), "jefe", gm.boss.name(), "usuario", gm.donor, "vida", hp);
    }

    public void showBars(Player p) {
        for (GameMob gm : bosses) if (gm.bar != null) p.showBossBar(gm.bar);
    }

    public void hideBars(Player p) {
        for (GameMob gm : bosses) if (gm.bar != null) p.hideBossBar(gm.bar);
    }

    void onDamage(GameMob gm) {
        if (gm.bar != null) {
            gm.bar.progress((float) Math.max(0, Math.min(1, gm.hp / gm.maxHp)));
            gm.bar.name(barTitle(gm));
        }
        if (!gm.furious && gm.hp / gm.maxHp * 100 <= plugin.settings.furyPercent) {
            gm.furious = true;
            if (!gm.manual) {
                var a = gm.entity.getAttribute(Attribute.MOVEMENT_SPEED);
                if (a != null) a.setBaseValue(a.getBaseValue() * plugin.settings.furySpeed);
            }
            gm.bar.color(BossBar.Color.RED);
            gm.bar.name(barTitle(gm));
            plugin.game.banner(plugin.settings.msg("furiaTitulo"), plugin.settings.msg("furiaSubtitulo"), Sound.ENTITY_RAVAGER_ROAR, 0.8f, "jefe", gm.boss.name(), "usuario", gm.donor);
            Location l = gm.entity.getLocation().add(0, gm.entity.getHeight() / 2, 0);
            plugin.fx.particle(l, Particle.ANGRY_VILLAGER, 20, gm.entity.getWidth(), 0, true);
            plugin.fx.particle(l, Particle.FLAME, 80, gm.entity.getWidth() * 0.6, 0.08, true);
        }
    }

    void onDeath(GameMob gm) {
        forget(gm);
        Location l = gm.entity.getLocation().add(0, gm.entity.getHeight() / 2, 0);
        massive(l, gm.entity.getWidth() + 1);
        plugin.game.banner(plugin.settings.msg("jefeDerrotado"), "&7de &e{usuario}", Sound.UI_TOAST_CHALLENGE_COMPLETE, 1f, "jefe", gm.boss.name(), "usuario", gm.donor);
    }

    void onReachBase(GameMob gm, Location l) {
        massive(l.clone().add(0, 1.5, 0), gm.entity.getWidth() + 1.5);
        plugin.fx.sound(l, Sound.ENTITY_WITHER_BREAK_BLOCK, 3f, 0.6f, true);
    }

    /** Efecto masivo de partículas y sonido (muerte o llegada de jefe). */
    private void massive(Location l, double size) {
        plugin.fx.explosion(l, size * 2, true);
        plugin.fx.particle(l, Particle.SOUL_FIRE_FLAME, 120, size, size, size, 0.12, null, true);
        plugin.fx.particle(l, Particle.DUST, 120, size, size, size, 0, new Particle.DustOptions(Color.fromRGB(150, 0, 0), 2.6f), true);
        plugin.fx.particle(l, Particle.FIREWORK, 80, 0.2, 0.2, 0.2, 0.45, null, true);
        plugin.fx.particle(l, Particle.FLASH, 2, 0, 0, 0, 0, Color.WHITE, true);
        plugin.fx.sound(l, Sound.ENTITY_WITHER_DEATH, 1.6f, 0.9f, true);
        plugin.fx.sound(l, Sound.ENTITY_GENERIC_EXPLODE, 4f, 0.5f, true);
    }

    void forget(GameMob gm) {
        bosses.remove(gm);
        if (gm.bar != null) for (Player p : plugin.game.viewers()) p.hideBossBar(gm.bar);
        if (bosses.isEmpty()) plugin.hud.relayout();
        balls.values().removeIf(b -> {
            if (b.owner == gm) {
                if (b.e.isValid()) b.e.remove();
                return true;
            }
            return false;
        });
    }

    public void removeAllBalls() {
        for (Ball b : balls.values()) if (b.e.isValid()) b.e.remove();
        balls.clear();
    }

    // ───────────────────────────── TICK ─────────────────────────────

    public void tick() {
        if (!plugin.game.running() || plugin.arena == null) return;
        long now = plugin.tick();
        for (GameMob gm : new ArrayList<>(bosses)) {
            if (gm.dead || !gm.entity.isValid()) continue;
            Location l = gm.entity.getLocation();
            if (gm.furious && now % 4 == 0) plugin.fx.particle(l.clone().add(0, gm.entity.getHeight() * 0.6, 0), Particle.FLAME, 6, gm.entity.getWidth() * 0.4, 0.02, false);
            if (now % 10 == 0) plugin.fx.particle(l.clone().add(0, gm.entity.getHeight() * 0.5, 0), Particle.SMOKE, 6, gm.entity.getWidth() * 0.4, 0.01, false);
            double every = gm.boss.fireballEvery();
            if (every > 0 && !plugin.game.paused() && now >= gm.nextFireball) {
                double interval = every * 20 / (gm.furious ? 1.5 : 1);
                gm.nextFireball = now + (long) interval;
                shootFireball(gm);
            }
            if (gm.entity.getType() == EntityType.ENDER_DRAGON && now % 3 == 0) plugin.fx.particle(l, Particle.DRAGON_BREATH, 6, 2, 0.5, 2, 0.01, 1f, false);
        }
        tickBalls(now);
    }

    private void shootFireball(GameMob gm) {
        Location from = gm.entity.getLocation().add(0, gm.entity.getHeight() * 0.5, 0);
        Vector to = plugin.arena.baseCenter();
        Vector dir = to.clone().subtract(from.toVector()).normalize();
        from.add(dir.clone().multiply(gm.entity.getWidth() * 0.6 + 1));
        LargeFireball f = from.getWorld().spawn(from, LargeFireball.class, e -> {
            e.setShooter(gm.entity);
            e.setYield(0);
            e.setIsIncendiary(false);
            e.setDirection(dir);
            e.setAcceleration(new Vector());
            e.setVelocity(dir.clone().multiply(0.42));
            e.setPersistent(false);
            e.getPersistentDataContainer().set(plugin.projKey, PersistentDataType.STRING, "bola");
        });
        balls.put(f.getUniqueId(), new Ball(f, gm, plugin.tick()));
        plugin.fx.sound(from, Sound.ENTITY_GHAST_WARN, 2.5f, 1f, true);
        plugin.fx.sound(from, Sound.ENTITY_GHAST_SHOOT, 2.5f, 0.9f, true);
        if (plugin.tick() - lastReturnTitle > 80) {
            lastReturnTitle = plugin.tick();
            plugin.game.banner(plugin.settings.msg("devuelvelaTitulo"), plugin.settings.msg("devuelvelaSubtitulo"), null, 1f);
        }
    }

    private void tickBalls(long now) {
        Iterator<Ball> it = balls.values().iterator();
        Vector baseC = plugin.arena.baseCenter();
        while (it.hasNext()) {
            Ball b = it.next();
            if (!b.e.isValid() || now - b.born > 20 * 20) {
                if (b.e.isValid()) b.e.remove();
                it.remove();
                continue;
            }
            Location l = b.e.getLocation();
            Vector target;
            if (b.returned) {
                if (b.owner.dead || !b.owner.entity.isValid()) {
                    plugin.fx.explosion(l, 2, false);
                    b.e.remove();
                    it.remove();
                    continue;
                }
                target = b.owner.entity.getLocation().add(0, b.owner.entity.getHeight() * 0.5, 0).toVector();
            } else target = baseC;
            Vector d = target.clone().subtract(l.toVector());
            double dist = d.length();
            double hitR = b.returned ? Math.max(2.2, b.owner.entity.getWidth()) : 3.2;
            if (dist < hitR) {
                it.remove();
                b.e.remove();
                plugin.fx.explosion(l, 3, false);
                if (b.returned) {
                    plugin.mobs.damage(b.owner, b.owner.boss.fireballBossDamage(), null);
                    plugin.fx.sound(l, Sound.ENTITY_GHAST_HURT, 3f, 0.8f, true);
                } else plugin.game.damageBase(b.owner.boss.fireballBaseDamage(), null);
                continue;
            }
            Vector v = d.multiply(1 / dist).multiply(b.returned ? 0.95 : 0.42);
            b.e.setVelocity(v);
            b.e.setDirection(v);
            b.e.setAcceleration(new Vector());
            if (now % 2 == 0) plugin.fx.particle(l, Particle.FLAME, 3, 0.2, 0.02, false);
        }
    }

    /** El streamer le dio a la bola: vuelve hacia el Ghast. */
    public void returnBall(Ball b, Player p) {
        if (b.returned) return;
        b.returned = true;
        Location l = b.e.getLocation();
        plugin.fx.particle(l, Particle.CRIT, 30, 0.5, 0.4, true);
        plugin.fx.particle(l, Particle.END_ROD, 12, 0.3, 0.12, true);
        plugin.fx.sound(l, Sound.ENTITY_PLAYER_ATTACK_CRIT, 2f, 1.2f, true);
        plugin.fx.sound(p.getLocation(), Sound.BLOCK_NOTE_BLOCK_PLING, 1.5f, 2f, true);
        p.sendActionBar(Txt.fmt("&6&l¡DEVUELTA!"));
    }

    @EventHandler
    public void onHit(ProjectileHitEvent e) {
        Entity ent = e.getEntity();
        if (balls.containsKey(ent.getUniqueId()) || "bola".equals(ent.getPersistentDataContainer().get(plugin.projKey, PersistentDataType.STRING))) {
            // nada de explosión vanilla: la trayectoria la gestiona el plugin
            e.setCancelled(true);
        }
    }

    @EventHandler
    public void onPrime(ExplosionPrimeEvent e) {
        if (plugin.inGameWorld(e.getEntity())) e.setCancelled(true);
    }
}
