package dev.livearena.dropper;

import java.util.HashMap;
import java.util.Map;
import org.bukkit.configuration.file.FileConfiguration;

/** Ajustes leídos de config.yml (con límites para que un valor raro no rompa nada). */
public final class Settings {
    public final String worldName;
    public final long seed;
    public final int levels;
    public final double difficulty;
    public final int timeLimitMin, celebrateSeconds, countdown;
    public final boolean restartOnWin;
    public final double effectGap, pushStrength, windStrength;
    public final int windS, fogS, slowS, quakeS, shieldS, guideS, protectHits, protectS;
    public final boolean packEnabled, packRequired;
    public final int packPort;
    public final String packUrl;
    private final Map<String, String> msgs = new HashMap<>();

    public Settings(FileConfiguration c) {
        worldName = c.getString("mundo.nombre", "dropper_mundo");
        seed = c.getLong("mapa.semilla", 2026);
        levels = clamp(c.getInt("mapa.niveles", 100), 5, 100);
        difficulty = Math.max(0.3, Math.min(2, c.getDouble("mapa.dificultad", 1)));
        timeLimitMin = clamp(c.getInt("partida.tiempoLimite", 0), 0, 600);
        restartOnWin = c.getBoolean("partida.reiniciarAlGanar", true);
        celebrateSeconds = clamp(c.getInt("partida.segundosCelebracion", 10), 3, 120);
        countdown = clamp(c.getInt("partida.cuentaAtras", 2), 0, 10);
        effectGap = Math.max(0.2, c.getDouble("efectos.separacionSegundos", 1.5));
        pushStrength = Math.max(0.1, Math.min(3, c.getDouble("efectos.empujeFuerza", 0.9)));
        windStrength = Math.max(0.01, Math.min(0.4, c.getDouble("efectos.vientoFuerza", 0.07)));
        windS = sec(c, "efectos.vientoSegundos", 5);
        fogS = sec(c, "efectos.nieblaSegundos", 6);
        slowS = sec(c, "efectos.lentoSegundos", 5);
        quakeS = sec(c, "efectos.terremotoSegundos", 4);
        shieldS = sec(c, "efectos.escudoSegundos", 30);
        guideS = sec(c, "efectos.guiaSegundos", 15);
        protectHits = clamp(c.getInt("efectos.choquesParaProteger", 5), 0, 50);
        protectS = sec(c, "efectos.segundosProteccion", 15);
        packEnabled = c.getBoolean("paquete.activo", true);
        packRequired = c.getBoolean("paquete.obligatorio", false);
        packPort = clamp(c.getInt("paquete.puerto", 25592), 1024, 65535);
        packUrl = c.getString("paquete.url", "http://127.0.0.1:{puerto}/dropper.zip").replace("{puerto}", String.valueOf(packPort));
        var sec = c.getConfigurationSection("mensajes");
        if (sec != null) for (String k : sec.getKeys(false)) msgs.put(k, sec.getString(k, ""));
    }

    public String msg(String key) {
        return msgs.getOrDefault(key, "&f{usuario}: " + key);
    }

    /** Lo que cambia la forma de los niveles (si cambia, el mapa se vuelve a construir). */
    public String mapSignature() {
        return "d" + dev.livearena.dropper.map.ShaftGen.VERSION + ":" + seed + ":" + levels + ":" + difficulty;
    }

    private static int sec(FileConfiguration c, String path, int def) {
        return clamp(c.getInt(path, def), 1, 120);
    }

    static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
