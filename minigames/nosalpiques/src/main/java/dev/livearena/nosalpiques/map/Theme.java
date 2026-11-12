package dev.livearena.nosalpiques.map;

import java.util.Locale;
import java.util.Random;
import org.bukkit.Color;
import org.bukkit.Material;

/**
 * Bioma de un nivel de la torre: nombre, paleta de bloques, bioma real de Minecraft (color del cielo, niebla y
 * partículas propias del bioma), hora del día y partícula de ambiente.
 *
 * @param particle nombre de partícula de Bukkit o "dust:#RRGGBB"
 */
public record Theme(String name, String biome, int time, String particle, int rgb, Material[] path, Material slab, Material post,
                    Material[] pillar, Material light, Material[] deco, Material pad) {

    public Color color() {
        return Color.fromRGB(rgb);
    }

    public String hex() {
        return String.format(Locale.ROOT, "%06X", rgb & 0xFFFFFF);
    }

    public Material pathBlock(Random r) {
        return path[r.nextInt(path.length)];
    }

    public Material pillarBlock(Random r) {
        return pillar[r.nextInt(pillar.length)];
    }

    public Material decoBlock(Random r) {
        return deco[r.nextInt(deco.length)];
    }

    static Material m(String name) {
        Material x = Material.matchMaterial(name);
        return x != null && x.isBlock() ? x : Material.STONE;
    }

    static Material[] ms(String... names) {
        Material[] out = new Material[names.length];
        for (int i = 0; i < names.length; i++) out[i] = m(names[i]);
        return out;
    }
}
