import Link from "next/link";
import { CalendarClock, MapPin } from "lucide-react";
import {
  COMPETITION_LABEL, MATCH_STATUS_LABEL, MATCH_STATUS_TONE, OUTCOME_LABEL, OUTCOME_TONE,
  hhmm, kickoffDate, longDay, mapsLink, outcomeOf, relativeDay, rivalShort, shortDay, sides, CLUB_SHORT,
  type MatchRow,
} from "@/lib/matches";
import { Crest } from "@/components/matches/crest";
import { Countdown } from "@/components/matches/countdown";
import { Ball } from "@/components/squad/ball";
import { ordinal, pts, type MatchRanks, type Rank } from "@/lib/standings";

/** «5º · 9 pts»: posición y puntos en la liga. */
export function RankChip({ r, dark = false, className = "" }: { r: Rank; dark?: boolean; className?: string }) {
  const zone = r.zone?.color;
  return (
    <span title={`${ordinal(r.pos)} de ${r.total} en la liga con ${pts(r.points)}${r.zone ? ` · zona de ${r.zone.label}` : ""}`}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-bold leading-none tabular-nums ${dark ? "bg-black/60 text-white ring-1 ring-white/20" : "bg-dorado/20 text-negro ring-1 ring-dorado/40"} ${className}`}>
      {zone && <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: zone }} />}
      <span className="sport font-black">{ordinal(r.pos)}</span>
      <span aria-hidden className="opacity-50">·</span>
      <span>{pts(r.points)}</span>
    </span>
  );
}

/** Bolita V/E/D. */
export function OutcomeDot({ m, size = "md", title = true }: { m: MatchRow; size?: "sm" | "md"; title?: boolean }) {
  const o = outcomeOf(m);
  if (!o) return null;
  const dim = size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs";
  return (
    <span title={title ? `${OUTCOME_LABEL[o].long} ${m.goals_for}-${m.goals_against} contra ${m.rival.name}` : undefined}
      className={`sport inline-flex shrink-0 items-center justify-center rounded-full font-black ${dim} ${OUTCOME_TONE[o]}`}>
      <span aria-hidden>{OUTCOME_LABEL[o].short}</span>
      <span className="sr-only">{OUTCOME_LABEL[o].long}</span>
    </span>
  );
}

/** Racha: los últimos resultados, el más reciente a la derecha. */
export function FormStrip({ rows, label = true }: { rows: MatchRow[]; label?: boolean }) {
  if (!rows.length) return null;
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-[11px] font-bold uppercase tracking-wider text-current opacity-70">Racha</span>}
      <ol className="flex gap-1">
        {rows.map((m, i) => (
          <li key={m.id} className="anim-score" style={{ animationDelay: `${i * 70}ms` }}>
            <Link href={`/partidos/${m.id}`} prefetch={false}><OutcomeDot m={m} /></Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function StatusBadge({ m }: { m: MatchRow }) {
  if (m.status === "scheduled" || m.status === "played") return null;
  return <span className={`badge ${MATCH_STATUS_TONE[m.status]}`}>{MATCH_STATUS_LABEL[m.status]}</span>;
}

/** Videomarcador: escudos, nombres, marcador o cuenta atrás. */
export function Scoreboard({ m, countdown = true, compact = false, ranks }: { m: MatchRow; countdown?: boolean; compact?: boolean; ranks?: MatchRanks | null }) {
  const [a, b] = sides(m, m.rival);
  const played = m.status === "played";
  const o = outcomeOf(m);
  const crest = compact ? 44 : 64;
  const team = (t: typeof a) => (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <Crest us={t.us} rival={t.us ? null : m.rival} size={crest} />
      <span className={`sport block w-full truncate font-black leading-tight ${compact ? "text-base" : "text-lg sm:text-2xl"} ${t.us ? "text-white" : "text-white/90"}`}>
        <span className="sm:hidden">{t.us ? CLUB_SHORT : rivalShort(m.rival)}</span>
        <span className="hidden sm:inline">{t.name}</span>
      </span>
      {(() => { const r = t.us ? ranks?.us : ranks?.rival; return r ? <RankChip r={r} dark /> : null; })()}
    </div>
  );
  return (
    <div className="franja relative overflow-hidden rounded-3xl bg-negro p-5 text-white shadow-xl sm:p-6">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.12),transparent_60%)]" />
      <div className="relative mb-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[11px] font-bold uppercase tracking-[0.15em] text-dorado">
        <span>{COMPETITION_LABEL[m.competition]}{m.round ? ` · ${m.round}` : ""}</span>
        <span className="text-white/40">|</span>
        <span className="text-white/80">{m.is_home ? "En casa" : "Fuera"}</span>
      </div>
      <div className="relative flex items-center gap-2 sm:gap-4">
        {team(a)}
        <div className="flex shrink-0 flex-col items-center">
          {played ? (
            <div className="anim-score flex items-center gap-1.5 rounded-xl bg-black/60 px-3 py-2 ring-1 ring-white/15 sm:px-4">
              <span className={`sport text-4xl font-black tabular-nums leading-none sm:text-6xl ${a.us && o === "W" ? "text-dorado" : ""}`}>{a.goals}</span>
              <span className="sport text-2xl font-black text-white/40 sm:text-4xl">-</span>
              <span className={`sport text-4xl font-black tabular-nums leading-none sm:text-6xl ${b.us && o === "W" ? "text-dorado" : ""}`}>{b.goals}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="sport text-3xl font-black italic text-white/80 sm:text-5xl">VS</span>
              {m.kickoff && <span className="sport mt-1 rounded-md bg-rojo px-2 py-0.5 text-lg font-black leading-none">{hhmm(m.kickoff)}</span>}
            </div>
          )}
          {o && <span className={`badge mt-2 ${OUTCOME_TONE[o]}`}>{OUTCOME_LABEL[o].long}</span>}
          {!played && m.status !== "scheduled" && <span className={`badge mt-2 ${MATCH_STATUS_TONE[m.status]}`}>{MATCH_STATUS_LABEL[m.status]}</span>}
        </div>
        {team(b)}
      </div>
      <div className="relative mt-4 flex flex-col items-center gap-3">
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-white/80">
          <span className="inline-flex items-center gap-1.5 first-letter:uppercase"><CalendarClock size={15} className="text-dorado" /> <span className="first-letter:uppercase">{longDay(m.match_date)}</span>{relativeDay(m.match_date) && <b className="text-white">· {relativeDay(m.match_date)}</b>}</span>
          {m.venue && <span className="inline-flex items-center gap-1.5"><MapPin size={15} className="text-dorado" /> {m.venue}</span>}
        </p>
        {countdown && m.status === "scheduled" && kickoffDate(m).getTime() > Date.now() && <Countdown to={kickoffDate(m).toISOString()} />}
      </div>
    </div>
  );
}

/** Fila del calendario: fecha, escudo, rival, marcador o hora. */
export function MatchLine({ m, rank }: { m: MatchRow; rank?: Rank | null }) {
  const played = m.status === "played";
  const off = m.status === "postponed" || m.status === "cancelled";
  const time = hhmm(m.kickoff);
  return (
    <Link href={`/partidos/${m.id}`} prefetch={false}
      className={`group flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-rojo/40 sm:p-4 ${off ? "opacity-70" : ""}`}>
      <div className="w-12 shrink-0 text-center leading-none">
        <div className="text-[11px] font-bold uppercase text-negro/65">{shortDay(m.match_date).split(" ")[0].replace(",", "")}</div>
        <div className="sport text-2xl font-black">{Number(m.match_date.slice(8, 10))}</div>
        <div className="text-[11px] font-bold uppercase text-negro/65">{shortDay(m.match_date).split(" ").slice(-1)[0]}</div>
      </div>
      <span className="h-10 w-px shrink-0 bg-black/10" />
      <Crest rival={m.rival} size={34} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-bold">{m.rival.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-negro/65">
          <span className={`rounded px-1 font-bold ${m.is_home ? "bg-negro text-white" : "bg-gris text-negro"}`}>{m.is_home ? "Casa" : "Fuera"}</span>
          <span>{COMPETITION_LABEL[m.competition]}{m.round ? ` · ${m.round}` : ""}</span>
          {rank && <RankChip r={rank} />}
          <StatusBadge m={m} />
        </div>
      </div>
      {played ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="sport rounded-lg bg-negro px-2.5 py-1 text-xl font-black tabular-nums text-white">
            {m.is_home ? `${m.goals_for}-${m.goals_against}` : `${m.goals_against}-${m.goals_for}`}
          </span>
          <OutcomeDot m={m} size="sm" />
        </div>
      ) : off ? null : (
        <span className="sport shrink-0 rounded-lg bg-gris px-2.5 py-1 text-lg font-black tabular-nums text-negro/80">{time ?? "—"}</span>
      )}
    </Link>
  );
}

/** Tarjeta del próximo partido para el inicio. */
export function NextMatchCard({ m }: { m: MatchRow | null }) {
  if (!m)
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-white p-4 text-sm text-negro/65 ring-1 ring-black/5">
        <Ball size={24} className="anim-bounce-ball" /> No hay ningún partido programado.
      </div>
    );
  const link = mapsLink(m);
  return (
    <div>
      <Link href={`/partidos/${m.id}`} prefetch className="block transition hover:-translate-y-0.5"><Scoreboard m={m} compact /></Link>
      {link && (
        <a href={link} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-rojo"><MapPin size={15} /> Cómo llegar</a>
      )}
    </div>
  );
}
