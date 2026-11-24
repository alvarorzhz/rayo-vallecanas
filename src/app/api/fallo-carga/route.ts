import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cleanMessage, cleanPath } from "@/lib/error-log";
import { deviceKind } from "@/lib/usage";
import { APP_VERSION } from "@/lib/changelog";

/** 4.30.4 · El vigía de arranque avisa de que la app lleva 15 s sin arrancar (Gestión → Uso → Fallos). */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { path?: string; errors?: string; online?: boolean };
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) return new NextResponse(null, { status: 204 });
    const extra = [body.online === false ? "sin conexión" : "", body.errors ? `fallos: ${body.errors}` : ""].filter(Boolean).join(" · ");
    await supabase.rpc("log_app_error", {
      p_kind: "js",
      p_path: cleanPath(String(body.path ?? "/")),
      p_message: cleanMessage(`La app se quedó cargando más de 15 s${extra ? ` (${extra})` : ""}`),
      p_digest: null,
      p_version: APP_VERSION,
      p_device: deviceKind(request.headers.get("user-agent") ?? ""),
    });
  } catch {}
  return new NextResponse(null, { status: 204 });
}
