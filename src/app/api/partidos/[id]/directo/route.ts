import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchMatch } from "@/lib/match-queries";
import { fetchLiveView } from "@/lib/live-queries";

export const dynamic = "force-dynamic";

/** Marcador en directo: lo que va apuntando quien lleva el acta en vivo (Inicio lo consulta cada pocos segundos). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const m = await fetchMatch(supabase, id);
  if (!m) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(await fetchLiveView(supabase, m), { headers: { "Cache-Control": "no-store" } });
}
