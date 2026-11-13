import { CYCLE, type Discipline } from "@/lib/discipline";

/** Ciclo de amarillas de la liga en la ficha: cinco tarjetas que se van encendiendo. */
export function CardCycle({ d, isMe }: { d: Discipline; isMe: boolean }) {
  const lit = d.status === "banned" && d.inCycle === 0 && d.count > 0 ? CYCLE : d.inCycle;
  const text = d.status === "banned"
    ? `${d.reason}. ${isMe ? "Puede que te toque" : "Puede que le toque"} cumplir sanción el próximo partido: compruébalo en la federación.`
    : d.status === "warn"
      ? `${isMe ? "Estás" : "Está"} a una amarilla de la sanción: si ${isMe ? "ves" : "ve"} otra, ${isMe ? "te pierdes" : "se pierde"} el partido siguiente.`
      : d.count === 0
        ? "Sin amarillas en esta liga. ¡Así se juega!"
        : `${d.inCycle} de ${CYCLE}: con ${CYCLE} amarillas toca un partido de sanción.`;
  const tone = d.status === "banned" ? "bg-rojo/5 ring-rojo/40" : d.status === "warn" ? "bg-amber-50 ring-amber-300" : "bg-white ring-black/5";
  return (
    <div className={`mt-3 rounded-2xl p-3 ring-1 ${tone}`} aria-label={`Ciclo de amarillas: ${lit} de ${CYCLE}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-negro/65">
          Ciclo de amarillas · liga
          {d.status === "banned" && <span className="rounded bg-rojo px-1.5 py-0.5 text-white">Sanción</span>}
          {d.status === "warn" && <span className="rounded bg-amber-400 px-1.5 py-0.5 text-negro">A una</span>}
        </p>
        <div className="flex items-center gap-1" aria-hidden>
          {Array.from({ length: CYCLE }, (_, i) => (
            <span key={i} style={{ animationDelay: `${i * 90}ms` }}
              className={`anim-card-show inline-block h-5 w-3.5 rounded-[3px] shadow-sm ${i < lit ? (d.status === "banned" ? "bg-rojo" : "bg-amber-400") : "bg-black/[0.08]"}`} />
          ))}
          <span className="sport ml-1.5 text-lg font-black tabular-nums leading-none">{lit}/{CYCLE}</span>
        </div>
      </div>
      <p className={`mt-1.5 text-sm ${d.status === "ok" ? "text-negro/75" : "font-semibold"}`}>{text}</p>
    </div>
  );
}
