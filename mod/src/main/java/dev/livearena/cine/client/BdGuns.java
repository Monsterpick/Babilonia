package dev.livearena.cine.client;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.math.Axis;
import net.minecraft.client.Minecraft;
import net.minecraft.core.component.DataComponents;
import net.minecraft.resources.Identifier;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.item.ItemStack;
import net.neoforged.neoforge.client.event.ClientTickEvent;
import net.neoforged.neoforge.client.event.RenderHandEvent;
import net.neoforged.neoforge.client.event.ViewportEvent;
import net.neoforged.neoforge.client.event.sound.PlaySoundEvent;
import net.neoforged.neoforge.common.NeoForge;

/**
 * Armas de Base Defense en primera persona, estilo táctico (idea de mods de armas como TacZ, todo propio):
 * <ul>
 *   <li>Cámara más cerrada mientras el pack del minijuego está puesto.</li>
 *   <li>Controles de shooter: clic izquierdo dispara (mantenido en las automáticas), clic derecho apunta con la mira
 *       (el arma va al centro, la cámara se acerca y en el servidor baja la dispersión) y R recarga. El estado del
 *       ratón se manda al plugin por el canal «livearena:bd». Si el servidor no lo anuncia (plugin antiguo), se juega
 *       como antes: clic derecho dispara y Shift apunta.</li>
 *   <li>Animaciones: retroceso al disparar, recarga (inclina el arma y la baja), desenfundar al cambiar de arma y un
 *       balanceo suave en reposo.</li>
 * </ul>
 * Los disparos y recargas se detectan por los sonidos del pack (basedefense:arma.*) que suenan
 * junto al jugador, así funciona con el plugin tal cual.
 */
public final class BdGuns {
    private BdGuns() {}

    private static float recoil, recoilRoll;
    private static long reloadStart = -1;
    private static float reloadDur = 40;
    private static long drawStart = -1000;
    private static String lastGun = "";
    private static float ads, adsPrev;
    private static long ticks;
    private static int sentFlags = -1;
    private static long sentAt;
    private static boolean reloadPressed;

    public static void init() {
        NeoForge.EVENT_BUS.addListener(BdGuns::tick);
        NeoForge.EVENT_BUS.addListener(BdGuns::sound);
        NeoForge.EVENT_BUS.addListener(BdGuns::hand);
        NeoForge.EVENT_BUS.addListener(BdGuns::fov);
        NeoForge.EVENT_BUS.addListener(BdGuns::click);
        NeoForge.EVENT_BUS.addListener(BdGuns::key);
    }

    /** Nombre del arma del pack que lleva en la mano ("" si no es una). */
    static String gun(ItemStack st) {
        if (st == null || st.isEmpty()) return "";
        Identifier m = st.get(DataComponents.ITEM_MODEL);
        if (m == null || !"basedefense".equals(m.getNamespace())) return "";
        String p = m.getPath();
        return switch (p) {
            case "pistola", "subfusil", "ametralladora", "lanzagranadas", "lanzacohetes", "minigun" -> p;
            default -> "";
        };
    }

    private static float reloadSeconds(String g) {
        return switch (g) {
            case "pistola" -> 1.3f;
            case "subfusil" -> 1.8f;
            case "ametralladora" -> 3.6f;
            case "lanzagranadas" -> 2.8f;
            case "lanzacohetes" -> 3.2f;
            case "minigun" -> 4.5f;
            default -> 2f;
        };
    }

    private static void tick(ClientTickEvent.Post e) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.player == null || mc.isPaused()) return;
        ticks++;
        String g = gun(mc.player.getMainHandItem());
        if (!g.equals(lastGun)) {
            if (!g.isEmpty()) drawStart = ticks;
            casings.clear();
            spinVel = 0;
            reloadStart = -1;
            lastGun = g;
        }
        adsPrev = ads;
        boolean shooter = shooterControls(mc);
        boolean free = !g.isEmpty() && mc.screen == null && CineClient.minigameActive();
        boolean aimKey = shooter ? mc.options.keyUse.isDown() : mc.options.keyShift.isDown();
        boolean aiming = !g.isEmpty() && aimKey && reloadStart < 0 && mc.screen == null;
        if (shooter) {
            int flags = free ? (mc.options.keyAttack.isDown() ? 1 : 0) | (mc.options.keyUse.isDown() ? 2 : 0) | (reloadPressed ? 4 : 0) : 0;
            // se manda al cambiar y, mientras haya algo pulsado, cada 5 ticks (por si se pierde un paquete)
            if (flags != sentFlags || (flags != 0 && ticks - sentAt >= 5)) {
                net.neoforged.neoforge.client.network.ClientPacketDistributor.sendToServer(new dev.livearena.cine.BdInputPayload((byte) flags));
                sentFlags = flags;
                sentAt = ticks;
            }
        } else sentFlags = -1;
        reloadPressed = false;
        ads += ((aiming ? 1 : 0) - ads) * 0.35f;
        recoil *= 0.55f;
        recoilRoll *= 0.6f;
        if (reloadStart >= 0 && ticks - reloadStart > reloadDur + 6) reloadStart = -1;
        if (reloadStart >= 0 || g.isEmpty()) inspectStart = -1000;
        tickParts();
    }

    /** ¿El servidor entiende los controles de shooter? (el plugin anuncia el canal «livearena:bd») */
    static boolean shooterControls(Minecraft mc) {
        var c = mc.getConnection();
        return c != null && c.hasChannel(dev.livearena.cine.BdInputPayload.TYPE);
    }

    /** Con un arma en la mano los clics no son de Minecraft (ni golpear ni usar): los lleva el canal propio. */
    private static void click(net.neoforged.neoforge.client.event.InputEvent.InteractionKeyMappingTriggered e) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.player == null || e.isPickBlock() || !CineClient.minigameActive() || !shooterControls(mc)) return;
        if (gun(mc.player.getMainHandItem()).isEmpty()) return;
        e.setSwingHand(false);
        e.setCanceled(true);
    }

    private static void key(net.neoforged.neoforge.client.event.InputEvent.Key e) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.player == null || mc.screen != null) return;
        if (e.getAction() != org.lwjgl.glfw.GLFW.GLFW_PRESS || gun(mc.player.getMainHandItem()).isEmpty()) return;
        if (e.getKey() == org.lwjgl.glfw.GLFW.GLFW_KEY_R) reloadPressed = true;
        // G: inspeccionar el arma (solo visual, en el cliente)
        if (e.getKey() == org.lwjgl.glfw.GLFW.GLFW_KEY_G && reloadStart < 0 && ticks - inspectStart > 60) inspectStart = ticks;
        // banco de pruebas sin audio (el evento de sonido no llega si no hay dispositivo): solo con el fichero run/bdguns-test
        if (e.getKey() == org.lwjgl.glfw.GLFW.GLFW_KEY_F9 && java.nio.file.Files.exists(java.nio.file.Path.of("bdguns-test"))) {
            float[] cuts = {-1, 0.18f, 0.3f, 0.5f, 0.6f, 0.66f, 0.7f, 0.82f};
            frozenIdx = (frozenIdx + 1) % cuts.length;
            frozenR = cuts[frozenIdx];
        }
        if ((e.getKey() == org.lwjgl.glfw.GLFW.GLFW_KEY_F7 || e.getKey() == org.lwjgl.glfw.GLFW.GLFW_KEY_F8) && java.nio.file.Files.exists(java.nio.file.Path.of("bdguns-test"))) {
            String g = gun(mc.player.getMainHandItem());
            if (e.getKey() == org.lwjgl.glfw.GLFW.GLFW_KEY_F7) event("recarga");
            else event(switch (g) {
                case "lanzagranadas" -> "granada";
                case "lanzacohetes" -> "cohete";
                default -> g;
            });
        }
    }

    private static void sound(PlaySoundEvent e) {
        var s = e.getSound();
        Minecraft mc = Minecraft.getInstance();
        if (s == null || mc.player == null) return;
        Identifier id = s.getIdentifier();
        if (!"basedefense".equals(id.getNamespace()) || !id.getPath().startsWith("arma.")) return;
        if (mc.player.distanceToSqr(s.getX(), s.getY(), s.getZ()) > 16) return; // solo los míos
        event(id.getPath().substring(5));
    }

    /** Disparo/recarga detectados (por el sonido o, en pruebas, por las teclas F7/F8). */
    private static void event(String what) {
        switch (what) {
            case "recarga" -> {
                reloadStart = ticks;
                reloadDur = reloadSeconds(lastGun) * 20;
            }
            case "recarga_fin" -> reloadStart = Math.min(reloadStart, ticks - (long) reloadDur + 4);
            case "pistola" -> {
                kick(1.0f);
                fired("pistola");
            }
            case "subfusil" -> {
                kick(0.55f);
                fired("subfusil");
            }
            case "ametralladora" -> {
                kick(0.7f);
                fired("ametralladora");
            }
            case "minigun" -> {
                kick(0.35f);
                fired("minigun");
            }
            case "granada" -> {
                kick(1.3f);
                fired("lanzagranadas");
            }
            case "cohete" -> {
                kick(2.2f);
                fired("lanzacohetes");
            }
            default -> {
            }
        }
    }

    private static void kick(float k) {
        float aimK = 1 - ads * 0.45f;
        recoil = Math.min(2.5f, recoil + k * aimK);
        recoilRoll += (float) ((Math.random() - 0.5) * 2 * k);
    }

    /** Cámara más cerrada en Base Defense y aún más al apuntar. */
    private static void fov(ViewportEvent.ComputeFov e) {
        if (!CineClient.minigameActive() || !e.usedConfiguredFov()) return;
        float pt = (float) e.getPartialTick();
        float a = adsPrev + (ads - adsPrev) * pt;
        double zoom = "lanzacohetes".equals(lastGun) || "minigun".equals(lastGun) ? 0.8 : "pistola".equals(lastGun) ? 0.78 : 0.68;
        e.setFOV((float) (e.getFOV() * 0.74 * (1 - a * (1 - zoom)) * CineClient.dragonPunch(pt)));
    }

    private static float ease(float x) {
        x = Math.max(0, Math.min(1, x));
        return x * x * (3 - 2 * x);
    }

    private static float seg(float r, float a, float b) {
        return ease((r - a) / (b - a));
    }

    // ───────────── piezas animadas (pack con <arma>_cuerpo/_mano/_cargador/_corredera/_tambor) ─────────────

    /** Datos de cada arma en unidades del modelo (las de gen_guns.py): escala de la «display», boca, expulsión,
     *  mano izquierda en reposo, punto del cargador donde la mano lo encaja y dirección en la que cae. */
    private record Spec(float k, float[] muzzle, float[] eject, float[] fore, float[] well, float[] drop, float flash, float[] sight) {}

    // pose de primera persona del pack (gen_guns.py: FP_T, FP_R, FP_S); la escala final es FP_S·k
    private static final float FP_TX = 1.4f, FP_TY = 3.0f, FP_TZ = -1.0f, FP_RY = 9f, FP_S = 0.82f;

    private static final java.util.Map<String, Spec> SPECS = java.util.Map.of(
        "pistola", new Spec(1.2f, v(8, 9.5f, 0.1f), v(9.1f, 9.8f, 4.3f), v(8.2f, 4.6f, 7.2f), v(8, 3.0f, 9.2f), v(0, -1, 0.38f), 4.5f, v(8, 11.0f, 9.5f)),
        "subfusil", new Spec(0.95f, v(8, 9.2f, -10.7f), v(9.35f, 9.4f, 3), v(8, 7.4f, -4), v(8, 1.5f, 3.4f), v(0, -1, -0.4f), 5.5f, v(8, 12.9f, 3.1f)),
        "ametralladora", new Spec(0.72f, v(8, 9.4f, -16.2f), v(9.4f, 9.6f, 2), v(8, 7.8f, -7), v(8, 3.8f, 2.1f), v(0.15f, -1, 0), 8f, v(8, 11.6f, 0)),
        "lanzagranadas", new Spec(0.88f, v(8, 10.6f, -7.7f), null, v(8, 6.6f, -5.3f), v(8, 9.2f, -1.6f), v(0, -1, 0), 8f, v(8, 13.4f, 0.3f)),
        "lanzacohetes", new Spec(0.7f, v(8, 9, -12.3f), null, v(8, 5.2f, 9.8f), v(8, 9, -11), v(0, -0.5f, -1), 10f, v(10.7f, 10.6f, 5)),
        "minigun", new Spec(0.74f, v(8, 9, -15.3f), v(10.4f, 6.6f, 2.6f), v(8, 12.9f, 6.8f), v(12.3f, 3.6f, 6), v(0.3f, -1, 0), 7f, v(8, 13.4f, 6)));

    private static float[] v(float x, float y, float z) {
        return new float[] {x, y, z};
    }

    private static long shotAt = -100, inspectStart = -1000;
    private static float frozenR = -1;
    private static int frozenIdx;
    private static float slideKick, drumAngle, drumTarget, spinVel, spinAngle, flashRoll;
    private static boolean rocketEmpty;
    private static final java.util.List<float[]> casings = new java.util.ArrayList<>();
    private static boolean partsReady;
    private static long partsCheckedAt = -100;
    private static final java.util.Map<String, ItemStack> stacks = new java.util.HashMap<>();

    /** ¿El pack trae las piezas sueltas? (un pack antiguo solo trae el arma entera: entonces se anima en bloque) */
    private static boolean partsReady(Minecraft mc) {
        if (ticks - partsCheckedAt > 40 || partsCheckedAt > ticks) {
            partsCheckedAt = ticks;
            var rm = mc.getResourceManager();
            partsReady = rm.getResource(Identifier.fromNamespaceAndPath("basedefense", "items/pistola_cuerpo.json")).isPresent()
                || rm.getResource(Identifier.fromNamespaceAndPath("basedefense", "models/item/pistola_cuerpo.json")).isPresent();

        }
        return partsReady;
    }

    private static ItemStack part(ItemStack base, String model) {
        ItemStack s = stacks.get(model);
        if (s == null) {
            s = base.copy();
            s.set(DataComponents.ITEM_MODEL, Identifier.fromNamespaceAndPath("basedefense", model));
            stacks.put(model, s);
        }
        return s;
    }

    /** Llamado al sonar un disparo propio: corredera, tambor, casquillo y fogonazo. */
    private static void fired(String g) {
        shotAt = ticks;
        flashRoll = (float) (Math.random() * 360);
        Spec sp = SPECS.get(g);
        switch (g) {
            case "pistola" -> slideKick = 1;
            case "subfusil", "ametralladora" -> slideKick = 0.6f;
            case "lanzagranadas" -> drumTarget += 60;
            case "minigun" -> spinVel = Math.min(48, spinVel + 14);
            case "lanzacohetes" -> rocketEmpty = true;
            default -> {
            }
        }
        if (sp != null && sp.eject() != null && casings.size() < 24) {
            boolean mini = "minigun".equals(g);
            float[] e = sp.eject();
            casings.add(new float[] {e[0], e[1], e[2],
                (float) (mini ? 0.5 + Math.random() * 0.3 : 0.9 + Math.random() * 0.5), (float) (mini ? -0.3 : 0.9 + Math.random() * 0.5), (float) (0.15 + Math.random() * 0.3),
                ticks, (float) (Math.random() * 360)});
        }
    }

    private static void tickParts() {
        slideKick *= 0.45f;
        spinVel *= 0.9f;
        spinAngle += spinVel;
        drumAngle += (drumTarget - drumAngle) * 0.35f;
        for (var it = casings.iterator(); it.hasNext(); ) {
            float[] c = it.next();
            if (ticks - c[6] > 14) it.remove();
        }
    }

    // de la mano al sistema del modelo del arma (unidades de gen_guns) y vuelta, según la «display» de primera persona
    private static void enter(PoseStack ps, float k) {
        ps.translate(FP_TX / 16f, FP_TY / 16f, FP_TZ / 16f);
        ps.mulPose(Axis.YP.rotationDegrees(FP_RY));
        float s = FP_S * k / 16f;
        ps.scale(s, s, s);
        ps.translate(-8, -8, -8);
    }

    private static void exit(PoseStack ps, float k) {
        ps.translate(8, 8, 8);
        float s = 16f / (FP_S * k);
        ps.scale(s, s, s);
        ps.mulPose(Axis.YP.rotationDegrees(-FP_RY));
        ps.translate(-FP_TX / 16f, -FP_TY / 16f, -FP_TZ / 16f);
    }

    private static void about(PoseStack ps, float px, float py, float pz, com.mojang.math.Axis ax, float deg) {
        ps.translate(px, py, pz);
        ps.mulPose(ax.rotationDegrees(deg));
        ps.translate(-px, -py, -pz);
    }

    /** Dibuja el arma por piezas con animaciones por fotogramas clave. Devuelve false si no se puede (pack antiguo). */
    private static boolean renderParts(RenderHandEvent e, String g, float t) {
        Minecraft mc = Minecraft.getInstance();
        Spec sp = SPECS.get(g);
        if (sp == null || mc.player == null || !partsReady(mc)) return false;
        PoseStack ps = e.getPoseStack();
        var hr = mc.gameRenderer.itemInHandRenderer;
        var ctx = net.minecraft.world.item.ItemDisplayContext.FIRST_PERSON_RIGHT_HAND;
        // luz mínima para el arma (el escenario es muy oscuro y el arma quedaba negra sin detalle)
        int light = e.getPackedLight();
        int bl = Math.max((light >> 4) & 0xF, 11), sl = (light >> 20) & 0xF;
        light = (sl << 20) | (bl << 4);
        ItemStack base = e.getItemStack();
        float k = sp.k();
        ps.pushPose();
        ps.translate(0.56f, -0.52f + e.getEquipProgress() * -0.6f, -0.72f);

        // ── estado de la recarga (0..1) y de la inspección
        float r = frozenR >= 0 ? frozenR : reloadStart >= 0 ? Math.min(1, (t - reloadStart) / Math.max(10, reloadDur)) : -1;
        float ins = (t - inspectStart) / 60f;
        boolean inspecting = ins >= 0 && ins < 1 && r < 0;
        float d = (t - drawStart) / 14f;

        // mano izquierda: baja a por munición, la trae al encaje y vuelve
        float[] hand = {0, 0, 0};
        float[] mag = {0, 0, 0};
        float magTilt = 0;
        boolean magVisible = true;
        float[] w = sp.well(), f = sp.fore(), dr = sp.drop();
        if (r >= 0) {
            float down = seg(r, 0.22f, 0.36f) * (1 - seg(r, 0.46f, 0.58f));
            float toWell = seg(r, 0.46f, 0.58f) * (1 - seg(r, 0.76f, 0.88f));
            float gap = 1 - seg(r, 0.62f, 0.68f);
            // la mano sube con el cargador nuevo: primero 3,5 bloques por debajo del encaje y luego lo mete de golpe
            for (int i = 0; i < 3; i++) hand[i] = (w[i] - f[i] + dr[i] * 3.5f * gap) * toWell;
            hand[1] += -16 * down;
            hand[0] += -3 * down;
            // cargador viejo: cae por su eje (acelera) y se va; el nuevo llega con la mano y entra de golpe
            if (r < 0.46f) {
                float fall = seg(r, 0.12f, 0.20f) * 3 + (float) Math.pow(Math.max(0, (r - 0.20f) / 0.14f), 2) * 18;
                for (int i = 0; i < 3; i++) mag[i] = dr[i] * fall;
                magTilt = 25 * seg(r, 0.2f, 0.34f);
                magVisible = r < 0.36f;
            } else if (r < 0.68f) {
                // el cargador nuevo va pegado a la mano (misma posición relativa que al encajar)
                for (int i = 0; i < 3; i++) mag[i] = hand[i] - (w[i] - f[i]);
                magVisible = r > 0.5f;
            }
            if (r > 0.5f && "lanzacohetes".equals(g)) rocketEmpty = false;
        } else if (inspecting && !"lanzagranadas".equals(g) && !"lanzacohetes".equals(g)) {
            // al inspeccionar, saca un poco el cargador para mirarlo y lo vuelve a meter
            float o = seg(ins, 0.35f, 0.45f) * (1 - seg(ins, 0.6f, 0.68f));
            for (int i = 0; i < 3; i++) mag[i] = dr[i] * 2.2f * o;
            float h = seg(ins, 0.3f, 0.4f) * (1 - seg(ins, 0.66f, 0.76f));
            for (int i = 0; i < 3; i++) hand[i] = (w[i] - f[i] + dr[i] * 2.2f) * h;
        }

        // inspección: gira el arma para enseñarla (primero el lado derecho, luego la boca)
        if (inspecting) {
            float a1 = seg(ins, 0f, 0.18f) * (1 - seg(ins, 0.5f, 0.62f));
            float a2 = seg(ins, 0.5f, 0.62f) * (1 - seg(ins, 0.86f, 1f));
            ps.translate(-0.12f * a1 - 0.08f * a2, 0.06f * a1 + 0.04f * a2, 0.05f * (a1 + a2));
            ps.mulPose(Axis.YP.rotationDegrees(38 * a1 - 22 * a2));
            ps.mulPose(Axis.ZP.rotationDegrees(-24 * a1 + 10 * a2));
            ps.mulPose(Axis.XP.rotationDegrees(8 * a2 + (float) Math.sin(t * 0.3f) * 1.2f * (a1 + a2)));
        }

        // corredera / cerrojo: retroceso por disparo; montar al final de la recarga y al desenfundar
        float rack = 0;
        if (r >= 0) rack = seg(r, 0.78f, 0.84f) * (1 - seg(r, 0.86f, 0.89f));
        if (d >= 0 && d < 1) rack = Math.max(rack, seg(d, 0.55f, 0.72f) * (1 - seg(d, 0.76f, 0.82f)));
        float slide = Math.max(slideKick, rack);

        enter(ps, k);
        // ── cuerpo (+ brazo derecho)
        exit(ps, k);
        hr.renderItem(mc.player, part(base, g + "_cuerpo"), ctx, ps, e.getSubmitNodeCollector(), light);
        enter(ps, k);

        // ── corredera / tapa
        if (!"lanzagranadas".equals(g) && !"lanzacohetes".equals(g) && !"minigun".equals(g)) {
            ps.pushPose();
            if ("ametralladora".equals(g)) {
                float open = r >= 0 ? seg(r, 0.14f, 0.24f) * (1 - seg(r, 0.72f, 0.78f)) : 0;
                about(ps, 8, 11.1f, 8.0f, Axis.XP, -62 * open);
                ps.translate(0, 0, 1.2f * slideKick);
            } else ps.translate(0, 0, ("pistola".equals(g) ? 2.6f : 2.2f) * slide);
            exit(ps, k);
            hr.renderItem(mc.player, part(base, g + "_corredera"), ctx, ps, e.getSubmitNodeCollector(), light);
            ps.popPose();
        }
        // ── tambor (lanzagranadas: 60° por disparo y vuelta entera al recargar; minigun: gira con el fuego)
        if ("lanzagranadas".equals(g) || "minigun".equals(g)) {
            ps.pushPose();
            float cy = "minigun".equals(g) ? 9f : 9.2f;
            float ang = "minigun".equals(g) ? spinAngle + spinVel * (t - (float) Math.floor(t)) : drumAngle + (r >= 0 ? 360 * seg(r, 0.3f, 0.75f) : 0);
            about(ps, 8, cy, 0, Axis.ZP, ang);
            exit(ps, k);
            hr.renderItem(mc.player, part(base, g + "_tambor"), ctx, ps, e.getSubmitNodeCollector(), light);
            ps.popPose();
        }
        // ── cargador
        if (!"lanzagranadas".equals(g) && magVisible && !(rocketEmpty && "lanzacohetes".equals(g))) {
            ps.pushPose();
            ps.translate(mag[0], mag[1], mag[2]);
            about(ps, w[0], w[1], w[2], Axis.XP, magTilt);
            exit(ps, k);
            hr.renderItem(mc.player, part(base, g + "_cargador"), ctx, ps, e.getSubmitNodeCollector(), light);
            ps.popPose();
        }
        // ── mano izquierda
        ps.pushPose();
        ps.translate(hand[0], hand[1], hand[2]);
        exit(ps, k);
        hr.renderItem(mc.player, part(base, g + "_mano"), ctx, ps, e.getSubmitNodeCollector(), light);
        ps.popPose();

        // ── fogonazo (2 ticks, a toda luz) y casquillos
        float since = t - shotAt;
        if (since >= 0 && since < 3f) {
            ps.pushPose();
            float[] m = sp.muzzle();
            ps.translate(m[0], m[1], m[2] - sp.flash() * 0.35f);
            ps.mulPose(Axis.ZP.rotationDegrees(flashRoll));
            float sz = 2.3f * sp.flash() * (since < 1f ? 1f : since < 2f ? 0.65f : 0.35f);
            ps.scale(sz, sz, sz * 1.6f);
            hr.renderItem(mc.player, part(base, "fogonazo"), net.minecraft.world.item.ItemDisplayContext.NONE, ps, e.getSubmitNodeCollector(), 0xF000F0);
            ps.popPose();
        }
        for (float[] c : casings) {
            float a = t - c[6];
            if (a < 0) continue;
            ps.pushPose();
            ps.translate(c[0] + c[3] * a, c[1] + c[4] * a - 0.11f * a * a, c[2] + c[5] * a);
            ps.mulPose(Axis.YP.rotationDegrees(c[7] + a * 40));
            ps.mulPose(Axis.XP.rotationDegrees(a * 55));
            ps.scale(4.2f, 4.2f, 4.2f);
            hr.renderItem(mc.player, part(base, "casquillo"), net.minecraft.world.item.ItemDisplayContext.NONE, ps, e.getSubmitNodeCollector(), light);
            ps.popPose();
        }
        exit(ps, k);
        ps.popPose();
        return true;
    }

    private static void hand(RenderHandEvent e) {
        if (e.getHand() != InteractionHand.MAIN_HAND) return;
        String g = gun(e.getItemStack());
        if (g.isEmpty()) return;
        PoseStack ps = e.getPoseStack();
        float pt = e.getPartialTick();
        float t = ticks + pt;
        float a = ease(adsPrev + (ads - adsPrev) * pt);
        boolean parts = partsReady(Minecraft.getInstance()) && SPECS.containsKey(g);
        ps.pushPose();
        // apuntar: la mira del arma se coloca sobre la línea de la cruz (calculado con la pose del pack) y se endereza
        Spec sp0 = SPECS.get(g);
        if (sp0 != null && a > 0.001f) {
            float s = FP_S * sp0.k() / 16f;
            float[] q = sp0.sight();
            float sx = 0.56f + FP_TX / 16f + s * (q[0] - 8), sy = -0.52f + FP_TY / 16f + s * (q[1] - 8);
            ps.translate(-sx * a, -(sy - 0.004f) * a, 0.06f * a);
            // gira alrededor del punto de la mira para dejar el cañón recto hacia la cruz
            float pz = -0.72f + FP_TZ / 16f + s * (q[2] - 8);
            ps.translate(sx, sy, pz);
            ps.mulPose(Axis.YP.rotationDegrees(-FP_RY * a));
            ps.translate(-sx, -sy, -pz);
        }
        // reposo: balanceo lento (menos al apuntar); al andar, el arma se mece con el paso
        float sway = 1 - a * 0.85f;
        ps.translate(Math.sin(t * 0.045) * 0.006 * sway, Math.sin(t * 0.09) * 0.005 * sway, 0);
        // desenfundar: sube desde abajo girada sobre su eje y se asienta con un pequeño rebote
        float d = (t - drawStart) / 14f;
        if (d < 1) {
            float k = 1 - ease(d / 0.55f);
            float settle = d > 0.5f ? (float) Math.sin((d - 0.5f) / 0.5f * Math.PI) * (1 - d) : 0;
            float px = 0.56f + FP_TX / 16f, py = -0.52f + FP_TY / 16f, pz = -0.72f + FP_TZ / 16f;
            ps.translate(0.05 * k, -0.38 * k - 0.02 * settle, 0);
            ps.translate(px, py, pz);
            ps.mulPose(Axis.XP.rotationDegrees(-40 * k + 3 * settle));
            ps.mulPose(Axis.ZP.rotationDegrees(25 * k));
            ps.translate(-px, -py, -pz);
        }
        // recarga: el arma se acerca al centro y se inclina sobre sí misma (no sobre la cámara) para enseñar el encaje;
        // golpe al meter el cargador y tirón al montar
        if (reloadStart >= 0 || frozenR >= 0) {
            float r = frozenR >= 0 ? frozenR : (t - reloadStart) / Math.max(10, reloadDur);
            float k = seg(r, 0f, 0.14f) * (1 - seg(r, 0.86f, 1f));
            float tap = r > 0.66f && r < 0.74f ? (float) Math.sin((r - 0.66f) / 0.08f * Math.PI) : 0;
            float pull = r > 0.78f && r < 0.9f ? (float) Math.sin((r - 0.78f) / 0.12f * Math.PI) : 0;
            if (!parts) tap = r > 0.5f && r < 0.62f ? (float) Math.sin((r - 0.5f) / 0.12f * Math.PI) : 0;
            float px = 0.56f + FP_TX / 16f, py = -0.52f + FP_TY / 16f, pz = -0.72f + FP_TZ / 16f;
            ps.translate(-0.15 * k, 0.10 * k + 0.025 * tap, -0.08 * k + 0.03 * pull);
            ps.translate(px, py, pz);
            ps.mulPose(Axis.YP.rotationDegrees(14 * k));
            ps.mulPose(Axis.XP.rotationDegrees(20 * k + 5 * tap));
            ps.mulPose(Axis.ZP.rotationDegrees(22 * k - 5 * pull));
            ps.translate(-px, -py, -pz);
        }
        // retroceso: hacia atrás y la boca sube, con un poco de giro
        float rc = recoil;
        if (rc > 0.001f) {
            ps.translate(0, 0.012 * rc, 0.07 * rc);
            ps.mulPose(Axis.XP.rotationDegrees(5.5f * rc));
            ps.mulPose(Axis.ZP.rotationDegrees(recoilRoll * 1.6f));
        }
        if (parts && renderParts(e, g, t)) {
            ps.popPose();
            e.setCanceled(true);
            return;
        }
        // pack antiguo: lo dibuja vanilla con estas transformaciones (sin pop: las necesita)
        ps.popPose();
        legacy(ps, g, t, a);
    }

    /** Pack sin piezas: las mismas transformaciones, aplicadas a la pila para que vanilla dibuje el arma entera. */
    private static void legacy(PoseStack ps, String g, float t, float a) {
        float[] aim = switch (g) {
            case "pistola" -> new float[] {-0.13f, 0.05f, 0.06f};
            case "subfusil" -> new float[] {-0.40f, 0.05f, 0.06f};
            case "ametralladora" -> new float[] {-0.36f, 0.04f, 0.05f};
            case "lanzagranadas" -> new float[] {-0.34f, 0.04f, 0.05f};
            case "lanzacohetes" -> new float[] {-0.30f, 0.00f, 0.04f};
            default -> new float[] {-0.30f, 0.02f, 0.04f};
        };
        ps.translate(aim[0] * a, aim[1] * a, aim[2] * a);
        ps.mulPose(Axis.YP.rotationDegrees(-5 * a));
        float d = (t - drawStart) / 9f;
        if (d < 1) {
            float k = 1 - ease(d);
            ps.translate(0.05 * k, -0.35 * k, 0);
            ps.mulPose(Axis.XP.rotationDegrees(-35 * k));
        }
        if (reloadStart >= 0) {
            float r = (t - reloadStart) / Math.max(10, reloadDur);
            float in = ease(r / 0.18f), out = 1 - ease((r - 0.8f) / 0.2f);
            float k = Math.min(in, out);
            float tap = r > 0.5f && r < 0.62f ? (float) Math.sin((r - 0.5f) / 0.12f * Math.PI) : 0;
            ps.translate(-0.06 * k, -0.14 * k + 0.05 * tap, 0.04 * k);
            ps.mulPose(Axis.ZP.rotationDegrees(28 * k));
            ps.mulPose(Axis.XP.rotationDegrees(-14 * k + 6 * tap));
        }
        float rc = recoil;
        if (rc > 0.001f) {
            ps.translate(0, 0.012 * rc, 0.07 * rc);
            ps.mulPose(Axis.XP.rotationDegrees(5.5f * rc));
            ps.mulPose(Axis.ZP.rotationDegrees(recoilRoll * 1.6f));
        }
    }
}
