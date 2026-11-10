package dev.livearena.plugin;

import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Item;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityPickupItemEvent;
import org.bukkit.event.entity.EntityResurrectEvent;
import org.bukkit.event.player.PlayerChangedWorldEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;

final class TotemListener implements Listener {
    private final LiveArenaPlugin plugin;
    private final TotemManager totems;

    TotemListener(LiveArenaPlugin plugin, TotemManager totems) {
        this.plugin = plugin;
        this.totems = totems;
    }

    /**
     * Paper lanza este evento cuando el jugador va a morir; llega cancelado si no tiene tótem en la mano.
     * Si tiene tótems guardados, lo «descancelamos»: el juego aplica la resurrección normal
     * (animación, regeneración, absorción y resistencia al fuego) y gastamos uno del contador.
     */
    @EventHandler(priority = EventPriority.HIGH)
    public void onResurrect(EntityResurrectEvent e) {
        if (!(e.getEntity() instanceof Player p)) return;
        if (!e.isCancelled()) return; // tiene un tótem real en la mano: se usa ese
        if (totems.get(p.getName()) <= 0) return;
        e.setCancelled(false);
        totems.add(p.getName(), -1);
        // Sin tótem en la mano el juego puede no aplicar los efectos: los ponemos igual que un tótem normal.
        Bukkit.getScheduler().runTask(plugin, () -> {
            if (p.isDead() || !p.isOnline()) return;
            if (p.getHealth() < 1.0) p.setHealth(1.0);
            p.addPotionEffect(new PotionEffect(PotionEffectType.REGENERATION, 900, 1));
            p.addPotionEffect(new PotionEffect(PotionEffectType.ABSORPTION, 100, 1));
            p.addPotionEffect(new PotionEffect(PotionEffectType.FIRE_RESISTANCE, 800, 0));
            totems.announceUsed(p);
        });
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onPickup(EntityPickupItemEvent e) {
        if (!(e.getEntity() instanceof Player p)) return;
        if (!plugin.getConfig().getBoolean("totems.absorber-al-recoger", true)) return;
        Item item = e.getItem();
        ItemStack stack = item.getItemStack();
        if (stack.getType() != Material.TOTEM_OF_UNDYING) return;
        int m = totems.max();
        int have = totems.get(p.getName());
        if (m > 0 && have >= m) return; // lleno: que vaya al inventario normal
        e.setCancelled(true);
        int added = totems.add(p.getName(), stack.getAmount());
        int rest = stack.getAmount() - added;
        if (rest <= 0) item.remove();
        else {
            stack.setAmount(rest);
            item.setItemStack(stack);
        }
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent e) {
        totems.refresh(e.getPlayer());
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent e) {
        totems.hide(e.getPlayer());
    }

    /** La barra de tótems se oculta en el mundo del minijuego y vuelve al salir. */
    @EventHandler
    public void onWorld(PlayerChangedWorldEvent e) {
        totems.refresh(e.getPlayer());
    }
}
