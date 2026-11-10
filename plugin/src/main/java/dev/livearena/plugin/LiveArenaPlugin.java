package dev.livearena.plugin;

import org.bukkit.command.PluginCommand;
import org.bukkit.plugin.java.JavaPlugin;

/** Plugin propio de LiveArena. Primer módulo: tótems apilables. */
public final class LiveArenaPlugin extends JavaPlugin {
    private TotemManager totems;
    private CineEngine cine;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        totems = new TotemManager(this);
        totems.load();
        getServer().getPluginManager().registerEvents(new TotemListener(this, totems), this);
        Effects effects = new Effects(this);
        Goals goals = new Goals(this, effects.vfx);
        getServer().getPluginManager().registerEvents(goals, this);
        cine = new CineEngine(this);
        CineAbilities abilities = new CineAbilities(cine);
        abilities.register();
        getServer().getPluginManager().registerEvents(abilities, this);
        CineCharacters chars = new CineCharacters(cine);
        chars.register();
        new CineEspeciales(cine, chars).register();
        cine.enable();
        for (CineEngine.Ability a : cine.all().values()) {
            if (a.id.equals("test")) continue;
            effects.addSpecial("cine_" + a.id, a.nombre, a.colorHex, false, a.ayuda + " (cinemática)", (p, viewer, args) -> cine.request(a.id, p, null, viewer, false));
        }
        // Ids antiguos que siguen funcionando en las reglas ya creadas.
        for (var alias : CineEngine.ALIASES.entrySet()) {
            CineEngine.Ability a = cine.all().get(alias.getValue());
            if (a != null) effects.addSpecial("cine_" + alias.getKey(), a.nombre, a.colorHex, false, a.ayuda + " (cinemática)", (p, viewer, args) -> cine.request(a.id, p, null, viewer, false));
        }
        PluginCommand hab = getCommand("habilidad");
        if (hab != null) {
            hab.setExecutor(cine);
            hab.setTabCompleter(cine);
        }
        LaCommand cmd = new LaCommand(this, totems, effects, goals);
        PluginCommand la = getCommand("la");
        if (la != null) {
            la.setExecutor(cmd);
            la.setTabCompleter(cmd);
        }
        getLogger().info("LiveArena activo: tótems apilables, efectos survival y " + (cine.all().size() - 1) + " habilidades cinemáticas.");
    }

    @Override
    public void onDisable() {
        if (cine != null) cine.disable();
        if (totems != null) {
            totems.hideAll();
            totems.save();
        }
    }

    public void reload() {
        reloadConfig();
        totems.refreshAll();
        if (cine != null) cine.reloadConfig();
    }
}
