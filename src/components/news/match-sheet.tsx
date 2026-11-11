import Link from "next/link";
import { Star } from "lucide-react";
import { Crest } from "@/components/matches/crest";
import { CLUB_SHORT, rivalShort } from "@/lib/matches";
import type { MatchSheet } from "@/lib/news-queries";

const list = (xs: string[]) => xs.join(", ");

/** Ficha técnica del partido, sacada del acta (nunca del texto). */
export function MatchSheetBox({ sheet, link = true }: { sheet: MatchSheet; link?: boolean }) {
  const { m, facts: f } = sheet;
  const played = f.played;
  const [lh, rh] = m.is_home ? [{ us: true as const }, { rival: m.rival }] : [{ rival: m.rival }, { us: true as const }];
  const [lg, rg] = m.is_home ? [f.goalsFor, f.goalsAgainst] : [f.goalsAgainst, f.goalsFor];
  const goals = [...f.scorers.map((s) => (s.goals > 1 ? `${s.name} (${s.goals})` : s.name)), ...(f.ownGoals ? [`p.p. (${f.ownGoals})`] : [])];
  const rows: [string, string][] = [];
  if (played) {
    if (f.starters.length) rows.push(["Titulares", list(f.starters)]);
    if (f.subs.length) rows.push(["Suplentes", list(f.subs)]);
    if (goals.length) rows.push(["Goles", list(goals)]);
    if (f.assists.length) rows.push(["Asistencias", list(f.assists.map((a) => (a.count > 1 ? `${a.name} (${a.count})` : a.name)))]);
    if (f.cards.length) rows.push(["Tarjetas", list(f.cards.map((c) => `${c.name} ${c.red ? "🟥" : "🟨".repeat(Math.min(2, c.yellows))}`))]);
  } else if (f.callup.length) rows.push(["Convocados", list(f.callup)]);
  if (f.usRank) rows.push(["Clasificación", `Rayo ${f.usRank.pos}º (${f.usRank.points} pts)${f.rivalRank ? ` · ${m.rival.name} ${f.rivalRank.pos}º (${f.rivalRank.points} pts)` : ""}`]);
  rows.push(["Campo", [f.venue, f.date + (f.kickoff ? `, ${f.kickoff}` : "")].filter(Boolean).join(" · ")]);

  return (
    <aside aria-label="Ficha técnica" className="match-sheet rounded-sm p-4 text-[#141210]">
      <p className="news-kicker text-xs">Ficha técnica · {f.competition}{f.round ? ` · ${f.round}` : ""}</p>
      <div className="mt-3 flex items-center justify-center gap-3">
        <div className="flex flex-col items-center gap-1"><Crest {...lh} size={40} /><span className="sport text-[11px] font-bold tracking-widest">{"us" in lh ? CLUB_SHORT : rivalShort(m.rival)}</span></div>
        <span className="sport min-w-[5.5rem] text-center text-4xl font-black tabular-nums">{played ? `${lg}-${rg}` : "vs"}</span>
        <div className="flex flex-col items-center gap-1"><Crest {...rh} size={40} /><span className="sport text-[11px] font-bold tracking-widest">{"us" in rh ? CLUB_SHORT : rivalShort(m.rival)}</span></div>
      </div>
      {f.mvp && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-sm font-bold">
          <Star size={15} className="fill-dorado text-dorado" aria-hidden /> MVP: {f.mvp}
        </p>
      )}
      <dl className="mt-3 divide-y divide-[#141210]/10 border-t border-[#141210]/80 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-2 py-1.5">
            <dt className="font-bold uppercase tracking-wide text-[#141210]/60 text-[11px] pt-px">{k}</dt>
            <dd className="leading-snug">{v}</dd>
          </div>
        ))}
      </dl>
      {played && !sheet.report && <p className="mt-2 text-xs text-[#141210]/60">El acta de este partido aún no está rellena.</p>}
      {link && <Link href={`/partidos/${m.id}`} prefetch className="mt-3 inline-block text-xs font-bold text-rojo hover:underline">Ver el partido →</Link>}
    </aside>
  );
}
