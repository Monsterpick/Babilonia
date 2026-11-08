package dev.livearena.plugin;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.IntConsumer;
import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.sound.Sound;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextColor;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.title.Title;
import org.bukkit.Bukkit;
import org.bukkit.Color;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.block.data.BlockData;
import org.bukkit.entity.BlockDisplay;
import org.bukkit.entity.Display;
import org.bukkit.entity.Entity;
import org.bukkit.entity.FallingBlock;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.scheduler.BukkitTask;
import org.bukkit.util.Transformation;
import org.bukkit.util.Vector;
import org.joml.AxisAngle4f;
import org.joml.Vector3f;

/**
 * Caja de herramientas visual de LiveArena: partículas geométricas (anillos, esferas, rayos, estrellas),
 * figuras con «display entities», cuentas atrás con barra, títulos grandes, cráteres y golpes que consumen tótems.
 * Todo es vanilla (sin resource packs), así que funciona en cualquier cliente.
 */
final class Vfx {
    private final LiveArenaPlugin plugin;
    private final List<Entity> spawned = new ArrayList<>();

    Vfx(LiveArenaPlugin plugin) {
        this.plugin = plugin;
    }

    static ThreadLocalRandom rnd() {
        return ThreadLocalRandom.current();
    }

    /* ---------------------------------- tiempo ---------------------------------- */

    /** Repite cada `period` ticks durante `duration` ticks; el consumidor recibe el tick (0, period, 2·period…). */
    BukkitTask repeat(long delay, long period, int duration, IntConsumer step) {
        final int[] t = {0};
        final BukkitTask[] task = new BukkitTask[1];
        task[0] = Bukkit.getScheduler().runTaskTimer(plugin, () -> {
            if (t[0] > duration) {
                task[0].cancel();
                return;
            }
            try {
                step.accept(t[0]);
            } catch (RuntimeException ex) {
                plugin.getLogger().warning("Efecto: " + ex);
                task[0].cancel();
            }
            t[0] += (int) period;
        }, delay, period);
        return task[0];
    }

    void later(long delay, Runnable r) {
        Bukkit.getScheduler().runTaskLater(plugin, r, delay);
    }

    /* -------------------------------- partículas -------------------------------- */

    static Particle.DustOptions dust(int rgb, float size) {
        return new Particle.DustOptions(Color.fromRGB((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255), size);
    }

    static void p(World w, Particle particle, Location l, int count, double spread, double speed) {
        w.spawnParticle(particle, l, count, spread, spread, spread, speed, null, true);
    }

    static void dot(World w, Location l, Particle.DustOptions d) {
        w.spawnParticle(Particle.DUST, l, 1, 0, 0, 0, 0, d, true);
    }

    /** Anillo horizontal. `phase` en radianes permite girarlo. */
    static void ring(World w, Location c, double r, int points, Particle.DustOptions d, double phase) {
        for (int i = 0; i < points; i++) {
            double a = phase + i * Math.PI * 2 / points;
            dot(w, c.clone().add(Math.cos(a) * r, 0, Math.sin(a) * r), d);
        }
    }

    static void ringParticle(World w, Location c, double r, int points, Particle particle, double phase) {
        for (int i = 0; i < points; i++) {
            double a = phase + i * Math.PI * 2 / points;
            w.spawnParticle(particle, c.clone().add(Math.cos(a) * r, 0, Math.sin(a) * r), 1, 0, 0, 0, 0, null, true);
        }
    }

    /** Esfera (puntos repartidos en espiral de Fibonacci). */
    static void sphere(World w, Location c, double r, int points, Particle.DustOptions d) {
        double g = Math.PI * (3 - Math.sqrt(5));
        for (int i = 0; i < points; i++) {
            double y = 1 - (i / (double) (points - 1)) * 2;
            double rr = Math.sqrt(1 - y * y);
            double a = g * i;
            dot(w, c.clone().add(Math.cos(a) * rr * r, y * r, Math.sin(a) * rr * r), d);
        }
    }

    static void sphereParticle(World w, Location c, double r, int points, Particle particle) {
        double g = Math.PI * (3 - Math.sqrt(5));
        for (int i = 0; i < points; i++) {
            double y = 1 - (i / (double) (points - 1)) * 2;
            double rr = Math.sqrt(1 - y * y);
            double a = g * i;
            w.spawnParticle(particle, c.clone().add(Math.cos(a) * rr * r, y * r, Math.sin(a) * rr * r), 1, 0, 0, 0, 0, null, true);
        }
    }

    /** Línea recta entre dos puntos. */
    static void line(World w, Location a, Location b, double step, Particle.DustOptions d) {
        Vector dir = b.toVector().subtract(a.toVector());
        double len = dir.length();
        if (len < 0.001) return;
        dir.normalize().multiply(step);
        Location l = a.clone();
        for (double s = 0; s <= len; s += step) {
            dot(w, l, d);
            l.add(dir);
        }
    }

    static void lineParticle(World w, Location a, Location b, double step, Particle particle) {
        Vector dir = b.toVector().subtract(a.toVector());
        double len = dir.length();
        if (len < 0.001) return;
        dir.normalize().multiply(step);
        Location l = a.clone();
        for (double s = 0; s <= len; s += step) {
            w.spawnParticle(particle, l, 1, 0, 0, 0, 0, null, true);
            l.add(dir);
        }
    }

    /** Rayo grueso vertical (varias líneas juntas). */
    static void beam(World w, Location top, Location bottom, double radius, Particle.DustOptions d) {
        line(w, top, bottom, 0.35, d);
        for (int i = 0; i < 4; i++) {
            double a = i * Math.PI / 2;
            Vector off = new Vector(Math.cos(a) * radius, 0, Math.sin(a) * radius);
            line(w, top.clone().add(off), bottom.clone().add(off), 0.6, d);
        }
    }

    /** Polígono estrellado (p. ej. pentagrama con n=5, salto=2) en horizontal. */
    static void star(World w, Location c, double r, int n, int skip, Particle.DustOptions d, double phase) {
        for (int i = 0; i < n; i++) {
            double a1 = phase + i * Math.PI * 2 / n;
            double a2 = phase + ((i + skip) % n) * Math.PI * 2 / n;
            line(w, c.clone().add(Math.cos(a1) * r, 0, Math.sin(a1) * r), c.clone().add(Math.cos(a2) * r, 0, Math.sin(a2) * r), 0.3, d);
        }
    }

    /** Copo de nieve / brújula de 12 brazos con ramitas (en el suelo). */
    static void snowflake(World w, Location c, double r, Particle.DustOptions d, double phase) {
        for (int i = 0; i < 12; i++) {
            double a = phase + i * Math.PI / 6;
            Location tip = c.clone().add(Math.cos(a) * r, 0, Math.sin(a) * r);
            line(w, c, tip, 0.3, d);
            for (double f : new double[] {0.45, 0.7}) {
                Location base = c.clone().add(Math.cos(a) * r * f, 0, Math.sin(a) * r * f);
                for (int s = -1; s <= 1; s += 2) {
                    double b = a + s * 0.6;
                    line(w, base, base.clone().add(Math.cos(b) * r * 0.22, 0, Math.sin(b) * r * 0.22), 0.3, d);
                }
            }
        }
        ring(w, c, r * 0.3, 24, d, phase);
    }

    /* ------------------------------ display entities ------------------------------ */

    BlockDisplay block(Location l, Material m, float sx, float sy, float sz) {
        BlockData data = m.createBlockData();
        BlockDisplay d = l.getWorld().spawn(l, BlockDisplay.class, e -> {
            e.setBlock(data);
            e.setTransformation(new Transformation(new Vector3f(-sx / 2, -sy / 2, -sz / 2), new AxisAngle4f(), new Vector3f(sx, sy, sz), new AxisAngle4f()));
            e.setPersistent(false);
            e.setViewRange(4f);
            e.setTeleportDuration(2);
        });
        spawned.add(d);
        return d;
    }

    ItemDisplay item(Location l, ItemStack it, float scale) {
        ItemDisplay d = l.getWorld().spawn(l, ItemDisplay.class, e -> {
            e.setItemStack(it);
            e.setTransformation(new Transformation(new Vector3f(), new AxisAngle4f(), new Vector3f(scale, scale, scale), new AxisAngle4f()));
            e.setPersistent(false);
            e.setViewRange(4f);
            e.setTeleportDuration(2);
        });
        spawned.add(d);
        return d;
    }

    static void rotate(Display d, float angle, float ax, float ay, float az, float scale) {
        d.setInterpolationDelay(0);
        d.setInterpolationDuration(3);
        d.setTransformation(new Transformation(new Vector3f(), new AxisAngle4f(angle, ax, ay, az), new Vector3f(scale, scale, scale), new AxisAngle4f()));
    }

    void remove(Entity... es) {
        for (Entity e : es) if (e != null && e.isValid()) e.remove();
    }

    /** Quita todo lo que haya quedado de efectos (al desactivar el plugin o con /la limpiar). */
    int cleanup() {
        int n = 0;
        for (Entity e : spawned) if (e.isValid()) {
            e.remove();
            n++;
        }
        spawned.clear();
        return n;
    }

    /* ------------------------------ textos y barras ------------------------------ */

    static void bigTitle(Player p, String title, TextColor color, String sub, TextColor subColor, int stayMs) {
        p.showTitle(Title.title(Component.text(title, color).decorate(TextDecoration.BOLD), Component.text(sub, subColor),
                Title.Times.times(Duration.ofMillis(100), Duration.ofMillis(stayMs), Duration.ofMillis(400))));
    }

    static void actionBar(Player p, String text, TextColor color) {
        p.sendActionBar(Component.text(text, color).decorate(TextDecoration.BOLD));
    }

    /** Barra de jefe con cuenta atrás; al terminar llama a `done`. */
    void countdown(Player p, String label, BossBar.Color color, int seconds, Runnable done) {
        BossBar bar = BossBar.bossBar(Component.text(label.replace("%s", String.valueOf(seconds)), NamedTextColor.RED).decorate(TextDecoration.BOLD), 1f, color, BossBar.Overlay.NOTCHED_10);
        p.showBossBar(bar);
        repeat(20, 20, (seconds - 1) * 20, t -> {
            int left = seconds - 1 - t / 20;
            bar.name(Component.text(label.replace("%s", String.valueOf(left)), NamedTextColor.RED).decorate(TextDecoration.BOLD));
            bar.progress(Math.max(0f, left / (float) seconds));
            sound(p, "block.note_block.pling", 1f, left <= 3 ? 2f : 1.2f);
        });
        later(seconds * 20L, () -> {
            p.hideBossBar(bar);
            done.run();
        });
    }

    /** Barra con progreso libre (la controla quien la crea). */
    static BossBar bar(Player p, String text, TextColor color, BossBar.Color barColor) {
        BossBar b = BossBar.bossBar(Component.text(text, color).decorate(TextDecoration.BOLD), 1f, barColor, BossBar.Overlay.PROGRESS);
        p.showBossBar(b);
        return b;
    }

    static void sound(Player p, String key, float vol, float pitch) {
        p.playSound(Sound.sound(Key.key("minecraft", key), Sound.Source.MASTER, vol, pitch));
    }

    /** Sonido para todos los jugadores cercanos. */
    static void soundAt(Location l, String key, float vol, float pitch) {
        for (Player p : l.getWorld().getPlayers())
            if (p.getLocation().distanceSquared(l) < 120 * 120) p.playSound(Sound.sound(Key.key("minecraft", key), Sound.Source.MASTER, vol, pitch));
    }

    /* ------------------------------- daño y terreno ------------------------------- */

    boolean breakBlocks() {
        return plugin.getConfig().getBoolean("efectos.romper-bloques", true);
    }

    double hitDamage() {
        return plugin.getConfig().getDouble("efectos.danio-golpe", 1000.0);
    }

    /**
     * Golpe de un efecto especial. Por defecto es letal: si tienes tótems (en la mano o apilados) gastas uno
     * por golpe y sigues vivo; si no, mueres. Se ajusta con efectos.danio-golpe en config.yml.
     */
    void hit(Player p) {
        if (!p.isOnline() || p.isDead()) return;
        p.setNoDamageTicks(0);
        p.damage(hitDamage());
        p.setNoDamageTicks(0);
    }

    /** Serie de golpes, uno cada `every` ticks, con contador en la barra de acción. */
    void hits(Player p, int count, long every, String label) {
        for (int i = 0; i < count; i++) {
            final int k = i + 1;
            later(i * every, () -> {
                hit(p);
                actionBar(p, label + " " + k + " / " + count, NamedTextColor.GREEN);
            });
        }
    }

    /** Cráter esférico; el borde se llena de bloques chamuscados y fuego. No toca la roca madre. */
    void crater(Location c, int r, boolean fire) {
        if (!breakBlocks()) return;
        World w = c.getWorld();
        int cx = c.getBlockX(), cy = c.getBlockY(), cz = c.getBlockZ();
        Material[] rim = {Material.BLACKSTONE, Material.MAGMA_BLOCK, Material.COBBLED_DEEPSLATE, Material.COARSE_DIRT, Material.BASALT};
        for (int x = -r - 1; x <= r + 1; x++)
            for (int y = -r - 1; y <= r + 1; y++)
                for (int z = -r - 1; z <= r + 1; z++) {
                    double d = Math.sqrt(x * x + y * y * 1.6 + z * z);
                    Block b = w.getBlockAt(cx + x, cy + y, cz + z);
                    if (b.getType() == Material.BEDROCK || b.getType().isAir()) continue;
                    if (d <= r) b.setType(Material.AIR, false);
                    else if (d <= r + 1.2 && rnd().nextDouble() < 0.7) b.setType(rim[rnd().nextInt(rim.length)], false);
                }
        if (fire)
            for (int i = 0; i < r * 4; i++) {
                double a = rnd().nextDouble(Math.PI * 2);
                double dd = r * (0.6 + rnd().nextDouble(0.7));
                Block top = w.getHighestBlockAt((int) (cx + Math.cos(a) * dd), (int) (cz + Math.sin(a) * dd));
                Block above = top.getRelative(0, 1, 0);
                if (above.getType().isAir() && top.getType().isSolid()) above.setType(Material.FIRE, false);
            }
    }

    /** Bloques que salen volando desde un anillo (FallingBlock que no deja bloque al caer). */
    void flingBlocks(Location c, double r, int n, double power) {
        if (!breakBlocks()) return;
        World w = c.getWorld();
        for (int i = 0; i < n; i++) {
            double a = rnd().nextDouble(Math.PI * 2);
            double dd = r * rnd().nextDouble(0.5, 1.0);
            Block b = w.getHighestBlockAt((int) (c.getX() + Math.cos(a) * dd), (int) (c.getZ() + Math.sin(a) * dd));
            if (b.getType() == Material.BEDROCK || !b.getType().isSolid()) continue;
            BlockData data = b.getBlockData();
            b.setType(Material.AIR, false);
            FallingBlock fb = w.spawnFallingBlock(b.getLocation().add(0.5, 1, 0.5), data);
            fb.setDropItem(false);
            fb.setCancelDrop(true);
            fb.setHurtEntities(false);
            fb.setVelocity(new Vector(Math.cos(a) * power * 0.5, power * rnd().nextDouble(0.6, 1.1), Math.sin(a) * power * 0.5));
            later(60, () -> {
                if (fb.isValid()) fb.remove();
            });
        }
    }

    /** Empuja (o atrae, con fuerza negativa) a todas las entidades vivas en un radio. */
    static void push(Location c, double radius, double force, double up, Player exceptOrNull) {
        for (Entity e : c.getWorld().getNearbyEntities(c, radius, radius, radius)) {
            if (!(e instanceof LivingEntity) || e == exceptOrNull) continue;
            Vector v = e.getLocation().toVector().subtract(c.toVector());
            if (v.lengthSquared() < 0.01) v = new Vector(0, 1, 0);
            v.normalize().multiply(force).setY(up);
            e.setVelocity(v);
        }
    }
}
