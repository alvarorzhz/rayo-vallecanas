import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SaleRow } from "@/components/lottery/sales-table";

/** Ventas con nombre del comprador y del vendedor (RLS limita lo que cada uno ve). */
export async function fetchSales(
  supabase: SupabaseClient,
  opts: { campaignId?: string; sellerId?: string; status?: string; q?: string; limit?: number; offset?: number },
) {
  let q = supabase
    .from("lottery_sales")
    .select("id, reference, quantity, total_cents, paid_cents, payment_status, created_at, seller_id, buyer:buyers!inner(full_name)", { count: "exact" })
    .order("created_at", { ascending: false });
  if (opts.campaignId) q = q.eq("campaign_id", opts.campaignId);
  if (opts.sellerId) q = q.eq("seller_id", opts.sellerId);
  if (opts.status) q = q.eq("payment_status", opts.status);
  if (opts.q) {
    const term = opts.q.replace(/[%,()]/g, " ").trim();
    // Con cifras se busca por referencia; si no, por nombre del comprador
    if (term) q = /\d/.test(term) ? q.ilike("reference", `%${term}%`) : q.ilike("buyer.full_name", `%${term}%`);
  }
  const from = opts.offset ?? 0;
  q = q.range(from, from + (opts.limit ?? 50) - 1);
  const { data, count } = await q;
  const rows = (data ?? []) as unknown as (SaleRow & { seller_id: string })[];

  const ids = [...new Set(rows.map((r) => r.seller_id))];
  if (ids.length) {
    const { data: people } = await supabase.from("member_directory").select("id, full_name").in("id", ids);
    const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
    rows.forEach((r) => (r.seller_name = names.get(r.seller_id) ?? "—"));
  }
  return { rows, count: count ?? 0 };
}
