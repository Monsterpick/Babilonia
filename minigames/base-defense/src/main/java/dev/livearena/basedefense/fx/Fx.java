package dev.livearena.basedefense.fx;

import dev.livearena.basedefense.BaseDefense;
import java.util.ArrayDeque;
import java.util.Random;
import org.bukkit.Color;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.SoundCategory;
import org.bukkit.World;
import org.bukkit.block.data.BlockData;
import org.bukkit.entity.BlockDisplay;
import org.bukkit.entity.Display;
import org.bukkit.util.Transformation;
import org.joml.Quaternionf;
import org.joml.Vector3f;

/**
 * Partículas y sonidos con presupuesto por tick. Lo importante (explosiones, jefes, carteles) usa
 * prioridad alta y casi siempre entra; lo decorativo se descarta primero cuando hay mucha acción.
 */
public final class Fx {
    private final BaseDefense plugin;
    private final Random rnd = new Random();
    private int particles, sounds;
    private final ArrayDeque<Stain> stains = new ArrayDeque<>();
    private static final BlockData BLOOD = Material.REDSTONE_BLOCK.createBlockData();
    private static final String[] STAIN_BLOCKS = {"red_concrete", "nether_wart_block", "red_terracotta", "crimson_planks"};

    private record Stain(BlockDisplay e, long until) {}

    public Fx(BaseDefense plugin) {
        this.plugin = plugin;
    }

    public void beginTick() {
        particles = 0;
        sounds = 0;
        long now = plugin.tick();
        while (!stains.isEmpty() && (stains.peekFirst().until() <= now || !stains.peekFirst().e().isValid())) {
            Stain s = stains.pollFirst();
            if (s.e().isValid()) s.e().remove();
        }
    }

    /** high=true: se permite exceder el presupuesto hasta el doble (eventos importantes). */
    private boolean take(int count, boolean high) {
        int cap = plugin.settings.particlesPerTick * (high ? 2 : 1);
        if (particles + count > cap) return false;
        particles += count;
        return true;
    }

    public void particle(Location l, Particle p, int count, double spread, double speed, boolean high) {
        if (!take(count, high)) return;
        l.getWorld().spawnParticle(p, l, count, spread, spread, spread, speed, null, true);
    }

    public void particle(Location l, Particle p, int count, double sx, double sy, double sz, double speed, Object data, boolean high) {
        if (!take(count, high)) return;
        l.getWorld().spawnParticle(p, l, count, sx, sy, sz, speed, data, true);
    }

    public void dust(Location l, Color c, float size, int count, double spread, boolean high) {
        particle(l, Particle.DUST, count, spread, spread, spread, 0, new Particle.DustOptions(c, size), high);
    }

    /** Trazo de bala: pocas partículas TRAIL que viajan del cañón al impacto + puntos fijos. */
    public void tracer(Location from, Location to, Color c) {
        int pts = plugin.settings.tracePoints;
        double dist = from.distance(to);
        if (dist < 0.1) return;
        int trails = Math.min(3, pts);
        for (int i = 0; i < trails; i++) {
            Location s = from.clone().add(to.clone().subtract(from).toVector().multiply(i / (double) (trails * 3)));
            particle(s, Particle.TRAIL, 1, 0, 0, 0, 0, new Particle.Trail(to, c, 4 + (int) Math.min(6, dist / 12)), false);
        }
        int dots = Math.max(2, Math.min(pts - trails, (int) (dist / 2.5)));
        if (!take(dots, false)) return;
        World w = from.getWorld();
        var step = to.toVector().subtract(from.toVector()).multiply(1.0 / dots);
        Location p = from.clone();
        Particle.DustOptions dust = new Particle.DustOptions(c, 0.45f);
        for (int i = 0; i < dots; i++) {
            p.add(step);
            w.spawnParticle(Particle.DUST, p, 1, 0, 0, 0, 0, dust, true);
        }
    }

    public void sound(Location l, String key, float vol, float pitch, boolean high) {
        if (key == null || key.isBlank()) return;
        if (sounds >= plugin.settings.soundsPerTick * (high ? 3 : 1)) return;
        sounds++;
        l.getWorld().playSound(l, key, SoundCategory.HOSTILE, vol, pitch);
    }

    public void sound(Location l, org.bukkit.Sound s, float vol, float pitch, boolean high) {
        if (sounds >= plugin.settings.soundsPerTick * (high ? 3 : 1)) return;
        sounds++;
        l.getWorld().playSound(l, s, SoundCategory.HOSTILE, vol, pitch);
    }

    /** Explosión visual (no rompe nada). */
    public void explosion(Location l, double radius, boolean big) {
        particle(l, big ? Particle.EXPLOSION_EMITTER : Particle.EXPLOSION, big ? 2 : 3, radius * 0.25, 0, true);
        particle(l, Particle.FLAME, (int) (radius * 10), radius * 0.35, radius * 0.06, true);
        particle(l, Particle.LARGE_SMOKE, (int) (radius * 8), radius * 0.4, radius * 0.04, true);
        particle(l, Particle.LAVA, (int) (radius * 2), radius * 0.3, 0, false);
        sound(l, org.bukkit.Sound.ENTITY_GENERIC_EXPLODE, big ? 4f : 2.2f, big ? 0.6f : 0.9f + rnd.nextFloat() * 0.2f, true);
    }

    /** Sangre al morir: chorro de partículas y una mancha temporal en el suelo. */
    public void blood(Location l, double size) {
        particle(l.clone().add(0, 0.6, 0), Particle.BLOCK, (int) (14 * size), 0.25 * size, 0.2 * size, 0.25 * size, 0.08, BLOOD, false);
        dust(l.clone().add(0, 0.5, 0), Color.fromRGB(120, 0, 0), 1.4f, (int) (6 * size), 0.3 * size, false);
        int max = plugin.settings.bloodStains;
        if (max <= 0) return;
        while (stains.size() >= max) {
            Stain s = stains.pollFirst();
            if (s != null && s.e().isValid()) s.e().remove();
        }
        Location ground = l.clone();
        ground.setY(Math.floor(ground.getY()) + 0.012);
        float yaw = rnd.nextFloat() * 6.283f;
        float sx = (float) (0.6 + rnd.nextDouble() * 0.9 * size), sz = (float) (0.5 + rnd.nextDouble() * 0.8 * size);
        String mat = STAIN_BLOCKS[rnd.nextInt(STAIN_BLOCKS.length)];
        BlockDisplay d = l.getWorld().spawn(ground, BlockDisplay.class, e -> {
            e.setPersistent(false);
            e.setBlock(org.bukkit.Bukkit.createBlockData("minecraft:" + mat));
            Quaternionf q = new Quaternionf().rotateY(yaw);
            e.setTransformation(new Transformation(new Vector3f(-sx / 2, 0, -sz / 2).rotate(q), q, new Vector3f(sx, 0.01f, sz), new Quaternionf()));
            e.setBrightness(new Display.Brightness(4, 6));
            e.setViewRange(1.5f);
        });
        stains.addLast(new Stain(d, plugin.tick() + 100 + rnd.nextInt(60)));
    }

    public void clearStains() {
        for (Stain s : stains) if (s.e().isValid()) s.e().remove();
        stains.clear();
    }

    public Random rnd() {
        return rnd;
    }
}
