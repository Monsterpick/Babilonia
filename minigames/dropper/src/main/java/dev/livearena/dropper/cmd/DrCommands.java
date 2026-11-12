package dev.livearena.dropper.cmd;

import com.mojang.brigadier.Command;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.builder.LiteralArgumentBuilder;
import com.mojang.brigadier.builder.RequiredArgumentBuilder;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.suggestion.SuggestionProvider;
import dev.livearena.dropper.DropperLive;
import dev.livearena.dropper.game.Effects;
import dev.livearena.dropper.game.Game;
import dev.livearena.dropper.map.Themes;
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
 * /dr (streamer y app) y /ttdr (regalos desde la app). Responden siempre con una línea
 * "[Dropper] OK …" o "[Dropper] ERROR …" fácil de leer por una app.
 */
@SuppressWarnings("UnstableApiUsage")
public final class DrCommands {
    private final DropperLive plugin;

    public DrCommands(DropperLive plugin) {
        this.plugin = plugin;
    }

    public void register(Commands c) {
        c.register(dr().build(), "Dropper LIVE: partida, mapa y pruebas", List.of("dropper"));
        c.register(ttdr().build(), "Efecto de un espectador en el dropper (app de TikTok)");
    }

    private static boolean app(CommandSourceStack s) {
        CommandSender who = s.getSender();
        return !(who instanceof Player) || who.hasPermission("dropperlive.tiktok");
    }

    private static boolean admin(CommandSourceStack s) {
        CommandSender who = s.getSender();
        return !(who instanceof Player) || who.hasPermission("dropperlive.admin");
    }

    private static int ok(CommandContext<CommandSourceStack> ctx, String msg) {
        ctx.getSource().getSender().sendMessage(Component.text("[Dropper] OK " + msg, NamedTextColor.GREEN));
        return Command.SINGLE_SUCCESS;
    }

    private static int err(CommandContext<CommandSourceStack> ctx, String msg) {
        ctx.getSource().getSender().sendMessage(Component.text("[Dropper] ERROR " + msg, NamedTextColor.RED));
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

    // ───────────────────────────── /ttdr ─────────────────────────────

    private LiteralArgumentBuilder<CommandSourceStack> ttdr() {
        String usage = "uso: ttdr <" + String.join("|", Effects.ALL) + "> [n] <usuario>";
        return Commands.literal("ttdr").requires(DrCommands::app)
            .executes(ctx -> err(ctx, usage))
            .then(word("efecto").suggests(suggest(() -> Effects.ALL))
                .executes(ctx -> effect(ctx, arg(ctx, "efecto"), ""))
                .then(rest("resto").executes(ctx -> effect(ctx, arg(ctx, "efecto"), arg(ctx, "resto")))));
    }

    private int effect(CommandContext<CommandSourceStack> ctx, String type, String rest) {
        if (!plugin.game.running()) return err(ctx, "la partida no está iniciada (/dr start)");
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

    // ───────────────────────────── /dr ─────────────────────────────

    private LiteralArgumentBuilder<CommandSourceStack> dr() {
        return Commands.literal("dr").requires(DrCommands::admin)
            .executes(ctx -> {
                ctx.getSource().getSender().sendMessage(Component.text(
                    "Dropper LIVE · /dr start [jugador] | stop | status | reload | nivel <n> | mapa nuevo [semilla] | marcador reiniciar | test <efecto> [n]",
                    NamedTextColor.AQUA));
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
                var s = plugin.builder.shaft(n);
                StringJoiner sj = new StringJoiner(" ");
                for (int i = 0; i < s.layers().size(); i++) {
                    double[] h = s.holes().get(i);
                    sj.add(s.layers().get(i) + ":" + String.format(Locale.ROOT, "%.2f,%.2f", h[0], h[1]));
                }
                ctx.getSource().getSender().sendMessage(Component.text("DRINFO lv=" + n + " x0=" + s.x0() + " z0=" + s.z0() + " top=" + s.topY() + " water=" + s.waterY()
                    + " patterns=" + s.pattern() + " layers=" + sj));
                return Command.SINGLE_SUCCESS;
            })))
            .then(Commands.literal("reload").executes(ctx -> {
                plugin.reload();
                return ok(ctx, "configuración recargada");
            }))
            .then(Commands.literal("nivel").then(word("n").executes(ctx -> {
                if (!plugin.game.running()) return err(ctx, "la partida no está iniciada");
                int n = parse(arg(ctx, "n"), -1);
                if (n < 1 || n > plugin.settings.levels + 1) return err(ctx, "nivel entre 1 y " + (plugin.settings.levels + 1));
                plugin.game.setCheckpoint(n, true);
                return ok(ctx, "nivel " + n);
            })))
            .then(Commands.literal("mapa").then(Commands.literal("nuevo")
                .executes(ctx -> newMap(ctx, null))
                .then(word("semilla").executes(ctx -> newMap(ctx, arg(ctx, "semilla"))))))
            .then(Commands.literal("marcador").then(Commands.literal("reiniciar").executes(ctx -> {
                plugin.game.resetScore();
                plugin.hud.update();
                return ok(ctx, "marcador a 0-0");
            })))
            .then(Commands.literal("test").then(word("efecto").suggests(suggest(() -> {
                    List<String> l = new ArrayList<>(Effects.ALL);
                    l.addAll(List.of("ganar", "perder", "chocar", "agua"));
                    return l;
                }))
                .executes(ctx -> test(ctx, arg(ctx, "efecto"), 1))
                .then(word("n").executes(ctx -> test(ctx, arg(ctx, "efecto"), parse(arg(ctx, "n"), 1))))));
    }

    private int start(CommandContext<CommandSourceStack> ctx, String name) {
        Player p = target(name);
        if (p == null) return err(ctx, name == null ? "indica el jugador: /dr start <jugador>" : "jugador '" + name + "' no conectado");
        return ok(ctx, plugin.game.start(p));
    }

    private int newMap(CommandContext<CommandSourceStack> ctx, String seed) {
        if (plugin.game.running()) return err(ctx, "para la partida antes de crear un mapa nuevo (/dr stop)");
        long s;
        if (seed != null) {
            try {
                s = Long.parseLong(seed);
            } catch (NumberFormatException e) {
                s = seed.hashCode();
            }
        } else s = System.currentTimeMillis() % 100000;
        plugin.getConfig().set("mapa.semilla", s);
        plugin.saveConfig();
        plugin.reload();
        return ok(ctx, "mapa nuevo (semilla " + plugin.settings.seed + ")");
    }

    private int test(CommandContext<CommandSourceStack> ctx, String type, int n) {
        Game g = plugin.game;
        if (!g.running()) return err(ctx, "la partida no está iniciada (/dr start)");
        Player p = g.player();
        switch (type.toLowerCase(Locale.ROOT)) {
            case "ganar" -> g.setCheckpoint(plugin.settings.levels + 1, true);
            case "perder" -> {
                if (p != null) g.lose(p, "PARTIDA PERDIDA");
            }
            case "chocar" -> {
                if (p != null) {
                    var s = plugin.builder.shaft(g.checkpoint());
                    p.teleport(new org.bukkit.Location(p.getWorld(), s.x0() + 0.5, s.layers().getFirst() + 1.0, s.z0() + 0.5));
                }
            }
            case "agua" -> {
                if (p != null) {
                    var s = plugin.builder.shaft(g.checkpoint());
                    p.teleport(new org.bukkit.Location(p.getWorld(), s.cx(), s.waterY() + 1.2, s.cz()));
                }
            }
            default -> {
                if (!plugin.effects.add(type, n, "Prueba")) return err(ctx, "efecto desconocido '" + type + "'");
            }
        }
        return ok(ctx, "prueba: " + type);
    }

    private int status(CommandContext<CommandSourceStack> ctx) {
        Game g = plugin.game;
        int levels = plugin.settings.levels;
        StringJoiner colors = new StringJoiner(",");
        for (int lv = 1; lv <= levels; lv++) colors.add(Themes.of(lv).hex());
        Player p = g.player();
        int lv = Math.min(g.checkpoint(), levels);
        String line = "DRSTATUS running=" + (g.running() ? 1 : 0)
            + " built=" + plugin.builder.builtCount()
            + " building=" + (plugin.builder.building() ? 1 : 0)
            + " level=" + g.checkpoint()
            + " levels=" + levels
            + " progress=" + String.format(Locale.ROOT, "%.3f", g.totalProgress())
            + " levelProgress=" + String.format(Locale.ROOT, "%.3f", g.levelProgress())
            + " falls=" + g.falls()
            + " levelFalls=" + g.levelHits()
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
