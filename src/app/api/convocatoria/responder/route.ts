import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyReplyToken } from "@/lib/callup-push";
import { usedSince } from "@/lib/token-guard";

export const dynamic = "force-dynamic";

const USED = { error: "Ya contestaste desde este aviso (cada botón vale una vez)", failTitle: "Respuesta ya apuntada" };

/**
 * «Voy» / «No voy» pulsado en el aviso de la convocatoria. Lo llama el service worker, sin abrir
 * la app, así que no usa la sesión: el aviso lleva un token firmado para ese partido y ese usuario.
 * Repite las comprobaciones de la función callup_reply (convocatoria publicada, partido sin jugar,
 * jugador convocado) y además que el usuario siga activo.
 * Desde 4.31.4 el token es de un solo uso (no cambia una respuesta dada después de emitirse) y deja
 * de valer si a esa persona le cierran las sesiones o cambia la contraseña (verifyReplyToken).
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
  const who = body.token ? await verifyReplyToken(body.token) : null;
  if (!who) return NextResponse.json({ error: "Este aviso ya no vale (ha caducado o se ha anulado)" }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: profile }, { data: player }, { data: match }] = await Promise.all([
    admin.from("profiles").select("id").eq("id", who.userId).eq("active", true).maybeSingle(),
    admin.from("players").select("id").eq("user_id", who.userId).maybeSingle(),
    admin.from("matches").select("id, status, callup_published_at").eq("id", who.matchId).maybeSingle(),
  ]);
  if (!profile || !player) return NextResponse.json({ error: "No tienes ficha de jugador vinculada" }, { status: 403 });
  if (!match?.callup_published_at || !["scheduled", "postponed"].includes(match.status as string)) {
    return NextResponse.json({ error: "Esta convocatoria ya está cerrada" }, { status: 409 });
  }
  const { data: row } = await admin.from("match_callups").select("id, replied_at")
    .eq("match_id", who.matchId).eq("player_id", player.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Ya no estás en esta convocatoria" }, { status: 409 });
  // Un solo uso: si ya hay respuesta desde que salió este aviso, el botón no la vuelve a cambiar
  if (usedSince(row.replied_at as string | null, who.issuedAt)) return NextResponse.json(USED, { status: 409 });

  const issued = new Date(who.issuedAt).toISOString();
  const { data: rows, error } = await admin.from("match_callups")
    .update({ reply, reply_note: null, replied_at: new Date().toISOString(), replied_by: who.userId })
    .eq("id", row.id)
    // Por si llegan dos pulsaciones a la vez: solo gana una
    .or(`replied_at.is.null,replied_at.lt.${issued}`)
    .select("id");
  if (error) return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  if (!rows?.length) return NextResponse.json(USED, { status: 409 });

  revalidatePath(`/partidos/${who.matchId}`);
  revalidatePath("/");
  return NextResponse.json({
    ok: true,
    title: reply === "yes" ? "✅ ¡Apuntado!" : "Anotado: no vas",
    body: reply === "yes" ? "Nos vemos en el campo. Si cambia algo, contesta otra vez en la app." : "¡Otra vez será! Si al final puedes, cámbialo en la app.",
  });
}
