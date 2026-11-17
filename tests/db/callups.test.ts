/**
 * Convocatorias contra la base de datos de verdad: quién contesta, cuándo, y qué ve cada uno.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { admin, as, ok, rejects } from "./helpers.ts";

type Reply = "pending" | "yes" | "no" | "maybe";

async function playerOf(email: string) {
  const p = ok(await admin.from("profiles").select("id").eq("email", email).single()) as { id: string };
  return (ok(await admin.from("players").select("id").eq("user_id", p.id).single()) as { id: string }).id;
}

/** Partido por jugar, con Dani convocado (Javi no). Por defecto, la convocatoria ya publicada. */
async function matchWithCallup(p: { published?: boolean; status?: string } = {}) {
  const rival = ok(await admin.from("rivals").select("id").limit(1).single()) as { id: string };
  const d = new Date(Date.now() + 5 * 86400_000).toISOString().slice(0, 10);
  const m = ok(await admin.from("matches").insert({
    match_date: d, kickoff: "18:30", rival_id: rival.id, competition: "friendly", status: p.status ?? "scheduled",
    callup_published_at: p.published === false ? null : new Date().toISOString(),
    ...(p.status === "played" ? { goals_for: 2, goals_against: 1 } : {}),
  }).select("id").single()) as { id: string };
  const gestor = await as("gestor");
  ok(await gestor.db.from("match_callups").insert({ match_id: m.id, player_id: await playerOf("dani@rayo.test") }));
  return m.id;
}
const replyOf = async (matchId: string) =>
  ok(await admin.from("match_callups").select("reply, reply_note, replied_by").eq("match_id", matchId).single()) as { reply: Reply; reply_note: string | null; replied_by: string | null };

describe("contestar a la convocatoria", () => {
  test("el convocado contesta y puede cambiar de opinión; la nota se recorta a 140 letras", async () => {
    const m = await matchWithCallup();
    const dani = await as("dani");
    ok(await dani.db.rpc("callup_reply", { p_match: m, p_reply: "maybe", p_note: "Depende del trabajo" }));
    assert.deepEqual(await replyOf(m), { reply: "maybe", reply_note: "Depende del trabajo", replied_by: dani.id });
    ok(await dani.db.rpc("callup_reply", { p_match: m, p_reply: "yes", p_note: "x".repeat(300) }));
    const r = await replyOf(m);
    assert.equal(r.reply, "yes");
    assert.equal(r.reply_note?.length, 140);
    ok(await dani.db.rpc("callup_reply", { p_match: m, p_reply: "no", p_note: "   " }));
    assert.equal((await replyOf(m)).reply_note, null);
  });

  test("no se puede volver a «sin responder»", async () => {
    const m = await matchWithCallup();
    const dani = await as("dani");
    await rejects(dani.db.rpc("callup_reply", { p_match: m, p_reply: "pending" }), /Respuesta no válida/);
  });

  test("quien no está convocado, o no tiene ficha de jugador, no contesta", async () => {
    const m = await matchWithCallup();
    const javi = await as("javi"), gestor = await as("gestor");
    await rejects(javi.db.rpc("callup_reply", { p_match: m, p_reply: "yes" }), /No estás convocado/);
    await rejects(gestor.db.rpc("callup_reply", { p_match: m, p_reply: "yes" }), /No tienes ficha de jugador/);
    assert.equal((await replyOf(m)).reply, "pending");
  });

  test("sin publicar, ya jugado o suspendido, la convocatoria está cerrada", async () => {
    const dani = await as("dani");
    for (const p of [{ published: false }, { status: "played" }, { status: "cancelled" }]) {
      const m = await matchWithCallup(p);
      await rejects(dani.db.rpc("callup_reply", { p_match: m, p_reply: "yes" }), /ya está cerrada/);
    }
    // Aplazado: se sigue pudiendo contestar
    const m = await matchWithCallup({ status: "postponed" });
    ok(await dani.db.rpc("callup_reply", { p_match: m, p_reply: "yes" }));
  });
});

describe("qué puede tocar cada uno", () => {
  test("un jugador no cambia la respuesta de otro ni se convoca él mismo", async () => {
    const m = await matchWithCallup();
    const javi = await as("javi");
    // RLS: el UPDATE no encuentra filas que pueda tocar y no cambia nada
    ok(await javi.db.from("match_callups").update({ reply: "no" }).eq("match_id", m));
    assert.equal((await replyOf(m)).reply, "pending");
    await rejects(javi.db.from("match_callups").insert({ match_id: m, player_id: await playerOf("javi@rayo.test") }), /row-level security/);
  });

  test("el borrador de la convocatoria solo lo ven los gestores", async () => {
    const m = await matchWithCallup({ published: false });
    const dani = await as("dani"), gestor = await as("gestor");
    assert.equal((ok(await dani.db.from("match_callups").select("id").eq("match_id", m)) as unknown[]).length, 0);
    assert.equal((ok(await gestor.db.from("match_callups").select("id").eq("match_id", m)) as unknown[]).length, 1);
    ok(await admin.from("matches").update({ callup_published_at: new Date().toISOString() }).eq("id", m));
    assert.equal((ok(await dani.db.from("match_callups").select("id").eq("match_id", m)) as unknown[]).length, 1);
  });

  test("un jugador no aparece dos veces ni dos ocupan el mismo puesto de la alineación", async () => {
    const m = await matchWithCallup();
    const gestor = await as("gestor");
    await rejects(gestor.db.from("match_callups").insert({ match_id: m, player_id: await playerOf("dani@rayo.test") }), /duplicate key/);
    ok(await gestor.db.from("match_callups").insert({ match_id: m, player_id: await playerOf("javi@rayo.test"), slot: 1 }));
    await rejects(gestor.db.from("match_callups").update({ slot: 1 }).eq("match_id", m).eq("player_id", await playerOf("dani@rayo.test")), /duplicate key/);
  });
});
