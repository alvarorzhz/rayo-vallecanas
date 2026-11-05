import Link from "next/link";
import { ShoppingCart, Ticket, Wallet, CalendarDays, Shirt } from "lucide-react";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { euros, fecha } from "@/lib/format";
import { Empty, Progress, Stat } from "@/components/ui";
import { SalesTable } from "@/components/lottery/sales-table";
import { fetchSales } from "@/lib/lottery/queries";
import type { Campaign, Summary } from "@/lib/types";

type Rank = { seller_id: string; full_name: string; shares: number; sold_cents: number };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const s = await getSession();
  const supabase = await createClient();
  const isAdmin = s.can("lottery_admin");
  const canSell = s.can("lottery_sell", "create");

  // Campaña activa más reciente visible para el usuario
  let campaign: Campaign | null = null;
  if (isAdmin) {
    const { data } = await supabase.from("lottery_campaigns").select("*").in("status", ["active", "closed"]).is("archived_at", null).order("created_at", { ascending: false }).limit(1).returns<Campaign[]>();
    campaign = data?.[0] ?? null;
  } else if (canSell) {
    const { data } = await supabase
      .from("lottery_campaign_sellers")
      .select("campaign:lottery_campaigns!inner(*)")
      .eq("user_id", s.user.id)
      .eq("campaign.status", "active")
      .limit(1);
    campaign = (data?.[0]?.campaign as unknown as Campaign) ?? null;
  }

  let summary: Summary | null = null;
  let ranking: Rank[] = [];
  let latest: Awaited<ReturnType<typeof fetchSales>>["rows"] = [];
  let mine = { shares: 0, total: 0, paid: 0 };
  if (campaign) {
    const [sum, rk, sales, own] = await Promise.all([
      supabase.rpc("lottery_campaign_summary", { p_campaign_id: campaign.id }),
      isAdmin ? supabase.rpc("lottery_seller_ranking", { p_campaign_id: campaign.id }) : Promise.resolve({ data: [] }),
      fetchSales(supabase, { campaignId: campaign.id, sellerId: isAdmin ? undefined : s.user.id, limit: 5 }),
      supabase.from("lottery_sales").select("quantity, total_cents, paid_cents").eq("campaign_id", campaign.id).eq("seller_id", s.user.id).is("cancelled_at", null),
    ]);
    summary = sum.data as Summary;
    ranking = ((rk.data ?? []) as Rank[]).slice(0, 5);
    latest = sales.rows;
    for (const r of own.data ?? []) mine = { shares: mine.shares + r.quantity, total: mine.total + r.total_cents, paid: mine.paid + r.paid_cents };
  }

  const firstName = s.profile.full_name.split(" ")[0];

  return (
    <>
      {error === "permiso" && (
        <div className="mb-4 rounded-xl bg-rojo/10 p-3 text-sm font-medium text-rojo">No tienes permiso para acceder a esa sección.</div>
      )}

      <section className="franja relative mb-6 overflow-hidden rounded-3xl bg-negro p-6 text-white shadow-xl sm:p-8">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.10),transparent_55%)]" />
        <div className="relative flex items-center gap-4 sm:gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/escudo.png" alt="Escudo del Rayo Vallecañas" width={84} height={100} className="w-16 shrink-0 drop-shadow-2xl sm:w-20" />
          <div className="min-w-0">
            <p className="sport text-sm font-bold tracking-[0.15em] text-dorado">¡Hola, {firstName}! ⚡</p>
            <h1 className="sport text-4xl leading-[0.9] font-black sm:text-5xl">Rayo<br className="sm:hidden" /> Vallecañas</h1>
            <p className="mt-2 text-sm text-white/60">{fecha(new Date())}</p>
          </div>
        </div>
        {campaign && campaign.status === "active" && canSell && (
          <Link href={`/loteria/${campaign.id}/vender`} prefetch className="btn-primary relative mt-6 w-full py-3.5 text-lg sm:w-auto">
            <ShoppingCart size={20} /> {campaign.kind === "raffle" ? "Nueva venta de rifa" : "Nueva venta de lotería"}
          </Link>
        )}
      </section>

      {campaign && summary ? (
        <>
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="sport flex min-w-0 items-center gap-2 text-2xl font-black"><Ticket size={22} className="shrink-0 text-rojo" /> <span className="truncate">{campaign.name}</span></h2>
            <Link href={`/loteria/${campaign.id}`} prefetch className="shrink-0 text-sm font-bold text-rojo">Ver panel →</Link>
          </div>
          {isAdmin ? (
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Vendidas" value={`${summary.sold}/${summary.total}`} hint={`${summary.available} disponibles`} tone="dark" />
              <Stat label="Recaudado" value={euros(summary.paid_cents)} tone="red" />
              <Stat label="Pendiente de cobro" value={euros(summary.pending_cents)} hint={`${summary.pending_sales} ventas`} tone="gold" />
              <Stat label="Compradores" value={summary.buyers ?? 0} hint={`${summary.sales_count} ventas`} />
            </div>
          ) : (
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label={campaign.kind === "raffle" ? "Mis números" : "Mis participaciones"} value={mine.shares} tone="dark" />
              <Stat label="Vendido" value={euros(mine.total)} />
              <Stat label="Cobrado" value={euros(mine.paid)} tone="red" />
              <Stat label="Pendiente" value={euros(mine.total - mine.paid)} tone="gold" />
            </div>
          )}
          <div className="card mb-6">
            <div className="mb-1 flex justify-between text-xs text-negro/60">
              <span>{campaign.kind === "raffle" ? `Rifa · números 1–${campaign.total_shares}` : `Número ${campaign.lottery_number}`}</span>
              <span>{Math.round((summary.sold / Math.max(1, summary.total)) * 100)}% vendido</span>
            </div>
            <Progress value={summary.sold} total={summary.total} />
          </div>

          <div className={`mb-6 grid gap-6 ${isAdmin ? "lg:grid-cols-[1fr_20rem]" : ""}`}>
            <section className="card min-w-0">
              <h3 className="sport mb-3 text-xl font-black">{isAdmin ? "Últimas ventas" : "Mis últimas ventas"}</h3>
              {latest.length ? <SalesTable rows={latest} showSeller={isAdmin} unit={campaign.kind === "raffle" ? "núm." : "part."} /> : <Empty>Aún no hay ventas.</Empty>}
            </section>
            {isAdmin && (
              <section className="card min-w-0">
                <h3 className="sport mb-3 text-xl font-black">Ranking de vendedores</h3>
                {ranking.length ? (
                  <ol className="space-y-2">
                    {ranking.map((r, i) => (
                      <li key={r.seller_id} className="flex items-center gap-3 text-sm">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${i === 0 ? "bg-dorado" : "bg-gris"}`}>{i + 1}</span>
                        <span className="flex-1 truncate">{r.full_name}</span>
                        <b className="tabular-nums">{r.shares}</b>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <Empty>Sin vendedores.</Empty>
                )}
              </section>
            )}
          </div>
        </>
      ) : (
        <div className="mb-6">
          <Empty>
            {isAdmin ? (
              <>No hay ningún sorteo activo. <Link href="/loteria" className="font-semibold text-rojo">Ir a Sorteos</Link></>
            ) : (
              "No hay ninguna campaña de lotería activa en la que seas vendedor."
            )}
          </Empty>
        </div>
      )}

      <h2 className="sport mb-3 text-2xl font-black">Próximamente</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Wallet, t: "Finanzas", d: "Ingresos, gastos y saldo (fase 2)", show: isAdmin },
          { icon: Shirt, t: "Plantilla", d: "Fichas de jugadores (fase 3)", show: true },
          { icon: CalendarDays, t: "Partidos", d: "Calendario y convocatorias (fase 4)", show: true },
        ]
          .filter((x) => x.show)
          .map(({ icon: Icon, t, d }) => (
            <div key={t} className="flex items-center gap-3 rounded-2xl bg-white/60 p-4 ring-1 ring-black/5">
              <Icon size={22} className="text-negro/30" />
              <div>
                <div className="font-semibold text-negro/60">{t}</div>
                <div className="text-xs text-negro/40">{d}</div>
              </div>
            </div>
          ))}
      </div>
    </>
  );
}
