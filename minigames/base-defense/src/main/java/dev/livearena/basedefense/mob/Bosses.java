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
        cb.nextAttack = plugin.tick() + 60;
        combat.put(gm.entity.getUniqueId(), cb);
        bosses.add(gm);
        plugin.hud.relayout();
        plugin.game.banner(plugin.settings.msg("jefeTitulo"), plugin.settings.msg("jefeSubtitulo"), Sound.ENTITY_WITHER_SPAWN, 0.7f, "jefe", def.name(), "usuario", donor);
        plugin.alerts.siren(3);
        Location l = gm.entity.getLocation();
        plugin.fx.particle(l, Particle.SONIC_BOOM, 1, 0, 0, true);
        plugin.fx.particle(l.clone().add(0, 1, 0), Particle.SOUL_FIRE_FLAME, 60, 1.5, 1.5, 1.5, 0.05, null, true);
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
            plugin.fx.particle(l, Particle.ANGRY_VILLAGER, 20, gm.entity.getWidth(), 0, true);
            plugin.fx.particle(l, Particle.FLAME, 80, gm.entity.getWidth() * 0.6, 0.08, true);
        }
    }

    void onDeath(GameMob gm) {
        forget(gm);
        Location l = gm.entity.getLocation().add(0, gm.entity.getHeight() / 2, 0);
        massive(l, gm.entity.getWidth() + 1);
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
        cb.ramUntil = plugin.tick() + 25;
    }

    // ───────────────────────────── TICK ─────────────────────────────

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
            switch (gm.entity.getType()) {
                case WITHER -> {
                    if (distToBase(gm) <= gm.boss.attackDistance() + 6 && now >= cb.nextAttack) {
                        cb.nextAttack = now + (long) every;
                        int n = gm.furious ? 3 : 1;
                        for (int i = 0; i < n; i++) shoot(gm, Kind.CALAVERA, i);
                        warn("ataqueWither");
                    }
                }
                case ENDER_DRAGON -> {
                    if (distToBase(gm) <= gm.boss.attackDistance() + 12 && now >= cb.nextAttack) {
                        cb.nextAttack = now + (long) every;
                        shoot(gm, Kind.FUEGO, 0);
                        if (gm.furious) shoot(gm, Kind.FUEGO, 1);
                        warn("ataqueDragon");
                        plugin.fx.sound(l, Sound.ENTITY_ENDER_DRAGON_SHOOT, 4f, 0.8f, true);
                    }
                }
                case WARDEN -> warden(gm, cb, l, now, every);
                default -> {
                }
            }
        }
        tickBalls(now);
    }

    private void warden(GameMob gm, Combat cb, Location l, long now, double every) {
        Vector base = plugin.arena.baseCenter();
        // cañón sónico: carga (sonido de vanilla), y a los 1,5 s rayo hasta la base
        if (cb.chargeAt > 0 && now >= cb.chargeAt) {
            cb.chargeAt = -1;
            Location from = l.clone().add(0, gm.entity.getHeight() * 0.6, 0);
            Vector d = base.clone().add(new Vector(0, 1, 0)).subtract(from.toVector());
            double len = d.length();
            d.normalize();
            for (double s = 1; s < len; s += 1.6) plugin.fx.particle(from.clone().add(d.clone().multiply(s)), Particle.SONIC_BOOM, 1, 0, 0, true);
            plugin.fx.sound(from, Sound.ENTITY_WARDEN_SONIC_BOOM, 5f, 0.9f, true);
            plugin.fx.sound(base.toLocation(l.getWorld()), Sound.ENTITY_WARDEN_SONIC_BOOM, 4f, 1.1f, true);
            plugin.game.damageBase(gm.boss.attackDamage(), gm);
        }
        if (!cb.atBase && cb.chargeAt < 0 && distToBase(gm) <= gm.boss.attackDistance() && now >= cb.nextAttack) {
            cb.nextAttack = now + (long) every;
            cb.chargeAt = now + 30;
            plugin.fx.sound(l, Sound.ENTITY_WARDEN_SONIC_CHARGE, 4f, 1f, true);
            plugin.fx.particle(l.clone().add(0, gm.entity.getHeight() * 0.6, 0), Particle.SCULK_SOUL, 30, 1, 1, 1, 0.05, null, true);
            warn("ataqueWarden");
        }
        if (cb.atBase) {
            if (cb.ramPhase == 0 && now >= cb.ramUntil) {
                cb.ramPhase = 1;
                cb.ramUntil = now + (long) (gm.boss.ramEvery() * 20);
                plugin.fx.sound(l, Sound.ENTITY_WARDEN_ROAR, 4f, 1f, true);
            } else if (cb.ramPhase == 1 && (near(gm, base.clone().add(toSpawn().multiply(2)), 2.2) || now >= cb.ramUntil)) {
                // ¡embestida!
                cb.ramPhase = 0;
                cb.ramUntil = now + 20;
                Location hit = base.toLocation(l.getWorld()).add(toSpawn().multiply(1.5)).add(0, 1, 0);
                plugin.fx.particle(hit, Particle.EXPLOSION, 3, 1.5, 0.1, true);
                plugin.fx.particle(hit, Particle.BLOCK, 40, 2, 1, 0.5, 0.2, org.bukkit.Material.SPRUCE_PLANKS.createBlockData(), true);
                plugin.fx.sound(hit, Sound.ENTITY_WARDEN_ATTACK_IMPACT, 5f, 0.7f, true);
                plugin.fx.sound(hit, Sound.ENTITY_ZOMBIE_BREAK_WOODEN_DOOR, 3f, 0.6f, true);
                plugin.game.damageBase(gm.boss.ramDamage(), gm);
                plugin.game.shake();
            }
        }
    }

    private void warn(String key) {
        long now = plugin.tick();
        if (now - lastWarnTitle < 100) return;
        lastWarnTitle = now;
        for (Player p : plugin.game.viewers()) p.sendActionBar(Txt.fmt(plugin.settings.msg(key)));
    }

    private void shoot(GameMob gm, Kind kind, int i) {
        Location from = gm.entity.getLocation().add(0, gm.entity.getHeight() * 0.7, 0);
        if (gm.entity.getType() == EntityType.WITHER && i > 0) from.add(new Vector(-toSpawn().getZ(), 0, toSpawn().getX()).multiply(i == 1 ? 1.4 : -1.4));
        Vector to = plugin.arena.baseCenter().clone().add(new Vector((Math.random() - 0.5) * 6, 0, 0));
        Vector dir = to.clone().subtract(from.toVector()).normalize();
        from.add(dir.clone().multiply(gm.entity.getWidth() * 0.6 + 1));
        Class<? extends Fireball> cls = kind == Kind.CALAVERA ? WitherSkull.class : LargeFireball.class;
        Fireball f = from.getWorld().spawn(from, cls, e -> {
            e.setShooter(gm.entity);
            e.setYield(0);
            e.setIsIncendiary(false);
            e.setDirection(dir);
            e.setAcceleration(new Vector());
            e.setVelocity(dir.clone().multiply(kind == Kind.CALAVERA ? 0.55 : 0.42));
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
                plugin.fx.explosion(l, 3, false);
                if (b.returned) {
                    plugin.mobs.damage(b.owner, b.owner.boss.returnDamage(), null);
                    plugin.fx.sound(l, Sound.ENTITY_ENDER_DRAGON_HURT, 3f, 0.8f, true);
                } else plugin.game.damageBase(b.owner.boss.attackDamage(), null);
                continue;
            }
            double speed = b.returned ? 0.95 : b.kind == Kind.CALAVERA ? 0.55 : 0.42;
            Vector v = d.multiply(1 / dist).multiply(speed);
            b.e.setVelocity(v);
            b.e.setDirection(v);
            b.e.setAcceleration(new Vector());
            if (now % 2 == 0) plugin.fx.particle(l, b.kind == Kind.CALAVERA ? Particle.SMOKE : Particle.FLAME, 3, 0.2, 0.02, false);
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
            p.sendActionBar(Txt.fmt("&a&l¡CALAVERA DESTRUIDA!"));
            p.playSound(p.getLocation(), Sound.BLOCK_NOTE_BLOCK_PLING, 1f, 1.8f);
            return;
        }
        b.returned = true;
        plugin.fx.particle(l, Particle.CRIT, 30, 0.5, 0.4, true);
        plugin.fx.particle(l, Particle.END_ROD, 12, 0.3, 0.12, true);
        plugin.fx.sound(l, Sound.ENTITY_PLAYER_ATTACK_CRIT, 2f, 1.2f, true);
        p.playSound(p.getLocation(), Sound.BLOCK_NOTE_BLOCK_PLING, 1.5f, 2f);
        p.sendActionBar(Txt.fmt("&6&l¡DEVUELTA!"));
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
