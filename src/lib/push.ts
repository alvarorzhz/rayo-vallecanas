import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Notificaciones push (Web Push con claves VAPID).
 * Las claves se generan solas la primera vez y se guardan en app_secrets, una tabla que solo
 * puede leer el servidor con la clave de servicio: no hay que configurar nada en Vercel.
 */
let keys: { publicKey: string; privateKey: string } | null = null;

export async function vapidKeys() {
  if (keys) return keys;
  const admin = createAdminClient();
  const { data } = await admin.from("app_secrets").select("name, value").in("name", ["vapid_public", "vapid_private"]);
  const get = (n: string) => data?.find((r) => r.name === n)?.value;
  if (get("vapid_public") && get("vapid_private")) {
    keys = { publicKey: get("vapid_public")!, privateKey: get("vapid_private")! };
    return keys;
  }
  const fresh = webpush.generateVAPIDKeys();
  // Si dos peticiones las crean a la vez, gana la primera y se relee
  await admin.from("app_secrets").upsert(
    [{ name: "vapid_public", value: fresh.publicKey }, { name: "vapid_private", value: fresh.privateKey }],
    { onConflict: "name", ignoreDuplicates: true },
  );
  keys = null;
  const { data: again } = await admin.from("app_secrets").select("name, value").in("name", ["vapid_public", "vapid_private"]);
  keys = {
    publicKey: again!.find((r) => r.name === "vapid_public")!.value,
    privateKey: again!.find((r) => r.name === "vapid_private")!.value,
  };
  return keys;
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

/** Envía un aviso a todos los dispositivos de esos usuarios. Nunca lanza error: un aviso no debe romper una venta. */
export async function sendPush(userIds: string[], payload: PushPayload) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) return 0;
  try {
    const { publicKey, privateKey } = await vapidKeys();
    webpush.setVapidDetails("https://rayo-vallecanas.vercel.app", publicKey, privateKey);
    const admin = createAdminClient();
    const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", ids);
    let ok = 0;
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", url: "/", ...payload }),
            { TTL: 60 * 60 * 24 },
          );
          ok++;
          await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          // El dispositivo ya no acepta avisos (desinstalada o permiso retirado): se borra
          if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
      }),
    );
    return ok;
  } catch {
    return 0;
  }
}

/** Usuarios que gestionan sorteos (para avisos de ventas), según sus permisos efectivos. */
export async function lotteryManagers(exclude?: string) {
  const admin = createAdminClient();
  const [{ data: profiles }, { data: roles }, { data: custom }] = await Promise.all([
    admin.from("profiles").select("id, role, notify_sales").eq("active", true),
    admin.from("role_permissions").select("role, can_update").eq("module", "lottery_admin"),
    admin.from("user_permissions").select("user_id, can_update").eq("module", "lottery_admin"),
  ]);
  return (profiles ?? [])
    .filter((p) => p.notify_sales && p.id !== exclude)
    .filter((p) => {
      if (p.role === "superadmin") return true;
      const c = custom?.find((u) => u.user_id === p.id);
      if (c) return c.can_update;
      return Boolean(roles?.find((r) => r.role === p.role)?.can_update);
    })
    .map((p) => p.id);
}
