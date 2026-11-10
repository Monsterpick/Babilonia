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
            plugin.mobs.damage(gm, dmg * (gm.isBoss() ? 0.5 : 1), by);
            n++;
        }
        return n;
    }

    // ───────────────────────────── misil ─────────────────────────────

    private void missile(World w) {
        // el grupo más denso (o el portal si no hay nadie)
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
        Location start = hit.clone().add(-8, 46, -6);
        ItemDisplay m = w.spawn(start, ItemDisplay.class, d -> {
            d.setPersistent(false);
            d.setItemStack(new ItemStack(Material.FIREWORK_ROCKET));
            d.setTeleportDuration(1);
            d.setBrightness(new Display.Brightness(15, 15));
            Vector dir = hit.toVector().subtract(start.toVector()).normalize();
            Quaternionf q = new Quaternionf().rotationTo(new Vector3f(0, 1, 0), new Vector3f((float) -dir.getX(), (float) -dir.getY(), (float) -dir.getZ()));
            q.rotateZ((float) Math.PI);
            d.setTransformation(new Transformation(new Vector3f(), q, new Vector3f(3f), new Quaternionf()));
        });
        props.add(m);
        for (Player p : plugin.game.viewers()) p.playSound(p.getLocation(), Sound.ENTITY_FIREWORK_ROCKET_LAUNCH, 1f, 0.5f);
        plugin.fx.particle(hit.clone().add(0, 0.2, 0), Particle.DUST, 40, 3, 0.05, 3, 0, new Particle.DustOptions(Color.RED, 1.6f), true);
        final int dur = 22;
        Bukkit.getScheduler().runTaskTimer(plugin, new java.util.function.Consumer<BukkitTask>() {
            int t;

            @Override
            public void accept(BukkitTask task) {
                t++;
                double f = Math.min(1, t / (double) dur);
                Location l = start.clone().add(hit.toVector().subtract(start.toVector()).multiply(f * f));
                if (m.isValid()) m.teleport(l);
                plugin.fx.particle(l, Particle.FLAME, 6, 0.15, 0.02, true);
                plugin.fx.particle(l, Particle.LARGE_SMOKE, 3, 0.2, 0.02, true);
                if (t % 4 == 0) plugin.fx.particle(hit.clone().add(0, 0.2, 0), Particle.DUST, 30, 2.5, 0.05, 2.5, 0, new Particle.DustOptions(Color.RED, 1.4f), true);
                if (f >= 1 || !plugin.game.running()) {
                    task.cancel();
                    if (m.isValid()) m.remove();
                    props.remove(m);
                    if (!plugin.game.running()) return;
                    double r = cfg("misil.radio", 6);
                    plugin.fx.explosion(hit, r, true);
                    plugin.fx.particle(hit, Particle.FLASH, 2, 0, 0, 0, 0, Color.ORANGE, true);
                    hit.getWorld().playSound(hit, Sound.ENTITY_GENERIC_EXPLODE, 6f, 0.6f);
                    hurt(hit, r, cfg("misil.danio", 90));
                    plugin.game.shake();
                }
            }
        }, 0L, 1L);
    }

    // ───────────────────────────── bombardeo ─────────────────────────────

    private void airstrike(World w) {
        int bombs = (int) cfg("bombardeo.bombas", 10);
        for (Player p : plugin.game.viewers()) p.playSound(p.getLocation(), Sound.ITEM_ELYTRA_FLYING, 1f, 1.6f);
        for (int i = 0; i < bombs; i++) {
            final double f = 0.05 + 0.8 * i / Math.max(1, bombs - 1);
            final int delay = 10 + i * 5;
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                if (!plugin.game.running()) return;
                Location hit = lane(w, f).add(plugin.fx.rnd().nextGaussian() * 1.5, 0, plugin.fx.rnd().nextGaussian() * 1.5);
                dropBomb(w, hit);
            }, delay);
        }
    }

    private void dropBomb(World w, Location hit) {
        Location start = hit.clone().add(0, 26, 0);
        ItemDisplay b = w.spawn(start, ItemDisplay.class, d -> {
            d.setPersistent(false);
            d.setItemStack(new ItemStack(Material.TNT));
            d.setTeleportDuration(1);
            d.setTransformation(new Transformation(new Vector3f(), new Quaternionf(), new Vector3f(1.2f), new Quaternionf()));
        });
        props.add(b);
        w.playSound(start, Sound.ENTITY_TNT_PRIMED, 3f, 1.4f);
        Bukkit.getScheduler().runTaskTimer(plugin, new java.util.function.Consumer<BukkitTask>() {
            int t;

            @Override
            public void accept(BukkitTask task) {
                t++;
                double f = Math.min(1, t / 12.0);
                Location l = start.clone().add(0, -26 * f * f, 0);
                if (b.isValid()) b.teleport(l);
                if (t % 2 == 0) plugin.fx.particle(l, Particle.SMOKE, 2, 0.1, 0.01, false);
                if (f >= 1 || !plugin.game.running()) {
                    task.cancel();
                    if (b.isValid()) b.remove();
                    props.remove(b);
                    if (!plugin.game.running()) return;
                    double r = cfg("bombardeo.radio", 4);
                    plugin.fx.explosion(hit, r, false);
                    hurt(hit, r, cfg("bombardeo.danio", 45));
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
        BlockDisplay core = w.spawn(s0, BlockDisplay.class, d -> {
            beamPart(d, Material.WHITE_CONCRETE, 0.7f);
            d.setGlowing(true);
            d.setGlowColorOverride(Color.fromRGB(120, 230, 255));
        });
        BlockDisplay glow = w.spawn(s0, BlockDisplay.class, d -> beamPart(d, Material.LIGHT_BLUE_STAINED_GLASS, 2.0f));
        props.add(core);
        props.add(glow);
        for (Player p : plugin.game.viewers()) {
            p.playSound(p.getLocation(), Sound.BLOCK_BEACON_ACTIVATE, 1f, 0.6f);
            p.playSound(p.getLocation(), Sound.ENTITY_LIGHTNING_BOLT_THUNDER, 0.8f, 1.6f);
        }
        Bukkit.getScheduler().runTaskTimer(plugin, new java.util.function.Consumer<BukkitTask>() {
            int t;

            @Override
            public void accept(BukkitTask task) {
                t++;
                double f = Math.min(1, t / (double) dur) * 0.86;
                Location l = lane(w, f);
                if (core.isValid()) core.teleport(l);
                if (glow.isValid()) glow.teleport(l);
                plugin.fx.particle(l.clone().add(0, 0.3, 0), Particle.END_ROD, 6, width * 0.4, 0.2, width * 0.4, 0.08, null, true);
                plugin.fx.particle(l.clone().add(0, 0.2, 0), Particle.DUST, 10, width * 0.5, 0.05, width * 0.5, 0, new Particle.DustOptions(Color.fromRGB(150, 230, 255), 2f), true);
                if (t % 2 == 0) hurt(l, width, dmg);
                if (t % 6 == 0) w.playSound(l, Sound.BLOCK_BEACON_AMBIENT, 3f, 1.8f);
                if (t >= dur || !plugin.game.running()) {
                    task.cancel();
                    core.remove();
                    glow.remove();
                    props.remove(core);
                    props.remove(glow);
                    if (plugin.game.running()) plugin.fx.particle(l, Particle.FLASH, 1, 0, 0, 0, 0, Color.AQUA, true);
                }
            }
        }, 0L, 1L);
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
