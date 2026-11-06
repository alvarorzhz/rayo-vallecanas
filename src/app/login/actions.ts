"use server";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/receipt";

export type FormState = { error?: string; ok?: string } | undefined;

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "user_banned") return { error: "Tu acceso a la app está deshabilitado. Habla con la directiva." };
    return { error: "Email o contraseña incorrectos" };
  }
  redirect(safeNext(next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestReset(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Indica tu email" };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/auth/nueva-clave`,
  });
  // Misma respuesta exista o no la cuenta
  return { ok: "Si el email está registrado, recibirás un enlace para crear una nueva contraseña." };
}

export async function setPassword(_: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 10) return { error: "La contraseña debe tener al menos 10 caracteres" };
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return { error: "Usa letras y números" };
  if (password !== confirm) return { error: "Las contraseñas no coinciden" };
  const supabase = await createClient();
  const { data: u, error } = await supabase.auth.updateUser({ password });
  if (error) return { error: /different|same/i.test(error.message) ? "Elige una contraseña distinta de la provisional" : error.message };
  await supabase.from("profiles").update({ must_change_password: false }).eq("id", u.user.id);
  redirect("/");
}
