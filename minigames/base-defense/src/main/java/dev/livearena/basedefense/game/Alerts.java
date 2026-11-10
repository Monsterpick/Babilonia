package dev.livearena.basedefense.game;

import dev.livearena.basedefense.BaseDefense;
import dev.livearena.basedefense.util.Txt;
import java.time.Duration;
import java.util.ArrayDeque;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.title.Title;
import org.bukkit.Bukkit;
import org.bukkit.Sound;
import org.bukkit.entity.Player;

/** Alertas: sirena, base en peligro (pulso rojo), rachas de bajas. */
public final class Alerts {
    private final BaseDefense plugin;
    private final ArrayDeque<Long> recentKills = new ArrayDeque<>();
    private long lastDanger, lastStreak;
    private int streak;

    public Alerts(BaseDefense plugin) {
        this.plugin = plugin;
    }

    /** Sirena de alarma (n pulsos subiendo y bajando). */
    public void siren(int pulses) {
        for (int i = 0; i < pulses * 2; i++) {
            final float pitch = i % 2 == 0 ? 0.6f : 1.0f;
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                for (Player p : plugin.game.viewers()) {
                    p.playSound(p.getLocation(), plugin.pack.sound(p, "basedefense:alerta.sirena", "block.note_block.bit"), 1f, pitch);
                }
            }, i * 6L);
        }
    }

    /** Cada segundo: si la base baja del 25 % suena la alarma y la pantalla late en rojo. */
    public void tick() {
        if (!plugin.game.running()) return;
        long now = plugin.tick();
        double f = plugin.game.baseHp() / Math.max(1, plugin.game.baseMax());
        if (f < 0.25 && now - lastDanger > 120) {
            lastDanger = now;
            siren(1);
            Title t = Title.title(Component.empty(), Txt.fmt(plugin.settings.msg("peligroBase")), Title.Times.times(Duration.ofMillis(100), Duration.ofMillis(900), Duration.ofMillis(300)));
            for (Player p : plugin.game.viewers()) p.showTitle(t);
            plugin.game.redFlash(14);
        }
    }

    /** Racha: muchas bajas seguidas en poco tiempo. */
    public void onKill() {
        long now = plugin.tick();
        recentKills.addLast(now);
        while (!recentKills.isEmpty() && now - recentKills.peekFirst() > 40) recentKills.pollFirst();
        streak = recentKills.size();
        if (streak >= 5 && streak % 5 == 0 && now - lastStreak > 20) {
            lastStreak = now;
            Title t = Title.title(Component.empty(), Txt.fmt(plugin.settings.msg("racha"), "n", streak), Title.Times.times(Duration.ZERO, Duration.ofMillis(700), Duration.ofMillis(200)));
            for (Player p : plugin.game.viewers()) {
                p.showTitle(t);
                p.playSound(p.getLocation(), Sound.ENTITY_PLAYER_LEVELUP, 0.6f, 1.2f + Math.min(0.8f, streak / 25f));
            }
        }
    }
}
