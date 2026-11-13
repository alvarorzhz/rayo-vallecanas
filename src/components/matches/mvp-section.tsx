import { Clock, Lock, Star, Users } from "lucide-react";
import { Jersey } from "@/components/squad/jersey";
import { MvpGala } from "@/components/matches/mvp-gala";
import { MvpChoices, OpenMvpButton, type MvpChoice } from "@/components/matches/mvp-forms";
import { openMvp, pickMvp, voteMvp } from "@/app/(app)/partidos/mvp-actions";
import { lineOf, shirtName } from "@/lib/squad";
import { mvpStage, ranking, votesLabel, type MvpBoard } from "@/lib/mvp";
import { timeLeft } from "@/lib/polls";
import { fecha } from "@/lib/format";
import type { MatchRow } from "@/lib/matches";
import type { ReportPlayer } from "@/lib/reports";
import type { RosterEntry } from "@/lib/squad";

export type GalaInfo = { entry: RosterEntry; me: string; rival: string; auto: boolean };

/** El ganador, en grande. */
function Winner({ p, votes, picked, gala, matchId }: { p: ReportPlayer; votes: number; picked: boolean; gala?: GalaInfo | null; matchId: string }) {
  return (
    <div className="franja relative flex items-center gap-3 overflow-hidden rounded-2xl bg-negro p-3 text-white">
      <span className="relative"><Jersey number={p.number} goalkeeper={lineOf(p.position) === "GK"} size={48} /></span>
      <div className="relative min-w-0">
        <p className="sport flex items-center gap-1 text-xs font-black tracking-widest text-dorado"><Star size={13} className="fill-dorado" /> MVP DEL PARTIDO</p>
        <p className="sport truncate text-2xl font-black leading-tight">{shirtName(p.player)}</p>
        <p className="text-xs text-white/75">{picked ? "Lo eligió un gestor tras el empate" : `Elegido por el equipo con ${votesLabel(votes)}`}</p>
      </div>
      {gala && <span className="relative ml-auto"><MvpGala matchId={matchId} {...gala} votes={votes} picked={picked} dark /></span>}
    </div>
  );
}

/**
 * Votación del MVP en la página del partido. Abierta: en negro, para votar.
 * Cerrada: el ganador y el recuento (sin decir quién votó a quién).
 */
export function MvpSection({ m, board, pool, canEdit, gala = null }: { m: MatchRow; board: MvpBoard | null; pool: ReportPlayer[]; canEdit: boolean; gala?: GalaInfo | null }) {
  if (m.status !== "played") return null;
  const by = new Map(pool.map((p) => [p.player_id, p]));

  if (!board) {
    // Partidos de antes (con MVP del acta) o sin acta: un gestor puede abrirla a mano
    if (!canEdit || m.mvp_player_id) return null;
    return (
      <section id="mvp" className="card scroll-mt-24 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2"><Star size={18} className="fill-dorado text-dorado" /> MVP</h2>
          <p className="text-sm text-negro/65">Abre la votación para que el equipo elija al mejor del partido hasta las 23:59. Se vota entre los que jugaron según el acta o, si no hay, entre los que dijeron «Voy».</p>
        </div>
        <OpenMvpButton action={openMvp.bind(null, m.id)} />
      </section>
    );
  }

  const choice = (id: string): MvpChoice | null => {
    const p = by.get(id);
    return p ? { id, name: shirtName(p.player), number: p.number, goalkeeper: lineOf(p.position) === "GK", me: id === board.my_player_id } : null;
  };
  const stage = mvpStage(board);
  const meta = (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex items-center gap-1"><Users size={13} /> Han votado {board.voters} de {board.eligible}</span>
      <span className="flex items-center gap-1"><Lock size={13} /> Voto secreto</span>
    </span>
  );

  if (stage === "open" || stage === "counting") {
    const choices = board.candidates.map(choice).filter((c): c is MvpChoice => !!c);
    return (
      <section id="mvp" className="franja relative scroll-mt-24 overflow-hidden rounded-2xl bg-negro p-4 text-white shadow-lg sm:p-5">
        <div className="relative space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.15em] text-dorado"><Star size={15} className="fill-dorado" /> Votación del MVP</span>
            <span className="badge bg-dorado text-negro"><Clock size={12} /> {stage === "open" ? timeLeft(board.closes_at) : "Contando votos"}</span>
          </div>
          <h2 className="sport text-2xl leading-tight font-black text-white">¿Quién ha sido el mejor?</h2>
          {stage === "open"
            ? <MvpChoices choices={choices} mine={board.my_vote} action={voteMvp.bind(null, m.id)} mode="vote" dark />
            : <p className="text-sm text-white/80">La votación ya se ha cerrado. En un momento sale el ganador.</p>}
          <div className="text-xs text-white/70">{meta}</div>
          <p className="text-xs text-white/60">Se cierra el {fecha(board.closes_at, true)}. Nadie ve a quién has votado y el recuento sale al cerrar.</p>
        </div>
      </section>
    );
  }

  const rank = ranking(board);
  const top = rank[0]?.votes ?? 0;
  const winner = board.winner_id ? by.get(board.winner_id) : null;
  const toPick = (stage === "tie" ? board.tie_ids ?? [] : board.candidates).map(choice).filter((c): c is MvpChoice => !!c).map((c) => ({ ...c, me: false }));

  return (
    <section id="mvp" className="card scroll-mt-24 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2"><Star size={18} className="fill-dorado text-dorado" /> MVP</h2>
        <span className="text-xs font-bold uppercase tracking-wider text-negro/60">Votación cerrada</span>
      </div>

      {winner && <Winner p={winner} votes={board.tally?.[winner.player_id] ?? 0} picked={board.picked} gala={gala} matchId={m.id} />}
      {stage === "tie" && <p className="rounded-xl bg-dorado/15 p-3 text-sm font-semibold">Empate a votos y a goles. {canEdit ? "Elige tú al MVP entre los empatados:" : "Lo decide un gestor."}</p>}
      {stage === "empty" && <p className="rounded-xl bg-gris p-3 text-sm">Nadie votó. {canEdit ? "Puedes elegir tú al MVP:" : ""}</p>}
      {(stage === "tie" || stage === "empty") && canEdit && <MvpChoices choices={toPick} mine={null} action={pickMvp.bind(null, m.id)} mode="pick" />}

      {rank.length > 0 && (
        <ol className="space-y-1.5">
          {rank.slice(0, 6).map((r, i) => {
            const p = by.get(r.id);
            return (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                <span className="sport w-5 shrink-0 text-center font-black text-negro/50">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate font-bold ${r.id === board.winner_id ? "text-negro" : "text-negro/80"}`}>{r.id === board.winner_id && "⭐ "}{p ? shirtName(p.player) : "?"}</span>
                    <span className="shrink-0 text-xs font-bold text-negro/65">{votesLabel(r.votes)}</span>
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-gris">
                    <span className={`block h-full rounded-full ${r.id === board.winner_id ? "bg-dorado" : "bg-negro/30"}`} style={{ width: `${Math.round((r.votes / top) * 100)}%` }} />
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <div className="text-xs text-negro/65">{meta}{board.my_vote && by.get(board.my_vote) && <span className="mt-1 block">Tu voto: <b>{shirtName(by.get(board.my_vote)!.player)}</b></span>}</div>
    </section>
  );
}
