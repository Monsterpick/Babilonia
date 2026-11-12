package dev.livearena.dropper.game;

import dev.livearena.dropper.DropperLive;
import dev.livearena.dropper.hud.HudFont;
import dev.livearena.dropper.map.Theme;
import dev.livearena.dropper.map.Themes;
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
 * Interfaz en el juego, dibujada con fuentes del pack (como en Base Defense; ver tools/gen_drhud.py):
 * <ul>
 *   <li>Arriba (título de una BossBar con las barras nativas invisibles): nivel en grande, bioma, % de la torre y una
 *       tira con un segmento por nivel teñido con el color de su bioma; debajo, carteles (subir de nivel, cima…).</li>
 *   <li>Abajo (barra de acción, en el sitio de la hotbar, que el pack oculta): progreso del nivel, caídas, tiempo,
 *       ganadas-perdidas y estado; encima, el aviso de lo que manda cada espectador.</li>
 * </ul>
 * Si el jugador rechaza el pack se usa la versión clásica (BossBar, panel lateral y barra de experiencia).
 */
public final class Hud {
    private static final LegacyComponentSerializer AMP = LegacyComponentSerializer.builder().character('&').hexColors().build();
    private static final TextColor GRAY = TextColor.color(0x9AA0B8), DIM = TextColor.color(0x5C6078), GOOD = TextColor.color(0x7CFF9E),
        BAD = TextColor.color(0xFF5A6A), GOLD = TextColor.color(0xFFD45A), PINK = TextColor.color(0xFF7BE5);
    private final DropperLive plugin;
    private final HudFont font;
    private final BossBar top = BossBar.bossBar(Component.empty(), 0, BossBar.Color.WHITE, BossBar.Overlay.PROGRESS);
    private BossBar bar;
    private Scoreboard board;
    private Objective side;
    // aviso (lo que manda un espectador)
    private String noticeText = "", noticeIcon = "i_star";
    private TextColor noticeColor = NamedTextColor.WHITE;
    private Component noticePlain;
    private long noticeUntil, noticeBorn;
    // cartel grande
    private String banTitle = "", banSub = "";
    private TextColor banColor = NamedTextColor.WHITE;
    private long banUntil, banBorn;

    public Hud(DropperLive plugin) {
        this.plugin = plugin;
        this.font = new HudFont(plugin.getResource("hud.json"));
        if (!font.ok()) plugin.getLogger().warning("No se pudo leer hud.json: se usará la interfaz clásica");
    }

    public static Component amp(String s) {
        return AMP.deserialize(s);
    }

    private static String clean(String s) {
        return s.replace('&', '＆').replace('§', ' ');
    }

    private boolean fancy(Player p) {
        return font.ok() && plugin.pack.loaded(p);
    }

    // ───────────────────────────── mostrar / ocultar ─────────────────────────────

    public void show(Player p) {
        p.hideBossBar(top);
        if (bar != null) p.hideBossBar(bar);
        if (fancy(p)) {
            p.showBossBar(top);
            if (board != null) p.setScoreboard(Bukkit.getScoreboardManager().getMainScoreboard());
            board = null;
            side = null;
            // la barra de experiencia nativa no se usa (el pack la oculta; el número se vería suelto)
            p.setLevel(0);
            p.setExp(0);
        } else {
            if (bar == null) bar = BossBar.bossBar(Component.empty(), 0, BossBar.Color.GREEN, BossBar.Overlay.PROGRESS);
            p.showBossBar(bar);
            board = Bukkit.getScoreboardManager().getNewScoreboard();
            side = board.registerNewObjective("torre", Criteria.DUMMY, Component.text("⬇ DROPPER", TextColor.color(0xFFD45A)).decorate(TextDecoration.BOLD));
            side.setDisplaySlot(DisplaySlot.SIDEBAR);
            side.numberFormat(NumberFormat.blank());
            p.setScoreboard(board);
        }
        update();
    }

    public void hide(Player p) {
        p.hideBossBar(top);
        if (bar != null) p.hideBossBar(bar);
        p.setScoreboard(Bukkit.getScoreboardManager().getMainScoreboard());
        p.sendActionBar(Component.empty());
        board = null;
        side = null;
    }

    public void refresh() {
        Player p = plugin.game.player();
        if (p != null && plugin.game.running()) show(p);
    }

    public void update() {
        Game g = plugin.game;
        Player p = g.player();
        if (p == null || !g.running()) return;
        int levels = plugin.settings.levels;
        int cp = Math.min(g.checkpoint(), levels + 1);
        if (fancy(p)) {
            if (board != null) show(p); // acaba de cargar el pack: se cambia de la clásica a la propia
            long now = plugin.tick();
            top.name(topLine(g, cp, levels, now));
            p.sendActionBar(bottomLine(g, cp, levels, now));
            return;
        }
        if (bar == null || board == null) {
            show(p);
            return;
        }
        plain(g, p, cp, levels);
    }

    // ───────────────────────────── interfaz propia ─────────────────────────────

    private static TextColor dark(int rgb, double k) {
        return TextColor.color((int) (((rgb >> 16) & 255) * k), (int) (((rgb >> 8) & 255) * k), (int) ((rgb & 255) * k));
    }

    /** Colores muy oscuros (basalto, sculk…) se aclaran para que el texto se lea sobre el panel. */
    private static TextColor readable(int rgb) {
        int r = (rgb >> 16) & 255, gr = (rgb >> 8) & 255, b = rgb & 255;
        int max = Math.max(r, Math.max(gr, b));
        if (max >= 170) return TextColor.color(rgb);
        double k = 170.0 / Math.max(1, max);
        return TextColor.color(Math.min(255, (int) (r * k) + 20), Math.min(255, (int) (gr * k) + 20), Math.min(255, (int) (b * k) + 20));
    }

    private Component topLine(Game g, int cp, int levels, long now) {
        HudFont.Line l = font.line();
        boolean summit = cp > levels;
        Theme th = g.theme();
        TextColor col = summit ? GOLD : readable(th.rgb());
        l.put("dropper:bb_top", -103, font.g("p_top"), NamedTextColor.WHITE);
        // izquierda: NIVEL 23 /50
        int x = -96;
        String label = summit ? "FIN" : "NIVEL";
        l.put("dropper:bb_name", x, label, GRAY, -1);
        x += font.width("dropper:bb_name", label, -1) + 4;
        String num = summit ? "★" : String.valueOf(cp);
        l.put("dropper:bb_top", x, num, col, 0);
        x += font.width("dropper:bb_top", num, 0) + 1;
        if (!summit) l.put("dropper:bb_sub", x, "/" + levels, GRAY, -1);
        // derecha: bioma y % de la torre
        String name = font.clean("dropper:bb_name", summit ? "¡COMPLETADO!" : th.name());
        l.right("dropper:bb_name", 97, name, col, -1);
        l.right("dropper:bb_sub", 97, "MAPA " + Math.round(g.totalProgress() * 100) + "%", GRAY, -1);
        // tira de la torre: un segmento por nivel con el color de su bioma
        int per = Math.max(2, Math.min(13, 200 / Math.max(1, levels)));
        String w = String.valueOf(per - 1);
        int sx = -(per * levels) / 2;
        String seg = font.one("seg", w), segc = font.one("segc", w);
        for (int lv = 1; lv <= levels; lv++) {
            int rgb = Themes.of(lv).rgb();
            int px = sx + (lv - 1) * per;
            if (lv == cp) l.put("dropper:bb_top", px, segc, (now / 6) % 2 == 0 ? NamedTextColor.WHITE : TextColor.color(rgb));
            else l.put("dropper:bb_top", px, seg, lv < cp ? TextColor.color(rgb) : dark(rgb, 0.3));
        }
        // cartel
        if (now < banUntil) {
            String bt = font.clean("dropper:bb_ban", banTitle), bs = font.clean("dropper:bb_bansub", banSub);
            int tw = font.width("dropper:bb_ban", bt, 1), sw = font.width("dropper:bb_bansub", bs, -1);
            int wd = HudFont.Line.plateWidth(Math.max(tw, sw) + 24);
            long age = now - banBorn;
            if (age < 3) wd = HudFont.Line.plateWidth((int) (wd * (age + 1) / 4.0)); // se abre
            l.plate("dropper:bb_ban", "ban", -wd / 2, wd);
            if (age >= 3) {
                l.center("dropper:bb_ban", 0, bt, banColor, 1);
                if (!bs.isBlank()) l.center("dropper:bb_bansub", 0, bs, NamedTextColor.WHITE, -1);
            }
        }
        return l.build();
    }

    private Component bottomLine(Game g, int cp, int levels, long now) {
        HudFont.Line l = font.line();
        boolean summit = cp > levels;
        TextColor col = summit ? GOLD : readable(g.theme().rgb());
        l.put("dropper:ab_panel", -91, font.g("p_stat"), NamedTextColor.WHITE);
        // fila 1: progreso dentro del nivel
        double frac = summit ? 1 : g.levelProgress();
        l.put("dropper:ab_r1", -87, font.g("i_flag"), NamedTextColor.WHITE);
        l.put("dropper:ab_r1", -76, font.step("b_lvl", frac), col);
        l.center("dropper:ab_r1", 68, Math.round(frac * 100) + "%", NamedTextColor.WHITE, -1);
        // fila 2: caídas · tiempo · ganadas-perdidas · estado
        String f2 = "dropper:ab_r2";
        l.put(f2, -87, font.g("i_skull"), NamedTextColor.WHITE);
        l.put(f2, -76, String.valueOf(g.falls()), NamedTextColor.WHITE, -1);
        int secs = g.seconds(), limit = plugin.settings.timeLimitMin * 60;
        int shown = limit > 0 ? Math.max(0, limit - secs) : secs;
        l.put(f2, -42, font.g("i_clock"), NamedTextColor.WHITE);
        l.put(f2, -31, fmt(shown), limit > 0 && shown < 60 ? BAD : NamedTextColor.WHITE, -1);
        l.put(f2, 8, font.g("i_trophy"), NamedTextColor.WHITE);
        String ws = String.valueOf(g.wins()), ls = String.valueOf(g.losses());
        int wx = 19;
        l.put(f2, wx, ws, GOOD, -1);
        wx += font.width(f2, ws, -1) + 1;
        l.put(f2, wx, "-", DIM, -1);
        wx += font.width(f2, "-", -1) + 1;
        l.put(f2, wx, ls, BAD, -1);
        int q = plugin.effects.queued();
        if (g.shielded()) {
            l.put(f2, 44, font.g("i_shield"), NamedTextColor.WHITE);
            l.put(f2, 54, "ESCUDO", PINK, -1);
        } else if (g.isProtected()) {
            l.put(f2, 44, font.g("i_cross"), NamedTextColor.WHITE);
            l.put(f2, 54, "SEGURO", GOOD, -1);
        } else if (q > 0) {
            l.put(f2, 53, font.g("i_gift"), NamedTextColor.WHITE);
            l.put(f2, 64, "+" + q, GOLD, -1);
        } else {
            l.put(f2, 53, font.g("i_mountain"), DIM);
            l.put(f2, 64, Math.round(g.totalProgress() * 100) + "%", GRAY, -1);
        }
        // aviso encima del panel
        if (now < noticeUntil && !noticeText.isEmpty()) {
            String fn = "dropper:ab_n1";
            String t = noticeText;
            int tw = font.width(fn, t, 0);
            int wd = HudFont.Line.plateWidth(tw + 26);
            long age = now - noticeBorn;
            if (age < 2) wd = HudFont.Line.plateWidth(wd / 2);
            l.plate(fn, "pill", -wd / 2, wd);
            if (age >= 2) {
                l.put(fn, -wd / 2 + 6, font.g(noticeIcon), noticeColor);
                l.put(fn, -wd / 2 + 19, t, NamedTextColor.WHITE, 0);
            }
        }
        return l.build();
    }

    /** Texto para la letra propia: sin códigos de color y sin los caracteres que la letra no tiene (emojis, flechas…). */
    private String fit(String fontName, String s) {
        String raw = s.replaceAll("&#[0-9A-Fa-f]{6}|&[0-9a-fk-orA-FK-OR]", "");
        String c = font.clean(fontName, raw).replace("?", "").replaceAll(" {2,}", " ").trim();
        // los signos de interrogación de verdad se pierden: aquí no hacen falta
        return c.length() > 40 ? c.substring(0, 40) : c;
    }

    private static String iconFor(String type, boolean good) {
        return switch (type) {
            case "subir" -> "i_down";
            case "bajar", "reiniciar" -> "i_up";
            case "empujar", "viento" -> "i_wind";
            case "escudo" -> "i_shield";
            case "terremoto", "niebla", "acelerar" -> "i_warn";
            case "lento", "guia" -> "i_star";
            default -> good ? "i_star" : "i_warn";
        };
    }

    private void banner(String title, String sub, TextColor color, int ticks) {
        banTitle = title;
        banSub = sub;
        banColor = color;
        banBorn = plugin.tick();
        banUntil = banBorn + ticks;
    }

    // ───────────────────────────── avisos y carteles ─────────────────────────────

    public void levelTitle(Player p, int lv, boolean up) {
        if (lv > plugin.settings.levels) return;
        Theme th = Themes.of(lv);
        if (fancy(p)) {
            banner((up ? "NIVEL " : "VUELVES AL NIVEL ") + lv, th.name(), up ? readable(th.rgb()) : BAD, 50);
            update();
            return;
        }
        Component main = Component.text((up ? "▲ " : "▼ ") + "NIVEL " + lv, TextColor.color(up ? th.rgb() : 0xFF5050)).decorate(TextDecoration.BOLD);
        Component sub = Component.text(th.name(), TextColor.color(th.rgb()));
        p.showTitle(Title.title(main, sub, Title.Times.times(Duration.ofMillis(150), Duration.ofMillis(1800), Duration.ofMillis(500))));
    }

    /** Aviso de lo que manda un espectador. */
    public void notify(Player p, String type, String template, String user, boolean good) {
        String u = clean(user.length() > 24 ? user.substring(0, 24) : user);
        String text = template.replace("{usuario}", u);
        noticeBorn = plugin.tick();
        noticeUntil = noticeBorn + 70;
        noticeText = fit("dropper:ab_n1", text);
        noticeIcon = iconFor(type, good);
        noticeColor = good ? GOOD : BAD;
        noticePlain = amp(text);
        if (fancy(p)) update();
        else p.sendActionBar(noticePlain);
    }

    public void flash(Player p, String text) {
        noticeBorn = plugin.tick();
        noticeUntil = noticeBorn + 60;
        noticeText = fit("dropper:ab_n1", text);
        noticeIcon = "i_star";
        noticeColor = GOLD;
        noticePlain = amp(text);
        if (fancy(p)) update();
        else p.sendActionBar(noticePlain);
    }

    public void win(Player p) {
        String sub = plugin.settings.levels + " NIVELES · " + plugin.game.falls() + " CHOQUES";
        if (fancy(p)) {
            banner("¡VICTORIA!", sub, GOLD, 120);
            update();
            return;
        }
        p.showTitle(Title.title(Component.text("¡VICTORIA!", TextColor.color(0xFFD700)).decorate(TextDecoration.BOLD),
            Component.text("Has superado los " + plugin.settings.levels + " niveles · ☠ " + plugin.game.falls() + " choques", NamedTextColor.WHITE),
            Title.Times.times(Duration.ofMillis(200), Duration.ofMillis(4500), Duration.ofMillis(800))));
    }

    public void lose(Player p, String why) {
        if (fancy(p)) {
            banner(why, "VUELVES AL NIVEL 1", BAD, 80);
            update();
            return;
        }
        p.showTitle(Title.title(Component.text(why, NamedTextColor.RED).decorate(TextDecoration.BOLD),
            Component.text("Vuelves al nivel 1", NamedTextColor.GRAY), Title.Times.times(Duration.ofMillis(200), Duration.ofMillis(3000), Duration.ofMillis(700))));
    }

    // ───────────────────────────── versión clásica (sin pack) ─────────────────────────────

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

    private void plain(Game g, Player p, int cp, int levels) {
        Theme th = g.theme();
        Component name = cp > levels
            ? Component.text("★ ¡COMPLETADO! ★", TextColor.color(0xFFD700)).decorate(TextDecoration.BOLD)
            : Component.text("NIVEL ", NamedTextColor.WHITE).decorate(TextDecoration.BOLD)
                .append(Component.text(cp, TextColor.color(th.rgb())))
                .append(Component.text("/" + levels, NamedTextColor.GRAY))
                .append(Component.text("  ·  ", NamedTextColor.DARK_GRAY))
                .append(Component.text(th.name(), TextColor.color(th.rgb())).decoration(TextDecoration.BOLD, false))
                .append(Component.text("  ·  " + Math.round(g.totalProgress() * 100) + "%", NamedTextColor.GRAY).decoration(TextDecoration.BOLD, false));
        bar.name(name);
        bar.progress((float) Math.max(0, Math.min(1, g.totalProgress())));
        bar.color(cp > levels ? BossBar.Color.YELLOW : colorOf(th.rgb()));
        sidebar(g, cp, levels);
        p.setLevel(Math.min(cp, levels));
        p.setExp((float) Math.max(0, Math.min(0.999, cp > levels ? 1 : g.levelProgress())));
        long now = plugin.tick();
        if (noticePlain != null && now < noticeUntil) p.sendActionBar(noticePlain);
        else {
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
                lines[n++] = (cp > levels ? "&6★ " : "&8▼ ") + "&6&lFIN";
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
        lines[n++] = "&7⏱ &f" + (limit > 0 ? fmt(Math.max(0, limit - secs)) : fmt(secs)) + "   &7☠ &f" + g.falls();
        lines[n++] = "&a▲ " + g.wins() + " &8· &c▼ " + g.losses();
        for (int i = 0; i < 14; i++) {
            String entry = "§" + Integer.toHexString(i % 16) + "§r";
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
}
