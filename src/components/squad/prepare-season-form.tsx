"use client";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Jersey } from "@/components/squad/jersey";
import { LINE_TONE, lineOf } from "@/lib/squad";
import type { ActionState } from "@/app/(app)/plantilla/actions";

export type Candidate = { id: string; name: string; sub: string; number: number | null; position: string; photo: string | null; checked: boolean; group: "squad" | "left" | "former" };

const GROUPS: { key: Candidate["group"]; title: string; hint: string }[] = [
  { key: "squad", title: "Plantilla actual", hint: "Marcados: siguen la próxima temporada." },
  { key: "left", title: "Se fueron esta temporada", hint: "Por si alguno vuelve." },
  { key: "former", title: "Exjugadores de temporadas anteriores", hint: "Por si alguno vuelve." },
];

export function PrepareSeasonForm({ action, from, to, candidates }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; from: string; to: string; candidates: Candidate[] }) {
  const [state, formAction] = useActionState(action, undefined);
  const [sel, setSel] = useState(() => new Set(candidates.filter((c) => c.checked).map((c) => c.id)));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const setGroup = (g: Candidate["group"], on: boolean) =>
    setSel((s) => { const n = new Set(s); for (const c of candidates) if (c.group === g) { if (on) n.add(c.id); else n.delete(c.id); } return n; });

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <div className="space-y-6">
        {GROUPS.map((g) => {
          const list = candidates.filter((c) => c.group === g.key);
          if (!list.length) return null;
          const all = list.every((c) => sel.has(c.id));
          return (
            <section key={g.key} className="card">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div><h2>{g.title}</h2><p className="text-xs text-negro/50">{g.hint}</p></div>
                <button type="button" className="text-sm font-bold text-rojo" onClick={() => setGroup(g.key, !all)}>{all ? "Quitar todos" : "Marcar todos"}</button>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {list.map((c) => {
                  const on = sel.has(c.id);
                  return (
                    <li key={c.id}>
                      <label className={`flex cursor-pointer items-center gap-3 rounded-xl p-2.5 ring-1 transition ${on ? "bg-negro text-white ring-negro" : "bg-white ring-black/10 hover:ring-negro/30"}`}>
                        <input type="checkbox" name="player" value={c.id} checked={on} onChange={() => toggle(c.id)} className="h-5 w-5 accent-rojo" />
                        {c.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.photo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-dorado" />
                        ) : (
                          <span className="shrink-0"><Jersey number={c.number} goalkeeper={lineOf(c.position) === "GK"} size={34} /></span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{c.name}</span>
                          <span className={`block truncate text-xs ${on ? "text-white/60" : "text-negro/50"}`}>{c.sub}</span>
                        </span>
                        <span className={`sport shrink-0 rounded px-1.5 py-0.5 text-[11px] font-black ${LINE_TONE[lineOf(c.position)].chip}`}>{c.position}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <section className="card space-y-3">
          <h2>Temporada {to}</h2>
          <div className="sport text-5xl font-black leading-none">{sel.size}<span className="ml-2 text-base text-negro/50">jugadores</span></div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="keep_numbers" defaultChecked className="mt-0.5 h-4 w-4 accent-rojo" /> Mantener los dorsales</label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="keep_armbands" defaultChecked className="mt-0.5 h-4 w-4 accent-rojo" /> Mantener capitán y segundo capitán</label>
          <p className="text-xs text-negro/50">Las estadísticas empiezan a cero. Después puedes cambiar dorsales, fichar nuevos y dar bajas.</p>
          <FormMessage state={state} />
          <SubmitButton disabled={!sel.size} className="btn-primary w-full py-3 text-lg" pendingText="Preparando…">Preparar temporada</SubmitButton>
        </section>
      </div>
    </form>
  );
}
