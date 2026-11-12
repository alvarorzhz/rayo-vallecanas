"use client";
import { useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import type { PorraState } from "@/app/(app)/partidos/porra-actions";
import type { Rival } from "@/lib/matches";
import { Crest } from "@/components/matches/crest";

type Score = { goals_for: number; goals_against: number } | null;

/** Un marcador con − y + (goles de un equipo). */
function Stepper({ value, onChange, label, dark, disabled }: { value: number; onChange: (n: number) => void; label: string; dark: boolean; disabled: boolean }) {
  const btn = `grid h-9 w-9 place-items-center rounded-full ring-1 transition active:scale-90 disabled:opacity-40 ${dark ? "bg-white/10 ring-white/20 hover:bg-white/20" : "bg-white ring-black/15 hover:ring-negro/40"}`;
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={`Goles de ${label}`}>
      <button type="button" className={btn} disabled={disabled || value <= 0} onClick={() => onChange(value - 1)} aria-label={`Un gol menos para ${label}`}><Minus size={16} /></button>
      <output aria-live="polite" className={`sport w-9 text-center text-4xl font-black tabular-nums leading-none ${dark ? "text-white" : "text-negro"}`}>{value}</output>
      <button type="button" className={btn} disabled={disabled || value >= 20} onClick={() => onChange(value + 1)} aria-label={`Un gol más para ${label}`}><Plus size={16} /></button>
    </div>
  );
}

/**
 * La porra: el resultado que crees que va a salir. Va justo debajo de «Voy / No voy» (o suelta, para quien no
 * va convocado). Se guarda con un toque y se puede cambiar hasta el pitido inicial.
 */
export function PorraBox({ action, mine, rival, isHome, count, dark = false }: {
  action: (gf: number | null, ga: number | null) => Promise<PorraState>;
  mine: Score; rival: Pick<Rival, "name" | "short_name" | "color" | "crest_url">; isHome: boolean; count: number; dark?: boolean;
}) {
  const [gf, setGf] = useState(mine?.goals_for ?? 0);
  const [ga, setGa] = useState(mine?.goals_against ?? 0);
  const [saved, setSaved] = useState<Score>(mine);
  const [state, setState] = useState<PorraState>();
  const [pending, start] = useTransition();
  const dirty = !saved || saved.goals_for !== gf || saved.goals_against !== ga;
  const others = Math.max(0, count - (mine ? 1 : 0));
  const rivalName = rival.short_name?.trim() || rival.name;
  const us = { label: "Rayo", node: <Crest us size={30} />, value: gf, set: setGf };
  const them = { label: rivalName, node: <Crest rival={rival} size={30} />, value: ga, set: setGa };
  const [left, right] = isHome ? [us, them] : [them, us];
  const muted = dark ? "text-white/70" : "text-negro/65";

  return (
    <div id="porra" className={`scroll-mt-24 rounded-2xl p-3 ${dark ? "bg-white/5 ring-1 ring-white/10" : "bg-gris/70"}`}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className={`sport text-sm font-black uppercase tracking-widest ${dark ? "text-dorado" : "text-rojo"}`}>🎯 Tu porra</p>
        <p className={`text-xs ${muted}`}>{saved ? "Puedes cambiarla hasta el pitido" : others ? `${others} ya ${others === 1 ? "ha jugado" : "han jugado"}` : "¡Sé el primero!"}</p>
      </div>
      <div className="flex items-center justify-between gap-1">
        {[left, right].map((t, i) => (
          <div key={t.label} className={`flex min-w-0 flex-1 flex-col items-center gap-1.5 ${i === 1 ? "order-3" : "order-1"}`}>
            <span className="flex min-w-0 items-center gap-1.5">{t.node}<span className={`truncate text-xs font-bold ${dark ? "text-white" : ""}`}>{t.label}</span></span>
            <Stepper value={t.value} onChange={t.set} label={t.label} dark={dark} disabled={pending} />
          </div>
        ))}
        <span className={`sport order-2 text-3xl font-black ${muted}`}>–</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" disabled={pending || !dirty} className={`${dark ? "btn-primary" : "btn-dark"} flex-1 py-2 text-sm`}
          onClick={() => start(async () => {
            const r = await action(gf, ga);
            setState(r);
            if (r?.ok) setSaved({ goals_for: gf, goals_against: ga });
          })}>
          {pending ? "Guardando…" : saved && !dirty ? "✓ Porra guardada" : saved ? "Cambiar mi porra" : "Guardar mi porra"}
        </button>
      </div>
      {state?.error && <p className="mt-2 text-sm font-semibold text-rojo">{state.error}</p>}
      <p className={`mt-2 text-[11px] ${muted}`}>3 puntos si clavas el resultado y 1 si aciertas quién gana o el empate. Los de los demás se ven al empezar el partido.</p>
    </div>
  );
}
