import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { KIND_LABEL, NEWS_NAME } from "@/lib/news";
import { loadPublicArticle } from "@/lib/news-public";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = NEWS_NAME;

/** Foto de portada como data URL: solo de nuestra carpeta pública de noticias. */
async function coverData(url: string | null) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  if (!url || !base || !url.startsWith(`${base}/storage/v1/object/public/news-photos/`)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const type = r.headers.get("content-type") ?? "image/jpeg";
    if (!/^image\/(jpeg|png)$/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/** La imagen que sale al compartir la noticia por WhatsApp o en redes. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const p = await loadPublicArticle((await params).slug);
  const fonts = join(process.cwd(), "src/assets/fonts");
  const [black, semi, crest] = await Promise.all([
    readFile(join(fonts, "BarlowCondensed-Black.ttf")),
    readFile(join(fonts, "Barlow-SemiBold.ttf")),
    readFile(join(process.cwd(), "public/escudo.png")),
  ]);
  const a = p?.card;
  const cover = await coverData(a?.cover_url ?? null);
  const m = a?.match;
  const score = m && m.status === "played" && m.goals_for != null
    ? (m.is_home ? `Rayo ${m.goals_for}-${m.goals_against} ${m.rival.short_name ?? m.rival.name}` : `${m.rival.short_name ?? m.rival.name} ${m.goals_against}-${m.goals_for} Rayo`)
    : null;
  const title = a?.title ?? NEWS_NAME;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#080808", color: "#fff", fontFamily: "Barlow" }}>
        {cover && (
          // eslint-disable-next-line jsx-a11y/alt-text
          <img src={cover} width={1200} height={630} style={{ position: "absolute", inset: 0, width: 1200, height: 630, objectFit: "cover" }} />
        )}
        <div style={{ position: "absolute", inset: 0, display: "flex", background: cover ? "linear-gradient(180deg, rgba(8,8,8,0.35) 0%, rgba(8,8,8,0.92) 70%)" : "linear-gradient(135deg, #161616 0%, #080808 60%)" }} />
        {!cover && <div style={{ position: "absolute", top: -40, right: 120, width: 120, height: 760, background: "#D20D17", transform: "rotate(18deg)", display: "flex" }} />}
        {!cover && <div style={{ position: "absolute", top: -40, right: 80, width: 22, height: 760, background: "#D5AF32", transform: "rotate(18deg)", display: "flex" }} />}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px 64px", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img src={`data:image/png;base64,${crest.toString("base64")}`} width={64} height={76} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: "Barlow Condensed", fontSize: 40, letterSpacing: 1, lineHeight: 1 }}>LA VOZ DEL RAYO</span>
              <span style={{ fontSize: 18, color: "#D5AF32", letterSpacing: 4 }}>RAYO VALLECAÑAS · FÚTBOL 7</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 960 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span style={{ background: "#D20D17", padding: "6px 14px", fontFamily: "Barlow Condensed", fontSize: 26, letterSpacing: 2 }}>{(a?.kicker || (a ? KIND_LABEL[a.kind] : "Noticias")).toUpperCase()}</span>
              {score && <span style={{ fontFamily: "Barlow Condensed", fontSize: 30, color: "#D5AF32" }}>{score}</span>}
            </div>
            <span style={{ marginTop: 16, fontFamily: "Barlow Condensed", fontSize: title.length > 60 ? 64 : 80, lineHeight: 0.98 }}>{title.toUpperCase()}</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Barlow Condensed", data: black, weight: 900 }, { name: "Barlow", data: semi, weight: 600 }] },
  );
}
