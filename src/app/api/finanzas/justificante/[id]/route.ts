import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Abre el justificante de un movimiento con un enlace temporal (el bucket es privado; RLS comprueba el permiso). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: m } = await supabase.from("finance_movements").select("attachment_path").eq("id", id).single();
  if (!m?.attachment_path) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { data, error } = await supabase.storage.from("finance-docs").createSignedUrl(m.attachment_path, 300);
  if (error || !data) return NextResponse.json({ error: "No se pudo abrir el justificante" }, { status: 403 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
