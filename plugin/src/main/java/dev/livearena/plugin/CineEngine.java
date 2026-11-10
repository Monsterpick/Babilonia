package dev.livearena.plugin;

import java.io.File;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.sound.Sound;
import net.kyori.adventure.sound.SoundStop;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextColor;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.WeatherType;
import org.bukkit.World;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabExecutor;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Entity;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityCombustEvent;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.entity.EntityExplodeEvent;
import org.bukkit.event.entity.EntityTargetEvent;
import org.bukkit.event.entity.ExplosionPrimeEvent;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.player.PlayerChangedWorldEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.scheduler.BukkitTask;
import org.bukkit.util.Vector;

/**
 * Motor de habilidades cinemáticas de LiveArena.
 * <ul>
 *   <li>El servidor manda en el tiempo: cada habilidad es una línea de tiempo en ticks que avanza aquí.</li>
 *   <li>Lo visual de cliente (cámara, FOV, destellos, cielo, modelos GeckoLib) lo hace el mod «LiveArena Cinemáticas»
 *       si el jugador lo tiene; sin mod se ven igualmente los efectos de servidor (displays y partículas).</li>
 *   <li>Cancelación segura: desconexión, muerte, cambio de mundo, /habilidad detener o apagado → se llama a end()
 *       una sola vez, se devuelve la cámara, se restaura el cielo y se borran los actores.</li>
 *   <li>Un jugador solo está en una cinemática a la vez; las que lleguen mientras tanto esperan en cola.</li>
 * </ul>
 */
final class CineEngine implements Listener, TabExecutor {

    /* ===================================== habilidades ===================================== */

    abstract static class Ability {
        final String id, nombre, colorHex, ayuda;
        final int duracion, duracionCamara;

        Ability(String id, String nombre, String colorHex, int duracion, int duracionCamara, String ayuda) {
            this.id = id;
            this.nombre = nombre;
            this.colorHex = colorHex;
            this.duracion = duracion;
            this.duracionCamara = duracionCamara;
            this.ayuda = ayuda;
        }

        int duracion(Ctx c) {
            return c.cfgI("duracionTicks", duracion);
        }

        abstract void start(Ctx c);

        abstract void tick(Ctx c, int t);

        void end(Ctx c, boolean cancelled) {}
    }

    /** Estado de una ejecución de habilidad. */
    final class Ctx {
        final Ability ab;
        final Player target;
        final Player launcher; // puede ser null
        final String viewer;
        final World w;
        final Location origin;
        final float yaw0;
        final long seed;
        final Random rnd;
        final List<Entity> actors = new ArrayList<>();
        final Map<String, Object> data = new HashMap<>();
        final Set<UUID> skyPlayers = new HashSet<>();
        final Set<Integer> models = new HashSet<>();
        int t;
        boolean cameraOn;
        /** Si la cinemática se llevó al jugador a un sitio despejado, dónde estaba (se le devuelve al acabar). */
        Location returnTo;
        Key voiceKey;
        boolean ended;

        Ctx(Ability ab, Player target, Player launcher, String viewer) {
            this.ab = ab;
            this.target = target;
            this.launcher = launcher;
            this.viewer = viewer == null ? "" : viewer;
            this.w = target.getWorld();
            this.origin = target.getLocation().clone();
            this.yaw0 = origin.getYaw();
            this.seed = System.nanoTime() ^ target.getUniqueId().getMostSignificantBits();
            this.rnd = new Random(seed);
        }

        /* --- config de la habilidad (habilidades.yml) --- */

        double cfg(String key, double def) {
            return cfgFile.getDouble(ab.id + "." + key, def);
        }

        int cfgI(String key, int def) {
            return cfgFile.getInt(ab.id + "." + key, def);
        }

        boolean cfgB(String key, boolean def) {
            return cfgFile.getBoolean(ab.id + "." + key, def);
        }

        String who() {
            return viewer.isBlank() ? "El chat" : viewer;
        }

        /* --- actores y ayudas --- */

        <E extends Entity> E actor(E e) {
            e.addScoreboardTag(CineFx.TAG);
            e.setPersistent(false);
            actors.add(e);
            return e;
        }

        /** Posición alrededor de un punto con ángulo relativo a hacia donde miraba el objetivo al empezar (0 = delante, 180 = detrás). */
        Location around(Location c, double angleDeg, double dist, double height) {
            double a = Math.toRadians(yaw0 + angleDeg);
            return c.clone().add(-Math.sin(a) * dist, height, Math.cos(a) * dist);
        }

        Location eye() {
            return target.getEyeLocation();
        }

        Location feet() {
            return target.getLocation();
        }

        /** Suelo bajo un punto (primer bloque sólido hacia abajo). */
        Location ground(Location l) {
            Location g = l.clone();
            for (int i = 0; i < 40 && g.getBlockY() > w.getMinHeight() && g.getBlock().isPassable(); i++) g.add(0, -1, 0);
            g.setY(g.getBlockY() + 1);
            return g;
        }

        /* --- sonido --- */

        /**
         * Sonido de una pista. Formato: «sonidos del mod|sonidos de Minecraft». Lo de la izquierda (audios propios de
         * LiveArena Cinemáticas) lo oye quien tiene el mod; lo de la derecha, el resto. Sin «|», lo oyen todos.
         * Varias claves separadas por comas suenan juntas (capas).
         */
        void sound(Location at, String cue, float vol, float pitch) {
            String def = DEFAULT_SOUNDS.getOrDefault(cue, "entity.experience_orb.pickup");
            String keys = cfgFile.getString("sonidos." + cue, def);
            // Archivos de versiones anteriores: si el valor es el sonido viejo por defecto, se usa el nuevo.
            if (keys.equals(OLD_SOUNDS.get(cue))) keys = def;
            if (def.contains("|") && !keys.contains("|") && keys.equals(def.substring(def.indexOf('|') + 1))) keys = def;
            String modKeys = keys, plainKeys = keys;
            int bar = keys.indexOf('|');
            if (bar >= 0) {
                modKeys = keys.substring(0, bar);
                plainKeys = keys.substring(bar + 1);
            }
            // Los audios propios están hechos a su tono: solo se varía un poco.
            float modPitch = bar >= 0 ? 1f + (pitch - 1f) * 0.3f : pitch;
            List<Sound> plain = sounds(plainKeys, vol, pitch);
            List<String> modList = new ArrayList<>();
            for (String key : modKeys.split(",")) {
                key = key.trim();
                if (!key.isEmpty()) modList.add(key.contains(":") ? key : "minecraft:" + key);
            }
            float range = 24f * Math.max(1f, vol);
            for (Player p : w.getPlayers()) {
                double d = p.getLocation().distance(at);
                if (CineNet.hasMod(p)) {
                    // Con el mod, el sonido llega directo (sin depender de dónde esté la cámara de cine).
                    double k = p == target ? 1 : Math.max(0, 1 - d / range);
                    if (k < 0.05) continue;
                    float v = (float) (Math.min(1f, vol) * k);
                    for (String key : modList) net.send(p, CineNet.sound(key, v, Math.max(0.5f, Math.min(2f, modPitch))));
                    continue;
                }
                if (d > 160) continue;
                // Volumen > 1 solo amplía el alcance: se oye a cualquier distancia del jugador como si estuviera cerca.
                Location near = d > 12 ? p.getLocation().add(at.toVector().subtract(p.getLocation().toVector()).normalize().multiply(6)) : at;
                for (Sound snd : plain) p.playSound(snd, near.getX(), near.getY(), near.getZ());
            }
        }

        private List<Sound> sounds(String keys, float vol, float pitch) {
            List<Sound> out = new ArrayList<>();
            for (String key : keys.split(",")) {
                key = key.trim();
                if (key.isEmpty()) continue;
                try {
                    Key k = key.contains(":") ? Key.key(key) : Key.key("minecraft", key);
                    out.add(Sound.sound(k, Sound.Source.MASTER, Math.min(1f, vol), Math.max(0.5f, Math.min(2f, pitch))));
                } catch (Exception e) {
                    // clave mal escrita: se ignora
                }
            }
            return out;
        }

        /* --- cámara y efectos de cliente --- */

        CineNet.Shot shot() {
            return new CineNet.Shot();
        }

        void cam(CineNet.Shot s) {
            if (!cameraOn) return;
            net.send(target, s.encode());
        }

        /** Sacudida para el jugador cinemático y, más suave, para los que estén cerca. */
        void shake(double intensity, int ticks, double decay) {
            for (Player p : w.getPlayers()) {
                double d = p.getLocation().distance(origin);
                double k = p == target ? 1 : Math.max(0, 1 - d / 150);
                if (k > 0.05) net.send(p, CineNet.shake(intensity * k, ticks, decay));
            }
        }

        void flash(int rgb, int in, int hold, int out) {
            for (Player p : w.getPlayers())
                if (p == target || p.getLocation().distanceSquared(origin) < 90 * 90) net.send(p, CineNet.screen(CineNet.FLASH, 0xff000000 | rgb, in, hold, out));
        }

        void vignette(int argb, int in, int hold, int out) {
            net.send(target, CineNet.screen(CineNet.VIGNETTE, argb, in, hold, out));
        }

        void tint(int argb, int in, int hold, int out) {
            net.send(target, CineNet.screen(CineNet.TINT, argb, in, hold, out));
        }

        /**
         * Cielo especial para los jugadores cercanos. Con mod: cielo/niebla del mod. Sin mod: tormenta y hora
         * por jugador (se restaura al terminar o cancelar).
         */
        void sky(byte mode, int rgb, int ticks) {
            for (Player p : w.getPlayers()) {
                if (p.getLocation().distanceSquared(origin) > 128 * 128) continue;
                skyPlayers.add(p.getUniqueId());
                net.send(p, CineNet.sky(mode, rgb, ticks));
                if (mode == CineNet.SKY_STORM) {
                    p.setPlayerWeather(WeatherType.DOWNFALL);
                    p.setPlayerTime(16000, false);
                } else if (mode == CineNet.SKY_SPACE || mode == CineNet.SKY_TINT) p.setPlayerTime(18000, false);
                else {
                    p.resetPlayerWeather();
                    p.resetPlayerTime();
                }
            }
        }

        void skyReset() {
            for (UUID id : skyPlayers) {
                Player p = Bukkit.getPlayer(id);
                if (p == null) continue;
                p.resetPlayerWeather();
                p.resetPlayerTime();
                net.send(p, CineNet.sky(CineNet.SKY_NORMAL, 0, 0));
            }
            skyPlayers.clear();
        }

        /** Rótulo inferior cinematográfico (con mod) o título de acción (sin mod). */
        void caption(String title, String sub, int rgb, int ticks) {
            if (CineNet.hasMod(target)) net.send(target, CineNet.caption(title, sub, rgb, ticks));
            else target.sendActionBar(Component.text(title + (sub.isBlank() ? "" : " — " + sub), TextColor.color(rgb)));
        }

        /** Modelo GeckoLib (mod) pegado a un actor; sin mod se ve el ítem/bloque del display. */
        /**
         * Asigna un modelo GeckoLib a un ItemDisplay «soporte». A los jugadores con el mod se les ocultan las piezas
         * de respaldo (bloques/partes hechas con displays) para que no vean las dos cosas a la vez.
         */
        void model(Entity holder, String model, String anim, float scale, Entity... fallback) {
            models.add(holder.getEntityId());
            for (Player p : w.getPlayers()) {
                if (!CineNet.hasMod(p)) continue;
                net.send(p, CineNet.model(holder.getEntityId(), model, anim, scale));
                for (Entity f : fallback) if (f != null) p.hideEntity(plugin, f);
            }
        }

        /** Ancla un modelo al hueso de otro (lo sigue durante sus animaciones); en el servidor no cambia nada. */
        void attach(Entity child, Entity parent, String bone, double ox, double oy, double oz) {
            for (Player p : w.getPlayers())
                if (CineNet.hasMod(p)) net.send(p, CineNet.modelAttach(child.getEntityId(), parent == null ? -1 : parent.getEntityId(), bone, (float) ox, (float) oy, (float) oz));
        }

        /**
         * Frase del personaje: subtítulo grande para quien tiene el mod; en la barra de acción para el resto.
         * Se puede cambiar en habilidades.yml → frases.<clave> (vacío = sin frase).
         */
        void say(String key, String def, int rgb, int ticks) {
            String text = cfgFile.getString("frases." + key, def);
            if (text == null || text.isBlank()) return;
            for (Player p : w.getPlayers()) {
                if (p.getLocation().distanceSquared(origin) > 160 * 160) continue;
                if (CineNet.hasMod(p)) net.send(p, CineNet.subtitle(text, rgb, ticks));
                else p.sendActionBar(Component.text(text, TextColor.color(rgb)));
            }
        }

        /**
         * Voz del personaje: un audio del mod (livearena:voz.<nombre>) que suena «en los auriculares» de cada jugador
         * cercano con el mod. Devuelve true si el objetivo la oye (entonces se omiten los sonidos que duplicaría).
         * habilidades.yml → voces.activadas: false las apaga; voces.<nombre> cambia el sonido.
         */
        boolean voice(String name) {
            if (!cfgFile.getBoolean("voces.activadas", true)) return false;
            String key = cfgFile.getString("voces." + name, "livearena:voz." + name);
            if (key == null || key.isBlank()) return false;
            Key k;
            try {
                k = Key.key(key);
            } catch (Exception e) {
                return false;
            }
            voiceKey = k;
            float vol = (float) cfgFile.getDouble("voces.volumen", 1.0);
            Sound s = Sound.sound(k, Sound.Source.MASTER, vol, 1f);
            for (Player p : w.getPlayers()) {
                if (!CineNet.hasMod(p) || p.getLocation().distanceSquared(origin) > 160 * 160) continue;
                net.send(p, CineNet.sound(key, vol, 1f));
            }
            return CineNet.hasMod(target);
        }

        /** Efecto de pantalla del mod (hiperespacio, mancha, líneas de velocidad, retícula…) para el objetivo y los cercanos. */
        void screenFx(byte kind, int argb, int in, int hold, int out) {
            for (Player p : w.getPlayers())
                if (p == target || p.getLocation().distanceSquared(origin) < 40 * 40) net.send(p, CineNet.screen(kind, argb, in, hold, out));
        }

        /** Tajos que cruzan la pantalla (solo con mod). */
        void screenSlashes(int rgb, int ticks) {
            for (Player p : w.getPlayers())
                if (p == target || p.getLocation().distanceSquared(origin) < 40 * 40) net.send(p, CineNet.screen(CineNet.SLASHES, 0xff000000 | rgb, 0, ticks, 0));
        }

        void anim(Entity holder, String anim) {
            for (Player p : w.getPlayers()) net.send(p, CineNet.modelAnim(holder.getEntityId(), anim));
        }

        /* --- daño y tótems configurables (habilidades.yml → danio.<id>) --- */

        /** Ajuste de daño de esta habilidad (sección «danio»); def si no está. */
        double dmg(String key, double def) {
            return cfgFile.getDouble("danio." + ab.id + "." + key, def);
        }

        int totemsDuringLeft = -1;
        int lastTotemTick = -1000;
        boolean finalDone;

        private int totemsDuring() {
            if (totemsDuringLeft < 0) totemsDuringLeft = Math.max(0, (int) dmg("totemsDurante", 0));
            return totemsDuringLeft;
        }

        /** Quita hasta n tótems apilados con la animación de tótem; devuelve cuántos quitó. */
        int takeTotems(Player p, int n) {
            if (n <= 0 || !p.isOnline()) return 0;
            TotemManager tm = plugin.totems();
            int k = Math.min(n, tm.get(p.getName()));
            if (k <= 0) return 0;
            tm.add(p.getName(), -k);
            popTotems(p, k);
            tm.announceRemoved(p, k, viewer);
            return k;
        }

        /**
         * Daño al objetivo: si quedan tótems apilados, no baja de medio corazón (los tótems que se pierden son
         * exactamente los configurados); sin tótems sí puede matar.
         */
        private void hurtTarget(Player p, double hp) {
            if (hp <= 0 || !p.isOnline() || p.isDead()) return;
            if (plugin.totems().get(p.getName()) > 0) hp = Math.min(hp, Math.max(0, p.getHealth() + p.getAbsorptionAmount() - 1));
            if (world.nonLethal()) hp = Math.min(hp, Math.max(0, p.getHealth() + p.getAbsorptionAmount() - 2));
            if (hp <= 0 || !CineWorld.affectable(p, launcher)) return;
            // Daño exacto en corazones: de tipo mágico, la armadura no lo reduce.
            p.setNoDamageTicks(0);
            p.damage(hp, org.bukkit.damage.DamageSource.builder(org.bukkit.damage.DamageType.MAGIC).build());
            p.setNoDamageTicks(0);
        }

        void damage(LivingEntity e, double amount, boolean fast) {
            if (e == target) {
                // Golpe durante la habilidad: corazones configurados (si los hay) y, a ritmo, los tótems «durante».
                double h = dmg("corazonesGolpe", -1);
                hurtTarget(target, h >= 0 ? h * 2 : amount);
                if (totemsDuring() > 0 && t - lastTotemTick >= 10) {
                    lastTotemTick = t;
                    totemsDuringLeft -= Math.max(1, takeTotems(target, 1));
                }
                return;
            }
            world.damage(e, amount, fast, launcher);
        }

        /** Golpe final: quita los tótems configurados (y los «durante» que falten) y hace el daño final en corazones. */
        void finalHit(Player p, double amount) {
            if (p != target) {
                damage(p, amount, true);
                return;
            }
            if (finalDone) {
                hurtTarget(p, dmg("corazonesFinal", amount / 2) * 2);
                return;
            }
            finalDone = true;
            boolean letal = plugin.getConfig().getBoolean("cinematicas.golpe-letal-final", true);
            int tf = (int) dmg("totemsFinal", letal ? 1 : 0);
            int during = totemsDuring();
            totemsDuringLeft = 0;
            takeTotems(p, Math.max(0, tf) + during);
            hurtTarget(p, dmg("corazonesFinal", amount / 2) * 2);
        }

        /** Al terminar sin golpe final (o si faltan tótems «durante» por quitar). */
        void settleTotems() {
            if (!target.isOnline()) return;
            if (!finalDone) {
                boolean letal = plugin.getConfig().getBoolean("cinematicas.golpe-letal-final", true);
                // Solo las habilidades de ataque (las que tienen sección de daño) quitan tótems al final por su cuenta.
                if (cfgFile.isConfigurationSection("danio." + ab.id)) takeTotems(target, Math.max(0, (int) dmg("totemsFinal", letal ? 1 : 0)) + totemsDuring());
                finalDone = true;
            } else if (totemsDuring() > 0) takeTotems(target, totemsDuring());
            totemsDuringLeft = 0;
        }
    }

    static final Map<String, String> DEFAULT_SOUNDS = new LinkedHashMap<>();
    /** Sonidos por defecto de versiones anteriores (se sustituyen solos por los nuevos). */
    static final Map<String, String> OLD_SOUNDS = Map.ofEntries(
            Map.entry("personaje.desvanecer", "livearena:sfx.desvanecer|block.amethyst_block.resonate,entity.illusioner.mirror_move"),
            Map.entry("juicio.carga", "block.beacon.power_select"), Map.entry("juicio.final", "entity.wither.spawn"),
            Map.entry("esfera.carga", "block.beacon.ambient"), Map.entry("esfera.lanzar", "entity.wither.shoot"), Map.entry("esfera.detonar", "entity.generic.explode"),
            Map.entry("cortes.final", "entity.wither.break_block"),
            Map.entry("rayo.trueno_lejano", "entity.lightning_bolt.thunder"), Map.entry("rayo.impacto", "entity.lightning_bolt.impact"),
            Map.entry("trueno.menor", "entity.lightning_bolt.impact"), Map.entry("trueno.mayor", "entity.lightning_bolt.thunder"),
            Map.entry("trueno.explosion_grande", "entity.generic.explode"),
            Map.entry("corona.aparecer", "item.trident.return"), Map.entry("corona.disparo", "item.trident.throw"), Map.entry("corona.impacto", "item.trident.hit"),
            Map.entry("ojo.abrir", "entity.elder_guardian.curse"), Map.entry("juicio.rayo", "entity.lightning_bolt.impact"));

    static {
        String[][] s = {
            {"escudo.activar", "block.beacon.activate"}, {"escudo.impacto", "block.amethyst_block.hit"}, {"escudo.romper", "block.glass.break"},
            {"onda.carga", "block.beacon.power_select"}, {"onda.liberar", "entity.warden.sonic_boom"},
            {"corona.aparecer", "item.trident.return,block.amethyst_block.chime"}, {"corona.disparo", "item.trident.throw,entity.arrow.shoot"},
            {"corona.impacto", "item.trident.hit,block.anvil.land"}, {"corona.apuntar", "block.respawn_anchor.set_spawn,item.crossbow.loading_end"},
            {"rayo.trueno_lejano", "item.trident.thunder"}, {"rayo.carga", "block.respawn_anchor.charge,entity.creeper.primed"},
            {"rayo.impacto", "entity.lightning_bolt.impact,entity.lightning_bolt.thunder,entity.generic.explode"},
            {"trueno.menor", "entity.lightning_bolt.impact,item.trident.thunder"}, {"trueno.mayor", "entity.lightning_bolt.thunder,entity.lightning_bolt.impact,item.trident.thunder"},
            {"trueno.explosion_grande", "entity.generic.explode,entity.dragon_fireball.explode,entity.lightning_bolt.thunder"},
            {"carrusel.musica", "block.note_block.bell"}, {"carrusel.siseo", "entity.creeper.primed"}, {"carrusel.explosion", "entity.generic.explode"},
            {"ojo.abrir", "entity.elder_guardian.curse,entity.warden.emerge"}, {"ojo.susurro", "ambient.cave,entity.warden.ambient,entity.allay.death"},
            {"ojo.grito", "entity.warden.roar,entity.elder_guardian.curse,entity.ghast.scream"}, {"ojo.latido", "entity.warden.heartbeat"}, {"ojo.zumbido", "block.beacon.ambient"},
            {"agujero.formacion", "block.portal.trigger"}, {"agujero.zumbido", "block.beacon.ambient"}, {"agujero.colapso", "entity.warden.sonic_boom"},
            {"juicio.final_carga", "block.beacon.activate,block.end_portal.spawn,block.respawn_anchor.charge"},
            {"juicio.inicio", "block.end_portal.spawn,block.enchantment_table.use"}, {"juicio.carga", "block.beacon.power_select,block.respawn_anchor.charge"},
            {"juicio.rayo", "entity.lightning_bolt.impact,block.amethyst_block.break,entity.generic.explode"}, {"juicio.final", "entity.lightning_bolt.thunder,entity.generic.explode,block.beacon.deactivate"},
            {"esfera.inicio", "block.conduit.activate,block.beacon.activate"}, {"esfera.carga", "block.respawn_anchor.charge,block.conduit.ambient.short"},
            {"esfera.lanzar", "entity.warden.sonic_boom,entity.ender_dragon.shoot"}, {"esfera.detonar", "entity.generic.explode,entity.lightning_bolt.thunder,item.totem.use"},
            {"meteorito.entrada", "item.firecharge.use"}, {"meteorito.estampido", "entity.lightning_bolt.thunder"}, {"meteorito.impacto", "entity.generic.explode"},
            {"cortes.tajo", "livearena:sfx.tajo|entity.player.attack.sweep"}, {"cortes.final", "livearena:sfx.tajo,livearena:sfx.onda_choque,livearena:sfx.golpe_impacto|entity.wither.break_block,entity.generic.explode"},
            {"cortes.dominio", "entity.warden.emerge,block.end_portal.spawn"},
            {"genkidama.aparicion", "livearena:sfx.whoosh,livearena:sfx.aura|entity.breeze.land,block.beacon.activate"}, {"genkidama.carga", "livearena:sfx.energia_carga|block.respawn_anchor.charge,block.conduit.ambient.short"},
            {"genkidama.viento", "livearena:sfx.viento_energia|item.elytra.flying"}, {"genkidama.viaje", "livearena:sfx.rugido_esfera|block.beacon.ambient"},
            {"genkidama.lanzar", "livearena:sfx.genkidama_lanzar,livearena:sfx.onda_choque|entity.warden.sonic_boom,entity.ender_dragon.shoot"}, {"genkidama.detonar", "livearena:sfx.explosion_grave,livearena:sfx.onda_choque|entity.generic.explode,entity.lightning_bolt.thunder,item.totem.use"},
            {"sukuna.dominio", "block.bell.resonate,entity.warden.emerge,block.end_portal.spawn"},
            {"gojo.aparicion", "entity.illusioner.mirror_move,block.amethyst_block.resonate"}, {"gojo.carga", "block.beacon.power_select,block.respawn_anchor.charge"},
            {"gojo.disparo", "entity.warden.sonic_boom,entity.wither.shoot"}, {"gojo.detonacion", "livearena:sfx.explosion_grave,livearena:sfx.onda_choque|entity.generic.explode,entity.lightning_bolt.thunder,block.beacon.deactivate"},
            {"akaza.aparicion", "entity.breeze.land,entity.player.attack.strong"}, {"akaza.despliegue", "block.amethyst_block.resonate,block.beacon.activate"},
            {"aura.vibrar", "livearena:sfx.aura|block.beacon.ambient"}, {"personaje.desvanecer", "livearena:sfx.desvanecer|block.respawn_anchor.deplete,entity.warden.sonic_boom"},
            {"choso.aparicion", "block.bubble_column.whirlpool_inside,entity.warden.emerge"}, {"choso.carga", "livearena:sfx.sangre_burbujas,livearena:sfx.aura|block.bubble_column.whirlpool_inside,block.beacon.ambient"},
            {"choso.destello", "livearena:sfx.destello|block.amethyst_block.chime,item.trident.return"}, {"orbital.rayo", "livearena:sfx.rayo_espacio,livearena:sfx.laser_disparo|entity.warden.sonic_boom,block.beacon.deactivate"},
            {"choso.compresion", "livearena:sfx.sangre_burbujas|block.respawn_anchor.charge,block.honey_block.break"}, {"choso.disparo", "livearena:sfx.silbido_perforante,livearena:sfx.onda_choque|entity.warden.sonic_boom,item.trident.riptide_3,entity.arrow.shoot"},
            {"choso.impacto", "livearena:sfx.golpe_impacto,livearena:sfx.onda_choque|entity.player.attack.crit,entity.generic.explode,block.slime_block.break"},
            {"orbital.fijado", "livearena:sfx.objetivo_fijado|block.beacon.power_select,block.note_block.bit"}, {"orbital.alarma", "livearena:sfx.pitido|block.note_block.pling"},
            {"orbital.subida", "livearena:sfx.whoosh|entity.firework_rocket.launch,item.elytra.flying"}, {"orbital.activar", "block.beacon.activate,block.conduit.activate,block.respawn_anchor.charge"},
            {"orbital.carga", "livearena:sfx.carga_canon|block.respawn_anchor.set_spawn,block.beacon.ambient"}, {"orbital.disparo", "livearena:sfx.laser_disparo,livearena:sfx.onda_choque|entity.warden.sonic_boom,entity.lightning_bolt.thunder,block.beacon.deactivate"},
            {"orbital.impacto", "livearena:sfx.explosion_grave,livearena:sfx.onda_choque|entity.generic.explode,entity.lightning_bolt.thunder,entity.dragon_fireball.explode,entity.warden.sonic_boom"},
            {"akaza.punetazo", "entity.player.attack.crit,entity.player.attack.knockback"}, {"akaza.rafaga", "entity.breeze.shoot,entity.player.attack.sweep"},
            {"akaza.golpe", "livearena:sfx.golpe_impacto,livearena:sfx.onda_choque|entity.generic.explode,entity.warden.attack_impact,entity.lightning_bolt.thunder"}, {"cortes.ambiente", "ambient.crimson_forest.mood,entity.warden.heartbeat"},
        };
        for (String[] e : s) DEFAULT_SOUNDS.put(e[0], e[1]);
    }

    /* ======================================= motor ======================================= */

    final LiveArenaPlugin plugin;
    final CineNet net;
    final CineFx fx = new CineFx();
    final CineWorld world;
    private final Map<String, Ability> abilities = new LinkedHashMap<>();
    private final Map<UUID, Ctx> running = new LinkedHashMap<>();
    private final Map<UUID, Deque<Runnable>> queue = new HashMap<>();
    /** Habilidades que siguen activas tras su fase cinemática (p. ej. el escudo). */
    final Map<UUID, Ctx> persistent = new HashMap<>();
    private YamlConfiguration cfgFile = new YamlConfiguration();
    private BukkitTask task;
    private long tick;

    CineEngine(LiveArenaPlugin plugin) {
        this.plugin = plugin;
        this.net = new CineNet(plugin);
        this.world = new CineWorld(plugin, fx);
    }

    void enable() {
        net.register();
        reloadConfig();
        // Limpia restos de una ejecución anterior (p. ej. si el servidor se cerró a mitad de una habilidad).
        for (World w : Bukkit.getWorlds()) for (Entity e : w.getEntities()) if (e.getScoreboardTags().contains(CineFx.TAG)) e.remove();
        task = Bukkit.getScheduler().runTaskTimer(plugin, this::tickAll, 1L, 1L);
        plugin.getServer().getPluginManager().registerEvents(this, plugin);
    }

    void disable() {
        for (Ctx c : new ArrayList<>(running.values())) finish(c, true);
        for (Ctx c : new ArrayList<>(persistent.values())) finish(c, true);
        if (task != null) task.cancel();
        fx.clearAll();
        world.clearFlying();
        world.restoreAllNow();
    }

    void reloadConfig() {
        File f = new File(plugin.getDataFolder(), "habilidades.yml");
        if (!f.exists()) plugin.saveResource("habilidades.yml", false);
        cfgFile = YamlConfiguration.loadConfiguration(f);
        world.budgetPerTick = Math.max(20, cfgFile.getInt("general.bloquesPorTick", 400));
        world.maxFlying = Math.max(0, cfgFile.getInt("general.maxBloquesVoladores", 200));
        world.restore = cfgFile.getBoolean("general.restaurarBloques", true);
        world.restoreSeconds = Math.max(1, cfgFile.getInt("general.segundosRestauracion", 60));
        world.breakBlocks = cfgFile.getBoolean("general.romperBloques", true);
        for (String m : cfgFile.getStringList("general.bloquesProtegidos")) {
            Material mat = Material.matchMaterial(m);
            if (mat != null) world.protectedBlocks.add(mat);
        }
    }

    void register(Ability a) {
        abilities.put(a.id, a);
    }

    Map<String, Ability> all() {
        return abilities;
    }

    boolean cameraEnabled() {
        return cfgFile.getBoolean("general.camaraCinematica", true);
    }

    /** Pide una habilidad. Si el objetivo ya está en una cinemática, espera en cola. Devuelve false si no existe. */
    boolean request(String id, Player target, Player launcher, String viewer) {
        return request(id, target, launcher, viewer, true);
    }

    /** Ids antiguos → id actual (las reglas y comandos viejos siguen funcionando). */
    static final Map<String, String> ALIASES = Map.of("esfera_energia", "genkidama", "gojo", "vacio_purpura", "gojo_purpura", "vacio_purpura",
            "choso", "sangre_perforante", "orbital", "ataque_orbital", "laser_orbital", "ataque_orbital");

    boolean request(String id, Player target, Player launcher, String viewer, boolean announce) {
        String key = id.toLowerCase(Locale.ROOT);
        Ability a = abilities.get(ALIASES.getOrDefault(key, key));
        if (a == null || target == null) return false;
        // En el minijuego Base Defense no hay cinemáticas (modos separados).
        if (Minijuego.en(target)) return false;
        if (running.containsKey(target.getUniqueId())) {
            Deque<Runnable> q = queue.computeIfAbsent(target.getUniqueId(), k -> new ArrayDeque<>());
            if (q.size() < Math.max(0, cfgFile.getInt("general.colaMax", 10))) q.add(() -> start(a, target, launcher, viewer, announce));
            return true;
        }
        start(a, target, launcher, viewer, announce);
        return true;
    }

    private void start(Ability a, Player target, Player launcher, String viewer, boolean announce) {
        if (!target.isOnline() || target.isDead()) return;
        if (launcher != null && (!launcher.isOnline() || launcher.getWorld() != target.getWorld())) launcher = null;
        Location back = null;
        if (cfgFile.getBoolean("general.escenarioDespejado", true)) {
            Location stage = stage(target);
            if (stage != null) {
                back = target.getLocation().clone();
                if (CineNet.hasMod(target)) net.send(target, CineNet.screen(CineNet.FLASH, 0xff000000, 0, 3, 10));
                target.setFallDistance(0);
                target.teleport(stage);
            }
        }
        Ctx c = new Ctx(a, target, launcher, viewer);
        c.returnTo = back;
        c.cameraOn = cameraEnabled() && CineNet.hasMod(target);
        running.put(target.getUniqueId(), c);
        if (c.cameraOn) net.send(target, CineNet.screen(CineNet.LETTERBOX, 0xff000000, 8, Math.max(1, a.duracionCamara - 16), 8));
        if (announce && plugin.getConfig().getBoolean("efectos.anunciar-en-chat", true))
            Bukkit.broadcast(Component.text("✦ ", TextColor.fromHexString(a.colorHex)).append(Component.text(c.who(), NamedTextColor.YELLOW))
                    .append(Component.text(" lanzó ", NamedTextColor.GRAY)).append(Component.text(a.nombre, TextColor.fromHexString(a.colorHex)))
                    .append(Component.text(" sobre " + target.getName(), NamedTextColor.GRAY)));
        c.caption(a.nombre, c.who() + " → " + target.getName(), TextColor.fromHexString(a.colorHex).value(), 70);
        try {
            a.start(c);
        } catch (RuntimeException ex) {
            plugin.getLogger().warning("Habilidad " + a.id + " falló al empezar: " + ex);
            finish(c, true);
        }
    }

    private void tickAll() {
        tick++;
        fx.tick(tick);
        world.tick(tick);
        for (Ctx c : new ArrayList<>(running.values())) step(c);
        for (Ctx c : new ArrayList<>(persistent.values())) step(c);
        if (!running.isEmpty() || !persistent.isEmpty() || world.busy()) lastActiveTick = tick;
    }

    /** Último tick con alguna habilidad (o bloques voladores) en marcha. */
    private long lastActiveTick = -100000;

    /**
     * Las habilidades levantan y sostienen a los jugadores en el aire (ojo del vacío, agujero negro…). Con
     * allow-flight=false, Paper los expulsaría por «volar»: durante una habilidad y 20 s después se ignora.
     */
    @EventHandler(ignoreCancelled = true)
    public void onFlyKick(org.bukkit.event.player.PlayerKickEvent e) {
        if (e.getCause() == org.bukkit.event.player.PlayerKickEvent.Cause.FLYING_PLAYER && tick - lastActiveTick < 400) e.setCancelled(true);
    }

    private void step(Ctx c) {
        if (c.ended) return;
        if (!c.target.isOnline()) {
            finish(c, true);
            return;
        }
        try {
            c.ab.tick(c, c.t);
        } catch (RuntimeException ex) {
            plugin.getLogger().warning("Habilidad " + c.ab.id + " falló en el tick " + c.t + ": " + ex);
            finish(c, true);
            return;
        }
        c.t++;
        if (c.cameraOn && c.t % 40 == 0) net.send(c.target, CineNet.keepAlive());
        // Fin de la fase cinemática: se devuelve la cámara y la habilidad puede seguir (efecto persistente).
        if (c.t == c.ab.duracionCamara && running.get(c.target.getUniqueId()) == c) {
            endCamera(c);
            if (c.ab.duracion(c) > c.ab.duracionCamara) {
                running.remove(c.target.getUniqueId());
                persistent.put(c.target.getUniqueId(), c);
                next(c.target.getUniqueId());
            }
        }
        if (c.t >= c.ab.duracion(c)) finish(c, false);
    }

    private void endCamera(Ctx c) {
        if (c.cameraOn) net.send(c.target, CineNet.end());
        c.cameraOn = false;
        // de vuelta al sitio donde estaba antes del escenario despejado
        if (c.returnTo != null) {
            Location back = c.returnTo;
            c.returnTo = null;
            Player p = c.target;
            if (p.isOnline() && !p.isDead() && p.getWorld() == back.getWorld()) {
                if (CineNet.hasMod(p)) net.send(p, CineNet.screen(CineNet.FLASH, 0xff000000, 0, 2, 10));
                back.setYaw(p.getLocation().getYaw());
                back.setPitch(p.getLocation().getPitch());
                p.setVelocity(new Vector());
                p.setFallDistance(0);
                p.teleport(back);
            }
        }
    }

    /* ---------------------------- tótems: explosión escalonada ---------------------------- */

    /**
     * Animación de n tótems gastados, repartida en el tiempo (una ráfaga fluida en vez de un único golpe): uno cada
     * pocos ticks, con el sonido variando de tono y un estallido de partículas alrededor del jugador. Con muchos, la
     * ráfaga se acelera (y se agrupan) para no durar más de ~2,5 s.
     */
    void popTotems(Player p, int n) {
        if (n <= 0) return;
        int maxTicks = 50;
        int gap = Math.max(1, Math.min(5, maxTicks / Math.max(1, n)));
        int perPop = (int) Math.ceil(n / (double) Math.max(1, maxTicks / gap));
        int pops = (int) Math.ceil(n / (double) perPop);
        for (int i = 0; i < pops; i++) {
            final int idx = i;
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                if (!p.isOnline()) return;
                p.playEffect(org.bukkit.EntityEffect.PROTECTED_FROM_DEATH);
                // el cliente ya suena el tótem con cada animación; aquí solo un «tic» ascendente que da ritmo a la ráfaga
                float pitch = 0.9f + 0.9f * idx / Math.max(1, pops - 1);
                if (idx > 0) p.playSound(Sound.sound(Key.key("minecraft", "block.amethyst_block.chime"), Sound.Source.MASTER, 0.9f, pitch), Sound.Emitter.self());
            }, (long) i * gap);
        }
    }

    /* ---------------------------- escenario despejado ---------------------------- */

    /**
     * Las cinemáticas se pensaron en terreno abierto. Si el jugador está en un hueco, una cueva o pegado a paredes,
     * se busca cerca un sitio abierto y plano (en la superficie) donde hacerla; null si ya está bien o no hay sitio.
     */
    Location stage(Player p) {
        Location here = p.getLocation();
        if (enclosure(here) < 0.14) return null;
        World w = here.getWorld();
        Location best = null;
        double bestScore = Double.MAX_VALUE;
        int[] radii = {0, 4, 8, 12, 16, 22, 28, 34};
        for (int r : radii) {
            int dirs = r == 0 ? 1 : 12;
            for (int i = 0; i < dirs; i++) {
                double ang = i * Math.PI * 2 / dirs;
                int x = here.getBlockX() + (int) Math.round(Math.cos(ang) * r), z = here.getBlockZ() + (int) Math.round(Math.sin(ang) * r);
                if (!w.isChunkLoaded(x >> 4, z >> 4)) continue;
                int y = w.getHighestBlockYAt(x, z);
                org.bukkit.block.Block ground = w.getBlockAt(x, y, z);
                Material gm = ground.getType();
                if (ground.isLiquid() || gm == Material.LAVA || org.bukkit.Tag.LEAVES.isTagged(gm) || !gm.isSolid()) continue;
                Location cand = new Location(w, x + 0.5, y + 1, z + 0.5, here.getYaw(), here.getPitch());
                double sc = enclosure(cand) + r * 0.002;
                if (sc < bestScore) {
                    bestScore = sc;
                    best = cand;
                }
            }
            if (best != null && bestScore < 0.05) break;
        }
        return best != null && bestScore < 0.12 ? best : null;
    }

    /** 0 = campo abierto; cuanto más alto, más encerrado (bloques alrededor a la altura del cuerpo y techo encima). */
    static double enclosure(Location feet) {
        World w = feet.getWorld();
        int fx = feet.getBlockX(), fy = feet.getBlockY(), fz = feet.getBlockZ();
        int solid = 0, total = 0;
        for (int dx = -6; dx <= 6; dx += 2)
            for (int dz = -6; dz <= 6; dz += 2)
                for (int dy = 0; dy <= 6; dy++) {
                    total++;
                    if (w.getBlockAt(fx + dx, fy + dy, fz + dz).getType().isOccluding()) solid++;
                }
        double f = solid / (double) total;
        for (int dy = 2; dy <= 24; dy++)
            if (w.getBlockAt(fx, fy + dy, fz).getType().isOccluding()) {
                f += 0.5; // techo encima (cueva, interior)
                break;
            }
        return f;
    }

    /** Termina una habilidad (una sola vez) y limpia todo. */
    void finish(Ctx c, boolean cancelled) {
        if (c.ended) return;
        c.ended = true;
        if (!cancelled) {
            try {
                c.settleTotems();
            } catch (RuntimeException ex) {
                plugin.getLogger().warning("Tótems de " + c.ab.id + ": " + ex);
            }
        }
        try {
            c.ab.end(c, cancelled);
        } catch (RuntimeException ex) {
            plugin.getLogger().warning("Habilidad " + c.ab.id + " falló al terminar: " + ex);
        }
        endCamera(c);
        if (cancelled && c.voiceKey != null) for (Player p : c.w.getPlayers()) p.stopSound(SoundStop.named(c.voiceKey));
        c.skyReset();
        for (Integer id : c.models) for (Player p : c.w.getPlayers()) net.send(p, CineNet.modelRemove(id));
        for (Entity e : c.actors) if (e.isValid()) e.remove();
        c.actors.clear();
        UUID id = c.target.getUniqueId();
        boolean wasRunning = running.get(id) == c;
        if (wasRunning) running.remove(id);
        if (persistent.get(id) == c) persistent.remove(id);
        if (wasRunning) next(id);
    }

    private void next(UUID id) {
        Deque<Runnable> q = queue.get(id);
        if (q == null || q.isEmpty()) return;
        Runnable r = q.poll();
        Bukkit.getScheduler().runTaskLater(plugin, r, 10L);
    }

    int stop(Player p) {
        int n = 0;
        Deque<Runnable> q = queue.remove(p.getUniqueId());
        if (q != null) n += q.size();
        for (Ctx c : new ArrayList<>(running.values())) if (c.target == p || c.launcher == p) {
            finish(c, true);
            n++;
        }
        for (Ctx c : new ArrayList<>(persistent.values())) if (c.target == p || c.launcher == p) {
            finish(c, true);
            n++;
        }
        return n;
    }

    Ctx persistentFor(Player p, String abilityId) {
        Ctx c = persistent.get(p.getUniqueId());
        if (c != null && c.ab.id.equals(abilityId)) return c;
        c = running.get(p.getUniqueId());
        if (c != null && c.ab.id.equals(abilityId)) return c;
        return null;
    }

    /* ===================================== seguridad ===================================== */

    @EventHandler
    public void onQuit(PlayerQuitEvent e) {
        stop(e.getPlayer());
    }

    @EventHandler
    public void onDeath(PlayerDeathEvent e) {
        stop(e.getEntity());
    }

    @EventHandler
    public void onWorld(PlayerChangedWorldEvent e) {
        stop(e.getPlayer());
    }

    /** Los actores de cinemática no reciben daño, no arden y no explotan por su cuenta. */
    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onActorDamage(EntityDamageEvent e) {
        if (e.getEntity().getScoreboardTags().contains(CineFx.TAG)) e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void onActorBurn(EntityCombustEvent e) {
        if (e.getEntity().getScoreboardTags().contains(CineFx.TAG)) e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void onActorPrime(ExplosionPrimeEvent e) {
        if (e.getEntity().getScoreboardTags().contains(CineFx.TAG)) e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void onActorExplode(EntityExplodeEvent e) {
        if (e.getEntity().getScoreboardTags().contains(CineFx.TAG)) e.setCancelled(true);
    }

    @EventHandler(ignoreCancelled = true)
    public void onActorTarget(EntityTargetEvent e) {
        if (e.getEntity().getScoreboardTags().contains(CineFx.TAG)) e.setCancelled(true);
    }

    /* ====================================== comando ====================================== */

    private static void reply(CommandSender s, String text, NamedTextColor color) {
        s.sendMessage(Component.text(text, color));
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) {
            reply(sender, "Uso: /habilidad <id> <objetivo> [lanzador|-] [espectador] · /habilidad lista · /habilidad detener <jugador> · /habilidad debug <primitiva>", NamedTextColor.YELLOW);
            return true;
        }
        String sub = args[0].toLowerCase(Locale.ROOT);
        switch (sub) {
            case "lista", "list" -> {
                for (Ability a : abilities.values())
                    sender.sendMessage(Component.text(a.id, TextColor.fromHexString(a.colorHex)).append(Component.text(" — " + a.nombre + ": " + a.ayuda, NamedTextColor.GRAY)));
                return true;
            }
            case "detener", "stop" -> {
                Player p = args.length >= 2 ? Bukkit.getPlayerExact(args[1]) : sender instanceof Player sp ? sp : null;
                if (p == null) {
                    reply(sender, "Uso: /habilidad detener <jugador>", NamedTextColor.RED);
                    return true;
                }
                reply(sender, "HABILIDAD detenidas " + stop(p), NamedTextColor.GREEN);
                return true;
            }
            case "recargar", "reload" -> {
                reloadConfig();
                reply(sender, "habilidades.yml recargado.", NamedTextColor.GREEN);
                return true;
            }
            case "debug" -> {
                // /habilidad debug <primitiva> [jugador] (desde la consola o RCON hace falta el jugador)
                Player p = args.length >= 3 ? Bukkit.getPlayerExact(args[2])
                        : sender instanceof Player sp ? sp
                        : sender instanceof org.bukkit.command.ProxiedCommandSender pc && pc.getCallee() instanceof Player cp ? cp : null;
                if (p == null) {
                    reply(sender, "Uso: /habilidad debug <primitiva> [jugador]", NamedTextColor.RED);
                    return true;
                }
                debug(p, args.length >= 2 ? args[1].toLowerCase(Locale.ROOT) : "");
                return true;
            }
            case "modelo" -> {
                // /habilidad modelo <jugador> <modelo> [animación] [escala]: muestra un modelo 15 s delante del jugador.
                Player p = args.length >= 2 ? Bukkit.getPlayerExact(args[1]) : null;
                if (p == null || args.length < 3) {
                    reply(sender, "Uso: /habilidad modelo <jugador> <modelo> [animación] [escala]", NamedTextColor.RED);
                    return true;
                }
                String anim = args.length >= 4 ? args[3] : "idle";
                float scale = args.length >= 5 ? Float.parseFloat(args[4]) : 1f;
                Location at = p.getLocation().add(p.getLocation().getDirection().setY(0).normalize().multiply(6));
                at.setY(p.getLocation().getY());
                org.bukkit.entity.ItemDisplay d = fx.itemDisplay(at, new org.bukkit.inventory.ItemStack(Material.AIR), 1f, 300);
                d.setRotation(p.getLocation().getYaw() + 180, 0);
                for (Player v : p.getWorld().getPlayers()) if (CineNet.hasMod(v)) net.send(v, CineNet.model(d.getEntityId(), args[2], anim, scale));
                reply(sender, "MODELO " + args[2] + " " + anim, NamedTextColor.GREEN);
                return true;
            }
            case "mod" -> {
                Player p = args.length >= 2 ? Bukkit.getPlayerExact(args[1]) : sender instanceof Player sp ? sp : null;
                reply(sender, p == null ? "Jugador no conectado" : "MOD " + p.getName() + " " + (CineNet.hasMod(p) ? "si" : "no"), NamedTextColor.GOLD);
                return true;
            }
            default -> {}
        }
        if (args.length < 2) {
            reply(sender, "Uso: /habilidad <id> <objetivo> [lanzador|-] [espectador]", NamedTextColor.YELLOW);
            return true;
        }
        Player target = Bukkit.getPlayerExact(args[1]);
        if (target == null) {
            reply(sender, "HABILIDAD " + sub + " jugador " + args[1] + " no está conectado", NamedTextColor.RED);
            return true;
        }
        Player launcher = args.length >= 3 && !args[2].equals("-") ? Bukkit.getPlayerExact(args[2]) : null;
        String viewer = args.length >= 4 ? String.join(" ", Arrays.copyOfRange(args, 3, args.length)).replace('_', ' ') : "";
        if (!request(sub, target, launcher, viewer)) {
            reply(sender, "Habilidad desconocida: " + sub + " (mira /habilidad lista)", NamedTextColor.RED);
            return true;
        }
        reply(sender, "HABILIDAD " + sub + " OK", NamedTextColor.GREEN);
        return true;
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        List<String> out = new ArrayList<>();
        if (args.length == 1) {
            out.addAll(abilities.keySet());
            out.addAll(List.of("lista", "detener", "debug", "recargar", "mod", "modelo"));
        } else if (args.length == 2 && args[0].equalsIgnoreCase("debug"))
            out.addAll(List.of("beam", "sphere", "ring", "lightning", "slash", "marker", "glyph", "disk", "dome", "stream", "crater", "flying", "camara", "flash", "sky"));
        else if (args.length == 2 || args.length == 3) {
            if (args.length == 3) out.add("-");
            for (Player p : Bukkit.getOnlinePlayers()) out.add(p.getName());
        }
        String last = args[args.length - 1].toLowerCase(Locale.ROOT);
        out.removeIf(s -> !s.toLowerCase(Locale.ROOT).startsWith(last));
        return out;
    }

    /* ==================================== depuración ==================================== */

    /** /habilidad debug <primitiva>: muestra cada pieza del motor delante del jugador. */
    private void debug(Player p, String what) {
        World w = p.getWorld();
        Location front = p.getLocation().add(p.getLocation().getDirection().setY(0).normalize().multiply(8));
        front.setY(p.getLocation().getY());
        Location up = front.clone().add(0, 3, 0);
        switch (what) {
            case "beam" -> fx.beam(front, front.clone().add(0, 25, 0), 0.6f, Material.LIGHT_BLUE_CONCRETE, 0x7ad7ff, 60);
            case "sphere" -> {
                CineFx.Orb o = fx.orb(up, 1, Material.LIGHT_BLUE_CONCRETE, Material.LIGHT_BLUE_STAINED_GLASS, 0x5ce1ff, 80);
                o.radius(3, 1.5f, 40);
            }
            case "ring" -> repeat(30, t -> CineFx.wave(w, front, 1 + t * 0.6, 0x5ce1ff));
            case "lightning" -> fx.lightning(w, front.clone().add(0, 40, 0), front, 0.35f, 5, System.nanoTime(), 0x9fdcff, 20);
            case "slash" -> {
                for (int i = 0; i < 6; i++) {
                    double a = i * Math.PI / 6;
                    fx.slash(up, new Vector(Math.cos(a), Math.sin(a) * 0.5, Math.sin(a)), new Vector(-Math.sin(a), 0.3, Math.cos(a)), 8, 0.12f, Material.WHITE_CONCRETE, 0xffffff, 10 + i * 2);
                }
            }
            case "marker" -> repeat(40, t -> CineFx.marker(w, front, 4, 0x3aa0ff, t / 40.0));
            case "glyph" -> repeat(80, t -> CineFx.glyph(w, up.clone().add(0, 3, 0), 6, 3, 42, t / 50.0, t * 0.05, 0xffd34d, 0xb15cff));
            case "disk" -> repeat(80, t -> CineFx.disk(w, up, 2.5, 6, t * 0.15, 0xffffff, 0xff8a1a));
            case "dome" -> repeat(80, t -> CineFx.domeHex(w, front, 4, Math.min(1, t / 40.0), 0x5ce1ff, 0xffffff, t));
            case "stream" -> repeat(60, t -> CineFx.stream(w, p.getLocation().add(0, 1, 0), up, org.bukkit.Particle.END_ROD, 3));
            case "crater" -> world.bowlCrater(front.clone().add(0, -1, 0), 6, 4, true, 0.2, 0.1, 0.05, new Random());
            case "flying" -> {
                for (int i = 0; i < 30; i++)
                    world.flyVisual(front.clone().add(Math.random() * 6 - 3, 0, Math.random() * 6 - 3), Material.DIRT.createBlockData(), CineWorld.Path.SPIRAL_IN, up, null, 100, 0.08);
            }
            case "camara" -> request("test", p, null, "debug");
            case "flash" -> net.send(p, CineNet.screen(CineNet.FLASH, 0xffffffff, 2, 4, 20));
            case "sky" -> {
                net.send(p, CineNet.sky(CineNet.SKY_TINT, 0x4b1f6f, 100));
                Bukkit.getScheduler().runTaskLater(plugin, () -> net.send(p, CineNet.sky(CineNet.SKY_NORMAL, 0, 0)), 100L);
            }
            default -> {
                reply(p, "Primitivas: beam, sphere, ring, lightning, slash, marker, glyph, disk, dome, stream, crater, flying, camara, flash, sky", NamedTextColor.YELLOW);
                return;
            }
        }
        reply(p, "DEBUG " + what + (CineNet.hasMod(p) ? " (con mod)" : " (sin mod)"), NamedTextColor.GREEN);
    }

    void repeat(int ticks, java.util.function.IntConsumer f) {
        final int[] t = {0};
        final BukkitTask[] h = new BukkitTask[1];
        h[0] = Bukkit.getScheduler().runTaskTimer(plugin, () -> {
            if (t[0] > ticks) {
                h[0].cancel();
                return;
            }
            f.accept(t[0]++);
        }, 0L, 1L);
    }
}
