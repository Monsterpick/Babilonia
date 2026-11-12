package dev.livearena.dropper.map;

import java.util.List;
import org.bukkit.block.data.BlockData;

/**
 * Un nivel del dropper: un tubo vertical (interior S×S) con capas de obstáculos y agua al fondo. Coordenadas del
 * mundo: el interior va de (x0, z0) a (x0+S-1, z0+S-1); se empieza en topY y el agua ocupa waterY..waterY+2.
 *
 * @param holes  centro del hueco seguro de cada capa (de arriba abajo), para la guía y el escudo
 * @param layers altura de cada capa de obstáculos (de arriba abajo)
 */
public record Shaft(int level, int x0, int z0, int topY, int waterY, List<Place> places, List<double[]> holes, List<Integer> layers, String pattern) {
    public static final int S = 9;

    public record Place(int x, int y, int z, BlockData data) {}

    public double cx() {
        return x0 + S / 2.0;
    }

    public double cz() {
        return z0 + S / 2.0;
    }

    public boolean inside(double x, double z) {
        return x >= x0 - 1 && x <= x0 + S + 1 && z >= z0 - 1 && z <= z0 + S + 1;
    }

    /** Fracción de la caída hecha (0 arriba, 1 en el agua). */
    public double progress(double y) {
        return Math.max(0, Math.min(1, (topY - y) / (double) Math.max(1, topY - waterY)));
    }
}
