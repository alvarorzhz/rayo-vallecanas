import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { replyButtons, usersOfPlayers } from "@/lib/callup-push";
import { CLUB_NAME, hhmm, todayMadrid, type MatchRow } from "@/lib/matches";
import { sponsorReminders } from "@/lib/sponsor-alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Recordatorio diario de las convocatorias (lo lanza Vercel Cron cada mañana).
 * · Víspera: a los convocados que no han contestado.
 * · Día del partido: a los que van o dudan, con la hora de quedada.
 * Cada partido recibe como mucho un recordatorio al día, así que repetir la llamada no molesta a nadie.
 * De paso, avisa a los gestores de los plazos de patrocinio sin cobrar y de los acuerdos que vencen.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const admin = createAdminClient();
  const today = todayMadrid();
  const tomorrow = todayMadrid(new Date(Date.now() + 24 * 3600 * 1000));
  const { data: matches } = await admin.from("matches").select("*, rival:rivals!inner(*)")
    .not("callup_published_at", "is", null).eq("status", "scheduled").in("match_date", [today, tomorrow]).returns<MatchRow[]>();

  let sent = 0;
  for (const m of matches ?? []) {
    if (m.callup_reminded_at && todayMadrid(new Date(m.callup_reminded_at)) === today) continue;
    await admin.from("matches").update({ callup_reminded_at: new Date().toISOString() }).eq("id", m.id);

    const isToday = m.match_date === today;
    const { data: rows } = await admin.from("match_callups").select("player_id, reply").eq("match_id", m.id)
      .in("reply", isToday ? ["yes", "maybe", "pending"] : ["pending"]);
    const users = await usersOfPlayers((rows ?? []).map((r) => r.player_id as string));
    if (!users.length) continue;
    const vs = m.is_home ? `${CLUB_NAME} vs ${m.rival.name}` : `${m.rival.name} vs ${CLUB_NAME}`;
    const meet = m.meet_time || m.meet_place ? ` Quedamos${m.meet_time ? ` a las ${hhmm(m.meet_time)}` : ""}${m.meet_place ? ` en ${m.meet_place}` : ""}.` : "";
    sent += await sendPush(users, isToday
      ? { title: "⚽ ¡Hoy jugamos!", body: `${vs}${m.kickoff ? ` a las ${hhmm(m.kickoff)}` : ""}${m.venue ? ` · ${m.venue}` : ""}.${meet}`, url: `/partidos/${m.id}`, tag: `convocatoria-${m.id}` }
      : { title: "⏰ Mañana hay partido: ¿vas?", body: `${vs}${m.kickoff ? ` a las ${hhmm(m.kickoff)}` : ""}. Aún no has contestado a la convocatoria.`, url: `/partidos/${m.id}`, tag: `convocatoria-${m.id}` },
      isToday ? undefined : await replyButtons(m.id, m.match_date));
  }
  const sponsors = await sponsorReminders(today);
  return NextResponse.json({ ok: true, matches: matches?.length ?? 0, sent, sponsors });
}
