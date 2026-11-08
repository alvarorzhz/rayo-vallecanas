import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { fetchMatch, fetchReport } from "@/lib/match-queries";
import { CLUB_NAME, COMPETITION_LABEL, OUTCOME_LABEL, longDay, outcomeOf, rivalColor, rivalShort } from "@/lib/matches";
import { shirtName } from "@/lib/squad";
import { fetchDisplay, type Showcase } from "@/lib/sponsors";

export const runtime = "nodejs";

let assets: Promise<{ black: Buffer; semi: Buffer; crest: string }> | null = null;
const load = () =>
  (assets ??= Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/BarlowCondensed-Black.ttf")),
    readFile(join(process.cwd(), "src/assets/fonts/Barlow-SemiBold.ttf")),
    readFile(join(process.cwd(), "public/escudo.png")),
  ]).then(([black, semi, crest]) => ({ black, semi, crest: `data:image/png;base64,${crest.toString("base64")}` })));

/** Logo del patrocinador principal como data URI, con su proporción (PNG) para dibujarlo sin deformar. */
async function sponsorLogo(url: string): Promise<{ src: string; ratio: number } | null> {
  try {
    let buf: Buffer;
    if (url.startsWith("/")) {
      if (!/^\/patrocinadores\/[\w.-]+\.(png|jpe?g)$/.test(url)) return null;
      buf = await readFile(join(process.cwd(), "public", url));
    } else {
      // Solo logos subidos a nuestro almacenamiento
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!base || !url.startsWith(`${base.replace(/\/$/, "")}/storage/v1/object/public/sponsor-logos/`)) return null;
      const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) return null;
      buf = Buffer.from(await r.arrayBuffer());
    }
    const png = buf.subarray(1, 4).toString("ascii") === "PNG";
    const jpg = buf[0] === 0xff && buf[1] === 0xd8;
    if (!png && !jpg) return null;
    const ratio = png ? buf.readUInt32BE(16) / Math.max(1, buf.readUInt32BE(20)) : 1.6;
    return { src: `data:image/${png ? "png" : "jpeg"};base64,${buf.toString("base64")}`, ratio };
  } catch {
    return null;
  }
}

/** Imagen del resultado (1080 × 1350) para compartir en WhatsApp o Instagram. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return new Response("Sin sesión", { status: 401 });
  const m = await fetchMatch(supabase, id);
  if (!m || m.status !== "played") return new Response("No encontrado", { status: 404 });
  const [report, { black, semi, crest }, display, showcase] = await Promise.all([
    fetchReport(supabase, m), load(), fetchDisplay(supabase), supabase.rpc("sponsor_showcase"),
  ]);
  // Patrocinador principal (si los gestores lo tienen activado): pequeño, encima del pie
  const main = display.show_result ? ((showcase.data ?? []) as Showcase[]).find((x) => x.tier === "main" && x.logo_url) : undefined;
  const sponsor = main ? await sponsorLogo(main.logo_url!) : null;
  const logoH = 76;
  const logoW = sponsor ? Math.round(Math.min(240, Math.max(60, logoH * sponsor.ratio))) : 0;

  const o = outcomeOf(m)!;
  const us = { name: CLUB_NAME, crest: crest as string | null, goals: m.goals_for ?? 0, short: "RVA", color: "#D20D17" };
  const them = { name: m.rival.name, crest: m.rival.crest_url, goals: m.goals_against ?? 0, short: rivalShort(m.rival), color: rivalColor(m.rival) };
  const [a, b] = m.is_home ? [us, them] : [them, us];

  // Goleadores agrupados: «EISIEL ×2»
  const count = new Map<string, number>();
  for (const g of report.goals) {
    const n = g.own_goal ? "En propia puerta" : g.scorer ? shirtName(g.scorer.player) : null;
    if (n) count.set(n, (count.get(n) ?? 0) + 1);
  }
  const scorers = [...count].map(([n, k]) => (k > 1 ? `${n} ×${k}` : n));
  const tone = o === "W" ? "#16A34A" : o === "L" ? "#D20D17" : "#A3A3A3";

  const team = (t: typeof us) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 340 }}>
      {t.crest ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.crest} width={220} height={220} style={{ objectFit: "contain" }} alt="" />
      ) : (
        <div style={{ display: "flex", width: 200, height: 220, alignItems: "center", justifyContent: "center", background: t.color, borderRadius: "30px 30px 100px 100px", border: "8px solid rgba(255,255,255,0.85)", fontFamily: "Display", fontSize: 72, color: "white" }}>{t.short}</div>
      )}
      <div style={{ display: "flex", marginTop: 24, fontFamily: "Display", fontSize: 50, lineHeight: 1, textAlign: "center", textTransform: "uppercase", color: "white" }}>{t.name}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: 1080, height: 1350, background: "#080808", color: "white", fontFamily: "Text", position: "relative", overflow: "hidden" }}>
        {/* Franja del Rayo */}
        <div style={{ position: "absolute", top: -200, left: 560, width: 190, height: 1900, background: "#D20D17", transform: "rotate(24deg)" }} />
        <div style={{ position: "absolute", top: -200, left: 770, width: 38, height: 1900, background: "#D5AF32", transform: "rotate(24deg)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at top, rgba(255,255,255,0.14), transparent 60%)" }} />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 60px 0", position: "relative" }}>
          <div style={{ display: "flex", fontFamily: "Display", fontSize: 40, letterSpacing: 8, color: "#D5AF32" }}>RESULTADO FINAL</div>
          <div style={{ display: "flex", marginTop: 8, fontSize: 30, color: "rgba(255,255,255,0.75)" }}>{COMPETITION_LABEL[m.competition]}{m.round ? ` · ${m.round}` : ""}</div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: 90 }}>
            {team(a)}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", background: "rgba(0,0,0,0.7)", border: "3px solid rgba(255,255,255,0.18)", borderRadius: 28, padding: "10px 34px", fontFamily: "Display", fontSize: 170, lineHeight: 1 }}>
                <span style={{ color: a === us && o === "W" ? "#D5AF32" : "white" }}>{a.goals}</span>
                <span style={{ color: "rgba(255,255,255,0.4)", margin: "0 18px", fontSize: 120 }}>-</span>
                <span style={{ color: b === us && o === "W" ? "#D5AF32" : "white" }}>{b.goals}</span>
              </div>
              <div style={{ display: "flex", marginTop: 26, background: tone, color: o === "D" ? "#080808" : "white", borderRadius: 999, padding: "8px 34px", fontFamily: "Display", fontSize: 40, letterSpacing: 4 }}>{OUTCOME_LABEL[o].long.toUpperCase()}</div>
            </div>
            {team(b)}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexGrow: 1, justifyContent: "center", padding: "0 80px", position: "relative" }}>
          {scorers.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "rgba(0,0,0,0.6)", borderRadius: 30, padding: "26px 44px", maxWidth: 940 }}>
              <div style={{ display: "flex", fontFamily: "Display", fontSize: 30, letterSpacing: 6, color: "#D5AF32" }}>GOLES DEL RAYO</div>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", marginTop: 10, fontSize: 40, textAlign: "center" }}>{scorers.join(" · ")}</div>
            </div>
          )}
          {report.mvp && (
            <div style={{ display: "flex", alignItems: "center", marginTop: 30, background: "#D5AF32", color: "#080808", borderRadius: 999, padding: "12px 40px" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" style={{ marginRight: 10 }}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#080808" /></svg>
              <span style={{ fontFamily: "Display", fontSize: 34, letterSpacing: 4, marginRight: 18 }}>MVP</span>
              <span style={{ fontFamily: "Display", fontSize: 48 }}>{shirtName(report.mvp.player).toUpperCase()}</span>
            </div>
          )}
        </div>

        {sponsor && (
          <div style={{ display: "flex", justifyContent: "center", paddingBottom: 24, position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", background: "rgba(0,0,0,0.65)", borderRadius: 999, padding: "6px 26px 6px 30px" }}>
            <span style={{ fontSize: 18, letterSpacing: 5, color: "rgba(255,255,255,0.55)", marginRight: 18 }}>CON EL APOYO DE</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sponsor.src} width={logoW} height={logoH} style={{ objectFit: "contain" }} alt="" />
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "34px 60px", background: "rgba(0,0,0,0.75)", borderTop: "4px solid #D5AF32", position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 32 }}>{longDay(m.match_date).charAt(0).toUpperCase() + longDay(m.match_date).slice(1)}</span>
            {m.venue && <span style={{ fontSize: 26, color: "rgba(255,255,255,0.7)" }}>{m.venue}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={crest} width={72} height={72} alt="" />
            <span style={{ fontFamily: "Display", fontSize: 40, marginLeft: 14 }}>RAYO <span style={{ color: "#D5AF32", marginLeft: 10 }}>VALLECAÑAS</span></span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: [
        { name: "Display", data: black, weight: 900, style: "normal" },
        { name: "Text", data: semi, weight: 600, style: "normal" },
      ],
      headers: { "Cache-Control": "private, max-age=60" },
    },
  );
}
