package dev.livearena.plugin;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabExecutor;
import org.bukkit.entity.Player;

/**
 * /la totem add <jugador> [cantidad] [espectador…]
 * /la totem remove <jugador> [cantidad] [espectador…]
 * /la totem set <jugador> <cantidad>
 * /la totem get <jugador>          → responde «TOTEMS <jugador> <n>» (lo lee LiveArena por RCON)
 * /la efecto <nombre> <jugador> [espectador] [parámetros]   (lista: /la efectos; /la limpiar quita los mobs)
 * /la reload | /la version
 */
final class LaCommand implements TabExecutor {
    private final LiveArenaPlugin plugin;
    private final TotemManager totems;
    private final Effects effects;
    private final Goals goals;

    LaCommand(LiveArenaPlugin plugin, TotemManager totems, Effects effects, Goals goals) {
        this.plugin = plugin;
        this.totems = totems;
        this.effects = effects;
        this.goals = goals;
    }

    private static void reply(CommandSender s, String text, NamedTextColor color) {
        s.sendMessage(Component.text(text, color));
    }

    private static int parseInt(String s, int def) {
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return def;
        }
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) {
            reply(sender, "LiveArena " + plugin.getPluginMeta().getVersion() + " — /la totem <add|remove|set|get> <jugador> [cantidad] [espectador]", NamedTextColor.GOLD);
            return true;
        }
        String sub = args[0].toLowerCase(Locale.ROOT);
        switch (sub) {
            case "version" -> reply(sender, "LiveArena " + plugin.getPluginMeta().getVersion(), NamedTextColor.GOLD);
            case "reload" -> {
                plugin.reload();
                reply(sender, "LiveArena: configuración recargada.", NamedTextColor.GREEN);
            }
            case "totem", "totems", "tótem", "tótems" -> totem(sender, Arrays.copyOfRange(args, 1, args.length));
            case "efecto", "e" -> effect(sender, Arrays.copyOfRange(args, 1, args.length));
            case "efectos" -> {
                for (Effects.Def d : effects.all().values())
                    sender.sendMessage(Component.text(d.id(), d.color()).append(Component.text(" — " + d.nombre() + ": " + d.ayuda(), NamedTextColor.GRAY)));
            }
            case "limpiar" -> reply(sender, "LiveArena: quitados " + effects.clear() + " mobs de efectos.", NamedTextColor.GREEN);
            case "reto", "goal" -> reto(sender, Arrays.copyOfRange(args, 1, args.length));
            default -> reply(sender, "Subcomando desconocido: " + sub, NamedTextColor.RED);
        }
        return true;
    }

    /** /la efecto <nombre> <jugador> [espectador|-] [parámetros…] */
    private void effect(CommandSender sender, String[] a) {
        if (a.length < 2) {
            reply(sender, "Uso: /la efecto <nombre> <jugador> [espectador] [parámetros] — lista: /la efectos", NamedTextColor.YELLOW);
            return;
        }
        String id = a[0].toLowerCase(Locale.ROOT);
        Player p = Bukkit.getPlayerExact(a[1]);
        if (p == null) {
            reply(sender, "EFECTO " + id + " jugador " + a[1] + " no está conectado", NamedTextColor.RED);
            return;
        }
        String viewer = a.length >= 3 && !a[2].equals("-") && !a[2].equalsIgnoreCase("null") ? a[2].replace('_', ' ') : "";
        String[] params = a.length > 3 ? Arrays.copyOfRange(a, 3, a.length) : new String[0];
        if (!effects.run(id, p, viewer, params)) {
            reply(sender, "Efecto desconocido: " + id + " (mira /la efectos)", NamedTextColor.RED);
            return;
        }
        reply(sender, "EFECTO " + id + " OK", NamedTextColor.GREEN);
    }

    /** /la reto crear|meta|sumarmeta|quitarmeta|sumar|quitar|poner|recurso|mineral|pico|ganar|perder|fin|estado */
    private void reto(CommandSender sender, String[] a) {
        if (a.length == 0) {
            reply(sender, "Uso: /la reto <crear|meta|sumar|quitar|mineral|pico|ganar|perder|fin|estado> …", NamedTextColor.YELLOW);
            return;
        }
        String op = a[0].toLowerCase(Locale.ROOT);
        int n = a.length >= 2 ? parseInt(a[1], 1) : 1;
        Player any = Bukkit.getOnlinePlayers().stream().findFirst().orElse(null);
        switch (op) {
            case "crear", "create", "start" -> goals.start(a.length >= 2 ? Math.max(1, n) : 10);
            case "meta", "goal" -> goals.setGoal(n);
            case "sumarmeta", "addgoal" -> goals.addGoal(n);
            case "quitarmeta", "removegoal" -> goals.addGoal(-n);
            case "sumar", "add" -> goals.addProgress(n);
            case "quitar", "remove" -> goals.addProgress(-n);
            case "poner", "set" -> goals.setProgress(n);
            case "recurso", "resource" -> goals.setResource(a.length >= 2 ? a[1] : "diamante");
            case "mineral", "ore" -> {
                if (any != null) goals.oreWave(any, a.length >= 2 ? Math.max(0, n) : 0);
            }
            case "pico", "pickaxe" -> {
                if (any != null) goals.pickaxe(any, a.length >= 2 ? Math.max(1, n) : 30);
            }
            case "ganar", "win" -> goals.win();
            case "perder", "lose" -> goals.lose();
            case "fin", "stop", "delete" -> goals.stop();
            case "estado", "status" -> {}
            default -> reply(sender, "Opción de reto desconocida: " + op, NamedTextColor.RED);
        }
        reply(sender, "RETO " + goals.progress() + " " + goals.goal() + " " + (goals.active() ? "activo" : "parado"), NamedTextColor.GREEN);
    }

    private void totem(CommandSender sender, String[] a) {
        if (a.length < 2) {
            reply(sender, "Uso: /la totem <add|remove|set|get> <jugador> [cantidad] [espectador]", NamedTextColor.YELLOW);
            return;
        }
        String op = a[0].toLowerCase(Locale.ROOT);
        if (a[1].equals("@a")) {
            // Para todos los jugadores conectados (lo usa el kit con «para todos»).
            for (Player p : Bukkit.getOnlinePlayers()) {
                String[] copy = a.clone();
                copy[1] = p.getName();
                totem(sender, copy);
            }
            return;
        }
        String name = a[1];
        Player online = Bukkit.getPlayerExact(name);
        if (online != null) name = online.getName();
        int amount = a.length >= 3 ? parseInt(a[2], -1) : 1;
        String viewer = a.length >= 4 ? String.join(" ", Arrays.copyOfRange(a, 3, a.length)) : "";
        switch (op) {
            case "add", "dar", "sumar" -> {
                if (amount < 1) {
                    reply(sender, "La cantidad tiene que ser 1 o más.", NamedTextColor.RED);
                    return;
                }
                int applied = totems.add(name, Math.min(amount, 100_000));
                if (applied <= 0) {
                    if (online != null) online.sendMessage(Text.render(totems.msg("maximo"), totems.vars(name, 0, viewer)));
                    reply(sender, "TOTEMS " + name + " " + totems.get(name) + " (máximo)", NamedTextColor.YELLOW);
                    return;
                }
                if (online != null) totems.announceGiven(online, applied, viewer);
                reply(sender, "TOTEMS " + name + " " + totems.get(name), NamedTextColor.GREEN);
            }
            case "remove", "quitar", "restar" -> {
                if (amount < 1) amount = 1;
                int applied = -totems.add(name, -amount);
                if (online != null && applied > 0) totems.announceRemoved(online, applied, viewer);
                reply(sender, "TOTEMS " + name + " " + totems.get(name), NamedTextColor.GREEN);
            }
            case "set", "poner" -> {
                if (amount < 0) {
                    reply(sender, "Uso: /la totem set <jugador> <cantidad>", NamedTextColor.RED);
                    return;
                }
                totems.set(name, amount);
                reply(sender, "TOTEMS " + name + " " + totems.get(name), NamedTextColor.GREEN);
            }
            case "get", "ver" -> reply(sender, "TOTEMS " + name + " " + totems.get(name), NamedTextColor.GOLD);
            default -> reply(sender, "Opción desconocida: " + op + " (add, remove, set, get)", NamedTextColor.RED);
        }
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        List<String> out = new ArrayList<>();
        if (args.length == 1) out.addAll(List.of("totem", "efecto", "efectos", "reto", "limpiar", "reload", "version"));
        else if (args.length == 2 && args[0].equalsIgnoreCase("reto")) out.addAll(List.of("crear", "meta", "sumar", "quitar", "mineral", "pico", "ganar", "perder", "fin"));
        else if (args.length == 2 && args[0].equalsIgnoreCase("efecto")) out.addAll(effects.all().keySet());
        else if (args.length == 3 && args[0].equalsIgnoreCase("efecto")) for (Player p : Bukkit.getOnlinePlayers()) out.add(p.getName());
        else if (args.length == 2 && args[0].toLowerCase(Locale.ROOT).startsWith("tot")) out.addAll(List.of("add", "remove", "set", "get"));
        else if (args.length == 3 && args[0].toLowerCase(Locale.ROOT).startsWith("tot")) for (Player p : Bukkit.getOnlinePlayers()) out.add(p.getName());
        else if (args.length == 4) out.addAll(List.of("1", "5", "10"));
        String last = args[args.length - 1].toLowerCase(Locale.ROOT);
        out.removeIf(s -> !s.toLowerCase(Locale.ROOT).startsWith(last));
        return out;
    }
}
