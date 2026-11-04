import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fetchSales } from "@/lib/lottery/queries";
import { euros } from "@/lib/format";
import { Empty, PageHeader, Stat } from "@/components/ui";
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
    supabase.from("lottery_campaign_sellers").select("campaign:lottery_campaigns!inner(id, name, status)").eq("user_id", s.user.id).eq("campaign.status", "active"),
  ]);
  const t = (totals ?? []).reduce((a, r) => ({ q: a.q + r.quantity, total: a.total + r.total_cents, paid: a.paid + r.paid_cents }), { q: 0, total: 0, paid: 0 });
  const campaigns = (active ?? []).map((a) => a.campaign as unknown as { id: string; name: string });

  return (
    <>
      <PageHeader
        title="Mis ventas"
        subtitle="Solo ves las ventas que has registrado tú"
        actions={campaigns.map((c) => (
          <Link key={c.id} href={`/loteria/${c.id}/vender`} className="btn-primary">
            <ShoppingCart size={16} /> Vender · {c.name}
          </Link>
        ))}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Participaciones" value={t.q} tone="dark" />
        <Stat label="Vendido" value={euros(t.total)} />
        <Stat label="Cobrado" value={euros(t.paid)} tone="red" />
        <Stat label="Pendiente de cobro" value={euros(t.total - t.paid)} tone="gold" />
      </div>
      <div className="mb-3 flex gap-2 overflow-x-auto text-sm">
        {[["", "Todas"], ["pending", "Pendientes"], ["partial", "Parciales"], ["paid", "Pagadas"]].map(([v, l]) => (
          <Link key={v} href={v ? `?estado=${v}` : "?"} className={`badge px-3 py-1.5 ${(sp.estado ?? "") === v ? "bg-negro text-white" : "bg-white ring-1 ring-black/10"}`}>{l}</Link>
        ))}
      </div>
      <div className="card">
        {rows.length ? <SalesTable rows={rows} showSeller={false} /> : <Empty>Todavía no has registrado ventas.</Empty>}
        <Pager page={page} pageSize={PAGE} total={count} href={(p) => `?p=${p}${sp.estado ? `&estado=${sp.estado}` : ""}`} />
      </div>
    </>
  );
}
