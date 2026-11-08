import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { fetchMatch, fetchReport } from "@/lib/match-queries";
import { CLUB_NAME, COMPETITION_LABEL, OUTCOME_LABEL, longDay, outcomeOf, rivalColor, rivalShort } from "@/lib/matches";
import { shirtName } from "@/lib/squad";
import { fetchDisplay, type Showcase } from "@/lib/sponsors";

export const runtime = "nodejs";

const W = 1080;
const H = 1350;
const ROJO = "#D20D17";
const ORO = "#D5AF32";

let assets: Promise<{ black: Buffer; semi: Buffer; crest: string }> | null = null;
const load = () =>
  (assets ??= Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/BarlowCondensed-Black.ttf")),
    readFile(join(process.cwd(), "src/assets/fonts/Barlow-SemiBold.ttf")),
    readFile(join(process.cwd(), "public/escudo.png")),
  ]).then(([black, semi, crest]) => ({ black, semi, crest: `data:image/png;base64,${crest.toString("base64")}` })));

/** Proporción ancho/alto de un PNG o JPEG (para dibujarlo sin deformar). */
function ratioOf(buf: Buffer): number | null {
  if (buf.subarray(1, 4).toString("ascii") === "PNG") return buf.readUInt32BE(16) / Math.max(1, buf.readUInt32BE(20));
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return buf.readUInt16BE(i + 7) / Math.max(1, buf.readUInt16BE(i + 5));
      i += 2 + len;
    }
  }
  return null;
}

/**
 * Imagen (PNG o JPEG) como data URI. Solo se leen ficheros de la propia app o de nuestro almacenamiento:
 * así nadie puede hacer que el servidor pida una dirección cualquiera.
 */
async function embed(url: string | null | undefined, buckets: string[]): Promise<{ src: string; ratio: number } | null> {
  if (!url) return null;
  try {
    let buf: Buffer;
    if (url.startsWith("/")) {
      if (!/^\/patrocinadores\/[\w.-]+\.(png|jpe?g)$/.test(url)) return null;
      buf = await readFile(join(process.cwd(), "public", url));
    } else {
      const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
      if (!base || !buckets.some((b) => url.startsWith(`${base}/storage/v1/object/public/${b}/`))) return null;
      const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) return null;
      buf = Buffer.from(await r.arrayBuffer());
    }
    const ratio = ratioOf(buf);
    if (!ratio) return null;   // WebP y otros formatos: no se pueden dibujar
    const png = buf.subarray(1, 4).toString("ascii") === "PNG";
    return { src: `data:image/${png ? "png" : "jpeg"};base64,${buf.toString("base64")}`, ratio };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- Fondo: estadio de noche

/** Césped en perspectiva con las franjas del corte y las líneas del campo. */
function Stadium({ tone }: { tone: string }) {
  const top = 640;                       // horizonte del césped
  const vx = W / 2;                      // punto de fuga
  const vy = top - 900;
  const x = (y: number, side: -1 | 1) => vx + side * (((y - vy) / (H - vy)) * 1500);   // borde del césped a la altura y
  const bands = 9;
  const ys = Array.from({ length: bands + 1 }, (_, k) => top + (H - top) * Math.pow(k / bands, 1.6));
  // Línea de medio campo y círculo central (elipse por la perspectiva)
  const mid = top + (H - top) * 0.36;
  const lineL = (y: number) => vx - ((y - vy) / (H - vy)) * 1050;
  const lineR = (y: number) => vx + ((y - vy) / (H - vy)) * 1050;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", top: 0, left: 0 }}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05070c" />
          <stop offset="0.45" stopColor="#0b1220" />
          <stop offset="1" stopColor="#101a16" />
        </linearGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff8dc" stopOpacity="0.32" />
          <stop offset="1" stopColor="#fff8dc" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffbe8" stopOpacity="0.9" />
          <stop offset="0.25" stopColor="#fff2b8" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff2b8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#000" stopOpacity="0.1" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
        <radialGradient id="spot" cx="0.5" cy="0.35" r="0.6">
          <stop offset="0" stopColor={tone} stopOpacity="0.22" />
          <stop offset="1" stopColor={tone} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#sky)" />

      {/* Grada: filas de público con bufandas y flashes */}
      <polygon points={`0,210 ${W},210 ${W},${top} 0,${top}`} fill="#0a1017" />
      <rect x="0" y="200" width={W} height="12" fill="#1a2433" />
      {Array.from({ length: 12 }, (_, r) => (
        <rect key={r} x="0" y={222 + r * 35} width={W} height="3" fill="#ffffff" opacity="0.04" />
      ))}
      {Array.from({ length: 260 }, (_, k) => {
        const row = k % 12;
        const cx = (k * 211 + row * 53) % W;
        const cy = 236 + row * 35 + ((k * 7) % 9);
        const c = k % 9 === 0 ? ROJO : k % 13 === 0 ? ORO : "#cfd8e3";
        return <circle key={k} cx={cx} cy={cy} r={k % 17 === 0 ? 3.4 : 2} fill={c} opacity={k % 17 === 0 ? 0.9 : 0.14 + (k % 4) * 0.05} />;
      })}
      {Array.from({ length: 14 }, (_, k) => (
        <circle key={`f${k}`} cx={(k * 389 + 120) % W} cy={250 + ((k * 97) % 360)} r="9" fill="#ffffff" opacity="0.18" />
      ))}
      <rect x="0" y={top - 26} width={W} height="26" fill="#0b0f14" />
      <rect x="0" y={top - 30} width={W} height="4" fill={ROJO} opacity="0.7" />

      {/* Focos en las esquinas con su haz de luz */}
      {([[-1, 70], [1, W - 70]] as const).map(([side, cx]) => (
        <g key={side}>
          <polygon points={`${cx - 40},70 ${cx + 40},70 ${side < 0 ? 760 : 320},${top} ${side < 0 ? 140 : W - 140},${top}`} fill="url(#beam)" />
          <circle cx={cx} cy="72" r="210" fill="url(#glow)" />
          <rect x={cx - 3} y="96" width="6" height={top - 160} fill="#1a2230" />
          <rect x={cx - 46} y="40" width="92" height="56" rx="6" fill="#1c2431" />
          {Array.from({ length: 8 }, (_, k) => (
            <rect key={k} x={cx - 40 + (k % 4) * 21} y={46 + Math.floor(k / 4) * 24} width="17" height="19" rx="3" fill="#fffbe6" />
          ))}
        </g>
      ))}

      {/* Césped: franjas del corte en perspectiva */}
      {ys.slice(0, -1).map((y0, k) => {
        const y1 = ys[k + 1];
        return <polygon key={k} points={`${x(y0, -1)},${y0} ${x(y0, 1)},${y0} ${x(y1, 1)},${y1} ${x(y1, -1)},${y1}`} fill={k % 2 ? "#1f6b32" : "#257a3a"} />;
      })}
      <rect x="0" y={top} width={W} height={H - top} fill="url(#grass)" />
      <g stroke="#ffffff" strokeOpacity="0.55" strokeWidth="5" fill="none">
        <line x1={lineL(top + 8)} y1={top + 8} x2={lineR(top + 8)} y2={top + 8} />
        <line x1={lineL(top + 8)} y1={top + 8} x2={lineL(H)} y2={H} />
        <line x1={lineR(top + 8)} y1={top + 8} x2={lineR(H)} y2={H} />
        <line x1={lineL(mid)} y1={mid} x2={lineR(mid)} y2={mid} />
        <ellipse cx={vx} cy={mid} rx="230" ry="62" />
      </g>
      <circle cx={vx} cy={mid} r="7" fill="#ffffff" fillOpacity="0.6" />
      <rect width={W} height={H} fill="url(#spot)" />
    </svg>
  );
}

/** Confeti de victoria (posiciones fijas: la imagen sale siempre igual). */
function Confetti() {
  const colors = [ROJO, ORO, "#ffffff", ORO, ROJO];
  return (
    <svg width={W} height={620} viewBox={`0 0 ${W} 620`} style={{ position: "absolute", top: 0, left: 0 }}>
      {Array.from({ length: 46 }, (_, k) => {
        const cx = (k * 263 + 41) % W;
        const cy = (k * 131 + 17) % 600;
        const w = 10 + (k % 3) * 5;
        return <rect key={k} x={cx} y={cy} width={w} height={w * 0.45} rx="2" fill={colors[k % colors.length]} opacity={0.75} transform={`rotate(${(k * 47) % 180} ${cx} ${cy})`} />;
      })}
    </svg>
  );
}

const Bolt = ({ size = 34, color = ORO }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" fill={color} /></svg>
);
const BallIcon = ({ size = 30 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="11" fill="#ffffff" stroke="#111" strokeWidth="1.2" />
    <path d="M12 6.5l3.6 2.6-1.4 4.2H9.8L8.4 9.1z" fill="#111" />
    <path d="M12 1.5v5M15.6 9.1l5-1.6M14.2 13.3l3 4.2M9.8 13.3l-3 4.2M8.4 9.1l-5-1.6" stroke="#111" strokeWidth="1.2" />
  </svg>
);

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
  // Patrocinador principal (si los gestores lo tienen activado) y foto del MVP
  const main = display.show_result ? ((showcase.data ?? []) as Showcase[]).find((x) => x.tier === "main" && x.logo_url) : undefined;
  const [sponsor, mvpPhoto] = await Promise.all([
    main ? embed(main.logo_url, ["sponsor-logos"]) : null,
    embed(report.mvp?.player.photo_url, ["player-photos"]),
  ]);

  const o = outcomeOf(m)!;
  const tone = o === "W" ? "#16A34A" : o === "L" ? ROJO : "#A3A3A3";
  const us = { name: CLUB_NAME, crest: crest as string | null, goals: m.goals_for ?? 0, short: "RVA", color: ROJO, isUs: true };
  const them = { name: m.rival.name, crest: m.rival.crest_url, goals: m.goals_against ?? 0, short: rivalShort(m.rival), color: rivalColor(m.rival), isUs: false };
  const [a, b] = m.is_home ? [us, them] : [them, us];

  // Goleadores agrupados («EISIEL» con dos balones) y sus asistentes
  const scorers = new Map<string, { goals: number; assists: Set<string> }>();
  for (const g of report.goals) {
    const n = g.own_goal ? "En propia puerta" : g.scorer ? shirtName(g.scorer.player) : null;
    if (!n) continue;
    const e = scorers.get(n) ?? { goals: 0, assists: new Set<string>() };
    e.goals++;
    if (g.assist) e.assists.add(shirtName(g.assist.player));
    scorers.set(n, e);
  }
  const scorerList = [...scorers].sort((x, y) => y[1].goals - x[1].goals).slice(0, 5);
  const more = scorers.size - scorerList.length;
  const mvp = report.mvp;
  const mvpNumber = mvp?.number;
  const headline = OUTCOME_LABEL[o].long.toUpperCase().replace("VICTORIA", "¡VICTORIA!");
  const tagline = o === "L" ? "A POR EL SIGUIENTE" : o === "D" && m.competition === "league" ? "UN PUNTO" : null;
  const comp = [COMPETITION_LABEL[m.competition], m.round].filter(Boolean).join(" · ").toUpperCase();
  const day = longDay(m.match_date);
  // El marcador se ilumina en dorado solo con los goles del Rayo cuando gana
  const winner = (t: typeof us) => t.isUs && o === "W";

  const team = (t: typeof us) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 300 }}>
      <div style={{ display: "flex", width: 210, height: 210, alignItems: "center", justifyContent: "center", borderRadius: 999, background: "radial-gradient(circle, rgba(255,255,255,0.16), rgba(255,255,255,0) 68%)" }}>
        {t.crest ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.crest} width={176} height={176} style={{ objectFit: "contain" }} alt="" />
        ) : (
          <div style={{ display: "flex", width: 150, height: 170, alignItems: "center", justifyContent: "center", background: t.color, borderRadius: "26px 26px 80px 80px", border: "7px solid rgba(255,255,255,0.9)", fontFamily: "Display", fontSize: 58, color: "white" }}>{t.short}</div>
        )}
      </div>
      <div style={{ display: "flex", marginTop: 14, fontFamily: "Display", fontSize: t.name.length > 18 ? 38 : 46, lineHeight: 1, textAlign: "center", textTransform: "uppercase", color: t.isUs ? ORO : "white", justifyContent: "center" }}>{t.name}</div>
    </div>
  );

  const digit = (n: number, win: boolean) => (
    <div style={{ display: "flex", width: 150, height: 196, alignItems: "center", justifyContent: "center", borderRadius: 22, background: "linear-gradient(180deg, #1b1f27 0%, #0b0d11 50%, #15181f 50%, #07080b 100%)", border: `3px solid ${win ? ORO : "rgba(255,255,255,0.16)"}`, boxShadow: win ? "0 0 40px rgba(213,175,50,0.45)" : "0 12px 30px rgba(0,0,0,0.6)", fontFamily: "Display", fontSize: 176, lineHeight: 1, color: win ? ORO : "white" }}>{n}</div>
  );

  const hasCards = scorerList.length > 0 || !!mvp;

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: W, height: H, background: "#05070c", color: "white", fontFamily: "Text", position: "relative", overflow: "hidden" }}>
        <Stadium tone={tone} />
        {o === "W" && <Confetti />}
        {/* Franja del Rayo, en diagonal por detrás del marcador */}
        <div style={{ position: "absolute", top: -260, left: 610, width: 120, height: 1100, background: `linear-gradient(180deg, rgba(210,13,23,0) 0%, rgba(210,13,23,0.55) 55%, rgba(210,13,23,0) 100%)`, transform: "rotate(24deg)" }} />
        <div style={{ position: "absolute", top: -260, left: 742, width: 22, height: 1100, background: "linear-gradient(180deg, rgba(213,175,50,0) 0%, rgba(213,175,50,0.6) 55%, rgba(213,175,50,0) 100%)", transform: "rotate(24deg)" }} />

        {/* Cabecera */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 64, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", background: "rgba(0,0,0,0.55)", border: "2px solid rgba(255,255,255,0.14)", borderRadius: 999, padding: "8px 26px", fontSize: 24, letterSpacing: 4, color: "rgba(255,255,255,0.85)" }}>
            <div style={{ display: "flex", width: 12, height: 12, borderRadius: 99, background: ROJO, marginRight: 14 }} />
            {comp || "PARTIDO"}
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 14 }}>
            <div style={{ display: "flex", height: 6, width: 90, background: `linear-gradient(90deg, rgba(213,175,50,0), ${ORO})`, marginRight: 22 }} />
            <span style={{ fontFamily: "Display", fontSize: 92, lineHeight: 1, letterSpacing: 10, textShadow: "0 6px 30px rgba(0,0,0,0.8)" }}>FINAL</span>
            <div style={{ display: "flex", height: 6, width: 90, background: `linear-gradient(90deg, ${ORO}, rgba(213,175,50,0))`, marginLeft: 22 }} />
          </div>
        </div>

        {/* Videomarcador */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "34px 46px 0", padding: "34px 20px 30px", borderRadius: 40, background: "linear-gradient(180deg, rgba(10,12,18,0.88), rgba(10,12,18,0.72))", border: "2px solid rgba(255,255,255,0.12)", boxShadow: "0 30px 80px rgba(0,0,0,0.7)", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 80, right: 80, height: 5, display: "flex", background: `linear-gradient(90deg, rgba(0,0,0,0), ${ROJO}, ${ORO}, ${ROJO}, rgba(0,0,0,0))` }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            {team(a)}
            <div style={{ display: "flex", alignItems: "center" }}>
              {digit(a.goals, winner(a))}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "0 14px" }}>
                <div style={{ display: "flex", width: 14, height: 14, borderRadius: 99, background: "rgba(255,255,255,0.5)", marginBottom: 22 }} />
                <div style={{ display: "flex", width: 14, height: 14, borderRadius: 99, background: "rgba(255,255,255,0.5)" }} />
              </div>
              {digit(b.goals, winner(b))}
            </div>
            {team(b)}
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 26, background: tone, color: o === "D" ? "#080808" : "white", borderRadius: 999, padding: "10px 40px", fontFamily: "Display", fontSize: 44, letterSpacing: 6, boxShadow: `0 0 36px ${o === "W" ? "rgba(22,163,74,0.55)" : "rgba(0,0,0,0.4)"}` }}>
            {o === "W" && <div style={{ display: "flex", marginRight: 12 }}><Bolt size={36} color="#ffffff" /></div>}
            {headline}
            {tagline && <span style={{ fontSize: 28, letterSpacing: 3, marginLeft: 16, opacity: 0.8 }}>· {tagline}</span>}
          </div>
        </div>

        {/* Sobre el césped: goleadores y MVP */}
        <div style={{ display: "flex", flexGrow: 1, alignItems: "center", justifyContent: "center", padding: "0 46px", position: "relative" }}>
          {hasCards && (
            <div style={{ display: "flex", width: "100%", justifyContent: "center", alignItems: "stretch" }}>
              {scorerList.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, flexBasis: 0, maxWidth: mvp ? 560 : 760, background: "linear-gradient(160deg, #0d1218 0%, #05080a 100%)", border: "2px solid rgba(255,255,255,0.12)", borderRadius: 30, padding: "24px 30px", justifyContent: "center", marginRight: mvp ? 24 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", fontFamily: "Display", fontSize: 28, letterSpacing: 5, color: ORO, marginBottom: 8 }}>
                    <div style={{ display: "flex", marginRight: 10 }}><BallIcon size={26} /></div> GOLES DEL RAYO
                  </div>
                  {scorerList.map(([n, e]) => (
                    <div key={n} style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <span style={{ fontFamily: "Display", fontSize: 40, lineHeight: 1.05, textTransform: "uppercase", marginRight: 12 }}>{n}</span>
                        {Array.from({ length: Math.min(e.goals, 5) }, (_, k) => <div key={k} style={{ display: "flex", marginRight: 4 }}><BallIcon size={26} /></div>)}
                      </div>
                      {e.assists.size > 0 && <span style={{ fontSize: 21, color: "rgba(255,255,255,0.6)" }}>Asist. {[...e.assists].join(", ")}</span>}
                    </div>
                  ))}
                  {more > 0 && <span style={{ fontSize: 22, color: "rgba(255,255,255,0.6)", marginTop: 8 }}>y {more} más</span>}
                </div>
              )}
              {mvp && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: scorerList.length ? 330 : 420, background: `linear-gradient(160deg, ${ORO} 0%, #b8901c 100%)`, borderRadius: 30, padding: "22px 20px", color: "#0b0b0b", boxShadow: "0 18px 50px rgba(0,0,0,0.6)" }}>
                  <div style={{ display: "flex", alignItems: "center", fontFamily: "Display", fontSize: 28, letterSpacing: 3 }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" style={{ marginRight: 8 }}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#0b0b0b" /></svg>
                    MVP DEL PARTIDO
                  </div>
                  <div style={{ display: "flex", width: 170, height: 170, marginTop: 14, borderRadius: 999, border: "6px solid #0b0b0b", background: "#0b0b0b", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {mvpPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mvpPhoto.src} width={mvpPhoto.ratio >= 1 ? Math.round(158 * mvpPhoto.ratio) : 158} height={mvpPhoto.ratio >= 1 ? 158 : Math.round(158 / mvpPhoto.ratio)} style={{ objectFit: "cover" }} alt="" />
                    ) : (
                      <span style={{ fontFamily: "Display", fontSize: 96, color: ORO, lineHeight: 1 }}>{mvpNumber ?? "★"}</span>
                    )}
                  </div>
                  <span style={{ fontFamily: "Display", fontSize: shirtName(mvp.player).length > 12 ? 40 : 50, lineHeight: 1, marginTop: 14, textTransform: "uppercase", textAlign: "center" }}>{shirtName(mvp.player)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {sponsor && (
          <div style={{ display: "flex", justifyContent: "center", paddingBottom: 22, position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", background: "rgba(0,0,0,0.65)", borderRadius: 999, padding: "6px 26px 6px 30px" }}>
              <span style={{ fontSize: 18, letterSpacing: 5, color: "rgba(255,255,255,0.6)", marginRight: 18 }}>CON EL APOYO DE</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sponsor.src} width={Math.round(Math.min(240, Math.max(60, 72 * sponsor.ratio)))} height={72} style={{ objectFit: "contain" }} alt="" />
            </div>
          </div>
        )}

        {/* Pie */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "28px 56px", background: "rgba(0,0,0,0.82)", borderTop: `5px solid ${ORO}`, position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 30 }}>{day.charAt(0).toUpperCase() + day.slice(1)}</span>
            {m.venue && <span style={{ fontSize: 24, color: "rgba(255,255,255,0.65)" }}>{m.venue}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={crest} width={70} height={70} alt="" />
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 14 }}>
              <span style={{ fontFamily: "Display", fontSize: 38, lineHeight: 1 }}>RAYO <span style={{ color: ORO, marginLeft: 10 }}>VALLECAÑAS</span></span>
              <span style={{ display: "flex", alignItems: "center", fontSize: 20, letterSpacing: 4, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>#AÚPARAYO <div style={{ display: "flex", marginLeft: 6 }}><Bolt size={20} /></div></span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: "Display", data: black, weight: 900, style: "normal" },
        { name: "Text", data: semi, weight: 600, style: "normal" },
      ],
      headers: { "Cache-Control": "private, max-age=60" },
    },
  );
}
