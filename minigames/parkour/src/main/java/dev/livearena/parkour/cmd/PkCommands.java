package dev.livearena.parkour.cmd;

import com.mojang.brigadier.Command;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.builder.LiteralArgumentBuilder;
import com.mojang.brigadier.builder.RequiredArgumentBuilder;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.suggestion.SuggestionProvider;
import dev.livearena.parkour.ParkourLive;
import dev.livearena.parkour.game.Effects;
import dev.livearena.parkour.game.Game;
import dev.livearena.parkour.tower.Themes;
import io.papermc.paper.command.brigadier.CommandSourceStack;
import io.papermc.paper.command.brigadier.Commands;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.StringJoiner;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.World;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

/**
 * /pk (streamer y app) y /ttpk (regalos desde la app). Responden siempre con una línea
 * "[Parkour] OK …" o "[Parkour] ERROR …" fácil de leer por una app.
 */
@SuppressWarnings("UnstableApiUsage")
public final class PkCommands {
    private final ParkourLive plugin;

    public PkCommands(ParkourLive plugin) {
        this.plugin = plugin;
    }

    public void register(Commands c) {
        c.register(pk().build(), "Parkour LIVE: partida, torre y pruebas", List.of("parkour"));
        c.register(ttpk().build(), "Efecto de un espectador en el parkour (app de TikTok)");
    }

    private static boolean app(CommandSourceStack s) {
        CommandSender who = s.getSender();
        return !(who instanceof Player) || who.hasPermission("parkourlive.tiktok");
    }

    private static boolean admin(CommandSourceStack s) {
        CommandSender who = s.getSender();
        return !(who instanceof Player) || who.hasPermission("parkourlive.admin");
    }

    private static int ok(CommandContext<CommandSourceStack> ctx, String msg) {
        ctx.getSource().getSender().sendMessage(Component.text("[Parkour] OK " + msg, NamedTextColor.GREEN));
        return Command.SINGLE_SUCCESS;
    }

    private static int err(CommandContext<CommandSourceStack> ctx, String msg) {
        ctx.getSource().getSender().sendMessage(Component.text("[Parkour] ERROR " + msg, NamedTextColor.RED));
        return 0;
    }

    private static String arg(CommandContext<CommandSourceStack> ctx, String name) {
        try {
            return ctx.getArgument(name, String.class);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static RequiredArgumentBuilder<CommandSourceStack, String> word(String name) {
        return Commands.argument(name, StringArgumentType.word());
    }

    private static RequiredArgumentBuilder<CommandSourceStack, String> rest(String name) {
        return Commands.argument(name, StringArgumentType.greedyString());
    }

    private SuggestionProvider<CommandSourceStack> suggest(java.util.function.Supplier<java.util.Collection<String>> values) {
        return (ctx, b) -> {
            String rem = b.getRemainingLowerCase();
            for (String v : values.get()) if (v.toLowerCase(Locale.ROOT).startsWith(rem)) b.suggest(v);
            return b.buildFuture();
        };
    }

    /** Nombre del espectador: sin códigos de color, saltos de línea ni caracteres de control. */
    static String cleanName(String s) {
        if (s == null) return "Alguien";
        String t = s.replaceAll("[§&\\p{Cntrl}]", "").trim();
        if (t.isEmpty()) return "Alguien";
        return t.length() > 24 ? t.substring(0, 24) : t;
    }

    private static int parse(String s, int def) {
        try {
            return Integer.parseInt(s.trim());
        } catch (Exception e) {
            return def;
        }
    }

    private Player target(String name) {
        if (name != null && !name.isBlank()) return Bukkit.getPlayerExact(name);
        Player p = plugin.game.player();
        if (p != null) return p;
        var all = Bukkit.getOnlinePlayers();
        return all.size() == 1 ? all.iterator().next() : null;
    }

    // ───────────────────────────── /ttpk ─────────────────────────────

    private LiteralArgumentBuilder<CommandSourceStack> ttpk() {
        String usage = "uso: ttpk <" + String.join("|", Effects.ALL) + "> [n] <usuario>";
        return Commands.literal("ttpk").requires(PkCommands::app)
            .executes(ctx -> err(ctx, usage))
            .then(word("efecto").suggests(suggest(() -> Effects.ALL))
                .executes(ctx -> effect(ctx, arg(ctx, "efecto"), ""))
                .then(rest("resto").executes(ctx -> effect(ctx, arg(ctx, "efecto"), arg(ctx, "resto")))));
    }

    private int effect(CommandContext<CommandSourceStack> ctx, String type, String rest) {
        if (!plugin.game.running()) return err(ctx, "la partida no está iniciada (/pk start)");
        type = type.toLowerCase(Locale.ROOT);
        if (!Effects.ALL.contains(type)) return err(ctx, "efecto desconocido '" + type + "'. Efectos: " + String.join(", ", Effects.ALL));
        int n = 1;
        String user = rest == null ? "" : rest.trim();
        String[] parts = user.split("\\s+", 2);
        if (parts.length > 0 && parts[0].matches("\\d{1,3}")) {
            n = parse(parts[0], 1);
            user = parts.length > 1 ? parts[1] : "";
        }
        plugin.effects.add(type, n, cleanName(user));
        return ok(ctx, type + (n > 1 ? " ×" + n : "") + " en cola");
    }

    // ───────────────────────────── /pk ─────────────────────────────

    private LiteralArgumentBuilder<CommandSourceStack> pk() {
        return Commands.literal("pk").requires(PkCommands::admin)
            .executes(ctx -> {
                ctx.getSource().getSender().sendMessage(Component.text(
                    "Parkour LIVE · /pk start [jugador] | stop | status | reload | tp | nivel <n> | torre generar [semilla] | marcador reiniciar | test <efecto> [n]",
                    NamedTextColor.GOLD));
                return Command.SINGLE_SUCCESS;
            })
            .then(Commands.literal("start").executes(ctx -> start(ctx, null)).then(word("jugador").executes(ctx -> start(ctx, arg(ctx, "jugador")))))
            .then(Commands.literal("stop").executes(ctx -> {
                if (!plugin.game.running()) return err(ctx, "no hay partida");
                plugin.game.stop(true);
                return ok(ctx, "partida terminada");
            }))
            .then(Commands.literal("status").executes(this::status))
            .then(Commands.literal("info").then(word("n").executes(ctx -> {
                int n = parse(arg(ctx, "n"), 1);
                var pad = plugin.tower.pad(n);
                StringJoiner sj = new StringJoiner(" ");
                for (var st : plugin.tower.steps(n)) sj.add(st.x() + "," + st.y() + "," + st.z() + ":" + st.kind());
                ctx.getSource().getSender().sendMessage(Component.text("PKINFO pad=" + pad.x() + "," + pad.y() + "," + pad.z() + " r=" + pad.radius() + " steps=" + sj));
                return Command.SINGLE_SUCCESS;
            })))
            .then(Commands.literal("reload").executes(ctx -> {
                plugin.reload();
                return ok(ctx, "configuración recargada");
            }))
            .then(Commands.literal("tp").executes(ctx -> tp(ctx, null)).then(word("jugador").executes(ctx -> tp(ctx, arg(ctx, "jugador")))))
            .then(Commands.literal("nivel").then(word("n").executes(ctx -> {
                if (!plugin.game.running()) return err(ctx, "la partida no está iniciada");
                int n = parse(arg(ctx, "n"), -1);
                if (n < 1 || n > plugin.tower.levels + 1) return err(ctx, "nivel entre 1 y " + (plugin.tower.levels + 1));
                plugin.game.setCheckpoint(n, true);
                return ok(ctx, "nivel " + n);
            })))
            .then(Commands.literal("torre").then(Commands.literal("generar")
                .executes(ctx -> generate(ctx, null))
                .then(word("semilla").executes(ctx -> generate(ctx, arg(ctx, "semilla"))))))
            .then(Commands.literal("marcador").then(Commands.literal("reiniciar").executes(ctx -> {
                plugin.game.resetScore();
                plugin.hud.update();
                return ok(ctx, "marcador a 0-0");
            })))
            .then(Commands.literal("test").then(word("efecto").suggests(suggest(() -> {
                    List<String> l = new ArrayList<>(Effects.ALL);
                    l.addAll(List.of("ganar", "perder", "caer"));
                    return l;
                }))
                .executes(ctx -> test(ctx, arg(ctx, "efecto"), 1))
                .then(word("n").executes(ctx -> test(ctx, arg(ctx, "efecto"), parse(arg(ctx, "n"), 1))))));
    }

    private int start(CommandContext<CommandSourceStack> ctx, String name) {
        Player p = target(name);
        if (p == null) return err(ctx, name == null ? "indica el jugador: /pk start <jugador>" : "jugador '" + name + "' no conectado");
        return ok(ctx, plugin.game.start(p));
    }

    private int tp(CommandContext<CommandSourceStack> ctx, String name) {
        Player p = target(name);
        if (p == null) return err(ctx, "jugador no encontrado");
        World w = plugin.world(true);
        int lv = plugin.game.running() ? plugin.game.checkpoint() : 1;
        p.teleport(plugin.tower.pad(lv).spawn(w, plugin.tower.yawAt(lv)));
        return ok(ctx, "teletransportado al nivel " + lv);
    }

    private int generate(CommandContext<CommandSourceStack> ctx, String seed) {
        if (plugin.game.running()) return err(ctx, "para la partida antes de regenerar la torre (/pk stop)");
        if (plugin.builder.building()) return err(ctx, "ya se está construyendo");
        if (seed != null) {
            long s;
            try {
                s = Long.parseLong(seed);
            } catch (NumberFormatException e) {
                s = seed.hashCode();
            }
            plugin.getConfig().set("torre.semilla", s);
            plugin.saveConfig();
            plugin.reloadConfig();
            plugin.settings = new dev.livearena.parkour.Settings(plugin.getConfig());
        }
        plugin.builder.rebuild(null);
        return ok(ctx, "construyendo la torre (semilla " + plugin.settings.seed + ")");
    }

    private int test(CommandContext<CommandSourceStack> ctx, String type, int n) {
        Game g = plugin.game;
        if (!g.running()) return err(ctx, "la partida no está iniciada (/pk start)");
        switch (type.toLowerCase(Locale.ROOT)) {
            case "ganar" -> g.setCheckpoint(plugin.tower.levels + 1, true);
            case "perder" -> {
                Player p = g.player();
                if (p != null) g.lose(p, "PARTIDA PERDIDA");
            }
            case "caer" -> {
                Player p = g.player();
                if (p != null) p.teleport(p.getLocation().add(0, -40, 0));
            }
            default -> {
                if (!plugin.effects.add(type, n, "Prueba")) return err(ctx, "efecto desconocido '" + type + "'");
            }
        }
        return ok(ctx, "prueba: " + type);
    }

    private int status(CommandContext<CommandSourceStack> ctx) {
        Game g = plugin.game;
        var t = plugin.tower;
        StringJoiner colors = new StringJoiner(",");
        for (int lv = 1; lv <= t.levels; lv++) colors.add(Themes.of(lv).hex());
        Player p = g.player();
        int lv = Math.min(g.checkpoint(), t.levels);
        String line = "PKSTATUS running=" + (g.running() ? 1 : 0)
            + " built=" + (plugin.builder.isBuilt() ? 1 : 0)
            + " building=" + (plugin.builder.building() ? 1 : 0)
            + " buildPct=" + Math.round(plugin.builder.progress() * 100)
            + " level=" + g.checkpoint()
            + " levels=" + t.levels
            + " progress=" + String.format(Locale.ROOT, "%.3f", g.totalProgress())
            + " levelProgress=" + String.format(Locale.ROOT, "%.3f", g.levelProgress())
            + " falls=" + g.falls()
            + " time=" + g.seconds()
            + " limit=" + plugin.settings.timeLimitMin * 60
            + " ganadas=" + g.wins()
            + " perdidas=" + g.losses()
            + " queue=" + plugin.effects.queued()
            + " shield=" + (g.shielded() ? 1 : 0)
            + " protected=" + (g.isProtected() ? 1 : 0)
            + " won=" + (g.celebrating() ? 1 : 0)
            + " theme=" + Themes.of(Math.max(1, lv)).name().replace(' ', '_')
            + " color=" + Themes.of(Math.max(1, lv)).hex()
            + " streamer=" + (p != null ? p.getName() : "-")
            + " colors=" + colors;
        ctx.getSource().getSender().sendMessage(Component.text(line));
        return Command.SINGLE_SUCCESS;
    }
}
