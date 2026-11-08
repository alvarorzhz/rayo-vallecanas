import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { euros, fecha, fechaLarga, ranges } from "@/lib/format";
import { DRAW_MODE_LABEL, lastClose, publicRaffleUrl } from "@/lib/lottery/public";
import { loadPublicRaffle } from "@/app/rifa/[slug]/data";

export const runtime = "nodejs";

const ROJO = rgb(0.824, 0.051, 0.09);
const NEGRO = rgb(0.07, 0.07, 0.07);
const DORADO = rgb(0.835, 0.686, 0.196);
const GRIS = rgb(0.45, 0.45, 0.45);

const clean = (t: string) => t.replace(/[\u00a0\u202f]/g, " ").replace(/[^\x20-\x7e¡-ÿ€–—“”‘’…]/g, "").trim();

/** Acta pública del sorteo de la rifa (sin datos personales). */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await loadPublicRaffle(slug);
  if (!r || r.status === "active") return NextResponse.json({ error: "Acta no disponible" }, { status: 404 });

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Acta del sorteo · ${r.name}`);
  pdf.setAuthor("Rayo Vallecañas");
  const W = 595, H = 842; // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const crest = await pdf.embedPng(await readFile(path.join(process.cwd(), "public", "escudo.png")));

  let page = pdf.addPage([W, H]);
  let y = H;
  const M = 48;

  /** Escribe un párrafo con salto de línea automático; abre página nueva si no cabe. */
  const para = (text: string, f: PDFFont, size: number, color = NEGRO, gap = 4) => {
    const words = clean(text).split(" ");
    let line = "";
    const flush = () => {
      if (y < 60) { page = pdf.addPage([W, H]); y = H - 50; }
      page.drawText(line, { x: M, y, size, font: f, color });
      y -= size + gap;
      line = "";
    };
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > W - 2 * M && line) { flush(); line = w; } else line = next;
    }
    if (line) flush();
  };
  const heading = (t: string) => { y -= 10; para(t.toUpperCase(), bold, 11, ROJO, 6); };

  // Cabecera
  page.drawRectangle({ x: 0, y: H - 120, width: W, height: 120, color: NEGRO });
  page.drawRectangle({ x: 0, y: H - 126, width: W, height: 6, color: ROJO });
  page.drawImage(crest, { x: M, y: H - 102, width: 66, height: 78 });
  page.drawText("ACTA DEL SORTEO", { x: M + 86, y: H - 52, size: 11, font: bold, color: DORADO });
  page.drawText(clean(r.name), { x: M + 86, y: H - 76, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Rayo Vallecañas", { x: M + 86, y: H - 96, size: 10, font, color: rgb(0.8, 0.8, 0.8) });
  y = H - 160;

  heading("Datos de la rifa");
  if (r.prize) para(`Premio: ${r.prize}`, font, 10);
  para(`Fecha del sorteo: ${r.draw_date ? fechaLarga(r.draw_date) : "sin fecha"}`, font, 10);
  para(`Números: del 1 al ${r.total} · Precio: ${euros(r.price_cents)} por número`, font, 10);
  para(`Números vendidos: ${r.sold_numbers.length}${r.voided_numbers.length ? ` · anulados: ${r.voided_numbers.length}` : ""}`, font, 10);

  if (r.winning_number != null) {
    heading("Resultado");
    para(`Número ganador: ${r.winning_number}${r.sold_numbers.includes(r.winning_number) ? "" : " (no estaba vendido)"}`, bold, 14);
  }

  if (r.purpose || r.raised_cents != null) {
    heading("Destino de lo recaudado");
    if (r.purpose) para(r.purpose, font, 10);
    if (r.raised_cents != null) para(`Recaudado: ${euros(r.raised_cents)}`, bold, 10);
  }

  heading("Registro");
  for (const e of r.events) {
    const t =
      e.kind === "closed" ? `Ventas cerradas con ${e.sold_count} números vendidos.`
      : e.kind === "reopened" ? "Ventas reabiertas."
      : `Sorteo realizado: número ganador ${e.winning_number}.${e.draw_mode ? ` ${DRAW_MODE_LABEL[e.draw_mode]}.` : ""}`;
    para(`${fecha(e.at, true)} · ${t}${e.actor ? ` Registrado por ${e.actor}.` : ""}`, font, 10);
    if (e.fingerprint) para(`Huella: ${e.fingerprint}`, mono, 8, GRIS);
  }

  const close = lastClose(r.events);
  if (close?.sold_numbers) {
    heading("Lista cerrada de números vendidos");
    para(close.sold_numbers.length ? ranges(close.sold_numbers) : "Ninguno", mono, 9);
    y -= 4;
    para("La huella es el SHA-256 de estos números, de menor a mayor, separados por comas y sin espacios. Cualquiera puede recalcularla y comprobar que la lista no ha cambiado.", font, 9, GRIS);
  }

  y -= 10;
  para(`Página pública: ${publicRaffleUrl(slug)}`, font, 9, GRIS);
  para(`Documento generado el ${fecha(new Date(), true)}. No contiene datos personales de compradores ni vendedores.`, font, 9, GRIS);

  for (const p of pdf.getPages()) footer(p, W);

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="acta-${slug}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

function footer(page: PDFPage, W: number) {
  page.drawRectangle({ x: 0, y: 0, width: W, height: 8, color: ROJO });
  page.drawRectangle({ x: W / 2, y: 0, width: W / 2, height: 8, color: DORADO });
}
