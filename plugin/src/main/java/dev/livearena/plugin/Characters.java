package dev.livearena.plugin;

import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.text.format.TextColor;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.World;
import org.bukkit.entity.BlockDisplay;
import org.bukkit.entity.Player;
import org.bukkit.util.Vector;

/**
 * Efectos temáticos de personajes (originales de LiveArena, inspirados en poderes de anime).
 * Akaza: brújula/copo de nieve azul, aura, puño cargado, onda y cráter.
 * Gojo: esfera roja + azul que forman la morada, y el dominio del vacío.
 */
final class Characters {
    private final LiveArenaPlugin plugin;
    private final Effects fx;
    private final Vfx v;

    Characters(LiveArenaPlugin plugin, Effects fx, Vfx v) {
        this.plugin = plugin;
        this.fx = fx;
        this.v = v;
    }

    private static final TextColor AZUL = TextColor.color(0x3fa9ff);
    private static final TextColor ROJO = TextColor.color(0xff3b5c);
    private static final TextColor MORADO = TextColor.color(0xb15cff);
    private static final TextColor BLANCO = TextColor.color(0xffffff);

    private static Location ground(Location l) {
        Location g = l.clone();
        int y = l.getWorld().getHighestBlockYAt(l.getBlockX(), l.getBlockZ());
        if (y < l.getBlockY() + 2) g.setY(y + 1);
        return g;
    }

    private static String who(String viewer) {
        return viewer == null || viewer.isBlank() ? "El chat" : viewer;
    }

    void register() {
        /* ================================= AKAZA ================================= */

        fx.addSpecial("akaza", "AKAZA · DESARROLLO DESTRUCTIVO", "#3fa9ff", false, "Brújula de combate azul, aura, y onda de choque con cráter [golpes]", (p, viewer, a) -> {
            int hits = Effects.arg(a, 0, 8, 0, 80);
            World w = p.getWorld();
            Location c = ground(p.getLocation());
            Vfx.bigTitle(p, "❄ DESARROLLO DESTRUCTIVO", AZUL, who(viewer), BLANCO, 2200);
            Vfx.soundAt(c, "block.conduit.activate", 1f, 0.8f);
            // Fase 1: brújula/copo de nieve girando en el suelo + aura azul en el objetivo
            v.repeat(0, 2, 60, tick -> {
                double ph = tick * 0.05;
                Vfx.snowflake(w, c.clone().add(0, 0.15, 0), 4.5, Vfx.dust(0x3fa9ff, 1.5f), ph);
                for (double y = 0; y < 2.2; y += 0.3) Vfx.ring(w, p.getLocation().add(0, y, 0), 0.7, 10, Vfx.dust(0x9be7ff, 1.1f), ph * 3 + y);
                Vfx.p(w, Particle.SNOWFLAKE, p.getLocation().add(0, 1, 0), 3, 0.4, 0.02);
            });
            // Fase 2: puño cargado (esfera azul en la mano)
            v.later(62, () -> {
                Location fist = p.getLocation().add(p.getLocation().getDirection().multiply(1.2)).add(0, 1.2, 0);
                BlockDisplay orb = v.block(fist, Material.LIGHT_BLUE_CONCRETE, 0.5f, 0.5f, 0.5f);
                v.repeat(0, 1, 24, tick -> Vfx.sphere(w, fist, 0.6, 24, Vfx.dust(0x3fa9ff, 1.3f)));
                Vfx.soundAt(fist, "item.trident.riptide_3", 1f, 1.2f);
                v.later(26, () -> v.remove(orb));
            });
            // Fase 3: impacto — onda de choque concéntrica + cráter + golpes
            v.later(92, () -> {
                v.repeat(0, 1, 18, tick -> {
                    double r = tick * 0.7;
                    Vfx.ringParticle(w, c.clone().add(0, 0.3, 0), r, (int) (r * 10) + 6, Particle.SONIC_BOOM, 0);
                    Vfx.ring(w, c.clone().add(0, 0.3, 0), r, (int) (r * 12) + 8, Vfx.dust(0x3fa9ff, 1.8f), 0);
                });
                Vfx.p(w, Particle.FLASH, c, 2, 0, 0);
                Vfx.soundAt(c, "entity.warden.sonic_boom", 1f, 0.9f);
                v.crater(c, 4, true);
                v.flingBlocks(c, 7, 46, 1.3);
                Vfx.push(c, 11, 1.9, 0.8, null);
                v.hits(p, hits, 5, "GOLPES");
            });
        });

        fx.addSpecial("akaza_rapido", "AKAZA · AGUJA DESTRUCTIVA", "#67e8f9", false, "Ráfaga rápida de golpes de aire comprimido [golpes]", (p, viewer, a) -> {
            int hits = Effects.arg(a, 0, 12, 0, 120);
            World w = p.getWorld();
            Vfx.bigTitle(p, "❄ AGUJA DESTRUCTIVA", AZUL, who(viewer), BLANCO, 1600);
            v.repeat(0, 2, hits * 4, tick -> {
                Location o = p.getLocation().add(Effects.rnd().nextDouble(-2, 2), Effects.rnd().nextDouble(0, 2.2), Effects.rnd().nextDouble(-2, 2));
                Vfx.lineParticle(w, o, p.getLocation().add(0, 1, 0), 0.3, Particle.SWEEP_ATTACK);
                Vfx.p(w, Particle.SNOWFLAKE, o, 2, 0.1, 0.02);
            });
            v.hits(p, hits, 4, "AGUJAS");
        });

        /* ================================= GOJO ================================= */

        fx.addSpecial("gojo_purpura", "GOJO · HUECO MORADO", "#b15cff", false, "Azul y rojo chocan y forman una esfera morada que arrasa [golpes]", (p, viewer, a) -> {
            int hits = Effects.arg(a, 0, 10, 0, 100);
            World w = p.getWorld();
            Location c = p.getLocation().add(p.getLocation().getDirection().multiply(2)).add(0, 1.6, 0);
            Vfx.bigTitle(p, "⟁ HUECO: MORADO", MORADO, who(viewer), BLANCO, 2200);
            // Dos esferas: azul (atrae) y roja (repele) acercándose
            Location left = c.clone().add(-1.3, 0, 0);
            Location right = c.clone().add(1.3, 0, 0);
            BlockDisplay blue = v.block(left, Material.BLUE_CONCRETE, 0.6f, 0.6f, 0.6f);
            BlockDisplay red = v.block(right, Material.RED_CONCRETE, 0.6f, 0.6f, 0.6f);
            Vfx.soundAt(c, "block.beacon.power_select", 1f, 0.8f);
            v.repeat(0, 1, 40, tick -> {
                double f = tick / 40.0;
                Location bl = left.clone().add(new Vector(1.3 * f, 0, 0));
                Location rl = right.clone().add(new Vector(-1.3 * f, 0, 0));
                blue.teleport(bl);
                red.teleport(rl);
                Vfx.sphere(w, bl, 0.5, 18, Vfx.dust(0x2b6bff, 1.2f));
                Vfx.sphere(w, rl, 0.5, 18, Vfx.dust(0xff2b4d, 1.2f));
            });
            // Choque → morado
            v.later(42, () -> {
                v.remove(blue, red);
                BlockDisplay purple = v.block(c, Material.PURPLE_CONCRETE, 0.8f, 0.8f, 0.8f);
                Vfx.p(w, Particle.FLASH, c, 2, 0, 0);
                Vfx.soundAt(c, "entity.warden.sonic_charge", 1f, 0.7f);
                v.repeat(0, 1, 40, tick -> {
                    float s = 0.8f + tick * 0.05f;
                    Vfx.rotate(purple, tick * 0.2f, 0.2f, 1, 0, s);
                    Vfx.sphere(w, c, s * 0.9, 44, Vfx.dust(0xb15cff, 1.6f));
                    Vfx.ring(w, c, s * 1.4, 40, Vfx.dust(0xdca0ff, 1.2f), tick * 0.2);
                });
                // Rayo morado hacia delante que arrasa una franja
                v.later(42, () -> {
                    v.remove(purple);
                    Location from = c.clone();
                    Vector d = p.getLocation().getDirection().setY(0).normalize();
                    for (int i = 1; i <= 20; i++) {
                        final int k = i;
                        v.later(i / 2, () -> {
                            Location hitL = from.clone().add(d.clone().multiply(k * 1.5));
                            Vfx.p(w, Particle.EXPLOSION_EMITTER, ground(hitL), 1, 0.5, 0);
                            Vfx.sphere(w, hitL, 1.2, 20, Vfx.dust(0xb15cff, 1.6f));
                            v.crater(ground(hitL), 2, false);
                            Vfx.soundAt(hitL, "entity.generic.explode", 1f, 0.6f);
                        });
                    }
                    v.hits(p, hits, 4, "GOLPES");
                });
            });
        });

        fx.addSpecial("gojo_dominio", "GOJO · VACÍO INFINITO", "#dca0ff", false, "El dominio del vacío: infinita información que te paraliza [golpes]", (p, viewer, a) -> {
            int hits = Effects.arg(a, 0, 12, 0, 120);
            World w = p.getWorld();
            Location c = ground(p.getLocation());
            Vfx.bigTitle(p, "⟡ EXPANSIÓN DE DOMINIO", MORADO, "Vacío Infinito · " + who(viewer), TextColor.color(0xdca0ff), 2600);
            Vfx.soundAt(c, "block.portal.trigger", 1f, 0.6f);
            // Cúpula de dominio: esfera grande morada + sellos arriba y abajo
            p.addPotionEffect(new org.bukkit.potion.PotionEffect(org.bukkit.potion.PotionEffectType.SLOWNESS, 120, 10, false, false));
            p.addPotionEffect(new org.bukkit.potion.PotionEffect(org.bukkit.potion.PotionEffectType.MINING_FATIGUE, 120, 10, false, false));
            Location center = c.clone().add(0, 4, 0);
            BossBar bar = Vfx.bar(p, "VACÍO INFINITO", MORADO, BossBar.Color.PURPLE);
            v.repeat(0, 1, 120, tick -> {
                double ph = tick * 0.06;
                Vfx.sphere(w, center, 6, 90, Vfx.dust(0xb15cff, 1.4f));
                Vfx.star(w, center.clone().add(0, 5.5, 0), 6, 7, 3, Vfx.dust(0xdca0ff, 1.6f), ph);
                Vfx.star(w, c.clone().add(0, 0.2, 0), 6, 7, 3, Vfx.dust(0xdca0ff, 1.6f), -ph);
                Vfx.p(w, Particle.REVERSE_PORTAL, p.getLocation().add(0, 1, 0), 10, 0.6, 0.4);
                bar.progress(Math.max(0f, 1f - tick / 120f));
            });
            v.later(122, () -> {
                p.hideBossBar(bar);
                Vfx.p(w, Particle.FLASH, p.getLocation(), 2, 0, 0);
                v.hits(p, hits, 2, "GOLPES");
            });
        });
    }
}
