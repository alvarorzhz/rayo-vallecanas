import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Crown, Trophy } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { fullName, lineOf, prevSeason, seasonSlug, shirtName, sumStats, type Membership, type Player } from "@/lib/squad";
import { Empty, PageHeader } from "@/components/ui";
import { Jersey } from "@/components/squad/jersey";
import { CountUp } from "@/components/squad/count-up";

export const metadata = { title: "Historia de la plantilla" };

type Row = Membership & { player: Player };

export default async function HistoryPage() {
  await requirePerm("squad", "read");
  const supabase = await createClient();
  const { data } = await supabase.from("squad_members").select("*, player:players!inner(*)").order("season", { ascending: false }).returns<Row[]>();
  const rows = data ?? [];
  const current = seasonOf();
  const seasons = [...new Set(rows.map((r) => r.season))].sort().reverse();
  const bySeason = new Map(seasons.map((s) => [s, rows.filter((r) => r.season === s)]));
  const href = (r: Row) => `/plantilla/${r.player_id}?temporada=${seasonSlug(r.season)}`;

  // Récords del club: totales de todas las temporadas
  const players = new Map<string, { player: Player; rows: Row[] }>();
  for (const r of rows) {
    const p = players.get(r.player_id) ?? { player: r.player, rows: [] };
    p.rows.push(r);
    players.set(r.player_id, p);
  }
  const careers = [...players.values()].map((p) => ({ ...p, total: sumStats(p.rows), seasons: p.rows.length, last: p.rows[0] }));
  const best = (n: (c: (typeof careers)[number]) => number) => [...careers].sort((a, b) => n(b) - n(a))[0];
  const records = careers.length
    ? ([
        ["Máximo goleador", (c) => c.total.goals, "goles"],
        ["Más partidos", (c) => c.total.apps, "partidos"],
        ["Más asistencias", (c) => c.total.assists, "asistencias"],
        ["Más temporadas", (c) => c.seasons, "temporadas"],
      ] as [string, (c: (typeof careers)[number]) => number, string][])
        .map(([label, n, unit]) => ({ label, c: best(n), n, unit }))
        .filter((x) => x.n(x.c) > 0)
    : [];

  // Dorsales utilizados: quién ha llevado cada número
  const numbers = new Map<number, Row[]>();
  for (const r of rows) if (r.number != null) numbers.set(r.number, [...(numbers.get(r.number) ?? []), r]);
  const numberList = [...numbers.entries()].sort((a, b) => a[0] - b[0]);

  // Exjugadores: no están en la temporada actual
  const inCurrent = new Set((bySeason.get(current) ?? []).filter((r) => r.status !== "left").map((r) => r.player_id));
  const former = careers.filter((c) => !inCurrent.has(c.player.id)).sort((a, b) => b.last.season.localeCompare(a.last.season));

  return (
    <>
      <PageHeader title="Historia de la plantilla" subtitle="Todas las temporadas, fichajes y bajas, récords y dorsales del Rayo."
        back={{ href: "/plantilla", label: "Plantilla" }} />

      {!rows.length ? (
        <Empty>Aún no hay ninguna temporada con plantilla.</Empty>
      ) : (
        <>
          {/* Récords */}
          <section className="mb-8">
            <h2 className="sport mb-3 flex items-center gap-2 text-2xl font-black"><Trophy size={22} className="anim-trophy text-dorado" /> Récords del club</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {records.map(({ label, c, n, unit }, i) => (
                <Link key={label} href={href(c.last)} prefetch style={{ animationDelay: `${i * 100}ms` }} className="anim-deal franja relative overflow-hidden rounded-2xl bg-negro p-4 text-white shadow-lg transition hover:-translate-y-0.5">
                  <div className="relative flex items-center gap-3">
                    {c.player.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.player.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-dorado" />
                    ) : (
                      <span className="shrink-0"><Jersey number={c.last.number} goalkeeper={lineOf(c.last.position) === "GK"} size={46} /></span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-dorado">{label}</span>
                      <span className="sport block truncate text-xl font-black leading-tight">{shirtName(c.player)}</span>
                      <span className="block text-xs text-white/70"><b className="sport text-base text-white"><CountUp value={n(c)} /></b> {unit}</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Temporadas */}
          <section className="mb-8">
            <h2 className="sport mb-3 text-2xl font-black">Temporada a temporada</h2>
            <ol className="relative space-y-4 border-l-4 border-negro/10 pl-5 sm:pl-7">
              {seasons.map((s, si) => {
                const list = bySeason.get(s)!;
                const prev = new Set((bySeason.get(prevSeason(s)) ?? []).map((r) => r.player_id));
                const prevKept = (bySeason.get(prevSeason(s)) ?? []).filter((r) => r.status !== "left");
                const here = new Set(list.map((r) => r.player_id));
                const signings = bySeason.has(prevSeason(s)) ? list.filter((r) => !prev.has(r.player_id)) : [];
                const left = list.filter((r) => r.status === "left");
                const notContinued = prevKept.filter((r) => !here.has(r.player_id));
                const totals = sumStats(list);
                const scorer = [...list].sort((a, b) => b.goals - a.goals)[0];
                const captain = list.find((r) => r.armband === "captain");
                return (
                  <li key={s} className="anim-rise relative" style={{ animationDelay: `${Math.min(si, 8) * 90}ms` }}>
                    <span aria-hidden className={`${s === current ? "animate-pulse" : ""} absolute -left-[1.95rem] top-5 h-5 w-5 -skew-x-[15deg] rounded-sm ring-4 ring-gris sm:-left-[2.45rem] ${s === current ? "bg-rojo" : "bg-negro"}`} />
                    <div className="card">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link href={`/plantilla?temporada=${seasonSlug(s)}`} className="sport text-3xl font-black hover:text-rojo">{s}</Link>
                        {s === current && <span className="badge bg-rojo text-white">Actual</span>}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
                        {[
                          ["Jugadores", list.filter((r) => r.status !== "left").length],
                          ["Fichajes", bySeason.has(prevSeason(s)) ? signings.length : "–"],
                          ["Bajas", left.length + notContinued.length],
                          ["Goles", totals.goals],
                          ["Asistencias", totals.assists],
                          ["Tarjetas", totals.yellows + totals.reds],
                        ].map(([k, v]) => (
                          <div key={k} className="anim-score rounded-xl bg-gris p-2.5">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-negro/50">{k}</div>
                            <div className="sport text-2xl font-black leading-none">{v}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                        {scorer && scorer.goals > 0 && <span><Trophy size={14} className="mr-1 inline text-dorado" />Pichichi: <Link href={href(scorer)} className="font-bold hover:text-rojo">{shirtName(scorer.player)}</Link> ({scorer.goals})</span>}
                        {captain && <span><Crown size={14} className="mr-1 inline text-rojo" />Capitán: <Link href={href(captain)} className="font-bold hover:text-rojo">{shirtName(captain.player)}</Link></span>}
                      </div>
                      {(signings.length > 0 || left.length > 0 || notContinued.length > 0) && (
                        <details className="group mt-3">
                          <summary className="cursor-pointer text-sm font-bold text-rojo">Ver fichajes y bajas</summary>
                          <div className="mt-2 grid gap-3 sm:grid-cols-2">
                            <div>
                              <h3 className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-green-700"><ArrowUpRight size={14} /> Fichajes</h3>
                              {signings.length ? (
                                <ul className="space-y-0.5 text-sm">{signings.map((r) => <li key={r.id}><Link href={href(r)} className="hover:text-rojo">{fullName(r.player)}</Link></li>)}</ul>
                              ) : <p className="text-sm text-negro/40">Ninguno</p>}
                            </div>
                            <div>
                              <h3 className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-rojo"><ArrowDownRight size={14} /> Bajas</h3>
                              {left.length + notContinued.length ? (
                                <ul className="space-y-0.5 text-sm">
                                  {left.map((r) => <li key={r.id}><Link href={href(r)} className="hover:text-rojo">{fullName(r.player)}</Link>{r.left_on && <span className="text-negro/50"> · {new Date(r.left_on).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>}</li>)}
                                  {notContinued.map((r) => <li key={r.id}><Link href={href(r)} className="hover:text-rojo">{fullName(r.player)}</Link><span className="text-negro/50"> · no siguió</span></li>)}
                                </ul>
                              ) : <p className="text-sm text-negro/40">Ninguna</p>}
                            </div>
                          </div>
                        </details>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Dorsales */}
          <section className="mb-8">
            <h2 className="sport mb-1 text-2xl font-black">Dorsales del Rayo</h2>
            <p className="mb-3 text-sm text-negro/60">Quién ha llevado cada número, de la temporada más reciente a la más antigua.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {numberList.map(([n, list], i) => (
                <div key={n} style={{ animationDelay: `${Math.min(i, 16) * 40}ms` }} className="anim-rise group flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
                  <span className="shrink-0 transition duration-300 group-hover:-rotate-6 group-hover:scale-110"><Jersey number={n} goalkeeper={list.some((r) => lineOf(r.position) === "GK") && list.every((r) => lineOf(r.position) === "GK")} size={48} /></span>
                  <ul className="min-w-0 space-y-0.5 text-xs">
                    {list.map((r) => (
                      <li key={r.id} className="truncate">
                        <span className="sport mr-1 font-black text-negro/50">{r.season.slice(2)}</span>
                        <Link href={href(r)} className="font-semibold hover:text-rojo">{shirtName(r.player)}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Exjugadores */}
          {former.length > 0 && (
            <section>
              <h2 className="sport mb-1 text-2xl font-black">Exjugadores</h2>
              <p className="mb-3 text-sm text-negro/60">No están en la plantilla {current}. Desde su ficha se pueden volver a fichar.</p>
              <div className="card overflow-x-auto p-0 sm:p-0">
                <table className="table">
                  <thead><tr><th>Jugador</th><th>Última temporada</th><th className="text-center">Temp.</th><th className="text-center">PJ</th><th className="text-center">GOL</th></tr></thead>
                  <tbody>
                    {former.map((c) => (
                      <tr key={c.player.id}>
                        <td><Link href={href(c.last)} className="font-semibold hover:text-rojo">{fullName(c.player)}</Link></td>
                        <td>{c.last.season}</td>
                        <td className="text-center tabular-nums">{c.seasons}</td>
                        <td className="text-center tabular-nums">{c.total.apps}</td>
                        <td className="text-center tabular-nums">{c.total.goals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
