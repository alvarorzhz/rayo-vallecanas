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
          <Link href="/loteria" className={`badge px-3 py-1.5 ${!showArchived ? "tab-on bg-negro text-white" : "bg-white ring-1 ring-black/10"}`}>En curso</Link>
          <Link href="/loteria?archivadas=1" className={`badge px-3 py-1.5 ${showArchived ? "tab-on bg-negro text-white" : "bg-white ring-1 ring-black/10"}`}>
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
              <div key={c.id} className="reveal lift flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_1px_rgba(0,0,0,0.03),0_10px_30px_-14px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06]">
                {/* Matriz del boleto: nombre, sorteo y número en negro con la franja */}
                <div className="relative overflow-hidden bg-negro p-4 text-white sm:p-5">
                  <div aria-hidden className="franja pointer-events-none absolute inset-0 opacity-80" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-dorado">{c.kind === "raffle" ? "Rifa" : "Lotería"} · {fecha(c.draw_date)}</div>
                      <Link href={`/loteria/${c.id}`} className="sport mt-0.5 block truncate text-2xl leading-tight font-black hover:text-dorado">{c.name}</Link>
                      <div className="truncate text-xs text-white/60">{c.draw_type}</div>
                    </div>
                    <span className="shrink-0 rounded-md bg-white"><CampaignBadge status={c.status} /></span>
                  </div>
                  <div className="relative mt-3 inline-flex items-baseline gap-2 rounded-lg border border-dashed border-dorado/60 bg-black/50 px-3 py-1.5">
                    <span className="text-[10px] font-bold tracking-widest text-dorado">{c.kind === "raffle" ? "NÚMEROS" : "NÚMERO"}</span>
                    <span className={`font-mono text-2xl leading-none font-black ${c.kind === "raffle" ? "" : "tracking-[0.2em]"}`}>
                      {c.kind === "raffle" ? `1–${c.total_shares}` : c.lottery_number}
                    </span>
                  </div>
                </div>
                {/* Línea de corte del boleto */}
                <div aria-hidden className="relative h-0 border-t-2 border-dashed border-black/15">
                  <span className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full bg-gris ring-1 ring-inset ring-black/[0.06]" />
                  <span className="absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full bg-gris ring-1 ring-inset ring-black/[0.06]" />
                </div>
                <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Precio", euros(c.price_cents)],
                    ["Numeración", NUMBERING_MODE_LABEL[c.numbering_mode]],
                    ...(isAdmin && sum?.paid_cents !== undefined ? [["Cobrado", euros(sum.paid_cents)]] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-gris px-2 py-2">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-negro/55">{k}</dt>
                      <dd className="sport truncate text-lg leading-tight font-black">{v}</dd>
                    </div>
                  ))}
                </dl>
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
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
