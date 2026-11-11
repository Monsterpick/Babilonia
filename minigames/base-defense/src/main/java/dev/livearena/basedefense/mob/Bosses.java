package dev.livearena.basedefense.mob;

import dev.livearena.basedefense.BaseDefense;
import dev.livearena.basedefense.Settings;
import dev.livearena.basedefense.util.Txt;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.Color;
import org.bukkit.Location;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.World;
import org.bukkit.attribute.Attribute;
import org.bukkit.entity.Entity;
import org.bukkit.entity.EntityType;
import org.bukkit.entity.Fireball;
import org.bukkit.entity.LargeFireball;
import org.bukkit.entity.Player;
import org.bukkit.entity.WitherSkull;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.ExplosionPrimeEvent;
import org.bukkit.event.entity.ProjectileHitEvent;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.util.Vector;

/**
 * Jefes: WITHER (calaveras a la base, se pueden destruir a tiros), DRAGÓN DEL END (bolas de fuego que se le pueden
 * devolver) y WARDEN (cañón sónico a distancia y embestidas contra la base). No desaparecen al llegar: se colocan
 * frente a la base y atacan hasta que los matas. Vida propia en BossBar y furia al bajar de vida.
 */
public final class Bosses implements Listener {
    private final BaseDefense plugin;
    private final List<GameMob> bosses = new ArrayList<>();
    private final Map<UUID, Ball> balls = new LinkedHashMap<>();
    private long lastWarnTitle;

    public enum Kind { FUEGO, CALAVERA }

    /** Proyectil de un jefe controlado por el plugin (va hacia la base o vuelve a su dueño). */
    public static final class Ball {
        final Fireball e;
        final GameMob owner;
        final Kind kind;
        boolean returned;
        final long born;

        Ball(Fireball e, GameMob owner, Kind kind, long born) {
            this.e = e;
            this.owner = owner;
            this.kind = kind;
            this.born = born;
        }

        public Fireball entity() {
            return e;
        }

        public boolean returned() {
            return returned;
        }

        public Kind kind() {
            return kind;
        }
    }

    /** Estado de ataque de cada jefe (por id de entidad). */
    private static final class Combat {
        long nextAttack;
        long chargeAt = -1;      // warden: cuándo suelta el cañón sónico ya cargado
        boolean atBase;
        int ramPhase;            // 0 = retrocede, 1 = embiste
        long ramUntil;
        long nextSummon;
        // movimiento suave (aceleración, giro progresivo, retroceso al disparar)
        double vx, vz, kick, lift;
        float yaw = Float.NaN;
        long frozenUntil;        // quieto (animación de llegada, carga de un ataque, rugido)
        // wither: ráfaga de calaveras tras la carga
        int burstLeft, burstIdx;
        long nextBurst;
        int spawnAnim;           // wither: animación de aparición (cuenta atrás de «invulnerable»)
        int rams;                // warden: embestidas dadas (ruge cada tres)
    }

    private static float wrap(float a) {
        a %= 360f;
        return a > 180 ? a - 360 : a < -180 ? a + 360 : a;
    }

    /**
     * Paso de movimiento de un jefe (wither y warden): acelera y frena en vez de ir a velocidad fija, gira poco a poco,
     * retrocede al disparar y se queda quieto mientras carga un ataque. Devuelve la nueva posición.
     */
    Location step(GameMob gm, Location l, Vector target, double sp, double y) {
        Combat cb = combat.get(gm.entity.getUniqueId());
        Location to = l.clone();
        if (cb == null) return to;
        long now = plugin.tick();
        boolean flying = gm.boss.flying();
        boolean frozen = now < cb.frozenUntil;
        double dx = target.getX() - l.getX(), dz = target.getZ() - l.getZ();
        double len = Math.hypot(dx, dz);
        // frena al acercarse a su puesto (los que embisten no frenan)
        boolean ramming = cb.atBase && cb.ramPhase == 1;
        double want = frozen || len < 0.05 ? 0 : ramming ? sp : Math.min(sp, len * (flying ? 0.10 : 0.25) + 0.02);
        double k = flying ? 0.07 : ramming ? 0.35 : 0.22;
        cb.vx += ((len > 0 ? dx / len * want : 0) - cb.vx) * k;
        cb.vz += ((len > 0 ? dz / len * want : 0) - cb.vz) * k;
        Vector out = toSpawn();
        to.add(cb.vx + out.getX() * cb.kick, 0, cb.vz + out.getZ() * cb.kick);
        cb.kick *= 0.78;
        if (flying) {
            cb.lift += ((cb.chargeAt > 0 || cb.burstLeft > 0 ? 1.8 : 0) - cb.lift) * 0.1;
            y += Math.sin((now + gm.entity.getEntityId() * 7) * 0.06) * 0.8 + cb.lift;
        }
        to.setY(to.getY() + (y - to.getY()) * (flying ? 0.1 : 0.3));
        // mira hacia donde va; parado o cargando, hacia la base
        double speed = Math.hypot(cb.vx, cb.vz);
        Vector look = speed > 0.06 && !frozen && cb.chargeAt < 0 && cb.burstLeft == 0 ? new Vector(cb.vx, 0, cb.vz) : plugin.arena.baseCenter().clone().subtract(l.toVector());
        float goal = (float) Math.toDegrees(Math.atan2(-look.getX(), look.getZ()));
        if (Float.isNaN(cb.yaw)) cb.yaw = goal;
        cb.yaw += wrap(goal - cb.yaw) * (flying ? 0.12f : 0.25f);
        to.setYaw(cb.yaw);
        to.setPitch(0);
        return to;
    }

    private final Map<UUID, Combat> combat = new LinkedHashMap<>();

    public Bosses(BaseDefense plugin) {
        this.plugin = plugin;
    }

    public List<GameMob> all() {
        return bosses;
    }

    public java.util.Collection<Ball> balls() {
        return balls.values();
    }

    /** Pide un jefe. Devuelve false si no se pudo crear. */
    public boolean spawn(Settings.BossDef def, String donor) {
        World w = plugin.world(false);
        if (w == null) return false;
        return plugin.mobs.spawnBoss(w, def, donor, gm -> registered(gm, def, donor));
    }

    private void registered(GameMob gm, Settings.BossDef def, String donor) {
        gm.bar = BossBar.bossBar(barTitle(gm), 1f, color(def), BossBar.Overlay.NOTCHED_10);
        Combat cb = new Combat();
        cb.nextAttack = plugin.tick() + 40;
        cb.nextSummon = plugin.tick() + (long) (def.summonEvery() * 20);
        combat.put(gm.entity.getUniqueId(), cb);
        bosses.add(gm);
        plugin.hud.relayout();
        plugin.game.banner(plugin.settings.msg("jefeTitulo"), plugin.settings.msg("jefeSubtitulo"), Sound.ENTITY_WITHER_SPAWN, 0.7f, "jefe", def.name(), "usuario", donor);
        plugin.alerts.siren(3);
        Location l = gm.entity.getLocation();
        Color pc = switch (def.entity().name()) {
            case "WITHER" -> Color.fromRGB(60, 60, 70);
            case "WARDEN" -> Color.fromRGB(40, 200, 220);
            default -> Color.fromRGB(190, 70, 255);
        };
        plugin.fx.portal(l.clone().add(0, 0.3, 0), pc, Color.fromRGB(20, 0, 30), Math.max(3, gm.entity.getWidth() * 1.6), 60);
        l.getWorld().strikeLightningEffect(l);
        if (gm.entity.getType() == EntityType.ENDER_DRAGON) dragonArrival(l);
        if (gm.entity instanceof org.bukkit.entity.Wither) {
            // aparición: se forma envuelto en energía (la animación de «invulnerable» del wither) y estalla al terminar
            cb.spawnAnim = 120;
            cb.frozenUntil = plugin.tick() + 45;
            cb.nextAttack = plugin.tick() + 70;
            plugin.fx.sound(l, Sound.ENTITY_WITHER_AMBIENT, 4f, 0.5f, true);
        }
        if (gm.entity instanceof org.bukkit.entity.Warden wd) {
            // sale de la tierra como en las ciudades antiguas
            wd.setPose(org.bukkit.entity.Pose.EMERGING, true);
            cb.frozenUntil = plugin.tick() + 105;
            cb.nextAttack = plugin.tick() + 130;
            plugin.fx.sound(l, Sound.ENTITY_WARDEN_EMERGE, 5f, 1f, true);
            poseLater(gm, org.bukkit.entity.Pose.STANDING, 105);
            for (int i = 0; i < 5; i++) {
                int d = i * 18;
                Bukkit.getScheduler().runTaskLater(plugin, () -> {
                    if (gm.dead || !gm.entity.isValid()) return;
                    Location g = gm.entity.getLocation();
                    plugin.fx.particle(g, Particle.BLOCK, 50, 1.2, 0.3, 1.2, 0.2, org.bukkit.Material.SCULK.createBlockData(), true);
                    plugin.fx.particle(g.clone().add(0, 0.5, 0), Particle.SCULK_SOUL, 12, 1, 0.3, 1, 0.04, null, true);
                    plugin.fx.sound(g, Sound.BLOCK_SCULK_BREAK, 3f, 0.6f, true);
                }, d);
            }
        }
        plugin.fx.particle(l, Particle.SONIC_BOOM, 1, 0, 0, true);
        plugin.fx.particle(l.clone().add(0, 1, 0), Particle.SOUL_FIRE_FLAME, 60, 1.5, 1.5, 1.5, 0.05, null, true);
    }

    /** Cambia la pose del jefe dentro de unos ticks (si sigue vivo). */
    private void poseLater(GameMob gm, org.bukkit.entity.Pose pose, int ticks) {
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            if (!gm.dead && gm.entity.isValid()) gm.entity.setPose(pose, true);
        }, ticks);
    }

    /** El warden ruge: se para, animación de rugido, ondas y temblor. */
    private void roar(GameMob gm, Combat cb, int ticks) {
        Location l = gm.entity.getLocation();
        gm.entity.setPose(org.bukkit.entity.Pose.ROARING, true);
        poseLater(gm, org.bukkit.entity.Pose.STANDING, ticks);
        cb.frozenUntil = Math.max(cb.frozenUntil, plugin.tick() + ticks);
        plugin.fx.sound(l, Sound.ENTITY_WARDEN_ROAR, 5f, 1f, true);
        for (int i = 0; i < 3; i++) {
            int d = 12 + i * 7;
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                if (gm.dead || !gm.entity.isValid()) return;
                Location c = gm.entity.getLocation().add(0, 0.3, 0);
                plugin.fx.ring(c, 9, Color.fromRGB(40, 210, 225), 12);
                plugin.fx.particle(c.clone().add(0, 2, 0), Particle.SONIC_BOOM, 1, 0, 0, true);
                plugin.game.shake();
            }, d);
        }
    }

    private static BossBar.Color color(Settings.BossDef def) {
        return switch (def.entity().name()) {
            case "WITHER" -> BossBar.Color.WHITE;
            case "ENDER_DRAGON" -> BossBar.Color.PURPLE;
            case "WARDEN" -> BossBar.Color.BLUE;
            default -> BossBar.Color.RED;
        };
    }

    private Component barTitle(GameMob gm) {
        String hp = String.valueOf((int) Math.ceil(Math.max(0, gm.hp)));
        return Txt.fmt("&4☠ &c&l{jefe} &7de &e{usuario} &8· &f{vida}" + (gm.furious ? " &4&lFURIOSO" : ""), "jefe", gm.boss.name(), "usuario", gm.donor, "vida", hp);
    }

    public void showBars(Player p) {
        for (GameMob gm : bosses) if (gm.bar != null) p.showBossBar(gm.bar);
    }

    public void hideBars(Player p) {
        for (GameMob gm : bosses) if (gm.bar != null) p.hideBossBar(gm.bar);
    }

    void onDamage(GameMob gm) {
        if (gm.bar != null) {
            gm.bar.progress((float) Math.max(0, Math.min(1, gm.hp / gm.maxHp)));
            gm.bar.name(barTitle(gm));
        }
        if (!gm.furious && gm.hp / gm.maxHp * 100 <= plugin.settings.furyPercent) {
            gm.furious = true;
            if (!gm.manual) {
                var a = gm.entity.getAttribute(Attribute.MOVEMENT_SPEED);
                if (a != null) a.setBaseValue(a.getBaseValue() * plugin.settings.furySpeed);
            }
            gm.bar.color(BossBar.Color.RED);
            gm.bar.name(barTitle(gm));
            plugin.game.banner(plugin.settings.msg("furiaTitulo"), plugin.settings.msg("furiaSubtitulo"), Sound.ENTITY_RAVAGER_ROAR, 0.8f, "jefe", gm.boss.name(), "usuario", gm.donor);
            Location l = gm.entity.getLocation().add(0, gm.entity.getHeight() / 2, 0);
            Combat fc = combat.get(gm.entity.getUniqueId());
            if (fc != null && gm.entity.getType() == EntityType.WARDEN) roar(gm, fc, 44);
            if (fc != null && gm.entity.getType() == EntityType.WITHER) {
                // estallido de furia: onda oscura, se eleva y descarga una ráfaga larga
                plugin.fx.ring(l.clone().add(0, -gm.entity.getHeight() / 2 + 0.3, 0), 12, Color.fromRGB(90, 20, 140), 16);
                plugin.fx.particle(l, Particle.SOUL, 60, 2, 2, 2, 0.1, null, true);
                plugin.fx.sound(l, Sound.ENTITY_WITHER_BREAK_BLOCK, 3f, 0.6f, true);
                fc.chargeAt = plugin.tick() + 20;
            }
            plugin.fx.particle(l, Particle.ANGRY_VILLAGER, 20, gm.entity.getWidth(), 0, true);
            plugin.fx.particle(l, Particle.FLAME, 80, gm.entity.getWidth() * 0.6, 0.08, true);
        }
    }

    void onDeath(GameMob gm) {
        forget(gm);
        Location l = gm.entity.getLocation().add(0, gm.entity.getHeight() / 2, 0);
        massive(l, gm.entity.getWidth() + 1);
        // explosiones encadenadas alrededor mientras cae
        for (int i = 1; i <= 6; i++) {
            Location at = l.clone().add(plugin.fx.rnd().nextGaussian() * 2.2, plugin.fx.rnd().nextGaussian() * 1.4, plugin.fx.rnd().nextGaussian() * 2.2);
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                plugin.fx.explosion(at, 2.2, false);
                plugin.fx.particle(at, Particle.SOUL_FIRE_FLAME, 25, 0.6, 0.6, 0.6, 0.1, null, true);
            }, i * 3L);
        }
        Bukkit.getScheduler().runTaskLater(plugin, () -> plugin.fx.ring(l.clone().add(0, -l.getY() + plugin.arena.groundY + 1.3, 0), 16, Color.fromRGB(255, 200, 90), 18), 6L);
        plugin.game.banner(plugin.settings.msg("jefeDerrotado"), "&7de &e{usuario}", Sound.UI_TOAST_CHALLENGE_COMPLETE, 1f, "jefe", gm.boss.name(), "usuario", gm.donor);
        plugin.loot.bossDrop(l);
    }

    /** Efecto masivo de partículas y sonido (muerte de jefe). */
    private void massive(Location l, double size) {
        plugin.fx.explosion(l, size * 2, true);
        plugin.fx.particle(l, Particle.SOUL_FIRE_FLAME, 120, size, size, size, 0.12, null, true);
        plugin.fx.particle(l, Particle.DUST, 120, size, size, size, 0, new Particle.DustOptions(Color.fromRGB(150, 0, 0), 2.6f), true);
        plugin.fx.particle(l, Particle.FIREWORK, 80, 0.2, 0.2, 0.2, 0.45, null, true);
        plugin.fx.particle(l, Particle.FLASH, 2, 0, 0, 0, 0, Color.WHITE, true);
        plugin.fx.sound(l, Sound.ENTITY_WITHER_DEATH, 1.6f, 0.9f, true);
        plugin.fx.sound(l, Sound.ENTITY_GENERIC_EXPLODE, 4f, 0.5f, true);
    }

    void forget(GameMob gm) {
        bosses.remove(gm);
        combat.remove(gm.entity.getUniqueId());
        if (gm.bar != null) for (Player p : plugin.game.viewers()) p.hideBossBar(gm.bar);
        if (bosses.isEmpty()) plugin.hud.relayout();
        balls.values().removeIf(b -> {
            if (b.owner == gm) {
                if (b.e.isValid()) b.e.remove();
                return true;
            }
            return false;
        });
    }

    public void removeAllBalls() {
        for (Ball b : balls.values()) if (b.e.isValid()) b.e.remove();
        balls.clear();
    }

    // ───────────────────────────── MOVIMIENTO ─────────────────────────────

    private Vector toSpawn() {
        Vector d = plugin.arena.mobSpawn.clone().subtract(plugin.arena.baseCenter()).setY(0);
        if (d.lengthSquared() < 1e-4) d = new Vector(0, 0, 1);
        return d.normalize();
    }

    /** A dónde va ahora el jefe (lo usa MobManager para moverlo a mano). */
    Vector target(GameMob gm) {
        Vector base = plugin.arena.baseCenter().clone();
        Vector out = toSpawn();
        double dist = gm.boss.attackDistance();
        if (gm.entity.getType() == EntityType.WARDEN) {
            Combat cb = combat.get(gm.entity.getUniqueId());
            Vector front = base.clone().add(out.clone().multiply(3.5));
            if (cb != null && cb.atBase) return cb.ramPhase == 0 ? front.clone().add(out.clone().multiply(6)) : front.clone().add(out.clone().multiply(-1.5));
            return front;
        }
        Vector hold = base.clone().add(out.clone().multiply(dist));
        if (gm.entity.getType() == EntityType.WITHER && near(gm, hold, 12)) {
            // en su puesto no se queda clavado: se desliza de lado a lado frente a la base (más rápido si está furioso)
            double a = (plugin.tick() + gm.entity.getEntityId() * 17) * (gm.furious ? 0.045 : 0.028);
            Vector side = new Vector(-out.getZ(), 0, out.getX());
            return hold.clone().add(side.multiply(Math.sin(a) * 6.5)).add(out.clone().multiply(Math.sin(a * 2.3) * 2.5));
        }
        if (gm.entity.getType() == EntityType.ENDER_DRAGON && near(gm, hold, 6)) {
            // da vueltas sobre el carril frente a la base
            double a = (plugin.tick() + gm.entity.getEntityId() * 31) * 0.035;
            Vector side = new Vector(-out.getZ(), 0, out.getX());
            return hold.clone().add(side.multiply(Math.cos(a) * 10)).add(out.clone().multiply(Math.sin(a) * 6));
        }
        return hold;
    }

    double speedMul(GameMob gm) {
        Combat cb = combat.get(gm.entity.getUniqueId());
        if (cb != null && cb.atBase && cb.ramPhase == 1) return 3.2;
        return gm.furious ? plugin.settings.furySpeed : 1.0;
    }

    private boolean near(GameMob gm, Vector p, double r) {
        Location l = gm.entity.getLocation();
        double dx = l.getX() - p.getX(), dz = l.getZ() - p.getZ();
        return dx * dx + dz * dz <= r * r;
    }

    private double distToBase(GameMob gm) {
        Location l = gm.entity.getLocation();
        Vector b = plugin.arena.baseCenter();
        return Math.hypot(l.getX() - b.getX(), l.getZ() - b.getZ());
    }

    /** El warden llegó a la base: desde ahora embiste una y otra vez. */
    void atBase(GameMob gm) {
        Combat cb = combat.get(gm.entity.getUniqueId());
        if (cb == null || cb.atBase) return;
        cb.atBase = true;
        cb.ramPhase = 0;
        cb.ramUntil = plugin.tick() + 50;
        roar(gm, cb, 44);
    }

    // ───────────────────────────── TICK ─────────────────────────────

    /** Jefe de invocación: suelta esbirros en el carril bajo él (con portal y rayo). */
    private void summon(GameMob gm, Location at) {
        var def = plugin.settings.mobs.get(gm.boss.summonType().toLowerCase(java.util.Locale.ROOT));
        World w = at.getWorld();
        if (def == null || w == null) return;
        Location ground = at.clone();
        ground.setY(plugin.arena.groundY + 1);
        // que no caigan dentro de la base
        if (plugin.arena.baseRegion.clone().expand(3).contains(ground.toVector())) ground = plugin.arena.mobSpawn(w);
        int n = gm.boss.summonCount() + (gm.furious ? 2 : 0);
        for (int i = 0; i < n; i++) {
            Location p = ground.clone().add(plugin.fx.rnd().nextGaussian() * 1.5, 0, plugin.fx.rnd().nextGaussian() * 1.5);
            plugin.mobs.spawnAt(w, p, def, gm.donor, false);
        }
        plugin.fx.portal(ground.clone().add(0, 0.2, 0), Color.fromRGB(180, 30, 30), Color.fromRGB(20, 0, 0), 2.5, 30);
        w.strikeLightningEffect(ground);
        plugin.hud.notify("skull", Alerts2.plain(plugin.settings.msg("invocacion"), "jefe", gm.boss.name()), net.kyori.adventure.text.format.TextColor.color(0xE63C32));
    }

    private static final class Alerts2 {
        static String plain(String tpl, Object... kv) {
            return net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer.plainText().serialize(Txt.fmt(tpl, kv));
        }
    }

    public void tick() {
        if (!plugin.game.running() || plugin.arena == null) return;
        long now = plugin.tick();
        boolean paused = plugin.game.paused();
        for (GameMob gm : new ArrayList<>(bosses)) {
            if (gm.dead || !gm.entity.isValid()) continue;
            Location l = gm.entity.getLocation();
            if (gm.furious && now % 4 == 0) plugin.fx.particle(l.clone().add(0, gm.entity.getHeight() * 0.6, 0), Particle.FLAME, 6, gm.entity.getWidth() * 0.4, 0.02, false);
            if (gm.entity.getType() == EntityType.ENDER_DRAGON && now % 3 == 0) plugin.fx.particle(l, Particle.DRAGON_BREATH, 6, 2, 0.5, 2, 0.01, 1f, false);
            Combat cb = combat.get(gm.entity.getUniqueId());
            if (cb == null || paused) continue;
            double every = gm.boss.attackEvery() * 20 / (gm.furious ? 1.5 : 1);
            if (now >= cb.nextSummon && gm.boss.summonCount() > 0) {
                cb.nextSummon = now + (long) (gm.boss.summonEvery() * 20 / (gm.furious ? 1.4 : 1));
                summon(gm, l);
            }
            switch (gm.entity.getType()) {
                case WITHER -> wither(gm, cb, l, now, every);
                case ENDER_DRAGON -> {
                    int orbs = gm.furious ? 3 : 2;
                    if (cb.chargeAt > 0) {
                        // carga: los orbes crecen junto a la boca mientras la energía converge
                        double k = 1 - (cb.chargeAt - now) / 26.0;
                        if (now % 2 == 0) for (int i = 0; i < orbs; i++) dragonOrb(dragonMouth(gm, i, orbs), k);
                        if (now >= cb.chargeAt) {
                            cb.chargeAt = -1;
                            Location mouth = dragonMouth(gm, -1, orbs);
                            Vector dir = plugin.arena.baseCenter().clone().subtract(mouth.toVector()).normalize();
                            dragonRing(mouth, dir);
                            for (int i = 0; i < orbs; i++) shoot(gm, Kind.FUEGO, i);
                            plugin.fx.sound(l, Sound.ENTITY_ENDER_DRAGON_SHOOT, 4f, 0.8f, true);
                            plugin.fx.sound(l, Sound.ENTITY_WARDEN_SONIC_BOOM, 2f, 1.5f, true);
                        }
                    } else if (distToBase(gm) <= gm.boss.attackDistance() + 12 && now >= cb.nextAttack) {
                        cb.nextAttack = now + (long) every;
                        cb.chargeAt = now + 26;
                        warn("ataqueDragon");
                        plugin.fx.sound(l, Sound.ENTITY_ENDER_DRAGON_GROWL, 4f, 1.25f, true);
                        plugin.fx.sound(l, Sound.BLOCK_BEACON_POWER_SELECT, 3f, 0.6f, true);
                    }
                }
                case WARDEN -> warden(gm, cb, l, now, every);
                default -> {
                }
            }
        }
        tickBalls(now);
    }

    /** Punto de cada cabeza del wither (0 centro, 1 y 2 laterales). */
    private Location witherHead(GameMob gm, int i) {
        Location l = gm.entity.getLocation();
        double sc = gm.entity.getAttribute(Attribute.SCALE) != null ? gm.entity.getAttribute(Attribute.SCALE).getValue() : 1;
        double yaw = Math.toRadians(l.getYaw());
        Vector side = new Vector(Math.cos(yaw), 0, Math.sin(yaw));
        l.add(0, (i == 0 ? 3.0 : 2.2) * sc, 0);
        if (i > 0) l.add(side.multiply((i == 1 ? 1.3 : -1.3) * sc));
        return l;
    }

    /**
     * WITHER: aparece formándose, sus cabezas siguen al streamer, y ataca con coreografía: se eleva cargando energía en
     * las tres cabezas (aviso), y descarga las calaveras una a una alternando cabezas, con retroceso en cada disparo.
     */
    private void wither(GameMob gm, Combat cb, Location l, long now, double every) {
        org.bukkit.entity.Wither w = (org.bukkit.entity.Wither) gm.entity;
        if (cb.spawnAnim > 0) {
            cb.spawnAnim = Math.max(0, cb.spawnAnim - 3);
            w.setInvulnerableTicks(cb.spawnAnim);
            if (now % 3 == 0) plugin.fx.particle(l.clone().add(0, 2, 0), Particle.SOUL, 8, 1.2, 1.5, 1.2, 0.05, null, true);
            if (cb.spawnAnim == 0) {
                Location c = l.clone().add(0, 2, 0);
                plugin.fx.explosion(c, 5, true);
                plugin.fx.ring(c.clone().add(0, -l.getY() + plugin.arena.groundY - 0.7, 0), 14, Color.fromRGB(120, 60, 200), 16);
                plugin.fx.sound(c, Sound.ENTITY_WITHER_SPAWN, 3f, 1f, true);
                plugin.game.shake();
            }
            return;
        }
        Player sp = plugin.game.streamer();
        if (sp != null && now % 20 == 0) {
            w.setTarget(org.bukkit.entity.Wither.Head.LEFT, sp);
            w.setTarget(org.bukkit.entity.Wither.Head.RIGHT, sp);
        }
        // humo oscuro que deja al moverse
        if (now % 2 == 0) plugin.fx.particle(l.clone().add(0, 1.5, 0), Particle.SMOKE, 3, 0.6, 0.8, 0.6, 0.01, null, false);
        if (cb.burstLeft > 0) {
            if (now >= cb.nextBurst) {
                int head = cb.burstIdx++ % 3;
                cb.burstLeft--;
                cb.nextBurst = now + (gm.furious ? 3 : 5);
                cb.kick = 0.22;
                Location h = witherHead(gm, head);
                plugin.fx.particle(h, Particle.FLASH, 1, 0, 0, 0, 0, Color.fromRGB(150, 110, 255), true);
                plugin.fx.particle(h, Particle.SOUL_FIRE_FLAME, 14, 0.25, 0.25, 0.25, 0.08, null, true);
                plugin.fx.particle(h, Particle.LARGE_SMOKE, 6, 0.3, 0.3, 0.3, 0.03, null, true);
                shoot(gm, Kind.CALAVERA, head);
            }
            return;
        }
        if (cb.chargeAt > 0) {
            // carga: la energía converge en las tres cabezas (cada vez más deprisa)
            double k = 1 - Math.max(0, cb.chargeAt - now) / 18.0;
            for (int i = 0; i < 3; i++) {
                Location h = witherHead(gm, i);
                for (int j = 0; j < 2 + (int) (k * 3); j++) {
                    Vector o = new Vector(plugin.fx.rnd().nextGaussian(), plugin.fx.rnd().nextGaussian(), plugin.fx.rnd().nextGaussian()).normalize().multiply(2.6);
                    Vector v = o.clone().multiply(-1).normalize();
                    // count 0 = partícula dirigida: viaja hacia la cabeza
                    plugin.fx.particle(h.clone().add(o), Particle.SOUL_FIRE_FLAME, 0, v.getX(), v.getY(), v.getZ(), 0.22, null, true);
                }
                if (now % 2 == 0) plugin.fx.particle(h, Particle.DUST, 2, 0.15, 0.15, 0.15, 0, new Particle.DustOptions(Color.fromRGB(170, 120, 255), (float) (1 + k * 2.2)), true);
            }
            if (now % 4 == 0) plugin.fx.sound(l, Sound.BLOCK_BEACON_AMBIENT, 3f, (float) (0.8 + k * 1.1), true);
            if (now >= cb.chargeAt) {
                cb.chargeAt = -1;
                cb.burstLeft = gm.furious ? 7 : 3;
                cb.nextBurst = now;
                plugin.fx.sound(l, Sound.ENTITY_WITHER_AMBIENT, 4f, 1.3f, true);
            }
            return;
        }
        if (distToBase(gm) <= gm.boss.attackDistance() + 9 && now >= cb.nextAttack) {
            cb.nextAttack = now + (long) every + 18;
            cb.chargeAt = now + 18;
            plugin.fx.sound(l, Sound.BLOCK_RESPAWN_ANCHOR_CHARGE, 4f, 0.6f, true);
            warn("ataqueWither");
        }
    }

    private void warden(GameMob gm, Combat cb, Location l, long now, double every) {
        Vector base = plugin.arena.baseCenter();
        // latido y antenas mientras camina
        if (now % 28 == 0 && now >= cb.frozenUntil) {
            gm.entity.playEffect(org.bukkit.EntityEffect.WARDEN_TENDRIL_SHAKE);
            plugin.fx.sound(l, Sound.ENTITY_WARDEN_HEARTBEAT, 3f, gm.furious ? 1.3f : 1f, false);
            plugin.fx.particle(l.clone().add(0, 0.1, 0), Particle.SCULK_CHARGE_POP, 6, 0.8, 0.05, 0.8, 0.02, null, false);
        }
        // cargando el cañón: la energía converge en el pecho
        if (cb.chargeAt > 0 && now < cb.chargeAt) {
            Location chest = l.clone().add(0, gm.entity.getHeight() * 0.6, 0);
            double k = 1 - (cb.chargeAt - now) / 34.0;
            for (int j = 0; j < 3; j++) {
                Vector o = new Vector(plugin.fx.rnd().nextGaussian(), plugin.fx.rnd().nextGaussian(), plugin.fx.rnd().nextGaussian()).normalize().multiply(3);
                Vector v = o.clone().multiply(-1).normalize();
                plugin.fx.particle(chest.clone().add(o), Particle.SCULK_SOUL, 0, v.getX(), v.getY(), v.getZ(), 0.25, null, true);
            }
            if (now % 2 == 0) plugin.fx.particle(chest, Particle.DUST, 3, 0.25, 0.25, 0.25, 0, new Particle.DustOptions(Color.fromRGB(60, 225, 235), (float) (1 + k * 2.5)), true);
        }
        // cañón sónico: carga (sonido de vanilla), y a los 1,5 s rayo hasta la base
        if (cb.chargeAt > 0 && now >= cb.chargeAt) {
            cb.chargeAt = -1;
            Location from = l.clone().add(0, gm.entity.getHeight() * 0.6, 0);
            Vector d = base.clone().add(new Vector(0, 1, 0)).subtract(from.toVector());
            double len = d.length();
            d.normalize();
            for (double s = 1; s < len; s += 1.2) plugin.fx.particle(from.clone().add(d.clone().multiply(s)), Particle.SONIC_BOOM, 1, 0, 0, true);
            // anillos sónicos a lo largo del rayo y onda en la base
            Vector u = d.clone().crossProduct(new Vector(0, 1, 0));
            if (u.lengthSquared() < 1e-4) u = new Vector(1, 0, 0);
            u.normalize();
            Vector v2 = u.clone().crossProduct(d).normalize();
            Particle.DustOptions cyan = new Particle.DustOptions(Color.fromRGB(60, 220, 230), 1.6f);
            for (double s = 3; s < len; s += 3.5)
                for (int k = 0; k < 14; k++) {
                    double a = k * Math.PI * 2 / 14, rr = 1.2 + s * 0.04;
                    plugin.fx.particle(from.clone().add(d.clone().multiply(s)).add(u.clone().multiply(Math.cos(a) * rr)).add(v2.clone().multiply(Math.sin(a) * rr)), Particle.DUST, 1, 0, 0, 0, 0, cyan, true);
                }
            Location bh = base.toLocation(l.getWorld()).add(0, 1, 0);
            plugin.fx.blast(bh, 3.5, Color.fromRGB(40, 220, 230), true);
            plugin.fx.particle(bh, Particle.SCULK_SOUL, 40, 2, 1, 2, 0.08, null, true);
            Player sp = plugin.game.streamer();
            if (sp != null) sp.addPotionEffect(new org.bukkit.potion.PotionEffect(org.bukkit.potion.PotionEffectType.DARKNESS, 40, 0, false, false, false));
            plugin.fx.sound(from, Sound.ENTITY_WARDEN_SONIC_BOOM, 5f, 0.9f, true);
            plugin.fx.sound(base.toLocation(l.getWorld()), Sound.ENTITY_WARDEN_SONIC_BOOM, 4f, 1.1f, true);
            plugin.game.damageBase(gm.boss.attackDamage(), gm);
        }
        if (!cb.atBase && cb.chargeAt < 0 && distToBase(gm) <= gm.boss.attackDistance() && now >= cb.nextAttack) {
            cb.nextAttack = now + (long) every + 34;
            // animación propia del warden (se echa hacia atrás y abre el pecho); el disparo sale a los 34 ticks, como en vanilla
            cb.chargeAt = now + 34;
            cb.frozenUntil = Math.max(cb.frozenUntil, now + 42);
            gm.entity.playEffect(org.bukkit.EntityEffect.WARDEN_SONIC_ATTACK);
            plugin.fx.sound(l, Sound.ENTITY_WARDEN_SONIC_CHARGE, 4f, 1f, true);
            plugin.fx.particle(l.clone().add(0, gm.entity.getHeight() * 0.6, 0), Particle.SCULK_SOUL, 30, 1, 1, 1, 0.05, null, true);
            warn("ataqueWarden");
        }
        if (cb.atBase) {
            if (cb.ramPhase == 0 && now >= cb.ramUntil) {
                cb.ramPhase = 1;
                cb.ramUntil = now + (long) (gm.boss.ramEvery() * 20);
                gm.entity.playEffect(org.bukkit.EntityEffect.WARDEN_TENDRIL_SHAKE);
                plugin.fx.sound(l, Sound.ENTITY_WARDEN_ANGRY, 4f, 1f, true);
            } else if (cb.ramPhase == 1 && (near(gm, base.clone().add(toSpawn().multiply(2)), 2.2) || now >= cb.ramUntil)) {
                // ¡embestida!
                cb.ramPhase = 0;
                cb.ramUntil = now + 20;
                cb.vx = cb.vz = 0;
                gm.entity.playEffect(org.bukkit.EntityEffect.ENTITY_ATTACK);
                // cada tres embestidas se para a rugir (respiro para dispararle)
                if (++cb.rams % 3 == 0) {
                    roar(gm, cb, 44);
                    cb.ramUntil = now + 50;
                }
                Location hit = base.toLocation(l.getWorld()).add(toSpawn().multiply(1.5)).add(0, 1, 0);
                plugin.fx.blast(hit, 4, Color.fromRGB(40, 200, 210), true);
                plugin.fx.particle(hit, Particle.BLOCK, 60, 2, 1, 0.5, 0.3, org.bukkit.Material.SPRUCE_PLANKS.createBlockData(), true);
                plugin.fx.sound(hit, Sound.ENTITY_WARDEN_ATTACK_IMPACT, 5f, 0.7f, true);
                plugin.fx.sound(hit, Sound.ENTITY_ZOMBIE_BREAK_WOODEN_DOOR, 3f, 0.6f, true);
                plugin.game.damageBase(gm.boss.ramDamage(), gm);
                plugin.game.shake();
            }
        }
    }

    // ───────────────────────────── DRAGÓN: efectos ─────────────────────────────

    private static final Color VIOLET = Color.fromRGB(190, 70, 255), LILAC = Color.fromRGB(240, 200, 255), DEEP = Color.fromRGB(70, 10, 120);

    /** Grieta de luz: columna violeta que se abre, late y se cierra, con la energía subiendo en espiral. */
    private void dragonArrival(Location ground) {
        World w = ground.getWorld();
        Location base = ground.clone();
        base.setY(plugin.arena.mobSpawn.getY());
        plugin.fx.sound(base, Sound.BLOCK_END_PORTAL_SPAWN, 1.2f, 0.7f, true);
        plugin.fx.sound(base, Sound.ENTITY_ENDER_DRAGON_GROWL, 5f, 0.6f, true);
        List<org.bukkit.entity.BlockDisplay> beams = new ArrayList<>();
        Object[][] layers = {{"minecraft:purple_stained_glass", 3.4f}, {"minecraft:magenta_stained_glass", 2.0f}, {"minecraft:white_stained_glass", 0.9f}};
        for (Object[] ly : layers) {
            float wd = (float) ly[1];
            beams.add(w.spawn(base, org.bukkit.entity.BlockDisplay.class, d -> {
                d.setPersistent(false);
                d.setBlock(Bukkit.createBlockData((String) ly[0]));
                d.setBrightness(new org.bukkit.entity.Display.Brightness(15, 15));
                d.setViewRange(4f);
                d.setTransformation(new org.bukkit.util.Transformation(new org.joml.Vector3f(0, 0, 0), new org.joml.Quaternionf(), new org.joml.Vector3f(0.01f, 46, 0.01f), new org.joml.Quaternionf()));
                d.getPersistentDataContainer().set(plugin.mobKey, PersistentDataType.BYTE, (byte) 2);
                d.customName(net.kyori.adventure.text.Component.text(String.valueOf(wd)));
            }));
        }
        Bukkit.getScheduler().runTaskTimer(plugin, new java.util.function.Consumer<org.bukkit.scheduler.BukkitTask>() {
            int t;

            @Override
            public void accept(org.bukkit.scheduler.BukkitTask task) {
                t++;
                boolean closing = t > 62;
                if (t > 80) {
                    for (var b : beams) if (b.isValid()) b.remove();
                    task.cancel();
                    return;
                }
                if (t == 1 || t % 6 == 0 || t == 63) {
                    double pulse = closing ? 0.0 : 1 + 0.18 * Math.sin(t * 0.9);
                    for (var b : beams) {
                        if (!b.isValid()) continue;
                        float wd = (float) (Float.parseFloat(net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer.plainText().serialize(b.customName())) * pulse);
                        wd = Math.max(0.01f, wd);
                        b.setInterpolationDelay(0);
                        b.setInterpolationDuration(closing ? 16 : 6);
                        b.setTransformation(new org.bukkit.util.Transformation(new org.joml.Vector3f(-wd / 2, 0, -wd / 2), new org.joml.Quaternionf(), new org.joml.Vector3f(wd, 46, wd), new org.joml.Quaternionf()));
                    }
                }
                if (closing) return;
                // energía que sube en doble hélice y niebla que se abre por el suelo
                for (int i = 0; i < 2; i++) {
                    double a = t * 0.35 + i * Math.PI, h = (t * 0.9) % 30;
                    Location p = base.clone().add(Math.cos(a) * 3, h, Math.sin(a) * 3);
                    plugin.fx.particle(p, Particle.DUST_COLOR_TRANSITION, 3, 0.15, 0.15, 0.15, 0, new Particle.DustTransition(LILAC, VIOLET, 3.2f), true);
                    plugin.fx.particle(p, Particle.END_ROD, 1, 0.1, 0.1, 0.1, 0.01, null, true);
                }
                if (t % 3 == 0) {
                    plugin.fx.particle(base.clone().add(0, 0.4, 0), Particle.DRAGON_BREATH, 14, 3.5, 0.2, 3.5, 0.02, 1f, true);
                    plugin.fx.particle(base.clone().add(0, 6, 0), Particle.REVERSE_PORTAL, 30, 2.5, 6, 2.5, 0.05, null, true);
                }
                if (t == 8 || t == 22 || t == 40) {
                    plugin.fx.ring(base.clone().add(0, 0.3, 0), 14, t == 22 ? LILAC : VIOLET, 22);
                    plugin.fx.particle(base.clone().add(0, 2, 0), Particle.FLASH, 1, 0, 0, 0, 0, LILAC, true);
                }
            }
        }, 0L, 1L);
    }

    /** Punto junto a la boca del dragón (i = -1: el centro). Los orbes se reparten a los lados. */
    private Location dragonMouth(GameMob gm, int i, int n) {
        Location l = gm.entity.getLocation().add(0, gm.entity.getHeight() * 0.55, 0);
        Vector fwd = plugin.arena.baseCenter().clone().subtract(l.toVector()).setY(0).normalize();
        Vector side = new Vector(-fwd.getZ(), 0, fwd.getX());
        l.add(fwd.clone().multiply(gm.entity.getWidth() * 0.45 + 2.5));
        if (i >= 0) l.add(side.multiply((i - (n - 1) / 2.0) * 3.4)).add(0, i % 2 == 0 ? 0.6 : -0.2, 0);
        return l;
    }

    /** Orbe en carga (k = 0..1): núcleo blanco, halo lila que crece y chispas que convergen. */
    private void dragonOrb(Location c, double k) {
        float size = (float) (1.2 + 3.0 * k);
        plugin.fx.particle(c, Particle.DUST_COLOR_TRANSITION, 4 + (int) (8 * k), 0.12 + 0.3 * k, 0.12 + 0.3 * k, 0.12 + 0.3 * k, 0, new Particle.DustTransition(Color.WHITE, VIOLET, size), true);
        plugin.fx.particle(c, Particle.DUST, 2, 0.05, 0.05, 0.05, 0, new Particle.DustOptions(Color.WHITE, Math.min(4f, size)), true);
        var r = plugin.fx.rnd();
        for (int j = 0; j < 3; j++) {
            Vector off = new Vector(r.nextGaussian(), r.nextGaussian(), r.nextGaussian()).normalize().multiply(2.2 + 1.5 * k);
            Location from = c.clone().add(off);
            Vector v = off.multiply(-1).normalize();
            c.getWorld().spawnParticle(Particle.END_ROD, from, 0, v.getX(), v.getY(), v.getZ(), 0.28, null, true);
        }
        if (k > 0.6) plugin.fx.particle(c, Particle.ELECTRIC_SPARK, 3, 0.5, 0.5, 0.5, 0.05, null, true);
    }

    /** Anillo-portal que se abre delante de la boca al soltar la descarga (mirando a la base). */
    private void dragonRing(Location c, Vector dir) {
        Vector u = dir.clone().crossProduct(new Vector(0, 1, 0));
        if (u.lengthSquared() < 1e-4) u = new Vector(1, 0, 0);
        u.normalize();
        Vector v = dir.clone().crossProduct(u).normalize();
        plugin.fx.particle(c, Particle.FLASH, 1, 0, 0, 0, 0, LILAC, true);
        for (int step = 0; step < 10; step++) {
            int st = step;
            Vector uu = u.clone(), vv = v.clone();
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                double rr = 0.8 + st * 0.55;
                Location center = c.clone().add(dir.clone().multiply(st * 0.5));
                int n = (int) (14 + rr * 8);
                for (int i = 0; i < n; i++) {
                    double a = i * Math.PI * 2 / n + st * 0.3;
                    Location p = center.clone().add(uu.clone().multiply(Math.cos(a) * rr)).add(vv.clone().multiply(Math.sin(a) * rr));
                    plugin.fx.particle(p, Particle.DUST_COLOR_TRANSITION, 1, 0, 0, 0, 0, new Particle.DustTransition(st % 2 == 0 ? LILAC : VIOLET, DEEP, (float) (2.8 - st * 0.15)), true);
                }
                // segundo anillo interior más fino
                for (int i = 0; i < n / 2; i++) {
                    double a = -i * Math.PI * 4 / n - st * 0.4;
                    Location p = center.clone().add(uu.clone().multiply(Math.cos(a) * rr * 0.55)).add(vv.clone().multiply(Math.sin(a) * rr * 0.55));
                    plugin.fx.particle(p, Particle.END_ROD, 1, 0, 0, 0, 0, null, true);
                }
            }, step);
        }
    }

    /** Impacto de la descarga: implosión, columna violeta y charco de aliento que se abre. */
    private void dragonImpact(Location l) {
        plugin.fx.blast(l, 5, VIOLET, true);
        plugin.fx.particle(l, Particle.FLASH, 1, 0, 0, 0, 0, LILAC, true);
        plugin.fx.particle(l, Particle.REVERSE_PORTAL, 120, 2.5, 1.5, 2.5, 0.3, null, true);
        plugin.fx.particle(l, Particle.DRAGON_BREATH, 90, 2.6, 0.5, 2.6, 0.04, 1f, true);
        for (int k = 0; k < 12; k++)
            plugin.fx.particle(l.clone().add(0, k * 0.9, 0), Particle.DUST_COLOR_TRANSITION, 8, 0.5 - k * 0.03, 0.3, 0.5 - k * 0.03, 0, new Particle.DustTransition(LILAC, VIOLET, (float) (3.6 - k * 0.2)), true);
        plugin.fx.ring(l.clone().add(0, 0.2, 0), 8, VIOLET, 14);
        Bukkit.getScheduler().runTaskLater(plugin, () -> plugin.fx.ring(l.clone().add(0, 0.2, 0), 11, LILAC, 18), 4L);
        plugin.fx.sound(l, Sound.ENTITY_DRAGON_FIREBALL_EXPLODE, 4f, 0.7f, true);
        plugin.fx.sound(l, Sound.BLOCK_RESPAWN_ANCHOR_DEPLETE, 3f, 0.6f, true);
    }

    /** La bola del dragón no deja su nube de daño de vanilla: el impacto lo dibuja y lo cuenta el plugin. */
    @org.bukkit.event.EventHandler
    public void onDragonBall(com.destroystokyo.paper.event.entity.EnderDragonFireballHitEvent e) {
        if (e.getEntity().getPersistentDataContainer().has(plugin.projKey)) e.setCancelled(true);
    }

    private void warn(String key) {
        long now = plugin.tick();
        if (now - lastWarnTitle < 100) return;
        lastWarnTitle = now;
        plugin.hud.notify("warn", net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer.plainText().serialize(Txt.fmt(plugin.settings.msg(key))), net.kyori.adventure.text.format.TextColor.color(0xE63C32));
    }

    private void shoot(GameMob gm, Kind kind, int i) {
        Location from = gm.entity.getLocation().add(0, gm.entity.getHeight() * 0.7, 0);
        if (gm.entity.getType() == EntityType.WITHER) from = witherHead(gm, i % 3);
        Vector to = plugin.arena.baseCenter().clone().add(new Vector((Math.random() - 0.5) * 6, 0, 0));
        Vector dir = to.clone().subtract(from.toVector()).normalize();
        from.add(dir.clone().multiply(gm.entity.getWidth() * 0.6 + 1));
        // el dragón lanza su propia bola (violeta); el resto de jefes, bola de fuego
        Class<? extends Fireball> cls = kind == Kind.CALAVERA ? WitherSkull.class : gm.entity.getType() == EntityType.ENDER_DRAGON ? org.bukkit.entity.DragonFireball.class : LargeFireball.class;
        Fireball f = from.getWorld().spawn(from, cls, e -> {
            e.setShooter(gm.entity);
            e.setYield(0);
            e.setIsIncendiary(false);
            e.setDirection(dir);
            e.setAcceleration(new Vector());
            e.setVelocity(dir.clone().multiply(kind == Kind.CALAVERA ? 0.8 : 0.62));
            e.setPersistent(false);
            if (e instanceof WitherSkull ws) ws.setCharged(gm.furious);
            e.getPersistentDataContainer().set(plugin.projKey, PersistentDataType.STRING, "jefe");
        });
        balls.put(f.getUniqueId(), new Ball(f, gm, kind, plugin.tick()));
        if (kind == Kind.CALAVERA) plugin.fx.sound(from, Sound.ENTITY_WITHER_SHOOT, 3f, 1f, true);
        else plugin.fx.sound(from, Sound.ENTITY_GHAST_SHOOT, 3f, 0.7f, true);
    }

    private void tickBalls(long now) {
        Iterator<Ball> it = balls.values().iterator();
        Vector baseC = plugin.arena.baseCenter();
        while (it.hasNext()) {
            Ball b = it.next();
            if (!b.e.isValid() || now - b.born > 20 * 20) {
                if (b.e.isValid()) b.e.remove();
                it.remove();
                continue;
            }
            Location l = b.e.getLocation();
            Vector target;
            if (b.returned) {
                if (b.owner.dead || !b.owner.entity.isValid()) {
                    plugin.fx.explosion(l, 2, false);
                    b.e.remove();
                    it.remove();
                    continue;
                }
                target = b.owner.entity.getLocation().add(0, b.owner.entity.getHeight() * 0.5, 0).toVector();
            } else target = baseC;
            Vector d = target.clone().subtract(l.toVector());
            double dist = d.length();
            double hitR = b.returned ? Math.max(3, b.owner.entity.getWidth()) : 3.2;
            if (dist < hitR) {
                it.remove();
                b.e.remove();
                if (b.kind == Kind.CALAVERA) {
                    plugin.fx.blast(l, 3.5, Color.fromRGB(70, 200, 230), true);
                    plugin.fx.particle(l, Particle.SOUL_FIRE_FLAME, 60, 1.6, 0.8, 1.6, 0.08, null, true);
                    plugin.fx.particle(l, Particle.SOUL, 20, 1.2, 0.6, 1.2, 0.05, null, true);
                    plugin.fx.sound(l, Sound.ENTITY_WITHER_BREAK_BLOCK, 3f, 0.7f, true);
                } else {
                    if (b.owner.entity.getType() == EntityType.ENDER_DRAGON) dragonImpact(l);
                    else {
                        plugin.fx.blast(l, 4.5, Color.fromRGB(255, 110, 30), true);
                        plugin.fx.particle(l, Particle.DRAGON_BREATH, 60, 2, 0.6, 2, 0.02, 1f, true);
                        for (int k = 0; k < 8; k++) plugin.fx.particle(l.clone().add(0, k * 0.8, 0), Particle.FLAME, 10, 0.4, 0.2, 0.4, 0.02, null, true);
                    }
                }
                if (b.returned) {
                    plugin.mobs.damage(b.owner, b.owner.boss.returnDamage(), null);
                    plugin.fx.sound(l, Sound.ENTITY_ENDER_DRAGON_HURT, 3f, 0.8f, true);
                } else plugin.game.damageBase(b.owner.boss.attackDamage(), null);
                continue;
            }
            double speed = b.returned ? 1.1 : b.kind == Kind.CALAVERA ? 0.8 : 0.62;
            Vector v = d.multiply(1 / dist).multiply(speed);
            b.e.setVelocity(v);
            b.e.setDirection(v);
            b.e.setAcceleration(new Vector());
            plugin.fx.trail(l, b.kind == Kind.CALAVERA ? "calavera" : b.owner.entity.getType() == EntityType.ENDER_DRAGON ? "dragon" : "fuego");
        }
    }

    /** El streamer le dio a un proyectil: la calavera se destruye; la bola de fuego vuelve a su dueño. */
    public void hitBall(Ball b, Player p) {
        if (b.returned) return;
        Location l = b.e.getLocation();
        if (b.kind == Kind.CALAVERA) {
            balls.remove(b.e.getUniqueId());
            b.e.remove();
            plugin.fx.explosion(l, 1.5, false);
            plugin.fx.particle(l, Particle.SOUL, 12, 0.4, 0.05, true);
            plugin.hud.notify("bolt", "¡CALAVERA DESTRUIDA!", net.kyori.adventure.text.format.TextColor.color(0x5ADC5A));
            p.playSound(p.getLocation(), Sound.BLOCK_NOTE_BLOCK_PLING, 1f, 1.8f);
            return;
        }
        b.returned = true;
        plugin.fx.particle(l, Particle.CRIT, 30, 0.5, 0.4, true);
        plugin.fx.particle(l, Particle.END_ROD, 12, 0.3, 0.12, true);
        plugin.fx.sound(l, Sound.ENTITY_PLAYER_ATTACK_CRIT, 2f, 1.2f, true);
        p.playSound(p.getLocation(), Sound.BLOCK_NOTE_BLOCK_PLING, 1.5f, 2f);
        plugin.hud.notify("bolt", "¡DEVUELTA!", net.kyori.adventure.text.format.TextColor.color(0xF2B632));
    }

    @EventHandler
    public void onHit(ProjectileHitEvent e) {
        Entity ent = e.getEntity();
        if (balls.containsKey(ent.getUniqueId()) || "jefe".equals(ent.getPersistentDataContainer().get(plugin.projKey, PersistentDataType.STRING))) {
            // nada de explosión vanilla: la trayectoria la gestiona el plugin
            e.setCancelled(true);
        }
    }

    @EventHandler
    public void onPrime(ExplosionPrimeEvent e) {
        if (plugin.inGameWorld(e.getEntity())) e.setCancelled(true);
    }
}
