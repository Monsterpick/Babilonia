package dev.livearena.basedefense.game;

import dev.livearena.basedefense.BaseDefense;
import dev.livearena.basedefense.Settings;
import dev.livearena.basedefense.mob.GameMob;
import dev.livearena.basedefense.util.Txt;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import org.bukkit.Color;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.World;
import org.bukkit.entity.BlockDisplay;
import org.bukkit.entity.Display;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.util.Transformation;
import org.bukkit.util.Vector;
import org.joml.Quaternionf;
import org.joml.Vector3f;

/**
 * Munición: los mobs a veces sueltan una caja que vuela sola hasta el streamer (no puede bajar al carril), y
 * cada fase (y con regalos) cae una caja de suministros en paracaídas sobre la base: se abre al tocarla.
 */
public final class Loot {
    private final BaseDefense plugin;
    private final List<Box> boxes = new ArrayList<>();
    private final List<Crate> crates = new ArrayList<>();

    /** Caja de munición volando hacia el jugador. */
    private static final class Box {
        ItemDisplay e;
        Location from;
        long born;
        int life;
        boolean big;
    }

    /** Caja de suministros con paracaídas. */
    private static final class Crate {
        BlockDisplay box, chute;
        Location at;
        double y;
        boolean landed;
        long born;
        String by;
    }

    public Loot(BaseDefense plugin) {
        this.plugin = plugin;
    }

    public void clear() {
        for (Box b : boxes) if (b.e.isValid()) b.e.remove();
        for (Crate c : crates) {
            if (c.box.isValid()) c.box.remove();
            if (c.chute.isValid()) c.chute.remove();
        }
        boxes.clear();
        crates.clear();
    }

    // ───────────────────────────── cajas de munición ─────────────────────────────

    public void onKill(GameMob gm, Location l) {
        if (plugin.fx.rnd().nextDouble() < plugin.settings.ammoChance) flyBox(l.clone().add(0, 0.8, 0), false);
    }

    public void bossDrop(Location l) {
        if (plugin.fx.rnd().nextDouble() >= plugin.settings.ammoChanceBoss) return;
        for (int i = 0; i < 4; i++) flyBox(l.clone().add(plugin.fx.rnd().nextGaussian(), 0, plugin.fx.rnd().nextGaussian()), true);
    }

    private void flyBox(Location from, boolean big) {
        Player p = plugin.game.streamer();
        if (p == null || !plugin.inGameWorld(p) || boxes.size() > 30) return;
        Box b = new Box();
        b.from = from.clone();
        b.born = plugin.tick();
        b.life = 22 + (int) Math.min(20, from.distance(p.getLocation()) / 4);
        b.big = big;
        b.e = from.getWorld().spawn(from, ItemDisplay.class, d -> {
            d.setPersistent(false);
            ItemStack it = new ItemStack(big ? Material.ENDER_CHEST : Material.CHEST);
            if (plugin.pack.loaded(p)) {
                var m = it.getItemMeta();
                m.setItemModel(org.bukkit.NamespacedKey.fromString("basedefense:caja_municion"));
                it.setItemMeta(m);
            }
            d.setItemStack(it);
            d.setTeleportDuration(1);
            d.setGlowing(true);
            d.setGlowColorOverride(big ? Color.FUCHSIA : Color.YELLOW);
            d.setBrightness(new Display.Brightness(15, 15));
            d.setTransformation(new Transformation(new Vector3f(), new Quaternionf(), new Vector3f(big ? 0.7f : 0.5f), new Quaternionf()));
        });
        boxes.add(b);
        plugin.fx.sound(from, Sound.ENTITY_ITEM_PICKUP, 1f, 0.6f, false);
    }

    // ───────────────────────────── suministros ─────────────────────────────

    /** Cae una caja de suministros en la plataforma. by = quién la manda (o el motivo). */
    public void dropSupply(String by) {
        World w = plugin.world(false);
        if (w == null || plugin.arena == null || plugin.arena.platform == null || crates.size() >= 3) return;
        var pf = plugin.arena.platform;
        double x = pf.getMinX() + 2.5 + plugin.fx.rnd().nextDouble() * (pf.getWidthX() - 5);
        double z = pf.getMinZ() + 3 + plugin.fx.rnd().nextDouble() * Math.max(1, pf.getWidthZ() - 7);
        Location at = new Location(w, Math.floor(x) + 0.5, plugin.arena.playerSpawn.getY(), Math.floor(z) + 0.5);
        Crate c = new Crate();
        c.at = at;
        c.y = at.getY() + 32;
        c.born = plugin.tick();
        c.by = by;
        Location top = at.clone();
        top.setY(c.y);
        c.box = w.spawn(top, BlockDisplay.class, d -> {
            d.setPersistent(false);
            d.setBlock(Material.BARREL.createBlockData());
            d.setTeleportDuration(2);
            d.setGlowing(true);
            d.setGlowColorOverride(Color.LIME);
            d.setTransformation(new Transformation(new Vector3f(-0.45f, 0, -0.45f), new Quaternionf(), new Vector3f(0.9f), new Quaternionf()));
        });
        c.chute = w.spawn(top.clone().add(0, 2.6, 0), BlockDisplay.class, d -> {
            d.setPersistent(false);
            d.setBlock(Material.RED_WOOL.createBlockData());
            d.setTeleportDuration(2);
            d.setTransformation(new Transformation(new Vector3f(-1.6f, 0, -1.6f), new Quaternionf(), new Vector3f(3.2f, 0.25f, 3.2f), new Quaternionf()));
        });
        crates.add(c);
        plugin.game.banner(plugin.settings.msg("suministroTitulo"), plugin.settings.msg("suministroSubtitulo"), Sound.ITEM_TRIDENT_RETURN, 0.6f);
    }

    // ───────────────────────────── tick ─────────────────────────────

    public void tick() {
        long now = plugin.tick();
        Player p = plugin.game.streamer();
        tickBoxes(now, p);
        tickCrates(now, p);
    }

    private void tickBoxes(long now, Player p) {
        for (Iterator<Box> it = boxes.iterator(); it.hasNext(); ) {
            Box b = it.next();
            if (!b.e.isValid() || p == null || !plugin.inGameWorld(p)) {
                if (b.e.isValid()) b.e.remove();
                it.remove();
                continue;
            }
            double f = Math.min(1, (now - b.born) / (double) b.life);
            Location to = p.getLocation().add(0, 1.1, 0);
            // arco: sube y cae sobre el jugador
            Vector pos = b.from.toVector().multiply(1 - f).add(to.toVector().multiply(f)).add(new Vector(0, Math.sin(f * Math.PI) * 6, 0));
            Location l = pos.toLocation(p.getWorld());
            l.setYaw((float) (now * 18 % 360));
            b.e.teleport(l);
            if (now % 2 == 0) plugin.fx.particle(l, Particle.WAX_ON, 1, 0.05, 0, false);
            if (f >= 1) {
                b.e.remove();
                it.remove();
                grantSmall(p, b.big);
            }
        }
    }

    private void tickCrates(long now, Player p) {
        for (Iterator<Crate> it = crates.iterator(); it.hasNext(); ) {
            Crate c = it.next();
            if (!c.box.isValid()) {
                it.remove();
                continue;
            }
            if (!c.landed) {
                c.y = Math.max(c.at.getY(), c.y - 0.32);
                Location l = c.at.clone();
                l.setY(c.y);
                c.box.teleport(l);
                c.chute.teleport(l.clone().add(0, 2.6, 0));
                if (now % 3 == 0) plugin.fx.particle(l.clone().add(0, 0.5, 0), Particle.CAMPFIRE_SIGNAL_SMOKE, 1, 0.1, 0.01, false);
                if (c.y <= c.at.getY()) {
                    c.landed = true;
                    c.chute.remove();
                    plugin.fx.particle(c.at.clone().add(0, 0.3, 0), Particle.CLOUD, 20, 0.6, 0.05, true);
                    plugin.fx.sound(c.at, Sound.BLOCK_WOOD_PLACE, 2f, 0.6f, true);
                }
                continue;
            }
            if (now % 5 == 0) plugin.fx.particle(c.at.clone().add(0, 1.2, 0), Particle.HAPPY_VILLAGER, 3, 0.4, 0, false);
            if (p != null && plugin.inGameWorld(p) && p.getLocation().distanceSquared(c.at) < 2.6 * 2.6) {
                open(c, p);
                it.remove();
            } else if (now - c.born > 20 * 90) {
                c.box.remove();
                it.remove();
            }
        }
    }

    private void open(Crate c, Player p) {
        c.box.remove();
        plugin.fx.particle(c.at.clone().add(0, 0.6, 0), Particle.TOTEM_OF_UNDYING, 60, 0.4, 0.5, true);
        plugin.fx.sound(c.at, Sound.BLOCK_CHEST_OPEN, 2f, 0.8f, true);
        plugin.fx.sound(c.at, Sound.ENTITY_PLAYER_LEVELUP, 1f, 1.4f, true);
        // munición para todas las armas y la minigun
        List<String> got = new ArrayList<>();
        for (Settings.WeaponDef w : plugin.settings.weapons.values()) {
            if (w.infinite()) continue;
            int amount = w.shotsPerTick() > 1 ? w.magazine() : w.magazine() * 2;
            plugin.weapons.addReserve(p, w, amount);
            got.add(w.id().equals("minigun") ? "&d&lMINIGUN" : w.name());
        }
        plugin.game.heal(plugin.game.baseMax() * 0.05);
        p.sendActionBar(Txt.fmt("&a&l+ MUNICIÓN &7para " + String.join("&7, ", got)));
    }

    /** Caja pequeña: rellena el arma que más lo necesita. */
    private void grantSmall(Player p, boolean big) {
        Settings.WeaponDef best = null;
        double need = -1;
        for (Settings.WeaponDef w : plugin.settings.weapons.values()) {
            if (w.infinite()) continue;
            double n = 1 - plugin.weapons.reserveRatio(p, w) + plugin.fx.rnd().nextDouble() * 0.3;
            if (n > need) {
                need = n;
                best = w;
            }
        }
        if (best == null) return;
        int amount = Math.max(1, (int) Math.round(best.magazine() * (big ? 1.5 : 0.5)));
        plugin.weapons.addReserve(p, best, amount);
        p.playSound(p.getLocation(), Sound.ITEM_ARMOR_EQUIP_IRON, 1f, 1.3f);
        p.sendActionBar(Txt.fmt("&e+" + amount + " &7balas · " + best.name()));
    }
}
