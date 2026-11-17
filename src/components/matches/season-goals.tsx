import Link from "next/link";
import { Check, Pencil } from "lucide-react";
import type { GoalCard } from "@/lib/season-goals-server";

/** 4.20.0 · Objetivos de la temporada con su barra (Estadísticas y la página de objetivos). */
export function SeasonGoals({ goals, season, canEdit, editHref }: { goals: GoalCard[]; season: string; canEdit: boolean; editHref?: string }) {
  if (!goals.length && !canEdit) return null;
  const done = goals.filter((g) => g.done).length;
  return (
    <section id="objetivos" className="mb-5 scroll-mt-24">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="sport text-2xl font-black uppercase italic leading-none">Objetivos {season.slice(2)}</h2>
        <span aria-hidden className="h-0.5 flex-1 bg-gradient-to-r from-dorado to-transparent" />
        {canEdit && editHref && (
          <Link href={editHref} prefetch className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold ring-1 ring-black/10 hover:text-rojo">
            <Pencil size={13} /> {goals.length ? "Editar" : "Poner objetivos"}
          </Link>
        )}
      </div>
      {!goals.length ? (
        <p className="rounded-2xl bg-white p-4 text-sm text-negro/65 ring-1 ring-black/10">Todavía no hay objetivos para esta temporada. Elige unos cuantos y la app los irá midiendo sola con las actas.</p>
      ) : (
        <>
          <div className="franja relative mb-2.5 overflow-hidden rounded-2xl bg-negro px-4 py-3 text-white">
            <div className="relative flex items-center gap-3">
              <span className="sport text-4xl font-black leading-none text-dorado">{done}/{goals.length}</span>
              <span className="text-sm text-white/80">{done === goals.length ? "¡Todos cumplidos! 🏆" : `${done === 1 ? "objetivo cumplido" : "objetivos cumplidos"}`}</span>
            </div>
          </div>
          <ul className="space-y-2">
            {goals.map((g) => (
              <li key={g.id} className={`rounded-2xl p-3 ring-1 ${g.done ? "bg-gradient-to-r from-dorado/30 to-dorado/5 ring-dorado/60" : "bg-white ring-black/10"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <b className="text-sm">{g.title}</b>
                  {g.done
                    ? <span className="inline-flex shrink-0 items-center gap-1 text-xs font-extrabold text-[#6b5410]"><Check size={14} /> ¡CONSEGUIDO!</span>
                    : <span className="shrink-0 text-xs font-extrabold tabular-nums">{g.now}</span>}
                </div>
                {!g.done && (
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/5">
                    <div className="anim-fill h-full rounded-full bg-rojo" style={{ width: `${g.pct}%` }} />
                  </div>
                )}
                {!g.done && g.hint && <p className="mt-1 text-[11px] text-negro/60">{g.hint}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
