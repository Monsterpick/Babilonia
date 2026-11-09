package dev.livearena.plugin;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.entity.ArmorStand;
import org.bukkit.entity.BlockDisplay;
import org.bukkit.entity.Creeper;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Item;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Monster;
import org.bukkit.entity.Player;
import org.bukkit.entity.Projectile;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;
import org.bukkit.util.EulerAngle;
import org.bukkit.util.Transformation;
import org.bukkit.util.Vector;
import org.joml.Quaternionf;
import org.joml.Vector3f;

import static dev.livearena.plugin.CineNet.CUT;
import static dev.livearena.plugin.CineNet.EASE_IN_EXPO;
import static dev.livearena.plugin.CineNet.EASE_IN_OUT;
import static dev.livearena.plugin.CineNet.EASE_OUT_EXPO;
import static dev.livearena.plugin.CineNet.LINEAR;

/**
 * Las 12 habilidades cinemáticas del kit (una por ficha de docs/habilidades) más «test».
 * Cada una es una línea de tiempo en ticks; los números salen de habilidades.yml (por defecto, los de la ficha).
 */
final class CineAbilities implements Listener {
    private final CineEngine e;
    private final CineFx fx;
    private final CineWorld world;

    CineAbilities(CineEngine engine) {
        this.e = engine;
        this.fx = engine.fx;
        this.world = engine.world;
    }

    private static Vector forward(float yaw) {
        double a = Math.toRadians(yaw);
        return new Vector(-Math.sin(a), 0, Math.cos(a));
    }

    private static Location mid(Location a, Location b, double f) {
        return a.clone().add(b.toVector().subtract(a.toVector()).multiply(f));
    }

    /** Añade una órbita como fotogramas lineales (el mod los une con Catmull-Rom). */
    private static void orbit(CineNet.Shot s, CineEngine.Ctx c, Location center, double r0, double r1, double h0, double h1, double a0, double a1, int t0, int t1, Location look, float fov0, float fov1) {
        int steps = Math.max(2, (t1 - t0) / 5);
        for (int i = 0; i <= steps; i++) {
            double f = i / (double) steps;
            Location p = c.around(center, a0 + (a1 - a0) * f, r0 + (r1 - r0) * f, h0 + (h1 - h0) * f);
            s.key(t0 + (int) Math.round((t1 - t0) * f), p, look, (float) (fov0 + (fov1 - fov0) * f), i == 0 && t0 > 0 ? CUT : LINEAR);
        }
    }

    @SuppressWarnings("unchecked")
    private static <T> T get(CineEngine.Ctx c, String k) {
        return (T) c.data.get(k);
    }

    void register() {
        test();
        escudo();
        ondaRepulsion();
        coronaEspadas();
        superRayo();
        truenoExplosion();
        carruselCreepers();
        ojoVacio();
        agujeroNegro();
        juicioArcano();
        esferaEnergia();
        meteorito();
        milCortes();
    }

    /* ======================================== test ======================================== */

    private void test() {
        e.register(new CineEngine.Ability("test", "PRUEBA DE CÁMARA", "#5ef2ff", 100, 100, "La cámara orbita alrededor del objetivo 5 s y vuelve") {
            void start(CineEngine.Ctx c) {
                CineNet.Shot s = c.shot();
                orbit(s, c, c.feet(), 6, 6, 3, 3, 180, 540, 0, 100, c.eye(), 70, 70);
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                if (t % 5 == 0) CineFx.ring(c.w, c.feet(), 1.5, 0x5ef2ff, 1.2f, t * 0.1);
            }
        });
    }

    /* ======================================= 01 escudo ======================================= */

    private final Map<UUID, CineEngine.Ctx> shields = new HashMap<>();

    private void escudo() {
        e.register(new CineEngine.Ability("escudo", "ESCUDO DE ENERGÍA", "#5ce1ff", 600, 60, "Cúpula hexagonal que sigue al objetivo, refleja flechas y absorbe golpes") {
            void start(CineEngine.Ctx c) {
                c.data.put("dur", c.cfg("durabilidad", 60.0));
                shields.put(c.target.getUniqueId(), c);
                CineNet.Shot s = c.shot();
                s.key(0, c.around(c.feet(), 180, 6, 1.6), c.eye(), 70, LINEAR);
                orbit(s, c, c.feet(), 8, 8, 4, 4, 180, 360, 10, 60, c.eye(), 72, 80);
                c.cam(s);
                c.vignette(0x6012a0c0, 5, 40, 15);
            }

            void tick(CineEngine.Ctx c, int t) {
                double r = c.cfg("radio", 4.0);
                Location center = c.feet();
                int dur = duracion(c);
                Integer brokeAt = get(c, "brokeAt");
                if (brokeAt != null) {
                    if (t - brokeAt > 20) e.finish(c, false);
                    return;
                }
                if (t < 40) {
                    if (t % 2 == 0) CineFx.domeHex(c.w, center, r, t / 40.0, 0x5ce1ff, 0xffffff, t);
                    if (t % 8 == 0) c.sound(center, "onda.carga", 0.4f, 0.6f + t / 40f);
                    return;
                }
                if (t == 40) {
                    c.sound(center, "escudo.activar", 1.2f, 1.2f);
                    c.flash(0x5ce1ff, 1, 2, 8);
                    CineFx.sphereShell(c.w, center.clone().add(0, 0.2, 0), r, 220, 0xffffff, 1.6f);
                }
                if (t >= dur - 20) {
                    double grow = (dur - t) / 20.0;
                    if (t % 2 == 0) CineFx.domeHex(c.w, center, r, grow, 0x5ce1ff, 0x5ce1ff, t);
                    return;
                }
                if (t % 4 == 0) CineFx.domeHex(c.w, center, r, 1, (t / 4) % 6 == 0 ? 0x9ff0ff : 0x5ce1ff, 0xffffff, t);
                // Proyectiles desde fuera: rebotan.
                for (Entity en : c.w.getNearbyEntities(center, r + 2, r + 2, r + 2)) {
                    if (en instanceof Projectile pr) {
                        if (pr.getShooter() == c.target) continue;
                        Vector rel = pr.getLocation().toVector().subtract(center.toVector().add(new Vector(0, 1, 0)));
                        double d = rel.length();
                        Vector v = pr.getVelocity();
                        if (d < r + 0.8 && d > r - 1.2 && v.dot(rel) < 0) {
                            Vector n = rel.normalize();
                            if (c.cfgB("reflejarProyectiles", true)) pr.setVelocity(v.subtract(n.clone().multiply(2 * v.dot(n))));
                            else pr.remove();
                            impact(c, pr.getLocation(), 2.0);
                        }
                    } else if (en instanceof Monster m && c.cfgB("empujarMobs", true)) {
                        if (m.getLocation().distance(center) < r) {
                            Vector out = m.getLocation().toVector().subtract(center.toVector()).setY(0);
                            if (out.lengthSquared() < 0.01) out = new Vector(1, 0, 0);
                            m.setVelocity(out.normalize().multiply(0.8).setY(0.3));
                        }
                    }
                }
            }

            void end(CineEngine.Ctx c, boolean cancelled) {
                shields.remove(c.target.getUniqueId());
            }
        });
    }

    /** Impacto en la cúpula: onda visual, sonido y resta durabilidad (si se agota, se rompe). */
    private void impact(CineEngine.Ctx c, Location at, double dmg) {
        double r = c.cfg("radio", 4.0);
        Location center = c.feet();
        CineFx.domeImpact(c.w, center.clone().add(0, 0.5, 0), r, at, 0xffffff);
        c.sound(at, "escudo.impacto", 1f, 1.2f);
        double dur = (double) c.data.getOrDefault("dur", 60.0) - dmg;
        c.data.put("dur", dur);
        if (dur <= 0 && !c.data.containsKey("brokeAt")) {
            c.data.put("brokeAt", c.t);
            c.sound(center, "escudo.romper", 1.5f, 0.8f);
            for (int i = 0; i < 40; i++) {
                double a = Math.random() * Math.PI * 2, y = Math.random() * r;
                Location l = center.clone().add(Math.cos(a) * r * 0.9, y, Math.sin(a) * r * 0.9);
                world.flyVisual(l, Material.LIGHT_BLUE_STAINED_GLASS.createBlockData(), CineWorld.Path.LAUNCH, null,
                        new Vector(Math.cos(a) * 0.2, 0.1, Math.sin(a) * 0.2), 30, 0);
            }
            shields.remove(c.target.getUniqueId());
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onShieldDamage(EntityDamageEvent ev) {
        if (!(ev.getEntity() instanceof Player p)) return;
        CineEngine.Ctx c = shields.get(p.getUniqueId());
        if (c == null || c.ended || c.t < 40) return;
        EntityDamageEvent.DamageCause cause = ev.getCause();
        boolean outside = switch (cause) {
            case PROJECTILE, ENTITY_EXPLOSION, BLOCK_EXPLOSION, LIGHTNING, MAGIC, SONIC_BOOM -> true;
            case ENTITY_ATTACK, ENTITY_SWEEP_ATTACK -> ev instanceof EntityDamageByEntityEvent be
                    && be.getDamager().getLocation().distance(p.getLocation()) > c.cfg("radio", 4.0) - 0.5;
            default -> false; // caída, hambre, ahogo… no se bloquean
        };
        if (!outside) return;
        ev.setCancelled(true);
        Location at = ev instanceof EntityDamageByEntityEvent be ? be.getDamager().getLocation() : p.getLocation().add(0, 3, 0);
        impact(c, at, ev.getDamage());
    }

    /* ==================================== 02 onda_repulsion ==================================== */

    private void ondaRepulsion() {
        e.register(new CineEngine.Ability("onda_repulsion", "ONDA DE REPULSIÓN", "#ffffff", 80, 80, "Un anillo de fuerza barre el terreno y lanza todo por los aires") {
            void start(CineEngine.Ctx c) {
                Location center = c.launcher != null ? c.launcher.getLocation() : c.feet();
                c.data.put("center", center.clone());
                c.data.put("hit", new HashSet<UUID>());
                c.sound(center, "onda.carga", 1f, 0.6f);
                c.vignette(0x70000000, 6, 20, 10);
                CineNet.Shot s = c.shot();
                s.key(0, c.around(center, 150, 10, 12), center, 70, LINEAR);
                s.key(25, c.around(center, 160, 9, 12), center, 72, LINEAR);
                s.key(40, c.around(center, 175, 4, 18), center, 78, EASE_OUT_EXPO);
                s.key(80, c.around(center, 180, 4, 19), center, 78, LINEAR);
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                Location center = get(c, "center");
                double radius = c.cfg("radio", 20.0);
                int exp = c.cfgI("ticksExpansion", 15);
                if (t < 25) {
                    for (int i = 0; i < 6; i++) {
                        double a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 6;
                        CineFx.stream(c.w, center.clone().add(Math.cos(a) * d, 0.3 + Math.random() * 2, Math.sin(a) * d), center.clone().add(0, 1, 0), Particle.CLOUD, 1);
                    }
                    CineFx.ring(c.w, center, 0.6 + (25 - t) * 0.12, 0xffffff, 1.0f, t * 0.3);
                    return;
                }
                if (t == 25) {
                    c.flash(0xffffff, 1, 2, 6);
                    c.shake(1.0, 20, 0.9);
                    c.sound(center, "onda.liberar", 1.6f, 0.9f);
                    CineFx.part(c.w, Particle.SONIC_BOOM, center.clone().add(0, 1, 0), 1, 0, 0);
                }
                if (t > 25 + exp) return;
                double prev = radius * Math.max(0, (t - 26)) / exp;
                double front = radius * (t - 25) / exp;
                CineFx.wave(c.w, center, front, 0xe8f4ff);
                Set<UUID> hit = get(c, "hit");
                UUID except = c.launcher == null ? c.target.getUniqueId() : null;
                for (Entity en : c.w.getNearbyEntities(center, front + 1, 8, front + 1)) {
                    if (!(en instanceof LivingEntity le) || !CineWorld.affectable(en, c.launcher) || en.getUniqueId().equals(except) || !hit.add(en.getUniqueId())) continue;
                    double d = en.getLocation().distance(center);
                    if (d > front + 0.8) {
                        hit.remove(en.getUniqueId());
                        continue;
                    }
                    double k = Math.max(0, 1 - d / radius);
                    Vector out = en.getLocation().toVector().subtract(center.toVector()).setY(0);
                    if (out.lengthSquared() < 0.01) out = forward(c.yaw0);
                    en.setVelocity(out.normalize().multiply(c.cfg("fuerzaMax", 3.0) * k).setY(0.6));
                    c.damage(le, Math.max(2, c.cfg("danio", 8.0) * k), false);
                }
                // Frágiles y bloques sueltos que saltan bajo el frente.
                int n = (int) Math.max(4, front * 2);
                for (int i = 0; i < n; i++) {
                    double a = Math.random() * Math.PI * 2;
                    double rr = prev + Math.random() * Math.max(0.5, front - prev);
                    Block top = c.w.getHighestBlockAt((int) Math.floor(center.getX() + Math.cos(a) * rr), (int) Math.floor(center.getZ() + Math.sin(a) * rr));
                    Block above = top.getRelative(0, 1, 0);
                    if (c.cfgB("romperFragiles", true)) {
                        if (CineWorld.fragile(above.getType())) world.set(above, Material.AIR);
                        if (CineWorld.fragile(top.getType())) world.set(top, Material.AIR);
                    }
                    if (c.cfgB("bloquesVoladoresVisuales", true) && i % 3 == 0 && top.getType().isSolid())
                        world.flyVisual(top.getLocation().add(0.5, 1.2, 0.5), top.getBlockData(), CineWorld.Path.LAUNCH, null, new Vector(Math.cos(a) * 0.3, 0.6 + Math.random() * 0.4, Math.sin(a) * 0.3), 30, 0);
                }
            }
        });
    }

    /* ==================================== 03 corona_espadas ==================================== */

    private static final class Sword {
        ItemDisplay d;
        Vector pos, vel;
        boolean flying, stuck;
        int stuckAt;
    }

    private void coronaEspadas() {
        e.register(new CineEngine.Ability("corona_espadas", "CORONA DE ESPADAS", "#9fe8ff", 140, 140, "Doce espadas espectrales forman una corona y se disparan contra el objetivo") {
            Location crownCenter(CineEngine.Ctx c) {
                return c.launcher != null ? c.launcher.getLocation().add(0, 2.0 + 1.5, 0) : c.feet().add(0, 15, 0);
            }

            void start(CineEngine.Ctx c) {
                c.data.put("swords", new ArrayList<Sword>());
                Location cc = crownCenter(c);
                CineNet.Shot s = c.shot();
                if (c.launcher != null) {
                    Location l = c.launcher.getLocation();
                    s.key(0, c.around(l, 30, 3, 0.4), cc, 60, LINEAR);
                    s.key(60, c.around(l, 60, 3.2, 0.5), cc, 60, LINEAR);
                } else {
                    s.key(0, c.around(c.feet(), 40, 4, 0.3), cc, 62, LINEAR);
                    s.key(60, c.around(c.feet(), 70, 4, 0.3), cc, 62, LINEAR);
                }
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                List<Sword> swords = get(c, "swords");
                int n = c.cfgI("numeroEspadas", 12);
                Location cc = crownCenter(c);
                double ring = 2.5;
                if (t < 30 && t % 2 == 0 && t / 2 < n) {
                    int i = t / 2;
                    double a = i * Math.PI * 2 / n;
                    Location at = cc.clone().add(Math.cos(a) * ring, 0, Math.sin(a) * ring);
                    Sword sw = new Sword();
                    sw.d = c.actor(fx.itemDisplay(at, new ItemStack(Material.DIAMOND_SWORD), 1.5f, 0));
                    sw.d.setGlowing(true);
                    sw.d.setGlowColorOverride(org.bukkit.Color.fromRGB(0x9fe8ff));
                    c.model(sw.d, "espada_espectral", "aparecer", 1f);
                    sw.pos = at.toVector();
                    swords.add(sw);
                    c.sound(at, "corona.aparecer", 0.7f, 1.2f + i * 0.05f);
                    CineFx.part(c.w, Particle.END_ROD, at, 6, 0.2, 0.03);
                }
                double spin = t >= 30 && t < 60 ? (t - 30) * Math.PI * 2 / 20 : t >= 60 ? Math.PI * 3 : 0;
                Location aim = c.eye();
                for (int i = 0; i < swords.size(); i++) {
                    Sword sw = swords.get(i);
                    if (!sw.d.isValid()) continue;
                    if (sw.stuck) {
                        if (c.t - sw.stuckAt == 30) c.anim(sw.d, "desvanecer");
                        if (c.t - sw.stuckAt > 40) sw.d.remove();
                        continue;
                    }
                    if (!sw.flying) {
                        double a = spin + i * Math.PI * 2 / n;
                        Location at = cc.clone().add(Math.cos(a) * ring, Math.sin(t * 0.2 + i) * 0.1, Math.sin(a) * ring);
                        sw.pos = at.toVector();
                        sw.d.teleport(at);
                        Vector dir = t >= 60 ? aim.toVector().subtract(sw.pos) : new Vector(Math.cos(a), 0.6, Math.sin(a));
                        point(sw.d, dir, 1.5f);
                        if (t == 30) c.anim(sw.d, "girar");
                    }
                }
                // Ráfaga: una espada cada intervalo hacia la posición ACTUAL del objetivo.
                int every = Math.max(1, c.cfgI("intervaloDisparoTicks", 3));
                if (t >= 70 && t < 70 + n * every && (t - 70) % every == 0) {
                    int i = (t - 70) / every;
                    if (i < swords.size()) {
                        Sword sw = swords.get(i);
                        sw.flying = true;
                        sw.vel = aim.toVector().subtract(sw.pos).normalize().multiply(c.cfg("velocidad", 1.8));
                        c.sound(sw.d.getLocation(), "corona.disparo", 1f, 1.3f);
                        if (i == 0) {
                            // Cámara: de lado con la primera espada y luego plano frontal del objetivo.
                            CineNet.Shot s = c.shot().followLook(sw.d.getEntityId());
                            Vector side = sw.vel.clone().crossProduct(new Vector(0, 1, 0)).normalize().multiply(5);
                            s.key(0, sw.d.getLocation().add(side).add(0, 1, 0), aim, 70, CUT);
                            s.key(10, mid(sw.d.getLocation(), aim, 0.8).add(side), aim, 70, LINEAR);
                            c.cam(s);
                        }
                        if (i == 4) {
                            CineNet.Shot s = c.shot();
                            s.key(0, c.around(c.feet(), 0, 6, 1.6), c.eye(), 65, CUT);
                            s.key(40, c.around(c.feet(), 15, 7, 1.8), c.eye(), 65, LINEAR);
                            c.cam(s);
                        }
                    }
                }
                for (Sword sw : swords) {
                    if (!sw.flying || sw.stuck || !sw.d.isValid()) continue;
                    // Corrección de rumbo leve (máx. 5°/tick): puede fallar si el objetivo se mueve rápido.
                    Vector want = aim.toVector().subtract(sw.pos).normalize();
                    Vector cur = sw.vel.clone().normalize();
                    double ang = Math.acos(Math.max(-1, Math.min(1, cur.dot(want))));
                    double max = Math.toRadians(5);
                    if (ang > 1e-3) {
                        double f = Math.min(1, max / ang);
                        cur = cur.multiply(1 - f).add(want.multiply(f)).normalize();
                    }
                    sw.vel = cur.multiply(c.cfg("velocidad", 1.8));
                    sw.pos.add(sw.vel);
                    Location at = sw.pos.toLocation(c.w);
                    sw.d.teleport(at);
                    point(sw.d, sw.vel, 1.5f);
                    CineFx.dot(c.w, at, 0x9fe8ff, 1.2f);
                    for (Entity en : c.w.getNearbyEntities(at, 1.1, 1.1, 1.1)) {
                        if (!(en instanceof LivingEntity le) || !CineWorld.affectable(en, c.launcher)) continue;
                        boolean last = swords.indexOf(sw) == swords.size() - 1 && en == c.target;
                        if (last) c.finalHit(c.target, c.cfg("danioPorEspada", 5.0));
                        else c.damage(le, c.cfg("danioPorEspada", 5.0), true);
                        le.setVelocity(sw.vel.clone().normalize().multiply(0.4).setY(0.15));
                        stick(c, sw, at);
                        break;
                    }
                    if (!sw.stuck && at.getBlock().getType().isSolid()) {
                        if (c.cfgB("romperBloqueAlImpactar", true)) world.set(at.getBlock(), Material.AIR);
                        stick(c, sw, at);
                    }
                    if (!sw.stuck && sw.pos.distanceSquared(c.origin.toVector()) > 120 * 120) sw.d.remove();
                }
            }

            void stick(CineEngine.Ctx c, Sword sw, Location at) {
                sw.stuck = true;
                sw.stuckAt = c.t;
                CineFx.part(c.w, Particle.ELECTRIC_SPARK, at, 12, 0.3, 0.2);
                c.sound(at, "corona.impacto", 1f, 1f);
            }
        });
    }

    /** Orienta una espada (ítem) para que la punta mire en la dirección dada. */
    private static void point(ItemDisplay d, Vector dir, float scale) {
        Vector3f to = new Vector3f((float) dir.getX(), (float) dir.getY(), (float) dir.getZ());
        if (to.lengthSquared() < 1e-6f) return;
        to.normalize();
        // En el modelo plano del ítem la hoja va en diagonal (+X +Y).
        Quaternionf q = new Quaternionf().rotationTo(new Vector3f(1, 1, 0).normalize(), to);
        d.setInterpolationDelay(0);
        d.setInterpolationDuration(2);
        d.setTransformation(new Transformation(new Vector3f(), q, new Vector3f(scale, scale, scale), new Quaternionf()));
    }

    /* ====================================== 04 super_rayo ====================================== */

    private void superRayo() {
        e.register(new CineEngine.Ability("super_rayo", "SÚPER RAYO", "#9fdcff", 100, 100, "El cielo se oscurece y cae un relámpago colosal y ramificado") {
            void start(CineEngine.Ctx c) {
                c.sky(CineNet.SKY_STORM, 0x2a2f3a, 100);
                c.sound(c.feet(), "rayo.trueno_lejano", 0.6f, 0.8f);
                CineNet.Shot s = c.shot();
                Location look = c.feet().add(0, 9, 0);
                s.key(0, c.around(c.feet(), 200, 10, 0.4), look, 75, LINEAR);
                s.key(43, c.around(c.feet(), 190, 9, 0.4), look, 75, LINEAR);
                s.key(44, c.around(c.feet(), 150, 25, 6), c.feet().add(0, 4, 0), 70, CUT);
                s.key(100, c.around(c.feet(), 140, 26, 6), c.feet().add(0, 4, 0), 70, LINEAR);
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                if (t < 40 && t % 10 == 5) {
                    CineFx.part(c.w, Particle.FLASH, c.feet().add(Math.random() * 30 - 15, 35, Math.random() * 30 - 15), 1, 0, 0);
                    if (t % 20 == 5) c.sound(c.feet(), "rayo.trueno_lejano", 0.5f, 0.7f);
                }
                if (c.launcher != null && t >= 30 && t < 44 && t % 3 == 0)
                    fx.lightning(c.w, c.launcher.getEyeLocation().add(0, 0.6, 0), c.launcher.getLocation().add(0, 60, 0), 0.25f, 2, c.seed + t, 0x9fdcff, 3);
                if (t >= 30 && t < 45) {
                    CineFx.marker(c.w, c.feet(), 2.5, 0x3a8dff, (t - 30) / 15.0);
                    CineFx.part(c.w, Particle.ELECTRIC_SPARK, c.feet().add(0, 1, 0), 4, 0.6, 0.05);
                }
                if (t == 45) {
                    Location p = c.feet();
                    c.data.put("p", p.clone());
                    fx.lightning(c.w, p.clone().add(0, 80, 0), p, (float) c.cfg("grosor", 0.9), 6, c.seed, 0x9fdcff, 4);
                    c.w.strikeLightningEffect(p);
                    c.flash(0xffffff, 0, 4, 10);
                    c.shake(2.0, 25, 0.85);
                    c.sound(p, "rayo.impacto", 3f, 0.8f);
                    c.finalHit(c.target, c.cfg("danio", 25.0));
                    world.areaDamage(p, c.cfg("radioArea", 4.0), c.cfg("danio", 25.0) * 0.5, c.launcher, c.target.getUniqueId());
                    world.bowlCrater(p.clone().add(0, -1, 0), c.cfgI("radioCrater", 3), 2, false, 0.3, 0, 0, c.rnd);
                }
                if (t == 48 || t == 51 || t == 54) {
                    Location p = get(c, "p");
                    fx.lightning(c.w, p.clone().add(0, 80, 0), p, (float) c.cfg("grosor", 0.9) * 0.8f, 5, c.seed + t, 0x9fdcff, 2);
                    c.flash(0xd8ecff, 0, 1, 3);
                }
                if (t == 60 && c.cfgB("crearFulguritas", true)) {
                    Location p = get(c, "p");
                    for (Block b : world.sphere(p, 4)) {
                        Material m = b.getType();
                        if (m == Material.SAND || m == Material.RED_SAND || m == Material.GRAVEL || m == Material.SUSPICIOUS_SAND) world.set(b, Material.GLASS);
                    }
                }
                if (t == 80) c.skyReset();
            }
        });
    }

    /* =================================== 05 trueno_explosion =================================== */

    private void truenoExplosion() {
        e.register(new CineEngine.Ability("trueno_explosion", "TRUENO + EXPLOSIÓN", "#ffb347", 140, 140, "Tres rayos cercan al objetivo, cae el rayo central y todo estalla") {
            void start(CineEngine.Ctx c) {
                c.sky(CineNet.SKY_STORM, 0x262a36, 140);
                List<Location> v = new ArrayList<>();
                for (int i = 0; i < 3; i++) v.add(c.ground(c.around(c.feet(), i * 120, 6, 2)));
                c.data.put("v", v);
                c.data.put("center", c.feet());
                CineNet.Shot s = c.shot();
                orbit(s, c, c.feet(), 12, 12, 4, 4, 0, 240, 0, 40, c.eye(), 70, 70);
                s.key(60, c.around(c.feet(), 250, 3, 20), c.feet(), 75, EASE_IN_OUT);
                s.key(68, c.around(c.feet(), 252, 3, 20), c.feet(), 75, LINEAR);
                s.key(69, c.around(c.feet(), 120, 30, 3), c.feet().add(0, 4, 0), 75, CUT);
                s.key(140, c.around(c.feet(), 125, 32, 4), c.feet().add(0, 4, 0), 75, LINEAR);
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                List<Location> v = get(c, "v");
                if (t < 40) for (int i = 0; i < 3; i++) if (t < 20 + i * 10) CineFx.marker(c.w, v.get(i), 1.8, 0x5aa0ff, Math.min(1, t / (20.0 + i * 10)));
                if (t == 20 || t == 30 || t == 40) {
                    Location p = v.get((t - 20) / 10);
                    fx.lightning(c.w, p.clone().add(0, 60, 0), p, 0.35f, 3, c.seed + t, 0xa8d8ff, 5);
                    c.sound(p, "trueno.menor", 2f, 1.1f);
                    c.shake(0.6, 10, 0.85);
                    world.areaDamage(p, 2, c.cfg("danioRayoMenor", 6.0), c.launcher, null);
                    world.bowlCrater(p.clone().add(0, -1, 0), 1, 1, false, 0.4, 0, 0, c.rnd);
                }
                if (t >= 40 && t < 60) {
                    if (c.cfgB("inmovilizar", true)) c.target.addPotionEffect(new PotionEffect(PotionEffectType.SLOWNESS, 25, 6, false, false));
                    if (t % 4 == 0)
                        for (int i = 0; i < 3; i++)
                            fx.lightning(c.w, v.get(i).clone().add(0, 1, 0), v.get((i + 1) % 3).clone().add(0, 1, 0), 0.12f, 1, c.seed + t * 7 + i, 0x9fd0ff, 4);
                }
                if (t == 60) {
                    Location p = c.feet();
                    c.data.put("center", p.clone());
                    fx.lightning(c.w, p.clone().add(0, 80, 0), p, 0.9f, 6, c.seed + 99, 0xbfe4ff, 8);
                    c.flash(0xffffff, 0, 3, 6);
                    c.sound(p, "trueno.mayor", 3f, 0.7f);
                    c.damage(c.target, c.cfg("danioRayo", 15.0), true);
                }
                if (t >= 70 && t <= 100) {
                    Location p = get(c, "center");
                    if (t == 70) {
                        CineFx.Orb o = fx.orb(p.clone().add(0, 1, 0), 0.5f, Material.ORANGE_CONCRETE, Material.YELLOW_STAINED_GLASS, 0xff9a2a, 60);
                        o.radius(9, 1.2f, 8);
                        c.data.put("orb", o);
                        c.flash(0xfff2d0, 0, 5, 20);
                        c.shake(2.0, 30, 0.9);
                        c.sound(p, "trueno.explosion_grande", 4f, 0.6f);
                        CineFx.part(c.w, Particle.EXPLOSION_EMITTER, p, 3, 2, 0);
                        world.bowlCrater(p.clone().add(0, -1, 0), c.cfgI("radioCrater", 8), 5, true, 0.25, 0.05, 0, c.rnd);
                        c.finalHit(c.target, c.cfg("danioExplosion", 30.0));
                        world.areaDamage(p, 12, c.cfg("danioExplosion", 30.0), c.launcher, c.target.getUniqueId());
                        CineWorld.radial(p, 12, 2.5, 0.8, c.launcher, null);
                    }
                    if (t == 82) {
                        CineFx.Orb o = get(c, "orb");
                        o.radius(0.1f, 2.4f, 18);
                    }
                    CineFx.wave(c.w, p, (t - 70) * 25.0 / 30, 0xffa040);
                }
                if (t > 70 && t % 3 == 0) {
                    Location p = get(c, "center");
                    CineFx.part(c.w, Particle.LARGE_SMOKE, p.clone().add(Math.random() * 10 - 5, 1, Math.random() * 10 - 5), 2, 0.4, 0.04);
                    CineFx.part(c.w, Particle.FLAME, p.clone().add(Math.random() * 8 - 4, 0.5, Math.random() * 8 - 4), 2, 0.3, 0.02);
                }
                if (t == 120) c.skyReset();
            }
        });
    }

    /* =================================== 06 carrusel_creepers =================================== */

    private void carruselCreepers() {
        e.register(new CineEngine.Ability("carrusel_creepers", "CARRUSEL DE CREEPERS", "#58ff7a", 200, 200, "Ocho creepers giran como un tiovivo, se hinchan y se lanzan uno tras otro") {
            void start(CineEngine.Ctx c) {
                int n = c.cfgI("numeroCreepers", 8);
                double r = c.cfg("radioOrbita", 6.0);
                Location center = c.feet();
                c.data.put("center", center.clone());
                List<Creeper> list = new ArrayList<>();
                for (int i = 0; i < n; i++) {
                    double a = i * Math.PI * 2 / n;
                    Location at = center.clone().add(Math.cos(a) * r, -2, Math.sin(a) * r);
                    Creeper cr = c.w.spawn(at, Creeper.class, k -> {
                        k.setAI(false);
                        k.setGravity(false);
                        k.setInvulnerable(true);
                        k.setSilent(true);
                        k.setCollidable(false);
                        k.setPersistent(false);
                        k.setRemoveWhenFarAway(false);
                        k.setMaxFuseTicks(4000);
                        k.setExplosionRadius(0);
                        k.addScoreboardTag(CineFx.TAG);
                    });
                    list.add(c.actor(cr));
                }
                c.data.put("creepers", list);
                c.data.put("angle", 0.0);
                CineNet.Shot s = c.shot();
                s.key(0, c.around(center, 0, 7, 1.8), c.eye(), 70, LINEAR);
                s.key(19, c.around(center, 10, 7, 1.8), c.eye(), 70, LINEAR);
                // Vista aérea que gira al revés que el carrusel (vértigo).
                orbit(s, c, center, 10, 10, 14, 14, 20, -200, 20, 130, center, 72, 72);
                s.key(130, c.around(center, 30, 3, 0.4), c.eye(), 75, CUT);
                s.key(170, c.around(center, 40, 3.2, 0.4), c.eye(), 75, LINEAR);
                s.key(171, c.around(center, 30, 14, 6), center, 72, CUT);
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                List<Creeper> list = get(c, "creepers");
                Location center = get(c, "center");
                double r = c.cfg("radioOrbita", 6.0);
                int n = list.size();
                double w = 0;
                if (t >= 20) w = (0.5 + (c.cfg("velocidadMax", 3.0) - 0.5) * Math.min(1, (t - 20) / 80.0)) / 20.0;
                double angle = (double) c.data.get("angle") + w;
                c.data.put("angle", angle);
                double h = t < 20 ? -2 + 2 * (t / 20.0) : Math.min(3, (t - 20) / 80.0 * 3);
                for (int i = 0; i < n; i++) {
                    Creeper cr = list.get(i);
                    if (!cr.isValid() || cr.getScoreboardTags().contains("dash")) continue;
                    double a = angle + i * Math.PI * 2 / n;
                    double y = h + (t >= 20 ? Math.sin(t * 0.25 + i * 1.3) * 0.5 : 0);
                    Location at = center.clone().add(Math.cos(a) * r, y, Math.sin(a) * r);
                    at.setYaw((float) Math.toDegrees(a));
                    cr.teleport(at);
                    if (t < 20 && t % 3 == 0) CineFx.part(c.w, Particle.BLOCK, at.clone().add(0, 2, 0), 6, 0.3, 0.05, 0.3, 0, Material.DIRT.createBlockData());
                    if (t >= 20 && t % 2 == 0) CineFx.dot(c.w, at.clone().add(0, 0.8, 0), 0x3ddc5c, 0.9f);
                }
                if (t >= 20 && t < 130 && t % 5 == 0) c.sound(center, "carrusel.musica", 0.8f, (float) Math.min(2.0, 0.6 + (t - 20) / 80.0));
                if (t == 100) {
                    for (Creeper cr : list) if (cr.isValid()) cr.ignite();
                    c.sound(center, "carrusel.siseo", 1.5f, 1f);
                }
                if (t >= 130 && t < 170 && (t - 130) % 5 == 0) {
                    int i = (t - 130) / 5;
                    if (i < n) {
                        Creeper cr = list.get(i);
                        cr.addScoreboardTag("dash");
                        c.data.put("dash" + i, t);
                    }
                }
                for (int i = 0; i < n; i++) {
                    Creeper cr = list.get(i);
                    if (!cr.isValid() || !cr.getScoreboardTags().contains("dash")) continue;
                    int since = t - (int) c.data.get("dash" + i);
                    Location at = cr.getLocation();
                    Vector to = c.eye().toVector().subtract(at.toVector());
                    if (to.length() < 1.6 || since > 8) {
                        boom(c, cr, i == n - 1);
                        continue;
                    }
                    cr.teleport(at.add(to.normalize().multiply(Math.max(1.2, to.length() / 3))));
                }
            }

            void boom(CineEngine.Ctx c, Creeper cr, boolean last) {
                Location at = cr.getLocation();
                cr.remove();
                CineFx.part(c.w, Particle.EXPLOSION_EMITTER, at, 1, 0, 0);
                c.sound(at, "carrusel.explosion", 2f, 1f);
                c.shake(0.7, 10, 0.85);
                if (c.cfgB("romperBloques", true)) world.enqueueSorted(world.sphere(at, 2), at, true, Material.AIR);
                if (last) c.finalHit(c.target, c.cfg("danioPorCreeper", 5.0));
                world.areaDamage(at, 4, c.cfg("danioPorCreeper", 5.0), c.launcher, last ? c.target.getUniqueId() : null);
                CineWorld.radial(at, 4, 0.8, 0.4, c.launcher, null);
            }

            void end(CineEngine.Ctx c, boolean cancelled) {
                List<Creeper> list = get(c, "creepers");
                if (list == null) return;
                for (Creeper cr : list)
                    if (cr.isValid()) {
                        CineFx.part(c.w, Particle.EXPLOSION, cr.getLocation(), 1, 0, 0);
                        cr.remove();
                    }
            }
        });
    }

    /* ======================================= 07 ojo_vacio ======================================= */

    private void ojoVacio() {
        e.register(new CineEngine.Ability("ojo_vacio", "OJO DEL VACÍO", "#b15cff", 260, 260, "Un ojo colosal se abre en el cielo, todo levita y luego es aplastado") {
            void start(CineEngine.Ctx c) {
                Location eyeAt = c.feet().add(0, 40, 0);
                c.data.put("eye", eyeAt);
                c.sky(CineNet.SKY_TINT, 0x4b1f6f, 260);
                // Ojo de servidor: iris morado + anillos + pupila; párpados que se abren. Con mod se ve el modelo GeckoLib.
                ItemDisplay holder = c.actor(fx.itemDisplay(eyeAt, new ItemStack(Material.AIR), 1f, 0));
                c.data.put("holder", holder);
                BlockDisplay iris = c.actor(fx.blockDisplay(eyeAt, Material.PURPLE_CONCRETE.createBlockData(), 0xb15cff, 0));
                BlockDisplay iris2 = c.actor(fx.blockDisplay(eyeAt, Material.MAGENTA_STAINED_GLASS.createBlockData(), 0xd08aff, 0));
                BlockDisplay pupil = c.actor(fx.blockDisplay(eyeAt, Material.BLACK_CONCRETE.createBlockData(), -1, 0));
                BlockDisplay lidA = c.actor(fx.blockDisplay(eyeAt, Material.BLACKSTONE.createBlockData(), -1, 0));
                BlockDisplay lidB = c.actor(fx.blockDisplay(eyeAt, Material.BLACKSTONE.createBlockData(), -1, 0));
                flat(iris, 14, 0.3f, 0, 0);
                flat(iris2, 14, 0.25f, (float) (Math.PI / 4), 0);
                flat(pupil, 3, 0.5f, 0, 0);
                lid(lidA, 1, 1f, 0);
                lid(lidB, -1, 1f, 0);
                c.model(holder, "ojo_vacio", "abrir", 16f, iris, iris2, pupil, lidA, lidB);
                c.data.put("iris", iris);
                c.data.put("pupil", pupil);
                c.data.put("lidA", lidA);
                c.data.put("lidB", lidB);
                c.data.put("float", new HashSet<UUID>());
                CineNet.Shot s = c.shot();
                Location low = c.around(c.feet(), 180, 3, 0.3);
                s.key(0, low, eyeAt, 80, LINEAR);
                s.key(60, c.around(c.feet(), 182, 3.4, 0.3), eyeAt, 80, LINEAR);
                // Dolly zoom: la cámara retrocede mientras el FOV se cierra.
                s.key(160, c.around(c.feet(), 190, 14, 1.0), eyeAt, 50, EASE_IN_OUT);
                s.key(161, c.around(c.feet(), 90, 30, 8), c.feet().add(0, 8, 0), 70, CUT);
                s.key(260, c.around(c.feet(), 95, 31, 9), c.feet().add(0, 10, 0), 70, LINEAR);
                c.cam(s);
            }

            void flat(BlockDisplay d, float size, float thick, float rotY, int interp) {
                Quaternionf q = new Quaternionf().rotateY(rotY);
                Vector3f t = new Vector3f(-size / 2, -thick / 2, -size / 2);
                q.transform(t);
                CineFx.shape(d, t, q, new Vector3f(size, thick, size), interp);
            }

            /** Párpado: losa que cubre medio ojo; open=0 cerrado, 1 abierto (se retrae hacia fuera). */
            void lid(BlockDisplay d, int side, float closed, int interp) {
                float w = 16, h = 8 * closed;
                Vector3f t = new Vector3f(-w / 2, -0.6f, side > 0 ? 0 : -h);
                if (side > 0) t.z = 8 - h; // se recoge hacia el borde
                CineFx.shape(d, t, new Quaternionf(), new Vector3f(w, 0.4f, h), interp);
            }

            void tick(CineEngine.Ctx c, int t) {
                Location eyeAt = get(c, "eye");
                if (t < 60 && t % 2 == 0) CineFx.glyph(c.w, eyeAt.clone().add(0, 1, 0), 18, 3, c.seed, Math.min(1, t / 30.0), t * 0.03, 0xb15cff, 0x5a1a8a);
                if (t >= 60 && t < 230 && t % 4 == 0) CineFx.glyph(c.w, eyeAt.clone().add(0, 1, 0), 18, 3, c.seed, t < 180 ? 1 : (230 - t) / 50.0, t * 0.03, 0xb15cff, 0x5a1a8a);
                if (t % 3 == 0 && t < 230) {
                    for (int k = 0; k < 4; k++) CineFx.ring(c.w, eyeAt.clone().add(0, -0.3, 0), 2 + k * 1.6, k % 2 == 0 ? 0x8a2be2 : 0x2a0a3a, 1.4f, t * 0.02 * (k % 2 == 0 ? 1 : -1));
                }
                if (t == 30) {
                    c.anim(get(c, "holder"), "abrir");
                    lid(get(c, "lidA"), 1, 0.05f, 30);
                    lid(get(c, "lidB"), -1, 0.05f, 30);
                    c.vignette(0x904b1f6f, 10, 120, 20);
                    c.sound(eyeAt, "ojo.abrir", 3f, 0.6f);
                }
                if (t >= 60 && t < 160) {
                    double radius = c.cfg("radio", 15.0);
                    double lift = c.cfg("alturaLevitacion", 6.0);
                    Set<UUID> fl = get(c, "float");
                    for (Entity en : c.w.getNearbyEntities(c.origin, radius, radius, radius)) {
                        if (!CineWorld.affectable(en, c.launcher)) continue;
                        fl.add(en.getUniqueId());
                        Location target = en.getLocation();
                        target.setY(c.origin.getY() + lift + Math.sin((t + en.getEntityId()) * 0.1) * 0.3);
                        CineWorld.hold(en, target);
                    }
                    if (t < 110) {
                        int max = c.cfgI("maxBloquesFlotantes", 120);
                        for (int k = 0; k < 3 && (int) c.data.getOrDefault("lifted", 0) < max; k++) {
                            double a = c.rnd.nextDouble() * Math.PI * 2, d = 2 + c.rnd.nextDouble() * (radius - 2);
                            Block top = c.w.getHighestBlockAt((int) Math.floor(c.origin.getX() + Math.cos(a) * d), (int) Math.floor(c.origin.getZ() + Math.sin(a) * d));
                            if (!top.getType().isSolid()) continue;
                            if (world.fly(top, k % 2 == 0 ? CineWorld.Path.HOVER : CineWorld.Path.ORBIT, c.origin.clone().add(0, lift, 0), new Vector(0, 0.35 + c.rnd.nextDouble() * 0.2, 0), 140, 0.02))
                                c.data.put("lifted", (int) c.data.getOrDefault("lifted", 0) + 1);
                        }
                    }
                    if (t % 4 == 0) {
                        // La pupila sigue al objetivo.
                        BlockDisplay pupil = get(c, "pupil");
                        Vector off = c.feet().toVector().subtract(eyeAt.toVector()).setY(0);
                        if (off.length() > 2.5) off.normalize().multiply(2.5);
                        Quaternionf q = new Quaternionf();
                        CineFx.shape(pupil, new Vector3f((float) off.getX() - 1.5f, -0.25f, (float) off.getZ() - 1.5f), q, new Vector3f(3, 0.5f, 3), 4);
                        CineFx.part(c.w, Particle.REVERSE_PORTAL, c.origin.clone().add(c.rnd.nextDouble() * 20 - 10, 0.5, c.rnd.nextDouble() * 20 - 10), 6, 0.5, 0.05);
                    }
                    if (t % 40 == 0) c.sound(eyeAt, "ojo.zumbido", 2f, 0.5f);
                }
                if (t == 160) {
                    c.anim(get(c, "holder"), "latido");
                    c.flash(0xb15cff, 0, 3, 10);
                    c.shake(1.6, 20, 0.85);
                    c.sound(eyeAt, "ojo.latido", 4f, 0.6f);
                }
                if (t >= 160 && t < 175) CineFx.wave(c.w, c.ground(c.origin), (t - 160) * 1.4, 0x8a2be2);
                if (t == 162) {
                    Set<UUID> fl = get(c, "float");
                    for (UUID id : fl) {
                        Entity en = org.bukkit.Bukkit.getEntity(id);
                        if (en == null || !en.isValid()) continue;
                        en.setVelocity(new Vector(0, -3, 0));
                        if (en instanceof LivingEntity le) {
                            if (en == c.target) c.finalHit(c.target, c.cfg("danio", 24.0));
                            else c.damage(le, c.cfg("danio", 24.0) * 0.5, true);
                        }
                    }
                    world.dropFlyers(c.origin, 40);
                    world.bowlCrater(c.ground(c.feet()).add(0, -1, 0), c.cfgI("radioCrater", 6), 2, false, 0, 0, 0, c.rnd);
                    CineFx.part(c.w, Particle.EXPLOSION_EMITTER, c.feet(), 2, 1, 0);
                }
                if (t > 162 && t < 200) {
                    // El aplastamiento sustituye la caída: sin daño de caída duplicado.
                    Set<UUID> fl = get(c, "float");
                    for (UUID id : fl) {
                        Entity en = org.bukkit.Bukkit.getEntity(id);
                        if (en != null) en.setFallDistance(0);
                    }
                }
                if (t == 180) {
                    c.anim(get(c, "holder"), "cerrar");
                    lid(get(c, "lidA"), 1, 1f, 40);
                    lid(get(c, "lidB"), -1, 1f, 40);
                }
                if (t == 230) {
                    for (Entity en : new ArrayList<>(c.actors)) if (en instanceof BlockDisplay || en instanceof ItemDisplay) en.remove();
                    c.skyReset();
                }
            }
        });
    }

    /* ===================================== 08 agujero_negro ===================================== */

    private void agujeroNegro() {
        e.register(new CineEngine.Ability("agujero_negro", "AGUJERO NEGRO", "#ff8a1a", 300, 300, "Una singularidad arranca el terreno en espiral, lo traga todo y colapsa") {
            void start(CineEngine.Ctx c) {
                Location hole;
                if (c.launcher != null) hole = mid(c.launcher.getEyeLocation(), c.eye(), 0.6);
                else hole = c.feet().add(forward(c.yaw0).multiply(12)).add(0, 6, 0);
                c.data.put("hole", hole);
                CineFx.Orb o = fx.orb(hole, 0.1f, Material.BLACK_CONCRETE, Material.BLACK_CONCRETE, -1, 0);
                for (BlockDisplay d : o.parts) c.actor(d);
                o.radius(2, 0.5f, 30);
                c.data.put("orb", o);
                c.sound(hole, "agujero.formacion", 2f, 0.5f);
                c.vignette(0xa0000000, 20, 220, 30);
                // Bloques a arrancar (de fuera a dentro).
                List<Block> cand = new ArrayList<>();
                for (Block b : world.sphere(hole, c.cfg("radioArranque", 10.0))) if (b.getType().isSolid() && world.breakable(b)) cand.add(b);
                cand.sort((a, b) -> Double.compare(b.getLocation().distanceSquared(hole), a.getLocation().distanceSquared(hole)));
                c.data.put("cand", cand);
                c.data.put("ci", 0);
                Vector side = forward(c.yaw0).crossProduct(new Vector(0, 1, 0)).normalize();
                Location midp = mid(c.feet(), hole, 0.5);
                CineNet.Shot s = c.shot();
                s.key(0, midp.clone().add(side.clone().multiply(25)).add(0, 4, 0), midp, 70, LINEAR);
                s.key(30, midp.clone().add(side.clone().multiply(24)).add(0, 4, 0), midp, 70, LINEAR);
                for (int k = 1; k <= 10; k++) {
                    double f = k / 10.0;
                    Location p = hole.clone().add(side.clone().multiply(25 - 17 * f)).add(0, 3 - f, 0).subtract(forward(c.yaw0).multiply(4 * f));
                    s.key(30 + k * 20, p, hole, (k % 2 == 0 ? 10f : -10f), 72, LINEAR);
                }
                s.key(250, hole.clone().add(side.clone().multiply(40)).add(0, 10, 0), hole, 0f, 70, CUT);
                s.key(300, hole.clone().add(side.clone().multiply(42)).add(0, 11, 0), hole, 0f, 70, LINEAR);
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                Location hole = get(c, "hole");
                CineFx.Orb o = get(c, "orb");
                double r0 = t < 30 ? 2.5 * t / 30.0 : t < 230 ? 2.5 : 2.5 * Math.max(0, (250 - t) / 20.0);
                double r1 = t < 30 ? 2.5 + 4.5 * t / 30.0 : t < 230 ? 7 : 7 * Math.max(0, (250 - t) / 20.0);
                if (t < 250 && t % 2 == 0) CineFx.disk(c.w, hole, Math.max(0.1, r0), Math.max(0.2, r1), t * 0.12, 0xfff6e0, 0xff7a00);
                if (t >= 30 && t < 230) {
                    double grow = Math.min(1, (t - 30) / 120.0);
                    CineWorld.pull(hole, c.cfg("radioAtraccion", 25.0), c.cfg("fuerzaMax", 0.25) * (0.3 + 0.7 * grow), c.launcher);
                    List<Block> cand = get(c, "cand");
                    int ci = get(c, "ci");
                    int max = c.cfgI("maxBloquesAbsorbidos", 600);
                    int per = Math.max(1, max / 200);
                    for (int k = 0; k < per && ci < Math.min(max, cand.size()); k++, ci++)
                        world.fly(cand.get(ci), CineWorld.Path.SPIRAL_IN, hole, null, 160, 0.04 + grow * 0.05);
                    c.data.put("ci", ci);
                    if (t % 2 == 0) {
                        double a = c.rnd.nextDouble() * Math.PI * 2, d = 6 + c.rnd.nextDouble() * 12;
                        CineFx.stream(c.w, hole.clone().add(Math.cos(a) * d, c.rnd.nextDouble() * 6 - 3, Math.sin(a) * d), hole, Particle.SMOKE, 3);
                    }
                    if (t % 40 == 30) c.sound(hole, "agujero.zumbido", 2f, 0.4f + (float) grow * 0.4f);
                    double hr = c.cfg("radioHorizonte", 2.0);
                    for (Entity en : c.w.getNearbyEntities(hole, hr + 0.5, hr + 0.5, hr + 0.5)) {
                        if (en instanceof Item it && c.cfgB("destruirItems", true)) {
                            it.remove();
                            continue;
                        }
                        if (!(en instanceof LivingEntity le) || !CineWorld.affectable(en, c.launcher)) continue;
                        CineWorld.hold(en, hole);
                        if (t % 10 == 0) c.damage(le, c.cfg("danioTick", 2.0), true);
                    }
                    if (t % 20 == 0 && c.target.getLocation().distance(hole) < 8) c.tint(0x50000000, 5, 15, 5);
                }
                if (t == 230) o.radius(0.05f, 3f, 20);
                if (t == 250) {
                    c.flash(0xffffff, 0, 6, 25);
                    c.shake(2.0, 30, 0.9);
                    c.sound(hole, "agujero.colapso", 4f, 0.6f);
                    o.remove();
                    CineWorld.radial(hole, c.cfg("radioAtraccion", 25.0), 3.2, 1.0, c.launcher, null);
                    if (c.target.getLocation().distance(hole) < c.cfg("radioAtraccion", 25.0)) c.finalHit(c.target, c.cfg("danioColapso", 20.0));
                    world.areaDamage(hole, c.cfg("radioAtraccion", 25.0), c.cfg("danioColapso", 20.0), c.launcher, c.target.getUniqueId());
                    CineFx.part(c.w, Particle.EXPLOSION_EMITTER, hole, 3, 1.5, 0);
                }
                if (t >= 250 && t < 275) CineFx.wave(c.w, hole, (t - 250) * 30.0 / 25, 0xffffff);
            }
        });
    }

    /* ===================================== 09 juicio_arcano ===================================== */

    private record Strike(Location at, int impact) {}

    private void juicioArcano() {
        e.register(new CineEngine.Ability("juicio_arcano", "JUICIO ARCANO", "#ffd34d", 260, 260, "Círculos mágicos en el cielo desatan una lluvia de rayos y un pilar final") {
            void start(CineEngine.Ctx c) {
                Location main = c.feet().add(0, 30, 0);
                c.data.put("main", main);
                List<Location> minors = new ArrayList<>();
                for (int i = 0; i < 6; i++) minors.add(c.around(c.feet(), i * 60, 10, 22 + (i % 3) * 3));
                c.data.put("minors", minors);
                // Lluvia con semilla: 30% de los rayos cerca del objetivo.
                List<Strike> strikes = new ArrayList<>();
                int n = c.cfgI("numeroRayos", 33);
                double zone = c.cfg("radioZona", 15.0);
                for (int i = 0; i < n; i++) {
                    int impact = 100 + (int) Math.round(i * (90.0 / Math.max(1, n - 1)));
                    strikes.add(new Strike(null, impact));
                }
                c.data.put("strikes", strikes);
                c.data.put("zone", zone);
                CineNet.Shot s = c.shot();
                s.key(0, c.around(c.feet(), 200, 4, 0.5), main, 72, LINEAR);
                s.key(90, c.around(c.feet(), 210, 8, 35), main.clone().add(0, -5, 0), 72, EASE_IN_OUT);
                s.key(91, c.around(c.feet(), 135, 18, 25), c.feet(), 70, CUT);
                s.key(190, c.around(c.feet(), 150, 18, 25), c.feet(), 70, LINEAR);
                s.key(200, c.around(c.feet(), 180, 2.5, 0.3), main, 80, CUT);
                s.key(219, c.around(c.feet(), 185, 2.6, 0.3), main, 80, LINEAR);
                s.key(220, c.around(c.feet(), 120, 35, 8), c.feet().add(0, 10, 0), 70, CUT);
                s.key(260, c.around(c.feet(), 125, 36, 9), c.feet().add(0, 10, 0), 70, LINEAR);
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                Location main = get(c, "main");
                List<Location> minors = get(c, "minors");
                double draw = Math.min(1, t / 60.0);
                double fade = t > 220 ? Math.max(0, (250 - t) / 30.0) : 1;
                if (t < 250 && t % 2 == 0) {
                    CineFx.glyph(c.w, main, 16, 3, c.seed, draw * fade, t * 0.02, 0xffd34d, 0xb15cff);
                    for (int i = 0; i < minors.size(); i++) {
                        Location m = minors.get(i);
                        if (t >= 200) m = c.feet().add(0, 8 + i * 3.5, 0); // se alinean en columna
                        CineFx.glyph(c.w, m, 4, 2, c.seed + i, Math.min(1, t / 40.0) * fade, t * 0.05 * (i % 2 == 0 ? 1 : -1), i % 2 == 0 ? 0xb15cff : 0xffd34d, 0xffffff);
                    }
                }
                if (t >= 60 && t < 90) {
                    if (t == 60) c.sound(c.feet(), "juicio.carga", 2f, 0.6f);
                    for (int k = 0; k < 5; k++) {
                        Location l = c.feet().add(c.rnd.nextDouble() * 24 - 12, 0.2, c.rnd.nextDouble() * 24 - 12);
                        CineFx.shoot(c.w, Particle.END_ROD, l, new Vector(0, 1, 0), 0.6);
                    }
                }
                List<Strike> strikes = get(c, "strikes");
                double zone = get(c, "zone");
                for (int i = 0; i < strikes.size(); i++) {
                    Strike s = strikes.get(i);
                    int warn = s.impact() - 10;
                    if (t == warn) {
                        boolean near = c.rnd.nextDouble() < 0.3;
                        double rr = near ? c.rnd.nextDouble() * 4 : c.rnd.nextDouble() * zone;
                        double a = c.rnd.nextDouble() * Math.PI * 2;
                        Location at = c.ground(c.feet().add(Math.cos(a) * rr, 3, Math.sin(a) * rr));
                        strikes.set(i, s = new Strike(at, s.impact()));
                    }
                    if (s.at() == null) continue;
                    if (t >= warn && t < s.impact()) CineFx.marker(c.w, s.at(), 2, 0xffd34d, (t - warn) / 10.0);
                    if (t == s.impact()) {
                        Location from = minors.get(0);
                        for (Location m : minors) if (m.distanceSquared(s.at()) < from.distanceSquared(s.at())) from = m;
                        fx.beam(s.at(), from, 0.25f, Material.YELLOW_CONCRETE, 0xffe066, 5);
                        CineFx.part(c.w, Particle.FLASH, s.at().clone().add(0, 1, 0), 1, 0, 0);
                        c.sound(s.at(), "juicio.rayo", 1.2f, 1.2f);
                        world.areaDamage(s.at(), 2, c.cfg("danioRayo", 8.0), c.launcher, null);
                        world.bowlCrater(s.at().clone().add(0, -1, 0), 1, 1, false, 0.2, 0, 0, c.rnd);
                    }
                }
                if (t >= 200 && t < 220) CineFx.marker(c.w, c.feet(), 5, 0xffffff, (t - 200) / 20.0);
                if (t == 220) {
                    Location ground = c.ground(c.feet());
                    BlockDisplay pillar = fx.beam(ground.clone().add(0, -2, 0), main, 3f, Material.YELLOW_CONCRETE, 0xfff2a0, 45);
                    c.data.put("pillar", pillar);
                    c.data.put("pg", ground);
                    c.flash(0xfff8e0, 0, 5, 18);
                    c.shake(2.0, 30, 0.9);
                    c.sound(ground, "juicio.final", 3f, 0.8f);
                    c.finalHit(c.target, c.cfg("danioFinal", 40.0));
                    world.areaDamage(ground, 5, c.cfg("danioFinal", 40.0) * 0.6, c.launcher, c.target.getUniqueId());
                    int rc = c.cfgI("radioCraterFinal", 5);
                    world.enqueueSorted(world.cylinder(ground, rc, 6, 4), ground, true, Material.AIR);
                }
                if (t == 225) {
                    BlockDisplay pillar = get(c, "pillar");
                    if (pillar != null && pillar.isValid()) CineFx.beamRadius(pillar, ((Location) get(c, "pg")).clone().add(0, -2, 0), main, 0.05f, 35);
                }
            }
        });
    }

    /* ==================================== 10 esfera_energia ==================================== */

    private void esferaEnergia() {
        e.register(new CineEngine.Ability("esfera_energia", "ESFERA DE ENERGÍA", "#7fd4ff", 320, 320, "La energía de todo lo cercano forma una esfera gigante que se lanza contra el objetivo") {
            void start(CineEngine.Ctx c) {
                Location base;
                if (c.launcher != null) base = c.launcher.getLocation();
                else {
                    base = c.ground(c.feet().add(forward(c.yaw0).multiply(30)).add(0, 5, 0));
                    ArmorStand inv = c.actor(c.w.spawn(base, ArmorStand.class, a -> {
                        a.setArms(true);
                        a.setBasePlate(false);
                        a.setGravity(false);
                        a.setInvulnerable(true);
                        a.setGlowing(true);
                        a.setRotation(c.yaw0 + 180, 0);
                        a.setRightArmPose(new EulerAngle(Math.toRadians(-170), 0, Math.toRadians(10)));
                        a.setLeftArmPose(new EulerAngle(Math.toRadians(-170), 0, Math.toRadians(-10)));
                        a.getEquipment().setHelmet(new ItemStack(Material.LIGHT_BLUE_STAINED_GLASS));
                        a.getEquipment().setChestplate(new ItemStack(Material.DIAMOND_CHESTPLATE));
                    }));
                    ItemDisplay holder = c.actor(fx.itemDisplay(base.clone(), new ItemStack(Material.AIR), 1f, 0));
                    holder.setRotation(c.yaw0 + 180, 0);
                    c.model(holder, "invocador", "aparicion", 1.4f, inv);
                    c.data.put("inv", holder);
                }
                c.data.put("base", base);
                // Fuentes de energía: hojas y agua cercanas (con semilla).
                List<Location> src = new ArrayList<>();
                for (int i = 0; i < 80 && src.size() < 12; i++) {
                    Block b = c.w.getHighestBlockAt(base.getBlockX() + c.rnd.nextInt(49) - 24, base.getBlockZ() + c.rnd.nextInt(49) - 24);
                    Material m = b.getType();
                    if (org.bukkit.Tag.LEAVES.isTagged(m) || m == Material.WATER || org.bukkit.Tag.LOGS.isTagged(m) || m == Material.GRASS_BLOCK) src.add(b.getLocation().add(0.5, 1, 0.5));
                }
                c.data.put("src", src);
                Location center = base.clone().add(0, 4, 0);
                CineFx.Orb o = fx.orb(center, 0.5f, Material.LIGHT_BLUE_CONCRETE, Material.LIGHT_BLUE_STAINED_GLASS, 0x7fd4ff, 0);
                for (BlockDisplay d : o.parts) c.actor(d);
                c.data.put("orb", o);
                c.data.put("center", center);
                CineNet.Shot s = c.shot();
                for (int k = 0; k <= 8; k++) {
                    int tk = 20 + k * 20;
                    double r = 0.5 + (c.cfg("radioMax", 12.0) - 0.5) * Math.min(1, k / 8.0);
                    s.key(tk == 20 ? 0 : tk, c.around(base, 200, 10 + r * 2.6, 0.5 + r * 0.3), base.clone().add(0, r + 3, 0), 72, LINEAR);
                }
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                Location base = get(c, "base");
                CineFx.Orb o = get(c, "orb");
                double rmax = c.cfg("radioMax", 12.0);
                if (t >= 20 && t < 180) {
                    double f = (t - 20) / 160.0;
                    double r = 0.5 + (rmax - 0.5) * (1 - Math.pow(1 - f, 2));
                    Location center = base.clone().add(0, r + 3, 0);
                    o.move(center);
                    if (t % 4 == 0) o.radius((float) r, t * 0.02f, 4);
                    c.data.put("center", center);
                    c.data.put("r", r);
                    List<Location> src = get(c, "src");
                    if (t % 2 == 0) for (Location s : src) CineFx.stream(c.w, s, center, Particle.END_ROD, 1);
                    if (c.cfgB("energiaDeJugadores", true) && t % 2 == 0)
                        for (Player p : c.w.getPlayers()) if (p.getLocation().distanceSquared(base) < 64 * 64) CineFx.stream(c.w, p.getLocation().add(0, 1.2, 0), center, Particle.ELECTRIC_SPARK, 2);
                    if (t % 20 == 0) c.sound(center, "esfera.carga", 1.5f, 0.5f + (float) f);
                    if (t % 3 == 0) CineFx.sphereShell(c.w, center, r * 1.05, (int) (40 + r * 6), 0xcff4ff, 1.4f);
                }
                if (t == 180) {
                    Location center = get(c, "center");
                    CineNet.Shot s = c.shot();
                    s.key(0, c.target.getEyeLocation().add(forward(c.yaw0).multiply(-2.5)).add(0, 0.6, 0), center, 75, CUT);
                    s.key(20, c.target.getEyeLocation().add(forward(c.yaw0).multiply(-2.8)).add(0, 0.6, 0), center, 75, LINEAR);
                    c.cam(s);
                }
                if (t >= 180 && t < 200) {
                    double r = (double) c.data.getOrDefault("r", rmax);
                    if (t % 2 == 0) o.radius((float) (r + (t % 4 == 0 ? 0.3 : -0.3)), t * 0.02f, 2);
                }
                if (t == 200) {
                    c.sound((Location) get(c, "center"), "esfera.lanzar", 3f, 0.6f);
                    ItemDisplay inv = get(c, "inv");
                    if (inv != null) c.anim(inv, "lanzar");
                    Location center = get(c, "center");
                    double r = (double) c.data.getOrDefault("r", rmax);
                    Vector dir = c.eye().toVector().subtract(center.toVector()).normalize();
                    CineNet.Shot s = c.shot().followPos(o.parts.get(0).getEntityId()).followLook(o.parts.get(0).getEntityId());
                    // Con followPos, las posiciones de los fotogramas son desplazamientos respecto a la esfera.
                    Location off = dir.clone().multiply(-(r * 2 + 6)).add(new Vector(0, r, 0)).toLocation(c.w);
                    s.key(0, off, off, 75, CUT);
                    c.cam(s);
                }
                Integer contact = get(c, "contact");
                if (t >= 200 && contact == null) {
                    Location center = get(c, "center");
                    double r = (double) c.data.getOrDefault("r", rmax);
                    Vector to = c.eye().toVector().subtract(center.toVector());
                    if (to.length() <= r * 0.9 || t > 340) {
                        c.data.put("contact", t);
                        c.target.setVelocity(new Vector(0, -1.2, 0));
                    } else {
                        Vector step = to.normalize().multiply(c.cfg("velocidad", 0.4));
                        center.add(step);
                        o.move(center);
                        if (t % 4 == 0) {
                            List<Block> shell = new ArrayList<>();
                            int R = (int) Math.ceil(r);
                            for (int x = -R; x <= R; x++)
                                for (int y = -R; y <= R; y++)
                                    for (int z = -R; z <= R; z++) {
                                        double d2 = x * x + y * y + z * z;
                                        if (d2 > r * r || d2 < (r - 2.5) * (r - 2.5)) continue;
                                        if (x * step.getX() + y * step.getY() + z * step.getZ() < 0) continue;
                                        shell.add(c.w.getBlockAt(center.getBlockX() + x, center.getBlockY() + y, center.getBlockZ() + z));
                                    }
                            for (Block b : shell) if (!b.getType().isAir()) world.set(b, Material.AIR);
                        }
                        Location under = c.ground(center.clone());
                        if (t % 3 == 0) CineFx.marker(c.w, under, Math.min(r, 14), 0x203040, 1);
                    }
                }
                contact = get(c, "contact");
                if (contact != null) {
                    int since = t - contact;
                    Location center = get(c, "center");
                    if (since < 15) {
                        center.add(0, -0.15, 0);
                        o.move(center);
                        if (since % 3 == 0) c.shake(0.8, 6, 0.9);
                    }
                    if (since == 15) {
                        Location p = c.ground(center.clone());
                        o.radius(18, 2f, 6);
                        c.flash(0xffffff, 1, 12, 30);
                        c.shake(2.2, 40, 0.92);
                        c.sound(p, "esfera.detonar", 4f, 0.5f);
                        world.bowlCrater(p.clone().add(0, -1, 0), c.cfgI("radioCrater", 14), c.cfgI("profundidadCrater", 8), true, 0.15, 0.03, 0, c.rnd);
                        c.finalHit(c.target, c.cfg("danio", 50.0));
                        world.areaDamage(p, 25, c.cfg("danio", 50.0) * 0.6, c.launcher, c.target.getUniqueId());
                        CineWorld.radial(p, 25, 3, 1, c.launcher, null);
                        c.data.put("det", p);
                        CineNet.Shot s = c.shot();
                        s.key(0, c.around(p, 120, 50, 18), p, 72, CUT);
                        s.key(60, c.around(p, 130, 48, 18), p, 72, LINEAR);
                        c.cam(s);
                    }
                    if (since > 15 && since < 40) CineFx.wave(c.w, (Location) get(c, "det"), (since - 15) * 40.0 / 25, 0xcff4ff);
                    if (since == 22) o.radius(0.05f, 3f, 20);
                    if (since == 44) o.remove();
                    if (since >= 70) e.finish(c, false);
                }
            }
        });
    }

    /* ====================================== 11 meteorito ====================================== */

    private void meteorito() {
        e.register(new CineEngine.Ability("meteorito", "METEORITO", "#ff6a1a", 360, 360, "Una roca incandescente entra desde el espacio y deja un cráter enorme") {
            void start(CineEngine.Ctx c) {
                Location p = c.ground(c.feet());
                c.data.put("p", p);
                double a = c.rnd.nextDouble() * Math.PI * 2;
                // Nace dentro de la zona cargada alrededor del jugador (a 70 bloques y 130 de alto).
                Location from = p.clone().add(Math.cos(a) * 70, 130, Math.sin(a) * 70);
                c.data.put("from", from);
                c.sky(CineNet.SKY_SPACE, 0x000000, 100);
                double top = Math.min(c.w.getMaxHeight() + 60, 320);
                CineNet.Shot s = c.shot();
                s.key(0, c.eye().add(0, 1, 0), c.feet().add(forward(c.yaw0).multiply(8)), 70, LINEAR);
                Location space = p.clone();
                space.setY(top);
                s.key(40, space.clone().add(forward(c.yaw0).multiply(-20)), p, 80, EASE_IN_EXPO);
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                Location p = get(c, "p");
                Location from = get(c, "from");
                if (t == 40) {
                    Location start = mid(from, p, 0.0);
                    BlockDisplay core = c.actor(fx.blockDisplay(start, Material.MAGMA_BLOCK.createBlockData(), 0xff6a1a, 0));
                    BlockDisplay rock = c.actor(fx.blockDisplay(start, Material.BLACKSTONE.createBlockData(), -1, 0));
                    CineFx.shape(core, new Vector3f(-4, -4, -4), new Quaternionf(), new Vector3f(8, 8, 8), 0);
                    CineFx.shape(rock, new Vector3f(-3.6f, -3.6f, -3.6f), new Quaternionf().rotateXYZ(0.6f, 0.7f, 0.2f), new Vector3f(7.2f, 7.2f, 7.2f), 0);
                    core.setTeleportDuration(3);
                    rock.setTeleportDuration(3);
                    ItemDisplay mh = c.actor(fx.itemDisplay(start, new ItemStack(Material.AIR), 1f, 0));
                    mh.setTeleportDuration(3);
                    c.model(mh, "meteorito", "rotar", 8f, core, rock);
                    c.data.put("mh", mh);
                    c.data.put("core", core);
                    c.data.put("rock", rock);
                    c.sound(p, "meteorito.entrada", 3f, 0.5f);
                    double top = Math.min(c.w.getMaxHeight() + 60, 320);
                    Location space = p.clone();
                    space.setY(top);
                    CineNet.Shot s = c.shot().followLook(mh.getEntityId());
                    s.key(0, space.clone().add(forward(c.yaw0).multiply(-20)), p, 80, LINEAR);
                    s.key(60, space.clone().add(forward(c.yaw0).multiply(-24)).add(0, -10, 0), p, 70, LINEAR);
                    c.cam(s);
                }
                if (t >= 40 && t <= 200) {
                    BlockDisplay core = get(c, "core");
                    BlockDisplay rock = get(c, "rock");
                    double u = t < 100 ? 0.3 * (t - 40) / 60.0 : 0.3 + 0.7 * Math.pow((t - 100) / 100.0, 2);
                    Location at = mid(from, p.clone().add(0, 4, 0), u);
                    if (core != null && core.isValid()) core.teleport(at);
                    if (rock != null && rock.isValid()) rock.teleport(at);
                    ItemDisplay mh = get(c, "mh");
                    if (mh != null) mh.teleport(at);
                    if (t % 2 == 0 && rock != null && rock.isValid()) CineFx.shape(rock, new Vector3f(-3.6f, -3.6f, -3.6f).rotate(new Quaternionf().rotateXYZ(t * 0.05f, t * 0.07f, 0.2f)), new Quaternionf().rotateXYZ(t * 0.05f, t * 0.07f, 0.2f), new Vector3f(7.2f, 7.2f, 7.2f), 2);
                    Vector back = from.toVector().subtract(at.toVector()).normalize();
                    for (int k = 0; k < 4; k++) {
                        Location tr = at.clone().add(back.clone().multiply(3 + k * 2));
                        CineFx.part(c.w, Particle.FLAME, tr, 8, 1.2, 0.05);
                        CineFx.part(c.w, Particle.LARGE_SMOKE, tr, 4, 1.4, 0.03);
                    }
                    if (t >= 100) {
                        CineFx.marker(c.w, p, 2 + 16 * (t - 100) / 100.0, 0x401000, (t - 100) / 100.0);
                        if (t % 20 == 0) c.sound(p, "meteorito.entrada", 2f, 0.4f + (t - 100) / 200f);
                    }
                }
                if (t == 100) {
                    c.sky(CineNet.SKY_TINT, 0xff5a1a, 200);
                    ItemDisplay mh = get(c, "mh");
                    CineNet.Shot s = mh != null ? c.shot().followLook(mh.getEntityId()) : c.shot();
                    Vector dir = p.toVector().subtract(from.toVector()).setY(0).normalize();
                    s.key(0, p.clone().add(dir.clone().multiply(40)).add(0, 2, 0), p, 75, CUT);
                    s.key(99, p.clone().add(dir.clone().multiply(38)).add(0, 2, 0), p, 75, LINEAR);
                    c.cam(s);
                }
                if (t == 180) {
                    c.flash(0xffe0c0, 1, 2, 8);
                    c.shake(0.8, 15, 0.85);
                    c.sound(p, "meteorito.estampido", 4f, 0.6f);
                }
                if (t == 200) {
                    BlockDisplay core = get(c, "core");
                    BlockDisplay rock = get(c, "rock");
                    if (core != null) core.remove();
                    if (rock != null) rock.remove();
                    ItemDisplay mh = get(c, "mh");
                    if (mh != null) mh.remove();
                    c.flash(0xffffff, 0, 14, 40);
                    c.shake(2.4, 50, 0.93);
                    c.sound(p, "meteorito.impacto", 5f, 0.5f);
                    CineFx.part(c.w, Particle.EXPLOSION_EMITTER, p, 6, 4, 0);
                    CineFx.Orb o = fx.orb(p.clone().add(0, 2, 0), 1f, Material.ORANGE_CONCRETE, Material.ORANGE_STAINED_GLASS, 0xff7a1a, 80);
                    o.radius(22, 1.5f, 10);
                    c.data.put("orb", o);
                    // Eyección: bloques de la superficie salen despedidos (visual).
                    int ej = c.cfgI("bloquesEyeccion", 80);
                    for (int k = 0; k < ej; k++) {
                        double a = c.rnd.nextDouble() * Math.PI * 2, d = c.rnd.nextDouble() * 12;
                        Block top = c.w.getHighestBlockAt((int) Math.floor(p.getX() + Math.cos(a) * d), (int) Math.floor(p.getZ() + Math.sin(a) * d));
                        if (!top.getType().isSolid()) continue;
                        world.flyVisual(top.getLocation().add(0.5, 1.5, 0.5), top.getBlockData(), CineWorld.Path.LAUNCH, null,
                                new Vector(Math.cos(a) * (0.6 + c.rnd.nextDouble()), 1.2 + c.rnd.nextDouble() * 1.2, Math.sin(a) * (0.6 + c.rnd.nextDouble())), 60, 0);
                    }
                    world.bowlCrater(p.clone().add(0, -1, 0), c.cfgI("radioCrater", 18), c.cfgI("profundidadCrater", 10), true, 0.2, 0.15, 0.1, c.rnd);
                    double lethal = c.cfg("radioLetal", 6.0), dr = c.cfg("radioDanio", 30.0);
                    double dt = c.target.getLocation().distance(p);
                    if (dt <= lethal) c.finalHit(c.target, c.cfg("danioMax", 100.0));
                    else if (dt <= dr) c.damage(c.target, c.cfg("danioMax", 100.0) * (1 - dt / dr), true);
                    world.areaDamage(p, dr, c.cfg("danioMax", 100.0), c.launcher, c.target.getUniqueId());
                    CineWorld.radial(p, 35, 3.5, 1.2, c.launcher, null);
                    CineNet.Shot s = c.shot();
                    s.key(0, c.around(p, 140, 70, 25), p, 72, CUT);
                    s.key(160, c.around(p, 150, 30, 14), p, 72, EASE_IN_OUT);
                    c.cam(s);
                }
                if (t == 212) {
                    CineFx.Orb o = get(c, "orb");
                    if (o != null) o.radius(0.1f, 3f, 30);
                }
                if (t >= 200 && t < 240) CineFx.wave(c.w, p, (t - 200) * 60.0 / 40, 0xffa060);
                if (t > 200 && t % 3 == 0) {
                    CineFx.part(c.w, Particle.CAMPFIRE_SIGNAL_SMOKE, p.clone().add(c.rnd.nextDouble() * 8 - 4, 1, c.rnd.nextDouble() * 8 - 4), 2, 0.5, 0.05);
                    CineFx.part(c.w, Particle.LAVA, p.clone().add(c.rnd.nextDouble() * 14 - 7, 0, c.rnd.nextDouble() * 14 - 7), 1, 0.3, 0);
                }
                if (t == 220 || t == 245) c.shake(0.4, 12, 0.85);
                if (t == 300) c.skyReset();
            }
        });
    }

    /* ====================================== 12 mil_cortes ====================================== */

    private void milCortes() {
        e.register(new CineEngine.Ability("mil_cortes", "MIL CORTES", "#ff3b3b", 200, 200, "Cortes invisibles rebanan el espacio y terminan en un tajo en cruz gigante") {
            void start(CineEngine.Ctx c) {
                c.vignette(0xb0300000, 10, 110, 20);
                c.target.addPotionEffect(new PotionEffect(PotionEffectType.SLOWNESS, 120, 9, false, false));
                CineNet.Shot s = c.shot();
                s.key(0, c.around(c.feet(), 0, 5, 1.6), c.eye(), 65, LINEAR);
                s.key(20, c.around(c.feet(), 5, 4.6, 1.6), c.eye(), 62, LINEAR);
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                Location center = c.feet().add(0, 1, 0);
                if (t < 120) c.target.setVelocity(new Vector(0, Math.min(0, c.target.getVelocity().getY()), 0));
                if (t >= 20 && t < 100) {
                    if ((t - 20) % 10 == 0) {
                        // Montaje: cambia de plano cada 10 ticks.
                        int k = (t - 20) / 10;
                        Location pos = switch (k % 6) {
                            case 0 -> c.around(c.feet(), 30, 2.4, 1.4);
                            case 1 -> c.feet().add(0.01, 12, 0);
                            case 2 -> c.around(c.feet(), 200, 3, 0.3);
                            case 3 -> c.launcher != null ? c.launcher.getEyeLocation().add(forward(c.launcher.getLocation().getYaw()).multiply(-1.5)) : c.around(c.feet(), 120, 6, 3);
                            case 4 -> c.around(c.feet(), 300, 2.0, 1.8);
                            default -> c.around(c.feet(), 90, 8, 1.0);
                        };
                        CineNet.Shot s = c.shot();
                        s.key(0, pos, c.eye(), 70, CUT);
                        c.cam(s);
                        c.shake(0.15, 10, 1.0);
                    }
                    double radius = c.cfg("radio", 10.0);
                    int per = c.cfgI("cortesPorTick", 3);
                    for (int i = 0; i < per; i++) {
                        Vector along = new Vector(c.rnd.nextGaussian(), c.rnd.nextGaussian() * 0.7, c.rnd.nextGaussian()).normalize();
                        Vector tmp = Math.abs(along.getY()) < 0.9 ? new Vector(0, 1, 0) : new Vector(1, 0, 0);
                        Vector normal = along.clone().crossProduct(tmp).normalize();
                        double rr = Math.cbrt(c.rnd.nextDouble()) * radius * 0.8;
                        Vector off = new Vector(c.rnd.nextGaussian(), c.rnd.nextGaussian(), c.rnd.nextGaussian()).normalize().multiply(rr);
                        Location at = center.clone().add(off);
                        double len = 4 + c.rnd.nextDouble() * 8;
                        fx.slash(at, along, normal, (float) len, 0.08f, Material.WHITE_CONCRETE, 0xffffff, 3);
                        if (c.cfgB("romperBloques", true)) for (Block b : world.slabPlane(at, along, normal, len, len * 0.5)) if (!b.getType().isAir()) world.set(b, Material.AIR);
                        for (Entity en : c.w.getNearbyEntities(at, len / 2, len / 2, len / 2)) {
                            if (!(en instanceof LivingEntity le) || en == c.target || !CineWorld.affectable(en, c.launcher)) continue;
                            Vector rel = en.getLocation().add(0, 1, 0).toVector().subtract(at.toVector());
                            if (Math.abs(rel.dot(normal)) < 0.8 && Math.abs(rel.dot(along)) < len / 2) c.damage(le, c.cfg("danioCorte", 1.0), true);
                        }
                    }
                    if (t % 2 == 0) {
                        c.damage(c.target, c.cfg("danioCorte", 1.0), true);
                        c.target.setVelocity(new Vector());
                    }
                    c.sound(center, "cortes.tajo", 0.7f, 0.8f + c.rnd.nextFloat() * 0.9f);
                    if (t % 3 == 0) CineFx.part(c.w, Particle.SWEEP_ATTACK, center.clone().add(c.rnd.nextGaussian() * 2, c.rnd.nextGaussian(), c.rnd.nextGaussian() * 2), 1, 0, 0);
                }
                if (t == 100) {
                    CineNet.Shot s = c.shot();
                    s.key(0, c.around(c.feet(), 0, 5, 1.5), c.eye(), 65, CUT);
                    s.key(19, c.around(c.feet(), 0, 4.6, 1.5), c.eye(), 62, LINEAR);
                    s.key(20, c.around(c.feet(), 30, 25, 8), c.feet(), 70, CUT);
                    s.key(80, c.around(c.feet(), 40, 26, 9), c.feet(), 70, LINEAR);
                    c.cam(s);
                }
                if (t == 120) {
                    Vector fwd = forward(c.yaw0);
                    Vector right = fwd.clone().crossProduct(new Vector(0, 1, 0)).normalize();
                    Vector d1 = fwd.clone().add(new Vector(0, 0.9, 0)).normalize();
                    Vector d2 = fwd.clone().add(new Vector(0, -0.9, 0)).normalize();
                    fx.slash(center, d1, right, 30, 0.5f, Material.RED_CONCRETE, 0xff2020, 14);
                    fx.slash(center, d2, right, 30, 0.5f, Material.WHITE_CONCRETE, 0xffffff, 14);
                    if (c.cfgB("romperBloques", true)) {
                        for (Block b : world.slabPlane(center, d1, right, 30, 1)) world.set(b, Material.AIR);
                        for (Block b : world.slabPlane(center, d2, right, 30, 1)) world.set(b, Material.AIR);
                    }
                    c.flash(0xffe0e0, 0, 4, 14);
                    c.shake(2.0, 25, 0.88);
                    c.sound(center, "cortes.final", 3f, 0.7f);
                    c.finalHit(c.target, c.cfg("danioFinal", 30.0));
                    c.target.setVelocity(fwd.clone().multiply(-1.4).setY(0.5));
                    for (int k = 0; k < 24; k++) {
                        double s = (k - 12) * 1.2;
                        Location l = center.clone().add(d1.clone().multiply(s));
                        Block b = l.getBlock();
                        if (b.getType().isSolid())
                            world.flyVisual(l.clone().add(0, 0.3, 0), b.getBlockData(), CineWorld.Path.HOVER, null, new Vector(0, 0.05, 0), 60, 0);
                    }
                }
                if (t > 120 && t < 160 && t % 2 == 0) CineFx.part(c.w, Particle.CRIMSON_SPORE, center, 12, 3, 0.02);
            }
        });
    }

    /** Toda la lista de ids (para la galería de comandos y el autocompletado). */
    List<String> ids() {
        return new ArrayList<>(e.all().keySet());
    }
}
