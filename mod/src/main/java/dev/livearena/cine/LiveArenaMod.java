package dev.livearena.cine;

import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.network.event.RegisterPayloadHandlersEvent;
import net.neoforged.neoforge.network.registration.PayloadRegistrar;

/**
 * LiveArena Cinemáticas: la parte de cliente de las habilidades del plugin LiveArena (servidor Paper).
 * No registra bloques, ítems ni entidades, para poder entrar en servidores Paper/vanilla: el único canal
 * (livearena:cine) es opcional. El servidor manda en el tiempo; aquí solo se hace lo visual.
 */
@Mod(LiveArenaMod.ID)
public final class LiveArenaMod {
    public static final String ID = "livearena";

    public LiveArenaMod(IEventBus modBus, Dist dist) {
        modBus.addListener(LiveArenaMod::payloads);
        if (dist.isClient()) dev.livearena.cine.client.CineClient.init(modBus);
    }

    private static void payloads(RegisterPayloadHandlersEvent event) {
        PayloadRegistrar r = event.registrar("1").optional();
        r.playToClient(CinePayload.TYPE, CinePayload.CODEC, (payload, ctx) -> ctx.enqueueWork(() -> ClientBridge.handle(payload.data())));
        // cliente → plugin Base Defense (en un servidor Paper lo recibe el plugin; aquí no hay nada que hacer)
        r.playToServer(BdInputPayload.TYPE, BdInputPayload.CODEC, (payload, ctx) -> {});
    }

    /** Evita cargar clases de cliente en un servidor dedicado. */
    static final class ClientBridge {
        static void handle(byte[] data) {
            dev.livearena.cine.client.CineClient.handle(data);
        }
    }
}
