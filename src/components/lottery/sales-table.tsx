import Link from "next/link";
import { euros, fecha } from "@/lib/format";
import { PaymentBadge } from "@/components/ui";

export type SaleRow = {
  id: string;
  reference: string;
  quantity: number;
  total_cents: number;
  paid_cents: number;
  payment_status: string;
  created_at: string;
  buyer: { full_name: string } | null;
  seller_name?: string;
};

/** Tabla en escritorio, tarjetas en móvil. */
export function SalesTable({ rows, showSeller = true, unit = "part." }: { rows: SaleRow[]; showSeller?: boolean; unit?: string }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="table">
          <thead>
            <tr>
              <th>Referencia</th>
              <th>Comprador</th>
              {showSeller && <th>Vendedor</th>}
              <th className="text-right">Part.</th>
              <th className="text-right">Importe</th>
              <th className="text-right">Cobrado</th>
              <th>Pago</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gris">
                <td className="whitespace-nowrap"><Link href={`/loteria/venta/${r.id}`} className="font-mono font-semibold text-rojo hover:underline">{r.reference}</Link></td>
                <td>{r.buyer?.full_name}</td>
                {showSeller && <td className="text-negro/70">{r.seller_name}</td>}
                <td className="text-right tabular-nums">{r.quantity}</td>
                <td className="text-right tabular-nums">{euros(r.total_cents)}</td>
                <td className="text-right tabular-nums">{euros(r.paid_cents)}</td>
                <td><PaymentBadge status={r.payment_status} /></td>
                <td className="whitespace-nowrap text-negro/60">{fecha(r.created_at, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="stagger space-y-2 md:hidden">
        {rows.map((r) => {
          const owed = r.total_cents - r.paid_cents;
          const stub = r.payment_status === "paid" ? "bg-green-700" : r.payment_status === "cancelled" ? "bg-black/30" : r.payment_status === "partial" ? "bg-amber-500" : "bg-rojo";
          return (
            <li key={r.id}>
              <Link href={`/loteria/venta/${r.id}`} className="flex items-stretch overflow-hidden rounded-xl bg-white ring-1 ring-black/[0.07] transition active:scale-[0.99] active:bg-gris">
                {/* Matriz del boleto: cuántos números se lleva */}
                <div className={`flex w-14 shrink-0 flex-col items-center justify-center border-r-2 border-dashed border-white/60 text-white ${stub}`}>
                  <span className="sport text-2xl leading-none font-black">{r.quantity}</span>
                  {unit && <span className="text-[9px] font-bold uppercase tracking-wider text-white/80">{unit}</span>}
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className={`truncate font-bold ${r.payment_status === "cancelled" ? "text-negro/45 line-through" : ""}`}>{r.buyer?.full_name}</div>
                    <div className="truncate text-xs text-negro/55">
                      <span className="font-mono">{r.reference}</span> · {fecha(r.created_at)}{showSeller && r.seller_name ? ` · ${r.seller_name}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="sport text-lg leading-tight font-black tabular-nums">{euros(r.total_cents)}</div>
                    {owed > 0 && r.payment_status !== "cancelled"
                      ? <div className="text-[11px] font-bold text-rojo">Debe {euros(owed)}</div>
                      : <PaymentBadge status={r.payment_status} />}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
