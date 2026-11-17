import type { Streak } from "@/lib/streaks";

/** 4.20.0 · Rachas del jugador (debajo de Logros): las que están en marcha, en rojo; las cortadas, con su récord. */
export function Streaks({ items, season }: { items: Streak[]; season: string }) {
  if (!items.length) return null;
  return (
    <section className="card mb-6" aria-labelledby="rachas">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="rachas" className="h2">Rachas</h2>
        <span className="text-xs text-negro/60">Temporada {season}</span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((s) => (
          <li key={s.key} className={`flex items-center gap-3 rounded-xl p-2.5 ${s.live ? "bg-gradient-to-r from-rojo/12 to-rojo/[0.02] ring-1 ring-rojo/30" : "bg-gris"}`}>
            <span className={`sport flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl font-black ${s.live ? "bg-rojo text-white" : "bg-negro text-dorado"}`}>
              {s.live ? s.current : s.best}
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-sm leading-tight">{s.label}</b>
              <span className="text-xs text-negro/65">
                {s.live ? (s.best > s.current ? `En marcha · su récord: ${s.best}` : "En marcha · ¡su mejor racha!") : "Su mejor racha"}
              </span>
            </span>
            {s.live && <span className="shrink-0 text-[11px] font-extrabold text-rojo">EN RACHA</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
