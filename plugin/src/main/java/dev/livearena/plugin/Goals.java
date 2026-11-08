package dev.livearena.plugin;

import java.util.Locale;
import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;

/**
 * Reto con meta y barra de progreso, al estilo «Buscador de diamantes»: pones una meta, el chat la sube
 * o la baja con regalos, aparecen oleadas de mineral, se dan picos temporales y hay victoria/derrota.
 * Sirve también como marcador genérico (parkour, carreras…). Lo lee el overlay de metas.
 */
final class Goals implements Listener {
    private final LiveArenaPlugin plugin;
    private final Vfx v;

    private boolean active;
    private int progress;
    private int goal = 10;
    private Material resource = Material.DIAMOND_ORE;
    private Material item = Material.DIAMOND;
    private BossBar bar;

    Goals(LiveArenaPlugin plugin, Vfx v) {
        this.plugin = plugin;
        this.v = v;
    }

    boolean active() {
        return active;
    }

    int progress() {
        return progress;
    }

    int goal() {
        return goal;
    }

    private void updateBar() {
        if (bar == null) return;
        bar.name(Component.text("⛏ RETO  " + progress + " / " + goal, TextColor.color(0x5ef2ff)).decorate(TextDecoration.BOLD));
        bar.progress(goal > 0 ? Math.max(0f, Math.min(1f, progress / (float) goal)) : 0f);
    }

    private void showBar() {
        if (bar == null) bar = BossBar.bossBar(Component.empty(), 0f, BossBar.Color.BLUE, BossBar.Overlay.NOTCHED_10);
        updateBar();
        for (Player p : Bukkit.getOnlinePlayers()) p.showBossBar(bar);
    }

    void start(int startGoal) {
        active = true;
        progress = 0;
        goal = Math.max(1, startGoal);
        showBar();
        for (Player p : Bukkit.getOnlinePlayers()) Vfx.bigTitle(p, "⛏ ¡RETO!", TextColor.color(0x5ef2ff), "Meta: " + goal, NamedTextColor.WHITE, 2000);
    }

    void stop() {
        active = false;
        if (bar != null) for (Player p : Bukkit.getOnlinePlayers()) p.hideBossBar(bar);
        bar = null;
    }

    void addProgress(int n) {
        if (!active) return;
        progress = Math.max(0, progress + n);
        updateBar();
        if (progress >= goal) win();
    }

    void setProgress(int n) {
        progress = Math.max(0, n);
        updateBar();
    }

    void addGoal(int n) {
        goal = Math.max(1, goal + n);
        updateBar();
    }

    void setGoal(int n) {
        goal = Math.max(1, n);
        updateBar();
    }

    void setResource(String name) {
        switch (name.toLowerCase(Locale.ROOT)) {
            case "esmeralda", "emerald" -> {
                resource = Material.EMERALD_ORE;
                item = Material.EMERALD;
            }
            case "oro", "gold" -> {
                resource = Material.GOLD_ORE;
                item = Material.GOLD_INGOT;
            }
            case "netherite", "ancient", "debris" -> {
                resource = Material.ANCIENT_DEBRIS;
                item = Material.NETHERITE_SCRAP;
            }
            default -> {
                resource = Material.DIAMOND_ORE;
                item = Material.DIAMOND;
            }
        }
    }

    /** Oleada de mineral alrededor del jugador, opcionalmente temporal (se borra tras `seconds`). */
    void oreWave(Player p, int seconds) {
        World w = p.getWorld();
        Location c = p.getLocation();
        java.util.List<Block> placed = new java.util.ArrayList<>();
        for (int i = 0; i < 24; i++) {
            double a = Effects.rndAngle();
            double d = 2 + Vfx.rnd().nextDouble(6);
            Block b = w.getHighestBlockAt((int) (c.getX() + Math.cos(a) * d), (int) (c.getZ() + Math.sin(a) * d));
            if (b.getType().isSolid() && b.getType() != Material.BEDROCK) {
                b.setType(resource, false);
                placed.add(b);
                w.spawnParticle(Particle.END_ROD, b.getLocation().add(0.5, 1, 0.5), 6, 0.3, 0.3, 0.3, 0.02);
            }
        }
        Vfx.soundAt(c, "block.amethyst_block.chime", 1f, 1.2f);
        if (seconds > 0)
            v.later(seconds * 20L, () -> {
                for (Block b : placed) if (b.getType() == resource) b.setType(Material.STONE, false);
            });
    }

    void pickaxe(Player p, int seconds) {
        ItemStack pick = new ItemStack(Material.NETHERITE_PICKAXE);
        ItemMeta meta = pick.getItemMeta();
        meta.addEnchant(Enchantment.EFFICIENCY, 5, true);
        meta.addEnchant(Enchantment.FORTUNE, 3, true);
        pick.setItemMeta(meta);
        Effects.give(p, pick);
        p.addPotionEffect(new PotionEffect(PotionEffectType.HASTE, seconds * 20, 2));
        Vfx.actionBar(p, "¡Pico turbo " + seconds + "s!", NamedTextColor.AQUA);
    }

    void win() {
        active = false;
        for (Player p : Bukkit.getOnlinePlayers()) {
            Vfx.bigTitle(p, "🏆 ¡VICTORIA!", TextColor.color(0x34e0a1), "Meta cumplida", NamedTextColor.WHITE, 3000);
            p.getWorld().spawnParticle(Particle.TOTEM_OF_UNDYING, p.getLocation().add(0, 1, 0), 120, 1, 1.5, 1, 0.4);
            Vfx.sound(p, "ui.toast.challenge_complete", 1f, 1f);
            for (int i = 0; i < 6; i++) {
                final int k = i;
                v.later(i * 6L, () -> p.getWorld().spawn(p.getLocation().add(Vfx.rnd().nextDouble(-4, 4), 0, Vfx.rnd().nextDouble(-4, 4)), org.bukkit.entity.Firework.class, fw -> {
                    org.bukkit.inventory.meta.FireworkMeta fm = fw.getFireworkMeta();
                    fm.addEffect(org.bukkit.FireworkEffect.builder().withColor(org.bukkit.Color.AQUA, org.bukkit.Color.LIME).with(org.bukkit.FireworkEffect.Type.BALL_LARGE).withFlicker().build());
                    fm.setPower(1);
                    fw.setFireworkMeta(fm);
                }));
            }
        }
        if (bar != null) {
            bar.progress(1f);
            v.later(80, this::stop);
        }
    }

    void lose() {
        active = false;
        for (Player p : Bukkit.getOnlinePlayers()) {
            Vfx.bigTitle(p, "💀 DERROTA", TextColor.color(0xff4d6d), "Se acabó el tiempo", NamedTextColor.WHITE, 3000);
            p.getInventory().clear();
            Vfx.sound(p, "entity.wither.death", 1f, 0.8f);
            p.getWorld().strikeLightningEffect(p.getLocation());
        }
        v.later(60, this::stop);
    }

    @EventHandler
    public void onBreak(BlockBreakEvent e) {
        if (!active) return;
        if (e.getBlock().getType() == resource || e.getBlock().getType() == item) addProgress(1);
    }
}
