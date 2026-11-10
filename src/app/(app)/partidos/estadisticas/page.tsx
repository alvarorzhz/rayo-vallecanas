import Link from "next/link";
import { Trophy } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { fetchMatchSeasons } from "@/lib/match-queries";
import { outcomeOf, record, type MatchRow } from "@/lib/matches";
import { lineOf, ratio, seasonFromSlug, seasonSlug, shirtName, sortRoster, type Membership, type Player } from "@/lib/squad";
import { Empty, PageHeader } from "@/components/ui";
import { Jersey } from "@/components/squad/jersey";

export const metadata = { title: "Estadísticas" };

type Row = Membership & { player: Player };
type Cat = { key: string; title: string; unit: string; value: (r: Row) => number; show?: (r: Row) => boolean; asc?: boolean; fmt?: (r: Row) => string };

const CATS: Cat[] = [
  { key: "goals", title: "Pichichi", unit: "goles", value: (r) => r.goals },
  { key: "assists", title: "Asistencias", unit: "asist.", value: (r) => r.assists },
  { key: "ga", title: "Goles + asistencias", unit: "G+A", value: (r) => r.goals + r.assists },
  { key: "mvps", title: "MVP", unit: "veces", value: (r) => r.mvps },
  { key: "apps", title: "Más partidos", unit: "PJ", value: (r) => r.apps },
  { key: "starts", title: "Más veces titular", unit: "TIT", value: (r) => r.starts },
  { key: "zamora", title: "Zamora", unit: "encajados por partido", value: (r) => (r.apps ? r.conceded / r.apps : 99), show: (r) => lineOf(r.position) === "GK" && r.apps > 0, asc: true, fmt: (r) => ratio(r.conceded, r.apps) },
  { key: "clean", title: "Porterías a cero", unit: "P0", value: (r) => r.clean_sheets, show: (r) => lineOf(r.position) === "GK" },
  { key: "cards", title: "Más tarjetas", unit: "TA + TR", value: (r) => r.yellows + r.reds },
];

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ temporada?: string }> }) {
  const sp = await searchParams;
  await requirePerm("matches", "read");
  const supabase = await createClient();
  const season = seasonFromSlug(sp.temporada) ?? seasonOf();
  const [{ data: rosterData }, { data: allMatches }, seasons] = await Promise.all([
    supabase.from("squad_members_full").select("*, player:players!inner(*)").eq("season", season).returns<Row[]>(),
    supabase.from("matches").select("*, rival:rivals!inner(*)").eq("status", "played").order("match_date").returns<MatchRow[]>(),
    fetchMatchSeasons(supabase),
  ]);
  const roster = sortRoster(rosterData ?? []);
  const played = (allMatches ?? []).filter((m) => m.season === season);
  const rec = record(played);
  const withReport = played.filter((m) => m.report_saved_at).length;

  // Histórico: balance de cada temporada
  const history = [...new Set((allMatches ?? []).map((m) => m.season))].sort().reverse().map((s) => {
    const list = (allMatches ?? []).filter((m) => m.season === s);
    const r = record(list);
    const best = [...list].filter((m) => outcomeOf(m) === "W").sort((a, b) => (b.goals_for! - b.goals_against!) - (a.goals_for! - a.goals_against!))[0];
    return { season: s, r, best, pts: r.W * 3 + r.D };
  });

  const tops = CATS.map((c) => ({
    ...c,
    rows: roster.filter((r) => (c.show ? c.show(r) : true) && (c.asc ? true : c.value(r) > 0))
      .sort((a, b) => (c.asc ? c.value(a) - c.value(b) : c.value(b) - c.value(a)) || (a.number ?? 99) - (b.number ?? 99)).slice(0, 5),
  })).filter((c) => c.rows.length);

  return (
    <>
      <PageHeader title="Estadísticas" subtitle={<>Temporada <b>{season}</b> · {played.length} {played.length === 1 ? "partido jugado" : "partidos jugados"} · {withReport} con acta</>}
        back={{ href: `/partidos?temporada=${seasonSlug(season)}`, label: "Partidos" }} />

      {seasons.length > 1 && (
        <nav aria-label="Temporadas" className="mb-4 flex flex-wrap gap-2">
          {seasons.map((x) => (
            <Link key={x} href={`/partidos/estadisticas?temporada=${seasonSlug(x)}`} prefetch
              className={`sport rounded-full px-3 py-1 text-sm font-black ring-1 ${x === season ? "tab-on bg-negro text-white ring-negro" : "bg-white ring-black/10"}`}>{x}</Link>
          ))}
        </nav>
      )}

      {played.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[["PJ", rec.played], ["V", rec.W], ["E", rec.D], ["D", rec.L], ["GF", rec.gf], ["GC", rec.ga]].map(([k, v]) => (
            <div key={k as string} className="rounded-2xl bg-white p-3 text-center ring-1 ring-black/5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-negro/65">{k}</div>
              <div className="sport text-3xl font-black tabular-nums">{v}</div>
            </div>
          ))}
        </div>
      )}

      {tops.length === 0 ? (
        <Empty>Aún no hay estadísticas esta temporada. Salen solas de las actas de los partidos.</Empty>
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tops.map((c) => (
            <section key={c.key} className="card">
              <h2 className="mb-3 flex items-center gap-2"><Trophy size={18} className="text-dorado" /> {c.title}</h2>
              <ol className="space-y-1.5">
                {c.rows.map((r, i) => (
                  <li key={r.id}>
                    <Link href={`/plantilla/${r.player_id}?temporada=${seasonSlug(season)}`} prefetch
                      className={`flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-gris ${i === 0 ? "bg-dorado/15 ring-1 ring-dorado/50" : ""}`}>
                      <span className="sport w-5 text-center text-lg font-black text-negro/50">{i + 1}</span>
                      <Jersey number={r.number} goalkeeper={lineOf(r.position) === "GK"} size={26} />
                      <span className="min-w-0 flex-1 truncate font-bold">{shirtName(r.player)}</span>
                      <span className="sport text-xl font-black tabular-nums text-rojo">{c.fmt ? c.fmt(r) : c.value(r)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-right text-[11px] uppercase tracking-wider text-negro/50">{c.unit}</p>
            </section>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <section className="card overflow-x-auto">
          <h2 className="mb-3">Histórico del equipo</h2>
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-negro/65">
                <th className="py-1">Temporada</th><th className="text-center">PJ</th><th className="text-center">V</th><th className="text-center">E</th><th className="text-center">D</th><th className="text-center">GF</th><th className="text-center">GC</th><th className="text-center">Pts</th><th>Mayor victoria</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.season} className="border-t border-black/5">
                  <td className="py-2"><Link href={`/partidos/estadisticas?temporada=${seasonSlug(h.season)}`} className="sport font-black hover:text-rojo">{h.season}</Link></td>
                  {[h.r.played, h.r.W, h.r.D, h.r.L, h.r.gf, h.r.ga, h.pts].map((v, i) => <td key={i} className="text-center tabular-nums">{v}</td>)}
                  <td className="truncate">{h.best ? <Link href={`/partidos/${h.best.id}`} className="hover:text-rojo">{h.best.goals_for}-{h.best.goals_against} a {h.best.rival.name}</Link> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-negro/65">Puntos a 3 por victoria y 1 por empate, contando todos los partidos jugados (también amistosos).</p>
        </section>
      )}
    </>
  );
}
