package dev.livearena.basedefense;

import io.papermc.paper.plugin.bootstrap.BootstrapContext;
import io.papermc.paper.plugin.bootstrap.PluginBootstrap;
import io.papermc.paper.plugin.lifecycle.event.types.LifecycleEvents;
import java.net.URI;
import java.util.Objects;

/**
 * Arranque temprano: registra el datapack interno con el bioma propio "basedefense:ceniza"
 * (niebla y cielo apagados, ceniza cayendo). Los comandos se registran en onEnable.
 */
@SuppressWarnings("UnstableApiUsage")
public final class BdBootstrap implements PluginBootstrap {
    @Override
    public void bootstrap(BootstrapContext context) {
        context.getLifecycleManager().registerEventHandler(LifecycleEvents.DATAPACK_DISCOVERY.newHandler(event -> {
            try {
                URI uri = Objects.requireNonNull(getClass().getResource("/datapack")).toURI();
                event.registrar().discoverPack(uri, "ceniza");
            } catch (Exception e) {
                context.getLogger().warn("No se pudo registrar el bioma propio: {}", e.toString());
            }
        }));
    }
}
