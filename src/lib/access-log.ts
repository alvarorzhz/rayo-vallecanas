import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export type AccessEvent = "login" | "login_failed" | "link" | "logout" | "password" | "revoked" | "disabled";

/** Saca el id de sesión de Supabase Auth del token de acceso (claim session_id). */
export function sessionIdFromToken(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { session_id?: string };
    return typeof payload.session_id === "string" ? payload.session_id : null;
  } catch {
    return null;
  }
}

/**
 * Apunta una entrada en el historial de accesos (con la IP y el navegador de la petición).
 * Nunca rompe el inicio de sesión: si falla, se ignora.
 */
export async function logAccess(e: { event: AccessEvent; userId?: string | null; email?: string | null; sessionId?: string | null; detail?: string | null }) {
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim() || null;
    const ua = h.get("user-agent");
    await createAdminClient().from("access_log").insert({
      event: e.event,
      user_id: e.userId ?? null,
      email: e.email ? e.email.slice(0, 160).toLowerCase() : null,
      session_id: e.sessionId ?? null,
      ip: ip?.slice(0, 64) ?? null,
      user_agent: ua?.slice(0, 400) ?? null,
      detail: e.detail?.slice(0, 200) ?? null,
    });
  } catch {
    // El historial de accesos es informativo: no debe impedir entrar o salir
  }
}
