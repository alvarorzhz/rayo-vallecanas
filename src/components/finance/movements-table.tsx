import Link from "next/link";
import { Paperclip } from "lucide-react";
import { euros, fecha } from "@/lib/format";
import type { MovementRow } from "@/lib/finance";

export function Amount({ kind, cents, voided }: { kind: string; cents: number; voided?: boolean }) {
  return (
    <span className={`font-bold tabular-nums ${voided ? "text-negro/60 line-through" : kind === "income" ? "text-green-700" : "text-rojo"}`}>
      {kind === "income" ? "+" : "−"}{euros(cents)}
    </span>
  );
}

/** Lista de movimientos: tarjetas en el móvil y tabla en el ordenador. */
export function MovementsTable({ rows }: { rows: MovementRow[] }) {
  return (
    <>
      <ul className="divide-y divide-black/5 md:hidden">
        {rows.map((m) => (
          <li key={m.id}>
            <Link href={`/finanzas/${m.id}`} prefetch={false} className="flex items-center gap-3 py-3">
              <span className={`h-9 w-1.5 shrink-0 -skew-x-[15deg] rounded ${m.kind === "income" ? "bg-green-600" : "bg-rojo"}`} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-semibold ${m.voided_at ? "text-negro/60 line-through" : ""}`}>{m.concept}</span>
                <span className="block truncate text-xs text-negro/65">
                  {fecha(m.op_date)} · {m.category?.name}{m.voided_at ? " · Anulado" : ""}
                </span>
              </span>
              {m.attachment_path && <Paperclip size={14} className="shrink-0 text-negro/30" />}
              <Amount kind={m.kind} cents={m.amount_cents} voided={!!m.voided_at} />
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="table">
          <thead>
            <tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th className="hidden xl:table-cell">Persona / proveedor</th><th className="text-right">Importe</th></tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="hover:bg-gris/60">
                <td className="whitespace-nowrap text-negro/60">{fecha(m.op_date)}</td>
                <td className="max-w-[22rem]">
                  <Link href={`/finanzas/${m.id}`} prefetch={false} className={`flex items-center gap-1.5 font-semibold hover:text-rojo ${m.voided_at ? "text-negro/60 line-through" : ""}`}>
                    <span className="truncate">{m.concept}</span>
                    {m.attachment_path && <Paperclip size={13} className="shrink-0 text-negro/30" />}
                  </Link>
                  {m.voided_at && <span className="badge bg-black/10 text-negro/60">Anulado</span>}
                </td>
                <td className="whitespace-nowrap">{m.category?.name}</td>
                <td className="hidden max-w-[12rem] truncate text-negro/60 xl:table-cell">{m.counterparty ?? "—"}</td>
                <td className="whitespace-nowrap text-right"><Amount kind={m.kind} cents={m.amount_cents} voided={!!m.voided_at} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
