package dev.livearena.plugin;

import java.util.ArrayList;
import java.util.List;
import org.bukkit.Color;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.Tag;
import org.bukkit.block.Block;
import org.bukkit.entity.ArmorStand;
import org.bukkit.entity.BlockDisplay;
import org.bukkit.entity.Entity;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.LeatherArmorMeta;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;
import org.bukkit.util.EulerAngle;
import org.bukkit.util.Transformation;
import org.bukkit.util.Vector;
import org.joml.Quaternionf;
import org.joml.Vector3f;

import static dev.livearena.plugin.CineNet.CUT;
import static dev.livearena.plugin.CineNet.EASE_IN_OUT;
import static dev.livearena.plugin.CineNet.EASE_OUT_EXPO;
import static dev.livearena.plugin.CineNet.LINEAR;

/**
 * Habilidades con personaje (fichas del kit de personajes): genkidama, mil_cortes (santuario), vacio_purpura y akaza.
 * Los personajes son modelos GeckoLib (con el mod); sin el mod se ve un soporte de armadura en su lugar.
 * Todo nombre de modelo, hueso y animación está en las constantes de abajo: cambiar de modelo no obliga a tocar
 * las líneas de tiempo (el mod traduce además «animation.<modelo>.<nombre>» de Blockbench al nombre corto).
 */
final class CineCharacters {
    /* ------------------------------ contrato de modelos (nombres exactos) ------------------------------ */
    static final String GOKU = "goku", SUKUNA = "sukuna", SANTUARIO = "santuario", GOJO = "gojo", AKAZA = "akaza";
    static final String ESFERA = "esfera", COPO = "copo";
    static final String B_MANOS = "manos", B_MANO_IZQ = "mano_izquierda", B_MANO_DER = "mano_derecha", B_MANO_PROY = "mano_proyectil";
    static final String A_APARICION = "aparicion", A_ALZAR = "alzar_brazos", A_LANZAR = "lanzar", A_POSE_FINAL = "pose_final";
    static final String A_SELLO = "sello_mano", A_IDLE_DOMINIO = "idle_dominio", A_CORTE_FINAL = "corte_final", A_DESAPARICION = "desaparicion";
    static final String A_EMERGER = "emerger", A_HUNDIRSE = "hundirse";
    static final String A_CARGA = "carga", A_DISPARO = "disparo";
    static final String A_DESPLIEGUE = "despliegue_tecnica", A_GOLPE_SUELO = "golpe_suelo";
    /** Altura del modelo en bloques a escala 1 (los personajes miden 2 bloques; el santuario ≈ 5). */
    static final float ALTO_PERSONAJE = 2.0f, ALTO_SANTUARIO = 5.0f;
    /** Posición de los huesos de anclaje en reposo (bloques, escala 1; el modelo mira hacia delante). */
    static final double MANOS_ALTO = 2.5, PROY_ALTO = 17 / 16.0, PROY_DELANTE = 6 / 16.0;

    private final CineEngine e;
    private final CineFx fx;
    private final CineWorld world;

    CineCharacters(CineEngine engine) {
        this.e = engine;
        this.fx = engine.fx;
        this.world = engine.world;
    }

    void register() {
        genkidama();
        milCortes();
        vacioPurpura();
        akaza();
    }

    /* ======================================== utilidades ======================================== */

    @SuppressWarnings("unchecked")
    private static <T> T get(CineEngine.Ctx c, String k) {
        return (T) c.data.get(k);
    }

    private static Vector forward(float yaw) {
        double a = Math.toRadians(yaw);
        return new Vector(-Math.sin(a), 0, Math.cos(a));
    }

    private static float yawTo(Location from, Location to) {
        Vector d = to.toVector().subtract(from.toVector()).setY(0);
        if (d.lengthSquared() < 1e-6) return from.getYaw();
        return from.clone().setDirection(d).getYaw();
    }

    private static Location mid(Location a, Location b, double f) {
        return a.clone().add(b.toVector().subtract(a.toVector()).multiply(f));
    }

    /** Personaje: display con el modelo (mira en `yaw`) + soporte de armadura para quien no tiene el mod. */
    private ItemDisplay character(CineEngine.Ctx c, Location at, float yaw, String model, String anim, float scale, int color) {
        Location l = at.clone();
        l.setYaw(yaw);
        l.setPitch(0);
        ArmorStand stand = c.actor(c.w.spawn(l, ArmorStand.class, a -> {
            a.setArms(true);
            a.setBasePlate(false);
            a.setGravity(false);
            a.setInvulnerable(true);
            a.setCollidable(false);
            a.setPersistent(false);
            a.setRotation(yaw, 0);
            ItemStack chest = new ItemStack(Material.LEATHER_CHESTPLATE);
            if (chest.getItemMeta() instanceof LeatherArmorMeta m) {
                m.setColor(Color.fromRGB(color));
                chest.setItemMeta(m);
            }
            a.getEquipment().setChestplate(chest);
            a.addScoreboardTag(CineFx.TAG);
        }));
        ItemDisplay d = c.actor(fx.itemDisplay(l, new ItemStack(Material.AIR), 1f, 0));
        d.setRotation(yaw, 0);
        d.setTeleportDuration(2);
        // Caja de dibujo amplia para que no desaparezca por el recorte de vista.
        d.setDisplayWidth(4f * scale);
        d.setDisplayHeight(4f * scale);
        c.model(d, model, anim, scale, stand);
        c.data.put("stand_" + model, stand);
        return d;
    }

    /** Esfera de energía (modelo «esfera» teñido) de radio r en bloques. */
    private ItemDisplay energy(CineEngine.Ctx c, Location at, float r, String argb) {
        ItemDisplay d = c.actor(fx.itemDisplay(at, new ItemStack(Material.AIR), 1f, 0));
        d.setTeleportDuration(1);
        c.model(d, ESFERA, "idle", 1f);
        c.anim(d, "color:" + argb);
        size(d, r, 0);
        return d;
    }

    private static void size(ItemDisplay d, float r, int ticks) {
        if (d == null || !d.isValid()) return;
        d.setInterpolationDelay(0);
        d.setInterpolationDuration(ticks);
        d.setTransformation(new Transformation(new Vector3f(), new Quaternionf(), new Vector3f(r, r, r), new Quaternionf()));
    }

    private static void remove(Entity... es) {
        for (Entity en : es) if (en != null && en.isValid()) en.remove();
    }

    /* ========================================= GENKIDAMA ========================================= */

    private void genkidama() {
        e.register(new CineEngine.Ability("genkidama", "GENKIDAMA", "#8fd3ff", 340, 340, "Un guerrero alza los brazos y la energía de todo lo cercano forma una esfera gigante que lanza contra el objetivo") {
            void start(CineEngine.Ctx c) {
                Location at;
                if (c.launcher != null) {
                    Vector right = forward(c.launcher.getLocation().getYaw()).crossProduct(new Vector(0, 1, 0)).normalize().multiply(-2);
                    at = c.ground(c.launcher.getLocation().add(right).add(0, 2, 0));
                } else at = c.ground(c.feet().add(forward(c.yaw0).multiply(c.cfg("distanciaGokuSinLanzador", 30.0))).add(0, 6, 0));
                float yaw = yawTo(at, c.feet());
                ItemDisplay goku = character(c, at, yaw, GOKU, A_APARICION, ALTO_PERSONAJE / 2f, 0x2a6eaa);
                c.data.put("goku", goku);
                c.data.put("base", at);
                c.data.put("yaw", yaw);
                c.sound(at, "genkidama.aparicion", 2f, 0.9f);
                // Fuentes de energía: árboles, hojas y agua cercanos (con la semilla de la ejecución).
                List<Location> src = new ArrayList<>();
                for (int i = 0; i < 120 && src.size() < 14; i++) {
                    Block b = c.w.getHighestBlockAt(at.getBlockX() + c.rnd.nextInt(57) - 28, at.getBlockZ() + c.rnd.nextInt(57) - 28);
                    Material m = b.getType();
                    if (Tag.LEAVES.isTagged(m) || Tag.LOGS.isTagged(m) || m == Material.WATER || m == Material.GRASS_BLOCK) src.add(b.getLocation().add(0.5, 1, 0.5));
                }
                c.data.put("src", src);
                Location center = at.clone().add(0, MANOS_ALTO + 0.8, 0);
                c.data.put("center", center);
                c.data.put("r", 0.5);
                CineFx.Orb o = fx.orb(center, 0.01f, Material.LIGHT_BLUE_CONCRETE, Material.LIGHT_BLUE_STAINED_GLASS, 0x8fd3ff, 0);
                for (BlockDisplay d : o.parts) c.actor(d);
                c.data.put("orb", o);
                ItemDisplay sphere = energy(c, center, 0.01f, "ff8fd3ff");
                for (Player p : c.w.getPlayers()) if (CineNet.hasMod(p)) for (BlockDisplay d : o.parts) p.hideEntity(e.plugin, d);
                c.data.put("sphere", sphere);
                // 0–40: plano medio frontal del guerrero apareciendo y alzando los brazos.
                Vector face = forward(yaw);
                CineNet.Shot s = c.shot();
                s.key(0, at.clone().add(face.clone().multiply(5)).add(0, 1.4, 0), at.clone().add(0, 1.4, 0), 60, LINEAR);
                s.key(39, at.clone().add(face.clone().multiply(4.2)).add(0, 1.6, 0), at.clone().add(0, 2.2, 0), 62, LINEAR);
                // 40–200: contrapicado desde el suelo que se aleja según crece la esfera (siempre cabe entera).
                double rmax = c.cfg("radioMax", 12.0);
                Vector side = face.clone().crossProduct(new Vector(0, 1, 0)).normalize();
                for (int k = 0; k <= 8; k++) {
                    int tk = 40 + k * 20;
                    double r = 0.5 + (rmax - 0.5) * (1 - Math.pow(1 - k / 8.0, 2));
                    double dist = 8 + r * 2.4;
                    Location cpos = at.clone().add(face.clone().multiply(dist * 0.8)).add(side.clone().multiply(dist * 0.6)).add(0, 0.4, 0);
                    s.key(tk, cpos, at.clone().add(0, MANOS_ALTO + r * 0.9, 0), 74, k == 0 ? CUT : LINEAR);
                }
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                Location base = get(c, "base");
                ItemDisplay goku = get(c, "goku");
                ItemDisplay sphere = get(c, "sphere");
                CineFx.Orb o = get(c, "orb");
                double rmax = c.cfg("radioMax", 12.0);
                if (t == 20) c.anim(goku, A_ALZAR);
                if (t >= 40 && t < 200) {
                    double f = (t - 40) / 160.0;
                    double r = 0.5 + (rmax - 0.5) * (1 - Math.pow(1 - f, 2));
                    // Centro anclado sobre las manos alzadas: radio + altura del hueso «manos».
                    Location center = base.clone().add(0, MANOS_ALTO + r + 0.3, 0);
                    c.data.put("center", center);
                    c.data.put("r", r);
                    sphere.teleport(center);
                    o.move(center);
                    if (t % 4 == 0) {
                        size(sphere, (float) r, 4);
                        o.radius((float) r, t * 0.02f, 4);
                        // En el cliente la esfera sigue al hueso «manos» del modelo (no se separa al animarse).
                        c.attach(sphere, goku, B_MANOS, 0, r + 0.3, 0);
                    }
                    List<Location> src = get(c, "src");
                    if (t % 2 == 0) for (Location s : src) CineFx.stream(c.w, s, center, Particle.END_ROD, 1);
                    if (c.cfgB("energiaDeJugadores", true) && t % 2 == 0)
                        for (Player p : c.w.getPlayers())
                            if (p.getLocation().distanceSquared(base) < 64 * 64)
                                CineFx.stream(c.w, p.getLocation().add(0, 1.2, 0), center, p == c.launcher ? Particle.FLASH : Particle.ELECTRIC_SPARK, p == c.launcher ? 1 : 2);
                    if (t % 6 == 0) CineFx.part(c.w, Particle.CLOUD, base.clone().add(0, 0.3, 0), 6, 4, 0.08); // viento
                    if (t % 30 == 10) c.sound(center, "genkidama.carga", 1.5f, 0.6f + (float) f * 0.8f);
                }
                if (t == 200) {
                    // Pausa: la esfera vibra. Plano sobre el hombro del objetivo mirando al cielo.
                    Location center = get(c, "center");
                    Vector back = c.target.getLocation().toVector().subtract(center.toVector()).setY(0).normalize();
                    CineNet.Shot s = c.shot();
                    s.key(0, c.target.getEyeLocation().add(back.clone().multiply(2.2)).add(0, 0.5, 0), center, 72, CUT);
                    s.key(20, c.target.getEyeLocation().add(back.clone().multiply(2.5)).add(0, 0.4, 0), center, 70, LINEAR);
                    c.cam(s);
                }
                if (t >= 200 && t < 220 && t % 2 == 0) {
                    double r = (double) c.data.get("r");
                    float rr = (float) (r + (t % 4 == 0 ? 0.35 : -0.35));
                    size(sphere, rr, 2);
                    o.radius(rr, t * 0.02f, 2);
                }
                if (t == 220) {
                    c.anim(goku, A_LANZAR);
                    c.sound(base, "genkidama.lanzar", 3f, 0.6f);
                }
                if (t == 230) {
                    // Se suelta del hueso: desde aquí la posición la manda el servidor.
                    c.attach(sphere, null, "", 0, 0, 0);
                    Location center = get(c, "center");
                    double r = (double) c.data.get("r");
                    Vector dir = c.eye().toVector().subtract(center.toVector()).normalize();
                    CineNet.Shot s = c.shot().followPos(sphere.getEntityId()).followLook(sphere.getEntityId());
                    Location off = dir.clone().multiply(-(r * 2 + 8)).add(new Vector(0, r * 0.8 + 3, 0)).toLocation(c.w);
                    s.key(0, off, off, 74, CUT);
                    c.cam(s);
                }
                Integer contact = get(c, "contact");
                if (t >= 230 && contact == null) {
                    Location center = get(c, "center");
                    double r = (double) c.data.get("r");
                    Vector to = c.eye().toVector().subtract(center.toVector());
                    if (to.length() <= r * 0.9 || t > 330) {
                        c.data.put("contact", t);
                        c.target.setVelocity(new Vector(0, -1.2, 0));
                    } else {
                        Vector step = to.normalize().multiply(c.cfg("velocidad", 0.4));
                        center.add(step);
                        sphere.teleport(center);
                        o.move(center);
                        // Túnel: solo la mitad delantera de la esfera, cada 3 ticks y por la cola con presupuesto.
                        if (t % 3 == 0) {
                            List<Block> shell = new ArrayList<>();
                            for (Block b : world.sphere(center, r)) {
                                Vector rel = b.getLocation().add(0.5, 0.5, 0.5).toVector().subtract(center.toVector());
                                if (rel.dot(step) >= 0 && rel.lengthSquared() > (r - 2.5) * (r - 2.5) && !b.getType().isAir()) shell.add(b);
                            }
                            world.enqueueSorted(shell, center, true, Material.AIR);
                        }
                        if (t % 3 == 0) CineFx.marker(c.w, c.ground(center.clone()), Math.min(r, 16), 0x203040, 1);
                    }
                }
                contact = get(c, "contact");
                if (contact != null) {
                    int since = t - contact;
                    Location center = get(c, "center");
                    if (since < 15) {
                        center.add(0, -0.15, 0);
                        sphere.teleport(center);
                        o.move(center);
                        if (since % 3 == 0) c.shake(0.9, 6, 0.9);
                    }
                    if (since == 15) {
                        Location p = c.ground(center.clone());
                        size(sphere, 18, 6);
                        c.anim(sphere, "color:ffffffff");
                        o.radius(18, 2f, 6);
                        c.flash(0xffffff, 1, 14, 34);
                        c.shake(2.4, 40, 0.92);
                        c.sound(p, "genkidama.detonar", 4f, 0.5f);
                        world.bowlCrater(p.clone().add(0, -1, 0), c.cfgI("radioCrater", 14), c.cfgI("profundidadCrater", 8), true, 0.12, 0.03, 0, c.rnd);
                        c.finalHit(c.target, c.cfg("danio", 50.0));
                        world.areaDamage(p, 25, c.cfg("danio", 50.0) * 0.6, c.launcher, c.target.getUniqueId());
                        CineWorld.radial(p, 25, 3, 1, c.launcher, null);
                        c.data.put("det", p);
                        CineNet.Shot s = c.shot();
                        s.key(0, c.around(p, 120, 50, 18), p, 72, CUT);
                        s.key(40, c.around(p, 130, 48, 18), p, 72, LINEAR);
                        // Cierre: primer plano del guerrero en su pose final.
                        Location g = goku.getLocation();
                        Vector face = forward((float) c.data.get("yaw"));
                        s.key(41, g.clone().add(face.clone().multiply(3)).add(0, 1.6, 0), g.clone().add(0, 1.5, 0), 55, CUT);
                        s.key(75, g.clone().add(face.clone().multiply(2.6)).add(0, 1.7, 0), g.clone().add(0, 1.6, 0), 52, LINEAR);
                        c.cam(s);
                    }
                    if (since > 15 && since < 40) CineFx.wave(c.w, (Location) get(c, "det"), (since - 15) * 40.0 / 25, 0xcff4ff);
                    if (since == 24) {
                        size(sphere, 0.05f, 18);
                        o.radius(0.05f, 3f, 18);
                    }
                    if (since == 44) {
                        o.remove();
                        remove(sphere);
                        c.anim(goku, A_POSE_FINAL);
                    }
                    if (since == 74) remove(goku, get(c, "stand_" + GOKU));
                    if (since >= 78) e.finish(c, false);
                }
            }
        });
    }

    /* ================================= MIL CORTES: SANTUARIO ================================= */

    private void milCortes() {
        e.register(new CineEngine.Ability("mil_cortes", "MIL CORTES", "#ff3b3b", 300, 300, "Un rey maldito forma su sello, un santuario emerge del suelo bajo un cielo carmesí y mil cortes rebanan todo hasta el tajo en cruz") {
            void start(CineEngine.Ctx c) {
                Location at;
                if (c.launcher != null) {
                    Vector right = forward(c.launcher.getLocation().getYaw()).crossProduct(new Vector(0, 1, 0)).normalize().multiply(-1.5);
                    at = c.ground(c.launcher.getLocation().add(right).add(0, 2, 0));
                } else at = c.ground(c.feet().add(forward(c.yaw0).multiply(c.cfg("distanciaSukunaSinLanzador", 12.0))).add(0, 4, 0));
                float yaw = yawTo(at, c.feet());
                ItemDisplay sk = character(c, at, yaw, SUKUNA, A_APARICION, ALTO_PERSONAJE / 2f, 0xece8de);
                c.data.put("sk", sk);
                c.data.put("skAt", at);
                c.data.put("yaw", yaw);
                // Santuario 6 bloques detrás del rey (lejos del objetivo), mirando también al objetivo.
                Location sh = c.ground(at.clone().add(forward(yaw).multiply(-6)).add(0, 4, 0));
                c.data.put("shAt", sh);
                c.target.addPotionEffect(new PotionEffect(PotionEffectType.SLOWNESS, 230, 9, false, false));
                Vector face = forward(yaw);
                CineNet.Shot s = c.shot();
                // 0–60: plano medio frontal; primer plano de las manos durante el sello.
                s.key(0, at.clone().add(face.clone().multiply(4.5)).add(0, 1.5, 0), at.clone().add(0, 1.4, 0), 58, LINEAR);
                s.key(29, at.clone().add(face.clone().multiply(4.0)).add(0, 1.5, 0), at.clone().add(0, 1.4, 0), 56, LINEAR);
                s.key(30, at.clone().add(face.clone().multiply(1.8)).add(0, 1.2, 0), at.clone().add(0, 1.15, 0), 50, CUT);
                s.key(59, at.clone().add(face.clone().multiply(1.6)).add(0, 1.25, 0), at.clone().add(0, 1.2, 0), 48, LINEAR);
                // 60–110: plano general bajo desde detrás del objetivo: el rey delante y el santuario emergiendo detrás (FOV 85).
                Vector toSk = at.toVector().subtract(c.feet().toVector()).setY(0).normalize();
                s.key(60, c.feet().subtract(toSk.clone().multiply(4)).add(0, 0.6, 0), sh.clone().add(0, 6, 0), 85, CUT);
                s.key(109, c.feet().subtract(toSk.clone().multiply(5)).add(0, 0.5, 0), sh.clone().add(0, 8, 0), 85, LINEAR);
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                ItemDisplay sk = get(c, "sk");
                Location skAt = get(c, "skAt");
                Location shAt = get(c, "shAt");
                if (t < 220) c.target.setVelocity(new Vector(0, Math.min(0, c.target.getVelocity().getY()), 0));
                if (t == 30) {
                    c.anim(sk, A_SELLO);
                    c.sound(skAt, "sukuna.dominio", 3f, 0.55f);
                }
                if (t == 60) {
                    ItemDisplay santuario = character(c, shAt, (float) c.data.get("yaw"), SANTUARIO, A_EMERGER, 14f / ALTO_SANTUARIO, 0x3a0000);
                    c.data.put("santuario", santuario);
                    c.sky(CineNet.SKY_TINT, 0x3a0000, 240);
                    c.vignette(0xc0200000, 15, 200, 25);
                    c.shake(0.7, 50, 0.97);
                    c.sound(shAt, "cortes.dominio", 3f, 0.6f);
                }
                if (t > 60 && t < 110 && t % 3 == 0) {
                    CineFx.part(c.w, Particle.CAMPFIRE_COSY_SMOKE, shAt.clone().add(c.rnd.nextGaussian() * 6, 0.3, c.rnd.nextGaussian() * 6), 2, 0.5, 0.02);
                    CineFx.ring(c.w, c.ground(c.feet()).add(0, 0.12, 0), 2 + (t - 60) * 0.2, 0x3a0000, 1.6f, t * 0.03);
                }
                if (t == 110) {
                    c.anim(sk, A_IDLE_DOMINIO);
                    c.tint(0x60ff0000, 2, 4, 10); // pulso rojo
                }
                if (t >= 110 && t < 190) {
                    if ((t - 110) % 10 == 0) {
                        // Montaje: corte de cámara cada 10 ticks entre 6 planos.
                        Location pos = switch (((t - 110) / 10) % 6) {
                            case 0 -> c.around(c.feet(), 30, 2.4, 1.4);
                            case 1 -> c.feet().add(0.01, 12, 0);
                            case 2 -> c.around(c.feet(), 200, 3, 0.3);
                            case 3 -> skAt.clone().add(forward((float) c.data.get("yaw")).multiply(3)).add(0, 1.6, 0);
                            case 4 -> c.around(c.feet(), 300, 2.0, 1.8);
                            default -> c.around(c.feet(), 90, 8, 1.0);
                        };
                        Location look = ((t - 110) / 10) % 6 == 3 ? skAt.clone().add(0, 1.5, 0) : c.eye();
                        CineNet.Shot s = c.shot();
                        s.key(0, pos, look, 70, CUT);
                        c.cam(s);
                        c.shake(0.15, 10, 1.0);
                    }
                    slashes(c, t);
                }
                if (t == 190) {
                    CineNet.Shot s = c.shot();
                    s.key(0, c.around(c.feet(), 0, 4.5, 1.5), c.eye(), 62, CUT);
                    s.key(29, c.around(c.feet(), 0, 4.2, 1.5), c.eye(), 60, LINEAR);
                    // 220: plano general lejano con el santuario de fondo para ver la cruz.
                    Vector toSh = shAt.toVector().subtract(c.feet().toVector()).setY(0).normalize();
                    Location far = c.feet().subtract(toSh.clone().multiply(28)).add(0, 9, 0);
                    s.key(30, far, mid(c.feet(), shAt, 0.4).add(0, 4, 0), 70, CUT);
                    s.key(110, far.clone().add(0, 2, 0), mid(c.feet(), shAt, 0.4).add(0, 4, 0), 70, LINEAR);
                    c.cam(s);
                }
                if (t == 210) c.anim(sk, A_CORTE_FINAL);
                if (t == 220) cross(c);
                if (t > 220 && t < 260 && t % 2 == 0) CineFx.part(c.w, Particle.CRIMSON_SPORE, c.feet().add(0, 1, 0), 12, 3, 0.02);
                if (t == 250) {
                    c.anim(get(c, "santuario"), A_HUNDIRSE);
                    c.anim(sk, A_DESAPARICION);
                    c.sound(shAt, "cortes.dominio", 2f, 0.9f);
                }
                if (t == 270) c.skyReset();
                if (t == 290) remove(sk, get(c, "santuario"), get(c, "stand_" + SUKUNA), get(c, "stand_" + SANTUARIO));
            }

            /** Ráfaga: `cortesPorTick` planos de 1 bloque con orientación aleatoria (semilla) dentro del dominio. */
            void slashes(CineEngine.Ctx c, int t) {
                Location center = c.feet().add(0, 1, 0);
                double radius = c.cfg("radio", 10.0);
                int per = c.cfgI("cortesPorTick", 3);
                for (int i = 0; i < per; i++) {
                    Vector along = new Vector(c.rnd.nextGaussian(), c.rnd.nextGaussian() * 0.7, c.rnd.nextGaussian()).normalize();
                    Vector tmp = Math.abs(along.getY()) < 0.9 ? new Vector(0, 1, 0) : new Vector(1, 0, 0);
                    Vector normal = along.clone().crossProduct(tmp).normalize();
                    double rr = Math.cbrt(c.rnd.nextDouble()) * radius * 0.8;
                    Location at = center.clone().add(new Vector(c.rnd.nextGaussian(), c.rnd.nextGaussian(), c.rnd.nextGaussian()).normalize().multiply(rr));
                    double len = 4 + c.rnd.nextDouble() * 8;
                    fx.slash(at, along, normal, (float) len, 0.08f, Material.WHITE_CONCRETE, 0xffffff, 3);
                    if (c.cfgB("romperBloques", true)) {
                        List<Block> cut = new ArrayList<>();
                        for (Block b : world.slabPlane(at, along, normal, len, 1)) if (!b.getType().isAir()) cut.add(b);
                        // Si el presupuesto va justo, se recortan los cortes más lejanos (los encola al final).
                        if (world.pending() < 4000 || rr < radius * 0.4) world.enqueueSorted(cut, at, true, Material.AIR);
                        if (!cut.isEmpty()) CineFx.part(c.w, Particle.BLOCK, at, 6, 1.2, 0.2, 1.2, 0, cut.get(0).getBlockData());
                    }
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
            }

            /** Corte en cruz: dos planos enormes cruzados en el objetivo; las mitades superiores se desplazan. */
            void cross(CineEngine.Ctx c) {
                Location center = c.feet().add(0, 1, 0);
                Vector fwd = forward(c.yaw0);
                Vector right = fwd.clone().crossProduct(new Vector(0, 1, 0)).normalize();
                Vector d1 = fwd.clone().add(new Vector(0, 0.9, 0)).normalize();
                Vector d2 = fwd.clone().add(new Vector(0, -0.9, 0)).normalize();
                fx.slash(center, d1, right, 30, 0.5f, Material.RED_CONCRETE, 0xff2020, 16);
                fx.slash(center, d2, right, 30, 0.5f, Material.WHITE_CONCRETE, 0xffffff, 16);
                if (c.cfgB("romperBloques", true)) {
                    world.enqueueSorted(world.slabPlane(center, d1, right, 30, 1), center, true, Material.AIR);
                    world.enqueueSorted(world.slabPlane(center, d2, right, 30, 1), center, true, Material.AIR);
                }
                c.flash(0xffe0e0, 0, 4, 14);
                c.shake(2.2, 25, 0.88);
                c.sound(center, "cortes.final", 3f, 0.7f);
                c.finalHit(c.target, c.cfg("danioFinal", 30.0));
                world.areaDamage(center, 6, c.cfg("danioFinal", 30.0) * 0.5, c.launcher, c.target.getUniqueId());
                c.target.setVelocity(fwd.clone().multiply(-1.4).setY(0.5));
                for (int k = 0; k < 30; k++) {
                    Location l = center.clone().add(d1.clone().multiply((k - 15) * 1.0));
                    Block b = l.getBlock().getRelative(0, 1, 0);
                    if (b.getType().isSolid()) world.flyVisual(b.getLocation().add(0.5, 0.3, 0.5), b.getBlockData(), CineWorld.Path.HOVER, null, new Vector(0.3, 0.02, 0), 40, 0);
                }
            }
        });
    }

    /* ======================================== VACÍO PÚRPURA ======================================== */

    private void vacioPurpura() {
        e.register(new CineEngine.Ability("vacio_purpura", "VACÍO PÚRPURA", "#9b30ff", 260, 260, "Una esfera azul y una roja se funden en un orbe morado que avanza borrando todo y arrastra al objetivo") {
            void start(CineEngine.Ctx c) {
                Location at;
                float yaw;
                if (c.launcher != null) {
                    Vector right = forward(c.launcher.getLocation().getYaw()).crossProduct(new Vector(0, 1, 0)).normalize().multiply(-1.5);
                    at = c.ground(c.launcher.getLocation().add(right).add(0, 2, 0));
                    yaw = c.launcher.getLocation().getYaw();
                } else {
                    at = c.ground(c.feet().add(forward(c.yaw0).multiply(25)).add(0, 6, 0));
                    yaw = yawTo(at, c.feet());
                }
                ItemDisplay gj = character(c, at, yaw, GOJO, A_APARICION, ALTO_PERSONAJE / 2f, 0x18203a);
                c.data.put("gj", gj);
                c.data.put("at", at);
                c.data.put("yaw", yaw);
                c.sound(at, "gojo.aparicion", 2f, 1f);
                Vector face = forward(yaw);
                Vector side = face.clone().crossProduct(new Vector(0, 1, 0)).normalize();
                CineNet.Shot s = c.shot();
                // 0–30: plano medio del hechicero apareciendo.
                s.key(0, at.clone().add(face.clone().multiply(4.5)).add(0, 1.5, 0), at.clone().add(0, 1.3, 0), 60, LINEAR);
                // 30–110: travelling por detrás, del hombro izquierdo al derecho, mirando las manos; acaba sobre su hombro mirando al objetivo.
                Location hands = at.clone().add(0, 1.1, 0).add(face.clone().multiply(0.6));
                for (int k = 0; k <= 8; k++) {
                    double a = Math.PI * (0.15 + 0.7 * k / 8.0);
                    Vector off = side.clone().multiply(Math.cos(a) * 2.6).add(face.clone().multiply(-Math.sin(a) * 2.4));
                    Location look = k < 8 ? hands : c.eye();
                    s.key(30 + k * 10, at.clone().add(off).add(0, 1.8, 0), look, 62, k == 0 ? CUT : EASE_IN_OUT);
                }
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                ItemDisplay gj = get(c, "gj");
                Location at = get(c, "at");
                float yaw = (float) c.data.get("yaw");
                Vector face = forward(yaw);
                Vector side = face.clone().crossProduct(new Vector(0, 1, 0)).normalize();
                if (t == 30) {
                    c.anim(gj, A_CARGA);
                    c.sound(at, "gojo.carga", 1.5f, 0.8f);
                    // Azul (atracción) en la mano izquierda y rojo (repulsión) en la derecha, pegadas a los huesos.
                    ItemDisplay blue = energy(c, at.clone().add(0, 1, 0), 0.01f, "ff3a7bff");
                    ItemDisplay red = energy(c, at.clone().add(0, 1, 0), 0.01f, "ffff3030");
                    c.attach(blue, gj, B_MANO_IZQ, 0, 0, 0);
                    c.attach(red, gj, B_MANO_DER, 0, 0, 0);
                    size(blue, 0.6f, 60);
                    size(red, 0.6f, 60);
                    c.data.put("blue", blue);
                    c.data.put("red", red);
                }
                if (t > 30 && t < 90 && t % 3 == 0) {
                    // Chispas aproximadas en cada mano (para quien no tiene el mod también se ve algo).
                    CineFx.dot(c.w, at.clone().add(side.clone().multiply(0.9)).add(0, 1.2, 0).add(face.clone().multiply(0.5)), 0x3a7bff, 1.2f);
                    CineFx.dot(c.w, at.clone().add(side.clone().multiply(-0.9)).add(0, 1.2, 0).add(face.clone().multiply(0.5)), 0xff3030, 1.2f);
                }
                if (t == 90) {
                    // Las manos se juntan: ambas esferas viajan al hueso «mano_proyectil».
                    c.attach(get(c, "blue"), gj, B_MANO_PROY, -0.25, 0, 0);
                    c.attach(get(c, "red"), gj, B_MANO_PROY, 0.25, 0, 0);
                }
                if (t == 102) {
                    remove(get(c, "blue"), get(c, "red"));
                    Location p0 = at.clone().add(0, PROY_ALTO, 0).add(face.clone().multiply(PROY_DELANTE));
                    ItemDisplay purple = energy(c, p0, 0.6f, "ff9b30ff");
                    c.attach(purple, gj, B_MANO_PROY, 0, 0, 0);
                    size(purple, 0.9f, 8);
                    c.data.put("purple", purple);
                    c.flash(0x9b30ff, 0, 2, 8);
                    CineFx.part(c.w, Particle.FLASH, p0, 1, 0, 0);
                    CineFx.part(c.w, Particle.DRAGON_BREATH, p0, 20, 0.3, 0.05);
                }
                if (t == 110) {
                    c.anim(gj, A_DISPARO);
                    c.shake(0.8, 10, 0.85);
                    c.sound(at, "gojo.disparo", 3f, 0.7f);
                    ItemDisplay purple = get(c, "purple");
                    c.attach(purple, null, "", 0, 0, 0);
                    Location p0 = at.clone().add(0, PROY_ALTO, 0).add(face.clone().multiply(PROY_DELANTE));
                    purple.teleport(p0);
                    size(purple, 3f, 6);
                    // Dirección fija: hacia donde estaba el objetivo al disparar (no lo persigue).
                    Vector dir = (c.launcher != null ? c.eye().toVector().subtract(c.launcher.getEyeLocation().toVector()) : c.eye().toVector().subtract(p0.toVector())).normalize();
                    c.data.put("pos", p0.clone());
                    c.data.put("start", p0.clone());
                    c.data.put("dir", dir);
                    // Cámara: sigue al orbe desde un lateral a 10 bloques.
                    Vector lat = dir.clone().crossProduct(new Vector(0, 1, 0)).normalize().multiply(10);
                    CineNet.Shot s = c.shot().followPos(purple.getEntityId()).followLook(purple.getEntityId());
                    Location off = lat.add(new Vector(0, 2.5, 0)).toLocation(c.w);
                    s.key(0, off, off, 70, CUT);
                    c.cam(s);
                }
                Integer det = get(c, "det");
                if (t > 110 && det == null) {
                    ItemDisplay purple = get(c, "purple");
                    Location pos = get(c, "pos");
                    Vector dir = get(c, "dir");
                    pos.add(dir.clone().multiply(c.cfg("velocidad", 0.6)));
                    purple.teleport(pos);
                    // a) Borra lo que toca (esfera continua, por la cola con presupuesto).
                    world.enqueueSorted(world.sphere(pos, c.cfg("radioDestruccion", 3.0)), pos, true, Material.AIR);
                    // b) Atracción amortiguada; c) núcleo: sujeta en el centro y hace daño cada 10 ticks.
                    double ra = c.cfg("radioAtraccion", 10.0), rn = c.cfg("radioNucleo", 1.5);
                    for (Entity en : c.w.getNearbyEntities(pos, ra, ra, ra)) {
                        if (!(en instanceof LivingEntity le) || !CineWorld.affectable(en, c.launcher)) continue;
                        Vector to = pos.toVector().subtract(en.getLocation().add(0, 1, 0).toVector());
                        double d = to.length();
                        if (d < rn) {
                            CineWorld.hold(en, pos.clone().add(0, -1, 0));
                            if (t % 10 == 0) c.damage(le, c.cfg("danioTick", 2.0), true);
                        } else if (d < ra) {
                            Vector v = to.normalize().multiply(Math.min(0.9, 0.25 + (ra - d) * 0.06));
                            en.setVelocity(en.getVelocity().multiply(0.5).add(v).add(dir.clone().multiply(c.cfg("velocidad", 0.6) * 0.8)));
                            en.setFallDistance(0);
                        }
                    }
                    if (t % 2 == 0) {
                        CineFx.part(c.w, Particle.DRAGON_BREATH, pos, 10, 2.2, 0.02);
                        CineFx.part(c.w, Particle.REVERSE_PORTAL, pos, 20, 3.5, 0.2);
                    }
                    if (t % 4 == 0) c.anim(purple, (t / 4) % 2 == 0 ? "color:ffb050ff" : "color:ff9b30ff");
                    boolean done = t - 110 >= c.cfgI("ticksMax", 100) || pos.distance((Location) get(c, "start")) >= c.cfg("distanciaMax", 60.0);
                    if (done) detonate(c, t, pos);
                }
                det = get(c, "det");
                if (det != null) {
                    int since = t - det;
                    Location p = get(c, "detAt");
                    if (since < 20) CineFx.wave(c.w, p, since * 20.0 / 20, since % 2 == 0 ? 0xffffff : 0x9b30ff);
                    if (since == 12) size(get(c, "purple"), 0.05f, 12);
                    if (since == 25) {
                        remove(get(c, "purple"));
                        c.anim(gj, A_POSE_FINAL);
                    }
                    if (since == 60) remove(gj, get(c, "stand_" + GOJO));
                    if (since >= 64) e.finish(c, false);
                }
            }

            void detonate(CineEngine.Ctx c, int t, Location pos) {
                c.data.put("det", t);
                c.data.put("detAt", pos.clone());
                int rd = c.cfgI("radioDetonacion", 7);
                world.enqueueSorted(world.sphere(pos, rd), pos, true, Material.AIR);
                size(get(c, "purple"), rd, 4);
                c.anim(get(c, "purple"), "color:ffffffff");
                c.flash(0xe8c8ff, 0, 6, 20);
                c.shake(2.4, 30, 0.9);
                c.sound(pos, "gojo.detonacion", 4f, 0.6f);
                CineFx.part(c.w, Particle.EXPLOSION_EMITTER, pos, 3, 2, 0);
                if (c.target.getLocation().distance(pos) < rd + 3) c.finalHit(c.target, c.cfg("danioFinal", 30.0));
                world.areaDamage(pos, rd + 3, c.cfg("danioFinal", 30.0), c.launcher, c.target.getUniqueId());
                // Liberación: nadie queda sujeto.
                CineWorld.radial(pos, rd + 6, 1.2, 0.6, c.launcher, null);
                // Plano general a 30 bloques y luego primer plano del hechicero en su pose final.
                ItemDisplay gj = get(c, "gj");
                Location g = gj.getLocation();
                Vector face = forward((float) c.data.get("yaw"));
                CineNet.Shot s = c.shot();
                s.key(0, c.around(pos, 140, 30, 10), pos, 72, CUT);
                s.key(24, c.around(pos, 150, 29, 10), pos, 72, LINEAR);
                s.key(25, g.clone().add(face.clone().multiply(2.8)).add(0, 1.6, 0), g.clone().add(0, 1.5, 0), 55, CUT);
                s.key(60, g.clone().add(face.clone().multiply(2.4)).add(0, 1.7, 0), g.clone().add(0, 1.6, 0), 52, LINEAR);
                c.cam(s);
            }
        });
    }

    /* ========================================== AKAZA ========================================== */

    private void akaza() {
        e.register(new CineEngine.Ability("akaza", "DESPLIEGUE DE TÉCNICA", "#7fd8ff", 180, 180, "Un luchador dibuja un copo de hielo de 12 puntas en el suelo y golpea la tierra abriendo un cráter") {
            void start(CineEngine.Ctx c) {
                Location at = c.ground(c.feet().add(forward(c.yaw0).multiply(c.cfg("distanciaAparicion", 8.0))).add(0, 4, 0));
                float yaw = yawTo(at, c.feet());
                ItemDisplay ak = character(c, at, yaw, AKAZA, A_APARICION, ALTO_PERSONAJE / 2f, 0x282840);
                c.data.put("ak", ak);
                c.data.put("at", at);
                c.data.put("yaw", yaw);
                c.sound(at, "akaza.aparicion", 2f, 0.7f);
                CineFx.part(c.w, Particle.BLOCK, at.clone().add(0, 0.2, 0), 40, 1.5, 0.1, 1.5, 0, at.clone().add(0, -1, 0).getBlock().getBlockData());
                CineFx.part(c.w, Particle.CLOUD, at, 20, 1.5, 0.05);
                Vector back = c.feet().toVector().subtract(at.toVector()).setY(0).normalize();
                Vector lat = back.clone().crossProduct(new Vector(0, 1, 0)).normalize();
                CineNet.Shot s = c.shot();
                // 0–30: tercera persona frontal del objetivo (en diagonal, hacia el luchador), alejándose de 4 a 12 bloques.
                s.key(0, c.eye().add(back.clone().multiply(-0.8).add(lat.clone().multiply(0.6)).normalize().multiply(4)).add(0, 0.3, 0), c.eye(), 65, LINEAR);
                s.key(29, c.eye().add(back.clone().multiply(0.3).add(lat.clone().multiply(1)).normalize().multiply(12)).add(0, 3, 0), mid(c.feet(), at, 0.5).add(0, 1, 0), 70, EASE_OUT_EXPO);
                // 30–70: sube a plano picado a 14 bloques para ver el copo entero.
                s.key(30, c.eye().add(back.clone().multiply(0.3).add(lat.clone().multiply(1)).normalize().multiply(12)).add(0, 3, 0), mid(c.feet(), at, 0.5).add(0, 1, 0), 70, LINEAR);
                s.key(69, at.clone().add(back.clone().multiply(3)).add(0, 14, 0), at, 70, EASE_IN_OUT);
                // 70–85: corte a plano bajo lateral, cerca del suelo, con el luchador en primer término.
                Vector side = back.clone().crossProduct(new Vector(0, 1, 0)).normalize();
                s.key(70, at.clone().add(side.clone().multiply(3)).add(back.clone().multiply(-1.5)).add(0, 0.4, 0), mid(at, c.feet(), 0.6).add(0, 1, 0), 72, CUT);
                s.key(84, at.clone().add(side.clone().multiply(3.2)).add(back.clone().multiply(-1.6)).add(0, 0.35, 0), mid(at, c.feet(), 0.6).add(0, 1, 0), 72, LINEAR);
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                ItemDisplay ak = get(c, "ak");
                Location at = get(c, "at");
                double rc = c.cfg("radioCopo", 10.0);
                if (t == 30) {
                    c.anim(ak, A_DESPLIEGUE);
                    c.sound(at, "akaza.despliegue", 2f, 0.9f);
                    // Copo plano a la altura de los pies del luchador (+0.05): en terreno irregular atraviesa el relieve,
                    // pero nunca parpadea (proyectarlo bloque a bloque obligaría a partirlo en cientos de piezas).
                    ItemDisplay copo = c.actor(fx.itemDisplay(at.clone().add(0, 0.05, 0), new ItemStack(Material.AIR), 1f, 0));
                    copo.setDisplayWidth((float) rc * 2.5f);
                    copo.setDisplayHeight(2f);
                    c.model(copo, COPO, "trazar", (float) (rc / 2.0));
                    c.data.put("copo", copo);
                }
                if (t >= 30 && t < 120 && t % 2 == 0) {
                    // Sin el mod: el mismo patrón con partículas, trazado desde el centro en 30 ticks.
                    double prog = Math.min(1, (t - 30) / 30.0);
                    CineFx.glyph(c.w, at.clone().add(0, 0.15, 0), rc, 3, 12, prog, 0, 0x7fd8ff, 0xffffff);
                }
                if (t == 70) {
                    c.anim(ak, A_GOLPE_SUELO);
                    c.anim(get(c, "copo"), "color:ffffffff");
                    c.target.addPotionEffect(new PotionEffect(PotionEffectType.SLOWNESS, 20, 9, false, false));
                }
                if (t > 70 && t < 85) c.target.setVelocity(new Vector(0, Math.min(0, c.target.getVelocity().getY()), 0));
                if (t == c.cfgI("tickImpacto", 85)) impact(c, at);
                if (t == 120) {
                    c.anim(ak, A_POSE_FINAL);
                    c.anim(get(c, "copo"), "desvanecer");
                    c.anim(get(c, "copo"), "color:607fd8ff");
                    Vector face = forward((float) c.data.get("yaw"));
                    CineNet.Shot s = c.shot();
                    s.key(0, at.clone().add(face.clone().multiply(3.2)).add(0, 1.5, 0), at.clone().add(0, 1.3, 0), 58, CUT);
                    s.key(40, at.clone().add(face.clone().multiply(2.8)).add(0, 1.6, 0), at.clone().add(0, 1.4, 0), 54, LINEAR);
                    c.cam(s);
                }
                if (t == 140) c.anim(get(c, "copo"), "color:207fd8ff");
                if (t == 155) remove(get(c, "copo"));
                if (t == 160) remove(ak, get(c, "stand_" + AKAZA));
            }

            void impact(CineEngine.Ctx c, Location at) {
                Location p = c.ground(mid(at, c.feet(), 0.5).add(0, 2, 0));
                world.bowlCrater(p.clone().add(0, -1, 0), c.cfgI("radioCrater", 6), 3, false, 0, 0, 0, c.rnd);
                // Explosión solo visual (nunca la explosión vanilla).
                CineFx.part(c.w, Particle.EXPLOSION_EMITTER, p, 2, 1, 0);
                CineFx.part(c.w, Particle.FLASH, p.clone().add(0, 1, 0), 1, 0, 0);
                CineFx.part(c.w, Particle.SNOWFLAKE, p.clone().add(0, 1, 0), 80, 3, 0.4);
                CineFx.part(c.w, Particle.BLOCK, p, 60, 3, 0.5, 3, 0.2, p.clone().add(0, -1, 0).getBlock().getBlockData());
                for (int k = 0; k < 3; k++) CineFx.wave(c.w, p.clone().add(0, 0.2, 0), 4 + k * 6, k == 1 ? 0x7fd8ff : 0xffffff);
                c.flash(0xe6f8ff, 0, 3, 12);
                c.shake(2.2, 25, 0.88);
                c.sound(p, "akaza.golpe", 4f, 0.7f);
                c.finalHit(c.target, c.cfg("danio", 20.0));
                world.areaDamage(p, 6, c.cfg("danio", 20.0) * 0.6, c.launcher, c.target.getUniqueId());
                double kh = c.cfg("knockbackHorizontal", 2.5), kv = c.cfg("knockbackVertical", 1.2);
                CineWorld.radial(p, 14, kh, kv, c.launcher, null);
                Vector out = c.feet().toVector().subtract(p.toVector()).setY(0);
                if (out.lengthSquared() < 0.01) out = forward(c.yaw0);
                c.target.setVelocity(out.normalize().multiply(kh).setY(kv));
                // 30 bloques del cráter salen volando.
                for (int k = 0; k < 30; k++) {
                    double a = c.rnd.nextDouble() * Math.PI * 2;
                    Block b = c.ground(p.clone().add(Math.cos(a) * 3, 2, Math.sin(a) * 3)).add(0, -1, 0).getBlock();
                    Material m = b.getType().isSolid() ? b.getType() : Material.DIRT;
                    Vector v = new Vector(Math.cos(a) * (0.4 + c.rnd.nextDouble() * 0.5), 0.7 + c.rnd.nextDouble() * 0.6, Math.sin(a) * (0.4 + c.rnd.nextDouble() * 0.5));
                    world.flyVisual(p.clone().add(0, 0.5, 0), m.createBlockData(), CineWorld.Path.LAUNCH, null, v, 40, 0);
                }
                // 85–120: la cámara sigue al objetivo volando, desde un lateral.
                Vector side = out.clone().crossProduct(new Vector(0, 1, 0)).normalize().multiply(7);
                CineNet.Shot s = c.shot().followPos(c.target.getEntityId()).followLook(c.target.getEntityId());
                Location off = side.add(new Vector(0, 1.5, 0)).toLocation(c.w);
                s.key(0, off, off, 74, CUT);
                c.cam(s);
            }
        });
    }
}
