package dev.livearena.basedefense.fx;

import dev.livearena.basedefense.BaseDefense;
import java.util.List;
import org.bukkit.Location;
import org.bukkit.Particle;
import org.bukkit.SoundCategory;
import org.bukkit.entity.Player;

/**
 * Atmósfera: ceniza cayendo alrededor del streamer, humo en el portal y sonidos lejanos a
 * intervalos aleatorios (viento, gruñidos, aullidos). Todo con límite por tick.
 */
public final class Ambience {
    private final BaseDefense plugin;
    private long nextSound;

    public Ambience(BaseDefense plugin) {
        this.plugin = plugin;
    }

    public void tick() {
        if (!plugin.game.running() || plugin.arena == null) return;
        Player p = plugin.game.streamer();
        if (p == null || !plugin.inGameWorld(p)) return;
        var r = plugin.fx.rnd();
        long now = plugin.tick();
        Location c = p.getLocation();
        int ash = plugin.settings.ashPerTick;
        for (int i = 0; i < ash; i++) {
            Location at = c.clone().add((r.nextDouble() - 0.5) * 50, 6 + r.nextDouble() * 14, r.nextDouble() * 60 - 8);
            plugin.fx.particle(at, r.nextInt(3) == 0 ? Particle.WHITE_ASH : Particle.ASH, 2, 0.5, 0.0, false);
        }
        // niebla en la boca del portal
        if (now % 3 == 0) {
            Location portal = plugin.arena.mobSpawn(p.getWorld()).add(0, 0.4, 1);
            plugin.fx.particle(portal, Particle.CAMPFIRE_COSY_SMOKE, 1, 2.6, 0.2, 0.6, 0.006, null, false);
            plugin.fx.particle(portal.clone().add(0, 2, 1.5), Particle.REVERSE_PORTAL, 4, 2.4, 2.2, 0.3, 0.02, null, false);
        }
        if (plugin.settings.ambientSounds && now >= nextSound) {
            int min = plugin.settings.ambientMin, max = plugin.settings.ambientMax;
            nextSound = now + (min + r.nextInt(Math.max(1, max - min + 1))) * 20L;
            List<String> list = plugin.settings.ambientList;
            if (!list.isEmpty()) {
                String key = list.get(r.nextInt(list.size()));
                double ang = r.nextDouble() * Math.PI * 2;
                Location far = c.clone().add(Math.cos(ang) * 28, 2, Math.abs(Math.sin(ang)) * 40 + 10);
                p.playSound(far, key, SoundCategory.AMBIENT, 1.4f, 0.6f + r.nextFloat() * 0.4f);
            }
        }
    }
}
