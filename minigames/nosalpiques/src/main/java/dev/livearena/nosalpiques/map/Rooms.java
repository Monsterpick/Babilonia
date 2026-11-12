package dev.livearena.nosalpiques.map;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import org.bukkit.Material;
import org.bukkit.block.data.BlockData;

/**
 * El mapa de No Salpiques: N salas de piscinas una detrás de otra (a lo largo de X), unidas por pasillos. Cada sala:
 * cubierta de entrada, piscina con plataformas (el camino), cubierta de salida. Determinista por semilla.
 *
 * <p>Cotas: fondo de la piscina y = FLOOR, agua FLOOR+1..WATER_TOP (la superficie queda en WATER_TOP+1), plataformas y
 * cubiertas con la cara de arriba en DECK+1 (un bloque por encima del agua: desde el agua se puede volver a subir).
 * Saltos: distancia entre centros ≤ 3,6 en llano (un salto normal llega a ~4) y ≤ 3,0 subiendo un bloque.
 */
public final class Rooms {
    public static final int VERSION = 1;
    public static final int FLOOR = 60, WATER_TOP = 63, DECK = 64, L = 36, W = 18, H = 13, GAP = 8;

    /** Tipo de plataforma. */
    public enum Kind { FIJA, HUNDE, PARPADEA, CORRIENTE, MEMORIA, MEMORIA_TRAMPA }

    public record Pad(int room, int index, int x, int y, int z, int size, Kind kind, int phase, double pushX, double pushZ) {
        public boolean contains(double px, double pz) {
            return px >= x && px < x + size && pz >= z && pz < z + size;
        }
    }

    public record Room(int index, int x0, Theme theme, List<Pad> pads, int exitY) {
        public double startX() {
            return x0 + 1.5;
        }

        public double startZ() {
            return W / 2.0;
        }

        /** ¿Está en la cubierta de salida? (en la sala final, arriba). */
        public boolean atExit(double x, double y, double z) {
            return x >= x0 + L - 4 && x < x0 + L + 1 && y >= exitY + 0.5 && y < exitY + 3;
        }

        /** Progreso de la sala (0..1) por la X recorrida. */
        public double progress(double x) {
            return Math.max(0, Math.min(1, (x - x0 - 3) / (L - 7.0)));
        }

        public boolean inside(double x, double z) {
            return x >= x0 - 1 && x <= x0 + L + 1 && z >= -1 && z <= W + 1;
        }
    }

    public record Place(int x, int y, int z, BlockData data) {}

    public final int rooms;
    public final List<Room> list = new ArrayList<>();
    public final List<Place> places = new ArrayList<>();
    /** Bloques que son plataforma (clave x,y,z → pad), para saber qué pisa el jugador. */
    public final Map<Long, Pad> padAt = new HashMap<>();
    public final Set<Long> water = new HashSet<>();

    public static long key(int x, int y, int z) {
        return ((long) (x & 0x3FFFFFF) << 38) | ((long) (z & 0x3FFFFFF) << 12) | (y & 0xFFF);
    }

    public static int roomX(int room) {
        return (room - 1) * (L + GAP);
    }

    public Room room(int r) {
        return list.get(Math.max(1, Math.min(rooms, r)) - 1);
    }

    public Rooms(long seed, int rooms, double difficulty) {
        this.rooms = rooms;
        for (int r = 1; r <= rooms; r++) build(new Random(seed * 31L + r * 977L), r, difficulty);
    }

    private void put(int x, int y, int z, Material m) {
        places.add(new Place(x, y, z, m.createBlockData()));
    }

    private void build(Random rnd, int r, double diff) {
        Theme th = Themes.of(r);
        int x0 = roomX(r);
        boolean last = r == rooms;
        int top = DECK + H + (last ? 10 : 0);
        // ── caja: suelo, paredes con franja y zócalo, techo con paneles de luz ──
        for (int x = x0 - 1; x <= x0 + L; x++)
            for (int z = -1; z <= W; z++) {
                boolean wall = x == x0 - 1 || x == x0 + L || z == -1 || z == W;
                for (int y = FLOOR; y <= top; y++) {
                    if (!wall && y > FLOOR && y < top) continue;
                    Material m;
                    if (y == top) m = (Math.floorMod(x - x0, 5) == 2 && Math.floorMod(z, 5) == 2) ? th.light() : th.pillar()[0];
                    else if (y == FLOOR) m = (Math.floorMod(x + z, 2) == 0) ? th.path()[0] : th.path()[th.path().length - 1];
                    else if (y == DECK + 3 || y == DECK + 4) m = th.decoBlock(rnd);
                    else m = th.pillar()[Math.floorMod(x + z + y, 3) == 0 ? th.pillar().length - 1 : 0];
                    put(x, y, z, m);
                }
            }
        // abertura hacia el pasillo (salida) y desde el pasillo (entrada)
        int exitY = last ? DECK + 10 : DECK;
        for (int z = W / 2 - 1; z <= W / 2 + 1; z++)
            for (int y = DECK + 1; y <= DECK + 3; y++) {
                if (r > 1) put(x0 - 1, y, z, Material.AIR);
                if (!last) put(x0 + L, y, z, Material.AIR);
            }
        // agua de la piscina
        for (int x = x0 + 4; x < x0 + L - 4; x++)
            for (int z = 0; z < W; z++)
                for (int y = FLOOR + 1; y <= WATER_TOP; y++) {
                    put(x, y, z, Material.WATER);
                    water.add(key(x, y, z));
                }
        // cubiertas de entrada y salida (en la final, la salida está arriba)
        for (int x = x0; x < x0 + 4; x++)
            for (int z = 0; z < W; z++)
                for (int y = FLOOR + 1; y <= DECK; y++) put(x, y, z, y == DECK ? (z % 3 == 0 ? th.deco()[0] : th.pad()) : th.pillar()[0]);
        for (int x = x0 + L - 4; x < x0 + L; x++)
            for (int z = 0; z < W; z++)
                for (int y = FLOOR + 1; y <= exitY; y++) {
                    if (last && y < exitY && y > WATER_TOP) continue; // en la final la cubierta alta es una repisa
                    put(x, y, z, y == exitY ? (z % 3 == 0 ? th.deco()[0] : th.pad()) : th.pillar()[0]);
                }
        // bordillo de la piscina (losas) en las cubiertas
        for (int z = 0; z < W; z++) {
            put(x0 + 3, DECK + 1, z, th.slab());
            if (!last) put(x0 + L - 4, DECK + 1, z, th.slab());
        }
        for (int z = W / 2 - 1; z <= W / 2 + 1; z++) {
            put(x0 + 3, DECK + 1, z, Material.AIR); // hueco en el bordillo para salir
            if (!last) put(x0 + L - 4, DECK + 1, z, Material.AIR);
        }
        // salvavidas y escalerillas de decoración en las paredes
        for (int x = x0 + 6; x < x0 + L - 6; x += 9) {
            put(x, DECK + 2, -1, Material.RED_CONCRETE);
            put(x, DECK + 2, W, Material.RED_CONCRETE);
            put(x + 1, DECK + 2, -1, Material.WHITE_CONCRETE);
            put(x + 1, DECK + 2, W, Material.WHITE_CONCRETE);
        }
        // pasillo hasta la sala siguiente
        if (!last) {
            int cx0 = x0 + L + 1, cx1 = x0 + L + GAP - 2;
            for (int x = cx0; x <= cx1; x++)
                for (int z = W / 2 - 2; z <= W / 2 + 2; z++)
                    for (int y = DECK; y <= DECK + 4; y++) {
                        boolean side = z == W / 2 - 2 || z == W / 2 + 2;
                        Material m = y == DECK ? th.pad() : y == DECK + 4 ? (x % 3 == 0 ? th.light() : th.pillar()[0]) : side ? th.pillar()[0] : Material.AIR;
                        put(x, y, z, m);
                    }
        }
        // ── el camino de plataformas ──
        List<Pad> pads = new ArrayList<>();
        double t = (r - 1) / (double) Math.max(1, rooms - 1);
        double cx = x0 + 3.5, cz = W / 2.0;
        int y = DECK;
        int idx = 0;
        int memoryAt = (r == 4 || r == 7) ? 3 + rnd.nextInt(2) : -1;
        while (cx < x0 + L - 7.5) {
            if (idx == memoryAt) {
                // puente de memoria: filas de 3 baldosas pegadas; solo una por fila es segura
                int rows = 5 + (r == 7 ? 2 : 0);
                int zc = (int) Math.round(Math.max(3, Math.min(W - 4, cz))) - 1;
                int bx = (int) Math.floor(cx + 2.5);
                for (int row = 0; row < rows; row++) {
                    int safe = rnd.nextInt(3);
                    for (int k = 0; k < 3; k++) {
                        Pad p = new Pad(r, idx, bx + row, y, zc + k, 1, k == safe ? Kind.MEMORIA : Kind.MEMORIA_TRAMPA, row, 0, 0);
                        addPad(pads, p, th, true);
                    }
                }
                cx = bx + rows - 0.5;
                cz = zc + 1.5;
                idx++;
                continue;
            }
            double reach = 2.7 + rnd.nextDouble() * 0.9 * Math.min(1.2, diff);
            if (last && y < exitY) reach = Math.min(reach, 2.9);
            double nz = Math.max(2.5, Math.min(W - 3.5, cz + (rnd.nextDouble() - 0.5) * 5));
            double dx = Math.sqrt(Math.max(1.4, reach * reach - (nz - cz) * (nz - cz)));
            double nx = cx + dx;
            int size = rnd.nextDouble() < Math.max(0.15, 0.7 - t * 0.6) / Math.sqrt(diff) ? 2 : 1;
            Kind kind = Kind.FIJA;
            double roll = rnd.nextDouble();
            if (r >= 2 && roll < 0.25 + t * 0.15) kind = Kind.HUNDE;
            else if (r >= 3 && roll < 0.45 + t * 0.1) kind = Kind.PARPADEA;
            else if (r >= 5 && roll < 0.6) kind = Kind.CORRIENTE;
            if (last) {
                if (y < exitY) y++; // la sala final sube como una escalera mientras crece el agua
                if (kind == Kind.PARPADEA) kind = Kind.FIJA;
            }
            double a = rnd.nextDouble() * Math.PI * 2;
            Pad p = new Pad(r, idx, (int) Math.floor(nx - size / 2.0 + 0.5), y, (int) Math.floor(nz - size / 2.0 + 0.5), size, kind, idx % 2,
                kind == Kind.CORRIENTE ? Math.cos(a) : 0, kind == Kind.CORRIENTE ? Math.sin(a) : 0);
            addPad(pads, p, th, false);
            cx = p.x() + size / 2.0;
            cz = p.z() + size / 2.0;
            idx++;
        }
        if (last) {
            // escalera final hasta la repisa de salida
            while (y < exitY) {
                y++;
                cx = Math.min(cx + 2.4, x0 + L - 5.5);
                Pad p = new Pad(r, idx++, (int) Math.floor(cx - 0.5), y, (int) Math.floor(cz - 0.5), 2, Kind.FIJA, 0, 0, 0);
                addPad(pads, p, th, false);
                cx = p.x() + 1;
            }
            // puerta de salida dorada en la pared del fondo
            for (int z = W / 2 - 1; z <= W / 2 + 1; z++)
                for (int yy = exitY + 1; yy <= exitY + 3; yy++) put(x0 + L, yy, z, z == W / 2 && yy < exitY + 3 ? Material.AIR : Material.GOLD_BLOCK);
        }
        list.add(new Room(r, x0, th, pads, exitY));
    }

    /** Pilar de la plataforma desde el fondo; la cara de arriba en y+1. */
    private void addPad(List<Pad> pads, Pad p, Theme th, boolean flat) {
        pads.add(p);
        Material top = switch (p.kind()) {
            case HUNDE -> Material.LIGHT_GRAY_CONCRETE;
            case PARPADEA -> Material.LIGHT_BLUE_STAINED_GLASS;
            case CORRIENTE -> Material.CYAN_CONCRETE;
            default -> th.path()[0];
        };
        for (int x = p.x(); x < p.x() + p.size(); x++)
            for (int z = p.z(); z < p.z() + p.size(); z++) {
                for (int y = FLOOR + 1; y <= p.y(); y++) {
                    boolean head = y == p.y();
                    if (!head && flat) continue; // las baldosas de memoria flotan sobre el agua
                    put(x, y, z, head ? top : th.pillar()[0]);
                    water.remove(key(x, y, z));
                }
                padAt.put(key(x, p.y(), z), p);
            }
    }
}
