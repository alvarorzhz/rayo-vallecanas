import Link from "next/link";
import { BarChart3, Target, CalendarDays, Lock, Plus, Shield, Trophy } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { fetchMatchSeasons, fetchMatches } from "@/lib/match-queries";
import { monthLabel, todayMadrid, type MatchRow } from "@/lib/matches";
import { seasonFromSlug, seasonSlug } from "@/lib/squad";
import { Empty, PageHeader } from "@/components/ui";
import { MatchLine, Scoreboard } from "@/components/matches/match-bits";
import { Ball } from "@/components/squad/ball";
import { LeagueProblem } from "@/components/matches/league-problem";
import type { StoredSummary } from "@/lib/league-status";
import { Suspense } from "react";
import { getForecast, getForecastQuick, getLeagueTable, getLeagueTableQuick } from "@/lib/league-table";
import { matchRanks, rivalRow, type MatchRanks } from "@/lib/standings";
import { oddsFor } from "@/lib/league-forecast";
import { ForecastLine, MatchOdds } from "@/components/matches/league-forecast";
import { StandingsTable, type TableRival } from "@/components/matches/league-table";
import { LeagueOutlook } from "@/components/matches/league-outlook";
import type { SupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 60;
export const metadata = { title: "Partidos" };

type SP = { temporada?: string; ver?: string; eliminado?: string };

export default async function MatchesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const s = await requirePerm("matches", "read");
  const supabase = await createClient();
  const season = seasonFromSlug(sp.temporada) ?? seasonOf();
  const view = sp.ver === "resultados" || sp.ver === "proximos" || sp.ver === "clasificacion" ? sp.ver : "todos";
  const current = season === seasonOf();
  const leagueP = supabase.from("league_sync").select("competition, team, last_summary").eq("id", 1).maybeSingle<{ competition: string; team: string; last_summary: StoredSummary }>().then((r) => r.data);
  // Clasificación para la posición y los puntos de cada rival (sin esperar más de 2,5 s a la web de la liga)
  const standingsP = leagueP.then((l) => (l?.competition && l.team && current ? getLeagueTableQuick(l.competition) : null));
  // 4.25.0 · Previsión de la liga (para el «¿Ganamos?» del próximo partido)
  const forecastP = leagueP.then((l) => (l?.competition && l.team && current ? getForecastQuick(l.competition, l.team) : null));
  const [matches, seasons, league, standings, forecast] = await Promise.all([
    fetchMatches(supabase, season),
    fetchMatchSeasons(supabase),
    leagueP,
    standingsP,
    forecastP,
  ]);
  const ranks = standings && league ? matchRanks(standings.rows, league.team, matches, season) : new Map<string, MatchRanks>();

  const today = todayMadrid();
  const upcoming = matches.filter((m) => (m.status === "scheduled" && m.match_date >= today) || m.status === "postponed");
  const next = matches.find((m) => m.status === "scheduled" && m.match_date >= today) ?? null;
  const last = [...matches].reverse().find((m) => m.status === "played") ?? null;

  const shown =
    view === "resultados" ? [...matches].filter((m) => m.status === "played").reverse()
    : view === "proximos" ? upcoming
    : matches;
  // Agrupados por mes
  const months: { key: string; label: string; rows: MatchRow[] }[] = [];
  for (const m of shown) {
    const key = m.match_date.slice(0, 7);
    let g = months.find((x) => x.key === key);
    if (!g) months.push((g = { key, label: monthLabel(m.match_date), rows: [] }));
    g.rows.push(m);
  }

  const link = (p: Partial<SP>) => {
    const next = { temporada: seasonSlug(season), ver: view, ...p };
    const qs = new URLSearchParams(Object.entries(next).filter(([k, v]) => v && !(k === "ver" && v === "todos")) as [string, string][]);
    return `/partidos?${qs}`;
  };
  const withTable = !!league && current;
  const tableView = view === "clasificacion" && withTable;
  const canCreate = s.can("matches", "create");
  const hero = current ? next ?? last : last;
  const heroOdds = hero && hero === next && hero.competition === "league" && standings
    ? oddsFor(forecast, rivalRow(standings.rows, hero.rival)?.teamId, hero.match_date)
    : null;

  return (
    <>
      <PageHeader
        title="Partidos"
        subtitle={<>Temporada <b>{season}</b>{current ? " · actual" : ""}</>}
        actions={canCreate ? <Link href="/partidos/nuevo" prefetch className="btn-primary"><Plus size={18} /> Nuevo partido</Link> : undefined}
      />
      {s.can("matches", "update") && league?.last_summary && <LeagueProblem summary={league.last_summary} compact />}
      {s.can("matches", "update") && !league && current && (
        <Link href="/partidos/liga" className="mb-4 flex items-center gap-2 rounded-xl bg-dorado/15 px-3 py-2 text-sm font-semibold ring-1 ring-dorado/40 hover:ring-dorado">
          <Trophy size={16} className="text-dorado" /> Conecta la web de la liga para traer el calendario y los resultados solos →
        </Link>
      )}
      {sp.eliminado && <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">Partido eliminado del calendario.</p>}

      {/* Lo demás de Partidos, en una sola línea discreta (el balance está en Estadísticas y la tabla en Clasificación) */}
      <nav aria-label="Más de Partidos" className="-mx-4 -mt-2 mb-5 flex gap-1.5 [scrollbar-width:none] overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {([
          [`/partidos/estadisticas?temporada=${seasonSlug(season)}`, <BarChart3 key="i" size={15} />, "Estadísticas", true],
          [`/partidos/porra?temporada=${seasonSlug(season)}`, <Target key="i" size={15} />, "Porra", true],
          ["/partidos/capsula", <Lock key="i" size={15} />, "Cápsula", true],
          ["/partidos/rivales", <Shield key="i" size={15} />, "Rivales", s.can("matches", "update")],
          ["/partidos/liga", <Trophy key="i" size={15} />, "Liga", s.can("matches", "update")],
        ] as const).filter((x) => x[3]).map(([href, icon, label]) => (
          <Link key={label} href={href} prefetch
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 text-[13px] font-bold text-negro/75 ring-1 ring-black/10 transition hover:text-rojo hover:ring-rojo/40">
            <span className="text-rojo">{icon}</span> {label}
          </Link>
        ))}
      </nav>

      {!tableView && hero && (
        <section className="mb-6">
          <h2 className="sport mb-2 text-xl font-black">{hero === next ? "Próximo partido" : "Último resultado"}</h2>
          <Link href={`/partidos/${hero.id}`} prefetch className="block transition hover:-translate-y-0.5"><Scoreboard m={hero} ranks={ranks.get(hero.id)} /></Link>
          {heroOdds && <MatchOdds odds={heroOdds} className="mt-2" />}
        </section>
      )}

      {/* Vista y temporada */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-black/5">
          {([["todos", "Calendario"], ["proximos", "Próximos"], ["resultados", "Resultados"], ...(withTable ? [["clasificacion", "Clasificación"]] as const : [])] as const).map(([v, label]) => (
            <Link key={v} href={link({ ver: v })} prefetch aria-current={view === v ? "page" : undefined}
              className={`sport rounded-lg px-3 py-1.5 text-sm font-black transition ${view === v ? "tab-on bg-negro text-white" : "text-negro/65 hover:text-negro"}`}>
              {label}
            </Link>
          ))}
        </div>
        {!tableView && seasons.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {seasons.map((t) => (
              <Link key={t} href={link({ temporada: seasonSlug(t) })} prefetch
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 ${t === season ? "bg-rojo text-white ring-rojo" : "bg-white text-negro/70 ring-black/10 hover:ring-rojo"}`}>
                {t}
              </Link>
            ))}
          </div>
        )}
      </div>

      {tableView ? (
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/70 ring-1 ring-black/5" aria-label="Cargando la clasificación" />}>
          <FullTable supabase={supabase} competition={league!.competition} team={league!.team} />
        </Suspense>
      ) : matches.length === 0 ? (
        <Empty>
          <span aria-hidden className="mb-3 block h-8 overflow-hidden"><span className="inline-block [--roll:90px]"><Ball size={30} className="anim-roll" /></span></span>
          Aún no hay partidos en la temporada {season}.{" "}
          {canCreate && <Link href="/partidos/nuevo" className="font-semibold text-rojo">Añade el primero</Link>}
        </Empty>
      ) : shown.length === 0 ? (
        <Empty>{view === "resultados" ? "Aún no se ha jugado ningún partido." : "No hay partidos pendientes."}</Empty>
      ) : (
        <div className="space-y-6">
          {months.map((g) => (
            <section key={g.key}>
              <h3 className="sport mb-2 flex items-center gap-2 text-lg font-black"><CalendarDays size={18} className="text-rojo" /> <span className="inline-block first-letter:uppercase">{g.label}</span></h3>
              <ol className="space-y-2">
                {g.rows.map((m, i) => (
                  <li key={m.id} className="anim-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}><MatchLine m={m} rank={ranks.get(m.id)?.rival} /></li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

type TableProps = { supabase: SupabaseClient; competition: string; team: string };

async function tableData({ supabase, competition, team }: TableProps) {
  const [table, forecast, rivals] = await Promise.all([
    getLeagueTable(competition),
    getForecast(competition, team),
    supabase.from("rivals").select("name, short_name, color, crest_url, ext_id").not("ext_id", "is", null).returns<TableRival[]>().then((r) => r.data ?? []),
  ]);
  return { table, forecast, rivals };
}

async function FullTable(p: TableProps) {
  const { table, forecast, rivals } = await tableData(p);
  if (!table) {
    return (
      <Empty>
        Ahora mismo no se puede leer la clasificación de la web de la liga.{" "}
        <a href={`https://www.futormes.com/mod/soccer/situation.aspx?itm=${p.competition}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-rojo">Verla en la web de la liga</a>
      </Empty>
    );
  }
  return (
    <>
      <StandingsTable table={table} us={p.team} rivals={rivals} />
      {forecast && <ForecastLine f={forecast} />}
      <LeagueOutlook table={table} us={p.team} />
    </>
  );
}
