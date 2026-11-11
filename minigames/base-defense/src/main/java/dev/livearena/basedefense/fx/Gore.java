package dev.livearena.basedefense.fx;

import dev.livearena.basedefense.BaseDefense;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Random;
import org.bukkit.Color;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.entity.Display;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.inventory.ItemStack;
import org.bukkit.scheduler.BukkitTask;
import org.bukkit.util.Transformation;
import org.bukkit.util.Vector;
import org.joml.Quaternionf;
import org.joml.Vector3f;

/**
 * Desmembramiento: piezas 3D (modelos del pack con la piel propia del zombi) que salen despedidas al matar, giran,
 * rebotan en el suelo dejando sangre y se desvanecen. Física sencilla hecha aquí (gravedad, rebote, rozamiento) y
 * movida con interpolación para que se vea suave. Sin el pack de texturas no se crean piezas (solo sangre).
 */
public final class Gore {
    private final BaseDefense plugin;
    private final List<Piece> pieces = new ArrayList<>();
    private BukkitTask task;

    private static final class Piece {
        ItemDisplay d;
        Vector pos, vel;
        Vector3f axis;
        float angle, spin, scale;
        double floor;
        int age, life;
        boolean landed;
    }

    public Gore(BaseDefense plugin) {
        this.plugin = plugin;
    }

    private Random rnd() {
        return plugin.fx.rnd();
    }

    private boolean enabled() {
        return plugin.settings.gore && plugin.pack.loaded(plugin.game.streamer());
    }

    /**
     * Zombi hecho pedazos. full = explosión (cuerpo entero en piezas, el cadáver desaparece); si no, salen volando
     * uno o dos miembros (la cabeza si fue un tiro a la cabeza).
     *
     * @return true si el cuerpo se ha deshecho del todo (hay que quitar la entidad)
     */
    public boolean zombie(Location feet, double scale, Vector push, boolean full, boolean head) {
        blood(feet, scale, full);
        if (!enabled()) return false;
        float s = (float) scale;
        if (full) {
            spawn("parte_cabeza", feet, 1.75 * s, s, push, 0.55);
            spawn("parte_torso", feet, 1.15 * s, s, push, 0.3);
            spawn("parte_brazo", feet, 1.3 * s, s, push, 0.5);
            spawn("parte_brazo", feet, 1.3 * s, s, push, 0.5);
            spawn("parte_pierna", feet, 0.5 * s, s, push, 0.35);
            spawn("parte_pierna", feet, 0.5 * s, s, push, 0.35);
            for (int i = 0; i < 4; i++) spawn(rnd().nextBoolean() ? "trozo_carne" : "trozo_hueso", feet, 1.0 * s, s, push, 0.7);
            plugin.fx.sound(feet, Sound.ENTITY_SLIME_SQUISH, 1.2f, 0.55f, false);
            plugin.fx.sound(feet, Sound.BLOCK_HONEY_BLOCK_BREAK, 1.0f, 0.6f, false);
            return true;
        }
        if (head) spawn("parte_cabeza", feet, 1.75 * s, s, push, 0.45);
        else spawn(rnd().nextInt(3) == 0 ? "parte_pierna" : "parte_brazo", feet, 1.2 * s, s, push, 0.4);
        if (rnd().nextInt(3) == 0) spawn("parte_brazo", feet, 1.3 * s, s, push, 0.4);
        spawn("trozo_carne", feet, 1.2 * s, s, push, 0.5);
        plugin.fx.sound(feet, Sound.ENTITY_SLIME_SQUISH_SMALL, 1.0f, 0.7f, false);
        return false;
    }

    /** Trozos genéricos (carne o hueso) para los mobs que no son zombis. */
    public void chunks(Location feet, double height, Vector push, boolean bone, boolean full) {
        blood(feet, height / 1.9, full);
        if (!enabled()) return;
        int n = full ? 6 : 2;
        for (int i = 0; i < n; i++) spawn(bone || rnd().nextInt(3) == 0 ? "trozo_hueso" : "trozo_carne", feet, height * (0.3 + rnd().nextDouble() * 0.6), 1f, push, 0.6);
    }

    private void blood(Location feet, double scale, boolean full) {
        Location c = feet.clone().add(0, 1.0 * scale, 0);
        plugin.fx.particle(c, Particle.BLOCK, full ? 40 : 18, 0.3 * scale, 0.4 * scale, 0.3 * scale, 0.15, Material.REDSTONE_BLOCK.createBlockData(), false);
        plugin.fx.dust(c, Color.fromRGB(110, 0, 0), 1.8f, full ? 22 : 10, 0.4 * scale, false);
        if (full) plugin.fx.dust(c, Color.fromRGB(60, 0, 0), 2.6f, 12, 0.7 * scale, false);
    }

    private void spawn(String model, Location feet, double y, float scale, Vector push, double up) {
        if (pieces.size() > plugin.settings.goreMax) {
            Piece old = pieces.removeFirst();
            if (old.d.isValid()) old.d.remove();
        }
        Random r = rnd();
        Piece p = new Piece();
        p.pos = feet.toVector().add(new Vector((r.nextDouble() - 0.5) * 0.4 * scale, y, (r.nextDouble() - 0.5) * 0.4 * scale));
        Vector out = new Vector(r.nextGaussian(), 0, r.nextGaussian()).normalize().multiply(0.08 + r.nextDouble() * 0.14);
        p.vel = out.add(push.clone().multiply(0.6 + r.nextDouble() * 0.6)).setY(0.18 + r.nextDouble() * up);
        p.axis = new Vector3f((float) r.nextGaussian(), (float) r.nextGaussian(), (float) r.nextGaussian()).normalize();
        p.spin = (float) ((0.25 + r.nextDouble() * 0.45) * (r.nextBoolean() ? 1 : -1));
        p.scale = scale;
        p.floor = feet.getY();
        p.life = plugin.settings.goreSeconds * 20 + r.nextInt(30);
        ItemStack it = new ItemStack(Material.ROTTEN_FLESH);
        var m = it.getItemMeta();
        m.setItemModel(org.bukkit.NamespacedKey.fromString("basedefense:" + model));
        it.setItemMeta(m);
        Location at = p.pos.toLocation(feet.getWorld());
        p.d = feet.getWorld().spawn(at, ItemDisplay.class, d -> {
            d.setPersistent(false);
            d.setItemStack(it);
            d.setItemDisplayTransform(ItemDisplay.ItemDisplayTransform.FIXED);
            d.setTeleportDuration(2);
            d.setInterpolationDuration(2);
            d.setViewRange(1.6f);
            d.setShadowRadius(0.25f * scale);
            d.setShadowStrength(0.6f);
            d.setTransformation(new Transformation(new Vector3f(), new Quaternionf(), new Vector3f(scale), new Quaternionf()));
        });
        pieces.add(p);
        if (task == null) task = org.bukkit.Bukkit.getScheduler().runTaskTimer(plugin, this::tick, 1L, 1L);
    }

    private void tick() {
        Iterator<Piece> it = pieces.iterator();
        while (it.hasNext()) {
            Piece p = it.next();
            if (!p.d.isValid()) {
                it.remove();
                continue;
            }
            p.age++;
            if (p.age > p.life) {
                p.d.remove();
                it.remove();
                continue;
            }
            float size = p.scale;
            int fade = p.life - p.age;
            if (fade < 12) size *= fade / 12f; // se encoge antes de desaparecer
            if (!p.landed) {
                p.vel.setY(p.vel.getY() - 0.055);
                p.vel.multiply(0.985);
                p.pos.add(p.vel);
                p.angle += p.spin;
                double rest = p.floor + 0.12 * p.scale;
                if (p.pos.getY() <= rest) {
                    p.pos.setY(rest);
                    if (Math.abs(p.vel.getY()) > 0.12) {
                        // rebote con salpicadura
                        p.vel.setY(-p.vel.getY() * 0.32);
                        p.vel.setX(p.vel.getX() * 0.55).setZ(p.vel.getZ() * 0.55);
                        p.spin *= 0.5f;
                        Location l = p.pos.toLocation(p.d.getWorld());
                        plugin.fx.particle(l, Particle.BLOCK, 5, 0.12, 0.02, 0.12, 0.05, Material.REDSTONE_BLOCK.createBlockData(), false);
                        if (p.scale >= 0.9f && rnd().nextInt(2) == 0) plugin.fx.blood(l.clone().add(0, -0.1, 0), 0.5);
                    } else {
                        p.landed = true;
                        // queda tumbada en una postura aleatoria
                        p.angle = (float) (Math.round(p.angle / (Math.PI / 2)) * (Math.PI / 2));
                    }
                } else if (p.age % 2 == 0) {
                    plugin.fx.dust(p.pos.toLocation(p.d.getWorld()), Color.fromRGB(120, 4, 4), 0.9f, 1, 0.02, false);
                }
                p.d.teleport(p.pos.toLocation(p.d.getWorld()));
            }
            if (!p.landed || fade < 12) {
                p.d.setInterpolationDelay(0);
                p.d.setTransformation(new Transformation(new Vector3f(), new Quaternionf().rotateAxis(p.angle, p.axis), new Vector3f(size), new Quaternionf()));
            }
        }
        if (pieces.isEmpty() && task != null) {
            task.cancel();
            task = null;
        }
    }

    public void clear() {
        for (Piece p : pieces) if (p.d.isValid()) p.d.remove();
        pieces.clear();
    }
}
