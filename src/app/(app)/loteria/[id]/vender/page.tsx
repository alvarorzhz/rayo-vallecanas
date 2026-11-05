import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ranges } from "@/lib/format";
import { Empty, PageHeader } from "@/components/ui";
import { SaleForm } from "@/components/lottery/sale-form";
import { whatsappConfigured } from "@/lib/notify";
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
        <Empty>No estás asignado como vendedor en esta campaña. Pídeselo a la directiva.</Empty>
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
      <PageHeader title="Nueva venta" subtitle={c.kind === "raffle" ? `Rifa · ${c.name}` : `Número ${c.lottery_number} · ${c.name}`} back={back} />
      <div className="mx-auto max-w-2xl">
        <SaleForm
          action={registerSale.bind(null, id)}
          priceCents={c.price_cents}
          available={available}
          mode={c.numbering_mode}
          availableHint={hint}
          sellers={sellers}
          currentUserId={s.user.id}
          whatsappApi={whatsappConfigured()}
          raffle={c.kind === "raffle"}
          availableNumbers={freeNumbers}
        />
      </div>
    </>
  );
}
