package dev.livearena.plugin;

import static dev.livearena.plugin.CineCharacters.ease;
import static dev.livearena.plugin.CineCharacters.forward;
import static dev.livearena.plugin.CineCharacters.get;
import static dev.livearena.plugin.CineCharacters.mid;
import static dev.livearena.plugin.CineCharacters.remove;
import static dev.livearena.plugin.CineCharacters.size;
import static dev.livearena.plugin.CineCharacters.yawTo;
import static dev.livearena.plugin.CineNet.CUT;
import static dev.livearena.plugin.CineNet.EASE_IN_EXPO;
import static dev.livearena.plugin.CineNet.EASE_IN_OUT;
import static dev.livearena.plugin.CineNet.EASE_OUT_EXPO;
import static dev.livearena.plugin.CineNet.LINEAR;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.block.Block;
import org.bukkit.damage.DamageSource;
import org.bukkit.damage.DamageType;
import org.bukkit.entity.Entity;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;
import org.bukkit.util.BoundingBox;
import org.bukkit.util.RayTraceResult;
import org.bukkit.util.Transformation;
import org.bukkit.util.Vector;
import org.joml.Quaternionf;
import org.joml.Vector3f;

/**
 * Cinemáticas v5: «Sangre Perforante» (Choso, con la skin del usuario) y «Ataque orbital» (satélite + láser).
 * Usan los mismos recursos que las de personaje: modelos GeckoLib, efectos con shader del mod (fx_*), cámara por planos
 * y destrucción del mundo por la cola con presupuesto (CineWorld). Sin el mod se ven partículas y displays de respaldo.
 */
final class CineEspeciales {
    static final String CHOSO = "choso", SATELITE = "satelite";

    private final CineEngine e;
    private final CineFx fx;
    private final CineWorld world;
    private final CineCharacters k;

    CineEspeciales(CineEngine engine, CineCharacters characters) {
        this.e = engine;
        this.fx = engine.fx;
        this.world = engine.world;
        this.k = characters;
    }

    void register() {
        sangrePerforante();
        ataqueOrbital();
    }

    /* ======================================== utilidades ======================================== */

    /** Display cuyo eje Z (dirección y longitud) va de `from` a `to`, con grosor `width`: haces y láseres del mod. */
    private ItemDisplay axis(CineEngine.Ctx c, Location from, Location to, String model, float width, String argb, String anim) {
        ItemDisplay d = c.actor(fx.itemDisplay(from, new ItemStack(Material.AIR), 1f, 0));
        d.setTeleportDuration(1);
        // Caja de dibujo enorme: el haz se sale mucho de la posición del display.
        d.setDisplayWidth(400f);
        d.setDisplayHeight(400f);
        d.setViewRange(16f);
        c.model(d, model, anim, 1f);
        if (argb != null) c.anim(d, "color:" + argb);
        setAxis(d, from, to, width, 0);
        return d;
    }

    private static void setAxis(ItemDisplay d, Location from, Location to, float width, int ticks) {
        setAxis(d, from, to, width, width, ticks);
    }

    /** yScale: libre para pasar un dato al efecto (p. ej. la velocidad de la flecha, en bloques/s ÷ 100). */
    private static void setAxis(ItemDisplay d, Location from, Location to, float width, float yScale, int ticks) {
        setAxis(d, from, to, width, yScale, ticks, 0);
    }

    /**
     * lift: el display está `lift` bloques por debajo de `from` y el efecto sube con una traslación. La caja de dibujo de
     * un display solo crece hacia arriba: un haz que baja desde su origen se dejaría de dibujar sin esto.
     */
    private static void setAxis(ItemDisplay d, Location from, Location to, float width, float yScale, int ticks, float lift) {
        if (d == null || !d.isValid()) return;
        Vector v = to.toVector().subtract(from.toVector());
        float len = (float) v.length();
        Quaternionf q = new Quaternionf().rotationTo(new Vector3f(0, 0, 1), new Vector3f((float) v.getX(), (float) v.getY(), (float) v.getZ()).normalize());
        d.setInterpolationDelay(0);
        d.setInterpolationDuration(ticks);
        d.setTransformation(new Transformation(new Vector3f(0, lift, 0), q, new Vector3f(width, yScale, Math.max(0.01f, len)), new Quaternionf()));
    }

    /** Daño que atraviesa la armadura en una fracción `pierce` (esa parte es de tipo mágico). */
    private void piercing(CineEngine.Ctx c, LivingEntity le, double amount, double pierce) {
        if (le == c.target) {
            c.finalHit(c.target, amount);
            return;
        }
        if (!CineWorld.affectable(le, c.launcher)) return;
        double magic = amount * pierce;
        if (world.nonLethal() && le instanceof Player p) magic = Math.min(magic, Math.max(0, p.getHealth() + p.getAbsorptionAmount() - 2));
        if (magic > 0) {
            le.setNoDamageTicks(0);
            le.damage(magic, DamageSource.builder(DamageType.MAGIC).build());
        }
        world.damage(le, amount * (1 - pierce), true, c.launcher);
    }

    /* ===================================== SANGRE PERFORANTE ===================================== */

    private void sangrePerforante() {
        e.register(new CineEngine.Ability("sangre_perforante", "SANGRE PERFORANTE", "#c0101c", 320, 320,
                "Un hechicero de sangre surge del suelo, comprime su sangre entre las manos y dispara un haz perforante que atraviesa al objetivo y todo lo que hay detrás") {
            void start(CineEngine.Ctx c) {
                Location at = c.ground(c.feet().add(forward(c.yaw0).multiply(c.cfg("distancia", 9.0))).add(0, 4, 0));
                float yaw = yawTo(at, c.feet());
                ItemDisplay ch = k.character(c, at, yaw, CHOSO, CineCharacters.A_APARICION, CineCharacters.ALTO_PERSONAJE / 2f, 0x3a2030);
                c.data.put("ch", ch);
                c.data.put("at", at);
                c.data.put("yaw", yaw);
                c.target.addPotionEffect(new PotionEffect(PotionEffectType.SLOWNESS, 110, 9, false, false));
                c.sound(at, "choso.aparicion", 2f, 0.8f);
                k.once(c, at.clone().add(0, 0.12, 0), CineCharacters.FX_ONDA, 5, "ffa0000c", 26);
                CineFx.part(c.w, Particle.DUST, at.clone().add(0, 0.3, 0), 60, 1.2, 0.2, 1.2, 0, CineFx.dust(0x8a0010, 1.6f));
                // Panel de manga: cámara lateral con los dos de perfil.
                Location m = mid(at, c.feet(), 0.5);
                Vector lat = lateral(at, c.feet());
                double sep = at.distance(c.feet());
                CineNet.Shot s = c.shot();
                s.key(0, m.clone().add(lat.clone().multiply(sep * 0.95 + 3)).add(0, 1.3, 0), m.clone().add(0, 1.2, 0), 60, LINEAR);
                s.key(40, m.clone().add(lat.clone().multiply(sep * 0.85 + 2.5)).add(0, 1.4, 0), m.clone().add(0, 1.2, 0), 56, EASE_IN_OUT);
                // 41–70: zoom lento a la cara de Choso (frontal), con las manos juntas bajo la barbilla.
                Vector face = forward(yaw);
                Location eyes = at.clone().add(0, 1.68, 0);
                s.key(41, eyes.clone().add(face.clone().multiply(2.3)).add(lat.clone().multiply(0.35)).add(0, -0.15, 0), eyes.clone().add(0, -0.12, 0), 50, CUT);
                s.key(70, eyes.clone().add(face.clone().multiply(1.55)).add(lat.clone().multiply(0.15)).add(0, -0.08, 0), eyes.clone().add(0, -0.1, 0), 40, EASE_IN_OUT);
                // 71–92: 3/4 de las manos y la cara: la flecha de sangre toma forma entre las palmas.
                Location hands = hands(at, yaw, 0.7);
                s.key(71, at.clone().add(face.clone().multiply(2.4)).add(lat.clone().multiply(1.5)).add(0, 1.35, 0), hands.clone().add(0, 0.12, 0), 50, CUT);
                s.key(92, at.clone().add(face.clone().multiply(1.9)).add(lat.clone().multiply(1.1)).add(0, 1.4, 0), hands.clone().add(0, 0.15, 0), 44, EASE_IN_OUT);
                // 93–102: plano detalle de los ojos con el fogonazo rojo (justo antes del disparo).
                s.key(93, eyes.clone().add(face.clone().multiply(1.45)).add(0, -0.05, 0), eyes.clone().add(0, -0.08, 0), 38, CUT);
                s.key(102, eyes.clone().add(face.clone().multiply(1.25)).add(0, -0.05, 0), eyes.clone().add(0, -0.08, 0), 34, LINEAR);
                c.cam(s);
            }

            /** Vector lateral (perpendicular a la línea Choso → objetivo). */
            Vector lateral(Location a, Location b) {
                Vector d = b.toVector().subtract(a.toVector()).setY(0);
                if (d.lengthSquared() < 1e-4) d = new Vector(0, 0, 1);
                return d.normalize().crossProduct(new Vector(0, 1, 0)).normalize();
            }

            Location hands(Location at, float yaw, double ahead) {
                return at.clone().add(forward(yaw).multiply(ahead)).add(0, 1.31, 0);
            }

            void tick(CineEngine.Ctx c, int t) {
                ItemDisplay ch = get(c, "ch");
                Location at = get(c, "at");
                float yaw = (float) c.data.get("yaw");
                boolean plain = !CineNet.hasMod(c.target);
                if (t < 104) c.target.setVelocity(new Vector(0, Math.min(0, c.target.getVelocity().getY()), 0));
                if (t == 24) {
                    c.data.put("aura", k.vfx(c, at, CineCharacters.FX_AURA, 2.3f, "ffb0101c"));
                    c.sound(at, "aura.vibrar", 1.5f, 0.8f);
                }
                if (t == 32) {
                    c.anim(ch, "juntar_manos");
                    c.sky(CineNet.SKY_TINT, 0x2a0006, 220);
                    c.vignette(0xa0200006, 10, 150, 20);
                }
                if (t == 40) c.say("choso_tecnica", "Técnica de manipulación de sangre…", 0xff5a64, 34);
                if (t == 46) {
                    // Destellos rojos bajo los ojos (anclados a la cara; el display gira con Choso).
                    Location eyeAt = at.clone().add(0, 1.66, 0);
                    eyeAt.setYaw(yaw);
                    ItemDisplay ojos = k.vfx(c, eyeAt, "fx_ojos", 1f / 16f, null);
                    ojos.setRotation(yaw, 0);
                    c.attach(ojos, ch, "ojos", 0, 0, 0);
                    c.data.put("ojos", ojos);
                }
                if (t == 58 || t == 94) {
                    c.anim(get(c, "ojos"), "destello");
                    c.sound(at, "choso.destello", 1.4f, t == 58 ? 1.2f : 1.5f);
                    c.shake(t == 58 ? 0.25 : 0.45, 6, 0.85);
                    if (t == 94) c.screenFx(CineNet.SPEEDLINES, 0xff2a0006, 0, 9, 4);
                }
                if (t == 52) c.anim(ch, "cargar");
                if (t == 60) {
                    // La flecha de sangre se forma entre las manos (sin esfera): punta que crece y late, hilos de sangre en espiral.
                    Location h = hands(at, yaw, 0.72);
                    Location aim = c.target.getLocation().add(0, 1.15, 0);
                    Vector d = aim.toVector().subtract(h.toVector());
                    if (d.lengthSquared() < 1e-4) d = forward(yaw);
                    d.normalize();
                    ItemDisplay arrow = axis(c, h, h.clone().add(d.clone().multiply(0.62)), "fx_perforante", 0.07f, null, "formar");
                    c.attach(arrow, ch, "manos", 0, 0, 0);
                    c.data.put("arrow", arrow);
                    c.sound(at, "choso.carga", 1.6f, 0.8f);
                }
                if (plain && t > 60 && t < 104 && t % 2 == 0)
                    CineFx.part(c.w, Particle.DUST, hands(at, yaw, 0.7), 6, 0.25, 0.25, 0.25, 0, CineFx.dust(0x8a0010, 1.2f));
                if (t >= 80 && t < 100 && t % 4 == 0) {
                    // Compresión: la sangre late y tiembla todo.
                    c.shake(0.2 + (t - 80) / 20.0 * 0.4, 5, 0.9);
                    if (t % 8 == 0) c.sound(at, "choso.compresion", 1.2f, 0.9f + (t - 80) / 30f);
                }
                if (t == 72) {
                    // Voz (1,6 s): la frase «¡Sangre Perforante!» termina justo en el disparo (tick 103). El subtítulo sale
                    // con la voz y la flecha cuando la frase acaba; el destello rojo y el daño solo llegan con el impacto.
                    c.data.put("voiced", c.voice("choso"));
                    c.say("choso_perforante", "¡Sangre Perforante!", 0xff2a3a, 40);
                }
                if (t == 101) c.anim(ch, "perforar");
                if (t == 103) {
                    fire(c, at, yaw);
                    c.screenFx(CineNet.SPEEDLINES, 0xff000000, 0, 12, 6);
                    c.shake(0.4, 6, 0.85);
                }
                Integer fired = get(c, "fired");
                Integer imp = get(c, "imp");
                if (fired != null && imp == null) advance(c, t);
                imp = get(c, "imp");
                if (imp != null) {
                    int since = t - imp;
                    int hold = holdTicks(c);
                    Location impAt = get(c, "impAt");
                    boolean pinned = Boolean.TRUE.equals(c.data.get("pinned"));
                    if (since < hold && pinned) {
                        // Clavado por la flecha: no se mueve y la sangre gotea por el haz.
                        c.target.setVelocity(new Vector(0, Math.min(0, c.target.getVelocity().getY()), 0));
                        if (since % 3 == 0) CineFx.part(c.w, Particle.DUST, impAt, 8, 0.15, 0.25, 0.15, 0, CineFx.dust(0x8a0010, 1.3f));
                        if (since % 10 == 0) CineFx.part(c.w, Particle.DAMAGE_INDICATOR, impAt, 2, 0.2, 0.2, 0.2, 0.05, null);
                        if (since % 16 == 8) c.sound(impAt, "choso.compresion", 0.8f, 1.4f);
                    }
                    if (since == 24) {
                        // Plano detalle: la punta clavada en el objetivo con el haz que llega desde las manos.
                        Location from = get(c, "from");
                        Vector dir = get(c, "dir");
                        Vector lat = lateral(at, c.feet());
                        CineNet.Shot s = c.shot();
                        Location p0 = impAt.clone().add(lat.clone().multiply(2.2)).add(dir.clone().multiply(-2.6)).add(0, 0.35, 0);
                        s.key(0, p0, impAt.clone().add(dir.clone().multiply(-0.8)), 50, CUT);
                        s.key(hold - 24, p0.clone().add(lat.clone().multiply(0.6)).add(dir.clone().multiply(-0.8)), impAt.clone().add(dir.clone().multiply(-1.2)), 46, EASE_IN_OUT);
                        c.cam(s);
                        c.shake(0.3, 10, 0.9);
                    }
                    if (since == hold) release(c, t);
                    if (since == hold + 30) {
                        c.anim(ch, "pose_final");
                        Vector face = forward(yaw);
                        CineNet.Shot s = c.shot();
                        s.key(0, at.clone().add(face.clone().multiply(3.1)).add(0, 1.55, 0), at.clone().add(0, 1.4, 0), 56, CUT);
                        s.key(50, at.clone().add(face.clone().multiply(2.6)).add(0, 1.65, 0), at.clone().add(0, 1.5, 0), 52, LINEAR);
                        c.cam(s);
                    }
                    if (since == hold + 54) k.vanish(c, CHOSO, ch, 0xc0101c, 28, (Entity) get(c, "aura"), (Entity) get(c, "ojos"));
                    if (since == hold + 66) c.skyReset();
                    if (since >= hold + 88) e.finish(c, false);
                }
            }

            int holdTicks(CineEngine.Ctx c) {
                return (int) Math.round(Math.max(0.5, c.cfg("segundosClavada", 3.0)) * 20);
            }

            /** Disparo: el haz sale de las manos hacia el objetivo y sigue hasta `distanciaDestruccion` bloques detrás. */
            void fire(CineEngine.Ctx c, Location at, float yaw) {
                remove((Entity) get(c, "arrow"));
                Location from = hands(at, yaw, 0.85).add(0, 0.04, 0);
                Location aim = c.target.getLocation().add(0, 1.15, 0);
                Vector dir = aim.toVector().subtract(from.toVector());
                if (dir.lengthSquared() < 1e-4) dir = forward(yaw);
                dir.normalize();
                double len = from.distance(aim) + c.cfg("distanciaDestruccion", 28.0);
                Location to = from.clone().add(dir.clone().multiply(len));
                double speed = Math.max(0.2, c.cfg("velocidadRayo", 0.8)); // bloques por tick (×20 = bloques/s)
                c.data.put("speed", speed);
                // El rayo visible acaba justo atravesando al objetivo: la punta se queda clavada y el haz unido a las
                // manos de Choso durante «segundosClavada»; luego se apaga (el tramo de detrás sale al soltarlo).
                Location rayEnd = aim.clone().add(dir.clone().multiply(1.4));
                double holdS = holdTicks(c) / 20.0 + 0.3;
                ItemDisplay beam = axis(c, from, rayEnd, "fx_perforante", (float) c.cfg("grosor", 0.22), null, "rayo:" + String.format(java.util.Locale.ROOT, "%.2f", holdS));
                setAxis(beam, from, rayEnd, (float) c.cfg("grosor", 0.22), (float) (speed * 20 / 100.0), 0);
                c.data.put("beam", beam);
                c.data.put("from", from);
                c.data.put("dir", dir);
                c.data.put("len", len);
                c.data.put("prog", 0.0);
                c.data.put("fired", c.t);
                c.data.put("hitSet", new LinkedHashSet<Entity>());
                // La voz termina justo al disparar: el silbido y la onda de la flecha suenan completos.
                if (Boolean.TRUE.equals(c.data.get("voiced"))) c.sound(from, "choso.disparo", 1f, 1f);
                else c.sound(from, "choso.disparo", 2.5f, 1.7f);
                c.target.removePotionEffect(PotionEffectType.SLOWNESS);
                // La cámara acompaña a la flecha de lado durante el vuelo (se ve la punta entera).
                Vector lat = lateral(at, c.feet());
                double hit = Math.max(1, from.distance(aim));
                int flight = (int) Math.max(3, Math.ceil(hit / speed));
                CineNet.Shot s = c.shot();
                Location cam0 = from.clone().add(lat.clone().multiply(3.6)).add(0, 0.4, 0).add(dir.clone().multiply(-1.2));
                s.key(0, cam0, from.clone().add(dir.clone().multiply(-0.6)), 58, CUT);
                Location cam1 = from.clone().add(dir.clone().multiply(hit - 1.8)).add(lat.clone().multiply(3.6)).add(0, 0.4, 0);
                s.key(flight, cam1, from.clone().add(dir.clone().multiply(hit - 0.6)), 58, LINEAR);
                s.key(flight + 8, cam1.clone().add(lat.clone().multiply(0.8)), from.clone().add(dir.clone().multiply(hit + 0.5)), 66, LINEAR);
                c.cam(s);
            }

            /** Se suelta la flecha: sale despedido, el haz sigue de largo por detrás y abre el túnel. */
            void release(CineEngine.Ctx c, int t) {
                Location p = get(c, "impAt");
                Vector dir = get(c, "dir");
                if (p == null || dir == null) return;
                boolean pinned = Boolean.TRUE.equals(c.data.get("pinned"));
                if (pinned) {
                    double push = c.cfg("empuje", 2.8);
                    c.target.setVelocity(dir.clone().setY(0).normalize().multiply(push).setY(0.45));
                    c.target.setFallDistance(0);
                }
                Location end = p.clone().add(dir.clone().multiply(c.cfg("distanciaDestruccion", 28.0)));
                ItemDisplay through = axis(c, p, end, "fx_perforante", (float) c.cfg("grosor", 0.22) * 0.8f, null, "disparar");
                setAxis(through, p, end, (float) c.cfg("grosor", 0.22) * 0.8f, (float) (2.4 * 20 / 100.0), 0);
                c.sound(p, "choso.disparo", 1.6f, 1.4f);
                c.shake(1.2, 14, 0.88);
                c.tint(0x40ff2030, 0, 2, 6);
                k.once(c, p, CineCharacters.FX_ONDA, 6, "ffff2030", 22);
                // Destrucción en línea DETRÁS del objetivo: un túnel que avanza desde el impacto.
                if (c.cfgB("romperBloques", true)) {
                    double r = c.cfg("radioDestruccion", 1.4), dist = c.cfg("distanciaDestruccion", 28.0);
                    List<Block> tube = new ArrayList<>();
                    Set<Block> seen = new LinkedHashSet<>();
                    for (double s = 0.6; s <= dist; s += 0.5) {
                        Location q = p.clone().add(dir.clone().multiply(s));
                        int R = (int) Math.ceil(r);
                        for (int x = -R; x <= R; x++)
                            for (int y = -R; y <= R; y++)
                                for (int z = -R; z <= R; z++) {
                                    if (x * x + y * y + z * z > r * r) continue;
                                    Block b = q.clone().add(x, y, z).getBlock();
                                    if (!b.getType().isAir() && seen.add(b)) tube.add(b);
                                }
                    }
                    world.enqueueSorted(tube, p, true, Material.AIR);
                    for (int i = 0; i < 14 && i < tube.size(); i += 2) {
                        Block b = tube.get(i);
                        world.flyVisual(b.getLocation().add(0.5, 0.5, 0.5), b.getBlockData(), CineWorld.Path.LAUNCH, null, dir.clone().multiply(0.8).add(new Vector(0, 0.35, 0)), 30, 0);
                    }
                }
                // Cámara: tras el objetivo que sale despedido, de lado.
                Vector lat = dir.clone().setY(0).normalize().crossProduct(new Vector(0, 1, 0)).normalize().multiply(6.5);
                CineNet.Shot s = c.shot().followPos(c.target.getEntityId()).followLook(c.target.getEntityId());
                Location off = lat.add(new Vector(0, 1.2, 0)).add(dir.clone().multiply(-1.5)).toLocation(c.w);
                s.key(0, off, off, 66, CUT);
                s.key(30, off.clone().add(dir.clone().multiply(-2)), off, 72, EASE_OUT_EXPO);
                c.cam(s);
            }

            /** Avanza el proyectil `velocidadFlecha` bloques/tick con un barrido de segmento: no puede atravesar sin impactar. */
            void advance(CineEngine.Ctx c, int t) {
                Location from = get(c, "from");
                Vector dir = get(c, "dir");
                double len = (double) c.data.get("len");
                double p0 = (double) c.data.get("prog"), p1 = Math.min(len, p0 + (double) c.data.get("speed"));
                c.data.put("prog", p1);
                Location a = from.clone().add(dir.clone().multiply(p0));
                if (!CineNet.hasMod(c.target)) CineFx.line(c.w, a, from.clone().add(dir.clone().multiply(p1)), 0.3, 0xc0101c, 1.6f);
                @SuppressWarnings("unchecked")
                Set<Entity> hit = (Set<Entity>) c.data.get("hitSet");
                Vector seg = dir.clone().multiply(p1 - p0);
                for (Entity en : c.w.getNearbyEntities(a.clone().add(seg.clone().multiply(0.5)), (p1 - p0) / 2 + 2, (p1 - p0) / 2 + 2, (p1 - p0) / 2 + 2)) {
                    if (!(en instanceof LivingEntity le) || hit.contains(en)) continue;
                    if (en != c.target && !CineWorld.affectable(en, c.launcher)) continue;
                    BoundingBox bb = en.getBoundingBox().expand(0.35);
                    RayTraceResult r = bb.rayTrace(a.toVector(), dir, Math.max(0.01, p1 - p0));
                    if (r == null && !bb.contains(a.toVector())) continue;
                    hit.add(en);
                    if (en == c.target) impact(c, t, r != null ? r.getHitPosition().toLocation(c.w) : c.target.getLocation().add(0, 1, 0), dir);
                    else {
                        piercing(c, le, c.cfg("danio", 30.0) * 0.5, c.cfg("perforacion", 0.6));
                        le.setVelocity(dir.clone().multiply(1.6).setY(0.3));
                    }
                }
                if (p1 >= len && get(c, "imp") == null) {
                    // Falló (el objetivo se apartó): se sigue con el final igualmente.
                    c.data.put("imp", t);
                    c.data.put("impAt", from.clone().add(dir.clone().multiply(len)));
                }
            }

            void impact(CineEngine.Ctx c, int t, Location p, Vector dir) {
                c.data.put("imp", t);
                c.data.put("impAt", p.clone());
                c.data.put("pinned", true);
                piercing(c, c.target, c.cfg("danio", 30.0), c.cfg("perforacion", 0.6));
                int lvl = Math.max(1, c.cfgI("witherNivel", 2));
                c.target.addPotionEffect(new PotionEffect(PotionEffectType.WITHER, c.cfgI("witherSegundos", 4) * 20, lvl - 1, false, true));
                c.target.setVelocity(dir.clone().setY(0).normalize().multiply(0.25).setY(0.05));
                c.target.setFallDistance(0);
                k.once(c, p, CineCharacters.FX_ONDA, 7, "ffff2030", 26);
                CineFx.part(c.w, Particle.DUST, p, 50, 0.6, 0.6, 0.6, 0, CineFx.dust(0x8a0010, 1.8f));
                CineFx.part(c.w, Particle.DAMAGE_INDICATOR, p, 12, 0.4, 0.4, 0.4, 0.2, null);
                c.tint(0x50ff2030, 0, 2, 6);
                c.shake(1.7, 18, 0.88);
                c.screenFx(CineNet.SPEEDLINES, 0xffffffff, 0, 8, 6);
                c.sound(p, "choso.impacto", 2.5f, 0.9f);
                // Plano general de perfil: Choso, el haz entero y la punta clavada (como la viñeta del manga).
                Location from = get(c, "from");
                Location at = get(c, "at");
                Location m = mid(from, p, 0.5);
                Vector lat = lateral(at, c.feet());
                double sep = from.distance(p);
                CineNet.Shot s = c.shot();
                Location w0 = m.clone().add(lat.clone().multiply(sep * 0.7 + 3.5)).add(0, 0.9, 0);
                s.key(0, w0, m.clone().add(0, 0.2, 0), 64, CUT);
                s.key(24, w0.clone().add(lat.clone().multiply(-0.8)).add(0, 0.2, 0), m.clone().add(0, 0.25, 0), 60, EASE_OUT_EXPO);
                c.cam(s);
            }
        });
    }

    /* ======================================== ATAQUE ORBITAL ======================================== */

    private void ataqueOrbital() {
        e.register(new CineEngine.Ability("ataque_orbital", "ATAQUE ORBITAL", "#ff1a2a", 300, 300,
                "Un rayo rojo fija al objetivo; la cámara sube al espacio, un satélite cañón carga con la Tierra al fondo, dispara al planeta y el rayo cae sobre el objetivo abriendo un cráter enorme") {
            void start(CineEngine.Ctx c) {
                Location g = c.ground(c.feet().add(0, 1, 0));
                c.data.put("g", g);
                // Satélite a `altura` bloques sobre el objetivo, desplazado y con el cañón apuntándole.
                double alt = c.cfg("altura", 180.0), el = Math.toRadians(c.cfg("inclinacion", 72.0));
                Vector hz = forward(c.yaw0 + 90f);
                double D = alt / Math.sin(el);
                Vector dir = hz.clone().multiply(Math.cos(el)).add(new Vector(0, -Math.sin(el), 0)).normalize();
                c.data.put("skyDir", g.clone().subtract(dir.clone().multiply(D)));
                // La escena del espacio va muy por encima del terreno (el cielo del mod tapa todo lo que queda a más de
                // 175 bloques de la cámara) y la Tierra del fondo va fijada a la cámara, como un cielo.
                // Por encima de las nubes (y≈192) para que no se vean bajo el satélite.
                Location sat = g.clone().add(0, c.cfg("alturaEspacio", 340.0), 0);
                // Todo lo del espacio (satélite, fondo y el rayo, que va 160-300 bloques por debajo con el truco de la
                // caja de dibujo) queda por encima del techo del mundo (y=320): ahí el cliente lo dibuja siempre. Por
                // debajo solo lo dibujaría si esa zona entra en tu distancia de renderizado (con 6-8 chunks no salía el rayo).
                if (sat.getY() < 640) sat.setY(640);
                float scale = (float) c.cfg("tamanoSatelite", 2.0);
                Location muzzle = sat.clone().add(dir.clone().multiply(8.75 * scale));
                c.data.put("sat", sat);
                c.data.put("dir", dir);
                c.data.put("muzzle", muzzle);
                c.data.put("scale", scale);
                c.data.put("hit", muzzle.clone().add(dir.clone().multiply(45)));
                ItemDisplay marca = k.vfx(c, g.clone().add(0, 0.05, 0), "fx_marca", 1.2f, "ffff2030");
                marca.setDisplayHeight(400f);
                c.data.put("marca", marca);
                c.target.addPotionEffect(new PotionEffect(PotionEffectType.SLOWNESS, 220, 9, false, false));
                c.sound(g, "orbital.fijado", 2f, 1.2f);
                c.screenFx(CineNet.TARGET_HUD, 0xffff2a3a, 4, 40, 4);
                // 0–44: vista cenital (algo ladeada) que se cierra sobre el objetivo marcado.
                CineNet.Shot s = c.shot();
                Vector side = dir.clone().crossProduct(new Vector(0, 1, 0)).normalize();
                s.key(0, g.clone().add(side.clone().multiply(14)).add(0, 40, 0), g, 62, LINEAR);
                s.key(44, g.clone().add(side.clone().multiply(10)).add(0, 28, 0), g, 46, EASE_IN_OUT);
                // 45–62: subida vertiginosa hacia el espacio.
                s.key(45, g.clone().add(side.clone().multiply(10)).add(0, 28, 0), g, 50, LINEAR);
                s.key(62, g.clone().add(side.clone().multiply(10)).add(0, 150, 0), g.clone().add(0, 400, 0), 100, EASE_IN_EXPO);
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                Location g = get(c, "g");
                Location sat = get(c, "sat");
                Location muzzle = get(c, "muzzle");
                Location hit = get(c, "hit");
                Vector dir = get(c, "dir");
                float scale = (float) c.data.get("scale");
                boolean plain = !CineNet.hasMod(c.target);
                Vector side = dir.clone().crossProduct(new Vector(0, 1, 0)).normalize();
                Vector upv = side.clone().crossProduct(dir).normalize();
                if (t < 198) c.target.setVelocity(new Vector(0, Math.min(0, c.target.getVelocity().getY()), 0));
                if (t < 45 && t % 10 == 0) c.sound(g, "orbital.alarma", 1.5f, 1.4f + (t / 10) * 0.08f);
                if (plain && t < 198 && t % 3 == 0) CineFx.line(c.w, g.clone().add(0, 40, 0), g, 1.0, 0xff2030, 1.2f);
                if (t == 45) {
                    c.sound(g, "orbital.subida", 2f, 0.8f);
                    c.screenFx(CineNet.WARP, 0xffff3040, 4, 12, 4);
                }
                if (t == 56) {
                    c.sky(CineNet.SKY_SPACE, 0, 140);
                    // Satélite y fondo del espacio (solo los ve quien tiene el mod). La caja de dibujo de un display solo
                    // crece hacia arriba: la entidad va más abajo y el modelo sube con una traslación.
                    ItemDisplay st = c.actor(fx.itemDisplay(sat.clone().add(0, -70, 0), new ItemStack(Material.AIR), 1f, 0));
                    st.setDisplayWidth(160f);
                    st.setDisplayHeight(160f);
                    st.setViewRange(16f);
                    c.model(st, SATELITE, "idle", scale);
                    Quaternionf q = new Quaternionf().rotationTo(new Vector3f(0, 0, 1), new Vector3f((float) dir.getX(), (float) dir.getY(), (float) dir.getZ()));
                    st.setTransformation(new Transformation(new Vector3f(0, 70, 0), q, new Vector3f(1, 1, 1), new Quaternionf()));
                    c.data.put("satD", st);
                    ItemDisplay esp = c.actor(fx.itemDisplay(sat.clone().add(0, -300, 0), new ItemStack(Material.AIR), 1f, 0));
                    esp.setDisplayWidth(800f);
                    esp.setDisplayHeight(800f);
                    esp.setViewRange(16f);
                    c.model(esp, "fx_espacio", "idle", 1f);
                    esp.setTransformation(new Transformation(new Vector3f(0, 300, 0), new Quaternionf(), new Vector3f(1, 1, 1), new Quaternionf()));
                    c.data.put("esp", esp);
                }
                if (t == 63) {
                    // 63–102: plano general. El satélite entero con la Tierra enorme al fondo; travelling lento en arco.
                    c.caption("SATÉLITE ORBITAL LA-1", "Cañón de partículas · órbita baja · objetivo: " + c.target.getName(), 0xff4050, 70);
                    CineNet.Shot s = c.shot();
                    Location focus = sat.clone().add(dir.clone().multiply(4 * scale)).add(0, -14, 0);
                    Location p0 = sat.clone().add(side.clone().multiply(36 * scale)).add(0, 9, 0).add(dir.clone().multiply(-8 * scale));
                    Location p1 = sat.clone().add(side.clone().multiply(30 * scale)).add(0, 12, 0).add(dir.clone().multiply(-2 * scale));
                    s.key(0, p0, focus, 64, CUT);
                    s.key(39, p1, focus, 60, EASE_IN_OUT);
                    // 103–142: primer plano del cañón mientras carga (los aros se encienden, el núcleo crece).
                    s.key(40, muzzle.clone().add(side.clone().multiply(7.5 * scale)).add(upv.clone().multiply(2.2 * scale)).add(dir.clone().multiply(-4 * scale)), muzzle, 56, CUT);
                    s.key(79, muzzle.clone().add(side.clone().multiply(5 * scale)).add(upv.clone().multiply(1.6 * scale)).add(dir.clone().multiply(-2 * scale)), muzzle, 50, EASE_IN_OUT);
                    // 143–151: por encima del satélite, mirando por el cañón hacia el planeta (justo antes del disparo).
                    Location rear = sat.clone().add(dir.clone().multiply(-8 * scale)).add(upv.clone().multiply(2.6 * scale)).add(side.clone().multiply(1.4 * scale));
                    s.key(80, rear, hit, 70, CUT);
                    s.key(88, rear.clone().add(dir.clone().multiply(1.5 * scale)), hit, 66, LINEAR);
                    // 152–185: el disparo visto de lado y de lejos: el rayo baja del cañón hasta la Tierra.
                    Location wide = sat.clone().add(side.clone().multiply(34 * scale)).add(0, -2, 0).add(dir.clone().multiply(6 * scale));
                    // 152–160: de cerca, el rayo sale de la boca del cañón hacia la Tierra
                    Location near = muzzle.clone().add(side.clone().multiply(9 * scale)).add(upv.clone().multiply(1.5 * scale)).add(dir.clone().multiply(-3 * scale));
                    s.key(89, near, muzzle.clone().add(dir.clone().multiply(6 * scale)), 62, CUT);
                    s.key(97, near.clone().add(side.clone().multiply(2 * scale)), muzzle.clone().add(dir.clone().multiply(9 * scale)), 66, LINEAR);
                    s.key(98, wide, muzzle.clone().add(dir.clone().multiply(14)), 72, CUT);
                    s.key(122, wide.clone().add(side.clone().multiply(-6 * scale)).add(0, 2, 0), muzzle.clone().add(dir.clone().multiply(18)), 66, LINEAR);
                    c.cam(s);
                }
                if (t == 103) {
                    c.anim(get(c, "satD"), "activar");
                    c.sound(sat, "orbital.activar", 3f, 0.7f);
                    // Carga: haces de energía que entran en la boca y chispas entre los aros (sin esfera que tape el cañón).
                    // Va anclado al hueso del cañón (sigue su deslizamiento, retroceso y giro) con el centro entre los aros.
                    ItemDisplay core = c.actor(fx.itemDisplay(muzzle.clone().add(0, -40, 0), new ItemStack(Material.AIR), 1f, 0));
                    core.setDisplayWidth(120f);
                    core.setDisplayHeight(120f);
                    core.setViewRange(16f);
                    c.model(core, "fx_carga", "idle", 1f);
                    setAxis(core, muzzle, muzzle.clone().add(dir), 1.1f * scale, 1.1f * scale, 0, 0);
                    double along = (116 - 40) / 16.0 * scale; // del pivote del cañón (z=40 px) al centro de los aros (z≈116 px)
                    c.attach(core, get(c, "satD"), "canon", dir.getX() * along, dir.getY() * along, dir.getZ() * along);
                    c.data.put("core", core);
                }
                if (t == 122) c.anim(get(c, "satD"), "cargando");
                if (t == 145) c.anim(get(c, "satD"), "cargado");
                if (t > 103 && t < 152 && t % 12 == 7) {
                    c.sound(sat, "orbital.carga", 2f, 0.6f + (t - 103) / 60f);
                    c.shake(0.12 + (t - 103) / 48.0 * 0.45, 10, 0.95);
                }
                if (t == 152) {
                    // ¡Disparo! El rayo sale de la boca del cañón y cruza el vacío hasta la Tierra.
                    c.anim(get(c, "satD"), "disparo");
                    c.tint(0x38ffffff, 0, 1, 5);
                    c.shake(1.2, 14, 0.88);
                    c.sound(sat, "orbital.disparo", 4f, 0.6f);
                    c.sound(sat, "orbital.rayo", 3f, 0.9f);
                    c.anim(get(c, "core"), "disparo");
                    float w = (float) (c.cfg("anchoLaser", 6.0) * 0.45);
                    float lift = 160;
                    ItemDisplay sb = c.actor(fx.itemDisplay(muzzle.clone().add(0, -lift, 0), new ItemStack(Material.AIR), 1f, 0));
                    sb.setDisplayWidth(400f);
                    sb.setDisplayHeight(400f);
                    sb.setViewRange(16f);
                    c.model(sb, "fx_laser", "tierra_fino", 1f);
                    setAxis(sb, muzzle, muzzle.clone().add(dir.clone().multiply(1)), w, w, 0, lift);

                    c.data.put("spaceBeam", sb);
                }
                if (t == 154) {
                    // El rayo se alarga desde la boca del cañón hasta la Tierra (el efecto lo corta en la superficie).
                    float w = (float) (c.cfg("anchoLaser", 6.0) * 0.45);
                    setAxis(get(c, "spaceBeam"), muzzle, muzzle.clone().add(dir.clone().multiply(260)), w, w, 8, 160);
                }
                if (t == 158) c.anim(get(c, "spaceBeam"), "tierra_ancho");
                if (t == 160) c.anim(get(c, "satD"), "cargado");
                if (t == 186) {
                    // Bajada: del espacio a la vista del objetivo siguiendo el rayo (hiperespacio corto).
                    c.screenFx(CineNet.WARP, 0xffff2030, 2, 10, 3);
                    c.skyReset();
                    remove((Entity) get(c, "esp"), (Entity) get(c, "satD"), (Entity) get(c, "core"), (Entity) get(c, "spaceBeam"));
                    Location sky = get(c, "skyDir");
                    ItemDisplay laser = axis(c, g, sky, "fx_laser", (float) c.cfg("anchoLaser", 6.0), null, "fino");
                    c.data.put("laser", laser);
                    if (plain) c.data.put("beamB", c.actor(fx.beam(g, g.clone().add(0, 60, 0), 0.25f, Material.RED_CONCRETE, 0xff2030, 0)));
                    CineNet.Shot s = c.shot();
                    Location top = g.clone().subtract(dir.clone().multiply(110)).add(side.clone().multiply(14));
                    Location low = g.clone().add(side.clone().multiply(26)).add(0, 14, 0);
                    s.key(0, top, g, 90, CUT);
                    s.key(11, low, g, 76, EASE_IN_EXPO);
                    // 197–: a ras de suelo, el rayo fino toca tierra y se ensancha.
                    Location ground = g.clone().add(side.clone().multiply(30)).add(0, 2.5, 0);
                    s.key(12, ground, g.clone().add(0, 9, 0), 72, CUT);
                    c.cam(s);
                }
                if (t == 197) remove((Entity) get(c, "marca"));
                if (t == 200) impact(c, g, side);
                if (t > 200 && t < 236 && t % 5 == 0) c.shake(0.9, 6, 0.95);
                if (t == 240) c.anim(get(c, "laser"), "fin");
                if (t == 246) c.anim(get(c, "domo"), "fin");
                if (t == 254) {
                    // Final: el objetivo en el fondo del cráter (cámara desde el borde, mirando abajo).
                    CineNet.Shot s = c.shot().followLook(c.target.getEntityId());
                    Location rim = g.clone().add(side.clone().multiply(c.cfgI("radioCrater", 22) + 6)).add(0, 10, 0);
                    s.key(0, rim, rim, 70, CUT);
                    s.key(30, rim.clone().add(0, 3, 0), rim, 72, LINEAR);
                    c.cam(s);
                }
                if (t == 280) remove((Entity) get(c, "laser"), (Entity) get(c, "domo"), (Entity) get(c, "beamB"));
                if (t >= 296) e.finish(c, false);
            }

            void impact(CineEngine.Ctx c, Location g, Vector side) {
                c.anim(get(c, "laser"), "ancho");
                if (get(c, "beamB") != null) FxBeam.widen(get(c, "beamB"), g, 3f);
                c.flash(0xfff0e0, 0, 2, 8);
                c.shake(2.6, 50, 0.95);
                c.sound(g, "orbital.impacto", 4f, 0.55f);
                // Cúpula de energía que crece (translúcida, sin tapar la vista) y el cráter que se abre desde el centro.
                ItemDisplay domo = k.vfx(c, g.clone().add(0, 1, 0), "fx_domo", 2f, "b0ff1a20");
                size(domo, (float) (c.cfgI("radioCrater", 22) * 0.95), 22);
                c.data.put("domo", domo);
                k.once(c, g.clone().add(0, 0.3, 0), CineCharacters.FX_ONDA, (float) (c.cfgI("radioCrater", 22) * 1.6), "ffff4050", 30);
                int r = c.cfgI("radioCrater", 22), depth = c.cfgI("profundidadCrater", 16);
                world.boost(c.cfgI("bloquesPorTick", 1500), 120);
                world.bowlCrater(g.clone().add(0, -1, 0), r, depth, false, 0.04, 0.06, 0.03, c.rnd);
                c.finalHit(c.target, c.cfg("danio", 60.0));
                world.areaDamage(g, c.cfg("radioDanio", 26.0), c.cfg("danio", 60.0) * 0.7, c.launcher, c.target.getUniqueId());
                CineWorld.radial(g, c.cfg("radioDanio", 26.0), 1.6, 1.2, c.launcher, c.target.getUniqueId());
                c.target.removePotionEffect(PotionEffectType.SLOWNESS);
                c.target.setVelocity(new Vector(0, c.cfg("impulso", 1.6), 0));
                if (!CineNet.hasMod(c.target)) CineFx.part(c.w, Particle.EXPLOSION_EMITTER, g, 6, 4, 0);
                for (int i = 0; i < 50; i++) {
                    double a = c.rnd.nextDouble() * Math.PI * 2;
                    Block b = c.ground(g.clone().add(Math.cos(a) * 5, 3, Math.sin(a) * 5)).add(0, -1, 0).getBlock();
                    Material m = b.getType().isSolid() ? b.getType() : Material.DIRT;
                    Vector v = new Vector(Math.cos(a) * (0.6 + c.rnd.nextDouble()), 1.0 + c.rnd.nextDouble() * 1.2, Math.sin(a) * (0.6 + c.rnd.nextDouble()));
                    world.flyVisual(g.clone().add(0, 1, 0), m.createBlockData(), CineWorld.Path.LAUNCH, null, v, 50, 0);
                }
                // Plano: de lado y lejos, con la explosión creciendo y el objetivo por los aires.
                CineNet.Shot s = c.shot();
                Location wide = g.clone().add(side.clone().multiply(54)).add(0, 14, 0);
                s.key(0, wide, g.clone().add(0, 8, 0), 76, CUT);
                s.key(52, wide.clone().add(side.clone().multiply(6)).add(0, 4, 0), g.clone().add(0, 6, 0), 78, LINEAR);
                c.cam(s);
            }
        });
    }

    /** Respaldo sin mod: ensancha el rayo de bloques. */
    private static final class FxBeam {
        static void widen(Object o, Location g, float radius) {
            if (o instanceof org.bukkit.entity.BlockDisplay d && d.isValid()) CineFx.beamRadius(d, g, g.clone().add(0, 60, 0), radius, 6);
        }
    }

    @SuppressWarnings("unused")
    private static double clamp(double v) {
        return Math.max(0, Math.min(1, v));
    }

    @SuppressWarnings("unused")
    private static double eased(double f) {
        return ease(f);
    }
}
