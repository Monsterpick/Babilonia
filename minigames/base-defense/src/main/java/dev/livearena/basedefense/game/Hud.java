package dev.livearena.basedefense.game;

import dev.livearena.basedefense.BaseDefense;
import dev.livearena.basedefense.util.Txt;
import io.papermc.paper.scoreboard.numbers.NumberFormat;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.scoreboard.Criteria;
import org.bukkit.scoreboard.DisplaySlot;
import org.bukkit.scoreboard.Objective;
import org.bukkit.scoreboard.Scoreboard;

/** BossBars (vida de la base, ronda, meta de likes) y marcador lateral para el stream. */
public final class Hud {
    private final BaseDefense plugin;
    private final BossBar base, round, likes;
    private final Map<UUID, Scoreboard> boards = new HashMap<>();
    private boolean shown;

    public Hud(BaseDefense plugin) {
        this.plugin = plugin;
        base = BossBar.bossBar(Component.empty(), 1f, BossBar.Color.GREEN, BossBar.Overlay.NOTCHED_20);
        round = BossBar.bossBar(Component.empty(), 1f, BossBar.Color.YELLOW, BossBar.Overlay.PROGRESS);
        likes = BossBar.bossBar(Component.empty(), 0f, BossBar.Color.PINK, BossBar.Overlay.PROGRESS);
    }

    public void show() {
        shown = true;
        for (Player p : plugin.game.viewers()) attach(p);
        update();
    }

    public void hide() {
        shown = false;
        for (Player p : Bukkit.getOnlinePlayers()) detach(p);
        boards.clear();
    }

    public void refresh() {
        if (shown) update();
    }

    /**
     * El cliente solo dibuja las barras que caben en el tercio superior de la pantalla, así que se
     * muestran por prioridad: vida de la base, jefes, ronda y meta de likes.
     */
    public void relayout() {
        if (!shown) return;
        for (Player p : plugin.game.viewers()) bars(p);
    }

    private void bars(Player p) {
        p.hideBossBar(base);
        p.hideBossBar(round);
        p.hideBossBar(likes);
        plugin.bosses.hideBars(p);
        p.showBossBar(base);
        plugin.bosses.showBars(p);
        p.showBossBar(round);
        if (plugin.bosses.all().isEmpty()) p.showBossBar(likes);
    }

    public void attach(Player p) {
        bars(p);
        Scoreboard sb = boards.computeIfAbsent(p.getUniqueId(), id -> Bukkit.getScoreboardManager().getNewScoreboard());
        p.setScoreboard(sb);
    }

    public void detach(Player p) {
        p.hideBossBar(base);
        p.hideBossBar(round);
        p.hideBossBar(likes);
        plugin.bosses.hideBars(p);
        if (boards.remove(p.getUniqueId()) != null) p.setScoreboard(Bukkit.getScoreboardManager().getMainScoreboard());
    }

    public void update() {
        if (!shown) return;
        Game g = plugin.game;
        double hp = Math.max(0, g.baseHp());
        int max = g.baseMax();
        float frac = (float) Math.max(0, Math.min(1, hp / max));
        base.name(Txt.fmt(plugin.settings.msg("bossbarBase"), "vida", (int) Math.ceil(hp), "max", max, "porcentaje", Math.round(frac * 100)));
        base.progress(frac);
        base.color(frac > 0.6 ? BossBar.Color.GREEN : frac > 0.3 ? BossBar.Color.YELLOW : BossBar.Color.RED);
        String time = g.paused() ? "PAUSA" : Txt.time(g.secondsLeft());
        round.name(Txt.fmt(plugin.settings.msg("bossbarRonda"), "ronda", g.round(), "tiempo", time, "victorias", g.victories(),
            "fase", plugin.waves.phase(), "oleada", plugin.waves.wave()));
        round.progress((float) Math.max(0, Math.min(1, g.secondsLeft() / (double) plugin.settings.roundSeconds)));
        round.color(g.secondsLeft() <= 10 ? BossBar.Color.RED : BossBar.Color.YELLOW);
        LikeGoal lg = plugin.likes();
        var boss = plugin.settings.bosses.get(plugin.settings.likesBoss);
        likes.name(Txt.fmt(plugin.settings.msg("bossbarLikes"), "faltan", String.format("%,d", lg.missing()).replace(',', '.'), "jefe", boss == null ? plugin.settings.likesBoss.toUpperCase() : boss.name(), "meta", plugin.settings.likesGoal));
        likes.progress(lg.progress());
        for (Player p : plugin.game.viewers()) sidebar(p);
    }

    private void sidebar(Player p) {
        Scoreboard sb = boards.get(p.getUniqueId());
        if (sb == null) return;
        Objective o = sb.getObjective("bd");
        if (o == null) {
            o = sb.registerNewObjective("bd", Criteria.DUMMY, Txt.fmt("&c&l☠ BASE DEFENSE ☠"));
            o.setDisplaySlot(DisplaySlot.SIDEBAR);
            o.numberFormat(NumberFormat.blank());
        }
        Game g = plugin.game;
        String[] lines = {
            "&7Ronda &f" + g.round() + " &8· &f" + (g.paused() ? "pausa" : Txt.time(g.secondsLeft())),
            "&6Fase &f" + plugin.waves.phase() + "&7/" + plugin.settings.phases + " &8· &cOleada &f" + plugin.waves.wave(),
            "&7Próxima oleada &f" + plugin.waves.secondsToWave() + "s",
            "&eVictorias &f" + g.victories(),
            " ",
            "&cMobs vivos &f" + plugin.mobs.alive(),
            "&6En cola &f" + plugin.mobs.queued(),
            "&4Jefes &f" + plugin.bosses.all().size(),
            "&aBajas &f" + plugin.mobs.kills,
            "  ",
            "&dLikes &f" + plugin.likes().total(),
            "&7faltan &f" + plugin.likes().missing(),
        };
        for (int i = 0; i < lines.length; i++) {
            var score = o.getScore("l" + i);
            score.setScore(lines.length - i);
            score.customName(Txt.fmt(lines[i]));
        }
    }
}
