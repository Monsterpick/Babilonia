package dev.livearena.cine;

import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.Identifier;

/**
 * Controles de shooter de Base Defense (canal «livearena:bd», cliente → servidor): un byte con el estado del ratón.
 * bit 0 = disparar (clic izquierdo mantenido) · bit 1 = apuntar (clic derecho mantenido) · bit 2 = recargar (R).
 * Solo se manda si el servidor anuncia el canal (plugin Base Defense); si no, se juega con los controles clásicos.
 */
public record BdInputPayload(byte flags) implements CustomPacketPayload {
    public static final Type<BdInputPayload> TYPE = new Type<>(Identifier.fromNamespaceAndPath(LiveArenaMod.ID, "bd"));

    public static final StreamCodec<RegistryFriendlyByteBuf, BdInputPayload> CODEC = StreamCodec.of(
            (buf, p) -> buf.writeByte(p.flags()),
            buf -> new BdInputPayload(buf.readByte()));

    @Override
    public Type<? extends CustomPacketPayload> type() {
        return TYPE;
    }
}
