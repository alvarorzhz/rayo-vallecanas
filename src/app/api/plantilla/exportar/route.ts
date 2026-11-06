import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { fecha } from "@/lib/format";
import { fetchRoster } from "@/lib/squad-queries";
import {
  ARMBAND_LABEL, FOOT_LABEL, LINES, POSITION_LABEL, STATUS_LABEL, ageOf, fullName, lineOf, seasonFromSlug, shirtName, sumStats,
  type PlayerPrivate,
} from "@/lib/squad";

export const runtime = "nodejs";
export const maxDuration = 60;

const ROJO = rgb(0.824, 0.051, 0.09);
const NEGRO = rgb(0.07, 0.07, 0.07);
const DORADO = rgb(0.835, 0.686, 0.196);
const GRIS = rgb(0.45, 0.45, 0.45);
const clean = (t: string) => t.replace(/[  ]/g, " ").replace(/[^\x20-\x7e¡-ÿ€–—“”‘’…]/g, "").trim();

/**
 * Solo para gestores (quien puede editar la plantilla).
 * Exporta la plantilla de una temporada a Excel o PDF: dorsales, posiciones, estado y estadísticas.
 * Con ?datos=1 (solo Excel y solo con permiso de datos personales) añade contacto y nacimiento.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get("formato") === "pdf" ? "pdf" : "xlsx";
  const season = seasonFromSlug(url.searchParams.get("temporada")) ?? seasonOf();
  const supabase = await createClient();
  const [{ data: canRead }, { data: canPrivate }] = await Promise.all([
    supabase.rpc("has_perm", { p_module: "squad", p_action: "update" }),
    supabase.rpc("has_perm", { p_module: "squad_private", p_action: "read" }),
  ]);
  if (!canRead) return NextResponse.json({ error: "No tienes permiso" }, { status: 403 });
  const withPrivate = format === "xlsx" && url.searchParams.get("datos") === "1" && Boolean(canPrivate);

  const roster = (await fetchRoster(supabase, season)).filter((r) => r.status !== "left");
  const priv = new Map<string, PlayerPrivate>();
  if (withPrivate && roster.length) {
    const { data } = await supabase.from("player_private").select("*").in("player_id", roster.map((r) => r.player_id)).returns<PlayerPrivate[]>();
    for (const p of data ?? []) priv.set(p.player_id, p);
  }
  await supabase.rpc("log_export", { p_table: "squad_members", p_record: format, p_data: { season, rows: roster.length, personal: withPrivate } });
  const name = `rayo-vallecanas-plantilla-${season.replace("/", "-")}${withPrivate ? "-datos" : ""}`;
  const total = sumStats(roster);

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Rayo Vallecañas";
    const ws = wb.addWorksheet(`Plantilla ${season.replace("/", "-")}`);
    ws.columns = [
      { header: "Dorsal", key: "number", width: 8 },
      { header: "Nombre en la camiseta", key: "shirt", width: 20 },
      { header: "Nombre completo", key: "name", width: 28 },
      { header: "Posición", key: "pos", width: 8 },
      { header: "Posición (nombre)", key: "posname", width: 20 },
      { header: "Línea", key: "line", width: 14 },
      { header: "Estado", key: "status", width: 14 },
      { header: "Brazalete", key: "armband", width: 16 },
      { header: "Pierna", key: "foot", width: 12 },
      { header: "Altura (cm)", key: "height", width: 11 },
      { header: "PJ", key: "apps", width: 6 },
      { header: "Titular", key: "starts", width: 8 },
      { header: "Goles", key: "goals", width: 7 },
      { header: "Asist.", key: "assists", width: 7 },
      { header: "MVP", key: "mvps", width: 6 },
      { header: "Amarillas", key: "yellows", width: 9 },
      { header: "Rojas", key: "reds", width: 7 },
      { header: "Encajados", key: "conceded", width: 10 },
      { header: "Port. a cero", key: "clean", width: 11 },
      ...(withPrivate
        ? [
            { header: "Nacimiento", key: "birth", width: 12, style: { numFmt: "dd/mm/yyyy" } },
            { header: "Edad", key: "age", width: 6 },
            { header: "Teléfono", key: "phone", width: 14 },
            { header: "Email", key: "email", width: 28 },
            { header: "Emergencia", key: "emergency", width: 30 },
          ]
        : []),
    ];
    for (const r of roster) {
      const p = priv.get(r.player_id);
      ws.addRow({
        number: r.number ?? "",
        shirt: shirtName(r.player),
        name: fullName(r.player),
        pos: r.position,
        posname: POSITION_LABEL[r.position],
        line: LINES.find((l) => l.key === lineOf(r.position))?.label ?? "",
        status: STATUS_LABEL[r.status],
        armband: r.armband ? ARMBAND_LABEL[r.armband] : "",
        foot: r.player.foot ? FOOT_LABEL[r.player.foot] : "",
        height: r.player.height_cm ?? "",
        apps: r.apps, starts: r.starts, goals: r.goals, assists: r.assists, mvps: r.mvps, yellows: r.yellows, reds: r.reds,
        conceded: lineOf(r.position) === "GK" ? r.conceded : "", clean: lineOf(r.position) === "GK" ? r.clean_sheets : "",
        ...(withPrivate
          ? {
              birth: p?.birth_date ? new Date(`${p.birth_date}T12:00:00Z`) : "",
              age: ageOf(p?.birth_date) ?? "",
              phone: p?.phone ?? "",
              email: p?.email ?? "",
              emergency: [p?.emergency_name, p?.emergency_phone].filter(Boolean).join(" · "),
            }
          : {}),
      });
    }
    const t = ws.addRow({ shirt: "TOTAL", apps: total.apps, starts: total.starts, goals: total.goals, assists: total.assists, mvps: total.mvps, yellows: total.yellows, reds: total.reds, conceded: total.conceded, clean: total.clean_sheets });
    t.font = { bold: true };
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF080808" } };
    ws.views = [{ state: "frozen", ySplit: 1, xSplit: 2 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // ------------------------------------------------------------ PDF (A4 horizontal)
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Plantilla ${season}`);
  pdf.setAuthor("Rayo Vallecañas");
  const W = 842, H = 595, M = 36;
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const crest = await pdf.embedPng(await readFile(path.join(process.cwd(), "public", "escudo.png")));
  const text = (p: PDFPage, t: string, x: number, y: number, size: number, f: PDFFont = font, color = NEGRO) => p.drawText(clean(t), { x, y, size, font: f, color });
  const center = (p: PDFPage, t: string, x: number, y: number, size: number, f: PDFFont = font, color = NEGRO) => {
    const s = clean(t);
    p.drawText(s, { x: x - f.widthOfTextAtSize(s, size) / 2, y, size, font: f, color });
  };
  const fit = (t: string, max: number, size: number, f: PDFFont = font) => {
    let s = clean(t);
    if (f.widthOfTextAtSize(s, size) <= max) return s;
    while (s.length > 1 && f.widthOfTextAtSize(s + "…", size) > max) s = s.slice(0, -1);
    return s + "…";
  };

  let page = pdf.addPage([W, H]);
  let n = 1;
  page.drawRectangle({ x: 0, y: H - 92, width: W, height: 92, color: NEGRO });
  page.drawRectangle({ x: 0, y: H - 96, width: W, height: 4, color: ROJO });
  page.drawImage(crest, { x: M, y: H - 82, width: 46, height: 55 });
  text(page, "RAYO VALLECAÑAS", M + 60, H - 45, 20, bold, rgb(1, 1, 1));
  text(page, `PLANTILLA ${season}`, M + 60, H - 63, 11, bold, DORADO);
  text(page, `${roster.length} jugadores · Fútbol 7`, M + 60, H - 78, 9, font, rgb(0.8, 0.8, 0.8));
  const rightText = `Generado el ${fecha(new Date(), true)}`;
  text(page, rightText, W - M - font.widthOfTextAtSize(clean(rightText), 8), H - 45, 8, font, rgb(0.7, 0.7, 0.7));

  const cols: [string, number, "l" | "c"][] = [
    ["#", 22, "c"], ["JUGADOR", 170, "l"], ["POS.", 40, "c"], ["LÍNEA", 80, "l"], ["ESTADO", 80, "l"], ["BRAZ.", 40, "c"],
    ["PJ", 34, "c"], ["TIT", 34, "c"], ["GOL", 34, "c"], ["ASI", 34, "c"], ["MVP", 34, "c"], ["TA", 30, "c"], ["TR", 30, "c"], ["GC", 30, "c"], ["P0", 30, "c"],
  ];
  const xs: number[] = [];
  cols.reduce((x, [, w]) => (xs.push(x), x + w), M);
  const header = (p: PDFPage, y: number) => {
    p.drawRectangle({ x: M - 4, y: y - 5, width: W - 2 * M + 8, height: 17, color: NEGRO });
    cols.forEach(([h, w, a], i) => (a === "c" ? center(p, h, xs[i] + w / 2, y, 7, bold, rgb(1, 1, 1)) : text(p, h, xs[i], y, 7, bold, rgb(1, 1, 1))));
  };
  let y = H - 125;
  for (const l of [...LINES]) {
    const list = roster.filter((r) => lineOf(r.position) === l.key);
    if (!list.length) continue;
    if (y < 90) {
      text(page, `Rayo Vallecañas · Plantilla ${season}`, M, 20, 7, font, GRIS);
      page = pdf.addPage([W, H]);
      n += 1;
      y = H - M - 10;
    }
    page.drawRectangle({ x: M - 4, y: y - 4, width: 4, height: 16, color: l.key === "GK" ? DORADO : ROJO });
    text(page, l.plural.toUpperCase(), M + 6, y, 11, bold);
    y -= 22;
    header(page, y);
    y -= 17;
    for (const [ri, r] of list.entries()) {
      if (y < 50) {
        text(page, `Rayo Vallecañas · Plantilla ${season} · página ${n}`, M, 20, 7, font, GRIS);
        page = pdf.addPage([W, H]);
        n += 1;
        y = H - M - 10;
        header(page, y);
        y -= 17;
      }
      if (ri % 2 === 0) page.drawRectangle({ x: M - 4, y: y - 5, width: W - 2 * M + 8, height: 16, color: rgb(0.965, 0.965, 0.955) });
      const gk = l.key === "GK";
      const vals = [
        r.number != null ? String(r.number) : "–",
        `${shirtName(r.player)} · ${fullName(r.player)}`,
        r.position,
        l.label,
        STATUS_LABEL[r.status],
        r.armband === "captain" ? "C" : r.armband === "vice" ? "2C" : "",
        r.apps, r.starts, r.goals, r.assists, r.mvps, r.yellows, r.reds, gk ? r.conceded : "", gk ? r.clean_sheets : "",
      ].map(String);
      cols.forEach(([, w, a], i) => {
        const f = i === 0 || i === 1 ? bold : font;
        const color = i === 0 ? ROJO : i === 4 && r.status !== "active" ? GRIS : NEGRO;
        if (a === "c") center(page, vals[i], xs[i] + w / 2, y, i === 0 ? 10 : 8, f, color);
        else text(page, fit(vals[i], w - 6, 8, f), xs[i], y, 8, f, color);
      });
      y -= 16;
    }
    y -= 12;
  }
  if (y < 50) { page = pdf.addPage([W, H]); n += 1; y = H - M - 10; }
  page.drawRectangle({ x: M - 4, y: y - 5, width: W - 2 * M + 8, height: 17, color: ROJO });
  text(page, "TOTAL DE LA PLANTILLA", xs[1], y, 8, bold, rgb(1, 1, 1));
  [total.apps, total.starts, total.goals, total.assists, total.mvps, total.yellows, total.reds, total.conceded, total.clean_sheets]
    .forEach((v, i) => center(page, String(v), xs[6 + i] + cols[6 + i][1] / 2, y, 8, bold, rgb(1, 1, 1)));
  text(page, "PJ partidos · TIT titular · GOL goles · ASI asistencias · MVP mejor del partido · TA/TR tarjetas · GC encajados y P0 porterías a cero (porteros)", M, y - 22, 7, font, GRIS);
  text(page, `Rayo Vallecañas · Plantilla ${season}${n > 1 ? ` · página ${n}` : ""}`, M, 20, 7, font, GRIS);

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}.pdf"`, "Cache-Control": "no-store" },
  });
}
