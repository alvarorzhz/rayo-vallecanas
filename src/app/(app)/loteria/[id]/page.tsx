import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, Download, Pencil, ShoppingCart, Users, Grid3x3, List, Trophy, ShieldAlert, Wallet } from "lucide-react";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { euros, fecha, NUMBERING_MODE_LABEL } from "@/lib/format";
import { CampaignBadge, Empty, PageHeader, Progress, Stat } from "@/components/ui";
import { SalesTable } from "@/components/lottery/sales-table";
import { fetchNumbers, fetchSales, type NumberRow } from "@/lib/lottery/queries";
import { DeleteCampaignForm, RaffleDrawForm } from "@/components/lottery/client-forms";
import { ImportCampaignButton } from "@/components/finance/client-forms";
import { importCampaign } from "@/app/(app)/finanzas/actions";
import { archiveCampaign, deleteCampaign, drawRaffle, setCampaignStatus, setWinningPrize } from "../actions";
import type { Campaign, Summary } from "@/lib/types";

type Rank = { seller_id: string; full_name: string; sales_count: number; shares: number; sold_cents: number; paid_cents: number; pending_cents: number };

const NEXT_STATUS: Record<string, { to: string; label: string; cls: string }[]> = {
  draft: [{ to: "active", label: "Activar ventas", cls: "btn-primary" }],
  active: [{ to: "closed", label: "Cerrar ventas", cls: "btn-dark" }],
  closed: [{ to: "active", label: "Reabrir ventas", cls: "btn-ghost" }],
  drawn: [],
};

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  const isAdmin = s.can("lottery_admin");
  const supabase = await createClient();

  const { data: c } = await supabase.from("lottery_campaigns").select("*").eq("id", id).single<Campaign>();
  if (!c) notFound();
  const { data: sum } = await supabase.rpc("lottery_campaign_summary", { p_campaign_id: id });
  const summary = sum as Summary;

  const [{ rows: latest }, ranking] = await Promise.all([
    fetchSales(supabase, { campaignId: id, sellerId: isAdmin ? undefined : s.user.id, limit: 8 }),
    isAdmin ? supabase.rpc("lottery_seller_ranking", { p_campaign_id: id }).then((r) => (r.data ?? []) as Rank[]) : Promise.resolve([] as Rank[]),
  ]);

  const finance = isAdmin && s.can("finances")
    ? ((await supabase.rpc("finance_campaign_status", { p_campaign_id: id })).data as { paid_cents: number; transferred_cents: number; last_at: string | null } | null)
    : null;

  const raffle = c.kind === "raffle";
  const toSell = Math.max(0, summary.total - summary.sold - summary.voided);
  const unit = raffle ? "número" : "participación";
  const units = raffle ? "números" : "participaciones";
  let winner: NumberRow | undefined;
  if (raffle && c.winning_number && isAdmin) {
    [winner] = await fetchNumbers(supabase, id, { only: c.winning_number });
  }

  // Totales propios (vendedor)
  let mine = { count: 0, shares: 0, total: 0, paid: 0 };
  if (!isAdmin) {
    const { data } = await supabase
      .from("lottery_sales")
      .select("quantity, total_cents, paid_cents")
      .eq("campaign_id", id)
      .eq("seller_id", s.user.id)
      .is("cancelled_at", null);
    for (const r of data ?? []) {
      mine = { count: mine.count + 1, shares: mine.shares + r.quantity, total: mine.total + r.total_cents, paid: mine.paid + r.paid_cents };
    }
  }

  return (
    <>
      <PageHeader
        title={c.name}
        back={c.archived_at ? { href: "/loteria?archivadas=1", label: "Archivadas" } : { href: "/loteria", label: "Sorteos" }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <CampaignBadge status={c.status} />
            {c.archived_at && <span className="badge bg-negro/10 text-negro/70">Archivada</span>}
            {c.draw_type} · {fecha(c.draw_date)} · {NUMBERING_MODE_LABEL[c.numbering_mode]}
          </span>
        }
        actions={
          <>
            {c.status === "active" && (
              <Link href={`/loteria/${id}/vender`} className="btn-primary">
                <ShoppingCart size={16} /> Nueva venta
              </Link>
            )}
            {isAdmin && (
              <a href={`/api/loteria/${id}/export`} className="btn-ghost">
                <Download size={16} /> Excel
              </a>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[auto_1fr]">
        <div className="franja flex items-center gap-5 overflow-hidden rounded-2xl bg-negro p-5 text-white shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/escudo.png" alt="" width={56} height={66} />
          <div>
            {raffle ? (
              <>
                <div className="text-xs tracking-[0.3em] text-dorado">RIFA</div>
                <div className="font-mono text-3xl font-black">1 – {c.total_shares}</div>
              </>
            ) : (
              <>
                <div className="text-xs tracking-[0.3em] text-dorado">NÚMERO</div>
                <div className="font-mono text-4xl font-black tracking-[0.25em]">{c.lottery_number}</div>
              </>
            )}
            <div className="mt-1 text-xs text-white/60">
              {euros(c.price_cents)} / {unit}
              {c.played_cents > 0 && ` · juega ${euros(c.played_cents)}`}
              {c.donation_cents > 0 && ` · donativo ${euros(c.donation_cents)}`}
            </div>
          </div>
        </div>
        <div className="card flex flex-col justify-center gap-2">
          <div className="flex justify-between text-sm">
            <span><b>{summary.sold}</b> {raffle ? "vendidos" : "vendidas"} de {summary.total}</span>
            <span className="text-negro/60">
              {summary.available} disponibles{summary.reserved ? ` · ${summary.reserved} ${raffle ? "reservados" : "reservadas"}` : ""}
              {summary.voided ? ` · ${summary.voided} ${raffle ? "anulados" : "anuladas"}` : ""}
            </span>
          </div>
          <Progress value={summary.sold} total={summary.total} />
        </div>
      </div>

      {isAdmin ? (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <Stat label={raffle ? "Vendidos" : "Vendidas"} value={summary.sold} tone="dark"
              hint={`${euros(summary.sold_cents ?? 0)} · ${summary.sales_count ?? 0} ${summary.sales_count === 1 ? "venta" : "ventas"}`} />
            <Stat label="Pendiente de vender" value={toSell} tone="red" hint={`${euros(toSell * c.price_cents)} por vender`} />
          </div>
          <PaidLine paid={summary.paid_cents ?? 0} pending={summary.pending_cents ?? 0} pendingSales={summary.pending_sales} />
        </>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <Stat label="Mis ventas" value={mine.shares} hint={`${units} · ${mine.count} ${mine.count === 1 ? "venta" : "ventas"}`} tone="dark" />
            <Stat label="Vendido" value={euros(mine.total)} tone="red" />
          </div>
          <PaidLine paid={mine.paid} pending={mine.total - mine.paid} />
        </>
      )}

      {isAdmin && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link href={`/loteria/${id}/ventas`} className="btn-ghost"><List size={16} /> Todas las ventas</Link>
          <Link href={`/loteria/${id}/participaciones`} className="btn-ghost"><Grid3x3 size={16} /> {raffle ? "Números" : "Participaciones"}</Link>
          <Link href={`/loteria/${id}/vendedores`} className="btn-ghost"><Users size={16} /> Vendedores{c.numbering_mode === "booklet" ? " y talonarios" : ""}</Link>
          {s.can("lottery_admin", "update") && (
            <>
              <Link href={`/loteria/${id}/editar`} className="btn-ghost"><Pencil size={16} /> Editar</Link>
              {!c.archived_at && NEXT_STATUS[c.status].map((n) => (
                <form key={n.to} action={setCampaignStatus.bind(null, id, n.to)}>
                  <button className={n.cls}>{n.label}</button>
                </form>
              ))}
            </>
          )}
        </div>
      )}

      {finance && (
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="mb-1 flex items-center gap-2 font-bold"><Wallet size={18} className="text-rojo" /> Finanzas</h2>
            <p className="text-sm text-negro/60">
              Cobrado: <b>{euros(finance.paid_cents)}</b> · Ya en Finanzas: <b>{euros(finance.transferred_cents)}</b>
              {finance.last_at && <> · último paso el {fecha(finance.last_at)}</>}
            </p>
          </div>
          {finance.paid_cents !== finance.transferred_cents && s.can("finances", "create") ? (
            <ImportCampaignButton action={importCampaign.bind(null, id)}
              label={finance.paid_cents > finance.transferred_cents
                ? `Pasar ${euros(finance.paid_cents - finance.transferred_cents)} a Finanzas`
                : `Apuntar devolución de ${euros(finance.transferred_cents - finance.paid_cents)}`} />
          ) : finance.paid_cents > 0 ? (
            <span className="badge bg-green-100 text-green-800">Todo pasado a Finanzas</span>
          ) : null}
        </div>
      )}

      {isAdmin && c.status !== "draft" && s.can("lottery_admin", "update") && (
        <div className="card mb-6">
          <h2 className="mb-2 flex items-center gap-2 font-bold"><Trophy size={18} className="text-dorado" /> Sorteo</h2>
          {raffle ? (
            c.winning_number ? (
              <div className="flex flex-wrap items-center gap-4">
                <div className="rounded-xl bg-dorado px-4 py-2 text-center text-negro">
                  <div className="text-[10px] font-bold tracking-[0.3em]">GANADOR</div>
                  <div className="font-mono text-3xl font-black">{c.winning_number}</div>
                </div>
                {winner?.sale_id ? (
                  <div className="text-sm">
                    <div>Comprador: <b>{winner.buyer_name}</b>{winner.buyer_phone ? ` · ${winner.buyer_phone}` : ""}</div>
                    <div>Vendido por: <b>{winner.seller_name}</b></div>
                    <Link href={`/loteria/venta/${winner.sale_id}`} className="font-semibold text-rojo">Ver venta {winner.reference}</Link>
                  </div>
                ) : (
                  <p className="text-sm">Ese número no se vendió.</p>
                )}
              </div>
            ) : (
              <RaffleDrawForm action={drawRaffle.bind(null, id)} total={c.total_shares} />
            )
          ) : c.status === "drawn" ? (
            <p className="text-sm">
              Premio por participación: <b>{euros(c.winning_prize_cents)}</b>
              {c.winning_prize_cents ? ` · Total a repartir: ${euros((c.winning_prize_cents ?? 0) * summary.sold)}` : " · No ha resultado premiado."}
            </p>
          ) : (
            <form action={setWinningPrize.bind(null, id)} className="flex flex-wrap items-end gap-2">
              <div>
                <label className="label" htmlFor="prize">Premio por participación tras el sorteo (€)</label>
                <input id="prize" name="prize" inputMode="decimal" className="input" placeholder="0,00" />
              </div>
              <button className="btn-dark">Registrar resultado</button>
            </form>
          )}
        </div>
      )}

      <div className={`grid gap-6 ${isAdmin ? "lg:grid-cols-[1fr_22rem]" : ""}`}>
        <section className="card min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">{isAdmin ? "Últimas operaciones" : "Mis últimas ventas"}</h2>
            <Link href={isAdmin ? `/loteria/${id}/ventas` : "/mis-ventas"} className="text-sm font-semibold text-rojo">Ver todas</Link>
          </div>
          {latest.length ? <SalesTable rows={latest} showSeller={isAdmin} unit={raffle ? "núm." : "part."} /> : <Empty>Aún no hay ventas.</Empty>}
        </section>
        {isAdmin && (
          <section className="card min-w-0">
            <h2 className="mb-3 font-bold">Ranking de vendedores</h2>
            {ranking.length ? (
              <ol className="space-y-3">
                {ranking.map((r, i) => (
                  <li key={r.seller_id} className="flex items-center gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${i === 0 ? "bg-dorado text-negro" : i < 3 ? "bg-negro text-white" : "bg-gris"}`}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{r.full_name}</div>
                      <div className="text-xs text-negro/65">{r.shares} {raffle ? "núm." : "part."} · pendiente {euros(r.pending_cents)}</div>
                    </div>
                    <div className="text-sm font-bold tabular-nums">{euros(r.sold_cents)}</div>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty>Asigna vendedores a la campaña.</Empty>
            )}
          </section>
        )}
      </div>

      {s.profile.role === "superadmin" && (
        <section className="card mt-6 space-y-4 ring-1 ring-rojo/20">
          <div>
            <h2 className="flex items-center gap-2 font-bold"><ShieldAlert size={18} className="text-rojo" /> Archivar o eliminar</h2>
            <p className="text-sm text-negro/60">
              Solo lo ven los superadministradores. <b>Archivar</b> quita la campaña de la lista pero conserva todos los datos y se puede recuperar.
              <b> Eliminar</b> la borra para siempre.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <form action={archiveCampaign.bind(null, id, !c.archived_at)}>
              <button className="btn-dark">
                {c.archived_at ? <><ArchiveRestore size={16} /> Recuperar de archivadas</> : <><Archive size={16} /> Archivar campaña</>}
              </button>
            </form>
            <DeleteCampaignForm action={deleteCampaign.bind(null, id)} name={c.name} sales={summary.sales_count ?? 0} />
          </div>
          {!c.archived_at && c.status === "active" && (
            <p className="text-xs text-negro/65">Al archivar, las ventas se cierran automáticamente.</p>
          )}
        </section>
      )}
    </>
  );
}

/** Cobrado y pendiente de cobro: dato secundario (casi todo se paga al momento). */
function PaidLine({ paid, pending, pendingSales }: { paid: number; pending: number; pendingSales?: number }) {
  return (
    <p className="mb-6 flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-white px-4 py-2 text-sm text-negro/60 ring-1 ring-black/5">
      <span>Cobrado: <b className="text-negro">{euros(paid)}</b></span>
      <span>
        Pendiente de cobro: <b className={pending > 0 ? "text-rojo" : "text-negro"}>{euros(pending)}</b>
        {pendingSales ? ` (${pendingSales} ${pendingSales === 1 ? "venta" : "ventas"})` : ""}
      </span>
    </p>
  );
}
