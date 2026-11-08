import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
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
 * Cada aviso de convocatoria lleva un token firmado (partido + usuario + caducidad) para que el
 * service worker pueda apuntar «Voy» / «No voy» sin abrir la app y sin depender de la sesión.
 * La clave se crea sola la primera vez y se guarda en app_secrets (solo la lee el servidor).
 */
let secret: string | null = null;

async function tokenSecret() {
  if (secret) return secret;
  const admin = createAdminClient();
  const read = async () => (await admin.from("app_secrets").select("value").eq("name", "callup_reply_secret").maybeSingle()).data?.value as string | undefined;
  let v = await read();
  if (!v) {
    await admin.from("app_secrets").upsert([{ name: "callup_reply_secret", value: randomBytes(32).toString("base64url") }], { onConflict: "name", ignoreDuplicates: true });
    v = await read();
  }
  if (!v) throw new Error("No se pudo crear la clave de respuestas");
  secret = v;
  return v;
}

const sign = (key: string, body: string) => createHmac("sha256", key).update(body).digest("base64url");

/** Firma para un partido y un usuario. Vale hasta el día siguiente al partido. */
export function signReplyToken(key: string, matchId: string, userId: string, matchDate: string) {
  const exp = Math.floor(new Date(`${matchDate}T23:59:59Z`).getTime() / 1000) + 24 * 3600;
  const body = `${matchId}.${userId}.${exp}`;
  return `${body}.${sign(key, body)}`;
}

/** Comprueba firma y caducidad. Devuelve el partido y el usuario, o null. */
export function readReplyToken(key: string, token: string, now = Date.now()): { matchId: string; userId: string } | null {
  const parts = String(token).split(".");
  if (parts.length !== 4) return null;
  const [matchId, userId, exp, sig] = parts;
  const UUID = /^[0-9a-f-]{36}$/i;
  if (!UUID.test(matchId) || !UUID.test(userId) || !/^\d+$/.test(exp)) return null;
  const good = Buffer.from(sign(key, `${matchId}.${userId}.${exp}`));
  const given = Buffer.from(sig);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null;
  if (Number(exp) * 1000 < now) return null;
  return { matchId, userId };
}

export async function verifyReplyToken(token: string) {
  return readReplyToken(await tokenSecret(), token);
}

/** Botones «Voy / No voy» con el token de cada destinatario. Si algo falla, el aviso sale sin botones. */
export async function replyButtons(matchId: string, matchDate: string): Promise<PerUser | undefined> {
  try {
    const key = await tokenSecret();
    return (userId) => ({
      actions: [{ action: "yes", title: "✅ Voy" }, { action: "no", title: "❌ No voy" }],
      reply: { token: signReplyToken(key, matchId, userId, matchDate) },
    });
  } catch {
    return undefined;
  }
}
