package dev.livearena.basedefense.game;

import dev.livearena.basedefense.BaseDefense;
import dev.livearena.basedefense.mob.GameMob;
import java.util.ArrayList;
import java.util.List;
import net.kyori.adventure.text.format.TextColor;
import org.bukkit.Bukkit;
import org.bukkit.Color;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.World;
import org.bukkit.entity.BlockDisplay;
import org.bukkit.entity.Display;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.scheduler.BukkitTask;
import org.bukkit.util.Transformation;
import org.bukkit.util.Vector;
import org.joml.Quaternionf;
import org.joml.Vector3f;

/**
 * Bando aliado: ataques que regalan los espectadores para ayudar al streamer (/ttaliado). Daño de juego controlado
 * (solo a los mobs del juego, sin romper bloques), separado de lo visual.
 * <ul>
 *   <li>misil: cae del cielo sobre el grupo más denso de enemigos;</li>
 *   <li>bombardeo: una fila de bombas recorre el carril desde el portal hacia la base;</li>
 *   <li>rayo: un rayo orbital barre el carril de punta a punta.</li>
 * </ul>
 */
public final class Allies {
    public static final List<String> TYPES = List.of("misil", "bombardeo", "rayo");
    private static final TextColor BLUE = TextColor.color(0x5AC8FF);
    private final BaseDefense plugin;
    private final List<org.bukkit.entity.Entity> props = new ArrayList<>();

    public Allies(BaseDefense plugin) {
        this.plugin = plugin;
    }

    private double cfg(String path, double def) {
        return plugin.getConfig().getDouble("aliados." + path, def);
    }

    public boolean launch(String type, String who) {
        World w = plugin.world(false);
        if (w == null || !plugin.game.running()) return false;
        String msgKey = switch (type) {
            case "misil" -> "aliadoMisil";
            case "bombardeo" -> "aliadoBombardeo";
            case "rayo" -> "aliadoRayo";
            default -> null;
        };
        if (msgKey == null) return false;
        plugin.hud.notify("bolt", Alerts.plain(dev.livearena.basedefense.util.Txt.plain(plugin.settings.msg(msgKey), "usuario", who)), BLUE);
        switch (type) {
            case "misil" -> missile(w);
            case "bombardeo" -> airstrike(w);
            default -> beam(w);
        }
        return true;
    }

    public void clear() {
        for (var e : props) if (e.isValid()) e.remove();
        props.clear();
    }

    // ───────────────────────────── carril ─────────────────────────────

    /** Punto del carril: f=0 en el portal de los mobs, f=1 en la puerta de la base. */
    private Location lane(World w, double f) {
        List<Vector> pts = new ArrayList<>();
        pts.add(plugin.arena.mobSpawn.clone());
        pts.addAll(plugin.arena.waypoints);
        pts.add(plugin.arena.baseCenter().clone());
        double total = 0;
        for (int i = 1; i < pts.size(); i++) total += pts.get(i).distance(pts.get(i - 1));
        double want = Math.max(0, Math.min(1, f)) * total;
        for (int i = 1; i < pts.size(); i++) {
            double seg = pts.get(i).distance(pts.get(i - 1));
            if (want <= seg || i == pts.size() - 1) {
                Vector v = pts.get(i - 1).clone().add(pts.get(i).clone().subtract(pts.get(i - 1)).multiply(seg == 0 ? 0 : Math.min(1, want / seg)));
                Location l = v.toLocation(w);
                l.setY(plugin.arena.groundY + 1);
                return l;
            }
            want -= seg;
        }
        return plugin.arena.mobSpawn.toLocation(w);
    }

    /** Daño en área a los mobs del juego. */
    private int hurt(Location c, double radius, double dmg) {
        Player by = plugin.game.streamer();
        int n = 0;
        for (GameMob gm : new ArrayList<>(plugin.mobs.all())) {
            if (gm.dead || !gm.entity.isValid()) continue;
            Location l = gm.entity.getLocation();
            double dx = l.getX() - c.getX(), dz = l.getZ() - c.getZ();
            if (dx * dx + dz * dz > radius * radius || Math.abs(l.getY() - c.getY()) > radius + 6) continue;
            plugin.mobs.damage(gm, dmg * (gm.isBoss() ? 0.5 : 1), by, false, true, c);
            n++;
        }
        return n;
    }

    // ───────────────────────────── utilidades visuales ─────────────────────────────

    private boolean pack() {
        return plugin.pack.loaded(plugin.game.streamer());
    }

    private ItemStack model(String key, Material fallback) {
        ItemStack it = new ItemStack(pack() ? Material.STICK : fallback);
        if (pack()) {
            var m = it.getItemMeta();
            m.setItemModel(org.bukkit.NamespacedKey.fromString(key));
            it.setItemMeta(m);
        }
        return it;
    }

    private ItemDisplay prop(Location at, ItemStack it, float scale) {
        ItemDisplay d = at.getWorld().spawn(at, ItemDisplay.class, e -> {
            e.setPersistent(false);
            e.setItemStack(it);
            e.setTeleportDuration(2);
            e.setInterpolationDuration(2);
            e.setBrightness(new Display.Brightness(15, 15));
            e.setViewRange(4f);
            e.setTransformation(new Transformation(new Vector3f(), new Quaternionf(), new Vector3f(scale), new Quaternionf()));
        });
        props.add(d);
        return d;
    }

    /** Orienta el eje +Z del modelo según dir (con alabeo opcional). */
    private static void aim(ItemDisplay d, Vector dir, float scale, float roll) {
        if (dir.lengthSquared() < 1e-6 || !d.isValid()) return;
        Quaternionf q = new Quaternionf().rotationTo(new Vector3f(0, 0, 1), new Vector3f((float) dir.getX(), (float) dir.getY(), (float) dir.getZ()).normalize());
        if (roll != 0) q.rotateZ(roll);
        d.setInterpolationDelay(0);
        d.setTransformation(new Transformation(new Vector3f(), q, new Vector3f(scale), new Quaternionf()));
    }

    /** Zona de impacto marcada en el suelo (anillo rojo que late) durante unos ticks. */
    private void marker(Location c, double r, int ticks) {
        Bukkit.getScheduler().runTaskTimer(plugin, new java.util.function.Consumer<BukkitTask>() {
            int t;

            @Override
            public void accept(BukkitTask task) {
                if (t++ >= ticks || !plugin.game.running()) {
                    task.cancel();
                    return;
                }
                if (t % 3 != 0) return;
                double rr = r * (0.75 + 0.25 * Math.sin(t * 0.5));
                Particle.DustOptions red = new Particle.DustOptions(Color.fromRGB(255, 40, 30), 1.6f);
                for (int i = 0; i < 28; i++) {
                    double a = i * Math.PI * 2 / 28;
                    plugin.fx.particle(c.clone().add(Math.cos(a) * rr, 0.15, Math.sin(a) * rr), Particle.DUST, 1, 0, 0, 0, 0, red, true);
                }
                for (int i = -3; i <= 3; i++) {
                    plugin.fx.particle(c.clone().add(i * rr / 3.5, 0.15, 0), Particle.DUST, 1, 0, 0, 0, 0, red, true);
                    plugin.fx.particle(c.clone().add(0, 0.15, i * rr / 3.5), Particle.DUST, 1, 0, 0, 0, 0, red, true);
                }
            }
        }, 0L, 1L);
    }

    private void sound(Sound s, float vol, float pitch) {
        for (Player p : plugin.game.viewers()) p.playSound(p.getLocation(), s, vol, pitch);
    }

    // ───────────────────────────── misil ─────────────────────────────

    private void missile(World w) {
        // el grupo más denso (o el carril si no hay nadie)
        Location target = null;
        int best = -1;
        List<GameMob> all = new ArrayList<>(plugin.mobs.all());
        for (GameMob a : all) {
            if (a.dead) continue;
            int n = 0;
            for (GameMob b : all) if (!b.dead && a.entity.getLocation().distanceSquared(b.entity.getLocation()) < 36) n++;
            if (n > best) {
                best = n;
                target = a.entity.getLocation();
            }
        }
        if (target == null) target = lane(w, 0.35);
        final Location hit = target.clone();
        hit.setY(plugin.arena.groundY + 1);
        double r = cfg("misil.radio", 6);
        marker(hit, r, 46);
        sound(Sound.BLOCK_NOTE_BLOCK_BIT, 1f, 2f);
        Location start = hit.clone().add(-26, 58, -18);
        ItemDisplay m = prop(start, model("basedefense:cohete_vuelo", Material.FIREWORK_ROCKET), 4f);
        aim(m, hit.toVector().subtract(start.toVector()), 4f, 0);
        sound(Sound.ENTITY_FIREWORK_ROCKET_LAUNCH, 1.5f, 0.4f);
        final int dur = 34;
        Bukkit.getScheduler().runTaskTimer(plugin, new java.util.function.Consumer<BukkitTask>() {
            int t;
            Location prev = start.clone();

            @Override
            public void accept(BukkitTask task) {
                t++;
                double f = Math.min(1, t / (double) dur);
                double ff = f * f;
                Location l = start.clone().add(hit.toVector().subtract(start.toVector()).multiply(ff));
                if (m.isValid()) {
                    m.teleport(l);
                    aim(m, l.toVector().subtract(prev.toVector()), 4f, t * 0.4f);
                }
                prev = l.clone();
                for (int k = 0; k < 3; k++) plugin.fx.trail(l.clone().subtract(hit.toVector().subtract(start.toVector()).normalize().multiply(k * 1.2)), "cohete");
                if (t % 6 == 0) for (Player p : plugin.game.viewers()) p.playSound(l, Sound.ENTITY_FIREWORK_ROCKET_LAUNCH, 2f, 0.5f + (float) f);
                if (f >= 1 || !plugin.game.running()) {
                    task.cancel();
                    if (m.isValid()) m.remove();
                    props.remove(m);
                    if (!plugin.game.running()) return;
                    plugin.fx.blast(hit, r, Color.fromRGB(255, 120, 30), true);
                    for (int k = 0; k < 4; k++) {
                        final double a = k * Math.PI / 2 + plugin.fx.rnd().nextDouble();
                        Bukkit.getScheduler().runTaskLater(plugin, () -> plugin.fx.blast(hit.clone().add(Math.cos(a) * r * 0.6, 0, Math.sin(a) * r * 0.6), r * 0.45, Color.fromRGB(255, 160, 50), false), 3 + k * 2L);
                    }
                    hit.getWorld().playSound(hit, Sound.ENTITY_GENERIC_EXPLODE, 6f, 0.5f);
                    hurt(hit, r, cfg("misil.danio", 90));
                }
            }
        }, 0L, 1L);
    }

    // ───────────────────────────── bombardeo (avión) ─────────────────────────────

    private void airstrike(World w) {
        // Sale por detrás del streamer, pasa por encima (algo a un lado) y se aleja hacia el portal soltando bombas:
        // así se ve entero, de espaldas, cruzando el carril.
        Location a = lane(w, 1), b = lane(w, 0);
        Vector dir = b.toVector().subtract(a.toVector()).setY(0);
        if (dir.lengthSquared() < 1e-4) dir = new Vector(0, 0, 1);
        dir.normalize();
        Vector lateral = dir.clone().crossProduct(new Vector(0, 1, 0)).normalize().multiply(5);
        double alt = plugin.arena.groundY + 1 + cfg("bombardeo.altura", 20);
        Location from = a.clone().subtract(dir.clone().multiply(45)).add(lateral);
        from.setY(alt - 4);
        Location to = b.clone().add(dir.clone().multiply(45)).add(lateral);
        to.setY(alt + 8);
        int dur = (int) cfg("bombardeo.duracionVuelo", 90);
        int bombs = (int) cfg("bombardeo.bombas", 10);
        ItemDisplay plane = prop(from, model("basedefense:avion", Material.ELYTRA), (float) cfg("bombardeo.tamanoAvion", 7));
        float ps = (float) cfg("bombardeo.tamanoAvion", 7);
        aim(plane, to.toVector().subtract(from.toVector()), ps, 0);
        sound(Sound.ITEM_ELYTRA_FLYING, 1.2f, 0.5f);
        sound(Sound.EVENT_RAID_HORN, 0.6f, 1.6f);
        Vector step = to.toVector().subtract(from.toVector()).multiply(1.0 / dur);
        // las bombas caen mientras el avión está sobre el carril (del portal a la base)
        double fa = 45 / from.distance(to), fb = 1 - 45 / from.distance(to);
        Bukkit.getScheduler().runTaskTimer(plugin, new java.util.function.Consumer<BukkitTask>() {
            int t, dropped;

            @Override
            public void accept(BukkitTask task) {
                t++;
                double f = t / (double) dur;
                Location l = from.clone().add(step.clone().multiply(t));
                float roll = (float) (Math.sin(t * 0.08) * 0.08);
                if (plane.isValid()) {
                    plane.teleport(l);
                    aim(plane, step, ps, roll);
                }
                // estela de los motores
                Vector side = step.clone().normalize().crossProduct(new Vector(0, 1, 0)).normalize().multiply(ps * 0.72);
                Location tail = l.clone().subtract(step.clone().normalize().multiply(ps * 0.4));
                plugin.fx.particle(tail.clone().add(side), Particle.CAMPFIRE_COSY_SMOKE, 1, 0.05, 0.05, 0.05, 0.01, null, false);
                plugin.fx.particle(tail.clone().subtract(side), Particle.CAMPFIRE_COSY_SMOKE, 1, 0.05, 0.05, 0.05, 0.01, null, false);
                // llamas de los motores y luces de navegación (roja a babor, verde a estribor) para que se vea de lejos
                plugin.fx.particle(tail.clone().add(side), Particle.FLAME, 3, 0.1, 0.1, 0.1, 0.02, null, true);
                plugin.fx.particle(tail.clone().subtract(side), Particle.FLAME, 3, 0.1, 0.1, 0.1, 0.02, null, true);
                Location wingL = l.clone().add(side.clone().multiply(2.6)), wingR = l.clone().subtract(side.clone().multiply(2.6));
                boolean blink = t % 10 < 5;
                plugin.fx.particle(wingL, Particle.DUST, 2, 0, 0, 0, 0, new Particle.DustOptions(blink ? Color.RED : Color.fromRGB(120, 0, 0), 2.4f), true);
                plugin.fx.particle(wingR, Particle.DUST, 2, 0, 0, 0, 0, new Particle.DustOptions(blink ? Color.LIME : Color.fromRGB(0, 100, 0), 2.4f), true);
                if (t % 14 == 0) for (Player p : plugin.game.viewers()) p.playSound(l, Sound.ITEM_ELYTRA_FLYING, 3f, 0.45f);
                if (f >= fa && f <= fb && dropped < bombs && t % Math.max(2, (int) ((fb - fa) * dur / bombs)) == 0) {
                    dropped++;
                    dropBomb(w, l.clone().add(0, -1.5, 0), step.clone());
                }
                if (t >= dur || !plugin.game.running()) {
                    task.cancel();
                    if (plane.isValid()) plane.remove();
                    props.remove(plane);
                }
            }
        }, 0L, 1L);
    }

    private void dropBomb(World w, Location start, Vector vel0) {
        ItemDisplay b = prop(start, model("basedefense:bomba", Material.TNT), 1.6f);
        w.playSound(start, Sound.ENTITY_ARROW_SHOOT, 3f, 0.5f);
        double ground = plugin.arena.groundY + 1;
        Bukkit.getScheduler().runTaskTimer(plugin, new java.util.function.Consumer<BukkitTask>() {
            final Location pos = start.clone();
            final Vector v = vel0.clone().multiply(0.6);
            int t;

            @Override
            public void accept(BukkitTask task) {
                t++;
                v.add(new Vector(0, -0.08, 0));
                pos.add(v);
                if (b.isValid()) {
                    b.teleport(pos);
                    aim(b, v, 1.6f, 0);
                }
                if (t % 3 == 0) plugin.fx.particle(pos, Particle.SMOKE, 1, 0.03, 0.03, 0.03, 0.0, null, false);
                if (t == 4) w.playSound(pos, Sound.ENTITY_FIREWORK_ROCKET_LAUNCH, 2f, 0.4f); // silbido
                if (pos.getY() <= ground || t > 80 || !plugin.game.running()) {
                    task.cancel();
                    if (b.isValid()) b.remove();
                    props.remove(b);
                    if (!plugin.game.running()) return;
                    Location hit = pos.clone();
                    hit.setY(ground);
                    double r = cfg("bombardeo.radio", 4);
                    plugin.fx.blast(hit, r, Color.fromRGB(255, 140, 40), false);
                    hurt(hit, r, cfg("bombardeo.danio", 45));
                    plugin.game.shake();
                }
            }
        }, 0L, 1L);
    }

    // ───────────────────────────── rayo orbital ─────────────────────────────

    private void beam(World w) {
        int dur = (int) (cfg("rayo.duracion", 3) * 20);
        double width = cfg("rayo.ancho", 3);
        double dmg = cfg("rayo.danio", 10);
        Location s0 = lane(w, 0);
        // 1) fijando el objetivo: láser fino desde el cielo, círculo de aviso y carga
        marker(s0, width + 1.5, 30);
        sound(Sound.BLOCK_BEACON_ACTIVATE, 1f, 0.5f);
        sound(Sound.BLOCK_RESPAWN_ANCHOR_CHARGE, 1f, 0.6f);
        for (int i = 0; i < 30; i += 3) {
            final int k = i;
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                if (!plugin.game.running()) return;
                for (double y = 0; y < 60; y += 1.5) plugin.fx.particle(s0.clone().add(0, y, 0), Particle.DUST, 1, 0, 0, 0, 0, new Particle.DustOptions(Color.fromRGB(255, 50, 40), 0.8f + k / 30f), false);
            }, i);
        }
        Bukkit.getScheduler().runTaskLater(plugin, () -> fire(w, dur, width, dmg), 30);
    }

    private void fire(World w, int dur, double width, double dmg) {
        if (!plugin.game.running()) return;
        Location s0 = lane(w, 0);
        BlockDisplay core = w.spawn(s0, BlockDisplay.class, d -> {
            beamPart(d, Material.WHITE_CONCRETE, (float) (width * 0.3));
            d.setGlowing(true);
            d.setGlowColorOverride(Color.fromRGB(150, 240, 255));
        });
        BlockDisplay glow = w.spawn(s0, BlockDisplay.class, d -> beamPart(d, Material.LIGHT_BLUE_STAINED_GLASS, (float) (width * 0.75)));
        BlockDisplay halo = w.spawn(s0, BlockDisplay.class, d -> beamPart(d, Material.CYAN_STAINED_GLASS, (float) (width * 1.15)));
        props.add(core);
        props.add(glow);
        props.add(halo);
        w.strikeLightningEffect(s0);
        plugin.fx.blast(s0, width + 1, Color.fromRGB(120, 230, 255), true);
        sound(Sound.ENTITY_LIGHTNING_BOLT_THUNDER, 1f, 1.6f);
        sound(Sound.BLOCK_BEACON_POWER_SELECT, 1f, 0.5f);
        List<BlockDisplay> scorch = new ArrayList<>();
        Bukkit.getScheduler().runTaskTimer(plugin, new java.util.function.Consumer<BukkitTask>() {
            int t;

            @Override
            public void accept(BukkitTask task) {
                t++;
                double f = Math.min(1, t / (double) dur) * 0.86;
                Location l = lane(w, f);
                float pulse = (float) (1 + 0.18 * Math.sin(t * 1.3));
                for (BlockDisplay d : List.of(core, glow, halo)) if (d.isValid()) d.teleport(l);
                resize(glow, (float) (width * 0.75 * pulse));
                resize(halo, (float) (width * 1.15 * (2 - pulse)));
                plugin.fx.particle(l.clone().add(0, 0.3, 0), Particle.END_ROD, 10, width * 0.4, 0.3, width * 0.4, 0.12, null, true);
                plugin.fx.particle(l.clone().add(0, 0.2, 0), Particle.ELECTRIC_SPARK, 12, width * 0.5, 0.2, width * 0.5, 0.3, null, true);
                plugin.fx.particle(l.clone().add(0, 0.2, 0), Particle.DUST, 10, width * 0.5, 0.05, width * 0.5, 0, new Particle.DustOptions(Color.fromRGB(150, 230, 255), 2f), true);
                if (t % 3 == 0) plugin.fx.particle(l, Particle.FLAME, 8, width * 0.4, 0.1, width * 0.4, 0.04, null, true);
                if (t % 8 == 0) plugin.fx.blast(l, Math.max(2, width * 0.7), Color.fromRGB(120, 230, 255), false);
                if (t % 4 == 0) scorch.add(burn(w, l, width));
                if (t % 2 == 0) hurt(l, width, dmg);
                if (t % 6 == 0) w.playSound(l, Sound.BLOCK_BEACON_AMBIENT, 3f, 1.8f);
                if (t >= dur || !plugin.game.running()) {
                    task.cancel();
                    for (BlockDisplay d : List.of(core, glow, halo)) {
                        d.remove();
                        props.remove(d);
                    }
                    if (plugin.game.running()) {
                        plugin.fx.blast(l, width + 2, Color.fromRGB(120, 230, 255), true);
                        w.strikeLightningEffect(l);
                    }
                    // el surco quemado se borra poco a poco
                    for (int i = 0; i < scorch.size(); i++) {
                        BlockDisplay sd = scorch.get(i);
                        Bukkit.getScheduler().runTaskLater(plugin, () -> {
                            sd.remove();
                            props.remove(sd);
                        }, 100L + i * 3L);
                    }
                }
            }
        }, 0L, 1L);
    }

    private static void resize(BlockDisplay d, float wdt) {
        if (!d.isValid()) return;
        d.setInterpolationDelay(0);
        d.setInterpolationDuration(2);
        d.setTransformation(new Transformation(new Vector3f(-wdt / 2, 0, -wdt / 2), new Quaternionf(), new Vector3f(wdt, 90f, wdt), new Quaternionf()));
    }

    /** Mancha quemada en el suelo donde pasa el rayo. */
    private BlockDisplay burn(World w, Location l, double width) {
        Location g = l.clone();
        g.setY(plugin.arena.groundY + 1.01);
        float s = (float) (width * 0.9);
        float yaw = plugin.fx.rnd().nextFloat() * 6.28f;
        BlockDisplay d = w.spawn(g, BlockDisplay.class, e -> {
            e.setPersistent(false);
            e.setBlock(Material.BLACK_CONCRETE_POWDER.createBlockData());
            Quaternionf q = new Quaternionf().rotateY(yaw);
            e.setTransformation(new Transformation(new Vector3f(-s / 2, 0, -s / 2).rotate(q), q, new Vector3f(s, 0.02f, s), new Quaternionf()));
            e.setBrightness(new Display.Brightness(2, 2));
            e.setViewRange(1.5f);
        });
        props.add(d);
        return d;
    }

    private static void beamPart(BlockDisplay d, Material m, float wdt) {
        d.setPersistent(false);
        d.setBlock(m.createBlockData());
        d.setTeleportDuration(1);
        d.setBrightness(new Display.Brightness(15, 15));
        d.setViewRange(4f);
        // el display solo se dibuja si su origen está a la vista: va en el suelo y se estira hacia arriba
        d.setTransformation(new Transformation(new Vector3f(-wdt / 2, 0, -wdt / 2), new Quaternionf(), new Vector3f(wdt, 90f, wdt), new Quaternionf()));
    }
}
