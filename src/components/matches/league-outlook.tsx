import { leagueOutlook, needLabel, type Goal } from "@/lib/league-outlook";
import type { LeagueTable } from "@/lib/league-table";

const TAG: Record<Goal["state"], { text: string; cls: string }> = {
  hecho: { text: "¡HECHO!", cls: "text-[#6b5410]" },
  "depende-de-nosotros": { text: "DEPENDE DE NOSOTROS", cls: "text-green-800" },
  "depende-de-otros": { text: "DEPENDE DE OTROS", cls: "text-[#6b5410]" },
  imposible: { text: "YA NO SE PUEDE", cls: "text-negro/50" },
};

function explain(g: Goal): string {
  if (g.state === "hecho") return "Asegurado, pase lo que pase en lo que queda.";
  if (g.state === "imposible") return "Ya no da con los puntos que quedan.";
  if (g.state === "depende-de-otros") return "Hay que sumar todo lo posible y que fallen los de arriba.";
  return `Con ${needLabel(g.need ?? 0)} más está hecho, hagan lo que hagan los demás.`;
}

/** 4.20.0 · «Lo que queda»: debajo de la clasificación, partidos y puntos en juego y qué hace falta para cada objetivo. */
export function LeagueOutlook({ table, us }: { table: LeagueTable; us: string }) {
  if (!table.withCalendar) return null;
  const left = new Map(table.rows.map((r) => [r.teamId, r.left ?? 0]));
  const o = leagueOutlook(table.rows, us, left);
  if (!o || o.left === 0) return null;
  return (
    <section className="mt-5 space-y-2.5" aria-labelledby="lo-que-queda">
      <div className="franja relative overflow-hidden rounded-2xl bg-negro p-4 text-white shadow-lg">
        <div className="relative">
          <h2 id="lo-que-queda" className="sport text-sm font-black tracking-[0.18em] text-dorado">LO QUE QUEDA</h2>
          <div className="mt-1.5 flex gap-6">
            {([[o.left, o.left === 1 ? "partido" : "partidos", ""], [o.atStake, "puntos en juego", ""], [o.max, "como mucho", "text-dorado"]] as const).map(([v, k, tone]) => (
              <div key={k}>
                <div className={`sport text-4xl font-black leading-none ${tone}`}>{v}</div>
                <div className="mt-0.5 text-xs text-white/75">{k}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {o.goals.map((g) => (
          <div key={g.key} className={`rounded-2xl p-3.5 ring-1 ${g.state === "hecho" ? "bg-dorado/15 ring-dorado/50" : "bg-white ring-black/10"}`}>
            <div className="flex items-baseline justify-between gap-2">
              <b className="text-sm">{g.label}</b>
              <span className={`shrink-0 text-[11px] font-extrabold ${TAG[g.state].cls}`}>{TAG[g.state].text}</span>
            </div>
            <p className="mt-1 text-xs text-negro/70">{explain(g)}</p>
          </div>
      ))}
      <p className="text-[11px] text-negro/60">Sale de la clasificación y el calendario de la web de la liga. Las cuentas son prudentes: se supone que cada rival puede ganar todo lo que le queda.</p>
    </section>
  );
}
