package dev.livearena.basedefense.game;

import dev.livearena.basedefense.BaseDefense;
import net.kyori.adventure.text.format.TextColor;
import org.bukkit.Sound;
import org.bukkit.entity.Player;

/**
 * Amenaza: sube con lo que mandan los espectadores (mobs y jefes donados) y baja sola con el tiempo. Cada nivel
 * endurece la partida: más vida y velocidad de los mobs, oleadas más grandes y más élites. Sin donaciones se queda
 * en el nivel 1 (la dificultad base, que ya es exigente).
 */
public final class Threat {
    private final BaseDefense plugin;
    private double points;
    private int shownLevel = 1;

    public Threat(BaseDefense plugin) {
        this.plugin = plugin;
    }

    public void reset() {
        points = 0;
        shownLevel = 1;
    }

    public void add(double p) {
        if (!plugin.game.running() || p <= 0) return;
        points = Math.min(points + p, plugin.settings.threatPerLevel * plugin.settings.threatLevels * 1.5);
        check();
    }

    public void addMobs(int n) {
        add(n * plugin.settings.threatPerMob);
    }

    public void addBoss() {
        add(plugin.settings.threatPerBoss);
    }

    /** 1..niveles */
    public int level() {
        return Math.min(plugin.settings.threatLevels, 1 + (int) (points / plugin.settings.threatPerLevel));
    }

    /** 0..1 dentro del nivel actual (para la barrita). */
    public double progress() {
        if (level() >= plugin.settings.threatLevels) return 1;
        return (points % plugin.settings.threatPerLevel) / plugin.settings.threatPerLevel;
    }

    public double hpMult() {
        return 1 + (level() - 1) * plugin.settings.threatHp;
    }

    public double speedMult() {
        return 1 + (level() - 1) * plugin.settings.threatSpeed;
    }

    public double waveMult() {
        return 1 + (level() - 1) * plugin.settings.threatWave;
    }

    public double eliteBonus() {
        return (level() - 1) * plugin.settings.threatElite;
    }

    /** Cada segundo. */
    public void tick() {
        if (!plugin.game.running() || plugin.game.paused()) return;
        points = Math.max(0, points - plugin.settings.threatDecay);
        check();
    }

    private void check() {
        int lv = level();
        if (lv > shownLevel) {
            plugin.hud.notify("warn", Txt2.plain(plugin.settings.msg("amenazaSube"), "nivel", lv), TextColor.color(0xFF5030));
            for (Player p : plugin.game.viewers()) {
                p.playSound(p.getLocation(), Sound.ENTITY_ELDER_GUARDIAN_CURSE, 0.7f, 0.6f + lv * 0.08f);
                p.playSound(p.getLocation(), Sound.EVENT_RAID_HORN, 0.8f, 0.7f);
            }
            if (lv >= 4) plugin.alerts.siren(1);
        }
        shownLevel = lv;
    }

    /** Texto plano de una plantilla de la config. */
    static final class Txt2 {
        static String plain(String tpl, Object... kv) {
            return Alerts.plain(dev.livearena.basedefense.util.Txt.plain(tpl, kv));
        }
    }
}
