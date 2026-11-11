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

    /**
     * Bombardeo en alfombra: suena la alarma y se marcan en rojo los puntos de impacto; entra una escuadrilla de tres
     * aviones en cuña (el líder suelta las bombas, los escoltas dejan estelas), cada bomba cae silbando con su estela y
     * revienta con fogonazo, onda dorada a ras de suelo, columna de fuego, escombros y explosiones secundarias. Al final,
     * una onda recorre todo el carril.
     */
    private void airstrike(World w) {
        Location a = lane(w, 1), b = lane(w, 0);
        Vector dir = b.toVector().subtract(a.toVector()).setY(0);
        if (dir.lengthSquared() < 1e-4) dir = new Vector(0, 0, 1);
        dir.normalize();
        Vector lateral = dir.clone().crossProduct(new Vector(0, 1, 0)).normalize();
        double alt = plugin.arena.groundY + 1 + cfg("bombardeo.altura", 20);
        int dur = (int) cfg("bombardeo.duracionVuelo", 90);
        int bombs = (int) cfg("bombardeo.bombas", 14);
        float ps = (float) cfg("bombardeo.tamanoAvion", 7);
        double r = cfg("bombardeo.radio", 5);
        // puntos de impacto repartidos por el carril (zigzag), marcados antes de que lleguen los aviones
        List<Location> targets = new ArrayList<>();
        for (int i = 0; i < bombs; i++) {
            Location t = lane(w, 0.92 - 0.86 * (i + 0.5) / bombs);
            t.add(lateral.clone().multiply(((i % 3) - 1) * 3.2 + plugin.fx.rnd().nextGaussian() * 0.6));
            targets.add(t);
            marker(t, r * 0.8, 34 + (int) (dur * 0.75));
        }
        sound(Sound.EVENT_RAID_HORN, 0.9f, 1.4f);
        sound(Sound.BLOCK_BELL_RESONATE, 0.8f, 0.6f);
        plugin.alerts.siren(2);
        int delay = 34;
        // escuadrilla: líder + dos escoltas más atrás y a los lados
        double[][] wing = {{0, 0, 0}, {-9, -7, 2.5}, {9, -7, 2.5}};
        for (int pi = 0; pi < wing.length; pi++) {
            final boolean lead = pi == 0;
            Vector off = lateral.clone().multiply(wing[pi][0]).add(dir.clone().multiply(wing[pi][1])).add(new Vector(0, wing[pi][2], 0));
            Location from = a.clone().subtract(dir.clone().multiply(50)).add(off);
            from.setY(alt - 3 + wing[pi][2]);
            Location to = b.clone().add(dir.clone().multiply(55)).add(off);
            to.setY(alt + 9 + wing[pi][2]);
            Vector step = to.toVector().subtract(from.toVector()).multiply(1.0 / dur);
            final float size = lead ? ps : ps * 0.8f;
            final int index = pi;
            Bukkit.getScheduler().runTaskTimer(plugin, new java.util.function.Consumer<BukkitTask>() {
                int t = -delay, dropped;
                ItemDisplay plane;

                @Override
                public void accept(BukkitTask task) {
                    t++;
                    if (t < 0) return;
                    if (!plugin.game.running()) {
                        if (plane != null && plane.isValid()) plane.remove();
                        props.remove(plane);
                        task.cancel();
                        return;
                    }
                    if (plane == null) {
                        plane = prop(from, model("basedefense:avion", Material.ELYTRA), size);
                        aim(plane, step, size, 0);
                        if (lead) sound(Sound.ITEM_ELYTRA_FLYING, 1.4f, 0.5f);
                    }
                    Location l = from.clone().add(step.clone().multiply(t));
                    // alabeo: entra inclinado, se nivela para soltar y vuelve a inclinarse al salir
                    double f = t / (double) dur;
                    float roll = (float) ((f < 0.2 ? (0.2 - f) * 2.5 : f > 0.8 ? -(f - 0.8) * 3.2 : 0) * (index == 1 ? -1 : 1) + Math.sin(t * 0.09 + index) * 0.05);
                    if (plane.isValid()) {
                        plane.teleport(l);
                        aim(plane, step, size, roll);
                    }
                    Vector fw = step.clone().normalize();
                    Vector side = fw.clone().crossProduct(new Vector(0, 1, 0)).normalize().multiply(size * 0.72);
                    Location tail = l.clone().subtract(fw.clone().multiply(size * 0.4));
                    // estelas blancas largas en las puntas de las alas + llama de los motores
                    for (int sgn = -1; sgn <= 1; sgn += 2) {
                        Location tip = l.clone().add(side.clone().multiply(sgn * 1.25));
                        plugin.fx.particle(tip, Particle.CLOUD, 2, 0.05, 0.05, 0.05, 0.0, null, true);
                        plugin.fx.particle(tip, Particle.END_ROD, 1, 0.02, 0.02, 0.02, 0.0, null, false);
                        plugin.fx.particle(tail.clone().add(side.clone().multiply(sgn * 0.5)), Particle.FLAME, 3, 0.1, 0.1, 0.1, 0.02, null, true);
                        plugin.fx.particle(tail.clone().add(side.clone().multiply(sgn * 0.5)), Particle.CAMPFIRE_COSY_SMOKE, 1, 0.05, 0.05, 0.05, 0.01, null, false);
                    }
                    boolean blink = t % 10 < 5;
                    plugin.fx.particle(l.clone().add(side.clone().multiply(1.3)), Particle.DUST, 2, 0, 0, 0, 0, new Particle.DustOptions(blink ? Color.RED : Color.fromRGB(120, 0, 0), 2.4f), true);
                    plugin.fx.particle(l.clone().subtract(side.clone().multiply(1.3)), Particle.DUST, 2, 0, 0, 0, 0, new Particle.DustOptions(blink ? Color.LIME : Color.fromRGB(0, 100, 0), 2.4f), true);
                    if (lead && t % 12 == 0) for (Player p : plugin.game.viewers()) p.playSound(l, Sound.ITEM_ELYTRA_FLYING, 3.5f, 0.45f);
                    if (lead) {
                        // suelta cada bomba cuando pasa sobre su punto (un poco antes: la bomba sigue avanzando al caer)
                        while (dropped < targets.size()) {
                            Location tg = targets.get(dropped);
                            double ahead = tg.toVector().subtract(l.toVector()).setY(0).dot(fw);
                            if (ahead > 7) break;
                            dropBomb(w, l.clone().add(0, -1.5, 0), tg, dropped);
                            dropped++;
                        }
                    }
                    if (t >= dur) {
                        task.cancel();
                        if (plane.isValid()) plane.remove();
                        props.remove(plane);
                        if (lead) {
                            // onda final que recorre el carril de la base al portal
                            for (int k = 0; k < 6; k++) {
                                Location c = lane(w, 0.9 - k * 0.16).add(0, 0.3, 0);
                                Bukkit.getScheduler().runTaskLater(plugin, () -> plugin.fx.ring(c, 9, Color.fromRGB(255, 205, 90), 12), k * 3L);
                            }
                            sound(Sound.ENTITY_LIGHTNING_BOLT_THUNDER, 0.8f, 0.6f);
                        }
                    }
                }
            }, 0L, 1L);
        }
    }

    /** Bomba que cae hacia su punto marcado: estela, silbido y explosión con efectos encadenados. */
    private void dropBomb(World w, Location start, Location target, int n) {
        ItemDisplay b = prop(start, model("basedefense:bomba", Material.TNT), 1.8f);
        w.playSound(start, Sound.ENTITY_ARROW_SHOOT, 3f, 0.5f);
        double ground = plugin.arena.groundY + 1;
        int fall = 24;
        Bukkit.getScheduler().runTaskTimer(plugin, new java.util.function.Consumer<BukkitTask>() {
            final Location pos = start.clone();
            int t;

            @Override
            public void accept(BukkitTask task) {
                t++;
                double k = Math.min(1, t / (double) fall);
                // avanza hacia el punto en horizontal y acelera al caer
                Location prev = pos.clone();
                pos.setX(start.getX() + (target.getX() - start.getX()) * k);
                pos.setZ(start.getZ() + (target.getZ() - start.getZ()) * k);
                pos.setY(start.getY() + (ground - start.getY()) * k * k);
                Vector v = pos.toVector().subtract(prev.toVector());
                if (b.isValid()) {
                    b.teleport(pos);
                    aim(b, v, 1.8f, t * 0.35f);
                }
                // estela vertical: humo blanco y chispas
                plugin.fx.particle(pos, Particle.CLOUD, 2, 0.05, 0.2, 0.05, 0.0, null, true);
                plugin.fx.particle(pos, Particle.FIREWORK, 1, 0.05, 0.05, 0.05, 0.02, null, false);
                if (t == 3) w.playSound(pos, Sound.ENTITY_FIREWORK_ROCKET_LAUNCH, 2.5f, 0.4f); // silbido
                if (t >= fall || !plugin.game.running()) {
                    task.cancel();
                    if (b.isValid()) b.remove();
                    props.remove(b);
                    if (!plugin.game.running()) return;
                    Location hit = target.clone();
                    hit.setY(ground);
                    double r = cfg("bombardeo.radio", 5);
                    plugin.fx.blast(hit, r, Color.fromRGB(255, 140, 40), false);
                    // onda dorada a ras de suelo y columna de fuego
                    plugin.fx.ring(hit.clone().add(0, 0.2, 0), r * 2.2, Color.fromRGB(255, 205, 90), 10);
                    for (int h = 0; h < 6; h++) plugin.fx.particle(hit.clone().add(0, 0.6 + h * 0.9, 0), Particle.FLAME, 10, 0.5 - h * 0.05, 0.3, 0.5 - h * 0.05, 0.03, null, true);
                    plugin.fx.particle(hit.clone().add(0, 1, 0), Particle.LAVA, 14, 0.8, 0.4, 0.8, 0, null, true);
                    plugin.fx.particle(hit.clone().add(0, 4, 0), Particle.CAMPFIRE_SIGNAL_SMOKE, 8, 0.6, 1.5, 0.6, 0.03, null, true);
                    hurt(hit, r, cfg("bombardeo.danio", 90));
                    plugin.game.shake();
                    // explosiones secundarias alrededor
                    for (int i = 0; i < 2; i++) {
                        double ang = plugin.fx.rnd().nextDouble() * Math.PI * 2, d = r * (0.5 + plugin.fx.rnd().nextDouble() * 0.5);
                        Location s2 = hit.clone().add(Math.cos(ang) * d, 0.3, Math.sin(ang) * d);
                        Bukkit.getScheduler().runTaskLater(plugin, () -> {
                            if (plugin.game.running()) plugin.fx.explosion(s2, 2.2, false);
                        }, 4L + i * 4L);
                    }
                    // brasas que quedan ardiendo unos segundos
                    Bukkit.getScheduler().runTaskTimer(plugin, new java.util.function.Consumer<BukkitTask>() {
                        int e;

                        @Override
                        public void accept(BukkitTask et) {
                            if (e++ > 12 || !plugin.game.running()) {
                                et.cancel();
                                return;
                            }
                            plugin.fx.particle(hit.clone().add(0, 0.3, 0), Particle.FLAME, 5, r * 0.35, 0.1, r * 0.35, 0.01, null, false);
                            plugin.fx.particle(hit.clone().add(0, 0.6, 0), Particle.LARGE_SMOKE, 3, r * 0.3, 0.3, r * 0.3, 0.02, null, false);
                        }
                    }, 5L, 5L);
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
