package dev.livearena.basedefense.util;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;

/** Textos de la config con códigos &. Los valores insertados (nombres) nunca se interpretan. */
public final class Txt {
    private static final LegacyComponentSerializer AMP = LegacyComponentSerializer.builder().character('&').hexColors().build();

    private Txt() {}

    /** Sustituye {clave} por valores ya limpios (sin & ni §) y convierte a componente. */
    public static Component fmt(String template, Object... kv) {
        String s = template == null ? "" : template;
        for (int i = 0; i + 1 < kv.length; i += 2) {
            String v = String.valueOf(kv[i + 1]).replace('&', '＆').replace('§', ' ');
            s = s.replace("{" + kv[i] + "}", v);
        }
        return AMP.deserialize(s);
    }

    public static String plain(String template, Object... kv) {
        String s = template;
        for (int i = 0; i + 1 < kv.length; i += 2) s = s.replace("{" + kv[i] + "}", String.valueOf(kv[i + 1]));
        return s;
    }

    public static String time(int seconds) {
        seconds = Math.max(0, seconds);
        return String.format("%02d:%02d", seconds / 60, seconds % 60);
    }
}
