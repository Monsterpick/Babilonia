import { overlayUrl as fixedOverlayUrl } from '../lib/api';
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleDashed,
  Download,
  ExternalLink,
  Gift,
  Loader2,
  Map as MapIcon,
  Mountain,
  Play,
  Power,
  Save,
  Shield,
  Skull,
  Sparkles,
  Square,
  Timer,
  Trophy,
  Wind,
  XCircle,
  Zap,
} from "lucide-react";
import { api } from "../lib/api";
import { useLiveState } from "../lib/live";
import { useApp } from "../App";
import { toast } from "../components/Toast";

interface PkGame {
  running: boolean;
  built: boolean;
  building: boolean;
  buildPct: number;
  level: number;
  levels: number;
  progress: number;
  levelProgress: number;
  falls: number;
  time: number;
  limit: number;
  ganadas: number;
  perdidas: number;
  queue: number;
  shield: boolean;
  protected: boolean;
  won: boolean;
  theme: string;
  color: string;
  streamer: string;
  colors: string[];
}

interface PkStatus {
  bundled: boolean;
  plugin: "no-server" | "missing" | "installed" | "outdated" | "disabled";
  loaded: boolean | null;
  config: boolean;
  game: PkGame | null;
  error: string | null;
}

type Settings = Record<string, string | number>;

/** Efectos: lo que pueden hacer los espectadores. */
const EFFECTS: {
  id: string;
  cmd: string;
  name: string;
  good: boolean;
  icon: ReactNode;
}[] = [
  {
    id: "subir1",
    cmd: "subir 1",
    name: "Subir 1 nivel",
    good: true,
    icon: <ArrowUp size={14} />,
  },
  {
    id: "subir10",
    cmd: "subir 10",
    name: "Subir 10 niveles",
    good: true,
    icon: <ArrowUp size={14} />,
  },
  {
    id: "bajar1",
    cmd: "bajar 1",
    name: "Bajar 1 nivel",
    good: false,
    icon: <ArrowDown size={14} />,
  },
  {
    id: "bajar10",
    cmd: "bajar 10",
    name: "Bajar 10 niveles",
    good: false,
    icon: <ArrowDown size={14} />,
  },
  {
    id: "empujar",
    cmd: "empujar",
    name: "Empujar",
    good: false,
    icon: <Wind size={14} />,
  },
  {
    id: "viento",
    cmd: "viento",
    name: "Viento",
    good: false,
    icon: <Wind size={14} />,
  },
  {
    id: "niebla",
    cmd: "niebla",
    name: "Apagar luces",
    good: false,
    icon: <Zap size={14} />,
  },
  {
    id: "hielo",
    cmd: "hielo",
    name: "Camino de hielo",
    good: false,
    icon: <Zap size={14} />,
  },
  {
    id: "fantasma",
    cmd: "fantasma",
    name: "Bloques fantasma",
    good: false,
    icon: <Zap size={14} />,
  },
  {
    id: "terremoto",
    cmd: "terremoto",
    name: "Terremoto",
    good: false,
    icon: <Zap size={14} />,
  },
  {
    id: "lento",
    cmd: "lento",
    name: "Lentitud",
    good: false,
    icon: <Zap size={14} />,
  },
  {
    id: "supersalto",
    cmd: "supersalto",
    name: "Supersalto",
    good: true,
    icon: <Sparkles size={14} />,
  },
  {
    id: "escudo",
    cmd: "escudo",
    name: "Escudo anticaída",
    good: true,
    icon: <Shield size={14} />,
  },
  {
    id: "guia",
    cmd: "guia",
    name: "Marcar camino",
    good: true,
    icon: <Sparkles size={14} />,
  },
  {
    id: "puente",
    cmd: "puente",
    name: "Puente",
    good: true,
    icon: <Sparkles size={14} />,
  },
];

const GIFTS: { gift: string; coins: number; what: string; good?: boolean }[] = [
  { gift: "Rose / TikTok", coins: 1, what: "Empujar" },
  { gift: "GG", coins: 1, what: "Viento" },
  { gift: "Heart Me", coins: 1, what: "Marcar camino", good: true },
  { gift: "Finger Heart", coins: 5, what: "Subir 1 nivel", good: true },
  { gift: "Perfume", coins: 20, what: "Bajar 1 nivel" },
  { gift: "Doughnut", coins: 30, what: "Apagar luces" },
  { gift: "Cap", coins: 99, what: "Supersalto", good: true },
  { gift: "Hand Hearts", coins: 100, what: "Camino de hielo" },
  { gift: "Confetti", coins: 100, what: "Bloques fantasma" },
  { gift: "Sunglasses", coins: 199, what: "Escudo anticaída", good: true },
  { gift: "Corgi", coins: 299, what: "Terremoto" },
  { gift: "Money Gun", coins: 500, what: "Subir 10 niveles", good: true },
  { gift: "Swan", coins: 699, what: "Puente", good: true },
  { gift: "Galaxy", coins: 1000, what: "Bajar 10 niveles" },
  { gift: "Seguir", coins: 0, what: "Marcar camino", good: true },
  { gift: "Compartir · cada 500 likes", coins: 0, what: "Empujar" },
];

const FIELDS: {
  key: string;
  label: string;
  hint?: string;
  type: "int" | "number" | "bool" | "select";
  options?: { v: string; l: string }[];
  tower?: boolean;
  min?: number;
  max?: number;
  step?: number;
}[] = [
  {
    key: "torre.estilo",
    label: "Tipo de mapa",
    hint: "se reconstruye al guardar",
    type: "select",
    tower: true,
    options: [
      { v: "clasica", l: "Torre clásica (bloques flotando alrededor de una columna)" },
      { v: "espiral", l: "Espiral (cilindro gigante con terraza de biomas)" },
    ],
  },
  {
    key: "torre.niveles",
    label: "Niveles de la torre",
    hint: "2–120 · 50 biomas distintos",
    type: "int",
    tower: true,
    min: 2,
    max: 120,
  },
  {
    key: "torre.dificultad",
    label: "Dificultad del recorrido",
    hint: "0.5 fácil · 1.5 difícil",
    type: "number",
    tower: true,
    min: 0.3,
    max: 2,
    step: 0.1,
  },
  {
    key: "torre.semilla",
    label: "Semilla del mapa",
    hint: "misma semilla = misma torre",
    type: "int",
    tower: true,
  },
  {
    key: "partida.tiempoLimite",
    label: "Tiempo límite (min)",
    hint: "0 = sin límite",
    type: "int",
    min: 0,
    max: 600,
  },
  {
    key: "partida.reiniciarAlGanar",
    label: "Al llegar a la cima, volver a empezar",
    type: "bool",
  },
  {
    key: "partida.segundosCelebracion",
    label: "Segundos de celebración",
    type: "int",
    min: 3,
    max: 120,
  },
  {
    key: "partida.visionNocturna",
    label: "Visión nocturna en niveles oscuros",
    type: "bool",
  },
  {
    key: "efectos.separacionSegundos",
    label: "Segundos entre efectos",
    hint: "cola",
    type: "number",
    min: 0.2,
    max: 10,
    step: 0.1,
  },
  {
    key: "efectos.empujeFuerza",
    label: "Fuerza del empujón",
    type: "number",
    min: 0.2,
    max: 3,
    step: 0.05,
  },
  {
    key: "efectos.vientoSegundos",
    label: "Viento (s)",
    type: "int",
    min: 1,
    max: 120,
  },
  {
    key: "efectos.nieblaSegundos",
    label: "Apagar luces (s)",
    type: "int",
    min: 1,
    max: 120,
  },
  {
    key: "efectos.hieloSegundos",
    label: "Hielo (s)",
    type: "int",
    min: 1,
    max: 120,
  },
  {
    key: "efectos.fantasmaSegundos",
    label: "Bloques fantasma (s)",
    type: "int",
    min: 1,
    max: 120,
  },
  {
    key: "efectos.escudoSegundos",
    label: "Escudo anticaída (s)",
    type: "int",
    min: 1,
    max: 120,
  },
  {
    key: "efectos.caidasParaProteger",
    label: "Caídas seguidas para protegerte",
    hint: "0 = nunca",
    type: "int",
    min: 0,
    max: 50,
  },
];

const mmss = (s: number) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

function Step({
  ok,
  warn,
  title,
  detail,
  action,
}: {
  ok: boolean;
  warn?: boolean;
  title: string;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
      {ok ? (
        <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
      ) : warn ? (
        <CircleDashed size={20} className="shrink-0 text-warn" />
      ) : (
        <XCircle size={20} className="shrink-0 text-white/30" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        {detail && <div className="text-xs text-muted">{detail}</div>}
      </div>
      {action}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone = "text-white",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2 ring-1 ring-white/5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-muted uppercase">
        {icon} {label}
      </div>
      <div className={`mt-0.5 text-lg font-black tabular-nums ${tone}`}>
        {value}
      </div>
    </div>
  );
}

/** Torre dibujada con los colores de cada nivel (de abajo arriba) y la posición actual. */
export function TowerStrip({
  colors,
  level,
  progress,
  vertical = false,
}: {
  colors: string[];
  level: number;
  progress: number;
  vertical?: boolean;
}) {
  const n = Math.max(1, colors.length);
  return (
    <div
      className={`relative flex ${vertical ? "h-full w-full flex-col-reverse" : "h-6 w-full"} gap-[2px]`}
    >
      {colors.map((c, i) => {
        const lv = i + 1;
        const done = lv < level;
        const cur = lv === level;
        return (
          <div
            key={i}
            className={`relative flex-1 rounded-[3px] ${cur ? "ring-2 ring-white" : ""}`}
            style={{
              background: c,
              opacity: done ? 0.95 : cur ? 1 : 0.28,
              boxShadow: cur ? `0 0 14px ${c}` : undefined,
            }}
            title={`Nivel ${lv}`}
          >
            {cur && (
              <div
                className="absolute inset-y-0 left-0 rounded-[3px] bg-white/40"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            )}
          </div>
        );
      })}
      {level > n && (
        <div className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-amber-300" />
      )}
    </div>
  );
}

export function ParkourPanel() {
  const { state, profile, reload, go } = useApp();
  const live = useLiveState<{ parkour?: PkStatus }>("minigames");
  const [st, setSt] = useState<PkStatus | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings>({});
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const s = await api<{ parkour: PkStatus }>(
        "GET",
        "/api/minigames/status",
      );
      setSt(s.parkour);
      const c = await api<{ exists: boolean; values: Settings }>(
        "GET",
        "/api/minigames/parkour/settings",
      );
      setSettings(c.exists ? c.values : null);
      setDraft({});
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    if (live?.parkour) setSt(live.parkour);
  }, [live]);
  useEffect(() => {
    if (st?.config && !settings)
      void api<{ exists: boolean; values: Settings }>(
        "GET",
        "/api/minigames/parkour/settings",
      ).then(
        (s) => s.exists && setSettings(s.values),
        () => undefined,
      );
  }, [st?.config]);

  const g = st?.game ?? null;
  const rcon = st?.loaded !== null && st?.loaded !== undefined;
  const pluginOk = st?.plugin === "installed" || st?.plugin === "outdated";
  const loaded = st?.loaded === true;
  const profileActive = profile?.id === "parkour";
  const player = state?.config?.minecraft?.player ?? "";

  const cmd = async (command: string, okMsg?: string) => {
    setBusy(command);
    try {
      const r = await api<{ response: string }>(
        "POST",
        "/api/minigames/parkour/command",
        { command },
      );
      toast(okMsg ?? r.response ?? "Hecho");
      if (/^pk (start|stop)/.test(command)) await reload();
      setTimeout(() => void refresh(), 600);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setTimeout(() => setBusy(null), 400);
    }
  };

  const install = async () => {
    setBusy("install");
    try {
      const r = await api<{ restartNeeded: boolean }>(
        "POST",
        "/api/minigames/parkour/install",
      );
      toast(
        r.restartNeeded
          ? "Plugin instalado. Reinicia el servidor para cargarlo."
          : "Plugin instalado. Se cargará al encender el servidor.",
      );
      await refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const restartServer = async () => {
    setBusy("restart");
    try {
      await api("POST", "/api/minecraft/server/stop").catch(() => undefined);
      toast("Reiniciando el servidor…");
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const s = await api<any>("GET", "/api/state").catch(() => null);
        if (
          s?.minecraft?.server?.state !== "running" &&
          s?.minecraft?.server?.state !== "stopping"
        )
          break;
      }
      await api("POST", "/api/minecraft/server/start");
      toast("Servidor encendido: Parkour LIVE se carga en unos segundos");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const activateProfile = async () => {
    setBusy("profile");
    try {
      await api("POST", "/api/minigames/parkour/profile");
      await reload();
      toast(
        "Perfil «Parkour LIVE» activo: los regalos ya suben, bajan y empujan",
      );
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const merged = useMemo(
    () => ({ ...(settings ?? {}), ...draft }),
    [settings, draft],
  );
  const dirty = Object.keys(draft).length > 0;
  const towerDirty = Object.keys(draft).some(
    (k) => FIELDS.find((f) => f.key === k)?.tower,
  );
  const save = async () => {
    setBusy("save");
    try {
      const r = await api<{ reloaded: boolean }>(
        "PUT",
        "/api/minigames/parkour/settings",
        draft,
      );
      toast(
        towerDirty
          ? g?.running
            ? "Guardado. La torre nueva se construye al terminar la partida («Nuevo mapa»)."
            : "Guardado: reconstruyendo la torre…"
          : r.reloaded
            ? "Guardado y aplicado"
            : "Guardado: se aplica al encender el servidor",
      );
      await refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const colors = g?.colors?.length
    ? g.colors
    : Array.from({ length: 50 }, (_, i) => `hsl(${(i * 37) % 360} 70% 55%)`);
  const overlayUrl = fixedOverlayUrl('parkour');

  return (
    <div className="space-y-5 px-8">
      {/* Portada */}
      <div className="card relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background: `linear-gradient(180deg, ${colors.slice(-12).join(",")})`,
            filter: "saturate(1.2) blur(40px)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/30" />
        <div className="relative grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_200px]">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-emerald-300 uppercase">
              <Mountain size={14} /> Minijuego · Paper 26.1.2
            </div>
            <h2 className="mt-1 text-3xl font-black tracking-tight">
              Parkour LIVE
            </h2>
            <p className="mt-2 max-w-xl text-sm text-white/80">
              Una torre vertical de {g?.levels ?? 50} niveles, cada uno con su
              propio bioma (cerezos, glaciar, abismo de sculk, biblioteca
              flotante, reino de las nubes, puente arcoíris, aurora boreal,
              islas del vacío…). Los espectadores te <b>suben</b> o te{" "}
              <b>bajan</b> de nivel, te <b>empujan</b> y te ponen trampas — o te
              ayudan. Si caes, vuelves al inicio del nivel de tu último
              checkpoint.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
              {[
                "50 biomas distintos",
                "Checkpoint en cada nivel",
                "Subir / bajar niveles",
                "Empujones y 10 efectos más",
                "Cola de efectos",
                "Protección tras muchas caídas",
                "Barra y panel de progreso",
                "Overlay de la torre",
              ].map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-white/10 px-2.5 py-1 font-semibold text-white/90 ring-1 ring-white/10"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="hidden h-56 rounded-xl bg-black/40 p-2 ring-1 ring-white/10 lg:block">
            <TowerStrip
              colors={colors}
              level={g?.level ?? 1}
              progress={g?.levelProgress ?? 0}
              vertical
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          {/* Pasos */}
          <div className="card p-3">
            <div className="px-3 pt-2 pb-1 text-xs font-bold tracking-wider text-muted uppercase">
              Preparación (una sola vez)
            </div>
            <Step
              ok={pluginOk}
              warn={st?.plugin === "outdated"}
              title={
                st?.plugin === "outdated"
                  ? "Plugin Parkour LIVE (hay versión nueva)"
                  : "Plugin Parkour LIVE en tu servidor"
              }
              detail={
                st?.plugin === "no-server"
                  ? "Primero crea o elige tu servidor en la pestaña Servidor"
                  : !st?.bundled
                    ? "Esta copia de la app no trae el plugin (solo la versión de Windows)"
                    : st?.plugin === "disabled"
                      ? "Está desactivado en el gestor de plugins"
                      : pluginOk
                        ? "ParkourLive.jar está en plugins/"
                        : "Copia ParkourLive.jar a la carpeta plugins/ del servidor"
              }
              action={
                st?.plugin !== "installed" &&
                st?.plugin !== "no-server" &&
                st?.bundled ? (
                  <button
                    className="btn btn-accent"
                    disabled={busy === "install"}
                    onClick={() => void install()}
                  >
                    {busy === "install" ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Download size={15} />
                    )}{" "}
                    {st?.plugin === "outdated" ? "Actualizar" : "Instalar"}
                  </button>
                ) : st?.plugin === "no-server" ? (
                  <button className="btn" onClick={() => go("servidor")}>
                    Ir a Servidor
                  </button>
                ) : null
              }
            />
            <Step
              ok={loaded}
              warn={pluginOk && !loaded}
              title="Cargado en el servidor"
              detail={
                loaded
                  ? "Parkour LIVE responde por RCON"
                  : !rcon
                    ? "Enciende el servidor (y conecta RCON) para comprobarlo"
                    : "Instalado pero no cargado: reinicia el servidor"
              }
              action={
                pluginOk && !loaded && rcon ? (
                  <button
                    className="btn"
                    disabled={busy === "restart"}
                    onClick={() => void restartServer()}
                  >
                    {busy === "restart" ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Power size={15} />
                    )}{" "}
                    Reiniciar servidor
                  </button>
                ) : null
              }
            />
            <Step
              ok={!!g?.built}
              warn={!!g?.building}
              title={
                g?.building
                  ? `Construyendo la torre… ${g.buildPct}%`
                  : "Torre construida"
              }
              detail={
                g?.built
                  ? `${g.levels} niveles en un mundo propio (parkour_torre)`
                  : "El plugin la construye solo al arrancar (unos segundos)"
              }
              action={
                g?.building ? (
                  <Loader2 size={18} className="animate-spin text-warn" />
                ) : null
              }
            />
            <Step
              ok={profileActive}
              warn={!profileActive}
              title="Regalos conectados al juego"
              detail={
                profileActive
                  ? "Perfil «Parkour LIVE» activo"
                  : `Ahora está activo «${profile?.name ?? "—"}». Se activa solo al empezar la partida.`
              }
              action={
                !profileActive ? (
                  <button
                    className="btn"
                    disabled={busy === "profile"}
                    onClick={() => void activateProfile()}
                  >
                    <Gift size={15} /> Activar perfil
                  </button>
                ) : null
              }
            />
          </div>

          {/* Partida */}
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-line bg-gradient-to-r from-emerald-600/25 via-sky-500/10 to-transparent px-5 py-4">
              <Mountain className="text-emerald-300" />
              <div className="min-w-0 flex-1">
                <div className="font-bold">Partida</div>
                <div className="text-xs text-muted">
                  {g?.running
                    ? `En marcha · ${g.streamer || "—"}`
                    : loaded
                      ? "Te lleva al nivel 1 de la torre (tu inventario se guarda y se devuelve al terminar). Si Base Defense está en marcha, se detiene."
                      : "Disponible cuando el plugin esté cargado"}
                </div>
              </div>
              {g?.running ? (
                <button
                  className="btn"
                  disabled={!!busy}
                  onClick={() => void cmd("pk stop", "Partida detenida")}
                >
                  <Square size={15} /> Detener
                </button>
              ) : (
                <button
                  className="btn btn-accent"
                  disabled={!loaded || !!g?.building || !!busy || !player}
                  title={
                    !player ? "Pon tu nombre de jugador en Ajustes" : undefined
                  }
                  onClick={() =>
                    void cmd(`pk start ${player}`, "¡A subir la torre!")
                  }
                >
                  <Play size={15} /> Empezar partida
                </button>
              )}
              {loaded && g?.built && (
                <button
                  className="btn"
                  disabled={!!busy || !player}
                  onClick={() =>
                    void cmd(`pk tp ${player}`, "Te llevé a la torre")
                  }
                  title="Te lleva al nivel actual sin empezar"
                >
                  <MapIcon size={15} /> Ver la torre
                </button>
              )}
            </div>
            {g ? (
              <div className="space-y-4 p-5">
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span
                      className="font-bold tracking-wide"
                      style={{ color: g.color }}
                    >
                      {g.level > g.levels
                        ? "★ CIMA"
                        : `NIVEL ${g.level}/${g.levels} · ${g.theme}`}
                    </span>
                    <span className="tabular-nums text-muted">
                      {Math.round(g.progress * 100)}% de la torre
                    </span>
                  </div>
                  <TowerStrip
                    colors={colors}
                    level={g.level}
                    progress={g.levelProgress}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat
                    icon={<Timer size={12} />}
                    label={g.limit > 0 ? "Tiempo restante" : "Tiempo"}
                    value={
                      g.running
                        ? mmss(g.limit > 0 ? g.limit - g.time : g.time)
                        : "—"
                    }
                    tone={
                      g.limit > 0 && g.limit - g.time < 60
                        ? "text-red-400"
                        : "text-white"
                    }
                  />
                  <Stat
                    icon={<Skull size={12} />}
                    label="Caídas"
                    value={g.falls}
                  />
                  <Stat
                    icon={<Trophy size={12} />}
                    label="Ganadas · perdidas"
                    value={`${g.ganadas} – ${g.perdidas}`}
                    tone="text-amber-300"
                  />
                  <Stat
                    icon={<Zap size={12} />}
                    label="Efectos en cola"
                    value={g.queue}
                    tone={g.queue > 5 ? "text-orange-300" : "text-white"}
                  />
                </div>
                {(g.shield || g.protected || g.won) && (
                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    {g.won && (
                      <span className="rounded-full bg-amber-400/20 px-2.5 py-1 text-amber-200">
                        ★ ¡Ha llegado a la cima!
                      </span>
                    )}
                    {g.shield && (
                      <span className="rounded-full bg-pink-400/20 px-2.5 py-1 text-pink-200">
                        🛡 Escudo anticaída
                      </span>
                    )}
                    {g.protected && (
                      <span className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-emerald-200">
                        ✚ Protegido (sin sabotajes)
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="px-5 py-6 text-sm text-muted">
                {st?.error ? st.error : "Sin datos todavía."}
              </div>
            )}
          </div>

          {/* Pruebas */}
          <div className="card p-5">
            <div className="mb-1 font-bold">Probar sin TikTok</div>
            <div className="mb-3 text-xs text-muted">
              Lanza cada efecto con la partida en marcha (donante «Prueba»). Van
              en cola, uno detrás de otro.
            </div>
            <div className="flex flex-wrap gap-2">
              {EFFECTS.map((e) => (
                <button
                  key={e.id}
                  className={`btn ${e.good ? "ring-1 ring-emerald-400/30" : "ring-1 ring-red-400/25"}`}
                  disabled={!g?.running || !!busy}
                  onClick={() =>
                    void cmd(`pk test ${e.cmd}`, `${e.name} en cola`)
                  }
                >
                  {e.icon} {e.name}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="btn"
                disabled={!g?.running || !!busy}
                onClick={() => void cmd("pk test ganar", "¡Cima!")}
              >
                <Trophy size={14} /> Llegar a la cima
              </button>
              <button
                className="btn"
                disabled={!g?.running || !!busy}
                onClick={() => void cmd("pk test caer", "Caída")}
              >
                <Skull size={14} /> Simular caída
              </button>
              <button
                className="btn"
                disabled={!g?.running || !!busy}
                onClick={() => void cmd("pk test perder", "+1 perdida")}
              >
                <Trophy size={14} /> +1 perdida
              </button>
              <button
                className="btn"
                disabled={!!busy}
                onClick={() => {
                  if (
                    confirm("¿Poner el marcador de ganadas y perdidas a 0-0?")
                  )
                    void cmd("pk marcador reiniciar", "Marcador a 0-0");
                }}
              >
                <Trophy size={14} /> Marcador a 0-0
              </button>
            </div>
          </div>

          {/* Ajustes */}
          <div className="card p-5">
            <div className="mb-1 font-bold">Ajustes del juego</div>
            {!settings ? (
              <div className="text-sm text-muted">
                Aparecen cuando el servidor arranca una vez con el plugin
                instalado.
              </div>
            ) : (
              <>
                <div className="mb-3 text-xs text-muted">
                  Se aplican al momento. Los marcados con 🗺 cambian la torre
                  (se reconstruye sola si no hay partida).
                </div>
                <div className="grid gap-x-4 gap-y-2.5 md:grid-cols-2">
                  {FIELDS.map((f) => {
                    const v = merged[f.key];
                    return (
                      <label key={f.key} className="block">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-semibold text-white/90">
                            {f.label}{" "}
                            {f.tower && <span title="Cambia la torre">🗺</span>}
                          </span>
                          {f.hint && (
                            <span className="text-[10px] text-muted">
                              {f.hint}
                            </span>
                          )}
                        </div>
                        {f.type === "select" ? (
                          <select className="input w-full" value={String(v ?? f.options![0]!.v)} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}>
                            {f.options!.map((o) => (
                              <option key={o.v} value={o.v}>
                                {o.l}
                              </option>
                            ))}
                          </select>
                        ) : f.type === "bool" ? (
                          <select
                            className="input w-full"
                            value={Number(v) ? "1" : "0"}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                [f.key]: Number(e.target.value),
                              })
                            }
                          >
                            <option value="1">Sí</option>
                            <option value="0">No</option>
                          </select>
                        ) : (
                          <input
                            className="input w-full"
                            type="number"
                            min={f.min}
                            max={f.max}
                            step={f.step ?? 1}
                            value={String(v ?? "")}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                [f.key]:
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value),
                              })
                            }
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    className="btn btn-accent"
                    disabled={!dirty || busy === "save"}
                    onClick={() => void save()}
                  >
                    {busy === "save" ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Save size={15} />
                    )}{" "}
                    Guardar
                  </button>
                  <button
                    className="btn"
                    disabled={!loaded || !!g?.running || !!busy}
                    title={
                      g?.running
                        ? "Detén la partida antes"
                        : "Torre nueva con otra semilla"
                    }
                    onClick={() =>
                      void cmd(
                        `pk torre generar ${Math.floor(Math.random() * 1e9)}`,
                        "Construyendo una torre nueva…",
                      )
                    }
                  >
                    <MapIcon size={15} /> Nuevo mapa
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {/* Regalos */}
          <div className="card p-5">
            <div className="mb-1 flex items-center gap-2 font-bold">
              <Gift size={16} className="text-pink-300" /> Regalos → juego
            </div>
            <div className="mb-3 text-xs text-muted">
              Perfil «Parkour LIVE». Cámbialo como cualquier otro en la pestaña
              Plugins.
            </div>
            <div className="divide-y divide-line/60 text-sm">
              {GIFTS.map((r) => (
                <div
                  key={r.gift}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <span className="min-w-0 truncate">
                    {r.gift}
                    {r.coins > 0 && (
                      <span className="ml-1.5 text-[11px] text-amber-300/80">
                        {r.coins} 🪙
                      </span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 text-right text-xs font-semibold ${r.good ? "text-emerald-300" : "text-red-300"}`}
                  >
                    {r.what}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button className="btn flex-1" onClick={() => go("plugins")}>
                Editar regalos
              </button>
              {!profileActive && (
                <button
                  className="btn btn-accent flex-1"
                  disabled={busy === "profile"}
                  onClick={() => void activateProfile()}
                >
                  Activar
                </button>
              )}
            </div>
          </div>

          {/* Overlay */}
          <div className="card p-5">
            <div className="mb-1 font-bold">Overlay de progreso</div>
            <div className="mb-3 text-xs text-muted">
              Añádelo como fuente de navegador (360×720) en TikTok LIVE Studio u
              OBS: la torre con tu nivel, el bioma, las caídas y el tiempo.
            </div>
            <div className="flex gap-2">
              <input
                className="input min-w-0 flex-1 font-mono text-xs"
                readOnly
                value={overlayUrl}
                onFocus={(e) => e.currentTarget.select()}
              />
              <a
                className="btn"
                href={`${overlayUrl}?demo=1`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          {/* Guía */}
          <div className="card p-5 text-xs leading-relaxed text-muted">
            <div className="mb-2 text-sm font-bold text-white">
              Cómo se juega
            </div>
            <p>
              Sube saltando de bloque en bloque alrededor de la columna. Cada
              plataforma con cartel es un{" "}
              <b className="text-white">checkpoint</b>: si caes a un nivel
              inferior o al vacío vuelves al inicio de ese nivel. Si te bajan de
              nivel, tu checkpoint pasa a ese nivel. Hay escaleras de mano,
              losas, postes estrechos y, más arriba, bloques que aparecen y
              desaparecen.
            </p>
            <p className="mt-2">
              La barra de experiencia muestra tu progreso en el nivel; arriba,
              el de la torre; a la derecha, los niveles de alrededor. Llegar a
              la cima suma una <b className="text-white">ganada</b>; si pones
              tiempo límite y se acaba, una{" "}
              <b className="text-white">perdida</b>.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] text-white/85">{`ttpk subir [n] <usuario>
ttpk bajar [n] <usuario>
ttpk empujar <usuario>
ttpk <viento|niebla|hielo|fantasma|terremoto|lento> <usuario>
ttpk <supersalto|escudo|guia|puente> <usuario>`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
