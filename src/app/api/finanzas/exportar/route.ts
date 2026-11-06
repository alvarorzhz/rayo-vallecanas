import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { euros, fecha, PAYMENT_METHOD_LABEL } from "@/lib/format";
import { KIND_LABEL, MOVEMENT_SELECT, type FinanceSummary, type MovementRow } from "@/lib/finance";
import { applyFilters, parseFilters, periodLabel, type FinanceFilterParams } from "@/lib/finance-filters";

export const runtime = "nodejs";
export const maxDuration = 60;

const ROJO = rgb(0.824, 0.051, 0.09);
const NEGRO = rgb(0.07, 0.07, 0.07);
const DORADO = rgb(0.835, 0.686, 0.196);
const GRIS = rgb(0.45, 0.45, 0.45);
const VERDE = rgb(0.08, 0.5, 0.24);
const clean = (t: string) => t.replace(/[  ]/g, " ").replace(/[^\x20-\x7e¡-ÿ€–—“”‘’…]/g, "").trim();

/**
 * Exporta los movimientos filtrados a Excel o a PDF (mismos filtros que la lista).
 * Lee con la sesión del usuario: la base de datos (RLS) solo deja hacerlo a quien puede ver Finanzas.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams) as FinanceFilterParams & { formato?: string };
  const format = sp.formato === "pdf" ? "pdf" : "xlsx";
  const f = parseFilters(sp);
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("has_perm", { p_module: "finances", p_action: "read" });
  if (!allowed) return NextResponse.json({ error: "No tienes permiso" }, { status: 403 });

  const rows: MovementRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await applyFilters(supabase.from("finance_movements").select(MOVEMENT_SELECT), f)
      .order("op_date", { ascending: true }).order("created_at", { ascending: true })
      .range(from, from + 999).returns<MovementRow[]>();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const { data: sum } = await supabase.rpc("finance_summary", {});
  const summary = sum as FinanceSummary;

  const valid = rows.filter((r) => !r.voided_at);
  const income = valid.filter((r) => r.kind === "income").reduce((a, r) => a + r.amount_cents, 0);
  const expense = valid.filter((r) => r.kind === "expense").reduce((a, r) => a + r.amount_cents, 0);
  const byCat = new Map<string, { kind: string; name: string; cents: number; n: number }>();
  for (const r of valid) {
    const k = `${r.kind}|${r.category?.name ?? "—"}`;
    const e = byCat.get(k) ?? { kind: r.kind, name: r.category?.name ?? "—", cents: 0, n: 0 };
    e.cents += r.amount_cents;
    e.n += 1;
    byCat.set(k, e);
  }
  const cats = [...byCat.values()].sort((a, b) => (a.kind === b.kind ? b.cents - a.cents : a.kind === "income" ? -1 : 1));
  const period = periodLabel(f);
  const extra = [f.kind ? `solo ${f.kind === "income" ? "ingresos" : "gastos"}` : "", f.cat ? `categoría: ${rows[0]?.category?.name ?? ""}` : "", f.q ? `búsqueda: «${f.q}»` : ""]
    .filter(Boolean).join(" · ");

  await supabase.rpc("log_export", { p_table: "finance_movements", p_record: format, p_data: { period, filters: f, rows: rows.length } });

  const slug = period.toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
  const name = `rayo-vallecanas-finanzas-${slug}`;

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Rayo Vallecañas";
    const money = '#,##0.00 "€";[Red]-#,##0.00 "€"';

    const rs = wb.addWorksheet("Resumen");
    rs.columns = [{ width: 34 }, { width: 18 }, { width: 12 }];
    rs.addRow(["Rayo Vallecañas · Finanzas"]).font = { bold: true, size: 14 };
    rs.addRow([period + (extra ? ` (${extra})` : "")]);
    rs.addRow([`Generado el ${fecha(new Date(), true)}`]).font = { color: { argb: "FF777777" } };
    rs.addRow([]);
    for (const [k, v] of [["Ingresos", income / 100], ["Gastos", -expense / 100], ["Resultado", (income - expense) / 100], ["Saldo actual (hoy)", summary.balance_cents / 100]] as const) {
      const r = rs.addRow([k, v]);
      r.getCell(2).numFmt = money;
      r.font = { bold: k === "Resultado" || k === "Saldo actual (hoy)" };
    }
    rs.addRow([]);
    rs.addRow(["Categoría", "Importe", "Movimientos"]).font = { bold: true };
    for (const c of cats) {
      const r = rs.addRow([`${KIND_LABEL[c.kind as "income"]} · ${c.name}`, (c.kind === "income" ? 1 : -1) * c.cents / 100, c.n]);
      r.getCell(2).numFmt = money;
    }

    const ws = wb.addWorksheet("Movimientos");
    ws.columns = [
      { header: "Fecha", key: "date", width: 12, style: { numFmt: "dd/mm/yyyy" } },
      { header: "Temporada", key: "season", width: 11 },
      { header: "Tipo", key: "kind", width: 9 },
      { header: "Concepto", key: "concept", width: 40 },
      { header: "Categoría", key: "cat", width: 22 },
      { header: "Importe", key: "amount", width: 13, style: { numFmt: money } },
      { header: "Método", key: "method", width: 14 },
      { header: "Persona / proveedor", key: "who", width: 24 },
      { header: "Observaciones", key: "notes", width: 36 },
      { header: "Justificante", key: "doc", width: 12 },
      { header: "Apuntado por", key: "author", width: 20 },
      { header: "Estado", key: "state", width: 30 },
    ];
    for (const r of rows) {
      ws.addRow({
        date: new Date(`${r.op_date}T12:00:00Z`),
        season: r.season,
        kind: KIND_LABEL[r.kind],
        concept: r.concept,
        cat: r.category?.name ?? "",
        amount: (r.kind === "income" ? 1 : -1) * r.amount_cents / 100,
        method: PAYMENT_METHOD_LABEL[r.method] ?? r.method,
        who: r.counterparty ?? "",
        notes: r.notes ?? "",
        doc: r.attachment_path ? "Sí" : "",
        author: r.author?.full_name ?? "",
        state: r.voided_at ? `Anulado: ${r.void_reason ?? ""}` : "",
      });
    }
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: "A1", to: "L1" };

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // ------------------------------------------------------------ PDF (A4 vertical)
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Finanzas · ${period}`);
  pdf.setAuthor("Rayo Vallecañas");
  const W = 595, H = 842, M = 40;
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const crest = await pdf.embedPng(await readFile(path.join(process.cwd(), "public", "escudo.png")));

  let page = pdf.addPage([W, H]);
  const text = (p: PDFPage, t: string, x: number, y: number, size: number, f: PDFFont = font, color = NEGRO) =>
    p.drawText(clean(t), { x, y, size, font: f, color });
  const right = (p: PDFPage, t: string, x: number, y: number, size: number, f: PDFFont = font, color = NEGRO) => {
    const s = clean(t);
    p.drawText(s, { x: x - f.widthOfTextAtSize(s, size), y, size, font: f, color });
  };
  const fit = (t: string, max: number, size: number, f: PDFFont = font) => {
    let s = clean(t);
    if (f.widthOfTextAtSize(s, size) <= max) return s;
    while (s.length > 1 && f.widthOfTextAtSize(s + "…", size) > max) s = s.slice(0, -1);
    return s + "…";
  };

  // Cabecera
  page.drawRectangle({ x: 0, y: H - 110, width: W, height: 110, color: NEGRO });
  page.drawRectangle({ x: 0, y: H - 115, width: W, height: 5, color: ROJO });
  page.drawImage(crest, { x: M, y: H - 95, width: 54, height: 64 });
  text(page, "RAYO VALLECAÑAS", M + 70, H - 52, 20, bold, rgb(1, 1, 1));
  text(page, "INFORME DE FINANZAS", M + 70, H - 70, 10, font, DORADO);
  text(page, period + (extra ? ` · ${extra}` : ""), M + 70, H - 88, 9, font, rgb(0.85, 0.85, 0.85));
  right(page, `Generado el ${fecha(new Date(), true)}`, W - M, H - 52, 8, font, rgb(0.7, 0.7, 0.7));

  // Resumen
  let y = H - 175;
  const boxes: [string, number, typeof NEGRO][] = [
    ["INGRESOS", income, VERDE], ["GASTOS", expense, ROJO], ["RESULTADO", income - expense, NEGRO], ["SALDO ACTUAL", summary.balance_cents, NEGRO],
  ];
  const bw = (W - 2 * M - 3 * 10) / 4;
  boxes.forEach(([label, cents, color], i) => {
    const x = M + i * (bw + 10);
    page.drawRectangle({ x, y, width: bw, height: 48, color: rgb(0.96, 0.96, 0.96) });
    page.drawRectangle({ x, y, width: 3, height: 48, color: i === 3 ? DORADO : color });
    text(page, label, x + 10, y + 32, 7, bold, GRIS);
    text(page, euros(cents), x + 10, y + 12, 14, bold, color);
  });

  // Por categoría
  y -= 30;
  text(page, "POR CATEGORÍA", M, y, 10, bold);
  y -= 16;
  for (const c of cats) {
    if (y < 80) break;
    text(page, `${KIND_LABEL[c.kind as "income"]} · ${c.name}`, M, y, 9);
    text(page, `${c.n} mov.`, W - M - 140, y, 8, font, GRIS);
    right(page, `${c.kind === "income" ? "+" : "-"}${euros(c.cents)}`, W - M, y, 9, bold, c.kind === "income" ? VERDE : ROJO);
    y -= 14;
  }
  if (!cats.length) { text(page, "Sin movimientos.", M, y, 9, font, GRIS); y -= 14; }

  // Movimientos
  const cols = { date: M, concept: M + 58, cat: M + 270, who: M + 375, amount: W - M };
  const header = (p: PDFPage, yy: number) => {
    p.drawRectangle({ x: M - 4, y: yy - 4, width: W - 2 * M + 8, height: 16, color: NEGRO });
    for (const [k, label] of [["date", "FECHA"], ["concept", "CONCEPTO"], ["cat", "CATEGORÍA"], ["who", "PERSONA / PROVEEDOR"]] as const)
      text(p, label, cols[k], yy + 1, 7, bold, rgb(1, 1, 1));
    right(p, "IMPORTE", cols.amount, yy + 1, 7, bold, rgb(1, 1, 1));
  };
  y -= 20;
  text(page, `MOVIMIENTOS (${rows.length})`, M, y, 10, bold);
  y -= 22;
  header(page, y);
  y -= 16;
  let n = 1;
  const footer = (p: PDFPage) => {
    text(p, "Rayo Vallecañas · Finanzas", M, 24, 7, font, GRIS);
    right(p, `Página ${n}`, W - M, 24, 7, font, GRIS);
  };
  for (const r of rows) {
    if (y < 50) {
      footer(page);
      page = pdf.addPage([W, H]);
      n += 1;
      y = H - M - 10;
      header(page, y);
      y -= 16;
    }
    const color = r.voided_at ? GRIS : NEGRO;
    text(page, fecha(r.op_date), cols.date, y, 8, font, GRIS);
    text(page, fit((r.voided_at ? "[ANULADO] " : "") + r.concept, 205, 8), cols.concept, y, 8, font, color);
    text(page, fit(r.category?.name ?? "", 100, 8), cols.cat, y, 8, font, color);
    text(page, fit(r.counterparty ?? "", 95, 8), cols.who, y, 8, font, GRIS);
    right(page, `${r.kind === "income" ? "+" : "-"}${euros(r.amount_cents)}`, cols.amount, y, 8, bold, r.voided_at ? GRIS : r.kind === "income" ? VERDE : ROJO);
    page.drawLine({ start: { x: M - 4, y: y - 4 }, end: { x: W - M + 4, y: y - 4 }, thickness: 0.3, color: rgb(0.88, 0.88, 0.88) });
    y -= 14;
  }
  footer(page);

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
