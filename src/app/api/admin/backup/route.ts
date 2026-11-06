import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Tablas que se copian, con el nombre de la hoja en el Excel. */
const TABLES: [string, string][] = [
  ["profiles", "Usuarios"],
  ["role_permissions", "Permisos por perfil"],
  ["user_permissions", "Permisos personalizados"],
  ["lottery_campaigns", "Campañas"],
  ["lottery_campaign_sellers", "Vendedores asignados"],
  ["lottery_booklets", "Talonarios"],
  ["buyers", "Compradores"],
  ["lottery_sales", "Ventas"],
  ["lottery_shares", "Participaciones y números"],
  ["lottery_payments", "Cobros"],
  ["notifications", "Justificantes enviados"],
  ["finance_settings", "Finanzas · saldo inicial"],
  ["finance_categories", "Finanzas · categorías"],
  ["finance_movements", "Finanzas · movimientos"],
  ["players", "Plantilla · jugadores"],
  ["player_private", "Plantilla · datos personales"],
  ["squad_members", "Plantilla · temporadas"],
  ["player_documents", "Plantilla · documentos"],
  ["squad_fee_plans", "Plantilla · cuotas"],
  ["squad_fee_overrides", "Plantilla · cuotas especiales"],
  ["audit_log", "Auditoría"],
];

/**
 * Copia de seguridad completa de los datos de la app (solo superadministradores).
 * ?formato=xlsx → Excel legible, una hoja por tabla. ?formato=json → todo en un fichero, para restaurar.
 * Se lee con la sesión del superadministrador: la base de datos (RLS) le deja ver todo.
 */
export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get("formato") === "json" ? "json" : "xlsx";
  const supabase = await createClient();
  const { error: denied } = await supabase.rpc("log_backup", { p_format: format });
  if (denied) return NextResponse.json({ error: "Solo un superadministrador puede descargar la copia de seguridad" }, { status: 403 });

  const data: Record<string, Record<string, unknown>[]> = {};
  for (const [table] of TABLES) {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await supabase.from(table).select("*").range(from, from + 999);
      if (error) return NextResponse.json({ error: `No se pudo leer ${table}: ${error.message}` }, { status: 500 });
      rows.push(...(page ?? []));
      if (!page || page.length < 1000) break;
    }
    data[table] = rows;
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/^(\d{8})(\d{4})$/, "$1-$2");
  const name = `rayo-vallecanas-copia-${stamp}`;

  if (format === "json") {
    const body = JSON.stringify({ app: "rayo-vallecanas", created_at: new Date().toISOString(), tables: data }, null, 1);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Rayo Vallecañas";
  const summary = wb.addWorksheet("Resumen");
  summary.columns = [{ header: "Tabla", key: "t", width: 32 }, { header: "Registros", key: "n", width: 12 }];
  summary.addRow({ t: `Copia del ${new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}`, n: "" });
  for (const [table, label] of TABLES) summary.addRow({ t: label, n: data[table].length });
  summary.getRow(1).font = { bold: true };

  for (const [table, label] of TABLES) {
    const rows = data[table];
    const ws = wb.addWorksheet(label.slice(0, 31));
    const cols = rows.length ? Object.keys(rows[0]) : ["(sin datos)"];
    ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.min(40, Math.max(12, c.length + 2)) }));
    for (const r of rows) {
      ws.addRow(Object.fromEntries(cols.map((c) => {
        const v = r[c];
        return [c, v !== null && typeof v === "object" ? JSON.stringify(v) : v];
      })));
    }
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
