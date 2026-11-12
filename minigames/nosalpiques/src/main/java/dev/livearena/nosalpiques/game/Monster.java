package dev.livearena.nosalpiques.game;

import dev.livearena.nosalpiques.NoSalpiquesLive;
import dev.livearena.nosalpiques.map.Rooms;
import org.bukkit.Color;
import org.bukkit.Location;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.entity.Player;
import org.bukkit.entity.Pose;
import org.bukkit.entity.Warden;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;
import org.bukkit.util.Vector;

/**
 * La criatura que despierta al salpicar. Es un warden sin IA que movemos nosotros: sale del agua (pose de emerger),
 * ruge y persigue al jugador «andando» sobre el agua y las plataformas. Si le alcanza, le atrapa. Una piedra lanzada
 * lo distrae (va hacia donde cayó) y una bengala lo ciega unos segundos.
 */
public final class Monster {
    private final NoSalpiquesLive plugin;
    private Warden mob;
    private long wakeUntil, distractUntil, blindUntil, rageUntil;
    private Location lure;

    public Monster(NoSalpiquesLive plugin) {
        this.plugin = plugin;
    }

    public boolean awake() {
        return mob != null && mob.isValid();
    }

    public boolean emerging() {
        return awake() && plugin.tick() < wakeUntil;
    }

    public boolean blinded() {
        return plugin.tick() < blindUntil;
    }

    public boolean distracted() {
        return plugin.tick() < distractUntil;
    }

    public Location location() {
        return awake() ? mob.getLocation() : null;
    }

    /** Despierta en el agua cerca de `near` (a unos bloques, para dar tiempo a huir). */
    public void wake(Player p, Location near) {
        if (awake()) return;
        // emerge del agua de la piscina a 6–8 bloques del jugador (delante si se puede, para que se vea salir)
        Rooms.Room rm = plugin.rooms.room(plugin.game.checkpoint());
        Location pl = p.getLocation();
        Location at = null;
        var r = plugin.fx.rnd();
        for (int tries = 0; tries < 40 && at == null; tries++) {
            double ang = Math.toRadians(pl.getYaw() + 90) + (r.nextDouble() - 0.5) * (tries < 20 ? 1.6 : Math.PI * 2);
            double dist = 6 + r.nextDouble() * 2;
            double x = pl.getX() + Math.cos(ang) * dist, z = pl.getZ() + Math.sin(ang) * dist;
            if (x < rm.x0() + 4.5 || x > rm.x0() + Rooms.L - 4.5 || z < 1 || z > Rooms.W - 1) continue;
            if (!plugin.rooms.water.contains(Rooms.key((int) Math.floor(x), Rooms.WATER_TOP, (int) Math.floor(z)))) continue;
            at = new Location(pl.getWorld(), x, 0, z);
        }
        if (at == null) at = new Location(pl.getWorld(), Math.max(rm.x0() + 6, Math.min(rm.x0() + Rooms.L - 6, pl.getX() + 6)), 0, Rooms.W - 2.5);
        at.setY(Rooms.WATER_TOP + 1 - 2.2); // sale de debajo del agua
        at.setYaw(yawTo(at, pl));
        mob = at.getWorld().spawn(at, Warden.class, w -> {
            w.setAI(false);
            w.setInvulnerable(true);
            w.setPersistent(false);
            w.setRemoveWhenFarAway(false);
            w.setSilent(true);
            w.setGravity(false);
            w.setCollidable(false);
            w.addScoreboardTag("nosalpiques");
            w.setPose(Pose.EMERGING, true);
        });
        wakeUntil = plugin.tick() + plugin.settings.wakeS * 20L;
        distractUntil = blindUntil = 0;
        lure = null;
        Location l = mob.getLocation();
        plugin.fx.particle(l.clone().add(0, 2.4, 0), Particle.SPLASH, 200, 1.6, 0.6);
        plugin.fx.particle(l.clone().add(0, 2.2, 0), Particle.SCULK_SOUL, 30, 1.2, 0.05);
        plugin.fx.sound(l, Sound.ENTITY_WARDEN_EMERGE, 2f, 0.8f);
        plugin.fx.sound(l, Sound.ENTITY_GENERIC_SPLASH, 2f, 0.5f);
        p.addPotionEffect(new PotionEffect(PotionEffectType.DARKNESS, 60, 0, true, false, false));
    }

    /** Vuelve al agua (al pasar de sala, al dormirlo o al atrapar). */
    public void sleep(boolean effect) {
        if (mob != null && mob.isValid()) {
            Location l = mob.getLocation();
            if (effect) {
                plugin.fx.particle(l.clone().add(0, 1, 0), Particle.SPLASH, 120, 1.2, 0.5);
                plugin.fx.particle(l.clone().add(0, 1.5, 0), Particle.SCULK_SOUL, 20, 0.8, 0.05);
                plugin.fx.sound(l, Sound.ENTITY_WARDEN_DIG, 1.5f, 0.8f);
            }
            mob.remove();
        }
        mob = null;
        lure = null;
    }

    public void distract(Location at) {
        if (!awake()) return;
        lure = at.clone();
        distractUntil = plugin.tick() + plugin.settings.distractS * 20L;
        plugin.fx.sound(mob.getLocation(), Sound.ENTITY_WARDEN_LISTENING, 1.5f, 1f);
    }

    public void blind() {
        if (!awake()) return;
        blindUntil = plugin.tick() + plugin.settings.blindS * 20L;
        plugin.fx.sound(mob.getLocation(), Sound.ENTITY_WARDEN_HURT, 1.5f, 0.7f);
    }

    public void rage(int seconds) {
        rageUntil = plugin.tick() + seconds * 20L;
    }

    /** Un paso: devuelve true si ha atrapado al jugador. */
    public boolean tick(Player p, int room) {
        if (!awake()) return false;
        long now = plugin.tick();
        Location m = mob.getLocation();
        Location target = p.getLocation();
        if (now < wakeUntil) {
            // emerge poco a poco del agua mirando al jugador
            double rise = Math.min(Rooms.WATER_TOP + 1 - 0.3, m.getY() + 2.0 / (plugin.settings.wakeS * 20.0));
            Location to = m.clone();
            to.setY(rise);
            to.setYaw(yawTo(m, target));
            mob.teleport(to);
            if (now % 5 == 0) plugin.fx.particle(to.clone().add(0, 1.2, 0), Particle.FALLING_WATER, 12, 0.8, 0);
            if (wakeUntil - now == 1) {
                mob.setPose(Pose.ROARING, true);
                plugin.fx.sound(to, Sound.ENTITY_WARDEN_ROAR, 3f, 0.8f);
                plugin.hud.flash(p, "&4¡ALGO HA DESPERTADO!");
            }
            return false;
        }
        if (now == wakeUntil + 40) mob.setPose(Pose.STANDING, true);
        if (now % 20 == 0) plugin.fx.sound(m, Sound.ENTITY_WARDEN_HEARTBEAT, 1.6f, 1f);
        if (now % 80 == 0) p.addPotionEffect(new PotionEffect(PotionEffectType.DARKNESS, 50, 0, true, false, false));
        if (now < blindUntil) {
            if (now % 4 == 0) plugin.fx.particle(m.clone().add(0, 2.6, 0), Particle.FLASH, 1, 0, 0, 0, 0);
            if (now % 3 == 0) plugin.fx.dust(m.clone().add(0, 2.4, 0), Color.fromRGB(0xFFC04D), 1.5f, 6, 0.6);
            return false;
        }
        Location goal = now < distractUntil && lure != null ? lure : target;
        double speed = plugin.settings.monsterSpeed * (1 + (room - 1) * 0.06) * (now < rageUntil ? 1.6 : 1);
        Vector d = goal.toVector().subtract(m.toVector());
        double y = Math.max(Rooms.WATER_TOP + 1 - 0.3, goal.getY() - 0.2);
        d.setY(0);
        double dist = d.length();
        Location to = m.clone();
        if (dist > 0.05) to.add(d.normalize().multiply(Math.min(speed, dist)));
        to.setY(m.getY() + Math.max(-0.25, Math.min(0.25, y - m.getY())));
        to.setYaw(yawTo(to, target));
        mob.teleport(to);
        if (now % 3 == 0) plugin.fx.particle(to.clone().add(0, 0.1, 0), Particle.SPLASH, 6, 0.5, 0.05);
        if (now % 6 == 0) plugin.fx.particle(to.clone().add(0, 2.2, 0), Particle.SCULK_SOUL, 1, 0.3, 0.02);
        if (now >= distractUntil) {
            double dx = to.getX() - target.getX(), dz = to.getZ() - target.getZ();
            return Math.sqrt(dx * dx + dz * dz) < plugin.settings.catchDist && Math.abs(to.getY() - target.getY()) < 2.6;
        }
        return false;
    }

    private static float yawTo(Location a, Location b) {
        double dx = b.getX() - a.getX(), dz = b.getZ() - a.getZ();
        return (float) Math.toDegrees(Math.atan2(-dx, dz));
    }
}
