import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { loadReceipt } from "@/lib/lottery/receipt-data";
import { headline, headlineLabel } from "@/lib/receipt";
import { euros, fecha, fechaLarga, ranges } from "@/lib/format";

export const runtime = "nodejs";

const ROJO = rgb(0.824, 0.051, 0.09);
const NEGRO = rgb(0.07, 0.07, 0.07);
const DORADO = rgb(0.835, 0.686, 0.196);
const GRIS = rgb(0.45, 0.45, 0.45);

/** Las fuentes estándar de PDF solo tienen caracteres latinos: se quitan emojis y espacios raros. */
const clean = (t: string) =>
  t.replace(/[  ]/g, " ").replace(/[^\x20-\x7e¡-ÿ€–—“”‘’…]/g, "").trim();

/**
 * Justificante en PDF. Sustituye a «Imprimir», que no funciona dentro de la app instalada
 * en el móvil. El navegador lo abre y desde ahí se puede guardar, compartir o imprimir.
 */
export async function GET(_: Request, { params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  const supabase = await createClient();
  const receipt = await loadReceipt(supabase, saleId); // RLS: solo quien puede ver la venta
  if (!receipt) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
  const d = receipt.data;

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Justificante ${d.reference}`);
  pdf.setAuthor("Rayo Vallecañas");
  const W = 420, H = 640; // tamaño cercano a A5
  const page = pdf.addPage([W, H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const crest = await pdf.embedPng(await readFile(path.join(process.cwd(), "public", "escudo.png")));

  const center = (text: string, y: number, f: PDFFont, size: number, color = NEGRO) => {
    const t = clean(text);
    page.drawText(t, { x: (W - f.widthOfTextAtSize(t, size)) / 2, y, size, font: f, color });
  };

  // Cabecera
  page.drawRectangle({ x: 0, y: H - 150, width: W, height: 150, color: NEGRO });
  page.drawRectangle({ x: 0, y: H - 156, width: W, height: 6, color: ROJO });
  page.drawImage(crest, { x: (W - 54) / 2, y: H - 80, width: 54, height: 64 });
  center("RAYO VALLECAÑAS", H - 104, bold, 18, rgb(1, 1, 1));
  center(d.kind === "raffle" ? "JUSTIFICANTE DE RIFA" : "JUSTIFICANTE DE LOTERÍA", H - 124, font, 9, DORADO);
  if (receipt.cancelled) center("VENTA ANULADA", H - 142, bold, 10, ROJO);

  let y = H - 190;
  center(`¡Gracias por colaborar con nuestro equipo, ${d.buyerName}!`, y, font, 11);

  // Número destacado
  y -= 110;
  page.drawRectangle({ x: 30, y, width: W - 60, height: 90, color: NEGRO });
  center(headlineLabel(d), y + 70, font, 8, DORADO);
  const big = clean(headline(d));
  let size = d.kind === "raffle" ? 30 : 40;
  while (size > 12 && bold.widthOfTextAtSize(big, size) > W - 80) size -= 2;
  center(big, y + 32, bold, size, rgb(1, 1, 1));
  center(d.drawDate ? `Sorteo: ${fechaLarga(d.drawDate)}` : d.drawType, y + 12, font, 9, rgb(0.8, 0.8, 0.8));

  // Detalle
  const rows: [string, string][] = [
    ["Referencia", d.reference],
    d.kind === "raffle"
      ? ["Números", String(d.quantity)]
      : ["Participaciones", `${d.quantity} (nº ${d.shareNumbers.length ? ranges(d.shareNumbers) : "—"})`],
    ["Vendedor", d.sellerName],
    ["Fecha", fecha(d.createdAt, true)],
    ["Pagado", euros(d.paidCents)],
    ["Pendiente", euros(d.totalCents - d.paidCents)],
  ];
  y -= 30;
  for (const [k, v] of rows) {
    row(page, font, bold, k, v, y, W);
    y -= 26;
  }
  page.drawLine({ start: { x: 30, y: y + 14 }, end: { x: W - 30, y: y + 14 }, thickness: 1, color: NEGRO });
  y -= 8;
  page.drawText("Importe", { x: 30, y, size: 12, font: bold, color: NEGRO });
  const total = clean(euros(d.totalCents));
  page.drawText(total, { x: W - 30 - bold.widthOfTextAtSize(total, 18), y: y - 2, size: 18, font: bold, color: NEGRO });

  y -= 50;
  center("¡Muchísimas gracias por apoyar al Rayo Vallecañas y mucha suerte!", y, bold, 10);
  center("Guarda este justificante de compra.", y - 16, font, 9, GRIS);
  page.drawRectangle({ x: 0, y: 0, width: W, height: 8, color: ROJO });
  page.drawRectangle({ x: W / 2, y: 0, width: W / 2, height: 8, color: DORADO });

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="justificante-${d.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function row(page: PDFPage, font: PDFFont, bold: PDFFont, k: string, v: string, y: number, W: number) {
  const val = clean(v);
  page.drawText(clean(k), { x: 30, y, size: 10, font, color: GRIS });
  let size = 10;
  while (size > 6 && bold.widthOfTextAtSize(val, size) > W - 170) size -= 0.5;
  page.drawText(val, { x: W - 30 - bold.widthOfTextAtSize(val, size), y, size, font: bold, color: NEGRO });
  page.drawLine({ start: { x: 30, y: y - 9 }, end: { x: W - 30, y: y - 9 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
}
