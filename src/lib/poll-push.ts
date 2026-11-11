import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { appSecret } from "@/lib/app-secret";
import { readToken, signToken } from "@/lib/signed-token";
import type { PerUser } from "@/lib/push";
import type { PollAudience } from "@/lib/polls";

/** Personas activas a las que va dirigida una votación (según su rol base). */
export async function pollAudienceUsers(audience: PollAudience): Promise<string[]> {
  const admin = createAdminClient();
  let q = admin.from("profiles").select("id").eq("active", true);
  if (audience === "player") q = q.eq("role", "player");
  if (audience === "admin") q = q.neq("role", "player");
  const { data } = await q;
  return (data ?? []).map((p) => p.id as string);
}

// ------------------------------------------------------------------ Votar desde el aviso
/**
 * Como en las convocatorias: cada aviso lleva un token firmado (votación + usuario + cierre)
 * para que el service worker apunte el voto sin abrir la app. Clave propia en app_secrets.
 */
const SECRET = "poll_reply_secret";

export async function verifyPollToken(token: string): Promise<{ pollId: string; userId: string } | null> {
  const t = readToken(await appSecret(SECRET), token);
  return t && { pollId: t.subjectId, userId: t.userId };
}

/** Botones «Sí / No» con el token de cada destinatario. Si algo falla, el aviso sale sin botones. */
export async function pollButtons(pollId: string, closesAt: string): Promise<PerUser | undefined> {
  try {
    const key = await appSecret(SECRET);
    // Caduca al cerrarse la votación
    const exp = new Date(closesAt);
    return (userId) => ({
      actions: [{ action: "yes", title: "✅ Sí" }, { action: "no", title: "❌ No" }],
      reply: { token: signToken(key, pollId, userId, exp), endpoint: "/api/votacion/responder" },
    });
  } catch {
    return undefined;
  }
}
