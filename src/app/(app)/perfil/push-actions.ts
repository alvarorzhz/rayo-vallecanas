"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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
  // Si el mismo dispositivo estaba asociado a otro usuario (sesión anterior), se reasigna
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
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
  const n = await sendPush([s.user.id], { title: "¡Avisos activados! ⚡", body: "Así te llegarán los avisos del Rayo Vallecañas.", url: "/perfil" });
  return n > 0 ? { ok: "Aviso de prueba enviado" } : { error: "No se pudo enviar. Activa los avisos en este dispositivo primero." };
}

export async function setNotifySales(on: boolean) {
  const s = await getSession();
  const supabase = await createClient();
  await supabase.from("profiles").update({ notify_sales: on }).eq("id", s.user.id);
  revalidatePath("/perfil");
}
