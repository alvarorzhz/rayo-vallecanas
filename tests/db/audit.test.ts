/**
 * 4.32.2 · Auditoría más ligera: en una modificación solo se guardan los campos que cambian,
 * los datos privados de los jugadores no se copian y la retención borra lo antiguo.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { admin, as, ok, tag } from "./helpers.ts";
import { changedFields, recordSummary, type AuditRow } from "../../src/lib/audit.ts";

const last = async (table: string, record: string) =>
  ok(await admin.from("audit_log").select("*").eq("table_name", table).eq("record_id", record).order("id", { ascending: false }).limit(1).single()) as AuditRow;

describe("auditoría", () => {
  test("una modificación guarda solo lo que cambia y lo que identifica el registro", async () => {
    const name = tag("Rival");
    const r = ok(await admin.from("rivals").insert({ name }).select("id").single()) as { id: string };
    const ins = await last("rivals", r.id);
    assert.equal(ins.action, "INSERT");
    assert.ok(!("created_at" in (ins.new_data ?? {})) && !("updated_at" in (ins.new_data ?? {})), "el alta no guarda campos internos");
    assert.ok(Object.values(ins.new_data ?? {}).every((v) => v !== null && v !== ""), "ni campos vacíos");

    ok(await admin.from("rivals").update({ notes: "Juegan con tres centrales" }).eq("id", r.id));
    const up = await last("rivals", r.id);
    assert.equal(up.action, "UPDATE");
    assert.deepEqual(up.changed, ["notes"]);
    assert.deepEqual(Object.keys(up.new_data ?? {}).sort(), ["name", "notes"]);
    assert.equal(up.old_data?.notes ?? null, null);
    // La vista sigue diciendo qué registro es y qué cambió
    assert.equal(recordSummary(up), name);
    assert.deepEqual(changedFields(up).map((c) => [c.key, c.after]), [["notes", "Juegan con tres centrales"]]);

    // Una escritura que no cambia nada no deja rastro
    const before = up.id;
    ok(await admin.from("rivals").update({ notes: "Juegan con tres centrales" }).eq("id", r.id));
    assert.equal((await last("rivals", r.id)).id, before);
  });

  test("los datos privados de un jugador no se copian en la auditoría", async () => {
    const p = ok(await admin.from("players").insert({ first_name: "Privado", last_name: tag("P") }).select("id").single()) as { id: string };
    ok(await admin.from("player_private").upsert({ player_id: p.id, phone: "699000111", internal_notes: "Lesión de rodilla" }));
    ok(await admin.from("player_private").update({ phone: "699000222" }).eq("player_id", p.id));
    const rows = ok(await admin.from("audit_log").select("*").eq("table_name", "player_private").eq("record_id", p.id)) as AuditRow[];
    assert.ok(rows.length >= 2);
    const text = JSON.stringify(rows);
    assert.ok(!text.includes("699000") && !text.includes("rodilla"), "ni teléfonos ni notas en la auditoría");
    const up = rows.find((r) => r.action === "UPDATE" && r.changed?.join() === "phone")!;
    assert.deepEqual(changedFields(up).map((c) => [c.label, c.before, c.after]), [["Teléfono", "Oculto", "Cambiado (oculto)"]]);
  });

  test("los textos largos se guardan recortados, pero el cambio se ve", async () => {
    const r = ok(await admin.from("rivals").insert({ name: tag("Largo"), notes: "a".repeat(800) }).select("id").single()) as { id: string };
    ok(await admin.from("rivals").update({ notes: "a".repeat(799) + "b" }).eq("id", r.id));
    const up = await last("rivals", r.id);
    assert.ok(String(up.new_data?.notes).length < 400);
    assert.match(String(up.new_data?.notes), /800 caracteres/);
    assert.equal(changedFields(up).length, 1, "aunque recortado se vea igual, cuenta como cambio");
  });

  test("retención: solo el servidor la lanza, borra lo antiguo y lo apunta", async () => {
    const sup = await as("superadmin");
    const { error } = await sup.db.rpc("purge_audit_log", { p_months: 24 });
    assert.ok(error, "nadie desde la app puede borrar la auditoría");

    const { error: min } = await admin.rpc("purge_audit_log", { p_months: 1 });
    assert.match(min?.message ?? "", /al menos 6 meses/);

    const old = ok(await admin.from("audit_log").insert({ action: "TEST_OLD", table_name: "app", created_at: "2020-01-01T00:00:00Z" }).select("id").single()) as { id: number };
    const recent = ok(await admin.from("audit_log").insert({ action: "TEST_NEW", table_name: "app" }).select("id").single()) as { id: number };
    const acc = ok(await admin.from("access_log").insert({ event: "login", email: "viejo@rayo.test", created_at: "2020-01-01T00:00:00Z" }).select("id").single()) as { id: number };

    const res = ok(await admin.rpc("purge_audit_log", { p_months: 24 })) as { audit: number; access: number };
    assert.ok(res.audit >= 1 && res.access >= 1);
    assert.equal((ok(await admin.from("audit_log").select("id").eq("id", old.id)) as unknown[]).length, 0);
    assert.equal((ok(await admin.from("access_log").select("id").eq("id", acc.id)) as unknown[]).length, 0);
    assert.equal((ok(await admin.from("audit_log").select("id").eq("id", recent.id)) as unknown[]).length, 1, "lo reciente se queda");
    const log = ok(await admin.from("audit_log").select("action, new_data").eq("action", "PURGE").order("id", { ascending: false }).limit(1).single()) as { new_data: { detail: string } };
    assert.match(log.new_data.detail, /hace más de 24 meses/);
    ok(await admin.from("audit_log").delete().eq("id", recent.id));
  });
});
