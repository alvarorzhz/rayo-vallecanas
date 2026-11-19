import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { seasonOf } from "@/lib/finance";
import { shirtName, type Player } from "@/lib/squad";
import { porraNames } from "@/lib/porra-queries";
import { getStandings } from "@/lib/league-table";
import { sendPush } from "@/lib/push";
import { fecha } from "@/lib/format";
import {
  capsuleStage, closest, computeReality, judge, numberText, seerTable, QUESTIONS,
  type Capsule, type CapsuleMessage, type CapsulePrediction, type Reality, type SeerRow, type Stage, type QuestionKey, type Verdict,
} from "@/lib/capsule";

type DB = Awaited<ReturnType<typeof createClient>>;

export type CapsuleState = {
  capsule: Capsule;
  opensAt: string | null;
  stage: Stage;
  counts: { writers: number; messages: number; predictions: number };
};

/** La cápsula de una temporada con su momento (o null si no hay). */
export async function fetchCapsule(supabase: DB, season: string): Promise<CapsuleState | null> {
  const { data: capsule, error } = await supabase.from("time_capsules").select("season, write_until, opens_on, final_position").eq("season", season).maybeSingle<Capsule>();
  if (error || !capsule) return null; // sin cápsula (o falta el SQL de la 4.26.0)
  const [{ data: opensAt }, { data: counts }] = await Promise.all([
    supabase.rpc("capsule_opens_at", { p_season: season }),
    supabase.rpc("capsule_counts", { p_season: season }),
  ]);
  const c = (Array.isArray(counts) ? counts[0] : counts) as CapsuleState["counts"] | null;
  return {
    capsule,
    opensAt: (opensAt as string | null) ?? null,
    stage: capsuleStage(capsule, (opensAt as string | null) ?? null),
    counts: c ?? { writers: 0, messages: 0, predictions: 0 },
  };
}

/** Temporadas con cápsula, de la más nueva a la más antigua. */
export async function fetchCapsuleSeasons(supabase: DB): Promise<string[]> {
  const { data } = await supabase.from("time_capsules").select("season").order("season", { ascending: false });
  return (data ?? []).map((r) => r.season as string);
}

/** Lo mío (lo único que se puede leer mientras está cerrada). */
export async function fetchMine(supabase: DB, season: string, userId: string) {
  const [{ data: preds }, { data: msgs }] = await Promise.all([
    supabase.from("capsule_predictions").select("user_id, question, player_id, number").eq("season", season).eq("user_id", userId).returns<CapsulePrediction[]>(),
    supabase.from("capsule_messages").select("id, user_id, to_player_id, body, created_at").eq("season", season).eq("user_id", userId).order("created_at").returns<CapsuleMessage[]>(),
  ]);
  return { preds: preds ?? [], msgs: msgs ?? [] };
}

export type PickPlayer = { id: string; name: string; number: number | null; photo: string | null; userId: string | null };

/**
 * Jugadores para elegir (predicciones y destinatarios): la plantilla de esa temporada o, si aún
 * no está hecha, la de la temporada más reciente que haya.
 */
export async function fetchPickPlayers(supabase: DB, season: string): Promise<PickPlayer[]> {
  const { data } = await supabase.from("squad_members").select("season, number, status, player:players!inner(id, first_name, last_name, nickname, photo_url, user_id)")
    .lte("season", season).order("season", { ascending: false }).limit(400);
  const rows = (data ?? []) as unknown as { season: string; number: number | null; status: string; player: Player }[];
  const target = rows[0]?.season;
  return rows.filter((r) => r.season === target && r.status !== "left")
    .map((r) => ({ id: r.player.id, name: shirtName(r.player), number: r.number, photo: r.player.photo_url ?? null, userId: r.player.user_id ?? null }))
    .sort((a, b) => (a.number ?? 100) - (b.number ?? 100) || a.name.localeCompare(b.name, "es"));
}

/** Nombres de unos jugadores (aunque ya no estén en la plantilla). */
async function playerNames(supabase: DB, ids: string[]) {
  const out = new Map<string, { name: string; photo: string | null; userId: string | null }>();
  if (!ids.length) return out;
  const { data } = await supabase.from("players").select("id, first_name, last_name, nickname, photo_url, user_id").in("id", ids);
  for (const p of (data ?? []) as Player[]) out.set(p.id, { name: shirtName(p), photo: p.photo_url ?? null, userId: p.user_id ?? null });
  return out;
}

/** La realidad de la temporada: actas de los partidos jugados y el puesto final. */
async function fetchReality(supabase: DB, c: Capsule): Promise<Reality> {
  const { data: ms } = await supabase.from("matches").select("id, goals_for, goals_against, mvp_player_id").eq("season", c.season).eq("status", "played");
  const ids = (ms ?? []).map((m) => m.id as string);
  const [{ data: apps }, { data: goals }] = ids.length
    ? await Promise.all([
        supabase.from("match_appearances").select("match_id, player_id, yellows, red").in("match_id", ids),
        supabase.from("match_goals").select("match_id, scorer_id, assist_id").in("match_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  let position = c.final_position;
  // El puesto se apunta una vez, con la clasificación de la liga, si la cápsula es de la temporada en curso
  if (!position && c.season === seasonOf()) {
    const st = await getStandings(supabase, 3000).catch(() => null);
    const me = st?.table.rows.find((r) => r.teamId === st.us);
    if (me?.pos) {
      position = me.pos;
      await createAdminClient().from("time_capsules").update({ final_position: me.pos }).eq("season", c.season).is("final_position", null);
    }
  }
  return computeReality({ matches: (ms ?? []) as never, apps: (apps ?? []) as never, goals: (goals ?? []) as never }, position);
}

export type GalaPick = { user: string; name: string; avatar: string | null; me: boolean; answer: string; verdict: Verdict; closest: boolean };
export type GalaQuestion = { key: QuestionKey; label: string; emoji: string; truth: string | null; truthPhoto: string | null; picks: GalaPick[] };
export type GalaMessage = { id: string; from: string; fromAvatar: string | null; to: string | null; toMe: boolean; mine: boolean; self: boolean; body: string };
export type Gala = {
  season: string;
  writers: number;
  questions: GalaQuestion[];
  seers: (SeerRow & { name: string; avatar: string | null; me: boolean })[];
  messages: GalaMessage[];
};

/** Todo lo de la gala. Solo funciona con la cápsula abierta: antes la base de datos no deja leer lo de los demás. */
export async function fetchGala(supabase: DB, c: Capsule, userId: string): Promise<Gala> {
  const [{ data: predRows }, { data: msgRows }, reality] = await Promise.all([
    supabase.from("capsule_predictions").select("user_id, question, player_id, number").eq("season", c.season).returns<CapsulePrediction[]>(),
    supabase.from("capsule_messages").select("id, user_id, to_player_id, body, created_at").eq("season", c.season).order("created_at").returns<CapsuleMessage[]>(),
    fetchReality(supabase, c),
  ]);
  const preds = predRows ?? [];
  const msgs = msgRows ?? [];
  const userIds = [...new Set([...preds.map((p) => p.user_id), ...msgs.map((m) => m.user_id)])];
  const truthIds = QUESTIONS.flatMap((q) => { const t = reality[q.key]; return t && "players" in t ? t.players : []; });
  const playerIds = [...new Set([...preds.map((p) => p.player_id), ...msgs.map((m) => m.to_player_id), ...truthIds].filter(Boolean) as string[])];
  const [people, players] = await Promise.all([porraNames(userIds), playerNames(supabase, playerIds)]);
  const nameOf = (u: string) => people.get(u)?.name ?? "Alguien";
  const pName = (id: string | null) => (id ? players.get(id)?.name ?? "un excompañero" : "");

  const questions: GalaQuestion[] = QUESTIONS.map((q) => {
    const truth = reality[q.key];
    const near = new Set(closest(preds, q.key, truth));
    const truthText = !truth ? null : "players" in truth ? `${truth.players.map((id) => pName(id)).join(", ")} (${numberText(q, truth.value)})` : numberText(q, truth.number);
    const picks = preds.filter((p) => p.question === q.key).map((p) => ({
      user: p.user_id, name: nameOf(p.user_id), avatar: people.get(p.user_id)?.avatar ?? null, me: p.user_id === userId,
      answer: p.player_id ? pName(p.player_id) : q.key === "position" ? `${p.number}º` : String(p.number),
      verdict: judge(p, truth), closest: near.has(p.user_id) && near.size < preds.filter((x) => x.question === q.key).length,
    })).sort((a, b) => (b.verdict?.points ?? 0) - (a.verdict?.points ?? 0) || a.name.localeCompare(b.name, "es"));
    const photo = truth && "players" in truth && truth.players.length === 1 ? players.get(truth.players[0])?.photo ?? null : null;
    return { key: q.key, label: q.label, emoji: q.emoji, truth: truthText, truthPhoto: photo, picks };
  }).filter((q) => q.picks.length > 0);

  const seers = seerTable(preds, reality).map((r) => ({ ...r, name: nameOf(r.user_id), avatar: people.get(r.user_id)?.avatar ?? null, me: r.user_id === userId }));
  const messages: GalaMessage[] = msgs.map((m) => {
    const to = m.to_player_id ? players.get(m.to_player_id) : null;
    return {
      id: m.id, from: nameOf(m.user_id), fromAvatar: people.get(m.user_id)?.avatar ?? null,
      to: m.to_player_id ? pName(m.to_player_id) : null, toMe: !!to?.userId && to.userId === userId,
      mine: m.user_id === userId, self: !!to?.userId && to.userId === m.user_id, body: m.body,
    };
  });
  return { season: c.season, writers: userIds.length, questions, seers, messages };
}

export type CapsuleHome = { season: string; stage: Stage; writeUntil: string; opensAt: string | null; wrote: boolean };

/**
 * Para Inicio: una cápsula abierta en las últimas 3 semanas (la gala) o una en la que aún se
 * puede escribir y en la que yo no he escrito nada.
 */
export async function fetchCapsuleHome(supabase: DB, userId: string): Promise<CapsuleHome | null> {
  const { data, error } = await supabase.from("time_capsules").select("season, write_until, opens_on").order("season", { ascending: false }).limit(3);
  if (error || !data?.length) return null;
  const rows = await Promise.all((data as Pick<Capsule, "season" | "write_until" | "opens_on">[]).map(async (c) => {
    const { data: opensAt } = await supabase.rpc("capsule_opens_at", { p_season: c.season });
    return { c, opensAt: (opensAt as string | null) ?? null, stage: capsuleStage(c, (opensAt as string | null) ?? null) };
  }));
  // Primero la gala recién abierta (manda sobre la invitación a escribir en la siguiente)
  const fresh = rows.find((r) => r.stage === "open" && Date.now() - new Date(r.opensAt as string).getTime() < 21 * 86_400_000);
  if (fresh) return { season: fresh.c.season, stage: "open", writeUntil: fresh.c.write_until, opensAt: fresh.opensAt, wrote: true };
  for (const { c, opensAt, stage } of rows) {
    if (stage === "writing") {
      const [{ count: p }, { count: m }] = await Promise.all([
        supabase.from("capsule_predictions").select("question", { count: "exact", head: true }).eq("season", c.season).eq("user_id", userId),
        supabase.from("capsule_messages").select("id", { count: "exact", head: true }).eq("season", c.season).eq("user_id", userId),
      ]);
      if (!(p ?? 0) && !(m ?? 0)) return { season: c.season, stage, writeUntil: c.write_until, opensAt, wrote: false };
    }
  }
  return null;
}

/**
 * Avisos de la cápsula (cron de la noche y al abrir Inicio). Nunca lanza error.
 * - Al abrirse: «¡Se abre la cápsula!» a todo el equipo (una sola vez: solo avisa quien pone la marca).
 * - 3 días antes de cerrarse: recordatorio a quien aún no ha escrito nada (una sola vez).
 * Solo cuenta quién ha escrito, nunca lee lo que pone.
 */
export async function capsuleTick(): Promise<{ opened: string[]; reminded: string[] }> {
  const out = { opened: [] as string[], reminded: [] as string[] };
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("time_capsules").select("season, write_until, opened_notified, reminded").or("opened_notified.eq.false,reminded.eq.false");
    if (!data?.length) return out;
    const { data: people } = await admin.from("profiles").select("id").eq("active", true);
    const everyone = (people ?? []).map((p) => p.id as string);
    for (const c of data as { season: string; write_until: string; opened_notified: boolean; reminded: boolean }[]) {
      const { data: open } = await admin.rpc("capsule_is_open", { p_season: c.season });
      if (open && !c.opened_notified) {
        const { data: won } = await admin.from("time_capsules").update({ opened_notified: true, reminded: true }).eq("season", c.season).eq("opened_notified", false).select("season");
        if (won?.length) {
          out.opened.push(c.season);
          await sendPush(everyone, {
            title: "🔓 ¡Se abre la cápsula del tiempo!",
            body: `Lo que escribisteis al empezar la temporada ${c.season} ya se puede leer. ¿Quién fue el pitoniso?`,
            url: `/partidos/capsula/gala?temporada=${c.season.replace("/", "-")}`, tag: `capsula-${c.season}`,
          });
        }
        continue;
      }
      const left = new Date(c.write_until).getTime() - Date.now();
      if (!open && !c.reminded && left > 0 && left < 3 * 86_400_000) {
        const { data: won } = await admin.from("time_capsules").update({ reminded: true }).eq("season", c.season).eq("reminded", false).select("season");
        if (!won?.length) continue;
        const [{ data: p }, { data: m }] = await Promise.all([
          admin.from("capsule_predictions").select("user_id").eq("season", c.season),
          admin.from("capsule_messages").select("user_id").eq("season", c.season),
        ]);
        const wrote = new Set([...(p ?? []), ...(m ?? [])].map((r) => r.user_id as string));
        const pending = everyone.filter((u) => !wrote.has(u));
        out.reminded.push(c.season);
        await sendPush(pending, {
          title: "⏳ La cápsula del tiempo se cierra pronto",
          body: `Tienes hasta el ${fecha(c.write_until)} para dejar tus predicciones y un mensaje para final de temporada.`,
          url: `/partidos/capsula?temporada=${c.season.replace("/", "-")}`, tag: `capsula-recordar-${c.season}`,
        });
      }
    }
  } catch (e) {
    console.error("No se ha podido revisar la cápsula del tiempo:", e instanceof Error ? e.message : e);
  }
  return out;
}
