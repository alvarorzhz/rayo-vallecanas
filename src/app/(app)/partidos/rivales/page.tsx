import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fetchRivals } from "@/lib/match-queries";
import { record, type Match } from "@/lib/matches";
import { Empty, PageHeader } from "@/components/ui";
import { Crest } from "@/components/matches/crest";
import { DeleteButton, RivalForm } from "@/components/matches/match-forms";
import { deleteRival, saveRival } from "../actions";

export const metadata = { title: "Rivales" };

export default async function RivalsPage() {
  const s = await requirePerm("matches", "update");
  const supabase = await createClient();
  const [rivals, { data: games }] = await Promise.all([
    fetchRivals(supabase),
    supabase.from("matches").select("rival_id, status, goals_for, goals_against").returns<Pick<Match, "rival_id" | "status" | "goals_for" | "goals_against">[]>(),
  ]);
  const byRival = new Map<string, typeof games>();
  for (const g of games ?? []) byRival.set(g.rival_id, [...(byRival.get(g.rival_id) ?? []), g]);

  return (
    <>
      <PageHeader title="Rivales" subtitle="Los equipos contra los que jugamos, con su escudo y su campo" back={{ href: "/partidos", label: "Partidos" }} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="min-w-0 space-y-2">
          {rivals.length === 0 ? (
            <Empty>Aún no hay rivales. Añade el primero o créalo al meter un partido.</Empty>
          ) : (
            rivals.map((r) => {
              const rows = byRival.get(r.id) ?? [];
              const rec = record(rows);
              return (
                <details key={r.id} className="group rounded-2xl bg-white shadow-sm ring-1 ring-black/5 open:ring-rojo/40">
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-3 sm:p-4 [&::-webkit-details-marker]:hidden">
                    <Crest rival={r} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{r.name}</span>
                      <span className="block truncate text-xs text-negro/65">{r.home_venue ?? "Sin campo apuntado"}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-negro/65">
                      {rows.length ? <>{rows.length} {rows.length === 1 ? "partido" : "partidos"}{rec.played > 0 && <><br /><b className="text-green-700">{rec.W}V</b> <b>{rec.D}E</b> <b className="text-rojo">{rec.L}D</b></>}</> : "Sin partidos"}
                    </span>
                    <span aria-hidden className="text-negro/40 transition group-open:rotate-90">›</span>
                  </summary>
                  <div className="space-y-3 border-t border-black/5 p-4">
                    <RivalForm action={saveRival.bind(null, r.id)} rival={r} />
                    {s.can("matches", "delete") && rows.length === 0 && (
                      <DeleteButton action={deleteRival.bind(null, r.id)} label="Eliminar rival" confirmText={`¿Eliminar a ${r.name}?`} />
                    )}
                  </div>
                </details>
              );
            })
          )}
        </section>
        <aside className="card self-start lg:sticky lg:top-6">
          <h2 className="mb-3">Nuevo rival</h2>
          <RivalForm action={saveRival.bind(null, null)} />
        </aside>
      </div>
    </>
  );
}
