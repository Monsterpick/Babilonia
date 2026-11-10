package dev.livearena.basedefense.mob;

import com.destroystokyo.paper.entity.ai.Goal;
import com.destroystokyo.paper.entity.ai.GoalKey;
import com.destroystokyo.paper.entity.ai.GoalType;
import com.destroystokyo.paper.event.entity.EntityRemoveFromWorldEvent;
import dev.livearena.basedefense.BaseDefense;
import dev.livearena.basedefense.Settings;
import dev.livearena.basedefense.util.Txt;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.bukkit.Bukkit;
import org.bukkit.Color;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.World;
import org.bukkit.attribute.Attribute;
import org.bukkit.attribute.AttributeInstance;
import org.bukkit.entity.AbstractSkeleton;
import org.bukkit.entity.Creeper;
import org.bukkit.entity.Display;
import org.bukkit.entity.Entity;
import org.bukkit.entity.EntityType;
import org.bukkit.entity.Mob;
import org.bukkit.entity.Player;
import org.bukkit.entity.Spider;
import org.bukkit.entity.TextDisplay;
import org.bukkit.entity.Zombie;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.CreatureSpawnEvent;
import org.bukkit.event.entity.EntityCombustEvent;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.entity.EntityDeathEvent;
import org.bukkit.event.entity.EntityTargetEvent;
import org.bukkit.event.entity.EntityTransformEvent;
import org.bukkit.inventory.EntityEquipment;
import org.bukkit.inventory.ItemStack;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.util.BoundingBox;
import org.bukkit.util.Vector;

/**
 * Colección propia de mobs del juego, cola de spawn y la tarea central que detecta la llegada a
 * la base. Nunca se recorren las entidades del mundo: solo este mapa.
 */
public final class MobManager implements Listener {
    private final BaseDefense plugin;
    private final Map<UUID, GameMob> mobs = new LinkedHashMap<>();
    private final ArrayDeque<Order> queue = new ArrayDeque<>();
    private final GoalKey<Mob> laneKey;
    private int labels;
    public int kills, spawned;
    private long lastSpawnFx;
    private final org.bukkit.command.CommandSender silent = Bukkit.createCommandSender(c -> {});

    /** Pedido de horda: se reparte en varios ticks. */
    static final class Order {
        final Settings.MobDef def;
        final String donor;
        int left;
        int labelsLeft;

        Order(Settings.MobDef def, String donor, int count, int labels) {
            this.def = def;
            this.donor = donor;
            this.left = count;
            this.labelsLeft = labels;
        }
    }

    public MobManager(BaseDefense plugin) {
        this.plugin = plugin;
        this.laneKey = GoalKey.of(Mob.class, new NamespacedKey(plugin, "carril"));
    }

    public Collection<GameMob> all() {
        return mobs.values();
    }

    public int alive() {
        int n = 0;
        for (GameMob gm : mobs.values()) if (!gm.isBoss()) n++;
        return n;
    }

    public int queued() {
        int n = 0;
        for (Order o : queue) n += o.left;
        return n;
    }

    public GameMob get(Entity e) {
        return e == null ? null : mobs.get(e.getUniqueId());
    }

    public boolean isGameMob(Entity e) {
        return e != null && e.getPersistentDataContainer().has(plugin.mobKey);
    }

    public void clearQueue() {
        queue.clear();
    }

    // ───────────────────────────── PEDIDOS ─────────────────────────────

    /** Encola una horda. Devuelve cuántos se aceptaron. */
    public int enqueue(Settings.MobDef def, int count, String donor) {
        int perHorde = plugin.settings.labelsPerHorde;
        queue.addLast(new Order(def, donor, count, perHorde));
        return count;
    }

    // ───────────────────────────── TICK CENTRAL ─────────────────────────────

    public void tick() {
        World w = plugin.world(false);
        if (w == null || plugin.arena == null || !plugin.arena.valid()) return;
        boolean active = plugin.game.running() && !plugin.game.paused();
        if (active) spawnFromQueue(w);
        if (mobs.isEmpty()) return;
        BoundingBox base = plugin.arena.baseRegion;
        int g = plugin.arena.groundY;
        long now = plugin.tick();
        List<GameMob> reached = null, lost = null;
        for (GameMob gm : mobs.values()) {
            Mob m = gm.entity;
            if (!m.isValid()) {
                if (lost == null) lost = new ArrayList<>();
                lost.add(gm);
                continue;
            }
            Location l = m.getLocation();
            boolean inBase = gm.isBoss() && gm.manual
                ? l.getX() >= base.getMinX() && l.getX() <= base.getMaxX() && l.getZ() >= base.getMinZ() && l.getZ() <= base.getMaxZ()
                : base.contains(l.getX(), l.getY(), l.getZ());
            if (inBase && active && gm.isBoss()) {
                plugin.bosses.atBase(gm);
                inBase = false;
            }
            if (inBase && active) {
                if (reached == null) reached = new ArrayList<>();
                reached.add(gm);
                continue;
            }
            if (l.getY() < g - 12) {
                if (lost == null) lost = new ArrayList<>();
                lost.add(gm);
                continue;
            }
            if (gm.manual) moveManual(gm, l);
            else {
                if (m instanceof Spider && l.getY() > g + 1.7) m.setVelocity(new Vector(0, -0.35, 0));
                if ((now + m.getEntityId()) % 20 == 0) checkStuck(gm, l, now);
            }
        }
        if (reached != null) for (GameMob gm : reached) reachBase(gm);
        if (lost != null) for (GameMob gm : lost) discard(gm, false);
    }

    private void spawnFromQueue(World w) {
        int budget = plugin.settings.spawnPerTick;
        int cap = plugin.settings.mobCap;
        while (budget > 0 && !queue.isEmpty() && alive() < cap) {
            Order o = queue.peekFirst();
            boolean label = o.labelsLeft > 0 && labels < plugin.settings.labelsMax;
            if (spawn(w, o.def, o.donor, label) != null && label) o.labelsLeft--;
            o.left--;
            budget--;
            if (o.left <= 0) queue.pollFirst();
        }
    }

    // ───────────────────────────── SPAWN ─────────────────────────────

    public GameMob spawn(World w, Settings.MobDef def, String donor, boolean label) {
        Location at = spawnPoint(w);
        // cada fase los mobs salen con más vida y algo más rápidos
        double hp = def.health() * plugin.waves.healthMult(), speed = def.speed() * plugin.waves.speedMult();
        Mob m = spawnEntity(w, at, def.entity(), hp, speed, 1.0, plugin.fx.rnd().nextInt(6) != 0);
        if (m == null) return null;
        double off = (plugin.fx.rnd().nextDouble() * 2 - 1) * Math.max(1, plugin.arena.laneHalfWidth - 1.5);
        GameMob gm = new GameMob(m, donor, def, null, hp, off);
        mobs.put(m.getUniqueId(), gm);
        spawned++;
        attachBrain(gm, speed);
        if (label) addLabel(gm, 1f);
        updateBar(gm);
        spawnFx(at, false);
        return gm;
    }

    /** Usado por los jefes. */
    /** Usado por los jefes. done recibe el jefe ya creado (el dragón llega un tick después). */
    boolean spawnBoss(World w, Settings.BossDef def, String donor, java.util.function.Consumer<GameMob> done) {
        Location at = spawnPoint(w);
        if (def.flying()) at.add(0, def.height(), 0);
        double realHp = Math.min(def.health(), 1000);
        if (def.entity() == EntityType.ENDER_DRAGON) {
            String tag = summonDragon(w, at);
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                for (org.bukkit.entity.EnderDragon d : w.getEntitiesByClass(org.bukkit.entity.EnderDragon.class)) {
                    if (!d.getScoreboardTags().contains(tag)) continue;
                    d.getPersistentDataContainer().set(plugin.mobKey, PersistentDataType.BYTE, (byte) 1);
                    d.setPersistent(false);
                    d.setRemoveWhenFarAway(false);
                    set(d, Attribute.MAX_HEALTH, realHp);
                    d.setHealth(realHp);
                    if (def.scale() != 1.0) set(d, Attribute.SCALE, def.scale());
                    done.accept(finishBoss(d, def, donor, at));
                    return;
                }
                plugin.getLogger().warning("No se pudo invocar el dragon");
            }, 1L);
            return true;
        }
        Mob m = spawnEntity(w, at, def.entity(), realHp, def.speed(), def.scale(), false);
        if (m == null) return false;
        done.accept(finishBoss(m, def, donor, at));
        return true;
    }

    private GameMob finishBoss(Mob m, Settings.BossDef def, String donor, Location at) {
        GameMob gm = new GameMob(m, donor, null, def, def.health(), 0);
        gm.speed = def.speed();
        mobs.put(m.getUniqueId(), gm);
        if (def.flying()) {
            gm.manual = true;
            // el dragón sin IA no interpola su posición en el cliente: se queda en fase HOVER y lo movemos nosotros
            if (m instanceof org.bukkit.entity.EnderDragon d) d.setPhase(org.bukkit.entity.EnderDragon.Phase.HOVER);
            else m.setAI(false);
        } else attachBrain(gm, def.speed());
        addLabel(gm, 1.6f);
        updateBar(gm);
        spawnFx(at, true);
        return gm;
    }

    private Location spawnPoint(World w) {
        Location base = plugin.arena.mobSpawn(w);
        double spread = Math.min(3.2, plugin.arena.laneHalfWidth - 2);
        return base.add((plugin.fx.rnd().nextDouble() * 2 - 1) * spread, 0, plugin.fx.rnd().nextDouble() * 1.2);
    }

    @SuppressWarnings("unchecked")
    private Mob spawnEntity(World w, Location at, EntityType type, double hp, double speed, double scale, boolean silent) {
        Class<? extends Entity> cls = type.getEntityClass();
        if (cls == null || !Mob.class.isAssignableFrom(cls)) {
            plugin.getLogger().warning("El tipo " + type.key() + " no es un mob que pueda caminar.");
            return null;
        }
        float yaw = facingYaw();
        at.setYaw(yaw);
        return w.spawn(at, (Class<Mob>) cls, CreatureSpawnEvent.SpawnReason.CUSTOM, false, m -> {
            m.getPersistentDataContainer().set(plugin.mobKey, PersistentDataType.BYTE, (byte) 1);
            m.setPersistent(false);
            m.setRemoveWhenFarAway(false);
            m.setCanPickupItems(false);
            m.setCollidable(false);
            m.setSilent(silent);
            m.setRotation(yaw, 0);
            set(m, Attribute.MAX_HEALTH, hp);
            m.setHealth(hp);
            set(m, Attribute.MOVEMENT_SPEED, speed);
            set(m, Attribute.FOLLOW_RANGE, 64);
            set(m, Attribute.KNOCKBACK_RESISTANCE, 0.6);
            if (scale != 1.0) set(m, Attribute.SCALE, scale);
            m.setMaximumNoDamageTicks(0);
            m.setNoDamageTicks(0);
            EntityEquipment eq = m.getEquipment();
            if (eq != null) {
                eq.clear();
                for (var slot : org.bukkit.inventory.EquipmentSlot.values()) {
                    try {
                        eq.setDropChance(slot, 0f);
                    } catch (IllegalArgumentException ignored) {
                    }
                }
            }
            if (m instanceof Zombie z) {
                z.setShouldBurnInDay(false);
                z.setAdult();
            }
            if (m instanceof AbstractSkeleton s) {
                s.setShouldBurnInDay(false);
                if (eq != null) eq.setItemInMainHand(new ItemStack(Material.BOW));
            }
            if (m instanceof org.bukkit.entity.PiglinAbstract pa) pa.setImmuneToZombification(true);
            if (m instanceof org.bukkit.entity.Hoglin h) h.setImmuneToZombification(true);
            if (eq != null) {
                Material hand = switch (type.name()) {
                    case "PIGLIN" -> Material.GOLDEN_SWORD;
                    case "PIGLIN_BRUTE" -> Material.GOLDEN_AXE;
                    case "WITHER_SKELETON" -> Material.STONE_SWORD;
                    case "VINDICATOR" -> Material.IRON_AXE;
                    case "PILLAGER" -> Material.CROSSBOW;
                    case "STRAY", "BOGGED" -> Material.BOW;
                    default -> null;
                };
                if (hand != null) eq.setItemInMainHand(new ItemStack(hand));
            }
            if (m instanceof Creeper c) {
                c.setExplosionRadius(0);
                c.setMaxFuseTicks(Integer.MAX_VALUE / 2);
            }
            if (m instanceof org.bukkit.entity.Wither wi) {
                wi.setInvulnerableTicks(0);
                if (wi.getBossBar() != null) wi.getBossBar().setVisible(false);
            }
        });
    }

    /**
     * El dragón creado con World#spawn no llega a dibujarse en el cliente fuera del End; invocado como
     * lo hace el comando vanilla sí. Devuelve la etiqueta para encontrarlo en el siguiente tick.
     */
    private String summonDragon(World w, Location at) {
        String tag = "bd_" + Long.toHexString(plugin.fx.rnd().nextLong());
        String cmd = String.format(java.util.Locale.ROOT, "execute in %s run summon minecraft:ender_dragon %.2f %.2f %.2f {DragonPhase:10,Tags:[\"%s\"],Rotation:[%.1ff,0f]}",
            w.getKey().asString(), at.getX(), at.getY(), at.getZ(), tag, facingYaw() + 180f);
        Bukkit.dispatchCommand(Bukkit.getConsoleSender(), cmd);
        return tag;
    }

    private static void set(Mob m, Attribute a, double v) {
        AttributeInstance i = m.getAttribute(a);
        if (i != null) i.setBaseValue(v);
    }

    float facingYaw() {
        List<Vector> wp = plugin.arena.waypoints;
        Vector d = wp.get(wp.size() - 1).clone().subtract(wp.get(0));
        return (float) Math.toDegrees(Math.atan2(-d.getX(), d.getZ()));
    }

    /** Quita la IA vanilla y deja un solo goal de carril. Los mobs con "cerebro" (warden…) se mueven a mano. */
    private void attachBrain(GameMob gm, double speed) {
        Mob m = gm.entity;
        var goals = Bukkit.getMobGoals();
        boolean goalBased = !goals.getAllGoals(m).isEmpty();
        goals.removeAllGoals(m);
        m.setTarget(null);
        if (goalBased) goals.addGoal(m, 0, new LaneGoal(gm));
        else {
            gm.manual = true;
            gm.speed = speed * 0.8; // atributo de velocidad → bloques/tick aproximados
            m.setAI(false);
        }
    }

    private void addLabel(GameMob gm, float scale) {
        if (gm.donor == null || gm.donor.isBlank()) return;
        Mob m = gm.entity;
        TextDisplay t = m.getWorld().spawn(m.getLocation(), TextDisplay.class, d -> {
            d.setPersistent(false);
            d.text(labelText(gm));
            d.setBillboard(Display.Billboard.CENTER);
            d.setShadowed(true);
            d.setSeeThrough(false);
            d.setBackgroundColor(Color.fromARGB(110, 0, 0, 0));
            d.setViewRange(2.4f);
            d.setBrightness(new Display.Brightness(15, 15));
            d.setTransformation(new org.bukkit.util.Transformation(new org.joml.Vector3f(0, 0.25f, 0), new org.joml.Quaternionf(), new org.joml.Vector3f(scale), new org.joml.Quaternionf()));
            d.getPersistentDataContainer().set(plugin.mobKey, PersistentDataType.BYTE, (byte) 2);
        });
        if (!m.addPassenger(t)) {
            t.remove(); // el dragón (multiparte) no admite pasajeros: su nombre va en la BossBar
            return;
        }
        gm.label = t;
        labels++;
    }

    private net.kyori.adventure.text.Component labelText(GameMob gm) {
        return Txt.fmt(plugin.settings.label, "usuario", gm.donor, "tipo", gm.typeName()).append(net.kyori.adventure.text.Component.newline()).append(healthBar(gm));
    }

    /** Barra de vida en 10 tramos (verde → amarillo → rojo). */
    net.kyori.adventure.text.Component healthBar(GameMob gm) {
        double f = Math.max(0, Math.min(1, gm.hp / gm.maxHp));
        int n = (int) Math.ceil(f * 10);
        String col = f > 0.6 ? "&a" : f > 0.3 ? "&e" : "&c";
        return Txt.fmt("&c❤ " + col + "▮".repeat(n) + "&8" + "▮".repeat(10 - n));
    }

    /** Vida visible: en el TextDisplay del donante o, si no lo lleva, como nombre del mob. */
    void updateBar(GameMob gm) {
        if (gm.label != null && gm.label.isValid()) {
            gm.label.text(labelText(gm));
            return;
        }
        if (gm.isBoss()) return;
        gm.entity.customName(healthBar(gm));
        gm.entity.setCustomNameVisible(true);
    }

    private void spawnFx(Location at, boolean big) {
        long now = plugin.tick();
        plugin.fx.particle(at.clone().add(0, 1, 0), Particle.PORTAL, big ? 120 : 14, 0.4, 0.8, 0.4, 0.6, null, big);
        plugin.fx.particle(at.clone().add(0, 0.6, 0), Particle.LARGE_SMOKE, big ? 30 : 3, 0.4, 0.3, 0.4, 0.02, null, big);
        if (big || now - lastSpawnFx > 4) {
            lastSpawnFx = now;
            plugin.fx.sound(at, Sound.ENTITY_ENDERMAN_TELEPORT, big ? 2f : 0.7f, big ? 0.5f : 0.6f + plugin.fx.rnd().nextFloat() * 0.3f, big);
        }
    }

    // ───────────────────────────── MOVIMIENTO ─────────────────────────────

    /** Punto objetivo actual (waypoint + desplazamiento lateral perpendicular al carril). */
    Vector target(GameMob gm) {
        List<Vector> wp = plugin.arena.waypoints;
        int i = Math.min(gm.waypoint, wp.size() - 1);
        Vector t = wp.get(i).clone();
        Vector prev = i == 0 ? plugin.arena.mobSpawn : wp.get(i - 1);
        Vector dir = t.clone().subtract(prev).setY(0);
        if (dir.lengthSquared() < 1e-4) dir = new Vector(0, 0, -1);
        dir.normalize();
        Vector side = new Vector(-dir.getZ(), 0, dir.getX());
        double off = i == wp.size() - 1 ? gm.offset * 0.9 : gm.offset;
        return t.add(side.multiply(off));
    }

    /** ¿Ya pasó el waypoint actual? */
    boolean reached(GameMob gm, Location l) {
        List<Vector> wp = plugin.arena.waypoints;
        if (gm.waypoint >= wp.size() - 1) return false;
        Vector t = target(gm);
        double dx = t.getX() - l.getX(), dz = t.getZ() - l.getZ();
        if (dx * dx + dz * dz < 6.5) return true;
        Vector prev = gm.waypoint == 0 ? plugin.arena.mobSpawn : wp.get(gm.waypoint - 1);
        Vector dir = wp.get(gm.waypoint).clone().subtract(prev).setY(0);
        return dir.dot(new Vector(l.getX() - t.getX(), 0, l.getZ() - t.getZ())) > 0;
    }

    /** Llamado por el goal: avanza de waypoint y vuelve a pedir ruta cuando hace falta. */
    void steer(GameMob gm) {
        Mob m = gm.entity;
        Location l = m.getLocation();
        boolean repath = false;
        while (reached(gm, l)) {
            gm.waypoint++;
            repath = true;
        }
        long now = plugin.tick();
        if (repath || (now + m.getEntityId()) % 30 == 0 || !m.getPathfinder().hasPath()) {
            Vector t = target(gm);
            double mult = gm.furious ? plugin.settings.furySpeed : 1.0;
            if (!m.getPathfinder().moveTo(new Location(m.getWorld(), t.getX(), t.getY(), t.getZ()), mult)) nudge(gm, l, 1.2);
        }
    }

    private double remaining(GameMob gm, Location l) {
        List<Vector> wp = plugin.arena.waypoints;
        int i = Math.min(gm.waypoint, wp.size() - 1);
        Vector t = target(gm);
        double d = Math.hypot(t.getX() - l.getX(), t.getZ() - l.getZ());
        for (int k = i; k < wp.size() - 1; k++) d += wp.get(k).distance(wp.get(k + 1));
        return d;
    }

    private void checkStuck(GameMob gm, Location l, long now) {
        double progress = -remaining(gm, l);
        if (progress > gm.bestProgress + 0.6) {
            gm.bestProgress = progress;
            gm.lastProgressTick = now;
            gm.stuckCount = 0;
        } else if (now - gm.lastProgressTick > 100) {
            gm.stuckCount++;
            gm.lastProgressTick = now;
            nudge(gm, l, gm.stuckCount > 3 ? 6 : 1.6);
        }
    }

    private void nudge(GameMob gm, Location l, double dist) {
        Vector t = target(gm);
        Vector d = new Vector(t.getX() - l.getX(), 0, t.getZ() - l.getZ());
        if (d.lengthSquared() < 0.01) return;
        d.normalize().multiply(Math.min(dist, Math.sqrt(t.clone().setY(0).distanceSquared(l.toVector().setY(0)))));
        Location to = l.clone().add(d);
        to.setY(plugin.arena.groundY + 1);
        gm.entity.teleport(to);
    }

    /** Jefes voladores y mobs sin goals: el plugin los mueve por el carril a altura fija. */
    private void moveManual(GameMob gm, Location l) {
        List<Vector> wp = plugin.arena.waypoints;
        Vector t;
        double sp;
        if (gm.isBoss()) {
            // los jefes van a su puesto de ataque frente a la base (o embisten, el warden)
            t = plugin.bosses.target(gm);
            sp = gm.speed * plugin.bosses.speedMul(gm);
        } else {
            while (reached(gm, l)) gm.waypoint++;
            t = gm.waypoint >= wp.size() - 1 ? plugin.arena.baseCenter().clone().setY(wp.get(wp.size() - 1).getY()) : target(gm);
            sp = gm.speed * (gm.furious ? plugin.settings.furySpeed : 1.0);
        }
        double y = plugin.arena.groundY + 1 + (gm.isBoss() && gm.boss.flying() ? gm.boss.height() : 0);
        Vector d = new Vector(t.getX() - l.getX(), 0, t.getZ() - l.getZ());
        double len = d.length();
        Location to = l.clone();
        if (len > 1e-3) to.add(d.multiply(Math.min(sp, len) / len));
        // vaivén suave de los voladores
        if (gm.isBoss() && gm.boss.flying()) y += Math.sin((plugin.tick() + gm.entity.getEntityId() * 7) * 0.06) * 0.8;
        to.setY(to.getY() + (y - to.getY()) * 0.15);
        Vector look = len > 0.4 ? new Vector(t.getX() - l.getX(), 0, t.getZ() - l.getZ()) : plugin.arena.baseCenter().clone().subtract(l.toVector());
        float yaw = (float) Math.toDegrees(Math.atan2(-look.getX(), look.getZ()));
        if (gm.entity.getType() == EntityType.ENDER_DRAGON) yaw += 180f;
        to.setYaw(yaw);
        to.setPitch(0);
        if (gm.entity.getType() == EntityType.ENDER_DRAGON) {
            // el cliente solo dibuja bien al dragón movido como lo hace /tp (historial de vuelo)
            Bukkit.dispatchCommand(silent, String.format(java.util.Locale.ROOT, "execute in %s as %s run tp @s %.3f %.3f %.3f %.1f 0",
                to.getWorld().getKey().asString(), gm.entity.getUniqueId(), to.getX(), to.getY(), to.getZ(), to.getYaw()));
            return;
        }
        if (!gm.entity.teleport(to) && !gm.warned) {
            gm.warned = true;
            plugin.getLogger().warning("No se pudo mover " + gm.entity.getType() + " (teleport rechazado)");
        }
    }

    // ───────────────────────────── DAÑO Y MUERTE ─────────────────────────────

    /** Daño del jugador (armas). Sin invulnerabilidad entre golpes. */
    public void damage(GameMob gm, double amount, Player by) {
        if (gm.dead || amount <= 0) return;
        gm.hp -= amount;
        Mob m = gm.entity;
        if (gm.hp <= 0) {
            kill(gm, by);
            return;
        }
        double max = m.getAttribute(Attribute.MAX_HEALTH) != null ? m.getAttribute(Attribute.MAX_HEALTH).getValue() : 20;
        m.setHealth(Math.max(1, Math.min(max, max * gm.hp / gm.maxHp)));
        m.playHurtAnimation(by == null ? 0 : by.getYaw());
        m.setNoDamageTicks(0);
        updateBar(gm);
        if (gm.isBoss()) plugin.bosses.onDamage(gm);
    }

    public void kill(GameMob gm, Player by) {
        if (gm.dead) return;
        gm.dead = true;
        mobs.remove(gm.entity.getUniqueId());
        removeLabel(gm);
        kills++;
        Location l = gm.entity.getLocation();
        if (gm.isBoss()) plugin.bosses.onDeath(gm);
        else {
            plugin.fx.blood(l, gm.entity.getHeight() > 1.2 ? 1.0 : 0.7);
            plugin.loot.onKill(gm, l);
        }
        plugin.game.onKill(gm);
        gm.entity.setHealth(0);
    }

    private void reachBase(GameMob gm) {
        Location l = gm.entity.getLocation();
        int dmg = gm.baseDamage();
        discard(gm, true);
        {
            plugin.fx.particle(l.clone().add(0, 1, 0), Particle.LARGE_SMOKE, 8, 0.3, 0.5, 0.3, 0.03, null, false);
            plugin.fx.particle(l.clone().add(0, 1, 0), Particle.DUST, 10, 0.4, 0.6, 0.4, 0, new Particle.DustOptions(Color.RED, 1.6f), false);
        }
        plugin.game.damageBase(dmg, gm);
    }

    /** Quita un mob sin muerte (llegó a la base, cayó al vacío o se limpia la ronda). */
    public void discard(GameMob gm, boolean poof) {
        gm.dead = true;
        mobs.remove(gm.entity.getUniqueId());
        removeLabel(gm);
        if (gm.isBoss()) plugin.bosses.forget(gm);
        if (poof && gm.entity.isValid()) plugin.fx.particle(gm.entity.getLocation().add(0, 1, 0), Particle.POOF, 4, 0.3, 0.05, false);
        gm.entity.remove();
    }

    private void removeLabel(GameMob gm) {
        if (gm.label != null) {
            if (gm.label.isValid()) gm.label.remove();
            gm.label = null;
            labels = Math.max(0, labels - 1);
        }
    }

    /** Elimina todos los mobs. fx=true: nube de humo en una parte de ellos (con límite). */
    public void removeAll(boolean fx) {
        List<GameMob> copy = new ArrayList<>(mobs.values());
        int shown = 0;
        for (GameMob gm : copy) {
            if (fx && gm.entity.isValid() && shown++ < 60) {
                Location l = gm.entity.getLocation().add(0, 0.8, 0);
                plugin.fx.particle(l, Particle.LARGE_SMOKE, 6, 0.3, 0.4, 0.3, 0.02, null, true);
                plugin.fx.particle(l, Particle.FLAME, 4, 0.3, 0.4, 0.3, 0.02, null, true);
            }
            discard(gm, false);
        }
        labels = 0;
    }

    /** Al arrancar: quita restos de una sesión anterior (marcados con PDC). */
    public void purgeStrays(World w) {
        for (Entity e : w.getEntities()) if (e.getPersistentDataContainer().has(plugin.mobKey) && !mobs.containsKey(e.getUniqueId())) e.remove();
    }

    // ───────────────────────────── EVENTOS ─────────────────────────────

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onDamage(EntityDamageEvent e) {
        if (!isGameMob(e.getEntity())) return;
        EntityDamageEvent.DamageCause c = e.getCause();
        if (c == EntityDamageEvent.DamageCause.KILL || c == EntityDamageEvent.DamageCause.VOID) return;
        e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void onTarget(EntityTargetEvent e) {
        if (isGameMob(e.getEntity())) e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void onCombust(EntityCombustEvent e) {
        if (isGameMob(e.getEntity())) e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void onTransform(EntityTransformEvent e) {
        if (isGameMob(e.getEntity())) e.setCancelled(true);
    }

    @EventHandler
    public void onDeath(EntityDeathEvent e) {
        if (!isGameMob(e.getEntity())) return;
        e.getDrops().clear();
        e.setDroppedExp(0);
        GameMob gm = mobs.get(e.getEntity().getUniqueId());
        if (gm != null) {
            gm.dead = true;
            mobs.remove(e.getEntity().getUniqueId());
            removeLabel(gm);
            if (gm.isBoss()) plugin.bosses.forget(gm);
        }
    }

    @EventHandler
    public void onRemove(EntityRemoveFromWorldEvent e) {
        GameMob gm = mobs.get(e.getEntity().getUniqueId());
        if (gm == null) return;
        // /kill u otro plugin: lo sacamos de la colección en el siguiente tick (no durante la iteración)
        Bukkit.getScheduler().runTask(plugin, () -> {
            if (!gm.entity.isValid() && mobs.get(gm.entity.getUniqueId()) == gm) discard(gm, false);
        });
    }

    /** Goal único de carril. */
    final class LaneGoal implements Goal<Mob> {
        private final GameMob gm;

        LaneGoal(GameMob gm) {
            this.gm = gm;
        }

        @Override
        public boolean shouldActivate() {
            return !gm.dead && plugin.game.running();
        }

        @Override
        public boolean shouldStayActive() {
            return !gm.dead && plugin.game.running();
        }

        @Override
        public void stop() {
            gm.entity.getPathfinder().stopPathfinding();
        }

        @Override
        public void tick() {
            if (!plugin.game.paused()) steer(gm);
        }

        @Override
        public GoalKey<Mob> getKey() {
            return laneKey;
        }

        @Override
        public EnumSet<GoalType> getTypes() {
            return EnumSet.of(GoalType.MOVE, GoalType.LOOK, GoalType.JUMP);
        }
    }
}
