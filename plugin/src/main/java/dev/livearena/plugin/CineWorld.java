package dev.livearena.plugin;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.Deque;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.Tag;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.block.TileState;
import org.bukkit.block.data.BlockData;
import org.bukkit.entity.BlockDisplay;
import org.bukkit.entity.Entity;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Player;
import org.bukkit.util.Transformation;
import org.bukkit.util.Vector;
import org.joml.Quaternionf;
import org.joml.Vector3f;

/**
 * Servicios de servidor del motor cinemático:
 * destrucción repartida en ticks con presupuesto y restauración gradual (snapshot de cada bloque),
 * bloques voladores (displays con trayectoria), fuerzas (empujar, atraer, sujetar) y daño.
 */
final class CineWorld {
    private final LiveArenaPlugin plugin;
    private final CineFx fx;

    CineWorld(LiveArenaPlugin plugin, CineFx fx) {
        this.plugin = plugin;
        this.fx = fx;
    }

    /* ------------------------------------- config ------------------------------------- */

    int budgetPerTick = 400;
    int maxFlying = 200;
    boolean restore = true;
    int restoreSeconds = 60;
    boolean breakBlocks = true;
    final Set<Material> protectedBlocks = EnumSet.of(Material.BEDROCK, Material.END_PORTAL_FRAME, Material.END_PORTAL, Material.BARRIER, Material.COMMAND_BLOCK,
            Material.CHAIN_COMMAND_BLOCK, Material.REPEATING_COMMAND_BLOCK, Material.STRUCTURE_BLOCK, Material.JIGSAW, Material.NETHER_PORTAL, Material.END_GATEWAY,
            Material.REINFORCED_DEEPSLATE, Material.SPAWNER);

    /* ----------------------------------- destrucción ----------------------------------- */

    private record Job(Block block, Material to) {}

    private final Deque<Job> queue = new ArrayDeque<>();
    /** Snapshot del estado original de cada bloque tocado (el primero gana). */
    private final Map<Block, BlockData> snapshot = new LinkedHashMap<>();
    private final Deque<Map.Entry<Long, List<Block>>> restoreQueue = new ArrayDeque<>();
    private final Deque<Block> restoring = new ArrayDeque<>();
    private long tick;

    boolean breakable(Block b) {
        Material m = b.getType();
        if (m.isAir() || protectedBlocks.contains(m)) return false;
        if (b.getY() <= b.getWorld().getMinHeight()) return false;
        try {
            if (b.getState(false) instanceof TileState) return false; // cofres, hornos, carteles…
        } catch (Throwable ignored) {
            return false;
        }
        return true;
    }

    static boolean fragile(Material m) {
        return Tag.LEAVES.isTagged(m) || Tag.FLOWERS.isTagged(m) || m.name().contains("GLASS") || m == Material.SNOW || m == Material.SHORT_GRASS
                || m == Material.TALL_GRASS || m == Material.FERN || m == Material.LARGE_FERN || m == Material.DEAD_BUSH || m == Material.VINE;
    }

    /** Encola el cambio de un bloque a `to` (AIR para romper). Respeta protecciones y la config. */
    void set(Block b, Material to) {
        if (!breakBlocks || !breakable(b)) return;
        queue.add(new Job(b, to));
    }

    /** Ordena los bloques por distancia al centro (de dentro a fuera, o al revés) y los encola. */
    void enqueueSorted(Collection<Block> blocks, Location center, boolean insideOut, Material to) {
        List<Block> list = new ArrayList<>(blocks);
        Comparator<Block> cmp = Comparator.comparingDouble(b -> b.getLocation().add(0.5, 0.5, 0.5).distanceSquared(center));
        list.sort(insideOut ? cmp : cmp.reversed());
        for (Block b : list) set(b, to);
    }

    /** Esfera de radio r. */
    List<Block> sphere(Location c, double r) {
        List<Block> out = new ArrayList<>();
        int R = (int) Math.ceil(r);
        World w = c.getWorld();
        for (int x = -R; x <= R; x++)
            for (int y = -R; y <= R; y++)
                for (int z = -R; z <= R; z++)
                    if (x * x + y * y + z * z <= r * r) out.add(w.getBlockAt(c.getBlockX() + x, c.getBlockY() + y, c.getBlockZ() + z));
        return out;
    }

    /**
     * Cráter en forma de cuenco: radio horizontal r, profundidad depth. Con borde elevado, el anillo exterior
     * recibe bloques extra. Decoración (fuego, magma, obsidiana) con probabilidad sobre la superficie del cuenco.
     */
    void bowlCrater(Location c, int r, int depth, boolean rim, double fire, double magma, double obsidian, Random rnd) {
        World w = c.getWorld();
        int cx = c.getBlockX(), cy = c.getBlockY(), cz = c.getBlockZ();
        List<Block> air = new ArrayList<>();
        List<Block> deco = new ArrayList<>();
        List<Block> rimBlocks = new ArrayList<>();
        for (int x = -r; x <= r; x++)
            for (int z = -r; z <= r; z++) {
                double d = Math.sqrt(x * x + z * z) / r;
                if (d > 1.0) continue;
                int floor = (int) Math.round(-depth * (1 - d * d)); // parábola
                for (int y = floor; y <= 6; y++) air.add(w.getBlockAt(cx + x, cy + y, cz + z));
                deco.add(w.getBlockAt(cx + x, cy + floor - 1, cz + z));
            }
        if (rim)
            for (int x = -r - 3; x <= r + 3; x++)
                for (int z = -r - 3; z <= r + 3; z++) {
                    double d = Math.sqrt(x * x + z * z);
                    if (d <= r || d > r + 3) continue;
                    int h = (int) Math.round(2.2 * (1 - (d - r) / 3.0));
                    Block top = w.getHighestBlockAt(cx + x, cz + z);
                    if (top.getY() > cy + 4 || top.getY() < cy - 6) continue;
                    for (int k = 1; k <= h; k++) rimBlocks.add(top.getRelative(0, k, 0));
                }
        enqueueSorted(air, c, true, Material.AIR);
        for (Block b : rimBlocks) queueAdd(b, rnd.nextDouble() < 0.5 ? Material.COARSE_DIRT : Material.COBBLESTONE);
        for (Block b : deco) {
            double p = rnd.nextDouble();
            if (p < magma) set(b, Material.MAGMA_BLOCK);
            else if (p < magma + obsidian) set(b, Material.OBSIDIAN);
            else if (p < magma + obsidian + 0.25) set(b, Material.BLACKSTONE);
            if (rnd.nextDouble() < fire) queueAdd(b.getRelative(0, 1, 0), Material.FIRE);
        }
    }

    /** Añadir bloques donde hay aire (borde del cráter, fuego): también se restaura. */
    private void queueAdd(Block b, Material to) {
        if (!breakBlocks) return;
        if (!b.getType().isAir() && b.getType() != Material.SHORT_GRASS) return;
        queue.add(new Job(b, to));
    }

    /** Cilindro vertical (para el pilar final del juicio). */
    List<Block> cylinder(Location c, double r, int depth, int up) {
        List<Block> out = new ArrayList<>();
        World w = c.getWorld();
        int R = (int) Math.ceil(r);
        for (int x = -R; x <= R; x++)
            for (int z = -R; z <= R; z++)
                if (x * x + z * z <= r * r)
                    for (int y = -depth; y <= up; y++) out.add(w.getBlockAt(c.getBlockX() + x, c.getBlockY() + y, c.getBlockZ() + z));
        return out;
    }

    /** Plano fino orientado (corte limpio): `along` dirección del corte, `normal` normal del plano. */
    List<Block> slabPlane(Location c, Vector along, Vector normal, double length, double height) {
        Set<Block> out = new HashSet<>();
        Vector a = along.clone().normalize();
        Vector n = normal.clone().normalize();
        Vector up = n.clone().crossProduct(a).normalize();
        World w = c.getWorld();
        for (double s = -length / 2; s <= length / 2; s += 0.5)
            for (double h = -height / 2; h <= height / 2; h += 0.5) {
                Location l = c.clone().add(a.clone().multiply(s)).add(up.clone().multiply(h));
                out.add(w.getBlockAt(l));
            }
        return new ArrayList<>(out);
    }

    /** Lo llama el motor cada tick: aplica la cola con presupuesto y restaura lo que toque. */
    void tick(long now) {
        tick = now;
        int budget = budgetPerTick;
        List<Block> changed = new ArrayList<>();
        while (budget-- > 0 && !queue.isEmpty()) {
            Job j = queue.poll();
            Block b = j.block();
            if (b.getType() == j.to()) continue;
            if (j.to() == Material.AIR && !breakable(b)) continue;
            snapshot.putIfAbsent(b, b.getBlockData().clone());
            b.setType(j.to(), false);
            changed.add(b);
            if (j.to() == Material.AIR && Math.random() < 0.04)
                b.getWorld().spawnParticle(Particle.BLOCK, b.getLocation().add(0.5, 0.5, 0.5), 4, 0.3, 0.3, 0.3, 0, snapshot.get(b), true);
        }
        if (restore && !changed.isEmpty()) restoreQueue.add(Map.entry(now + restoreSeconds * 20L, changed));
        while (!restoreQueue.isEmpty() && restoreQueue.peek().getKey() <= now) restoring.addAll(restoreQueue.poll().getValue());
        int rb = Math.max(50, budgetPerTick / 2);
        while (rb-- > 0 && !restoring.isEmpty()) {
            Block b = restoring.poll();
            BlockData orig = snapshot.remove(b);
            if (orig != null) b.setBlockData(orig, false);
        }
        tickFlying();
    }

    /** Restaura todo de golpe (al apagar el servidor). */
    void restoreAllNow() {
        queue.clear();
        if (!restore) {
            snapshot.clear();
            return;
        }
        for (Map.Entry<Block, BlockData> e : snapshot.entrySet()) e.getKey().setBlockData(e.getValue(), false);
        snapshot.clear();
        restoreQueue.clear();
        restoring.clear();
    }

    int pending() {
        return queue.size();
    }

    /* --------------------------------- bloques voladores --------------------------------- */

    enum Path { LAUNCH, ORBIT, SPIRAL_IN, HOVER }

    private static final class Flyer {
        BlockDisplay d;
        Path path;
        Location center;
        Vector pos, vel;
        double angle, radius, height, speed;
        int age, life;
        float spin;
    }

    private final List<Flyer> flyers = new ArrayList<>();

    int flyingCount() {
        return flyers.size();
    }

    /**
     * Arranca un bloque y lo convierte en bloque volador (solo visual). Si se supera el límite global, el bloque
     * se destruye igualmente pero sin visual. Devuelve false si no se pudo arrancar.
     */
    boolean fly(Block b, Path path, Location center, Vector vel, int life, double speed) {
        if (!breakBlocks || !breakable(b)) return false;
        BlockData data = b.getBlockData().clone();
        set(b, Material.AIR);
        if (flyers.size() >= maxFlying) return true;
        flyVisual(b.getLocation().add(0.5, 0.5, 0.5), data, path, center, vel, life, speed);
        return true;
    }

    /** Bloque volador solo visual (no toca el mundo). */
    void flyVisual(Location at, BlockData data, Path path, Location center, Vector vel, int life, double speed) {
        if (flyers.size() >= maxFlying) return;
        Flyer f = new Flyer();
        f.d = fx.blockDisplay(at, data, -1, life + 40);
        f.d.setTransformation(new Transformation(new Vector3f(-0.5f, -0.5f, -0.5f), new Quaternionf(), new Vector3f(1, 1, 1), new Quaternionf()));
        f.path = path;
        f.center = center == null ? at.clone() : center.clone();
        f.pos = at.toVector();
        f.vel = vel == null ? new Vector() : vel.clone();
        Vector rel = f.pos.clone().subtract(f.center.toVector());
        f.angle = Math.atan2(rel.getZ(), rel.getX());
        f.radius = Math.hypot(rel.getX(), rel.getZ());
        f.height = rel.getY();
        f.speed = speed;
        f.life = life;
        f.spin = (float) (Math.random() * 0.4 + 0.1);
        flyers.add(f);
    }

    private void tickFlying() {
        for (Iterator<Flyer> it = flyers.iterator(); it.hasNext(); ) {
            Flyer f = it.next();
            if (!f.d.isValid() || ++f.age > f.life) {
                if (f.d.isValid()) f.d.remove();
                it.remove();
                continue;
            }
            switch (f.path) {
                case LAUNCH -> {
                    f.vel.setY(f.vel.getY() - 0.06);
                    f.pos.add(f.vel);
                }
                case ORBIT -> {
                    f.angle += f.speed;
                    f.pos = f.center.toVector().add(new Vector(Math.cos(f.angle) * f.radius, f.height + Math.sin(f.age * 0.1) * 0.3, Math.sin(f.angle) * f.radius));
                }
                case SPIRAL_IN -> {
                    f.angle += f.speed * (1 + 6 / Math.max(1, f.radius));
                    f.radius = Math.max(0, f.radius - 0.12 - f.speed * 0.6);
                    f.height += (0 - f.height) * 0.06;
                    f.pos = f.center.toVector().add(new Vector(Math.cos(f.angle) * f.radius, f.height, Math.sin(f.angle) * f.radius));
                    if (f.radius < 0.6) f.age = f.life + 1;
                }
                case HOVER -> {
                    f.pos.add(f.vel);
                    f.vel.multiply(0.9);
                }
            }
            Location to = f.pos.toLocation(f.d.getWorld());
            f.d.teleport(to);
            if (f.age % 2 == 0) {
                float a = f.age * f.spin;
                CineFx.shape(f.d, new Vector3f(-0.5f, -0.5f, -0.5f).rotate(new Quaternionf().rotateXYZ(a, a * 0.7f, a * 0.3f)), new Quaternionf().rotateXYZ(a, a * 0.7f, a * 0.3f), new Vector3f(1, 1, 1), 2);
            }
        }
    }

    /** Hace caer de golpe todos los bloques flotantes (HOVER/ORBIT) cerca de un punto. */
    void dropFlyers(Location c, double radius) {
        for (Flyer f : flyers)
            if ((f.path == Path.HOVER || f.path == Path.ORBIT) && f.pos.distanceSquared(c.toVector()) < radius * radius) {
                f.path = Path.LAUNCH;
                f.vel = new Vector(0, -1.4, 0);
                f.life = f.age + 14;
            }
    }

    void clearFlying() {
        for (Flyer f : flyers) if (f.d.isValid()) f.d.remove();
        flyers.clear();
    }

    /* ------------------------------------- fuerzas ------------------------------------- */

    static boolean affectable(Entity e, Player launcher) {
        if (!(e instanceof LivingEntity) || e == launcher) return false;
        if (e.getScoreboardTags().contains(CineFx.TAG)) return false;
        if (e instanceof Player p && (p.getGameMode() == GameMode.CREATIVE || p.getGameMode() == GameMode.SPECTATOR)) return false;
        return true;
    }

    /** Empuja (fuerza > 0) o atrae (fuerza < 0) con caída lineal por distancia. */
    static void radial(Location c, double radius, double force, double up, Player launcher, UUID except) {
        for (Entity e : c.getWorld().getNearbyEntities(c, radius, radius, radius)) {
            if (!affectable(e, launcher) || e.getUniqueId().equals(except)) continue;
            Vector v = e.getLocation().toVector().subtract(c.toVector());
            double d = v.length();
            if (d > radius) continue;
            if (d < 0.05) v = new Vector(0, 1, 0);
            double k = force * (1 - d / radius);
            e.setVelocity(v.normalize().multiply(k).setY(up));
        }
    }

    /** Atrae hacia un punto sin pasarse (amortiguado cerca del centro para no rebotar al otro lado). */
    static void pull(Location c, double radius, double maxForce, Player launcher) {
        for (Entity e : c.getWorld().getNearbyEntities(c, radius, radius, radius)) {
            if (!affectable(e, launcher) && !(e instanceof org.bukkit.entity.Item)) continue;
            Vector to = c.toVector().subtract(e.getLocation().toVector());
            double d = to.length();
            if (d > radius || d < 0.01) continue;
            double k = maxForce * (1.2 - d / radius);
            Vector want = to.normalize().multiply(Math.min(k * 4, d * 0.25));
            Vector v = e.getVelocity().multiply(0.6).add(want.multiply(0.6));
            e.setVelocity(v);
            e.setFallDistance(0);
        }
    }

    /** Sujeta una entidad en un punto (la acerca suavemente; para jugadores sin tirones). */
    static void hold(Entity e, Location point) {
        Vector to = point.toVector().subtract(e.getLocation().toVector());
        e.setVelocity(to.multiply(0.35));
        e.setFallDistance(0);
    }

    /* -------------------------------------- daño -------------------------------------- */

    boolean nonLethal() {
        return plugin.getConfig().getBoolean("cinematicas.danio-no-letal", false);
    }

    /** Daño de habilidad. ignoreIframes = golpes rápidos (cada golpe cuenta). */
    void damage(LivingEntity e, double amount, boolean ignoreIframes, Player launcher) {
        if (amount <= 0 || e.isDead() || !affectable(e, launcher)) return;
        if (nonLethal() && e instanceof Player p) amount = Math.min(amount, Math.max(0, p.getHealth() + p.getAbsorptionAmount() - 2));
        if (amount <= 0) return;
        if (ignoreIframes) e.setNoDamageTicks(0);
        e.damage(amount);
        if (ignoreIframes) e.setNoDamageTicks(0);
    }

    /** Daño en área con caída lineal. */
    void areaDamage(Location c, double radius, double max, Player launcher, UUID except) {
        for (Entity e : c.getWorld().getNearbyEntities(c, radius, radius, radius)) {
            if (!(e instanceof LivingEntity le) || e.getUniqueId().equals(except)) continue;
            double d = e.getLocation().distance(c);
            if (d > radius) continue;
            damage(le, Math.max(1, max * (1 - d / radius)), false, launcher);
        }
    }
}
