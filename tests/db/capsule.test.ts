/**
 * 4.26.0 · La cápsula del tiempo contra la base de datos de verdad: lo de cada uno queda bajo llave
 * (ni gestores ni superadministradores lo leen) hasta que se abre, y se abre para todos a la vez.
 */
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { admin, as, ok, rejects } from "./helpers.ts";

const SEASON = "2031/32"; // temporada sin partidos en los datos de ejemplo
const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
const at = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();

async function playerOf(email: string) {
  const p = ok(await admin.from("profiles").select("id").eq("email", email).single()) as { id: string };
  return (ok(await admin.from("players").select("id").eq("user_id", p.id).single()) as { id: string }).id;
}

/** Deja la cápsula de pruebas recién creada (y vacía), abierta para escribir. */
async function freshCapsule() {
  await admin.from("capsule_predictions").delete().eq("season", SEASON);
  await admin.from("capsule_messages").delete().eq("season", SEASON);
  await admin.from("matches").delete().eq("season", SEASON);
  await admin.from("time_capsules").delete().eq("season", SEASON);
  const gestor = await as("gestor");
  ok(await gestor.db.from("time_capsules").insert({ season: SEASON, write_until: at(10), opens_on: day(400) }));
}

/** Mueve las fechas con la clave de servicio (como si pasara el tiempo). */
async function setDates(writeUntilDays: number, opensOnDays: number) {
  ok(await admin.from("time_capsules").update({ write_until: at(writeUntilDays), opens_on: day(opensOnDays) }).eq("season", SEASON));
}

describe("cápsula del tiempo", () => {
  let dani: Awaited<ReturnType<typeof as>>, javi: Awaited<ReturnType<typeof as>>, gestor: Awaited<ReturnType<typeof as>>, alvaro: Awaited<ReturnType<typeof as>>;
  let daniPlayer: string, javiPlayer: string;
  before(async () => {
    [dani, javi, gestor, alvaro] = await Promise.all([as("dani"), as("javi"), as("gestor"), as("superadmin")]);
    [daniPlayer, javiPlayer] = await Promise.all([playerOf("dani@rayo.test"), playerOf("javi@rayo.test")]);
  });

  test("solo quien prepara la temporada crea la cápsula; los jugadores no", async () => {
    await freshCapsule();
    await admin.from("time_capsules").delete().eq("season", "2032/33");
    await rejects(dani.db.from("time_capsules").insert({ season: "2032/33", write_until: at(5), opens_on: day(300) }), /row-level|permission/i);
    // La gala no puede ser antes de que se cierre la cápsula
    await rejects(gestor.db.from("time_capsules").insert({ season: "2032/33", write_until: at(30), opens_on: day(3) }), /gala/);
  });

  test("bajo llave: cada uno lee solo lo suyo, tampoco gestores ni superadministradores", async () => {
    await freshCapsule();
    ok(await dani.db.rpc("capsule_predict", { p_season: SEASON, p_question: "top_scorer", p_player: javiPlayer, p_number: null }));
    ok(await dani.db.rpc("capsule_predict", { p_season: SEASON, p_question: "position", p_player: null, p_number: 3 }));
    ok(await dani.db.rpc("capsule_message_save", { p_season: SEASON, p_id: null, p_to: null, p_body: "Este año subimos" }));
    ok(await javi.db.rpc("capsule_message_save", { p_season: SEASON, p_id: null, p_to: daniPlayer, p_body: "Dani, me debes una cena" }));

    const mine = ok(await dani.db.from("capsule_messages").select("body").eq("season", SEASON)) as { body: string }[];
    assert.deepEqual(mine.map((m) => m.body), ["Este año subimos"]);
    for (const who of [gestor, alvaro, javi]) {
      const preds = ok(await who.db.from("capsule_predictions").select("*").eq("season", SEASON).neq("user_id", who.id)) as unknown[];
      const msgs = ok(await who.db.from("capsule_messages").select("*").eq("season", SEASON).neq("user_id", who.id)) as unknown[];
      assert.equal(preds.length, 0);
      assert.equal(msgs.length, 0);
    }
    // El mensaje para Dani tampoco lo lee Dani antes de tiempo
    const forDani = ok(await dani.db.from("capsule_messages").select("*").eq("season", SEASON).eq("to_player_id", daniPlayer)) as unknown[];
    assert.equal(forDani.length, 0);
    // Los números sí se ven (sin el contenido)
    const counts = ok(await javi.db.rpc("capsule_counts", { p_season: SEASON })) as { writers: number; messages: number; predictions: number }[];
    assert.deepEqual(counts[0], { writers: 2, messages: 2, predictions: 2 });
  });

  test("nadie escribe directamente en las tablas ni toca lo de otro", async () => {
    await freshCapsule();
    await rejects(gestor.db.from("capsule_messages").insert({ season: SEASON, user_id: gestor.id, body: "hola" }), /row-level|permission/i);
    await rejects(dani.db.from("capsule_predictions").insert({ season: SEASON, user_id: dani.id, question: "wins", number: 3 }), /row-level|permission/i);
    const id = ok(await dani.db.rpc("capsule_message_save", { p_season: SEASON, p_id: null, p_to: null, p_body: "mío" })) as string;
    await rejects(javi.db.rpc("capsule_message_save", { p_season: SEASON, p_id: id, p_to: null, p_body: "cambiado" }), /no es tuyo/);
    await rejects(javi.db.rpc("capsule_message_delete", { p_id: id }), /no es tuyo/);
    // Se puede cambiar y borrar lo suyo
    ok(await dani.db.rpc("capsule_message_save", { p_season: SEASON, p_id: id, p_to: javiPlayer, p_body: "mío, cambiado" }));
    ok(await dani.db.rpc("capsule_message_delete", { p_id: id }));
    // No se puede borrar una cápsula con algo escrito
    ok(await dani.db.rpc("capsule_predict", { p_season: SEASON, p_question: "wins", p_player: null, p_number: 12 }));
    await rejects(gestor.db.from("time_capsules").delete().eq("season", SEASON), /no se puede borrar/);
  });

  test("como mucho 12 mensajes por persona", async () => {
    await freshCapsule();
    for (let i = 0; i < 12; i++) ok(await dani.db.rpc("capsule_message_save", { p_season: SEASON, p_id: null, p_to: null, p_body: `Mensaje ${i}` }));
    await rejects(dani.db.rpc("capsule_message_save", { p_season: SEASON, p_id: null, p_to: null, p_body: "uno más" }), /12 mensajes/);
  });

  test("cerrada para escribir: no se puede escribir ni cambiar, y lo de los demás sigue oculto", async () => {
    await freshCapsule();
    const id = ok(await dani.db.rpc("capsule_message_save", { p_season: SEASON, p_id: null, p_to: null, p_body: "antes" })) as string;
    await setDates(-1, 300);
    await rejects(dani.db.rpc("capsule_message_save", { p_season: SEASON, p_id: id, p_to: null, p_body: "después" }), /cerrada/);
    await rejects(dani.db.rpc("capsule_predict", { p_season: SEASON, p_question: "wins", p_player: null, p_number: 5 }), /cerrada/);
    await rejects(dani.db.rpc("capsule_message_delete", { p_id: id }), /cerrada/);
    const others = ok(await gestor.db.from("capsule_messages").select("*").eq("season", SEASON)) as unknown[];
    assert.equal(others.length, 0);
  });

  test("se abre para todos el día de la gala, pero nunca antes del último partido de la temporada", async () => {
    await freshCapsule();
    ok(await dani.db.rpc("capsule_message_save", { p_season: SEASON, p_id: null, p_to: null, p_body: "Nos vemos en la gala" }));
    // Un partido de esa temporada en el calendario (el 1 de junio de 2032, aún por jugar)
    const rival = ok(await admin.from("rivals").select("id").limit(1).single()) as { id: string };
    const m = ok(await admin.from("matches").insert({ match_date: "2032-06-01", kickoff: "18:00", rival_id: rival.id }).select("id").single()) as { id: string };
    await setDates(-3, -1);
    assert.equal(ok(await gestor.db.rpc("capsule_is_open", { p_season: SEASON })), false);
    const opensAt = ok(await gestor.db.rpc("capsule_opens_at", { p_season: SEASON })) as string;
    assert.equal(new Date(opensAt).toISOString(), "2032-06-01T18:00:00.000Z"); // 18:00 + 2 h en Madrid (verano) = 20:00 = 18:00 UTC
    assert.equal((ok(await gestor.db.from("capsule_messages").select("*").eq("season", SEASON)) as unknown[]).length, 0);

    // Sin partidos pendientes, ya está abierta: todos leen todo
    ok(await admin.from("matches").delete().eq("id", m.id));
    assert.equal(ok(await gestor.db.rpc("capsule_is_open", { p_season: SEASON })), true);
    for (const who of [gestor, alvaro, javi]) {
      const msgs = ok(await who.db.from("capsule_messages").select("body").eq("season", SEASON)) as { body: string }[];
      assert.deepEqual(msgs.map((x) => x.body), ["Nos vemos en la gala"]);
    }
    // Abierta, ya no se escribe ni se cambian las fechas
    await rejects(javi.db.rpc("capsule_message_save", { p_season: SEASON, p_id: null, p_to: null, p_body: "tarde" }), /cerrada/);
    await rejects(gestor.db.from("time_capsules").update({ opens_on: day(200) }).eq("season", SEASON), /ya está abierta/);
    // Pero sí se puede corregir el puesto final
    ok(await gestor.db.from("time_capsules").update({ final_position: 2 }).eq("season", SEASON));
  });
});
