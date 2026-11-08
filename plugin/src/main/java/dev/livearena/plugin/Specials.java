package dev.livearena.plugin;

import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextColor;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.Particle;
import org.bukkit.World;
import org.bukkit.entity.BlockDisplay;
import org.bukkit.entity.Creeper;
import org.bukkit.entity.Entity;
import org.bukkit.entity.EntityType;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Mob;
import org.bukkit.entity.Player;
import org.bukkit.inventory.EntityEquipment;
import org.bukkit.inventory.ItemStack;
import org.bukkit.util.Vector;

/**
 * Efectos espectaculares de LiveArena, hechos solo con partículas y «display entities» (sin resource packs).
 * Los ataques dan un golpe letal configurable que consume un tótem si tienes; cada efecto muestra su propio título.
 */
final class Specials {
    private final LiveArenaPlugin plugin;
    private final Effects fx;
    private final Vfx v;

    Specials(LiveArenaPlugin plugin, Effects fx, Vfx v) {
        this.plugin = plugin;
        this.fx = fx;
        this.v = v;
    }

    private static final TextColor RED = TextColor.color(0xff3b3b);
    private static final TextColor GOLD = TextColor.color(0xffcc33);
    private static final TextColor PURPLE = TextColor.color(0xb15cff);
    private static final TextColor CYAN = TextColor.color(0x5ef2ff);
    private static final TextColor WHITE = NamedTextColor.WHITE;

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
        /* ------------------------------ grandes ------------------------------ */

        fx.addSpecial("meteorito_gigante", "METEORITO", "#ff6a1a", false, "Un meteorito cae del cielo y revienta el suelo [golpes]", (p, viewer, a) -> {
            int hits = Effects.arg(a, 0, 6, 0, 60);
            World w = p.getWorld();
            Location t = ground(p.getLocation());
            Vfx.bigTitle(p, "☄ METEORITO", RED, who(viewer) + " abrió el cielo", TextColor.color(0xffb080), 2200);
            Vfx.soundAt(t, "entity.ender_dragon.growl", 1f, 0.6f);
            Location start = t.clone().add(10, 60, 10);
            BlockDisplay rock = v.block(start, Material.MAGMA_BLOCK, 3.5f, 3.5f, 3.5f);
            v.repeat(0, 1, 50, tick -> {
                double f = tick / 50.0;
                Location c = start.clone().add(t.clone().subtract(start).toVector().multiply(f));
                rock.teleport(c);
                Vfx.p(w, Particle.FLAME, c, 14, 1.2, 0.02);
                Vfx.p(w, Particle.LARGE_SMOKE, c, 6, 1.0, 0.01);
            });
            v.later(52, () -> {
                v.remove(rock);
                w.strikeLightningEffect(t);
                Vfx.p(w, Particle.EXPLOSION_EMITTER, t, 4, 2, 0);
                Vfx.soundAt(t, "entity.generic.explode", 1f, 0.6f);
                v.crater(t, 5, true);
                v.flingBlocks(t, 7, 50, 1.4);
                Vfx.push(t, 10, 1.4, 0.7, null);
                v.hits(p, hits, 6, "GOLPES");
            });
        });

        fx.addSpecial("agujero_negro", "AGUJERO NEGRO", "#9b59ff", false, "Una singularidad te atrae y te tritura [golpes]", (p, viewer, a) -> {
            int hits = Effects.arg(a, 0, 8, 0, 60);
            World w = p.getWorld();
            Location c = p.getLocation().add(0, 2.2, 0);
            Vfx.bigTitle(p, "⊛ AGUJERO NEGRO", PURPLE, who(viewer), WHITE, 2200);
            BlockDisplay core = v.block(c, Material.BLACK_CONCRETE, 1.4f, 1.4f, 1.4f);
            Vfx.soundAt(c, "block.beacon.deactivate", 1f, 0.4f);
            v.repeat(0, 1, 90, tick -> {
                double ph = tick * 0.4;
                for (int arm = 0; arm < 3; arm++)
                    for (double r = 0.6; r < 4; r += 0.35) {
                        double ang = ph + r * 1.6 + arm * Math.PI * 2 / 3;
                        Vfx.dot(w, c.clone().add(Math.cos(ang) * r, Math.sin(r + ph) * 0.3, Math.sin(ang) * r), Vfx.dust(0xb15cff, 1.3f));
                    }
                Vfx.sphereParticle(w, c, 0.7, 20, Particle.PORTAL);
                Vfx.push(c, 6, -0.8, 0.1, null);
                Vfx.rotate(core, tick * 0.5f, 0, 1, 0, 1.4f);
            });
            v.later(92, () -> {
                v.remove(core);
                Vfx.p(w, Particle.EXPLOSION_EMITTER, c, 2, 0.5, 0);
                Vfx.soundAt(c, "entity.generic.explode", 1f, 0.8f);
                v.hits(p, hits, 5, "GOLPES");
            });
        });

        fx.addSpecial("super_rayo", "SÚPER RAYO", "#5ef2ff", false, "Un haz de energía cae sobre ti [golpes]", (p, viewer, a) -> {
            int hits = Effects.arg(a, 0, 5, 0, 60);
            World w = p.getWorld();
            Location t = p.getLocation();
            Vfx.bigTitle(p, "⚡ SÚPER RAYO", CYAN, who(viewer), WHITE, 1800);
            Location top = t.clone().add(0, 40, 0);
            v.repeat(0, 2, 30, tick -> {
                Vfx.beam(w, top, t.clone().add(0, 1, 0), 0.5 + Math.sin(tick) * 0.2, Vfx.dust(0x5ef2ff, 2.2f));
                Vfx.ringParticle(w, t.clone().add(0, 0.2, 0), 2 + tick * 0.1, 30, Particle.ELECTRIC_SPARK, tick * 0.3);
                Vfx.soundAt(t, "entity.lightning_bolt.thunder", 0.5f, 1.6f);
            });
            v.later(14, () -> w.strikeLightningEffect(t));
            v.later(32, () -> {
                Vfx.p(w, Particle.FLASH, t, 2, 0, 0);
                v.hits(p, hits, 5, "GOLPES");
            });
        });

        fx.addSpecial("trueno_explosion", "TRUENO + EXPLOSIÓN", "#ffe066", false, "Varios rayos y una onda explosiva [golpes]", (p, viewer, a) -> {
            int hits = Effects.arg(a, 0, 4, 0, 60);
            World w = p.getWorld();
            Location t = ground(p.getLocation());
            Vfx.bigTitle(p, "⚡ TORMENTA", GOLD, who(viewer), WHITE, 1800);
            for (int i = 0; i < 6; i++) {
                final int k = i;
                v.later(i * 5L, () -> {
                    double a2 = Effects.rndAngle();
                    Location l = t.clone().add(Math.cos(a2) * (1 + k), 0, Math.sin(a2) * (1 + k));
                    w.strikeLightningEffect(l);
                    Vfx.p(w, Particle.ELECTRIC_SPARK, l.add(0, 1, 0), 30, 1, 0.1);
                });
            }
            v.later(34, () -> {
                Vfx.p(w, Particle.EXPLOSION_EMITTER, t, 3, 1.5, 0);
                Vfx.soundAt(t, "entity.generic.explode", 1f, 0.9f);
                v.crater(t, 3, true);
                Vfx.push(t, 7, 1.1, 0.6, null);
                v.hits(p, hits, 5, "GOLPES");
            });
        });

        fx.addSpecial("juicio_arcano", "JUICIO ARCANO", "#ff7b00", false, "Un sello mágico se abre en el cielo y lanza un pilar [golpes]", (p, viewer, a) -> {
            int hits = Effects.arg(a, 0, 6, 0, 60);
            World w = p.getWorld();
            Location t = ground(p.getLocation());
            Location sky = t.clone().add(0, 14, 0);
            Vfx.bigTitle(p, "✦ JUICIO ARCANO ✦", RED, who(viewer) + " abrió el cielo", TextColor.color(0xffcc80), 2400);
            Vfx.soundAt(t, "block.respawn_anchor.charge", 1f, 0.7f);
            v.repeat(0, 2, 70, tick -> {
                double ph = tick * 0.08;
                Vfx.star(w, sky, 4, 5, 2, Vfx.dust(0xff7b00, 1.8f), ph);
                Vfx.ring(w, sky, 4.4, 60, Vfx.dust(0xffd000, 1.4f), -ph);
                Vfx.ring(w, sky, 2.6, 40, Vfx.dust(0xff3b00, 1.4f), ph * 1.5);
            });
            v.later(50, () -> {
                v.repeat(0, 1, 24, tick -> Vfx.beam(w, sky, t, 1.2, Vfx.dust(0xff7b00, 2.6f)));
                Vfx.soundAt(t, "entity.lightning_bolt.thunder", 1f, 0.8f);
            });
            v.later(76, () -> {
                Vfx.p(w, Particle.EXPLOSION_EMITTER, t, 3, 2, 0);
                v.crater(t, 4, true);
                Vfx.push(t, 8, 1.2, 0.6, null);
                v.hits(p, hits, 6, "GOLPES");
            });
        });

        fx.addSpecial("dragones", "DRAGONES ENCADENADOS", "#7c3aed", false, "Dos cabezas de dragón giran encadenadas y embisten [golpes]", (p, viewer, a) -> {
            int hits = Effects.arg(a, 0, 6, 0, 60);
            World w = p.getWorld();
            Location c = p.getLocation().add(0, 1.5, 0);
            Vfx.bigTitle(p, "🐉 DRAGONES ENCADENADOS", PURPLE, who(viewer), WHITE, 2200);
            BlockDisplay d1 = v.block(c, Material.DRAGON_HEAD, 1.6f, 1.6f, 1.6f);
            BlockDisplay d2 = v.block(c, Material.WITHER_SKELETON_SKULL, 1.4f, 1.4f, 1.4f);
            v.repeat(0, 1, 100, tick -> {
                double ph = tick * 0.25;
                Location a1 = c.clone().add(Math.cos(ph) * 3.5, Math.sin(ph * 2) * 1.5, Math.sin(ph) * 3.5);
                Location a2 = c.clone().add(Math.cos(ph + Math.PI) * 3.5, Math.sin(ph * 2 + Math.PI) * 1.5, Math.sin(ph + Math.PI) * 3.5);
                d1.teleport(a1);
                d2.teleport(a2);
                Vfx.line(w, a1, a2, 0.4, Vfx.dust(0x7c3aed, 1.4f));
                Vfx.p(w, Particle.DRAGON_BREATH, a1, 3, 0.2, 0.01);
                Vfx.p(w, Particle.SOUL_FIRE_FLAME, a2, 3, 0.2, 0.01);
            });
            v.later(102, () -> {
                v.remove(d1, d2);
                Vfx.soundAt(c, "entity.ender_dragon.hurt", 1f, 0.8f);
                v.hits(p, hits, 6, "GOLPES");
            });
        });

        /* ------------------------------ poder ------------------------------ */

        fx.addSpecial("onda_repulsion", "ONDA DE REPULSIÓN", "#9be7ff", false, "Un empujón que lanza todo lejos y revienta el suelo", (p, viewer, a) -> {
            World w = p.getWorld();
            Location c = ground(p.getLocation());
            Vfx.bigTitle(p, "✴ ONDA DE REPULSIÓN", CYAN, who(viewer), WHITE, 1600);
            v.repeat(0, 1, 16, tick -> {
                double r = tick * 0.6;
                Vfx.ringParticle(w, c.clone().add(0, 0.3, 0), r, (int) (r * 10) + 6, Particle.SWEEP_ATTACK, 0);
                Vfx.ring(w, c.clone().add(0, 0.3, 0), r, (int) (r * 12) + 6, Vfx.dust(0x9be7ff, 1.6f), 0);
            });
            Vfx.soundAt(c, "entity.generic.explode", 1f, 1.4f);
            Vfx.push(c, 12, 2.2, 0.8, p);
            v.flingBlocks(c, 9, 40, 1.1);
        });

        fx.addSpecial("esfera_destruccion", "ESFERA DE DESTRUCCIÓN", "#ff4d6d", false, "Una esfera de energía crece y estalla [golpes]", (p, viewer, a) -> {
            int hits = Effects.arg(a, 0, 7, 0, 60);
            World w = p.getWorld();
            Location c = p.getLocation().add(0, 1.6, 0);
            Vfx.bigTitle(p, "⚫ ESFERA DE DESTRUCCIÓN", RED, who(viewer), WHITE, 2000);
            BlockDisplay core = v.block(c, Material.RED_CONCRETE, 0.5f, 0.5f, 0.5f);
            v.repeat(0, 1, 60, tick -> {
                float s = 0.5f + tick * 0.08f;
                Vfx.rotate(core, tick * 0.3f, 0.3f, 1, 0, s);
                Vfx.sphere(w, c, s * 0.9, 40, Vfx.dust(0xff4d6d, 1.4f));
                Vfx.p(w, Particle.CRIMSON_SPORE, c, 6, s, 0.02);
            });
            v.later(62, () -> {
                v.remove(core);
                Vfx.p(w, Particle.EXPLOSION_EMITTER, c, 3, 1.5, 0);
                Vfx.soundAt(c, "entity.generic.explode", 1f, 0.7f);
                v.crater(ground(p.getLocation()), 3, false);
                v.hits(p, hits, 5, "GOLPES");
            });
        });

        fx.addSpecial("ojo_vacio", "OJO DEL VACÍO", "#b15cff", false, "Un ojo morado se abre y te absorbe en el vacío [golpes]", (p, viewer, a) -> {
            int hits = Effects.arg(a, 0, 6, 0, 60);
            World w = p.getWorld();
            Location c = p.getLocation().add(0, 2, p.getLocation().getDirection().getZ());
            Vfx.bigTitle(p, "👁 OJO DEL VACÍO", PURPLE, who(viewer), WHITE, 2000);
            v.repeat(0, 1, 70, tick -> {
                double ph = tick * 0.15;
                for (double t2 = -1; t2 <= 1; t2 += 0.1) {
                    double x = t2 * 3;
                    double y = Math.cos(t2 * Math.PI / 2) * 1.6;
                    Vfx.dot(w, c.clone().add(x, y, 0), Vfx.dust(0xb15cff, 1.3f));
                    Vfx.dot(w, c.clone().add(x, -y, 0), Vfx.dust(0xb15cff, 1.3f));
                }
                Vfx.ring(w, c, 0.8, 24, Vfx.dust(0x5a00a0, 1.6f), ph);
                Vfx.p(w, Particle.PORTAL, c, 8, 0.6, 0.3);
            });
            v.later(72, () -> v.hits(p, hits, 6, "GOLPES"));
        });

        fx.addSpecial("corona_espadas", "CORONA DE ESPADAS", "#e5e7eb", false, "Un círculo de espadas te rodea y te atraviesa [golpes]", (p, viewer, a) -> {
            int hits = Effects.arg(a, 0, 8, 0, 60);
            World w = p.getWorld();
            Location c = p.getLocation().add(0, 1, 0);
            Vfx.bigTitle(p, "⚔ CORONA DE ESPADAS", WHITE, who(viewer), WHITE, 1800);
            java.util.List<BlockDisplay> swords = new java.util.ArrayList<>();
            int n = 10;
            for (int i = 0; i < n; i++) {
                double ang = i * Math.PI * 2 / n;
                BlockDisplay s = v.block(c.clone().add(Math.cos(ang) * 3.5, 1.5, Math.sin(ang) * 3.5), Material.NETHERITE_BLOCK, 0.18f, 1.6f, 0.18f);
                swords.add(s);
            }
            v.repeat(0, 1, 40, tick -> {
                double ph = tick * 0.12;
                for (int i = 0; i < n; i++) {
                    double ang = ph + i * Math.PI * 2 / n;
                    double r = 3.5 - tick * 0.06;
                    swords.get(i).teleport(c.clone().add(Math.cos(ang) * r, 1.5 - tick * 0.02, Math.sin(ang) * r));
                }
            });
            v.later(42, () -> {
                swords.forEach(v::remove);
                Vfx.p(w, Particle.SWEEP_ATTACK, c, 8, 1, 0);
                Vfx.soundAt(c, "entity.player.attack.sweep", 1f, 0.8f);
                v.hits(p, hits, 4, "CORTES");
            });
        });

        fx.addSpecial("mil_cortes", "MIL CORTES DIVINOS", "#ff3b3b", false, "Un santuario se abre y lanza una lluvia de cortes [golpes]", (p, viewer, a) -> {
            int hits = Effects.arg(a, 0, 12, 0, 120);
            World w = p.getWorld();
            Location c = p.getLocation().add(0, 3, 0);
            Vfx.bigTitle(p, "⚔ MIL CORTES DIVINOS", RED, who(viewer) + " abrió su santuario", TextColor.color(0xffb0b0), 2400);
            BossBar bar = Vfx.bar(p, "MIL CORTES 0 / " + hits * 80, RED, BossBar.Color.RED);
            Vfx.soundAt(c, "item.trident.throw", 1f, 0.6f);
            v.repeat(0, 1, 70, tick -> {
                double ph = tick * 0.1;
                for (int i = 0; i < 8; i++) {
                    double ang = ph + i * Math.PI / 4;
                    Vfx.line(w, c, c.clone().add(Math.cos(ang) * 4.5, 0, Math.sin(ang) * 4.5), 0.3, Vfx.dust(0xff3b3b, 1.2f));
                }
                Vfx.ring(w, c, 4.6, 70, Vfx.dust(0x7a0000, 1.6f), -ph);
                Vfx.p(w, Particle.SWEEP_ATTACK, p.getLocation().add(Effects.rnd().nextDouble(-2, 2), Effects.rnd().nextDouble(0, 2), Effects.rnd().nextDouble(-2, 2)), 1, 0, 0);
            });
            v.later(72, () -> {
                p.hideBossBar(bar);
                v.hits(p, hits, 2, "CORTES");
            });
        });

        /* ------------------------------ mobs / aliados ------------------------------ */

        fx.addSpecial("parca", "LA PARCA", "#1f2937", false, "Un segador encapuchado aparece y te persigue", (p, viewer, a) -> {
            World w = p.getWorld();
            Location sp = Effects.around(p, 4, 7);
            Vfx.bigTitle(p, "☠ LA PARCA", TextColor.color(0x9ca3af), who(viewer), WHITE, 1800);
            Entity e = fx.mob(p, EntityType.WITHER_SKELETON, viewer, TextColor.color(0x9ca3af), 4, 7);
            if (e instanceof LivingEntity le) {
                le.getEquipment().setHelmet(new ItemStack(Material.SOUL_LANTERN));
                le.getEquipment().setItemInMainHand(new ItemStack(Material.IRON_HOE));
                le.addPotionEffect(new org.bukkit.potion.PotionEffect(org.bukkit.potion.PotionEffectType.SPEED, 99999, 1));
                le.setGlowing(true);
            }
            Vfx.soundAt(sp, "entity.wither.spawn", 0.5f, 0.6f);
            v.repeat(0, 3, 160, tick -> {
                if (e.isValid()) Vfx.p(w, Particle.SOUL, e.getLocation().add(0, 1, 0), 6, 0.3, 0.02);
            });
        });

        fx.addSpecial("mago_aliado", "MAGO ALIADO", "#60a5fa", true, "Un orbe y un aliado mágico que te defienden", (p, viewer, a) -> {
            World w = p.getWorld();
            Entity ally = fx.mob(p, EntityType.SNOW_GOLEM, viewer, TextColor.color(0x60a5fa), 1, 2);
            if (ally instanceof Mob m) m.setTarget(null);
            if (ally instanceof LivingEntity le) le.setGlowing(true);
            Location c = p.getLocation().add(0, 2.4, 0);
            BlockDisplay orb = v.block(c, Material.LIGHT_BLUE_CONCRETE, 0.5f, 0.5f, 0.5f);
            Vfx.bigTitle(p, "🔮 MAGO ALIADO", TextColor.color(0x60a5fa), who(viewer), WHITE, 1600);
            v.repeat(0, 2, 200, tick -> {
                Location o = p.getLocation().add(Math.cos(tick * 0.2) * 1.5, 2.2, Math.sin(tick * 0.2) * 1.5);
                orb.teleport(o);
                Vfx.p(w, Particle.END_ROD, o, 2, 0.1, 0.01);
                if (tick % 20 == 0) {
                    for (Entity en : w.getNearbyEntities(p.getLocation(), 8, 4, 8))
                        if (en instanceof org.bukkit.entity.Monster mo) {
                            Vfx.lineParticle(w, o, mo.getLocation().add(0, 1, 0), 0.3, Particle.ELECTRIC_SPARK);
                            mo.damage(4);
                        }
                }
            });
            v.later(200, () -> v.remove(orb));
        });

        fx.addSpecial("carrusel_creepers", "CARRUSEL DE CREEPERS", "#22c55e", false, "Un anillo de creepers gira y cierra sobre ti", (p, viewer, a) -> {
            World w = p.getWorld();
            java.util.List<Entity> cps = new java.util.ArrayList<>();
            Vfx.bigTitle(p, "💥 CARRUSEL DE CREEPERS", TextColor.color(0x22c55e), who(viewer), WHITE, 1800);
            for (int i = 0; i < 8; i++) {
                double ang = i * Math.PI / 4;
                Entity e = fx.mob(p, EntityType.CREEPER, viewer, TextColor.color(0x22c55e), 5, 6);
                if (e != null) {
                    e.teleport(p.getLocation().add(Math.cos(ang) * 5, 0, Math.sin(ang) * 5));
                    cps.add(e);
                }
            }
            v.repeat(0, 2, 100, tick -> {
                double ph = tick * 0.1;
                double r = 5 - tick * 0.04;
                for (int i = 0; i < cps.size(); i++) {
                    Entity e = cps.get(i);
                    if (!e.isValid()) continue;
                    double ang = ph + i * Math.PI * 2 / cps.size();
                    Location to = p.getLocation().add(Math.cos(ang) * r, 0, Math.sin(ang) * r);
                    e.teleport(to);
                    if (e instanceof Mob m) m.setTarget(p);
                }
            });
        });

        /* ------------------------------ ayudas ------------------------------ */

        fx.addSpecial("escudo_energia", "ESCUDO DE ENERGÍA", "#34e0a1", true, "Una cúpula que te da resistencia [segundos]", (p, viewer, a) -> {
            int secs = Effects.arg(a, 0, 15, 3, 120);
            World w = p.getWorld();
            Vfx.bigTitle(p, "🛡 ESCUDO DE ENERGÍA", TextColor.color(0x34e0a1), who(viewer), WHITE, 1600);
            p.addPotionEffect(new org.bukkit.potion.PotionEffect(org.bukkit.potion.PotionEffectType.RESISTANCE, secs * 20, 3));
            p.addPotionEffect(new org.bukkit.potion.PotionEffect(org.bukkit.potion.PotionEffectType.ABSORPTION, secs * 20, 2));
            BossBar bar = Vfx.bar(p, "ESCUDO", TextColor.color(0x34e0a1), BossBar.Color.GREEN);
            v.repeat(0, 2, secs * 20, tick -> {
                bar.progress(Math.max(0f, 1f - tick / (float) (secs * 20)));
                Vfx.sphere(w, p.getLocation().add(0, 1, 0), 1.6, 36, Vfx.dust(0x34e0a1, 1.2f));
            });
            v.later(secs * 20L, () -> p.hideBossBar(bar));
        });

        fx.addSpecial("genkidama", "ESFERA DE ENERGÍA", "#67e8f9", false, "Una enorme esfera de luz se forma arriba y cae [golpes]", (p, viewer, a) -> {
            int hits = Effects.arg(a, 0, 8, 0, 80);
            World w = p.getWorld();
            Location sky = p.getLocation().add(0, 16, 0);
            Vfx.bigTitle(p, "🔵 ESFERA DE ENERGÍA", CYAN, who(viewer) + " reunió energía", WHITE, 2400);
            BlockDisplay orb = v.block(sky, Material.LIGHT_BLUE_CONCRETE, 1f, 1f, 1f);
            v.repeat(0, 1, 60, tick -> {
                float s = 1f + tick * 0.12f;
                Vfx.rotate(orb, tick * 0.1f, 0, 1, 0, s);
                Vfx.sphere(w, sky, s * 0.9, 50, Vfx.dust(0x9be7ff, 1.6f));
                if (tick % 6 == 0) Vfx.soundAt(sky, "block.beacon.ambient", 0.6f, 1.2f + tick * 0.01f);
            });
            v.later(62, () -> {
                Location t = ground(p.getLocation());
                v.repeat(0, 1, 20, tick -> {
                    double f = tick / 20.0;
                    orb.teleport(sky.clone().add(t.clone().subtract(sky).toVector().multiply(f)));
                });
                v.later(22, () -> {
                    v.remove(orb);
                    Vfx.p(w, Particle.FLASH, t, 3, 0, 0);
                    Vfx.p(w, Particle.EXPLOSION_EMITTER, t, 4, 2, 0);
                    Vfx.soundAt(t, "entity.generic.explode", 1f, 0.5f);
                    v.crater(t, 5, false);
                    Vfx.push(t, 12, 1.8, 0.9, null);
                    v.hits(p, hits, 4, "GOLPES");
                });
            });
        });

        /* ------------------------------ reto ------------------------------ */

        fx.addSpecial("carcel_temporal", "CÁRCEL TEMPORAL", "#9ca3af", false, "Te encierra en una celda que desaparece sola [segundos]", (p, viewer, a) -> {
            int secs = Effects.arg(a, 0, 15, 3, 120);
            // reutiliza la cárcel de Effects pero con aviso propio
            fx.run("carcel", p, viewer, new String[] {String.valueOf(secs)});
        });
    }
}
