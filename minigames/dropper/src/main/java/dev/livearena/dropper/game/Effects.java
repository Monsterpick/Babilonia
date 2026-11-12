package dev.livearena.dropper.game;

import dev.livearena.dropper.DropperLive;
import dev.livearena.dropper.Settings;
import java.util.ArrayDeque;
import java.util.List;
import java.util.Locale;
import org.bukkit.Bukkit;
import org.bukkit.Color;
import org.bukkit.Location;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.entity.Player;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;
import org.bukkit.util.Vector;

/**
 * Lo que mandan los espectadores. Van en cola, uno detrás de otro. Los sabotajes esperan si el streamer está protegido
 * (tras muchos choques seguidos) y los que actúan durante la caída esperan a que se suelte el cristal.
 */
public final class Effects {
    public static final List<String> ALL = List.of("subir", "bajar", "reiniciar", "empujar", "viento", "niebla", "lento", "acelerar", "terremoto", "escudo", "guia");
    private static final List<String> HELP = List.of("subir", "lento", "escudo", "guia");
    /** Solo tienen sentido mientras cae. */
    private static final List<String> FALLING = List.of("empujar", "viento", "acelerar", "terremoto", "lento");

    private record Req(String type, int n, String user) {}

    private final DropperLive plugin;
    private final ArrayDeque<Req> queue = new ArrayDeque<>();
    private long nextAt, windUntil, quakeUntil;
    private Vector windDir = new Vector(1, 0, 0);

    public Effects(DropperLive plugin) {
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
        if (p != null && g.running() && plugin.inWorld(p) && g.released()) {
            if (now < windUntil) p.setVelocity(p.getVelocity().add(windDir.clone().multiply(plugin.settings.windStrength)));
            if (now < quakeUntil && now % 3 == 0) {
                var r = plugin.fx.rnd();
                p.setVelocity(p.getVelocity().add(new Vector(r.nextGaussian() * 0.12, 0, r.nextGaussian() * 0.12)));
                plugin.fx.particle(p.getLocation().add(0, 2.5, 0), Particle.FALLING_DUST, 6, 1.2, 0.02);
            }
        }
        if (queue.isEmpty() || now < nextAt || p == null || !g.running() || g.celebrating()) return;
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
        } else {
            if (FALLING.contains(r.type()) && !g.released()) return; // espera a que caiga
            queue.pollFirst();
        }
        nextAt = now + (long) (plugin.settings.effectGap * 20) + (r.type().equals("subir") || r.type().equals("bajar") ? 30 : 0);
        run(p, r);
    }

    private void run(Player p, Req r) {
        Settings s = plugin.settings;
        Game g = plugin.game;
        String msg = s.msg(r.type()).replace("{n}", String.valueOf(r.n())).replace("{s}", r.n() == 1 ? "" : "es");
        plugin.hud.notify(p, r.type(), msg, r.user(), helps(r.type()));
        Location l = p.getLocation();
        switch (r.type()) {
            case "subir" -> {
                plugin.fx.sound(p, "dropper:subir", Sound.BLOCK_BEACON_POWER_SELECT, 1f, 1.3f);
                for (int i = 0; i < 4; i++) {
                    int k = i;
                    Bukkit.getScheduler().runTaskLater(plugin, () -> plugin.fx.spiral(p.getLocation().add(0, 0.5 - k * 0.4, 0), Color.fromRGB(0x7CFF9E), false, 3, 2, Particle.END_ROD), i * 3L);
                }
                Bukkit.getScheduler().runTaskLater(plugin, () -> {
                    if (g.running()) g.setCheckpoint(g.checkpoint() + r.n(), true);
                }, 14L);
            }
            case "bajar" -> {
                plugin.fx.sound(p, "dropper:bajar", Sound.BLOCK_PORTAL_TRAVEL, 0.5f, 1.6f);
                for (int i = 0; i < 4; i++) {
                    int k = i;
                    Bukkit.getScheduler().runTaskLater(plugin, () -> plugin.fx.spiral(p.getLocation().add(0, 0.1, 0), Color.fromRGB(0x5B0A91), true, 2.8 - k * 0.4, 2, Particle.REVERSE_PORTAL), i * 3L);
                }
                Bukkit.getScheduler().runTaskLater(plugin, () -> {
                    if (g.running()) g.setCheckpoint(Math.max(1, g.checkpoint() - r.n()), true);
                }, 14L);
            }
            case "reiniciar" -> {
                plugin.fx.sound(p, "dropper:bajar", Sound.ENTITY_ENDERMAN_TELEPORT, 1f, 0.7f);
                plugin.fx.particle(l.clone().add(0, 1, 0), Particle.REVERSE_PORTAL, 60, 0.6, 0.2);
                Bukkit.getScheduler().runTaskLater(plugin, () -> {
                    if (g.running()) g.goLevel(p, g.checkpoint(), false, true);
                }, 6L);
            }
            case "empujar" -> {
                double a = plugin.fx.rnd().nextDouble() * Math.PI * 2;
                Vector v = new Vector(Math.cos(a), 0, Math.sin(a)).multiply(s.pushStrength * Math.min(3, r.n()));
                p.setVelocity(p.getVelocity().add(v));
                plugin.fx.particle(l.clone().add(0, 1, 0), Particle.GUST, 2, 0.2, 0);
                plugin.fx.sound(p, "dropper:empujon", Sound.ENTITY_BREEZE_WIND_BURST, 1f, 1f);
            }
            case "viento" -> {
                double a = plugin.fx.rnd().nextDouble() * Math.PI * 2;
                windDir = new Vector(Math.cos(a), 0, Math.sin(a));
                windUntil = plugin.tick() + s.windS * 20L;
                plugin.fx.sound(p, "dropper:viento", Sound.ITEM_ELYTRA_FLYING, 0.6f, 1.3f);
            }
            case "niebla" -> {
                p.addPotionEffect(new PotionEffect(PotionEffectType.DARKNESS, s.fogS * 20, 0, true, false, false));
                plugin.fx.sound(p, "dropper:niebla", Sound.AMBIENT_CAVE, 1f, 0.6f);
            }
            case "lento" -> {
                p.addPotionEffect(new PotionEffect(PotionEffectType.SLOW_FALLING, s.slowS * 20, 0, true, false, false));
                plugin.fx.particle(l.clone().add(0, 2.5, 0), Particle.CLOUD, 30, 0.6, 0.02);
                plugin.fx.sound(p, "dropper:lento", Sound.ENTITY_PHANTOM_FLAP, 1f, 1.4f);
            }
            case "acelerar" -> {
                p.setVelocity(p.getVelocity().add(new Vector(0, -1.2, 0)));
                plugin.fx.particle(l.clone().add(0, 3, 0), Particle.CRIT, 40, 0.5, 0.3);
                plugin.fx.sound(p, "dropper:empujon", Sound.ENTITY_BREEZE_SHOOT, 1f, 0.7f);
            }
            case "terremoto" -> {
                quakeUntil = plugin.tick() + s.quakeS * 20L;
                plugin.fx.sound(p, "dropper:terremoto", Sound.ENTITY_WARDEN_SONIC_BOOM, 0.4f, 0.6f);
            }
            case "escudo" -> {
                g.shield(s.shieldS);
                plugin.fx.spiral(l.clone(), Color.fromRGB(0xFF7BE5), true, 2.2, 2, Particle.END_ROD);
                plugin.fx.sound(p, "dropper:escudo", Sound.ITEM_SHIELD_BLOCK, 1f, 1.4f);
            }
            case "guia" -> {
                g.guide(s.guideS);
                plugin.fx.sound(p, "dropper:ayuda", Sound.BLOCK_AMETHYST_BLOCK_CHIME, 1f, 1.2f);
            }
            default -> {}
        }
        plugin.hud.update();
    }
}
