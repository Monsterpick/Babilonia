package dev.livearena.basedefense.game;

import dev.livearena.basedefense.BaseDefense;

/**
 * Meta de likes: la app envía el total acumulado del directo (/ttlikes &lt;total&gt;). Cada vez que
 * se cruza la meta aparece un jefe y la meta se reinicia. Si el total baja (directo nuevo) se reinicia.
 */
public final class LikeGoal {
    private final BaseDefense plugin;

    public LikeGoal(BaseDefense plugin) {
        this.plugin = plugin;
    }

    public long total() {
        return plugin.data().getLong("likes.total", 0);
    }

    private long base() {
        return plugin.data().getLong("likes.base", 0);
    }

    public long missing() {
        return Math.max(0, plugin.settings.likesGoal - (total() - base()));
    }

    public float progress() {
        return (float) Math.max(0, Math.min(1, (total() - base()) / (double) plugin.settings.likesGoal));
    }

    /** Actualiza el total. Devuelve cuántas metas se cumplieron (jefes a invocar). */
    public int update(long newTotal) {
        long base = base();
        if (newTotal < total()) base = 0; // nuevo directo
        int reached = 0;
        while (newTotal - base >= plugin.settings.likesGoal && reached < 5) {
            base += plugin.settings.likesGoal;
            reached++;
        }
        if (newTotal - base >= plugin.settings.likesGoal) base = newTotal - newTotal % plugin.settings.likesGoal; // salto enorme: no inundar de jefes
        plugin.data().set("likes.total", newTotal);
        plugin.data().set("likes.base", base);
        return reached;
    }

    public void reset() {
        plugin.data().set("likes.total", 0);
        plugin.data().set("likes.base", 0);
    }
}
