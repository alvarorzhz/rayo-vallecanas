import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { euros, fecha, ranges } from "@/lib/format";
import { TicketHead, TicketNumber, TICKET_CARD } from "@/components/lottery/ticket";
import { Empty, PageHeader } from "@/components/ui";
import { SaleForm } from "@/components/lottery/sale-form";
import { emailConfigured, whatsappConfigured } from "@/lib/notify";
import { registerSale } from "../../actions";
import type { Campaign } from "@/lib/types";

export const metadata = { title: "Nueva venta" };

export default async function SellPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  const isAdmin = s.can("lottery_admin", "create");
  const supabase = await createClient();
  const { data: c } = await supabase.from("lottery_campaigns").select("*").eq("id", id).single<Campaign>();
  if (!c) notFound();

  const back = { href: `/loteria/${id}`, label: c.name };
  if (c.status !== "active") {
    return (
      <>
        <PageHeader title="Nueva venta" back={back} />
        <Empty>La campaña no está activa ahora mismo.</Empty>
      </>
    );
  }

  const { data: assigned } = await supabase.from("lottery_campaign_sellers").select("user_id").eq("campaign_id", id);
  const assignedIds = (assigned ?? []).map((a) => a.user_id as string);
  if (!isAdmin && !assignedIds.includes(s.user.id)) {
    return (
      <>
        <PageHeader title="Nueva venta" back={back} />
        <Empty>No estás asignado como vendedor en esta campaña. Pídeselo a un gestor.</Empty>
      </>
    );
  }

  // Disponibilidad
  let available = 0;
  let hint: string | undefined;
  let freeNumbers: number[] | undefined;
  if (c.numbering_mode === "booklet") {
    const { data: booklets } = await supabase.from("lottery_booklets").select("id").eq("campaign_id", id).eq("seller_id", s.user.id);
    const ids = (booklets ?? []).map((b) => b.id);
    if (ids.length) {
      const { count } = await supabase.from("lottery_shares").select("id", { count: "exact", head: true }).in("booklet_id", ids).eq("status", "available");
      available = count ?? 0;
    }
    if (!ids.length) hint = "No tienes talonario asignado.";
  } else {
    const { count } = await supabase.from("lottery_shares").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "available");
    available = count ?? 0;
    if (c.numbering_mode === "manual") {
      const { data } = await supabase.from("lottery_shares").select("share_number").eq("campaign_id", id).eq("status", "available").order("share_number").range(0, 999);
      const nums = (data ?? []).map((d) => d.share_number as number);
      freeNumbers = nums;
      hint = nums.length ? `Libres: ${ranges(nums)}${available > nums.length ? "…" : ""}` : "No quedan libres.";
    }
  }

  let sellers: { id: string; full_name: string }[] | undefined;
  if (isAdmin && assignedIds.length) {
    const { data } = await supabase.from("member_directory").select("id, full_name").in("id", [...new Set([...assignedIds, s.user.id])]).order("full_name");
    sellers = data ?? [];
  }

  return (
    <>
      <PageHeader title="Nueva venta" back={back} />
      <div className="mx-auto max-w-2xl">
        <div className={`${TICKET_CARD} mb-5 animate-fade-up`}>
          <TicketHead
            eyebrow={<>{c.kind === "raffle" ? "Rifa" : "Lotería"}{c.draw_date ? ` · ${fecha(c.draw_date)}` : ""}</>}
            title={c.name}
            sub={c.draw_type}
            aside={
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-widest text-dorado">{c.kind === "raffle" ? "Cada número" : "Cada una"}</div>
                <div className="sport text-2xl leading-tight font-black">{euros(c.price_cents)}</div>
              </div>
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              {c.kind !== "raffle" && <TicketNumber label="NÚMERO"><span className="tracking-[0.2em]">{c.lottery_number}</span></TicketNumber>}
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                {available} {c.kind === "raffle" ? (available === 1 ? "número libre" : "números libres") : (available === 1 ? "libre" : "libres")}
                {c.numbering_mode === "booklet" ? " en tu talonario" : ""}
              </span>
            </div>
          </TicketHead>
        </div>
        <SaleForm
          action={registerSale.bind(null, id)}
          priceCents={c.price_cents}
          available={available}
          mode={c.numbering_mode}
          availableHint={hint}
          sellers={sellers}
          currentUserId={s.user.id}
          whatsappApi={whatsappConfigured()}
          emailEnabled={emailConfigured()}
          raffle={c.kind === "raffle"}
          availableNumbers={freeNumbers}
        />
      </div>
    </>
  );
}
