import Link from "next/link";
import { Plus, ShoppingBag, ShoppingCart } from "lucide-react";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { euros, fecha, NUMBERING_MODE_LABEL } from "@/lib/format";
import { CampaignBadge, Empty, PageHeader, Progress } from "@/components/ui";
import type { Campaign, Summary } from "@/lib/types";

export const metadata = { title: "Sorteos" };

export default async function LotteryPage({ searchParams }: { searchParams: Promise<{ archivadas?: string; eliminada?: string }> }) {
  const sp = await searchParams;
  const showArchived = sp.archivadas === "1";
  const s = await getSession();
  const isAdmin = s.can("lottery_admin");
  const supabase = await createClient();

  let query = supabase.from("lottery_campaigns").select("*").order("created_at", { ascending: false });
  if (!isAdmin) {
    const { data: mine } = await supabase.from("lottery_campaign_sellers").select("campaign_id").eq("user_id", s.user.id);
    query = query.in("id", (mine ?? []).map((m) => m.campaign_id)).neq("status", "draft");
  }
  query = showArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const [{ data: campaigns }, { count: archivedCount }] = await Promise.all([
    query.returns<Campaign[]>(),
    isAdmin
      ? supabase.from("lottery_campaigns").select("id", { count: "exact", head: true }).not("archived_at", "is", null)
      : Promise.resolve({ count: 0 }),
  ]);
  const summaries = await Promise.all(
    (campaigns ?? []).map(async (c) => (await supabase.rpc("lottery_campaign_summary", { p_campaign_id: c.id })).data as Summary),
  );

  return (
    <>
      <PageHeader
        title={showArchived ? "Campañas archivadas" : "Sorteos"}
        subtitle={isAdmin ? "Campañas, participaciones, vendedores y cobros" : "Campañas en las que eres vendedor"}
        actions={
          <>
            {s.can("lottery_sell", "create") && (
              <Link href="/mis-ventas" prefetch className="btn-dark">
                <ShoppingBag size={16} /> Mis ventas
              </Link>
            )}
            {s.can("lottery_admin", "create") && (
              <Link href="/loteria/nueva" className="btn-primary">
                <Plus size={16} /> Nueva campaña
              </Link>
            )}
          </>
        }
      />
      {sp.eliminada && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">Campaña eliminada definitivamente.</p>
      )}
      {isAdmin && (showArchived || (archivedCount ?? 0) > 0) && (
        <div className="mb-4 flex gap-1">
          <Link href="/loteria" className={`badge px-3 py-1.5 ${!showArchived ? "bg-negro text-white" : "bg-white ring-1 ring-black/10"}`}>En curso</Link>
          <Link href="/loteria?archivadas=1" className={`badge px-3 py-1.5 ${showArchived ? "bg-negro text-white" : "bg-white ring-1 ring-black/10"}`}>
            Archivadas ({archivedCount ?? 0})
          </Link>
        </div>
      )}
      {!campaigns?.length ? (
        showArchived ? <Empty>No hay campañas archivadas.</Empty> :
        <Empty>
          {isAdmin ? "Aún no hay campañas. Crea la primera para empezar a vender." : "No estás asignado a ninguna campaña activa."}
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((c, i) => {
            const sum = summaries[i];
            return (
              <div key={c.id} className="card flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/loteria/${c.id}`} className="sport block truncate text-2xl font-black hover:text-rojo">{c.name}</Link>
                    <div className="text-sm text-negro/60">
                      {c.draw_type} · {fecha(c.draw_date)}
                    </div>
                  </div>
                  <CampaignBadge status={c.status} />
                </div>
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-negro px-4 py-2 text-center">
                    {c.kind === "raffle" ? (
                      <>
                        <div className="text-[10px] tracking-widest text-dorado">RIFA</div>
                        <div className="font-mono text-2xl font-black text-white">1–{c.total_shares}</div>
                      </>
                    ) : (
                      <>
                        <div className="text-[10px] tracking-widest text-dorado">NÚMERO</div>
                        <div className="font-mono text-2xl font-black tracking-[0.2em] text-white">{c.lottery_number}</div>
                      </>
                    )}
                  </div>
                  <div className="flex-1 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-negro/60">Precio</span><b>{euros(c.price_cents)}</b></div>
                    <div className="flex justify-between"><span className="text-negro/60">Numeración</span><b>{NUMBERING_MODE_LABEL[c.numbering_mode]}</b></div>
                    {isAdmin && sum?.paid_cents !== undefined && (
                      <div className="flex justify-between"><span className="text-negro/60">Cobrado</span><b>{euros(sum.paid_cents)}</b></div>
                    )}
                  </div>
                </div>
                {sum && (
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-negro/60">
                      <span>{sum.sold} {c.kind === "raffle" ? "vendidos" : "vendidas"} de {sum.total}</span>
                      <span>{sum.available} disponibles</span>
                    </div>
                    <Progress value={sum.sold} total={sum.total} />
                  </div>
                )}
                <div className="mt-auto flex gap-2">
                  {c.status === "active" && (
                    <Link href={`/loteria/${c.id}/vender`} className="btn-primary flex-1">
                      <ShoppingCart size={16} /> Nueva venta
                    </Link>
                  )}
                  <Link href={`/loteria/${c.id}`} prefetch className="btn-ghost flex-1">Ver panel</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
