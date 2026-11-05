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

export type NumberRow = {
  share_number: number;
  status: "available" | "reserved" | "sold" | "voided";
  sale_id: string | null;
  reference: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  seller_name: string | null;
};

/** Números de una campaña con comprador y vendedor (para rifas, sorteo y Excel). */
export async function fetchNumbers(
  supabase: SupabaseClient,
  campaignId: string,
  opts: { from?: number; to?: number; only?: number } = {},
): Promise<NumberRow[]> {
  const rows: NumberRow[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    let q = supabase
      .from("lottery_shares")
      .select("share_number, status, sale_id, sale:lottery_sales(reference, seller_id, buyer:buyers(full_name, phone))")
      .eq("campaign_id", campaignId)
      .order("share_number")
      .range(offset, offset + PAGE - 1);
    if (opts.only !== undefined) q = q.eq("share_number", opts.only);
    if (opts.from !== undefined) q = q.gte("share_number", opts.from);
    if (opts.to !== undefined) q = q.lte("share_number", opts.to);
    const { data, error } = await q;
    if (error) throw error;
    const page = (data ?? []) as unknown as {
      share_number: number;
      status: NumberRow["status"];
      sale_id: string | null;
      sale: { reference: string; seller_id: string; buyer: { full_name: string; phone: string | null } | null } | null;
    }[];
    for (const r of page)
      rows.push({
        share_number: r.share_number,
        status: r.status,
        sale_id: r.sale_id,
        reference: r.sale?.reference ?? null,
        buyer_name: r.sale?.buyer?.full_name ?? null,
        buyer_phone: r.sale?.buyer?.phone ?? null,
        seller_name: r.sale?.seller_id ?? null, // se sustituye por el nombre abajo
      });
    if (page.length < PAGE) break;
  }
  const ids = [...new Set(rows.map((r) => r.seller_name).filter(Boolean))] as string[];
  if (ids.length) {
    const { data: people } = await supabase.from("member_directory").select("id, full_name").in("id", ids);
    const names = new Map((people ?? []).map((p) => [p.id, p.full_name as string]));
    rows.forEach((r) => (r.seller_name = r.seller_name ? names.get(r.seller_name) ?? "—" : null));
  }
  return rows;
}
