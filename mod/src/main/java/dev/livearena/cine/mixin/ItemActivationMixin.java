package dev.livearena.cine.mixin;

import dev.livearena.cine.client.CineClient;
import net.minecraft.client.renderer.ScreenEffectRenderer;
import net.minecraft.util.RandomSource;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * El tótem gigante que salta a la pantalla al gastar uno tapaba las cinemáticas (y con ráfagas de tótems, todo).
 * En su lugar el mod dibuja un tótem pequeño que salta junto al contador de arriba y se desvanece.
 */
@Mixin(ScreenEffectRenderer.class)
public abstract class ItemActivationMixin {
    @Inject(method = "displayItemActivation", at = @At("HEAD"), cancellable = true)
    private void livearena$smallTotem(ItemStack stack, RandomSource random, CallbackInfo ci) {
        if (stack == null || !stack.is(Items.TOTEM_OF_UNDYING)) return;
        CineClient.totemPop(stack.copy());
        ci.cancel();
    }
}
