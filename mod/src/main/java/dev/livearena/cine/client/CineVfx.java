package dev.livearena.cine.client;

import com.mojang.blaze3d.pipeline.BlendFunction;
import com.mojang.blaze3d.pipeline.ColorTargetState;
import com.mojang.blaze3d.pipeline.DepthStencilState;
import com.mojang.blaze3d.pipeline.RenderPipeline;
import com.mojang.blaze3d.platform.CompareOp;
import com.mojang.blaze3d.vertex.DefaultVertexFormat;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import com.mojang.blaze3d.vertex.VertexFormat;
import dev.livearena.cine.LiveArenaMod;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Random;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.RenderPipelines;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.rendertype.RenderSetup;
import net.minecraft.client.renderer.rendertype.RenderType;
import net.minecraft.client.renderer.state.level.CameraRenderState;
import net.minecraft.core.BlockPos;
import net.minecraft.resources.Identifier;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.Vec3;
import net.minecraft.world.phys.shapes.VoxelShape;
import org.joml.Matrix4f;
import org.joml.Vector3f;

/**
 * Efectos de energía dibujados por la tarjeta gráfica con shaders propios (assets/livearena/shaders/core/fx.*):
 * esferas de plasma, halos, ondas expansivas, haces, tajos, auras de llamas, vórtices, rayos, estelas y un sistema
 * de partículas propio con mezcla aditiva. Nada de esto usa partículas ni bloques de Minecraft.
 * El plugin los crea igual que un modelo: un display con «modelo» fx_<nombre>; su escala (interpolada) es el tamaño,
 * su «animación» el estado (idle, viajar, detonar, cortar…) y su color el tinte.
 */
public final class CineVfx {
    private CineVfx() {}

    private static Identifier id(String p) {
        return Identifier.fromNamespaceAndPath(LiveArenaMod.ID, p);
    }

    private static RenderPipeline.Builder base(String name) {
        return RenderPipeline.builder(RenderPipelines.MATRICES_PROJECTION_SNIPPET, RenderPipelines.GLOBALS_SNIPPET)
                .withLocation(id("pipeline/" + name)).withVertexShader(id("core/fx")).withCull(false)
                .withVertexFormat(DefaultVertexFormat.ENTITY, VertexFormat.Mode.QUADS)
                .withDepthStencilState(new DepthStencilState(CompareOp.LESS_THAN_OR_EQUAL, false));
    }

    static final RenderPipeline P_ADD = base("fx_add").withFragmentShader(id("core/fx")).withShaderDefine("ADDITIVE")
            .withColorTargetState(new ColorTargetState(BlendFunction.ADDITIVE)).build();
    static final RenderPipeline P_ALPHA = base("fx_alpha").withFragmentShader(id("core/fx"))
            .withColorTargetState(new ColorTargetState(BlendFunction.TRANSLUCENT)).build();
    static final RenderPipeline P_TEX = base("fx_tex").withFragmentShader(id("core/fxtex")).withSampler("Sampler0")
            .withColorTargetState(new ColorTargetState(BlendFunction.ADDITIVE)).build();

    private static RenderType tAdd, tAlpha, tTex;

    private static RenderType add() {
        if (tAdd == null) tAdd = RenderType.create("livearena_fx_add", RenderSetup.builder(P_ADD).bufferSize(1 << 18).createRenderSetup());
        return tAdd;
    }

    private static RenderType alpha() {
        if (tAlpha == null) tAlpha = RenderType.create("livearena_fx_alpha", RenderSetup.builder(P_ALPHA).bufferSize(1 << 16).sortOnUpload().createRenderSetup());
        return tAlpha;
    }

    private static RenderType tex() {
        if (tTex == null) tTex = RenderType.create("livearena_fx_tex", RenderSetup.builder(P_TEX).withTexture("Sampler0", id("textures/fx/brujula.png")).bufferSize(1 << 16).createRenderSetup());
        return tTex;
    }

    static boolean is(String model) {
        return model.startsWith("fx_");
    }

    /* ------------------------------------ lote de caras ------------------------------------ */

    static final int ORB = 0, GLOW = 1, RING = 2, BEAM = 3, SLASH = 4, FLAME = 5, VORTEX = 6, FLAT = 7, STARS = 8, PLANET = 9, DOME = 10;

    static final class Batch {
        float[] f = new float[24 * 256];
        int[] n = new int[6 * 256];
        int q;

        void quad(float[] p, float u0, float v0, float u1, float v1, float a0, float a1, float a2, float a3, int rgb, int rgb2, int mode, int seed, float px, float py) {
            if (q >= 12000) return;
            if ((q + 1) * 24 > f.length) {
                f = java.util.Arrays.copyOf(f, f.length * 2);
                n = java.util.Arrays.copyOf(n, n.length * 2);
            }
            int o = q * 24;
            System.arraycopy(p, 0, f, o, 12);
            f[o + 12] = u0; f[o + 13] = v0;
            f[o + 14] = u1; f[o + 15] = v0;
            f[o + 16] = u1; f[o + 17] = v1;
            f[o + 18] = u0; f[o + 19] = v1;
            f[o + 20] = a0; f[o + 21] = a1; f[o + 22] = a2; f[o + 23] = a3;
            int m = q * 6;
            n[m] = rgb; n[m + 1] = rgb2; n[m + 2] = mode; n[m + 3] = seed & 0x3ff;
            n[m + 4] = Math.max(-32000, Math.min(32000, Math.round(px * 1000)));
            n[m + 5] = Math.max(-32000, Math.min(32000, Math.round(py * 1000)));
            q++;
        }

        void emit(PoseStack.Pose pose, VertexConsumer vc) {
            for (int i = 0; i < q; i++) {
                int o = i * 24, m = i * 6;
                int rgb = n[m], c2 = n[m + 1];
                float nx = ((c2 >> 16) & 255) / 127.5f - 1, ny = ((c2 >> 8) & 255) / 127.5f - 1, nz = (c2 & 255) / 127.5f - 1;
                for (int k = 0; k < 4; k++) {
                    int al = Math.max(0, Math.min(255, (int) (f[o + 20 + k] * 255)));
                    vc.addVertex(pose, f[o + k * 3], f[o + k * 3 + 1], f[o + k * 3 + 2]).setColor((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, al)
                            .setUv(f[o + 12 + k * 2], f[o + 13 + k * 2]).setUv1(n[m + 2], n[m + 3]).setUv2(n[m + 4], n[m + 5]).setNormal(nx, ny, nz);
                }
            }
        }
    }

    /* ------------------------------------ estado por efecto ------------------------------------ */

    static final class P {
        double x, y, z;
        float vx, vy, vz, age, life, size, pull, drag, grav;
        int rgb, rgb2;
        /** Partícula oscura (sangre, humo): se dibuja con mezcla normal, no aditiva. */
        boolean ink;
    }

    static final class Wave {
        double x, y, z;
        float t0, dur, r0, r1, thick;
        int rgb, rgb2;
        boolean flat;
    }

    static final class Slash {
        double x, y, z;
        float ux, uy, uz, len, t0, life, bend, width;
        int rgb, rgb2, seed;
        boolean ink;
    }

    static final class St {
        final long born = System.nanoTime();
        final Random rnd = new Random();
        final int seed = new Random().nextInt(1000);
        final List<P> parts = new ArrayList<>();
        final List<Wave> waves = new ArrayList<>();
        final List<Slash> slashes = new ArrayList<>();
        final ArrayDeque<double[]> trail = new ArrayDeque<>();
        double last = -1, lx, ly, lz;
        float emit, emit2;
        String anim = null;
        float animAt;
        boolean started;
        int[] heights;
        int hx, hz, hr;
        float heightsAt = -9;
    }

    private static final java.util.WeakHashMap<CineModels.Inst, St> states = new java.util.WeakHashMap<>();

    /* ------------------------------------ fotograma actual ------------------------------------ */

    private static Batch A, B, T;
    private static Vector3f right, up, fwd;
    private static double camX, camY, camZ;

    private static float[] q = new float[12];

    private static void bill(Batch b, float x, float y, float z, float hw, float hh, float ext, float rot, float al, int rgb, int rgb2, int mode, int seed, float px, float py) {
        float c = (float) Math.cos(rot), s = (float) Math.sin(rot);
        float rx = (right.x * c + up.x * s) * hw, ry = (right.y * c + up.y * s) * hw, rz = (right.z * c + up.z * s) * hw;
        float ux = (-right.x * s + up.x * c) * hh, uy = (-right.y * s + up.y * c) * hh, uz = (-right.z * s + up.z * c) * hh;
        q[0] = x - rx - ux; q[1] = y - ry - uy; q[2] = z - rz - uz;
        q[3] = x + rx - ux; q[4] = y + ry - uy; q[5] = z + rz - uz;
        q[6] = x + rx + ux; q[7] = y + ry + uy; q[8] = z + rz + uz;
        q[9] = x - rx + ux; q[10] = y - ry + uy; q[11] = z - rz + uz;
        b.quad(q, -ext, -ext, ext, ext, al, al, al, al, rgb, rgb2, mode, seed, px, py);
    }

    /** Cara horizontal (ondas en el suelo). */
    private static void flat(Batch b, float x, float y, float z, float h, float al, int rgb, int rgb2, int mode, int seed, float px, float py) {
        q[0] = x - h; q[1] = y; q[2] = z - h;
        q[3] = x + h; q[4] = y; q[5] = z - h;
        q[6] = x + h; q[7] = y; q[8] = z + h;
        q[9] = x - h; q[10] = y; q[11] = z + h;
        b.quad(q, -1, -1, 1, 1, al, al, al, al, rgb, rgb2, mode, seed, px, py);
    }

    /** Tramo de cinta de a → b que mira a la cámara: ancho w0 en a y w1 en b; v0..v1 a lo largo. */
    private static void seg(Batch b, float ax, float ay, float az, float bx, float by, float bz, float w0, float w1, float v0, float v1, float al0, float al1, int rgb, int rgb2, int mode, int seed, float px, float py) {
        float dx = bx - ax, dy = by - ay, dz = bz - az;
        float mx = (ax + bx) * 0.5f, my = (ay + by) * 0.5f, mz = (az + bz) * 0.5f;
        // lado = dirección × vista
        float sx = dy * mz - dz * my, sy = dz * mx - dx * mz, sz = dx * my - dy * mx;
        float l = (float) Math.sqrt(sx * sx + sy * sy + sz * sz);
        if (l < 1e-6f) return;
        sx /= l; sy /= l; sz /= l;
        q[0] = ax - sx * w0; q[1] = ay - sy * w0; q[2] = az - sz * w0;
        q[3] = ax + sx * w0; q[4] = ay + sy * w0; q[5] = az + sz * w0;
        q[6] = bx + sx * w1; q[7] = by + sy * w1; q[8] = bz + sz * w1;
        q[9] = bx - sx * w1; q[10] = by - sy * w1; q[11] = bz - sz * w1;
        b.quad(q, -1, v0, 1, v1, al0, al0, al1, al1, rgb, rgb2, mode, seed, px, py);
    }

    private static int mix(int a, int b, float f) {
        f = Math.max(0, Math.min(1, f));
        int r = (int) (((a >> 16) & 255) * (1 - f) + ((b >> 16) & 255) * f), g = (int) (((a >> 8) & 255) * (1 - f) + ((b >> 8) & 255) * f), bl = (int) ((a & 255) * (1 - f) + (b & 255) * f);
        return (r << 16) | (g << 8) | bl;
    }

    /** Rayo quebrado entre dos puntos (relativos a la cámara). */
    private static void arc(Batch b, Random r, float ax, float ay, float az, float bx, float by, float bz, float jitter, float w, float al, int rgb, int rgb2) {
        int nseg = 9;
        float px = ax, py = ay, pz = az;
        for (int i = 1; i <= nseg; i++) {
            float f = i / (float) nseg, k = (float) Math.sin(f * Math.PI) * jitter;
            float x = ax + (bx - ax) * f + (r.nextFloat() - 0.5f) * 2 * k, y = ay + (by - ay) * f + (r.nextFloat() - 0.5f) * 2 * k, z = az + (bz - az) * f + (r.nextFloat() - 0.5f) * 2 * k;
            if (i == nseg) { x = bx; y = by; z = bz; }
            seg(b, px, py, pz, x, y, z, w, w, 0, 1, al, al, rgb, rgb2, BEAM, 0, 0, 0);
            px = x; py = y; pz = z;
        }
    }

    private static P spawn(St s, double x, double y, double z, float vx, float vy, float vz, float life, float size, int rgb, int rgb2) {
        if (s.parts.size() > 2600) return new P();
        P p = new P();
        p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.life = life; p.size = size; p.rgb = rgb; p.rgb2 = rgb2; p.drag = 0.6f;
        s.parts.add(p);
        return p;
    }

    private static void burst(St s, double x, double y, double z, int n, float speed, float life, float size, int rgb, int rgb2) {
        for (int i = 0; i < n; i++) {
            double th = s.rnd.nextDouble() * Math.PI * 2, cz = s.rnd.nextDouble() * 2 - 1, sq = Math.sqrt(1 - cz * cz);
            float sp = speed * (0.25f + s.rnd.nextFloat());
            P p = spawn(s, x, y, z, (float) (Math.cos(th) * sq) * sp, (float) cz * sp, (float) (Math.sin(th) * sq) * sp, life * (0.5f + s.rnd.nextFloat()), size * (0.5f + s.rnd.nextFloat()), rgb, rgb2);
            p.drag = 1.6f;
            p.grav = 2.5f;
        }
    }

    private static void wave(St s, double x, double y, double z, float t, float dur, float r0, float r1, float thick, int rgb, int rgb2, boolean flat) {
        Wave w = new Wave();
        w.x = x; w.y = y; w.z = z; w.t0 = t; w.dur = dur; w.r0 = r0; w.r1 = r1; w.thick = thick; w.rgb = rgb; w.rgb2 = rgb2; w.flat = flat;
        s.waves.add(w);
    }

    /* ------------------------------------ dibujo ------------------------------------ */

    static void render(CineModels.Inst inst, PoseStack poseStack, SubmitNodeCollector collector, CameraRenderState camera) {
        St s = states.computeIfAbsent(inst, k -> new St());
        Matrix4f m = poseStack.last().pose();
        Vector3f c = m.transformPosition(new Vector3f());
        Vector3f ax = m.transformDirection(new Vector3f(1, 0, 0)), az = m.transformDirection(new Vector3f(0, 0, 1));
        float R = ax.length();
        if (R < 1e-4f) R = 1e-4f;
        right = camera.orientation.transform(new Vector3f(1, 0, 0));
        up = camera.orientation.transform(new Vector3f(0, 1, 0));
        fwd = camera.orientation.transform(new Vector3f(0, 0, -1));
        camX = camera.pos.x; camY = camera.pos.y; camZ = camera.pos.z;
        float t = (System.nanoTime() - s.born) / 1e9f;
        float dt = s.last < 0 ? 0 : (float) Math.min(0.1, t - s.last);
        s.last = t;
        if (!inst.animName.equals(s.anim)) {
            s.anim = inst.animName;
            s.animAt = t;
            s.started = false;
        }
        Batch a = new Batch(), b = new Batch(), tx = new Batch();
        A = a; B = b; T = tx;
        double wx = camX + c.x, wy = camY + c.y, wz = camZ + c.z;
        int col = inst.color & 0xffffff;
        float al = ((inst.color >>> 24) & 255) / 255f * inst.fade();
        String model = inst.model;
        Vector3f zAxis = m.transformDirection(new Vector3f(0, 0, 1));
        switch (model) {
            case "fx_azul" -> orb(s, c, wx, wy, wz, R, t, dt, al, col == 0xffffff ? 0x2f7bff : col, 0xbfe6ff, 1.0f, 0.9f, 1);
            case "fx_rojo" -> orb(s, c, wx, wy, wz, R, t, dt, al, col == 0xffffff ? 0xff2a2a : col, 0xffd0a0, 1.4f, 0.9f, 2);
            case "fx_purpura" -> orb(s, c, wx, wy, wz, R, t, dt, al, col == 0xffffff ? 0x9a3cff : col, 0xf0c8ff, 1.2f, 1.0f, 3);
            case "fx_genki" -> orb(s, c, wx, wy, wz, R, t, dt, al, col == 0xffffff ? 0x4fb4ff : col, 0xe8fbff, 0.7f, 1.0f, 4);
            case "fx_onda" -> onda(s, c, wx, wy, wz, R, t, col);
            case "fx_pilar" -> pilar(s, c, wx, wy, wz, R, t, dt, al, col);
            case "fx_cortes" -> cortes(s, c, wx, wy, wz, R, t, dt, col);
            case "fx_brujula" -> brujula(s, c, wx, wy, wz, R, t, dt, al, col);
            case "fx_aura" -> aura(s, c, wx, wy, wz, R, t, dt, al, col);
            case "fx_golpe" -> golpe(s, c, wx, wy, wz, R, t, col);
            case "fx_cometa" -> cometa(s, c, wx, wy, wz, R, t, dt, al, col);
            case "fx_rayos" -> rayos(s, c, R, t, al, col);
            case "fx_sangre" -> orb(s, c, wx, wy, wz, R, t, dt, al, col == 0xffffff ? 0xa0000c : col, 0x140003, 0.9f, 0.5f, 5);
            case "fx_nucleo" -> orb(s, c, wx, wy, wz, R, t, dt, al, col == 0xffffff ? 0xff1a24 : col, 0xffd8d8, 1.6f, 1.0f, 6);
            case "fx_disolver" -> disolver(s, c, wx, wy, wz, R, t, dt, col);
            case "fx_perforante" -> perforante(s, c, zAxis, wx, wy, wz, R, t, dt, al);
            case "fx_laser" -> laser(s, c, zAxis, wx, wy, wz, R, t, dt, al, col == 0xffffff ? 0xff1424 : col);
            case "fx_marca" -> marca(s, c, R, t, al, col == 0xffffff ? 0xff2030 : col);
            case "fx_espacio" -> espacio(s, c, R, t, al);
            case "fx_domo" -> domo(s, c, wx, wy, wz, R, t, dt, al, col == 0xffffff ? 0xff1020 : col);
            default -> bill(a, c.x, c.y, c.z, R, R, 1, 0, al, col, 0xffffff, GLOW, s.seed, 0, 0);
        }
        s.lx = wx; s.ly = wy; s.lz = wz;
        particles(s, dt, wx, wy, wz, R);
        waves(s, t);
        slashes(s, t);
        PoseStack id = new PoseStack();
        if (b.q > 0) collector.submitCustomGeometry(id, alpha(), b::emit);
        if (tx.q > 0) collector.submitCustomGeometry(id, tex(), tx::emit);
        if (a.q > 0) collector.submitCustomGeometry(id, add(), a::emit);
    }

    private static void particles(St s, float dt, double cx, double cy, double cz, float R) {
        for (Iterator<P> it = s.parts.iterator(); it.hasNext(); ) {
            P p = it.next();
            p.age += dt;
            if (p.age >= p.life) { it.remove(); continue; }
            if (p.pull != 0) {
                double dx = cx - p.x, dy = cy - p.y, dz = cz - p.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (p.pull > 0 && d < R * 0.85) { it.remove(); continue; }
                float k = p.pull * dt / (float) Math.max(d, 0.05);
                p.vx += dx * k; p.vy += dy * k; p.vz += dz * k;
            }
            float dr = Math.max(0, 1 - p.drag * dt);
            p.vx *= dr; p.vy = p.vy * dr - p.grav * dt; p.vz *= dr;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            float f = p.age / p.life, al = Math.min(1, f * 8) * (1 - f) * 1.6f;
            float x = (float) (p.x - camX), y = (float) (p.y - camY), z = (float) (p.z - camZ);
            float sp = (float) Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
            if (sp > 1.5f && !p.ink) {
                float k = Math.min(0.09f, 1.2f / sp);
                seg(A, x - p.vx * k, y - p.vy * k, z - p.vz * k, x, y, z, p.size * 0.2f, p.size * 0.45f, 0, 1, 0, Math.min(1, al), p.rgb, p.rgb2, BEAM, 0, 0, 0);
            }
            if (p.ink) bill(B, x, y, z, p.size, p.size, 1, 0, Math.min(1, al * 0.9f), p.rgb, p.rgb2, GLOW, 0, 0, 0);
            else bill(A, x, y, z, p.size, p.size, 1, 0, Math.min(1, al), p.rgb, p.rgb2, GLOW, 0, 0, 0);
        }
    }

    private static void waves(St s, float t) {
        for (Iterator<Wave> it = s.waves.iterator(); it.hasNext(); ) {
            Wave w = it.next();
            float f = (t - w.t0) / w.dur;
            if (f >= 1) { it.remove(); continue; }
            if (f < 0) continue;
            float e = 1 - (1 - f) * (1 - f) * (1 - f);
            float r = (w.r0 + (w.r1 - w.r0) * e) / 0.82f, al = (float) Math.pow(1 - f, 1.4);
            float x = (float) (w.x - camX), y = (float) (w.y - camY), z = (float) (w.z - camZ);
            float th = w.thick * (1 - f * 0.6f);
            if (w.flat) flat(A, x, y, z, r, al, w.rgb, w.rgb2, RING, s.seed, th, 0.5f);
            else bill(A, x, y, z, r, r, 1, 0, al, w.rgb, w.rgb2, RING, s.seed, th, 0.15f);
        }
    }

    private static void slashes(St s, float t) {
        for (Iterator<Slash> it = s.slashes.iterator(); it.hasNext(); ) {
            Slash k = it.next();
            float f = (t - k.t0) / k.life;
            if (f >= 1) { it.remove(); continue; }
            if (f < 0) continue;
            float x = (float) (k.x - camX), y = (float) (k.y - camY), z = (float) (k.z - camZ);
            // Plano del tajo de cara a la cámara: b = u × vista.
            float bx = k.uy * z - k.uz * y, by = k.uz * x - k.ux * z, bz = k.ux * y - k.uy * x;
            float l = (float) Math.sqrt(bx * bx + by * by + bz * bz);
            if (l < 1e-5f) continue;
            bx /= l; by /= l; bz /= l;
            float wipe = Math.min(1, f / 0.22f), al = f < 0.3f ? 1 : (float) Math.pow(1 - (f - 0.3f) / 0.7f, 1.6);
            float wd = k.width * (f < 0.3f ? 1 : 1 - (f - 0.3f) * 0.8f);
            int nseg = 8;
            for (int i = 0; i < nseg; i++) {
                float s0 = -1 + 2f * i / nseg, s1 = -1 + 2f * (i + 1) / nseg;
                float h0 = k.len * 0.5f * s0, h1 = k.len * 0.5f * s1, c0 = (1 - s0 * s0) * k.bend, c1 = (1 - s1 * s1) * k.bend;
                float x0 = x + k.ux * h0 + bx * c0, y0 = y + k.uy * h0 + by * c0, z0 = z + k.uz * h0 + bz * c0;
                float x1 = x + k.ux * h1 + bx * c1, y1 = y + k.uy * h1 + by * c1, z1 = z + k.uz * h1 + bz * c1;
                q[0] = x0 - bx * wd; q[1] = y0 - by * wd; q[2] = z0 - bz * wd;
                q[3] = x1 - bx * wd; q[4] = y1 - by * wd; q[5] = z1 - bz * wd;
                q[6] = x1 + bx * wd; q[7] = y1 + by * wd; q[8] = z1 + bz * wd;
                q[9] = x0 + bx * wd; q[10] = y0 + by * wd; q[11] = z0 + bz * wd;
                if (k.ink) B.quad(q, s0, -1, s1, 1, al * 0.6f, al * 0.6f, al * 0.6f, al * 0.6f, 0x050002, 0x200008, SLASH, k.seed, wipe, 0);
                A.quad(q, s0, -1, s1, 1, al, al, al, al, k.rgb, k.rgb2, SLASH, k.seed, wipe, 1);
            }
        }
    }

    /* ------------------------------------ esferas de energía ------------------------------------ */

    /** kind: 1 azul (atrae), 2 rojo (repele), 3 púrpura (vórtice), 4 genkidama (recoge energía de lejos). */
    private static void orb(St s, Vector3f c, double wx, double wy, double wz, float R, float t, float dt, float al, int rgb, int rgb2, float speed, float core, int kind) {
        float pulse = 1 + 0.03f * (float) Math.sin(t * 11 + s.seed);
        float rr = R * pulse;
        // Resplandor amplio, cuerpo (opaco: se ve también contra el cielo claro) y brillo aditivo encima.
        bill(A, c.x, c.y, c.z, rr * 4.2f, rr * 4.2f, 1, 0, 0.20f * al, rgb, rgb, GLOW, 0, 0, 0);
        bill(B, c.x, c.y, c.z, rr * 2.5f, rr * 2.5f, 2.5f, 0, al, rgb, rgb2, ORB, s.seed, speed, core);
        bill(A, c.x, c.y, c.z, rr * 2.5f, rr * 2.5f, 2.5f, 0, 0.22f * al, rgb, rgb2, ORB, s.seed + 7, speed, core);
        if (kind == 3) {
            // Vórtice doble: restos del rojo y del azul girando en sentidos opuestos alrededor del púrpura.
            bill(A, c.x, c.y, c.z, rr * 3.1f, rr * 3.1f, 1, 0, 0.55f * al, 0xff3050, 0xffc0d0, VORTEX, s.seed, 3, 5.5f);
            bill(A, c.x, c.y, c.z, rr * 3.6f, rr * 3.6f, 1, 0, 0.5f * al, 0x3a6bff, 0xc0d8ff, VORTEX, s.seed + 3, 4, -4.2f);
            bill(A, c.x, c.y, c.z, rr * 1.9f, rr * 1.9f, 1, t * 0.7f, 0.5f * al, 0xe0b0ff, 0xffffff, GLOW, 0, 1, 0);
        }
        // Rayos que recorren la superficie (cambian 14 veces por segundo).
        int arcs = kind == 4 ? 7 : kind == 3 ? 8 : kind == 5 ? 2 : kind == 6 ? 9 : 4;
        Random r = new Random(s.seed * 7919L + (long) (t * 14));
        for (int i = 0; i < arcs; i++) {
            double th = r.nextDouble() * Math.PI * 2, cz = r.nextDouble() * 2 - 1, sq = Math.sqrt(1 - cz * cz);
            float x0 = (float) (Math.cos(th) * sq), y0 = (float) cz, z0 = (float) (Math.sin(th) * sq);
            float x1 = x0 + (r.nextFloat() - 0.5f) * 1.6f, y1 = y0 + (r.nextFloat() - 0.5f) * 1.6f, z1 = z0 + (r.nextFloat() - 0.5f) * 1.6f;
            float l = (float) Math.sqrt(x1 * x1 + y1 * y1 + z1 * z1);
            float out = kind == 3 ? 1.5f + r.nextFloat() * 0.9f : 1.12f + r.nextFloat() * 0.3f;
            x1 = x1 / l * out; y1 = y1 / l * out; z1 = z1 / l * out;
            int arcCol = kind == 5 ? 0xff2a30 : mix(rgb, 0xffffff, 0.35f);
            arc(A, r, c.x + x0 * rr * 1.02f, c.y + y0 * rr * 1.02f, c.z + z0 * rr * 1.02f, c.x + x1 * rr, c.y + y1 * rr, c.z + z1 * rr, rr * 0.16f, Math.max(0.02f, rr * 0.035f), al, arcCol, kind == 5 ? 0xffb0b0 : 0xffffff);
        }
        boolean det = "detonar".equals(s.anim);
        if (det && !s.started) {
            s.started = true;
            burst(s, wx, wy, wz, 420, R * 9 + 14, 1.6f, Math.max(0.12f, R * 0.07f), rgb, 0xffffff);
            for (int i = 0; i < 4; i++) wave(s, wx, wy, wz, t + i * 0.12f, 1.1f + i * 0.2f, R, R * (5 + i * 3) + 12, 0.07f, i % 2 == 0 ? 0xffffff : rgb, 0xffffff, i == 1);
        }
        if (det) return;
        // Partículas propias según el tipo.
        float rate = kind == 4 ? 90 + R * 40 : kind == 3 ? 150 : kind == 5 ? 110 : kind == 6 ? 120 : 70;
        s.emit += rate * dt;
        while (s.emit >= 1) {
            s.emit -= 1;
            double th = s.rnd.nextDouble() * Math.PI * 2, cz = s.rnd.nextDouble() * 2 - 1, sq = Math.sqrt(1 - cz * cz);
            float dx = (float) (Math.cos(th) * sq), dy = (float) cz, dz = (float) (Math.sin(th) * sq);
            if (kind == 5) {
                // Sangre: gotas oscuras que giran y se comprimen hacia el centro.
                float d0 = R * 3.6f + 0.3f;
                float tx = -dz, tz = dx, sp = R * 6 + 1.2f;
                boolean dark = s.rnd.nextInt(3) == 0;
                P p = spawn(s, wx + dx * d0, wy + dy * d0 * 0.7, wz + dz * d0, tx * sp, 0, tz * sp, 0.8f, Math.max(0.025f, R * (dark ? 0.12f : 0.07f)), dark ? 0x2a0004 : 0xd0101c, dark ? 0x000000 : 0xff6060);
                p.ink = dark;
                p.pull = R * 46 + 14;
                p.drag = 2.4f;
                continue;
            }
            if (kind == 6) {
                // Núcleo del cañón: chispas rojas que entran a toda velocidad.
                float d0 = R * 4f + 1;
                P p = spawn(s, wx + dx * d0, wy + dy * d0, wz + dz * d0, 0, 0, 0, 0.6f, Math.max(0.04f, R * 0.06f), rgb, 0xffffff);
                p.pull = R * 80 + 30;
                p.drag = 0.5f;
                continue;
            }
            if (kind == 2) {
                // Rojo: chispas expulsadas hacia fuera.
                float sp = R * 5 + 2;
                P p = spawn(s, wx + dx * R, wy + dy * R, wz + dz * R, dx * sp, dy * sp, dz * sp, 0.35f + s.rnd.nextFloat() * 0.3f, Math.max(0.03f, R * 0.09f), rgb, 0xffe0a0);
                p.drag = 3;
            } else if (kind == 4) {
                // Genkidama: motas de energía que llegan de todas partes (sobre todo de la tierra, abajo).
                if (dy > 0.2f) dy = -dy;
                float d0 = R * 2.2f + 8 + s.rnd.nextFloat() * 30;
                float tx = -dz, tz = dx;
                P p = spawn(s, wx + dx * d0, wy + dy * d0, wz + dz * d0, tx * 5, 0.5f, tz * 5, 3.2f, 0.10f + s.rnd.nextFloat() * 0.16f + R * 0.008f, s.rnd.nextInt(5) == 0 ? 0xfff6c0 : rgb, 0xffffff);
                p.pull = 26 + R * 2.5f;
                p.drag = 1.1f;
            } else {
                // Azul y púrpura: todo cae en espiral hacia dentro.
                float d0 = R * (kind == 3 ? 3.4f : 3.2f) + 0.2f;
                float tx = -dz, tz = dx, sp = R * (kind == 3 ? 7 : 4) + 1;
                P p = spawn(s, wx + dx * d0, wy + dy * d0 * 0.6, wz + dz * d0, tx * sp, 0, tz * sp, 0.9f, Math.max(0.03f, R * (kind == 3 ? 0.07f : 0.08f)), kind == 3 ? (s.rnd.nextBoolean() ? 0xff4060 : 0x4a7bff) : rgb, 0xffffff);
                p.pull = R * 40 + 12;
                p.drag = 2.2f;
            }
        }
        // Estela al viajar.
        if ("viajar".equals(s.anim)) {
            s.trail.addLast(new double[] {wx, wy, wz, t});
            while (s.trail.size() > 2 && t - s.trail.peekFirst()[3] > 0.9f) s.trail.pollFirst();
            double[] prev = null;
            for (double[] p : s.trail) {
                if (prev != null) {
                    float f0 = 1 - (float) (t - prev[3]) / 0.9f, f1 = 1 - (float) (t - p[3]) / 0.9f;
                    seg(A, (float) (prev[0] - camX), (float) (prev[1] - camY), (float) (prev[2] - camZ), (float) (p[0] - camX), (float) (p[1] - camY), (float) (p[2] - camZ),
                            R * 1.5f * f0, R * 1.5f * f1, (float) prev[3] * 3, (float) p[3] * 3, f0 * 0.9f * al, f1 * 0.9f * al, rgb, rgb2, BEAM, s.seed, 0.9f, 3);
                }
                prev = p;
            }
            s.emit2 += dt * 9;
            if (s.emit2 >= 1) {
                s.emit2 -= 1;
                wave(s, wx, wy, wz, t, 0.55f, R * 1.0f, R * 3.2f, 0.06f, mix(rgb, 0xffffff, 0.4f), 0xffffff, false);
            }
        }
    }

    /* ------------------------------------ efectos sueltos ------------------------------------ */

    private static void onda(St s, Vector3f c, double wx, double wy, double wz, float R, float t, int rgb) {
        if (!s.started) {
            s.started = true;
            wave(s, wx, wy + 0.15, wz, t, 0.9f, R * 0.05f, R, 0.07f, rgb, 0xffffff, true);
            wave(s, wx, wy + 0.2, wz, t + 0.1f, 1.1f, R * 0.05f, R * 0.8f, 0.05f, 0xffffff, 0xffffff, true);
            wave(s, wx, wy + 0.5, wz, t, 0.7f, R * 0.05f, R * 0.6f, 0.05f, rgb, 0xffffff, false);
            burst(s, wx, wy + 0.5, wz, 140, R * 1.6f + 6, 1.0f, Math.max(0.08f, R * 0.012f), rgb, 0xffffff);
        }
        float f = t / 0.45f;
        if (f < 1) bill(A, c.x, c.y + 0.5f, c.z, R * 0.9f, R * 0.9f, 1, 0, (1 - f) * (1 - f), mix(rgb, 0xffffff, 0.5f), 0xffffff, GLOW, 0, 1, 0);
    }

    private static void golpe(St s, Vector3f c, double wx, double wy, double wz, float R, float t, int rgb) {
        if (!s.started) {
            s.started = true;
            wave(s, wx, wy, wz, t, 0.4f, R * 0.1f, R * 1.6f, 0.06f, rgb, 0xffffff, false);
            wave(s, wx, wy, wz, t + 0.05f, 0.55f, R * 0.1f, R * 2.4f, 0.04f, 0xffffff, 0xffffff, false);
            burst(s, wx, wy, wz, 46, R * 9 + 5, 0.45f, Math.max(0.05f, R * 0.07f), rgb, 0xffffff);
        }
        float f = t / 0.3f;
        if (f < 1) {
            float k = (1 - f) * (1 - f);
            bill(A, c.x, c.y, c.z, R * 2.6f, R * 2.6f, 1, s.seed, k, rgb, 0xffffff, GLOW, 0, 1, 0);
            bill(A, c.x, c.y, c.z, R * 1.2f, R * 1.2f, 1, 0, k, 0xffffff, 0xffffff, GLOW, 0, 0, 0);
        }
    }

    private static void pilar(St s, Vector3f c, double wx, double wy, double wz, float R, float t, float dt, float al, int rgb) {
        float grow = Math.min(1, t / 0.25f), k = 1 - (1 - grow) * (1 - grow);
        float fade = "fin".equals(s.anim) ? Math.max(0, 1 - (t - s.animAt) / 0.5f) : 1;
        float h = R * 26 * k, w = R * (1.3f - 0.3f * k) * (0.92f + 0.08f * (float) Math.sin(t * 23 + s.seed));
        int nseg = 6;
        for (int i = 0; i < nseg; i++) {
            float f0 = i / (float) nseg, f1 = (i + 1) / (float) nseg;
            float a0 = (1 - f0 * f0) * al * fade, a1 = (1 - f1 * f1) * al * fade;
            seg(A, c.x, c.y + h * f0, c.z, c.x, c.y + h * f1, c.z, w, w, f0 * h * 0.25f, f1 * h * 0.25f, a0, a1, rgb, 0xffffff, BEAM, s.seed, 0.7f, 2.5f);
        }
        bill(A, c.x, c.y + R * 0.3f, c.z, R * 3.2f, R * 3.2f, 1, 0, 0.7f * al * fade, rgb, 0xffffff, GLOW, 0, 0, 0);
        flat(A, c.x, c.y + 0.08f, c.z, R * 2.6f, 0.9f * al * fade, rgb, 0xffffff, RING, s.seed, 0.09f, 1);
        if (!s.started) {
            s.started = true;
            wave(s, wx, wy + 0.1, wz, t, 0.6f, R * 0.2f, R * 5, 0.06f, rgb, 0xffffff, true);
        }
        s.emit += dt * 40 * fade;
        while (s.emit >= 1) {
            s.emit -= 1;
            double th = s.rnd.nextDouble() * Math.PI * 2;
            P p = spawn(s, wx + Math.cos(th) * R * 1.3, wy + s.rnd.nextDouble() * 2, wz + Math.sin(th) * R * 1.3, 0, 6 + s.rnd.nextFloat() * 8, 0, 0.8f, Math.max(0.05f, R * 0.12f), rgb, 0xffffff);
            p.drag = 0.2f;
        }
    }

    private static void aura(St s, Vector3f c, double wx, double wy, double wz, float R, float t, float dt, float al, int rgb) {
        // Llamas en dos capas que miran a la cámara girando solo en vertical.
        float hx = right.x, hz = right.z, l = (float) Math.sqrt(hx * hx + hz * hz);
        if (l < 1e-4f) { hx = 1; hz = 0; l = 1; }
        hx /= l; hz /= l;
        for (int k = 0; k < 2; k++) {
            float w = R * (k == 0 ? 0.62f : 0.9f), h = R * (k == 0 ? 1.45f : 1.9f), a = (k == 0 ? 0.8f : 0.45f) * al;
            float y0 = c.y - R * 0.06f;
            q[0] = c.x - hx * w; q[1] = y0; q[2] = c.z - hz * w;
            q[3] = c.x + hx * w; q[4] = y0; q[5] = c.z + hz * w;
            q[6] = c.x + hx * w; q[7] = y0 + h; q[8] = c.z + hz * w;
            q[9] = c.x - hx * w; q[10] = y0 + h; q[11] = c.z - hz * w;
            A.quad(q, -1, 0, 1, 1, a, a, a, a, rgb, mix(rgb, 0xffffff, 0.7f), FLAME, s.seed + k * 31, 0, 0);
        }
        bill(A, c.x, c.y + R * 0.45f, c.z, R * 1.3f, R * 1.3f, 1, 0, 0.16f * al, rgb, rgb, GLOW, 0, 0, 0);
        s.emit += dt * 30 * al;
        while (s.emit >= 1) {
            s.emit -= 1;
            double th = s.rnd.nextDouble() * Math.PI * 2, d = R * (0.2 + s.rnd.nextDouble() * 0.45);
            P p = spawn(s, wx + Math.cos(th) * d, wy + s.rnd.nextDouble() * R * 0.4, wz + Math.sin(th) * d, 0, R * (1.5f + s.rnd.nextFloat() * 2), 0, 0.7f, R * 0.035f, mix(rgb, 0xffffff, 0.4f), 0xffffff);
            p.drag = 0.3f;
        }
    }

    private static void cometa(St s, Vector3f c, double wx, double wy, double wz, float R, float t, float dt, float al, int rgb) {
        s.trail.addLast(new double[] {wx, wy, wz, t});
        while (s.trail.size() > 2 && t - s.trail.peekFirst()[3] > 0.35f) s.trail.pollFirst();
        double[] prev = null;
        for (double[] p : s.trail) {
            if (prev != null) {
                float f0 = 1 - (float) (t - prev[3]) / 0.35f, f1 = 1 - (float) (t - p[3]) / 0.35f;
                seg(A, (float) (prev[0] - camX), (float) (prev[1] - camY), (float) (prev[2] - camZ), (float) (p[0] - camX), (float) (p[1] - camY), (float) (p[2] - camZ),
                        R * f0, R * f1, (float) prev[3] * 5, (float) p[3] * 5, f0 * al, f1 * al, rgb, 0xffffff, BEAM, s.seed, 0.8f, 4);
            }
            prev = p;
        }
        bill(A, c.x, c.y, c.z, R * 2.4f, R * 2.4f, 1, t * 3, al, rgb, 0xffffff, GLOW, 0, 1, 0);
        bill(A, c.x, c.y, c.z, R * 1.1f, R * 1.1f, 1, 0, al, 0xffffff, 0xffffff, GLOW, 0, 0, 0);
        s.emit += dt * 60;
        while (s.emit >= 1) {
            s.emit -= 1;
            P p = spawn(s, wx, wy, wz, (s.rnd.nextFloat() - 0.5f) * 4, (s.rnd.nextFloat() - 0.5f) * 4, (s.rnd.nextFloat() - 0.5f) * 4, 0.4f, R * 0.25f, rgb, 0xffffff);
            p.drag = 2;
        }
    }

    private static void rayos(St s, Vector3f c, float R, float t, float al, int rgb) {
        Random r = new Random(s.seed * 31L + (long) (t * 16));
        for (int i = 0; i < 7; i++) {
            float x0 = (r.nextFloat() - 0.5f) * 2 * R, y0 = (r.nextFloat() - 0.2f) * R, z0 = (r.nextFloat() - 0.5f) * 2 * R;
            float x1 = (r.nextFloat() - 0.5f) * 2 * R, y1 = (r.nextFloat() - 0.2f) * R, z1 = (r.nextFloat() - 0.5f) * 2 * R;
            arc(A, r, c.x + x0, c.y + y0, c.z + z0, c.x + x1, c.y + y1, c.z + z1, R * 0.18f, Math.max(0.03f, R * 0.02f), al, mix(rgb, 0xffffff, 0.3f), 0xffffff);
        }
    }


    /* ------------------------------------ v5: disolver, sangre perforante, ataque orbital ------------------------------------ */

    /** Personaje que se deshace en partículas de su color (de abajo arriba) con un destello en los pies. R = escala del personaje. */
    private static void disolver(St s, Vector3f c, double wx, double wy, double wz, float R, float t, float dt, int rgb) {
        float h = 2f * R;
        if (!s.started) {
            s.started = true;
            wave(s, wx, wy + 0.08, wz, t, 0.9f, 0.2f, R * 2.6f, 0.06f, rgb, 0xffffff, true);
        }
        float f = t / 1.4f;
        if (f < 1) {
            // Columna de luz que sube y se apaga.
            float a = (float) Math.sin(Math.min(1, f) * Math.PI) * 0.55f;
            seg(A, c.x, c.y, c.z, c.x, c.y + h * 1.4f, c.z, R * 0.55f, R * 0.15f, 0, 2, a, 0, rgb, 0xffffff, BEAM, s.seed, 0.6f, 2);
            bill(A, c.x, c.y + h * 0.5f, c.z, R * 1.5f, h * 0.9f, 1, 0, a * 0.5f, rgb, rgb, GLOW, 0, 0, 0);
            s.emit += dt * 260 * (1 - f);
            while (s.emit >= 1) {
                s.emit -= 1;
                double th = s.rnd.nextDouble() * Math.PI * 2, rr = R * (0.15 + s.rnd.nextDouble() * 0.3);
                // El frente de disolución baja de la cabeza a los pies.
                double y = wy + h * Math.max(0, 1 - f * 1.1 - s.rnd.nextDouble() * 0.25);
                float sw = (s.rnd.nextFloat() - 0.5f) * 2;
                P p = spawn(s, wx + Math.cos(th) * rr, y, wz + Math.sin(th) * rr, (float) -Math.sin(th) * sw * 1.5f, 0.8f + s.rnd.nextFloat() * 2.4f, (float) Math.cos(th) * sw * 1.5f,
                        0.9f + s.rnd.nextFloat() * 0.8f, R * (0.03f + s.rnd.nextFloat() * 0.05f), s.rnd.nextInt(4) == 0 ? 0xffffff : rgb, 0xffffff);
                p.drag = 0.8f;
                p.grav = -0.6f;
            }
        }
    }

    /** Base ortonormal perpendicular a d (para anillos «de frente» a lo largo de un haz). */
    private static Vector3f[] perp(Vector3f d) {
        Vector3f a = Math.abs(d.y) < 0.9f ? new Vector3f(0, 1, 0) : new Vector3f(1, 0, 0);
        Vector3f u = new Vector3f(d).cross(a).normalize();
        Vector3f v = new Vector3f(d).cross(u).normalize();
        return new Vector3f[] {u, v};
    }

    /** Anillo perpendicular a una dirección (onda de choque alrededor de un haz). */
    private static void ringAround(Batch b, float x, float y, float z, Vector3f[] uv, float r, float al, int rgb, int rgb2, int seed, float thick) {
        Vector3f u = uv[0], v = uv[1];
        q[0] = x - u.x * r - v.x * r; q[1] = y - u.y * r - v.y * r; q[2] = z - u.z * r - v.z * r;
        q[3] = x + u.x * r - v.x * r; q[4] = y + u.y * r - v.y * r; q[5] = z + u.z * r - v.z * r;
        q[6] = x + u.x * r + v.x * r; q[7] = y + u.y * r + v.y * r; q[8] = z + u.z * r + v.z * r;
        q[9] = x - u.x * r + v.x * r; q[10] = y - u.y * r + v.y * r; q[11] = z - u.z * r + v.z * r;
        b.quad(q, -1, -1, 1, 1, al, al, al, al, rgb, rgb2, RING, seed, thick, 0);
    }

    /**
     * Sangre Perforante: lanza de sangre comprimida. El eje Z del display (dirección y longitud) marca el recorrido;
     * su escala X, el grosor. Con «disparar» la punta avanza a 90 bloques/s; luego se queda un instante y se apaga.
     */
    private static void perforante(St s, Vector3f c, Vector3f z, double wx, double wy, double wz, float W, float t, float dt, float al) {
        float L = z.length();
        if (L < 0.01f || !("disparar".equals(s.anim))) return;
        Vector3f d = new Vector3f(z).div(L);
        float ta = t - s.animAt, travel = L / 90f;
        float head = Math.min(L, ta * 90f);
        float fade = ta < travel + 0.45f ? 1f : Math.max(0, 1 - (ta - travel - 0.45f) / 0.5f);
        if (fade <= 0) return;
        float a = al * fade, w = W * (0.6f + 0.4f * fade);
        float hx = c.x + d.x * head, hy = c.y + d.y * head, hz = c.z + d.z * head;
        // Vaina oscura, resplandor rojo y núcleo casi blanco.
        seg(B, c.x, c.y, c.z, hx, hy, hz, w * 2.4f, w * 2.0f, 0, head * 0.3f, a * 0.9f, a * 0.9f, 0x1a0003, 0x3a0006, BEAM, s.seed, 0.5f, 7);
        seg(A, c.x, c.y, c.z, hx, hy, hz, w * 3.4f, w * 2.8f, 0, head * 0.3f, a * 0.85f, a, 0xff0a1a, 0xff8080, BEAM, s.seed, 0.7f, 9);
        seg(A, c.x, c.y, c.z, hx, hy, hz, w * 0.9f, w * 0.7f, 0, head * 0.3f, a, a, 0xffd0d0, 0xffffff, BEAM, s.seed + 3, 0.2f, 12);
        Vector3f[] uv = perp(d);
        // Conos de choque que quedan atrás de la punta.
        for (float k = 2.5f; k < head; k += 3f) {
            float since = (head - k) / 90f;
            if (since > 0.4f) continue;
            float f = since / 0.4f;
            ringAround(A, c.x + d.x * k, c.y + d.y * k, c.z + d.z * k, uv, w * (2 + f * 10), (1 - f) * a * 0.8f, 0xff2030, 0xffffff, s.seed, 0.06f);
        }
        if (head < L) {
            bill(A, hx, hy, hz, w * 9, w * 9, 1, 0, a, 0xff2030, 0xffffff, GLOW, 0, 1, 0);
            ringAround(A, hx, hy, hz, uv, w * 5, a, 0xff4050, 0xffffff, s.seed, 0.08f);
        }
        bill(A, c.x, c.y, c.z, w * 6, w * 6, 1, t * 4, a * 0.9f, 0xff2030, 0xffffff, GLOW, 0, 1, 0);
        // Gotas que salen despedidas a los lados de la punta.
        s.emit += dt * (head < L ? 220 : 40) * fade;
        while (s.emit >= 1) {
            s.emit -= 1;
            float k = head * s.rnd.nextFloat();
            double px = wx + d.x * k, py = wy + d.y * k, pz = wz + d.z * k;
            float ang = s.rnd.nextFloat() * 6.283f, sp = 2 + s.rnd.nextFloat() * 7;
            float vx = (uv[0].x * (float) Math.cos(ang) + uv[1].x * (float) Math.sin(ang)) * sp + d.x * 3;
            float vy = (uv[0].y * (float) Math.cos(ang) + uv[1].y * (float) Math.sin(ang)) * sp + d.y * 3;
            float vz = (uv[0].z * (float) Math.cos(ang) + uv[1].z * (float) Math.sin(ang)) * sp + d.z * 3;
            boolean dark = s.rnd.nextBoolean();
            P p = spawn(s, px, py, pz, vx, vy, vz, 0.5f + s.rnd.nextFloat() * 0.5f, 0.05f + s.rnd.nextFloat() * 0.08f, dark ? 0x30000a : 0xe0101c, 0xff7070);
            p.ink = dark;
            p.drag = 2.5f;
            p.grav = 9;
        }
    }

    /** Láser orbital: columna de energía de la boca del cañón al suelo. «fino» → «ancho» → «fin». */
    private static void laser(St s, Vector3f c, Vector3f z, double wx, double wy, double wz, float W, float t, float dt, float al, int rgb) {
        float L = z.length();
        if (L < 0.01f) return;
        Vector3f d = new Vector3f(z).div(L);
        float ta = t - s.animAt;
        float width, a = al;
        switch (s.anim == null ? "" : s.anim) {
            case "ancho" -> width = W * (0.08f + 0.92f * (1 - (float) Math.pow(1 - Math.min(1, ta / 0.45f), 3)));
            case "fin" -> {
                width = W * Math.max(0.02f, 1 - ta / 1.2f);
                a *= Math.max(0, 1 - ta / 1.4f);
            }
            default -> width = W * 0.08f;
        }
        if (a <= 0.01f) return;
        width *= 0.94f + 0.06f * (float) Math.sin(t * 40);
        // Tramos de 24 bloques (la perspectiva de cintas muy largas se deforma).
        int nseg = Math.max(1, (int) Math.ceil(L / 24f));
        for (int i = 0; i < nseg; i++) {
            float k0 = L * i / nseg, k1 = L * (i + 1) / nseg;
            float x0 = c.x + d.x * k0, y0 = c.y + d.y * k0, z0 = c.z + d.z * k0, x1 = c.x + d.x * k1, y1 = c.y + d.y * k1, z1 = c.z + d.z * k1;
            seg(A, x0, y0, z0, x1, y1, z1, width * 2.6f, width * 2.6f, k0 * 0.05f, k1 * 0.05f, a * 0.55f, a * 0.55f, rgb, 0xff9090, BEAM, s.seed, 0.9f, 3);
            seg(A, x0, y0, z0, x1, y1, z1, width * 1.2f, width * 1.2f, k0 * 0.08f, k1 * 0.08f, a, a, rgb, 0xffffff, BEAM, s.seed + 5, 0.4f, 6);
            seg(A, x0, y0, z0, x1, y1, z1, width * 0.45f, width * 0.45f, k0 * 0.1f, k1 * 0.1f, a, a, 0xffe8e8, 0xffffff, BEAM, s.seed + 9, 0.1f, 9);
        }
        // Impacto: destello en cruz, anillos en el suelo y brasas.
        float ex = c.x + d.x * L, ey = c.y + d.y * L, ez = c.z + d.z * L;
        double gx = wx + d.x * L, gy = wy + d.y * L, gz = wz + d.z * L;
        bill(A, ex, ey + 0.3f, ez, width * 7 + 2, width * 7 + 2, 1, 0, a, rgb, 0xffffff, GLOW, 0, 1.4f, 0);
        bill(A, ex, ey + 0.3f, ez, width * 2.5f + 0.6f, width * 2.5f + 0.6f, 1, 0, a, 0xffffff, 0xffffff, GLOW, 0, 0, 0);
        flat(A, ex, ey + 0.1f, ez, width * 4 + 1, a * 0.9f, rgb, 0xffffff, RING, s.seed, 0.12f, 0.8f);
        s.emit2 += dt * ("ancho".equals(s.anim) ? 6 : 2.5f);
        if (s.emit2 >= 1) {
            s.emit2 -= 1;
            wave(s, gx, gy + 0.2, gz, t, 0.7f, width, width * 6 + 6, 0.05f, rgb, 0xffffff, true);
        }
        s.emit += dt * ("ancho".equals(s.anim) ? 260 : 40) * a;
        while (s.emit >= 1) {
            s.emit -= 1;
            double th = s.rnd.nextDouble() * Math.PI * 2;
            float sp = 6 + s.rnd.nextFloat() * 22;
            P p = spawn(s, gx + Math.cos(th) * width, gy + 0.3, gz + Math.sin(th) * width, (float) Math.cos(th) * sp, 4 + s.rnd.nextFloat() * 16, (float) Math.sin(th) * sp,
                    0.6f + s.rnd.nextFloat() * 0.8f, 0.1f + s.rnd.nextFloat() * 0.25f, s.rnd.nextInt(3) == 0 ? 0xffd0a0 : rgb, 0xffffff);
            p.drag = 1.2f;
            p.grav = 14;
        }
    }

    /** Marca de objetivo: rayo rojo finísimo desde el cielo y retícula giratoria en el suelo. */
    private static void marca(St s, Vector3f c, float R, float t, float al, int rgb) {
        float pulse = 0.75f + 0.25f * (float) Math.sin(t * 9);
        float a = al * Math.min(1, t / 0.3f);
        seg(A, c.x, c.y + 220, c.z, c.x, c.y, c.z, 0.05f * R, 0.05f * R, 0, 20, a * pulse, a, rgb, 0xffffff, BEAM, s.seed, 0.1f, 5);
        seg(A, c.x, c.y + 220, c.z, c.x, c.y, c.z, 0.35f * R, 0.35f * R, 0, 20, a * 0.25f, a * 0.35f, rgb, rgb, BEAM, s.seed, 0.3f, 2);
        bill(A, c.x, c.y + 0.4f, c.z, R * 1.6f, R * 1.6f, 1, 0, a * pulse, rgb, 0xffffff, GLOW, 0, 1.2f, 0);
        // Retícula: dos anillos que giran y se cierran sobre el objetivo.
        float close = Math.max(1, 3.2f - t * 1.6f);
        flat(A, c.x, c.y + 0.06f, c.z, R * 1.9f * close, a, rgb, 0xffffff, RING, s.seed, 0.05f, 0);
        flat(A, c.x, c.y + 0.07f, c.z, R * 1.15f * close, a * pulse, rgb, 0xffffff, RING, s.seed + 1, 0.09f, 0);
        for (int k = 0; k < 4; k++) {
            double ang = t * 1.5 + k * Math.PI / 2;
            float r0 = R * 0.9f * close, r1 = R * 2.3f * close;
            float x0 = c.x + (float) Math.cos(ang) * r0, z0 = c.z + (float) Math.sin(ang) * r0, x1 = c.x + (float) Math.cos(ang) * r1, z1 = c.z + (float) Math.sin(ang) * r1;
            seg(A, x0, c.y + 0.08f, z0, x1, c.y + 0.08f, z1, 0.06f * R, 0.06f * R, 0, 1, a, a, rgb, 0xffffff, BEAM, s.seed, 0, 0);
        }
    }

    /** Fondo del espacio alrededor de la cámara: caja de estrellas fija en el mundo y un planeta debajo. */
    private static void espacio(St s, Vector3f c, float R, float t, float al) {
        float H = 190;
        float[][] faces = {
            {1, 0, 0, 0, 0, 1, 0, 1, 0}, {-1, 0, 0, 0, 0, -1, 0, 1, 0}, {0, 0, 1, -1, 0, 0, 0, 1, 0},
            {0, 0, -1, 1, 0, 0, 0, 1, 0}, {0, 1, 0, 1, 0, 0, 0, 0, 1}, {0, -1, 0, 1, 0, 0, 0, 0, -1}};
        for (int f = 0; f < 6; f++) {
            float[] F = faces[f];
            float nx = F[0] * H, ny = F[1] * H, nz = F[2] * H;
            float ux = F[3] * H, uy = F[4] * H, uz = F[5] * H, vx = F[6] * H, vy = F[7] * H, vz = F[8] * H;
            q[0] = nx - ux - vx; q[1] = ny - uy - vy; q[2] = nz - uz - vz;
            q[3] = nx + ux - vx; q[4] = ny + uy - vy; q[5] = nz + uz - vz;
            q[6] = nx + ux + vx; q[7] = ny + uy + vy; q[8] = nz + uz + vz;
            q[9] = nx - ux + vx; q[10] = ny - uy + vy; q[11] = nz - uz + vz;
            B.quad(q, -1, -1, 1, 1, al, al, al, al, 0xffffff, 0x9fb8ff, STARS, f * 97 + 13, 0, 0);
        }
        // Planeta: su centro está bajo el display (fijo en el mundo), a 120 bloques.
        float PR = 92f * R;
        bill(B, c.x, c.y - 120f * R, c.z, PR * 1.12f, PR * 1.12f, 1.12f, 0, al, 0x2a6ad8, 0x9fd8ff, PLANET, s.seed, 0, 0);
        // Brillo de la atmósfera por encima.
        bill(A, c.x, c.y - 120f * R, c.z, PR * 1.18f, PR * 1.18f, 1.18f, 0, al * 0.8f, 0x4a9aff, 0xd0f0ff, PLANET, s.seed + 1, 1, 0);
    }

    /** Cúpula roja de la explosión del láser: crece con la escala del display y se apaga con «fin». */
    private static void domo(St s, Vector3f c, double wx, double wy, double wz, float R, float t, float dt, float al, int rgb) {
        float a = al * ("fin".equals(s.anim) ? Math.max(0, 1 - (t - s.animAt) / 1.2f) : 1);
        if (a <= 0.01f) return;
        bill(B, c.x, c.y, c.z, R * 1.15f, R * 1.15f, 1.15f, 0, a * 0.85f, rgb, 0x200000, DOME, s.seed, 0, 0);
        bill(A, c.x, c.y, c.z, R * 1.15f, R * 1.15f, 1.15f, 0, a * 0.7f, rgb, 0xffd0c0, DOME, s.seed, 1, 0);
        if (!s.started) {
            s.started = true;
            burst(s, wx, wy, wz, 500, 60, 2.2f, 0.5f, rgb, 0xffffff);
        }
    }

    /* ------------------------------------ tajos ------------------------------------ */

    private static Slash slash(St s, double x, double y, double z, float ux, float uy, float uz, float len, float width, float bend, float t0, float life, int rgb) {
        Slash k = new Slash();
        float l = (float) Math.sqrt(ux * ux + uy * uy + uz * uz);
        k.x = x; k.y = y; k.z = z; k.ux = ux / l; k.uy = uy / l; k.uz = uz / l; k.len = len; k.width = width; k.bend = bend; k.t0 = t0; k.life = life;
        k.rgb = rgb; k.rgb2 = 0xffffff; k.seed = s.rnd.nextInt(1000); k.ink = true;
        s.slashes.add(k);
        return k;
    }

    private static void cortes(St s, Vector3f c, double wx, double wy, double wz, float R, float t, float dt, int rgb) {
        if (rgb == 0xffffff) rgb = 0xff1a2a;
        if ("cortar".equals(s.anim)) {
            // La cadencia sube con el tiempo (acompaña al crescendo del audio).
            float ramp = Math.min(1, (t - s.animAt) / 4f);
            s.emit += dt * (40 + 80 * ramp);
            while (s.emit >= 1 && s.slashes.size() < 140) {
                s.emit -= 1;
                double th = s.rnd.nextDouble() * Math.PI * 2, cz = s.rnd.nextDouble() * 2 - 1, sq = Math.sqrt(1 - cz * cz), d = Math.cbrt(s.rnd.nextDouble()) * R * 0.85;
                double x = wx + Math.cos(th) * sq * d, y = wy + Math.abs(cz) * d * 0.7, z = wz + Math.sin(th) * sq * d;
                float ux = (float) s.rnd.nextGaussian(), uy = (float) s.rnd.nextGaussian() * 0.8f, uz = (float) s.rnd.nextGaussian();
                float len = (2.5f + s.rnd.nextFloat() * 7.5f) * Math.max(0.6f, R / 10f);
                boolean white = s.rnd.nextInt(3) == 0;
                slash(s, x, y, z, ux, uy, uz, len, len * 0.11f, (s.rnd.nextFloat() - 0.5f) * len * 0.35f, t, 0.22f + s.rnd.nextFloat() * 0.2f, white ? 0xffe8e8 : rgb);
                if (s.rnd.nextInt(3) == 0) burst(s, x, y, z, 5, 9, 0.35f, 0.07f, 0xff4040, 0xffffff);
            }
            // Pulso carmesí en el centro del dominio.
            bill(A, c.x, c.y + 1, c.z, R * 1.6f, R * 1.6f, 1, 0, 0.10f + 0.05f * (float) Math.sin(t * 20), 0xff0010, 0xff6060, GLOW, 0, 0, 0);
        } else if ("cruz".equals(s.anim)) {
            if (!s.started) {
                s.started = true;
                // Cruz gigante de cara a la cámara + onda y chispas.
                slash(s, wx, wy + 1, wz, right.x + up.x, right.y + up.y, right.z + up.z, R * 3.4f, R * 0.20f, 0, t, 1.5f, 0xff1020);
                slash(s, wx, wy + 1, wz, right.x - up.x, right.y - up.y, right.z - up.z, R * 3.4f, R * 0.20f, 0, t + 0.12f, 1.5f, 0xffffff);
                for (int i = 0; i < 3; i++) wave(s, wx, wy + 1, wz, t + 0.15f + i * 0.1f, 0.9f, 1, R * (1.6f + i * 0.9f), 0.05f, i == 1 ? 0xffffff : 0xff2030, 0xffffff, i == 2);
                burst(s, wx, wy + 1, wz, 300, R * 2.2f + 8, 1.1f, 0.12f, 0xff3040, 0xffffff);
            }
            float f = (t - s.animAt) / 0.6f;
            if (f < 1) bill(A, c.x, c.y + 1, c.z, R * 2.5f, R * 2.5f, 1, 0, (1 - f) * (1 - f), 0xff4050, 0xffffff, GLOW, 0, 1, 0);
        }
    }

    /* ------------------------------------ brújula (calco sobre el terreno) ------------------------------------ */

    private static void brujula(St s, Vector3f c, double wx, double wy, double wz, float R, float t, float dt, float al, int rgb) {
        Level level = Minecraft.getInstance().level;
        if (level == null) return;
        int rad = (int) Math.ceil(R) + 1, bx = (int) Math.floor(wx), by = (int) Math.floor(wy), bz = (int) Math.floor(wz), side = rad * 2 + 1;
        if (s.heights == null || s.hr != rad || s.hx != bx || s.hz != bz || t - s.heightsAt > 0.3f) {
            // Altura de la cara superior de cada columna (en 1/16 de bloque respecto a la base); se refresca porque el terreno cambia.
            int[] h = new int[side * side];
            BlockPos.MutableBlockPos pos = new BlockPos.MutableBlockPos();
            for (int dz = -rad; dz <= rad; dz++)
                for (int dx = -rad; dx <= rad; dx++) {
                    int v = Integer.MIN_VALUE;
                    for (int dy = 5; dy >= -8; dy--) {
                        pos.set(bx + dx, by + dy, bz + dz);
                        VoxelShape sh = level.getBlockState(pos).getCollisionShape(level, pos);
                        if (!sh.isEmpty()) {
                            v = dy * 16 + (int) Math.round(sh.max(net.minecraft.core.Direction.Axis.Y) * 16);
                            break;
                        }
                    }
                    h[(dz + rad) * side + dx + rad] = v;
                }
            s.heights = h; s.hr = rad; s.hx = bx; s.hz = bz; s.heightsAt = t;
        }
        float ta = t - s.animAt;
        float reveal = "trazar".equals(s.anim) ? Math.min(1.5f, ta / 1.3f * 1.5f) : 1.5f;
        float fade = "desvanecer".equals(s.anim) ? Math.max(0, 1 - ta / 1.2f) : 1;
        float hit = "golpe".equals(s.anim) ? Math.max(0, 1 - ta / 0.5f) : 0;
        float a = al * fade * (1 + hit);
        float inv = 1 / (2 * R);
        for (int dz = -rad; dz <= rad; dz++)
            for (int dx = -rad; dx <= rad; dx++) {
                int v = s.heights[(dz + rad) * side + dx + rad];
                if (v == Integer.MIN_VALUE) continue;
                float x0 = (float) (bx + dx - camX), z0 = (float) (bz + dz - camZ), y = (float) (by + v / 16.0 + 0.035 - camY);
                float u0 = (float) (bx + dx - wx) * inv + 0.5f, v0 = (float) (bz + dz - wz) * inv + 0.5f, u1 = u0 + inv, v1 = v0 + inv;
                if (u1 <= 0 || v1 <= 0 || u0 >= 1 || v0 >= 1) continue;
                float cx0 = Math.max(0, u0), cz0 = Math.max(0, v0), cx1 = Math.min(1, u1), cz1 = Math.min(1, v1);
                float px0 = x0 + (cx0 - u0) / inv, pz0 = z0 + (cz0 - v0) / inv, px1 = x0 + 1 - (u1 - cx1) / inv, pz1 = z0 + 1 - (v1 - cz1) / inv;
                q[0] = px0; q[1] = y; q[2] = pz0;
                q[3] = px1; q[4] = y; q[5] = pz0;
                q[6] = px1; q[7] = y; q[8] = pz1;
                q[9] = px0; q[10] = y; q[11] = pz1;
                T.quad(q, cx0, cz0, cx1, cz1, a, a, a, a, rgb, 0xffffff, 0, s.seed, reveal, 1);
            }
        // Luz que sube del dibujo y motas que flotan.
        bill(A, c.x, c.y + 0.6f, c.z, R * 1.3f, R * 0.5f, 1, 0, 0.16f * a * Math.min(1, reveal), rgb, 0xffffff, GLOW, 0, 0, 0);
        if (hit > 0 && !s.started) {
            s.started = true;
            wave(s, wx, wy + 0.2, wz, t, 0.8f, 1, R * 1.3f, 0.06f, rgb, 0xffffff, true);
        }
        s.emit += dt * 46 * fade * Math.min(1, reveal);
        while (s.emit >= 1) {
            s.emit -= 1;
            double th = s.rnd.nextDouble() * Math.PI * 2, d = Math.sqrt(s.rnd.nextDouble()) * R;
            P p = spawn(s, wx + Math.cos(th) * d, wy + 0.1, wz + Math.sin(th) * d, 0, 0.8f + s.rnd.nextFloat() * 2.2f, 0, 1.4f, 0.06f + s.rnd.nextFloat() * 0.07f, rgb, 0xffffff);
            p.drag = 0.1f;
        }
    }
}
