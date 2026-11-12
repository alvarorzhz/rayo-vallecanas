import { CalendarClock, Wallet } from "lucide-react";
import { euros, fecha, PAYMENT_METHOD_LABEL } from "@/lib/format";
import { FEE_STATUS_LABEL, FEE_STATUS_TONE, feeOf, feeStatus } from "@/lib/squad";
import type { fetchMyFee } from "@/lib/squad-queries";
import { Ball } from "@/components/squad/ball";

type MyFee = NonNullable<Awaited<ReturnType<typeof fetchMyFee>>>;

/** Tarjeta «Mi cuota» de Mi perfil: lo que le toca pagar al jugador, lo pagado y lo que falta. Solo lo suyo. */
export function MyFeeCard({ fee }: { fee: MyFee }) {
  const due = feeOf(fee.plan, fee.override);
  const status = feeStatus(due, fee.paid);
  const left = due != null ? Math.max(0, due - fee.paid) : 0;
  const pct = due ? Math.min(100, Math.round((fee.paid / due) * 100)) : fee.paid > 0 ? 100 : 0;
  const late = left > 0 && fee.plan?.due_on && fee.plan.due_on < new Date().toISOString().slice(0, 10);
  return (
    <section className="card" id="mi-cuota">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold"><Wallet size={18} className="text-rojo" /> Mi cuota · {fee.season}</h2>
        <span className={`badge ${FEE_STATUS_TONE[status]}`}>{FEE_STATUS_LABEL[status]}</span>
      </div>
      {due == null ? (
        <p className="text-sm text-negro/65">Todavía no se ha puesto la cuota de esta temporada.</p>
      ) : due === 0 ? (
        <p className="text-sm text-negro/65">Esta temporada no pagas cuota{fee.override?.reason ? ` (${fee.override.reason})` : ""}.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Cuota", euros(due), ""],
              ["Pagado", euros(fee.paid), "text-green-700"],
              ["Falta", euros(left), left ? "text-rojo" : "text-green-700"],
            ].map(([k, v, tone]) => (
              <div key={k} className="rounded-xl bg-gris/60 px-2 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-negro/60">{k}</div>
                <div className={`sport text-xl font-black tabular-nums ${tone}`}>{v}</div>
              </div>
            ))}
          </div>
          <div className="relative mt-4 h-3 rounded-full bg-black/5">
            <div className="anim-fill absolute inset-y-0 left-0 rounded-full bg-[repeating-linear-gradient(90deg,#1f7a3a_0_14px,#2a8f47_14px_28px)]" style={{ width: `${pct}%` }} />
            <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${Math.max(pct, 3)}%` }}><Ball size={20} className="drop-shadow" /></span>
          </div>
          {fee.override && <p className="mt-3 text-xs text-negro/65">Tienes una cuota especial{fee.override.reason ? `: ${fee.override.reason}` : ""}.</p>}
          {left > 0 && fee.plan?.due_on && (
            <p className={`mt-3 flex items-center gap-1.5 text-sm ${late ? "font-bold text-rojo" : "text-negro/70"}`}>
              <CalendarClock size={16} /> {late ? `Se tenía que pagar antes del ${fecha(fee.plan.due_on)}` : `Hay que pagarla antes del ${fecha(fee.plan.due_on)}`}
            </p>
          )}
          {left === 0 && <p className="mt-3 text-sm font-bold text-green-700">¡Cuota pagada! Gracias por estar al día.</p>}
        </>
      )}
      {fee.plan?.notes && left > 0 && <p className="mt-2 rounded-xl bg-dorado/15 px-3 py-2 text-sm text-negro/80">{fee.plan.notes}</p>}
      {fee.payments.length > 0 && (
        <ul className="mt-4 divide-y divide-black/5 text-sm">
          {fee.payments.map((p) => (
            <li key={p.id} className="flex justify-between gap-3 py-1.5">
              <span className="text-negro/70">{fecha(p.op_date)} · {PAYMENT_METHOD_LABEL[p.method] ?? p.method}</span>
              <b className="tabular-nums">{euros(p.amount_cents)}</b>
            </li>
          ))}
        </ul>
      )}
      {left > 0 && <p className="mt-3 text-xs text-negro/65">Para pagar, habla con cualquier gestor. En cuanto lo apunte, sale aquí.</p>}
    </section>
  );
}
