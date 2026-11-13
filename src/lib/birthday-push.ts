import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { seasonOf } from "@/lib/finance";
import { shirtName, type Player } from "@/lib/squad";
import { birthdays } from "@/lib/birthdays";

/**
 * Avisos de cumpleaños (los lanza el cron de cada mañana): al equipo, para que le felicite,
 * y al propio jugador. Cada cumpleaños se avisa una sola vez al año (se mira el registro de avisos).
 */
export async function birthdayPushes(today: string) {
  const admin = createAdminClient();
  const season = seasonOf();
  const year = today.slice(0, 4);
  const [{ data: priv }, { data: members }] = await Promise.all([
    admin.from("player_private").select("player_id, birth_date").not("birth_date", "is", null),
    admin.from("squad_members").select("player_id, status, player:players!inner(*)").eq("season", season).neq("status", "left")
      .returns<{ player_id: string; status: string; player: Player }[]>(),
  ]);
  const inSquad = new Map((members ?? []).map((m) => [m.player_id, m.player]));
  const rows = (priv ?? []).filter((p) => inSquad.has(p.player_id as string)).map((p) => {
    const d = String(p.birth_date);
    return { player_id: p.player_id as string, month: Number(d.slice(5, 7)), day: Number(d.slice(8, 10)) };
  });
  const list = birthdays(rows, today).today;
  if (!list.length) return 0;
  const { data: people } = await admin.from("profiles").select("id").eq("active", true);
  const everyone = (people ?? []).map((p) => p.id as string);
  let sent = 0;
  for (const r of list) {
    const tag = `cumple-${r.player_id}-${year}`;
    const { count } = await admin.from("push_log").select("id", { count: "exact", head: true }).eq("tag", tag);
    if (count) continue;
    const p = inSquad.get(r.player_id)!;
    const name = shirtName(p);
    sent += await sendPush(everyone.filter((id) => id !== p.user_id), { title: `🎂 Hoy cumple ${name}`, body: "¡Felicítale desde Inicio! Un toque y le llega. ⚡", url: "/", tag });
    if (p.user_id) sent += await sendPush([p.user_id], { title: `🎂 ¡Feliz cumpleaños, ${name}!`, body: "Todo el Rayo te desea un gran día. ⚡", url: "/", tag: `cumple-yo-${r.player_id}-${year}` });
  }
  return sent;
}
