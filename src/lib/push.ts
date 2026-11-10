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

type PushAction = { action: string; title: string };
export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /** Botones del aviso (Chrome/Edge en Android, Windows y Mac; Safari y el iPhone no los enseñan). */
  actions?: PushAction[];
  /** Respuesta directa desde el aviso: el service worker la manda a endpoint (por defecto, /api/convocatoria/responder). */
  reply?: { token: string; endpoint?: string };
};
/** Datos extra de cada destinatario (p. ej. su token para contestar desde el aviso). */
export type PerUser = (userId: string) => Partial<PushPayload>;

/** Envía un aviso a todos los dispositivos de esos usuarios. Nunca lanza error: un aviso no debe romper una venta. */
export async function sendPush(userIds: string[], payload: PushPayload, perUser?: PerUser) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) return 0;
  try {
    const { publicKey, privateKey } = await vapidKeys();
    webpush.setVapidDetails("https://rayo-vallecanas.vercel.app", publicKey, privateKey);
    const admin = createAdminClient();
    const { data: subs } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", ids);
    let ok = 0;
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", url: "/", ...payload, ...perUser?.(s.user_id as string) }),
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
    await logPush(payload, ids.length, ok);
    return ok;
  } catch {
    return 0;
  }
}

/** Apunta el aviso en el registro (Gestión → Avisos) y borra los de hace más de 90 días. Nunca lanza error. */
async function logPush(p: PushPayload, people: number, devices: number) {
  if (p.tag === "prueba") return; // el aviso de prueba de Mi perfil no se apunta
  try {
    const admin = createAdminClient();
    await admin.from("push_log").insert({ title: p.title.slice(0, 120), body: p.body.slice(0, 400), url: p.url ?? "/", tag: p.tag ?? null, people, devices });
    if (Math.random() < 0.1) await admin.from("push_log").delete().lt("created_at", new Date(Date.now() - 90 * 86_400_000).toISOString());
  } catch {
    // el registro es informativo: si falla, el aviso ya ha salido
  }
}

/** Usuarios que gestionan sorteos (para avisos de ventas), según sus permisos efectivos. */
export async function lotteryManagers(exclude?: string) {
  const admin = createAdminClient();
  const [{ data: profiles }, { data: ids }] = await Promise.all([
    admin.from("profiles").select("id, notify_sales").eq("active", true),
    admin.rpc("users_with_perm", { p_module: "lottery_admin", p_action: "update" }),
  ]);
  const allowed = new Set((ids ?? []) as string[]);
  return (profiles ?? []).filter((p) => p.notify_sales && p.id !== exclude && allowed.has(p.id)).map((p) => p.id);
}
