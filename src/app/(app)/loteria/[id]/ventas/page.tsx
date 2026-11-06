import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fetchSales } from "@/lib/lottery/queries";
import { Empty, PageHeader } from "@/components/ui";
import { SalesTable } from "@/components/lottery/sales-table";
import { Pager } from "@/components/pager";

export const metadata = { title: "Ventas" };
const PAGE = 50;

export default async function SalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; estado?: string; vendedor?: string; p?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  await requirePerm("lottery_admin", "read");
  const supabase = await createClient();
  const { data: c } = await supabase.from("lottery_campaigns").select("id, name, kind").eq("id", id).single();
  if (!c) notFound();
  const page = Math.max(1, Number(sp.p) || 1);
  const [{ rows, count }, { data: sellers }] = await Promise.all([
    fetchSales(supabase, { campaignId: id, q: sp.q, status: sp.estado, sellerId: sp.vendedor || undefined, limit: PAGE, offset: (page - 1) * PAGE }),
    supabase.from("lottery_campaign_sellers").select("user_id").eq("campaign_id", id),
  ]);
  const { data: people } = await supabase.from("member_directory").select("id, full_name").in("id", (sellers ?? []).map((s) => s.user_id)).order("full_name");

  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (sp.q) u.set("q", sp.q);
    if (sp.estado) u.set("estado", sp.estado);
    if (sp.vendedor) u.set("vendedor", sp.vendedor);
    u.set("p", String(p));
    return `?${u}`;
  };

  return (
    <>
      <PageHeader
        title="Ventas"
        subtitle={c.name}
        back={{ href: `/loteria/${id}`, label: c.name }}
        actions={<a href={`/api/loteria/${id}/export`} className="btn-ghost"><Download size={16} /> Exportar Excel</a>}
      />
      <form className="card mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <input name="q" defaultValue={sp.q} className="input" placeholder="Buscar por comprador o referencia" />
        <select name="estado" defaultValue={sp.estado ?? ""} className="input" aria-label="Estado del cobro">
          <option value="">Todos los pagos</option>
          <option value="pending">Pendiente</option>
          <option value="partial">Parcial</option>
          <option value="paid">Pagado</option>
          <option value="cancelled">Anuladas</option>
        </select>
        <select name="vendedor" defaultValue={sp.vendedor ?? ""} className="input" aria-label="Vendedor">
          <option value="">Todos los vendedores</option>
          {(people ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
        <button className="btn-dark">Filtrar</button>
      </form>
      <div className="card">
        {rows.length ? <SalesTable rows={rows} unit={c.kind === "raffle" ? "núm." : "part."} /> : <Empty>No hay ventas con estos filtros.</Empty>}
        <Pager page={page} pageSize={PAGE} total={count} href={qs} />
      </div>
    </>
  );
}
