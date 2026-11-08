"use client";
import { useState, useTransition } from "react";
import { Star, Vote } from "lucide-react";
import { Jersey } from "@/components/squad/jersey";
import { FormMessage } from "@/components/form-message";

type S = { error?: string; ok?: string } | undefined;
export type MvpChoice = { id: string; name: string; number: number | null; goalkeeper: boolean; me: boolean };

/**
 * Rejilla de jugadores para votar al MVP (mode="vote", se puede cambiar hasta el cierre)
 * o para que un gestor desempate (mode="pick", sin vuelta atrás).
 */
export function MvpChoices({ choices, mine, action, mode, dark = false }: {
  choices: MvpChoice[]; mine: string | null; action: (id: string) => Promise<S>; mode: "vote" | "pick"; dark?: boolean;
}) {
  const [choice, setChoice] = useState<string | null>(mine);
  const [state, setState] = useState<S>();
  const [pending, start] = useTransition();
  function send(id: string) {
    if (mode === "pick" && !confirm(`¿${choices.find((c) => c.id === id)?.name} es el MVP del partido? No se puede cambiar después.`)) return;
    const before = choice;
    setChoice(id);
    start(async () => {
      const r = await action(id);
      if (r?.error) setChoice(before);
      setState(r);
    });
  }
  const picked = choices.find((c) => c.id === choice);
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label={mode === "vote" ? "Tu voto al MVP" : "Elige al MVP"} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {choices.map((c) => {
          const on = choice === c.id;
          return (
            <button key={c.id} type="button" role="radio" aria-checked={on} disabled={pending || c.me} onClick={() => send(c.id)}
              title={c.me ? "No puedes votarte a ti mismo" : undefined}
              className={`flex min-h-12 items-center gap-2 rounded-xl p-2 text-left text-sm font-bold ring-2 transition active:scale-95 disabled:cursor-not-allowed ${
                on ? "scale-[1.02] bg-dorado text-negro shadow-lg ring-dorado"
                  : c.me ? (dark ? "bg-white/5 text-white/45 ring-white/10" : "bg-gris text-negro/45 ring-transparent")
                  : dark ? "bg-white/10 text-white ring-white/15 hover:bg-white/20" : "bg-white text-negro ring-black/10 hover:ring-negro/30"
              }`}>
              {on ? <Star size={22} className="shrink-0 fill-negro text-negro" /> : <span className="shrink-0"><Jersey number={c.number} goalkeeper={c.goalkeeper} size={24} dim={c.me} /></span>}
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              {c.me && <span className="text-[0.65rem] font-black uppercase tracking-wider">Tú</span>}
            </button>
          );
        })}
      </div>
      {pending ? (
        <p className={`text-sm ${dark ? "text-white/80" : "text-negro/65"}`}>Guardando…</p>
      ) : state?.error ? (
        <FormMessage state={state} />
      ) : mode === "vote" && picked ? (
        <p className={`flex items-center gap-1.5 text-sm ${dark ? "text-white/80" : "text-negro/65"}`}><Vote size={15} className="shrink-0 text-dorado" /> <span>Has votado a <b>{picked.name}</b>. Puedes cambiarlo hasta el cierre.</span></p>
      ) : null}
    </div>
  );
}

/** Botón para que un gestor abra la votación a mano. */
export function OpenMvpButton({ action }: { action: () => Promise<S> }) {
  const [state, setState] = useState<S>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} className="btn-primary" onClick={() => start(async () => setState(await action()))}>
        <Star size={16} className="fill-dorado text-dorado" /> {pending ? "Abriendo…" : "Abrir votación del MVP"}
      </button>
      <FormMessage state={state} />
    </div>
  );
}
