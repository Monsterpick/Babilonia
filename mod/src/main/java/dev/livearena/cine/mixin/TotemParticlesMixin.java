package dev.livearena.cine.mixin;

import net.minecraft.client.multiplayer.ClientPacketListener;
import net.minecraft.client.particle.ParticleEngine;
import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.world.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

/** La nube de partículas al gastar un tótem dura mucho menos: con ráfagas de tótems ya no tapa la pantalla. */
@Mixin(ClientPacketListener.class)
public abstract class TotemParticlesMixin {
    @Redirect(method = "handleEntityEvent", at = @At(value = "INVOKE",
            target = "Lnet/minecraft/client/particle/ParticleEngine;createTrackingEmitter(Lnet/minecraft/world/entity/Entity;Lnet/minecraft/core/particles/ParticleOptions;I)V"))
    private void livearena$lessTotemParticles(ParticleEngine engine, Entity entity, ParticleOptions type, int lifetime) {
        engine.createTrackingEmitter(entity, type, type == ParticleTypes.TOTEM_OF_UNDYING ? Math.max(3, lifetime / 5) : lifetime);
    }
}
