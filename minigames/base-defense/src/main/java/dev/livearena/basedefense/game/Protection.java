package dev.livearena.basedefense.game;

import dev.livearena.basedefense.BaseDefense;
import org.bukkit.GameMode;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockBurnEvent;
import org.bukkit.event.block.BlockExplodeEvent;
import org.bukkit.event.block.BlockFadeEvent;
import org.bukkit.event.block.BlockFormEvent;
import org.bukkit.event.block.BlockFromToEvent;
import org.bukkit.event.block.BlockIgniteEvent;
import org.bukkit.event.block.BlockPhysicsEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.block.BlockSpreadEvent;
import org.bukkit.event.block.LeavesDecayEvent;
import org.bukkit.event.entity.CreatureSpawnEvent;
import org.bukkit.event.entity.CreeperPowerEvent;
import org.bukkit.event.entity.EntityChangeBlockEvent;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.entity.EntityExplodeEvent;
import org.bukkit.event.entity.EntityPortalEvent;
import org.bukkit.event.entity.FoodLevelChangeEvent;
import org.bukkit.event.hanging.HangingBreakEvent;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.event.player.PlayerDropItemEvent;
import org.bukkit.event.player.PlayerInteractEntityEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerItemDamageEvent;
import org.bukkit.event.player.PlayerPortalEvent;
import org.bukkit.event.weather.WeatherChangeEvent;

/**
 * Mundo del juego intocable: nada rompe ni coloca bloques, sin daño de explosiones al terreno, el
 * streamer no recibe daño ni hambre y no puede soltar las armas. Con la partida parada, un admin
 * en creativo puede retocar la arena a mano.
 */
public final class Protection implements Listener {
    private final BaseDefense plugin;

    public Protection(BaseDefense plugin) {
        this.plugin = plugin;
    }

    private boolean editing(Player p) {
        return p.getGameMode() == GameMode.CREATIVE && !plugin.game.running() && p.hasPermission("basedefense.admin");
    }

    @EventHandler(ignoreCancelled = true)
    public void onBreak(BlockBreakEvent e) {
        if (plugin.inGameWorld(e.getBlock().getWorld()) && !editing(e.getPlayer())) e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void onPlace(BlockPlaceEvent e) {
        if (plugin.inGameWorld(e.getBlock().getWorld()) && !editing(e.getPlayer())) e.setCancelled(true);
    }

    @EventHandler(priority = EventPriority.HIGHEST)
    public void onEntityExplode(EntityExplodeEvent e) {
        if (!plugin.inGameWorld(e.getEntity())) return;
        e.blockList().clear();
        e.setCancelled(true);
    }

    @EventHandler(priority = EventPriority.HIGHEST)
    public void onBlockExplode(BlockExplodeEvent e) {
        if (!plugin.inGameWorld(e.getBlock().getWorld())) return;
        e.blockList().clear();
        e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void onChange(EntityChangeBlockEvent e) {
        if (plugin.inGameWorld(e.getBlock().getWorld())) e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true) public void onBurn(BlockBurnEvent e) { if (plugin.inGameWorld(e.getBlock().getWorld())) e.setCancelled(true); }
    @EventHandler(ignoreCancelled = true) public void onIgnite(BlockIgniteEvent e) { if (plugin.inGameWorld(e.getBlock().getWorld())) e.setCancelled(true); }
    @EventHandler(ignoreCancelled = true) public void onSpread(BlockSpreadEvent e) { if (plugin.inGameWorld(e.getBlock().getWorld())) e.setCancelled(true); }
    @EventHandler(ignoreCancelled = true) public void onFade(BlockFadeEvent e) { if (plugin.inGameWorld(e.getBlock().getWorld())) e.setCancelled(true); }
    @EventHandler(ignoreCancelled = true) public void onForm(BlockFormEvent e) { if (plugin.inGameWorld(e.getBlock().getWorld())) e.setCancelled(true); }
    @EventHandler(ignoreCancelled = true) public void onFlow(BlockFromToEvent e) { if (plugin.inGameWorld(e.getBlock().getWorld())) e.setCancelled(true); }
    @EventHandler(ignoreCancelled = true) public void onDecay(LeavesDecayEvent e) { if (plugin.inGameWorld(e.getBlock().getWorld())) e.setCancelled(true); }
    @EventHandler(ignoreCancelled = true) public void onHanging(HangingBreakEvent e) { if (plugin.inGameWorld(e.getEntity())) e.setCancelled(true); }
    @EventHandler(ignoreCancelled = true) public void onPower(CreeperPowerEvent e) { if (plugin.inGameWorld(e.getEntity())) e.setCancelled(true); }

    /** El portal en ruinas y el resto del decorado no deben recalcularse (físicas apagadas en la arena). */
    @EventHandler(ignoreCancelled = true)
    public void onPhysics(BlockPhysicsEvent e) {
        if (plugin.inGameWorld(e.getBlock().getWorld())) e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void onWeather(WeatherChangeEvent e) {
        if (plugin.inGameWorld(e.getWorld()) && e.getCause() == WeatherChangeEvent.Cause.NATURAL) e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void onSpawn(CreatureSpawnEvent e) {
        if (!plugin.inGameWorld(e.getEntity())) return;
        // solo los mobs que invoca el plugin (CUSTOM); nada de spawn natural, huevos, etc.
        if (e.getSpawnReason() != CreatureSpawnEvent.SpawnReason.CUSTOM && e.getSpawnReason() != CreatureSpawnEvent.SpawnReason.COMMAND) e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void onPortal(EntityPortalEvent e) {
        if (plugin.inGameWorld(e.getEntity())) e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void onPlayerPortal(PlayerPortalEvent e) {
        if (plugin.inGameWorld(e.getPlayer())) e.setCancelled(true);
    }

    // ───────────────────────────── JUGADOR ─────────────────────────────

    @EventHandler(ignoreCancelled = true)
    public void onPlayerDamage(EntityDamageEvent e) {
        if (e.getEntity() instanceof Player p && plugin.inGameWorld(p)) {
            e.setCancelled(true);
            if (e.getCause() == EntityDamageEvent.DamageCause.VOID) p.teleport(plugin.arena != null && plugin.arena.valid() ? plugin.arena.spawn(p.getWorld()) : p.getWorld().getSpawnLocation());
        }
    }

    @EventHandler(ignoreCancelled = true)
    public void onHunger(FoodLevelChangeEvent e) {
        if (e.getEntity() instanceof Player p && plugin.inGameWorld(p)) {
            e.setCancelled(true);
            p.setFoodLevel(20);
        }
    }

    @EventHandler(ignoreCancelled = true)
    public void onDrop(PlayerDropItemEvent e) {
        if (plugin.weapons.isWeapon(e.getItemDrop().getItemStack()) || plugin.inGameWorld(e.getPlayer()) && plugin.game.running()) e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void onClick(InventoryClickEvent e) {
        if (!(e.getWhoClicked() instanceof Player p)) return;
        if (p.getGameMode() == GameMode.CREATIVE && !plugin.game.running()) return;
        boolean weapon = plugin.weapons.isWeapon(e.getCurrentItem()) || plugin.weapons.isWeapon(e.getCursor())
            || e.getHotbarButton() >= 0 && plugin.weapons.isWeapon(p.getInventory().getItem(e.getHotbarButton()));
        if (weapon || plugin.inGameWorld(p) && plugin.game.running()) e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void onDrag(InventoryDragEvent e) {
        if (plugin.weapons.isWeapon(e.getOldCursor())) e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void onItemDamage(PlayerItemDamageEvent e) {
        if (plugin.weapons.isWeapon(e.getItem())) e.setCancelled(true);
    }

    @EventHandler(priority = EventPriority.HIGH)
    public void onInteract(PlayerInteractEvent e) {
        if (plugin.inGameWorld(e.getPlayer()) && !editing(e.getPlayer()) && e.getClickedBlock() != null) e.setUseInteractedBlock(org.bukkit.event.Event.Result.DENY);
    }

    @EventHandler(ignoreCancelled = true)
    public void onInteractEntity(PlayerInteractEntityEvent e) {
        if (plugin.inGameWorld(e.getPlayer()) && !editing(e.getPlayer())) e.setCancelled(true);
    }
}
