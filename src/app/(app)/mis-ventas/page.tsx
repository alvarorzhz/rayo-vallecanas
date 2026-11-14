import Link from "next/link";
import { ChevronRight, ShoppingCart } from "lucide-react";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fetchSales } from "@/lib/lottery/queries";
import { euros } from "@/lib/format";
import { Empty, PageHeader } from "@/components/ui";
import { TicketCut, TicketHead, TICKET_CARD } from "@/components/lottery/ticket";
import { SalesTable } from "@/components/lottery/sales-table";
import { Pager } from "@/components/pager";

export const metadata = { title: "Mis ventas" };
const PAGE = 50;

export default async function MySalesPage({ searchParams }: { searchParams: Promise<{ p?: string; estado?: string }> }) {
  const sp = await searchParams;
  const s = await getSession();
  const supabase = await createClient();
  const page = Math.max(1, Number(sp.p) || 1);
  const [{ rows, count }, { data: totals }, { data: active }] = await Promise.all([
    fetchSales(supabase, { sellerId: s.user.id, status: sp.estado, limit: PAGE, offset: (page - 1) * PAGE }),
    supabase.from("lottery_sales").select("quantity, total_cents, paid_cents").eq("seller_id", s.user.id).is("cancelled_at", null),
    supabase.from("lottery_campaign_sellers").select("campaign:lottery_campaigns!inner(id, name, status, kind, price_cents)").eq("user_id", s.user.id).eq("campaign.status", "active"),
  ]);
  const t = (totals ?? []).reduce((a, r) => ({ q: a.q + r.quantity, total: a.total + r.total_cents, paid: a.paid + r.paid_cents }), { q: 0, total: 0, paid: 0 });
  const campaigns = (active ?? []).map((a) => a.campaign as unknown as { id: string; name: string; kind: "lottery" | "raffle"; price_cents: number });
  const owed = t.total - t.paid;

  return (
    <>
      <PageHeader title="Mis ventas" subtitle="Solo ves las ventas que has registrado tú" back={{ href: "/loteria", label: "Sorteos" }} />

      {campaigns.length > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/loteria/${c.id}/vender`}
              className="lift group flex items-center gap-3 overflow-hidden rounded-2xl bg-rojo p-4 text-white shadow-lg shadow-rojo/25">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15"><ShoppingCart size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-dorado">Vender {c.kind === "raffle" ? "rifa" : "lotería"} · {euros(c.price_cents)}</span>
                <span className="sport block truncate text-xl leading-tight font-black">{c.name}</span>
              </span>
              <ChevronRight size={20} className="shrink-0 transition group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      )}

      <div className={`${TICKET_CARD} mb-6 animate-fade-up`}>
        <TicketHead eyebrow="Tu taquilla" title={<>{t.q} {t.q === 1 ? "vendido" : "vendidos"}</>} sub="Sin contar las anuladas"
          aside={<div className="text-right"><div className="text-[10px] font-bold uppercase tracking-widest text-dorado">Vendido</div><div className="sport text-2xl leading-tight font-black">{euros(t.total)}</div></div>} />
        <TicketCut notch="bg-gris" />
        <dl className="grid grid-cols-2 divide-x divide-black/5 text-center">
          <div className="p-3">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-negro/55">Cobrado</dt>
            <dd className="sport text-2xl leading-tight font-black text-green-700">{euros(t.paid)}</dd>
          </div>
          <div className="p-3">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-negro/55">Por cobrar</dt>
            <dd className={`sport text-2xl leading-tight font-black ${owed > 0 ? "text-rojo" : "text-negro/35"}`}>{euros(owed)}</dd>
          </div>
        </dl>
        {owed > 0 && <p className="border-t border-black/5 px-4 py-2 text-center text-xs text-negro/60">Cuando te paguen, entra en la venta y apunta el cobro.</p>}
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto text-sm">
        {[["", "Todas"], ["pending", "Pendientes"], ["partial", "Parciales"], ["paid", "Pagadas"]].map(([v, l]) => (
          <Link key={v} href={v ? `?estado=${v}` : "?"} className={`badge px-3 py-1.5 ${(sp.estado ?? "") === v ? "tab-on bg-negro text-white" : "bg-white ring-1 ring-black/10"}`}>{l}</Link>
        ))}
      </div>
      <div className="md:card">
        {rows.length ? <SalesTable rows={rows} showSeller={false} unit="" /> : <Empty>Todavía no has registrado ventas.</Empty>}
        <Pager page={page} pageSize={PAGE} total={count} href={(p) => `?p=${p}${sp.estado ? `&estado=${sp.estado}` : ""}`} />
      </div>
    </>
  );
}
