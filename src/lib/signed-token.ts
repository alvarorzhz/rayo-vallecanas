import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Tokens firmados de los botones de los avisos («Voy / No voy», «Sí / No»).
 * Forma: `<id del asunto>.<id del usuario>.<caducidad en segundos>.<firma>`.
 * Quien tiene el token puede responder por ese usuario a ese asunto hasta que caduca,
 * sin iniciar sesión: por eso van firmados con una clave que solo conoce el servidor.
 */
const UUID = /^[0-9a-f-]{36}$/i;

const sign = (key: string, body: string) => createHmac("sha256", key).update(body).digest("base64url");

/** Firma un token para un asunto (partido, votación…) y un usuario, válido hasta `expiresAt`. */
export function signToken(key: string, subjectId: string, userId: string, expiresAt: Date): string {
  const body = `${subjectId}.${userId}.${Math.floor(expiresAt.getTime() / 1000)}`;
  return `${body}.${sign(key, body)}`;
}

/** Comprueba forma, firma y caducidad. Devuelve el asunto y el usuario, o null. */
export function readToken(key: string, token: string, now = Date.now()): { subjectId: string; userId: string } | null {
  const parts = String(token).split(".");
  if (parts.length !== 4) return null;
  const [subjectId, userId, exp, sig] = parts;
  if (!UUID.test(subjectId) || !UUID.test(userId) || !/^\d+$/.test(exp)) return null;
  const good = Buffer.from(sign(key, `${subjectId}.${userId}.${exp}`));
  const given = Buffer.from(sig);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null;
  if (Number(exp) * 1000 < now) return null;
  return { subjectId, userId };
}
