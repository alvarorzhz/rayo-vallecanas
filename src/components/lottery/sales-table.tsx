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
      <ul className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/loteria/venta/${r.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-gris p-3 active:bg-black/5">
              <div className="min-w-0">
                <div className="truncate font-semibold">{r.buyer?.full_name}</div>
                <div className="text-xs text-negro/60">
                  <span className="font-mono">{r.reference}</span> · {r.quantity} {unit}{showSeller && r.seller_name ? ` · ${r.seller_name}` : ""}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-bold tabular-nums">{euros(r.total_cents)}</div>
                <PaymentBadge status={r.payment_status} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
