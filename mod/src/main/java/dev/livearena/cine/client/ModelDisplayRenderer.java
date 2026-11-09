package dev.livearena.cine.client;

import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.entity.DisplayRenderer;
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.state.ItemDisplayEntityRenderState;
import net.minecraft.client.renderer.state.level.CameraRenderState;
import net.minecraft.world.entity.Display;
import org.joml.Quaternionf;

/**
 * Renderizador de ItemDisplay: igual que el vanilla, salvo que si el plugin ha asignado un modelo GeckoLib
 * a ese display, dibuja el modelo animado en su lugar.
 */
public final class ModelDisplayRenderer extends DisplayRenderer.ItemDisplayRenderer {
    public static final class State extends ItemDisplayEntityRenderState {
        int livearenaId = -1;
    }

    public ModelDisplayRenderer(EntityRendererProvider.Context context) {
        super(context);
    }

    @Override
    public ItemDisplayEntityRenderState createRenderState() {
        return new State();
    }

    @Override
    public void extractRenderState(Display.ItemDisplay entity, ItemDisplayEntityRenderState state, float partialTicks) {
        super.extractRenderState(entity, state, partialTicks);
        if (state instanceof State s) s.livearenaId = entity.getId();
    }

    @Override
    public void submit(ItemDisplayEntityRenderState state, PoseStack poseStack, SubmitNodeCollector collector, CameraRenderState camera) {
        CineModels.Inst inst = state instanceof State s ? CineModels.get(s.livearenaId) : null;
        if (inst == null) {
            super.submit(state, poseStack, collector, camera);
            return;
        }
        poseStack.pushPose();
        // Misma orientación que el display vanilla (FIXED) + su transformación interpolada (giro y escala del servidor).
        poseStack.mulPose(new Quaternionf().rotationYXZ((float) (-Math.PI / 180.0) * state.entityYRot, (float) (Math.PI / 180.0) * state.entityXRot, 0.0F));
        if (state.renderState != null) poseStack.mulPose(state.renderState.transformation().get(state.interpolationProgress));
        poseStack.scale(inst.scale, inst.scale, inst.scale);
        float partial = Minecraft.getInstance().getDeltaTracker().getGameTimeDeltaPartialTick(false);
        CineModels.renderer(inst.model).performRenderPass(inst, null, poseStack, collector, camera, 0xF000F0, partial);
        poseStack.popPose();
    }
}
