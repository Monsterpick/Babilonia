package dev.livearena.basedefense.weapon;

import dev.livearena.basedefense.BaseDefense;
import dev.livearena.basedefense.Settings;
import dev.livearena.basedefense.Settings.WeaponDef;
import dev.livearena.basedefense.Settings.WeaponKind;
import dev.livearena.basedefense.mob.Bosses;
import dev.livearena.basedefense.mob.GameMob;
import dev.livearena.basedefense.util.Txt;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.bukkit.Color;
import org.bukkit.FluidCollisionMode;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.block.Block;
import org.bukkit.block.BlockFace;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.entity.Snowball;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.entity.ProjectileHitEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerSwapHandItemsEvent;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.util.RayTraceResult;
import org.bukkit.util.Vector;

/**
 * Armas del streamer. Clic derecho dispara; el servidor solo recibe el clic cada ~4 ticks al
 * mantenerlo, así que el fuego automático lo sostiene la tarea central mientras el último clic sea
 * reciente. Clic izquierdo o F recargan.
 */
public final class Weapons implements Listener {
    private static final int HOLD_TICKS = 6;
    private final BaseDefense plugin;
    private final Map<UUID, Map<String, State>> states = new HashMap<>();
    private final Map<UUID, Long> lastClick = new HashMap<>();
    private final Map<UUID, Proj> projectiles = new HashMap<>();
    private long lastHitSound;

    private static final class State {
        int ammo;
        long reloadUntil;
        long nextShot;
    }

    private static final class Proj {
        final WeaponDef def;
        final Player owner;
        final Location origin;
        final long born;
        int bounces;

        Proj(WeaponDef def, Player owner, Location origin, long born, int bounces) {
            this.def = def;
            this.owner = owner;
            this.origin = origin;
            this.born = born;
            this.bounces = bounces;
        }
    }

    public Weapons(BaseDefense plugin) {
        this.plugin = plugin;
    }

    // ───────────────────────────── ÍTEMS ─────────────────────────────

    public void give(Player p) {
        states.remove(p.getUniqueId());
        for (WeaponDef w : plugin.settings.weapons.values()) p.getInventory().setItem(w.slot(), item(w));
        p.getInventory().setHeldItemSlot(0);
    }

    public void refreshItems() {
        Player p = plugin.game.streamer();
        if (p != null && plugin.game.running()) give(p);
    }

    private ItemStack item(WeaponDef w) {
        ItemStack it = w.item().createItemStack();
        ItemMeta m = it.getItemMeta();
        m.displayName(Txt.fmt("&l" + w.name()).decoration(net.kyori.adventure.text.format.TextDecoration.ITALIC, false));
        List<net.kyori.adventure.text.Component> lore = new ArrayList<>();
        lore.add(Txt.fmt("&7Daño &f" + fmt(w.damage()) + (w.kind() != WeaponKind.HITSCAN ? " &7en área &f" + fmt(w.radius()) + "m" : "")).decoration(net.kyori.adventure.text.format.TextDecoration.ITALIC, false));
        lore.add(Txt.fmt("&7Cadencia &f" + fmt(w.rate()) + "/s &8· &7Cargador &f" + w.magazine()).decoration(net.kyori.adventure.text.format.TextDecoration.ITALIC, false));
        lore.add(Txt.fmt("&8Clic derecho: disparar · Clic izq. o F: recargar").decoration(net.kyori.adventure.text.format.TextDecoration.ITALIC, false));
        m.lore(lore);
        m.getPersistentDataContainer().set(plugin.weaponKey, PersistentDataType.STRING, w.id());
        if (w.model() != null && !w.model().isBlank()) m.setItemModel(Settings.key(w.model()));
        m.setUnbreakable(true);
        m.setMaxStackSize(1);
        m.addItemFlags(ItemFlag.values());
        it.setItemMeta(m);
        return it;
    }

    private static String fmt(double d) {
        return d == Math.floor(d) ? String.valueOf((int) d) : String.format("%.1f", d);
    }

    public WeaponDef weaponOf(ItemStack it) {
        if (it == null || !it.hasItemMeta()) return null;
        String id = it.getItemMeta().getPersistentDataContainer().get(plugin.weaponKey, PersistentDataType.STRING);
        return id == null ? null : plugin.settings.weapons.get(id);
    }

    public boolean isWeapon(ItemStack it) {
        return it != null && it.hasItemMeta() && it.getItemMeta().getPersistentDataContainer().has(plugin.weaponKey);
    }

    private State state(Player p, WeaponDef w) {
        return states.computeIfAbsent(p.getUniqueId(), k -> new HashMap<>()).computeIfAbsent(w.id(), k -> {
            State s = new State();
            s.ammo = w.magazine();
            return s;
        });
    }

    // ───────────────────────────── ENTRADA ─────────────────────────────

    @EventHandler(priority = EventPriority.LOWEST)
    public void onInteract(PlayerInteractEvent e) {
        if (e.getHand() != EquipmentSlot.HAND) return;
        Player p = e.getPlayer();
        WeaponDef w = weaponOf(p.getInventory().getItemInMainHand());
        if (w == null) return;
        e.setCancelled(true);
        if (!plugin.game.running() || !plugin.inGameWorld(p)) return;
        Action a = e.getAction();
        if (a == Action.RIGHT_CLICK_AIR || a == Action.RIGHT_CLICK_BLOCK) {
            long now = plugin.tick();
            Long prev = lastClick.put(p.getUniqueId(), now);
            // semiautomática: un disparo por clic (los repetidos de mantener cuentan como clics)
            if (!w.automatic() || prev == null || now - prev > HOLD_TICKS) tryFire(p, w);
        } else if (a == Action.LEFT_CLICK_AIR || a == Action.LEFT_CLICK_BLOCK) reload(p, w);
    }

    @EventHandler(ignoreCancelled = true)
    public void onSwap(PlayerSwapHandItemsEvent e) {
        WeaponDef w = weaponOf(e.getPlayer().getInventory().getItemInMainHand());
        if (w == null && !plugin.inGameWorld(e.getPlayer())) return;
        e.setCancelled(true);
        if (w != null) reload(e.getPlayer(), w);
    }

    private void reload(Player p, WeaponDef w) {
        State s = state(p, w);
        long now = plugin.tick();
        if (s.reloadUntil > now || s.ammo >= w.magazine()) return;
        s.reloadUntil = now + Math.round(w.reload() * 20);
        p.playSound(p.getLocation(), Sound.ITEM_CROSSBOW_LOADING_START, 1f, 0.9f);
    }

    // ───────────────────────────── TICK ─────────────────────────────

    public void tick() {
        long now = plugin.tick();
        tickProjectiles(now);
        if (!plugin.game.running()) return;
        Player p = plugin.game.streamer();
        if (p == null || !plugin.inGameWorld(p)) return;
        WeaponDef w = weaponOf(p.getInventory().getItemInMainHand());
        // recargas terminadas (todas las armas, aunque no estén en la mano)
        Map<String, State> mine = states.get(p.getUniqueId());
        if (mine != null) for (var en : mine.entrySet()) {
            State s = en.getValue();
            if (s.reloadUntil != 0 && now >= s.reloadUntil) {
                WeaponDef d = plugin.settings.weapons.get(en.getKey());
                s.ammo = d == null ? 0 : d.magazine();
                s.reloadUntil = 0;
                if (d != null && d == w) p.playSound(p.getLocation(), Sound.ITEM_CROSSBOW_LOADING_END, 1f, 1.1f);
            }
        }
        if (w == null) return;
        Long lc = lastClick.get(p.getUniqueId());
        if (w.automatic() && lc != null && now - lc <= HOLD_TICKS) tryFire(p, w);
        if (now % 2 == 0) actionBar(p, w);
    }

    private void actionBar(Player p, WeaponDef w) {
        State s = state(p, w);
        long now = plugin.tick();
        if (s.reloadUntil > now) {
            double total = w.reload() * 20, left = s.reloadUntil - now;
            int filled = (int) Math.round((1 - left / total) * 12);
            String bar = "&a" + "█".repeat(Math.max(0, filled)) + "&8" + "█".repeat(Math.max(0, 12 - filled));
            p.sendActionBar(Txt.fmt(plugin.settings.msg("recargando").replace("{barra}", bar).replace("{arma}", w.name())));
        } else {
            String ammoColor = s.ammo <= Math.max(1, w.magazine() / 5) ? "&c" : "&f";
            p.sendActionBar(Txt.fmt(plugin.settings.msg("municion").replace("{arma}", w.name()).replace("{balas}", ammoColor + s.ammo + "&f"), "cargador", w.magazine()));
        }
    }

    // ───────────────────────────── DISPARO ─────────────────────────────

    private void tryFire(Player p, WeaponDef w) {
        State s = state(p, w);
        long now = plugin.tick();
        if (s.reloadUntil > now || now < s.nextShot) return;
        if (s.ammo <= 0) {
            p.playSound(p.getLocation(), Sound.BLOCK_DISPENSER_FAIL, 0.8f, 1.6f);
            reload(p, w);
            return;
        }
        s.ammo--;
        s.nextShot = now + w.cooldownTicks();
        switch (w.kind()) {
            case HITSCAN -> hitscan(p, w);
            case COHETE, GRANADA -> launch(p, w);
        }
        if (s.ammo <= 0) reload(p, w);
    }

    private Vector spread(Vector dir, double deg) {
        if (deg <= 0) return dir;
        var r = plugin.fx.rnd();
        double rad = Math.toRadians(deg);
        Vector v = dir.clone().add(new Vector(r.nextGaussian(), r.nextGaussian(), r.nextGaussian()).multiply(rad * 0.5));
        return v.normalize();
    }

    private Location muzzle(Player p, Vector dir) {
        Vector right = dir.clone().crossProduct(new Vector(0, 1, 0));
        if (right.lengthSquared() < 1e-4) right = new Vector(1, 0, 0);
        right.normalize();
        return p.getEyeLocation().add(dir.clone().multiply(0.6)).add(right.multiply(0.24)).add(0, -0.14, 0);
    }

    private static boolean solid(Block b) {
        Material m = b.getType();
        return m != Material.BARRIER && m != Material.LIGHT && m != Material.STRUCTURE_VOID && !m.isAir();
    }

    /** Un único ray trace por disparo, filtrado a los mobs del juego. */
    private void hitscan(Player p, WeaponDef w) {
        Location eye = p.getEyeLocation();
        Vector dir = spread(eye.getDirection(), w.spread());
        // el trazo empieza a unos bloques del ojo: cerca de la cámara las partículas taparían la vista
        Location from = eye.clone().add(dir.clone().multiply(3.2)).add(0, -0.25, 0);
        RayTraceResult hit = p.getWorld().rayTrace(eye, dir, w.range(), FluidCollisionMode.NEVER, true, 0.18,
            e -> plugin.mobs.get(e) != null, Weapons::solid);
        double hitDist = hit == null ? w.range() : hit.getHitPosition().distance(eye.toVector());
        // ¿cruzó una bola de fuego del Ghast antes?
        Bosses.Ball ball = null;
        for (Bosses.Ball b : plugin.bosses.balls()) {
            if (b.returned() || !b.entity().isValid()) continue;
            Vector c = b.entity().getLocation().toVector().subtract(eye.toVector());
            double t = c.dot(dir);
            if (t < 0 || t > hitDist) continue;
            if (c.clone().subtract(dir.clone().multiply(t)).lengthSquared() < 1.8 * 1.8) {
                ball = b;
                hitDist = t;
            }
        }
        Location end = eye.clone().add(dir.clone().multiply(hitDist));
        Color trace = w.automatic() ? Color.fromRGB(255, 214, 120) : Color.fromRGB(255, 245, 200);
        if (hitDist > 3.5) plugin.fx.tracer(from, end, trace);
        plugin.fx.sound(p.getLocation(), w.sound(), 0.7f, w.pitch() + (plugin.fx.rnd().nextFloat() - 0.5f) * 0.1f, true);
        if (ball != null) {
            plugin.bosses.returnBall(ball, p);
            return;
        }
        if (hit == null) return;
        if (hit.getHitEntity() != null) {
            GameMob gm = plugin.mobs.get(hit.getHitEntity());
            if (gm == null) return;
            Entity e = gm.entity;
            boolean head = hit.getHitPosition().getY() > e.getLocation().getY() + e.getHeight() * 0.78;
            double dmg = w.damage() * (head ? 1.6 : 1.0);
            plugin.fx.particle(end, Particle.BLOCK, head ? 8 : 4, 0.08, 0.08, 0.08, 0, Material.REDSTONE_BLOCK.createBlockData(), false);
            if (head) plugin.fx.particle(end, Particle.CRIT, 6, 0.1, 0.25, false);
            plugin.mobs.damage(gm, dmg, p);
            long now = plugin.tick();
            if (now - lastHitSound >= 2) {
                lastHitSound = now;
                p.playSound(p.getLocation(), Sound.ENTITY_ARROW_HIT_PLAYER, 0.35f, head ? 1.8f : 1.3f);
            }
        } else if (hit.getHitBlock() != null) {
            plugin.fx.particle(end, Particle.BLOCK, 3, 0.05, 0.05, 0.05, 0.05, hit.getHitBlock().getBlockData(), false);
        }
    }

    // ───────────────────────────── EXPLOSIVOS ─────────────────────────────

    private void launch(Player p, WeaponDef w) {
        Vector dir = spread(p.getEyeLocation().getDirection(), w.spread());
        Location from = muzzle(p, dir);
        Snowball s = p.getWorld().spawn(from, Snowball.class, e -> {
            e.setShooter(p);
            e.setItem(w.kind() == WeaponKind.COHETE ? new ItemStack(Material.FIREWORK_ROCKET) : w.item().createItemStack());
            e.setGravity(w.kind() == WeaponKind.GRANADA);
            e.setVelocity(dir.clone().multiply(w.speed()));
            e.setPersistent(false);
            e.getPersistentDataContainer().set(plugin.projKey, PersistentDataType.STRING, w.id());
        });
        projectiles.put(s.getUniqueId(), new Proj(w, p, from, plugin.tick(), w.bounces()));
        plugin.fx.sound(p.getLocation(), w.sound(), 1.2f, w.pitch(), true);
    }

    private void tickProjectiles(long now) {
        if (projectiles.isEmpty()) return;
        Iterator<Map.Entry<UUID, Proj>> it = projectiles.entrySet().iterator();
        List<Runnable> later = new ArrayList<>();
        while (it.hasNext()) {
            var en = it.next();
            Proj pr = en.getValue();
            Entity e = plugin.getServer().getEntity(en.getKey());
            if (e == null || !e.isValid()) {
                it.remove();
                continue;
            }
            Location l = e.getLocation();
            boolean nearCam = now - pr.born < 4;
            if (pr.def.kind() == WeaponKind.COHETE) {
                if (!nearCam) {
                    plugin.fx.particle(l, Particle.FLAME, 2, 0.04, 0.01, false);
                    plugin.fx.particle(l, Particle.SMOKE, 2, 0.06, 0.01, false);
                }
                boolean far = l.distanceSquared(pr.origin) > pr.def.range() * pr.def.range();
                if (far) {
                    it.remove();
                    e.remove();
                    later.add(() -> explode(l, pr));
                }
            } else {
                if (!nearCam && now % 2 == 0) plugin.fx.particle(l, Particle.SMOKE, 1, 0.02, 0.0, false);
                if (now - pr.born >= Math.round(pr.def.fuse() * 20)) {
                    it.remove();
                    e.remove();
                    later.add(() -> explode(l, pr));
                }
            }
        }
        later.forEach(Runnable::run);
    }

    @EventHandler
    public void onHit(ProjectileHitEvent e) {
        Proj pr = projectiles.remove(e.getEntity().getUniqueId());
        if (pr == null) return;
        Location l = e.getEntity().getLocation();
        if (e.getHitEntity() != null && plugin.mobs.get(e.getHitEntity()) == null) {
            // atraviesa cosas que no son del juego
            e.setCancelled(true);
            projectiles.put(e.getEntity().getUniqueId(), pr);
            return;
        }
        if (pr.def.kind() == WeaponKind.GRANADA && e.getHitBlock() != null && pr.bounces > 0) {
            BlockFace face = e.getHitBlockFace();
            Vector v = e.getEntity().getVelocity();
            if (face != null && v.lengthSquared() > 0.04) {
                Vector n = face.getDirection();
                Vector r = v.clone().subtract(n.clone().multiply(2 * v.dot(n))).multiply(0.5);
                Location at = l.clone().add(n.clone().multiply(0.15));
                Proj next = new Proj(pr.def, pr.owner, pr.origin, pr.born, pr.bounces - 1);
                plugin.getServer().getScheduler().runTask(plugin, () -> {
                    Snowball s = at.getWorld().spawn(at, Snowball.class, sb -> {
                        sb.setShooter(pr.owner);
                        sb.setItem(((Snowball) e.getEntity()).getItem());
                        sb.setVelocity(r);
                        sb.setPersistent(false);
                        sb.getPersistentDataContainer().set(plugin.projKey, PersistentDataType.STRING, pr.def.id());
                    });
                    projectiles.put(s.getUniqueId(), next);
                });
                plugin.fx.sound(l, Sound.BLOCK_STONE_HIT, 1f, 1.3f, false);
                return;
            }
        }
        explode(l, pr);
    }

    /** Daño en área solo a mobs del juego; no rompe bloques ni daña al jugador. */
    private void explode(Location l, Proj pr) {
        double r = pr.def.radius();
        plugin.fx.explosion(l, r, r >= 5);
        plugin.fx.particle(l, Particle.FLASH, 1, 0, 0, 0, 0, Color.ORANGE, true);
        for (GameMob gm : new ArrayList<>(plugin.mobs.all())) {
            if (gm.dead || !gm.entity.isValid()) continue;
            var box = gm.entity.getBoundingBox();
            double dx = Math.max(box.getMinX() - l.getX(), Math.max(0, l.getX() - box.getMaxX()));
            double dy = Math.max(box.getMinY() - l.getY(), Math.max(0, l.getY() - box.getMaxY()));
            double dz = Math.max(box.getMinZ() - l.getZ(), Math.max(0, l.getZ() - box.getMaxZ()));
            double d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d > r) continue;
            double dmg = pr.def.damage() * (1 - 0.6 * d / r);
            if (!gm.isBoss() && !gm.manual) {
                Vector push = gm.entity.getLocation().toVector().subtract(l.toVector()).setY(0);
                if (push.lengthSquared() > 1e-4) gm.entity.setVelocity(push.normalize().multiply(0.35).setY(0.32));
            }
            plugin.mobs.damage(gm, dmg, pr.owner);
        }
        for (Bosses.Ball b : plugin.bosses.balls())
            if (!b.returned() && b.entity().getLocation().distanceSquared(l) < (r + 1.5) * (r + 1.5) && pr.owner != null) plugin.bosses.returnBall(b, pr.owner);
    }

    public void clearProjectiles() {
        for (UUID id : projectiles.keySet()) {
            Entity e = plugin.getServer().getEntity(id);
            if (e != null) e.remove();
        }
        projectiles.clear();
    }
}
