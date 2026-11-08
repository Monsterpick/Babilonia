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
 * /la reload | /la version
 */
final class LaCommand implements TabExecutor {
    private final LiveArenaPlugin plugin;
    private final TotemManager totems;

    LaCommand(LiveArenaPlugin plugin, TotemManager totems) {
        this.plugin = plugin;
        this.totems = totems;
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
            default -> reply(sender, "Subcomando desconocido: " + sub, NamedTextColor.RED);
        }
        return true;
    }

    private void totem(CommandSender sender, String[] a) {
        if (a.length < 2) {
            reply(sender, "Uso: /la totem <add|remove|set|get> <jugador> [cantidad] [espectador]", NamedTextColor.YELLOW);
            return;
        }
        String op = a[0].toLowerCase(Locale.ROOT);
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
        if (args.length == 1) out.addAll(List.of("totem", "reload", "version"));
        else if (args.length == 2 && args[0].toLowerCase(Locale.ROOT).startsWith("tot")) out.addAll(List.of("add", "remove", "set", "get"));
        else if (args.length == 3 && args[0].toLowerCase(Locale.ROOT).startsWith("tot")) for (Player p : Bukkit.getOnlinePlayers()) out.add(p.getName());
        else if (args.length == 4) out.addAll(List.of("1", "5", "10"));
        String last = args[args.length - 1].toLowerCase(Locale.ROOT);
        out.removeIf(s -> !s.toLowerCase(Locale.ROOT).startsWith(last));
        return out;
    }
}
