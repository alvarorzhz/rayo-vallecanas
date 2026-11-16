"use client";
import { useState, useTransition } from "react";
import { Check, UserPlus, X } from "lucide-react";
import { addLeagueNewcomers, ignoreLeagueNewcomer, type ActionState } from "@/app/(app)/plantilla/actions";
import { POSITION_LABEL } from "@/lib/squad";

export type NewcomerItem = {
  extId: string; name: string; number: number | null; line: string; returning: boolean;
  apps: number; goals: number; seenAt: string;
};

const since = (iso: string) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" }).format(new Date(iso)).replace(".", "");

/**
 * Plantilla → «Nuevos en la liga» (v4.17.0): jugadores que están en la plantilla del Rayo en
 * futormes y no en la de la app. Solo lo ve quien puede fichar. Nadie entra sin pulsar «Añadir».
 */
export function LeagueNewcomers({ items }: { items: NewcomerItem[] }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<ActionState>();
  const run = (key: string, fn: () => Promise<ActionState>) => {
    setBusy(key);
    start(async () => {
      setMsg(await fn());
      setBusy(null);
    });
  };

  if (!items.length) return msg?.ok ? <p role="status" className="anim-rise mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">{msg.ok}</p> : null;

  return (
    <section id="nuevos-liga" aria-labelledby="nuevos-liga-t" className="anim-rise mb-6 scroll-mt-20 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-rojo/25">
      <header className="flex items-start gap-3 border-b border-black/5 bg-rojo/5 px-4 py-3 sm:px-5">
        <span aria-hidden className="mt-0.5 text-xl">🆕</span>
        <div className="min-w-0 flex-1">
          <h2 id="nuevos-liga-t" className="sport text-lg font-black leading-tight">
            {items.length === 1 ? "Jugador nuevo en la liga" : `${items.length} jugadores nuevos en la liga`}
          </h2>
          <p className="text-sm text-negro/65">Están en la plantilla del Rayo en futormes y no en la app. ¿Los añades?</p>
        </div>
        {items.length > 1 && (
          <button type="button" disabled={pending} onClick={() => run("all", () => addLeagueNewcomers(items.map((i) => i.extId)))}
            className="btn-dark hidden shrink-0 !px-3 !py-1.5 text-sm sm:inline-flex">
            <UserPlus size={15} /> {busy === "all" ? "Añadiendo…" : "Añadir todos"}
          </button>
        )}
      </header>
      <ul className="divide-y divide-black/5">
        {items.map((n) => (
          <li key={n.extId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
            <span className="sport grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-negro text-lg font-black text-dorado">{n.number ?? "–"}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{n.name}</div>
              <div className="text-xs text-negro/60">
                {POSITION_LABEL[n.line] ?? n.line} · {n.apps} {n.apps === 1 ? "partido" : "partidos"}{n.goals ? ` · ${n.goals} ${n.goals === 1 ? "gol" : "goles"}` : ""} · desde el {since(n.seenAt)}
                {n.returning && <span className="ml-1.5 rounded bg-dorado/20 px-1.5 py-0.5 font-bold text-negro/80">Vuelve</span>}
              </div>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <button type="button" disabled={pending} onClick={() => run(n.extId, () => addLeagueNewcomers([n.extId]))}
                className="btn-primary flex-1 !px-3 !py-1.5 text-sm sm:flex-none">
                <Check size={15} /> {busy === n.extId ? "Añadiendo…" : "Añadir"}
              </button>
              <button type="button" disabled={pending} onClick={() => run(`x${n.extId}`, () => ignoreLeagueNewcomer(n.extId))}
                title="No es de los nuestros: no volverá a salir" className="btn-ghost flex-1 !px-3 !py-1.5 text-sm sm:flex-none">
                <X size={15} /> Ignorar
              </button>
            </div>
          </li>
        ))}
      </ul>
      {items.length > 1 && (
        <div className="border-t border-black/5 px-4 py-3 sm:hidden">
          <button type="button" disabled={pending} onClick={() => run("all", () => addLeagueNewcomers(items.map((i) => i.extId)))} className="btn-dark w-full justify-center text-sm">
            <UserPlus size={15} /> {busy === "all" ? "Añadiendo…" : `Añadir a los ${items.length}`}
          </button>
        </div>
      )}
      {msg && (
        <p role="status" className={`px-4 pb-3 text-sm font-medium sm:px-5 ${msg.error ? "text-rojo" : "text-green-800"}`}>{msg.error ?? msg.ok}</p>
      )}
    </section>
  );
}
