import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Abre el contrato de un acuerdo con un enlace temporal (bucket privado; RLS comprueba el permiso). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: a } = await supabase.from("sponsor_agreements").select("contract_path").eq("id", id).maybeSingle();
  if (!a?.contract_path) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { data, error } = await supabase.storage.from("sponsor-docs").createSignedUrl(a.contract_path, 300);
  if (error || !data) return NextResponse.json({ error: "No se pudo abrir el contrato" }, { status: 403 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
