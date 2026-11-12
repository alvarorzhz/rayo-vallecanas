import Link from "next/link";
import { Award, CalendarCheck, Target, Trophy } from "lucide-react";
import { getSession, requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { fetchMatchSeasons } from "@/lib/match-queries";
import { fetchRoster } from "@/lib/squad-queries";
import { lineOf, seasonSlug, shirtName } from "@/lib/squad";
import { shortDay } from "@/lib/matches";
import { playerSummary, teamSummary } from "@/lib/season-summary";
import { fetchCompetitions, fetchSummaryData, porraOf, resolveScope, scopeSlug, competitionShort } from "@/lib/season-summary-queries";
import { plural } from "@/lib/stats-board";
import { Empty, PageHeader } from "@/components/ui";
import { Jersey } from "@/components/squad/jersey";
import { CountUp } from "@/components/squad/count-up";
import { ShareImageButton } from "@/components/matches/share-image";

export const metadata = { title: "Resumen de temporada" };

const ord = (n: number | null) => (n ? `${n}º` : "–");

export default async function SummaryPage({ searchParams }: { searchParams: Promise<{ de?: string; jugador?: string }> }) {
  const sp = await searchParams;
  await requirePerm("matches", "read");
  const [s, supabase] = await Promise.all([getSession(), createClient()]);
  const scope = await resolveScope(supabase, sp.de, seasonOf());
  const season = scope.kind === "season" ? scope.season : scope.season ?? seasonOf();
  const [data, roster, comps, seasons] = await Promise.all([
    fetchSummaryData(supabase, scope),
    fetchRoster(supabase, season),
    fetchCompetitions(supabase),
    fetchMatchSeasons(supabase),
  ]);
  const team = teamSummary(data.matches);
  // Jugadores con algún partido en el acta (y el propio usuario aunque no haya jugado)
  const playedIds = new Set(data.apps.map((a) => a.player_id));
  const players = roster.filter((r) => playedIds.has(r.player_id) || r.player.user_id === s.user.id);
  const mine = roster.find((r) => r.player.user_id === s.user.id) ?? null;
  const who = players.find((r) => r.player_id === sp.jugador) ?? mine ?? players[0] ?? null;
  const sum = who ? playerSummary(who.player_id, data) : null;
  const porra = who ? porraOf(data, who.player.user_id) : null;
  const scopeName = scope.kind === "season" ? `temporada ${scope.season}` : scope.name;
  const slug = scopeSlug(scope);
  const link = (p: { de?: string; jugador?: string }) => `/partidos/resumen?${new URLSearchParams({ de: p.de ?? slug, ...(p.jugador ?? who?.player_id ? { jugador: p.jugador ?? who!.player_id } : {}) })}`;
  const gk = who ? lineOf(who.position) === "GK" || (sum?.gkApps ?? 0) > (sum?.apps ?? 0) / 2 : false;

  const tiles: [string, number, string?][] = sum ? [
    ["Partidos", sum.apps, sum.appsRank === 1 ? "el que más" : undefined],
    ...(gk ? [["Porterías a cero", sum.cleanSheets] as [string, number], ["Encajados", sum.conceded] as [string, number]] : [["Goles", sum.goals, sum.goalsRank ? `${ord(sum.goalsRank)} del equipo` : undefined] as [string, number, string?], ["Asistencias", sum.assists, sum.assistsRank ? `${ord(sum.assistsRank)} del equipo` : undefined] as [string, number, string?]]),
    ["MVP", sum.mvps],
  ] : [];

  return (
    <>
      <PageHeader title="Resumen de temporada" subtitle={<>Lo mejor de cada uno en {scope.kind === "season" ? <>la <b>{scopeName}</b></> : <>el <b>{scopeName}</b>{scope.season ? ` ${scope.season}` : ""}</>}</>}
        back={{ href: `/partidos/estadisticas?temporada=${seasonSlug(season)}`, label: "Estadísticas" }} />

      <nav aria-label="Qué resumen" className="mb-3 flex flex-wrap gap-2">
        {comps.map((c) => (
          <Link key={c.competition} href={link({ de: `c${c.competition}` })} prefetch
            className={`sport rounded-full px-3 py-1 text-sm font-black ring-1 ${slug === `c${c.competition}` ? "tab-on bg-negro text-white ring-negro" : "bg-white ring-black/10"}`}>
            {competitionShort(c.name)}{c.season ? ` ${c.season}` : ""}{c.finished ? "" : " · en juego"}
          </Link>
        ))}
        {seasons.map((x) => (
          <Link key={x} href={link({ de: seasonSlug(x) })} prefetch
            className={`sport rounded-full px-3 py-1 text-sm font-black ring-1 ${slug === seasonSlug(x) ? "tab-on bg-negro text-white ring-negro" : "bg-white ring-black/10"}`}>Temporada {x}</Link>
        ))}
      </nav>

      {players.length > 1 && (
        <nav aria-label="Jugador" className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none]">
          {players.map((r) => (
            <Link key={r.player_id} href={link({ jugador: r.player_id })} prefetch={false} scroll={false}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold transition ${who?.player_id === r.player_id ? "tab-on bg-rojo text-white" : "bg-white text-negro/70 ring-1 ring-black/10 hover:ring-negro/30"}`}>
              {r.number != null ? `${r.number} · ` : ""}{shirtName(r.player)}{r.player.user_id === s.user.id ? " (tú)" : ""}
            </Link>
          ))}
        </nav>
      )}

      {!data.matches.length ? (
        <Empty>Todavía no hay partidos jugados con acta en {scope.kind === "season" ? `la ${scopeName}` : `el ${scopeName}`}.</Empty>
      ) : !who || !sum ? (
        <Empty>No hay jugadores con partidos en {scopeName}.</Empty>
      ) : (
        <div className="mx-auto max-w-2xl space-y-5">
          {/* La portada del resumen */}
          <section className="franja relative overflow-hidden rounded-3xl bg-negro p-5 text-white shadow-xl sm:p-6">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(213,175,50,0.18),transparent_60%)]" />
            <div className="relative flex items-center gap-4">
              {who.player.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={who.player.photo_url} alt="" className="h-24 w-24 shrink-0 rounded-2xl object-cover ring-4 ring-dorado" />
              ) : (
                <span className="anim-trophy shrink-0"><Jersey number={who.number} goalkeeper={gk} size={84} /></span>
              )}
              <div className="min-w-0">
                <p className="sport text-xs font-black tracking-[0.2em] text-dorado">RESUMEN · {scopeName.toUpperCase()}</p>
                <h2 className="sport truncate text-4xl font-black leading-none">{shirtName(who.player)}</h2>
                <p className="mt-2 inline-flex -skew-x-[10deg] items-center gap-1.5 rounded bg-dorado px-2.5 py-0.5 text-sm font-black uppercase tracking-wider text-negro"><Award size={15} /> {sum.badge.title}</p>
                <p className="mt-1.5 text-sm text-white/80">{sum.badge.line}</p>
              </div>
            </div>
            <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {tiles.map(([k, v, hint], i) => (
                <div key={k} className="anim-score rounded-2xl bg-white/5 p-3 ring-1 ring-white/10" style={{ animationDelay: `${i * 90}ms` }}>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">{k}</div>
                  <div className="sport text-4xl font-black leading-none text-white"><CountUp value={v} /></div>
                  {hint && <div className="mt-1 text-[11px] font-bold text-dorado">{hint}</div>}
                </div>
              ))}
            </div>
            <div className="relative mt-4 flex flex-wrap gap-2">
              <ShareImageButton url={`/api/resumen/${who.player_id}/${slug}`} name={`resumen-${shirtName(who.player).toLowerCase().replace(/\s+/g, "-")}.jpg`} title="Imagen del resumen" />
            </div>
          </section>

          {/* Su mejor partido */}
          {sum.best && (sum.best.goals > 0 || sum.best.assists > 0 || sum.best.mvp) && (
            <section className="card flex items-center gap-4">
              <Trophy size={28} className="shrink-0 text-dorado" />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-negro/60">Su mejor partido</p>
                <p className="sport text-xl font-black leading-tight">
                  {sum.best.match.is_home ? `Rayo ${sum.best.match.goals_for}-${sum.best.match.goals_against} ${sum.best.match.rival}` : `${sum.best.match.rival} ${sum.best.match.goals_against}-${sum.best.match.goals_for} Rayo`}
                </p>
                <p className="text-sm text-negro/70">
                  {shortDay(sum.best.match.match_date)} · {[sum.best.goals ? plural(sum.best.goals, "1 gol", `${sum.best.goals} goles`) : null, sum.best.assists ? plural(sum.best.assists, "1 asistencia", `${sum.best.assists} asistencias`) : null, sum.best.mvp ? "MVP ⭐" : null].filter(Boolean).join(" · ")}
                </p>
              </div>
            </section>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="card space-y-1">
              <h3 className="flex items-center gap-2 font-bold"><CalendarCheck size={18} className="text-rojo" /> Compromiso</h3>
              {sum.called ? (
                <p className="text-sm text-negro/75">Convocado <b>{sum.called}</b> {plural(sum.called, "vez", "veces")} y dijo «Voy» a <b>{sum.said_yes}</b>.</p>
              ) : <p className="text-sm text-negro/65">Sin convocatorias en la app en este tramo.</p>}
              <p className="text-sm text-negro/75"><b>{sum.wins}</b> {plural(sum.wins, "victoria", "victorias")} con él en el campo{sum.yellows || sum.reds ? ` · ${sum.yellows} 🟨${sum.reds ? ` · ${sum.reds} 🟥` : ""}` : ""}.</p>
            </section>
            <section className="card space-y-1">
              <h3 className="flex items-center gap-2 font-bold"><Target size={18} className="text-rojo" /> La porra</h3>
              {porra ? (
                <p className="text-sm text-negro/75"><b>{porra.pos}º</b> con <b>{porra.points} {plural(porra.points, "punto", "puntos")}</b> · {porra.exact} {plural(porra.exact, "resultado clavado", "resultados clavados")}.</p>
              ) : <p className="text-sm text-negro/65">{who.player.user_id ? "No jugó la porra en este tramo." : "Sin usuario en la app."}</p>}
            </section>
          </div>

          <section className="card">
            <h3 className="mb-2 font-bold">El equipo</h3>
            <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
              {([["PJ", team.played], ["V", team.W], ["E", team.D], ["D", team.L], ["GF", team.gf], ["GC", team.ga]] as [string, number][]).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-gris/60 py-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-negro/60">{k}</div>
                  <div className="sport text-2xl font-black tabular-nums">{v}</div>
                </div>
              ))}
            </div>
          </section>
          <p className="text-center text-xs text-negro/60">Sale de las actas de {team.played} {plural(team.played, "partido", "partidos")}. Cualquiera del equipo puede ver el resumen de los demás.</p>
        </div>
      )}
    </>
  );
}
