import { euros } from "@/lib/format";
import { Ball } from "@/components/squad/ball";

/** Barra de lo pagado de la cuota, con el balón rodando hasta donde llega. */
export function FeeBar({ due, paid }: { due: number | null; paid: number }) {
  const pct = due ? Math.min(100, Math.round((paid / due) * 100)) : paid > 0 ? 100 : 0;
  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-negro/65">Pagado</div>
          <div className="sport text-3xl font-black leading-none text-green-700">{euros(paid)}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-bold uppercase tracking-wider text-negro/65">{due == null ? "Cuota" : due > paid ? "Falta" : "Cuota"}</div>
          <div className={`sport text-3xl font-black leading-none ${due != null && due > paid ? "text-rojo" : ""}`}>
            {due == null ? "–" : euros(due > paid ? due - paid : due)}
          </div>
        </div>
      </div>
      <div className="relative mt-3 h-3 rounded-full bg-[#1f7a3a]/15">
        <div className="anim-fill absolute inset-y-0 left-0 rounded-full bg-[repeating-linear-gradient(90deg,#1f7a3a_0_14px,#2a8f47_14px_28px)]" style={{ width: `${pct}%` }} />
        {pct > 0 && (
          <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-1000" style={{ left: `${pct}%` }}>
            <Ball size={20} className="anim-spin drop-shadow" />
          </span>
        )}
      </div>
      {due != null && <div className="mt-1 text-right text-xs font-semibold text-negro/65">{pct}% de {euros(due)}</div>}
    </div>
  );
}
