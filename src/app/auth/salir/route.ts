import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAccess } from "@/lib/access-log";

/** Cierra la sesión (las páginas no pueden borrar cookies) y vuelve al login con el motivo. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const error = request.nextUrl.searchParams.get("error");
  // «sesion»: la cerró un superadministrador y ya quedó apuntado
  if (error !== "sesion") {
    const { data } = await supabase.auth.getClaims();
    const c = data?.claims;
    if (c?.sub) {
      await logAccess({
        event: error === "inactivo" ? "disabled" : "logout",
        userId: c.sub,
        email: (c.email as string) ?? null,
        sessionId: (c.session_id as string) ?? null,
        detail: error === "inactivo" ? "Usuario deshabilitado: se le sacó de la app" : null,
      });
    }
  }
  await supabase.auth.signOut({ scope: "local" });
  const url = new URL("/login", request.url);
  if (error && /^[a-z]+$/.test(error)) url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}
