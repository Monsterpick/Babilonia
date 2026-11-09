package dev.livearena.cine.mixin;

import java.util.Set;
import net.neoforged.neoforge.network.event.RegisterPayloadHandlersEvent;
import net.neoforged.neoforge.network.registration.PayloadRegistrar;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Compatibilidad con servidores Paper/vanilla: GeckoLib registra sus canales de red como obligatorios, y NeoForge
 * rechaza entonces cualquier servidor que no sea NeoForge. Esos canales solo sincronizan animaciones de entidades
 * GeckoLib desde un servidor NeoForge (aquí no se usan: los modelos los dirige el plugin LiveArena), así que los
 * marcamos como opcionales. En un servidor NeoForge con GeckoLib siguen funcionando igual.
 */
@Mixin(RegisterPayloadHandlersEvent.class)
public abstract class PayloadOptionalMixin {
    private static final Set<String> OPTIONAL = Set.of("geckolib");

    @Inject(method = "registrar", at = @At("RETURN"), cancellable = true, remap = false)
    private void livearena$optional(String version, CallbackInfoReturnable<PayloadRegistrar> cir) {
        if (OPTIONAL.contains(version)) cir.setReturnValue(cir.getReturnValue().optional());
    }
}
