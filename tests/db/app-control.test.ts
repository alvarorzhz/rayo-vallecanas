/**
 * 4.31.0 · Mandos de la app: app_settings, app_public_status() y admin_close_all_sessions().
 */
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { admin, as, ok, rejects, URL_ } from "./helpers.ts";

const RESET = { maintenance: false, maintenance_message: null, maintenance_until: null, maintenance_public: false, banner_text: null, banner_until: null, modules_off: [], reload_at: null };
after(async () => { await admin.from("app_settings").update(RESET).eq("id", true); });

describe("mandos de la app", () => {
  test("todos con sesión los leen; solo el superadministrador los cambia y queda en la auditoría", async () => {
    const [sup, gestor, dani] = await Promise.all([as("superadmin"), as("gestor"), as("dani")]);
    const row = ok(await dani.db.from("app_settings").select("maintenance, modules_off").single()) as { maintenance: boolean };
    assert.equal(row.maintenance, false);

    for (const who of [gestor, dani]) {
      const r = await who.db.from("app_settings").update({ maintenance: true }, { count: "exact" }).eq("id", true);
      assert.equal(r.count ?? 0, 0, "un gestor o un jugador no puede poner el mantenimiento");
    }
    assert.equal((ok(await admin.from("app_settings").select("maintenance").single()) as { maintenance: boolean }).maintenance, false);

    const r = await sup.db.from("app_settings").update({ maintenance: true, maintenance_message: "Obras" }, { count: "exact" }).eq("id", true);
    assert.equal(r.error, null);
    assert.equal(r.count, 1);
    const now = ok(await admin.from("app_settings").select("maintenance, updated_by").single()) as { maintenance: boolean; updated_by: string };
    assert.equal(now.maintenance, true);
    assert.equal(now.updated_by, sup.id);
    const log = ok(await admin.from("audit_log").select("action, user_id, new_data").eq("table_name", "app_settings").order("id", { ascending: false }).limit(1).single()) as { action: string; user_id: string; new_data: { maintenance: boolean } };
    assert.equal(log.action, "UPDATE");
    assert.equal(log.user_id, sup.id);
    assert.equal(log.new_data.maintenance, true);
  });

  test("solo se pueden apagar los apartados que existen", async () => {
    const sup = await as("superadmin");
    ok(await sup.db.from("app_settings").update({ modules_off: ["lottery", "polls"] }).eq("id", true));
    await rejects(sup.db.from("app_settings").update({ modules_off: ["finanzas"] }).eq("id", true), /check/i);
  });

  test("sin sesión solo se ve lo justo del mantenimiento, no la tabla", async () => {
    ok(await admin.from("app_settings").update({ maintenance: true, maintenance_public: true, maintenance_message: "Volvemos", banner_text: "secreto" }).eq("id", true));
    const anon = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const t = await anon.from("app_settings").select("*");
    assert.ok(t.error || (t.data ?? []).length === 0, "la tabla no se lee sin sesión");
    const st = (ok(await anon.rpc("app_public_status")) as { maintenance: boolean; message: string; public_closed: boolean }[])[0];
    assert.deepEqual({ m: st.maintenance, msg: st.message, pub: st.public_closed }, { m: true, msg: "Volvemos", pub: true });
    ok(await admin.from("app_settings").update({ maintenance_public: true, maintenance: false }).eq("id", true));
    const off = (ok(await anon.rpc("app_public_status")) as { public_closed: boolean }[])[0];
    assert.equal(off.public_closed, false, "sin mantenimiento las páginas públicas siguen abiertas");
  });

  test("cerrar sesión a todos saca a los demás y deja al superadministrador", async () => {
    const tag = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const email = `todos${tag}@rayo.test`;
    const { error } = await admin.auth.admin.createUser({ email, password: "Todos1234!", email_confirm: true, user_metadata: { full_name: `Pepa ${tag}` } });
    if (error) throw error;
    const other = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: si, error: e } = await other.auth.signInWithPassword({ email, password: "Todos1234!" });
    if (e) throw e;
    assert.equal(ok(await other.rpc("session_alive")), true);

    const [sup, gestor] = await Promise.all([as("superadmin"), as("gestor")]);
    await rejects(gestor.db.rpc("admin_close_all_sessions"), /superadministrador/);

    const n = ok(await sup.db.rpc("admin_close_all_sessions")) as number;
    assert.ok(n >= 2, `se cierran al menos la del gestor y la nueva (${n})`);
    assert.equal(ok(await other.rpc("session_alive")), false, "a la otra persona la app la saca");
    assert.equal(ok(await sup.db.rpc("session_alive")), true, "el superadministrador sigue dentro");
    const rev = ok(await admin.from("access_log").select("event, detail").eq("user_id", si.user!.id).eq("event", "revoked")) as { detail: string }[];
    assert.equal(rev.length, 1);
    assert.match(rev[0].detail, /todas a la vez/);
    const log = ok(await admin.from("audit_log").select("action").eq("action", "CLOSE_ALL_SESSIONS").eq("user_id", sup.id)) as unknown[];
    assert.ok(log.length >= 1);
    // Fuera la persona de prueba, para no colarse en las listas de otras pruebas (votaciones…)
    await admin.auth.admin.deleteUser(si.user!.id);
  });
});
