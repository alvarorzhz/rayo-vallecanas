"use server";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { siteUrl } from "@/lib/receipt";
import { logAccess, sessionIdFromToken } from "@/lib/access-log";

/** email: el que se escribió, para que no se borre del formulario al fallar (React lo vacía tras cada envío). */
export type FormState = { error?: string; ok?: string; email?: string } | undefined;

/** 4.30.4 · El texto que ve la persona para cada fallo de Supabase Auth (nunca el mensaje en inglés). */
function authError(e: { code?: string; status?: number; message?: string; name?: string }): string {
  if (e.code === "user_banned") return "Tu acceso a la app está deshabilitado. Habla con un gestor del club.";
  if (e.code === "over_request_rate_limit" || e.status === 429)
    return "Demasiados intentos seguidos. Espera unos minutos antes de volver a probar o pulsa «¿Has olvidado la contraseña?».";
  if (e.code === "email_not_confirmed") return "Tu cuenta aún no está activada. Pide a un gestor que te dé una contraseña provisional.";
  if (e.name === "AuthRetryableFetchError" || (e.status ?? 0) >= 500 || /fetch|network/i.test(e.message ?? ""))
    return "No se ha podido conectar. Revisa la cobertura y vuelve a intentarlo.";
  return "Email o contraseña incorrectos. Revisa que el email esté bien escrito.";
}

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  if (!email || !password) return { error: "Escribe tu email y tu contraseña" };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const msg = authError(error);
    await logAccess({ event: "login_failed", email, detail: error.code === "user_banned" ? "Usuario deshabilitado" : error.code === "invalid_credentials" ? "Email o contraseña incorrectos" : msg });
    return { error: msg, email };
  }
  await logAccess({ event: "login", userId: data.user.id, email, sessionId: sessionIdFromToken(data.session.access_token) });
  redirect(safeNext(next));
}

export async function signOut() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) await logAccess({ event: "logout", userId: data.claims.sub, email: (data.claims.email as string) ?? null, sessionId: (data.claims.session_id as string) ?? null });
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestReset(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { error: "Escribe el email con el que entras en la app" };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/auth/nueva-clave`,
  });
  // 4.30.4 · El correo gratuito de Supabase solo manda unos pocos por hora: si se pasa, que lo sepa
  if (error && (error.code === "over_email_send_rate_limit" || error.status === 429))
    return { error: "Ahora mismo no se pueden mandar más correos. Pulsa «Avisar a un gestor» y te dará una contraseña provisional." };
  // Misma respuesta exista o no la cuenta
  return { ok: "Si el email es de alguien del club, te llegará un correo con un enlace para crear tu contraseña. Mira también en «Spam». Si en unos minutos no te llega, pulsa «Avisar a un gestor»." };
}

const HELP_DETAIL = "Pidió ayuda a un gestor (contraseña olvidada)";

/**
 * 4.30.4 · «Avisar a un gestor»: les llega un aviso al móvil con su nombre y, al tocarlo, se abre su ficha
 * para crearle una contraseña provisional. Como mucho un aviso cada 30 minutos por persona.
 * La respuesta es siempre la misma, exista o no la cuenta.
 */
export async function requestHelp(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { error: "Escribe el email con el que entras en la app" };
  const done: FormState = { ok: "Hecho. Si el email es de alguien del club, los gestores ya tienen el aviso y te mandarán una contraseña provisional por WhatsApp. También puedes escribir a cualquiera de ellos." };
  try {
    const admin = createAdminClient();
    const { data: who } = await admin.from("profiles").select("id, full_name, active").ilike("email", email.replace(/[\\%_]/g, (c) => `\\${c}`)).maybeSingle();
    if (!who) {
      await logAccess({ event: "login_failed", email, detail: `${HELP_DETAIL}: email desconocido` });
      return done;
    }
    const since = new Date(Date.now() - 30 * 60_000).toISOString();
    const { count } = await admin.from("access_log").select("id", { count: "exact", head: true })
      .eq("event", "login_failed").eq("user_id", who.id).like("detail", `${HELP_DETAIL}%`).gte("created_at", since);
    await logAccess({ event: "login_failed", userId: who.id, email, detail: HELP_DETAIL });
    if (count) return done;
    const { data: ids } = await admin.rpc("users_with_perm", { p_module: "users", p_action: "update" });
    const managers = ((ids ?? []) as string[]).filter((id) => id !== who.id);
    await sendPush(managers, {
      title: `🔑 ${who.full_name} no puede entrar`,
      body: who.active
        ? "Ha olvidado su contraseña. Toca para crearle una provisional y mandársela por WhatsApp."
        : "Ha pedido ayuda para entrar, pero tiene el acceso deshabilitado.",
      url: `/admin/usuarios/${who.id}`,
      tag: `ayuda-acceso-${who.id}`,
    });
  } catch {
    // El aviso es una ayuda: si falla, la persona puede escribir a un gestor
  }
  return done;
}

/** 4.30.4 · Fallos al guardar una contraseña nueva, en castellano. */
function passwordError(e: { code?: string; message?: string; name?: string }): string {
  if (e.code === "same_password" || /different|same/i.test(e.message ?? "")) return "Elige una contraseña distinta de la que tenías";
  if (e.code === "weak_password") return "Esa contraseña es demasiado fácil. Prueba con otra más larga";
  if (e.name === "AuthSessionMissingError" || /session/i.test(e.message ?? ""))
    return "El enlace ha caducado o ya se usó (cada enlace sirve una sola vez). Pide otro en «¿Has olvidado la contraseña?».";
  return authError(e);
}

function checkNew(password: string, confirm: string): string | null {
  if (password.length < 10) return "La contraseña debe tener al menos 10 caracteres";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Usa letras y números";
  if (password !== confirm) return "Las contraseñas no coinciden";
  return null;
}

export async function setPassword(_: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const bad = checkNew(password, confirm);
  if (bad) return { error: bad };
  const supabase = await createClient();
  const { data: u, error } = await supabase.auth.updateUser({ password });
  if (error) return { error: passwordError(error) };
  await supabase.from("profiles").update({ must_change_password: false }).eq("id", u.user.id);
  await logAccess({ event: "password", userId: u.user.id, email: u.user.email ?? null });
  redirect("/");
}

/** 4.30.4 · Cambiar la contraseña desde Mi perfil: pide la actual para que nadie la cambie con el móvil de otro. */
export async function changePassword(_: FormState, formData: FormData): Promise<FormState> {
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!current) return { error: "Escribe tu contraseña actual" };
  const bad = checkNew(password, confirm);
  if (bad) return { error: bad };
  if (password === current) return { error: "Elige una contraseña distinta de la que tenías" };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = (claims?.claims?.email as string | undefined) ?? null;
  if (!claims?.claims?.sub || !email) return { error: "Tu sesión ha caducado. Sal y vuelve a entrar." };
  // Se comprueba la actual con un cliente aparte (sin tocar la sesión de este móvil) y se cierra esa comprobación
  const check = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: wrong } = await check.auth.signInWithPassword({ email, password: current });
  if (wrong) return { error: wrong.code === "invalid_credentials" ? "La contraseña actual no es correcta" : authError(wrong) };
  await check.auth.signOut({ scope: "local" }).catch(() => {});
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: passwordError(error) };
  await logAccess({ event: "password", userId: claims.claims.sub, email, detail: "Cambiada desde Mi perfil" });
  return { ok: "Contraseña cambiada. La próxima vez entra con la nueva." };
}
