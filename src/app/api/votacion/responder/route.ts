import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPollToken } from "@/lib/poll-push";
import { usedSince } from "@/lib/token-guard";

export const dynamic = "force-dynamic";

/**
 * «Sí» / «No» pulsado en el aviso de una votación. Lo llama el service worker sin abrir la app:
 * el aviso lleva un token firmado para esa votación y ese usuario, que caduca al cerrarse.
 * Las comprobaciones (abierta, dirigida a esa persona, usuario activo) las hace poll_cast en la BD.
 * Desde 4.31.4 el token es de un solo uso y se revoca al cerrar sesiones o cambiar la contraseña.
 */
export async function POST(req: Request) {
  let body: { token?: string; reply?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Petición no válida" }, { status: 400 });
  }
  const reply = body.reply;
  if (reply !== "yes" && reply !== "no") return NextResponse.json({ error: "Respuesta no válida" }, { status: 400 });
  const who = body.token ? await verifyPollToken(body.token) : null;
  if (!who) return NextResponse.json({ error: "Este aviso ya no vale (la votación se cerró o el aviso se anuló)", failTitle: "No se pudo apuntar tu voto" }, { status: 401 });

  const admin = createAdminClient();
  // Un solo uso: si ya votó desde que salió este aviso, el botón no cambia el voto
  const { data: prev } = await admin.from("poll_votes").select("voted_at").eq("poll_id", who.pollId).eq("user_id", who.userId).maybeSingle();
  if (usedSince(prev?.voted_at as string | null | undefined, who.issuedAt)) {
    return NextResponse.json({ error: "Ya votaste desde este aviso (cada botón vale una vez)", failTitle: "Voto ya apuntado" }, { status: 409 });
  }
  const { error } = await admin.rpc("poll_cast", { p_user: who.userId, p_poll: who.pollId, p_vote: reply === "yes" });
  if (error) return NextResponse.json({ error: error.message, failTitle: "No se pudo apuntar tu voto" }, { status: 409 });

  revalidatePath("/votaciones");
  revalidatePath("/");
  return NextResponse.json({
    ok: true,
    title: reply === "yes" ? "🗳️ Has votado SÍ" : "🗳️ Has votado NO",
    body: "Puedes cambiar tu voto en la app hasta que se cierre la votación.",
  });
}
