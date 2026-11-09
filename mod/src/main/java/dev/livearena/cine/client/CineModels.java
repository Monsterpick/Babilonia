package dev.livearena.cine.client;

import com.geckolib.animatable.GeoAnimatable;
import com.geckolib.animatable.instance.AnimatableInstanceCache;
import com.geckolib.animatable.manager.AnimatableManager;
import com.geckolib.animation.AnimationController;
import com.geckolib.animation.RawAnimation;
import com.geckolib.model.GeoModel;
import com.geckolib.renderer.GeoObjectRenderer;
import com.geckolib.renderer.base.GeoRenderState;
import com.geckolib.renderer.base.RenderPassInfo;
import com.geckolib.util.GeckoLibUtil;
import dev.livearena.cine.LiveArenaMod;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import net.minecraft.resources.Identifier;
import net.minecraft.world.entity.EntityType;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.client.event.EntityRenderersEvent;

/**
 * Modelos GeckoLib de las habilidades (espada_espectral, ojo_vacio, invocador, meteorito).
 * El plugin crea en el servidor un ItemDisplay invisible y nos dice «este display es el modelo X con la
 * animación Y»; nuestro renderizador de ItemDisplay dibuja entonces el modelo animado en su lugar.
 * Archivos: assets/livearena/geckolib/models/<modelo>.geo.json, geckolib/animations/<modelo>.animation.json
 * y textures/entity/<modelo>.png (los nombres de animaciones y huesos siguen docs/ASSETS.md).
 */
public final class CineModels {
    private CineModels() {}

    static final Set<String> LOOPS = Set.of("idle", "girar", "rotar", "alzar_brazos", "cargar", "arder");
    /** Modelos de energía: translúcidos y a plena luz (escudo, disco del agujero negro, círculos…). */
    static final Set<String> TRANSLUCENT = Set.of("escudo", "agujero_negro", "circulo_arcano", "aura");
    /** Modelos con partes que brillan: llevan además textures/entity/<modelo>_glowmask.png. */
    static final Set<String> GLOW = Set.of("meteorito", "ojo_vacio", "guerrero", "santuario");

    /** Una instancia animada por actor del servidor. */
    public static final class Inst implements GeoAnimatable {
        final String model;
        final float scale;
        volatile RawAnimation anim;
        /** Color ARGB que tiñe el modelo (el servidor lo cambia con la «animación» color:AARRGGBB). */
        volatile int color = 0xFFFFFFFF;
        private final AnimatableInstanceCache cache = GeckoLibUtil.createInstanceCache(this);

        Inst(String model, String anim, float scale) {
            this.model = model;
            this.scale = scale;
            this.anim = raw(anim);
        }

        @Override
        public void registerControllers(AnimatableManager.ControllerRegistrar controllers) {
            controllers.add(new AnimationController<Inst>("main", 3, test -> test.setAndContinue(anim)));
        }

        @Override
        public AnimatableInstanceCache getAnimatableInstanceCache() {
            return cache;
        }
    }

    static RawAnimation raw(String anim) {
        if (anim == null || anim.isBlank()) return RawAnimation.begin().thenLoop("idle");
        if (LOOPS.contains(anim)) return RawAnimation.begin().thenLoop(anim);
        return switch (anim) {
            case "abrir", "latido", "impacto", "aparicion", "golpe" -> RawAnimation.begin().thenPlay(anim).thenLoop("idle");
            default -> RawAnimation.begin().thenPlayAndHold(anim);
        };
    }

    /** Modelo con rutas fijas: livearena:<modelo>. */
    static final class Model extends GeoModel<Inst> {
        private final Identifier id, texture;

        Model(String name) {
            id = Identifier.fromNamespaceAndPath(LiveArenaMod.ID, name);
            texture = Identifier.fromNamespaceAndPath(LiveArenaMod.ID, "textures/entity/" + name + ".png");
        }

        @Override
        public Identifier getModelResource(GeoRenderState state) {
            return id;
        }

        @Override
        public Identifier getTextureResource(GeoRenderState state) {
            return texture;
        }

        @Override
        public Identifier getAnimationResource(Inst animatable) {
            return id;
        }
    }

    /** Renderizador de objeto sin el desplazamiento de medio bloque que GeckoLib pone por defecto. */
    static final class Renderer extends GeoObjectRenderer<Inst, Void, GeoRenderState> {
        private final boolean translucent;

        Renderer(String name) {
            super(new Model(name));
            translucent = TRANSLUCENT.contains(name);
            if (GLOW.contains(name)) withRenderLayer(com.geckolib.renderer.layer.builtin.AutoGlowingGeoLayer::new);
        }

        @Override
        public net.minecraft.client.renderer.rendertype.RenderType getRenderType(GeoRenderState state, Identifier texture) {
            return translucent ? net.minecraft.client.renderer.rendertype.RenderTypes.entityTranslucentEmissive(texture) : super.getRenderType(state, texture);
        }

        @Override
        public int getRenderColor(Inst animatable, Void data, float partialTick) {
            return animatable.color;
        }

        @Override
        public void adjustRenderPose(RenderPassInfo<GeoRenderState> info) {}
    }

    private static final Map<Integer, Inst> active = new HashMap<>();
    private static final Map<String, Renderer> renderers = new HashMap<>();

    static void init(IEventBus modBus) {
        modBus.addListener(CineModels::renderers);
    }

    private static void renderers(EntityRenderersEvent.RegisterRenderers e) {
        e.registerEntityRenderer(EntityType.ITEM_DISPLAY, ModelDisplayRenderer::new);
    }

    static void add(int entityId, String model, String anim, float scale) {
        active.put(entityId, new Inst(model, anim, scale));
    }

    static void anim(int entityId, String anim) {
        Inst i = active.get(entityId);
        if (i == null) return;
        if (anim.startsWith("color:")) {
            try {
                i.color = (int) Long.parseLong(anim.substring(6), 16);
            } catch (NumberFormatException ignored) {
            }
            return;
        }
        i.anim = raw(anim);
    }

    static void remove(int entityId) {
        active.remove(entityId);
    }

    static void clear() {
        active.clear();
    }

    static void tick() {}

    static Inst get(int entityId) {
        return active.get(entityId);
    }

    static Renderer renderer(String model) {
        return renderers.computeIfAbsent(model, Renderer::new);
    }
}
