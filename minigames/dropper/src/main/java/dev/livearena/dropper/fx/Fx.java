package dev.livearena.dropper.fx;

import dev.livearena.dropper.DropperLive;
import dev.livearena.dropper.map.Theme;
import java.util.Random;
import org.bukkit.Color;
import org.bukkit.FireworkEffect;
import org.bukkit.Location;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.World;
import org.bukkit.entity.Firework;
import org.bukkit.entity.Player;
import org.bukkit.inventory.meta.FireworkMeta;
import org.bukkit.util.Vector;

/** Partículas, sonidos y fuegos artificiales. Todo visible desde lejos (force) para que la cámara del directo lo vea. */
public final class Fx {
    private final DropperLive plugin;
    private final Random rnd = new Random();

    public Fx(DropperLive plugin) {
        this.plugin = plugin;
    }

    public Random rnd() {
        return rnd;
    }

    public void particle(Location l, Particle p, int n, double spread, double speed) {
        particle(l, p, n, spread, spread, spread, speed);
    }

    public void particle(Location l, Particle p, int n, double sx, double sy, double sz, double speed) {
        try {
            Class<?> dt = p.getDataType();
            if (dt == Void.class) l.getWorld().spawnParticle(p, l, n, sx, sy, sz, speed, null, true);
            else if (dt == Particle.DustOptions.class) l.getWorld().spawnParticle(p, l, n, sx, sy, sz, speed, new Particle.DustOptions(Color.WHITE, 1.2f), true);
            else if (dt == Float.class) l.getWorld().spawnParticle(p, l, n, sx, sy, sz, speed, 0f, true);
            else if (dt == Integer.class) l.getWorld().spawnParticle(p, l, n, sx, sy, sz, speed, 0, true);
            else if (dt == Color.class) l.getWorld().spawnParticle(p, l, n, sx, sy, sz, speed, Color.WHITE, true);
        } catch (RuntimeException ignored) {
            // partícula que necesita otros datos: se omite
        }
    }

    public void dust(Location l, Color c, float size, int n, double spread) {
        l.getWorld().spawnParticle(Particle.DUST, l, n, spread, spread, spread, 0, new Particle.DustOptions(c, size), true);
    }

    public void dustTo(Location l, Color a, Color b, float size, int n, double spread) {
        l.getWorld().spawnParticle(Particle.DUST_COLOR_TRANSITION, l, n, spread, spread, spread, 0, new Particle.DustTransition(a, b, size), true);
    }

    /** Partícula de ambiente del bioma ("dust:#RRGGBB" o un nombre de partícula). */
    public void ambient(Theme th, Location l, int n, double spread) {
        String p = th.particle();
        if (p.startsWith("dust:")) {
            try {
                dust(l, Color.fromRGB(Integer.parseInt(p.substring(6), 16)), 1.1f, n, spread);
            } catch (NumberFormatException ignored) {
            }
            return;
        }
        try {
            particle(l, Particle.valueOf(p), n, spread, spread * 0.6, spread, 0.01);
        } catch (IllegalArgumentException e) {
            dust(l, th.color(), 1.1f, n, spread);
        }
    }

    public void sound(Location l, Sound s, float vol, float pitch) {
        l.getWorld().playSound(l, s, vol, pitch);
    }

    /** Sonido del pack si el jugador lo tiene; si no, el de Minecraft. */
    public void sound(Player p, String packKey, Sound vanilla, float vol, float pitch) {
        if (plugin.pack.loaded(p)) p.playSound(p.getLocation(), packKey, vol, pitch);
        else p.playSound(p.getLocation(), vanilla, vol, pitch);
    }

    public void ring(Location c, Color col, double radius, int points, float size) {
        for (int i = 0; i < points; i++) {
            double a = i * Math.PI * 2 / points;
            dust(c.clone().add(Math.cos(a) * radius, 0, Math.sin(a) * radius), col, size, 1, 0.02);
        }
    }

    public void line(Location a, Location b, Color col, double step, float size) {
        Vector d = b.toVector().subtract(a.toVector());
        double len = d.length();
        if (len < 0.01) return;
        d.normalize().multiply(step);
        Location p = a.clone();
        for (double s = 0; s <= len; s += step) {
            dust(p, col, size, 1, 0);
            p.add(d);
        }
    }

    public void firework(Location l, Color a, Color b, FireworkEffect.Type type, int power) {
        World w = l.getWorld();
        Firework f = w.spawn(l, Firework.class, fw -> {
            FireworkMeta m = fw.getFireworkMeta();
            m.addEffect(FireworkEffect.builder().with(type).withColor(a).withFade(b).trail(true).flicker(rnd.nextBoolean()).build());
            m.setPower(power);
            fw.setFireworkMeta(m);
            fw.getPersistentDataContainer().set(plugin.tagKey, org.bukkit.persistence.PersistentDataType.BYTE, (byte) 2);
        });
        if (power == 0) plugin.getServer().getScheduler().runTaskLater(plugin, f::detonate, 2L);
    }

    /** Remolino ascendente (subir) o descendente (bajar) alrededor del jugador. */
    public void spiral(Location base, Color col, boolean up, double height, int turns, Particle extra) {
        for (int i = 0; i < turns * 24; i++) {
            double t = i / (turns * 24.0);
            double a = t * turns * Math.PI * 2;
            double y = up ? t * height : (1 - t) * height;
            double r = 0.9 + (up ? 0.2 : 0.6) * Math.sin(t * Math.PI);
            Location p = base.clone().add(Math.cos(a) * r, y, Math.sin(a) * r);
            dust(p, col, 1.3f, 1, 0);
            if (i % 6 == 0 && extra != null) particle(p, extra, 1, 0.02, 0.02);
        }
    }
}
