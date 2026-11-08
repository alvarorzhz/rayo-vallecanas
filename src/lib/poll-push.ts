import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
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
let secret: string | null = null;

async function tokenSecret() {
  if (secret) return secret;
  const admin = createAdminClient();
  const read = async () => (await admin.from("app_secrets").select("value").eq("name", "poll_reply_secret").maybeSingle()).data?.value as string | undefined;
  let v = await read();
  if (!v) {
    await admin.from("app_secrets").upsert([{ name: "poll_reply_secret", value: randomBytes(32).toString("base64url") }], { onConflict: "name", ignoreDuplicates: true });
    v = await read();
  }
  if (!v) throw new Error("No se pudo crear la clave de votaciones");
  secret = v;
  return v;
}

const sign = (key: string, body: string) => createHmac("sha256", key).update(body).digest("base64url");

/** Firma para una votación y un usuario. Caduca al cerrarse la votación. */
export function signPollToken(key: string, pollId: string, userId: string, closesAt: string) {
  const exp = Math.floor(new Date(closesAt).getTime() / 1000);
  const body = `${pollId}.${userId}.${exp}`;
  return `${body}.${sign(key, body)}`;
}

export function readPollToken(key: string, token: string, now = Date.now()): { pollId: string; userId: string } | null {
  const parts = String(token).split(".");
  if (parts.length !== 4) return null;
  const [pollId, userId, exp, sig] = parts;
  const UUID = /^[0-9a-f-]{36}$/i;
  if (!UUID.test(pollId) || !UUID.test(userId) || !/^\d+$/.test(exp)) return null;
  const good = Buffer.from(sign(key, `${pollId}.${userId}.${exp}`));
  const given = Buffer.from(sig);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null;
  if (Number(exp) * 1000 < now) return null;
  return { pollId, userId };
}

export async function verifyPollToken(token: string) {
  return readPollToken(await tokenSecret(), token);
}

/** Botones «Sí / No» con el token de cada destinatario. Si algo falla, el aviso sale sin botones. */
export async function pollButtons(pollId: string, closesAt: string): Promise<PerUser | undefined> {
  try {
    const key = await tokenSecret();
    return (userId) => ({
      actions: [{ action: "yes", title: "✅ Sí" }, { action: "no", title: "❌ No" }],
      reply: { token: signPollToken(key, pollId, userId, closesAt), endpoint: "/api/votacion/responder" },
    });
  } catch {
    return undefined;
  }
}
