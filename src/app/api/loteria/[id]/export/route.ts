import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchNumbers } from "@/lib/lottery/queries";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, ranges } from "@/lib/format";

export const runtime = "nodejs";

// Exportación Excel de una campaña: ventas, cobros y resumen por vendedor.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("has_perm", { p_module: "lottery_admin", p_action: "read" });
  if (!allowed) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { data: c } = await supabase.from("lottery_campaigns").select("*").eq("id", id).single();
  if (!c) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  const raffle = c.kind === "raffle";

  const fetchAll = async <T,>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>) => {
    const out: T[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await build(from, from + 999);
      out.push(...(data ?? []));
      if (!data || data.length < 1000) return out;
    }
  };

  const sales = await fetchAll((a, b) =>
    supabase.from("lottery_sales").select("*, buyer:buyers(full_name, phone, email)").eq("campaign_id", id).order("created_at").range(a, b),
  );
  const shares = await fetchAll((a, b) =>
    supabase.from("lottery_shares").select("share_number, sale_id").eq("campaign_id", id).not("sale_id", "is", null).range(a, b),
  );
  const saleIds = sales.map((s) => s.id);
  const payments = saleIds.length
    ? await fetchAll((a, b) => supabase.from("lottery_payments").select("*").in("sale_id", saleIds).order("paid_at").range(a, b))
    : [];
  const { data: people } = await supabase.from("member_directory").select("id, full_name");
  const name = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const sharesBySale = new Map<string, number[]>();
  for (const s of shares) sharesBySale.set(s.sale_id, [...(sharesBySale.get(s.sale_id) ?? []), s.share_number]);
  const refBySale = new Map(sales.map((s) => [s.id, s.reference]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Rayo Vallecañas";
  const header = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF080808" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };
  const eur = '#,##0.00 "€"';

  const ws = wb.addWorksheet("Ventas");
  ws.columns = [
    { header: "Referencia", key: "ref", width: 16 },
    { header: "Fecha", key: "date", width: 18, style: { numFmt: "dd/mm/yyyy hh:mm" } },
    { header: "Comprador", key: "buyer", width: 28 },
    { header: "Teléfono", key: "phone", width: 15 },
    { header: "Email", key: "email", width: 28 },
    { header: "Vendedor", key: "seller", width: 22 },
    { header: "Cantidad", key: "qty", width: 10 },
    { header: raffle ? "Números" : "Participaciones", key: "shares", width: 20 },
    { header: "Importe", key: "total", width: 12, style: { numFmt: eur } },
    { header: "Cobrado", key: "paid", width: 12, style: { numFmt: eur } },
    { header: "Pendiente", key: "pending", width: 12, style: { numFmt: eur } },
    { header: "Estado pago", key: "status", width: 14 },
    { header: "Anulación", key: "cancel", width: 30 },
  ];
  header(ws);
  for (const s of sales) {
    const b = s.buyer as { full_name: string; phone: string | null; email: string | null };
    ws.addRow({
      ref: s.reference,
      date: new Date(s.created_at),
      buyer: b?.full_name,
      phone: b?.phone,
      email: b?.email,
      seller: name.get(s.seller_id),
      qty: s.quantity,
      shares: ranges(sharesBySale.get(s.id) ?? []),
      total: s.total_cents / 100,
      paid: s.paid_cents / 100,
      pending: s.cancelled_at ? 0 : (s.total_cents - s.paid_cents) / 100,
      status: PAYMENT_STATUS_LABEL[s.payment_status],
      cancel: s.cancelled_at ? s.cancel_reason : "",
    });
  }

  const wp = wb.addWorksheet("Cobros");
  wp.columns = [
    { header: "Fecha", key: "date", width: 18, style: { numFmt: "dd/mm/yyyy hh:mm" } },
    { header: "Venta", key: "ref", width: 16 },
    { header: "Importe", key: "amount", width: 12, style: { numFmt: eur } },
    { header: "Forma de pago", key: "method", width: 16 },
    { header: "Registrado por", key: "by", width: 22 },
    { header: "Nota", key: "notes", width: 30 },
  ];
  header(wp);
  for (const p of payments)
    wp.addRow({ date: new Date(p.paid_at), ref: refBySale.get(p.sale_id), amount: p.amount_cents / 100, method: PAYMENT_METHOD_LABEL[p.method], by: name.get(p.registered_by), notes: p.notes });

  const wr = wb.addWorksheet("Vendedores");
  wr.columns = [
    { header: "Vendedor", key: "seller", width: 24 },
    { header: "Ventas", key: "n", width: 10 },
    { header: raffle ? "Números" : "Participaciones", key: "q", width: 16 },
    { header: "Vendido", key: "total", width: 12, style: { numFmt: eur } },
    { header: "Cobrado", key: "paid", width: 12, style: { numFmt: eur } },
    { header: "Pendiente", key: "pending", width: 12, style: { numFmt: eur } },
  ];
  header(wr);
  const { data: ranking } = await supabase.rpc("lottery_seller_ranking", { p_campaign_id: id });
  for (const r of ranking ?? [])
    wr.addRow({ seller: r.full_name, n: r.sales_count, q: r.shares, total: r.sold_cents / 100, paid: r.paid_cents / 100, pending: r.pending_cents / 100 });

  const wn = wb.addWorksheet("Números");
  wn.columns = [
    { header: "Número", key: "n", width: 10 },
    { header: "Estado", key: "status", width: 12 },
    { header: "Venta", key: "ref", width: 16 },
    { header: "Comprador", key: "buyer", width: 28 },
    { header: "Teléfono", key: "phone", width: 16 },
    { header: "Vendedor", key: "seller", width: 24 },
  ];
  header(wn);
  const STATUS: Record<string, string> = { available: "Libre", reserved: "Reservado", sold: "Vendido", voided: "Anulado" };
  for (const r of await fetchNumbers(supabase, id))
    wn.addRow({ n: r.share_number, status: STATUS[r.status], ref: r.reference, buyer: r.buyer_name, phone: r.buyer_phone, seller: r.seller_name });

  await supabase.rpc("lottery_log_export", { p_campaign_id: id });
  const buf = await wb.xlsx.writeBuffer();
  const slug = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  const file = `${raffle ? slug(c.name) : `loteria-${c.year}-${c.lottery_number}`}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "no-store",
    },
  });
}
