import "server-only";
import { after } from "next/server";
import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { CLUB_NAME, type MatchRow } from "@/lib/matches";
import { shirtName, type Player } from "@/lib/squad";
import { votesLabel, type MvpBoard } from "@/lib/mvp";

type DB = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

type FinishResult = { just_closed: boolean; winner_id?: string | null; votes?: number; tie?: boolean };

const scoreLine = (m: Pick<MatchRow, "is_home" | "goals_for" | "goals_against"> & { rival: { name: string } }) =>
  m.is_home ? `${CLUB_NAME} ${m.goals_for}-${m.goals_against} ${m.rival.name}` : `${m.rival.name} ${m.goals_against}-${m.goals_for} ${CLUB_NAME}`;

/** Personas activas de la app (todas pueden votar). */
export async function activeUsers(except?: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id").eq("active", true);
  return (data ?? []).map((p) => p.id as string).filter((id) => id !== except);
}

/**
 * Tablero de la votación de un partido. Si ya pasó la hora de cierre y nadie ha hecho
 * el recuento, lo hace ahora (y el aviso del ganador sale en segundo plano).
 */
export async function fetchMvpBoard(supabase: DB, matchId: string): Promise<MvpBoard | null> {
  const get = async () => ((await supabase.rpc("mvp_board", { p_match: matchId })).data ?? null) as MvpBoard | null;
  const b = await get();
  if (!b || b.open || b.counted) return b;
  const r = await finishMvp(supabase, matchId, true);
  return r.just_closed ? get() : b;
}

/** Hace el recuento (si toca) y avisa del resultado. inBackground: el aviso sale después de responder. */
export async function finishMvp(supabase: DB, matchId: string, inBackground = false): Promise<FinishResult> {
  const { data, error } = await supabase.rpc("mvp_finish", { p_match: matchId });
  const r = (error ? { just_closed: false } : data) as FinishResult;
  if (r.just_closed) {
    if (inBackground) after(() => announceMvp(matchId, r));
    else await announceMvp(matchId, r);
  }
  return r;
}

/** Aviso al cerrar: el ganador a todo el equipo; si hay empate, a los gestores para que decidan. */
async function announceMvp(matchId: string, r: FinishResult) {
  const admin = createAdminClient();
  const { data: m } = await admin.from("matches").select("*, rival:rivals!inner(*)").eq("id", matchId).maybeSingle<MatchRow>();
  if (!m) return 0;
  if (r.winner_id) {
    const { data: p } = await admin.from("players").select("*").eq("id", r.winner_id).maybeSingle<Player>();
    return sendPush(await activeUsers(), {
      title: `⭐ MVP del partido: ${p ? shirtName(p) : "ya hay ganador"}`,
      body: `${scoreLine(m)} · Lo ha elegido el equipo con ${votesLabel(r.votes ?? 0)}.`,
      url: `/partidos/${matchId}#mvp`,
      tag: `mvp-${matchId}`,
    });
  }
  if (r.tie) {
    const { data } = await admin.rpc("users_with_perm", { p_module: "matches", p_action: "update" });
    return sendPush((data ?? []) as string[], {
      title: "⭐ Empate en el MVP: decide tú",
      body: `${scoreLine(m)} · Hay empate a votos y a goles. Elige al MVP en la ficha del partido.`,
      url: `/partidos/${matchId}#mvp`,
      tag: `mvp-${matchId}`,
    });
  }
  return 0;
}

/** Aviso al abrir la votación (con el resumen del acta si se pidió «Avisar»). */
export async function announceMvpOpen(m: MatchRow, until: string, opts: { except?: string; scorers?: string } = {}) {
  const body = [scoreLine(m), opts.scorers && `⚽ ${opts.scorers}`, `Vota al mejor del partido ${until}.`].filter(Boolean).join(" · ");
  return sendPush(await activeUsers(opts.except), {
    title: "⭐ Vota al MVP del partido",
    body,
    url: `/partidos/${m.id}#mvp`,
    tag: `mvp-${m.id}`,
  });
}
