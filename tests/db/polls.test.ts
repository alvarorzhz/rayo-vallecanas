/**
 * 4.29.1 · Votaciones en directo: qué devuelve poll_board() a cada uno según la votación esté
 * abierta o cerrada, sea en directo o no, y sea secreta o no.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { admin, as, ok } from "./helpers.ts";

type Board = { id: string; live: boolean; votes: number; yes: number | null; no: number | null; voters: { name: string; vote: boolean; voted_at: string }[] | null; missing: string[] | null };

const created: string[] = [];

/** Votación con votos de Álvaro (sí), Rubén (sí) y Javi (no); Dani no vota. */
async function poll(o: { live: boolean; anonymous?: boolean; open?: boolean }) {
  const p = ok(await admin.from("polls").insert({
    question: `Prueba en directo ${created.length}`, audience: "all", anonymous: o.anonymous ?? false, live: o.live,
    closes_at: new Date(Date.now() + 3600_000).toISOString(),
  }).select("id").single()) as { id: string };
  created.push(p.id);
  for (const who of ["superadmin", "gestor", "javi"] as const) {
    const s = await as(who);
    ok(await s.db.rpc("poll_vote", { p_poll: p.id, p_vote: who !== "javi" }));
  }
  if (o.open === false) ok(await admin.from("polls").update({ closes_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", p.id));
  return p.id;
}

async function board(who: "superadmin" | "gestor" | "dani" | "javi", id: string) {
  const s = await as(who);
  const rows = ok(await s.db.rpc("poll_board", { p_poll: id })) as Board[];
  return rows[0];
}

describe("votaciones en directo", () => {
  let normal: string, live: string, liveSecret: string, closed: string;
  before(async () => {
    normal = await poll({ live: false });
    live = await poll({ live: true });
    liveSecret = await poll({ live: true, anonymous: true });
    closed = await poll({ live: false, open: false });
  });
  after(async () => { await admin.from("polls").delete().in("id", created); });

  test("normal y abierta: un jugador solo sabe cuántos han votado", async () => {
    const b = await board("dani", normal);
    assert.equal(b.votes, 3);
    assert.equal(b.yes, null);
    assert.equal(b.no, null);
    assert.equal(b.voters, null);
  });

  test("normal y abierta: el gestor ve el recuento y quién falta, pero no qué ha votado cada uno", async () => {
    const b = await board("gestor", normal);
    assert.equal(b.yes, 2);
    assert.equal(b.no, 1);
    assert.equal(b.voters, null);
    assert.deepEqual(b.missing, ["Dani García"]);
  });

  test("en directo: un jugador que aún no ha votado ve el recuento y quién ha votado qué, el último primero", async () => {
    const b = await board("dani", live);
    assert.equal(b.live, true);
    assert.equal(b.yes, 2);
    assert.equal(b.no, 1);
    assert.equal(b.voters?.length, 3);
    assert.deepEqual(b.voters![0], { ...b.voters![0], name: "Javi Martín", vote: false });
    assert.ok(b.voters![0].voted_at >= b.voters![2].voted_at);
    assert.equal(b.missing, null); // quién falta sigue siendo solo para gestores
  });

  test("en directo pero secreta: recuento sí, nombres nunca", async () => {
    const b = await board("dani", liveSecret);
    assert.equal(b.yes, 2);
    assert.equal(b.voters, null);
    assert.equal((await board("superadmin", liveSecret)).voters, null);
  });

  test("al cerrar, todos ven el resultado y los votos", async () => {
    const b = await board("dani", closed);
    assert.equal(b.yes, 2);
    assert.equal(b.voters?.length, 3);
  });

  test("solo quien gestiona puede poner o quitar el directo", async () => {
    const javi = await as("javi");
    await javi.db.from("polls").update({ live: true }).eq("id", normal);
    assert.equal((await board("dani", normal)).live, false);
    const gestor = await as("gestor");
    ok(await gestor.db.from("polls").update({ live: true }).eq("id", normal));
    assert.equal((await board("dani", normal)).voters?.length, 3);
  });
});
