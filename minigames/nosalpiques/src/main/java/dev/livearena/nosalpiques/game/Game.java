package dev.livearena.nosalpiques.game;

import dev.livearena.nosalpiques.NoSalpiquesLive;
import dev.livearena.nosalpiques.map.Rooms;
import dev.livearena.nosalpiques.map.Theme;
import dev.livearena.nosalpiques.map.Themes;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.Color;
import org.bukkit.FireworkEffect;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.Particle;
import org.bukkit.Sound;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Egg;
import org.bukkit.entity.Player;
import org.bukkit.entity.Projectile;
import org.bukkit.entity.Snowball;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.CreatureSpawnEvent;
import org.bukkit.event.entity.ProjectileHitEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;
import org.bukkit.util.Vector;

/**
 * La partida de No Salpiques: el streamer salta de plataforma en plataforma por las salas de piscinas. Tocar el agua
 * (salpicar) despierta a la criatura, que le persigue hasta que llega a la sala siguiente; si le alcanza, vuelve al
 * inicio de la sala. En la sala final el agua sube y hay que trepar hasta la puerta dorada. Salir por ella = victoria.
 */
public final class Game implements Listener {
    private final NoSalpiquesLive plugin;
    private final NamespacedKey itemKey;
    private UUID streamer;
    private boolean running;
    private int room = 1;
    private int splashes, catches, roomSplashes, splashStreak;
    private long startedAt, wonAt = -1, roomStartedAt;
    private long shieldUntil, protectedUntil, memoryUntil, lastSplash;
    private double furthestX;
    private boolean wasWet;
    private int flood = Rooms.WATER_TOP;
    private long nextFlood;
    private final Set<Long> sinking = new HashSet<>();
    private final Map<Long, Long> broken = new HashMap<>();
    private final List<int[]> flooded = new ArrayList<>();
    private Location returnTo;
    private GameMode returnMode;

    public Game(NoSalpiquesLive plugin) {
        this.plugin = plugin;
        this.itemKey = new NamespacedKey(plugin, "objeto");
    }

    // ───────────────────────────── estado ─────────────────────────────

    public boolean running() {
        return running;
    }

    public Player player() {
        return streamer == null ? null : Bukkit.getPlayer(streamer);
    }

    /** Sala actual (rooms + 1 = completado). En el HUD se llama «nivel». */
    public int checkpoint() {
        return room;
    }

    public int falls() {
        return splashes;
    }

    public int catches() {
        return catches;
    }

    public boolean celebrating() {
        return wonAt >= 0;
    }

    public int wins() {
        return plugin.data().getInt("ganadas", 0);
    }

    public int losses() {
        return plugin.data().getInt("perdidas", 0);
    }

    public void addWins(int n) {
        plugin.data().set("ganadas", Math.max(0, wins() + n));
        plugin.saveData();
    }

    public void addLosses(int n) {
        plugin.data().set("perdidas", Math.max(0, losses() + n));
        plugin.saveData();
    }

    public void resetScore() {
        plugin.data().set("ganadas", 0);
        plugin.data().set("perdidas", 0);
        plugin.saveData();
    }

    public int seconds() {
        return running ? (int) ((plugin.tick() - startedAt) / 20) : 0;
    }

    public double levelProgress() {
        if (room > plugin.settings.levels) return 1;
        return plugin.rooms.room(room).progress(furthestX);
    }

    public double totalProgress() {
        int n = plugin.settings.levels;
        if (room > n) return 1;
        return Math.min(1, (room - 1 + levelProgress()) / n);
    }

    public Theme theme() {
        return Themes.of(Math.min(room, plugin.settings.levels));
    }

    public boolean shielded() {
        return plugin.tick() < shieldUntil;
    }

    public boolean isProtected() {
        return plugin.tick() < protectedUntil;
    }

    public void shield(int seconds) {
        shieldUntil = plugin.tick() + seconds * 20L;
    }

    public boolean hunted() {
        return plugin.monster.awake();
    }

    // ───────────────────────────── empezar / terminar ─────────────────────────────

    public String start(Player p) {
        if (plugin.builder.building()) return "las salas se están construyendo, espera unos segundos";
        if (!plugin.builder.isBuilt()) {
            plugin.builder.rebuild(() -> {
                Player again = Bukkit.getPlayer(p.getUniqueId());
                if (again != null) start(again);
            });
            return "construyendo las salas; la partida empieza al terminar";
        }
        plugin.world(true);
        if (running && streamer != null && !streamer.equals(p.getUniqueId())) stop(false);
        if (!running) {
            returnTo = p.getLocation();
            returnMode = p.getGameMode();
            saveInventory(p);
        }
        streamer = p.getUniqueId();
        running = true;
        p.getInventory().clear();
        p.setGameMode(GameMode.ADVENTURE);
        heal(p);
        newRun(p);
        plugin.pack.send(p);
        plugin.hud.show(p);
        return "partida iniciada · " + p.getName();
    }

    private void newRun(Player p) {
        splashes = 0;
        catches = 0;
        wonAt = -1;
        shieldUntil = protectedUntil = 0;
        startedAt = plugin.tick();
        p.getInventory().clear();
        give(p, "piedra", plugin.settings.startStones);
        give(p, "bengala", plugin.settings.startFlares);
        goRoom(p, 1, true);
        plugin.fx.sound(p, "nosalpiques:nivel", Sound.BLOCK_BEACON_ACTIVATE, 1f, 1f);
    }

    public void stop(boolean announce) {
        Player p = player();
        running = false;
        wonAt = -1;
        plugin.monster.sleep(false);
        plugin.effects.clear();
        resetRoomState();
        plugin.temp.restoreAll();
        if (p != null) {
            plugin.hud.hide(p);
            plugin.pack.remove(p);
            for (PotionEffectType t : new PotionEffectType[] {PotionEffectType.NIGHT_VISION, PotionEffectType.JUMP_BOOST, PotionEffectType.DARKNESS, PotionEffectType.BLINDNESS})
                p.removePotionEffect(t);
            restoreInventory(p);
            if (returnMode != null) p.setGameMode(returnMode);
            if (returnTo != null && returnTo.getWorld() != null && !returnTo.getWorld().getName().equals(plugin.settings.worldName)) p.teleport(returnTo);
            else p.teleport(Bukkit.getWorlds().getFirst().getSpawnLocation());
        }
        streamer = null;
    }

    private void heal(Player p) {
        var hp = p.getAttribute(org.bukkit.attribute.Attribute.MAX_HEALTH);
        p.setHealth(hp != null ? hp.getValue() : 20);
        p.setFoodLevel(20);
        p.setSaturation(20);
        p.setFireTicks(0);
    }

    /** Objetos de distracción: piedra (bola de nieve) y bengala (huevo), con nombre propio. */
    public void give(Player p, String kind, int n) {
        if (n <= 0) return;
        boolean stone = kind.equals("piedra");
        ItemStack it = new ItemStack(stone ? Material.SNOWBALL : Material.EGG, Math.min(16, n));
        var meta = it.getItemMeta();
        meta.displayName(Component.text(stone ? "Piedra" : "Bengala", stone ? NamedTextColor.GRAY : NamedTextColor.GOLD).decorate(TextDecoration.BOLD).decoration(TextDecoration.ITALIC, false));
        meta.lore(List.of(Component.text(stone ? "Lánzala: la criatura irá hacia el ruido" : "Lánzala a la criatura: la ciega unos segundos", NamedTextColor.WHITE).decoration(TextDecoration.ITALIC, false)));
        meta.getPersistentDataContainer().set(itemKey, PersistentDataType.STRING, kind);
        it.setItemMeta(meta);
        p.getInventory().addItem(it);
    }

    // ───────────────────────────── salas ─────────────────────────────

    private void resetRoomState() {
        World w = plugin.world(false);
        if (w != null) for (int[] f : flooded) w.getBlockAt(f[0], f[1], f[2]).setType(Material.AIR, false);
        flooded.clear();
        flood = Rooms.WATER_TOP;
        sinking.clear();
        broken.clear();
    }

    /** Lleva al jugador al inicio de la sala. */
    public void goRoom(Player p, int r, boolean announce) {
        int max = plugin.settings.levels;
        r = Math.max(1, Math.min(max, r));
        boolean changed = r != room;
        if (changed || announce) {
            roomSplashes = 0;
            splashStreak = 0;
        }
        room = r;
        plugin.monster.sleep(false);
        resetRoomState();
        plugin.temp.restoreAll();
        Rooms.Room rm = plugin.rooms.room(r);
        World w = plugin.world(true);
        Location at = new Location(w, rm.startX(), Rooms.DECK + 1, rm.startZ(), -90f, 10f);
        p.teleport(at);
        p.setVelocity(new Vector());
        p.setFallDistance(0);
        furthestX = at.getX();
        roomStartedAt = plugin.tick();
        memoryUntil = plugin.tick() + plugin.settings.memoryS * 20L;
        nextFlood = plugin.tick() + 80;
        showMemory(w, rm, true);
        p.addPotionEffect(new PotionEffect(PotionEffectType.NIGHT_VISION, 20 * 3600, 0, true, false, false));
        if (announce || changed) plugin.hud.levelTitle(p, r, true);
        plugin.hud.update();
    }

    /** Las baldosas seguras del puente de memoria brillan unos segundos al entrar en la sala. */
    private void showMemory(World w, Rooms.Room rm, boolean on) {
        for (Rooms.Pad pad : rm.pads()) {
            if (pad.kind() != Rooms.Kind.MEMORIA) continue;
            if (on) plugin.temp.set(w, pad.x(), pad.y(), pad.z(), Material.PEARLESCENT_FROGLIGHT.createBlockData(), plugin.settings.memoryS * 20L);
        }
        if (on && rm.pads().stream().anyMatch(pp -> pp.kind() == Rooms.Kind.MEMORIA)) {
            Player p = player();
            if (p != null) plugin.hud.flash(p, "&d¡Memoriza las baldosas que brillan!");
        }
    }

    public void setCheckpoint(int r, boolean teleport) {
        Player p = player();
        if (p == null) return;
        if (r > plugin.settings.levels) {
            room = r;
            win(p);
            return;
        }
        int before = room;
        goRoom(p, r, false);
        plugin.hud.levelTitle(p, r, r > before);
    }

    private void nextRoom(Player p) {
        Theme th = theme();
        plugin.monster.sleep(true);
        Location l = p.getLocation();
        plugin.fx.firework(l.clone().add(0, 3, 0), th.color(), Color.WHITE, FireworkEffect.Type.BALL, 0);
        plugin.fx.sound(p, "nosalpiques:checkpoint", Sound.ENTITY_PLAYER_LEVELUP, 1f, 1.2f);
        if (room >= plugin.settings.levels) {
            room = plugin.settings.levels + 1;
            win(p);
            return;
        }
        int next = room + 1;
        // el pasillo lleva solo a la sala siguiente: aquí solo se cambia el checkpoint y la sala
        room = next;
        roomSplashes = 0;
        splashStreak = 0;
        resetRoomState();
        Rooms.Room rm = plugin.rooms.room(next);
        furthestX = rm.startX();
        memoryUntil = plugin.tick() + plugin.settings.memoryS * 20L;
        nextFlood = plugin.tick() + 80;
        roomStartedAt = plugin.tick();
        showMemory(p.getWorld(), rm, true);
        plugin.hud.levelTitle(p, next, true);
        plugin.hud.update();
    }

    private void win(Player p) {
        if (wonAt >= 0) return;
        wonAt = plugin.tick();
        plugin.monster.sleep(true);
        addWins(1);
        plugin.hud.win(p);
        plugin.fx.sound(p, "nosalpiques:cima", Sound.UI_TOAST_CHALLENGE_COMPLETE, 1f, 1f);
        Location at = p.getLocation();
        for (int i = 0; i < 12; i++) {
            int k = i;
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                double a = k * 0.9;
                plugin.fx.firework(at.clone().add(Math.cos(a) * 3, 2, Math.sin(a) * 3), Color.fromRGB(Themes.of(1 + k).rgb()), Color.fromRGB(0xFFD700),
                    k % 3 == 0 ? FireworkEffect.Type.STAR : FireworkEffect.Type.BALL_LARGE, 1);
            }, i * 8L);
        }
        plugin.hud.update();
    }

    public void lose(Player p, String why) {
        addLosses(1);
        plugin.hud.lose(p, why);
        plugin.fx.sound(p, "nosalpiques:perder", Sound.ENTITY_WARDEN_DEATH, 0.8f, 1f);
        plugin.monster.sleep(false);
        newRun(p);
    }

    /** Ha tocado el agua. */
    private void splash(Player p) {
        long now = plugin.tick();
        if (now - lastSplash < 30) return;
        lastSplash = now;
        Location l = p.getLocation();
        plugin.fx.particle(l.clone().add(0, 0.4, 0), Particle.SPLASH, 160, 1.2, 0.5);
        plugin.fx.sound(l, Sound.ENTITY_PLAYER_SPLASH_HIGH_SPEED, 1.2f, 0.8f);
        if (hunted()) return; // ya le persigue
        if (shielded()) {
            shieldUntil = 0;
            plugin.fx.spiral(l.clone(), Color.fromRGB(0xFF7BE5), true, 2.2, 2, Particle.END_ROD);
            plugin.hud.flash(p, "&d🛡 El escudo silenció el salpicón");
            return;
        }
        splashes++;
        roomSplashes++;
        splashStreak++;
        plugin.fx.sound(p, "nosalpiques:caida", Sound.AMBIENT_UNDERWATER_ENTER, 1f, 0.6f);
        plugin.hud.banner("¡SALPICASTE!", "ALGO SE ESTÁ DESPERTANDO…", TextColor.color(0xFF5A6A), 50);
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            Player q = player();
            if (q != null && running && wonAt < 0) plugin.monster.wake(q, q.getLocation());
        }, 15L);
        if (plugin.settings.protectSplashes > 0 && splashStreak >= plugin.settings.protectSplashes && !isProtected()) {
            protectedUntil = now + plugin.settings.protectS * 20L;
            splashStreak = 0;
            plugin.hud.flash(p, "&a✚ Protegido " + plugin.settings.protectS + " s: sin sabotajes");
        }
        plugin.hud.update();
    }

    /** La criatura le ha alcanzado. */
    private void caught(Player p) {
        catches++;
        plugin.monster.sleep(false);
        p.addPotionEffect(new PotionEffect(PotionEffectType.BLINDNESS, 30, 0, true, false, false));
        plugin.fx.sound(p.getLocation(), Sound.ENTITY_WARDEN_SONIC_BOOM, 1.5f, 0.7f);
        plugin.fx.sound(p, "nosalpiques:perder", Sound.ENTITY_WARDEN_ROAR, 1f, 1.2f);
        plugin.hud.banner("¡TE ATRAPÓ!", "VUELVES AL INICIO DE LA SALA", TextColor.color(0xFF2A3A), 70);
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            Player q = player();
            if (q != null && running) goRoom(q, room, false);
        }, 20L);
    }

    // ───────────────────────────── bucle ─────────────────────────────

    public void tick() {
        if (!running) return;
        Player p = player();
        if (p == null || !plugin.inWorld(p)) return;
        long now = plugin.tick();
        if (p.getFoodLevel() < 20) p.setFoodLevel(20);
        if (wonAt >= 0) {
            if (now % 10 == 0) plugin.fx.particle(p.getLocation().add(0, 1, 0), Particle.END_ROD, 6, 1.5, 0.05);
            if (now % 5 == 0) plugin.hud.update();
            if (plugin.settings.restartOnWin && now - wonAt > plugin.settings.celebrateSeconds * 20L) newRun(p);
            return;
        }
        Rooms.Room rm = plugin.rooms.room(room);
        Location l = p.getLocation();
        World w = p.getWorld();
        // salida: pasillo de la sala siguiente o puerta dorada de la final
        if (room < plugin.settings.levels && l.getX() >= rm.x0() + Rooms.L + 1) {
            nextRoom(p);
            return;
        }
        if (room == plugin.settings.levels && l.getX() >= rm.x0() + Rooms.L - 1.2 && l.getY() >= rm.exitY() + 0.5) {
            nextRoom(p);
            return;
        }
        if (l.getX() < rm.x0() - 3 && room > 1) { // volvió atrás por el pasillo
            goRoom(p, room, false);
            return;
        }
        if (l.getY() < Rooms.FLOOR - 2 || !rm.inside(l.getX(), l.getZ()) && l.getX() < rm.x0() + Rooms.L) {
            goRoom(p, room, false);
            return;
        }
        furthestX = Math.max(furthestX, l.getX());
        // agua: cuenta al entrar (no mientras sigue dentro)
        boolean wet = p.isInWater() || l.getBlock().getType() == Material.WATER;
        if (wet && !wasWet) splash(p);
        wasWet = wet;
        // plataforma bajo los pies
        if (p.isOnGround()) {
            Block under = l.clone().add(0, -0.2, 0).getBlock();
            Rooms.Pad pad = plugin.rooms.padAt.get(Rooms.key(under.getX(), under.getY(), under.getZ()));
            if (pad != null) step(p, w, pad, under, now);
        }
        // plataformas que parpadean (por fase)
        blink(w, rm, now);
        // corrientes: empujan si estás encima
        // memoria: al acabar el tiempo de mostrar, se avisa
        if (memoryUntil > 0 && now == memoryUntil) plugin.fx.sound(l, Sound.BLOCK_AMETHYST_BLOCK_RESONATE, 1f, 0.8f);
        // crecida en la sala final
        if (room == plugin.settings.levels && now >= nextFlood && flood < rm.exitY() - 1) {
            nextFlood = now + (long) (plugin.settings.floodS * 20);
            flood++;
            raise(w, rm, flood);
            if (flood % 2 == 0) plugin.hud.flash(p, "&b¡El agua sube!");
        }
        if (plugin.monster.tick(p, room)) {
            caught(p);
            return;
        }
        if (now % 6 == 0) ambient(p, rm);
        if (plugin.settings.timeLimitMin > 0 && seconds() >= plugin.settings.timeLimitMin * 60) {
            lose(p, "¡SE ACABÓ EL TIEMPO!");
            return;
        }
        if (now % 4 == 0) plugin.hud.update();
    }

    private void step(Player p, World w, Rooms.Pad pad, Block under, long now) {
        long k = Rooms.key(under.getX(), under.getY(), under.getZ());
        switch (pad.kind()) {
            case HUNDE -> {
                if (sinking.add(k)) {
                    plugin.fx.sound(under.getLocation(), Sound.BLOCK_GRAVEL_STEP, 1f, 0.6f);
                    long delay = (long) (plugin.settings.sinkS * 20);
                    // avisa (grietas y burbujas) y luego se hunde un rato
                    for (int i = 0; i < delay; i += 4) {
                        Bukkit.getScheduler().runTaskLater(plugin, () -> plugin.fx.particle(under.getLocation().add(0.5, 1.05, 0.5), Particle.BUBBLE_POP, 6, 0.4, 0.02), i);
                    }
                    Bukkit.getScheduler().runTaskLater(plugin, () -> {
                        sinkPad(w, pad, 80);
                        sinking.remove(k);
                    }, delay);
                }
            }
            case CORRIENTE -> {
                if (now % 10 == 0) {
                    p.setVelocity(p.getVelocity().add(new Vector(pad.pushX(), 0, pad.pushZ()).multiply(0.22)));
                    plugin.fx.particle(p.getLocation().add(0, 0.1, 0), Particle.BUBBLE_COLUMN_UP, 6, 0.4, 0.02);
                }
            }
            case MEMORIA_TRAMPA -> {
                if (!broken.containsKey(k)) {
                    broken.put(k, now);
                    plugin.fx.sound(under.getLocation(), Sound.BLOCK_GLASS_BREAK, 1.2f, 0.8f);
                    w.spawnParticle(Particle.BLOCK, under.getLocation().add(0.5, 0.8, 0.5), 30, 0.3, 0.2, 0.3, 0.1, under.getBlockData());
                    plugin.temp.set(w, under.getX(), under.getY(), under.getZ(), Material.AIR.createBlockData(), 100);
                }
            }
            default -> {}
        }
    }

    /** Hunde la plataforma entera (su cara de arriba y el pilar visible) durante `ticks`. */
    public void sinkPad(World w, Rooms.Pad pad, long ticks) {
        for (int x = pad.x(); x < pad.x() + pad.size(); x++)
            for (int z = pad.z(); z < pad.z() + pad.size(); z++)
                for (int y = Rooms.WATER_TOP + 1; y <= pad.y(); y++) plugin.temp.set(w, x, y, z, Material.AIR.createBlockData(), ticks);
        plugin.fx.particle(new Location(w, pad.x() + pad.size() / 2.0, Rooms.WATER_TOP + 1.2, pad.z() + pad.size() / 2.0), Particle.SPLASH, 40, 0.6, 0.2);
        plugin.fx.sound(new Location(w, pad.x(), pad.y(), pad.z()), Sound.ENTITY_GENERIC_SPLASH, 1f, 0.7f);
    }

    private int lastBlinkPhase = -1;

    private void blink(World w, Rooms.Room rm, long now) {
        int period = (int) (plugin.settings.blinkS * 20);
        int phase = (int) ((now / period) % 2);
        if (phase == lastBlinkPhase) {
            if (now % period == period - 10)
                for (Rooms.Pad pad : rm.pads())
                    if (pad.kind() == Rooms.Kind.PARPADEA && pad.phase() == phase)
                        plugin.fx.particle(new Location(w, pad.x() + pad.size() / 2.0, pad.y() + 1.05, pad.z() + pad.size() / 2.0), Particle.ELECTRIC_SPARK, 6, 0.3, 0.02);
            return;
        }
        lastBlinkPhase = phase;
        for (Rooms.Pad pad : rm.pads())
            if (pad.kind() == Rooms.Kind.PARPADEA && pad.phase() != phase)
                for (int x = pad.x(); x < pad.x() + pad.size(); x++)
                    for (int z = pad.z(); z < pad.z() + pad.size(); z++) plugin.temp.set(w, x, pad.y(), z, Material.AIR.createBlockData(), period);
    }

    /** Sube el agua de la sala final a la altura y (sin pisar plataformas). */
    private void raise(World w, Rooms.Room rm, int y) {
        for (int x = rm.x0() + 4; x < rm.x0() + Rooms.L - 4; x++)
            for (int z = 0; z < Rooms.W; z++) {
                Block b = w.getBlockAt(x, y, z);
                if (!b.getType().isAir()) continue;
                b.setType(Material.WATER, false);
                flooded.add(new int[] {x, y, z});
            }
        plugin.fx.sound(new Location(w, rm.x0() + Rooms.L / 2.0, y, Rooms.W / 2.0), Sound.BLOCK_WATER_AMBIENT, 2f, 0.6f);
    }

    private void ambient(Player p, Rooms.Room rm) {
        Location l = p.getLocation();
        // gotas que caen del techo y reflejos en el agua
        var r = plugin.fx.rnd();
        Location drip = new Location(l.getWorld(), l.getX() + r.nextGaussian() * 6, Rooms.DECK + Rooms.H - 1, l.getZ() + r.nextGaussian() * 4);
        plugin.fx.particle(drip, Particle.DRIPPING_WATER, 2, 0.2, 0);
        if (r.nextInt(30) == 0) plugin.fx.sound(drip, Sound.BLOCK_POINTED_DRIPSTONE_DRIP_WATER_INTO_CAULDRON, 0.8f, 0.6f + r.nextFloat() * 0.4f);
        if (r.nextInt(60) == 0) plugin.fx.sound(l, Sound.AMBIENT_CAVE, 0.5f, 1.4f);
    }

    // ───────────────────────────── piedras y bengalas ─────────────────────────────

    @EventHandler
    public void onHit(ProjectileHitEvent e) {
        Projectile pr = e.getEntity();
        if (!running || !plugin.inWorld(pr) || !(pr.getShooter() instanceof Player p) || !p.getUniqueId().equals(streamer)) return;
        Location at = pr.getLocation();
        if (pr instanceof Snowball) {
            at.getWorld().spawnParticle(Particle.BLOCK, at, 20, 0.2, 0.2, 0.2, 0.1, Material.STONE.createBlockData());
            plugin.fx.sound(at, Sound.BLOCK_STONE_HIT, 2f, 0.8f);
            plugin.monster.distract(at);
            plugin.hud.flash(p, "&7La criatura oye el ruido…");
        } else if (pr instanceof Egg) {
            plugin.fx.particle(at, Particle.FLASH, 2, 0.2, 0);
            plugin.fx.dust(at, Color.fromRGB(0xFFB43C), 2f, 40, 1.2);
            plugin.fx.sound(at, Sound.ENTITY_FIREWORK_ROCKET_BLAST, 1.5f, 1f);
            Location m = plugin.monster.location();
            if (m != null && m.distance(at) < 6) {
                plugin.monster.blind();
                plugin.hud.flash(p, "&6¡Bengala! La criatura está cegada");
            }
        }
    }

    @EventHandler
    public void onSpawn(CreatureSpawnEvent e) {
        // los huevos lanzados no deben soltar pollitos
        if (plugin.inWorld(e.getEntity()) && e.getSpawnReason() == CreatureSpawnEvent.SpawnReason.EGG) e.setCancelled(true);
    }

    // ───────────────────────────── inventario ─────────────────────────────

    private File invFile(UUID id) {
        return new File(plugin.getDataFolder(), "inventarios/" + id + ".yml");
    }

    private void saveInventory(Player p) {
        YamlConfiguration y = new YamlConfiguration();
        y.set("items", p.getInventory().getContents());
        File f = invFile(p.getUniqueId());
        f.getParentFile().mkdirs();
        try {
            y.save(f);
        } catch (IOException e) {
            plugin.getLogger().warning("No se pudo guardar el inventario: " + e);
        }
    }

    private void restoreInventory(Player p) {
        File f = invFile(p.getUniqueId());
        if (!f.isFile()) return;
        YamlConfiguration y = YamlConfiguration.loadConfiguration(f);
        Object raw = y.get("items");
        if (raw instanceof java.util.List<?> list) {
            ItemStack[] items = new ItemStack[p.getInventory().getSize()];
            for (int i = 0; i < Math.min(items.length, list.size()); i++) if (list.get(i) instanceof ItemStack it) items[i] = it;
            p.getInventory().setContents(items);
        }
        f.delete();
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent e) {
        Player p = e.getPlayer();
        if (!(running && p.getUniqueId().equals(streamer)) && invFile(p.getUniqueId()).isFile()) {
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                if (!p.isOnline() || (running && p.getUniqueId().equals(streamer))) return;
                restoreInventory(p);
                if (plugin.inWorld(p)) {
                    p.teleport(Bukkit.getWorlds().getFirst().getSpawnLocation());
                    p.setGameMode(Bukkit.getDefaultGameMode());
                }
            }, 10L);
            return;
        }
        if (running && p.getUniqueId().equals(streamer)) {
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                p.setGameMode(GameMode.ADVENTURE);
                goRoom(p, room, false);
                plugin.pack.send(p);
                plugin.hud.show(p);
            }, 10L);
        }
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent e) {
        if (running && e.getPlayer().getUniqueId().equals(streamer)) {
            plugin.hud.hide(e.getPlayer());
            plugin.monster.sleep(false);
        }
    }
}
