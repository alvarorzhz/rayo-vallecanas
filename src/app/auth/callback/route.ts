import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { logAccess, sessionIdFromToken } from "@/lib/access-log";

// Enlaces de invitación y recuperación de contraseña.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  const supabase = await createClient();
  let res: { data: { user: { id: string; email?: string } | null; session: { access_token: string } | null }; error: unknown } | null = null;
  if (code) res = await supabase.auth.exchangeCodeForSession(code);
  else if (tokenHash && type) res = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  const ok = Boolean(res && !res.error);
  if (ok && res?.data.user) {
    await logAccess({
      event: "link",
      userId: res.data.user.id,
      email: res.data.user.email ?? null,
      sessionId: sessionIdFromToken(res.data.session?.access_token),
      detail: type === "invite" ? "Invitación" : type === "recovery" ? "Recuperar contraseña" : "Enlace por email",
    });
  }
  if (!ok) return NextResponse.redirect(`${origin}/login?error=enlace`);
  const dest = type === "invite" || type === "recovery" ? "/auth/nueva-clave" : next;
  return NextResponse.redirect(`${origin}${dest}`);
}
