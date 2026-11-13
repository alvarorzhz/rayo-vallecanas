"use client";
import { useOptimistic, useState, useTransition } from "react";
import { REACTIONS, REACTION_LABEL, type Reaction } from "@/lib/news";
import type { NewsState } from "@/app/(app)/la-voz/actions";

type Props = {
  counts: Record<Reaction, number>;
  names: Record<Reaction, string[]>;
  mine: Reaction | null;
  action: (emoji: string) => Promise<NewsState>;
};

/** Reacciones al final de la noticia: una por persona; tocar la misma la quita. */
export function Reactions({ counts, names, mine, action }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pop, setPop] = useState<Reaction | null>(null);
  const [state, setOptimistic] = useOptimistic({ counts, mine }, (cur, e: Reaction) => {
    const next = { ...cur.counts };
    if (cur.mine) next[cur.mine] = Math.max(0, next[cur.mine] - 1);
    if (cur.mine === e) return { counts: next, mine: null };
    next[e]++;
    return { counts: next, mine: e };
  });

  const tap = (e: Reaction) => {
    setError(null);
    if (state.mine !== e) setPop(e);
    start(async () => {
      setOptimistic(e);
      const r = await action(e);
      if (r?.error) setError(r.error);
    });
  };

  const total = REACTIONS.reduce((n, r) => n + state.counts[r], 0);
  return (
    <div className="mt-8">
      <p className="news-kicker mb-2 text-xs">{total ? `${total} ${total === 1 ? "reacción" : "reacciones"} del vestuario` : "¿Qué te ha parecido?"}</p>
      <div className="flex flex-wrap gap-2" aria-busy={pending}>
        {REACTIONS.map((e) => {
          const on = state.mine === e;
          const who = names[e].length ? `: ${names[e].slice(0, 8).join(", ")}${names[e].length > 8 ? "…" : ""}` : "";
          return (
            <button key={e} type="button" onClick={() => tap(e)} aria-pressed={on} title={`${REACTION_LABEL[e]}${who}`}
              className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition active:scale-95 ${on ? "bg-negro text-white ring-2 ring-dorado" : "bg-white/80 text-[#141210] ring-1 ring-[#141210]/15 hover:ring-[#141210]/40"}`}>
              <span key={on && pop === e ? "pop" : "still"} className={`text-lg leading-none ${on && pop === e ? "rx-pop" : ""}`} aria-hidden>{e}</span>
              <span className="sr-only">{REACTION_LABEL[e]}</span>
              {state.counts[e] > 0 && <span className="tabular-nums">{state.counts[e]}</span>}
              {on && pop === e && <span aria-hidden className="rx-burst pointer-events-none absolute left-4 top-1/2">{e}</span>}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm font-medium text-rojo">{error}</p>}
    </div>
  );
}
