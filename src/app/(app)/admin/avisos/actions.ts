"use server";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push";

export type NoticeState = { error?: string; ok?: string } | undefined;

export async function sendNotice(_: NoticeState, f: FormData): Promise<NoticeState> {
  const s = await getSession();
  if (!s.can("users", "update") && !s.can("lottery_admin", "update")) return { error: "No tienes permiso para enviar avisos" };
  const title = String(f.get("title") ?? "").trim().slice(0, 60);
  const body = String(f.get("body") ?? "").trim().slice(0, 240);
  const to = String(f.get("to") ?? "all");
  if (!title || !body) return { error: "Escribe un título y un mensaje" };

  const admin = createAdminClient();
  let q = admin.from("profiles").select("id").eq("active", true);
  if (to === "player" || to === "admin") q = q.eq("role", to);
  const { data: people } = await q;
  const ids = (people ?? []).map((p) => p.id);
  const n = await sendPush(ids, { title, body, url: "/" });

  const supabase = await createClient();
  await supabase.rpc("log_notice", { p_title: title, p_body: body, p_to: to, p_devices: n });
  return n
    ? { ok: `Aviso enviado a ${n} ${n === 1 ? "dispositivo" : "dispositivos"}.` }
    : { error: "Nadie tiene los avisos activados todavía. Cuando entren en la app les preguntará si quieren activarlos." };
}
