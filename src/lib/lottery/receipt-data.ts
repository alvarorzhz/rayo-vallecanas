import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReceiptData } from "@/lib/receipt";

/** Carga los datos del justificante con el cliente del usuario (RLS decide si puede verla). */
export async function loadReceipt(supabase: SupabaseClient, saleId: string) {
  const { data: sale, error } = await supabase
    .from("lottery_sales")
    .select(
      "id, reference, quantity, total_cents, paid_cents, created_at, cancelled_at, seller_id, preferred_channel, buyer:buyers(full_name, email, phone), campaign:lottery_campaigns(name, kind, lottery_number, draw_type, draw_date)",
    )
    .eq("id", saleId)
    .single();
  if (error || !sale) return null;

  const [{ data: shares }, { data: seller }] = await Promise.all([
    supabase.from("lottery_shares").select("share_number").eq("sale_id", saleId).order("share_number"),
    supabase.from("member_directory").select("full_name").eq("id", sale.seller_id).single(),
  ]);

  const buyer = sale.buyer as unknown as { full_name: string; email: string | null; phone: string | null };
  const campaign = sale.campaign as unknown as { name: string; kind: "lottery" | "raffle"; lottery_number: string | null; draw_type: string; draw_date: string | null };

  const data: ReceiptData = {
    reference: sale.reference,
    buyerName: buyer.full_name,
    kind: campaign.kind,
    lotteryNumber: campaign.lottery_number,
    drawType: campaign.draw_type,
    drawDate: campaign.draw_date,
    quantity: sale.quantity,
    shareNumbers: (shares ?? []).map((s) => s.share_number as number),
    totalCents: sale.total_cents,
    paidCents: sale.paid_cents,
    sellerName: seller?.full_name ?? "—",
    createdAt: sale.created_at,
    campaignName: campaign.name,
  };
  return { data, buyer, cancelled: Boolean(sale.cancelled_at), preferredChannel: sale.preferred_channel as "email" | "whatsapp" | null };
}
