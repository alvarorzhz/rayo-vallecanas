import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isBackupName, readBackup } from "@/lib/backup";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Descarga una de las copias automáticas guardadas (solo superadministradores; queda en la auditoría). */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const name = sp.get("nombre") ?? "";
  const where = sp.get("donde") === "blob" ? "blob" : "supabase";
  if (!isBackupName(name)) return NextResponse.json({ error: "Copia no válida" }, { status: 400 });
  const supabase = await createClient();
  const { error: denied } = await supabase.rpc("log_backup", { p_format: `guardada ${name}` });
  if (denied) return NextResponse.json({ error: "Solo un superadministrador puede descargar la copia de seguridad" }, { status: 403 });
  const body = await readBackup(name, where);
  if (!body) return NextResponse.json({ error: "No se encuentra esa copia" }, { status: 404 });
  return new NextResponse(body as BodyInit, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
