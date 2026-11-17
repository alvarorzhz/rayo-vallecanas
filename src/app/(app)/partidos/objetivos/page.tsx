import { X } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { seasonFromSlug, seasonSlug } from "@/lib/squad";
import { fetchGoalsBoard } from "@/lib/season-goals-server";
import { PageHeader } from "@/components/ui";
import { SeasonGoals } from "@/components/matches/season-goals";
import { GoalForm } from "@/components/matches/goal-form";
import { addSeasonGoal, removeSeasonGoal } from "../goal-actions";

export const metadata = { title: "Objetivos de temporada" };

/** 4.20.0 · Poner y quitar los objetivos de la temporada (gestores). */
export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ temporada?: string }> }) {
  const sp = await searchParams;
  await requirePerm("matches", "update");
  const supabase = await createClient();
  const season = seasonFromSlug(sp.temporada) ?? seasonOf();
  const goals = await fetchGoalsBoard(supabase, season);
  const back = `/partidos/estadisticas?temporada=${seasonSlug(season)}`;

  return (
    <>
      <PageHeader title="Objetivos" subtitle={<>Temporada <b>{season}</b>. La app los mide sola con las actas y la clasificación, y avisa al equipo cuando se cumple uno.</>}
        back={{ href: back, label: "Estadísticas" }} />
      {goals === null ? (
        <div className="card text-sm text-negro/70">Los objetivos todavía no están activados en la base de datos. Hay que ejecutar el SQL de la versión 4.20.0.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <SeasonGoals goals={goals} season={season} canEdit={false} />
            {goals.length > 0 && (
              <section className="card">
                <h2 className="mb-2 text-sm font-bold">Quitar un objetivo</h2>
                <ul className="divide-y divide-black/5 text-sm">
                  {goals.map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-2 py-1.5">
                      <span>{g.title}</span>
                      <form action={removeSeasonGoal.bind(null, g.id)}>
                        <button aria-label={`Quitar «${g.title}»`} className="rounded-lg p-2 text-negro/55 ring-1 ring-black/10 hover:text-rojo"><X size={15} /></button>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <section className="card h-max">
            <h2 className="mb-3 font-bold">Añadir objetivo</h2>
            {goals.length >= 8 ? <p className="text-sm text-negro/65">Ya hay 8: quita alguno para poner otro.</p> : <GoalForm action={addSeasonGoal.bind(null, season)} />}
            <p className="mt-3 text-xs text-negro/60">Si pones uno que ya está cumplido, sale como conseguido sin avisar a nadie. Lo que se consigue se queda conseguido aunque luego se corte la racha.</p>
          </section>
        </div>
      )}
    </>
  );
}
