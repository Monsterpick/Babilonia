package dev.livearena.cine.mixin;

import dev.livearena.cine.client.CineClient;
import net.minecraft.client.Camera;
import net.minecraft.world.phys.Vec3;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Tras colocar la cámara normal, si hay una cinemática activa la movemos a la pose calculada por el mod. */
@Mixin(Camera.class)
public abstract class CameraMixin {
    @Shadow
    private boolean detached;

    @Shadow
    protected abstract void setPosition(Vec3 position);

    @Shadow
    protected abstract void setRotation(float yRot, float xRot, float roll);

    @Inject(method = "alignWithEntity", at = @At("TAIL"))
    private void livearena$cinematic(float partialTicks, CallbackInfo ci) {
        CineClient.Pose pose = CineClient.pose(partialTicks);
        if (pose == null) return;
        this.setPosition(pose.pos());
        this.setRotation(pose.yaw(), pose.pitch(), pose.roll());
        this.detached = true; // así se dibuja el cuerpo del jugador
    }
}
