package dev.livearena.basedefense.arena;

import dev.livearena.basedefense.Settings;
import java.util.Random;
import org.bukkit.util.BoundingBox;
import org.bukkit.util.Vector;

/**
 * Diseña la arena en un {@link Canvas} (sin tocar el mundo). Ejes: el carril corre a lo largo de
 * +Z; la base está en z &lt; 0 y el portal de spawn al fondo, en z ≈ largo. Misma semilla → mismo mapa.
 *
 * <pre>
 *   z: -28 ……… -16 [plataforma -15..-1] [región base 0..3] [carril 0..L] [portal L+2] ……… L+14
 *   x: bosque | barrera | carril (-hw..hw) | barrera | bosque
 * </pre>
 */
public final class ArenaGenerator {
    private final Settings s;
    private final long seed;
    private final Noise n;
    private final Random r;
    private final Canvas c = new Canvas();
    private final int g, hw, L, F, bh, top;
    private final int islandX, zMin, zMax;
    private final int platHalf;

    public ArenaGenerator(Settings s, long seed) {
        this.s = s;
        this.seed = seed;
        this.n = new Noise(seed);
        this.r = new Random(seed);
        this.g = s.groundY;
        this.hw = s.width / 2;
        this.L = s.length;
        this.F = s.forest;
        this.bh = s.baseHeight;
        this.top = g + bh;
        this.islandX = hw + 1 + F + 3;
        this.zMin = -30;
        this.zMax = L + 16;
        this.platHalf = hw + 4;
    }

    public Canvas canvas() {
        return c;
    }

    public ArenaData build() {
        terrain();
        lane();
        forest();
        ruins();
        platform();
        portal();
        laneDebris();
        barriers();
        lights();
        return data();
    }

    // ───────────────────────────── TERRENO ─────────────────────────────

    private boolean inLane(int x, int z) {
        return Math.abs(x) <= hw && z >= 0 && z <= L + 1;
    }

    /** Distancia al borde de la isla (negativa = fuera), con bordes rotos por ruido. */
    private double edge(int x, int z) {
        double ex = islandX - Math.abs(x);
        double ez = Math.min(z - zMin, zMax - z);
        double e = Math.min(ex, ez);
        double jag = (n.fbm(x * 1.3 + 500, z * 1.3, 9, 3) - 0.5) * 9 + (n.cell(x, z, 7) - 0.5) * 1.6;
        return e + jag;
    }

    private int groundHeight(int x, int z) {
        if (inLane(x, z) || Math.abs(x) == hw + 1 && z >= -1 && z <= L + 2) return g;
        if (z < 0 && z > -18 && Math.abs(x) <= platHalf + 1) return g;
        double dist = Math.abs(x) - (hw + 1);
        double berm = dist > 0 ? Math.min(2.4, dist * 0.55) : 0;
        if (z < -1 || z > L + 2) berm = Math.min(2.4, Math.max(berm, 1.2));
        double hills = n.fbm(x + 40, z - 70, 11, 3) * 3.2 - 0.9;
        return g + (int) Math.round(Math.max(0, berm + hills));
    }

    private void terrain() {
        for (int x = -islandX - 6; x <= islandX + 6; x++)
            for (int z = zMin - 6; z <= zMax + 6; z++) {
                double e = edge(x, z);
                if (e < 0) continue;
                int h = groundHeight(x, z);
                if (e < 2.5) h = Math.min(h, g + (int) Math.floor(e));
                int depth = (int) Math.round(2 + Math.min(e, 18) * 1.05 + n.fbm(x * 0.9, z * 0.9 - 300, 7, 3) * 7);
                if (n.cell(x, z, 3) < 0.035) depth += 4 + (int) (n.cell(x, z, 4) * 9);
                int bottom = g - depth;
                for (int y = bottom; y <= h; y++) {
                    int fromTop = h - y;
                    String b;
                    if (fromTop == 0) b = surfaceForest(x, z);
                    else if (fromTop < 3) b = n.cell(x, y, z) < 0.2 ? "coarse_dirt" : "dirt";
                    else if (y < bottom + 3 && n.cell(x, y * 3, z) < 0.5) b = "cobbled_deepslate";
                    else {
                        double v = n.value(x * 0.21, y * 0.21, z * 0.21);
                        b = v < 0.3 ? "stone" : v < 0.45 ? "andesite" : v < 0.6 ? "tuff" : v < 0.7 ? "dirt" : v < 0.8 ? "gravel" : "stone";
                    }
                    c.set(x, y, z, b);
                }
                c.surface(x, z, h);
                // goteo bajo la isla: raíces colgantes y espeleotemas
                double drip = n.cell(x, z, 11);
                if (drip < 0.06) c.set(x, bottom - 1, z, "hanging_roots");
                else if (drip < 0.085) {
                    c.set(x, bottom - 1, z, "pointed_dripstone[vertical_direction=down,thickness=frustum]");
                    c.set(x, bottom - 2, z, "pointed_dripstone[vertical_direction=down,thickness=tip]");
                }
            }
        // fragmentos flotantes sueltos alrededor de la isla rota
        for (int i = 0; i < 9; i++) {
            int fx = (r.nextBoolean() ? 1 : -1) * (islandX + 4 + r.nextInt(10));
            int fz = zMin + r.nextInt(zMax - zMin);
            int fy = g - 6 - r.nextInt(14);
            int rad = 1 + r.nextInt(3);
            for (int dx = -rad; dx <= rad; dx++)
                for (int dz = -rad; dz <= rad; dz++)
                    for (int dy = -rad * 2; dy <= 0; dy++) {
                        if (dx * dx + dz * dz > rad * rad + 1 || -dy > (rad + 1 - Math.max(Math.abs(dx), Math.abs(dz))) * 2) continue;
                        c.set(fx + dx, fy + dy, fz + dz, dy == 0 ? "coarse_dirt" : r.nextBoolean() ? "stone" : "tuff");
                    }
        }
    }

    private String surfaceForest(int x, int z) {
        double v = n.fbm(x - 900, z + 900, 5, 2);
        double w = n.cell(x, z, 21);
        if (w < 0.05) return "moss_block";
        if (v < 0.30) return "podzol";
        if (v < 0.48) return "coarse_dirt";
        if (v < 0.60) return "rooted_dirt";
        if (v < 0.70) return "dirt";
        if (v < 0.80) return "podzol";
        return w < 0.5 ? "pale_moss_block" : "mud";
    }

    // ───────────────────────────── CARRIL ─────────────────────────────

    private void lane() {
        for (int x = -hw - 1; x <= hw + 1; x++)
            for (int z = -1; z <= L + 2; z++) {
                double v = n.fbm(x * 1.1 + 77, z * 1.1, 6, 3);
                double track = Math.abs(x) <= 2 ? 0.18 : 0;
                double cell = n.cell(x, z, 31);
                String b;
                if (cell < track) b = "dirt_path";
                else if (v < 0.28) b = "coarse_dirt";
                else if (v < 0.40) b = "dirt";
                else if (v < 0.50) b = "podzol";
                else if (v < 0.58) b = "gravel";
                else if (v < 0.67) b = "mud";
                else if (v < 0.76) b = "packed_mud";
                else if (v < 0.85) b = "rooted_dirt";
                else b = "coarse_dirt";
                for (int y = g + 1; y <= g + 7; y++) c.remove(x, y, z);
                c.set(x, g, z, b);
                c.set(x, g - 1, z, cell < 0.5 ? "dirt" : "coarse_dirt");
                // baches y charcos
                double hole = n.fbm(x * 0.8 - 120, z * 0.8 + 40, 4, 2);
                if (Math.abs(x) <= hw && z > 3 && z < L - 1 && hole > 0.72) {
                    c.set(x, g, z, hole > 0.78 ? "water" : "mud");
                    c.set(x, g - 1, z, "mud");
                }
                c.surface(x, z, g);
            }
        // vía de tren abandonada que cruza parte del carril
        int railZ = L / 3 + r.nextInt(L / 3);
        for (int x = -hw; x <= hw; x++) {
            if (r.nextDouble() < 0.3 || c.get(x, g, railZ).getMaterial().name().equals("WATER")) continue;
            c.set(x, g + 1, railZ, "rail[shape=east_west]");
            if (r.nextDouble() < 0.4) c.set(x, g, railZ, "gravel");
        }
    }

    /** Restos que no bloquean el paso: hierba seca, hojarasca, huesos, vagonetas y vallas caídas. */
    private void laneDebris() {
        double dens = s.decoDensity;
        for (int x = -hw; x <= hw; x++)
            for (int z = 2; z <= L; z++) {
                if (!c.empty(x, g + 1, z)) continue;
                String under = c.get(x, g, z) == null ? "" : c.get(x, g, z).getMaterial().name();
                if (under.equals("WATER") || under.equals("DIRT_PATH")) continue;
                double v = n.cell(x, z, 41);
                if (v < 0.05 * dens) c.set(x, g + 1, z, "short_dry_grass");
                else if (v < 0.075 * dens) c.set(x, g + 1, z, "dead_bush");
                else if (v < 0.11 * dens) c.set(x, g + 1, z, "leaf_litter[segment_amount=" + (1 + (int) (v * 1000) % 4) + ",facing=" + Pieces.pick(r, "north", "south", "east", "west") + "]");
                else if (v < 0.12 * dens) c.set(x, g + 1, z, "tall_dry_grass");
            }
        int carts = (int) Math.round(L / 26.0 * dens) + 1;
        for (int i = 0; i < carts; i++) {
            int z = 8 + r.nextInt(Math.max(1, L - 14));
            double x = (r.nextBoolean() ? 1 : -1) * (hw - 0.8 - r.nextDouble());
            Pieces.overturnedCart(c, r, x + 0.5, g + 1, z + 0.5);
        }
        int bones = (int) Math.round(L / 3.5 * dens);
        for (int i = 0; i < bones; i++) Pieces.bone(c, r, -hw + r.nextDouble() * (hw * 2 + 1), g + 1, 4 + r.nextDouble() * (L - 6));
        int fences = (int) Math.round(L / 14.0 * dens);
        for (int i = 0; i < fences; i++) Pieces.fallenFence(c, r, (r.nextBoolean() ? 1 : -1) * (hw - 1.5 - r.nextDouble() * 2), g + 1, 6 + r.nextDouble() * (L - 10));
    }

    // ───────────────────────────── BOSQUE ─────────────────────────────

    private void forest() {
        double dens = s.decoDensity;
        int cell = 5;
        for (int cx = -islandX; cx <= islandX; cx += cell)
            for (int cz = zMin; cz <= zMax; cz += cell) {
                int x = cx + r.nextInt(cell), z = cz + r.nextInt(cell);
                double roll = r.nextDouble();
                if (Math.abs(x) <= hw + 3 && z >= -2 && z <= L + 4) continue; // carril y su orilla
                if (z > -19 && z < 1 && Math.abs(x) <= platHalf + 2) continue; // plataforma
                if (edge(x, z) < 3) continue;
                if (roll > 0.82 * Math.min(1.3, dens)) continue;
                int y = c.top(x, z);
                if (y == Integer.MIN_VALUE) continue;
                double t = r.nextDouble();
                boolean roomy = Math.abs(x) > hw + 5;
                if (t < 0.34) Pieces.deadTree(c, r, x, y + 1, z);
                else if (t < 0.56 && roomy) Pieces.bigDarkTree(c, r, x, y + 1, z, r.nextDouble() < 0.3);
                else if (t < 0.74) Pieces.burntTree(c, r, x, y + 1, z);
                else Pieces.deadSpruce(c, r, x, y + 1, z);
            }
        // suelo del bosque
        for (int x = -islandX - 4; x <= islandX + 4; x++)
            for (int z = zMin - 4; z <= zMax + 4; z++) {
                if (Math.abs(x) <= hw + 1 && z >= -1 && z <= L + 2) continue;
                if (z > -18 && z < 0 && Math.abs(x) <= platHalf + 1) continue;
                int y = c.top(x, z);
                if (y == Integer.MIN_VALUE || !c.empty(x, y + 1, z)) continue;
                double v = n.cell(x, z, 51);
                if (v < 0.13 * dens) c.set(x, y + 1, z, "leaf_litter[segment_amount=" + (1 + (int) (v * 997) % 4) + ",facing=north]");
                else if (v < 0.19 * dens) c.set(x, y + 1, z, "short_dry_grass");
                else if (v < 0.23 * dens) c.set(x, y + 1, z, "pale_moss_carpet");
                else if (v < 0.25 * dens) c.set(x, y + 1, z, "dead_bush");
                else if (v < 0.262 * dens) c.set(x, y + 1, z, "firefly_bush");
                else if (v < 0.272 * dens) c.set(x, y + 1, z, Pieces.pick(r, "brown_mushroom", "red_mushroom"));
                else if (v < 0.285 * dens) c.set(x, y + 1, z, "tall_dry_grass");
                else if (v < 0.29 * dens) c.set(x, y + 1, z, "cobweb");
            }
    }

    // ───────────────────────────── RUINAS ─────────────────────────────

    private void ruins() {
        double dens = s.decoDensity;
        for (int side = -1; side <= 1; side += 2) {
            int z = 2 + r.nextInt(5);
            while (z < L) {
                int x = side * (hw + 2 + r.nextInt(3));
                int y = c.top(x, z);
                if (y != Integer.MIN_VALUE && r.nextDouble() < 0.9 * Math.min(1.2, dens)) {
                    int rot = 1 + r.nextInt(2) * 2; // a lo largo del carril
                    double t = r.nextDouble();
                    if (t < 0.34) Pieces.ruinWall(c, r, n, x, y + 1, z, rot);
                    else if (t < 0.5) Pieces.fallenPillar(c, r, x, y + 1, z, rot);
                    else if (t < 0.66) Pieces.brokenArch(c, r, x, y + 1, z, rot);
                    else if (t < 0.8) Pieces.ironFence(c, r, x, y + 1, z, rot);
                    else if (t < 0.9) Pieces.copperRemains(c, r, x + side, y + 1, z, side > 0 ? 3 : 1);
                    else Pieces.rubble(c, r, x + side, y, z);
                }
                z += 9 + r.nextInt(8);
            }
        }
        // ruinas sueltas en el interior del bosque
        int extra = (int) Math.round((L / 12.0) * dens);
        for (int i = 0; i < extra; i++) {
            int side = r.nextBoolean() ? 1 : -1;
            int x = side * (hw + 7 + r.nextInt(Math.max(1, F - 6)));
            int z = zMin + 4 + r.nextInt(zMax - zMin - 8);
            int y = c.top(x, z);
            if (y == Integer.MIN_VALUE || edge(x, z) < 4) continue;
            switch (r.nextInt(5)) {
                case 0 -> Pieces.ruinWall(c, r, n, x, y + 1, z, r.nextInt(4));
                case 1 -> Pieces.brokenArch(c, r, x, y + 1, z, r.nextInt(4));
                case 2 -> Pieces.copperRemains(c, r, x, y + 1, z, r.nextInt(4));
                case 3 -> Pieces.fallenPillar(c, r, x, y + 1, z, r.nextInt(4));
                default -> Pieces.rubble(c, r, x, y, z);
            }
        }
    }

    // ───────────────────────────── BASE ─────────────────────────────

    private void platform() {
        int x0 = -platHalf, x1 = platHalf, z0 = -15, z1 = -1;
        // cuerpo de la plataforma: muro exterior remendado, relleno de tierra
        for (int x = x0; x <= x1; x++)
            for (int z = z0; z <= z1; z++) {
                boolean rim = x == x0 || x == x1 || z == z0 || z == z1;
                for (int y = g; y < top; y++) {
                    String b;
                    if (!rim) b = "dirt";
                    else if (z == z1) b = frontWall(x, y);
                    else b = n.cell(x, y, z) < 0.5 ? Pieces.bricks(r) : Pieces.pick(r, "cobblestone", "spruce_planks", "mossy_cobblestone", "packed_mud");
                    c.set(x, y, z, b);
                }
                double v = n.cell(x, z, 61);
                String floor = v < 0.34 ? "spruce_planks" : v < 0.56 ? "dark_oak_planks" : v < 0.7 ? "coarse_dirt" : v < 0.82 ? "cobblestone" : v < 0.92 ? "packed_mud" : "stripped_spruce_wood[axis=x]";
                c.set(x, top, z, floor);
                c.surface(x, z, top);
            }
        // vigas de refuerzo en la cara frontal
        for (int x = x0; x <= x1; x += 3)
            for (int y = g; y <= top; y++) c.set(x, y, z1, "stripped_spruce_log[axis=y]");
        // estacas afiladas delante de la puerta (dentro de la región de la base)
        for (int x = -hw; x <= hw; x += 2) {
            if (r.nextDouble() < 0.25) continue;
            c.set(x, g + 1, 0, "pointed_dripstone[vertical_direction=up,thickness=tip]");
        }
        // borde frontal bajo (trampillas) para no tapar la vista del carril
        for (int x = x0; x <= x1; x++) c.set(x, top + 1, z1, "spruce_trapdoor[half=bottom,facing=north,open=false]");
        // barricadas laterales y traseras: vallas, barriles, sacos (barro) y troncos apilados
        for (int z = z0; z <= z1 - 1; z++) {
            barricade(x0, z, 3);
            barricade(x1, z, 1);
        }
        for (int x = x0; x <= x1; x++) barricade(x, z0, 0);
        // sacos terreros en las esquinas delanteras
        for (int k = 0; k < 3; k++) {
            c.set(x0 + k, top + 1, z1, "mud_brick_slab[type=bottom]");
            c.set(x1 - k, top + 1, z1, "mud_brick_slab[type=bottom]");
        }
        c.set(x0, top + 1, z1, "packed_mud");
        c.set(x1, top + 1, z1, "packed_mud");
        c.set(x0, top + 2, z1, "lantern[hanging=false]");
        c.set(x1, top + 2, z1, "lantern[hanging=false]");
        if (bh <= 1) {
            // A ras de suelo: barricada baja de sacos terreros y tablones por delante (se dispara por encima, los
            // zombis llegan cara a cara). Postes de valla cada 4 para que se lea como una defensa improvisada.
            for (int x = x0; x <= x1; x++) {
                boolean post = Math.floorMod(x, 4) == 2 && Math.abs(x) > 2; // el centro queda despejado (es donde se apunta)
                String b = post ? "stripped_spruce_log[axis=y]" : Math.floorMod(x * 7 + 3, 5) < 2 ? "mud_bricks" : Math.floorMod(x, 3) == 0 ? "spruce_planks" : "packed_mud";
                c.set(x, top + 1, z1, b);
                if (post) c.set(x, top + 2, z1, "spruce_fence");
            }
            c.set(x0, top + 2, z1, "lantern[hanging=false]");
            c.set(x1, top + 2, z1, "lantern[hanging=false]");
        }
        watchtower(x0 + 1, z0 + 1);
        // hogueras con humo alto (fardo de heno debajo)
        campfire(x1 - 2, z0 + 2);
        campfire(x0 + 5, z1 - 4);
        campfire(x1 - 3, z1 - 5);
        // cofres de munición y suministros
        String[] props = {"chest[facing=south]", "barrel[facing=up]", "barrel[facing=north]", "chest[facing=east]", "crafting_table", "chipped_anvil[facing=east]",
            "cauldron", "smithing_table", "hay_block[axis=x]", "composter", "barrel[facing=up]", "grindstone[face=floor,facing=north]", "decorated_pot[facing=south]"};
        int placed = 0;
        for (int i = 0; i < 70 && placed < 16; i++) {
            int x = x0 + 1 + r.nextInt(x1 - x0 - 1);
            int z = z0 + 1 + r.nextInt(z1 - z0 - 4);
            if (Math.abs(x) < 4 && z > -11) continue; // pasillo central despejado para el streamer
            if (!c.empty(x, top + 1, z)) continue;
            c.set(x, top + 1, z, props[r.nextInt(props.length)]);
            if (r.nextDouble() < 0.3 && c.empty(x, top + 2, z)) c.set(x, top + 2, z, Pieces.pick(r, "barrel[facing=up]", "white_carpet", "brown_carpet", "lantern[hanging=false]", "candle[candles=3,lit=true]"));
            placed++;
        }
        // lona sobre una zona de suministros
        for (int x = x1 - 5; x <= x1 - 1; x++) {
            c.set(x, top + 4, z0 + 4, "brown_wool");
            c.set(x, top + 4, z0 + 5, "brown_carpet");
            if (x == x1 - 5 || x == x1 - 1) for (int y = top + 1; y < top + 4; y++) c.set(x, y, z0 + 4, "spruce_fence");
        }
        c.set(x1 - 3, top + 3, z0 + 4, "lantern[hanging=true]");
        // luz cálida invisible sobre la plataforma
        for (int x = x0 + 3; x <= x1 - 3; x += 6)
            for (int z = z0 + 3; z <= z1 - 2; z += 5) c.soft(x, top + 3, z, "light[level=11]");
    }

    private String frontWall(int x, int y) {
        double v = n.cell(x, y, 71);
        if (y == g) return "cobblestone";
        if (v < 0.30) return "spruce_planks";
        if (v < 0.45) return "dark_oak_planks";
        if (v < 0.65) return Pieces.bricks(r);
        if (v < 0.78) return "cobblestone";
        if (v < 0.88) return "oak_planks";
        return "packed_mud";
    }

    private void barricade(int x, int z, int face) {
        double v = n.cell(x, z, 81);
        String facing = face == 0 ? "south" : face == 1 ? "west" : "east";
        if (v < 0.42) {
            c.set(x, top + 1, z, "spruce_fence");
            if (v < 0.2) c.set(x, top + 2, z, "spruce_fence");
        } else if (v < 0.58) {
            c.set(x, top + 1, z, "barrel[facing=up]");
        } else if (v < 0.72) {
            c.set(x, top + 1, z, "mud_brick_slab[type=bottom]");
        } else if (v < 0.84) {
            c.set(x, top + 1, z, "stripped_spruce_log[axis=" + (face == 0 ? "x" : "z") + "]");
            if (v < 0.78) c.set(x, top + 2, z, "spruce_slab[type=bottom]");
        } else if (v < 0.92) {
            c.set(x, top + 1, z, "spruce_trapdoor[half=bottom,facing=" + facing + ",open=true]");
        } else {
            c.set(x, top + 1, z, "iron_bars");
        }
    }

    /** Torre de vigilancia rota en una esquina trasera. */
    private void watchtower(int x, int z) {
        int h = 8;
        int[][] posts = {{0, 0}, {3, 0}, {0, 3}, {3, 3}};
        for (int i = 0; i < posts.length; i++) {
            int ph = i == 3 ? 4 : h; // un poste partido
            for (int y = 1; y <= ph; y++) c.set(x + posts[i][0], top + y, z + posts[i][1], "stripped_spruce_log[axis=y]");
        }
        for (int dx = 0; dx <= 3; dx++)
            for (int dz = 0; dz <= 3; dz++) {
                if (dx == 3 && dz == 3) continue;
                if (dx == 2 && dz == 3 || dx == 3 && dz == 2) {
                    if (r.nextBoolean()) continue;
                }
                c.soft(x + dx, top + 5, z + dz, "spruce_slab[type=bottom]");
            }
        for (int y = 1; y <= 5; y++) c.set(x + 1, top + y, z + 4, "ladder[facing=south]");
        c.soft(x + 1, top + 5, z + 4, "air");
        for (int dx = -1; dx <= 3; dx++) {
            if (r.nextDouble() < 0.45) continue;
            c.soft(x + dx, top + h + 1, z - 1 + (dx & 1), "spruce_stairs[facing=north]");
        }
        c.set(x, top + h + 1, z, "spruce_slab[type=bottom]");
        c.set(x + 3, top + h + 1, z, "spruce_slab[type=bottom]");
        c.set(x + 2, top + h, z + 1, "lantern[hanging=true]");
        c.set(x + 1, top + 6, z, "spruce_fence");
        c.set(x + 2, top + 6, z, "spruce_fence");
        c.set(x, top + 6, z + 1, "spruce_fence");
        c.set(x + 1, top + 7, z + 3, "cobweb");
        c.set(x + 3, top + 5, z + 3, "spruce_stairs[facing=west,half=top]");
    }

    private void campfire(int x, int z) {
        c.set(x, top, z, "hay_block[axis=y]");
        c.set(x, top + 1, z, "campfire[lit=true,signal_fire=true,facing=north]");
        c.soft(x + 1, top + 1, z, "cobblestone_slab[type=bottom]");
        c.soft(x - 1, top + 1, z, "cobblestone_slab[type=bottom]");
        c.soft(x, top + 1, z + 1, "spruce_log[axis=x]");
    }

    // ───────────────────────────── PORTAL ─────────────────────────────

    private void portal() {
        int pz = L + 3;
        int w = Math.min(hw - 1, 4); // marco interior de 2w-1 bloques
        int ph = 8;
        // marco de obsidiana válido (no se rompe con actualizaciones)
        for (int x = -w; x <= w; x++) {
            c.set(x, g, pz, "obsidian");
            c.set(x, g + ph + 1, pz, "obsidian");
        }
        for (int y = g; y <= g + ph + 1; y++) {
            c.set(-w, y, pz, "obsidian");
            c.set(w, y, pz, "obsidian");
        }
        for (int x = -w + 1; x <= w - 1; x++)
            for (int y = g + 1; y <= g + ph; y++) c.set(x, y, pz, "nether_portal[axis=x]");
        // ruina de piedra negra alrededor, rota por un lado
        for (int x = -w - 3; x <= w + 3; x++)
            for (int y = g; y <= g + ph + 4; y++)
                for (int dz = 0; dz <= 1; dz++) {
                    if (Math.abs(x) <= w && y <= g + ph + 1 && dz == 0) continue;
                    boolean outer = Math.abs(x) >= w + 1 || y >= g + ph + 2;
                    if (!outer) continue;
                    double archTop = g + ph + 4 - Math.pow(Math.abs(x) / (double) (w + 3), 3) * 3;
                    double broken = n.value(x * 0.5 + 300, y * 0.5) * 7 + (x > 0 ? 3 : 0);
                    if (y > archTop || y > g + ph + 4 - broken * 0.5 && x > 1) continue;
                    double v = n.cell(x, y * 2 + dz, pz);
                    String b = v < 0.30 ? "polished_blackstone_bricks" : v < 0.52 ? "cracked_polished_blackstone_bricks" : v < 0.66 ? "blackstone" : v < 0.76 ? "crying_obsidian" : v < 0.84 ? "gilded_blackstone" : v < 0.92 ? "obsidian" : "chiseled_polished_blackstone";
                    c.set(x, y, pz + dz, b);
                }
        // suelo corrompido, magma, fuego y cadenas
        for (int x = -hw - 2; x <= hw + 2; x++)
            for (int z = L - 6; z <= L + 6; z++) {
                double d = Math.hypot(x * 0.8, (z - pz) * 1.2);
                double v = n.fbm(x * 1.4, z * 1.4 + 600, 4, 2);
                if (d + v * 4 > 9.5 || c.top(x, z) == Integer.MIN_VALUE) continue;
                int y = c.top(x, z);
                if (z == pz && Math.abs(x) <= w) continue;
                String b = v < 0.35 ? "netherrack" : v < 0.5 ? "blackstone" : v < 0.62 ? "magma_block" : v < 0.8 ? "soul_soil" : "crimson_nylium";
                c.set(x, y, z, b);
                if (b.equals("netherrack") && Math.abs(x) > hw - 2 && z > pz && n.cell(x, z, 91) < 0.5 && c.empty(x, y + 1, z)) c.set(x, y + 1, z, "fire");
            }
        for (int x = -w - 2; x <= w + 2; x += 2) {
            if (Math.abs(x) <= w) continue;
            int len = 2 + r.nextInt(4);
            for (int k = 1; k <= len; k++) c.soft(x, g + ph + 4 - k, pz - 1, "iron_chain[axis=y]");
        }
        // columnas de humo a los lados del portal (niebla visible en el stream)
        for (int side = -1; side <= 1; side += 2) {
            int x = side * (w + 3);
            int y = c.top(x, pz - 2);
            c.set(x, y, pz - 2, "hay_block[axis=y]");
            c.set(x, y + 1, pz - 2, "campfire[lit=true,signal_fire=true,facing=north]");
            c.soft(x, y + 1, pz - 1, "soul_lantern[hanging=false]");
        }
        c.set(0, g + ph + 3, pz - 1, "soul_lantern[hanging=true]");
    }

    // ───────────────────── BARRERAS Y LUZ ─────────────────────

    private void barriers() {
        for (int z = 0; z <= L + 3; z++)
            for (int y = g + 1; y <= g + 6; y++)
                for (int side = -1; side <= 1; side += 2) c.set(side * (hw + 1), y, z, "barrier");
        for (int x = -hw; x <= hw; x++)
            for (int y = g + 1; y <= g + 6; y++) c.soft(x, y, L + 4, "barrier");
        // jaula de la plataforma (lados y fondo; el frente lo vigila la tarea de la base)
        int x0 = -platHalf - 1, x1 = platHalf + 1, z0 = -16;
        for (int y = top + 1; y <= top + 12; y++) {
            for (int z = z0; z <= 0; z++) {
                c.set(x0, y, z, "barrier");
                c.set(x1, y, z, "barrier");
            }
            for (int x = x0; x <= x1; x++) c.set(x, y, z0, "barrier");
        }
    }

    private void lights() {
        String lane = "light[level=" + s.laneLight + "]";
        if (s.laneLight <= 0) return;
        for (int z = 2; z <= L + 1; z += 5) {
            c.soft(-hw + 1, g + 3, z, lane);
            c.soft(hw - 1, g + 3, z + 2, lane);
            if (z % 10 == 2) c.soft(0, g + 5, z, lane);
        }
    }

    // ───────────────────────────── DATOS ─────────────────────────────

    private ArenaData data() {
        ArenaData a = new ArenaData();
        a.seed = seed;
        a.groundY = g;
        a.laneHalfWidth = hw;
        a.playerSpawn = new Vector(0.5, top + 1, -2.5);
        a.playerYaw = 0f;
        a.mobSpawn = new Vector(0.5, g + 1, L + 0.5);
        for (int z = L - 2; z > 4; z -= 10) a.waypoints.add(new Vector(0.5, g + 1, z + 0.5));
        a.waypoints.add(new Vector(0.5, g + 1, 1.5));
        a.baseRegion = new BoundingBox(-hw - 0.5, g - 2, -1, hw + 1.5, g + 7, 3.2);
        a.platform = new BoundingBox(-platHalf, top, -15, platHalf + 1, top + 14, -0.3);
        a.bounds = new BoundingBox(c.minX, c.minY, c.minZ, c.maxX + 1, c.maxY + 1, c.maxZ + 1);
        return a;
    }
}
