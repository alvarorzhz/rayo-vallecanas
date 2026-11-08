import Link from "next/link";
import { ArrowRight, Cross, Plane } from "lucide-react";
import { POSITION_LABEL, STATUS_LABEL, lineOf, ratio, seasonSlug, shirtName, type RosterEntry } from "@/lib/squad";
import { outcomeOf, shortDay, sides, type MatchRow } from "@/lib/matches";
import type { Appearance } from "@/lib/reports";
import { OutcomeDot } from "@/components/matches/match-bits";
import { PlayerCard } from "@/components/squad/player-card";
import { CountUp } from "@/components/squad/count-up";

type LogRow = Appearance & { match: MatchRow; goals: number; assists: number; mvp: boolean };

/** Partidos seguidos (desde el último) en los que se cumple algo. */
const runOf = (log: LogRow[], ok: (r: LogRow) => boolean) => {
  let n = 0;
  for (const r of log) {
    if (!ok(r)) break;
    n++;
  }
  return n;
};

/** «Tu temporada» en Inicio: el cromo del usuario, sus números y cómo le van los últimos partidos. */
export function MySeason({ entry, squad, log, season }: { entry: RosterEntry; squad: RosterEntry[]; log: LogRow[]; season: string }) {
  const gk = lineOf(entry.position) === "GK";
  const href = `/plantilla/${entry.player_id}?temporada=${seasonSlug(season)}`;
  const stats: [string, number][] = gk
    ? [["Partidos", entry.apps], ["Titular", entry.starts], ["Port. a cero", entry.clean_sheets], ["Encajados", entry.conceded], ["MVP", entry.mvps]]
    : [["Partidos", entry.apps], ["Titular", entry.starts], ["Goles", entry.goals], ["Asist.", entry.assists], ["MVP", entry.mvps]];

  // Puesto en la tabla de goleadores (o de MVP para los porteros) del equipo
  const key = gk ? "mvps" : "goals";
  const rank = entry[key] > 0 ? squad.filter((r) => r[key] > entry[key]).length + 1 : null;
  const facts: string[] = [];
  if (rank) facts.push(gk ? `${rank}º en MVP del equipo` : rank === 1 ? "🥇 Pichichi del equipo" : `${rank}º máximo goleador del equipo`);
  if (!gk && entry.apps > 0) facts.push(`${ratio(entry.goals + entry.assists, entry.apps)} goles + asist. por partido`);
  if (gk && entry.apps > 0) facts.push(`${ratio(entry.conceded, entry.apps)} encajados por partido`);
  const scoring = runOf(log, (r) => r.goals > 0);
  if (scoring >= 2) facts.push(`🔥 Marcando ${scoring} partidos seguidos`);
  const playing = runOf(log, () => true);
  if (gk && log.length && runOf(log, (r) => r.conceded === 0) >= 2) facts.push(`🧤 ${runOf(log, (r) => r.conceded === 0)} partidos sin encajar`);
  if (!facts.length && playing === 0) facts.push("Aún no has jugado esta temporada. ¡Tu momento llegará!");

  const last = log[0] ?? null;
  const lastText = (r: LogRow) => {
    const [a, b] = sides(r.match, r.match.rival);
    const bits = [r.started ? "titular" : "suplente", r.goals && `${r.goals} ${r.goals === 1 ? "gol" : "goles"}`, r.assists && `${r.assists} asist.`, r.mvp && "MVP 🌟"].filter(Boolean);
    return { score: `${a.goals}-${b.goals}`, bits: bits.join(" · ") };
  };

  return (
    <section aria-labelledby="mi-temporada" className="franja relative mb-6 overflow-hidden rounded-3xl bg-negro text-white shadow-xl">
      <div aria-hidden className={`absolute inset-0 ${gk ? "bg-[linear-gradient(150deg,#3a2f0b_0%,#080808_65%)]" : "bg-[linear-gradient(150deg,#3b0609_0%,#080808_65%)]"}`} />
      {entry.number != null && (
        <span aria-hidden className="sport pointer-events-none absolute -bottom-8 right-2 select-none text-[10rem] font-black leading-none text-white/[0.05] sm:text-[13rem]">{entry.number}</span>
      )}
      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-7 sm:p-6">
        <div className="mx-auto w-36 shrink-0 sm:mx-0 sm:w-44"><PlayerCard entry={entry} href={href} /></div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="mi-temporada" className="sport text-xs font-black uppercase tracking-[0.2em] text-dorado">Tu temporada {season}</h2>
            {entry.status !== "active" && (
              <span className="badge bg-white/15 text-white">
                {entry.status === "injured" && <Cross size={11} className="mr-1" strokeWidth={3} />}
                {entry.status === "away" && <Plane size={11} className="mr-1" />}
                {STATUS_LABEL[entry.status]}
              </span>
            )}
          </div>
          <p className="sport truncate text-4xl font-black leading-none sm:text-5xl">
            {entry.number != null && <span className="mr-2 text-dorado">{entry.number}</span>}{shirtName(entry.player)}
          </p>
          <p className="mt-1 text-sm text-white/70">{POSITION_LABEL[entry.position]}</p>

          <dl className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2">
            {stats.map(([k, v]) => (
              <div key={k} className="flex flex-col-reverse rounded-xl bg-white/[0.08] px-1 py-2 text-center ring-1 ring-white/10">
                <dt className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-white/70 sm:text-[11px]">{k}</dt>
                <dd className="sport text-2xl font-black leading-none tabular-nums text-dorado sm:text-3xl"><CountUp value={v} /></dd>
              </div>
            ))}
          </dl>

          {facts.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {facts.map((f) => <li key={f} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold">{f}</li>)}
            </ul>
          )}

          {log.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">Tus partidos</span>
                <ol className="flex gap-1">
                  {log.slice(0, 5).reverse().map((r) => (
                    <li key={r.id} className="relative">
                      <Link href={`/partidos/${r.match_id}`} prefetch={false} title={`${r.match.rival.name}${r.goals ? ` · ${r.goals} gol${r.goals > 1 ? "es" : ""}` : ""}`}>
                        {outcomeOf(r.match) ? <OutcomeDot m={r.match} title={false} /> : null}
                        {r.goals > 0 && <span aria-hidden className="absolute -right-1 -top-1 text-[10px]">⚽</span>}
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
              {last && (
                <Link href={`/partidos/${last.match_id}`} prefetch={false} className="group flex min-w-0 items-center gap-1.5 text-sm text-white/85 hover:text-white">
                  <span className="shrink-0 text-white/70">Último:</span>
                  <span className="truncate"><b>{last.match.rival.name}</b> {lastText(last).score} · {shortDay(last.match.match_date)} · {lastText(last).bits}</span>
                  <ArrowRight size={15} className="shrink-0 transition group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          )}
          <Link href={href} prefetch className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-dorado hover:underline">Ver tu ficha completa <ArrowRight size={15} /></Link>
        </div>
      </div>
    </section>
  );
}
