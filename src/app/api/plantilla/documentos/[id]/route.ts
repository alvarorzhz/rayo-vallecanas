import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Abre un documento de un jugador con un enlace temporal (bucket privado; RLS comprueba el permiso). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: d } = await supabase.from("player_documents").select("file_path").eq("id", id).maybeSingle();
  if (!d) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const { data, error } = await supabase.storage.from("player-docs").createSignedUrl(d.file_path, 300);
  if (error || !data) return NextResponse.json({ error: "No se pudo abrir el documento" }, { status: 403 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
