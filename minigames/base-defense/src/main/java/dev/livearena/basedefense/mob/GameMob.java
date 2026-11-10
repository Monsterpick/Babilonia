package dev.livearena.basedefense.mob;

import dev.livearena.basedefense.Settings;
import net.kyori.adventure.bossbar.BossBar;
import org.bukkit.entity.Mob;
import org.bukkit.entity.TextDisplay;

/** Estado de un mob del juego. La vida es "virtual" para permitir jefes de más de 1024 de vida. */
public final class GameMob {
    public final Mob entity;
    public final String donor;
    public final Settings.MobDef def;    // null si es jefe
    public final Settings.BossDef boss;  // null si es mob normal
    public final double maxHp;
    public double hp;
    public final double offset;          // desplazamiento lateral en el carril
    public TextDisplay label;
    public int waypoint;
    public double speed;                 // bloques/tick para los que se mueven a mano
    public boolean manual;               // movido por el plugin (voladores y mobs con "cerebro")
    public boolean furious;
    public double bestProgress = -1e9;
    public long lastProgressTick;
    public int stuckCount;
    public long nextFireball;
    public BossBar bar;
    public boolean dead;
    public boolean warned;

    GameMob(Mob entity, String donor, Settings.MobDef def, Settings.BossDef boss, double maxHp, double offset) {
        this.entity = entity;
        this.donor = donor;
        this.def = def;
        this.boss = boss;
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.offset = offset;
    }

    public boolean isBoss() {
        return boss != null;
    }

    public int baseDamage() {
        return boss != null ? boss.damage() : def.damage();
    }

    public String typeName() {
        return boss != null ? boss.name() : def.name();
    }
}
