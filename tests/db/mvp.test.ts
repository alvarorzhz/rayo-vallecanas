/**
 * 4.28.3 · Recuento del MVP contra la base de datos de verdad. Orden: más votos; si empatan,
 * la mejor nota media del partido (con 2 notas o más); luego más goles; y si aún siguen
 * empatados, lo elige un gestor.
 */
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { admin, as, ok, PEOPLE } from "./helpers.ts";

type Finish = { just_closed: boolean; winner_id: string | null; votes: number; tie: boolean };

const people: Record<string, string> = {};
let A: string, B: string, C: string; // tres jugadores que jugaron

/**
 * Partido jugado con su votación ya cerrada. Los votos, notas y goles se meten con la clave de
 * servicio (las reglas de quién vota a quién ya las vigila mvp_vote/rating_set).
 * votes: jugador votado por cada persona · ratings: [jugador, nota] por persona · goals: goleadores.
 */
async function closedPoll(p: { votes: string[]; ratings?: Record<string, [string, number][]>; goals?: string[] }) {
  const rival = ok(await admin.from("rivals").select("id").limit(1).single()) as { id: string };
  const m = ok(await admin.from("matches").insert({
    match_date: "2031-03-02", kickoff: "11:00", rival_id: rival.id, competition: "friendly",
    status: "played", goals_for: p.goals?.length ?? 0, goals_against: 0,
  }).select("id").single()) as { id: string };
  ok(await admin.from("mvp_polls").insert({ match_id: m.id, candidates: [A, B, C], closes_at: new Date(Date.now() + 3600_000).toISOString() }));
  const voters = Object.values(people);
  if (p.votes.length) ok(await admin.from("mvp_votes").insert(p.votes.map((c, i) => ({ match_id: m.id, voter_id: voters[i], candidate_id: c }))));
  const rows = Object.entries(p.ratings ?? {}).flatMap(([who, list]) => list.map(([player, score]) => ({ match_id: m.id, voter_id: people[who], player_id: player, score })));
  if (rows.length) ok(await admin.from("player_ratings").insert(rows));
  if (p.goals?.length) ok(await admin.from("match_goals").insert(p.goals.map((g, i) => ({ match_id: m.id, scorer_id: g, sort: i }))));
  ok(await admin.from("mvp_polls").update({ closes_at: new Date(Date.now() - 60_000).toISOString() }).eq("match_id", m.id));
  return m.id;
}

async function finish(matchId: string) {
  const gestor = await as("gestor");
  const r = ok(await gestor.db.rpc("mvp_finish", { p_match: matchId })) as Finish;
  const poll = ok(await admin.from("mvp_polls").select("winner_id, tie_ids").eq("match_id", matchId).single()) as { winner_id: string | null; tie_ids: string[] | null };
  const match = ok(await admin.from("matches").select("mvp_player_id").eq("id", matchId).single()) as { mvp_player_id: string | null };
  await admin.from("matches").delete().eq("id", matchId);
  return { r, poll, mvp: match.mvp_player_id };
}

describe("desempate del MVP", () => {
  before(async () => {
    for (const [k, email] of Object.entries(PEOPLE)) people[k] = (ok(await admin.from("profiles").select("id").eq("email", email).single()) as { id: string }).id;
    const ps = ok(await admin.from("players").select("id").order("created_at").limit(3)) as { id: string }[];
    [A, B, C] = ps.map((x) => x.id);
  });

  test("sin empate gana el más votado, aunque tenga peor nota y menos goles", async () => {
    const m = await closedPoll({ votes: [A, A, B, C], ratings: { superadmin: [[B, 10]], gestor: [[B, 10]] }, goals: [B, B] });
    const { r, mvp } = await finish(m);
    assert.equal(r.winner_id, A);
    assert.equal(r.votes, 2);
    assert.equal(mvp, A);
  });

  test("empate a votos: gana la mejor nota del partido, aunque el otro marcara más", async () => {
    const m = await closedPoll({
      votes: [A, A, B, B],
      ratings: { superadmin: [[A, 6], [B, 8]], gestor: [[A, 7], [B, 8.5]], dani: [[A, 9]] },
      goals: [A, A, A],
    });
    const { r, poll, mvp } = await finish(m);
    assert.equal(r.winner_id, B);
    assert.equal(r.tie, false);
    assert.equal(poll.tie_ids, null);
    assert.equal(mvp, B);
  });

  test("una nota suelta no hace media: va detrás de quien tiene 2 o más", async () => {
    const m = await closedPoll({ votes: [A, A, B, B], ratings: { superadmin: [[A, 10], [B, 5]], gestor: [[B, 5.5]] } });
    const { r } = await finish(m);
    assert.equal(r.winner_id, B);
  });

  test("solo cuenta la nota de los empatados: un tercero con mejor nota no se mete", async () => {
    const m = await closedPoll({
      votes: [A, A, B, B],
      ratings: { superadmin: [[A, 7], [B, 6], [C, 10]], gestor: [[A, 7], [B, 6], [C, 10]] },
    });
    const { r } = await finish(m);
    assert.equal(r.winner_id, A);
  });

  test("empate a votos y a nota: gana el que más goles metió", async () => {
    const m = await closedPoll({
      votes: [A, A, B, B],
      ratings: { superadmin: [[A, 8], [B, 7]], gestor: [[A, 7], [B, 8]] },
      goals: [B, A, B],
    });
    const { r } = await finish(m);
    assert.equal(r.winner_id, B);
  });

  test("sin notas suficientes de nadie, se pasa directamente a los goles", async () => {
    const m = await closedPoll({ votes: [A, A, B, B], ratings: { superadmin: [[A, 10]] }, goals: [B] });
    const { r } = await finish(m);
    assert.equal(r.winner_id, B);
  });

  test("empate a votos, nota y goles: decide un gestor entre los empatados", async () => {
    const m = await closedPoll({
      votes: [A, A, B, B],
      ratings: { superadmin: [[A, 8], [B, 8]], gestor: [[A, 7], [B, 7]] },
      goals: [A, B],
    });
    const { r, poll, mvp } = await finish(m);
    assert.equal(r.winner_id, null);
    assert.equal(r.tie, true);
    assert.deepEqual([...(poll.tie_ids ?? [])].sort(), [A, B].sort());
    assert.equal(mvp, null);
  });

  test("el gestor elige al MVP entre los empatados", async () => {
    const m = await closedPoll({ votes: [A, A, B, B] });
    const gestor = await as("gestor");
    const r = ok(await gestor.db.rpc("mvp_finish", { p_match: m })) as Finish;
    assert.equal(r.tie, true);
    ok(await gestor.db.rpc("mvp_pick", { p_match: m, p_player: B }));
    const match = ok(await admin.from("matches").select("mvp_player_id").eq("id", m).single()) as { mvp_player_id: string | null };
    assert.equal(match.mvp_player_id, B);
    await admin.from("matches").delete().eq("id", m);
  });
});
