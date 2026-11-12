package dev.livearena.nosalpiques.game;

import dev.livearena.nosalpiques.NoSalpiquesLive;
import dev.livearena.nosalpiques.Settings;
import dev.livearena.nosalpiques.map.Rooms;
import java.util.ArrayDeque;
import java.util.List;
import java.util.Locale;
import org.bukkit.Color;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.entity.Player;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;
import org.bukkit.util.Vector;

/**
 * Lo que mandan los espectadores: el público te ayuda a saltar o te empuja al agua. En cola, uno detrás de otro; los
 * sabotajes esperan si el streamer está protegido (tras muchos salpicones seguidos).
 */
public final class Effects {
    public static final List<String> ALL = List.of("empujar", "despertar", "hundir", "apagar", "resbalar", "rapido",
        "piedra", "bengala", "supersalto", "puente", "escudo", "dormir");
    private static final List<String> HELP = List.of("piedra", "bengala", "supersalto", "puente", "escudo", "dormir");

    private record Req(String type, int n, String user) {}

    private final NoSalpiquesLive plugin;
    private final ArrayDeque<Req> queue = new ArrayDeque<>();
    private long nextAt;

    public Effects(NoSalpiquesLive plugin) {
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
    }

    public boolean add(String type, int n, String user) {
        type = type.toLowerCase(Locale.ROOT);
        if (!ALL.contains(type)) return false;
        if (queue.size() >= 200) queue.pollFirst();
        queue.addLast(new Req(type, Math.max(1, Math.min(64, n)), user == null || user.isBlank() ? "Alguien" : user));
        return true;
    }

    public void tick() {
        Game g = plugin.game;
        Player p = g.player();
        long now = plugin.tick();
        if (queue.isEmpty() || now < nextAt || p == null || !g.running() || g.celebrating() || plugin.builder.building()) return;
        Req r = queue.peekFirst();
        if (!helps(r.type()) && g.isProtected()) {
            Req help = null;
            for (Req q : queue) if (helps(q.type())) {
                help = q;
                break;
            }
            if (help == null) return;
            queue.remove(help);
            r = help;
        } else queue.pollFirst();
        nextAt = now + (long) (plugin.settings.effectGap * 20);
        run(p, r);
    }

    private void run(Player p, Req r) {
        Settings s = plugin.settings;
        Game g = plugin.game;
        String msg = s.msg(r.type()).replace("{n}", String.valueOf(r.n())).replace("{s}", r.n() == 1 ? "" : "s");
        plugin.hud.notify(p, r.type(), msg, r.user(), helps(r.type()));
        Location l = p.getLocation();
        World w = p.getWorld();
        switch (r.type()) {
            case "empujar" -> {
                // hacia el agua más cercana (a un lado, perpendicular al camino)
                double side = l.getZ() < Rooms.W / 2.0 ? -1 : 1;
                Vector v = new Vector(plugin.fx.rnd().nextGaussian() * 0.2, 0.25, side).normalize().multiply(s.pushStrength);
                p.setVelocity(p.getVelocity().add(v));
                plugin.fx.particle(l.clone().add(0, 1, 0), Particle.GUST, 2, 0.2, 0);
                plugin.fx.sound(p, "nosalpiques:empujon", Sound.ENTITY_BREEZE_WIND_BURST, 1f, 1f);
            }
            case "despertar" -> {
                if (!plugin.monster.awake()) plugin.monster.wake(p, l);
                else plugin.monster.rage(6);
            }
            case "hundir" -> {
                Block under = l.clone().add(0, -0.3, 0).getBlock();
                Rooms.Pad pad = plugin.rooms.padAt.get(Rooms.key(under.getX(), under.getY(), under.getZ()));
                if (pad != null) g.sinkPad(w, pad, 60);
                plugin.fx.sound(p, "nosalpiques:terremoto", Sound.BLOCK_DEEPSLATE_BREAK, 1f, 0.6f);
            }
            case "apagar" -> {
                p.addPotionEffect(new PotionEffect(PotionEffectType.DARKNESS, s.darkS * 20, 0, true, false, false));
                p.removePotionEffect(PotionEffectType.NIGHT_VISION);
                org.bukkit.Bukkit.getScheduler().runTaskLater(plugin, () -> {
                    if (g.running()) p.addPotionEffect(new PotionEffect(PotionEffectType.NIGHT_VISION, 20 * 3600, 0, true, false, false));
                }, s.darkS * 20L);
                plugin.fx.sound(p, "nosalpiques:niebla", Sound.BLOCK_LEVER_CLICK, 1f, 0.5f);
            }
            case "resbalar" -> {
                for (int dx = -1; dx <= 1; dx++)
                    for (int dz = -1; dz <= 1; dz++) {
                        Block b = l.clone().add(dx, -0.3, dz).getBlock();
                        if (plugin.rooms.padAt.containsKey(Rooms.key(b.getX(), b.getY(), b.getZ())))
                            plugin.temp.set(w, b.getX(), b.getY(), b.getZ(), Material.BLUE_ICE.createBlockData(), s.slipS * 20L);
                    }
                plugin.fx.sound(p, "nosalpiques:hielo", Sound.BLOCK_GLASS_PLACE, 1f, 1.6f);
            }
            case "rapido" -> {
                if (plugin.monster.awake()) plugin.monster.rage(8);
                else plugin.monster.wake(p, l);
            }
            case "piedra" -> {
                g.give(p, "piedra", r.n());
                plugin.fx.sound(p, "nosalpiques:ayuda", Sound.ENTITY_ITEM_PICKUP, 1f, 0.8f);
            }
            case "bengala" -> {
                g.give(p, "bengala", r.n());
                plugin.fx.sound(p, "nosalpiques:ayuda", Sound.ENTITY_ITEM_PICKUP, 1f, 1.2f);
            }
            case "supersalto" -> {
                p.addPotionEffect(new PotionEffect(PotionEffectType.JUMP_BOOST, s.jumpS * 20, 1, true, false, false));
                plugin.fx.spiral(l.clone(), Color.fromRGB(0x7CFF9E), true, 2.4, 2, Particle.HAPPY_VILLAGER);
                plugin.fx.sound(p, "nosalpiques:ayuda", Sound.ENTITY_SLIME_JUMP, 1f, 1.2f);
            }
            case "puente" -> {
                // pasarela de 3 bloques en la dirección que mira, a la altura de sus pies
                Vector dir = l.getDirection().setY(0);
                if (dir.lengthSquared() < 0.01) dir = new Vector(1, 0, 0);
                dir.normalize();
                int y = l.getBlockY() - 1;
                for (int i = 1; i <= 5; i++) {
                    Location q = l.clone().add(dir.clone().multiply(i));
                    Block b = w.getBlockAt(q.getBlockX(), y, q.getBlockZ());
                    if (b.getType().isAir() || b.getType() == Material.WATER)
                        plugin.temp.set(w, b.getX(), b.getY(), b.getZ(), Material.WHITE_STAINED_GLASS.createBlockData(), s.bridgeS * 20L);
                }
                plugin.fx.sound(p, "nosalpiques:ayuda", Sound.BLOCK_AMETHYST_BLOCK_CHIME, 1f, 1.2f);
            }
            case "escudo" -> {
                g.shield(s.shieldS);
                plugin.fx.spiral(l.clone(), Color.fromRGB(0xFF7BE5), true, 2.2, 2, Particle.END_ROD);
                plugin.fx.sound(p, "nosalpiques:escudo", Sound.ITEM_SHIELD_BLOCK, 1f, 1.4f);
            }
            case "dormir" -> {
                if (plugin.monster.awake()) plugin.monster.sleep(true);
                plugin.fx.sound(p, "nosalpiques:ayuda", Sound.BLOCK_AMETHYST_BLOCK_CHIME, 1f, 0.8f);
            }
            default -> {}
        }
        plugin.hud.update();
    }
}
