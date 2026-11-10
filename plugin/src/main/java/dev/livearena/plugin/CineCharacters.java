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
    static final String ESFERA = "esfera", VACIO = "vacio", COPO = "copo", AURA = "aura";
    /** Efectos de energía con shader (mod). */
    static final String FX_AZUL = "fx_azul", FX_ROJO = "fx_rojo", FX_PURPURA = "fx_purpura", FX_GENKI = "fx_genki", FX_AURA = "fx_aura", FX_ONDA = "fx_onda",
            FX_PILAR = "fx_pilar", FX_CORTES = "fx_cortes", FX_BRUJULA = "fx_brujula", FX_GOLPE = "fx_golpe", FX_COMETA = "fx_cometa", FX_RAYOS = "fx_rayos";
    static final String B_MANOS = "manos", B_MANO_IZQ = "mano_izquierda", B_MANO_DER = "mano_derecha", B_MANO_PROY = "mano_proyectil";
    static final String A_APARICION = "aparicion", A_ALZAR = "alzar_brazos", A_LANZAR = "lanzar", A_POSE_FINAL = "pose_final";
    static final String A_SELLO = "sello_mano", A_IDLE_DOMINIO = "idle_dominio", A_CORTE_FINAL = "corte_final", A_DESAPARICION = "desaparicion";
    static final String A_EMERGER = "emerger", A_HUNDIRSE = "hundirse";
    static final String A_CARGA = "carga", A_DISPARO = "disparo";
    static final String A_DESPLIEGUE = "despliegue_tecnica", A_GOLPE_SUELO = "golpe_suelo";
    /** Altura del modelo en bloques a escala 1 (los personajes miden 2 bloques; el santuario ≈ 5). */
    static final float ALTO_PERSONAJE = 2.0f, ALTO_SANTUARIO = 51.0f; // el santuario es una construcción de 51 bloques (malla)
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
    static <T> T get(CineEngine.Ctx c, String k) {
        return (T) c.data.get(k);
    }

    static Vector forward(float yaw) {
        double a = Math.toRadians(yaw);
        return new Vector(-Math.sin(a), 0, Math.cos(a));
    }

    static float yawTo(Location from, Location to) {
        Vector d = to.toVector().subtract(from.toVector()).setY(0);
        if (d.lengthSquared() < 1e-6) return from.getYaw();
        return from.clone().setDirection(d).getYaw();
    }

    static Location mid(Location a, Location b, double f) {
        return a.clone().add(b.toVector().subtract(a.toVector()).multiply(f));
    }

    /** Personaje: display con el modelo (mira en `yaw`) + soporte de armadura para quien no tiene el mod. */
    ItemDisplay character(CineEngine.Ctx c, Location at, float yaw, String model, String anim, float scale, int color) {
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
        return energy(c, at, r, argb, ESFERA);
    }

    private ItemDisplay energy(CineEngine.Ctx c, Location at, float r, String argb, String model) {
        ItemDisplay d = c.actor(fx.itemDisplay(at, new ItemStack(Material.AIR), 1f, 0));
        d.setTeleportDuration(1);
        d.setDisplayWidth(40f);
        d.setDisplayHeight(40f);
        c.model(d, model, "idle", 1f);
        c.anim(d, "color:" + argb);
        size(d, r, 0);
        return d;
    }

    static void size(ItemDisplay d, float r, int ticks) {
        if (d == null || !d.isValid()) return;
        d.setInterpolationDelay(0);
        d.setInterpolationDuration(ticks);
        d.setTransformation(new Transformation(new Vector3f(), new Quaternionf(), new Vector3f(r, r, r), new Quaternionf()));
    }

    /** Efecto de energía del mod (shader): fx_azul, fx_rojo, fx_purpura, fx_genki, fx_aura, fx_pilar, fx_cortes, fx_brujula, fx_cometa… */
    ItemDisplay vfx(CineEngine.Ctx c, Location at, String model, float size, String argb) {
        ItemDisplay d = c.actor(fx.itemDisplay(at, new ItemStack(Material.AIR), 1f, 0));
        d.setTeleportDuration(1);
        d.setDisplayWidth(120f);
        d.setDisplayHeight(120f);
        d.setViewRange(16f);
        c.model(d, model, "idle", 1f);
        if (argb != null) c.anim(d, "color:" + argb);
        size(d, size, 0);
        return d;
    }

    /** Efecto de un solo uso (onda, golpe…): se borra solo a los `life` ticks. */
    void once(CineEngine.Ctx c, Location at, String model, float size, String argb, int life) {
        ItemDisplay d = c.actor(fx.itemDisplay(at, new ItemStack(Material.AIR), 1f, life));
        d.setDisplayWidth(120f);
        d.setDisplayHeight(120f);
        d.setViewRange(16f);
        c.model(d, model, "idle", 1f);
        if (argb != null) c.anim(d, "color:" + argb);
        size(d, size, 0);
    }

    static double ease(double f) {
        f = Math.max(0, Math.min(1, f));
        return 1 - (1 - f) * (1 - f);
    }

    static void remove(Entity... es) {
        for (Entity en : es) if (en != null && en.isValid()) en.remove();
    }

    /**
     * Final suave: el personaje (y lo que le acompañe, p. ej. su aura) se desvanece en partículas de su color en
     * `ticks` ticks y después se borra. Quien no tiene el mod ve el soporte de respaldo deshacerse en partículas.
     */
    void vanish(CineEngine.Ctx c, String model, ItemDisplay d, int rgb, int ticks, Entity... extra) {
        if (d == null || !d.isValid()) return;
        Location at = d.getLocation();
        c.anim(d, "disolver:" + ticks * 50);
        for (Entity x : extra) if (x != null && x.isValid()) c.anim(x, "disolver:" + ticks * 50);
        once(c, at, "fx_disolver", 1f, String.format("ff%06x", rgb & 0xffffff), ticks + 30);
        c.sound(at, "personaje.desvanecer", 1.5f, 1f);
        Entity stand = get(c, "stand_" + model);
        CineFx.part(c.w, Particle.DUST, at.clone().add(0, 1, 0), 40, 0.35, 0.8, 0.35, 0, CineFx.dust(rgb, 1.4f));
        CineFx.part(c.w, Particle.END_ROD, at.clone().add(0, 1, 0), 12, 0.3, 0.6, 0.3, 0.02, null);
        java.util.List<Entity> all = new java.util.ArrayList<>(java.util.List.of(extra));
        all.add(d);
        if (stand != null) stand.remove();
        e.plugin.getServer().getScheduler().runTaskLater(e.plugin, () -> remove(all.toArray(new Entity[0])), ticks + 2);
    }

    /** Mueve un personaje (modelo + soporte de respaldo + lo que le acompañe) conservando hacia dónde mira. */
    void moveChar(CineEngine.Ctx c, String model, ItemDisplay d, Location to, float yaw, Entity... extra) {
        Location l = to.clone();
        l.setYaw(yaw);
        l.setPitch(0);
        if (d != null && d.isValid()) d.teleport(l);
        Entity stand = get(c, "stand_" + model);
        if (stand != null && stand.isValid()) stand.teleport(l);
        for (Entity x : extra) if (x != null && x.isValid()) x.teleport(l);
    }

    /* ========================================= GENKIDAMA ========================================= */

    private void genkidama() {
        e.register(new CineEngine.Ability("genkidama", "GENKIDAMA", "#8fd3ff", 540, 540, "Un guerrero sube al cielo, pide energía a todos y forma una esfera gigante que lanza contra el objetivo") {
            void start(CineEngine.Ctx c) {
                Location at;
                if (c.launcher != null) {
                    Vector right = forward(c.launcher.getLocation().getYaw()).crossProduct(new Vector(0, 1, 0)).normalize().multiply(-2);
                    at = c.ground(c.launcher.getLocation().add(right).add(0, 2, 0));
                } else at = c.ground(c.feet().add(forward(c.yaw0).multiply(c.cfg("distanciaGokuSinLanzador", 30.0))).add(0, 6, 0));
                // El guerrero sube al cielo y desde ahí carga y lanza la esfera.
                at = at.clone().add(0, c.cfg("alturaVuelo", 16.0), 0);
                float yaw = yawTo(at, c.feet());
                Location low = at.clone().add(0, -9, 0);
                ItemDisplay goku = character(c, low, yaw, GOKU, A_APARICION, ALTO_PERSONAJE / 2f, 0xff7a1a);
                ItemDisplay aura = vfx(c, low, FX_AURA, 2.4f, "ffbfeaff");
                c.sound(low, "aura.vibrar", 1.5f, 1.1f);
                c.data.put("aura", aura);
                c.data.put("goku", goku);
                c.data.put("base", at);
                c.data.put("low", low);
                c.data.put("yaw", yaw);
                boolean voiced = c.voice("goku");
                c.data.put("voiced", voiced);
                if (!voiced) c.sound(at, "genkidama.aparicion", 2f, 0.9f);
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
                // Respaldo sin mod: esfera de bloques (oculta a quien tiene el mod, que ve la de energía).
                CineFx.Orb o = fx.orb(center, 0.01f, Material.LIGHT_BLUE_CONCRETE, Material.LIGHT_BLUE_STAINED_GLASS, 0x8fd3ff, 0);
                for (BlockDisplay d : o.parts) c.actor(d);
                c.data.put("orb", o);
                ItemDisplay sphere = vfx(c, center, FX_GENKI, 0.01f, null);
                for (Player p : c.w.getPlayers()) if (CineNet.hasMod(p)) for (BlockDisplay d : o.parts) p.hideEntity(e.plugin, d);
                c.data.put("sphere", sphere);
                Vector face = forward(yaw);
                Vector side = face.clone().crossProduct(new Vector(0, 1, 0)).normalize();
                CineNet.Shot s = c.shot();
                // 0–50: sube envuelto en su aura (grito); 50–73: plano medio frontal.
                Location cam0 = at.clone().add(face.clone().multiply(9)).add(side.clone().multiply(3)).add(0, -4, 0);
                s.key(0, cam0, low.clone().add(0, 1.4, 0), 66, LINEAR);
                s.key(50, cam0, at.clone().add(0, 1.4, 0), 62, LINEAR);
                s.key(73, at.clone().add(face.clone().multiply(4.4)).add(0, 1.6, 0), at.clone().add(0, 2.0, 0), 60, EASE_IN_OUT);
                // 74–270: contrapicado que se aleja según crece la esfera (siempre cabe entera).
                double rmax = c.cfg("radioMax", 12.0);
                for (int k = 0; k <= 8; k++) {
                    int tk = 74 + (int) Math.round(k * 24.5);
                    double r = 0.5 + (rmax - 0.5) * ease(k / 8.0);
                    double dist = 8 + r * 2.4;
                    Location cpos = at.clone().add(face.clone().multiply(dist * 0.8)).add(side.clone().multiply(dist * 0.6)).add(0, -6 - r * 0.4, 0);
                    s.key(tk, cpos, at.clone().add(0, MANOS_ALTO + r * 0.9, 0), 74, k == 0 ? CUT : LINEAR);
                }
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                Location base = get(c, "base");
                ItemDisplay goku = get(c, "goku");
                ItemDisplay sphere = get(c, "sphere");
                ItemDisplay aura = get(c, "aura");
                CineFx.Orb o = get(c, "orb");
                boolean plain = !CineNet.hasMod(c.target);
                boolean voiced = (boolean) c.data.get("voiced");
                float yaw = (float) c.data.get("yaw");
                double rmax = c.cfg("radioMax", 12.0);
                if (t <= 50) {
                    Location low = get(c, "low");
                    moveChar(c, GOKU, goku, mid(low, base, t / 50.0), yaw, aura);
                    if (t % 10 == 0) c.shake(0.25, 8, 0.95);
                }
                if (t == 50) once(c, base.clone().add(0, 1, 0), FX_ONDA, 14, "ffbfeaff", 30);
                // Frases al ritmo del audio.
                if (t == 74) {
                    c.anim(goku, A_ALZAR);
                    c.say("goku_1", "¡Escúchenme todos!", 0x8fd3ff, 27);
                    // El cielo se oscurece para que la energía destaque.
                    c.sky(CineNet.SKY_TINT, 0x0a2046, 260);
                }
                if (t == 102) c.say("goku_2", "¡Denme un poco de su energía!", 0x8fd3ff, 50);
                if (t == 160) c.say("goku_3", "¡La necesito!", 0xffffff, 34);
                if (plain && t < 290 && t % 4 == 0) {
                    CineFx.part(c.w, Particle.END_ROD, base.clone().add(0, 1, 0), 3, 0.6, 0.05);
                    CineFx.ring(c.w, base.clone().add(0, 0.1, 0), 1.4 + (t % 20) * 0.05, 0x9fe4ff, 1f, t * 0.1);
                }
                if (t >= 74 && t < 270) {
                    double f = (t - 74) / 196.0;
                    double r = 0.5 + (rmax - 0.5) * ease(f);
                    // Centro anclado sobre las manos alzadas: radio + altura del hueso «manos».
                    Location center = base.clone().add(0, MANOS_ALTO + r + 0.3, 0);
                    c.data.put("center", center);
                    c.data.put("r", r);
                    sphere.teleport(center);
                    o.move(center);
                    if (t % 4 == 0) {
                        size(sphere, (float) r, 4);
                        o.radius((float) r, t * 0.02f, 4);
                        c.attach(sphere, goku, B_MANOS, 0, r + 0.3, 0);
                    }
                    if (plain) {
                        List<Location> src = get(c, "src");
                        if (t % 2 == 0) for (Location s : src) CineFx.stream(c.w, s, center, Particle.END_ROD, 1);
                    }
                    if (c.cfgB("energiaDeJugadores", true) && t % 3 == 0)
                        for (Player p : c.w.getPlayers())
                            if (p.getLocation().distanceSquared(base) < 64 * 64)
                                CineFx.stream(c.w, p.getLocation().add(0, 1.2, 0), center, p == c.launcher ? Particle.FLASH : Particle.ELECTRIC_SPARK, 1);
                    if (t % 30 == 10 && (!voiced || t > 190)) c.sound(center, "genkidama.carga", 1.5f, 0.6f + (float) f * 0.8f);
                    if (t % 40 == 0) c.shake(0.2 + f * 0.4, 12, 0.96);
                }
                if (t == 270) {
                    // Pausa: la esfera vibra. Plano sobre el hombro del objetivo mirando al cielo.
                    Location center = get(c, "center");
                    Vector back = c.target.getLocation().toVector().subtract(center.toVector()).setY(0).normalize();
                    CineNet.Shot s = c.shot();
                    s.key(0, c.target.getEyeLocation().add(back.clone().multiply(2.2)).add(0, 0.5, 0), center, 72, CUT);
                    s.key(20, c.target.getEyeLocation().add(back.clone().multiply(2.5)).add(0, 0.4, 0), center, 70, LINEAR);
                    c.cam(s);
                }
                if (t >= 270 && t < 290 && t % 2 == 0) {
                    double r = (double) c.data.get("r");
                    float rr = (float) (r + (t % 4 == 0 ? 0.35 : -0.35));
                    size(sphere, rr, 2);
                    o.radius(rr, t * 0.02f, 2);
                }
                if (t == 290) {
                    c.anim(goku, A_LANZAR);
                    c.sound(base, "genkidama.lanzar", 3f, 0.6f);
                }
                if (t == 300) {
                    // Se suelta del hueso: desde aquí la posición la manda el servidor.
                    c.attach(sphere, null, "", 0, 0, 0);
                    c.anim(sphere, "viajar");
                    Location center = get(c, "center");
                    double r = (double) c.data.get("r");
                    Vector dir = c.eye().toVector().subtract(center.toVector()).normalize();
                    CineNet.Shot s = c.shot().followPos(sphere.getEntityId()).followLook(sphere.getEntityId());
                    Location off = dir.clone().multiply(-(r * 2 + 8)).add(new Vector(0, r * 0.8 + 3, 0)).toLocation(c.w);
                    s.key(0, off, off, 74, CUT);
                    c.cam(s);
                }
                Integer contact = get(c, "contact");
                if (t >= 300 && contact == null) {
                    Location center = get(c, "center");
                    double r = (double) c.data.get("r");
                    Vector to = c.eye().toVector().subtract(center.toVector());
                    if (to.length() <= r * 0.9 || t > 420) {
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
                        if (plain && t % 3 == 0) CineFx.marker(c.w, c.ground(center.clone()), Math.min(r, 16), 0x203040, 1);
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
                        c.anim(sphere, "detonar");
                        size(sphere, 18, 6);
                        o.radius(18, 2f, 6);
                        once(c, p.clone().add(0, 0.3, 0), FX_ONDA, 50, "ffbfeaff", 40);
                        once(c, p.clone().add(0, 0.3, 0), FX_ONDA, 28, "ffffffff", 40);
                        for (int k = 0; k < 6; k++) {
                            double a = k * Math.PI / 3 + c.rnd.nextDouble();
                            once(c, c.ground(p.clone().add(Math.cos(a) * 9, 4, Math.sin(a) * 9)), FX_PILAR, 0.9f, "ff9fdcff", 34);
                        }
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
                        Vector face = forward(yaw);
                        s.key(41, g.clone().add(face.clone().multiply(3)).add(0, 1.6, 0), g.clone().add(0, 1.5, 0), 55, CUT);
                        s.key(75, g.clone().add(face.clone().multiply(2.6)).add(0, 1.7, 0), g.clone().add(0, 1.6, 0), 52, LINEAR);
                        c.cam(s);
                    }
                    if (plain && since > 15 && since < 40) CineFx.wave(c.w, (Location) get(c, "det"), (since - 15) * 40.0 / 25, 0xcff4ff);
                    if (since == 26) {
                        size(sphere, 0.02f, 16);
                        o.radius(0.05f, 3f, 16);
                    }
                    if (since == 40) c.skyReset();
                    if (since == 44) {
                        o.remove();
                        remove(sphere);
                        c.anim(goku, A_POSE_FINAL);
                    }
                    if (since == 62) vanish(c, GOKU, goku, 0xffb04a, 28, aura);
                    if (since >= 96) e.finish(c, false);
                }
            }
        });
    }

    /* ================================= MIL CORTES: TEMPLO DEL MAL ================================= */

    private void milCortes() {
        e.register(new CineEngine.Ability("mil_cortes", "MIL CORTES", "#ff3b3b", 300, 300, "Un rey maldito forma su sello, su templo emerge del suelo bajo un cielo carmesí y mil cortes rebanan todo hasta el tajo en cruz") {
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
                Location sh = c.ground(at.clone().add(forward(yaw).multiply(-c.cfg("distanciaSantuario", 14.0))).add(0, 4, 0));
                c.data.put("shAt", sh);
                c.target.addPotionEffect(new PotionEffect(PotionEffectType.SLOWNESS, 215, 9, false, false));
                Vector face = forward(yaw);
                CineNet.Shot s = c.shot();
                // 0–60: plano medio frontal; primer plano de las manos durante el sello.
                s.key(0, at.clone().add(face.clone().multiply(4.5)).add(0, 1.5, 0), at.clone().add(0, 1.4, 0), 58, LINEAR);
                s.key(19, at.clone().add(face.clone().multiply(4.0)).add(0, 1.5, 0), at.clone().add(0, 1.4, 0), 56, LINEAR);
                s.key(20, at.clone().add(face.clone().multiply(1.8)).add(0, 1.2, 0), at.clone().add(0, 1.15, 0), 50, CUT);
                s.key(59, at.clone().add(face.clone().multiply(1.6)).add(0, 1.25, 0), at.clone().add(0, 1.2, 0), 48, LINEAR);
                // 60–95: plano general bajo desde detrás del objetivo: el rey delante y el templo emergiendo detrás.
                Vector toSk = at.toVector().subtract(c.feet().toVector()).setY(0).normalize();
                s.key(60, c.feet().subtract(toSk.clone().multiply(4)).add(0, 0.6, 0), sh.clone().add(0, 6, 0), 85, CUT);
                s.key(95, c.feet().subtract(toSk.clone().multiply(5)).add(0, 0.5, 0), sh.clone().add(0, 8, 0), 85, LINEAR);
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                ItemDisplay sk = get(c, "sk");
                Location skAt = get(c, "skAt");
                Location shAt = get(c, "shAt");
                boolean plain = !CineNet.hasMod(c.target);
                double radius = c.cfg("radio", 10.0);
                if (t < 205) c.target.setVelocity(new Vector(0, Math.min(0, c.target.getVelocity().getY()), 0));
                if (t == 14) {
                    // La voz dura 9,5 s: «Extensión de dominio» (0 s) · «Templo del mal» (2,3 s) · crescendo de cortes (4–9 s).
                    boolean voiced = c.voice("sukuna");
                    c.data.put("voiced", voiced);
                    c.anim(sk, A_SELLO);
                    if (!voiced) c.sound(skAt, "sukuna.dominio", 3f, 0.55f);
                    c.say("sukuna_dominio", "Extensión de dominio…", 0xff4040, 44);
                    c.data.put("aura", vfx(c, skAt, FX_AURA, 2.3f, "ffff2030"));
                    c.sound(skAt, "aura.vibrar", 1.5f, 0.85f);
                }
                if (t == 60) {
                    c.say("sukuna_templo", "Templo del mal.", 0xffd0d0, 44);
                    // La construcción tiene raíces de netherrack bajo el templo: se entierran para que quede asentado.
                    double alto = c.cfg("alturaSantuario", 20.0);
                    Location shBase = shAt.clone().add(0, -alto * c.cfg("enterrarSantuario", 0.3), 0);
                    ItemDisplay santuario = character(c, shBase, (float) c.data.get("yaw"), SANTUARIO, A_EMERGER, (float) (alto / ALTO_SANTUARIO), 0x3a0000);
                    santuario.setDisplayWidth((float) alto * 2.5f); // caja de dibujo grande: que no desaparezca al salir de cuadro
                    santuario.setDisplayHeight((float) alto * 2f);
                    c.data.put("santuario", santuario);
                    c.sky(CineNet.SKY_TINT, 0x3a0000, 240);
                    c.vignette(0xc0200000, 15, 190, 25);
                    c.shake(0.7, 50, 0.97);
                    if (!(boolean) c.data.get("voiced")) c.sound(shAt, "cortes.dominio", 3f, 0.6f);
                    once(c, c.ground(c.feet()).add(0, 0.2, 0), FX_ONDA, 30, "ffff1020", 30);
                    c.data.put("rayos", vfx(c, shAt.clone().add(0, alto * 0.45, 0), FX_RAYOS, (float) (alto * 0.55), "ffff2030"));
                }
                if (plain && t > 60 && t < 110 && t % 3 == 0) {
                    CineFx.part(c.w, Particle.CAMPFIRE_COSY_SMOKE, shAt.clone().add(c.rnd.nextGaussian() * 6, 0.3, c.rnd.nextGaussian() * 6), 2, 0.5, 0.02);
                    CineFx.ring(c.w, c.ground(c.feet()).add(0, 0.12, 0), 2 + (t - 60) * 0.2, 0x3a0000, 1.6f, t * 0.03);
                }
                if (t == 96) {
                    c.anim(sk, A_IDLE_DOMINIO);
                    c.tint(0x60ff0000, 2, 4, 10); // pulso rojo
                    // Los cortes los dibuja el mod (tajos de energía de cara a la cámara) dentro del dominio.
                    ItemDisplay cortes = vfx(c, c.feet(), FX_CORTES, (float) radius, null);
                    c.anim(cortes, "cortar");
                    c.data.put("cortes", cortes);
                    c.screenSlashes(0xff2030, 100);
                }
                if (t >= 96 && t < 196) {
                    if ((t - 96) % 10 == 0) {
                        // Montaje: corte de cámara cada 10 ticks entre 6 planos.
                        int k = ((t - 96) / 10) % 6;
                        Location pos = switch (k) {
                            case 0 -> c.around(c.feet(), 30, 2.4, 1.4);
                            case 1 -> c.feet().add(0.01, 12, 0);
                            case 2 -> c.around(c.feet(), 200, 3, 0.3);
                            case 3 -> skAt.clone().add(forward((float) c.data.get("yaw")).multiply(3)).add(0, 1.6, 0);
                            case 4 -> c.around(c.feet(), 300, 2.0, 1.8);
                            default -> c.around(c.feet(), 90, 8, 1.0);
                        };
                        Location look = k == 3 ? skAt.clone().add(0, 1.5, 0) : c.eye();
                        CineNet.Shot s = c.shot();
                        s.key(0, pos, look, 70, CUT);
                        c.cam(s);
                        c.shake(0.2 + (t - 96) / 100.0 * 0.5, 10, 1.0);
                    }
                    ItemDisplay cortes = get(c, "cortes");
                    if (t % 5 == 0) cortes.teleport(c.feet());
                    slashes(c, t, plain);
                }
                if (t == 176) {
                    CineNet.Shot s = c.shot();
                    s.key(0, c.around(c.feet(), 0, 4.5, 1.5), c.eye(), 62, CUT);
                    s.key(23, c.around(c.feet(), 0, 4.2, 1.5), c.eye(), 60, LINEAR);
                    // 200: plano general lejano con el templo de fondo para ver la cruz.
                    Vector toSh = shAt.toVector().subtract(c.feet().toVector()).setY(0).normalize();
                    Location far = c.feet().subtract(toSh.clone().multiply(28)).add(0, 9, 0);
                    s.key(24, far, mid(c.feet(), shAt, 0.4).add(0, 4, 0), 70, CUT);
                    s.key(110, far.clone().add(0, 2, 0), mid(c.feet(), shAt, 0.4).add(0, 4, 0), 70, LINEAR);
                    c.cam(s);
                }
                if (t == 190) c.anim(sk, A_CORTE_FINAL);
                if (t == 200) {
                    ItemDisplay cortes = get(c, "cortes");
                    cortes.teleport(c.feet());
                    size(cortes, 12, 0);
                    c.anim(cortes, "cruz");
                    cross(c, plain);
                }
                if (plain && t > 200 && t < 240 && t % 2 == 0) CineFx.part(c.w, Particle.CRIMSON_SPORE, c.feet().add(0, 1, 0), 12, 3, 0.02);
                if (t == 236) {
                    c.anim(get(c, "santuario"), A_HUNDIRSE);
                    vanish(c, SUKUNA, sk, 0xff3040, 30, (Entity) get(c, "aura"), (Entity) get(c, "rayos"));
                    c.sound(shAt, "cortes.dominio", 2f, 0.9f);
                }
                // El templo se hunde y a la vez se desvanece.
                if (t == 244) c.anim(get(c, "santuario"), "disolver:1700");
                if (t == 258) c.skyReset();
                if (t == 280) remove(sk, get(c, "santuario"), get(c, "stand_" + SUKUNA), get(c, "stand_" + SANTUARIO), get(c, "cortes"));
                if (t >= 286) e.finish(c, false);
            }

            /** Ráfaga: `cortesPorTick` planos de corte con orientación aleatoria (semilla) dentro del dominio: rompen bloques y dañan. */
            void slashes(CineEngine.Ctx c, int t, boolean plain) {
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
                    // Sin mod, el tajo se ve como una lámina blanca; con mod lo dibuja el shader.
                    if (plain) fx.slash(at, along, normal, (float) len, 0.08f, Material.WHITE_CONCRETE, 0xffffff, 3);
                    if (c.cfgB("romperBloques", true)) {
                        List<Block> cut = new ArrayList<>();
                        for (Block b : world.slabPlane(at, along, normal, len, 1)) if (!b.getType().isAir()) cut.add(b);
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
            void cross(CineEngine.Ctx c, boolean plain) {
                Location center = c.feet().add(0, 1, 0);
                Vector fwd = forward(c.yaw0);
                Vector right = fwd.clone().crossProduct(new Vector(0, 1, 0)).normalize();
                Vector d1 = fwd.clone().add(new Vector(0, 0.9, 0)).normalize();
                Vector d2 = fwd.clone().add(new Vector(0, -0.9, 0)).normalize();
                if (plain) {
                    fx.slash(center, d1, right, 30, 0.5f, Material.RED_CONCRETE, 0xff2020, 16);
                    fx.slash(center, d2, right, 30, 0.5f, Material.WHITE_CONCRETE, 0xffffff, 16);
                }
                if (c.cfgB("romperBloques", true)) {
                    world.enqueueSorted(world.slabPlane(center, d1, right, 30, 1), center, true, Material.AIR);
                    world.enqueueSorted(world.slabPlane(center, d2, right, 30, 1), center, true, Material.AIR);
                }
                once(c, c.ground(center.clone()).add(0, 0.2, 0), FX_ONDA, 36, "ffff1020", 36);
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
        e.register(new CineEngine.Ability("vacio_purpura", "VACÍO PÚRPURA", "#9b30ff", 480, 480, "Azul en una mano, rojo en la otra: se funden en un orbe púrpura que avanza borrando todo y arrastra al objetivo") {
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
                c.data.put("voiced", false);
                c.sound(at, "gojo.aparicion", 2f, 1f);
                Vector face = forward(yaw);
                Vector side = face.clone().crossProduct(new Vector(0, 1, 0)).normalize();
                Location hands = at.clone().add(0, 1.3, 0).add(face.clone().multiply(0.5));
                CineNet.Shot s = c.shot();
                // 0–20: plano medio del hechicero apareciendo.
                s.key(0, at.clone().add(face.clone().multiply(4.6)).add(0, 1.5, 0), at.clone().add(0, 1.3, 0), 60, LINEAR);
                s.key(19, at.clone().add(face.clone().multiply(4.1)).add(0, 1.5, 0), at.clone().add(0, 1.3, 0), 58, LINEAR);
                // 20–83: primer plano de la mano del azul; 84–129: la del rojo.
                s.key(20, at.clone().add(face.clone().multiply(2.7)).add(side.clone().multiply(2.0)).add(0, 1.5, 0), hands.clone().add(side.clone().multiply(0.7)), 52, CUT);
                s.key(83, at.clone().add(face.clone().multiply(2.3)).add(side.clone().multiply(1.6)).add(0, 1.6, 0), hands.clone().add(side.clone().multiply(0.7)), 50, LINEAR);
                s.key(84, at.clone().add(face.clone().multiply(2.7)).add(side.clone().multiply(-2.0)).add(0, 1.5, 0), hands.clone().add(side.clone().multiply(-0.7)), 52, CUT);
                s.key(129, at.clone().add(face.clone().multiply(2.3)).add(side.clone().multiply(-1.6)).add(0, 1.6, 0), hands.clone().add(side.clone().multiply(-0.7)), 50, LINEAR);
                // 130–215: frontal bajo mientras las dos esferas giran una hacia la otra.
                s.key(130, at.clone().add(face.clone().multiply(4.6)).add(0, 0.8, 0), hands, 62, CUT);
                s.key(215, at.clone().add(face.clone().multiply(3.4)).add(0, 1.0, 0), hands, 56, EASE_IN_OUT);
                // 216–303: por encima del hombro, con el púrpura creciendo y el objetivo al fondo.
                s.key(216, at.clone().add(face.clone().multiply(-4.2)).add(side.clone().multiply(2.2)).add(0, 2.7, 0), at.clone().add(face.clone().multiply(8)).add(0, 1.5, 0), 70, CUT);
                s.key(303, at.clone().add(face.clone().multiply(-7)).add(side.clone().multiply(3)).add(0, 3.4, 0), at.clone().add(face.clone().multiply(8)).add(0, 1.8, 0), 76, EASE_IN_OUT);
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                ItemDisplay gj = get(c, "gj");
                Location at = get(c, "at");
                float yaw = (float) c.data.get("yaw");
                boolean plain = !CineNet.hasMod(c.target);
                boolean voiced = (boolean) c.data.get("voiced");
                Vector face = forward(yaw);
                Vector side = face.clone().crossProduct(new Vector(0, 1, 0)).normalize();
                Location p0 = at.clone().add(0, PROY_ALTO, 0).add(face.clone().multiply(PROY_DELANTE));
                if (t == 20) {
                    // Voz (19,4 s): «…azul» 0 s · «…rojo» 3,2 s · zumbido 5,5–9,7 s · fusión 9,8 s · «¡Púrpura!» 14 s · explosión 16,6 s.
                    voiced = c.voice("gojo");
                    c.data.put("voiced", voiced);
                    c.anim(gj, A_CARGA);
                    if (!voiced) c.sound(at, "gojo.carga", 1.5f, 0.8f);
                }
                if (t == 22) {
                    c.say("gojo_azul", "Ritual maldito de amplificación: Azul.", 0x5a9bff, 46);
                    ItemDisplay blue = vfx(c, at.clone().add(0, 1, 0), FX_AZUL, 0.01f, null);
                    c.attach(blue, gj, B_MANO_IZQ, 0, 0, 0);
                    size(blue, 0.3f, 34);
                    c.data.put("blue", blue);
                }
                if (t == 84) {
                    c.say("gojo_rojo", "Ritual maldito de inversión: Rojo.", 0xff5050, 46);
                    ItemDisplay red = vfx(c, at.clone().add(0, 1, 0), FX_ROJO, 0.01f, null);
                    c.attach(red, gj, B_MANO_DER, 0, 0, 0);
                    size(red, 0.3f, 34);
                    c.data.put("red", red);
                }
                if (plain && t > 22 && t < 216 && t % 3 == 0) {
                    CineFx.dot(c.w, at.clone().add(side.clone().multiply(0.9)).add(0, 1.2, 0).add(face.clone().multiply(0.5)), 0x3a7bff, 1.2f);
                    if (t > 84) CineFx.dot(c.w, at.clone().add(side.clone().multiply(-0.9)).add(0, 1.2, 0).add(face.clone().multiply(0.5)), 0xff3030, 1.2f);
                }
                if (t == 130) {
                    size(get(c, "blue"), 0.42f, 80);
                    size(get(c, "red"), 0.42f, 80);
                }
                if (t >= 130 && t < 216) {
                    // Las dos esferas dejan las manos y giran en espiral, cada vez más rápido y más cerca, hasta tocarse.
                    double f = (t - 130) / 86.0, th = f * f * 30, r = 1.0 * (1 - f) + 0.08;
                    Vector off = side.clone().multiply(Math.cos(th) * r).add(new Vector(0, Math.sin(th) * r * 0.6, 0));
                    Vector fw = face.clone().multiply(0.45);
                    c.attach(get(c, "blue"), gj, B_MANO_PROY, off.getX() + fw.getX(), off.getY(), off.getZ() + fw.getZ());
                    c.attach(get(c, "red"), gj, B_MANO_PROY, -off.getX() + fw.getX(), -off.getY(), -off.getZ() + fw.getZ());
                    if (t % 6 == 0) c.shake(0.15 + f * 0.6, 6, 0.9);
                    if (!voiced && t % 20 == 0) c.sound(at, "gojo.carga", 1.2f, 0.8f + (float) f);
                    if (plain && t % 2 == 0) CineFx.part(c.w, Particle.REVERSE_PORTAL, p0, 10, 1.2, 0.3);
                }
                if (t == 216) {
                    remove(get(c, "blue"), get(c, "red"));
                    ItemDisplay purple = vfx(c, p0, FX_PURPURA, 0.2f, null);
                    c.attach(purple, gj, B_MANO_PROY, face.getX() * 1.0, 0.2, face.getZ() * 1.0);
                    size(purple, 0.7f, 8);
                    c.data.put("purple", purple);
                    c.say("gojo_vacio", "Vacío…", 0xc58bff, 76);
                    c.flash(0xb050ff, 0, 3, 12);
                    c.shake(1.3, 16, 0.88);
                    c.sky(CineNet.SKY_TINT, 0x14002a, 200);
                    c.vignette(0xb0200040, 6, 120, 20);
                    once(c, p0.clone().add(face.clone().multiply(1.2)), FX_ONDA, 16, "ffb060ff", 30);
                    if (!voiced) c.sound(p0, "gojo.carga", 2f, 1.6f);
                    if (plain) CineFx.part(c.w, Particle.DRAGON_BREATH, p0, 40, 0.5, 0.08);
                }
                if (t > 216 && t < 304 && t % 8 == 0) {
                    // El púrpura crece delante de él, cada vez más inestable.
                    double r = 0.7 + 0.9 * (t - 216) / 88.0;
                    ItemDisplay purple = get(c, "purple");
                    size(purple, (float) r, 8);
                    c.attach(purple, gj, B_MANO_PROY, face.getX() * (r + 0.3), 0.2 + r * 0.25, face.getZ() * (r + 0.3));
                    c.shake(0.3 + (t - 216) / 88.0 * 0.6, 8, 0.95);
                    if (t >= 248 && t <= 288 && t % 16 == 8) once(c, p0.clone().add(face.clone().multiply(r + 0.3)), FX_ONDA, 12, "ffffffff", 24);
                }
                if (t == 296) c.say("gojo_purpura", "¡Púrpura!", 0xe0b0ff, 50);
                if (t == 304) {
                    c.anim(gj, A_DISPARO);
                    c.shake(1.0, 10, 0.85);
                    c.sound(at, "gojo.disparo", 3f, 0.7f);
                    ItemDisplay purple = get(c, "purple");
                    c.attach(purple, null, "", 0, 0, 0);
                    Location from = p0.clone().add(face.clone().multiply(2.4)).add(0, 0.7, 0);
                    purple.teleport(from);
                    c.anim(purple, "viajar");
                    size(purple, (float) c.cfg("radioOrbe", 3.0), 6);
                    once(c, from, FX_ONDA, 14, "ffb060ff", 24);
                    // Dirección fija hacia donde estaba el objetivo al disparar; la velocidad se ajusta para que
                    // lo alcance a mitad de recorrido y la detonación coincida con la del audio (tick 352).
                    Vector to = c.eye().toVector().subtract(from.toVector());
                    double dist = to.length();
                    c.data.put("speed", Math.max(c.cfg("velocidad", 0.6), Math.min(2.2, dist / 28.0)));
                    c.data.put("pos", from.clone());
                    c.data.put("start", from.clone());
                    c.data.put("dir", to.normalize());
                    Vector dir = get(c, "dir");
                    Vector lat = dir.clone().crossProduct(new Vector(0, 1, 0)).normalize().multiply(11);
                    CineNet.Shot s = c.shot().followPos(purple.getEntityId()).followLook(purple.getEntityId());
                    Location off = lat.add(new Vector(0, 3, 0)).add(dir.clone().multiply(4)).toLocation(c.w);
                    s.key(0, off, off, 72, CUT);
                    c.cam(s);
                }
                Integer det = get(c, "det");
                if (t > 304 && det == null) {
                    ItemDisplay purple = get(c, "purple");
                    Location pos = get(c, "pos");
                    Vector dir = get(c, "dir");
                    double speed = (double) c.data.get("speed");
                    pos.add(dir.clone().multiply(speed));
                    purple.teleport(pos);
                    // a) Borra lo que toca (esfera continua, por la cola con presupuesto).
                    world.enqueueSorted(world.sphere(pos, c.cfg("radioDestruccion", 3.0)), pos, true, Material.AIR);
                    // b) Atracción amortiguada; c) núcleo: sujeta en el centro y hace daño cada 10 ticks.
                    double ra = c.cfg("radioAtraccion", 10.0), rn = c.cfg("radioNucleo", 1.5) + speed;
                    for (Entity en : c.w.getNearbyEntities(pos, ra, ra, ra)) {
                        if (!(en instanceof LivingEntity le) || !CineWorld.affectable(en, c.launcher)) continue;
                        Vector to = pos.toVector().subtract(en.getLocation().add(0, 1, 0).toVector());
                        double d = to.length();
                        if (d < rn) {
                            CineWorld.hold(en, pos.clone().add(0, -1, 0));
                            if (t % 10 == 0) c.damage(le, c.cfg("danioTick", 2.0), true);
                        } else if (d < ra) {
                            Vector v = to.normalize().multiply(Math.min(0.9, 0.25 + (ra - d) * 0.06));
                            en.setVelocity(en.getVelocity().multiply(0.5).add(v).add(dir.clone().multiply(speed * 0.8)));
                            en.setFallDistance(0);
                        }
                    }
                    if (plain && t % 2 == 0) {
                        CineFx.part(c.w, Particle.DRAGON_BREATH, pos, 10, 2.2, 0.02);
                        CineFx.part(c.w, Particle.REVERSE_PORTAL, pos, 20, 3.5, 0.2);
                        if (t % 3 == 0) CineFx.ring(c.w, pos, 3.4, 0xa64dff, 1.8f, t * 0.2);
                    }
                    if (t % 4 == 0) c.shake(0.5, 5, 0.95);
                    boolean done = t >= 352 || pos.distance((Location) get(c, "start")) >= c.cfg("distanciaMax", 80.0);
                    if (done) detonate(c, t, pos);
                }
                det = get(c, "det");
                if (det != null) {
                    int since = t - det;
                    Location p = get(c, "detAt");
                    if (plain && since < 20) CineFx.wave(c.w, p, since * 20.0 / 20, since % 2 == 0 ? 0xffffff : 0x9b30ff);
                    if (since == 14) size(get(c, "purple"), 0.02f, 14);
                    if (since == 30) {
                        remove((Entity) get(c, "purple"));
                        c.anim(gj, A_POSE_FINAL);
                    }
                    if (since == 50) c.skyReset();
                    if (since == 58) vanish(c, GOJO, gj, 0x9a6bff, 28);
                    if (since >= 92) e.finish(c, false);
                }
            }

            void detonate(CineEngine.Ctx c, int t, Location pos) {
                c.data.put("det", t);
                c.data.put("detAt", pos.clone());
                int rd = c.cfgI("radioDetonacion", 7);
                world.enqueueSorted(world.sphere(pos, rd), pos, true, Material.AIR);
                ItemDisplay purple = get(c, "purple");
                c.anim(purple, "detonar");
                size(purple, rd * 1.5f, 5);
                once(c, pos, FX_ONDA, 55, "ffb060ff", 40);
                once(c, pos, FX_ONDA, 30, "ffffffff", 40);
                c.flash(0xe8c8ff, 0, 6, 22);
                c.shake(2.6, 34, 0.9);
                c.sound(pos, "gojo.detonacion", 4f, 0.6f);
                if (!CineNet.hasMod(c.target)) CineFx.part(c.w, Particle.EXPLOSION_EMITTER, pos, 3, 2, 0);
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
                s.key(29, c.around(pos, 150, 29, 10), pos, 72, LINEAR);
                s.key(30, g.clone().add(face.clone().multiply(2.8)).add(0, 1.6, 0), g.clone().add(0, 1.5, 0), 55, CUT);
                s.key(68, g.clone().add(face.clone().multiply(2.4)).add(0, 1.7, 0), g.clone().add(0, 1.6, 0), 52, LINEAR);
                c.cam(s);
            }
        });
    }

    /* ========================================== AKAZA ========================================== */

    private void akaza() {
        e.register(new CineEngine.Ability("akaza", "AGUJA DE BRÚJULA", "#7fd8ff", 480, 480, "Un luchador despliega su brújula de hielo, se lanza sobre el objetivo con una ráfaga de golpes, lo eleva a puñetazos de aire y lo remata contra el suelo") {
            void start(CineEngine.Ctx c) {
                Location at = c.ground(c.feet().add(forward(c.yaw0).multiply(c.cfg("distanciaAparicion", 8.0))).add(0, 4, 0));
                float yaw = yawTo(at, c.feet());
                ItemDisplay ak = character(c, at, yaw, AKAZA, A_APARICION, ALTO_PERSONAJE / 2f, 0x282840);
                c.data.put("ak", ak);
                c.data.put("at", at);
                c.data.put("akPos", at.clone());
                c.data.put("yaw", yaw);
                c.data.put("pilares", new ArrayList<ItemDisplay>());
                c.data.put("cometas", new ArrayList<Object[]>());
                // Voz (19,5 s): «Muerte destructiva» 0,6 s · «Aguja de brújula» 5,3 s · golpe fuerte 12 s · remate 16 s.
                boolean voiced = c.voice("akaza");
                c.data.put("voiced", voiced);
                if (!voiced) c.sound(at, "akaza.aparicion", 2f, 0.7f);
                c.target.addPotionEffect(new PotionEffect(PotionEffectType.SLOWNESS, 238, 9, false, false));
                CineFx.part(c.w, Particle.BLOCK, at.clone().add(0, 0.2, 0), 40, 1.5, 0.1, 1.5, 0, at.clone().add(0, -1, 0).getBlock().getBlockData());
                once(c, at.clone().add(0, 0.2, 0), FX_ONDA, 8, "ffff7fae", 24);
                Vector back = c.feet().toVector().subtract(at.toVector()).setY(0).normalize();
                Vector lat = back.clone().crossProduct(new Vector(0, 1, 0)).normalize();
                Location m = mid(at, c.feet(), 0.5);
                CineNet.Shot s = c.shot();
                // 0–104: plano medio del luchador que lo rodea despacio.
                s.key(0, at.clone().add(back.clone().multiply(4.6)).add(lat.clone().multiply(1.6)).add(0, 1.2, 0), at.clone().add(0, 1.3, 0), 60, LINEAR);
                s.key(104, at.clone().add(back.clone().multiply(3.3)).add(lat.clone().multiply(-1.4)).add(0, 1.6, 0), at.clone().add(0, 1.3, 0), 54, EASE_IN_OUT);
                // 105–150: picado para ver la brújula dibujarse entera; 151–171: lateral bajo con los dos.
                s.key(105, at.clone().add(back.clone().multiply(2)).add(0, 16, 0), at, 72, CUT);
                s.key(150, at.clone().add(back.clone().multiply(5)).add(0, 11, 0), at, 70, EASE_IN_OUT);
                s.key(151, m.clone().add(lat.clone().multiply(10)).add(0, 1.3, 0), m.clone().add(0, 1.4, 0), 72, CUT);
                s.key(171, m.clone().add(lat.clone().multiply(9)).add(0, 1.0, 0), m.clone().add(0, 1.4, 0), 70, LINEAR);
                c.cam(s);
            }

            void tick(CineEngine.Ctx c, int t) {
                ItemDisplay ak = get(c, "ak");
                Location at = get(c, "at");
                float yaw = (float) c.data.get("yaw");
                boolean plain = !CineNet.hasMod(c.target);
                boolean voiced = (boolean) c.data.get("voiced");
                double rc = c.cfg("radioCopo", 10.0);
                List<ItemDisplay> pilares = get(c, "pilares");
                Vector back = c.feet().toVector().subtract(at.toVector()).setY(0);
                back = back.lengthSquared() < 0.01 ? forward(yaw) : back.normalize();
                if (t < 240) c.target.setVelocity(new Vector(0, Math.min(0, c.target.getVelocity().getY()), 0));
                if (t == 12) {
                    c.say("akaza_muerte", "Muerte destructiva…", 0xff7fae, 80);
                    c.data.put("aura", vfx(c, at, FX_AURA, 2.3f, "ffff5a9a"));
                    c.sound(at, "aura.vibrar", 1.5f, 1f);
                }
                if (t == 105) {
                    c.anim(ak, A_DESPLIEGUE);
                    if (!voiced) c.sound(at, "akaza.despliegue", 2f, 0.9f);
                    c.say("akaza_brujula", "¡Aguja de brújula!", 0x7fd8ff, 60);
                    c.vignette(0x9000183a, 10, 220, 20);
                    c.sky(CineNet.SKY_TINT, 0x00102c, 300);
                    // La brújula se calca sobre el terreno bloque a bloque (sigue el relieve: no parpadea ni lo atraviesa).
                    ItemDisplay bruj = vfx(c, at.clone().add(0, 0.05, 0), FX_BRUJULA, (float) rc, "ff6fd0ff");
                    c.anim(bruj, "trazar");
                    c.data.put("copo", bruj);
                    once(c, at.clone().add(0, 0.2, 0), FX_ONDA, (float) rc, "ff7fd8ff", 30);
                    c.shake(0.6, 20, 0.92);
                }
                if (plain && t >= 105 && t < 330 && t % 2 == 0) {
                    // Sin el mod: el mismo patrón con partículas, trazado desde el centro en 30 ticks.
                    double prog = Math.min(1, (t - 105) / 30.0);
                    CineFx.glyph(c.w, at.clone().add(0, 0.15, 0), rc, 3, 12, prog, 0, t > 322 ? 0xff3030 : 0x7fd8ff, 0xffffff);
                }
                if (t >= 120 && t < 168 && (t - 120) % 4 == 0) {
                    // Un pilar de luz en cada una de las 12 puntas, una tras otra.
                    int k = (t - 120) / 4;
                    double a = Math.toRadians(k * 30 - 90), f = k % 2 == 0 ? 0.95 : 0.68;
                    Location n = c.ground(at.clone().add(Math.cos(a) * rc * f, 3, Math.sin(a) * rc * f));
                    pilares.add(vfx(c, n, FX_PILAR, k % 2 == 0 ? 0.42f : 0.28f, "ff7fd8ff"));
                    c.sound(n, "akaza.despliegue", 0.8f, 0.9f + k * 0.08f);
                }
                if (t == 172) {
                    // Embestida: cruza la distancia en 8 ticks dejando una estela.
                    c.anim(ak, "rafaga");
                    c.data.put("cometa", vfx(c, at.clone().add(0, 1.2, 0), FX_COMETA, 0.7f, "ff7fd8ff"));
                    c.data.put("dashTo", c.feet().subtract(back.clone().multiply(1.6)));
                    c.sound(at, "akaza.rafaga", 2f, 0.7f);
                    Location m = mid(at, c.feet(), 0.8);
                    Vector lat = back.clone().crossProduct(new Vector(0, 1, 0)).normalize();
                    CineNet.Shot s = c.shot();
                    s.key(0, m.clone().add(lat.clone().multiply(6)).add(0, 1.4, 0), c.eye(), 74, CUT);
                    s.key(9, m.clone().add(lat.clone().multiply(4.5)).add(back.clone().multiply(1.5)).add(0, 1.5, 0), c.eye(), 66, EASE_OUT_EXPO);
                    c.cam(s);
                }
                if (t >= 172 && t <= 180) {
                    Location to = get(c, "dashTo");
                    Location p = mid(at, to, ease((t - 172) / 8.0));
                    p.setY(c.ground(p.clone().add(0, 2, 0)).getY());
                    c.data.put("akPos", p);
                    moveChar(c, AKAZA, ak, p, yaw, (Entity) get(c, "aura"));
                    Entity cm = get(c, "cometa");
                    if (cm != null && cm.isValid()) cm.teleport(p.clone().add(0, 1.2, 0));
                }
                if (t == 184) remove((Entity) get(c, "cometa"));
                if (t >= 182 && t < 238) {
                    if ((t - 182) % 4 == 0) {
                        // Ráfaga: un impacto cada 4 ticks.
                        Location hit = c.eye().add(c.rnd.nextGaussian() * 0.35, -0.5 + c.rnd.nextGaussian() * 0.4, c.rnd.nextGaussian() * 0.35);
                        once(c, hit, FX_GOLPE, 0.7f + c.rnd.nextFloat() * 0.5f, ((t - 182) / 4) % 2 == 0 ? "ff7fd8ff" : "ffff6fae", 14);
                        c.shake(0.45, 4, 0.9);
                        c.damage(c.target, c.cfg("danioGolpe", 0.5), true);
                        c.sound(hit, "akaza.punetazo", 1f, 0.8f + c.rnd.nextFloat() * 0.6f);
                    }
                    if ((t - 182) % 14 == 0) {
                        int k = (t - 182) / 14;
                        CineNet.Shot s = c.shot();
                        Location pos = c.around(c.feet(), new double[] {70, 250, 120, 300}[k % 4], k % 2 == 0 ? 3.4 : 4.6, k % 2 == 0 ? 1.5 : 0.7);
                        s.key(0, pos, c.eye().add(0, -0.3, 0), 68, CUT);
                        c.cam(s);
                    }
                }
                if (t == 240) {
                    // Gancho: el objetivo sale despedido hacia arriba.
                    Location hit = c.eye();
                    once(c, hit, FX_GOLPE, 2.4f, "ffffffff", 16);
                    once(c, c.ground(c.feet().add(0, 1, 0)).add(0, 0.2, 0), FX_ONDA, 14, "ff7fd8ff", 30);
                    c.flash(0xe6f8ff, 0, 2, 8);
                    c.shake(1.6, 16, 0.88);
                    if (!voiced) c.sound(hit, "akaza.golpe", 2f, 1.1f);
                    c.target.removePotionEffect(PotionEffectType.SLOWNESS);
                    c.target.setVelocity(new Vector(0, c.cfg("impulsoGancho", 1.7), 0));
                    c.damage(c.target, c.cfg("danioGolpe", 0.5) * 4, true);
                    c.anim(ak, "rafaga_arriba");
                    Vector lat = back.clone().crossProduct(new Vector(0, 1, 0)).normalize().multiply(3.6);
                    CineNet.Shot s = c.shot().followPos(c.target.getEntityId()).followLook(c.target.getEntityId());
                    Location off = lat.add(new Vector(0, -1.5, 0)).add(back.clone().multiply(2)).toLocation(c.w);
                    s.key(0, off, off, 78, CUT);
                    c.cam(s);
                }
                if (t > 252 && t < 322) {
                    // Lo mantiene en el aire a puñetazos de aire.
                    c.target.setVelocity(new Vector(0, 0.05, 0));
                    c.target.setFallDistance(0);
                }
                List<Object[]> cometas = get(c, "cometas");
                if (t >= 250 && t < 314 && (t - 250) % 5 == 0) {
                    Location akPos = get(c, "akPos");
                    Location from = akPos.clone().add(c.rnd.nextGaussian() * 0.5, 2.3, c.rnd.nextGaussian() * 0.5);
                    ItemDisplay cm = c.actor(fx.itemDisplay(from, new ItemStack(Material.AIR), 1f, 16));
                    cm.setTeleportDuration(5);
                    cm.setDisplayWidth(60f);
                    cm.setDisplayHeight(60f);
                    c.model(cm, FX_COMETA, "idle", 1f);
                    c.anim(cm, "color:" + (((t - 250) / 5) % 2 == 0 ? "ff7fd8ff" : "ffff6fae"));
                    size(cm, 0.45f, 0);
                    cometas.add(new Object[] {cm, t + 1, t + 6});
                    c.sound(from, "akaza.rafaga", 0.9f, 1.2f + c.rnd.nextFloat() * 0.5f);
                }
                for (java.util.Iterator<Object[]> it = cometas.iterator(); it.hasNext(); ) {
                    Object[] o = it.next();
                    ItemDisplay cm = (ItemDisplay) o[0];
                    if (t == (int) o[1] && cm.isValid()) cm.teleport(c.eye().add(0, -0.4, 0));
                    if (t >= (int) o[2]) {
                        Location hit = c.eye().add(0, -0.4, 0);
                        once(c, hit, FX_GOLPE, 1.1f, "ffbfeaff", 14);
                        c.shake(0.5, 5, 0.9);
                        c.damage(c.target, c.cfg("danioGolpe", 0.5), true);
                        c.sound(hit, "akaza.punetazo", 1f, 1.1f);
                        remove(cm);
                        it.remove();
                    }
                }
                if (t == 322) {
                    // Remate: aparece encima y lo hunde contra el suelo.
                    Location above = c.target.getLocation().add(0, 2.6, 0);
                    c.data.put("akPos", above);
                    moveChar(c, AKAZA, ak, above, yaw, (Entity) get(c, "aura"));
                    c.anim(ak, A_GOLPE_SUELO);
                    once(c, c.eye(), FX_GOLPE, 3f, "ffff4060", 16);
                    c.flash(0xffd0d8, 0, 2, 8);
                    c.target.setVelocity(new Vector(0, -3, 0));
                    for (ItemDisplay p : pilares) c.anim(p, "color:ffff3040");
                    c.anim(get(c, "copo"), "color:ffff3040");
                    Location g = c.ground(c.target.getLocation());
                    CineNet.Shot s = c.shot();
                    s.key(0, c.around(g, 60, 17, 4), c.target.getLocation(), 76, CUT);
                    s.key(12, c.around(g, 62, 17, 4), g, 76, LINEAR);
                    s.key(60, c.around(g, 75, 20, 7), g, 72, LINEAR);
                    c.cam(s);
                }
                Integer imp = get(c, "imp");
                if (t > 324 && imp == null && (((Entity) c.target).isOnGround() || t >= 344)) {
                    c.data.put("imp", t);
                    impact(c, c.ground(c.target.getLocation().add(0, 1, 0)), back);
                }
                imp = get(c, "imp");
                if (imp != null) {
                    int since = t - imp;
                    if (since == 8) {
                        // El luchador cae junto al cráter y adopta su pose.
                        Location p = get(c, "impAt");
                        Location land = c.ground(p.clone().subtract(back.clone().multiply(c.cfgI("radioCrater", 7) + 2)).add(0, 4, 0));
                        c.data.put("akPos", land);
                        moveChar(c, AKAZA, ak, land, yaw, (Entity) get(c, "aura"));
                        c.anim(ak, A_POSE_FINAL);
                    }
                    if (since == 14) for (ItemDisplay p : pilares) c.anim(p, "fin");
                    if (since == 24) {
                        c.anim(get(c, "copo"), "desvanecer");
                        Location land = get(c, "akPos");
                        Vector face = forward(yaw);
                        CineNet.Shot s = c.shot();
                        s.key(0, land.clone().add(face.clone().multiply(3.4)).add(0, 1.5, 0), land.clone().add(0, 1.3, 0), 58, CUT);
                        s.key(44, land.clone().add(face.clone().multiply(2.8)).add(0, 1.6, 0), land.clone().add(0, 1.4, 0), 54, LINEAR);
                        c.cam(s);
                    }
                    if (since == 30) for (ItemDisplay p : pilares) remove(p);
                    if (since == 50) remove((Entity) get(c, "copo"));
                    if (since == 56) vanish(c, AKAZA, ak, 0x7fd8ff, 28, (Entity) get(c, "aura"));
                    if (since >= 90) e.finish(c, false);
                }
            }

            void impact(CineEngine.Ctx c, Location p, Vector back) {
                c.data.put("impAt", p.clone());
                world.bowlCrater(p.clone().add(0, -1, 0), c.cfgI("radioCrater", 7), 4, false, 0, 0, 0, c.rnd);
                once(c, p.clone().add(0, 0.3, 0), FX_ONDA, 36, "ffff3040", 40);
                once(c, p.clone().add(0, 0.3, 0), FX_ONDA, 20, "ffffffff", 40);
                once(c, p, FX_PILAR, 1.8f, "ffff3040", 30);
                once(c, p.clone().add(0, 1, 0), FX_GOLPE, 5f, "ffffffff", 16);
                c.anim(get(c, "copo"), "golpe");
                if (!CineNet.hasMod(c.target)) {
                    // Explosión solo visual (nunca la explosión vanilla).
                    CineFx.part(c.w, Particle.EXPLOSION_EMITTER, p, 2, 1, 0);
                    CineFx.part(c.w, Particle.SNOWFLAKE, p.clone().add(0, 1, 0), 80, 3, 0.4);
                    for (int k = 0; k < 3; k++) CineFx.wave(c.w, p.clone().add(0, 0.2, 0), 4 + k * 6, k == 1 ? 0x7fd8ff : 0xffffff);
                }
                CineFx.part(c.w, Particle.BLOCK, p, 60, 3, 0.5, 3, 0.2, p.clone().add(0, -1, 0).getBlock().getBlockData());
                c.flash(0xffe6ea, 0, 4, 16);
                c.shake(2.6, 30, 0.9);
                c.sound(p, "akaza.golpe", 4f, 0.7f);
                c.finalHit(c.target, c.cfg("danio", 20.0));
                world.areaDamage(p, 7, c.cfg("danio", 20.0) * 0.6, c.launcher, c.target.getUniqueId());
                CineWorld.radial(p, 14, c.cfg("knockbackHorizontal", 2.5), c.cfg("knockbackVertical", 1.2), c.launcher, c.target.getUniqueId());
                // 40 bloques del cráter salen volando.
                for (int k = 0; k < 40; k++) {
                    double a = c.rnd.nextDouble() * Math.PI * 2;
                    Block b = c.ground(p.clone().add(Math.cos(a) * 3, 2, Math.sin(a) * 3)).add(0, -1, 0).getBlock();
                    Material m = b.getType().isSolid() ? b.getType() : Material.DIRT;
                    Vector v = new Vector(Math.cos(a) * (0.4 + c.rnd.nextDouble() * 0.6), 0.7 + c.rnd.nextDouble() * 0.8, Math.sin(a) * (0.4 + c.rnd.nextDouble() * 0.6));
                    world.flyVisual(p.clone().add(0, 0.5, 0), m.createBlockData(), CineWorld.Path.LAUNCH, null, v, 40, 0);
                }
            }
        });
    }
}
