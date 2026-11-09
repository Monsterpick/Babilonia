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
        else if (skyMode == 1) e.scaleFarPlaneDistance(1.6f);
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
                default -> {}
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
    }
}
