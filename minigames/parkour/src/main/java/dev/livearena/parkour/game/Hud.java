package dev.livearena.parkour.game;

import dev.livearena.parkour.ParkourLive;
import dev.livearena.parkour.tower.Theme;
import dev.livearena.parkour.tower.Themes;
import io.papermc.paper.scoreboard.numbers.NumberFormat;
import java.time.Duration;
import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextColor;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import net.kyori.adventure.title.Title;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.scoreboard.Criteria;
import org.bukkit.scoreboard.DisplaySlot;
import org.bukkit.scoreboard.Objective;
import org.bukkit.scoreboard.Scoreboard;

/**
 * Interfaz en el juego:
 * <ul>
 *   <li>Barra superior (BossBar con textura propia del pack): nivel, bioma y progreso total de la torre.</li>
 *   <li>Panel lateral derecho: la torre alrededor de tu nivel (hechos ✔, actual ▶, siguientes), caídas, tiempo y
 *       ganadas/perdidas.</li>
 *   <li>Títulos al llegar a un nivel, avisos de lo que manda cada espectador en la barra de acción.</li>
 * </ul>
 */
public final class Hud {
    private static final LegacyComponentSerializer AMP = LegacyComponentSerializer.builder().character('&').hexColors().build();
    private final ParkourLive plugin;
    private BossBar bar;
    private Scoreboard board;
    private Objective side;
    private Component notice;
    private long noticeUntil;

    public Hud(ParkourLive plugin) {
        this.plugin = plugin;
    }

    public static Component amp(String s) {
        return AMP.deserialize(s);
    }

    private static String clean(String s) {
        return s.replace('&', '＆').replace('§', ' ');
    }

    public void show(Player p) {
        if (bar == null) bar = BossBar.bossBar(Component.empty(), 0, BossBar.Color.GREEN, BossBar.Overlay.PROGRESS);
        p.showBossBar(bar);
        board = Bukkit.getScoreboardManager().getNewScoreboard();
        side = board.registerNewObjective("torre", Criteria.DUMMY, Component.text("⛰ TORRE PARKOUR", TextColor.color(0xFFD45A)).decorate(TextDecoration.BOLD));
        side.setDisplaySlot(DisplaySlot.SIDEBAR);
        side.numberFormat(NumberFormat.blank());
        p.setScoreboard(board);
        update();
    }

    public void hide(Player p) {
        if (bar != null) p.hideBossBar(bar);
        p.setScoreboard(Bukkit.getScoreboardManager().getMainScoreboard());
        board = null;
        side = null;
    }

    public void refresh() {
        Player p = plugin.game.player();
        if (p != null && plugin.game.running()) show(p);
    }

    private static BossBar.Color colorOf(int rgb) {
        float[] hsb = java.awt.Color.RGBtoHSB((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, null);
        if (hsb[1] < 0.2f) return BossBar.Color.WHITE;
        float h = hsb[0] * 360;
        if (h < 20 || h >= 340) return BossBar.Color.RED;
        if (h < 70) return BossBar.Color.YELLOW;
        if (h < 165) return BossBar.Color.GREEN;
        if (h < 250) return BossBar.Color.BLUE;
        if (h < 300) return BossBar.Color.PURPLE;
        return BossBar.Color.PINK;
    }

    public void update() {
        Game g = plugin.game;
        Player p = g.player();
        if (p == null || !g.running()) return;
        int levels = plugin.tower.levels;
        int cp = Math.min(g.checkpoint(), levels + 1);
        Theme th = g.theme();
        if (bar != null) {
            Component name = cp > levels
                ? Component.text("★ CIMA ALCANZADA ★", TextColor.color(0xFFD700)).decorate(TextDecoration.BOLD)
                : Component.text("NIVEL ", NamedTextColor.WHITE).decorate(TextDecoration.BOLD)
                    .append(Component.text(cp, TextColor.color(th.rgb())))
                    .append(Component.text("/" + levels, NamedTextColor.GRAY))
                    .append(Component.text("  ·  ", NamedTextColor.DARK_GRAY))
                    .append(Component.text(th.name(), TextColor.color(th.rgb())).decoration(TextDecoration.BOLD, false))
                    .append(Component.text("  ·  " + Math.round(g.totalProgress() * 100) + "%", NamedTextColor.GRAY).decoration(TextDecoration.BOLD, false));
            bar.name(name);
            bar.progress((float) Math.max(0, Math.min(1, g.totalProgress())));
            bar.color(cp > levels ? BossBar.Color.YELLOW : colorOf(th.rgb()));
        }
        sidebar(g, cp, levels);
        // barra de experiencia: número = nivel, barra = progreso dentro del nivel
        p.setLevel(Math.min(cp, levels));
        p.setExp((float) Math.max(0, Math.min(0.999, cp > levels ? 1 : g.levelProgress())));
        long now = plugin.tick();
        if (notice != null && now < noticeUntil) p.sendActionBar(notice);
        else {
            notice = null;
            String extra = g.shielded() ? "  &d🛡 escudo" : g.isProtected() ? "  &a✚ protegido" : "";
            int q = plugin.effects.queued();
            p.sendActionBar(amp("&7Nivel &f" + Math.round(g.levelProgress() * 100) + "%  &8|  &7☠ &f" + g.falls() + extra + (q > 0 ? "  &8|  &e⧗ " + q + " en cola" : "")));
        }
    }

    private void sidebar(Game g, int cp, int levels) {
        if (side == null || board == null) return;
        String[] lines = new String[14];
        int n = 0;
        lines[n++] = "&8 ";
        int top = Math.min(levels + 1, cp + 3), bottom = Math.max(1, top - 6);
        top = Math.min(levels + 1, bottom + 6);
        for (int lv = top; lv >= bottom; lv--) {
            if (lv > levels) {
                lines[n++] = (cp > levels ? "&6★ " : "&8▲ ") + "&6&lCIMA";
                continue;
            }
            Theme th = Themes.of(lv);
            String col = "&#" + th.hex();
            String nm = th.name().length() > 18 ? th.name().substring(0, 17) + "…" : th.name();
            if (lv == cp) lines[n++] = "&e▶ &f&l" + lv + " " + col + nm;
            else if (lv < cp) lines[n++] = "&a✔ &7" + lv + " " + nm;
            else lines[n++] = "&8│ &7" + lv + " " + col + nm;
        }
        lines[n++] = "&8  ";
        int secs = g.seconds();
        int limit = plugin.settings.timeLimitMin * 60;
        String time = limit > 0 ? fmt(Math.max(0, limit - secs)) : fmt(secs);
        lines[n++] = "&7⏱ &f" + time + "   &7☠ &f" + g.falls();
        lines[n++] = "&a▲ " + g.wins() + " &8· &c▼ " + g.losses();
        for (int i = 0; i < 14; i++) {
            String entry = "§" + Integer.toHexString(i % 16) + "§r" + (i >= 16 ? "§l" : "");
            if (i >= n) {
                board.resetScores(entry);
                continue;
            }
            var score = side.getScore(entry);
            score.setScore(n - i);
            score.customName(amp(lines[i]));
        }
    }

    private static String fmt(int s) {
        return s >= 3600 ? String.format("%d:%02d:%02d", s / 3600, (s / 60) % 60, s % 60) : String.format("%02d:%02d", s / 60, s % 60);
    }

    public void levelTitle(Player p, int lv, boolean up) {
        if (lv > plugin.tower.levels) return;
        Theme th = Themes.of(lv);
        Component main = Component.text((up ? "▲ " : "▼ ") + "NIVEL " + lv, TextColor.color(up ? th.rgb() : 0xFF5050)).decorate(TextDecoration.BOLD);
        Component sub = Component.text(th.name(), TextColor.color(th.rgb()));
        p.showTitle(Title.title(main, sub, Title.Times.times(Duration.ofMillis(150), Duration.ofMillis(1800), Duration.ofMillis(500))));
    }

    /** Aviso de lo que manda un espectador. */
    public void notify(Player p, String template, String user, boolean good) {
        String u = clean(user.length() > 24 ? user.substring(0, 24) : user);
        notice = amp(template.replace("{usuario}", u));
        noticeUntil = plugin.tick() + 60;
        p.sendActionBar(notice);
    }

    public void flash(Player p, String text) {
        notice = amp(text);
        noticeUntil = plugin.tick() + 50;
        p.sendActionBar(notice);
    }

    public void win(Player p) {
        p.showTitle(Title.title(Component.text("¡CIMA!", TextColor.color(0xFFD700)).decorate(TextDecoration.BOLD),
            Component.text("Has subido los " + plugin.tower.levels + " niveles · ☠ " + plugin.game.falls() + " caídas", NamedTextColor.WHITE),
            Title.Times.times(Duration.ofMillis(200), Duration.ofMillis(4500), Duration.ofMillis(800))));
    }

    public void lose(Player p, String why) {
        p.showTitle(Title.title(Component.text(why, NamedTextColor.RED).decorate(TextDecoration.BOLD),
            Component.text("Vuelves al nivel 1", NamedTextColor.GRAY), Title.Times.times(Duration.ofMillis(200), Duration.ofMillis(3000), Duration.ofMillis(700))));
    }
}
