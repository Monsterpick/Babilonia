package dev.livearena.basedefense.util;

import java.util.regex.Pattern;

/** Limpieza del nombre de usuario que llega desde la app de TikTok. */
public final class Names {
    private static final Pattern COLOR = Pattern.compile("(?i)[&§](#[0-9a-f]{6}|x([&§][0-9a-f]){6}|[0-9a-fk-or])");
    private static final Pattern MINI = Pattern.compile("<[/#!]?[a-zA-Z_:#0-9-]{1,32}>");

    private Names() {}

    /** Quita códigos de color, etiquetas, caracteres de control y bidi; recorta a max puntos de código. */
    public static String clean(String raw, int max) {
        if (raw == null) return "";
        String s = COLOR.matcher(raw).replaceAll("");
        s = MINI.matcher(s).replaceAll("");
        StringBuilder out = new StringBuilder();
        int count = 0;
        for (int i = 0; i < s.length() && count < max; ) {
            int cp = s.codePointAt(i);
            i += Character.charCount(cp);
            int type = Character.getType(cp);
            boolean bidi = (cp >= 0x202A && cp <= 0x202E) || (cp >= 0x2066 && cp <= 0x2069) || cp == 0x200E || cp == 0x200F;
            if (type == Character.CONTROL || bidi || cp == '§') continue;
            if (Character.isWhitespace(cp)) cp = ' ';
            if (cp == ' ' && (out.isEmpty() || out.charAt(out.length() - 1) == ' ')) continue;
            out.appendCodePoint(cp);
            count++;
        }
        String r = out.toString().strip();
        return r.isEmpty() ? "anónimo" : r;
    }
}
