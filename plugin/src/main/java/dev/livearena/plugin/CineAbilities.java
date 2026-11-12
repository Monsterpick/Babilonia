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
import org.bukkit.boss.BarColor;
import org.bukkit.boss.BarStyle;
import org.bukkit.boss.BossBar;
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
    /** Efectos de energía del mod (los asigna LiveArenaPlugin al crear los personajes). */
    CineCharacters k;

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
        meteorito();
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
        e.register(new CineEngine.Ability("escudo", "ESCUDO DE ENERGÍA", "#5ce1ff", 1200, 60, "Cúpula de energía con vida propia (50 corazones por defecto) que sigue al objetivo y aguanta los golpes") {
            void start(CineEngine.Ctx c) {
                double hp = c.cfg("vidaCorazones", 50.0) * 2;
                c.data.put("hp", hp);
                c.data.put("hpMax", hp);
                // Coraza ceñida al cuerpo: el modelo (cúpula de 3 bloques de radio) se escala a un óvalo de
                // `radio` de ancho y `altura` de alto, y va montado sobre el jugador para seguirle sin retraso.
                double r = shieldR(c), h = shieldH(c);
                ItemDisplay holder = c.actor(fx.itemDisplay(c.feet(), new ItemStack(Material.AIR), 1f, 0));
                holder.setTeleportDuration(1);
                holder.setDisplayWidth(4f);
                holder.setDisplayHeight(4f);
                c.model(holder, "escudo", "aparicion", 1f);
                holder.setTransformation(new org.bukkit.util.Transformation(new org.joml.Vector3f(0, (float) -RIDE_Y, 0), new org.joml.Quaternionf(),
                        new org.joml.Vector3f((float) (r / 3.0), (float) (h / 3.0), (float) (r / 3.0)), new org.joml.Quaternionf()));
                c.target.addPassenger(holder);
                c.data.put("holder", holder);
                c.anim(holder, "color:ff5ce1ff");
                BossBar bar = org.bukkit.Bukkit.createBossBar("§b🛡 ESCUDO §f" + hearts(hp) + " ❤", BarColor.BLUE, BarStyle.SEGMENTED_10);
                for (Player p : c.w.getPlayers()) if (p.getLocation().distanceSquared(c.feet()) < 120 * 120) bar.addPlayer(p);
                c.data.put("bar", bar);
                shields.put(c.target.getUniqueId(), c);
                CineNet.Shot s = c.shot();
                s.key(0, c.around(c.feet(), 180, 6, 1.6), c.eye(), 70, LINEAR);
                orbit(s, c, c.feet(), 8, 9, 4, 3, 180, 360, 10, 60, c.eye(), 72, 80);
                c.cam(s);
                c.vignette(0x6012a0c0, 5, 40, 15);
                c.sound(c.feet(), "escudo.activar", 1.5f, 0.8f);
            }

            void tick(CineEngine.Ctx c, int t) {
                double r = shieldR(c), h = shieldH(c);
                Location center = c.feet();
                ItemDisplay holder = get(c, "holder");
                if (holder != null && holder.isValid() && !c.target.getPassengers().contains(holder)) {
                    holder.teleport(center);
                    c.target.addPassenger(holder);
                }
                int dur = duracion(c);
                Integer brokeAt = get(c, "brokeAt");
                if (brokeAt != null) {
                    if (t - brokeAt > 24) e.finish(c, false);
                    return;
                }
                if (t < 20) {
                    // Formación: chispas que suben a la cúpula (también lo ven los que no tienen el mod).
                    if (t % 2 == 0) CineFx.part(c.w, Particle.DUST, center.clone().add(0, h * t / 20.0, 0), 6, r * 0.6, 0.1, r * 0.6, 0, CineFx.dust(0x5ce1ff, 0.8f));
                    return;
                }
                if (t == 20) {
                    c.flash(0x5ce1ff, 1, 2, 8);
                    c.sound(center, "escudo.activar", 1.2f, 1.3f);
                    CineFx.part(c.w, Particle.END_ROD, center.clone().add(0, h * 0.5, 0), 18, r * 0.5, h * 0.35, r * 0.5, 0.02, null);
                }
                if (t >= dur - 18) {
                    if (t == dur - 18) {
                        c.anim(holder, "desaparecer");
                        c.sound(center, "escudo.romper", 0.8f, 1.6f);
                    }
                    return;
                }
                // Brillo sutil del borde para todos (con el mod se ve además la cúpula de paneles).
                if (t % 10 == 0) CineFx.ring(c.w, center.clone().add(0, 0.1, 0), r, 0x5ce1ff, 0.7f, t * 0.05);
                if (t % 20 == 0) updateBar(c);
                // Proyectiles desde fuera: rebotan en la cúpula y le restan vida.
                for (Entity en : c.w.getNearbyEntities(center.clone().add(0, h / 2, 0), r + 2, h / 2 + 2, r + 2)) {
                    if (en instanceof Projectile pr) {
                        if (pr.getShooter() == c.target) continue;
                        // Distancia «elíptica» a la coraza (1 = sobre la superficie).
                        Vector rel = pr.getLocation().toVector().subtract(center.toVector().add(new Vector(0, h * 0.45, 0)));
                        double d = Math.sqrt(sq(rel.getX() / r) + sq(rel.getY() / (h * 0.55)) + sq(rel.getZ() / r));
                        Vector v = pr.getVelocity();
                        if (d < 1.6 && v.dot(rel) < 0) {
                            Vector n = rel.normalize();
                            if (c.cfgB("reflejarProyectiles", true)) pr.setVelocity(v.subtract(n.clone().multiply(2 * v.dot(n))));
                            else pr.remove();
                            impact(c, pr.getLocation(), 2.0);
                        }
                    } else if (en instanceof Monster m && c.cfgB("empujarMobs", true)) {
                        if (m.getLocation().distance(center) < r + 0.9) {
                            Vector out = m.getLocation().toVector().subtract(center.toVector()).setY(0);
                            if (out.lengthSquared() < 0.01) out = new Vector(1, 0, 0);
                            m.setVelocity(out.normalize().multiply(0.8).setY(0.3));
                            if (t % 10 == 0) {
                                CineFx.part(c.w, Particle.ELECTRIC_SPARK, center.clone().add(m.getLocation().toVector().subtract(center.toVector()).setY(0).normalize().multiply(r)).add(0, 1, 0), 8, 0.1, 0.3, 0.1, 0.1, null);
                                c.sound(m.getLocation(), "escudo.impacto", 0.6f, 1.6f);
                            }
                        }
                    }
                }
            }

            void end(CineEngine.Ctx c, boolean cancelled) {
                shields.remove(c.target.getUniqueId());
                BossBar bar = get(c, "bar");
                if (bar != null) bar.removeAll();
            }
        });
    }

    /** Pasajero de un jugador: el display queda a esta altura sobre los pies (se compensa con la traslación). */
    private static final double RIDE_Y = 1.8;

    private static double shieldR(CineEngine.Ctx c) {
        return Math.max(0.6, Math.min(3.0, c.cfg("radioCoraza", 0.95)));
    }

    private static double shieldH(CineEngine.Ctx c) {
        return Math.max(1.6, Math.min(4.0, c.cfg("alturaCoraza", 2.35)));
    }

    private static double sq(double v) {
        return v * v;
    }

    private static String hearts(double hp) {
        double h = Math.max(0, hp) / 2;
        return h == Math.floor(h) ? String.valueOf((int) h) : String.format(java.util.Locale.ROOT, "%.1f", h);
    }

    /** Barra de vida del escudo y color de la cúpula: cian → amarillo → rojo. */
    private void updateBar(CineEngine.Ctx c) {
        BossBar bar = get(c, "bar");
        double hp = (double) c.data.get("hp"), max = (double) c.data.get("hpMax");
        double f = Math.max(0, Math.min(1, hp / max));
        String state = f > 0.6 ? "ok" : f > 0.3 ? "mid" : "low";
        if (bar != null) {
            bar.setProgress(f);
            bar.setColor(f > 0.6 ? BarColor.BLUE : f > 0.3 ? BarColor.YELLOW : BarColor.RED);
            bar.setTitle((f > 0.6 ? "§b" : f > 0.3 ? "§e" : "§c") + "🛡 ESCUDO §f" + hearts(hp) + " / " + hearts(max) + " ❤");
            for (Player p : c.w.getPlayers()) if (!bar.getPlayers().contains(p) && p.getLocation().distanceSquared(c.feet()) < 120 * 120) bar.addPlayer(p);
        }
        if (!state.equals(c.data.get("tint"))) {
            c.data.put("tint", state);
            c.anim(get(c, "holder"), "color:" + (f > 0.6 ? "ff5ce1ff" : f > 0.3 ? "ffffd34d" : "ffff4a4a"));
        }
    }

    /** Impacto en la cúpula: onda visual, sonido y resta vida (si se agota, se rompe en pedazos). */
    private void impact(CineEngine.Ctx c, Location at, double dmg) {
        double r = shieldR(c), h = shieldH(c);
        Location center = c.feet();
        CineFx.part(c.w, Particle.ELECTRIC_SPARK, at, 10, 0.15, 0.15, 0.15, 0.15, null);
        c.sound(at, "escudo.impacto", 1f, 1.2f);
        double hp = (double) c.data.get("hp") - dmg;
        c.data.put("hp", hp);
        Integer last = get(c, "lastHitAnim");
        if (last == null || c.t - last > 7) {
            c.anim(get(c, "holder"), "impacto");
            c.data.put("lastHitAnim", c.t);
        }
        updateBar(c);
        if (hp <= 0 && !c.data.containsKey("brokeAt")) {
            c.data.put("brokeAt", c.t);
            c.anim(get(c, "holder"), "romper");
            c.sound(center, "escudo.romper", 1.6f, 0.7f);
            c.flash(0xffffff, 0, 2, 10);
            c.shake(0.8, 10, 0.8);
            CineFx.part(c.w, Particle.FLASH, center.clone().add(0, h * 0.5, 0), 1, 0, 0);
            for (int i = 0; i < 24; i++) {
                double a = Math.random() * Math.PI * 2, y = Math.random() * h;
                Location l = center.clone().add(Math.cos(a) * r, y, Math.sin(a) * r);
                world.flyVisual(l, (i % 3 == 0 ? Material.LIGHT_BLUE_STAINED_GLASS : i % 3 == 1 ? Material.CYAN_STAINED_GLASS : Material.WHITE_STAINED_GLASS).createBlockData(), CineWorld.Path.LAUNCH, null,
                        new Vector(Math.cos(a) * 0.35, 0.2 + Math.random() * 0.3, Math.sin(a) * 0.35), 30, 0);
            }
            BossBar bar = get(c, "bar");
            if (bar != null) bar.removeAll();
            shields.remove(c.target.getUniqueId());
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onShieldDamage(EntityDamageEvent ev) {
        if (!(ev.getEntity() instanceof Player p)) return;
        CineEngine.Ctx c = shields.get(p.getUniqueId());
        if (c == null || c.ended || c.t < 20) return;
        EntityDamageEvent.DamageCause cause = ev.getCause();
        boolean blocked = switch (cause) {
            case PROJECTILE, ENTITY_EXPLOSION, BLOCK_EXPLOSION, LIGHTNING, MAGIC, SONIC_BOOM, ENTITY_ATTACK, ENTITY_SWEEP_ATTACK, THORNS, DRAGON_BREATH, FALLING_BLOCK, FIRE -> true;
            default -> false; // caída, hambre, ahogo, vacío… no se bloquean
        };
        if (!blocked) return;
        ev.setCancelled(true);
        Location at = ev instanceof EntityDamageByEntityEvent be ? be.getDamager().getLocation().add(0, 1, 0) : p.getLocation().add(0, 3, 0);
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
        int glow = 0x9fe8ff;
        int stuckAt;
    }

    private void coronaEspadas() {
        e.register(new CineEngine.Ability("corona_espadas", "CORONA DE ESPADAS", "#9fe8ff", 140, 140, "Doce espadas de Minecraft (madera a netherita) forman una corona y se disparan contra el objetivo") {
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
                    // Espadas de Minecraft de verdad: madera, piedra, hierro, oro, diamante y netherita (en bucle).
                    Material[] tiers = {Material.WOODEN_SWORD, Material.STONE_SWORD, Material.IRON_SWORD, Material.GOLDEN_SWORD, Material.DIAMOND_SWORD, Material.NETHERITE_SWORD};
                    int[] glow = {0xc8914b, 0xbdbdbd, 0xffffff, 0xffd34d, 0x5ce8ff, 0xb06cff};
                    int tier = i % tiers.length;
                    sw.d = c.actor(fx.itemDisplay(at, new ItemStack(tiers[tier]), 2.0f, 0));
                    sw.d.setGlowing(true);
                    sw.d.setGlowColorOverride(org.bukkit.Color.fromRGB(glow[tier]));
                    sw.glow = glow[tier];
                    // Aparece desde un portal: arranca diminuta y crece girando.
                    sw.d.setTransformation(new Transformation(new Vector3f(), new Quaternionf(), new Vector3f(0.01f, 0.01f, 0.01f), new Quaternionf()));
                    CineFx.ring(c.w, at, 0.9, glow[tier], 1.2f, i);
                    CineFx.part(c.w, Particle.END_ROD, at, 10, 0.3, 0.08);
                    CineFx.part(c.w, Particle.ENCHANT, at, 20, 0.6, 0.5);
                    sw.pos = at.toVector();
                    swords.add(sw);
                    c.sound(at, "corona.aparecer", 0.7f, 1.2f + i * 0.05f);
                    CineFx.part(c.w, Particle.END_ROD, at, 6, 0.2, 0.03);
                }
                double spin = t >= 30 && t < 60 ? (t - 30) * Math.PI * 2 / 20 : t >= 60 ? Math.PI * 3 : 0;
                // Halo dorado bajo la corona y destellos que suben mientras gira.
                if (t < 70 && t % 2 == 0) {
                    CineFx.ring(c.w, cc.clone().add(0, -0.4, 0), ring, 0xffd34d, 1.3f, -t * 0.1);
                    if (t >= 30) CineFx.ring(c.w, cc.clone().add(0, 0.6, 0), ring * 0.6, 0xffffff, 1f, t * 0.2);
                    CineFx.part(c.w, Particle.WAX_OFF, cc, 3, ring, 0.05);
                }
                if (t == 60) {
                    // Todas apuntan a la vez al objetivo.
                    c.sound(cc, "corona.apuntar", 1.5f, 1.2f);
                    CineFx.part(c.w, Particle.FLASH, cc, 1, 0, 0);
                    CineFx.wave(c.w, cc, ring * 1.6, 0xffffff);
                    c.shake(0.4, 6, 0.85);
                }
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
                        // Antes de apuntar: hacia fuera y girando sobre sí mismas; después, todas al objetivo.
                        Vector dir = t >= 60 ? aim.toVector().subtract(sw.pos) : new Vector(Math.cos(a), 0.9 * Math.cos(t * 0.15 + i), Math.sin(a));
                        point(sw.d, dir, t - i * 2 < 6 ? 0.4f + (t - i * 2) * 0.27f : 2.0f);
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
                        c.sound(sw.d.getLocation(), "corona.disparo", 1f, 1.1f + i * 0.04f);
                        CineFx.ring(c.w, sw.d.getLocation(), 1.0, sw.glow, 1.4f, 0);
                        CineFx.part(c.w, Particle.SONIC_BOOM, sw.d.getLocation(), 1, 0, 0);
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
                    point(sw.d, sw.vel, 2.0f);
                    CineFx.dot(c.w, at, sw.glow, 1.6f);
                    CineFx.dot(c.w, at.clone().subtract(sw.vel.clone().multiply(0.5)), sw.glow, 1.2f);
                    CineFx.part(c.w, Particle.END_ROD, at, 2, 0.05, 0.01);
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
                CineFx.part(c.w, Particle.ELECTRIC_SPARK, at, 30, 0.6, 0.35);
                CineFx.part(c.w, Particle.CRIT, at, 20, 0.5, 0.4);
                CineFx.wave(c.w, at, 2.5, sw.glow);
                Block under = at.getBlock().getType().isSolid() ? at.getBlock() : at.clone().add(0, -1, 0).getBlock();
                if (under.getType().isSolid())
                    for (int k = 0; k < 4; k++)
                        world.flyVisual(at.clone(), under.getBlockData(), CineWorld.Path.LAUNCH, null, new Vector(c.rnd.nextGaussian() * 0.2, 0.4 + c.rnd.nextDouble() * 0.3, c.rnd.nextGaussian() * 0.2), 24, 0);
                c.shake(0.35, 5, 0.85);
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
                Location f = c.feet();
                // 0–45: tormenta que se carga. Relámpagos entre nubes, chispas que suben del suelo y arcos que
                // convergen desde un anillo hacia el objetivo (se le eriza todo).
                if (t < 45) {
                    if (t % 6 == 3) {
                        Location a1 = f.clone().add(c.rnd.nextDouble() * 50 - 25, 34 + c.rnd.nextDouble() * 6, c.rnd.nextDouble() * 50 - 25);
                        Location a2 = a1.clone().add(c.rnd.nextDouble() * 24 - 12, -c.rnd.nextDouble() * 4, c.rnd.nextDouble() * 24 - 12);
                        fx.lightning(c.w, a1, a2, 0.18f, 2, c.seed + t, 0xbfe0ff, 3);
                        CineFx.part(c.w, Particle.FLASH, a1, 1, 0, 0);
                    }
                    if (t % 15 == 5) c.sound(f, "rayo.trueno_lejano", 0.7f, 0.6f + t / 60f);
                    if (t >= 15) {
                        double r = 7 - (t - 15) * 0.15;
                        CineFx.ring(c.w, f.clone().add(0, 0.15, 0), r, 0x6fb8ff, 1.4f, t * 0.12);
                        if (t % 3 == 0) {
                            double ang = c.rnd.nextDouble() * Math.PI * 2;
                            fx.lightning(c.w, f.clone().add(Math.cos(ang) * r, 0.2, Math.sin(ang) * r), c.eye(), 0.07f, 0, c.seed + t * 3, 0xa8d8ff, 2);
                        }
                        CineFx.part(c.w, Particle.ELECTRIC_SPARK, f.clone().add(0, 0.2, 0), 10, 2.5, 0.25);
                        CineFx.part(c.w, Particle.END_ROD, f.clone().add(c.rnd.nextGaussian() * 3, 0.1, c.rnd.nextGaussian() * 3), 2, 0.1, 0.12);
                    }
                    if (t == 20) c.sound(f, "rayo.carga", 1.5f, 0.6f);
                    if (t >= 30) {
                        CineFx.marker(c.w, f, 3.0, 0x3a8dff, (t - 30) / 15.0);
                        c.target.setVelocity(new Vector(0, 0.04, 0)); // la carga lo levanta un poco
                    }
                }
                if (c.launcher != null && t >= 30 && t < 44 && t % 3 == 0)
                    fx.lightning(c.w, c.launcher.getEyeLocation().add(0, 0.6, 0), c.launcher.getLocation().add(0, 60, 0), 0.25f, 2, c.seed + t, 0x9fdcff, 3);
                if (t == 45) {
                    Location p = f;
                    c.data.put("p", p.clone());
                    float g = (float) c.cfg("grosor", 0.9);
                    // Relámpago colosal: tronco grueso, ramas y un núcleo de luz blanca.
                    fx.lightning(c.w, p.clone().add(0, 90, 0), p, g, 8, c.seed, 0x9fdcff, 5);
                    fx.lightning(c.w, p.clone().add(3, 90, -2), p, g * 0.55f, 4, c.seed + 7, 0xd8f0ff, 4);
                    fx.beam(p.clone().add(0, -1, 0), p.clone().add(0, 90, 0), g * 0.9f, Material.WHITE_CONCRETE, 0xffffff, 4);
                    c.flash(0xffffff, 0, 5, 14);
                    c.shake(2.4, 30, 0.85);
                    c.sound(p, "rayo.impacto", 3f, 0.8f);
                    c.finalHit(c.target, c.cfg("danio", 25.0));
                    world.areaDamage(p, c.cfg("radioArea", 4.0), c.cfg("danio", 25.0) * 0.5, c.launcher, c.target.getUniqueId());
                    world.bowlCrater(p.clone().add(0, -1, 0), c.cfgI("radioCrater", 3) + 1, 3, true, 0.35, 0.08, 0, c.rnd);
                    CineWorld.radial(p, 8, 1.4, 0.9, c.launcher, null);
                    CineFx.part(c.w, Particle.EXPLOSION_EMITTER, p, 1, 0, 0);
                    CineFx.part(c.w, Particle.ELECTRIC_SPARK, p.clone().add(0, 1, 0), 120, 2.5, 0.6);
                    // Arcos que recorren el suelo hacia fuera.
                    for (int k = 0; k < 8; k++) {
                        double ang = k * Math.PI / 4 + c.rnd.nextDouble() * 0.3;
                        Location end = c.ground(p.clone().add(Math.cos(ang) * 11, 3, Math.sin(ang) * 11)).add(0, 0.2, 0);
                        fx.lightning(c.w, p.clone().add(0, 0.3, 0), end, 0.12f, 1, c.seed + 50 + k, 0xa8d8ff, 6);
                    }
                    // Tierra y piedra que salen volando.
                    for (int k = 0; k < 30; k++) {
                        double ang = c.rnd.nextDouble() * Math.PI * 2;
                        Vector v = new Vector(Math.cos(ang) * (0.3 + c.rnd.nextDouble() * 0.5), 0.8 + c.rnd.nextDouble() * 0.7, Math.sin(ang) * (0.3 + c.rnd.nextDouble() * 0.5));
                        Material m = k % 3 == 0 ? Material.STONE : k % 3 == 1 ? Material.DIRT : Material.MAGMA_BLOCK;
                        world.flyVisual(p.clone().add(0, 0.5, 0), m.createBlockData(), CineWorld.Path.LAUNCH, null, v, 40, 0);
                    }
                }
                if (t > 45 && t < 70) {
                    Location p = get(c, "p");
                    if (t < 60) CineFx.wave(c.w, p.clone().add(0, 0.2, 0), (t - 45) * 1.4, t % 2 == 0 ? 0xffffff : 0x6fb8ff);
                    if (t % 2 == 0) CineFx.part(c.w, Particle.CAMPFIRE_SIGNAL_SMOKE, p.clone().add(c.rnd.nextGaussian(), 0.5, c.rnd.nextGaussian()), 2, 0.4, 0.05);
                    if (t % 3 == 0) CineFx.part(c.w, Particle.ELECTRIC_SPARK, p.clone().add(0, 0.4, 0), 15, 3, 0.2);
                }
                if (t == 49 || t == 53 || t == 58) {
                    Location p = get(c, "p");
                    fx.lightning(c.w, p.clone().add(c.rnd.nextGaussian() * 2, 80, c.rnd.nextGaussian() * 2), p, (float) c.cfg("grosor", 0.9) * 0.7f, 5, c.seed + t, 0x9fdcff, 3);
                    c.flash(0xd8ecff, 0, 1, 4);
                    c.shake(1.0, 8, 0.85);
                    c.sound(p, "trueno.menor", 2f, 0.9f + t / 200f);
                }
                if (t == 60 && c.cfgB("crearFulguritas", true)) {
                    Location p = get(c, "p");
                    for (Block b : world.sphere(p, 5)) {
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
                    fx.beam(p.clone().add(0, -0.5, 0), p.clone().add(0, 60, 0), 0.22f, Material.WHITE_CONCRETE, 0xffffff, 3);
                    c.sound(p, "trueno.menor", 2f, 1.1f);
                    c.shake(0.8, 10, 0.85);
                    c.flash(0xd8ecff, 0, 1, 4);
                    CineFx.part(c.w, Particle.ELECTRIC_SPARK, p.clone().add(0, 0.5, 0), 50, 1.5, 0.4);
                    CineFx.wave(c.w, p.clone().add(0, 0.2, 0), 4, 0xa8d8ff);
                    for (int k = 0; k < 10; k++) {
                        double ang = c.rnd.nextDouble() * Math.PI * 2;
                        world.flyVisual(p.clone().add(0, 0.5, 0), (k % 2 == 0 ? Material.DIRT : Material.STONE).createBlockData(), CineWorld.Path.LAUNCH, null,
                                new Vector(Math.cos(ang) * 0.35, 0.7 + c.rnd.nextDouble() * 0.4, Math.sin(ang) * 0.35), 30, 0);
                    }
                    world.areaDamage(p, 2, c.cfg("danioRayoMenor", 6.0), c.launcher, null);
                    world.bowlCrater(p.clone().add(0, -1, 0), 1, 1, false, 0.4, 0, 0, c.rnd);
                }
                if (t >= 40 && t < 60) {
                    // Jaula: anillo eléctrico que gira y se estrecha sobre el objetivo.
                    Location cc = get(c, "center");
                    CineFx.ring(c.w, cc.clone().add(0, 0.2 + (t - 40) * 0.12, 0), 6 - (t - 40) * 0.2, 0x9fd0ff, 1.5f, t * 0.3);
                    CineFx.part(c.w, Particle.ELECTRIC_SPARK, c.eye(), 6, 0.6, 0.1);
                    if (t % 5 == 0) c.sound(cc, "rayo.carga", 0.8f, 0.8f + (t - 40) / 20f);
                    if (c.cfgB("inmovilizar", true)) c.target.addPotionEffect(new PotionEffect(PotionEffectType.SLOWNESS, 25, 6, false, false));
                    if (t % 4 == 0)
                        for (int i = 0; i < 3; i++)
                            fx.lightning(c.w, v.get(i).clone().add(0, 1, 0), v.get((i + 1) % 3).clone().add(0, 1, 0), 0.12f, 1, c.seed + t * 7 + i, 0x9fd0ff, 4);
                }
                if (t == 60) {
                    Location p = c.feet();
                    c.data.put("center", p.clone());
                    fx.lightning(c.w, p.clone().add(0, 80, 0), p, 0.9f, 6, c.seed + 99, 0xbfe4ff, 8);
                    fx.beam(p.clone().add(0, -1, 0), p.clone().add(0, 80, 0), 0.7f, Material.WHITE_CONCRETE, 0xffffff, 6);
                    CineFx.part(c.w, Particle.ELECTRIC_SPARK, p.clone().add(0, 1, 0), 120, 2, 0.6);
                    c.shake(1.4, 12, 0.85);
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
                        CineFx.part(c.w, Particle.FLASH, p.clone().add(0, 2, 0), 1, 0, 0);
                        // Lluvia de escombros y bloques ardientes.
                        for (int k = 0; k < 50; k++) {
                            double ang = c.rnd.nextDouble() * Math.PI * 2;
                            Vector vv = new Vector(Math.cos(ang) * (0.4 + c.rnd.nextDouble() * 0.7), 0.9 + c.rnd.nextDouble() * 0.9, Math.sin(ang) * (0.4 + c.rnd.nextDouble() * 0.7));
                            Material m = k % 4 == 0 ? Material.MAGMA_BLOCK : k % 4 == 1 ? Material.NETHERRACK : k % 4 == 2 ? Material.DIRT : Material.STONE;
                            world.flyVisual(p.clone().add(0, 1, 0), m.createBlockData(), CineWorld.Path.LAUNCH, null, vv, 50, 0);
                        }
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
                    if (t < 90) CineFx.wave(c.w, p.clone().add(0, 0.5, 0), (t - 70) * 18.0 / 20, 0xffffff);
                    // Hongo de fuego: columna que sube y se abre.
                    double hh = Math.min(16, (t - 70) * 0.8);
                    CineFx.part(c.w, Particle.FLAME, p.clone().add(0, hh * 0.5, 0), 12, 1.0, 0.04);
                    if (t > 78) CineFx.ring(c.w, p.clone().add(0, hh, 0), 2 + (t - 78) * 0.25, 0xff7a20, 2f, t * 0.1);
                    CineFx.part(c.w, Particle.LARGE_SMOKE, p.clone().add(0, hh, 0), 6, 1.5, 0.03);
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
        e.register(new CineEngine.Ability("carrusel_creepers", "CARRUSEL DE CREEPERS", "#58ff7a", 200, 200, "Ocho creepers cargados por rayos giran como un tiovivo y se lanzan uno tras otro con explosiones enormes") {
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
                // Cada creeper recibe un rayo y queda CARGADO (aura eléctrica), uno tras otro.
                if (t >= 22 && t < 22 + n * 4 && (t - 22) % 4 == 0) {
                    Creeper cr = list.get((t - 22) / 4);
                    if (cr.isValid()) {
                        c.w.strikeLightningEffect(cr.getLocation());
                        cr.setPowered(true);
                        CineFx.part(c.w, Particle.ELECTRIC_SPARK, cr.getLocation().add(0, 1, 0), 30, 0.5, 0.3);
                        c.flash(0xe0fff0, 0, 1, 3);
                    }
                }
                // Columna verde que gira en el centro y anillo en el suelo.
                if (t >= 20 && t < 130 && t % 2 == 0) {
                    double sp = t * 0.35;
                    for (int k = 0; k < 3; k++) {
                        double a = sp + k * Math.PI * 2 / 3;
                        double y = (t % 40) / 40.0 * 6;
                        CineFx.dot(c.w, center.clone().add(Math.cos(a) * 1.2, y, Math.sin(a) * 1.2), 0x58ff7a, 1.3f);
                    }
                    if (t % 6 == 0) CineFx.ring(c.w, center.clone().add(0, 0.1, 0), r, 0x3ddc5c, 1.3f, -t * 0.05);
                }
                if (t >= 20 && t < 130 && t % 5 == 0) c.sound(center, "carrusel.musica", 0.8f, (float) Math.min(2.0, 0.6 + (t - 20) / 80.0));
                // Arcos eléctricos verdes entre creepers vecinos (ya cargados), notas de feria y estela de cada uno.
                if (t >= 56 && t < 130) {
                    if (t % 4 == 0)
                        for (int i = 0; i < n; i++) {
                            Creeper a1 = list.get(i), a2 = list.get((i + 1) % n);
                            if (a1.isValid() && a2.isValid() && !a1.getScoreboardTags().contains("dash") && !a2.getScoreboardTags().contains("dash"))
                                fx.lightning(c.w, a1.getLocation().add(0, 1, 0), a2.getLocation().add(0, 1, 0), 0.06f, 0, c.seed + t * 13 + i, 0x7dff9a, 3);
                        }
                    if (t % 3 == 0) {
                        double na = t * 0.2;
                        for (int k = 0; k < 4; k++)
                            CineFx.part(c.w, Particle.NOTE, center.clone().add(Math.cos(na + k * Math.PI / 2) * (r + 1.5), 4 + Math.sin(t * 0.1 + k), Math.sin(na + k * Math.PI / 2) * (r + 1.5)), 1, 0, 0);
                    }
                    for (Creeper cr : list)
                        if (cr.isValid() && !cr.getScoreboardTags().contains("dash")) CineFx.dot(c.w, cr.getLocation().add(0, 0.6, 0), 0x58ff7a, 1.1f);
                }
                if (t >= 100 && t < 130 && t % 4 == 0)
                    for (Creeper cr : list) if (cr.isValid()) CineFx.part(c.w, Particle.ELECTRIC_SPARK, cr.getLocation().add(0, 1, 0), 6, 0.5, 0.15);
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
                    // Estela de fuego verde y chispas al lanzarse.
                    CineFx.part(c.w, Particle.HAPPY_VILLAGER, cr.getLocation().add(0, 1, 0), 6, 0.3, 0.05);
                    CineFx.part(c.w, Particle.SOUL_FIRE_FLAME, cr.getLocation().add(0, 0.8, 0), 6, 0.25, 0.03);
                    if (since == 0) CineFx.ring(c.w, cr.getLocation().add(0, 1, 0), 1.2, 0x7dff9a, 1.5f, 0);
                }
            }

            void boom(CineEngine.Ctx c, Creeper cr, boolean last) {
                Location at = cr.getLocation();
                cr.remove();
                double rr = last ? 6 : 3;
                CineFx.part(c.w, Particle.EXPLOSION_EMITTER, at, last ? 3 : 1, last ? 2 : 0, 0);
                CineFx.part(c.w, Particle.FLASH, at, 1, 0, 0);
                CineFx.part(c.w, Particle.ELECTRIC_SPARK, at, 60, 1.2, 0.6);
                CineFx.part(c.w, Particle.HAPPY_VILLAGER, at, 20, 1.5, 0.2);
                for (int k = 0; k < 3; k++) CineFx.wave(c.w, c.ground(at).add(0, 0.2, 0), rr * (1 + k * 0.6), k == 0 ? 0xffffff : 0x58ff7a);
                CineFx.sphereShell(c.w, at, rr * 0.8, 90, 0x7dff9a, 1.6f);
                c.w.strikeLightningEffect(at);
                c.sound(at, "carrusel.explosion", last ? 4f : 2.5f, last ? 0.6f : 0.9f);
                c.flash(0xd8ffe0, 0, 1, last ? 14 : 5);
                c.shake(last ? 2.0 : 0.9, last ? 30 : 12, 0.85);
                // Tierra que sale volando.
                for (int k = 0; k < (last ? 40 : 12); k++) {
                    double a = c.rnd.nextDouble() * Math.PI * 2;
                    Vector v = new Vector(Math.cos(a) * (0.3 + c.rnd.nextDouble() * 0.5), 0.6 + c.rnd.nextDouble() * 0.6, Math.sin(a) * (0.3 + c.rnd.nextDouble() * 0.5));
                    Material m = k % 3 == 0 ? Material.GRASS_BLOCK : k % 3 == 1 ? Material.DIRT : Material.COARSE_DIRT;
                    world.flyVisual(c.ground(at).add(0, 0.5, 0), m.createBlockData(), CineWorld.Path.LAUNCH, null, v, 40, 0);
                }
                if (c.cfgB("romperBloques", true)) world.bowlCrater(c.ground(at).add(0, -1, 0), (int) rr, last ? 4 : 2, last, 0, 0, 0, c.rnd);
                if (last) {
                    // Gran final: hongo de humo y onda que barre todo.
                    for (int k = 0; k < 14; k++) CineFx.part(c.w, Particle.CAMPFIRE_SIGNAL_SMOKE, at.clone().add(c.rnd.nextGaussian(), k * 0.6, c.rnd.nextGaussian()), 4, 0.6, 0.02);
                    c.finalHit(c.target, c.cfg("danioPorCreeper", 5.0) * 2);
                }
                world.areaDamage(at, rr + 1, c.cfg("danioPorCreeper", 5.0), c.launcher, last ? c.target.getUniqueId() : null);
                CineWorld.radial(at, rr + 2, last ? 1.6 : 0.9, last ? 0.8 : 0.45, c.launcher, null);
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
                c.model(holder, "ojo_vacio", "cerrado", 16f, iris, iris2, pupil, lidA, lidB);
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
                // Fase de terror (100–158): oscuridad, latidos cada vez más rápidos, susurros, ojos que flotan
                // alrededor del objetivo mirándolo y, al final, la cámara se lanza hacia la pupila.
                if (t == 100) {
                    c.target.addPotionEffect(new PotionEffect(PotionEffectType.DARKNESS, 80, 0, false, false));
                    List<ItemDisplay> eyes = new ArrayList<>();
                    for (int k = 0; k < 10; k++) {
                        ItemDisplay ed = c.actor(fx.itemDisplay(c.eye(), new ItemStack(Material.ENDER_EYE), 0.7f, 0));
                        ed.setBillboard(org.bukkit.entity.Display.Billboard.CENTER);
                        ed.setGlowing(true);
                        ed.setGlowColorOverride(org.bukkit.Color.fromRGB(0xb15cff));
                        ed.setTeleportDuration(3);
                        eyes.add(ed);
                    }
                    c.data.put("eyes", eyes);
                }
                if (t >= 100 && t < 162) {
                    List<ItemDisplay> eyes = get(c, "eyes");
                    double rad = 3.5 - (t - 100) * 0.03;
                    for (int k = 0; k < eyes.size(); k++) {
                        double a = t * 0.05 + k * Math.PI * 2 / eyes.size();
                        eyes.get(k).teleport(c.eye().add(Math.cos(a) * rad, Math.sin(t * 0.1 + k) * 0.8, Math.sin(a) * rad));
                    }
                    int every = Math.max(4, 22 - (t - 100) / 3);
                    if ((t - 100) % every == 0) {
                        c.sound(c.feet(), "ojo.latido", 2.5f, 0.55f);
                        c.vignette(0xd0000000, 1, 2, every - 3);
                    }
                    if (t % 17 == 0) c.sound(c.eye().add(c.rnd.nextGaussian() * 3, 0, c.rnd.nextGaussian() * 3), "ojo.susurro", 1.2f, 0.5f + c.rnd.nextFloat() * 0.3f);
                    if (t % 9 == 0 && c.rnd.nextDouble() < 0.5) c.tint(0x70600000, 0, 1, 2);
                    CineFx.part(c.w, Particle.SQUID_INK, c.eye(), 3, 1.5, 0.02);
                }
                if (t == 112) c.say("ojo_vacio", "Te estoy viendo...", 0xb15cff, 40);
                if (t == 140) {
                    // Zoom brutal hacia la pupila (FOV 70 → 25) y corte al aplastamiento.
                    // eyeAt ya es la posición del ojo
                    CineNet.Shot s = c.shot();
                    s.key(0, c.feet().add(0, 2, 0), eyeAt, 75, CUT);
                    s.key(18, eyeAt.clone().add(0, -9, 0), eyeAt, 25, CineNet.EASE_IN_EXPO);
                    s.key(19, eyeAt.clone().add(0, -8.5, 0), eyeAt, 22, LINEAR);
                    s.key(21, c.around(c.feet(), 90, 30, 8), c.feet().add(0, 8, 0), 72, CUT);
                    s.key(120, c.around(c.feet(), 95, 31, 9), c.feet().add(0, 10, 0), 70, LINEAR);
                    c.cam(s);
                    c.sound(c.feet(), "ojo.susurro", 2f, 0.4f);
                }
                if (t == 158) {
                    // Susto: grito, fogonazo rojo y sacudida máxima.
                    c.sound(c.feet(), "ojo.grito", 4f, 0.6f);
                    c.flash(0xff0000, 0, 2, 6);
                    c.shake(2.6, 14, 0.8);
                }
                if (t == 162) {
                    List<ItemDisplay> eyes = get(c, "eyes");
                    if (eyes != null) for (ItemDisplay ed : eyes) ed.remove();
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
                // Modelo: horizonte negro, disco de acreción, anillo de fotones y chorros (sin el mod, la esfera de bloques).
                ItemDisplay bh = c.actor(fx.itemDisplay(hole, new ItemStack(Material.AIR), 1f, 0));
                c.model(bh, "agujero_negro", "aparicion", 3.6f, o.parts.toArray(new Entity[0]));
                c.data.put("bh", bh);
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
                if (t == 230) {
                    o.radius(0.05f, 3f, 20);
                    c.anim(get(c, "bh"), "colapso");
                }
                if (t == 252) {
                    ItemDisplay bh = get(c, "bh");
                    if (bh != null) bh.remove();
                }
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

    /**
     * «Juicio ígneo» (id juicio_arcano, para no romper las reglas de regalos): magia de fuego. Un sello de llamas se
     * abre bajo el objetivo, columnas de fuego lo rodean, cae una lluvia de meteoros, en el cielo se forma un sol que
     * absorbe el fuego, se comprime y baja sobre el objetivo: SUPER EXPLOSIÓN con cúpula, onda, hongo de humo y cráter.
     */
    private void juicioArcano() {
        e.register(new CineEngine.Ability("juicio_arcano", "JUICIO ÍGNEO", "#ff6a1a", 270, 270, "Un sello de fuego, columnas de llamas y lluvia de meteoros; un sol se comprime sobre el objetivo y estalla en una explosión colosal") {
            static final String FUEGO = "ffff6a1a", ORO = "ffffc04a", BLANCO = "fffff2d0";

            void start(CineEngine.Ctx c) {
                Location g = c.ground(c.feet().add(0, 2, 0));
                c.data.put("g", g);
                Location sun = g.clone().add(0, 22, 0);
                c.data.put("sun", sun);
                c.target.addPotionEffect(new PotionEffect(PotionEffectType.SLOWNESS, 200, 9, false, false));
                c.sound(g, "ignea.inicio", 2f, 0.8f);
                c.sky(CineNet.SKY_TINT, 0x3a0c00, 270);
                c.vignette(0x80401000, 10, 230, 20);
                // Sello de fuego en el suelo (onda lenta) y aura de llamas en el objetivo.
                k.once(c, g.clone().add(0, 0.1, 0), CineCharacters.FX_ONDA, 9, FUEGO, 40);
                c.data.put("aura", k.vfx(c, g.clone().add(0, 0.2, 0), CineCharacters.FX_AURA, 2.6f, FUEGO));
                // Lluvia de meteoros: 14 impactos alrededor (la mitad cerca del objetivo).
                List<Object[]> met = new ArrayList<>();
                int n = Math.max(4, c.cfgI("numeroRayos", 14));
                n = Math.min(n, 24);
                for (int i = 0; i < n; i++) {
                    double rr = i % 2 == 0 ? 2 + c.rnd.nextDouble() * 4 : 5 + c.rnd.nextDouble() * (c.cfg("radioZona", 15.0) - 5);
                    double ang = c.rnd.nextDouble() * Math.PI * 2;
                    Location at = c.ground(g.clone().add(Math.cos(ang) * rr, 6, Math.sin(ang) * rr));
                    met.add(new Object[] {at, 62 + i * 70 / n, null});
                }
                c.data.put("met", met);
                // Cámara: 0–40 contrapicado lento con el sello; 41–60 plano cenital del círculo de columnas.
                CineNet.Shot s = c.shot();
                s.key(0, c.around(g, 200, 5, 0.6), c.eye(), 70, LINEAR);
                s.key(40, c.around(g, 230, 4, 0.9), c.eye().add(0, 0.6, 0), 62, EASE_IN_OUT);
                s.key(41, c.around(g, 150, 9, 16), g, 70, CUT);
                s.key(60, c.around(g, 175, 10, 18), g, 66, EASE_IN_OUT);
                // 61–130: plano general amplio con la lluvia de meteoros.
                s.key(61, c.around(g, 120, 26, 11), g.clone().add(0, 4, 0), 72, CUT);
                s.key(130, c.around(g, 160, 24, 10), g.clone().add(0, 5, 0), 70, LINEAR);
                // 131–175: contrapicado hacia el sol que crece y absorbe el fuego.
                s.key(131, c.around(g, 100, 9, 1.2), sun, 74, CUT);
                s.key(175, c.around(g, 130, 7, 1.0), sun.clone().add(0, -3, 0), 62, EASE_IN_OUT);
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                Location g = get(c, "g");
                Location sun = get(c, "sun");
                boolean plain = !CineNet.hasMod(c.target);
                if (t < 190) c.target.setVelocity(new Vector(0, Math.min(0, c.target.getVelocity().getY()), 0));
                // Sin llamas en pantalla durante la cinemática (el fuego de primera persona taparía la cámara).
                c.target.setFireTicks(0);
                // Ascuas y humo en el aire todo el tiempo.
                if (t < 240 && t % 3 == 0) {
                    CineFx.part(c.w, Particle.FLAME, g.clone().add(0, 0.3, 0), 10, 4, 0.2, 4, 0.02, null);
                    CineFx.part(c.w, Particle.LAVA, g.clone().add(0, 0.5, 0), 2, 3, 0.2, 3, 0, null);
                }
                // 20–60: seis columnas de fuego brotan en círculo, una tras otra.
                if (t >= 20 && t < 50 && (t - 20) % 5 == 0) {
                    int i = (t - 20) / 5;
                    double a = i * Math.PI / 3 + c.seed % 7;
                    Location p = c.ground(g.clone().add(Math.cos(a) * 7, 4, Math.sin(a) * 7));
                    k.once(c, p, CineCharacters.FX_PILAR, 0.55f, FUEGO, 90);
                    k.once(c, p.clone().add(0, 0.2, 0), CineCharacters.FX_GOLPE, 0.8f, ORO, 14);
                    CineFx.part(c.w, Particle.FLAME, p.clone().add(0, 1, 0), 40, 0.4, 2.5, 0.4, 0.05, null);
                    c.sound(p, "ignea.columna", 1.4f, 0.8f + i * 0.08f);
                    c.shake(0.3, 6, 0.85);
                }
                if (t == 40) c.say("ignea_frase", "¡Arde!", 0xff8a2a, 30);
                // Meteoros: aparecen en lo alto y caen en 10 ticks con estela de fuego.
                List<Object[]> met = get(c, "met");
                for (Object[] m : met) {
                    Location at = (Location) m[0];
                    int hit = (int) m[1];
                    if (t == hit - 10) {
                        Location from = at.clone().add(c.rnd.nextDouble() * 10 - 5, 30, c.rnd.nextDouble() * 10 - 5);
                        ItemDisplay cm = c.actor(fx.itemDisplay(from, new ItemStack(Material.AIR), 1f, 14));
                        cm.setTeleportDuration(10);
                        cm.setDisplayWidth(60f);
                        cm.setDisplayHeight(60f);
                        c.model(cm, CineCharacters.FX_COMETA, "idle", 1f);
                        c.anim(cm, "color:" + FUEGO);
                        CineCharacters.size(cm, 1.1f, 0);
                        m[2] = cm;
                        c.sound(from, "ignea.meteoro", 1.2f, 0.7f + c.rnd.nextFloat() * 0.4f);
                    }
                    if (t == hit - 9 && m[2] instanceof ItemDisplay cm && cm.isValid()) cm.teleport(at.clone().add(0, 0.5, 0));
                    if (plain && t >= hit - 10 && t < hit) CineFx.part(c.w, Particle.FLAME, at.clone().add(0, (hit - t) * 3, 0), 12, 0.3, 0.3, 0.3, 0.02, null);
                    if (t == hit) {
                        k.once(c, at.clone().add(0, 0.3, 0), CineCharacters.FX_GOLPE, 1.3f, FUEGO, 16);
                        k.once(c, at.clone().add(0, 0.15, 0), CineCharacters.FX_ONDA, 3.5f, ORO, 18);
                        CineFx.part(c.w, Particle.EXPLOSION, at.clone().add(0, 0.6, 0), 2, 0.4, 0.2, 0.4, 0, null);
                        CineFx.part(c.w, Particle.FLAME, at.clone().add(0, 0.5, 0), 40, 0.6, 0.3, 0.6, 0.15, null);
                        CineFx.part(c.w, Particle.LARGE_SMOKE, at.clone().add(0, 1, 0), 12, 0.6, 0.6, 0.6, 0.03, null);
                        c.sound(at, "ignea.impacto", 1.4f, 0.8f + c.rnd.nextFloat() * 0.3f);
                        world.areaDamage(at, 2.5, c.cfg("danioRayo", 8.0), c.launcher, null);
                        world.bowlCrater(at.clone().add(0, -1, 0), 2, 2, false, 0.04, 0.08, 0, c.rnd);
                        if (c.target.getLocation().distance(at) < 3.5) c.shake(0.8, 8, 0.85);
                        else c.shake(0.35, 5, 0.85);
                    }
                }
                // 120–178: el sol se forma en el cielo y absorbe el fuego del suelo.
                if (t == 120) {
                    ItemDisplay sol = k.vfx(c, sun, CineCharacters.FX_ROJO, 0.6f, FUEGO);
                    CineCharacters.size(sol, 5.5f, 50);
                    c.data.put("sol", sol);
                    ItemDisplay halo = k.vfx(c, sun, CineCharacters.FX_AURA, 3f, ORO);
                    CineCharacters.size(halo, 9f, 50);
                    c.data.put("halo", halo);
                    c.sound(sun, "ignea.sol", 2.5f, 0.6f);
                    c.caption("JUICIO ÍGNEO", "Un sol desciende sobre " + c.target.getName(), 0xff8a2a, 60);
                }
                if (t >= 120 && t < 178) {
                    for (int i = 0; i < 4; i++) {
                        Location from = g.clone().add(c.rnd.nextGaussian() * 8, 0.3, c.rnd.nextGaussian() * 8);
                        CineFx.stream(c.w, from, sun, Particle.FLAME, 1);
                    }
                    if (t % 6 == 0) c.sound(sun, "ignea.carga", 1.6f, 0.5f + (t - 120) / 60f);
                    if (t % 4 == 0) c.shake(0.15 + (t - 120) / 58.0 * 0.6, 5, 0.92);
                    if (plain && t % 2 == 0) CineFx.part(c.w, Particle.FLAME, sun, 30, 2.5, 2.5, 2.5, 0.05, null);
                }
                // 178–192: el sol se comprime (más brillante) y cae sobre el objetivo.
                if (t == 178) {
                    CineCharacters.size(get(c, "sol"), 2.2f, 8);
                    CineCharacters.size(get(c, "halo"), 3.5f, 8);
                    c.anim(get(c, "sol"), "color:" + BLANCO);
                    c.sound(sun, "ignea.compresion", 2.5f, 1.4f);
                    c.screenFx(CineNet.SPEEDLINES, 0xffff6a1a, 2, 12, 4);
                    CineNet.Shot s = c.shot();
                    Location side = c.around(g, 140, 16, 5);
                    s.key(0, side, sun, 70, CUT);
                    s.key(14, side.clone().add(0, -1, 0), g.clone().add(0, 2, 0), 64, EASE_IN_EXPO);
                    c.cam(s);
                }
                if (t == 186) {
                    ItemDisplay sol = get(c, "sol"), halo = get(c, "halo");
                    if (sol != null && sol.isValid()) {
                        sol.setTeleportDuration(6);
                        sol.teleport(g.clone().add(0, 1.2, 0));
                    }
                    if (halo != null && halo.isValid()) {
                        halo.setTeleportDuration(6);
                        halo.teleport(g.clone().add(0, 1.2, 0));
                    }
                    c.sound(g, "ignea.caida", 2.5f, 0.7f);
                }
                if (t == 192) explode(c, g);
                if (t > 192 && t < 236) {
                    // Hongo de humo y fuego que sube, ascuas que llueven, ondas de calor.
                    int k2 = t - 192;
                    Location col = g.clone().add(0, Math.min(18, k2 * 0.7), 0);
                    CineFx.part(c.w, Particle.CAMPFIRE_SIGNAL_SMOKE, col, 6, 1.5 + k2 * 0.05, 0.6, 1.5 + k2 * 0.05, 0.02, null);
                    CineFx.part(c.w, Particle.FLAME, col, 18, 1.2, 1, 1.2, 0.06, null);
                    if (k2 > 14) CineFx.part(c.w, Particle.LARGE_SMOKE, g.clone().add(0, 18, 0), 12, 4 + k2 * 0.1, 1, 4 + k2 * 0.1, 0.02, null);
                    CineFx.part(c.w, Particle.LAVA, g.clone().add(0, 3, 0), 3, 6, 1, 6, 0, null);
                    if (t % 5 == 0) c.shake(0.8 - k2 * 0.015, 5, 0.95);
                }
                if (t == 236) {
                    c.anim(get(c, "domo"), "fin");
                    CineCharacters.remove((Entity) get(c, "aura"));
                }
                if (t == 248) c.skyReset();
                if (t >= 268) e.finish(c, false);
            }

            void explode(CineEngine.Ctx c, Location g) {
                CineCharacters.remove((Entity) get(c, "sol"), (Entity) get(c, "halo"));
                c.flash(0xfff0c0, 0, 4, 16);
                c.shake(2.8, 40, 0.94);
                c.sound(g, "ignea.explosion", 4f, 0.6f);
                c.tint(0x50ff6a1a, 0, 6, 20);
                int r = Math.max(4, c.cfgI("radioCraterFinal", 9));
                ItemDisplay domo = k.vfx(c, g.clone().add(0, 0.5, 0), "fx_domo", 1.5f, "c0ff6a1a");
                CineCharacters.size(domo, r * 1.6f, 14);
                c.data.put("domo", domo);
                k.once(c, g.clone().add(0, 0.3, 0), CineCharacters.FX_ONDA, r * 3.2f, ORO, 30);
                k.once(c, g.clone().add(0, 0.6, 0), CineCharacters.FX_ONDA, r * 2.2f, FUEGO, 24);
                k.once(c, g.clone().add(0, 1.2, 0), CineCharacters.FX_GOLPE, 4.5f, BLANCO, 20);
                k.once(c, g, CineCharacters.FX_PILAR, 1.6f, FUEGO, 50);
                CineFx.part(c.w, Particle.EXPLOSION_EMITTER, g.clone().add(0, 1, 0), 6, 3, 1, 3, 0, null);
                CineFx.part(c.w, Particle.FLASH, g.clone().add(0, 2, 0), 3, 1, 1, 1, 0, null);
                CineFx.part(c.w, Particle.FLAME, g.clone().add(0, 1, 0), 300, r * 0.6, 1.5, r * 0.6, 0.35, null);
                world.boost(c.cfgI("bloquesPorTick", 1200), 80);
                world.bowlCrater(g.clone().add(0, -1, 0), r, Math.max(4, r * 2 / 3), true, 0.06, 0.16, 0.08, c.rnd);
                for (int i = 0; i < 70; i++) {
                    double a = c.rnd.nextDouble() * Math.PI * 2;
                    Vector v = new Vector(Math.cos(a) * (0.5 + c.rnd.nextDouble() * 0.9), 0.9 + c.rnd.nextDouble() * 1.1, Math.sin(a) * (0.5 + c.rnd.nextDouble() * 0.9));
                    Material m = i % 4 == 0 ? Material.MAGMA_BLOCK : i % 4 == 1 ? Material.NETHERRACK : i % 4 == 2 ? Material.BLACKSTONE : Material.DIRT;
                    world.flyVisual(g.clone().add(0, 1, 0), m.createBlockData(), CineWorld.Path.LAUNCH, null, v, 50, 0);
                }
                c.target.removePotionEffect(PotionEffectType.SLOWNESS);
                c.finalHit(c.target, c.cfg("danioFinal", 40.0));
                world.areaDamage(g, r + 3, c.cfg("danioFinal", 40.0) * 0.6, c.launcher, c.target.getUniqueId());
                CineWorld.radial(g, r + 6, 2.4, 1.1, c.launcher, null);
                c.target.setVelocity(new Vector(0, 1.3, 0));
                // Plano general lejano: la cúpula de fuego y el hongo de humo; luego se acerca al cráter.
                CineNet.Shot s = c.shot();
                Location far = c.around(g, 135, 44, 12);
                s.key(0, far, g.clone().add(0, 6, 0), 74, CUT);
                s.key(40, c.around(g, 150, 36, 16), g.clone().add(0, 10, 0), 70, EASE_OUT_EXPO);
                s.key(41, c.around(g, 160, r + 7, 6), g, 70, CUT);
                s.key(76, c.around(g, 190, r + 6, 7), g, 66, LINEAR);
                c.cam(s);
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
                    c.model(mh, "meteorito", "rotar", 6.5f, core, rock);
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

    /** Toda la lista de ids (para la galería de comandos y el autocompletado). */
    List<String> ids() {
        return new ArrayList<>(e.all().keySet());
    }
}
