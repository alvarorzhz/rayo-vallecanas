import Link from "next/link";
import { CalendarDays, Plus, Shield, Trophy } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { fetchMatchSeasons, fetchMatches } from "@/lib/match-queries";
import { form, matchShareText, monthLabel, record, streak, todayMadrid, type MatchRow } from "@/lib/matches";
import { seasonFromSlug, seasonSlug } from "@/lib/squad";
import { Empty, PageHeader } from "@/components/ui";
import { FormStrip, MatchLine, Scoreboard } from "@/components/matches/match-bits";
import { Ball } from "@/components/squad/ball";
import { CountUp } from "@/components/squad/count-up";
import { ShareButton } from "@/components/matches/share-button";

export const metadata = { title: "Partidos" };

type SP = { temporada?: string; ver?: string; eliminado?: string };

export default async function MatchesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const s = await requirePerm("matches", "read");
  const supabase = await createClient();
  const season = seasonFromSlug(sp.temporada) ?? seasonOf();
  const view = sp.ver === "resultados" || sp.ver === "proximos" ? sp.ver : "todos";
  const [matches, seasons] = await Promise.all([fetchMatches(supabase, season), fetchMatchSeasons(supabase)]);

  const today = todayMadrid();
  const upcoming = matches.filter((m) => (m.status === "scheduled" && m.match_date >= today) || m.status === "postponed");
  const next = matches.find((m) => m.status === "scheduled" && m.match_date >= today) ?? null;
  const last = [...matches].reverse().find((m) => m.status === "played") ?? null;
  const rec = record(matches);
  const recent = form(matches);
  const run = streak(matches);

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
  const current = season === seasonOf();
  const canCreate = s.can("matches", "create");
  const hero = current ? next ?? last : last;

  return (
    <>
      <PageHeader
        title="Partidos"
        subtitle={<>Temporada <b>{season}</b>{current ? " · actual" : ""}</>}
        actions={<>
          {(s.can("matches", "update") || canCreate) && <Link href="/partidos/rivales" prefetch className="btn-ghost"><Shield size={18} /> Rivales</Link>}
          {canCreate && <Link href="/partidos/nuevo" prefetch className="btn-primary"><Plus size={18} /> Nuevo partido</Link>}
        </>}
      />
      {sp.eliminado && <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">Partido eliminado del calendario.</p>}

      {hero && (
        <section className="mb-6">
          <div className="mb-2 flex items-end justify-between gap-3">
            <h2 className="sport text-xl font-black">{hero === next ? "Próximo partido" : "Último resultado"}</h2>
            <ShareButton text={matchShareText(hero)} />
          </div>
          <Link href={`/partidos/${hero.id}`} prefetch className="block transition hover:-translate-y-0.5"><Scoreboard m={hero} /></Link>
        </section>
      )}

      {/* Balance de la temporada */}
      {rec.played > 0 && (
        <section className="relative mb-6 overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <span aria-hidden className="absolute -right-4 top-0 h-full w-10 -skew-x-[20deg] bg-dorado/80" />
          <div className="relative grid grid-cols-3 gap-4 sm:grid-cols-6">
            {([
              ["Jugados", rec.played, "text-negro"],
              ["Victorias", rec.W, "text-green-700"],
              ["Empates", rec.D, "text-negro/60"],
              ["Derrotas", rec.L, "text-rojo"],
              ["A favor", rec.gf, "text-negro"],
              ["En contra", rec.ga, "text-negro"],
            ] as const).map(([k, v, tone], i) => (
              <div key={k} className="anim-score" style={{ animationDelay: `${i * 70}ms` }}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-negro/65">{k}</div>
                <div className={`sport text-4xl font-black leading-none ${tone}`}><CountUp value={v} /></div>
              </div>
            ))}
          </div>
          <div className="relative mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <FormStrip rows={recent} />
            {run && <span className="inline-flex items-center gap-1.5 font-bold"><Trophy size={15} className="text-dorado" /> {run}</span>}
            <span className="text-negro/65">Diferencia de goles <b className="text-negro">{rec.gf - rec.ga > 0 ? "+" : ""}{rec.gf - rec.ga}</b></span>
          </div>
        </section>
      )}

      {/* Vista y temporada */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-black/5">
          {([["todos", "Calendario"], ["proximos", "Próximos"], ["resultados", "Resultados"]] as const).map(([v, label]) => (
            <Link key={v} href={link({ ver: v })} prefetch aria-current={view === v ? "page" : undefined}
              className={`sport rounded-lg px-3 py-1.5 text-sm font-black transition ${view === v ? "bg-negro text-white" : "text-negro/65 hover:text-negro"}`}>
              {label}
            </Link>
          ))}
        </div>
        {seasons.length > 1 && (
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

      {matches.length === 0 ? (
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
                  <li key={m.id} className="anim-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}><MatchLine m={m} /></li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
