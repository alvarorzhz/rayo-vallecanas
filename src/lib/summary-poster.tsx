import "server-only";
import { Backdrop, Kicker, MvpCard, ORO, PosterFooter, PosterHeader, SIZES, drawTree, type Format, type Pic } from "@/lib/result-image";

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
  sponsor: Pic | null;
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
      <PosterFooter sponsor={d.sponsor} venue={null} story={story} />
    </div>
  );
  return drawTree(tree, W, H);
}
