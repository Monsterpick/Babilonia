package dev.livearena.plugin;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.bukkit.Location;
import org.bukkit.entity.Player;

/**
 * Mensajes del plugin al mod cliente «LiveArena Cinemáticas» (NeoForge) por el canal livearena:cine.
 * Si el jugador no tiene el mod, no se envía nada y solo ve los efectos de servidor (partículas y displays).
 * Formato: big-endian (DataOutputStream). El mod lo lee igual.
 */
final class CineNet {
    static final String CHANNEL = "livearena:cine";

    static final byte SHOT = 1, END = 2, SHAKE = 3, SCREEN = 4, SKY = 5, KEEPALIVE = 6, CAPTION = 7, MODEL = 8, MODEL_ANIM = 9, MODEL_REMOVE = 10, MODEL_ATTACH = 11, SUBTITLE = 12;

    /** Curvas de interpolación de la cámara (mismos valores en el mod). */
    static final byte LINEAR = 0, EASE_IN_OUT = 1, EASE_IN_EXPO = 2, EASE_OUT_EXPO = 3, CUT = 4;

    /** Efectos de pantalla. */
    static final byte FLASH = 0, VIGNETTE = 1, TINT = 2, LETTERBOX = 3, SLASHES = 4;

    /** Cielos. */
    static final byte SKY_NORMAL = 0, SKY_SPACE = 1, SKY_STORM = 2, SKY_TINT = 3;

    private final LiveArenaPlugin plugin;

    CineNet(LiveArenaPlugin plugin) {
        this.plugin = plugin;
    }

    void register() {
        plugin.getServer().getMessenger().registerOutgoingPluginChannel(plugin, CHANNEL);
    }

    static boolean hasMod(Player p) {
        return p != null && p.isOnline() && p.getListeningPluginChannels().contains(CHANNEL);
    }

    void send(Player p, byte[] data) {
        if (hasMod(p)) p.sendPluginMessage(plugin, CHANNEL, data);
    }

    /** Pequeño escritor de mensajes. */
    static final class Msg {
        private final ByteArrayOutputStream bytes = new ByteArrayOutputStream(64);
        private final DataOutputStream out = new DataOutputStream(bytes);

        Msg(byte type) {
            b(type);
        }

        Msg b(int v) {
            try {
                out.writeByte(v);
            } catch (IOException e) {
                throw new IllegalStateException(e);
            }
            return this;
        }

        Msg i(int v) {
            try {
                out.writeInt(v);
            } catch (IOException e) {
                throw new IllegalStateException(e);
            }
            return this;
        }

        Msg f(double v) {
            try {
                out.writeFloat((float) v);
            } catch (IOException e) {
                throw new IllegalStateException(e);
            }
            return this;
        }

        Msg d(double v) {
            try {
                out.writeDouble(v);
            } catch (IOException e) {
                throw new IllegalStateException(e);
            }
            return this;
        }

        Msg s(String v) {
            try {
                out.writeUTF(v == null ? "" : v);
            } catch (IOException e) {
                throw new IllegalStateException(e);
            }
            return this;
        }

        byte[] bytes() {
            return bytes.toByteArray();
        }
    }

    /* ------------------------------------ cámara ------------------------------------ */

    /** Un fotograma clave de cámara: posición, punto al que mira, giro (roll), FOV y curva para llegar a él. */
    record Key(int tick, double x, double y, double z, double lx, double ly, double lz, float roll, float fov, byte curve) {}

    /**
     * Un plano de cámara: lista de fotogramas clave con ticks relativos a su inicio.
     * posEntity: si ≥ 0, las posiciones son relativas a esa entidad (la cámara la sigue).
     * lookEntity: si ≥ 0, la cámara mira a esa entidad (se ignora el punto de mirada).
     */
    static final class Shot {
        final List<Key> keys = new ArrayList<>();
        int posEntity = -1;
        int lookEntity = -1;

        Shot key(int tick, Location pos, Location look, float roll, float fov, byte curve) {
            keys.add(new Key(tick, pos.getX(), pos.getY(), pos.getZ(), look.getX(), look.getY(), look.getZ(), roll, fov, curve));
            return this;
        }

        Shot key(int tick, Location pos, Location look, float fov, byte curve) {
            return key(tick, pos, look, 0f, fov, curve);
        }

        Shot followPos(int entityId) {
            posEntity = entityId;
            return this;
        }

        Shot followLook(int entityId) {
            lookEntity = entityId;
            return this;
        }

        byte[] encode() {
            Msg m = new Msg(SHOT).i(posEntity).i(lookEntity).i(keys.size());
            for (Key k : keys) m.i(k.tick()).d(k.x()).d(k.y()).d(k.z()).d(k.lx()).d(k.ly()).d(k.lz()).f(k.roll()).f(k.fov()).b(k.curve());
            return m.bytes();
        }
    }

    static byte[] end() {
        return new Msg(END).bytes();
    }

    static byte[] keepAlive() {
        return new Msg(KEEPALIVE).bytes();
    }

    static byte[] shake(double intensity, int ticks, double decay) {
        return new Msg(SHAKE).f(intensity).i(ticks).f(decay).bytes();
    }

    static byte[] screen(byte kind, int argb, int in, int hold, int out) {
        return new Msg(SCREEN).b(kind).i(argb).i(in).i(hold).i(out).bytes();
    }

    static byte[] sky(byte mode, int rgb, int ticks) {
        return new Msg(SKY).b(mode).i(rgb).i(ticks).bytes();
    }

    static byte[] caption(String title, String sub, int rgb, int ticks) {
        return new Msg(CAPTION).s(title).s(sub).i(rgb).i(ticks).bytes();
    }

    /** Modelo GeckoLib del mod pegado a una entidad del servidor (normalmente un ItemDisplay invisible). */
    static byte[] model(int entityId, String model, String anim, float scale) {
        return new Msg(MODEL).i(entityId).s(model).s(anim).f(scale).bytes();
    }

    static byte[] modelAnim(int entityId, String anim) {
        return new Msg(MODEL_ANIM).i(entityId).s(anim).bytes();
    }

    /** Ancla el modelo «child» al hueso «bone» del modelo «parent» (+ desplazamiento en bloques); parent -1 lo suelta. */
    static byte[] modelAttach(int child, int parent, String bone, float ox, float oy, float oz) {
        return new Msg(MODEL_ATTACH).i(child).i(parent).s(bone).f(ox).f(oy).f(oz).bytes();
    }

    /** Frase en pantalla (subtítulo de cine). */
    static byte[] subtitle(String text, int rgb, int ticks) {
        return new Msg(SUBTITLE).s(text).i(rgb).i(ticks).bytes();
    }

    static byte[] modelRemove(int entityId) {
        return new Msg(MODEL_REMOVE).i(entityId).bytes();
    }
}
