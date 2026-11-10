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
        if (d == null || !d.isValid()) return;
        Vector v = to.toVector().subtract(from.toVector());
        float len = (float) v.length();
        Quaternionf q = new Quaternionf().rotationTo(new Vector3f(0, 0, 1), new Vector3f((float) v.getX(), (float) v.getY(), (float) v.getZ()).normalize());
        d.setInterpolationDelay(0);
        d.setInterpolationDuration(ticks);
        d.setTransformation(new Transformation(new Vector3f(), q, new Vector3f(width, width, Math.max(0.01f, len)), new Quaternionf()));
    }

    /** Daño que atraviesa la armadura en una fracción `pierce` (esa parte es de tipo mágico). */
    private void piercing(CineEngine.Ctx c, LivingEntity le, double amount, double pierce) {
        if (le == c.target && e.plugin.getConfig().getBoolean("cinematicas.golpe-letal-final", true)) {
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
        e.register(new CineEngine.Ability("sangre_perforante", "SANGRE PERFORANTE", "#c0101c", 260, 260,
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
                // 41–79: primer plano de las manos (3/4 frontal de Choso).
                Vector face = forward(yaw);
                Location hands = hands(at, yaw, 0.7);
                s.key(41, at.clone().add(face.clone().multiply(2.6)).add(lat.clone().multiply(1.3)).add(0, 1.55, 0), hands, 52, CUT);
                s.key(79, at.clone().add(face.clone().multiply(2.1)).add(lat.clone().multiply(1.0)).add(0, 1.5, 0), hands, 46, EASE_IN_OUT);
                // 80–103: vuelta al panel lateral, más cerrado, mientras comprime la sangre.
                s.key(80, m.clone().add(lat.clone().multiply(sep * 0.7 + 2)).add(0, 1.2, 0), m.clone().add(0, 1.25, 0), 50, CUT);
                s.key(103, m.clone().add(lat.clone().multiply(sep * 0.62 + 1.8)).add(0, 1.2, 0), m.clone().add(0, 1.25, 0), 48, LINEAR);
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
                if (t == 24) c.data.put("aura", k.vfx(c, at, CineCharacters.FX_AURA, 2.3f, "ffb0101c"));
                if (t == 32) {
                    c.anim(ch, "juntar_manos");
                    c.sky(CineNet.SKY_TINT, 0x2a0006, 220);
                    c.vignette(0xa0200006, 10, 150, 20);
                }
                if (t == 40) c.say("choso_tecnica", "Técnica de manipulación de sangre…", 0xff5a64, 58);
                if (t == 44) {
                    // Esfera de sangre entre las manos (pegada al hueso «manos»).
                    ItemDisplay sphere = k.vfx(c, hands(at, yaw, 0.7), "fx_sangre", 0.01f, null);
                    c.attach(sphere, ch, "manos", 0, 0, 0);
                    size(sphere, 0.45f, 30);
                    c.data.put("sphere", sphere);
                    c.sound(at, "choso.carga", 1.6f, 0.8f);
                }
                if (t == 52) c.anim(ch, "cargar");
                if (plain && t > 44 && t < 104 && t % 2 == 0)
                    CineFx.part(c.w, Particle.DUST, hands(at, yaw, 0.7), 6, 0.25, 0.25, 0.25, 0, CineFx.dust(0x8a0010, 1.2f));
                if (t >= 80 && t < 100 && t % 4 == 0) {
                    // Compresión: la esfera se encoge a pulsos y tiembla todo.
                    float r = (float) (0.45 - 0.23 * (t - 80) / 20.0);
                    size(get(c, "sphere"), r + (t % 8 == 0 ? 0.05f : -0.03f), 4);
                    c.shake(0.2 + (t - 80) / 20.0 * 0.4, 5, 0.9);
                    if (t % 8 == 0) c.sound(at, "choso.compresion", 1.2f, 0.9f + (t - 80) / 30f);
                }
                if (t == 98) c.say("choso_perforante", "¡Sangre Perforante!", 0xff2a3a, 44);
                if (t == 100) {
                    c.anim(ch, "perforar");
                    c.screenFx(CineNet.SPEEDLINES, 0xff000000, 0, 14, 6);
                    c.tint(0x908a0010, 0, 2, 6);
                    c.shake(0.8, 8, 0.85);
                }
                if (t == 103) fire(c, at, yaw);
                Integer fired = get(c, "fired");
                Integer imp = get(c, "imp");
                if (fired != null && imp == null) advance(c, t);
                imp = get(c, "imp");
                if (imp != null) {
                    int since = t - imp;
                    if (since == 34) {
                        c.anim(ch, "pose_final");
                        Vector face = forward(yaw);
                        CineNet.Shot s = c.shot();
                        s.key(0, at.clone().add(face.clone().multiply(3.1)).add(0, 1.55, 0), at.clone().add(0, 1.4, 0), 56, CUT);
                        s.key(50, at.clone().add(face.clone().multiply(2.6)).add(0, 1.65, 0), at.clone().add(0, 1.5, 0), 52, LINEAR);
                        c.cam(s);
                    }
                    if (since == 58) k.vanish(c, CHOSO, ch, 0xc0101c, 28, (Entity) get(c, "aura"));
                    if (since == 70) c.skyReset();
                    if (since >= 92) e.finish(c, false);
                }
            }

            /** Disparo: el haz sale de las manos hacia el objetivo y sigue hasta `distanciaDestruccion` bloques detrás. */
            void fire(CineEngine.Ctx c, Location at, float yaw) {
                remove((Entity) get(c, "sphere"));
                Location from = hands(at, yaw, 0.85).add(0, 0.04, 0);
                Location aim = c.target.getLocation().add(0, 1.15, 0);
                Vector dir = aim.toVector().subtract(from.toVector());
                if (dir.lengthSquared() < 1e-4) dir = forward(yaw);
                dir.normalize();
                double len = from.distance(aim) + c.cfg("distanciaDestruccion", 28.0);
                Location to = from.clone().add(dir.clone().multiply(len));
                ItemDisplay beam = axis(c, from, to, "fx_perforante", (float) c.cfg("grosor", 0.22), null, "disparar");
                c.data.put("beam", beam);
                c.data.put("from", from);
                c.data.put("dir", dir);
                c.data.put("len", len);
                c.data.put("prog", 0.0);
                c.data.put("fired", c.t);
                c.data.put("hitSet", new LinkedHashSet<Entity>());
                c.sound(from, "choso.disparo", 2.5f, 1.7f);
                c.target.removePotionEffect(PotionEffectType.SLOWNESS);
                // Plano de manga: el haz cruza el encuadre lateral.
                Location m = mid(at, c.feet(), 0.5);
                Vector lat = lateral(at, c.feet());
                CineNet.Shot s = c.shot();
                s.key(0, m.clone().add(lat.clone().multiply(at.distance(c.feet()) * 0.75 + 2.5)).add(0, 1.3, 0), m.clone().add(0, 1.2, 0), 58, CUT);
                s.key(12, m.clone().add(lat.clone().multiply(at.distance(c.feet()) * 0.72 + 2.4)).add(0, 1.3, 0), m.clone().add(dir.clone().multiply(1.5)).add(0, 1.2, 0), 60, LINEAR);
                c.cam(s);
            }

            /** Avanza el proyectil 4,5 bloques/tick con un barrido de segmento: no puede atravesar sin impactar. */
            void advance(CineEngine.Ctx c, int t) {
                Location from = get(c, "from");
                Vector dir = get(c, "dir");
                double len = (double) c.data.get("len");
                double p0 = (double) c.data.get("prog"), p1 = Math.min(len, p0 + 4.5);
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
                piercing(c, c.target, c.cfg("danio", 30.0), c.cfg("perforacion", 0.6));
                int lvl = Math.max(1, c.cfgI("witherNivel", 2));
                c.target.addPotionEffect(new PotionEffect(PotionEffectType.WITHER, c.cfgI("witherSegundos", 4) * 20, lvl - 1, false, true));
                double push = c.cfg("empuje", 2.8);
                c.target.setVelocity(dir.clone().setY(0).normalize().multiply(push).setY(0.45));
                c.target.setFallDistance(0);
                k.once(c, p, CineCharacters.FX_GOLPE, 1.8f, "ffd0101c", 16);
                k.once(c, p, CineCharacters.FX_ONDA, 7, "ffff2030", 26);
                CineFx.part(c.w, Particle.DUST, p, 50, 0.6, 0.6, 0.6, 0, CineFx.dust(0x8a0010, 1.8f));
                CineFx.part(c.w, Particle.DAMAGE_INDICATOR, p, 12, 0.4, 0.4, 0.4, 0.2, null);
                c.tint(0xa0ff2030, 0, 2, 8);
                c.shake(1.7, 18, 0.88);
                c.screenFx(CineNet.SPEEDLINES, 0xffffffff, 0, 8, 6);
                c.sound(p, "choso.impacto", 2.5f, 0.9f);
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
        });
    }

    /* ======================================== ATAQUE ORBITAL ======================================== */

    private void ataqueOrbital() {
        e.register(new CineEngine.Ability("ataque_orbital", "ATAQUE ORBITAL", "#ff1a2a", 300, 300,
                "Un rayo rojo fija al objetivo; la cámara sube al espacio, un satélite cañón carga y dispara un láser colosal que abre un cráter enorme") {
            void start(CineEngine.Ctx c) {
                Location g = c.ground(c.feet().add(0, 1, 0));
                c.data.put("g", g);
                // Satélite: a `altura` bloques sobre el objetivo, desplazado y apuntando con el cañón hacia él.
                double alt = c.cfg("altura", 180.0), el = Math.toRadians(c.cfg("inclinacion", 72.0));
                Vector hz = forward(c.yaw0 + 90f);
                double D = alt / Math.sin(el);
                Vector dir = hz.clone().multiply(Math.cos(el)).add(new Vector(0, -Math.sin(el), 0)).normalize();
                Location sat = g.clone().subtract(dir.clone().multiply(D));
                float scale = (float) c.cfg("escalaSatelite", 4.0);
                Location muzzle = sat.clone().add(dir.clone().multiply(8.75 * scale));
                c.data.put("sat", sat);
                c.data.put("dir", dir);
                c.data.put("muzzle", muzzle);
                c.data.put("scale", scale);
                ItemDisplay marca = k.vfx(c, g.clone().add(0, 0.05, 0), "fx_marca", 1.2f, "ffff2030");
                marca.setDisplayHeight(400f);
                c.data.put("marca", marca);
                c.target.addPotionEffect(new PotionEffect(PotionEffectType.SLOWNESS, 200, 9, false, false));
                c.sound(g, "orbital.fijado", 2f, 1.2f);
                c.screenFx(CineNet.TARGET_HUD, 0xffff2a3a, 4, 44, 4);
                // 0–49: vista cenital que se cierra sobre el objetivo marcado.
                CineNet.Shot s = c.shot();
                Vector side = dir.clone().crossProduct(new Vector(0, 1, 0)).normalize();
                // Un poco ladeada para no mirar el rayo de frente (deslumbra).
                s.key(0, g.clone().add(side.clone().multiply(14)).add(0, 40, 0), g, 62, LINEAR);
                s.key(49, g.clone().add(side.clone().multiply(10)).add(0, 28, 0), g, 46, EASE_IN_OUT);
                // 50–71: subida vertiginosa hacia el espacio.
                s.key(50, g.clone().add(side.clone().multiply(10)).add(0, 28, 0), g, 50, LINEAR);
                Location space0 = sat.clone().add(side.clone().multiply(70)).add(dir.clone().multiply(10)).add(0, 26, 0);
                s.key(71, space0.clone().add(0, -40, 0), sat, 90, EASE_IN_EXPO);
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                Location g = get(c, "g");
                Location sat = get(c, "sat");
                Location muzzle = get(c, "muzzle");
                Vector dir = get(c, "dir");
                float scale = (float) c.data.get("scale");
                boolean plain = !CineNet.hasMod(c.target);
                Vector side = dir.clone().crossProduct(new Vector(0, 1, 0)).normalize();
                Vector upv = side.clone().crossProduct(dir).normalize();
                if (t < 190) c.target.setVelocity(new Vector(0, Math.min(0, c.target.getVelocity().getY()), 0));
                if (t < 50 && t % 10 == 0) c.sound(g, "orbital.alarma", 1.5f, 1.4f + (t / 10) * 0.08f);
                if (plain && t < 190 && t % 3 == 0) CineFx.line(c.w, g.clone().add(0, 40, 0), g, 1.0, 0xff2030, 1.2f);
                if (t == 50) {
                    c.sound(g, "orbital.subida", 2f, 0.8f);
                    c.screenFx(CineNet.WARP, 0xffff3040, 4, 14, 4);
                }
                if (t == 60) {
                    c.sky(CineNet.SKY_SPACE, 0, 120);
                    // Satélite y fondo del espacio (solo los ve quien tiene el mod; están a mucha altura).
                    // La caja de dibujo de un display solo crece hacia arriba: la entidad va 70 bloques más abajo y el
                    // modelo sube con una traslación, así la caja cubre también la boca del cañón (que apunta abajo).
                    ItemDisplay st = c.actor(fx.itemDisplay(sat.clone().add(0, -70, 0), new ItemStack(Material.AIR), 1f, 0));
                    st.setDisplayWidth(140f);
                    st.setDisplayHeight(140f);
                    st.setViewRange(16f);
                    c.model(st, SATELITE, "idle", scale);
                    Quaternionf q = new Quaternionf().rotationTo(new Vector3f(0, 0, 1), new Vector3f((float) dir.getX(), (float) dir.getY(), (float) dir.getZ()));
                    st.setTransformation(new Transformation(new Vector3f(0, 70, 0), q, new Vector3f(1, 1, 1), new Quaternionf()));
                    c.data.put("satD", st);
                    ItemDisplay esp = c.actor(fx.itemDisplay(sat.clone().add(0, -200, 0), new ItemStack(Material.AIR), 1f, 0));
                    esp.setDisplayWidth(400f);
                    esp.setDisplayHeight(400f);
                    esp.setViewRange(16f);
                    c.model(esp, "fx_espacio", "idle", 1f);
                    esp.setTransformation(new Transformation(new Vector3f(0, 200, 0), new Quaternionf(), new Vector3f(1, 1, 1), new Quaternionf()));
                    c.data.put("esp", esp);
                }
                if (t == 72) {
                    c.caption("SATÉLITE ORBITAL LA-1", "Cañón de partículas · órbita baja · objetivo: " + c.target.getName(), 0xff4050, 64);
                    // 72–99: plano general del satélite con el planeta debajo; travelling a lo largo del casco.
                    CineNet.Shot s = c.shot();
                    Location look0 = sat.clone().add(dir.clone().multiply(-10 * scale / 4));
                    s.key(0, sat.clone().add(side.clone().multiply(62)).add(upv.clone().multiply(14)).add(dir.clone().multiply(-30)), look0, 66, CUT);
                    s.key(28, sat.clone().add(side.clone().multiply(48)).add(upv.clone().multiply(10)).add(dir.clone().multiply(8)), sat, 62, LINEAR);
                    // 100–129: primer plano de la boca del cañón y sus aros.
                    s.key(29, muzzle.clone().add(side.clone().multiply(22)).add(upv.clone().multiply(5)).add(dir.clone().multiply(-12)), muzzle, 58, CUT);
                    s.key(57, muzzle.clone().add(side.clone().multiply(17)).add(upv.clone().multiply(4)).add(dir.clone().multiply(-4)), muzzle, 54, EASE_IN_OUT);
                    // 130–147: desde detrás del satélite, mirando por el cañón hacia el planeta.
                    Location rear = sat.clone().add(dir.clone().multiply(-11 * scale)).add(upv.clone().multiply(3.5 * scale)).add(side.clone().multiply(1.2 * scale));
                    s.key(58, rear, muzzle.clone().add(dir.clone().multiply(40)), 70, CUT);
                    s.key(75, rear.clone().add(dir.clone().multiply(2 * scale)), muzzle.clone().add(dir.clone().multiply(40)), 64, LINEAR);
                    // 148–159: disparo visto de lado.
                    s.key(76, sat.clone().add(side.clone().multiply(70)).add(upv.clone().multiply(-6)).add(dir.clone().multiply(30)), muzzle.clone().add(dir.clone().multiply(25)), 72, CUT);
                    s.key(87, sat.clone().add(side.clone().multiply(74)).add(upv.clone().multiply(-6)).add(dir.clone().multiply(32)), muzzle.clone().add(dir.clone().multiply(30)), 74, LINEAR);
                    c.cam(s);
                }
                if (t == 100) {
                    c.anim(get(c, "satD"), "activar");
                    c.sound(sat, "orbital.activar", 3f, 0.7f);
                    ItemDisplay core = k.vfx(c, muzzle.clone().add(dir.clone().multiply(-2)), "fx_nucleo", 0.2f, null);
                    size(core, 2.6f * scale / 4, 40);
                    c.data.put("core", core);
                }
                if (t == 120) c.anim(get(c, "satD"), "cargado");
                if (t > 100 && t < 148 && t % 12 == 4) {
                    c.sound(sat, "orbital.carga", 2f, 0.6f + (t - 100) / 60f);
                    c.shake(0.15 + (t - 100) / 48.0 * 0.5, 10, 0.95);
                }
                if (t == 148) {
                    c.anim(get(c, "satD"), "disparo");
                    c.flash(0xffffff, 0, 3, 10);
                    c.shake(1.4, 14, 0.88);
                    c.sound(sat, "orbital.disparo", 4f, 0.6f);
                    size(get(c, "core"), 0.8f * scale / 4, 4);
                    // El láser vive en el suelo (punto de impacto) y apunta hacia la boca del cañón.
                    ItemDisplay laser = axis(c, g, muzzle, "fx_laser", (float) c.cfg("anchoLaser", 6.0), null, "fino");
                    c.data.put("laser", laser);
                    if (plain) c.data.put("beamB", c.actor(fx.beam(g, g.clone().add(0, 60, 0), 0.25f, Material.RED_CONCRETE, 0xff2030, 0)));
                }
                if (t == 156) c.anim(get(c, "satD"), "cargado");
                if (t == 160) {
                    // 160–175: descenso vertiginoso junto al rayo (hiperespacio).
                    c.screenFx(CineNet.WARP, 0xffff2030, 2, 12, 3);
                    CineNet.Shot s = c.shot();
                    Location top = muzzle.clone().add(dir.clone().multiply(20)).add(side.clone().multiply(10));
                    Location low = g.clone().add(side.clone().multiply(12)).add(0, 40, 0);
                    s.key(0, top, g, 80, CUT);
                    s.key(15, low, g, 100, EASE_IN_EXPO);
                    c.cam(s);
                }
                if (t == 170) {
                    c.skyReset();
                    remove((Entity) get(c, "esp"));
                }
                if (t == 172) c.screenFx(CineNet.SPLASH, 0xff9a0010, 0, 10, 0);
                if (t == 180) {
                    // En el suelo: el rayo finísimo toca tierra (cielo teñido de rojo).
                    remove((Entity) get(c, "marca"), (Entity) get(c, "satD"), (Entity) get(c, "core"));
                    c.sky(CineNet.SKY_TINT, 0x5a0008, 160);
                    c.tint(0x40ff0010, 4, 60, 30);
                    Vector away = side.clone();
                    CineNet.Shot s = c.shot();
                    Location low = g.clone().add(away.clone().multiply(22)).add(0, 1.2, 0);
                    s.key(0, low, g.clone().add(0, 20, 0), 74, CUT);
                    s.key(14, low.clone().add(away.clone().multiply(2)), g.clone().add(0, 16, 0), 70, LINEAR);
                    c.cam(s);
                }
                if (t == 194) impact(c, g, side);
                if (t > 194 && t < 230 && t % 5 == 0) c.shake(0.9, 6, 0.95);
                if (t == 236) c.anim(get(c, "laser"), "fin");
                if (t == 244) c.anim(get(c, "domo"), "fin");
                if (t == 250) {
                    c.skyReset();
                    // Final: el objetivo cae al fondo del cráter (cámara desde el borde, mirando abajo).
                    CineNet.Shot s = c.shot().followLook(c.target.getEntityId());
                    Location rim = g.clone().add(side.clone().multiply(c.cfgI("radioCrater", 22) + 6)).add(0, 10, 0);
                    s.key(0, rim, rim, 70, CUT);
                    s.key(30, rim.clone().add(0, 3, 0), rim, 72, LINEAR);
                    c.cam(s);
                }
                if (t == 270) remove((Entity) get(c, "laser"), (Entity) get(c, "domo"), (Entity) get(c, "beamB"));
                if (t >= 280) e.finish(c, false);
            }

            void impact(CineEngine.Ctx c, Location g, Vector side) {
                c.anim(get(c, "laser"), "ancho");
                if (get(c, "beamB") != null) FxBeam.widen(get(c, "beamB"), g, 3f);
                c.flash(0xffd0d0, 0, 2, 10);
                c.shake(2.8, 50, 0.95);
                c.sound(g, "orbital.impacto", 4f, 0.55f);
                c.tint(0x48ff0010, 2, 30, 30);
                // Cúpula roja que crece y el cráter que se abre desde el centro.
                ItemDisplay domo = k.vfx(c, g.clone().add(0, 1, 0), "fx_domo", 2f, null);
                size(domo, (float) (c.cfgI("radioCrater", 22) * 1.5), 24);
                c.data.put("domo", domo);
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
                // Plano: de lado y lejos, con la cúpula roja creciendo y el objetivo por los aires.
                CineNet.Shot s = c.shot();
                Location wide = g.clone().add(side.clone().multiply(52)).add(0, 12, 0);
                s.key(0, wide, g.clone().add(0, 10, 0), 76, CUT);
                s.key(55, wide.clone().add(side.clone().multiply(6)).add(0, 4, 0), g.clone().add(0, 6, 0), 78, LINEAR);
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
