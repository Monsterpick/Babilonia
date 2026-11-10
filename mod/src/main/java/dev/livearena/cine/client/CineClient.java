package dev.livearena.cine.client;

import dev.livearena.cine.LiveArenaMod;
import dev.livearena.cine.mixin.ClientInputAccessor;
import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import net.minecraft.client.DeltaTracker;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.resources.Identifier;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Input;
import net.minecraft.world.phys.Vec2;
import net.minecraft.world.phys.Vec3;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.client.event.ClientPlayerNetworkEvent;
import net.neoforged.neoforge.client.event.ClientTickEvent;
import net.neoforged.neoforge.client.event.InputEvent;
import net.neoforged.neoforge.client.event.MovementInputUpdateEvent;
import net.neoforged.neoforge.client.event.RegisterGuiLayersEvent;
import net.neoforged.neoforge.client.event.RenderGuiLayerEvent;
import net.neoforged.neoforge.client.event.RenderHandEvent;
import net.neoforged.neoforge.client.event.ViewportEvent;
import net.neoforged.neoforge.common.NeoForge;

/**
 * Lado cliente de las cinemáticas: interpreta los mensajes del plugin y hace lo que el servidor no puede:
 * cámara con fotogramas clave (posición, mirada, roll, FOV, curvas y cortes), sacudidas, destellos, viñeta,
 * tinte, franjas de cine, rótulos, cielo especial y bloqueo de controles durante la cinemática.
 * Salvavidas: si deja de llegar el plugin durante 10 s, todo se restaura solo.
 */
public final class CineClient {
    private CineClient() {}

    /* ----------------------------------- estado ----------------------------------- */

    record Key(int tick, Vec3 pos, Vec3 look, float roll, float fov, int curve) {}

    public record Pose(Vec3 pos, float yaw, float pitch, float roll) {}

    private record Fx(int kind, int argb, int in, int hold, int out, long start) {
        int total() {
            return in + hold + out;
        }

        float alpha(float now) {
            float t = now - start;
            if (t < 0 || t > total()) return 0;
            if (t < in) return in == 0 ? 1 : t / in;
            if (t < in + hold) return 1;
            return out == 0 ? 0 : 1 - (t - in - hold) / out;
        }
    }

    private static final List<Key> keys = new ArrayList<>();
    private static int posEntity = -1, lookEntity = -1;
    private static long shotStart;
    private static boolean active;
    private static long lastPacket;
    private static long ticks;
    private static float currentFov = -1;

    private static float shakeIntensity, shakeDecay;
    private static int shakeTicks;
    private static long shakeStart;

    private static final List<Fx> screen = new ArrayList<>();

    private static int skyMode, skyRgb;
    private static long skyUntil;

    private static String capTitle = "", capSub = "";
    private static int capRgb;
    private static long capStart, capUntil;
    /** Subtítulo (frase del personaje): texto, color, inicio y fin. */
    private static String subText = "";
    private static int subRgb;
    private static long subStart, subUntil;

    /* ----------------------------------- registro ----------------------------------- */

    public static void init(IEventBus modBus) {
        modBus.addListener(CineClient::layers);
        NeoForge.EVENT_BUS.addListener(CineClient::tick);
        NeoForge.EVENT_BUS.addListener(CineClient::fov);
        NeoForge.EVENT_BUS.addListener(CineClient::fogColor);
        NeoForge.EVENT_BUS.addListener(CineClient::fog);
        NeoForge.EVENT_BUS.addListener(CineClient::movement);
        NeoForge.EVENT_BUS.addListener(CineClient::interact);
        NeoForge.EVENT_BUS.addListener(CineClient::logout);
        NeoForge.EVENT_BUS.addListener(CineClient::hideHud);
        NeoForge.EVENT_BUS.addListener(CineClient::hideHand);
        CineModels.init(modBus);
    }

    private static void layers(RegisterGuiLayersEvent e) {
        e.registerAboveAll(LAYER, CineClient::drawOverlay);
    }

    /* ------------------------------------ red ------------------------------------ */

    public static void handle(byte[] data) {
        try (DataInputStream in = new DataInputStream(new ByteArrayInputStream(data))) {
            lastPacket = ticks;
            int type = in.readByte();
            switch (type) {
                case 1 -> { // SHOT
                    posEntity = in.readInt();
                    lookEntity = in.readInt();
                    int n = in.readInt();
                    keys.clear();
                    for (int i = 0; i < n; i++) {
                        int tick = in.readInt();
                        Vec3 pos = new Vec3(in.readDouble(), in.readDouble(), in.readDouble());
                        Vec3 look = new Vec3(in.readDouble(), in.readDouble(), in.readDouble());
                        keys.add(new Key(tick, pos, look, in.readFloat(), in.readFloat(), in.readByte()));
                    }
                    keys.sort((a, b) -> Integer.compare(a.tick(), b.tick()));
                    shotStart = ticks;
                    clipDist = -1;
                    if (!keys.isEmpty()) begin();
                }
                case 2 -> end(); // END
                case 3 -> { // SHAKE
                    shakeIntensity = in.readFloat();
                    shakeTicks = in.readInt();
                    shakeDecay = in.readFloat();
                    shakeStart = ticks;
                }
                case 4 -> { // SCREEN
                    int kind = in.readByte();
                    int argb = in.readInt();
                    screen.add(new Fx(kind, argb, in.readInt(), in.readInt(), in.readInt(), ticks));
                }
                case 5 -> { // SKY
                    skyMode = in.readByte();
                    skyRgb = in.readInt();
                    int t = in.readInt();
                    skyUntil = skyMode == 0 ? 0 : ticks + t;
                }
                case 6 -> {} // KEEPALIVE
                case 7 -> { // CAPTION
                    capTitle = in.readUTF();
                    capSub = in.readUTF();
                    capRgb = in.readInt();
                    capStart = ticks;
                    capUntil = ticks + in.readInt();
                }
                case 8 -> CineModels.add(in.readInt(), in.readUTF(), in.readUTF(), in.readFloat());
                case 9 -> CineModels.anim(in.readInt(), in.readUTF());
                case 10 -> CineModels.remove(in.readInt());
                case 11 -> CineModels.attach(in.readInt(), in.readInt(), in.readUTF(), in.readFloat(), in.readFloat(), in.readFloat());
                case 13 -> { // SOUND: sonido de cinemática sin atenuación (se oye aunque la cámara esté lejos)
                    String key = in.readUTF();
                    float vol = in.readFloat(), pitch = in.readFloat();
                    Minecraft mc = Minecraft.getInstance();
                    mc.execute(() -> mc.getSoundManager().play(new net.minecraft.client.resources.sounds.SimpleSoundInstance(Identifier.parse(key),
                            net.minecraft.sounds.SoundSource.MASTER, vol, pitch, net.minecraft.util.RandomSource.create(), false, 0,
                            net.minecraft.client.resources.sounds.SoundInstance.Attenuation.NONE, 0, 0, 0, true)));
                }
                case 12 -> { // SUBTITLE
                    subText = in.readUTF();
                    subRgb = in.readInt();
                    subStart = ticks;
                    subUntil = ticks + in.readInt();
                }
                default -> {}
            }
        } catch (IOException | RuntimeException ex) {
            // Mensaje de una versión distinta del plugin: se ignora.
        }
    }

    private static final Identifier LAYER = Identifier.fromNamespaceAndPath(LiveArenaMod.ID, "cinematica");

    private static void begin() {
        active = true;
    }

    /** Durante la cinemática se ocultan todas las capas del HUD menos la nuestra (franjas, destellos, rótulos). */
    private static void hideHud(RenderGuiLayerEvent.Pre e) {
        if (active && !LAYER.equals(e.getName())) e.setCanceled(true);
    }

    private static void hideHand(RenderHandEvent e) {
        if (active) e.setCanceled(true);
    }

    private static void end() {
        active = false;
        keys.clear();
        currentFov = -1;
        screen.removeIf(f -> f.kind() == 3); // franjas de cine
    }

    private static void resetAll() {
        end();
        screen.clear();
        skyMode = 0;
        skyUntil = 0;
        shakeTicks = 0;
        capUntil = 0;
        subUntil = 0;
        CineModels.clear();
    }

    /* ----------------------------------- eventos ----------------------------------- */

    private static void tick(ClientTickEvent.Post e) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.isPaused()) return;
        ticks++;
        // Salvavidas: sin noticias del servidor en 10 s → se devuelve todo.
        if (active && ticks - lastPacket > 200) end();
        if (skyUntil > 0 && ticks > skyUntil) skyMode = 0;
        for (Iterator<Fx> it = screen.iterator(); it.hasNext(); ) {
            Fx f = it.next();
            if (ticks - f.start() > f.total()) it.remove();
        }
        if (mc.player == null) resetAll();
        if (ticks % 10 == 0) minigamePost(mc);
        CineModels.tick();
    }

    private static void logout(ClientPlayerNetworkEvent.LoggingOut e) {
        resetAll();
    }

    private static void movement(MovementInputUpdateEvent e) {
        if (!active) return;
        e.getInput().keyPresses = Input.EMPTY;
        ((ClientInputAccessor) e.getInput()).livearena$setMoveVector(Vec2.ZERO);
    }

    private static void interact(InputEvent.InteractionKeyMappingTriggered e) {
        if (!active) return;
        e.setSwingHand(false);
        e.setCanceled(true);
    }

    private static void fov(ViewportEvent.ComputeFov e) {
        if (active && currentFov > 0) e.setFOV(currentFov);
    }

    private static float[] skyColor() {
        float r = ((skyRgb >> 16) & 255) / 255f, g = ((skyRgb >> 8) & 255) / 255f, b = (skyRgb & 255) / 255f;
        return switch (skyMode) {
            case 1 -> new float[] {0.01f, 0.01f, 0.03f}; // espacio
            case 2 -> new float[] {0.16f, 0.18f, 0.22f}; // tormenta
            case 3 -> new float[] {r, g, b};
            default -> null;
        };
    }

    private static void fogColor(ViewportEvent.ComputeFogColor e) {
        float[] c = skyColor();
        if (c == null) return;
        float k = skyMode == 3 ? 0.75f : 1f;
        e.setRed(e.getRed() * (1 - k) + c[0] * k);
        e.setGreen(e.getGreen() * (1 - k) + c[1] * k);
        e.setBlue(e.getBlue() * (1 - k) + c[2] * k);
    }

    private static void fog(ViewportEvent.RenderFog e) {
        if (skyMode == 2) e.scaleFarPlaneDistance(0.55f);
        else if (skyMode == 1) {
            // En el espacio no hay niebla: con una distancia de renderizado corta el rayo del satélite (cientos de
            // bloques) se perdía en la niebla negra aunque el satélite y la Tierra sí se veían.
            var fd = e.getFogData();
            fd.environmentalStart = fd.environmentalEnd = 1.0e5f;
            fd.renderDistanceStart = fd.renderDistanceEnd = 1.0e5f;
            fd.skyEnd = 1.0e5f;
            e.setNearPlaneDistance(1.0e5f);
            e.setFarPlaneDistance(1.0e5f);
        }
    }

    /* ------------------------------------ cámara ------------------------------------ */

    private static double ease(int curve, double u) {
        u = Math.max(0, Math.min(1, u));
        return switch (curve) {
            case 1 -> u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; // EASE_IN_OUT
            case 2 -> u == 0 ? 0 : Math.pow(2, 10 * u - 10); // EASE_IN_EXPO
            case 3 -> u == 1 ? 1 : 1 - Math.pow(2, -10 * u); // EASE_OUT_EXPO
            default -> u;
        };
    }

    private static Vec3 catmull(Vec3 p0, Vec3 p1, Vec3 p2, Vec3 p3, double t) {
        double t2 = t * t, t3 = t2 * t;
        return p0.scale(-0.5 * t3 + t2 - 0.5 * t)
                .add(p1.scale(1.5 * t3 - 2.5 * t2 + 1))
                .add(p2.scale(-1.5 * t3 + 2 * t2 + 0.5 * t))
                .add(p3.scale(0.5 * t3 - 0.5 * t2));
    }

    private static float noise(double t, double seed) {
        return (float) (Math.sin(t * 1.7 + seed) * 0.5 + Math.sin(t * 3.1 + seed * 2.3) * 0.3 + Math.sin(t * 7.3 + seed * 0.7) * 0.2);
    }

    /** Pose de la cámara para este fotograma (null = cámara normal). La llama CameraMixin. */
    public static Pose pose(float partial) {
        if (!active || keys.isEmpty()) return null;
        Minecraft mc = Minecraft.getInstance();
        if (mc.level == null) return null;
        double time = (ticks - shotStart) + partial;
        int n = keys.size();
        Key a, b;
        int i = 0;
        while (i < n - 1 && keys.get(i + 1).tick() <= time) i++;
        a = keys.get(i);
        b = i < n - 1 ? keys.get(i + 1) : a;
        Vec3 pos, look;
        float roll, fov;
        if (a == b || b.curve() == 4 || time <= a.tick()) {
            pos = a.pos();
            look = a.look();
            roll = a.roll();
            fov = a.fov();
        } else {
            double u = ease(b.curve(), (time - a.tick()) / Math.max(1e-3, b.tick() - a.tick()));
            if (n > 2 && b.curve() == 0) {
                Key k0 = i > 0 && a.curve() != 4 ? keys.get(i - 1) : a;
                Key k3 = i + 2 < n && keys.get(i + 2).curve() != 4 ? keys.get(i + 2) : b;
                pos = catmull(k0.pos(), a.pos(), b.pos(), k3.pos(), u);
            } else pos = a.pos().lerp(b.pos(), u);
            look = a.look().lerp(b.look(), u);
            roll = (float) (a.roll() + (b.roll() - a.roll()) * u);
            fov = (float) (a.fov() + (b.fov() - a.fov()) * u);
        }
        if (posEntity >= 0) {
            Entity en = mc.level.getEntity(posEntity);
            if (en != null) pos = en.getPosition(partial).add(pos);
        }
        if (lookEntity >= 0) {
            Entity en = mc.level.getEntity(lookEntity);
            if (en != null) look = en.getPosition(partial).add(0, en.getBbHeight() * 0.5, 0);
        }
        pos = avoidTerrain(mc, look, pos);
        float yaw, pitch;
        Vec3 d = look.subtract(pos);
        double hz = Math.sqrt(d.x * d.x + d.z * d.z);
        yaw = (float) Math.toDegrees(Math.atan2(-d.x, d.z));
        pitch = (float) -Math.toDegrees(Math.atan2(d.y, Math.max(1e-6, hz)));
        // Sacudida con ruido suave.
        double st = (ticks - shakeStart) + partial;
        if (shakeTicks > 0 && st < shakeTicks) {
            float amp = (float) (shakeIntensity * Math.pow(Math.max(0.01, shakeDecay), st));
            pos = pos.add(noise(st, 1) * amp * 0.25, noise(st, 7) * amp * 0.25, noise(st, 13) * amp * 0.25);
            yaw += noise(st, 3) * amp * 2.2f;
            pitch += noise(st, 5) * amp * 2.2f;
            roll += noise(st, 9) * amp * 1.2f;
        }
        currentFov = fov;
        return new Pose(pos, yaw, Math.max(-90, Math.min(90, pitch)), roll);
    }

    /* ---------------------- shader de cámara de Base Defense ---------------------- */

    private static final Identifier BD_POST = Identifier.fromNamespaceAndPath("basedefense", "apocalipsis");
    private static final Identifier BD_POST_FILE = Identifier.fromNamespaceAndPath("basedefense", "post_effect/apocalipsis.json");

    /**
     * Mientras el pack de Base Defense está cargado (solo durante la partida) se pone su efecto de pantalla completa
     * (grano, aberración, gradación y viñeta); al quitarse el pack se quita. Si el juego cambia de efecto (p. ej. al
     * mirar como un creeper en espectador) no se pisa.
     */
    private static long packSeenAt = -1;

    private static void minigamePost(Minecraft mc) {
        var gr = mc.gameRenderer;
        Identifier cur = gr.currentPostEffect();
        // durante la recarga de recursos el shader aún no existe: se espera a que termine (y 2 s más)
        boolean reloading = mc.getOverlay() != null;
        boolean packOn = !reloading && mc.player != null && mc.getResourceManager().getResource(BD_POST_FILE).isPresent();
        if (!packOn) packSeenAt = -1;
        else if (packSeenAt < 0) packSeenAt = ticks;
        if (packOn && ticks - packSeenAt >= 40 && cur == null) {
            try {
                ((dev.livearena.cine.mixin.GameRendererInvoker) gr).livearena$setPostEffect(BD_POST);
            } catch (RuntimeException ex) {
                org.slf4j.LoggerFactory.getLogger("livearena").warn("No se pudo poner el shader de Base Defense: {}", ex.toString());
            }
        } else if (!packOn && !reloading && BD_POST.equals(cur)) gr.clearPostEffect();
    }

    /* ---------------------- tótem pequeño (sustituye a la animación gigante) ---------------------- */

    private record Pop(net.minecraft.world.item.ItemStack stack, long start, float dx) {}

    private static final List<Pop> pops = new ArrayList<>();

    public static void totemPop(net.minecraft.world.item.ItemStack stack) {
        if (pops.size() > 12) pops.remove(0);
        pops.add(new Pop(stack, ticks, (float) (Math.random() * 2 - 1)));
    }

    /** Arriba en el centro, bajo la barra de tótems: salta, gira un poco, sube y se encoge hasta desaparecer (16 ticks). */
    private static void drawPops(GuiGraphicsExtractor g, float now, int w) {
        for (Iterator<Pop> it = pops.iterator(); it.hasNext(); ) {
            Pop p = it.next();
            float t = (now - p.start()) / 16f;
            if (t >= 1) {
                it.remove();
                continue;
            }
            if (t < 0) continue;
            float s = t < 0.2f ? 0.6f + t / 0.2f * 0.6f : 1.2f * (1 - (t - 0.2f) / 0.8f);
            if (s <= 0.02f) continue;
            float x = w / 2f + p.dx() * 24 * t + 46, y = 24 - 14 * t;
            var pose = g.pose();
            pose.pushMatrix();
            pose.translate(x, y);
            pose.rotate((float) Math.toRadians(p.dx() * 25 * t));
            pose.scale(s, s);
            g.item(p.stack(), -8, -8);
            pose.popMatrix();
        }
    }

    /** Distancia foco→cámara recortada por el terreno (-1 = sin recorte). */
    private static double clipDist = -1;

    /**
     * La cámara no atraviesa el terreno: si entre el foco y la cámara hay bloques (hueco, cueva, pared), se acerca
     * hasta justo delante del bloque; cuando el paso queda libre vuelve a su sitio poco a poco (sin saltos).
     * En el espacio y en planos muy lejanos (cámaras en el cielo) no se aplica.
     */
    private static Vec3 avoidTerrain(Minecraft mc, Vec3 look, Vec3 pos) {
        if (skyMode == 1 || mc.player == null) return pos;
        Vec3 off = pos.subtract(look);
        double len = off.length();
        if (len < 0.6 || len > 48) {
            clipDist = -1;
            return pos;
        }
        net.minecraft.world.phys.BlockHitResult hit = mc.level.clip(new net.minecraft.world.level.ClipContext(look, pos,
                net.minecraft.world.level.ClipContext.Block.VISUAL, net.minecraft.world.level.ClipContext.Fluid.NONE, mc.player));
        boolean blocked = hit.getType() == net.minecraft.world.phys.HitResult.Type.BLOCK;
        double want = len;
        if (blocked) {
            double h = hit.getLocation().distanceTo(look);
            // el foco está dentro de un bloque: no hay recorte que tenga sentido
            if (h < 0.35) blocked = false;
            else want = Math.max(0.5, h - 0.4);
        }
        if (!blocked) {
            if (clipDist < 0 || clipDist >= len - 1e-3) {
                clipDist = -1;
                return pos;
            }
            clipDist = Math.min(len, clipDist + Math.max(0.04, (len - clipDist) * 0.12));
        } else clipDist = clipDist < 0 ? want : Math.min(want, clipDist + Math.max(0.04, (want - clipDist) * 0.12));
        Vec3 out = look.add(off.scale(clipDist / len));
        // Dentro de hierba alta, flores, hojas o nieve (sin colisión, el rayo no los ve) la pantalla se llena de verde:
        // se acerca la cámara al foco hasta salir del bloque.
        Vec3 dir = off.normalize();
        double d = clipDist;
        for (int i = 0; i < 24 && d > 0.6 && !clearAt(mc, out); i++) {
            d -= 0.2;
            out = look.add(dir.scale(d));
        }
        if (d < clipDist - 1e-3) clipDist = d;
        return out;
    }

    private static boolean clearAt(Minecraft mc, Vec3 p) {
        var pos = net.minecraft.core.BlockPos.containing(p);
        var st = mc.level.getBlockState(pos);
        return st.isAir() || st.getFluidState().isEmpty() && st.getCollisionShape(mc.level, pos).isEmpty() && st.getShape(mc.level, pos).isEmpty();
    }

    /** Sacudida también fuera de la cinemática (para los que miran cerca). */
    public static boolean shaking() {
        return shakeTicks > 0 && ticks - shakeStart < shakeTicks;
    }

    /* ------------------------------------ pantalla ------------------------------------ */

    private static int withAlpha(int argb, float a) {
        int base = (argb >>> 24) & 255;
        int al = Math.max(0, Math.min(255, Math.round(base * a)));
        return (al << 24) | (argb & 0xffffff);
    }

    private static void drawOverlay(GuiGraphicsExtractor g, DeltaTracker dt) {
        Minecraft mc = Minecraft.getInstance();
        float now = ticks + dt.getGameTimeDeltaPartialTick(false);
        int w = g.guiWidth(), h = g.guiHeight();
        if (skyMode == 3) g.fill(0, 0, w, h, withAlpha(0xff000000 | skyRgb, 0.12f));
        for (Fx f : screen) {
            float a = f.alpha(now);
            if (a <= 0) continue;
            switch (f.kind()) {
                case 0, 2 -> g.fill(0, 0, w, h, withAlpha(f.argb(), a));
                case 1 -> { // viñeta: marcos concéntricos cada vez más transparentes
                    int steps = 14;
                    for (int s = 0; s < steps; s++) {
                        float k = (1 - s / (float) steps);
                        int col = withAlpha(f.argb(), a * k * k * 0.55f);
                        int tw = (int) (w * 0.018 * (s + 1)), th = (int) (h * 0.022 * (s + 1));
                        int pw = (int) (w * 0.018 * s), ph = (int) (h * 0.022 * s);
                        g.fill(pw, ph, w - pw, th, col);
                        g.fill(pw, h - th, w - pw, h - ph, col);
                        g.fill(pw, th, tw, h - th, col);
                        g.fill(w - tw, th, w - pw, h - th, col);
                    }
                }
                case 3 -> { // franjas de cine
                    int bar = (int) (h * 0.11f * a);
                    g.fill(0, 0, w, bar, 0xff000000);
                    g.fill(0, h - bar, w, h, 0xff000000);
                }
                case 4 -> { // tajos que cruzan la pantalla: cada uno dura 4 ticks
                    float t = now - f.start();
                    for (int k = 0; k < 3; k++) {
                        int slot = (int) Math.floor((t + k * 1.7f) / 5f);
                        float lt = (t + k * 1.7f) - slot * 5f;
                        if (lt > 4f) continue;
                        java.util.Random r = new java.util.Random(f.start() * 31L + slot * 7919L + k * 104729L);
                        float cx = w * (0.15f + r.nextFloat() * 0.7f), cy = h * (0.15f + r.nextFloat() * 0.7f);
                        float ang = (r.nextFloat() - 0.5f) * 2.6f, len = w * (0.5f + r.nextFloat() * 0.6f);
                        float prog = Math.min(1, lt / 1.2f), fade = lt < 1.2f ? 1 : 1 - (lt - 1.2f) / 2.8f;
                        g.pose().pushMatrix();
                        g.pose().translate(cx, cy);
                        g.pose().rotate(ang);
                        int x0 = (int) (-len / 2), x1 = (int) (-len / 2 + len * prog);
                        g.fill(x0, -3, x1, 3, withAlpha(f.argb(), 0.35f * fade));
                        g.fill(x0, -1, x1, 1, withAlpha(0xffffffff, fade));
                        g.pose().popMatrix();
                    }
                }
                case 5 -> { // hiperespacio: estrellas que se estiran desde el centro
                    float t = now - f.start();
                    g.fill(0, 0, w, h, withAlpha(0xff02030a, a * 0.85f));
                    java.util.Random r = new java.util.Random(f.start() * 13L);
                    float cx = w / 2f, cy = h / 2f;
                    for (int k = 0; k < 110; k++) {
                        float ang = r.nextFloat() * 6.2832f, sp = 0.4f + r.nextFloat() * 1.4f, ph = r.nextFloat();
                        float u = ((t * 0.045f * sp) + ph) % 1f, d0 = u * u * w * 0.9f, d1 = d0 + 6 + u * w * 0.16f * sp;
                        float ca = (float) Math.cos(ang), sa = (float) Math.sin(ang);
                        g.pose().pushMatrix();
                        g.pose().translate(cx + ca * d0, cy + sa * d0);
                        g.pose().rotate(ang);
                        g.fill(0, 0, (int) (d1 - d0), 1, withAlpha(k % 9 == 0 ? (f.argb() | 0xff000000) : 0xffdfe8ff, a * Math.min(1, u * 3)));
                        g.pose().popMatrix();
                    }
                }
                case 6 -> { // mancha roja que cubre la pantalla y se retira (transición)
                    float t = (now - f.start()) / Math.max(1f, f.total());
                    float grow = t < 0.5f ? t / 0.5f : 1 - (t - 0.5f) / 0.5f;
                    java.util.Random r = new java.util.Random(f.start());
                    int blobs = 9;
                    float[] bx = new float[blobs], by = new float[blobs], br = new float[blobs];
                    for (int k = 0; k < blobs; k++) {
                        bx[k] = w * (0.2f + r.nextFloat() * 0.6f);
                        by[k] = h * (0.2f + r.nextFloat() * 0.6f);
                        br[k] = (0.25f + r.nextFloat() * 0.5f) * Math.max(w, h) * grow;
                    }
                    int col = f.argb() | 0xff000000;
                    for (int y = 0; y < h; y += 2) {
                        int x0 = Integer.MAX_VALUE, x1 = Integer.MIN_VALUE;
                        for (int k = 0; k < blobs; k++) {
                            float dy = y - by[k];
                            float wob = 1 + 0.18f * (float) Math.sin(y * 0.09f + k * 2.1f);
                            float rr = br[k] * wob;
                            if (Math.abs(dy) >= rr) continue;
                            float dx = (float) Math.sqrt(rr * rr - dy * dy);
                            x0 = Math.min(x0, (int) (bx[k] - dx));
                            x1 = Math.max(x1, (int) (bx[k] + dx));
                        }
                        if (x0 < x1) g.fill(Math.max(0, x0), y, Math.min(w, x1), y + 2, withAlpha(col, Math.min(1, a * 1.2f)));
                    }
                }
                case 7 -> { // líneas de velocidad de manga alrededor del borde
                    java.util.Random r = new java.util.Random(f.start() * 7L + (long) (now * 0.5f));
                    float cx = w / 2f, cy = h / 2f, R0 = Math.min(w, h) * 0.32f, R1 = Math.max(w, h) * 0.8f;
                    for (int k = 0; k < 90; k++) {
                        float ang = r.nextFloat() * 6.2832f, d0 = R0 * (1 + r.nextFloat() * 0.6f);
                        g.pose().pushMatrix();
                        g.pose().translate(cx + (float) Math.cos(ang) * d0, cy + (float) Math.sin(ang) * d0);
                        g.pose().rotate(ang);
                        int th = 1 + r.nextInt(3);
                        g.fill(0, -th / 2, (int) (R1 - d0), (th + 1) / 2, withAlpha(f.argb(), a * (0.5f + r.nextFloat() * 0.5f)));
                        g.pose().popMatrix();
                    }
                }
                case 8 -> { // HUD de objetivo fijado: esquinas, cruz y texto parpadeante
                    int col = f.argb();
                    float t = now - f.start();
                    float close = Math.max(0, 1 - t / 10f);
                    int bw = (int) (w * (0.16f + 0.2f * close)), bh = (int) (h * (0.2f + 0.2f * close)), cx = w / 2, cy = h / 2, L = 14;
                    int[][] cs = {{cx - bw, cy - bh, 1, 1}, {cx + bw, cy - bh, -1, 1}, {cx - bw, cy + bh, 1, -1}, {cx + bw, cy + bh, -1, -1}};
                    int ca = withAlpha(col, a);
                    for (int[] k : cs) {
                        g.fill(Math.min(k[0], k[0] + k[2] * L), k[1] - 1, Math.max(k[0], k[0] + k[2] * L), k[1] + 1, ca);
                        g.fill(k[0] - 1, Math.min(k[1], k[1] + k[3] * L), k[0] + 1, Math.max(k[1], k[1] + k[3] * L), ca);
                    }
                    g.fill(cx - 7, cy, cx + 8, cy + 1, ca);
                    g.fill(cx, cy - 7, cx + 1, cy + 8, ca);
                    if (((int) (t / 5)) % 2 == 0) g.centeredText(mc.font, "[ OBJETIVO FIJADO ]", cx, cy - bh - 14, ca);
                    g.centeredText(mc.font, String.format("SEÑAL %03d%%  ·  ÓRBITA BAJA", Math.min(100, (int) (t * 4))), cx, cy + bh + 6, withAlpha(col, a * 0.8f));
                }
                default -> {}
            }
        }
        if (now < subUntil && !subText.isEmpty()) {
            // Frase del personaje: grande, centrada, con fondo, efecto «máquina de escribir» y fundido.
            float t = now - subStart, total = subUntil - subStart;
            float a = Math.min(1, Math.min(t / 4f, (total - t) / 8f));
            if (a > 0.02f) {
                int shown = Math.min(subText.length(), (int) (t * 2.2f) + 1);
                String txt = subText.substring(0, shown);
                float sc = w > 700 ? 1.6f : 1.25f;
                int maxW = (int) (w * 0.8f / sc);
                var lines = mc.font.split(net.minecraft.network.chat.Component.literal(txt), maxW);
                var full = mc.font.split(net.minecraft.network.chat.Component.literal(subText), maxW);
                int lh = 11;
                float cy = h * 0.70f / sc - full.size() * lh / 2f;
                int alpha = Math.max(5, (int) (a * 255)) << 24;
                g.pose().pushMatrix();
                g.pose().scale(sc, sc);
                int bw = 0;
                for (var l : full) bw = Math.max(bw, mc.font.width(l));
                int cx = (int) (w / 2f / sc);
                g.fill(cx - bw / 2 - 6, (int) cy - 4, cx + bw / 2 + 6, (int) cy + full.size() * lh + 2, ((int) (a * 150)) << 24);
                for (int i = 0; i < lines.size(); i++) g.centeredText(mc.font, lines.get(i), cx, (int) cy + i * lh, alpha | (subRgb & 0xffffff));
                g.pose().popMatrix();
            }
        }
        if (now < capUntil && !capTitle.isEmpty()) {
            float t = now - capStart, total = capUntil - capStart;
            float a = Math.min(1, Math.min(t / 6f, (total - t) / 10f));
            if (a > 0.02f) {
                int y = (int) (h * 0.80f);
                int alpha = Math.max(5, (int) (a * 255)) << 24;
                g.centeredText(mc.font, capTitle, w / 2, y, alpha | (capRgb & 0xffffff));
                if (!capSub.isEmpty()) g.centeredText(mc.font, capSub, w / 2, y + 12, alpha | 0xdddddd);
            }
        }
        if (!pops.isEmpty()) drawPops(g, now, w);
    }
}
