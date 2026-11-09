package dev.livearena.cine.client;

import com.mojang.blaze3d.vertex.PoseStack;
import dev.livearena.cine.LiveArenaMod;
import java.io.DataInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.GZIPInputStream;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.rendertype.RenderTypes;
import net.minecraft.client.renderer.texture.OverlayTexture;
import net.minecraft.resources.Identifier;

/**
 * Mallas de construcciones (p. ej. el santuario exportado de un mundo con Mineways) que se dibujan tal cual, con sus
 * texturas de bloques: miles de caras que como cubos de GeckoLib serían demasiado pesadas.
 * Archivo: assets/livearena/mesh/<modelo>.bin.gz (lo genera tools/gen_mesh.py) y textures/entity/<modelo>_mesh.png.
 * Animaciones sencillas en código: «emerger» (sale del suelo), «hundirse» y reposo.
 */
public final class CineMeshes {
    private CineMeshes() {}

    static final class Mesh {
        final int quads;
        final float height;
        final byte[] normal;
        final float[] pos; // x, y, z en bloques (4 vértices por cara)
        final float[] uv;
        final Identifier texture;

        Mesh(int quads, float height, byte[] normal, float[] pos, float[] uv, Identifier texture) {
            this.quads = quads;
            this.height = height;
            this.normal = normal;
            this.pos = pos;
            this.uv = uv;
            this.texture = texture;
        }
    }

    private static final Map<String, Mesh> cache = new HashMap<>();
    private static final Map<String, Boolean> missing = new HashMap<>();

    /** Malla del modelo, o null si no hay archivo de malla para él. */
    static Mesh get(String model) {
        if (missing.containsKey(model)) return null;
        Mesh m = cache.get(model);
        if (m != null) return m;
        Identifier id = Identifier.fromNamespaceAndPath(LiveArenaMod.ID, "mesh/" + model + ".bin.gz");
        var res = Minecraft.getInstance().getResourceManager().getResource(id);
        if (res.isEmpty()) {
            missing.put(model, true);
            return null;
        }
        try (InputStream raw = res.get().open(); DataInputStream in = new DataInputStream(new GZIPInputStream(raw, 1 << 16))) {
            if (in.readInt() != 0x4C414D31) throw new IOException("formato");
            int n = in.readInt();
            float h = in.readFloat();
            byte[] nor = new byte[n];
            float[] pos = new float[n * 12];
            float[] uv = new float[n * 8];
            for (int q = 0; q < n; q++) {
                nor[q] = in.readByte();
                for (int k = 0; k < 4; k++) {
                    pos[q * 12 + k * 3] = in.readShort() / 64f;
                    pos[q * 12 + k * 3 + 1] = in.readShort() / 64f;
                    pos[q * 12 + k * 3 + 2] = in.readShort() / 64f;
                    uv[q * 8 + k * 2] = in.readUnsignedShort() / 65535f;
                    uv[q * 8 + k * 2 + 1] = in.readUnsignedShort() / 65535f;
                }
            }
            m = new Mesh(n, h, nor, pos, uv, Identifier.fromNamespaceAndPath(LiveArenaMod.ID, "textures/entity/" + model + "_mesh.png"));
            cache.put(model, m);
            return m;
        } catch (IOException | RuntimeException ex) {
            org.slf4j.LoggerFactory.getLogger("livearena").warn("No se pudo leer la malla {}: {}", model, ex.toString());
            missing.put(model, true);
            return null;
        }
    }

    static void clear() {
        cache.clear();
        missing.clear();
    }

    private static final float[] SHADE = {0.6f, 0.6f, 1.0f, 0.5f, 0.8f, 0.8f};
    private static final float[][] NORMALS = {{1, 0, 0}, {-1, 0, 0}, {0, 1, 0}, {0, -1, 0}, {0, 0, 1}, {0, 0, -1}};

    private static float easeOutCubic(float t) {
        float u = 1 - t;
        return 1 - u * u * u;
    }

    /** Dibuja la malla con la animación sencilla que toque (el poseStack ya trae posición, giro y escala del display). */
    static void render(Mesh m, CineModels.Inst inst, PoseStack poseStack, SubmitNodeCollector collector, int light) {
        float secs = (System.currentTimeMillis() - inst.animStart) / 1000f;
        float dy = 0;
        switch (inst.animName) {
            case "emerger", "aparicion" -> dy = -m.height * (1 - easeOutCubic(Math.min(1, secs / 2.5f)));
            case "hundirse", "desaparecer" -> {
                float t = Math.min(1, secs / 2f);
                dy = -m.height * t * t;
            }
            default -> dy = 0;
        }
        // Temblor mientras emerge o se hunde.
        float shake = ("emerger".equals(inst.animName) && secs < 2.5f) || ("hundirse".equals(inst.animName) && secs < 2f) ? 0.15f : 0f;
        float sx = shake * (float) Math.sin(secs * 60), sz = shake * (float) Math.cos(secs * 53);
        int argb = inst.color;
        int ca = argb >>> 24, cr = (argb >> 16) & 255, cg = (argb >> 8) & 255, cb = argb & 255;
        poseStack.pushPose();
        poseStack.translate(sx, dy, sz);
        final float fdy = dy;
        collector.submitCustomGeometry(poseStack, RenderTypes.entityCutout(m.texture), (pose, vc) -> {
            for (int q = 0; q < m.quads; q++) {
                int nIdx = m.normal[q];
                float s = SHADE[nIdx];
                int col = (ca << 24) | ((int) (cr * s) << 16) | ((int) (cg * s) << 8) | (int) (cb * s);
                float[] nn = NORMALS[nIdx];
                for (int k = 0; k < 4; k++) {
                    int p = q * 12 + k * 3, t = q * 8 + k * 2;
                    vc.addVertex(pose, m.pos[p], m.pos[p + 1], m.pos[p + 2]).setColor(col).setUv(m.uv[t], m.uv[t + 1])
                            .setOverlay(OverlayTexture.NO_OVERLAY).setLight(light).setNormal(pose, nn[0], nn[1], nn[2]);
                }
            }
        });
        poseStack.popPose();
    }
}
