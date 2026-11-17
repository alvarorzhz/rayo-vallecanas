import { notFound } from "next/navigation";
import { X } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { euros, fecha, PAYMENT_METHOD_LABEL } from "@/lib/format";
import { Empty, PageHeader } from "@/components/ui";
import { HandoverForm } from "@/components/lottery/client-forms";
import { accountBar, accountsTotals, sellerAccount, type SellerAccountRow } from "@/lib/lottery/accounts";
import { addHandover, voidHandover } from "../../actions";

export const metadata = { title: "Cuentas de vendedores" };

type Handover = { id: string; seller_id: string; amount_cents: number; method: string; handed_on: string; notes: string | null; voided_at: string | null };

const BADGE = {
  debe: "bg-dorado/25 text-[#6b5410]",
  "al-dia": "bg-green-700/15 text-green-900",
  "de-mas": "bg-black/5 text-negro/70",
  "sin-ventas": "bg-black/5 text-negro/55",
} as const;

/** 4.20.0 · Lo que cada vendedor ha cobrado y lo que ya ha entregado al club. */
export default async function AccountsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePerm("lottery_admin", "read");
  const canEdit = s.can("lottery_admin", "update");
  const supabase = await createClient();
  const { data: c } = await supabase.from("lottery_campaigns").select("id, name").eq("id", id).single();
  if (!c) notFound();

  const [{ data: rows, error }, { data: hs }] = await Promise.all([
    supabase.rpc("lottery_seller_accounts", { p_campaign_id: id }),
    supabase.from("lottery_handovers").select("id, seller_id, amount_cents, method, handed_on, notes, voided_at").eq("campaign_id", id)
      .is("voided_at", null).order("handed_on", { ascending: false }).order("created_at", { ascending: false }).returns<Handover[]>(),
  ]);
  const accounts = ((rows ?? []) as SellerAccountRow[]).map(sellerAccount);
  const totals = accountsTotals(accounts);
  const bySeller = new Map<string, Handover[]>();
  for (const h of hs ?? []) bySeller.set(h.seller_id, [...(bySeller.get(h.seller_id) ?? []), h]);

  return (
    <>
      <PageHeader title="Cuentas de vendedores" subtitle={c.name} back={{ href: `/loteria/${id}`, label: c.name }} />

      {error ? (
        <div className="card text-sm text-negro/70">Las cuentas de vendedores todavía no están activadas en la base de datos. Hay que ejecutar el SQL de la versión 4.20.0.</div>
      ) : (
        <>
          <section className="franja relative mb-5 overflow-hidden rounded-3xl bg-negro p-5 text-white shadow-xl">
            <div className="relative grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/65">Ya en la caja</div>
                <div className="sport text-3xl font-black leading-none">{euros(totals.handed)}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-dorado">En manos de vendedores</div>
                <div className="sport text-3xl font-black leading-none text-dorado">{euros(totals.owed)}</div>
              </div>
            </div>
            {totals.unpaid > 0 && <p className="relative mt-3 text-xs text-white/70">Y {euros(totals.unpaid)} que los compradores aún no han pagado.</p>}
          </section>

          {!accounts.length ? (
            <Empty>Asigna vendedores a la campaña.</Empty>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {accounts.map((a) => {
                const bar = accountBar(a);
                const list = bySeller.get(a.seller_id) ?? [];
                const first = a.full_name.split(" ")[0];
                return (
                  <li key={a.seller_id} className="card space-y-2.5 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <b className="truncate">{a.full_name}</b>
                      <span className={`badge shrink-0 font-extrabold ${BADGE[a.state]}`}>
                        {a.state === "debe" ? `DEBE ${euros(a.owed)}` : a.state === "al-dia" ? "AL DÍA ✓" : a.state === "de-mas" ? `${euros(a.over)} DE MÁS` : "SIN VENTAS"}
                      </span>
                    </div>
                    <p className="text-xs text-negro/65">
                      Vendido {euros(a.sold_cents)} ({a.shares}) · cobrado {euros(a.paid_cents)} · entregado {euros(a.handed_cents)}
                    </p>
                    {a.state === "de-mas" && <p className="text-xs text-negro/65">Ha entregado más de lo que consta cobrado: seguramente falta apuntar algún cobro en sus ventas.</p>}
                    {a.state !== "sin-ventas" && (
                      <div className="flex h-2 overflow-hidden rounded-full bg-black/5" role="img" aria-label={`Entregado ${euros(a.handed_cents)}, en su mano ${euros(a.owed)}`}>
                        <div className="h-full bg-green-700" style={{ width: `${bar.handed}%` }} />
                        <div className="h-full bg-dorado" style={{ width: `${bar.owed}%` }} />
                      </div>
                    )}
                    {canEdit && a.state === "debe" && (
                      <div className="flex">
                        <HandoverForm key={`${a.seller_id}-${a.owed}-${list.length}`} action={addHandover.bind(null, id, a.seller_id)} owed={a.owed} name={first} />
                      </div>
                    )}
                    {list.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer font-bold text-negro/65">Entregas · {list.length}</summary>
                        <ul className="mt-1.5 divide-y divide-black/5">
                          {list.map((h) => (
                            <li key={h.id} className="flex items-center gap-2 py-1.5">
                              <span className="w-20 shrink-0 text-negro/60">{fecha(h.handed_on)}</span>
                              <b className="tabular-nums">{euros(h.amount_cents)}</b>
                              <span className="min-w-0 flex-1 truncate text-negro/60">{PAYMENT_METHOD_LABEL[h.method] ?? h.method}{h.notes ? ` · ${h.notes}` : ""}</span>
                              {canEdit && (
                                <form action={voidHandover.bind(null, id, h.id)}>
                                  <button aria-label="Anular esta entrega" className="rounded p-1 text-negro/50 hover:text-rojo"><X size={14} /></button>
                                </form>
                              )}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-4 text-center text-xs text-negro/60">
            Verde: ya en la caja del club. Dorado: cobrado al comprador pero lo tiene todavía el vendedor. Las entregas no tocan Finanzas: la recaudación se sigue pasando con «Pasar a Finanzas», como siempre. Cada vendedor ve lo suyo en «Mis ventas».
          </p>
        </>
      )}
    </>
  );
}
