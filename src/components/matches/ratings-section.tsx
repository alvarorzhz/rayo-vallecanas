import { Clock, EyeOff, Lock, Star, Users } from "lucide-react";
import { Jersey } from "@/components/squad/jersey";
import { RatingPad, ScorePill, type RatePlayer } from "@/components/matches/rating-forms";
import { rateMatchPlayer } from "@/app/(app)/partidos/mvp-actions";
import { lineOf, shirtName, type Line } from "@/lib/squad";
import { MIN_RATERS, TOP_VISIBLE, fmtScore, ratingRanking, ratingsLabel, type RatingBoard } from "@/lib/ratings";
import { timeLeft } from "@/lib/polls";
import type { MvpBoard } from "@/lib/mvp";
import type { MatchRow } from "@/lib/matches";
import type { ReportPlayer } from "@/lib/reports";

const LINE_ORDER: Record<Line, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

/**
 * Notas de los jugadores, debajo del MVP. Se abren y se cierran con la votación del MVP.
 * Abiertas: cada uno puntúa a los que jugaron. Cerradas: la lista de mejor a peor, con la
 * media solo de los 3 mejores (4.28.1, para que nadie se quede señalado).
 */
export function RatingsSection({ m, board, mvp, pool }: { m: MatchRow; board: RatingBoard | null; mvp: MvpBoard | null; pool: ReportPlayer[] }) {
  if (m.status !== "played" || !board || !mvp) return null;
  const by = new Map(pool.map((p) => [p.player_id, p]));
  const candidates = mvp.candidates.filter((id) => by.has(id));
  if (!candidates.length) return null;

  const meta = (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex items-center gap-1"><Users size={13} /> Han puntuado {board.raters} de {mvp.eligible}</span>
      <span className="flex items-center gap-1"><Lock size={13} /> Notas secretas</span>
    </span>
  );

  if (board.open) {
    const players: RatePlayer[] = candidates
      .map((id) => by.get(id)!)
      .sort((a, b) => LINE_ORDER[lineOf(a.position)] - LINE_ORDER[lineOf(b.position)] || (a.number ?? 99) - (b.number ?? 99))
      .map((p) => ({ id: p.player_id, name: shirtName(p.player), number: p.number, goalkeeper: lineOf(p.position) === "GK", me: p.player_id === mvp.my_player_id }));
    return (
      <section id="notas" className="card scroll-mt-24 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2"><span aria-hidden className="sport rounded-md bg-negro px-1.5 text-sm font-black italic text-dorado">7,5</span> Notas del partido</h2>
          <span className="badge bg-gris text-negro"><Clock size={12} /> {timeLeft(mvp.closes_at)}</span>
        </div>
        <p className="text-sm text-negro/65">Pon nota del 1 al 10 a los que jugaron. Al cerrar la votación del MVP salen las medias de los 3 mejores.</p>
        <RatingPad players={players} initial={board.mine} action={rateMatchPlayer.bind(null, m.id)} />
        <div className="text-xs text-negro/65">{meta}</div>
      </section>
    );
  }

  const rows = ratingRanking(board, candidates);
  const anyMedia = rows.some((r) => r.avg !== null || r.hidden);
  const mineCount = Object.keys(board.mine).length;
  return (
    <section id="notas" className="card scroll-mt-24 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2"><span aria-hidden className="sport rounded-md bg-negro px-1.5 text-sm font-black italic text-dorado">7,5</span> Notas del partido</h2>
        <span className="text-xs font-bold uppercase tracking-wider text-negro/60">Los {TOP_VISIBLE} mejores</span>
      </div>
      {!anyMedia ? (
        <p className="rounded-xl bg-gris p-3 text-sm">{board.raters === 0 ? "Nadie puso notas en este partido." : `No hay medias: hace falta que a cada jugador le puntúen al menos ${MIN_RATERS} personas.`}</p>
      ) : (
        <ol className="space-y-1">
          {rows.map((r) => {
            const p = by.get(r.id)!;
            const mvpWinner = r.id === mvp.winner_id;
            return (
              <li key={r.id} className={`flex items-center gap-2 rounded-xl px-1.5 py-1.5 ${r.rank === 1 ? "bg-dorado/10" : ""}`}>
                <span className="sport w-5 shrink-0 text-center font-black text-negro/45">{r.rank ?? (r.hidden ? "·" : "–")}</span>
                <Jersey number={p.number} goalkeeper={lineOf(p.position) === "GK"} size={24} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 truncate font-bold">{shirtName(p.player)}{mvpWinner && <Star size={13} className="shrink-0 fill-dorado text-dorado" aria-label="MVP" />}</span>
                  <span className="block text-[11px] text-negro/60">
                    {r.avg !== null || r.hidden ? ratingsLabel(r.n) : r.n ? `${ratingsLabel(r.n)}: no llega a media` : "sin notas"}
                    {r.mine !== null && <> · tu nota <b className="text-negro/80">{fmtScore(r.mine)}</b></>}
                  </span>
                </span>
                {r.avg !== null ? <ScorePill score={r.avg} decimals={1} />
                  : r.hidden ? <span className="grid min-w-9 place-items-center text-negro/30" aria-label="Nota oculta"><EyeOff size={16} /></span>
                  : <span className="sport min-w-9 text-center text-lg font-black italic text-negro/30">–</span>}
              </li>
            );
          })}
        </ol>
      )}
      <div className="text-xs text-negro/65">
        {meta}
        <span className="mt-1 block">Solo se enseña la media de los {TOP_VISIBLE} mejores; el resto va en su sitio, sin nota.{mineCount > 0 && <> Pusiste {ratingsLabel(mineCount)}. Nadie sabe qué nota puso cada uno.</>}</span>
      </div>
    </section>
  );
}
