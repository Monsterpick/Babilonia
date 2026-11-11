package dev.livearena.parkour;

import java.util.HashMap;
import java.util.Map;
import org.bukkit.configuration.file.FileConfiguration;

/** Ajustes leídos de config.yml (con límites para que un valor raro no rompa nada). */
public final class Settings {
    public final String worldName;
    public final long seed;
    public final int levels, baseY, rise;
    public final double radius, difficulty;
    public final int timeLimitMin, celebrateSeconds;
    public final boolean restartOnWin, nightVision;
    public final double effectGap, pushStrength, windStrength;
    public final int windS, fogS, iceS, ghostS, ghostBlocks, quakeS, slowS, jumpS, shieldS, guideS, bridgeS, protectFalls, protectS;
    public final boolean packEnabled, packRequired;
    public final int packPort;
    public final String packUrl;
    private final Map<String, String> msgs = new HashMap<>();

    public Settings(FileConfiguration c) {
        worldName = c.getString("mundo.nombre", "parkour_torre");
        seed = c.getLong("torre.semilla", 2026);
        baseY = clamp(c.getInt("torre.alturaBase", 8), -50, 100);
        // la torre tiene que caber en el mundo (techo en y=319): si hay muchos niveles, cada uno sube menos
        int wantLevels = clamp(c.getInt("torre.niveles", 50), 2, 60);
        int wantRise = clamp(c.getInt("torre.subidaPorNivel", 6), 5, 10);
        int room = 310 - baseY;
        while (wantRise > 5 && wantLevels * wantRise > room) wantRise--; // con menos de 5 los niveles se estorban
        levels = Math.min(wantLevels, room / wantRise);
        rise = wantRise;
        radius = Math.max(7, Math.min(16, c.getDouble("torre.radio", 9)));
        difficulty = Math.max(0.3, Math.min(2, c.getDouble("torre.dificultad", 1)));
        timeLimitMin = clamp(c.getInt("partida.tiempoLimite", 0), 0, 600);
        restartOnWin = c.getBoolean("partida.reiniciarAlGanar", true);
        celebrateSeconds = clamp(c.getInt("partida.segundosCelebracion", 12), 3, 120);
        nightVision = c.getBoolean("partida.visionNocturna", true);
        effectGap = Math.max(0.2, c.getDouble("efectos.separacionSegundos", 1.5));
        pushStrength = Math.max(0.2, Math.min(3, c.getDouble("efectos.empujeFuerza", 1.15)));
        windStrength = Math.max(0.01, Math.min(0.4, c.getDouble("efectos.vientoFuerza", 0.09)));
        windS = sec(c, "efectos.vientoSegundos", 6);
        fogS = sec(c, "efectos.nieblaSegundos", 7);
        iceS = sec(c, "efectos.hieloSegundos", 15);
        ghostS = sec(c, "efectos.fantasmaSegundos", 9);
        ghostBlocks = clamp(c.getInt("efectos.fantasmaBloques", 6), 1, 20);
        quakeS = sec(c, "efectos.terremotoSegundos", 5);
        slowS = sec(c, "efectos.lentoSegundos", 6);
        jumpS = sec(c, "efectos.supersaltoSegundos", 12);
        shieldS = sec(c, "efectos.escudoSegundos", 25);
        guideS = sec(c, "efectos.guiaSegundos", 15);
        bridgeS = sec(c, "efectos.puenteSegundos", 10);
        protectFalls = clamp(c.getInt("efectos.caidasParaProteger", 4), 0, 50);
        protectS = sec(c, "efectos.segundosProteccion", 12);
        packEnabled = c.getBoolean("paquete.activo", true);
        packRequired = c.getBoolean("paquete.obligatorio", false);
        packPort = clamp(c.getInt("paquete.puerto", 25591), 1024, 65535);
        packUrl = c.getString("paquete.url", "http://127.0.0.1:{puerto}/parkour.zip").replace("{puerto}", String.valueOf(packPort));
        var sec = c.getConfigurationSection("mensajes");
        if (sec != null) for (String k : sec.getKeys(false)) msgs.put(k, sec.getString(k, ""));
    }

    public String msg(String key) {
        return msgs.getOrDefault(key, "&f{usuario}: " + key);
    }

    /** Lo que cambia la forma de la torre (si cambia, hay que regenerarla). */
    public String towerSignature() {
        return "g" + dev.livearena.parkour.tower.TowerGen.VERSION + ":" + seed + ":" + levels + ":" + baseY + ":" + rise + ":" + radius + ":" + difficulty;
    }

    private static int sec(FileConfiguration c, String path, int def) {
        return clamp(c.getInt(path, def), 1, 120);
    }

    static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
