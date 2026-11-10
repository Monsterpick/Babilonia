package dev.livearena.basedefense.game;

import dev.livearena.basedefense.BaseDefense;
import dev.livearena.basedefense.Settings;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.bukkit.Sound;
import org.bukkit.entity.Player;

/**
 * Fases y oleadas automáticas: la ronda se divide en fases; cada fase desbloquea mobs nuevos (zombis y
 * esqueletos → arañas → piglins → esqueletos wither…), sube su vida y hace las oleadas más grandes.
 * Los regalos se suman encima.
 */
public final class Waves {
    private final BaseDefense plugin;
    private int phase = 1, wave;
    private long nextWave, nextSupply;
    private boolean warned;

    public Waves(BaseDefense plugin) {
        this.plugin = plugin;
    }

    public int phase() {
        return phase;
    }

    public int wave() {
        return wave;
    }

    public int secondsToWave() {
        return (int) Math.max(0, (nextWave - plugin.tick()) / 20);
    }

    /** Al empezar o reiniciar una ronda. */
    public void reset() {
        reset(true);
    }

    public void reset(boolean announce) {
        reset(announce, true);
    }

    /** relock: volver a dejar solo las armas de la fase 1 (al empezar y al caer la base; al ganar se conservan). */
    public void reset(boolean announce, boolean relock) {
        phase = 1;
        wave = 0;
        long now = plugin.tick();
        nextWave = now + 200;
        nextSupply = now + plugin.settings.supplyEvery * 20L;
        warned = false;
        if (announce) announcePhase(1);
        if (relock) plugin.weapons.relock(1);
    }

    public double healthMult() {
        return 1 + (phase - 1) * plugin.settings.healthPerPhase;
    }

    public double speedMult() {
        return 1 + (phase - 1) * plugin.settings.speedPerPhase;
    }

    private int computePhase() {
        int total = plugin.settings.roundSeconds;
        int elapsed = total - plugin.game.secondsLeft();
        return Math.max(1, Math.min(plugin.settings.phases, 1 + elapsed * plugin.settings.phases / Math.max(1, total)));
    }

    public void tick() {
        if (!plugin.game.running() || plugin.game.paused()) return;
        long now = plugin.tick();
        int ph = computePhase();
        if (ph > phase) {
            phase = ph;
            announcePhase(ph);
            plugin.weapons.unlockPhase(ph);
            if (plugin.settings.supplyOnPhase) plugin.loot.dropSupply("fase " + ph);
        }
        if (plugin.settings.waves) {
            if (!warned && nextWave - now <= 60) {
                warned = true;
                for (Player p : plugin.game.viewers()) p.playSound(p.getLocation(), Sound.BLOCK_NOTE_BLOCK_BASEDRUM, 1f, 0.6f);
            }
            if (now >= nextWave) {
                nextWave = now + plugin.settings.waveEvery * 20L;
                warned = false;
                launchWave();
            }
        }
        if (plugin.settings.supplyEvery > 0 && now >= nextSupply) {
            nextSupply = now + plugin.settings.supplyEvery * 20L;
            plugin.loot.dropSupply("auto");
        }
    }

    private void launchWave() {
        wave++;
        int base = plugin.settings.waveSize + (phase - 1) * plugin.settings.waveGrowth;
        // más grandes en cada ronda superada y con la amenaza de los espectadores
        int n = (int) Math.round(base * (1 + plugin.settings.perRound * (plugin.game.round() - 1)) * plugin.threat.waveMult());
        if (n <= 0) return;
        enqueueMix(n, null);
        // las oleadas son frecuentes: aviso pequeño abajo (los carteles grandes quedan para fases y jefes)
        plugin.hud.notify("warn", Alerts.plain(dev.livearena.basedefense.util.Txt.plain(plugin.settings.msg("oleadaSubtitulo"), "oleada", wave, "cantidad", n)),
            net.kyori.adventure.text.format.TextColor.color(0xE63C32));
        for (var p : plugin.game.viewers()) p.playSound(p.getLocation(), Sound.EVENT_RAID_HORN, 0.7f, 1.4f);
    }

    /** Mezcla de la fase actual (sorteo por peso entre los mobs desbloqueados). */
    public void enqueueMix(int n, String donor) {
        List<Settings.MobDef> pool = unlocked();
        if (pool.isEmpty()) return;
        int total = 0;
        for (Settings.MobDef d : pool) total += Math.max(1, d.weight());
        Map<Settings.MobDef, Integer> counts = new LinkedHashMap<>();
        for (int i = 0; i < n; i++) {
            int r = plugin.fx.rnd().nextInt(total);
            for (Settings.MobDef d : pool) {
                r -= Math.max(1, d.weight());
                if (r < 0) {
                    counts.merge(d, 1, Integer::sum);
                    break;
                }
            }
        }
        for (var e : counts.entrySet()) plugin.mobs.enqueue(e.getKey(), e.getValue(), donor);
    }

    public List<Settings.MobDef> unlocked() {
        List<Settings.MobDef> out = new ArrayList<>();
        for (Settings.MobDef d : plugin.settings.mobs.values()) if (d.phase() <= phase && d.weight() > 0) out.add(d);
        return out;
    }

    private void announcePhase(int ph) {
        List<String> news = new ArrayList<>();
        for (Settings.MobDef d : plugin.settings.mobs.values()) if (d.phase() == ph) news.add(d.name());
        String nuevos = news.isEmpty() ? "más y más fuertes" : String.join(", ", news);
        plugin.game.banner(plugin.settings.msg("faseTitulo"), plugin.settings.msg("faseSubtitulo"), Sound.ENTITY_WITHER_AMBIENT, 0.6f, "fase", ph, "nuevos", nuevos);
        plugin.hud.refresh();
    }
}
