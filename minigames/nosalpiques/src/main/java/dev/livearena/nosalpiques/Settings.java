package dev.livearena.nosalpiques;

import java.util.HashMap;
import java.util.Map;
import org.bukkit.configuration.file.FileConfiguration;

/** Ajustes leídos de config.yml (con límites para que un valor raro no rompa nada). */
public final class Settings {
    public final String worldName;
    public final long seed;
    /** Número de salas (en el HUD y la app se llaman «niveles»). */
    public final int levels;
    public final double difficulty;
    public final int timeLimitMin, celebrateSeconds, startStones, startFlares;
    public final boolean restartOnWin;
    public final double monsterSpeed, catchDist, sinkS, blinkS, floodS;
    public final int wakeS, distractS, blindS, memoryS;
    public final double effectGap, pushStrength;
    public final int darkS, slipS, jumpS, bridgeS, shieldS, protectSplashes, protectS;
    public final boolean packEnabled, packRequired;
    public final int packPort;
    public final String packUrl;
    private final Map<String, String> msgs = new HashMap<>();

    public Settings(FileConfiguration c) {
        worldName = c.getString("mundo.nombre", "nosalpiques_salas");
        seed = c.getLong("mapa.semilla", 2026);
        levels = clamp(c.getInt("mapa.salas", 8), 3, 12);
        difficulty = Math.max(0.3, Math.min(2, c.getDouble("mapa.dificultad", 1)));
        timeLimitMin = clamp(c.getInt("partida.tiempoLimite", 0), 0, 600);
        restartOnWin = c.getBoolean("partida.reiniciarAlGanar", true);
        celebrateSeconds = clamp(c.getInt("partida.segundosCelebracion", 10), 3, 120);
        startStones = clamp(c.getInt("partida.piedrasAlEmpezar", 2), 0, 64);
        startFlares = clamp(c.getInt("partida.bengalasAlEmpezar", 1), 0, 64);
        monsterSpeed = Math.max(0.05, Math.min(0.6, c.getDouble("monstruo.velocidad", 0.17)));
        wakeS = clamp(c.getInt("monstruo.segundosDespertar", 3), 1, 20);
        catchDist = Math.max(0.8, Math.min(4, c.getDouble("monstruo.distanciaAtrapar", 1.6)));
        distractS = clamp(c.getInt("monstruo.segundosDistraido", 5), 1, 60);
        blindS = clamp(c.getInt("monstruo.segundosCegado", 6), 1, 60);
        sinkS = Math.max(0.3, Math.min(10, c.getDouble("sala.segundosHundir", 1.2)));
        blinkS = Math.max(0.5, Math.min(10, c.getDouble("sala.segundosParpadeo", 2.0)));
        memoryS = clamp(c.getInt("sala.segundosMemoria", 4), 1, 30);
        floodS = Math.max(0.5, Math.min(30, c.getDouble("sala.segundosCrecida", 3.0)));
        effectGap = Math.max(0.2, c.getDouble("efectos.separacionSegundos", 1.5));
        pushStrength = Math.max(0.1, Math.min(3, c.getDouble("efectos.empujeFuerza", 0.85)));
        darkS = sec(c, "efectos.apagarSegundos", 6);
        slipS = sec(c, "efectos.resbalarSegundos", 6);
        jumpS = sec(c, "efectos.supersaltoSegundos", 10);
        bridgeS = sec(c, "efectos.puenteSegundos", 10);
        shieldS = sec(c, "efectos.escudoSegundos", 30);
        protectSplashes = clamp(c.getInt("efectos.salpiconesParaProteger", 4), 0, 50);
        protectS = sec(c, "efectos.segundosProteccion", 15);
        packEnabled = c.getBoolean("paquete.activo", true);
        packRequired = c.getBoolean("paquete.obligatorio", false);
        packPort = clamp(c.getInt("paquete.puerto", 25593), 1024, 65535);
        packUrl = c.getString("paquete.url", "http://127.0.0.1:{puerto}/nosalpiques.zip").replace("{puerto}", String.valueOf(packPort));
        var sec = c.getConfigurationSection("mensajes");
        if (sec != null) for (String k : sec.getKeys(false)) msgs.put(k, sec.getString(k, ""));
    }

    public String msg(String key) {
        return msgs.getOrDefault(key, "&f{usuario}: " + key);
    }

    public String mapSignature() {
        return "n" + dev.livearena.nosalpiques.map.Rooms.VERSION + ":" + seed + ":" + levels + ":" + difficulty;
    }

    private static int sec(FileConfiguration c, String path, int def) {
        return clamp(c.getInt(path, def), 1, 120);
    }

    static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
