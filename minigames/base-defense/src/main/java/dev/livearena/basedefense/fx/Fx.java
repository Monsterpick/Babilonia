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
        while (!holes.isEmpty() && (holes.peekFirst().until() <= now || !holes.peekFirst().e().isValid())) {
            Stain h = holes.pollFirst();
            if (h.e().isValid()) h.e().remove();
        }
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

    /** ¿Queda presupuesto de sonido este tick? (lo consume) */
    public boolean soundBudget() {
        if (sounds >= plugin.settings.soundsPerTick * 2) return false;
        sounds++;
        return true;
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

    /**
     * Explosión grande: fogonazo, núcleo de fuego, onda expansiva (anillo que se abre en el suelo), escombros del
     * suelo, columna de humo y lluvia de brasas. tint = color de la onda (naranja, alma, morado…).
     */
    public void blast(Location l, double r, Color tint, boolean shakeNear) {
        World w = l.getWorld();
        particle(l, Particle.FLASH, 1, 0, 0, 0, 0, tint, true);
        particle(l, Particle.EXPLOSION_EMITTER, r >= 4 ? 2 : 1, r * 0.2, 0, true);
        particle(l, Particle.EXPLOSION, (int) (r * 3), r * 0.45, 0, true);
        particle(l, Particle.FLAME, (int) (r * 18), r * 0.3, r * 0.25, r * 0.3, 0.12, null, true);
        particle(l, Particle.LAVA, (int) (r * 4), r * 0.3, 0, true);
        // escombros del suelo
        var ground = l.clone().add(0, -1, 0).getBlock().getBlockData();
        if (ground.getMaterial().isAir()) ground = Material.DIRT.createBlockData();
        particle(l, Particle.BLOCK, (int) (r * 22), r * 0.4, 0.3, r * 0.4, 0.3, ground, true);
        // columna de humo
        particle(l.clone().add(0, 1, 0), Particle.CAMPFIRE_SIGNAL_SMOKE, (int) (r * 3), r * 0.25, 0.4, r * 0.25, 0.02, null, true);
        particle(l, Particle.LARGE_SMOKE, (int) (r * 10), r * 0.4, 0.4, r * 0.4, 0.05, null, true);
        sound(l, org.bukkit.Sound.ENTITY_GENERIC_EXPLODE, 4f, 0.55f + rnd.nextFloat() * 0.15f, true);
        sound(l, org.bukkit.Sound.ENTITY_DRAGON_FIREBALL_EXPLODE, 2.5f, 0.6f, true);
        ring(l.clone().add(0, 0.25, 0), r * 1.6, tint, 8);
        if (shakeNear) for (var p : w.getPlayers()) if (p.getLocation().distanceSquared(l) < (r * 6) * (r * 6)) plugin.game.shake();
    }

    /** Onda expansiva: anillo de polvo que se abre en `ticks`. */
    public void ring(Location c, double radius, Color col, int ticks) {
        org.bukkit.Bukkit.getScheduler().runTaskTimer(plugin, new java.util.function.Consumer<org.bukkit.scheduler.BukkitTask>() {
            int t;

            @Override
            public void accept(org.bukkit.scheduler.BukkitTask task) {
                if (t++ >= ticks) {
                    task.cancel();
                    return;
                }
                double rr = radius * t / (double) ticks;
                int n = (int) Math.max(12, rr * 6);
                Particle.DustOptions d = new Particle.DustOptions(col, (float) (2.2 - 1.4 * t / (double) ticks));
                for (int i = 0; i < n; i++) {
                    double a = i * Math.PI * 2 / n;
                    particle(c.clone().add(Math.cos(a) * rr, 0, Math.sin(a) * rr), Particle.DUST, 1, 0, 0, 0, 0, d, true);
                }
                if (t % 2 == 0) for (int i = 0; i < n / 3; i++) {
                    double a = rnd.nextDouble() * Math.PI * 2;
                    particle(c.clone().add(Math.cos(a) * rr, 0.1, Math.sin(a) * rr), Particle.CLOUD, 1, 0, 0, 0, 0.02, null, false);
                }
            }
        }, 0L, 1L);
    }

    /** Estela de un proyectil (cada tick). kind: cohete, granada, calavera, fuego. */
    public void trail(Location l, String kind) {
        switch (kind) {
            case "cohete" -> {
                particle(l, Particle.FLAME, 4, 0.06, 0.06, 0.06, 0.02, null, false);
                particle(l, Particle.CAMPFIRE_COSY_SMOKE, 1, 0.05, 0.05, 0.05, 0.01, null, false);
                particle(l, Particle.LARGE_SMOKE, 2, 0.1, 0.1, 0.1, 0.01, null, false);
            }
            case "granada" -> {
                particle(l, Particle.SMOKE, 2, 0.04, 0.04, 0.04, 0.01, null, false);
                if (plugin.tick() % 4 < 2) particle(l, Particle.DUST, 2, 0.02, 0.02, 0.02, 0, new Particle.DustOptions(Color.RED, 1.2f), false);
            }
            case "calavera" -> {
                particle(l, Particle.SOUL_FIRE_FLAME, 4, 0.18, 0.18, 0.18, 0.02, null, false);
                particle(l, Particle.SMOKE, 3, 0.2, 0.2, 0.2, 0.02, null, false);
                particle(l, Particle.DUST, 3, 0.25, 0.25, 0.25, 0, new Particle.DustOptions(Color.fromRGB(20, 20, 24), 2.2f), false);
                particle(l, Particle.SOUL, 1, 0.2, 0.2, 0.2, 0.02, null, false);
            }
            case "dragon" -> {
                // descarga del dragón: núcleo blanco con halo violeta y cola de chispas
                particle(l, Particle.DUST, 3, 0.12, 0.12, 0.12, 0, new Particle.DustOptions(Color.WHITE, 3.4f), true);
                particle(l, Particle.DUST_COLOR_TRANSITION, 8, 0.45, 0.45, 0.45, 0, new Particle.DustTransition(Color.fromRGB(240, 200, 255), Color.fromRGB(150, 40, 230), 3.6f), true);
                particle(l, Particle.DRAGON_BREATH, 6, 0.4, 0.4, 0.4, 0.02, 1f, false);
                particle(l, Particle.END_ROD, 2, 0.3, 0.3, 0.3, 0.04, null, false);
                particle(l, Particle.REVERSE_PORTAL, 4, 0.3, 0.3, 0.3, 0.05, null, false);
            }
            default -> {
                particle(l, Particle.FLAME, 8, 0.35, 0.35, 0.35, 0.03, null, false);
                particle(l, Particle.DRAGON_BREATH, 4, 0.4, 0.4, 0.4, 0.01, 1f, false);
                particle(l, Particle.LAVA, 1, 0.2, 0.2, 0.2, 0, null, false);
                particle(l, Particle.LARGE_SMOKE, 2, 0.3, 0.3, 0.3, 0.02, null, false);
            }
        }
    }

    private final ArrayDeque<Stain> holes = new ArrayDeque<>();

    /** Agujero de bala en un bloque (unos segundos), con chispas. */
    public void bulletHole(Location at, org.bukkit.block.BlockFace face, BlockData hit) {
        particle(at, Particle.ELECTRIC_SPARK, 3, 0.05, 0.05, 0.05, 0.15, null, false);
        particle(at, Particle.BLOCK, 4, 0.05, 0.05, 0.05, 0.1, hit, false);
        if (face == null || holes.size() > 60 && !take(1, false)) return;
        while (holes.size() >= 60) {
            Stain s = holes.pollFirst();
            if (s != null && s.e().isValid()) s.e().remove();
        }
        org.bukkit.util.Vector n = face.getDirection();
        Location l = at.clone().add(n.clone().multiply(0.01));
        float sz = 0.1f + rnd.nextFloat() * 0.05f;
        BlockDisplay d = at.getWorld().spawn(l, BlockDisplay.class, e -> {
            e.setPersistent(false);
            e.setBlock(Material.BLACK_CONCRETE.createBlockData());
            Quaternionf q = new Quaternionf().rotationTo(new Vector3f(0, 0, 1), new Vector3f((float) n.getX(), (float) n.getY(), (float) n.getZ()));
            e.setTransformation(new Transformation(new Vector3f(-sz / 2, -sz / 2, 0).rotate(q), q, new Vector3f(sz, sz, 0.002f), new Quaternionf()));
            e.setBrightness(new Display.Brightness(0, 0));
            e.setViewRange(0.6f);
        });
        holes.addLast(new Stain(d, plugin.tick() + 160));
    }

    /** Casquillo que sale despedido a la derecha del jugador. */
    public void casing(org.bukkit.entity.Player p, boolean big) {
        Location eye = p.getEyeLocation();
        org.bukkit.util.Vector dir = eye.getDirection();
        org.bukkit.util.Vector right = dir.clone().crossProduct(new org.bukkit.util.Vector(0, 1, 0)).normalize();
        Location at = eye.clone().add(dir.clone().multiply(0.9)).add(right.clone().multiply(0.45)).add(0, -0.35, 0);
        org.bukkit.util.Vector v = right.clone().multiply(0.18 + rnd.nextDouble() * 0.08).add(new org.bukkit.util.Vector(0, 0.16 + rnd.nextDouble() * 0.06, 0));
        at.getWorld().spawnParticle(Particle.ITEM, at, 0, v.getX(), v.getY(), v.getZ(), 1.0, new org.bukkit.inventory.ItemStack(big ? Material.GOLD_INGOT : Material.GOLD_NUGGET), true);
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

    /** Portal de invocación: disco en espiral vertical que gira y se cierra (llegada de un jefe). */
    public void portal(Location center, Color a, Color b, double radius, int ticks) {
        org.bukkit.Bukkit.getScheduler().runTaskTimer(plugin, new java.util.function.Consumer<org.bukkit.scheduler.BukkitTask>() {
            int t;

            @Override
            public void accept(org.bukkit.scheduler.BukkitTask task) {
                if (t++ >= ticks || !plugin.game.running()) {
                    task.cancel();
                    return;
                }
                double f = t / (double) ticks;
                double r = radius * (f < 0.2 ? f / 0.2 : f > 0.8 ? (1 - f) / 0.2 : 1);
                Particle.DustTransition dt = new Particle.DustTransition(a, b, 1.6f);
                for (int arm = 0; arm < 3; arm++) {
                    for (int k = 0; k < 7; k++) {
                        double rr = r * (k + 1) / 7.0;
                        double ang = t * 0.35 + arm * 2.094 + k * 0.55;
                        Location l = center.clone().add(Math.cos(ang) * rr, 0, Math.sin(ang) * rr);
                        particle(l, Particle.DUST_COLOR_TRANSITION, 1, 0, 0, 0, 0, dt, true);
                    }
                }
                if (t % 2 == 0) particle(center, Particle.REVERSE_PORTAL, 12, r * 0.3, 0.2, r * 0.3, 0.6, null, true);
                if (t % 5 == 0) particle(center, Particle.END_ROD, 4, 0.2, 2, 0.2, 0.05, null, true);
            }
        }, 0L, 1L);
    }

    public void clearHoles() {
        for (Stain s : holes) if (s.e().isValid()) s.e().remove();
        holes.clear();
    }

    public void clearStains() {
        clearHoles();
        for (Stain s : stains) if (s.e().isValid()) s.e().remove();
        stains.clear();
    }

    public Random rnd() {
        return rnd;
    }
}
