package dev.livearena.nosalpiques.game;

import dev.livearena.nosalpiques.NoSalpiquesLive;
import org.bukkit.GameMode;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockFadeEvent;
import org.bukkit.event.block.BlockFormEvent;
import org.bukkit.event.block.BlockFromToEvent;
import org.bukkit.event.block.BlockPhysicsEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.block.LeavesDecayEvent;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.entity.FoodLevelChangeEvent;
import org.bukkit.event.player.PlayerDropItemEvent;
import org.bukkit.event.player.PlayerInteractEvent;

/** En el mundo de la torre no se rompe nada, no hay daño ni hambre y los bloques no cambian solos. */
public final class Protection implements Listener {
    private final NoSalpiquesLive plugin;

    public Protection(NoSalpiquesLive plugin) {
        this.plugin = plugin;
    }

    private boolean here(org.bukkit.World w) {
        return w.getName().equals(plugin.settings.worldName);
    }

    private boolean builder(Player p) {
        return p.getGameMode() == GameMode.CREATIVE && p.hasPermission("nosalpiqueslive.admin");
    }

    @EventHandler(priority = EventPriority.HIGH)
    public void onDamage(EntityDamageEvent e) {
        if (here(e.getEntity().getWorld()) && e.getEntity() instanceof Player) e.setCancelled(true);
    }

    @EventHandler
    public void onFood(FoodLevelChangeEvent e) {
        if (here(e.getEntity().getWorld())) e.setCancelled(true);
    }

    @EventHandler
    public void onBreak(BlockBreakEvent e) {
        if (here(e.getBlock().getWorld()) && !builder(e.getPlayer())) e.setCancelled(true);
    }

    @EventHandler
    public void onPlace(BlockPlaceEvent e) {
        if (here(e.getBlock().getWorld()) && !builder(e.getPlayer())) e.setCancelled(true);
    }

    @EventHandler
    public void onDrop(PlayerDropItemEvent e) {
        if (here(e.getPlayer().getWorld()) && !builder(e.getPlayer())) e.setCancelled(true);
    }

    @EventHandler
    public void onInteract(PlayerInteractEvent e) {
        if (here(e.getPlayer().getWorld()) && !builder(e.getPlayer()) && e.getClickedBlock() != null) e.setCancelled(true);
    }

    @EventHandler public void onDecay(LeavesDecayEvent e) { if (here(e.getBlock().getWorld())) e.setCancelled(true); }
    @EventHandler public void onFade(BlockFadeEvent e) { if (here(e.getBlock().getWorld())) e.setCancelled(true); }
    @EventHandler public void onForm(BlockFormEvent e) { if (here(e.getBlock().getWorld())) e.setCancelled(true); }
    @EventHandler public void onFlow(BlockFromToEvent e) { if (here(e.getBlock().getWorld())) e.setCancelled(true); }

    @EventHandler
    public void onPhysics(BlockPhysicsEvent e) {
        if (here(e.getBlock().getWorld())) e.setCancelled(true);
    }
}
