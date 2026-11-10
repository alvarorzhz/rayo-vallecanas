import { Zap } from "lucide-react";
import { CLUB_NAME, OUTCOME_LABEL, OUTCOME_TONE, type MatchRow } from "@/lib/matches";
import { lineOf, shirtName, type Player } from "@/lib/squad";
import { ordinal, perGame, type MatchRanks, type Rank } from "@/lib/standings";
import type { Outcome } from "@/lib/league-parse";
import { prettyTeam } from "@/lib/league-parse";
import { Crest } from "@/components/matches/crest";
import { Jersey } from "@/components/squad/jersey";

/** «Qué nos jugamos»: una frase, en dorado. */
export function Stake({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 rounded-xl bg-dorado/15 px-3 py-2 text-sm font-bold ring-1 ring-dorado/40">
      <Zap size={16} className="shrink-0 fill-dorado text-dorado" /> {text}
    </p>
  );
}

function Dots({ form }: { form: Outcome[] }) {
  if (!form.length) return null;
  return (
    <ol className="flex gap-0.5" aria-label="Últimos partidos">
      {form.map((o, i) => (
        <li key={i} title={OUTCOME_LABEL[o].long} className={`sport inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black ${OUTCOME_TONE[o]}`}>
          <span aria-hidden>{OUTCOME_LABEL[o].short}</span><span className="sr-only">{OUTCOME_LABEL[o].long}</span>
        </li>
      ))}
    </ol>
  );
}

/** Cómo viene el rival: sus tres últimos resultados y sus goles por partido, en una línea. */
function RivalTrend({ r }: { r: Rank }) {
  const last = r.last ?? [];
  if (!last.length && !r.played) return null;
  return (
    <p className="pl-9 text-xs leading-snug text-negro/65">
      {last.length > 0 && <>Últimos: {last.map((g, i) => (
        <span key={i}>
          {i > 0 && " · "}
          <b title={`${OUTCOME_LABEL[g.outcome].long} ${g.home ? "en casa contra" : "en el campo de"} ${prettyTeam(g.oppName)}`}
            className={g.outcome === "W" ? "text-green-700" : g.outcome === "L" ? "text-rojo" : "text-negro"}>{g.gf}-{g.ga}</b>
        </span>
      ))}{r.played > 0 && <span aria-hidden> — </span>}</>}
      {r.played > 0 && <span title="Goles por partido">meten <b className="text-negro">{perGame(r.gf, r.played)}</b> y encajan <b className="text-negro">{perGame(r.ga, r.played)}</b></span>}
    </p>
  );
}

/** «Así llegan» en pequeño: los dos equipos, ordenados por la clasificación. */
export function PreviaTable({ ranks, m }: { ranks: MatchRanks; m: MatchRow }) {
  const rows = [
    ranks.us && { key: "us", r: ranks.us, mine: true },
    ranks.rival && { key: "rival", r: ranks.rival, mine: false },
  ].filter((x): x is { key: string; r: Rank; mine: boolean } => !!x).sort((a, b) => a.r.pos - b.r.pos);
  if (!rows.length) return null;
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-negro/65">Así llegan</h3>
      <ol className="space-y-1.5">
        {rows.map(({ key, r, mine }) => (
          <li key={key} className="space-y-1">
            <div className={`relative flex items-center gap-2 rounded-xl px-2 py-1.5 ${mine ? "bg-rojo/10 font-bold" : "bg-gris/70"}`}>
              {r.zone && <span aria-hidden title={r.zone.label} className="absolute inset-y-1.5 left-0 w-1 rounded-r" style={{ background: r.zone.color }} />}
              <span className="sport w-7 text-center text-lg font-black leading-none">{ordinal(r.pos)}</span>
              <Crest us={mine} rival={mine ? null : m.rival} size={20} className="shrink-0" />
              <span className={`min-w-0 flex-1 truncate text-sm ${mine ? "text-rojo" : "font-semibold"}`}>
                {mine ? CLUB_NAME : m.rival.name}
              </span>
              <Dots form={r.form} />
              <span className="sport w-12 shrink-0 text-right text-lg font-black leading-none tabular-nums">{r.points}<span className="ml-0.5 text-[10px] font-bold text-negro/55">pts</span></span>
            </div>
            {!mine && <RivalTrend r={r} />}
          </li>
        ))}
      </ol>
      
    </div>
  );
}

type Hot = { player: Player; number: number | null; position: string; goals: number; mvp: boolean };
type Top = { goals: number; number: number | null; position: string; player: Player };

/** «En forma»: el MVP del último partido, los que marcaron en los dos últimos y el pichichi (máximo tres). */
export function InForm({ hot, top }: { hot: Hot[]; top: Top | null }) {
  const list: { id: string; player: Player; number: number | null; position: string; note: string }[] = [];
  for (const h of hot) {
    const bits = [h.mvp && "MVP del último partido", h.goals > 0 && `${h.goals === 1 ? "un gol" : `${h.goals} goles`} en los dos últimos`].filter(Boolean);
    if (top && top.player.id === h.player.id) bits.push(`pichichi con ${top.goals}`);
    list.push({ id: h.player.id, player: h.player, number: h.number, position: h.position, note: bits.join(" · ") });
  }
  if (top && !list.some((x) => x.id === top.player.id)) {
    list.push({ id: top.player.id, player: top.player, number: top.number, position: top.position, note: `Pichichi · ${top.goals} ${top.goals === 1 ? "gol" : "goles"}` });
  }
  const shown = list.slice(0, 3);
  if (!shown.length) return null;
  return (
    <div className="franja relative overflow-hidden rounded-2xl bg-negro p-3 text-white">
      <p className="relative mb-1.5 text-[11px] font-bold uppercase tracking-wider text-dorado">En forma</p>
      <ul className="relative space-y-1.5">
        {shown.map((x) => (
          <li key={x.id} className="flex items-center gap-2.5">
            <span className="flex w-8 shrink-0 justify-center"><Jersey number={x.number} goalkeeper={lineOf(x.position) === "GK"} size={30} /></span>
            <div className="min-w-0 pr-8">
              <p className="sport truncate text-lg font-black leading-tight">{shirtName(x.player)}</p>
              <p className="text-xs leading-snug text-white/75 first-letter:uppercase">{x.note}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
