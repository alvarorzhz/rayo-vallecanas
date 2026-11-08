import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPollToken } from "@/lib/poll-push";

export const dynamic = "force-dynamic";

/**
 * «Sí» / «No» pulsado en el aviso de una votación. Lo llama el service worker sin abrir la app:
 * el aviso lleva un token firmado para esa votación y ese usuario, que caduca al cerrarse.
 * Las comprobaciones (abierta, dirigida a esa persona, usuario activo) las hace poll_cast en la BD.
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
  if (!who) return NextResponse.json({ error: "La votación ya está cerrada", failTitle: "No se pudo apuntar tu voto" }, { status: 401 });

  const admin = createAdminClient();
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
