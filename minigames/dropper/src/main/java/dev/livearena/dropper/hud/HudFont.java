package dev.livearena.dropper.hud;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.TextComponent;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.ShadowColor;
import net.kyori.adventure.text.format.TextColor;

/**
 * Métricas de las fuentes del HUD (src/main/resources/hud.json, generado por tools/gen_hud.py) y un compositor de
 * líneas: coloca glifos en coordenadas X absolutas (píxeles de GUI desde el centro de la pantalla) con caracteres de
 * espacio negativos/positivos, y al final vuelve al origen para que la línea mida 0 y quede centrada.
 */
public final class HudFont {
    private final Map<String, Map<Integer, Integer>> adv = new HashMap<>();
    private final Map<String, String> glyph = new HashMap<>();
    private final Map<String, List<String>> series = new HashMap<>();
    private final Map<String, Map<String, List<String>>> groups = new HashMap<>();
    private final Map<Integer, String> spaces = new HashMap<>();
    private final boolean ok;

    public HudFont(InputStream in) {
        boolean good = false;
        if (in != null) try (InputStreamReader r = new InputStreamReader(in, StandardCharsets.UTF_8)) {
            JsonObject root = JsonParser.parseReader(r).getAsJsonObject();
            for (var f : root.getAsJsonObject("fonts").entrySet()) {
                Map<Integer, Integer> m = new HashMap<>();
                for (var e : f.getValue().getAsJsonObject().entrySet()) m.put(e.getKey().codePointAt(0), (int) Math.round(e.getValue().getAsDouble()));
                adv.put(f.getKey(), m);
            }
            for (var g : root.getAsJsonObject("glyphs").entrySet()) {
                JsonElement v = g.getValue();
                if (v.isJsonPrimitive()) glyph.put(g.getKey(), v.getAsString());
                else if (v.isJsonArray()) series.put(g.getKey(), list(v));
                else if (g.getKey().equals("space")) {
                    for (var s : v.getAsJsonObject().entrySet()) spaces.put(Integer.parseInt(s.getKey()), s.getValue().getAsString());
                } else {
                    Map<String, List<String>> m = new HashMap<>();
                    for (var s : v.getAsJsonObject().entrySet()) m.put(s.getKey(), list(s.getValue()));
                    groups.put(g.getKey(), m);
                }
            }
            good = !adv.isEmpty() && !spaces.isEmpty();
        } catch (Exception ignored) {
        }
        ok = good;
    }

    private static List<String> list(JsonElement v) {
        List<String> out = new ArrayList<>();
        for (JsonElement e : v.getAsJsonArray()) out.add(e.getAsString());
        return out;
    }

    public boolean ok() {
        return ok;
    }

    public String g(String name) {
        return glyph.getOrDefault(name, "");
    }

    /** Paso i (0..n) de una serie (barras). */
    public String step(String name, double frac) {
        List<String> s = series.get(name);
        if (s == null || s.isEmpty()) return "";
        int i = (int) Math.round(Math.max(0, Math.min(1, frac)) * (s.size() - 1));
        if (frac > 0 && i == 0) i = 1;
        return s.get(i);
    }

    public String step(String group, String name, double frac) {
        List<String> s = groups.getOrDefault(group, Map.of()).get(name);
        if (s == null || s.isEmpty()) return "";
        int i = (int) Math.round(Math.max(0, Math.min(1, frac)) * (s.size() - 1));
        if (frac > 0 && i == 0) i = 1;
        return s.get(i);
    }

    /** Glifo único de un grupo (p. ej. el segmento de la tira de N píxeles de ancho). */
    public String one(String group, String name) {
        List<String> s = groups.getOrDefault(group, Map.of()).get(name);
        return s == null || s.isEmpty() ? "" : s.getFirst();
    }

    public int width(String font, String s, int spacing) {
        Map<Integer, Integer> m = adv.get(font);
        if (m == null) return 0;
        int w = 0, n = 0;
        for (int i = 0; i < s.length(); ) {
            int cp = s.codePointAt(i);
            i += Character.charCount(cp);
            w += m.getOrDefault(cp, 0);
            n++;
        }
        return w + Math.max(0, n - 1) * spacing;
    }

    /** Texto apto para la letra propia: mayúsculas y los caracteres que no tiene se cambian por '?'. */
    public String clean(String font, String s) {
        Map<Integer, Integer> m = adv.get(font);
        if (m == null || s == null) return "";
        StringBuilder b = new StringBuilder();
        String up = s.toUpperCase(Locale.ROOT);
        for (int i = 0; i < up.length(); ) {
            int cp = up.codePointAt(i);
            i += Character.charCount(cp);
            if (m.containsKey(cp)) b.appendCodePoint(cp);
            else if (Character.isWhitespace(cp)) b.append(' ');
            else b.append('?');
        }
        return b.toString();
    }

    public Line line() {
        return new Line();
    }

    /** Una línea compuesta: segmentos de texto con fuente y color, con el cursor en píxeles de GUI. */
    public final class Line {
        private final TextComponent.Builder out = Component.text();
        private String curFont;
        private TextColor curColor;
        private final StringBuilder buf = new StringBuilder();
        private int cursor;

        private void flush() {
            if (buf.isEmpty()) return;
            out.append(Component.text(buf.toString()).font(Key.key(curFont)).color(curColor).shadowColor(ShadowColor.none()));
            buf.setLength(0);
        }

        private void use(String font, TextColor color) {
            if (!font.equals(curFont) || (color != null && !color.equals(curColor))) {
                flush();
                curFont = font;
                if (color != null) curColor = color;
            }
        }

        /** Mueve el cursor a x (en la fuente dada). */
        public Line at(String font, int x) {
            use(font, curColor == null ? NamedTextColor.WHITE : curColor);
            int d = x - cursor;
            while (d != 0) {
                int p = Integer.highestOneBit(Math.abs(d));
                if (p > 1024) p = 1024;
                String sp = spaces.get(d > 0 ? p : -p);
                if (sp == null) break;
                buf.append(sp);
                d -= d > 0 ? p : -p;
            }
            cursor = x;
            return this;
        }

        /** Escribe s (glifos o texto) en x con color. spacing = píxeles extra entre caracteres. */
        public Line put(String font, int x, String s, TextColor color, int spacing) {
            if (s == null || s.isEmpty()) return this;
            at(font, x);
            use(font, color);
            Map<Integer, Integer> m = adv.getOrDefault(font, Map.of());
            int n = 0;
            for (int i = 0; i < s.length(); ) {
                int cp = s.codePointAt(i);
                i += Character.charCount(cp);
                if (n > 0 && spacing != 0) {
                    int c = cursor;
                    at(font, c + spacing);
                    use(font, color);
                }
                buf.appendCodePoint(cp);
                cursor += m.getOrDefault(cp, 0);
                n++;
            }
            return this;
        }

        public Line put(String font, int x, String s, TextColor color) {
            return put(font, x, s, color, 0);
        }

        /** Texto centrado en cx. */
        public Line center(String font, int cx, String s, TextColor color, int spacing) {
            return put(font, cx - width(font, s, spacing) / 2, s, color, spacing);
        }

        /** Texto alineado a la derecha terminando en x. */
        public Line right(String font, int x, String s, TextColor color, int spacing) {
            return put(font, x - width(font, s, spacing), s, color, spacing);
        }

        /** Placa de ancho variable (tapa izquierda, tramos de 8 px, tapa derecha) que ocupa [x, x+w). */
        public Line plate(String font, String prefix, int x, int w) {
            int mids = Math.max(0, (w - 8 + 7) / 8);
            put(font, x, g(prefix + "_l"), NamedTextColor.WHITE);
            for (int i = 0; i < mids; i++) put(font, x + 4 + i * 8, g(prefix + "_m"), NamedTextColor.WHITE);
            put(font, x + 4 + mids * 8, g(prefix + "_r"), NamedTextColor.WHITE);
            return this;
        }

        public static int plateWidth(int w) {
            return 8 + Math.max(0, (w - 8 + 7) / 8) * 8;
        }

        public Component build() {
            if (curFont != null) at(curFont, 0);
            flush();
            return out.build();
        }
    }
}
