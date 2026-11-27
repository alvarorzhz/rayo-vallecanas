import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { appSecret } from "@/lib/app-secret";
import { readToken, signToken } from "@/lib/signed-token";
import { tokenRevoked } from "@/lib/token-guard";
import type { PerUser } from "@/lib/push";

/** Usuarios activos vinculados a esas fichas de jugador (para los avisos de la convocatoria). */
export async function usersOfPlayers(playerIds: string[]): Promise<string[]> {
  if (!playerIds.length) return [];
  const admin = createAdminClient();
  const { data: players } = await admin.from("players").select("user_id").in("id", playerIds).not("user_id", "is", null);
  const ids = (players ?? []).map((p) => p.user_id as string);
  if (!ids.length) return [];
  const { data: profiles } = await admin.from("profiles").select("id").in("id", ids).eq("active", true);
  return (profiles ?? []).map((p) => p.id as string);
}

// ------------------------------------------------------------------ Contestar desde el aviso
/**
 * Cada aviso de convocatoria lleva un token firmado (uso + partido + usuario + emisión + caducidad) para que el
 * service worker pueda apuntar «Voy» / «No voy» sin abrir la app y sin depender de la sesión.
 * La clave se crea sola la primera vez y se guarda en app_secrets (solo la lee el servidor).
 */
const SECRET = "callup_reply_secret";

export async function verifyReplyToken(token: string): Promise<{ matchId: string; userId: string; issuedAt: number } | null> {
  const t = readToken(await appSecret(SECRET), "callup", token);
  if (!t || (await tokenRevoked(t.userId, t.issuedAt))) return null;
  return { matchId: t.subjectId, userId: t.userId, issuedAt: t.issuedAt };
}

/** Botones «Voy / No voy» con el token de cada destinatario. Si algo falla, el aviso sale sin botones. */
export async function replyButtons(matchId: string, matchDate: string): Promise<PerUser | undefined> {
  try {
    const key = await appSecret(SECRET);
    // Vale hasta el final del día siguiente al partido
    const exp = new Date(new Date(`${matchDate}T23:59:59Z`).getTime() + 24 * 3600 * 1000);
    return (userId) => ({
      actions: [{ action: "yes", title: "✅ Voy" }, { action: "no", title: "❌ No voy" }],
      reply: { token: signToken(key, "callup", matchId, userId, exp) },
    });
  } catch {
    return undefined;
  }
}
