"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/session";
import { sendPush, vapidKeys } from "@/lib/push";

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function getPushKey() {
  await getSession();
  return (await vapidKeys()).publicKey;
}

export async function savePushSubscription(sub: Sub, userAgent: string) {
  const s = await getSession();
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "Suscripción no válida" };
  const supabase = await createClient();
  // Se llama cada vez que se abre la app: si el dispositivo ya está apuntado tal cual, no se toca
  // (antes se borraba y se volvía a crear, y así no se sabía qué móviles seguían recibiendo avisos)
  const { data: mine } = await supabase.from("push_subscriptions").select("id, p256dh, auth").eq("endpoint", sub.endpoint).maybeSingle();
  if (mine && mine.p256dh === sub.keys.p256dh && mine.auth === sub.keys.auth) return { ok: true };
  // Si el mismo dispositivo estaba asociado a otro usuario (sesión anterior), se reasigna.
  // Esa fila no se ve con los permisos de quien entra, así que se borra con la clave de servicio.
  if (!mine) await createAdminClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint).neq("user_id", s.user.id);
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: s.user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent.slice(0, 300) },
    { onConflict: "endpoint" },
  );
  if (error) return { error: error.message };
  return { ok: true };
}

export async function removePushSubscription(endpoint: string) {
  await getSession();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true };
}

export async function sendTestPush() {
  const s = await getSession();
  const n = await sendPush([s.user.id], { title: "¡Avisos activados! ⚡", body: "Así te llegarán los avisos del Rayo Vallecañas.", url: "/perfil", tag: "prueba" });
  return n > 0 ? { ok: "Aviso de prueba enviado" } : { error: "No se pudo enviar. Activa los avisos en este dispositivo primero." };
}

export async function setNotifySales(on: boolean) {
  const s = await getSession();
  const supabase = await createClient();
  await supabase.from("profiles").update({ notify_sales: on }).eq("id", s.user.id);
  revalidatePath("/perfil");
}
