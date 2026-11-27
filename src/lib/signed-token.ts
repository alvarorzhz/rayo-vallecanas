import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Tokens firmados de los botones de los avisos («Voy / No voy», «Sí / No»).
 *
 * Forma (4.31.4): `v2.<uso>.<id del asunto>.<id del usuario>.<emitido en ms>.<caduca en s>.<firma>`.
 * Quien tiene el token puede responder por ese usuario a ese asunto, sin iniciar sesión, mientras:
 *  - la firma cuadre (clave que solo conoce el servidor, una por uso),
 *  - el uso sea el esperado (un token de convocatoria no sirve para una votación ni al revés),
 *  - no haya caducado y no viva más de MAX_LIFETIME_MS desde que se emitió.
 * Lo de «una sola vez» y «revocado» lo comprueba quien lo usa (token-guard.ts), porque necesita la BD.
 * Los tokens antiguos (4 partes, sin uso ni fecha de emisión) ya no valen.
 */
export type TokenPurpose = "callup" | "poll";
export type ReadToken = { subjectId: string; userId: string; issuedAt: number };

/** Ningún botón de un aviso vale más de 15 días, aunque el partido o la votación estén más lejos. */
export const MAX_LIFETIME_MS = 15 * 24 * 3600 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PURPOSES: readonly string[] = ["callup", "poll"];

const sign = (key: string, body: string) => createHmac("sha256", key).update(body).digest("base64url");

/** Firma un token para un uso, un asunto (partido, votación…) y un usuario, válido hasta `expiresAt` (con tope). */
export function signToken(key: string, purpose: TokenPurpose, subjectId: string, userId: string, expiresAt: Date, now = Date.now()): string {
  const exp = Math.floor(Math.min(expiresAt.getTime(), now + MAX_LIFETIME_MS) / 1000);
  const body = `v2.${purpose}.${subjectId}.${userId}.${Math.floor(now)}.${exp}`;
  return `${body}.${sign(key, body)}`;
}

/** Comprueba forma, uso, firma y caducidad. Devuelve el asunto, el usuario y cuándo se emitió, o null. */
export function readToken(key: string, purpose: TokenPurpose, token: string, now = Date.now()): ReadToken | null {
  const parts = String(token).split(".");
  if (parts.length !== 7) return null;
  const [v, use, subjectId, userId, iat, exp, sig] = parts;
  if (v !== "v2" || !PURPOSES.includes(use) || !UUID.test(subjectId) || !UUID.test(userId) || !/^\d{1,15}$/.test(iat) || !/^\d{1,12}$/.test(exp)) return null;
  const good = Buffer.from(sign(key, parts.slice(0, 6).join(".")));
  const given = Buffer.from(sig);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null;
  // Comprobado después de la firma para no dar pistas: el uso tiene que ser el de quien lo lee
  if (use !== purpose) return null;
  const issuedAt = Number(iat);
  const expiresAt = Number(exp) * 1000;
  if (expiresAt < now) return null;
  if (issuedAt > now + 5 * 60 * 1000) return null; // emitido «en el futuro»: algo raro
  if (expiresAt - issuedAt > MAX_LIFETIME_MS) return null;
  return { subjectId, userId, issuedAt };
}
