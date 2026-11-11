package dev.livearena.basedefense.cmd;

import com.mojang.brigadier.Command;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.builder.LiteralArgumentBuilder;
import com.mojang.brigadier.builder.RequiredArgumentBuilder;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.suggestion.SuggestionProvider;
import dev.livearena.basedefense.BaseDefense;
import dev.livearena.basedefense.Settings;
import dev.livearena.basedefense.arena.ArenaData;
import dev.livearena.basedefense.arena.ArenaGenerator;
import dev.livearena.basedefense.util.Names;
import dev.livearena.basedefense.util.Txt;
import io.papermc.paper.command.brigadier.CommandSourceStack;
import io.papermc.paper.command.brigadier.Commands;
import java.util.List;
import java.util.Locale;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.util.BoundingBox;
import org.bukkit.util.Vector;

/**
 * Comandos (API Brigadier de Paper).
 *
 * <p>/tt* son para la app de TikTok: solo consola/RCON o quien tenga basedefense.tiktok. Responden
 * siempre con una línea "[BaseDefense] OK …" o "[BaseDefense] ERROR …" fácil de leer por una app.
 */
@SuppressWarnings("UnstableApiUsage")
public final class BdCommands {
    private static final int MAX_NAME = 24;
    private final BaseDefense plugin;

    public BdCommands(BaseDefense plugin) {
        this.plugin = plugin;
    }

    public void register(Commands c) {
        c.register(bd().build(), "Base Defense: partida, arena y pruebas", List.of("basedefense"));
        c.register(ttspawn().build(), "Invoca una horda (app de TikTok)");
        c.register(ttboss().build(), "Invoca un jefe (app de TikTok)");
        c.register(ttheal().build(), "Cura la base (app de TikTok)");
        c.register(ttwin().build(), "Suma o resta victorias (app de TikTok)");
        c.register(ttlikes().build(), "Total de likes del directo (app de TikTok)");
        c.register(ttaliado().build(), "Ataque aliado: misil, bombardeo o rayo (app de TikTok)");
        c.register(ttsuministro().build(), "Caja de suministros para la base (app de TikTok)");
    }

    // ───────────────────────────── utilidades ─────────────────────────────

    private static boolean app(CommandSourceStack s) {
        CommandSender who = s.getSender();
        return !(who instanceof Player) || who.hasPermission("basedefense.tiktok");
    }

    private static boolean admin(CommandSourceStack s) {
        CommandSender who = s.getSender();
        return !(who instanceof Player) || who.hasPermission("basedefense.admin");
    }

    private static int ok(CommandContext<CommandSourceStack> ctx, String msg) {
        ctx.getSource().getSender().sendMessage(Component.text("[BaseDefense] OK " + msg, NamedTextColor.GREEN));
        return Command.SINGLE_SUCCESS;
    }

    private static int err(CommandContext<CommandSourceStack> ctx, String msg) {
        ctx.getSource().getSender().sendMessage(Component.text("[BaseDefense] ERROR " + msg, NamedTextColor.RED));
        return 0;
    }

    private static final net.kyori.adventure.text.format.TextColor RED = net.kyori.adventure.text.format.TextColor.color(0xE63C32);
    private static final net.kyori.adventure.text.format.TextColor GREEN = net.kyori.adventure.text.format.TextColor.color(0x5ADC5A);

    /** Plantilla de la config → texto plano (sin códigos &) para los avisos del HUD. */
    private static String plain(String tpl, Object... kv) {
        return net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer.plainText().serialize(Txt.fmt(tpl, kv));
    }

    private static String arg(CommandContext<CommandSourceStack> ctx, String name) {
        try {
            return ctx.getArgument(name, String.class);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private String user(CommandContext<CommandSourceStack> ctx) {
        return Names.clean(arg(ctx, "usuario"), MAX_NAME);
    }

    private SuggestionProvider<CommandSourceStack> suggest(java.util.function.Supplier<java.util.Collection<String>> values) {
        return (ctx, b) -> {
            String rem = b.getRemainingLowerCase();
            for (String v : values.get()) if (v.toLowerCase(Locale.ROOT).startsWith(rem)) b.suggest(v);
            return b.buildFuture();
        };
    }

    private static RequiredArgumentBuilder<CommandSourceStack, String> word(String name) {
        return Commands.argument(name, StringArgumentType.word());
    }

    private static RequiredArgumentBuilder<CommandSourceStack, String> rest(String name) {
        return Commands.argument(name, StringArgumentType.greedyString());
    }

    private String needGame() {
        if (plugin.arena == null || !plugin.arena.valid()) return "no hay arena generada (/bd arena generate)";
        if (!plugin.game.running()) return "el juego no está iniciado (/bd start)";
        return null;
    }

    // ───────────────────────────── /tt* ─────────────────────────────

    private LiteralArgumentBuilder<CommandSourceStack> ttspawn() {
        String usage = "uso: ttspawn <tipo> <cantidad> <usuario>";
        return Commands.literal("ttspawn").requires(BdCommands::app)
            .executes(ctx -> err(ctx, usage))
            .then(word("tipo").suggests(suggest(() -> {
                    java.util.List<String> all = new java.util.ArrayList<>(plugin.settings.mobs.keySet());
                    all.add("horda");
                    return all;
                }))
                .executes(ctx -> err(ctx, "falta la cantidad; " + usage))
                .then(word("cantidad").suggests(suggest(() -> List.of("1", "5", "10", "25", "50")))
                    .executes(ctx -> err(ctx, "falta el usuario; " + usage))
                    .then(rest("usuario").executes(ctx -> {
                        String g = needGame();
                        if (g != null) return err(ctx, g);
                        String type = arg(ctx, "tipo").toLowerCase(Locale.ROOT);
                        Settings.MobDef def = plugin.settings.mobs.get(type);
                        boolean mix = type.equals("horda") || type.equals("mezcla");
                        if (def == null && !mix) return err(ctx, "tipo desconocido '" + type + "'. Tipos: horda (mezcla de la fase), " + String.join(", ", plugin.settings.mobs.keySet()));
                        int n;
                        try {
                            n = Integer.parseInt(arg(ctx, "cantidad"));
                        } catch (NumberFormatException e) {
                            return err(ctx, "la cantidad debe ser un número entero: '" + arg(ctx, "cantidad") + "'");
                        }
                        if (n < 1) return err(ctx, "la cantidad debe ser 1 o más");
                        int capped = Math.min(n, plugin.settings.maxPerCommand);
                        String who = user(ctx);
                        if (mix) plugin.waves.enqueueMix(capped, who);
                        else plugin.mobs.enqueue(def, capped, who);
                        plugin.threat.addMobs(capped);
                        if (capped >= plugin.settings.bigHorde)
                            plugin.game.banner(plugin.settings.msg("hordaTitulo"), plugin.settings.msg("hordaSubtitulo"), org.bukkit.Sound.EVENT_RAID_HORN, 1f, "usuario", who, "cantidad", capped, "tipo", mix ? "monstruos" : def.name());
                        else plugin.hud.notify("gift", plain(plugin.settings.msg("hordaSubtitulo"), "usuario", who, "cantidad", capped, "tipo", mix ? "monstruos" : def.name()), RED);
                        return ok(ctx, "ttspawn " + type + " x" + capped + (capped < n ? " (recortado de " + n + ")" : "") + " de " + who + " · en cola " + plugin.mobs.queued() + " · vivos " + plugin.mobs.alive());
                    }))));
    }

    private LiteralArgumentBuilder<CommandSourceStack> ttboss() {
        String usage = "uso: ttboss <tipo> <usuario>";
        return Commands.literal("ttboss").requires(BdCommands::app)
            .executes(ctx -> err(ctx, usage))
            .then(word("tipo").suggests(suggest(() -> plugin.settings.bosses.keySet()))
                .executes(ctx -> err(ctx, "falta el usuario; " + usage))
                .then(rest("usuario").executes(ctx -> {
                    String g = needGame();
                    if (g != null) return err(ctx, g);
                    String type = arg(ctx, "tipo").toLowerCase(Locale.ROOT);
                    Settings.BossDef def = plugin.settings.bosses.get(type);
                    if (def == null) return err(ctx, "jefe desconocido '" + type + "'. Jefes: " + String.join(", ", plugin.settings.bosses.keySet()));
                    String who = user(ctx);
                    if (!plugin.bosses.spawn(def, who)) return err(ctx, "no se pudo invocar el jefe");
                    plugin.threat.addBoss();
                    return ok(ctx, "ttboss " + type + " de " + who);
                })));
    }

    private LiteralArgumentBuilder<CommandSourceStack> ttheal() {
        String usage = "uso: ttheal <cantidad> <usuario>";
        return Commands.literal("ttheal").requires(BdCommands::app)
            .executes(ctx -> err(ctx, usage))
            .then(word("cantidad").suggests(suggest(() -> List.of("50", "100", "250")))
                .executes(ctx -> err(ctx, "falta el usuario; " + usage))
                .then(rest("usuario").executes(ctx -> {
                    String g = needGame();
                    if (g != null) return err(ctx, g);
                    double n;
                    try {
                        n = Double.parseDouble(arg(ctx, "cantidad").replace(',', '.'));
                    } catch (NumberFormatException e) {
                        return err(ctx, "la cantidad debe ser un número: '" + arg(ctx, "cantidad") + "'");
                    }
                    if (n <= 0 || Double.isNaN(n) || Double.isInfinite(n)) return err(ctx, "la cantidad debe ser mayor que 0");
                    String who = user(ctx);
                    double before = plugin.game.baseHp();
                    plugin.game.heal(n);
                    int healed = (int) Math.round(plugin.game.baseHp() - before);
                    plugin.hud.notify("cross", plain(plugin.settings.msg("curaTitulo") + " " + plugin.settings.msg("curaSubtitulo"), "cantidad", healed, "usuario", who), GREEN);
                    return ok(ctx, "ttheal +" + healed + " de " + who + " · base " + (int) plugin.game.baseHp() + "/" + plugin.game.baseMax());
                })));
    }

    private LiteralArgumentBuilder<CommandSourceStack> ttwin() {
        String usage = "uso: ttwin <+n|-n> <usuario>";
        return Commands.literal("ttwin").requires(BdCommands::app)
            .executes(ctx -> err(ctx, usage))
            .then(word("cambio").suggests(suggest(() -> List.of("+1", "-1", "+5")))
                .executes(ctx -> err(ctx, "falta el usuario; " + usage))
                .then(rest("usuario").executes(ctx -> {
                    String raw = arg(ctx, "cambio");
                    int d;
                    try {
                        d = Integer.parseInt(raw.startsWith("+") ? raw.substring(1) : raw);
                    } catch (NumberFormatException e) {
                        return err(ctx, "el cambio debe ser +n o -n: '" + raw + "'");
                    }
                    if (d == 0 || Math.abs(d) > 1000) return err(ctx, "el cambio debe estar entre -1000 y +1000 y no ser 0");
                    String who = user(ctx);
                    plugin.game.addVictories(d);
                    int v = plugin.game.victories();
                    String que = d > 0 ? "+" + d + " victoria" + (d == 1 ? "" : "s") : "+" + (-d) + " derrota" + (d == -1 ? "" : "s");
                    plugin.hud.notify("trophy", plain(plugin.settings.msg("victoriasCambio"), "usuario", who, "que", que, "ganadas", plugin.game.wins(), "perdidas", plugin.game.losses(), "victorias", v), d > 0 ? GREEN : RED);
                    for (Player vp : plugin.game.viewers()) vp.playSound(vp.getLocation(), d > 0 ? org.bukkit.Sound.ENTITY_PLAYER_LEVELUP : org.bukkit.Sound.ENTITY_VILLAGER_NO, 1f, 1f);
                    return ok(ctx, "ttwin " + (d > 0 ? "+" : "") + d + " de " + who + " · victorias " + v);
                })));
    }

    private LiteralArgumentBuilder<CommandSourceStack> ttsuministro() {
        return Commands.literal("ttsuministro").requires(BdCommands::app)
            .executes(ctx -> err(ctx, "uso: ttsuministro <usuario>"))
            .then(rest("usuario").executes(ctx -> {
                String g = needGame();
                if (g != null) return err(ctx, g);
                String who = user(ctx);
                plugin.loot.dropSupply(who);
                return ok(ctx, "ttsuministro de " + who);
            }));
    }

    private LiteralArgumentBuilder<CommandSourceStack> ttaliado() {
        String usage = "uso: ttaliado <" + String.join("|", dev.livearena.basedefense.game.Allies.TYPES) + "> <usuario>";
        return Commands.literal("ttaliado").requires(BdCommands::app)
            .executes(ctx -> err(ctx, usage))
            .then(word("tipo").suggests(suggest(() -> dev.livearena.basedefense.game.Allies.TYPES))
                .executes(ctx -> err(ctx, "falta el usuario; " + usage))
                .then(rest("usuario").executes(ctx -> {
                    String g = needGame();
                    if (g != null) return err(ctx, g);
                    String type = arg(ctx, "tipo").toLowerCase(Locale.ROOT);
                    if (!dev.livearena.basedefense.game.Allies.TYPES.contains(type)) return err(ctx, "tipo desconocido '" + type + "'; " + usage);
                    String who = user(ctx);
                    if (!plugin.allies.launch(type, who)) return err(ctx, "no se pudo lanzar");
                    return ok(ctx, "ttaliado " + type + " de " + who);
                })));
    }

    private LiteralArgumentBuilder<CommandSourceStack> ttlikes() {
        String usage = "uso: ttlikes <total>";
        return Commands.literal("ttlikes").requires(BdCommands::app)
            .executes(ctx -> err(ctx, usage))
            .then(word("total").executes(ctx -> {
                long total;
                try {
                    total = Long.parseLong(arg(ctx, "total").replace(".", "").replace(",", ""));
                } catch (NumberFormatException e) {
                    return err(ctx, "el total debe ser un número entero: '" + arg(ctx, "total") + "'");
                }
                if (total < 0) return err(ctx, "el total no puede ser negativo");
                int reached = plugin.likes().update(total);
                plugin.saveData();
                Settings.BossDef boss = plugin.settings.bosses.get(plugin.settings.likesBoss);
                int spawned = 0;
                if (reached > 0 && boss != null && plugin.game.running()) {
                    for (int i = 0; i < reached; i++) if (plugin.bosses.spawn(boss, plugin.settings.likesDonor)) spawned++;
                }
                plugin.hud.refresh();
                return ok(ctx, "ttlikes " + total + " · faltan " + plugin.likes().missing() + (spawned > 0 ? " · ¡meta! jefe " + boss.id() + " x" + spawned : ""));
            }));
    }

    // ───────────────────────────── /bd ─────────────────────────────

    private LiteralArgumentBuilder<CommandSourceStack> bd() {
        return Commands.literal("bd").requires(BdCommands::admin)
            .executes(ctx -> help(ctx))
            .then(Commands.literal("start")
                .executes(ctx -> start(ctx, null))
                .then(word("jugador").suggests(suggest(() -> Bukkit.getOnlinePlayers().stream().map(Player::getName).toList()))
                    .executes(ctx -> start(ctx, arg(ctx, "jugador")))))
            .then(Commands.literal("stop").executes(ctx -> {
                if (!plugin.game.running()) return err(ctx, "el juego no está iniciado");
                plugin.game.stop(true);
                return ok(ctx, "juego detenido");
            }))
            .then(Commands.literal("reload").executes(ctx -> {
                plugin.reload();
                return ok(ctx, "config.yml recargada");
            }))
            .then(Commands.literal("status").executes(this::status))
            .then(Commands.literal("marcador").then(Commands.literal("reiniciar").executes(ctx -> {
                plugin.game.resetScore();
                return ok(ctx, "marcador a 0-0");
            })))
            .then(Commands.literal("pack").executes(ctx -> {
                // vuelve a leer el pack (plugins/BaseDefense/pack.zip si existe) y se lo manda al streamer
                plugin.pack.start();
                Player p = plugin.game.streamer();
                if (p == null) return err(ctx, "no hay streamer en partida");
                plugin.pack.send(p);
                return ok(ctx, "pack reenviado a " + p.getName());
            }))
            .then(Commands.literal("tp")
                .executes(ctx -> tp(ctx, ctx.getSource().getSender() instanceof Player p ? p : null))
                .then(word("jugador").suggests(suggest(() -> Bukkit.getOnlinePlayers().stream().map(Player::getName).toList()))
                    .executes(ctx -> tp(ctx, Bukkit.getPlayerExact(arg(ctx, "jugador"))))))
            .then(Commands.literal("armas").executes(ctx -> {
                if (!(ctx.getSource().getSender() instanceof Player p)) return err(ctx, "solo jugadores");
                plugin.weapons.give(p);
                return ok(ctx, "armas entregadas");
            }))
            .then(arena())
            .then(set())
            .then(test());
    }

    private int help(CommandContext<CommandSourceStack> ctx) {
        CommandSender s = ctx.getSource().getSender();
        s.sendMessage(Txt.fmt("&c&lBase Defense &7" + plugin.getPluginMeta().getVersion()));
        for (String l : List.of(
            "&e/bd start [jugador] &7· iniciar &8| &e/bd stop &8| &e/bd status &8| &e/bd reload",
            "&e/bd arena generate [semilla] &8| &earena regen &8| &earena clear &8| &e/bd tp",
            "&e/bd set <jugador|mobs|base|waypoint-add|waypoint-clear> &7· ajuste manual",
            "&e/bd test <horda|<tipo>|jefe [wither|dragon|warden]|suministro|municion|curar|ganar|perder|likes|caer|ronda>",
            "&7App: &f/ttspawn <tipo|horda> <n> <usuario> · /ttboss <jefe> <usuario> · /ttheal <n> <usuario> · /ttwin <+n|-n> <usuario> · /ttsuministro <usuario> · /ttlikes <total>"))
            s.sendMessage(Txt.fmt(l));
        return Command.SINGLE_SUCCESS;
    }

    private int tp(CommandContext<CommandSourceStack> ctx, Player p) {
        if (p == null) return err(ctx, "indica el jugador: /bd tp <jugador>");
        if (plugin.arena == null || !plugin.arena.valid()) return err(ctx, "no hay arena: usa /bd arena generate");
        p.teleport(plugin.arena.spawn(plugin.world(true)));
        return ok(ctx, p.getName() + " está en la base");
    }

    private int start(CommandContext<CommandSourceStack> ctx, String name) {
        Player p = null;
        if (name != null) p = Bukkit.getPlayerExact(name);
        else if (ctx.getSource().getSender() instanceof Player sp) p = sp;
        else if (ctx.getSource().getExecutor() instanceof Player ep) p = ep;
        if (p == null && name == null) {
            String saved = plugin.data().getString("streamer");
            if (saved != null) p = Bukkit.getPlayer(java.util.UUID.fromString(saved));
            if (p == null && Bukkit.getOnlinePlayers().size() == 1) p = Bukkit.getOnlinePlayers().iterator().next();
        }
        if (p == null) return err(ctx, name != null ? "el jugador '" + name + "' no está conectado" : "indica el jugador: /bd start <jugador>");
        String e = plugin.game.start(p);
        if (e != null) return err(ctx, e);
        return ok(ctx, "juego iniciado · streamer " + p.getName());
    }

    /** Línea fácil de leer por la app: clave=valor separados por espacios. */
    private int status(CommandContext<CommandSourceStack> ctx) {
        var g = plugin.game;
        String line = "BDSTATUS running=" + (g.running() ? 1 : 0)
            + " arena=" + (plugin.arena != null && plugin.arena.valid() ? 1 : 0)
            + " generating=" + (plugin.placer.busy() ? 1 : 0)
            + " round=" + g.round() + " time=" + g.secondsLeft() + " paused=" + (g.paused() ? 1 : 0)
            + " phase=" + plugin.waves.phase() + " wave=" + plugin.waves.wave()
            + " hp=" + (int) Math.ceil(g.baseHp()) + " max=" + g.baseMax()
            + " wins=" + g.victories() + " ganadas=" + g.wins() + " perdidas=" + g.losses() + " amenaza=" + plugin.threat.level() + " mobs=" + plugin.mobs.alive() + " queue=" + plugin.mobs.queued()
            + " bosses=" + plugin.bosses.all().size() + " kills=" + plugin.mobs.kills
            + " likes=" + plugin.likes().total() + " likesMissing=" + plugin.likes().missing()
            + " streamer=" + (g.streamer() == null ? "-" : g.streamer().getName())
            + " tps=" + String.format(Locale.ROOT, "%.1f", Bukkit.getTPS()[0]);
        ctx.getSource().getSender().sendMessage(Component.text(line));
        return Command.SINGLE_SUCCESS;
    }

    // ───────────────────────────── arena ─────────────────────────────

    private LiteralArgumentBuilder<CommandSourceStack> arena() {
        return Commands.literal("arena")
            .executes(ctx -> err(ctx, "uso: /bd arena <generate [semilla]|regen|clear>"))
            .then(Commands.literal("generate")
                .executes(ctx -> generate(ctx, null, false))
                .then(word("semilla").executes(ctx -> generate(ctx, arg(ctx, "semilla"), false))))
            .then(Commands.literal("regen").executes(ctx -> generate(ctx, null, true)))
            .then(Commands.literal("clear").executes(ctx -> {
                if (plugin.game.running()) return err(ctx, "detén el juego antes (/bd stop)");
                if (plugin.placer.busy()) return err(ctx, "ya hay una operación de arena en curso");
                if (plugin.arena == null || plugin.arena.bounds == null) return err(ctx, "no hay arena que borrar");
                World w = plugin.world(true);
                BoundingBox box = plugin.arena.bounds;
                evacuate(w);
                plugin.placer.clear(w, box, plugin.settings.blocksPerTick * 3, () -> {
                    new java.io.File(plugin.getDataFolder(), "arena.yml").delete();
                    plugin.arena = null;
                    Bukkit.getLogger().info("[BaseDefense] Arena borrada.");
                });
                return ok(ctx, "borrando la arena…");
            }));
    }

    private int generate(CommandContext<CommandSourceStack> ctx, String seedArg, boolean regen) {
        if (plugin.game.running()) return err(ctx, "detén el juego antes (/bd stop)");
        if (plugin.placer.busy()) return err(ctx, "ya se está generando una arena");
        if (!regen && seedArg == null && plugin.arena != null && plugin.arena.valid())
            return err(ctx, "ya existe una arena; usa /bd arena regen para reconstruirla o /bd arena generate <semilla> para otra");
        long seed;
        if (seedArg != null) {
            try {
                seed = Long.parseLong(seedArg);
            } catch (NumberFormatException e) {
                seed = seedArg.hashCode();
            }
        } else if (regen && plugin.arena != null) seed = plugin.arena.seed;
        else seed = plugin.settings.seed;
        World w = plugin.world(true);
        BoundingBox old = plugin.arena != null ? plugin.arena.bounds : null;
        long t0 = System.currentTimeMillis();
        ArenaGenerator gen = new ArenaGenerator(plugin.settings, seed);
        ArenaData data = gen.build();
        long ms = System.currentTimeMillis() - t0;
        evacuate(w);
        final long fseed = seed;
        CommandSender sender = ctx.getSource().getSender();
        plugin.placer.rebuild(w, old, gen.canvas(), plugin.biome(), plugin.settings.blocksPerTick, () -> {
            plugin.saveArena(data);
            plugin.data().set("arenaLargo", plugin.settings.length);
            plugin.data().set("arenaAncho", plugin.settings.width);
            plugin.saveData();
            sender.sendMessage(Component.text("[BaseDefense] OK arena lista (semilla " + fseed + "). /bd tp para verla, /bd start para jugar.", NamedTextColor.GREEN));
        });
        return ok(ctx, "generando arena (semilla " + seed + ", " + gen.canvas().size() + " bloques, diseño en " + ms + " ms)…");
    }

    /** Durante la obra los jugadores esperan en una plataforma alta y segura. */
    private void evacuate(World w) {
        Location safe = new Location(w, 0.5, plugin.settings.groundY + 40, -40.5);
        w.getBlockAt(safe.clone().add(0, -1, 0)).setType(org.bukkit.Material.BARRIER, false);
        for (Player p : w.getPlayers()) p.teleport(safe);
    }

    // ───────────────────────────── set ─────────────────────────────

    private LiteralArgumentBuilder<CommandSourceStack> set() {
        return Commands.literal("set")
            .executes(ctx -> err(ctx, "uso: /bd set <jugador|mobs|base|waypoint-add|waypoint-clear> (en tu posición)"))
            .then(word("punto").suggests(suggest(() -> List.of("jugador", "mobs", "base", "waypoint-add", "waypoint-clear"))).executes(ctx -> {
                if (!(ctx.getSource().getSender() instanceof Player p)) return err(ctx, "solo jugadores (usa tu posición)");
                if (!plugin.inGameWorld(p)) return err(ctx, "ve al mundo del juego (/bd tp)");
                ArenaData a = plugin.arena;
                if (a == null) return err(ctx, "genera la arena primero");
                Location l = p.getLocation();
                Vector v = new Vector(l.getBlockX() + 0.5, l.getY(), l.getBlockZ() + 0.5);
                switch (arg(ctx, "punto").toLowerCase(Locale.ROOT)) {
                    case "jugador" -> {
                        a.playerSpawn = v;
                        a.playerYaw = l.getYaw();
                        if (a.platform != null) a.platform = a.platform.union(v);
                    }
                    case "mobs" -> a.mobSpawn = v;
                    case "base" -> {
                        double hw = a.baseRegion == null ? 8 : a.baseRegion.getWidthX() / 2;
                        a.baseRegion = new BoundingBox(v.getX() - hw, v.getY() - 3, v.getZ() - 2, v.getX() + hw, v.getY() + 6, v.getZ() + 2);
                    }
                    case "waypoint-add" -> a.waypoints.add(v);
                    case "waypoint-clear" -> a.waypoints.clear();
                    default -> {
                        return err(ctx, "punto desconocido. Opciones: jugador, mobs, base, waypoint-add, waypoint-clear");
                    }
                }
                plugin.saveArena(a);
                return ok(ctx, "punto '" + arg(ctx, "punto") + "' guardado" + (a.waypoints.size() < 2 ? " (necesitas al menos 2 waypoints)" : ""));
            }));
    }

    // ───────────────────────────── test ─────────────────────────────

    private LiteralArgumentBuilder<CommandSourceStack> test() {
        List<String> events = List.of("horda", "jefe", "suministro", "municion", "curar", "ganar", "perder", "likes", "caer", "victoria", "lleno", "ronda", "meta", "aviso", "misil", "bombardeo", "rayo", "armas", "amenaza", "despiece");
        return Commands.literal("test")
            .executes(ctx -> err(ctx, "uso: /bd test <" + String.join("|", events) + "> [tipo/cantidad]"))
            .then(word("evento").suggests(suggest(() -> {
                    java.util.List<String> all = new java.util.ArrayList<>(events);
                    all.addAll(plugin.settings.mobs.keySet());
                    return all;
                }))
                .executes(ctx -> test(ctx, arg(ctx, "evento"), null))
                .then(word("extra").suggests(suggest(() -> {
                    java.util.List<String> all = new java.util.ArrayList<>(plugin.settings.bosses.keySet());
                    all.addAll(List.of("10", "50", "100", "300"));
                    return all;
                })).executes(ctx -> test(ctx, arg(ctx, "evento"), arg(ctx, "extra")))));
    }

    private int test(CommandContext<CommandSourceStack> ctx, String ev, String extra) {
        String g = needGame();
        if (g != null) return err(ctx, g);
        String user = "Prueba" + (1 + plugin.fx.rnd().nextInt(99));
        CommandSender console = Bukkit.getConsoleSender();
        String e = ev.toLowerCase(Locale.ROOT);
        if (plugin.settings.mobs.containsKey(e)) {
            Bukkit.dispatchCommand(console, "ttspawn " + e + " " + (extra == null ? "5" : extra) + " " + user);
            return ok(ctx, "test " + e);
        }
        switch (e) {
            case "horda" -> Bukkit.dispatchCommand(console, "ttspawn horda " + (extra == null ? 40 : parse(extra, 40)) + " " + user);
            case "suministro" -> Bukkit.dispatchCommand(console, "ttsuministro " + user);
            case "municion" -> {
                Player sp = plugin.game.streamer();
                if (sp != null) for (Settings.WeaponDef w : plugin.settings.weapons.values()) plugin.weapons.addReserve(sp, w, w.magazine() * 3);
            }
            case "lleno" -> {
                List<String> types = List.copyOf(plugin.settings.mobs.keySet());
                for (String t : types) Bukkit.dispatchCommand(console, "ttspawn " + t + " " + (plugin.settings.mobCap / types.size() + 5) + " CargaMaxima");
            }
            case "jefe" -> Bukkit.dispatchCommand(console, "ttboss " + (extra == null ? List.copyOf(plugin.settings.bosses.keySet()).get(plugin.fx.rnd().nextInt(plugin.settings.bosses.size())) : extra) + " " + user);
            case "curar" -> Bukkit.dispatchCommand(console, "ttheal " + (extra == null ? "150" : extra) + " " + user);
            case "ganar", "victoria" -> Bukkit.dispatchCommand(console, "ttwin +1 " + user);
            case "perder" -> Bukkit.dispatchCommand(console, "ttwin -1 " + user);
            case "likes" -> Bukkit.dispatchCommand(console, "ttlikes " + (plugin.likes().total() + (extra == null ? plugin.settings.likesGoal / 4 : parse(extra, 1000))));
            case "caer" -> plugin.game.forceFall();
            case "ronda" -> plugin.game.forceWin();
            case "armas" -> plugin.weapons.unlockPhase(99);
            case "amenaza" -> plugin.threat.add(plugin.settings.threatPerLevel);
            case "despiece" -> plugin.mobs.demoGore(plugin.game.streamer());
            case "misil", "bombardeo", "rayo" -> Bukkit.dispatchCommand(console, "ttaliado " + e + " " + user);
            case "meta" -> {
                int left = plugin.loot.goalTarget() - plugin.loot.goalKills();
                for (int i = 0; i < left; i++) plugin.loot.countKill();
            }
            case "aviso" -> plugin.hud.notify("gift", user + " ENVÍA 10 ZOMBIS", net.kyori.adventure.text.format.TextColor.color(0x5ADC5A));
            default -> {
                return err(ctx, "evento desconocido '" + ev + "'");
            }
        }
        return ok(ctx, "test " + e);
    }

    private static int parse(String s, int def) {
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return def;
        }
    }
}
