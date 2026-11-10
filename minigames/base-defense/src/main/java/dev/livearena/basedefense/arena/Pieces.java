package dev.livearena.basedefense.arena;

import java.util.Random;
import org.bukkit.Material;
import org.bukkit.block.data.BlockData;
import org.bukkit.block.structure.StructureRotation;
import org.bukkit.entity.BlockDisplay;
import org.bukkit.entity.ItemDisplay;
import org.bukkit.inventory.ItemStack;
import org.bukkit.util.Transformation;
import org.joml.Quaternionf;
import org.joml.Vector3f;

/**
 * Piezas pequeñas y reutilizables (árboles, ruinas, restos y elementos de la base). El generador
 * las reparte con variación de rotación, altura y deterioro. Todas trabajan en coordenadas
 * locales (dx, dy, dz) que {@link Stamp} gira y traslada.
 */
final class Pieces {
    private Pieces() {}

    /** Coloca bloques relativos a un origen con una de 4 rotaciones. */
    static final class Stamp {
        final Canvas c;
        final int ox, oy, oz, rot;
        final StructureRotation sr;

        Stamp(Canvas c, int ox, int oy, int oz, int rot) {
            this.c = c;
            this.ox = ox;
            this.oy = oy;
            this.oz = oz;
            this.rot = rot & 3;
            this.sr = switch (this.rot) {
                case 1 -> StructureRotation.CLOCKWISE_90;
                case 2 -> StructureRotation.CLOCKWISE_180;
                case 3 -> StructureRotation.COUNTERCLOCKWISE_90;
                default -> StructureRotation.NONE;
            };
        }

        int wx(int dx, int dz) {
            return ox + switch (rot) { case 1 -> -dz; case 2 -> -dx; case 3 -> dz; default -> dx; };
        }

        int wz(int dx, int dz) {
            return oz + switch (rot) { case 1 -> dx; case 2 -> -dz; case 3 -> -dx; default -> dz; };
        }

        BlockData turn(String s) {
            BlockData d = Canvas.data(s);
            if (rot == 0) return d;
            d = d.clone();
            d.rotate(sr);
            return d;
        }

        void set(int dx, int dy, int dz, String s) {
            c.set(wx(dx, dz), oy + dy, wz(dx, dz), turn(s));
        }

        void soft(int dx, int dy, int dz, String s) {
            int x = wx(dx, dz), y = oy + dy, z = wz(dx, dz);
            if (c.empty(x, y, z)) c.set(x, y, z, turn(s));
        }

        /** Rellena hacia abajo hasta el suelo para que nada flote (cimientos). */
        void footing(int dx, int dz, String s) {
            int x = wx(dx, dz), z = wz(dx, dz);
            int top = c.top(x, z);
            if (top == Integer.MIN_VALUE) return;
            for (int y = oy - 1; y > top; y--) c.set(x, y, z, Canvas.data(s));
        }
    }

    static String pick(Random r, String... options) {
        return options[r.nextInt(options.length)];
    }

    static String bricks(Random r) {
        double v = r.nextDouble();
        if (v < 0.36) return "stone_bricks";
        if (v < 0.62) return "cracked_stone_bricks";
        if (v < 0.84) return "mossy_stone_bricks";
        if (v < 0.92) return "mossy_cobblestone";
        return "cobblestone";
    }

    // ───────────────────────────── ÁRBOLES ─────────────────────────────

    /** Árbol muerto: tronco inclinado sin hojas con ramas desnudas. */
    static void deadTree(Canvas c, Random r, int x, int y, int z) {
        String log = pick(r, "dark_oak_log", "dark_oak_log", "pale_oak_log", "spruce_log", "stripped_dark_oak_log");
        int h = 7 + r.nextInt(9);
        double lx = (r.nextDouble() - 0.5) * 0.35, lz = (r.nextDouble() - 0.5) * 0.35;
        double px = x + 0.5, pz = z + 0.5;
        for (int i = 0; i < h; i++) {
            c.set((int) Math.floor(px), y + i, (int) Math.floor(pz), log + "[axis=y]");
            if (i > 2) {
                px += lx;
                pz += lz;
            }
            if (i > h / 3 && r.nextDouble() < 0.33) branch(c, r, (int) Math.floor(px), y + i, (int) Math.floor(pz), log, 2 + r.nextInt(4), true);
        }
        int tx = (int) Math.floor(px), tz = (int) Math.floor(pz);
        for (int b = 0; b < 2 + r.nextInt(2); b++) branch(c, r, tx, y + h - 1, tz, log, 2 + r.nextInt(3), true);
        roots(c, r, x, y, z, log);
        if (r.nextDouble() < 0.35) c.set(tx, y + h, tz, "pale_hanging_moss[tip=true]");
    }

    /** Árbol quemado: base de basalto y carbón, tronco ennegrecido roto. */
    static void burntTree(Canvas c, Random r, int x, int y, int z) {
        int h = 4 + r.nextInt(7);
        for (int i = 0; i < h; i++) {
            String b = i < h / 2 ? pick(r, "basalt[axis=y]", "polished_basalt[axis=y]", "dark_oak_wood[axis=y]") : pick(r, "dark_oak_log[axis=y]", "basalt[axis=y]", "stripped_dark_oak_log[axis=y]");
            c.set(x, y + i, z, b);
        }
        if (r.nextBoolean()) branch(c, r, x, y + h - 1, z, "basalt", 2 + r.nextInt(2), false);
        if (r.nextDouble() < 0.6) c.set(x, y + h, z, pick(r, "polished_blackstone_wall", "blackstone_slab"));
        for (int i = 0; i < 4; i++) {
            int dx = r.nextInt(5) - 2, dz = r.nextInt(5) - 2;
            int t = c.top(x + dx, z + dz);
            if (t != Integer.MIN_VALUE && c.empty(x + dx, t + 1, z + dz)) c.set(x + dx, t, z + dz, pick(r, "coal_block", "blackstone", "gravel", "coarse_dirt"));
        }
    }

    /** Gran roble oscuro de tronco 2x2 con copa rala, musgo colgante y raíces. */
    static void bigDarkTree(Canvas c, Random r, int x, int y, int z, boolean pale) {
        String log = pale ? "pale_oak_log" : "dark_oak_log";
        String leaves = pale ? "pale_oak_leaves[persistent=true]" : "dark_oak_leaves[persistent=true]";
        int h = 11 + r.nextInt(8);
        for (int i = 0; i < h; i++)
            for (int dx = 0; dx < 2; dx++)
                for (int dz = 0; dz < 2; dz++) c.set(x + dx, y + i, z + dz, log + "[axis=y]");
        int arms = 3 + r.nextInt(3);
        for (int a = 0; a < arms; a++) {
            int ay = y + h / 2 + r.nextInt(h / 2);
            double ang = r.nextDouble() * Math.PI * 2;
            int len = 3 + r.nextInt(4);
            int ex = x, ez = z, ey = ay;
            for (int s = 1; s <= len; s++) {
                ex = x + (int) Math.round(Math.cos(ang) * s);
                ez = z + (int) Math.round(Math.sin(ang) * s);
                if (s % 2 == 0) ey++;
                String axis = Math.abs(Math.cos(ang)) > Math.abs(Math.sin(ang)) ? "x" : "z";
                c.set(ex, ey, ez, log + "[axis=" + axis + "]");
            }
            if (r.nextDouble() < 0.75) blob(c, r, ex, ey + 1, ez, 2 + r.nextInt(2), leaves, 0.55, pale);
        }
        blob(c, r, x, y + h, z, 3 + r.nextInt(2), leaves, 0.5, pale);
        for (int dx = 0; dx < 2; dx++)
            for (int dz = 0; dz < 2; dz++) roots(c, r, x + dx, y, z + dz, log);
        for (int k = 0; k < 6; k++) {
            int dx = r.nextInt(5) - 2, dz = r.nextInt(5) - 2;
            if (dx >= 0 && dx < 2 && dz >= 0 && dz < 2) continue;
            int t = c.top(x + dx, z + dz);
            if (t != Integer.MIN_VALUE) c.set(x + dx, t, z + dz, pick(r, "rooted_dirt", "podzol", "mangrove_roots", "coarse_dirt"));
        }
    }

    /** Conífera seca: tronco alto y fino con muñones de ramas. */
    static void deadSpruce(Canvas c, Random r, int x, int y, int z) {
        int h = 10 + r.nextInt(8);
        for (int i = 0; i < h; i++) {
            c.set(x, y + i, z, "spruce_log[axis=y]");
            if (i > 3 && i % 2 == 0 && r.nextDouble() < 0.7) {
                int d = r.nextInt(4);
                int bx = x + (d == 0 ? 1 : d == 1 ? -1 : 0), bz = z + (d == 2 ? 1 : d == 3 ? -1 : 0);
                c.set(bx, y + i, bz, r.nextDouble() < 0.5 ? "spruce_fence" : "spruce_log[axis=" + (d < 2 ? "x" : "z") + "]");
                if (r.nextDouble() < 0.25) c.set(bx, y + i - 1, bz, "pale_hanging_moss[tip=true]");
            }
        }
        c.set(x, y + h, z, "spruce_fence");
    }

    private static void branch(Canvas c, Random r, int x, int y, int z, String log, int len, boolean up) {
        int dir = r.nextInt(4);
        int dx = dir == 0 ? 1 : dir == 1 ? -1 : 0, dz = dir == 2 ? 1 : dir == 3 ? -1 : 0;
        int bx = x, by = y, bz = z;
        for (int i = 1; i <= len; i++) {
            bx += dx;
            bz += dz;
            if (up && i > 1 && r.nextDouble() < 0.5) by++;
            c.set(bx, by, bz, log + "[axis=" + (dx != 0 ? "x" : "z") + "]");
        }
        if (r.nextDouble() < 0.4) c.soft(bx, by + 1, bz, log.contains("basalt") ? "blackstone_wall" : "dark_oak_fence");
    }

    private static void roots(Canvas c, Random r, int x, int y, int z, String log) {
        for (int i = 0; i < 4; i++) {
            if (r.nextDouble() < 0.45) continue;
            int dx = i == 0 ? 1 : i == 1 ? -1 : 0, dz = i == 2 ? 1 : i == 3 ? -1 : 0;
            String axis = dx != 0 ? "x" : "z";
            if (log.contains("basalt")) continue;
            c.set(x + dx, y, z + dz, log.replace("stripped_", "") + "[axis=" + axis + "]");
            if (r.nextDouble() < 0.5) c.soft(x + dx * 2, y, z + dz * 2, "mangrove_roots");
        }
    }

    private static void blob(Canvas c, Random r, int cx, int cy, int cz, int rad, String leaves, double density, boolean pale) {
        for (int dx = -rad; dx <= rad; dx++)
            for (int dy = -1; dy <= rad - 1; dy++)
                for (int dz = -rad; dz <= rad; dz++) {
                    double d = (dx * dx + dz * dz) / (double) (rad * rad) + (dy * dy) / (double) Math.max(1, (rad - 1) * (rad - 1));
                    if (d > 1.05 || r.nextDouble() > density * (1.2 - d * 0.5)) continue;
                    int x = cx + dx, y = cy + dy, z = cz + dz;
                    if (!c.empty(x, y, z)) continue;
                    c.set(x, y, z, leaves);
                    if (dy == -1 && r.nextDouble() < 0.25) {
                        int len = 1 + r.nextInt(3);
                        for (int k = 1; k <= len && c.empty(x, y - k, z); k++) c.set(x, y - k, z, "pale_hanging_moss[tip=" + (k == len) + "]");
                    }
                }
    }

    // ───────────────────────────── RUINAS ─────────────────────────────

    /** Muro de ladrillo de piedra agrietado y musgoso, con borde dentado, huecos y rejas. */
    static void ruinWall(Canvas c, Random r, Noise n, int x, int y, int z, int rot) {
        Stamp s = new Stamp(c, x, y, z, rot);
        int len = 5 + r.nextInt(8);
        int hmax = 3 + r.nextInt(5);
        for (int i = 0; i < len; i++) {
            int h = (int) Math.round(hmax * (0.35 + 0.65 * n.value(x * 0.7 + i * 0.6, z * 0.3 + rot)));
            if (i == 0 || i == len - 1) h = Math.max(1, h - 1);
            s.footing(i, 0, "cobblestone");
            for (int k = 0; k < h; k++) {
                boolean window = k == 2 && i % 4 == 2 && h > 3;
                if (window) {
                    s.set(i, k, 0, r.nextBoolean() ? "iron_bars[east=true,west=true]" : "air");
                    continue;
                }
                if (k > 0 && r.nextDouble() < 0.07) continue;
                s.set(i, k, 0, bricks(r));
            }
            if (h > 0 && r.nextDouble() < 0.35) s.soft(i, h, 0, r.nextDouble() < 0.5 ? "moss_carpet" : pick(r, "stone_brick_slab[type=bottom]", "mossy_stone_brick_slab[type=bottom]"));
            if (r.nextDouble() < 0.3) s.soft(i, 0, 1, pick(r, "cobblestone", "mossy_cobblestone_slab[type=bottom]", "stone_brick_stairs[facing=south]", "gravel"));
            if (r.nextDouble() < 0.15) s.soft(i, 0, -1, "cobweb");
            if (h > 2 && r.nextDouble() < 0.18) s.soft(i, h - 1, 1, "vine[north=true]");
        }
    }

    /** Pilar caído: un muñón en pie y el fuste tumbado en el suelo. */
    static void fallenPillar(Canvas c, Random r, int x, int y, int z, int rot) {
        Stamp s = new Stamp(c, x, y, z, rot);
        int stump = 2 + r.nextInt(3);
        s.footing(0, 0, "stone_bricks");
        for (int k = 0; k < stump; k++) s.set(0, k, 0, k == 0 ? "chiseled_stone_bricks" : bricks(r));
        s.set(0, stump, 0, pick(r, "stone_brick_slab[type=bottom]", "cracked_stone_bricks", "air"));
        int len = 4 + r.nextInt(4);
        for (int i = 2; i < 2 + len; i++) {
            if (r.nextDouble() < 0.12) continue;
            s.set(i, 0, 0, r.nextDouble() < 0.7 ? "stone_brick_wall" : "polished_andesite");
            if (r.nextDouble() < 0.25) s.soft(i, 0, 1, pick(r, "andesite_slab[type=bottom]", "cobblestone_slab[type=bottom]", "moss_carpet"));
        }
        s.set(2 + len, 0, 0, "chiseled_stone_bricks");
    }

    /** Arco roto: dos pilares, uno cortado, y el dintel medio caído. */
    static void brokenArch(Canvas c, Random r, int x, int y, int z, int rot) {
        Stamp s = new Stamp(c, x, y, z, rot);
        int w = 5 + r.nextInt(3), h = 5 + r.nextInt(3);
        int cut = 2 + r.nextInt(h - 2);
        for (int k = 0; k < h; k++) s.set(0, k, 0, k == 0 ? "chiseled_stone_bricks" : bricks(r));
        for (int k = 0; k < cut; k++) s.set(w, k, 0, bricks(r));
        s.footing(0, 0, "stone_bricks");
        s.footing(w, 0, "stone_bricks");
        s.set(1, h - 1, 0, "stone_brick_stairs[facing=west,half=top]");
        s.set(1, h, 0, bricks(r));
        int span = 1 + r.nextInt(w - 2);
        for (int i = 2; i <= span; i++) s.set(i, h, 0, i == span ? "stone_brick_slab[type=bottom]" : bricks(r));
        for (int i = 0; i < 3; i++) s.soft(w - 1 + r.nextInt(3), 0, r.nextInt(3) - 1, pick(r, "cobblestone", "cracked_stone_bricks", "stone_brick_stairs[facing=north]", "gravel"));
    }

    /** Valla de rejas de hierro doblada, con postes y huecos. */
    static void ironFence(Canvas c, Random r, int x, int y, int z, int rot) {
        Stamp s = new Stamp(c, x, y, z, rot);
        int len = 5 + r.nextInt(6);
        for (int i = 0; i < len; i++) {
            if (i % 4 == 0) {
                s.footing(i, 0, "cobblestone");
                s.set(i, 0, 0, "stone_bricks");
                s.set(i, 1, 0, "cobblestone_wall");
                if (r.nextBoolean()) s.set(i, 2, 0, "cobblestone_wall");
                continue;
            }
            if (r.nextDouble() < 0.2) continue;
            int hh = 1 + r.nextInt(3);
            for (int k = 0; k < hh; k++) s.set(i, k, 0, "iron_bars[east=true,west=true]");
        }
    }

    /** Restos de cobre oxidado: una máquina o depósito vencido de la civilización caída. */
    static void copperRemains(Canvas c, Random r, int x, int y, int z, int rot) {
        Stamp s = new Stamp(c, x, y, z, rot);
        String[] mat = {"oxidized_copper", "weathered_copper", "oxidized_cut_copper", "weathered_cut_copper", "oxidized_copper_grate"};
        int l = 3 + r.nextInt(3), w = 2 + r.nextInt(2), h = 2 + r.nextInt(2);
        for (int i = 0; i < l; i++)
            for (int j = 0; j < w; j++) {
                s.footing(i, j, "oxidized_cut_copper");
                for (int k = 0; k < h; k++) {
                    if (r.nextDouble() < 0.12) continue;
                    s.set(i, k, j, mat[r.nextInt(mat.length)]);
                }
            }
        s.set(l / 2, h, 0, "lightning_rod[facing=up]");
        s.set(0, h, w - 1, "oxidized_cut_copper_stairs[facing=east]");
        s.set(l, 0, 0, "oxidized_cut_copper_slab[type=bottom]");
        if (r.nextBoolean()) s.set(l, 0, w - 1, "oxidized_copper_bars[north=true,south=true]");
        s.soft(-1, 0, 0, "oxidized_cut_copper_stairs[facing=west]");
    }

    /** Montón de escombros bajos. */
    static void rubble(Canvas c, Random r, int x, int y, int z) {
        for (int i = 0; i < 7 + r.nextInt(6); i++) {
            int dx = r.nextInt(5) - 2, dz = r.nextInt(5) - 2;
            int t = c.top(x + dx, z + dz);
            if (t == Integer.MIN_VALUE || !c.empty(x + dx, t + 1, z + dz)) continue;
            c.set(x + dx, t + 1, z + dz, pick(r, "cobblestone", "mossy_cobblestone", "andesite_slab[type=bottom]", "stone_brick_slab[type=bottom]", "gravel", "cracked_stone_bricks", "tuff"));
            if (r.nextDouble() < 0.25 && c.empty(x + dx, t + 2, z + dz)) c.set(x + dx, t + 2, z + dz, pick(r, "cobblestone_slab[type=bottom]", "moss_carpet", "stone_button[face=floor]"));
        }
    }

    // ─────────────────────── DECORADO DEL CARRIL (sin colisión) ───────────────────────

    /** Vagoneta volcada (entidad display, no bloquea a los mobs). */
    static void overturnedCart(Canvas c, Random r, double x, double y, double z) {
        float yaw = (float) (r.nextDouble() * Math.PI * 2);
        c.display(x, y, z, ItemDisplay.class, d -> {
            ((ItemDisplay) d).setItemStack(new ItemStack(Material.MINECART));
            Quaternionf q = new Quaternionf().rotateY(yaw).rotateZ((float) Math.toRadians(100));
            d.setTransformation(new Transformation(new Vector3f(0, 0.45f, 0), q, new Vector3f(1.6f), new Quaternionf()));
        });
    }

    /** Hueso tirado en el suelo. */
    static void bone(Canvas c, Random r, double x, double y, double z) {
        float yaw = (float) (r.nextDouble() * Math.PI * 2);
        float sc = 0.5f + r.nextFloat() * 0.35f;
        c.display(x, y, z, ItemDisplay.class, d -> {
            ((ItemDisplay) d).setItemStack(new ItemStack(r.nextDouble() < 0.8 ? Material.BONE : Material.SKELETON_SKULL));
            Quaternionf q = new Quaternionf().rotateY(yaw).rotateX((float) Math.toRadians(90));
            d.setTransformation(new Transformation(new Vector3f(0, 0.03f, 0), q, new Vector3f(sc), new Quaternionf()));
        });
    }

    /** Tramo de valla rota tumbado. */
    static void fallenFence(Canvas c, Random r, double x, double y, double z) {
        float yaw = (float) (r.nextDouble() * Math.PI * 2);
        String fence = pick(r, "dark_oak_fence[east=true,west=true]", "spruce_fence[east=true,west=true]", "oak_fence[east=true,west=true]");
        int pieces = 2 + r.nextInt(2);
        for (int i = 0; i < pieces; i++) {
            final int k = i;
            c.display(x, y, z, BlockDisplay.class, d -> {
                ((BlockDisplay) d).setBlock(Canvas.data(fence));
                Quaternionf q = new Quaternionf().rotateY(yaw).rotateX((float) Math.toRadians(88 + k * 3));
                Vector3f t = new Vector3f(k * 0.95f, 0.02f, 0).rotate(new Quaternionf().rotateY(yaw));
                d.setTransformation(new Transformation(t.add(-0.5f, 0, 0), q, new Vector3f(1, 1, 1), new Quaternionf()));
            });
        }
    }

}
