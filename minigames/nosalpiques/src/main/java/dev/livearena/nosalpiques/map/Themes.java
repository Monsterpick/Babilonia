package dev.livearena.nosalpiques.map;

import java.util.List;

/**
 * Las salas de piscinas (estética «poolrooms»: azulejos claros, luz fría de fluorescente, agua turquesa y silencio).
 * Todas inventadas. path = azulejo del suelo y plataformas, pillar = paredes, light = luz del techo, deco = franjas,
 * pad = cubierta de salida/llegada, slab = borde de la piscina.
 */
public final class Themes {
    private Themes() {}

    private static Theme t(String name, int rgb, String path, String slab, String pillar, String light, String deco, String pad) {
        return new Theme(name, "warm_ocean", 6000, "dust:#" + String.format("%06X", rgb), rgb, Theme.ms(path.split(",")), Theme.m(slab), Theme.m("WHITE_STAINED_GLASS_PANE"),
            Theme.ms(pillar.split(",")), Theme.m(light), Theme.ms(deco.split(",")), Theme.m(pad));
    }

    public static final List<Theme> ALL = List.of(
        t("Vestíbulo de Azulejos", 0x9FE8FF, "WHITE_CONCRETE,SMOOTH_QUARTZ", "SMOOTH_QUARTZ_SLAB", "WHITE_CONCRETE,SMOOTH_QUARTZ", "SEA_LANTERN", "LIGHT_BLUE_CONCRETE", "QUARTZ_BRICKS"),
        t("Piscina Infinita", 0x5FD3E6, "WHITE_TERRACOTTA,SMOOTH_QUARTZ", "SMOOTH_QUARTZ_SLAB", "WHITE_CONCRETE,QUARTZ_BRICKS", "SEA_LANTERN", "CYAN_TERRACOTTA", "SMOOTH_QUARTZ"),
        t("Sala de los Ecos", 0x7FB8FF, "SMOOTH_STONE,WHITE_CONCRETE", "SMOOTH_STONE_SLAB", "SMOOTH_STONE,POLISHED_DIORITE", "SEA_LANTERN", "LIGHT_BLUE_TERRACOTTA", "POLISHED_DIORITE"),
        t("Puente de la Memoria", 0xC7A6FF, "WHITE_CONCRETE,PURPUR_BLOCK", "SMOOTH_QUARTZ_SLAB", "WHITE_CONCRETE,CALCITE", "PEARLESCENT_FROGLIGHT", "PURPUR_PILLAR", "CALCITE"),
        t("Corrientes Frías", 0x4FD1C5, "PRISMARINE_BRICKS,WHITE_CONCRETE", "PRISMARINE_BRICK_SLAB", "WHITE_CONCRETE,PRISMARINE_BRICKS", "SEA_LANTERN", "DARK_PRISMARINE", "PRISMARINE_BRICKS"),
        t("Baños Olvidados", 0xE6D9B8, "BIRCH_PLANKS,SMOOTH_SANDSTONE", "SMOOTH_SANDSTONE_SLAB", "SMOOTH_SANDSTONE,CUT_SANDSTONE", "OCHRE_FROGLIGHT", "YELLOW_TERRACOTTA", "CUT_SANDSTONE"),
        t("Galería Sumergida", 0x3E8EDE, "LIGHT_BLUE_CONCRETE,WHITE_CONCRETE", "SMOOTH_QUARTZ_SLAB", "WHITE_CONCRETE,LIGHT_GRAY_CONCRETE", "SEA_LANTERN", "BLUE_CONCRETE", "SMOOTH_QUARTZ"),
        t("La Gran Crecida", 0xFF7B7B, "WHITE_CONCRETE,RED_TERRACOTTA", "SMOOTH_QUARTZ_SLAB", "WHITE_CONCRETE,LIGHT_GRAY_CONCRETE", "SEA_LANTERN", "RED_CONCRETE", "GOLD_BLOCK"));

    /** Tema de la sala (1..n). */
    public static Theme of(int level) {
        return ALL.get(Math.floorMod(level - 1, ALL.size()));
    }
}
