import "server-only";
import type { Outcome } from "@/lib/matches";
import type { Line } from "@/lib/squad";
import {
  Backdrop, CrestImg, Kicker, NEGRO, ORO, PosterFooter, PosterHeader, ROJO, SIZES, drawTree,
  type Format, type Pic,
} from "@/lib/result-image";

/**
 * Imágenes para compartir antes del partido (v4.4.0), con el mismo estilo póster que la del
 * resultado: la convocatoria y «Hoy jugamos». Mismas reglas de rendimiento que result-image.tsx
 * (nada de sombras, filtros ni overflow: hidden en la raíz).
 */

export type Team = {
  name: string;
  short: string;
  color: string;
  crest: Pic | string | null;
  isUs: boolean;
  rank: { pos: number; points: number } | null;
};

type Common = {
  competition: string;           // «LIGA · JORNADA 8»
  day: string;                   // «Sábado, 14 de noviembre»
  kickoff: string | null;        // «17:00»
  venue: string | null;
  home: Team;
  away: Team;
  crest: Pic;
  sponsor: Pic | null;
};

export type CallupPosterData = Common & {
  players: { name: string; number: number | null; line: Line }[];
};

export type MatchdayPosterData = Common & {
  title: string;                 // «¡HOY JUGAMOS!»
  form: Outcome[];               // nuestros últimos resultados (el más reciente al final)
  gap: string | null;            // «Les sacamos 3 puntos»
  weather: { temp: number; text: string; kind: Sky } | null;
};

export type Sky = "sun" | "cloud" | "rain" | "snow" | "storm";

const FORM_LETTER: Record<Outcome, string> = { W: "V", D: "E", L: "D" };
const FORM_BG: Record<Outcome, string> = { W: ORO, D: "#6b6b6b", L: ROJO };
const LINE_TITLE: Record<Line, [string, string]> = {
  GK: ["PORTERO", "PORTEROS"],
  DEF: ["DEFENSA", "DEFENSAS"],
  MID: ["MEDIO", "MEDIOS"],
  FWD: ["DELANTERO", "DELANTEROS"],
};
const LINE_HEX: Record<Line, string> = { GK: "#F59E0B", DEF: "#0284C7", MID: "#059669", FWD: ROJO };

// ---------------------------------------------------------------- Piezas

/** Palabra gigante y casi transparente de fondo, detrás del titular. */
function Ghost({ text, W, top, size }: { text: string; W: number; top: number; size: number }) {
  return (
    <div style={{ display: "flex", position: "absolute", top, left: -200, width: W + 400, justifyContent: "center", fontFamily: "Display", fontSize: size, lineHeight: 1, color: "rgba(255,255,255,0.045)", letterSpacing: 6 }}>{text}</div>
  );
}

/** «3º · 16 PTS» debajo del escudo. */
function RankChip({ rank, gold }: { rank: Team["rank"]; gold: boolean }) {
  if (!rank) return null;
  return (
    <div style={{ display: "flex", alignItems: "baseline", marginTop: 10, padding: "4px 14px", borderRadius: 999, background: gold ? "rgba(213,175,50,0.16)" : "rgba(255,255,255,0.1)", border: `2px solid ${gold ? "rgba(213,175,50,0.55)" : "rgba(255,255,255,0.18)"}` }}>
      <span style={{ fontFamily: "Display", fontSize: 30, lineHeight: 1, color: gold ? ORO : "white" }}>{rank.pos}º</span>
      <span style={{ fontSize: 20, color: "rgba(255,255,255,0.75)", marginLeft: 10 }}>{rank.points} {rank.points === 1 ? "PT" : "PTS"}</span>
    </div>
  );
}

/** Los dos escudos frente a frente con el VS en medio. */
function Duel({ home, away, crestSize, nameSize, vsSize, marginTop }: { home: Team; away: Team; crestSize: number; nameSize: number; vsSize: number; marginTop: number }) {
  const team = (t: Team) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 330 }}>
      <div style={{ display: "flex", width: crestSize + 30, height: crestSize + 30, alignItems: "center", justifyContent: "center", borderRadius: 999, background: `radial-gradient(circle, ${t.isUs ? "rgba(213,175,50,0.28)" : "rgba(255,255,255,0.16)"}, rgba(255,255,255,0) 68%)` }}>
        <CrestImg crest={t.crest} short={t.short} color={t.color} size={crestSize} />
      </div>
      <div style={{ display: "flex", marginTop: 8, fontFamily: "Display", fontSize: t.name.length > 18 ? nameSize * 0.85 : nameSize, lineHeight: 1, textAlign: "center", textTransform: "uppercase", color: t.isUs ? ORO : "white", justifyContent: "center" }}>{t.name}</div>
      <RankChip rank={t.rank} gold={t.isUs} />
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "0 30px", marginTop }}>
      {team(home)}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: crestSize + 30 }}>
        <span style={{ fontFamily: "Display", fontSize: vsSize, lineHeight: 1, color: ORO, transform: "skewX(-7deg)" }}>VS</span>
      </div>
      {team(away)}
    </div>
  );
}

const Pin = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z" fill={ORO} /></svg>
);
const Clock = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke={ORO} strokeWidth="2.6" /><path d="M12 6.5V12l3.8 2.4" fill="none" stroke={ORO} strokeWidth="2.6" strokeLinecap="round" /></svg>
);
const Calendar = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2.5" fill="none" stroke={ORO} strokeWidth="2.4" /><path d="M3 10h18M8 2.5v5M16 2.5v5" stroke={ORO} strokeWidth="2.4" strokeLinecap="round" /></svg>
);

/** Icono del tiempo dibujado (las emojis no se pueden dibujar en el póster). */
function SkyIcon({ kind, size }: { kind: Sky; size: number }) {
  const cloud = <path d="M7 18h10.5a4 4 0 0 0 .4-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 7 18z" fill="#e8e8e8" />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {kind === "sun" && <g>
        <circle cx="12" cy="12" r="5" fill={ORO} />
        <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" stroke={ORO} strokeWidth="2" strokeLinecap="round" />
      </g>}
      {kind !== "sun" ? cloud : null}
      {kind === "rain" && <path d="M9 20l-1 2.5M13 20l-1 2.5M17 20l-1 2.5" stroke="#5aa9ff" strokeWidth="2" strokeLinecap="round" />}
      {kind === "snow" && <path d="M9 21h.01M13 22h.01M17 21h.01" stroke="white" strokeWidth="3" strokeLinecap="round" />}
      {kind === "storm" && <path d="M13 17l-3 4h3l-1.5 3" stroke={ORO} strokeWidth="2" fill="none" strokeLinecap="round" />}
    </svg>
  );
}

/** Franja con día, hora y campo. */
function InfoStrip({ day, kickoff, venue, fs = 1 }: { day: string; kickoff: string | null; venue: string | null; fs?: number }) {
  const item = (icon: React.ReactNode, text: string, key: string) => (
    <div key={key} style={{ display: "flex", alignItems: "center", margin: "0 18px" }}>
      <div style={{ display: "flex", marginRight: 10 }}>{icon}</div>
      <span style={{ fontSize: 26 * fs, color: "rgba(255,255,255,0.92)" }}>{text}</span>
    </div>
  );
  const items = [
    item(<Calendar size={28 * fs} />, day, "d"),
    kickoff ? item(<Clock size={28 * fs} />, kickoff, "k") : null,
    venue ? item(<Pin size={28 * fs} />, venue, "v") : null,
  ].filter(Boolean);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", margin: "0 60px", padding: "14px 10px", background: "rgba(0,0,0,0.55)", border: "2px solid rgba(255,255,255,0.1)", borderRadius: 999 }}>
      {items}
    </div>
  );
}

// ---------------------------------------------------------------- Convocatoria

type Group = { line: Line; players: CallupPosterData["players"] };

/**
 * Tamaño de cada camiseta para que la lista quepa en el hueco: se prueba de mayor a menor.
 * Cada línea va en su banda, con el rótulo a la izquierda y las camisetas a la derecha.
 */
function fitTiles(groups: Group[], width: number, height: number) {
  for (const tw of [190, 170, 152, 136, 122, 110, 100, 90, 80]) {
    const perRow = Math.max(1, Math.floor(width / tw));
    const rows = groups.reduce((n, g) => n + Math.ceil(g.players.length / perRow), 0);
    const th = Math.round(tw * 1.02);
    // + separación entre líneas (margen, filete y relleno) + relleno de la caja
    const total = rows * th + (groups.length - 1) * 34 + 48;
    if (total <= height) return { tw, th, perRow };
  }
  return { tw: 80, th: 78, perRow: Math.floor(width / 80) };
}

/**
 * Camiseta para la lista: negra con mangas rojas y cuello y bajo dorados (la porteria, dorada),
 * sin la franja que cruza el pecho, para que el dorsal se lea bien aunque sea pequeña.
 */
function TileJersey({ goalkeeper, size }: { goalkeeper: boolean; size: number }) {
  const body = goalkeeper ? ORO : "#151515";
  const trim = goalkeeper ? NEGRO : ROJO;
  const shape = "M20 2 L26 6 Q32 9 38 6 L44 2 L62 12 L56 26 L50 23 L50 58 L14 58 L14 23 L8 26 L2 12 Z";
  return (
    <svg width={size} height={(size * 60) / 64} viewBox="0 0 64 60">
      <defs><clipPath id="tj"><path d={shape} /></clipPath></defs>
      <g clipPath="url(#tj)">
        <rect width="64" height="60" fill={body} />
        <path d="M44 2 L62 12 L56 26 L50 23 Z M20 2 L2 12 L8 26 L14 23 Z" fill={trim} opacity={goalkeeper ? 0.85 : 1} />
        <rect x="0" y="53" width="64" height="5" fill={goalkeeper ? NEGRO : ORO} opacity={goalkeeper ? 0.6 : 1} />
      </g>
      <path d="M20 2 L26 6 Q32 9 38 6 L44 2" fill="none" stroke={goalkeeper ? NEGRO : ORO} strokeWidth="2.4" />
      <path d={shape} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
    </svg>
  );
}

function PlayerTile({ p, tw, th }: { p: CallupPosterData["players"][number]; tw: number; th: number }) {
  const js = Math.round(tw * 0.66);
  const gk = p.line === "GK";
  const name = p.name.toUpperCase();
  const fs = tw * (name.length > 10 ? 0.15 : name.length > 8 ? 0.17 : 0.2);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: tw, height: th }}>
      <div style={{ display: "flex", position: "relative", width: js, height: (js * 60) / 64 }}>
        <TileJersey goalkeeper={gk} size={js} />
        <div style={{ display: "flex", position: "absolute", top: js * 0.2, left: 0, width: js, justifyContent: "center", fontFamily: "Display", fontSize: js * 0.44, lineHeight: 1, color: gk ? NEGRO : "white" }}>{p.number ?? ""}</div>
      </div>
      <span style={{ display: "flex", marginTop: tw * 0.05, fontFamily: "Display", fontSize: fs, lineHeight: 1, textAlign: "center", justifyContent: "center", width: tw - 6 }}>{name}</span>
    </div>
  );
}

function renderCallup(d: CallupPosterData, format: Format) {
  const { w: W, h: H } = SIZES[format];
  const story = format === "story";

  const groups: Group[] = (["GK", "DEF", "MID", "FWD"] as Line[])
    .map((line) => ({ line, players: d.players.filter((p) => p.line === line) }))
    .filter((g) => g.players.length > 0);

  // Hueco que queda para la lista (lo demás mide más o menos lo mismo siempre)
  const ranked = !!(d.home.rank || d.away.rank);
  const fixed = story ? 110 + 92 + 70 + 200 + 50 + (290 + (ranked ? 50 : 0)) + 50 + 80 + 60 + 210
    : 44 + 78 + 26 + 150 + 22 + (206 + (ranked ? 50 : 0)) + 26 + 70 + 36 + 130;
  const labelW = 150;
  const areaW = W - 120 - 44 - labelW;
  const fit = fitTiles(groups, areaW, H - fixed);

  const list = (
    <div style={{ display: "flex", flexDirection: "column", margin: "0 60px", padding: "22px 22px 22px 22px", background: "linear-gradient(160deg, rgba(20,20,22,0.9) 0%, rgba(8,8,9,0.9) 100%)", border: "2px solid rgba(255,255,255,0.1)", borderLeft: `6px solid ${ROJO}`, borderRadius: 18 }}>
      {groups.map((g, k) => (
        <div key={g.line} style={{ display: "flex", alignItems: "center", marginTop: k ? 18 : 0, paddingTop: k ? 14 : 0, borderTop: k ? "2px solid rgba(255,255,255,0.08)" : "none" }}>
          <div style={{ display: "flex", flexDirection: "column", width: labelW }}>
            <div style={{ display: "flex", width: 34, height: 6, borderRadius: 3, background: LINE_HEX[g.line], marginBottom: 8 }} />
            <span style={{ fontFamily: "Display", fontSize: 26, letterSpacing: 2, color: ORO, lineHeight: 1 }}>{LINE_TITLE[g.line][g.players.length === 1 ? 0 : 1]}</span>
            <span style={{ fontSize: 18, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{g.players.length}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", width: areaW, justifyContent: g.players.length < fit.perRow ? "flex-start" : "flex-start" }}>
            {g.players.map((p, i) => <PlayerTile key={`${p.name}-${i}`} p={p} tw={fit.tw} th={fit.th} />)}
          </div>
        </div>
      ))}
    </div>
  );

  const tree = (
    <div style={{ display: "flex", flexDirection: "column", width: W, height: H, background: "#070707", color: "white", fontFamily: "Text", position: "relative" }}>
      <Backdrop w={W} h={H} glow={ORO} glowY={story ? 0.27 : 0.25} />
      <PosterHeader crest={d.crest} competition={d.competition} day={d.day} story={story} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", marginTop: story ? 70 : 26 }}>
        <Ghost text="CONVOCATORIA" W={W} top={story ? -30 : -24} size={story ? 230 : 200} />
        <Kicker text={`${d.players.length} CONVOCADOS`} />
        <div style={{ display: "flex", marginTop: 4, fontFamily: "Display", fontSize: story ? 150 : 112, lineHeight: 1, letterSpacing: 4, transform: "skewX(-7deg)" }}>CONVOCATORIA</div>
      </div>
      <Duel home={d.home} away={d.away} crestSize={story ? 190 : 120} nameSize={story ? 38 : 32} vsSize={story ? 110 : 84} marginTop={story ? 50 : 22} />
      <div style={{ display: "flex", marginTop: story ? 50 : 26, justifyContent: "center" }}>
        <InfoStrip day={d.day} kickoff={d.kickoff} venue={d.venue} fs={story ? 1.1 : 1} />
      </div>
      <div style={{ display: "flex", flexGrow: 1, flexDirection: "column", justifyContent: "center", paddingTop: story ? 30 : 16, paddingBottom: story ? 40 : 20 }}>
        {list}
      </div>
      <PosterFooter sponsor={d.sponsor} venue={null} story={story} />
    </div>
  );
  return { tree, width: W, height: H };
}

export async function drawCallupPoster(d: CallupPosterData, format: Format) {
  const { tree, width, height } = renderCallup(d, format);
  return drawTree(tree, width, height);
}

// ---------------------------------------------------------------- Hoy jugamos

function renderMatchday(d: MatchdayPosterData, format: Format) {
  const { w: W, h: H } = SIZES[format];
  const story = format === "story";

  // Hora del pitido en grande, y el campo debajo
  const kick = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", }}>
      <span style={{ fontSize: 22, letterSpacing: 8, color: "rgba(255,255,255,0.6)" }}>{d.kickoff ? "PITIDO INICIAL" : "HORA POR CONFIRMAR"}</span>
      {d.kickoff && <span style={{ fontFamily: "Display", fontSize: story ? 190 : 150, lineHeight: 1, color: ORO, transform: "skewX(-7deg)", marginTop: 4 }}>{d.kickoff}</span>}
      {d.venue && (
        <div style={{ display: "flex", alignItems: "center", marginTop: d.kickoff ? 2 : 14 }}>
          <div style={{ display: "flex", marginRight: 10 }}><Pin size={story ? 36 : 32} /></div>
          <span style={{ fontFamily: "Display", fontSize: story ? 46 : 40, letterSpacing: 2, textTransform: "uppercase" }}>{d.venue}</span>
        </div>
      )}
    </div>
  );

  // Cómo llegamos: racha, clasificación y el tiempo
  const sc = story ? 1.25 : 1;     // en la historia hay sitio: todo un poco más grande
  const label = (s: string) => <span style={{ fontSize: 17 * sc, letterSpacing: 4, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>{s}</span>;
  const blocks: React.ReactNode[] = [];
  if (d.form.length > 0) {
    blocks.push(
      <div key="f" style={{ display: "flex", flexDirection: "column" }}>
        {label("NUESTRA RACHA")}
        <div style={{ display: "flex" }}>
          {d.form.map((r, k) => (
            <div key={k} style={{ display: "flex", width: 38 * sc, height: 38 * sc, marginRight: 6, alignItems: "center", justifyContent: "center", borderRadius: 6, background: FORM_BG[r], color: r === "W" ? NEGRO : "white", fontFamily: "Display", fontSize: 26 * sc }}>{FORM_LETTER[r]}</div>
          ))}
        </div>
      </div>,
    );
  }
  if (d.gap) {
    blocks.push(
      <div key="g" style={{ display: "flex", flexDirection: "column" }}>
        {label("CLASIFICACIÓN")}
        <span style={{ fontFamily: "Display", fontSize: 30 * sc, lineHeight: 1.1, textTransform: "uppercase", color: "white" }}>{d.gap}</span>
      </div>,
    );
  }
  if (d.weather) {
    blocks.push(
      <div key="w" style={{ display: "flex", flexDirection: "column" }}>
        {label("EL TIEMPO")}
        <div style={{ display: "flex", alignItems: "center" }}>
          <SkyIcon kind={d.weather.kind} size={42 * sc} />
          <span style={{ fontFamily: "Display", fontSize: 40 * sc, lineHeight: 1, marginLeft: 10, color: ORO }}>{d.weather.temp}º</span>
          <span style={{ fontSize: 20 * sc, marginLeft: 10, color: "rgba(255,255,255,0.8)" }}>{d.weather.text}</span>
        </div>
      </div>,
    );
  }
  const context = blocks.length > 0 && (
    <div style={{ display: "flex", alignItems: "center", justifyContent: blocks.length === 1 ? "center" : "space-between", margin: "0 60px", padding: story ? "26px 30px" : "18px 28px", background: "rgba(0,0,0,0.6)", border: "2px solid rgba(255,255,255,0.1)", borderRadius: 16 }}>
      {blocks.flatMap((b, k) => (k ? [<div key={`s${k}`} style={{ display: "flex", width: 2, height: 62, background: "rgba(255,255,255,0.12)" }} />, b] : [b]))}
    </div>
  );

  const tree = (
    <div style={{ display: "flex", flexDirection: "column", width: W, height: H, background: "#070707", color: "white", fontFamily: "Text", position: "relative" }}>
      <Backdrop w={W} h={H} glow={ROJO} glowY={story ? 0.36 : 0.42} />
      <PosterHeader crest={d.crest} competition={d.competition} day={d.day} story={story} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", marginTop: story ? 70 : 26 }}>
        <Ghost text="MATCHDAY" W={W} top={story ? -40 : -34} size={story ? 320 : 280} />
        <Kicker text="DÍA DE PARTIDO" />
        <div style={{ display: "flex", marginTop: 4, fontFamily: "Display", fontSize: (d.title.length > 14 ? 0.82 : 1) * (story ? 160 : 124), lineHeight: 1, letterSpacing: 4, transform: "skewX(-7deg)" }}>{d.title}</div>
      </div>
      <Duel home={d.home} away={d.away} crestSize={story ? 230 : 170} nameSize={story ? 42 : 36} vsSize={story ? 130 : 100} marginTop={story ? 70 : 26} />
      <div style={{ display: "flex", flexGrow: 1, flexDirection: "column", justifyContent: "center", paddingBottom: story ? 30 : 16 }}>{kick}</div>
      {context && <div style={{ display: "flex", flexDirection: "column", marginBottom: story ? 50 : 26 }}>{context}</div>}
      <PosterFooter sponsor={d.sponsor} venue={null} story={story} />
    </div>
  );
  return { tree, width: W, height: H };
}

export async function drawMatchdayPoster(d: MatchdayPosterData, format: Format) {
  const { tree, width, height } = renderMatchday(d, format);
  return drawTree(tree, width, height);
}
