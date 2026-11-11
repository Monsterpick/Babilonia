package dev.livearena.parkour.game;

import dev.livearena.parkour.ParkourLive;
import dev.livearena.parkour.Settings;
import dev.livearena.parkour.tower.Theme;
import dev.livearena.parkour.tower.Tower;
import java.util.ArrayDeque;
import java.util.List;
import java.util.Locale;
import org.bukkit.Bukkit;
import org.bukkit.Color;
import org.bukkit.FireworkEffect;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.World;
import org.bukkit.block.data.BlockData;
import org.bukkit.entity.Player;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;
import org.bukkit.util.Vector;

/**
 * Lo que mandan los espectadores. Van en cola, uno detrás de otro, para que en el directo se entienda cada uno. Los
 * sabotajes esperan si el streamer está protegido (después de muchas caídas seguidas).
 */
public final class Effects {
    public static final List<String> ALL = List.of("subir", "bajar", "empujar", "viento", "niebla", "hielo", "fantasma", "terremoto", "lento",
        "supersalto", "escudo", "guia", "puente");
    private static final List<String> HELP = List.of("subir", "supersalto", "escudo", "guia", "puente");

    private record Req(String type, int n, String user) {}

    private final ParkourLive plugin;
    private final ArrayDeque<Req> queue = new ArrayDeque<>();
    private long nextAt;
    private long windUntil, quakeUntil;
    private Vector windDir = new Vector(1, 0, 0);

    public Effects(ParkourLive plugin) {
        this.plugin = plugin;
    }

    public static boolean helps(String type) {
        return HELP.contains(type);
    }

    public int queued() {
        return queue.size();
    }

    public void clear() {
        queue.clear();
        windUntil = quakeUntil = 0;
    }

    public boolean add(String type, int n, String user) {
        type = type.toLowerCase(Locale.ROOT);
        if (!ALL.contains(type)) return false;
        if (queue.size() >= 200) queue.pollFirst();
        queue.addLast(new Req(type, Math.max(1, Math.min(100, n)), user == null || user.isBlank() ? "Alguien" : user));
        return true;
    }

    public void tick() {
        Game g = plugin.game;
        Player p = g.player();
        long now = plugin.tick();
        if (p != null && g.running() && plugin.inWorld(p)) {
            if (now < windUntil) wind(p, now);
            if (now < quakeUntil && now % 4 == 0) quake(p);
        }
        if (queue.isEmpty() || now < nextAt || p == null || !g.running() || g.celebrating() || plugin.builder.building()) return;
        Req r = queue.peekFirst();
        if (!helps(r.type()) && g.isProtected()) {
            // protegido: pasa antes la siguiente ayuda si la hay
            Req help = null;
            for (Req q : queue) if (helps(q.type())) {
                help = q;
                break;
            }
            if (help == null) return;
            queue.remove(help);
            r = help;
        } else queue.pollFirst();
        double gap = plugin.settings.effectGap;
        if (r.type().equals("subir") || r.type().equals("bajar")) gap += 1.5;
        nextAt = now + (long) (gap * 20);
        run(p, r);
    }

    private void run(Player p, Req r) {
        Settings s = plugin.settings;
        Game g = plugin.game;
        String msg = s.msg(r.type()).replace("{n}", String.valueOf(r.n())).replace("{s}", r.n() == 1 ? "" : "es");
        plugin.hud.notify(p, r.type(), msg, r.user(), helps(r.type()));
        Location l = p.getLocation();
        World w = p.getWorld();
        Theme th = g.theme();
        switch (r.type()) {
            case "subir" -> {
                int to = g.checkpoint() + r.n();
                plugin.fx.sound(p, "parkour:subir", Sound.BLOCK_BEACON_POWER_SELECT, 1f, 1.3f);
                p.addPotionEffect(new PotionEffect(PotionEffectType.LEVITATION, 18, 1, true, false, false));
                for (int i = 0; i < 4; i++) {
                    int k = i;
                    Bukkit.getScheduler().runTaskLater(plugin, () -> plugin.fx.spiral(p.getLocation().add(0, -0.5 + k * 0.4, 0), Color.fromRGB(0x7CFF9E), true, 3.2, 2, Particle.END_ROD), i * 4L);
                }
                Bukkit.getScheduler().runTaskLater(plugin, () -> {
                    if (!g.running()) return;
                    g.setCheckpoint(to, true);
                    Location a = p.getLocation();
                    plugin.fx.firework(a.clone().add(0, 2, 0), Color.fromRGB(0x7CFF9E), Color.WHITE, FireworkEffect.Type.BURST, 0);
                    plugin.fx.particle(a.clone().add(0, 1, 0), Particle.TOTEM_OF_UNDYING, 50, 0.8, 0.5);
                    plugin.fx.sound(p, "parkour:llegada", Sound.ENTITY_PLAYER_LEVELUP, 1f, 1.5f);
                }, 18L);
            }
            case "bajar" -> {
                int to = Math.max(1, g.checkpoint() - r.n());
                plugin.fx.sound(p, "parkour:bajar", Sound.BLOCK_PORTAL_TRAVEL, 0.5f, 1.6f);
                p.addPotionEffect(new PotionEffect(PotionEffectType.SLOWNESS, 20, 3, true, false, false));
                for (int i = 0; i < 4; i++) {
                    int k = i;
                    Bukkit.getScheduler().runTaskLater(plugin, () -> {
                        Location c = p.getLocation();
                        plugin.fx.spiral(c.clone().add(0, 0.1, 0), Color.fromRGB(0x5B0A91), false, 2.8 - k * 0.4, 2, Particle.REVERSE_PORTAL);
                        plugin.fx.particle(c.clone().add(0, 0.2, 0), Particle.SQUID_INK, 12, 0.6, 0.02);
                    }, i * 4L);
                }
                Bukkit.getScheduler().runTaskLater(plugin, () -> {
                    if (!g.running()) return;
                    g.setCheckpoint(to, true);
                    Location a = p.getLocation();
                    p.addPotionEffect(new PotionEffect(PotionEffectType.DARKNESS, 30, 0, true, false, false));
                    plugin.fx.particle(a, Particle.EXPLOSION, 3, 0.6, 0);
                    plugin.fx.particle(a.clone().add(0, 0.2, 0), Particle.LARGE_SMOKE, 30, 0.8, 0.05);
                    plugin.fx.sound(p, "parkour:impacto", Sound.BLOCK_ANVIL_LAND, 0.8f, 0.6f);
                }, 18L);
            }
            case "empujar" -> push(p, randomDir(), s.pushStrength, 0.42);
            case "viento" -> {
                windDir = randomDir();
                windUntil = plugin.tick() + s.windS * 20L;
                plugin.fx.sound(p, "parkour:viento", Sound.ITEM_ELYTRA_FLYING, 0.6f, 1.4f);
            }
            case "niebla" -> {
                p.removePotionEffect(PotionEffectType.NIGHT_VISION);
                p.addPotionEffect(new PotionEffect(PotionEffectType.DARKNESS, s.fogS * 20, 0, true, false, true));
                p.addPotionEffect(new PotionEffect(PotionEffectType.BLINDNESS, 40, 0, true, false, false));
                plugin.fx.particle(l.clone().add(0, 1, 0), Particle.LARGE_SMOKE, 60, 2.5, 0.02);
                plugin.fx.sound(p, "parkour:niebla", Sound.ENTITY_WARDEN_HEARTBEAT, 1f, 0.8f);
            }
            case "hielo" -> {
                BlockData ice = Material.BLUE_ICE.createBlockData();
                for (Tower.Step st : ahead(10)) {
                    if (!"block".equals(st.kind()) && !"slab".equals(st.kind())) continue;
                    plugin.temp.set(w, st.x(), st.y(), st.z(), ice, s.iceS * 20L);
                    plugin.fx.particle(new Location(w, st.x() + 0.5, st.y() + 1.1, st.z() + 0.5), Particle.SNOWFLAKE, 10, 0.4, 0.02);
                }
                plugin.fx.sound(p, "parkour:hielo", Sound.BLOCK_GLASS_BREAK, 1f, 1.6f);
            }
            case "fantasma" -> {
                BlockData barrier = Material.BARRIER.createBlockData();
                for (Tower.Step st : ahead(s.ghostBlocks)) {
                    if ("ladder".equals(st.kind()) || "blink".equals(st.kind())) continue;
                    Location c = new Location(w, st.x() + 0.5, st.y() + 0.5, st.z() + 0.5);
                    plugin.fx.particle(c, Particle.SOUL, 6, 0.3, 0.02);
                    plugin.temp.set(w, st.x(), st.y(), st.z(), barrier, s.ghostS * 20L);
                }
                plugin.fx.sound(p, "parkour:fantasma", Sound.ENTITY_ALLAY_ITEM_TAKEN, 1f, 0.6f);
            }
            case "terremoto" -> {
                quakeUntil = plugin.tick() + s.quakeS * 20L;
                plugin.fx.sound(p, "parkour:terremoto", Sound.ENTITY_RAVAGER_ROAR, 0.8f, 0.6f);
            }
            case "lento" -> {
                p.addPotionEffect(new PotionEffect(PotionEffectType.SLOWNESS, s.slowS * 20, 1, true, false, true));
                plugin.fx.particle(l.clone().add(0, 1, 0), Particle.ITEM_SLIME, 20, 0.5, 0.05);
                plugin.fx.sound(p, "parkour:lento", Sound.BLOCK_HONEY_BLOCK_SLIDE, 1f, 0.6f);
            }
            case "supersalto" -> {
                p.addPotionEffect(new PotionEffect(PotionEffectType.JUMP_BOOST, s.jumpS * 20, 1, true, false, true));
                plugin.fx.spiral(l, Color.fromRGB(0x7CFF9E), true, 2.2, 2, Particle.HAPPY_VILLAGER);
                plugin.fx.sound(p, "parkour:ayuda", Sound.ENTITY_BREEZE_JUMP, 1f, 1.2f);
            }
            case "escudo" -> {
                g.shield(s.shieldS);
                plugin.fx.ring(l.clone().add(0, 0.2, 0), Color.fromRGB(0xFF7BE5), 1.0, 30, 1.4f);
                plugin.fx.ring(l.clone().add(0, 1.0, 0), Color.fromRGB(0xFF7BE5), 1.2, 30, 1.4f);
                plugin.fx.ring(l.clone().add(0, 1.8, 0), Color.fromRGB(0xFF7BE5), 1.0, 30, 1.4f);
                plugin.fx.sound(p, "parkour:escudo", Sound.ITEM_ARMOR_EQUIP_DIAMOND, 1f, 1.2f);
            }
            case "guia" -> {
                g.guide(s.guideS);
                plugin.fx.sound(p, "parkour:ayuda", Sound.BLOCK_AMETHYST_BLOCK_CHIME, 1f, 1.4f);
            }
            case "puente" -> bridge(p, w, th);
            default -> {
            }
        }
        plugin.hud.update();
    }

    /** Próximos pasos del camino desde donde va el jugador. */
    private List<Tower.Step> ahead(int count) {
        var steps = plugin.tower.steps(plugin.game.checkpoint());
        int from = Math.max(0, plugin.game.furthest() + 1);
        return steps.subList(Math.min(from, steps.size()), Math.min(steps.size(), from + count));
    }

    private Vector randomDir() {
        double a = plugin.fx.rnd().nextDouble() * Math.PI * 2;
        return new Vector(Math.cos(a), 0, Math.sin(a));
    }

    private void push(Player p, Vector dir, double strength, double up) {
        p.setVelocity(p.getVelocity().add(dir.clone().multiply(strength)).setY(up));
        Location l = p.getLocation().add(0, 1, 0);
        plugin.fx.particle(l, Particle.GUST, 2, 0.2, 0);
        for (int i = 1; i <= 6; i++) plugin.fx.particle(l.clone().subtract(dir.clone().multiply(i * 0.5)), Particle.CLOUD, 3, 0.15, 0.01);
        plugin.fx.sound(p, "parkour:empujon", Sound.ENTITY_WIND_CHARGE_WIND_BURST, 1f, 1f);
    }

    private void wind(Player p, long now) {
        Vector v = p.getVelocity();
        p.setVelocity(v.add(windDir.clone().multiply(plugin.settings.windStrength * (p.isOnGround() ? 1.0 : 0.6))));
        if (now % 2 == 0) {
            Location l = p.getLocation().add(0, 1, 0);
            Vector side = new Vector(-windDir.getZ(), 0, windDir.getX());
            for (int i = 0; i < 3; i++) {
                Location s = l.clone().subtract(windDir.clone().multiply(3)).add(side.clone().multiply(plugin.fx.rnd().nextGaussian() * 1.5)).add(0, plugin.fx.rnd().nextGaussian() * 0.7, 0);
                p.getWorld().spawnParticle(Particle.CLOUD, s, 0, windDir.getX(), 0, windDir.getZ(), 0.6, null, true);
            }
        }
    }

    private void quake(Player p) {
        var r = plugin.fx.rnd();
        if (p.isOnGround()) p.setVelocity(p.getVelocity().add(new Vector((r.nextDouble() - 0.5) * 0.22, 0.08, (r.nextDouble() - 0.5) * 0.22)));
        Location l = p.getLocation();
        BlockData under = l.clone().add(0, -0.5, 0).getBlock().getBlockData();
        if (under.getMaterial().isAir() || under.getMaterial() == Material.BARRIER) under = Material.STONE.createBlockData();
        l.getWorld().spawnParticle(Particle.BLOCK, l, 14, 1.2, 0.1, 1.2, 0, under, true);
        plugin.fx.particle(l.clone().add(0, 0.1, 0), Particle.CAMPFIRE_COSY_SMOKE, 1, 0.8, 0.01);
        if (plugin.tick() % 12 == 0) plugin.fx.sound(l, Sound.ENTITY_GENERIC_EXPLODE, 0.25f, 0.5f);
    }

    /** Puente de cristal temporal sobre los próximos 3 saltos. */
    private void bridge(Player p, World w, Theme th) {
        BlockData glass = Material.LIGHT_BLUE_STAINED_GLASS.createBlockData();
        List<Tower.Step> next = ahead(3);
        Location prev = p.getLocation().clone().add(0, -1, 0);
        int count = 0;
        for (Tower.Step st : next) {
            Vector a = prev.toVector(), b = new Vector(st.x() + 0.5, st.y(), st.z() + 0.5);
            Vector d = b.clone().subtract(a);
            double len = d.length();
            int y = Math.min(prev.getBlockY(), st.y());
            for (double t = 0; t <= len; t += 0.4) {
                Vector q = a.clone().add(d.clone().multiply(t / Math.max(0.01, len)));
                int x = q.getBlockX(), z = q.getBlockZ();
                if (!w.getBlockAt(x, y, z).getType().isAir()) continue;
                plugin.temp.set(w, x, y, z, glass, plugin.settings.bridgeS * 20L);
                if (count++ % 2 == 0) plugin.fx.particle(new Location(w, x + 0.5, y + 1.1, z + 0.5), Particle.END_ROD, 1, 0.1, 0);
            }
            prev = new Location(w, st.x() + 0.5, st.y(), st.z() + 0.5);
        }
        plugin.fx.sound(p, "parkour:ayuda", Sound.BLOCK_AMETHYST_BLOCK_RESONATE, 1f, 1.2f);
    }
}
