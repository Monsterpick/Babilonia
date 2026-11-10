package dev.livearena.plugin;

import org.bukkit.NamespacedKey;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.persistence.PersistentDataType;

/**
 * Separación de modos: el minijuego Base Defense marca su mundo con «basedefense:juego». Ahí no funcionan las
 * cinemáticas, los efectos survival ni la barra de tótems de LiveArena (y Base Defense no hace nada fuera de él).
 */
final class Minijuego {
    private static final NamespacedKey KEY = NamespacedKey.fromString("basedefense:juego");

    private Minijuego() {}

    static boolean es(World w) {
        return w != null && KEY != null && w.getPersistentDataContainer().has(KEY, PersistentDataType.BYTE);
    }

    static boolean en(Player p) {
        return p != null && es(p.getWorld());
    }
}
