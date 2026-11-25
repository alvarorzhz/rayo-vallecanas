import { NextResponse } from "next/server";
import { getPublicStatus } from "@/lib/app-settings-server";

export const dynamic = "force-dynamic";

/** 4.31.0 · Marcas de los mandos (forzar actualización y último cambio), que la app mira al cambiar de pantalla. */
export async function GET() {
  const st = await getPublicStatus();
  return NextResponse.json({ reload_at: st.reload_at, updated_at: st.updated_at }, { headers: { "Cache-Control": "no-store" } });
}
