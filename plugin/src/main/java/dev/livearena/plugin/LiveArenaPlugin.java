package dev.livearena.plugin;

import org.bukkit.command.PluginCommand;
import org.bukkit.plugin.java.JavaPlugin;

/** Plugin propio de LiveArena. Primer módulo: tótems apilables. */
public final class LiveArenaPlugin extends JavaPlugin {
    private TotemManager totems;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        totems = new TotemManager(this);
        totems.load();
        getServer().getPluginManager().registerEvents(new TotemListener(this, totems), this);
        Effects effects = new Effects(this);
        Goals goals = new Goals(this, effects.vfx);
        getServer().getPluginManager().registerEvents(goals, this);
        LaCommand cmd = new LaCommand(this, totems, effects, goals);
        PluginCommand la = getCommand("la");
        if (la != null) {
            la.setExecutor(cmd);
            la.setTabCompleter(cmd);
        }
        getLogger().info("LiveArena activo: tótems apilables y efectos survival listos.");
    }

    @Override
    public void onDisable() {
        if (totems != null) {
            totems.hideAll();
            totems.save();
        }
    }

    public void reload() {
        reloadConfig();
        totems.refreshAll();
    }
}
