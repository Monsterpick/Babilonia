package dev.livearena.parkour.tower;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.block.BlockFace;
import org.bukkit.block.data.BlockData;
import org.bukkit.block.data.Directional;
import org.bukkit.block.data.Levelled;
import org.bukkit.block.data.type.Slab;

/**
 * Genera la torre a partir de una semilla (misma semilla = misma torre). Cada nivel es un tramo de camino en espiral
 * alrededor de una columna central, de una plataforma a la siguiente, subiendo ~6 bloques. Cada salto se comprueba con
 * la física real del jugador (distancia y altura máximas, espacio libre sobre la cabeza) antes de colocarlo; la
 * dificultad (distancia, piezas estrechas, escaleras, bloques que parpadean) crece con el nivel.
 */
public final class TowerGen {
    /** Sube este número cuando cambie el generador: las torres ya construidas se reconstruyen solas. */
    public static final int VERSION = 2;
    public record Options(int levels, int baseY, int rise, double radius, double difficulty) {}

    private final Options o;
    private final Random r;
    private final Tower t;
    private final Set<Long> solid = new HashSet<>();

    private TowerGen(long seed, Options o) {
        this.o = o;
        this.r = new Random(seed);
        this.t = new Tower(seed, o.levels());
    }

    public static Tower generate(long seed, Options o) {
        TowerGen g = new TowerGen(seed, o);
        g.build();
        return g.t;
    }

    // ───────────────────────────── colocar ─────────────────────────────

    private void put(int x, int y, int z, BlockData d) {
        t.places.add(new Tower.Place(x, y, z, d));
        if (d.getMaterial().isSolid() || d.getMaterial() == Material.LADDER) solid.add(Tower.key(x, y, z));
        t.minY = Math.min(t.minY, y);
        t.maxY = Math.max(t.maxY, y);
    }

    private void put(int x, int y, int z, Material m) {
        put(x, y, z, m.createBlockData());
    }

    private void light(int x, int y, int z, int level) {
        if (solid.contains(Tower.key(x, y, z))) return;
        Levelled l = (Levelled) Material.LIGHT.createBlockData();
        l.setLevel(level);
        t.places.add(new Tower.Place(x, y, z, l));
    }

    private boolean isSolid(int x, int y, int z) {
        return solid.contains(Tower.key(x, y, z));
    }

    /** ¿Se puede poner un bloque aquí sin tapar la cabeza de nadie ni quedarse sin espacio encima? */
    private boolean free(int x, int y, int z, int below, int above) {
        double rr = Math.sqrt(x * x + z * z);
        if (rr < 5.2) return false;
        for (int dy = -below; dy <= above; dy++)
            for (int dx = -1; dx <= 1; dx++)
                for (int dz = -1; dz <= 1; dz++) {
                    if ((dx != 0 || dz != 0) && dy != 0) continue; // los vecinos laterales solo en la misma altura
                    if (isSolid(x + dx, y + dy, z + dz)) return false;
                }
        return true;
    }

    private void mark(Tower.Step s) {
        long k = Tower.key(s.x(), s.y(), s.z());
        t.levelOf.put(k, s.level());
        t.stepAt.put(k, s);
        t.steps.get(s.level()).add(s);
    }

    // ───────────────────────────── torre ─────────────────────────────

    private void build() {
        t.minY = Integer.MAX_VALUE;
        t.maxY = Integer.MIN_VALUE;
        double angle = 0;
        // plataforma de salida (5×5)
        int px = (int) Math.round(o.radius()), pz = 0, py = o.baseY();
        pad(1, px, py, pz, 2, Themes.of(1));
        for (int lv = 1; lv <= o.levels(); lv++) {
            Theme th = Themes.of(lv);
            Tower.Pad from = t.pads[lv];
            angle = Math.atan2(from.z(), from.x());
            int[] end = level(lv, th, from, angle);
            boolean top = lv == o.levels();
            pad(lv + 1, end[0], end[1], end[2], top ? 2 : 1, top ? Themes.of(lv) : Themes.of(lv + 1));
        }
        pillar();
        for (int lv = 1; lv <= o.levels(); lv++) scenery(lv, Themes.of(lv));
    }

    private double dist(int x1, int z1, int x2, int z2) {
        return Math.hypot(x1 - x2, z1 - z2);
    }

    /** Camino de un nivel. Devuelve la posición de la siguiente plataforma. */
    private int[] level(int lv, Theme th, Tower.Pad from, double angle) {
        double d = o.levels() <= 1 ? 0 : (lv - 1) / (double) (o.levels() - 1);
        d = Math.min(1, d * o.difficulty());
        int n = 8 + lv / 5;
        // plan de subidas: +1 en unos saltos, una escalera (+3) a veces, la plataforma final +1
        boolean ladder = lv >= 4 && r.nextDouble() < 0.4;
        int need = o.rise() - 1 - (ladder ? 3 : 0);
        int ladderAt = ladder ? 2 + r.nextInt(Math.max(1, n - 4)) : -1;
        int[] dy = new int[n];
        List<Integer> slots = new ArrayList<>();
        for (int i = 0; i < n; i++) if (i != ladderAt) slots.add(i);
        java.util.Collections.shuffle(slots, r);
        for (int i = 0; i < need && i < slots.size(); i++) dy[slots.get(i)] = 1;
        // alguna bajada para variar (compensada con otra subida)
        if (lv > 6 && r.nextDouble() < 0.5) {
            for (int s : slots) if (dy[s] == 0) {
                dy[s] = -1;
                for (int s2 : slots) if (dy[s2] == 0 && s2 != s) {
                    dy[s2] = 1;
                    break;
                }
                break;
            }
        }
        if (ladderAt >= 0) dy[ladderAt] = 3;

        int x = from.x(), y = from.y(), z = from.z();
        double rad = Math.hypot(x, z);
        double hMin = 2.0 + 1.25 * d, hMax = 3.0 + 1.3 * d;
        int blinks = 0;
        String prev = "pad";
        int extra = from.radius();
        for (int i = 0; i < n; i++) {
            if (dy[i] == 3) {
                int[] c = ladder(lv, i, th, x, y, z);
                if (c != null) {
                    x = c[0];
                    y = c[1];
                    z = c[2];
                    prev = "ladder";
                    extra = 0;
                    continue;
                }
                dy[i] = 1; // no cupo la escalera: salto normal
            }
            int ny = y + dy[i];
            if ("slab".equals(prev) && ny > y) ny = y; // desde media losa no se sube un bloque entero
            String kind = "block";
            double k = r.nextDouble();
            boolean nextUp = i + 1 < n && dy[i + 1] > 0;
            if (lv >= 18 && ny == y && blinks < 1 + lv / 20 && k < 0.08 + 0.12 * d) {
                kind = "blink";
                blinks++;
            } else if (lv >= 6 && k < 0.22 + 0.25 * d && k >= 0.12) kind = "post";
            else if (!nextUp && k < 0.12) kind = "slab";
            double lo = hMin + extra, hi = Math.min(hMax, ny > y ? 3.9 : ny < y ? hMax + 0.5 : hMax) + extra;
            if ("post".equals(kind)) hi -= 0.5;
            if ("post".equals(prev) || "blink".equals(prev)) hi -= 0.3;
            int[] best = null;
            for (int tries = 0; tries < 60 && best == null; tries++) {
                double h = lo + r.nextDouble() * Math.max(0.1, hi - lo);
                double nr = Math.max(o.radius() - 2.5, Math.min(o.radius() + 3.5, rad + (r.nextDouble() * 3 - 1.5) + (tries > 30 ? 2 : 0)));
                double na = Math.atan2(z, x) + h / nr;
                int nx = (int) Math.round(nr * Math.cos(na)), nz = (int) Math.round(nr * Math.sin(na));
                double real = dist(x, z, nx, nz);
                if (real < lo - 0.4 || real > hi + 0.3 || (ny > y && real > 3.95 + extra)) continue;
                if (!free(nx, ny, nz, 3, 3)) continue;
                best = new int[] {nx, ny, nz};
            }
            if (best == null) {
                // último recurso: un bloque sencillo justo delante, siempre posible
                double na = Math.atan2(z, x) + 2.2 / rad;
                best = new int[] {(int) Math.round(rad * Math.cos(na)), y, (int) Math.round(rad * Math.sin(na))};
                kind = "block";
            }
            x = best[0];
            y = best[1];
            z = best[2];
            rad = Math.hypot(x, z);
            Material m = switch (kind) {
                case "slab" -> th.slab();
                case "post" -> th.post();
                case "blink" -> th.light();
                default -> th.pathBlock(r);
            };
            BlockData bd = m.createBlockData();
            if (bd instanceof Slab s) s.setType(Slab.Type.BOTTOM);
            if ("blink".equals(kind)) t.blinks.add(new Tower.Blink(x, y, z, bd, blinks % 2));
            put(x, y, z, bd);
            light(x, y + 2, z, 12);
            mark(new Tower.Step(lv, i, x, y, z, kind));
            prev = kind;
            extra = 0;
        }
        // siguiente plataforma (3×3): un salto normal desde el último bloque
        int ty = y + 1;
        if ("slab".equals(prev)) ty = y;
        for (int tries = 0; tries < 80; tries++) {
            double h = 3.0 + 0.7 * d + r.nextDouble() * 0.6 + (tries > 40 ? 1 : 0);
            double nr = Math.max(o.radius() - 2, Math.min(o.radius() + 3, rad + r.nextDouble() * 2 - 1));
            double na = Math.atan2(z, x) + h / nr;
            int nx = (int) Math.round(nr * Math.cos(na)), nz = (int) Math.round(nr * Math.sin(na));
            boolean ok = true;
            for (int ax = -1; ax <= 1 && ok; ax++)
                for (int az = -1; az <= 1 && ok; az++) ok = free(nx + ax, ty, nz + az, 3, 3);
            if (ok && dist(x, z, nx, nz) <= 4.6) return new int[] {nx, ty, nz};
        }
        double na = Math.atan2(z, x) + 3.4 / rad;
        return new int[] {(int) Math.round(rad * Math.cos(na)), ty, (int) Math.round(rad * Math.sin(na))};
    }

    /** Escalera de mano: columna de 3 con escalera pegada; se sube +3. Devuelve dónde se queda de pie. */
    private int[] ladder(int lv, int i, Theme th, int x, int y, int z) {
        double a = Math.atan2(z, x);
        double tx = -Math.sin(a), tz = Math.cos(a);
        int dx = 0, dz = 0;
        if (Math.abs(tx) > Math.abs(tz)) dx = tx > 0 ? 1 : -1;
        else dz = tz > 0 ? 1 : -1;
        int lx = x + dx, lz = z + dz, cx = x + 2 * dx, cz = z + 2 * dz;
        for (int k = 1; k <= 3; k++) if (!free(lx, y + k, lz, 0, 0) || !free(cx, y + k, cz, 0, 0)) return null;
        if (!free(cx, y + 3, cz, 3, 3)) return null;
        Material col = th.pillarBlock(r);
        if (!col.isOccluding()) col = Material.STONE_BRICKS;
        BlockFace facing = dx == 1 ? BlockFace.WEST : dx == -1 ? BlockFace.EAST : dz == 1 ? BlockFace.NORTH : BlockFace.SOUTH;
        for (int k = 1; k <= 3; k++) {
            put(cx, y + k, cz, col);
            Directional lad = (Directional) Material.LADDER.createBlockData();
            lad.setFacing(facing);
            put(lx, y + k, lz, lad);
        }
        light(cx, y + 5, cz, 12);
        mark(new Tower.Step(lv, i, cx, y + 3, cz, "ladder"));
        return new int[] {cx, y + 3, cz};
    }

    private void pad(int level, int cx, int cy, int cz, int radius, Theme th) {
        t.pads[level] = new Tower.Pad(level, cx, cy, cz, radius);
        for (int ax = -radius; ax <= radius; ax++)
            for (int az = -radius; az <= radius; az++) {
                boolean center = ax == 0 && az == 0;
                boolean edge = Math.abs(ax) == radius || Math.abs(az) == radius;
                put(cx + ax, cy, cz + az, center ? th.light() : edge && radius > 1 ? th.pillarBlock(r) : th.pad());
                long k = Tower.key(cx + ax, cy, cz + az);
                t.levelOf.put(k, level);
                if (!center) light(cx + ax, cy + 2, cz + az, 14);
            }
        // la de abajo de la plataforma: un remate colgante con el bloque de luz
        put(cx, cy - 1, cz, th.pillarBlock(r));
        put(cx, cy - 2, cz, th.light());
    }

    private void pillar() {
        int bottom = t.pads[1].y() - 6, top = t.pads[o.levels() + 1].y() + 3;
        for (int y = bottom; y <= top; y++) {
            int lv = levelForY(y);
            Theme th = Themes.of(lv);
            boolean ring = (y - t.pads[Math.min(lv, o.levels())].y()) == 0;
            for (int x = -4; x <= 4; x++)
                for (int z = -4; z <= 4; z++) {
                    double rr = Math.sqrt(x * x + z * z);
                    if (rr > 3.9 || rr < 2.6) continue;
                    Material m = ring ? th.light() : th.pillarBlock(r);
                    if (y == bottom || y == top) m = th.pillarBlock(r);
                    put(x, y, z, m);
                }
            if (y == top || y == bottom) for (int x = -2; x <= 2; x++) for (int z = -2; z <= 2; z++) if (x * x + z * z < 7) put(x, y, z, th.light());
        }
        // corona en la cima: anillo de luz y pilares
        Tower.Pad sum = t.pads[o.levels() + 1];
        for (int a = 0; a < 8; a++) {
            double ang = a * Math.PI / 4;
            int x = (int) Math.round(Math.cos(ang) * 2.2), z = (int) Math.round(Math.sin(ang) * 2.2);
            for (int k = 1; k <= 4; k++) put(x, top + k, z, k == 4 ? Material.BEACON : Material.QUARTZ_PILLAR);
        }
        light(sum.x(), sum.y() + 4, sum.z(), 15);
    }

    private int levelForY(int y) {
        for (int lv = o.levels(); lv >= 1; lv--) if (y >= t.pads[lv].y() - 1) return lv;
        return 1;
    }

    /** Decorado: racimos en la columna e islas flotantes alrededor (lejos del camino, solo para el paisaje). */
    private void scenery(int lv, Theme th) {
        Tower.Pad a = t.pads[lv], b = t.pads[lv + 1];
        int y0 = a.y(), y1 = Math.max(a.y() + 2, b.y());
        for (int i = 0; i < 6; i++) {
            double ang = r.nextDouble() * Math.PI * 2;
            int y = y0 + r.nextInt(Math.max(1, y1 - y0 + 1));
            int x = (int) Math.round(Math.cos(ang) * 4.6), z = (int) Math.round(Math.sin(ang) * 4.6);
            if (!free(x, y, z, 1, 1) && isSolid(x, y, z)) continue;
            put(x, y, z, th.decoBlock(r));
            if (r.nextBoolean() && !isSolid(x, y - 1, z)) put(x, y - 1, z, th.decoBlock(r));
        }
        for (int i = 0; i < 2; i++) {
            double ang = r.nextDouble() * Math.PI * 2;
            double rr = 17 + r.nextDouble() * 5;
            int cx = (int) Math.round(Math.cos(ang) * rr), cz = (int) Math.round(Math.sin(ang) * rr);
            int cy = y0 + r.nextInt(Math.max(1, y1 - y0 + 1));
            int rad = 2 + r.nextInt(2);
            for (int x = -rad; x <= rad; x++)
                for (int z = -rad; z <= rad; z++)
                    for (int y = -rad; y <= 0; y++) {
                        double dd = x * x + z * z + (y * y) * 2.2;
                        if (dd > rad * rad + 0.5 || r.nextDouble() < 0.08) continue;
                        Material m = y == 0 ? th.pathBlock(r) : th.decoBlock(r);
                        put(cx + x, cy + y, cz + z, m);
                    }
            put(cx, cy - rad, cz, th.light());
            light(cx, cy + 2, cz, 13);
            if (r.nextBoolean()) for (int k = 1; k <= 2; k++) put(cx, cy + k, cz, th.decoBlock(r));
        }
    }

    /** Datos de un bloque desde texto (para la config). */
    static BlockData data(String s) {
        try {
            return Bukkit.createBlockData(s);
        } catch (IllegalArgumentException e) {
            return Material.STONE.createBlockData();
        }
    }
}
