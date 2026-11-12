package dev.livearena.dropper.map;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import org.bukkit.Material;
import org.bukkit.block.data.BlockData;

/**
 * Genera cada nivel (determinista por semilla y número de nivel; no toca el mundo).
 *
 * <p>Garantía de que se puede pasar: se simula la caída del jugador con la física de Minecraft (gravedad 0,08 y
 * rozamiento 0,98 por tick) para saber cuántos ticks hay entre una capa y la siguiente, y el hueco seguro de cada capa
 * se coloca a una distancia horizontal que se puede recorrer en el aire en ese tiempo (≈0,15 bloques/tick, por debajo
 * de los 0,22 reales). El hueco seguro se talla siempre, sea cual sea el dibujo de la capa, y los pilares nunca se
 * ponen en el pasillo entre dos huecos seguros.
 */
public final class ShaftGen {
    /** Sube si cambias la generación (los niveles construidos se rehacen). */
    public static final int VERSION = 1;
    public static final int TOP_Y = 230, WATER_Y = 138, SPACING = 30, PER_ROW = 10;
    static final double AIR_SPEED = 0.15;

    private ShaftGen() {}

    /** Esquina del interior del tubo del nivel. */
    public static int[] origin(int level) {
        int i = level - 1;
        return new int[] {(i % PER_ROW) * SPACING, (i / PER_ROW) * SPACING};
    }

    /** Ticks que tarda en caer desde topY hasta la altura y (física del jugador). */
    static int ticksTo(double fromY, double y) {
        double py = fromY, v = 0;
        int t = 0;
        while (py > y && t < 10000) {
            v = (v - 0.08) * 0.98;
            py += v;
            t++;
        }
        return t;
    }

    public static Shaft generate(long seed, int level, double difficulty) {
        Random r = new Random(seed * 1_000_003L + level * 7919L);
        Theme th = Themes.of(level);
        int[] o = origin(level);
        int x0 = o[0], z0 = o[1], S = Shaft.S;
        double t = Math.max(0, Math.min(1, (level - 1) / 99.0));
        double d = difficulty;
        List<Shaft.Place> places = new ArrayList<>();
        // ── capas: cuántas, a qué altura y con qué dibujo ──
        int n = Math.max(2, Math.min(11, (int) Math.round((2.5 + t * 7) * Math.sqrt(d))));
        double holeR = Math.max(1.0, Math.min(3.2, (2.6 - t * 1.45) / Math.sqrt(d)));
        int top = TOP_Y - 16, bottom = WATER_Y + 7;
        List<Integer> ys = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            double f = n == 1 ? 0.5 : i / (double) (n - 1);
            int y = (int) Math.round(top - f * (top - bottom)) + (i > 0 && i < n - 1 ? r.nextInt(3) - 1 : 0);
            ys.add(y);
        }
        // ── huecos seguros: alcanzables desde el anterior con la caída simulada ──
        List<double[]> holes = new ArrayList<>();
        double px = S / 2.0, pz = S / 2.0;
        double prevY = TOP_Y;
        double lo = holeR + 0.15, hi = S - holeR - 0.15;
        for (int i = 0; i < n; i++) {
            int y = ys.get(i);
            int dt = ticksTo(TOP_Y, y + 1) - ticksTo(TOP_Y, prevY);
            double reach = Math.max(0.6, AIR_SPEED * dt - 0.3);
            double minShift = Math.min(reach * 0.65, 0.8 + t * 3.2);
            double hx = px, hz = pz;
            for (int tries = 0; tries < 60; tries++) {
                double a = r.nextDouble() * Math.PI * 2, dist = minShift + r.nextDouble() * Math.max(0, reach - minShift);
                double cx = px + Math.cos(a) * dist, cz = pz + Math.sin(a) * dist;
                if (cx >= lo && cx <= hi && cz >= lo && cz <= hi) {
                    hx = cx;
                    hz = cz;
                    break;
                }
            }
            holes.add(new double[] {x0 + hx, z0 + hz});
            px = hx;
            pz = hz;
            prevY = y + 1;
        }
        // ── paredes y luz ──
        for (int y = WATER_Y - 1; y <= TOP_Y + 3; y++) {
            boolean ring = (y - WATER_Y) % 9 == 4;
            for (int i = -1; i <= S; i++) {
                put(places, x0 + i, y, z0 - 1, wall(th, r, ring, i));
                put(places, x0 + i, y, z0 + S, wall(th, r, ring, i));
                if (i >= 0 && i < S) {
                    put(places, x0 - 1, y, z0 + i, wall(th, r, ring, i));
                    put(places, x0 + S, y, z0 + i, wall(th, r, ring, i));
                }
            }
        }
        // borde de arriba (para ver dónde empieza el tubo) y suelo bajo el agua
        for (int i = -2; i <= S + 1; i++) {
            put(places, x0 + i, TOP_Y + 3, z0 - 2, th.light().createBlockData());
            put(places, x0 + i, TOP_Y + 3, z0 + S + 1, th.light().createBlockData());
            put(places, x0 - 2, TOP_Y + 3, z0 + i, th.light().createBlockData());
            put(places, x0 + S + 1, TOP_Y + 3, z0 + i, th.light().createBlockData());
        }
        for (int x = 0; x < S; x++)
            for (int z = 0; z < S; z++) {
                put(places, x0 + x, WATER_Y - 1, z0 + z, (x + z) % 4 == 0 ? th.light().createBlockData() : th.pad().createBlockData());
                for (int y = WATER_Y; y <= WATER_Y + 2; y++) put(places, x0 + x, y, z0 + z, Material.WATER.createBlockData());
            }
        // ── capas ──
        String[] names = {"placa", "barras", "tablero", "cruz", "anillo", "rejilla", "diagonal", "islas"};
        int base = Math.floorMod((int) (seed % 97) + level * 3, names.length);
        StringBuilder pat = new StringBuilder();
        for (int i = 0; i < n; i++) {
            int kind = Math.floorMod(base + i * 5 + r.nextInt(2), names.length);
            if (level <= 3) kind = 0; // los primeros niveles: placas con un hueco grande, fáciles de entender
            pat.append(i == 0 ? "" : ",").append(names[kind]);
            boolean[][] solid = pattern(kind, r);
            double[] h = holes.get(i);
            int y = ys.get(i);
            Material a = th.pathBlock(r), b = th.decoBlock(r);
            for (int x = 0; x < S; x++)
                for (int z = 0; z < S; z++) {
                    double dx = x0 + x + 0.5 - h[0], dz = z0 + z + 0.5 - h[1];
                    if (dx * dx + dz * dz <= holeR * holeR) continue; // hueco seguro
                    if (!solid[x][z]) continue;
                    Material m = (x + z + i) % 5 == 0 ? b : a;
                    put(places, x0 + x, y, z0 + z, m.createBlockData());
                }
            // marco de luz alrededor del hueco seguro (se ve desde arriba al caer)
            for (int x = 0; x < S; x++)
                for (int z = 0; z < S; z++) {
                    double dx = x0 + x + 0.5 - h[0], dz = z0 + z + 0.5 - h[1];
                    double dd = Math.sqrt(dx * dx + dz * dz);
                    if (dd > holeR && dd <= holeR + 1.0 && solid[x][z] && (x + z) % 2 == 0) put(places, x0 + x, y, z0 + z, th.light().createBlockData());
                }
            // pilares entre esta capa y la siguiente (a partir del nivel 12), fuera del pasillo seguro
            if (level >= 12 && i < n - 1) {
                int pillars = 1 + (int) (t * 3 * d);
                double[] h2 = holes.get(i + 1);
                for (int k = 0; k < pillars; k++) {
                    for (int tries = 0; tries < 20; tries++) {
                        int x = r.nextInt(S), z = r.nextInt(S);
                        double cx = x0 + x + 0.5, cz = z0 + z + 0.5;
                        if (segDist(cx, cz, h[0], h[1], h2[0], h2[1]) < holeR + 1.3) continue;
                        int y2 = ys.get(i + 1);
                        int len = Math.min(y - y2 - 2, 3 + r.nextInt(5));
                        int from = y - 1 - r.nextInt(Math.max(1, y - y2 - len - 1));
                        for (int yy = from; yy > from - len && yy > y2; yy--) put(places, x0 + x, yy, z0 + z, th.pillarBlock(r).createBlockData());
                        break;
                    }
                }
            }
        }
        return new Shaft(level, x0, z0, TOP_Y, WATER_Y, places, holes, ys, pat.toString());
    }

    private static BlockData wall(Theme th, Random r, boolean ring, int i) {
        if (ring && i % 3 == 1) return th.light().createBlockData();
        return th.pillarBlock(r).createBlockData();
    }

    private static void put(List<Shaft.Place> l, int x, int y, int z, BlockData d) {
        l.add(new Shaft.Place(x, y, z, d));
    }

    /** Distancia del punto (px,pz) al segmento a-b (en el plano). */
    static double segDist(double px, double pz, double ax, double az, double bx, double bz) {
        double vx = bx - ax, vz = bz - az, wx = px - ax, wz = pz - az;
        double c = vx * vx + vz * vz;
        double u = c < 1e-9 ? 0 : Math.max(0, Math.min(1, (wx * vx + wz * vz) / c));
        double dx = ax + u * vx - px, dz = az + u * vz - pz;
        return Math.sqrt(dx * dx + dz * dz);
    }

    /** Dibujo de una capa (true = bloque). El hueco seguro se talla después. */
    static boolean[][] pattern(int kind, Random r) {
        int S = Shaft.S;
        boolean[][] s = new boolean[S][S];
        int off = r.nextInt(3);
        for (int x = 0; x < S; x++)
            for (int z = 0; z < S; z++) {
                double dx = x - 4, dz = z - 4;
                s[x][z] = switch (kind) {
                    case 0 -> true; // placa con un hueco
                    case 1 -> (x + off) % 3 != 0; // barras con rendijas
                    case 2 -> ((x / 2) + (z / 2)) % 2 == 0; // tablero
                    case 3 -> Math.abs(dx) <= 1 || Math.abs(dz) <= 1 || x == 0 || z == 0 || x == S - 1 || z == S - 1; // cruz y marco
                    case 4 -> { // anillos
                        double dist = Math.sqrt(dx * dx + dz * dz);
                        yield dist < 1.5 || (dist > 2.6 && dist < 4.1) || dist > 5.2;
                    }
                    case 5 -> (x + off) % 3 == 0 || (z + off) % 3 == 0; // rejilla
                    case 6 -> Math.floorMod(x + z + off, 4) < 2; // diagonales
                    default -> r.nextDouble() < 0.62; // islas
                };
            }
        return s;
    }
}
