import Link from "next/link";
import { Star, Trophy } from "lucide-react";
import { Crest } from "@/components/matches/crest";
import { CLUB_SHORT, rivalShort } from "@/lib/matches";
import type { MatchSheet } from "@/lib/news-queries";

/** Ficha técnica del partido, sacada del acta (nunca del texto). Sin alineaciones: el marcador, los goles, el MVP y la tabla. */
export function MatchSheetBox({ sheet, link = true }: { sheet: MatchSheet; link?: boolean }) {
  const { m, facts: f } = sheet;
  const played = f.played;
  const [lh, rh] = m.is_home ? [{ us: true as const }, { rival: m.rival }] : [{ rival: m.rival }, { us: true as const }];
  const [lg, rg] = m.is_home ? [f.goalsFor, f.goalsAgainst] : [f.goalsAgainst, f.goalsFor];
  const win = played && f.goalsFor! > f.goalsAgainst!;
  const draw = played && f.goalsFor === f.goalsAgainst;
  const result = !played ? null : win ? "Victoria" : draw ? "Empate" : "Derrota";
  const assistOf = new Map(f.assists.map((a) => [a.name, a.count]));
  const yellows = f.cards.filter((c) => !c.red);
  const reds = f.cards.filter((c) => c.red);

  return (
    <aside aria-label="Ficha técnica" className="match-sheet overflow-hidden rounded-sm text-[#141210]">
      {/* El marcador, en negro */}
      <div className="franja relative bg-negro px-4 pb-4 pt-3 text-white">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(213,175,50,0.2),transparent_70%)]" />
        <p className="relative flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">
          <span>{f.competition}{f.round ? ` · ${f.round}` : ""}</span>
          {result && <span className={`rounded px-1.5 py-0.5 text-[10px] ${win ? "bg-dorado text-negro" : draw ? "bg-white/15 text-white" : "bg-rojo text-white"}`}>{result}</span>}
        </p>
        <div className="relative mt-3 flex items-center justify-center gap-3">
          <div className="flex w-16 flex-col items-center gap-1"><Crest {...lh} size={44} /><span className="sport text-[11px] font-bold tracking-widest text-white/75">{"us" in lh ? CLUB_SHORT : rivalShort(m.rival)}</span></div>
          <span className={`sport min-w-[5.5rem] text-center text-5xl font-black tabular-nums ${played ? "" : "text-dorado"}`}>{played ? `${lg}-${rg}` : "vs"}</span>
          <div className="flex w-16 flex-col items-center gap-1"><Crest {...rh} size={44} /><span className="sport text-[11px] font-bold tracking-widest text-white/75">{"us" in rh ? CLUB_SHORT : rivalShort(m.rival)}</span></div>
        </div>
      </div>

      {/* El MVP, en dorado */}
      {f.mvp && (
        <div className="flex items-center gap-3 bg-gradient-to-r from-dorado to-[#ecd37a] px-4 py-2.5 text-negro">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-negro text-dorado"><Star size={17} className="fill-dorado" aria-hidden /></span>
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-negro/70">MVP del partido · votado por el equipo</span>
            <span className="sport block truncate text-xl font-black leading-tight">{f.mvp}</span>
          </span>
        </div>
      )}

      <div className="space-y-3 px-4 py-3 text-[13px]">
        {played && (f.scorers.length > 0 || f.ownGoals > 0) && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#141210]/55">Goles del Rayo</p>
            <ul className="mt-1 space-y-1">
              {f.scorers.map((s) => (
                <li key={s.name} className="flex items-baseline gap-2">
                  <span aria-hidden className="tracking-tighter">{"⚽".repeat(Math.min(s.goals, 5))}</span>
                  <span className="font-bold">{s.name}</span>
                  {assistOf.has(s.name) && <span className="text-[#141210]/55">· {assistOf.get(s.name)} asist.</span>}
                </li>
              ))}
              {f.ownGoals > 0 && <li className="flex items-baseline gap-2"><span aria-hidden>⚽</span><span className="italic">En propia puerta{f.ownGoals > 1 ? ` (${f.ownGoals})` : ""}</span></li>}
            </ul>
            {f.assists.some((a) => !f.scorers.some((s) => s.name === a.name)) && (
              <p className="mt-1 text-[#141210]/65">Asistencias: {f.assists.filter((a) => !f.scorers.some((s) => s.name === a.name)).map((a) => (a.count > 1 ? `${a.name} (${a.count})` : a.name)).join(", ")}</p>
            )}
          </div>
        )}
        {(yellows.length > 0 || reds.length > 0) && (
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            {yellows.map((c) => <span key={c.name}><span aria-label="amarilla" className="mr-1 inline-block h-3 w-2 rounded-[1px] bg-yellow-400 align-[-1px]" />{c.name}{c.yellows > 1 ? " (2)" : ""}</span>)}
            {reds.map((c) => <span key={c.name}><span aria-label="roja" className="mr-1 inline-block h-3 w-2 rounded-[1px] bg-rojo align-[-1px]" />{c.name}</span>)}
          </p>
        )}
        {f.usRank && (
          <div className="flex items-center gap-2">
            <Trophy size={15} className="shrink-0 text-dorado" aria-hidden />
            <span className="rounded bg-negro px-1.5 py-0.5 text-xs font-bold text-white">Rayo {f.usRank.pos}º · {f.usRank.points} pts</span>
            {f.rivalRank && <span className="rounded bg-[#141210]/10 px-1.5 py-0.5 text-xs font-bold">{rivalShort(m.rival)} {f.rivalRank.pos}º · {f.rivalRank.points} pts</span>}
          </div>
        )}
        {!played && f.callup.length > 0 && <p><span className="font-bold">Convocados ({f.callup.length}):</span> {f.callup.join(", ")}</p>}
        <p className="border-t border-[#141210]/15 pt-2 text-[12px] text-[#141210]/60">{[f.venue, f.date + (f.kickoff ? `, ${f.kickoff}` : "")].filter(Boolean).join(" · ")}</p>
        {played && !sheet.report && <p className="text-xs text-[#141210]/60">El acta de este partido aún no está rellena.</p>}
        {link && <Link href={`/partidos/${m.id}`} prefetch className="inline-block text-xs font-bold text-rojo hover:underline">Ver el partido →</Link>}
      </div>
    </aside>
  );
}
