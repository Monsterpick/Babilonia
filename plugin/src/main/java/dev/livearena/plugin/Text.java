package dev.livearena.plugin;

import java.util.Map;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;

/** Textos con MiniMessage y variables seguras (los nombres de espectadores no pueden inyectar formato). */
final class Text {
    private static final MiniMessage MM = MiniMessage.miniMessage();

    private Text() {}

    static Component render(String template, Map<String, String> vars) {
        TagResolver.Builder b = TagResolver.builder();
        for (Map.Entry<String, String> e : vars.entrySet()) b.resolver(Placeholder.unparsed(e.getKey(), e.getValue()));
        return MM.deserialize(template == null ? "" : template, b.build());
    }
}
