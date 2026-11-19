import "server-only";
import { Backdrop, BallIcon, Bolt, Kicker, MvpCard, NEGRO, ORO, PosterFooter, PosterHeader, ROJO, SIZES, drawTree, type Format, type Pic } from "@/lib/result-image";
import type { Slide } from "@/lib/wrapped";
import type { Wrapped } from "@/lib/wrapped-server";
import { embed } from "@/lib/poster-sources";

/** Imagen del resumen de temporada de un jugador (v4.9.0), con el estilo póster de las demás. */
export type SummaryPosterData = {
  crest: Pic;
  scope: string;                 // «APERTURA 2026/27» o «TEMPORADA 2026/27»
  title: string;                 // «PICHICHI»
  line: string;                  // «Máximo goleador del equipo con 6 goles»
  player: { name: string; number: number | null; position: string; goalkeeper: boolean; photo: Pic | null; goals: number; assists: number };
  stats: { label: string; value: number }[];
  best: string | null;           // «Su mejor partido: Rayo 4-0 Charros · 3 goles»
  team: string;                  // «El equipo: 3V 1E 1D · 12 goles»
  /** Patrocinadores principales (como mucho 3), en el orden de Gestión. */
  sponsors: Pic[];
};

export async function drawSummaryPoster(d: SummaryPosterData, format: Format) {
  const { w: W, h: H } = SIZES[format];
  const story = format === "story";
  const cardW = story ? 420 : 330;
  const tree = (
    <div style={{ display: "flex", flexDirection: "column", width: W, height: H, background: "#070707", color: "white", fontFamily: "Text", position: "relative" }}>
      <Backdrop w={W} h={H} glow={ORO} glowY={story ? 0.4 : 0.42} />
      <PosterHeader crest={d.crest} competition="RESUMEN" day={d.scope} story={story} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: story ? 70 : 22 }}>
        <Kicker text={d.scope} />
        <div style={{ display: "flex", fontFamily: "Display", fontSize: (d.title.length > 11 ? 0.8 : 1) * (story ? 150 : 112), lineHeight: 1, letterSpacing: 4, color: ORO, transform: "skewX(-7deg)", marginTop: 6 }}>{d.title.toUpperCase()}</div>
        <span style={{ fontSize: story ? 32 : 26, color: "rgba(255,255,255,0.85)", marginTop: 6 }}>{d.line}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: story ? 80 : 36 }}>
        <MvpCard mvp={d.player} crest={d.crest} w={cardW} label={d.title.toUpperCase()} />
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: story ? 60 : 26 }}>
        {d.stats.map((s, k) => (
          <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: story ? 220 : 200, borderLeft: k ? "2px solid rgba(255,255,255,0.15)" : "none" }}>
            <span style={{ fontFamily: "Display", fontSize: story ? 110 : 84, lineHeight: 1, color: "white" }}>{s.value}</span>
            <span style={{ fontSize: story ? 22 : 19, letterSpacing: 5, color: "rgba(255,255,255,0.6)" }}>{s.label.toUpperCase()}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexGrow: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 60px" }}>
        {d.best && <span style={{ fontSize: story ? 30 : 25, color: ORO, textAlign: "center" }}>{d.best}</span>}
        <span style={{ fontSize: story ? 26 : 22, color: "rgba(255,255,255,0.7)", marginTop: 8, textAlign: "center" }}>{d.team}</span>
      </div>
      <PosterFooter sponsors={d.sponsors} venue={null} story={story} />
    </div>
  );
  return drawTree(tree, W, H);
}

// ---------------------------------------------------------------- Rayo Wrapped (4.23.0)

/** Una historia del Rayo Wrapped como imagen, con los mismos textos que en la pantalla. */
export type WrappedCardData = { crest: Pic; scope: string; player: string; slide: Slide; sponsors: Pic[] };

const RESULT_BG = { W: ORO, D: "#6b6b6b", L: ROJO } as const;

function CardExtra({ x, story }: { x: NonNullable<Slide["extra"]>; story: boolean }) {
  const k = story ? 1 : 0.8;
  if (x.kind === "calendar") {
    const size = Math.max(34, Math.min(70, Math.floor(880 / Math.max(1, x.games.length)) - 10)) * k;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", width: 900 }}>
        {x.games.map((g, n) => (
          <div key={n} style={{ display: "flex", width: size, height: size, margin: 5, borderRadius: 10, background: g.played ? RESULT_BG[g.result] : "rgba(255,255,255,0.04)", border: g.played ? "none" : "3px solid rgba(255,255,255,0.3)" }} />
        ))}
      </div>
    );
  }
  if (x.kind === "balls" || x.kind === "stars") {
    const n = x.kind === "balls" ? Math.min(24, x.goals) : Math.min(12, x.n);
    const a = x.kind === "balls" ? Math.min(24 - n, x.assists) : 0;
    const size = (n + a > 12 ? 52 : 70) * k;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", width: 860 }}>
        {Array.from({ length: n + a }, (_, j) => (
          <div key={j} style={{ display: "flex", width: size, height: size, margin: 6, borderRadius: x.kind === "stars" ? 0 : size, alignItems: "center", justifyContent: "center",
            opacity: j < n ? 1 : 0.35 }}>
            {x.kind === "balls" && <BallIcon size={size} />}
            {x.kind === "stars" && (
              <svg width={size} height={size} viewBox="0 0 24 24"><polygon points="12,1.5 15.1,8.3 22.5,9.1 17,14.1 18.5,21.5 12,17.8 5.5,21.5 7,14.1 1.5,9.1 8.9,8.3" fill={ORO} /></svg>
            )}
          </div>
        ))}
      </div>
    );
  }
  if (x.kind === "score") {
    const side = (t: string, g: number, us: boolean) => (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 330 }}>
        <span style={{ fontFamily: "Display", fontSize: 200 * k, lineHeight: 1, color: us ? ORO : "white" }}>{g}</span>
        <span style={{ fontFamily: "Display", fontSize: 40 * k, letterSpacing: 2, color: us ? ORO : "rgba(255,255,255,0.8)", textAlign: "center" }}>{t.toUpperCase()}</span>
      </div>
    );
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "rgba(0,0,0,0.55)", border: `3px solid ${ORO}`, borderRadius: 26, padding: "26px 30px" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {side(x.home, x.homeGoals, x.homeUs)}
          <span style={{ fontFamily: "Display", fontSize: 90 * k, color: "rgba(255,255,255,0.4)" }}>-</span>
          {side(x.away, x.awayGoals, !x.homeUs)}
        </div>
        <span style={{ fontSize: 26 * k, letterSpacing: 6, color: "rgba(255,255,255,0.6)", marginTop: 8 }}>{x.date.toUpperCase()}</span>
      </div>
    );
  }
  if (x.kind === "bars") {
    const bar = (label: string, p: number, gold: boolean) => (
      <div style={{ display: "flex", alignItems: "center", marginTop: 18 }}>
        <span style={{ display: "flex", width: 200, fontFamily: "Display", fontSize: 40 * k, color: "rgba(255,255,255,0.8)" }}>{label}</span>
        <div style={{ display: "flex", width: 520, height: 54 * k, background: "rgba(255,255,255,0.1)", borderRadius: 12 }}>
          <div style={{ display: "flex", width: Math.max(6, 5.2 * p), height: "100%", background: gold ? ORO : "rgba(255,255,255,0.45)", borderRadius: 12 }} />
        </div>
        <span style={{ display: "flex", width: 140, justifyContent: "flex-end", fontFamily: "Display", fontSize: 46 * k, color: gold ? ORO : "white" }}>{p} %</span>
      </div>
    );
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {bar("CON", x.withPct, true)}
        {x.withoutPct !== null && bar("SIN", x.withoutPct, false)}
      </div>
    );
  }
  if (x.kind === "partner") {
    const chip = (t: string, gold: boolean) => (
      <div style={{ display: "flex", padding: "14px 30px", borderRadius: 18, background: gold ? ORO : "white", color: NEGRO, fontFamily: "Display", fontSize: 54 * k, letterSpacing: 2 }}>{t.toUpperCase()}</div>
    );
    return (
      <div style={{ display: "flex", alignItems: "center" }}>
        {chip(x.me, false)}
        <div style={{ display: "flex", margin: "0 22px" }}><Bolt size={74 * k} /></div>
        {chip(x.partner, true)}
      </div>
    );
  }
  return null;
}

export async function drawWrappedCard(d: WrappedCardData, format: Format) {
  const { w: W, h: H } = SIZES[format];
  const story = format === "story";
  const s = d.slide;
  const numeric = s.count !== undefined;
  const glow = s.tone === "rojo" ? ROJO : ORO;
  // Lo grande: cifras enormes; nombres y marcadores, a la medida del ancho
  const bigSize = numeric ? (s.big.length > 3 ? 320 : 420) * (story ? 1 : 0.74) : Math.min(story ? 180 : 140, Math.floor(1800 / Math.max(6, s.big.length)));
  const tree = (
    <div style={{ display: "flex", flexDirection: "column", width: W, height: H, background: "#070707", color: "white", fontFamily: "Text", position: "relative" }}>
      <Backdrop w={W} h={H} glow={glow} glowY={story ? 0.42 : 0.45} />
      <PosterHeader crest={d.crest} competition="WRAPPED" day={d.scope} story={story} />
      <div style={{ display: "flex", flexGrow: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 60px" }}>
        <Kicker text={s.kicker} />
        <span style={{ fontFamily: "Display", fontSize: story ? 48 : 34, letterSpacing: 6, color: "rgba(255,255,255,0.7)", marginTop: 14 }}>{d.player.toUpperCase()}</span>
        {s.extra?.kind !== "score" && (
          <div style={{ display: "flex", fontFamily: "Display", fontSize: bigSize, lineHeight: 1, letterSpacing: 2, color: numeric ? "white" : ORO, transform: "skewX(-7deg)", marginTop: story ? 30 : 16, textAlign: "center" }}>
            {s.big.toUpperCase()}
          </div>
        )}
        {s.unit && <span style={{ fontFamily: "Display", fontSize: story ? 76 : 52, letterSpacing: 3, color: ORO, marginTop: 4, textAlign: "center" }}>{s.unit.toUpperCase()}</span>}
        {s.extra && s.extra.kind !== "card" && <div style={{ display: "flex", marginTop: story ? 60 : 30 }}><CardExtra x={s.extra} story={story} /></div>}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: story ? 60 : 30 }}>
          {s.lines.filter(Boolean).map((l, n) => (
            <span key={n} style={{ fontSize: story ? 44 : 32, color: n ? "rgba(255,255,255,0.75)" : "white", marginTop: n ? 10 : 0, textAlign: "center" }}>{l}</span>
          ))}
        </div>
      </div>
      <PosterFooter sponsors={d.sponsors} venue={null} story={story} />
    </div>
  );
  return drawTree(tree, W, H);
}

/** Los datos del póster del resumen a partir de lo que carga loadWrapped (resumen y Wrapped usan el mismo). */
export async function summaryPosterData(w: Wrapped, crest: Pic, sponsors: Pic[]): Promise<SummaryPosterData> {
  const s = w.summary, t = w.team;
  const photo = await embed(w.entry.player.photo_url, ["player-photos", "avatars"], { max: 0, photo: { w: 311, h: 321 } });
  const b = s.best && (s.best.goals || s.best.assists || s.best.mvp) ? s.best : null;
  return {
    crest,
    scope: w.scopeLabel.toUpperCase(),
    title: s.badge.title,
    line: s.badge.line,
    player: { name: w.name, number: w.entry.number, position: w.entry.position, goalkeeper: w.gk, photo, goals: s.goals, assists: s.assists },
    stats: w.gk
      ? [{ label: "Partidos", value: s.apps }, { label: "A cero", value: s.cleanSheets }, { label: "MVP", value: s.mvps }]
      : [{ label: "Partidos", value: s.apps }, { label: "Goles", value: s.goals }, { label: "Asist.", value: s.assists }, { label: "MVP", value: s.mvps }],
    best: b ? `Su mejor partido: ${b.match.is_home ? `Rayo ${b.match.goals_for}-${b.match.goals_against} ${b.match.rival}` : `${b.match.rival} ${b.match.goals_against}-${b.match.goals_for} Rayo`}${b.goals ? ` · ${b.goals} ${b.goals === 1 ? "gol" : "goles"}` : ""}${b.mvp ? " · MVP" : ""}` : null,
    team: `El equipo: ${t.W}V ${t.D}E ${t.L}D · ${t.gf} goles a favor`,
    sponsors,
  };
}
