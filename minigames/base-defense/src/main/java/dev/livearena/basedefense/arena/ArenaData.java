package dev.livearena.basedefense.arena;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.util.BoundingBox;
import org.bukkit.util.Vector;

/**
 * Lo único que guarda el generador: spawn del jugador, waypoints del carril, punto de spawn de
 * mobs, región de la base y la plataforma (y los límites para poder borrar la arena).
 */
public final class ArenaData {
    public Vector playerSpawn;
    public float playerYaw;
    public Vector mobSpawn;
    public final List<Vector> waypoints = new ArrayList<>();
    public BoundingBox baseRegion;
    public BoundingBox platform;
    public BoundingBox bounds;
    public int groundY;
    public double laneHalfWidth;
    public long seed;

    public boolean valid() {
        return playerSpawn != null && mobSpawn != null && baseRegion != null && waypoints.size() >= 2;
    }

    public Location spawn(World w) {
        return new Location(w, playerSpawn.getX(), playerSpawn.getY(), playerSpawn.getZ(), playerYaw, 8f);
    }

    public Location mobSpawn(World w) {
        return mobSpawn.toLocation(w);
    }

    /** Centro de la puerta de la base (a donde van los mobs y las bolas de fuego). */
    public Vector baseCenter() {
        return baseRegion.getCenter();
    }

    public void save(File f) throws IOException {
        YamlConfiguration y = new YamlConfiguration();
        y.options().setHeader(List.of("Generado por /bd arena generate. Puedes ajustar puntos con /bd set."));
        y.set("semilla", seed);
        y.set("sueloY", groundY);
        y.set("medioAnchoCarril", laneHalfWidth);
        y.set("jugador", playerSpawn);
        y.set("jugadorYaw", playerYaw);
        y.set("spawnMobs", mobSpawn);
        y.set("waypoints", waypoints);
        y.set("base", baseRegion);
        y.set("plataforma", platform);
        y.set("limites", bounds);
        y.save(f);
    }

    public static ArenaData load(File f) {
        if (!f.isFile()) return null;
        YamlConfiguration y = YamlConfiguration.loadConfiguration(f);
        ArenaData a = new ArenaData();
        a.seed = y.getLong("semilla");
        a.groundY = y.getInt("sueloY", 64);
        a.laneHalfWidth = y.getDouble("medioAnchoCarril", 7);
        a.playerSpawn = y.getVector("jugador");
        a.playerYaw = (float) y.getDouble("jugadorYaw");
        a.mobSpawn = y.getVector("spawnMobs");
        for (Object o : y.getList("waypoints", List.of())) if (o instanceof Vector v) a.waypoints.add(v);
        a.baseRegion = y.getObject("base", BoundingBox.class);
        a.platform = y.getObject("plataforma", BoundingBox.class);
        a.bounds = y.getObject("limites", BoundingBox.class);
        return a;
    }
}
