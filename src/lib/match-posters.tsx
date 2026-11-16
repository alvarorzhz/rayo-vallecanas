import "server-only";
import type { Outcome } from "@/lib/matches";
import type { Line } from "@/lib/squad";
import {
  Backdrop, CrestImg, Kicker, NEGRO, ORO, ORO_CLARO, PosterFooter, PosterHeader, ROJO, SIZES, drawTree,
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
  form: Outcome[];               // últimos 3 resultados (el más reciente al final)
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
  players: { name: string; number: number | null; line: Line; photo: Pic | null }[];
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

// ---------------------------------------------------------------- Convocatoria

type CallupPlayer = CallupPosterData["players"][number];

const LINE_ORDER: Line[] = ["GK", "DEF", "MID", "FWD"];
/** Solo la línea, no la posición exacta: así la imagen no da pistas al rival. */
const LINE_CODE: Record<Line, string> = { GK: "POR", DEF: "DEF", MID: "MED", FWD: "DEL" };
const CARD_RATIO = 1.3;          // alto / ancho de cada cromo
/** Tamaño al que se recortan las fotos de los cromos (lo justo para el cromo más grande). */
export const PHOTO_BOX = { w: 300, h: 260 };

/**
 * Filas de cromos (v4.18.0): una por línea de juego (portería, defensa, medio y delantera), centradas.
 * Si una línea no cabe en una fila se parte en dos. Se prueba cuántos caben por fila y se queda con el
 * reparto que deja el cromo más grande sin salirse del hueco ni pasar de `max`.
 */
export function fitCards(lines: number[], width: number, height: number, gap: number, max: number) {
  const widest = Math.max(1, ...lines);
  let best = { w: 0, rows: [] as number[] };
  for (let cols = Math.min(widest, 6); cols >= Math.min(widest, 3); cols--) {
    const rows = lines.flatMap((n) => {
      const parts = Math.ceil(n / cols), base = Math.floor(n / parts), extra = n % parts;
      return Array.from({ length: parts }, (_, k) => base + (k < extra ? 1 : 0));
    });
    const used = Math.max(...rows);
    const w = Math.min(max, (width - (used - 1) * gap) / used, (height - (rows.length - 1) * gap) / rows.length / CARD_RATIO);
    if (w > best.w) best = { w, rows };
  }
  return { w: Math.floor(best.w), rows: best.rows };
}

/**
 * Camiseta para el cromo sin foto: negra con mangas rojas y cuello y bajo dorados (la del portero,
 * dorada), sin la franja que cruza el pecho, para que el dorsal se lea bien.
 */
function TileJersey({ goalkeeper, size }: { goalkeeper: boolean; size: number }) {
  const body = goalkeeper ? "#1a1a1a" : "#151515";
  const trim = goalkeeper ? ORO : ROJO;
  const shape = "M20 2 L26 6 Q32 9 38 6 L44 2 L62 12 L56 26 L50 23 L50 58 L14 58 L14 23 L8 26 L2 12 Z";
  return (
    <svg width={size} height={(size * 60) / 64} viewBox="0 0 64 60">
      <defs><clipPath id="tj"><path d={shape} /></clipPath></defs>
      <g clipPath="url(#tj)">
        <rect width="64" height="60" fill={body} />
        <path d="M44 2 L62 12 L56 26 L50 23 Z M20 2 L2 12 L8 26 L14 23 Z" fill={trim} />
        <rect x="0" y="53" width="64" height="5" fill={ORO} />
      </g>
      <path d="M20 2 L26 6 Q32 9 38 6 L44 2" fill="none" stroke={ORO} strokeWidth="2.4" />
      <path d={shape} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
    </svg>
  );
}

/**
 * Cromo de cada convocado, con la silueta de los de la plantilla: negro con filo dorado (el del
 * portero, dorado), dorsal y posición arriba a la izquierda, foto (o camiseta) y el nombre abajo.
 */
function PlayerCard({ p, w, crest }: { p: CallupPlayer; w: number; crest: Pic }) {
  const h = Math.round(w * CARD_RATIO);
  const gk = p.line === "GK";
  const ink = gk ? NEGRO : "white";
  const accent = gk ? NEGRO : ORO;
  const id = `c${p.number ?? 0}${gk ? "g" : "o"}`;
  const shape = (i: number) => `${w * 0.13 + i * 0.4},${i} ${w * 0.87 - i * 0.4},${i} ${w - i},${h * 0.07 + i * 0.4} ${w - i},${h * 0.91 - i * 0.25} ${w / 2},${h - i * 1.15} ${i},${h * 0.91 - i * 0.25} ${i},${h * 0.07 + i * 0.4}`;
  const rim = Math.max(3, w * 0.02);
  const photoW = Math.round(p.photo ? w - rim * 3 : w * 0.8), photoH = Math.round(h * 0.63);
  const face = gk ? "rgba(226,190,80," : "rgba(24,24,26,";     // color del cromo detrás de la foto
  const name = p.name.toUpperCase();
  const fs = Math.min(w * 0.17, (w * 0.86) / Math.max(1, name.length * 0.47));
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", top: 0, left: 0 }}>
        <defs>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="0.7" y2="1">
            {gk ? <stop offset="0" stopColor="#fdf0b4" /> : <stop offset="0" stopColor="#2a2a2e" />}
            {gk ? <stop offset="0.4" stopColor="#e6c65a" /> : <stop offset="0.45" stopColor="#141416" />}
            {gk ? <stop offset="1" stopColor="#a57d14" /> : <stop offset="1" stopColor="#0a0a0b" />}
          </linearGradient>
          <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={ORO_CLARO} />
            <stop offset="0.5" stopColor={ORO} />
            <stop offset="1" stopColor="#8a6a12" />
          </linearGradient>
        </defs>
        <polygon points={shape(0)} fill={`url(#${id}r)`} />
        <polygon points={shape(rim)} fill={`url(#${id}f)`} />
        {/* Franja del Rayo cruzando el cromo */}
        <polygon points={`${w * 0.66},${rim} ${w * 0.8},${rim} ${w * 0.12},${h * 0.66} ${w * 0.02},${h * 0.66}`} fill={ROJO} opacity={gk ? 0.8 : 0.7} />
        <polygon points={`${w * 0.83},${rim} ${w * 0.87},${rim} ${w * 0.19},${h * 0.66} ${w * 0.15},${h * 0.66}`} fill={gk ? NEGRO : ORO} opacity={gk ? 0.55 : 0.6} />
        {/* Pie oscuro para el nombre */}
        <polygon points={`${rim},${h * 0.7} ${w - rim},${h * 0.7} ${w - rim},${h * 0.91 - rim * 0.25} ${w / 2},${h - rim * 1.15} ${rim},${h * 0.91 - rim * 0.25}`} fill={gk ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.55)"} />
        <polygon points={shape(rim * 2.2)} fill="none" stroke={gk ? NEGRO : ORO} strokeOpacity={gk ? 0.3 : 0.35} strokeWidth={Math.max(1, w * 0.006)} />
      </svg>
      {/* Foto o camiseta con el dorsal */}
      <div style={{ display: "flex", position: "absolute", top: h * 0.07, left: p.photo ? rim * 1.5 : w * 0.17, width: photoW, height: photoH, alignItems: "flex-end", justifyContent: "center" }}>
        {p.photo ? (
          <div style={{ display: "flex", position: "relative", width: photoW, height: photoH }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.photo.src} width={photoW} height={photoH} style={{ objectFit: "cover" }} alt="" />
            {/* La foto se funde con el cromo por la izquierda y por arriba (por abajo ya viene fundida) */}
            <div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: photoW * 0.5, height: photoH, background: `linear-gradient(90deg, ${face}0.92) 0%, ${face}0.7) 40%, ${face}0) 100%)` }} />
            <div style={{ display: "flex", position: "absolute", top: 0, right: 0, width: photoW * 0.14, height: photoH, background: `linear-gradient(270deg, ${face}0.8) 0%, ${face}0) 100%)` }} />
            <div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: photoW, height: photoH * 0.22, background: `linear-gradient(180deg, ${face}1) 0%, ${face}0) 100%)` }} />
          </div>
        ) : (
          <div style={{ display: "flex", position: "relative", marginBottom: h * 0.04 }}>
            <TileJersey goalkeeper={gk} size={w * 0.6} />
            <div style={{ display: "flex", position: "absolute", top: w * 0.13, left: 0, width: w * 0.6, justifyContent: "center", fontFamily: "Display", fontSize: w * 0.27, lineHeight: 1, color: "white" }}>{p.number ?? ""}</div>
          </div>
        )}
      </div>
      {/* Dorsal, posición y escudo */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "absolute", top: h * 0.07, left: w * 0.07, color: accent }}>
        <span style={{ fontFamily: "Display", fontSize: w * 0.25, lineHeight: 0.9 }}>{p.number ?? "–"}</span>
        <span style={{ fontFamily: "Display", fontSize: w * 0.11, lineHeight: 1, marginTop: w * 0.01, color: ink }}>{LINE_CODE[p.line]}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={crest.src} width={Math.round(w * 0.13)} height={Math.round((w * 0.13) / crest.ratio)} style={{ marginTop: w * 0.035 }} alt="" />
      </div>
      {/* Nombre */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "absolute", top: h * 0.715, left: 0, width: w }}>
        <span style={{ fontFamily: "Display", fontSize: fs, lineHeight: 1, color: ink, letterSpacing: w * 0.004 }}>{name}</span>
        <div style={{ display: "flex", width: w * 0.32, height: Math.max(2, w * 0.014), marginTop: w * 0.035, background: gk ? NEGRO : ORO, opacity: gk ? 0.5 : 0.9 }} />
      </div>
    </div>
  );
}

/** Los dos equipos en una sola franja, con el día, la hora y el campo debajo. */
function MatchBar({ d, story }: { d: CallupPosterData; story: boolean }) {
  const cs = story ? 116 : 80;
  const fb = story ? 32 : 26;    // casillas de la racha
  const team = (t: Team, right: boolean) => (
    <div style={{ display: "flex", alignItems: "center", flexDirection: right ? "row-reverse" : "row", width: 400 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: cs + 20 }}>
        <div style={{ display: "flex", width: cs, height: cs, alignItems: "center", justifyContent: "center" }}>
          <CrestImg crest={t.crest} short={t.short} color={t.color} size={cs} />
        </div>
        {t.form.length > 0 && (
          <div style={{ display: "flex", marginTop: story ? 10 : 8 }}>
            {t.form.map((r, k) => (
              <div key={k} style={{ display: "flex", width: fb, height: fb, marginLeft: k ? 5 : 0, alignItems: "center", justifyContent: "center", borderRadius: 5, background: FORM_BG[r], color: r === "W" ? NEGRO : "white", fontFamily: "Display", fontSize: fb * 0.68, lineHeight: 1 }}>{FORM_LETTER[r]}</div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: right ? "flex-end" : "flex-start", margin: right ? "0 18px 0 0" : "0 0 0 18px", flexShrink: 1 }}>
        <span style={{ fontFamily: "Display", fontSize: (t.name.length > 16 ? 0.8 : 1) * (story ? 32 : 32), lineHeight: 1, textTransform: "uppercase", color: t.isUs ? ORO : "white", textAlign: right ? "right" : "left" }}>{t.name}</span>
        {t.rank && (
          <span style={{ display: "flex", fontSize: story ? 22 : 19, color: "rgba(255,255,255,0.65)", marginTop: 6 }}>
            {`${t.rank.pos}º · ${t.rank.points} ${t.rank.points === 1 ? "PT" : "PTS"}`}
          </span>
        )}
      </div>
    </div>
  );
  const fs = story ? 1.05 : 0.9;
  const item = (icon: React.ReactNode, text: string, key: string) => (
    <div key={key} style={{ display: "flex", alignItems: "center", margin: "0 16px" }}>
      <div style={{ display: "flex", marginRight: 9 }}>{icon}</div>
      <span style={{ fontSize: 25 * fs, color: "rgba(255,255,255,0.92)" }}>{text}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", margin: "0 60px", background: "rgba(0,0,0,0.55)", border: "2px solid rgba(255,255,255,0.1)", borderRadius: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: story ? "22px 24px" : "14px 20px" }}>
        {team(d.home, false)}
        <span style={{ fontFamily: "Display", fontSize: story ? 64 : 52, lineHeight: 1, color: ORO, transform: "skewX(-7deg)" }}>VS</span>
        {team(d.away, true)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", padding: story ? "16px 10px" : "11px 10px", borderTop: "2px solid rgba(255,255,255,0.08)" }}>
        {item(<Calendar size={26 * fs} />, d.day, "d")}
        {d.kickoff ? item(<Clock size={26 * fs} />, d.kickoff, "k") : null}
        {d.venue ? item(<Pin size={26 * fs} />, d.venue, "v") : null}
      </div>
    </div>
  );
}

function renderCallup(d: CallupPosterData, format: Format) {
  const { w: W, h: H } = SIZES[format];
  const story = format === "story";

  // Por líneas (portería, defensa, medio y delantera), cada una en su fila, y dentro como vengan
  const by = (line: Line) => d.players.filter((p) => p.line === line).length;
  const players = LINE_ORDER.flatMap((line) => d.players.filter((p) => p.line === line));

  // Hueco que queda para los cromos (lo demás mide siempre lo mismo)
  const fixed = story ? 945 : 605;   // medido en las imágenes de prueba (cabecera, titular, franja del partido y pie)
  const gap = story ? 22 : 16;
  // Si no caben bien, los porteros comparten fila con los defensas y los medios con los delanteros
  const [gk, df, md, fw] = [by("GK"), by("DEF"), by("MID"), by("FWD")];
  const options = [[gk, df, md, fw], [gk + df, md, fw], [gk, df, md + fw], [gk + df, md + fw]]
    .map((o) => fitCards(o.filter((n) => n > 0), W - 120 - (o.length < 4 ? gap * 2 : 0), H - fixed, gap, story ? 230 : 180));
  const fit = options.reduce((best, o) => (o.w > best.w * 1.08 ? o : best));   // juntar solo si el cromo crece de verdad

  let k = 0;
  const grid = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {fit.rows.map((count, r) => (
        <div key={r} style={{ display: "flex", justifyContent: "center", marginTop: r ? gap : 0 }}>
          {players.slice(k, (k += count)).map((p, i, row) => (
            // Un poco más de aire donde cambia la línea, si comparten fila
            <div key={`${p.name}-${i}`} style={{ display: "flex", marginLeft: !i ? 0 : row[i - 1].line !== p.line ? gap * 3 : gap }}>
              <PlayerCard p={p} w={fit.w} crest={d.crest} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  const tree = (
    <div style={{ display: "flex", flexDirection: "column", width: W, height: H, background: "#070707", color: "white", fontFamily: "Text", position: "relative" }}>
      <Backdrop w={W} h={H} glow={ORO} glowY={story ? 0.55 : 0.6} />
      <PosterHeader crest={d.crest} competition={d.competition} day={d.day} story={story} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", marginTop: story ? 60 : 20 }}>
        <Ghost text="CONVOCATORIA" W={W} top={story ? -26 : -18} size={story ? 200 : 160} />
        <Kicker text={`${d.players.length} ${d.players.length === 1 ? "CONVOCADO" : "CONVOCADOS"}`} />
        <div style={{ display: "flex", marginTop: 2, fontFamily: "Display", fontSize: story ? 120 : 88, lineHeight: 1, letterSpacing: 4, transform: "skewX(-7deg)" }}>CONVOCATORIA</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: story ? 50 : 20 }}>
        <MatchBar d={d} story={story} />
      </div>
      <div style={{ display: "flex", flexGrow: 1, flexDirection: "column", justifyContent: "center", paddingTop: story ? 30 : 16, paddingBottom: story ? 40 : 22 }}>
        {grid}
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
