package dev.livearena.plugin;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.sound.Sound;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextColor;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.title.Title;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.Particle;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.block.Chest;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.Creeper;
import org.bukkit.entity.Entity;
import org.bukkit.entity.EntityType;
import org.bukkit.entity.Fireball;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Mob;
import org.bukkit.entity.Player;
import org.bukkit.entity.TNTPrimed;
import org.bukkit.entity.Tameable;
import org.bukkit.entity.Warden;
import org.bukkit.inventory.EntityEquipment;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;
import org.bukkit.util.Vector;

/**
 * Efectos survival para lives, hechos desde cero para LiveArena. Todo en español.
 * Uso: /la efecto <nombre> <jugador> [espectador…]   (algunos admiten parámetros: ver ayuda)
 * Los mobs llevan el nombre del espectador encima y van a por el jugador.
 */
final class Effects {
    private final LiveArenaPlugin plugin;
    private final NamespacedKey tag;

    interface Fx {
        void run(Player p, String viewer, String[] args);
    }

    record Def(String id, String nombre, TextColor color, boolean bueno, String ayuda, Fx fx, boolean ownTitle) {}

    private final Map<String, Def> defs = new LinkedHashMap<>();

    final Vfx vfx;

    Effects(LiveArenaPlugin plugin) {
        this.plugin = plugin;
        this.tag = new NamespacedKey(plugin, "efecto");
        this.vfx = new Vfx(plugin);
        register();
        new Specials(plugin, this, vfx).register();
        new Characters(plugin, this, vfx).register();
    }

    NamespacedKey tag() {
        return tag;
    }

    Map<String, Def> all() {
        return defs;
    }

    /** Quita todos los mobs invocados por efectos. Devuelve cuántos. */
    int clear() {
        int n = vfx.cleanup();
        for (World w : Bukkit.getWorlds())
            for (LivingEntity e : w.getLivingEntities())
                if (e.getPersistentDataContainer().has(tag, PersistentDataType.BYTE)) {
                    e.remove();
                    n++;
                }
        return n;
    }

    /* --------------------------------- utilidades --------------------------------- */

    private static final ThreadLocalRandom R = ThreadLocalRandom.current();

    static ThreadLocalRandom rnd() {
        return ThreadLocalRandom.current();
    }

    static double rndAngle() {
        return ThreadLocalRandom.current().nextDouble(Math.PI * 2);
    }

    static TextColor hex(String h) {
        TextColor c = TextColor.fromHexString(h);
        return c == null ? NamedTextColor.WHITE : c;
    }

    void add(String id, String nombre, String color, boolean bueno, String ayuda, Fx fx) {
        defs.put(id, new Def(id, nombre, hex(color), bueno, ayuda, fx, false));
    }

    /** Efecto con títulos propios (no se muestra el título genérico, solo el aviso en el chat). */
    void addSpecial(String id, String nombre, String color, boolean bueno, String ayuda, Fx fx) {
        defs.put(id, new Def(id, nombre, hex(color), bueno, ayuda, fx, true));
    }

    private int maxMobs() {
        return Math.max(0, plugin.getConfig().getInt("efectos.max-mobs", 150));
    }

    private int liveMobs() {
        int n = 0;
        for (World w : Bukkit.getWorlds()) for (LivingEntity e : w.getLivingEntities()) if (e.getPersistentDataContainer().has(tag, PersistentDataType.BYTE)) n++;
        return n;
    }

    /** Sitio libre cerca del jugador (en el suelo, a cierta distancia). */
    static Location around(Player p, double min, double max) {
        Location base = p.getLocation();
        World w = base.getWorld();
        for (int i = 0; i < 12; i++) {
            double ang = R.nextDouble(Math.PI * 2);
            double d = min + R.nextDouble(Math.max(0.1, max - min));
            int x = base.getBlockX() + (int) Math.round(Math.cos(ang) * d);
            int z = base.getBlockZ() + (int) Math.round(Math.sin(ang) * d);
            int y = base.getBlockY();
            for (int dy = 3; dy >= -4; dy--) {
                Block feet = w.getBlockAt(x, y + dy, z);
                if (feet.isPassable() && feet.getRelative(0, 1, 0).isPassable() && !feet.getRelative(0, -1, 0).isPassable())
                    return feet.getLocation().add(0.5, 0, 0.5);
            }
        }
        return base.clone().add(R.nextDouble(-2, 2), 0, R.nextDouble(-2, 2));
    }

    Component viewerName(String viewer, TextColor color) {
        return Component.text(viewer == null || viewer.isBlank() ? "LIVE" : viewer, color).decorate(TextDecoration.BOLD);
    }

    /** Invoca un mob con el nombre del espectador que va a por el jugador. */
    Entity mob(Player p, EntityType type, String viewer, TextColor color, double min, double max) {
        if (maxMobs() > 0 && liveMobs() >= maxMobs()) {
            p.sendActionBar(Component.text("Límite de mobs alcanzado (" + maxMobs() + ")", NamedTextColor.RED));
            return null;
        }
        Location loc = around(p, min, max);
        World w = loc.getWorld();
        Entity e = w.spawnEntity(loc, type);
        e.customName(viewerName(viewer, color));
        e.setCustomNameVisible(plugin.getConfig().getBoolean("efectos.nombres-siempre-visibles", true));
        e.getPersistentDataContainer().set(tag, PersistentDataType.BYTE, (byte) 1);
        if (e instanceof Mob m) m.setTarget(p);
        w.spawnParticle(Particle.CLOUD, loc.clone().add(0, 1, 0), 20, 0.4, 0.6, 0.4, 0.02);
        w.spawnParticle(Particle.WITCH, loc.clone().add(0, 1, 0), 15, 0.3, 0.6, 0.3, 0.1);
        return e;
    }

    private static ItemStack item(Material m, int n) {
        return new ItemStack(m, n);
    }

    private static ItemStack enchanted(Material m, Enchantment e, int lvl) {
        ItemStack it = new ItemStack(m);
        ItemMeta meta = it.getItemMeta();
        meta.addEnchant(e, lvl, true);
        it.setItemMeta(meta);
        return it;
    }

    static void give(Player p, ItemStack... items) {
        for (ItemStack left : p.getInventory().addItem(items).values()) p.getWorld().dropItemNaturally(p.getLocation(), left);
    }

    private static <T> T pick(List<T> list) {
        return list.get(R.nextInt(list.size()));
    }

    static int arg(String[] a, int i, int def, int min, int max) {
        if (a == null || a.length <= i) return def;
        try {
            return Math.max(min, Math.min(max, Integer.parseInt(a[i])));
        } catch (NumberFormatException e) {
            return def;
        }
    }

    private static void sound(Player p, String key, float vol, float pitch) {
        p.playSound(Sound.sound(Key.key("minecraft", key), Sound.Source.MASTER, vol, pitch));
    }

    private void box(Player p, Material m, boolean roof, int r) {
        Location c = p.getLocation();
        World w = c.getWorld();
        int bx = c.getBlockX(), by = c.getBlockY(), bz = c.getBlockZ();
        for (int x = -r; x <= r; x++)
            for (int y = -1; y <= 3; y++)
                for (int z = -r; z <= r; z++) {
                    boolean wall = Math.abs(x) == r || Math.abs(z) == r || y == -1 || (roof && y == 3);
                    Block b = w.getBlockAt(bx + x, by + y, bz + z);
                    if (wall && b.getType() != Material.BEDROCK) b.setType(m, false);
                    else if (!wall && y >= 0 && y <= 2) b.setType(Material.AIR, false);
                }
        p.teleport(new Location(w, bx + 0.5, by, bz + 0.5, c.getYaw(), c.getPitch()));
    }

    /* ------------------------------- anuncio común ------------------------------- */

    void announce(Player p, Def d, String viewer) {
        Component t = Component.text(d.nombre(), d.color()).decorate(TextDecoration.BOLD);
        Component sub = Component.text(d.bueno() ? "regalo de " : "enviado por ", NamedTextColor.WHITE).append(Component.text(viewer.isBlank() ? "el chat" : viewer, NamedTextColor.YELLOW).decorate(TextDecoration.BOLD));
        if (!d.ownTitle()) p.showTitle(Title.title(t, sub, Title.Times.times(Duration.ofMillis(120), Duration.ofMillis(1400), Duration.ofMillis(350))));
        if (plugin.getConfig().getBoolean("efectos.anunciar-en-chat", true)) {
            Component msg = Component.text("[", NamedTextColor.DARK_GRAY)
                    .append(Component.text("LIVE", d.bueno() ? NamedTextColor.GREEN : NamedTextColor.RED).decorate(TextDecoration.BOLD))
                    .append(Component.text("] ", NamedTextColor.DARK_GRAY))
                    .append(Component.text(viewer.isBlank() ? "Alguien" : viewer, NamedTextColor.YELLOW))
                    .append(Component.text(" → ", NamedTextColor.GRAY))
                    .append(Component.text(d.nombre(), d.color()).decorate(TextDecoration.BOLD));
            Bukkit.getServer().sendMessage(msg);
        }
        sound(p, d.bueno() ? "entity.player.levelup" : "entity.elder_guardian.curse", 0.6f, d.bueno() ? 1.4f : 1.6f);
    }

    boolean run(String id, Player p, String viewer, String[] args) {
        Def d = defs.get(id);
        if (d == null) return false;
        if (Minijuego.en(p)) return true; // en Base Defense los efectos survival no hacen nada
        announce(p, d, viewer);
        d.fx().run(p, viewer, args);
        return true;
    }

    /* ---------------------------------- efectos ---------------------------------- */

    private void register() {
        // ---------- Regalos buenos ----------
        add("manzana", "MANZANA DORADA", "#ffd166", true, "Manzana dorada encantada", (p, v, a) -> {
            give(p, item(Material.ENCHANTED_GOLDEN_APPLE, 1));
            p.getWorld().spawnParticle(Particle.HAPPY_VILLAGER, p.getLocation().add(0, 1.2, 0), 25, 0.5, 0.6, 0.5);
        });
        add("totem", "TÓTEM", "#ffcc33", true, "Un tótem de la inmortalidad (objeto)", (p, v, a) -> give(p, item(Material.TOTEM_OF_UNDYING, 1)));
        add("arco", "ARCO INFINITO", "#9be7ff", true, "Arco con Infinidad + 1 flecha", (p, v, a) -> give(p, enchanted(Material.BOW, Enchantment.INFINITY, 1), item(Material.ARROW, 1)));
        add("espada", "ESPADA", "#e5e7eb", true, "Espada aleatoria con Filo III", (p, v, a) -> give(p, enchanted(pick(List.of(Material.STONE_SWORD, Material.IRON_SWORD, Material.GOLDEN_SWORD, Material.DIAMOND_SWORD, Material.NETHERITE_SWORD)), Enchantment.SHARPNESS, 3)));
        add("armadura", "ARMADURA", "#93c5fd", true, "Armadura aleatoria con Protección III", (p, v, a) -> {
            String mat = pick(List.of("LEATHER", "CHAINMAIL", "IRON", "GOLDEN", "DIAMOND", "NETHERITE"));
            for (String part : List.of("HELMET", "CHESTPLATE", "LEGGINGS", "BOOTS")) {
                Material m = Material.matchMaterial(mat + "_" + part);
                if (m != null) give(p, enchanted(m, Enchantment.PROTECTION, 3));
            }
        });
        add("herramientas", "HERRAMIENTAS", "#a78bfa", true, "Pico, hacha y pala de netherite", (p, v, a) -> give(p, item(Material.NETHERITE_PICKAXE, 1), item(Material.NETHERITE_AXE, 1), item(Material.NETHERITE_SHOVEL, 1)));
        add("comida", "COMIDA", "#f59e0b", true, "10 carnes cocinadas al azar", (p, v, a) -> {
            List<Material> f = List.of(Material.COOKED_BEEF, Material.COOKED_PORKCHOP, Material.COOKED_CHICKEN, Material.COOKED_MUTTON, Material.COOKED_RABBIT, Material.COOKED_SALMON);
            for (int i = 0; i < 10; i++) give(p, item(pick(f), 1));
        });
        add("perlas", "PERLAS DE ENDER", "#34d399", true, "16 perlas de ender", (p, v, a) -> give(p, item(Material.ENDER_PEARL, 16)));
        add("cofre", "COFRE", "#facc15", true, "Cofre con botín normal al lado", (p, v, a) -> chest(p, false));
        add("cofre_epico", "COFRE ÉPICO", "#fde047", true, "Cofre con botín raro y poderoso", (p, v, a) -> chest(p, true));
        add("perro", "PERRO", "#d6d3d1", true, "Un lobo amigo que te defiende", (p, v, a) -> {
            Entity e = mob(p, EntityType.WOLF, v, hex("#d6d3d1"), 1, 3);
            if (e instanceof Tameable t) {
                t.setTamed(true);
                t.setOwner(p);
            }
            if (e instanceof Mob m) m.setTarget(null);
        });
        add("golem", "GÓLEM DE HIERRO", "#cbd5e1", true, "Un gólem que te protege", (p, v, a) -> {
            Entity e = mob(p, EntityType.IRON_GOLEM, v, hex("#cbd5e1"), 2, 4);
            if (e instanceof Mob m) m.setTarget(null);
        });
        add("velocidad", "VELOCIDAD", "#7dd3fc", true, "Velocidad II [segundos]", (p, v, a) -> p.addPotionEffect(new PotionEffect(PotionEffectType.SPEED, arg(a, 0, 30, 1, 3600) * 20, 1)));
        add("salto", "SUPERSALTO", "#86efac", true, "Supersalto II [segundos]", (p, v, a) -> p.addPotionEffect(new PotionEffect(PotionEffectType.JUMP_BOOST, arg(a, 0, 30, 1, 3600) * 20, 1)));
        add("fuerza", "FUERZA", "#f87171", true, "Fuerza II [segundos]", (p, v, a) -> p.addPotionEffect(new PotionEffect(PotionEffectType.STRENGTH, arg(a, 0, 30, 1, 3600) * 20, 1)));
        add("regeneracion", "REGENERACIÓN", "#f472b6", true, "Regeneración II [segundos]", (p, v, a) -> p.addPotionEffect(new PotionEffect(PotionEffectType.REGENERATION, arg(a, 0, 20, 1, 3600) * 20, 1)));
        add("curar", "CURACIÓN", "#fb7185", true, "Vida y hambre al máximo", (p, v, a) -> {
            try {
                p.setHealth(20.0);
            } catch (IllegalArgumentException ignored) {
                /* vida máxima menor de 20 */
            }
            p.setFoodLevel(20);
            p.setSaturation(20f);
            p.getWorld().spawnParticle(Particle.HEART, p.getLocation().add(0, 2, 0), 12, 0.6, 0.4, 0.6);
        });

        // ---------- Mobs ----------
        add("zombie", "ZOMBIE", "#65a30d", false, "Zombie [armadura: ninguna|cuero|hierro|diamante|netherite]", (p, v, a) -> {
            Entity e = mob(p, EntityType.ZOMBIE, v, hex("#65a30d"), 4, 8);
            if (e instanceof LivingEntity le && a != null && a.length > 0) armor(le, a[0]);
        });
        add("esqueleto", "ESQUELETO", "#d4d4d8", false, "Esqueleto arquero", (p, v, a) -> mob(p, EntityType.SKELETON, v, hex("#d4d4d8"), 6, 10));
        add("creeper", "CREEPER", "#22c55e", false, "Creeper que va a por ti", (p, v, a) -> mob(p, EntityType.CREEPER, v, hex("#22c55e"), 4, 7));
        add("creeper_cargado", "CREEPER CARGADO", "#38bdf8", false, "Creeper electrificado", (p, v, a) -> {
            Entity e = mob(p, EntityType.CREEPER, v, hex("#38bdf8"), 5, 8);
            if (e instanceof Creeper c) c.setPowered(true);
            p.getWorld().strikeLightningEffect(e != null ? e.getLocation() : p.getLocation());
        });
        add("arana", "ARAÑA", "#7c3aed", false, "Araña", (p, v, a) -> mob(p, EntityType.SPIDER, v, hex("#7c3aed"), 4, 8));
        add("bruja", "BRUJA", "#a21caf", false, "Bruja", (p, v, a) -> mob(p, EntityType.WITCH, v, hex("#a21caf"), 5, 9));
        add("blaze", "BLAZE", "#f97316", false, "Blaze", (p, v, a) -> mob(p, EntityType.BLAZE, v, hex("#f97316"), 5, 9));
        add("abeja", "ABEJA FURIOSA", "#facc15", false, "Abeja enfadada", (p, v, a) -> mob(p, EntityType.BEE, v, hex("#facc15"), 2, 5));
        add("piglin", "PIGLIN BRUTO", "#d97706", false, "Piglin bruto con hacha", (p, v, a) -> mob(p, EntityType.PIGLIN_BRUTE, v, hex("#d97706"), 5, 8));
        add("ravager", "DEVASTADOR", "#78350f", false, "Devastador", (p, v, a) -> mob(p, EntityType.RAVAGER, v, hex("#b45309"), 7, 11));
        add("ghast", "GHAST", "#f5f5f5", false, "Ghast", (p, v, a) -> {
            Location l = around(p, 8, 14).add(0, 6, 0);
            Entity e = mob(p, EntityType.GHAST, v, hex("#f5f5f5"), 8, 14);
            if (e != null) e.teleport(l);
        });
        add("evocador", "EVOCADOR", "#94a3b8", false, "Evocador con colmillos y vexes", (p, v, a) -> mob(p, EntityType.EVOKER, v, hex("#94a3b8"), 6, 10));
        add("gigante", "ZOMBIE GIGANTE", "#4d7c0f", false, "Zombie gigante", (p, v, a) -> mob(p, EntityType.GIANT, v, hex("#4d7c0f"), 10, 14));
        add("warden", "WARDEN", "#0f766e", false, "El Warden, furioso contigo", (p, v, a) -> {
            Entity e = mob(p, EntityType.WARDEN, v, hex("#14b8a6"), 10, 14);
            if (e instanceof Warden w) w.setAnger(p, 150);
            sound(p, "entity.warden.emerge", 1f, 1f);
        });
        add("wither", "WITHER", "#18181b", false, "El Wither", (p, v, a) -> mob(p, EntityType.WITHER, v, hex("#a1a1aa"), 10, 14));
        add("mob", "MOB SORPRESA", "#e879f9", false, "Un mob al azar (sin jefes)", (p, v, a) -> mob(p, pick(List.of(EntityType.ZOMBIE, EntityType.SKELETON, EntityType.CREEPER, EntityType.SPIDER, EntityType.WITCH, EntityType.BLAZE, EntityType.PIGLIN_BRUTE, EntityType.VINDICATOR, EntityType.PILLAGER, EntityType.HUSK, EntityType.STRAY)), v, hex("#e879f9"), 4, 9));
        add("jefe", "JEFE", "#dc2626", false, "Un jefe al azar (Warden, Wither, Devastador…)", (p, v, a) -> {
            EntityType t = pick(List.of(EntityType.WARDEN, EntityType.WITHER, EntityType.RAVAGER, EntityType.EVOKER, EntityType.GIANT));
            Entity e = mob(p, t, v, hex("#dc2626"), 9, 13);
            if (e instanceof Warden w) w.setAnger(p, 150);
        });
        add("horda", "HORDA", "#991b1b", false, "Saqueadores, vindicadores y un devastador", (p, v, a) -> {
            for (int i = 0; i < 4; i++) mob(p, EntityType.PILLAGER, v, hex("#ef4444"), 8, 14);
            for (int i = 0; i < 3; i++) mob(p, EntityType.VINDICATOR, v, hex("#ef4444"), 8, 14);
            mob(p, EntityType.RAVAGER, v, hex("#ef4444"), 10, 14);
            mob(p, EntityType.EVOKER, v, hex("#ef4444"), 10, 14);
            sound(p, "event.raid.horn", 1f, 1f);
        });

        // ---------- Trampas y caos ----------
        add("telarana", "TELARAÑA", "#e5e7eb", false, "Te atrapa en telarañas", (p, v, a) -> {
            Location c = p.getLocation();
            for (int x = -1; x <= 1; x++)
                for (int y = 0; y <= 1; y++)
                    for (int z = -1; z <= 1; z++) {
                        Block b = c.clone().add(x, y, z).getBlock();
                        if (b.isPassable()) b.setType(Material.COBWEB, false);
                    }
        });
        add("caja_obsidiana", "CAJA DE OBSIDIANA", "#6d28d9", false, "Te encierra en obsidiana", (p, v, a) -> box(p, Material.OBSIDIAN, true, 2));
        add("jaula_abejas", "JAULA DE ABEJAS", "#f59e0b", false, "Jaula de miel con abejas dentro", (p, v, a) -> {
            box(p, Material.HONEY_BLOCK, true, 2);
            for (int i = 0; i < 4; i++) {
                Entity e = p.getWorld().spawnEntity(p.getLocation().add(R.nextDouble(-1, 1), 1.5, R.nextDouble(-1, 1)), EntityType.BEE);
                e.customName(viewerName(v, hex("#facc15")));
                e.getPersistentDataContainer().set(tag, PersistentDataType.BYTE, (byte) 1);
                if (e instanceof Mob m) m.setTarget(p);
            }
        });
        add("pozo", "POZO", "#57534e", false, "Abre un pozo bajo tus pies [ancho] [hondo]", (p, v, a) -> {
            int w = arg(a, 0, 3, 1, 9), h = arg(a, 1, 12, 2, 60);
            Location c = p.getLocation();
            int r = w / 2;
            for (int x = -r; x <= r; x++)
                for (int z = -r; z <= r; z++)
                    for (int y = -1; y >= -h; y--) {
                        Block b = c.clone().add(x, y, z).getBlock();
                        if (b.getType() != Material.BEDROCK) b.setType(Material.AIR, false);
                    }
        });
        add("pozo_lava", "POZO DE LAVA", "#ea580c", false, "Pozo con lava al fondo", (p, v, a) -> {
            Location c = p.getLocation();
            for (int x = -1; x <= 1; x++)
                for (int z = -1; z <= 1; z++) {
                    for (int y = -1; y >= -8; y--) {
                        Block b = c.clone().add(x, y, z).getBlock();
                        if (b.getType() != Material.BEDROCK) b.setType(Material.AIR, false);
                    }
                    Block bottom = c.clone().add(x, -9, z).getBlock();
                    if (bottom.getType() != Material.BEDROCK) bottom.setType(Material.LAVA, false);
                }
        });
        add("caida", "CAÍDA LIBRE", "#38bdf8", false, "Cubo de agua y ¡200 bloques arriba!", (p, v, a) -> {
            give(p, item(Material.WATER_BUCKET, 1));
            Location l = p.getLocation().add(0, arg(a, 0, 200, 20, 300), 0);
            p.teleport(l);
            sound(p, "entity.phantom.swoop", 1f, 1f);
        });
        add("congelar", "CONGELADO", "#a5f3fc", false, "No te puedes mover [segundos]", (p, v, a) -> {
            int s = arg(a, 0, 10, 1, 120);
            p.addPotionEffect(new PotionEffect(PotionEffectType.SLOWNESS, s * 20, 255, false, false));
            p.addPotionEffect(new PotionEffect(PotionEffectType.MINING_FATIGUE, s * 20, 255, false, false));
            p.setFreezeTicks(Math.min(140, s * 20));
            p.getWorld().spawnParticle(Particle.SNOWFLAKE, p.getLocation().add(0, 1, 0), 60, 0.5, 1, 0.5, 0.02);
        });
        add("carcel", "CÁRCEL", "#9ca3af", false, "Barrotes de hierro alrededor [segundos]", (p, v, a) -> {
            int s = arg(a, 0, 20, 3, 600);
            List<Block> placed = new ArrayList<>();
            Location c = p.getLocation();
            for (int x = -1; x <= 1; x++)
                for (int y = -1; y <= 2; y++)
                    for (int z = -1; z <= 1; z++) {
                        boolean edge = Math.abs(x) == 1 || Math.abs(z) == 1 || y == -1 || y == 2;
                        if (!edge) continue;
                        Block b = c.clone().add(x, y, z).getBlock();
                        if (b.getType() == Material.AIR || b.isPassable()) {
                            b.setType(y == -1 || y == 2 ? Material.STONE_BRICKS : Material.IRON_BARS, true);
                            placed.add(b);
                        }
                    }
            p.teleport(c.getBlock().getLocation().add(0.5, 0, 0.5));
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                for (Block b : placed) if (b.getType() == Material.IRON_BARS || b.getType() == Material.STONE_BRICKS) b.setType(Material.AIR);
                p.sendActionBar(Component.text("¡Libre!", NamedTextColor.GREEN));
            }, s * 20L);
        });
        add("rayo", "RAYO", "#fde047", false, "Rayo sobre ti", (p, v, a) -> p.getWorld().strikeLightning(p.getLocation()));
        add("tnt", "TNT", "#dc2626", false, "TNT cerca [mecha en ticks] [cantidad]", (p, v, a) -> {
            int fuse = arg(a, 0, 60, 10, 400), n = arg(a, 1, 1, 1, 30);
            for (int i = 0; i < n; i++) {
                Entity e = p.getWorld().spawnEntity(around(p, 1, 4).add(0, 2, 0), EntityType.TNT);
                if (e instanceof TNTPrimed t) t.setFuseTicks(fuse + i * 4);
            }
        });
        add("caja_tnt", "CAJA DE TNT", "#b91c1c", false, "Rodeado de TNT y creepers", (p, v, a) -> {
            Location c = p.getLocation();
            for (int x = -2; x <= 2; x++)
                for (int z = -2; z <= 2; z++) {
                    if (Math.abs(x) != 2 && Math.abs(z) != 2) continue;
                    Block b = c.clone().add(x, 0, z).getBlock();
                    if (b.isPassable()) b.setType(Material.TNT, false);
                }
            for (int i = 0; i < 3; i++) mob(p, EntityType.CREEPER, v, hex("#22c55e"), 4, 7);
        });
        add("meteoritos", "LLUVIA DE METEORITOS", "#fb923c", false, "Bolas de fuego del cielo [cantidad]", (p, v, a) -> {
            int n = arg(a, 0, 8, 1, 40);
            for (int i = 0; i < n; i++) {
                final int k = i;
                Bukkit.getScheduler().runTaskLater(plugin, () -> {
                    if (!p.isOnline()) return;
                    Location from = around(p, 0, 10).add(0, 30 + R.nextInt(10), 0);
                    Entity e = p.getWorld().spawnEntity(from, EntityType.FIREBALL);
                    if (e instanceof Fireball f) {
                        f.setDirection(new Vector(0, -1, 0));
                        f.setYield(2f + R.nextFloat() * 1.5f);
                    }
                    p.getWorld().spawnParticle(Particle.FLAME, from, 20, 0.5, 0.5, 0.5, 0.05);
                }, k * 8L);
            }
        });
        add("lanzar", "¡POR LOS AIRES!", "#c084fc", false, "Te lanza hacia arriba", (p, v, a) -> {
            p.setVelocity(new Vector(R.nextDouble(-0.4, 0.4), 2.2, R.nextDouble(-0.4, 0.4)));
            p.getWorld().spawnParticle(Particle.EXPLOSION, p.getLocation(), 3);
            sound(p, "entity.generic.explode", 0.8f, 1.2f);
        });
        add("vaciar", "INVENTARIO VACÍO", "#ef4444", false, "Te vacía el inventario", (p, v, a) -> p.getInventory().clear());
        add("hambre", "HAMBRE", "#a16207", false, "Te quita la comida", (p, v, a) -> {
            p.setFoodLevel(2);
            p.setSaturation(0f);
            p.addPotionEffect(new PotionEffect(PotionEffectType.HUNGER, 30 * 20, 1));
        });
        add("ceguera", "CEGUERA", "#111827", false, "No ves nada [segundos]", (p, v, a) -> p.addPotionEffect(new PotionEffect(PotionEffectType.BLINDNESS, arg(a, 0, 10, 1, 120) * 20, 0)));
        add("noche", "NOCHE", "#1e3a8a", false, "Se hace de noche", (p, v, a) -> p.getWorld().setTime(14000));
        add("dia", "DÍA", "#fde68a", true, "Se hace de día", (p, v, a) -> p.getWorld().setTime(1000));
        add("matar", "MUERTE", "#7f1d1d", false, "Mata al jugador", (p, v, a) -> p.setHealth(0));

        // Paridad con el s2e original
        add("set", "EQUIPO BÁSICO", "#cbd5e1", true, "Da armadura y espada de hierro por defecto", (p, v, a) -> {
            EntityEquipment eq = p.getEquipment();
            eq.setHelmet(new ItemStack(Material.IRON_HELMET));
            eq.setChestplate(new ItemStack(Material.IRON_CHESTPLATE));
            eq.setLeggings(new ItemStack(Material.IRON_LEGGINGS));
            eq.setBoots(new ItemStack(Material.IRON_BOOTS));
            give(p, item(Material.IRON_SWORD, 1));
        });
        add("saciedad", "SACIEDAD", "#86efac", true, "No pierdes hambre [segundos]", (p, v, a) -> {
            p.setFoodLevel(20);
            p.setSaturation(20f);
            p.addPotionEffect(new PotionEffect(PotionEffectType.SATURATION, arg(a, 0, 60, 1, 3600) * 20, 0, false, false));
        });
        add("jinetes_esqueleto", "JINETES ESQUELETO", "#a3a3a3", false, "Esqueletos montados en arañas [cantidad]", (p, v, a) -> {
            int n = arg(a, 0, 3, 1, 10);
            for (int i = 0; i < n; i++) {
                Entity spider = mob(p, EntityType.SPIDER, v, hex("#7c3aed"), 5, 9);
                if (spider == null) break;
                Entity sk = p.getWorld().spawnEntity(spider.getLocation().add(0, 1, 0), EntityType.SKELETON);
                sk.customName(viewerName(v, hex("#a3a3a3")));
                sk.getPersistentDataContainer().set(tag, PersistentDataType.BYTE, (byte) 1);
                spider.addPassenger(sk);
                if (sk instanceof Mob m) m.setTarget(p);
            }
        });
        add("armob", "MOB EN RADIO", "#e879f9", false, "Mob al azar (con jefes) en un radio [radio]", (p, v, a) -> {
            int r = arg(a, 0, 8, 2, 30);
            mob(p, pick(List.of(EntityType.ZOMBIE, EntityType.SKELETON, EntityType.CREEPER, EntityType.RAVAGER, EntityType.WITHER, EntityType.WARDEN, EntityType.EVOKER, EntityType.VINDICATOR, EntityType.WITCH, EntityType.BLAZE)), v, hex("#e879f9"), r * 0.6, r);
        });
        add("rmob", "MOB EN RADIO (SIN JEFES)", "#e879f9", false, "Mob al azar sin jefes en un radio [radio]", (p, v, a) -> {
            int r = arg(a, 0, 8, 2, 30);
            mob(p, pick(List.of(EntityType.ZOMBIE, EntityType.SKELETON, EntityType.CREEPER, EntityType.SPIDER, EntityType.HUSK, EntityType.STRAY, EntityType.PILLAGER, EntityType.VINDICATOR)), v, hex("#e879f9"), r * 0.6, r);
        });
        add("matar_todos", "MUERTE TOTAL", "#7f1d1d", false, "Mata a TODOS los jugadores", (p, v, a) -> {
            for (Player pl : Bukkit.getOnlinePlayers()) pl.setHealth(0);
        });
        add("vaciar_todos", "VACIAR A TODOS", "#ef4444", false, "Vacía el inventario de TODOS", (p, v, a) -> {
            for (Player pl : Bukkit.getOnlinePlayers()) pl.getInventory().clear();
        });
        add("rayo_todos", "RAYO A TODOS", "#fde047", false, "Un rayo sobre cada jugador", (p, v, a) -> {
            for (Player pl : Bukkit.getOnlinePlayers()) pl.getWorld().strikeLightning(pl.getLocation());
        });

    }

    private void armor(LivingEntity e, String kind) {
        String k = kind.toLowerCase();
        String prefix = switch (k) {
            case "cuero", "leather" -> "LEATHER";
            case "malla", "chainmail" -> "CHAINMAIL";
            case "hierro", "iron" -> "IRON";
            case "oro", "gold", "golden" -> "GOLDEN";
            case "diamante", "diamond" -> "DIAMOND";
            case "netherite" -> "NETHERITE";
            default -> null;
        };
        if (prefix == null) return;
        EntityEquipment eq = e.getEquipment();
        if (eq == null) return;
        Material h = Material.matchMaterial(prefix + "_HELMET"), c = Material.matchMaterial(prefix + "_CHESTPLATE"), l = Material.matchMaterial(prefix + "_LEGGINGS"), b = Material.matchMaterial(prefix + "_BOOTS");
        if (h != null) eq.setHelmet(new ItemStack(h));
        if (c != null) eq.setChestplate(new ItemStack(c));
        if (l != null) eq.setLeggings(new ItemStack(l));
        if (b != null) eq.setBoots(new ItemStack(b));
    }

    private void chest(Player p, boolean epic) {
        Location l = around(p, 1, 2);
        Block b = l.getBlock();
        b.setType(Material.CHEST);
        if (!(b.getState() instanceof Chest chest)) return;
        List<ItemStack> loot = new ArrayList<>();
        if (epic) {
            loot.add(item(Material.ENCHANTED_GOLDEN_APPLE, 2));
            loot.add(item(Material.TOTEM_OF_UNDYING, 1));
            loot.add(enchanted(Material.NETHERITE_SWORD, Enchantment.SHARPNESS, 5));
            loot.add(enchanted(Material.NETHERITE_CHESTPLATE, Enchantment.PROTECTION, 4));
            loot.add(item(Material.DIAMOND, 8 + R.nextInt(8)));
            loot.add(item(Material.NETHERITE_INGOT, 1 + R.nextInt(2)));
            loot.add(item(Material.ENDER_PEARL, 16));
            loot.add(item(Material.EXPERIENCE_BOTTLE, 32));
        } else {
            loot.add(item(Material.BREAD, 8));
            loot.add(item(Material.IRON_INGOT, 4 + R.nextInt(6)));
            loot.add(item(Material.GOLDEN_APPLE, 1));
            loot.add(item(Material.ARROW, 16));
            loot.add(item(Material.OAK_LOG, 16));
            loot.add(item(pick(List.of(Material.IRON_SWORD, Material.IRON_PICKAXE, Material.IRON_AXE, Material.SHIELD)), 1));
            if (R.nextBoolean()) loot.add(item(Material.DIAMOND, 1 + R.nextInt(3)));
        }
        for (ItemStack it : loot) chest.getBlockInventory().addItem(it);
        l.getWorld().spawnParticle(Particle.END_ROD, l.clone().add(0.5, 1, 0.5), 40, 0.4, 0.6, 0.4, 0.05);
        if (epic) l.getWorld().strikeLightningEffect(l);
    }
}
