package dev.livearena.cine;

import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.Identifier;

/** Mensaje en bruto del plugin (canal de plugin «livearena:cine»): el contenido lo interpreta CineClient. */
public record CinePayload(byte[] data) implements CustomPacketPayload {
    public static final Type<CinePayload> TYPE = new Type<>(Identifier.fromNamespaceAndPath(LiveArenaMod.ID, "cine"));

    public static final StreamCodec<RegistryFriendlyByteBuf, CinePayload> CODEC = StreamCodec.of(
            (buf, p) -> buf.writeBytes(p.data()),
            buf -> {
                byte[] b = new byte[buf.readableBytes()];
                buf.readBytes(b);
                return new CinePayload(b);
            });

    @Override
    public Type<? extends CustomPacketPayload> type() {
        return TYPE;
    }
}
