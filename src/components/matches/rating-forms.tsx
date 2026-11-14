"use client";
import { useRef, useState } from "react";
import { Check, Minus, Plus, X } from "lucide-react";
import { Jersey } from "@/components/squad/jersey";
import { fmtScore, leftToRate, nudge, scoreTone, scoreWord } from "@/lib/ratings";

type S = { error?: string; ok?: string } | undefined;
export type RatePlayer = { id: string; name: string; number: number | null; goalkeeper: boolean; me: boolean };

export const TONE_CLASS = {
  low: "bg-rojo text-white",
  mid: "bg-neutral-200 text-negro",
  good: "bg-green-600 text-white",
  top: "bg-dorado text-negro",
} as const;

/** La nota en una pastilla del color que toca. */
export function ScorePill({ score, decimals = 0, big = false }: { score: number; decimals?: 0 | 1; big?: boolean }) {
  return (
    <span className={`sport inline-flex items-center justify-center rounded-lg font-black italic tabular-nums leading-none ${TONE_CLASS[scoreTone(score)]} ${big ? "min-w-12 px-2 py-1.5 text-2xl" : "min-w-9 px-1.5 py-1 text-lg"}`}>
      {fmtScore(score, decimals)}
    </span>
  );
}

/**
 * Notas mientras están abiertas: cada jugador con los números del 1 al 10. Una vez puesta,
 * se afina de medio en medio punto o se quita. Se guarda sola al tocar.
 */
export function RatingPad({ players, initial, action }: {
  players: RatePlayer[]; initial: Record<string, number>; action: (playerId: string, score: number | null) => Promise<S>;
}) {
  const [mine, setMine] = useState<Record<string, number>>(initial);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  // Si se toca muy rápido, solo cuenta la última nota de cada jugador
  const seq = useRef<Record<string, number>>({});

  async function set(id: string, score: number | null) {
    const before = mine[id];
    setMine((m) => {
      const next = { ...m };
      if (score === null) delete next[id]; else next[id] = score;
      return next;
    });
    setError(null);
    const n = (seq.current[id] ?? 0) + 1;
    seq.current[id] = n;
    setSaving((s) => ({ ...s, [id]: true }));
    const r = await action(id, score);
    if (seq.current[id] !== n) return;
    setSaving((s) => ({ ...s, [id]: false }));
    if (r?.error) {
      setError(r.error);
      setMine((m) => {
        const next = { ...m };
        if (before === undefined) delete next[id]; else next[id] = before;
        return next;
      });
    } else setSaved(id);
  }

  const me = players.find((p) => p.me)?.id ?? null;
  const left = leftToRate(mine, players.map((p) => p.id), me);
  const done = players.length - (me ? 1 : 0) - left;

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-black/5">
        {players.map((p) => {
          const score = mine[p.id];
          return (
            <li key={p.id} className="py-2.5">
              <div className="flex items-center gap-2">
                <Jersey number={p.number} goalkeeper={p.goalkeeper} size={26} dim={p.me} />
                <span className={`min-w-0 flex-1 truncate font-bold ${p.me ? "text-negro/45" : ""}`}>{p.name}</span>
                {p.me ? (
                  <span className="text-[0.65rem] font-black uppercase tracking-wider text-negro/45">Tú · no te puntúas</span>
                ) : score !== undefined ? (
                  <span className="flex items-center gap-1">
                    <button type="button" aria-label={`Bajar medio punto a ${p.name}`} disabled={score <= 1} onClick={() => set(p.id, nudge(score, -0.5))}
                      className="grid h-9 w-9 place-items-center rounded-lg bg-gris text-negro ring-1 ring-black/10 active:scale-95 disabled:opacity-40"><Minus size={16} /></button>
                    <span className="flex w-[4.5rem] flex-col items-center">
                      <ScorePill score={score} big />
                      <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-negro/55">{saving[p.id] ? "Guardando…" : saved === p.id ? <span className="inline-flex items-center gap-0.5 text-green-700"><Check size={10} /> Guardada</span> : scoreWord(score)}</span>
                    </span>
                    <button type="button" aria-label={`Subir medio punto a ${p.name}`} disabled={score >= 10} onClick={() => set(p.id, nudge(score, 0.5))}
                      className="grid h-9 w-9 place-items-center rounded-lg bg-gris text-negro ring-1 ring-black/10 active:scale-95 disabled:opacity-40"><Plus size={16} /></button>
                    <button type="button" aria-label={`Quitar la nota de ${p.name}`} onClick={() => set(p.id, null)}
                      className="grid h-9 w-7 place-items-center rounded-lg text-negro/45 hover:text-rojo active:scale-95"><X size={16} /></button>
                  </span>
                ) : null}
              </div>
              {!p.me && score === undefined && (
                <div role="group" aria-label={`Nota para ${p.name}`} className="mt-2 grid grid-cols-10 gap-1">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button key={n} type="button" onClick={() => set(p.id, n)}
                      className={`sport h-9 rounded-lg text-base font-black italic tabular-nums ring-1 ring-black/10 transition active:scale-90 bg-white hover:bg-gris`}>
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="rounded-lg bg-rojo/10 px-3 py-2 text-sm font-medium text-rojo">{error}</p>}
      <p className="text-sm text-negro/65">
        {left === 0 && done > 0
          ? <>Has puntuado a todos. Puedes cambiar las notas hasta el cierre.</>
          : done > 0
            ? <>Llevas {done} de {done + left}. No hace falta puntuar a todos.</>
            : <>Toca un número para puntuar. No hace falta puntuar a todos.</>}
      </p>
    </div>
  );
}
