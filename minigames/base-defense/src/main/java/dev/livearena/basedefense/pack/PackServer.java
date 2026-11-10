package dev.livearena.basedefense.pack;

import com.sun.net.httpserver.HttpServer;
import dev.livearena.basedefense.BaseDefense;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executors;
import net.kyori.adventure.resource.ResourcePackInfo;
import net.kyori.adventure.resource.ResourcePackRequest;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerResourcePackStatusEvent;
import dev.livearena.basedefense.util.Txt;

/**
 * Pack de texturas del minijuego (texturas apocalípticas, modelos 3D de las armas y sonidos). Viene dentro del
 * plugin; el plugin lo sirve por HTTP y se lo manda al streamer al empezar la partida (y se lo quita al terminar,
 * para que su survival se vea como siempre).
 */
public final class PackServer implements Listener {
    public static final UUID PACK_ID = UUID.nameUUIDFromBytes("livearena-basedefense-pack".getBytes());
    private final BaseDefense plugin;
    private final Set<UUID> loaded = new HashSet<>();
    private HttpServer http;
    private byte[] zip;
    private String sha1;

    public PackServer(BaseDefense plugin) {
        this.plugin = plugin;
    }

    public void start() {
        stop();
        if (!plugin.settings.packEnabled) return;
        try (InputStream in = plugin.getResource("basedefense-pack.zip")) {
            if (in == null) {
                plugin.getLogger().warning("El .jar no trae el pack de texturas");
                return;
            }
            zip = in.readAllBytes();
            sha1 = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-1").digest(zip));
            http = HttpServer.create(new InetSocketAddress(plugin.settings.packPort), 0);
            http.createContext("/basedefense.zip", ex -> {
                ex.getResponseHeaders().add("Content-Type", "application/zip");
                ex.sendResponseHeaders(200, zip.length);
                try (OutputStream o = ex.getResponseBody()) {
                    o.write(zip);
                }
            });
            http.setExecutor(Executors.newSingleThreadExecutor(r -> {
                Thread t = new Thread(r, "BaseDefense-pack");
                t.setDaemon(true);
                return t;
            }));
            http.start();
            plugin.getLogger().info("Pack de texturas en " + plugin.settings.packUrl + " (" + zip.length / 1024 + " KB)");
        } catch (Exception e) {
            plugin.getLogger().warning("No se pudo servir el pack de texturas (puerto " + plugin.settings.packPort + "): " + e.getMessage());
            http = null;
        }
    }

    public void stop() {
        if (http != null) http.stop(0);
        http = null;
    }

    public boolean available() {
        return http != null && sha1 != null;
    }

    public boolean loaded(Player p) {
        return p != null && loaded.contains(p.getUniqueId());
    }

    /** Sonido del pack si el jugador lo tiene; si no, el de Minecraft. */
    public String sound(Player p, String packKey, String vanilla) {
        return loaded(p) ? packKey : vanilla;
    }

    public void send(Player p) {
        if (!available()) return;
        ResourcePackInfo info = ResourcePackInfo.resourcePackInfo(PACK_ID, URI.create(plugin.settings.packUrl), sha1);
        p.sendResourcePacks(ResourcePackRequest.resourcePackRequest().packs(info).required(plugin.settings.packRequired).replace(false)
            .prompt(Txt.fmt("&c&lBase Defense &7· texturas apocalípticas, armas en 3D y sonidos. &8(se quita al terminar)")));
    }

    public void remove(Player p) {
        loaded.remove(p.getUniqueId());
        p.removeResourcePacks(PACK_ID);
    }

    @EventHandler
    public void onStatus(PlayerResourcePackStatusEvent e) {
        if (!PACK_ID.equals(e.getID())) return;
        switch (e.getStatus()) {
            case SUCCESSFULLY_LOADED -> {
                loaded.add(e.getPlayer().getUniqueId());
                plugin.weapons.refreshItems();
            }
            case DECLINED, FAILED_DOWNLOAD, FAILED_RELOAD, INVALID_URL, DISCARDED -> {
                loaded.remove(e.getPlayer().getUniqueId());
                if (e.getStatus() != PlayerResourcePackStatusEvent.Status.DECLINED)
                    plugin.getLogger().warning("El pack no cargó para " + e.getPlayer().getName() + ": " + e.getStatus() + " (revisa paquete.url y el puerto " + plugin.settings.packPort + ")");
            }
            default -> {
            }
        }
    }
}
