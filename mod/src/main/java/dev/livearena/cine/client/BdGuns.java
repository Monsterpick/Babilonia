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
 *   <li>Apuntar con la mira manteniendo Shift: el arma va al centro, la cámara se acerca y (en el servidor) baja la
 *       dispersión.</li>
 *   <li>Animaciones: retroceso al disparar, recarga (inclina el arma y la baja), desenfundar al cambiar de arma y un
 *       balanceo suave en reposo.</li>
 * </ul>
 * No hay paquetes propios: los disparos y recargas se detectan por los sonidos del pack (basedefense:arma.*) que suenan
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

    public static void init() {
        NeoForge.EVENT_BUS.addListener(BdGuns::tick);
        NeoForge.EVENT_BUS.addListener(BdGuns::sound);
        NeoForge.EVENT_BUS.addListener(BdGuns::hand);
        NeoForge.EVENT_BUS.addListener(BdGuns::fov);
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
            reloadStart = -1;
            lastGun = g;
        }
        adsPrev = ads;
        boolean aiming = !g.isEmpty() && mc.options.keyShift.isDown() && reloadStart < 0 && mc.screen == null;
        ads += ((aiming ? 1 : 0) - ads) * 0.35f;
        recoil *= 0.55f;
        recoilRoll *= 0.6f;
        if (reloadStart >= 0 && ticks - reloadStart > reloadDur + 6) reloadStart = -1;
    }

    private static void sound(PlaySoundEvent e) {
        var s = e.getSound();
        Minecraft mc = Minecraft.getInstance();
        if (s == null || mc.player == null) return;
        Identifier id = s.getIdentifier();
        if (!"basedefense".equals(id.getNamespace()) || !id.getPath().startsWith("arma.")) return;
        if (mc.player.distanceToSqr(s.getX(), s.getY(), s.getZ()) > 16) return; // solo los míos
        String what = id.getPath().substring(5);
        switch (what) {
            case "recarga" -> {
                reloadStart = ticks;
                reloadDur = reloadSeconds(lastGun) * 20;
            }
            case "recarga_fin" -> reloadStart = Math.min(reloadStart, ticks - (long) reloadDur + 4);
            case "pistola" -> kick(1.0f);
            case "subfusil" -> kick(0.55f);
            case "ametralladora" -> kick(0.7f);
            case "minigun" -> kick(0.35f);
            case "granada" -> kick(1.3f);
            case "cohete" -> kick(2.2f);
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
        e.setFOV((float) (e.getFOV() * 0.86 * (1 - a * (1 - zoom)) * CineClient.dragonPunch(pt)));
    }

    private static float ease(float x) {
        x = Math.max(0, Math.min(1, x));
        return x * x * (3 - 2 * x);
    }

    private static void hand(RenderHandEvent e) {
        if (e.getHand() != InteractionHand.MAIN_HAND) return;
        String g = gun(e.getItemStack());
        if (g.isEmpty()) return;
        PoseStack ps = e.getPoseStack();
        float pt = e.getPartialTick();
        float t = ticks + pt;
        float a = ease(adsPrev + (ads - adsPrev) * pt);
        // apuntar: el arma va al centro y se acerca; la mira queda en la cruz
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
        // reposo: balanceo lento (menos al apuntar)
        float sway = 1 - a * 0.85f;
        ps.translate(Math.sin(t * 0.045) * 0.006 * sway, Math.sin(t * 0.09) * 0.005 * sway, 0);
        // desenfundar: sube desde abajo girado
        float d = (t - drawStart) / 9f;
        if (d < 1) {
            float k = 1 - ease(d);
            ps.translate(0.05 * k, -0.35 * k, 0);
            ps.mulPose(Axis.XP.rotationDegrees(-35 * k));
        }
        // recarga: baja, se inclina hacia dentro, «golpe» del cargador a mitad y vuelve
        if (reloadStart >= 0) {
            float r = (t - reloadStart) / Math.max(10, reloadDur);
            float in = ease(r / 0.18f), out = 1 - ease((r - 0.8f) / 0.2f);
            float k = Math.min(in, out);
            float tap = r > 0.5f && r < 0.62f ? (float) Math.sin((r - 0.5f) / 0.12f * Math.PI) : 0;
            ps.translate(-0.06 * k, -0.14 * k + 0.05 * tap, 0.04 * k);
            ps.mulPose(Axis.ZP.rotationDegrees(28 * k));
            ps.mulPose(Axis.XP.rotationDegrees(-14 * k + 6 * tap));
        }
        // retroceso: hacia atrás y la boca sube, con un poco de giro
        float rc = recoil;
        if (rc > 0.001f) {
            ps.translate(0, 0.012 * rc, 0.07 * rc);
            ps.mulPose(Axis.XP.rotationDegrees(5.5f * rc));
            ps.mulPose(Axis.ZP.rotationDegrees(recoilRoll * 1.6f));
        }
    }
}
