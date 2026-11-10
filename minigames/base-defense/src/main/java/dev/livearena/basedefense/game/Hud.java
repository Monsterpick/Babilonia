package dev.livearena.basedefense.game;

import dev.livearena.basedefense.BaseDefense;
import dev.livearena.basedefense.hud.HudFont;
import dev.livearena.basedefense.mob.GameMob;
import dev.livearena.basedefense.util.Txt;
import dev.livearena.basedefense.weapon.Weapons;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextColor;
import net.kyori.adventure.title.Title;
import net.kyori.adventure.title.TitlePart;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

/**
 * HUD del juego. Con el pack puesto todo se dibuja con fuentes propias y la pantalla queda limpia:
 * <ul>
 *   <li>abajo (barra de acción): panel de estado sobre la hotbar, munición de cada arma y avisos cortos;</li>
 *   <li>arriba (título de una única BossBar con las barras nativas invisibles): metas, jefes y carteles;</li>
 *   <li>centro (título): marcador de impacto.</li>
 * </ul>
 * Sin el pack (si el jugador lo rechaza) se usa una versión de texto simple: una BossBar con la vida de la base,
 * las de los jefes, la munición en la barra de acción y los carteles como títulos.
 */
public final class Hud {
    private static final TextColor AMBER = TextColor.color(0xF2B632);
    private static final TextColor GREY = TextColor.color(0xA8A8B0);
    private static final TextColor DIM = TextColor.color(0x6E6E78);
    private static final TextColor GOOD = TextColor.color(0x5ADC5A);
    private static final TextColor MID = TextColor.color(0xF0C83C);
    private static final TextColor BAD = TextColor.color(0xE63C32);
    private static final TextColor PINK = TextColor.color(0xFF5CAA);
    private static final TextColor BOSS = TextColor.color(0xB45AFF);

    private final BaseDefense plugin;
    private final HudFont font;
    private final BossBar top;                         // HUD de arriba (con pack)
    private final BossBar plainBase;                   // sin pack
    private final ArrayDeque<Note> notes = new ArrayDeque<>();
    private final Map<UUID, Long> lastHit = new HashMap<>();
    private Banner banner;
    private boolean shown;
    private long lowHpBlink;

    private record Note(String icon, String text, TextColor color, long until) {}

    private record Banner(String title, String sub, TextColor color, long until, long born) {}

    public Hud(BaseDefense plugin) {
        this.plugin = plugin;
        this.font = new HudFont(plugin.getResource("hud.json"));
        if (!font.ok()) plugin.getLogger().warning("hud.json no se pudo leer: el HUD usará la versión de texto");
        top = BossBar.bossBar(Component.empty(), 0f, BossBar.Color.WHITE, BossBar.Overlay.PROGRESS);
        plainBase = BossBar.bossBar(Component.empty(), 1f, BossBar.Color.GREEN, BossBar.Overlay.NOTCHED_20);
    }

    public HudFont fonts() {
        return font;
    }

    private boolean fancy(Player p) {
        return font.ok() && plugin.pack.loaded(p);
    }

    // ───────────────────────────── mostrar / ocultar ─────────────────────────────

    public void show() {
        shown = true;
        notes.clear();
        banner = null;
        for (Player p : plugin.game.viewers()) attach(p);
        render();
    }

    public void hide() {
        shown = false;
        for (Player p : Bukkit.getOnlinePlayers()) detach(p);
    }

    public void refresh() {
        if (shown) render();
    }

    /** Recoloca las barras (al cargar el pack, al aparecer o morir un jefe). */
    public void relayout() {
        if (!shown) return;
        for (Player p : plugin.game.viewers()) attach(p);
    }

    public void attach(Player p) {
        p.hideBossBar(top);
        p.hideBossBar(plainBase);
        plugin.bosses.hideBars(p);
        if (fancy(p)) p.showBossBar(top);
        else {
            p.showBossBar(plainBase);
            plugin.bosses.showBars(p);
        }
    }

    public void detach(Player p) {
        p.hideBossBar(top);
        p.hideBossBar(plainBase);
        plugin.bosses.hideBars(p);
        p.sendActionBar(Component.empty());
    }

    // ───────────────────────────── eventos ─────────────────────────────

    /** Aviso corto abajo (se ven como mucho dos a la vez). icon: skull, crate, warn, bolt, gift, bullet, cross, base, like, trophy. */
    public void notify(String icon, String text, TextColor color) {
        if (!shown) return;
        long now = plugin.tick();
        notes.removeIf(n -> n.text.equals(text) || (icon.equals("bullet") && n.icon.equals("bullet")));
        notes.addLast(new Note(icon, text, color, now + (icon.equals("bullet") ? 30 : 70)));
        while (notes.size() > 2) notes.pollFirst();
        for (Player p : plugin.game.viewers()) if (!fancy(p)) p.sendActionBar(Component.text(text, color));
    }

    /** Cartel grande arriba. Las plantillas de la config llevan códigos &: el primer color decide el del cartel. */
    public void banner(String title, String sub, Object... kv) {
        if (!shown) return;
        String t = Txt.plain(strip(title), kv).trim();
        String s = Txt.plain(strip(sub), kv).trim();
        if (t.isEmpty()) {
            t = s;
            s = "";
        }
        TextColor c = firstColor(title);
        long now = plugin.tick();
        banner = new Banner(t, s, c, now + 56, now);
        Title plain = Title.title(Txt.fmt(title, kv), Txt.fmt(sub, kv), Title.Times.times(Duration.ofMillis(150), Duration.ofMillis(2200), Duration.ofMillis(500)));
        for (Player p : plugin.game.viewers()) {
            if (fancy(p)) update(p);
            else p.showTitle(plain);
        }
    }

    /** Marcador de impacto en la mira (blanco; rojo si es a la cabeza; dorado si mata). */
    public void hit(Player p, boolean head, boolean kill) {
        if (!fancy(p)) return;
        long now = plugin.tick();
        Long prev = lastHit.put(p.getUniqueId(), now);
        if (prev != null && prev == now) return;
        TextColor c = kill ? AMBER : head ? BAD : NamedTextColor.WHITE;
        HudFont.Line l = font.line();
        // fuente con unidades de 4 px (el título se dibuja ×4): el glifo de 16 px queda centrado en la mira
        l.at("basedefense:ti_hit", -2).put("basedefense:ti_hit", -2, font.g("hit"), c);
        p.sendTitlePart(TitlePart.TIMES, Title.Times.times(Duration.ZERO, Duration.ofMillis(kill ? 160 : 90), Duration.ofMillis(120)));
        p.sendTitlePart(TitlePart.TITLE, l.build());
    }

    // ───────────────────────────── refresco ─────────────────────────────

    private boolean dirty;

    /** Pide redibujar (se hace en el siguiente tick, una sola vez aunque se pida muchas). */
    public void update() {
        dirty = true;
    }

    /** Cada tick desde Game: redibuja cada 2 ticks o si algo cambió. */
    public void tick() {
        if (!shown) return;
        if (dirty || plugin.tick() % 2 == 0) render();
        dirty = false;
    }

    private void render() {
        long now = plugin.tick();
        for (Iterator<Note> it = notes.iterator(); it.hasNext(); ) if (it.next().until < now) it.remove();
        if (banner != null && banner.until < now) banner = null;
        Component topTitle = font.ok() ? topLine(now) : Component.empty();
        top.name(topTitle);
        updatePlain();
        for (Player p : plugin.game.viewers()) {
            if (fancy(p)) p.sendActionBar(bottomLine(p, now));
            else p.sendActionBar(plainAmmo(p));
        }
    }

    private void update(Player p) {
        top.name(topLine(plugin.tick()));
    }

    // ── abajo: panel de estado, munición y avisos ──

    private Component bottomLine(Player p, long now) {
        Game g = plugin.game;
        HudFont.Line l = font.line();
        // panel
        l.put("basedefense:ab_panel", -91, font.g("p_status"), NamedTextColor.WHITE);
        // fila 1: vida de la base
        double frac = Math.max(0, Math.min(1, g.baseHp() / Math.max(1, g.baseMax())));
        boolean low = frac < 0.25;
        boolean blinkOff = low && (now / 6) % 2 == 0;
        TextColor hpc = frac > 0.6 ? GOOD : frac > 0.3 ? MID : BAD;
        l.put("basedefense:ab_r1", -88, font.g("i_base"), blinkOff ? DIM : NamedTextColor.WHITE);
        l.put("basedefense:ab_r1", -77, font.step("b_base", frac), blinkOff ? TextColor.color(0x7A1E18) : hpc);
        l.center("basedefense:ab_r1", 66, String.valueOf((int) Math.ceil(Math.max(0, g.baseHp()))), low ? BAD : NamedTextColor.WHITE, -1);
        // fila 2: bajas · tiempo · fase · victorias
        l.put("basedefense:ab_r2", -88, font.g("i_skull"), NamedTextColor.WHITE);
        l.put("basedefense:ab_r2", -77, String.valueOf(plugin.mobs.kills), NamedTextColor.WHITE, -1);
        l.put("basedefense:ab_r2", -41, font.g("i_clock"), NamedTextColor.WHITE);
        String time = g.paused() ? "PAUSA" : Txt.time(g.secondsLeft());
        l.put("basedefense:ab_r2", -30, time, g.secondsLeft() <= 10 && !g.paused() ? BAD : NamedTextColor.WHITE, -1);
        l.put("basedefense:ab_r2", 9, font.g("i_flag"), NamedTextColor.WHITE);
        l.put("basedefense:ab_r2", 20, plugin.waves.phase() + "/" + plugin.settings.phases, AMBER, -1);
        l.put("basedefense:ab_r2", 53, font.g("i_trophy"), NamedTextColor.WHITE);
        int v = g.victories();
        l.put("basedefense:ab_r2", 64, (v > 0 ? "+" : "") + v, v < 0 ? BAD : v > 0 ? GOOD : NamedTextColor.WHITE, -1);

        // munición de cada hueco + lectura grande del arma en mano
        List<Weapons.Slot> slots = plugin.weapons.slots(p);
        int held = p.getInventory().getHeldItemSlot();
        for (Weapons.Slot s : slots) {
            int i = s.def().slot();
            if (i < 0 || i > 5) continue;
            String n = s.infinite() ? "∞" : String.valueOf(s.ammo());
            TextColor c = s.reloading() >= 0 ? DIM : s.ammo() == 0 ? BAD : s.ammo() <= Math.max(1, s.def().magazine() / 5) ? MID : NamedTextColor.WHITE;
            l.right("basedefense:ab_slot", -72 + 20 * i, n, c, -2);
            if (i == held) ammoReadout(l, s, now);
        }

        // avisos (el más reciente abajo)
        List<Note> ns = new ArrayList<>(notes);
        for (int k = 0; k < ns.size(); k++) {
            Note n = ns.get(ns.size() - 1 - k);
            note(l, k == 0 ? "basedefense:ab_n1" : "basedefense:ab_n2", n);
        }
        return l.build();
    }

    private void ammoReadout(HudFont.Line l, Weapons.Slot s, long now) {
        if (s.reloading() >= 0) {
            l.right("basedefense:ab_amm_label", 88, "RECARGA", MID, -1);
            l.put("basedefense:ab_amm_label", 34, font.step("b_reload", s.reloading()), MID);
            l.put("basedefense:ab_amm_big", 34, String.valueOf(s.ammo()), DIM, 1);
            return;
        }
        if (s.warming() >= 0) {
            l.right("basedefense:ab_amm_label", 88, "GIRANDO", BOSS, -1);
            l.put("basedefense:ab_amm_label", 34, font.step("b_reload", s.warming()), BOSS);
            return;
        }
        if (!s.infinite() && s.ammo() == 0 && s.reserve() == 0) {
            boolean on = (now / 8) % 2 == 0;
            l.right("basedefense:ab_amm_label", 88, "SIN BALAS", on ? BAD : DIM, -1);
            l.right("basedefense:ab_amm_small", 88, "BUSCA CAJAS", GREY, -1);
            return;
        }
        double boost = plugin.weapons.boostLeft(plugin.game.streamer());
        if (boost > 0) l.right("basedefense:ab_amm_label", 88, "X2 " + (int) Math.ceil(boost), (now / 4) % 2 == 0 ? AMBER : MID, -1);
        TextColor c = s.ammo() <= Math.max(1, s.def().magazine() / 5) ? BAD : NamedTextColor.WHITE;
        l.put("basedefense:ab_amm_big", 34, String.valueOf(s.ammo()), c, 1);
        l.right("basedefense:ab_amm_small", 88, s.infinite() ? "∞" : String.valueOf(s.reserve()), GREY, -1);
    }

    private void note(HudFont.Line l, String f, Note n) {
        String text = font.clean(f, n.text);
        int tw = font.width(f, text, 0);
        int inner = tw + 12;
        int w = HudFont.Line.plateWidth(inner + 6);
        int x0 = -w / 2;
        l.plate(f, "pill", x0, w);
        l.put(f, x0 + 4, font.g("i_" + n.icon), NamedTextColor.WHITE);
        l.put(f, x0 + 4 + 12 + (w - 8 - inner) / 2, text, n.color);
    }

    // ── arriba: metas, jefes y carteles ──

    private Component topLine(long now) {
        HudFont.Line l = font.line();
        String f = "basedefense:bb_strip";
        l.put(f, -91, font.g("p_strip"), NamedTextColor.WHITE);
        // meta de bajas → cofre
        Loot loot = plugin.loot;
        l.put(f, -88, font.g("i_skull"), NamedTextColor.WHITE);
        l.put(f, -77, loot.goalKills() + "/" + loot.goalTarget(), AMBER, -1);
        l.put(f, -42, font.step("b_mini", loot.goalKills() / (double) Math.max(1, loot.goalTarget())), AMBER);
        // meta de likes → jefe
        LikeGoal lg = plugin.likes();
        l.put(f, 2, font.g("i_like"), NamedTextColor.WHITE);
        l.put(f, 13, compact(lg.total()), PINK, -1);
        l.put(f, 49, font.step("b_mini", lg.progress()), PINK);

        // placas de jefes (hasta 2)
        List<GameMob> bs = new ArrayList<>(plugin.bosses.all());
        for (int i = 0; i < Math.min(2, bs.size()); i++) {
            GameMob gm = bs.get(i);
            String bf = "basedefense:bb_boss" + i;
            double fr = Math.max(0, Math.min(1, gm.hp / gm.maxHp));
            l.put(bf, -103, font.g("p_boss"), NamedTextColor.WHITE);
            l.put(bf, -100, font.g("boss_" + bossKind(gm)), NamedTextColor.WHITE);
            String name = font.clean(bf, gm.boss.name() + (gm.donor == null || gm.donor.isBlank() ? "" : " · " + gm.donor));
            String hpTxt = (int) Math.ceil(gm.hp) + (gm.furious ? " FURIA" : "");
            int room = 172 - font.width(bf, hpTxt, -1) - 6;
            while (name.length() > 4 && font.width(bf, name, -1) > room) name = name.substring(0, name.length() - 2) + ".";
            l.put(bf, -79, name, gm.furious ? BAD : NamedTextColor.WHITE, -1);
            l.right(bf, 99, (int) Math.ceil(gm.hp) + (gm.furious ? " FURIA" : ""), gm.furious ? BAD : GREY, -1);
            l.put(bf, -79, font.step("b_boss", fr), gm.furious ? ((now / 5) % 2 == 0 ? BAD : TextColor.color(0xFF8A40)) : BOSS);
        }
        if (bs.size() > 2) l.right("basedefense:bb_boss1", 99, "+" + (bs.size() - 2), BAD, -1);

        // cartel
        if (banner != null) {
            String bt = font.clean("basedefense:bb_ban", banner.title);
            String bs2 = font.clean("basedefense:bb_bansub", banner.sub);
            int tw = font.width("basedefense:bb_ban", bt, 1);
            int sw = font.width("basedefense:bb_bansub", bs2, -1);
            int w = HudFont.Line.plateWidth(Math.max(tw, sw) + 20);
            // aparece abriéndose: los primeros ticks la placa crece
            long age = now - banner.born;
            if (age < 3) w = HudFont.Line.plateWidth((int) (w * (0.5 + age / 6.0)));
            l.plate("basedefense:bb_ban", "ban", -w / 2, w);
            if (age >= 2) {
                l.center("basedefense:bb_ban", 0, bt, banner.color, 1);
                if (!bs2.isBlank()) l.center("basedefense:bb_bansub", 0, bs2, NamedTextColor.WHITE, -1);
            }
        }
        return l.build();
    }

    private static String bossKind(GameMob gm) {
        return switch (gm.boss.entity().name()) {
            case "WITHER" -> "wither";
            case "ENDER_DRAGON" -> "dragon";
            default -> "warden";
        };
    }

    private static String compact(long n) {
        if (n >= 1_000_000) return String.format("%.1fM", n / 1e6).replace(".0M", "M");
        if (n >= 10_000) return (n / 1000) + "K";
        if (n >= 1000) return String.format("%.1fK", n / 1e3).replace(".0K", "K");
        return String.valueOf(n);
    }

    // ───────────────────────── versión de texto (sin pack) ─────────────────────────

    private void updatePlain() {
        Game g = plugin.game;
        double hp = Math.max(0, g.baseHp());
        float frac = (float) Math.max(0, Math.min(1, hp / Math.max(1, g.baseMax())));
        String time = g.paused() ? "PAUSA" : Txt.time(g.secondsLeft());
        plainBase.name(Txt.fmt("&c&lBASE &f{vida}&7/{max} &8· &6FASE {fase} &8· &f{tiempo} &8· &7bajas &f{bajas}",
            "vida", (int) Math.ceil(hp), "max", g.baseMax(), "fase", plugin.waves.phase(), "tiempo", time, "bajas", plugin.mobs.kills));
        plainBase.progress(frac);
        plainBase.color(frac > 0.6 ? BossBar.Color.GREEN : frac > 0.3 ? BossBar.Color.YELLOW : BossBar.Color.RED);
    }

    private Component plainAmmo(Player p) {
        int held = p.getInventory().getHeldItemSlot();
        for (Weapons.Slot s : plugin.weapons.slots(p)) {
            if (s.def().slot() != held) continue;
            if (s.reloading() >= 0) return Txt.fmt(s.def().name() + " &8| &eRECARGANDO");
            if (!s.infinite() && s.ammo() == 0 && s.reserve() == 0) return Txt.fmt(s.def().name() + " &8| &c&lSIN MUNICIÓN");
            return Txt.fmt(s.def().name() + " &8| &f" + s.ammo() + "&7/" + s.def().magazine() + " &8· &7reserva &f" + (s.infinite() ? "∞" : s.reserve()));
        }
        return Component.empty();
    }

    // ───────────────────────────── utilidades ─────────────────────────────

    private static String strip(String s) {
        return s == null ? "" : s.replaceAll("&[0-9a-fk-orA-FK-OR]", "").replaceAll("&#[0-9a-fA-F]{6}", "");
    }

    private static TextColor firstColor(String s) {
        if (s != null) for (int i = 0; i + 1 < s.length(); i++) {
            if (s.charAt(i) != '&') continue;
            char c = Character.toLowerCase(s.charAt(i + 1));
            TextColor t = switch (c) {
                case '4', 'c' -> BAD;
                case '6', 'e' -> AMBER;
                case '2', 'a' -> GOOD;
                case '5', 'd' -> BOSS;
                case '3', 'b' -> TextColor.color(0x5AE6F0);
                case 'f', '7' -> NamedTextColor.WHITE;
                default -> null;
            };
            if (t != null) return t;
        }
        return AMBER;
    }
}
