import Link from "next/link";
import { Flame, Footprints, Hand, Shirt, Star } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { fetchMatchSeasons } from "@/lib/match-queries";
import { form, outcomeOf, record, type MatchRow } from "@/lib/matches";
import { lineOf, ratio, seasonFromSlug, seasonSlug, shirtName, sortRoster, type Membership, type Player } from "@/lib/squad";
import { getLeagueTableQuick } from "@/lib/league-table";
import { perGame } from "@/lib/standings";
import { appsLine, assistsLine, goalsLine, joinNames, pct, plural, rankBy, type Ranked } from "@/lib/stats-board";
import { Empty, PageHeader } from "@/components/ui";
import { Jersey } from "@/components/squad/jersey";
import { Ball } from "@/components/squad/ball";
import { CountUp } from "@/components/squad/count-up";
import { FormStrip } from "@/components/matches/match-bits";

export const maxDuration = 60;
export const metadata = { title: "Estadísticas" };

type Row = Membership & { player: Player };
const byNumber = (a: Row, b: Row) => (a.number ?? 99) - (b.number ?? 99);

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ temporada?: string }> }) {
  const sp = await searchParams;
  await requirePerm("matches", "read");
  const supabase = await createClient();
  const season = seasonFromSlug(sp.temporada) ?? seasonOf();
  const current = season === seasonOf();
  // Puesto en la liga (solo la temporada actual y sin esperar más de 2,5 s a la web de la liga)
  const rankP = current ? leagueRank(supabase).catch(() => null) : Promise.resolve(null);
  const [{ data: rosterData }, { data: allMatches }, seasons, rank] = await Promise.all([
    supabase.from("squad_members_full").select("*, player:players!inner(*)").eq("season", season).returns<Row[]>(),
    supabase.from("matches").select("*, rival:rivals!inner(*)").eq("status", "played").order("match_date").returns<MatchRow[]>(),
    fetchMatchSeasons(supabase),
    rankP,
  ]);
  const roster = sortRoster(rosterData ?? []) as Row[];
  const played = (allMatches ?? []).filter((m) => m.season === season);
  const rec = record(played);
  const withReport = played.filter((m) => m.report_saved_at).length;
  const last = form(played, 5);
  const ss = seasonSlug(season);

  // Histórico: balance de cada temporada
  const history = [...new Set((allMatches ?? []).map((m) => m.season))].sort().reverse().map((s) => {
    const list = (allMatches ?? []).filter((m) => m.season === s);
    const best = [...list].filter((m) => outcomeOf(m) === "W").sort((a, b) => (b.goals_for! - b.goals_against!) - (a.goals_for! - a.goals_against!))[0];
    return { season: s, r: record(list), best };
  });

  const gks = roster.filter((r) => lineOf(r.position) === "GK");
  const scorers = rankBy(roster, (r) => r.goals, { tie: byNumber });
  const assisters = rankBy(roster, (r) => r.assists, { tie: byNumber });
  const mvps = rankBy(roster, (r) => r.mvps, { tie: byNumber });
  const ga = rankBy(roster, (r) => r.goals + r.assists, { tie: byNumber });
  const zamora = rankBy(gks.filter((r) => r.apps > 0), (r) => r.conceded / r.apps, { asc: true, tie: byNumber });
  const apps = rankBy(roster, (r) => r.apps, { tie: byNumber });
  const cards = rankBy(roster, (r) => r.yellows + r.reds * 2, { tie: byNumber, limit: 3 });
  const anyStats = [scorers, assisters, mvps, ga, zamora, apps, cards].some((l) => l.length);

  return (
    <>
      <PageHeader title="Estadísticas" subtitle={<>Temporada <b>{season}</b> · {played.length} {plural(played.length, "partido jugado", "partidos jugados")} · {withReport} con acta</>}
        back={{ href: `/partidos?temporada=${ss}`, label: "Partidos" }} />

      {seasons.length > 1 && (
        <nav aria-label="Temporadas" className="mb-4 flex flex-wrap gap-2">
          {seasons.map((x) => (
            <Link key={x} href={`/partidos/estadisticas?temporada=${seasonSlug(x)}`} prefetch
              className={`sport rounded-full px-3 py-1 text-sm font-black ring-1 ${x === season ? "tab-on bg-negro text-white ring-negro" : "bg-white ring-black/10"}`}>{x}</Link>
          ))}
        </nav>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-x-6">
        <div className="lg:col-start-1 lg:row-start-1">
          {played.length > 0 && <Balance rec={rec} rank={rank} last={last} />}
          {history.length > 0 && <div className="hidden lg:block"><Seasons history={history} season={season} /></div>}
        </div>

        <div className="lg:col-start-2 lg:row-start-1">
          {!anyStats ? (
            <Empty>Aún no hay estadísticas de jugadores esta temporada. Salen solas de las actas de los partidos.</Empty>
          ) : (
            <>
              <SectionTitle>Cuadro de honor</SectionTitle>
              <div className="grid gap-3 xl:grid-cols-2">
                {scorers.length > 0 && (
                  <Leader title="Pichichi" what="quién marca más goles" icon={<Ball size={20} />} list={scorers} ss={ss}
                    unit={(n) => plural(n, "gol", "goles")} line={goalsLine(scorers[0].value, rec.gf)} share={pct(scorers[0].value, rec.gf)} />
                )}
                {assisters.length > 0 && (
                  <Leader title="Asistencias" what="quién da más pases de gol" icon={<Footprints size={20} className="text-rojo" />} list={assisters} ss={ss}
                    unit={(n) => plural(n, "asistencia", "asistencias")} line={assistsLine(assisters[0].value, rec.gf)} share={pct(assisters[0].value, rec.gf)} />
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-3">
                {mvps.length > 0 && (
                  <Mini tone="gold" title="MVP" what="el mejor del partido, votado por el equipo" icon={<Star size={16} className="fill-dorado text-dorado" />}
                    list={mvps} ss={ss} foot={(n) => plural(n, "vez", "veces")} />
                )}
                {ga.length > 0 && (
                  <Mini tone="rojo" title="Goles + asist." what="en cuántos goles ha participado" icon={<Flame size={16} className="text-rojo" />}
                    list={ga} ss={ss} foot={(n) => plural(n, "gol", "goles")} />
                )}
                {zamora.length > 0 && (
                  <Mini tone="negro" title="Zamora" what="el portero que menos goles recibe por partido" icon={<Hand size={16} />}
                    list={zamora} ss={ss} fmt={(r) => ratio(r.conceded, r.apps)}
                    foot={() => `por partido · ${zamora[0].row.clean_sheets} ${plural(zamora[0].row.clean_sheets, "portería", "porterías")} a cero`} />
                )}
                {apps.length > 0 && (
                  <Mini tone="negro" title="Fijos" what="quién ha jugado más partidos" icon={<Shirt size={16} />}
                    list={apps} ss={ss} foot={(n) => appsLine(n, rec.played)} />
                )}
                {cards.length > 0 && <Cards list={cards} ss={ss} />}
              </div>
            </>
          )}
          <p className="mt-4 text-xs text-negro/60">
            Las cifras de los jugadores salen solas de las actas y de la web de la liga. Los puntos del balance cuentan todos los partidos jugados, también los amistosos (3 por victoria y 1 por empate).
          </p>
        </div>

        {/* En el móvil, las temporadas van al final */}
        {history.length > 0 && <div className="lg:hidden"><Seasons history={history} season={season} /></div>}
      </div>
    </>
  );
}

async function leagueRank(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: l } = await supabase.from("league_sync").select("competition, team").eq("id", 1).maybeSingle<{ competition: string | null; team: string | null }>();
  if (!l?.competition || !l.team) return null;
  const t = await getLeagueTableQuick(l.competition);
  const me = t?.rows.find((r) => r.teamId === l.team);
  return me && t ? { pos: me.pos, total: t.rows.length } : null;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-6 flex items-center gap-3 lg:mt-0">
      <h2 className="sport text-2xl font-black uppercase italic leading-none">{children}</h2>
      <span aria-hidden className="h-0.5 flex-1 bg-gradient-to-r from-dorado to-transparent" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Balance del equipo                                                  */
/* ------------------------------------------------------------------ */

type Rec = ReturnType<typeof record>;

function Balance({ rec, rank, last }: { rec: Rec; rank: { pos: number; total: number } | null; last: MatchRow[] }) {
  const diff = rec.gf - rec.ga;
  const parts = [
    { n: rec.W, label: plural(rec.W, "ganado", "ganados"), dot: "bg-green-600" },
    { n: rec.D, label: plural(rec.D, "empatado", "empatados"), dot: "bg-neutral-400" },
    { n: rec.L, label: plural(rec.L, "perdido", "perdidos"), dot: "bg-rojo" },
  ];
  return (
    <section aria-label="Balance del equipo" className="relative mb-4 overflow-hidden rounded-3xl bg-[radial-gradient(ellipse_at_top,#242424,#080808_65%)] p-4 text-white shadow-[0_18px_40px_-22px_rgba(0,0,0,0.8)] sm:p-5">
      <span aria-hidden className="anim-sweep pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_0_72%,rgba(210,13,23,0.35)_72%_84%,rgba(213,175,50,0.45)_84%_85.5%,transparent_85.5%)]" />
      <div className="relative">
        <div className="text-xs font-bold uppercase tracking-[0.14em] text-dorado">Balance del equipo</div>
        <div className="mt-1.5 flex items-end gap-3">
          <CountUp value={rec.points} className="sport text-[4.75rem] font-black italic leading-[0.8]" />
          <div className="pb-0.5 leading-tight">
            <div className="sport text-2xl font-black uppercase italic">{plural(rec.points, "punto", "puntos")}</div>
            <div className="text-sm text-white/70">en {rec.played} {plural(rec.played, "partido", "partidos")}</div>
          </div>
          {rank && (
            <div className="ml-auto rounded-2xl bg-dorado px-3 py-1.5 text-center text-negro shadow-[0_6px_16px_-8px_rgba(213,175,50,0.9)]">
              <div className="sport text-3xl font-black italic leading-none">{rank.pos}º</div>
              <div className="text-[10px] font-bold uppercase tracking-wider">de {rank.total} en liga</div>
            </div>
          )}
        </div>

        {/* Ganados · empatados · perdidos */}
        <div className="mt-4 flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-white/10" role="img"
          aria-label={`${rec.W} ganados, ${rec.D} empatados y ${rec.L} perdidos`}>
          {rec.W > 0 && <span className="anim-fill bg-green-600" style={{ flex: rec.W }} />}
          {rec.D > 0 && <span className="anim-fill bg-neutral-400" style={{ flex: rec.D, animationDelay: "120ms" }} />}
          {rec.L > 0 && <span className="anim-fill bg-rojo" style={{ flex: rec.L, animationDelay: "240ms" }} />}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {parts.map((p) => (
            <div key={p.label} className="rounded-xl bg-white/[0.07] px-2.5 py-2">
              <div className="sport text-3xl font-black italic leading-none tabular-nums">{p.n}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-white/80"><span className={`h-2 w-2 rounded-full ${p.dot}`} />{p.label}</div>
            </div>
          ))}
        </div>

        {/* Goles */}
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="rounded-xl bg-white/[0.07] px-2.5 py-2">
            <div className="sport text-3xl font-black italic leading-none tabular-nums">{rec.gf}</div>
            <div className="mt-0.5 text-xs leading-tight text-white/80">{plural(rec.gf, "gol marcado", "goles marcados")}<br /><span className="text-white/55">{perGame(rec.gf, rec.played)} por partido</span></div>
          </div>
          <div className="text-center">
            <div className={`sport text-2xl font-black italic leading-none ${diff > 0 ? "text-green-400" : diff < 0 ? "text-[#ff6b6b]" : "text-white"}`}>
              {diff > 0 ? `+${diff}` : diff < 0 ? `−${-diff}` : "0"}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-white/60">diferencia</div>
          </div>
          <div className="rounded-xl bg-white/[0.07] px-2.5 py-2 text-right">
            <div className="sport text-3xl font-black italic leading-none tabular-nums">{rec.ga}</div>
            <div className="mt-0.5 text-xs leading-tight text-white/80">{plural(rec.ga, "gol recibido", "goles recibidos")}<br /><span className="text-white/55">{perGame(rec.ga, rec.played)} por partido</span></div>
          </div>
        </div>

        {last.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/75">Últimos partidos</span>
            <FormStrip rows={last} label={false} />
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Cuadro de honor                                                     */
/* ------------------------------------------------------------------ */

/** Cromo dorado pequeño del líder: foto (o camiseta) con el dorsal y el nombre. */
function LeaderCromo({ r }: { r: Row }) {
  const gk = lineOf(r.position) === "GK";
  return (
    <div className="relative w-[6.5rem] shrink-0 rounded-xl bg-[linear-gradient(145deg,#f6dc7a,#D5AF32_40%,#8f6f12)] p-[3px] shadow-[0_10px_20px_-12px_rgba(0,0,0,0.7)]" style={{ aspectRatio: "0.74" }}>
      <div className="cromo-shine relative h-full overflow-hidden rounded-[10px] bg-[linear-gradient(160deg,#fbeaa6_0%,#e3c255_38%,#b8901f_100%)]">
        <span aria-hidden className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0_74%,rgba(210,13,23,0.9)_74%_84%,rgba(8,8,8,0.85)_84%_86%,transparent_86%)] [mask-image:linear-gradient(to_bottom,black_0%,black_40%,transparent_60%)]" />
        <span className="sport absolute left-1.5 top-1 z-10 text-2xl font-black italic leading-none text-negro">{r.number ?? ""}</span>
        <div className="absolute inset-x-0 bottom-5 top-3 flex items-end justify-center">
          {r.player.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.player.photo_url} alt="" loading="lazy" className="h-full w-full object-cover object-top [mask-image:linear-gradient(to_bottom,black_75%,transparent)]" />
          ) : (
            <span className="mb-1 drop-shadow-[0_8px_10px_rgba(0,0,0,0.5)]"><Jersey number={r.number} goalkeeper={gk} size={66} /></span>
          )}
        </div>
        <div className="sport absolute inset-x-0 bottom-0 truncate bg-negro px-1 py-0.5 text-center text-sm font-black uppercase italic text-white">{shirtName(r.player)}</div>
      </div>
    </div>
  );
}

function Leader({ title, what, icon, list, unit, line, share, ss }: {
  title: string; what: string; icon: React.ReactNode; list: Ranked<Row>[]; unit: (n: number) => string; line: string | null; share: number; ss: string;
}) {
  const leaders = list.filter((x) => x.pos === 1);
  const top = leaders[0];
  const rest = list.filter((x) => !leaders.includes(x));
  const tied = leaders.length > 1;
  return (
    <section className="anim-rise overflow-hidden rounded-2xl bg-white shadow-[0_10px_24px_-16px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
      <div className="flex items-center gap-2 px-4 pt-3">
        {icon}
        <h3 className="sport text-xl font-black uppercase italic leading-none">{title}</h3>
        <p className="ml-auto text-right text-xs text-negro/60">{what}</p>
      </div>
      <Link href={`/plantilla/${top.row.player_id}?temporada=${ss}`} prefetch className="group flex items-center gap-4 px-4 pb-3 pt-2.5">
        <LeaderCromo r={top.row} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <CountUp value={top.value} className="sport text-6xl font-black italic leading-[0.85] text-rojo" />
            <span className="font-bold">{unit(top.value)}</span>
          </div>
          <div className="sport mt-1 truncate text-lg font-black uppercase italic leading-none group-hover:text-rojo">{leaderNames(leaders)}</div>
          {tied ? (
            <p className="mt-1.5 text-[13px] leading-snug text-negro/70">Empatados en cabeza</p>
          ) : line ? (
            <>
              <p className="mt-1.5 text-[13px] leading-snug text-negro/70">{line}</p>
              {share > 0 && (
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/[0.06]">
                  <span className="anim-fill block h-full rounded-full bg-gradient-to-r from-rojo to-[#ff4d55]" style={{ width: `${share}%` }} />
                </div>
              )}
            </>
          ) : null}
        </div>
      </Link>
      {rest.length > 0 && (
        <ol className="border-t border-black/5 px-4 py-1.5">
          {rest.map((x) => (
            <li key={x.row.id}>
              <Link href={`/plantilla/${x.row.player_id}?temporada=${ss}`} prefetch className="flex items-center gap-2.5 rounded-lg py-1.5 transition hover:bg-gris">
                <span className="sport w-5 text-center text-lg font-black italic text-negro/45">{x.pos}</span>
                <Jersey number={x.row.number} goalkeeper={lineOf(x.row.position) === "GK"} size={24} />
                <span className="w-24 min-w-0 truncate font-bold">{shirtName(x.row.player)}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                  <span className="anim-fill block h-full rounded-full bg-negro" style={{ width: `${Math.max(6, Math.round((x.value / top.value) * 100))}%` }} />
                </span>
                <span className="sport w-7 text-right text-xl font-black italic tabular-nums text-rojo">{x.value}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** "Dani", "Dani y Javi" o, si empatan muchos, "Martín y 6 más". */
const leaderNames = (leaders: Ranked<Row>[]) =>
  leaders.length > 2 ? `${shirtName(leaders[0].row.player)} y ${leaders.length - 1} más` : joinNames(leaders.map((x) => shirtName(x.row.player)));

const TONE = { rojo: "bg-rojo", gold: "bg-dorado", negro: "bg-negro" } as const;

function Mini({ title, what, icon, list, foot, fmt, tone, ss }: {
  title: string; what: string; icon: React.ReactNode; list: Ranked<Row>[]; foot: (n: number) => string; fmt?: (r: Row) => string; tone: keyof typeof TONE; ss: string;
}) {
  const top = list[0];
  const leaders = list.filter((x) => x.pos === 1);
  const next = list.find((x) => x.pos !== 1);
  return (
    <section className="anim-rise relative overflow-hidden rounded-2xl bg-white p-3 ring-1 ring-black/5">
      <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${TONE[tone]}`} />
      <h3 className="sport flex items-center gap-1.5 text-base font-black uppercase italic leading-none">{icon}{title}</h3>
      <p className="mt-1 min-h-[2rem] text-[11px] leading-tight text-negro/60">{what}</p>
      <Link href={`/plantilla/${top.row.player_id}?temporada=${ss}`} prefetch className="group mt-1.5 flex items-center gap-1.5">
        <Jersey number={top.row.number} goalkeeper={lineOf(top.row.position) === "GK"} size={26} />
        <span className="min-w-0 flex-1 truncate font-bold group-hover:text-rojo">
          {leaderNames(leaders)}
        </span>
        <span className="sport text-3xl font-black italic leading-none tabular-nums text-rojo">{fmt ? fmt(top.row) : top.value}</span>
      </Link>
      <p className="mt-1 text-xs text-negro/65">
        {foot(top.value)}
        {next && <> · luego {shirtName(next.row.player)} ({fmt ? fmt(next.row) : next.value})</>}
      </p>
    </section>
  );
}

/** Tarjeta del árbitro dibujada. */
const RefCard = ({ red = false }: { red?: boolean }) => (
  <span aria-hidden className={`inline-block h-[18px] w-[13px] -rotate-6 rounded-[2px] shadow-sm ring-1 ring-black/10 ${red ? "bg-rojo" : "bg-yellow-400"}`} />
);

function Cards({ list, ss }: { list: Ranked<Row>[]; ss: string }) {
  return (
    <section className="anim-rise relative col-span-2 overflow-hidden rounded-2xl bg-white p-3 ring-1 ring-black/5 xl:col-span-1">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-yellow-400" />
      <h3 className="sport flex items-center gap-1.5 text-base font-black uppercase italic leading-none"><RefCard /> Tarjetas</h3>
      <p className="mt-1 text-[11px] leading-tight text-negro/60">amarillas y rojas de la temporada</p>
      <ol className="mt-1.5 space-y-1">
        {list.map((x) => (
          <li key={x.row.id}>
            <Link href={`/plantilla/${x.row.player_id}?temporada=${ss}`} prefetch className="group flex items-center gap-1.5">
              <Jersey number={x.row.number} goalkeeper={lineOf(x.row.position) === "GK"} size={24} />
              <span className="min-w-0 flex-1 truncate font-bold group-hover:text-rojo">{shirtName(x.row.player)}</span>
              <span className="flex items-center gap-1" aria-label={`${x.row.yellows} amarillas y ${x.row.reds} rojas`}>
                {x.row.yellows > 0 && <><RefCard /><span className="sport text-lg font-black italic tabular-nums">{x.row.yellows}</span></>}
                {x.row.reds > 0 && <span className="ml-1.5 flex items-center gap-1"><RefCard red /><span className="sport text-lg font-black italic tabular-nums">{x.row.reds}</span></span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Temporadas                                                          */
/* ------------------------------------------------------------------ */

function Seasons({ history, season }: { history: { season: string; r: Rec; best: MatchRow | undefined }[]; season: string }) {
  return (
    <>
      <SectionTitle>Temporadas</SectionTitle>
      <ul className="space-y-2">
        {history.map((h) => (
          <li key={h.season}>
            <div className={`flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ${h.season === season ? "ring-2 ring-dorado/70" : "ring-black/5"}`}>
              <Link href={`/partidos/estadisticas?temporada=${seasonSlug(h.season)}`} className="sport text-2xl font-black italic leading-none hover:text-rojo">{h.season.replace(/^20/, "").replace("/20", "/")}</Link>
              <div className="min-w-0 flex-1 text-xs text-negro/70">
                <div>{h.r.played} {plural(h.r.played, "partido", "partidos")} · {h.r.W} {plural(h.r.W, "ganado", "ganados")} · {h.r.D} {plural(h.r.D, "empate", "empates")} · {h.r.L} {plural(h.r.L, "perdido", "perdidos")}</div>
                <div className="my-1 flex h-2 gap-0.5 overflow-hidden rounded-full bg-black/[0.06]">
                  {h.r.W > 0 && <span className="bg-green-600" style={{ flex: h.r.W }} />}
                  {h.r.D > 0 && <span className="bg-neutral-400" style={{ flex: h.r.D }} />}
                  {h.r.L > 0 && <span className="bg-rojo" style={{ flex: h.r.L }} />}
                </div>
                <div className="truncate">
                  Mayor victoria: {h.best ? <Link href={`/partidos/${h.best.id}`} className="font-bold hover:text-rojo">{h.best.goals_for}-{h.best.goals_against} contra {h.best.rival.name}</Link> : "todavía ninguna"}
                </div>
              </div>
              <div className="text-right">
                <div className="sport text-3xl font-black italic leading-none">{h.r.points}</div>
                <div className="text-[10px] uppercase tracking-wider text-negro/60">{plural(h.r.points, "punto", "puntos")}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
