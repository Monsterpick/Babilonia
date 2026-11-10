package dev.livearena.cine.mixin;

import net.minecraft.client.renderer.GameRenderer;
import net.minecraft.resources.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;

/** Acceso al efecto de pantalla completa (post_effect) del juego. */
@Mixin(GameRenderer.class)
public interface GameRendererInvoker {
    @Invoker("setPostEffect")
    void livearena$setPostEffect(Identifier id);
}
