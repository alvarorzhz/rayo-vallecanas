import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { euros, fecha, PAYMENT_METHOD_LABEL, ranges } from "@/lib/format";
import { PageHeader, PaymentBadge } from "@/components/ui";
import { CancelForm, PaymentForm, SendReceipt } from "@/components/lottery/sale-actions";
import { loadReceipt } from "@/lib/lottery/receipt-data";
import { headline, headlineLabel } from "@/lib/receipt";
import { whatsappConfigured } from "@/lib/notify";
import { addPayment, cancelSale, openWhatsAppManual, sendReceipt } from "../../actions";

export const metadata = { title: "Venta" };

export default async function SalePage({
  params,
  searchParams,
}: {
  params: Promise<{ saleId: string }>;
  searchParams: Promise<{ nueva?: string; enviado?: string; envio_error?: string }>;
}) {
  const { saleId } = await params;
  const sp = await searchParams;
  const s = await getSession();
  const supabase = await createClient();

  const { data: sale } = await supabase.from("lottery_sales").select("*").eq("id", saleId).single();
  if (!sale) notFound();
  const receipt = await loadReceipt(supabase, saleId);
  if (!receipt) notFound();
  const [{ data: payments }, { data: notifications }] = await Promise.all([
    supabase.from("lottery_payments").select("*").eq("sale_id", saleId).order("paid_at"),
    supabase.from("notifications").select("*").eq("sale_id", saleId).order("created_at", { ascending: false }),
  ]);

  const d = receipt.data;
  const pending = sale.total_cents - sale.paid_cents;
  const cancelled = Boolean(sale.cancelled_at);
  const isOwner = sale.seller_id === s.user.id;
  const canPay = !cancelled && (s.can("lottery_admin", "update") || (isOwner && s.can("lottery_sell", "update")));
  const waApi = whatsappConfigured();

  return (
    <>
      <PageHeader
        title={`Venta ${sale.reference}`}
        subtitle={<span className="flex items-center gap-2"><PaymentBadge status={sale.payment_status} /> {d.campaignName}</span>}
        back={{ href: `/loteria/${sale.campaign_id}`, label: d.campaignName }}
      />

      {sp.nueva && (
        <div className="mb-4 rounded-xl bg-green-50 p-3 text-sm font-medium text-green-800 print:hidden">
          ✅ Venta registrada.{" "}
          {sp.enviado === "email" && "Justificante enviado por email."}
          {sp.enviado === "whatsapp" && "Justificante enviado por WhatsApp."}
          {sp.envio_error && <span className="text-rojo">No se pudo enviar el justificante: {sp.envio_error}. Puedes reenviarlo abajo.</span>}
          {!sp.enviado && !sp.envio_error && receipt.preferredChannel === "whatsapp" && "Pulsa “Abrir en WhatsApp” para mandarle el justificante."}
        </div>
      )}
      {cancelled && (
        <div className="mb-4 rounded-xl bg-rojo/10 p-3 text-sm text-rojo">
          Venta anulada el {fecha(sale.cancelled_at, true)}. Motivo: {sale.cancel_reason}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        {/* Justificante */}
        <article id="justificante" className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <header className="border-b-4 border-rojo bg-negro p-5 text-center text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/escudo.png" alt="" width={64} height={76} className="mx-auto" />
            <div className="mt-2 text-lg font-black tracking-wide">RAYO VALLECAÑAS</div>
            <div className="text-xs tracking-[0.3em] text-dorado">{d.kind === "raffle" ? "JUSTIFICANTE DE RIFA" : "JUSTIFICANTE DE LOTERÍA"}</div>
          </header>
          <div className="space-y-4 p-5">
            <p>¡Gracias por colaborar con nuestro equipo, <b>{d.buyerName}</b>!</p>
            <div className="rounded-xl bg-negro p-4 text-center text-white">
              <div className="text-xs tracking-[0.3em] text-dorado">{headlineLabel(d)}</div>
              <div className={`font-mono font-black ${d.kind === "raffle" ? "break-words text-3xl tracking-wider" : "text-5xl tracking-[0.25em]"}`}>{headline(d)}</div>
              <div className="text-xs text-white/60">{d.drawType}{d.drawDate ? ` · ${fecha(d.drawDate)}` : ""}</div>
            </div>
            <dl className="divide-y divide-black/5 text-sm">
              {[
                ["Referencia", <span key="r" className="font-mono font-bold">{d.reference}</span>],
                d.kind === "raffle"
                  ? ["Números", String(d.quantity)]
                  : ["Participaciones", `${d.quantity} (nº ${d.shareNumbers.length ? ranges(d.shareNumbers) : "—"})`],
                ["Vendedor", d.sellerName],
                ["Fecha", fecha(d.createdAt, true)],
                ["Pagado", euros(sale.paid_cents)],
                ["Pendiente", euros(pending)],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between py-2"><dt className="text-negro/60">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
              ))}
              <div className="flex justify-between py-3"><dt className="font-bold">Importe</dt><dd className="text-xl font-black">{euros(d.totalCents)}</dd></div>
            </dl>
            <p className="text-center font-bold">¡Mucha suerte y gracias por apoyar al Rayo Vallecañas! ⚡</p>
            <p className="text-center text-[11px] text-negro/40">Este justificante no sustituye a la participación física.</p>
          </div>
        </article>

        <aside className="space-y-6 print:hidden">
          <section className="card">
            <h2 className="mb-2 font-bold">Comprador</h2>
            <p className="font-semibold">{receipt.buyer.full_name}</p>
            {receipt.buyer.phone && <p className="text-sm text-negro/70">📞 <a href={`tel:${receipt.buyer.phone}`}>{receipt.buyer.phone}</a></p>}
            {receipt.buyer.email && <p className="text-sm text-negro/70">✉️ {receipt.buyer.email}</p>}
            {sale.notes && <p className="mt-2 text-sm text-negro/60">{sale.notes}</p>}
          </section>

          {!cancelled && (
            <section className="card">
              <h2 className="mb-3 font-bold">Enviar justificante</h2>
              <SendReceipt
                email={sendReceipt.bind(null, saleId, "email")}
                whatsappApi={waApi ? sendReceipt.bind(null, saleId, "whatsapp") : undefined}
                whatsappManual={openWhatsAppManual.bind(null, saleId)}
                hasEmail={Boolean(receipt.buyer.email)}
                hasPhone={Boolean(receipt.buyer.phone)}
              />
              {(notifications?.length ?? 0) > 0 && (
                <ul className="mt-4 space-y-1 border-t border-black/5 pt-3 text-xs">
                  {notifications!.map((n) => (
                    <li key={n.id} className="flex justify-between gap-2">
                      <span>{n.channel === "email" ? "Email" : "WhatsApp"} · {fecha(n.created_at, true)}</span>
                      <span className={n.status === "sent" ? "text-green-700" : n.status === "failed" ? "text-rojo" : "text-negro/50"} title={n.error ?? ""}>
                        {n.status === "sent" ? (n.provider_id?.startsWith("manual") ? "Abierto" : "Enviado") : n.status === "failed" ? "Error" : "Pendiente"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="card">
            <h2 className="mb-3 font-bold">Cobros</h2>
            {payments?.length ? (
              <ul className="mb-4 space-y-1 text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span className="text-negro/70">{fecha(p.paid_at, true)} · {PAYMENT_METHOD_LABEL[p.method]}</span>
                    <b className={p.amount_cents < 0 ? "text-rojo" : ""}>{euros(p.amount_cents)}</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-negro/50">Sin cobros registrados.</p>
            )}
            {canPay && (pending > 0 || s.can("lottery_admin", "update")) && (
              <PaymentForm action={addPayment.bind(null, saleId)} pendingCents={pending} canRefund={s.can("lottery_admin", "update")} />
            )}
          </section>

          {!cancelled && s.can("lottery_admin", "delete") && (
            <section className="card">
              <h2 className="mb-1 font-bold">Anulación controlada</h2>
              <p className="mb-3 text-xs text-negro/50">La venta no se borra: queda marcada como anulada y registrada en auditoría. Si ya se cobró algo, registra la devolución antes.</p>
              <CancelForm action={cancelSale.bind(null, saleId)} />
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
