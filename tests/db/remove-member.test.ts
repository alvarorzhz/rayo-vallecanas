/**
 * 4.30.7 · Dar de baja a un usuario borrando sus datos personales (remove_member).
 * Se crea una persona nueva en cada prueba para no tocar a las de los datos de ejemplo.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { admin, as, ok, rejects, URL_ } from "./helpers.ts";

const PASSWORD = "Baja1234!";

/** Persona nueva con teléfono, foto, ficha de jugador, aviso push, permisos, sesión abierta y un talonario de rifa. */
async function member() {
  const tag = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `baja${tag}@rayo.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Pepe ${tag}`, phone: "600111222" } });
  if (error) throw error;
  const id = data.user.id;
  const avatar = `http://127.0.0.1:54321/storage/v1/object/public/avatars/${id}/foto.png`;
  ok(await admin.from("profiles").update({ full_name: `Pepe ${tag}`, phone: "600111222", avatar_url: avatar }).eq("id", id));
  const player = ok(await admin.from("players").insert({ first_name: "Pepe", last_name: tag, photo_url: avatar, user_id: id }).select("id").single()) as { id: string };
  ok(await admin.from("push_subscriptions").insert({ user_id: id, endpoint: `https://push.test/${tag}`, p256dh: "x", auth: "y" }));
  ok(await admin.from("user_permissions").insert({ user_id: id, module: "finances", can_read: true }));
  ok(await admin.from("access_log").insert({ user_id: id, email, event: "login", ip: "1.2.3.4", user_agent: "iPhone" }));
  const c = ok(await admin.from("lottery_campaigns").insert({
    name: `Baja ${tag}`, year: 2031, kind: "lottery", lottery_number: "12345", price_cents: 500, total_shares: 20,
    numbering_mode: "booklet", ref_prefix: `B${tag.slice(-5)}`, status: "active",
  }).select("id").single()) as { id: string };
  const booklet = ok(await admin.from("lottery_booklets").insert({ campaign_id: c.id, seller_id: id, from_number: 1, to_number: 5, label: "A" }).select("id").single()) as { id: string };

  const own = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: e } = await own.auth.signInWithPassword({ email, password: PASSWORD });
  if (e) throw e;
  return { id, email, tag, player: player.id, booklet: booklet.id, own };
}

describe("dar de baja a un usuario", () => {
  test("solo quien puede borrar usuarios, nunca a sí mismo", async () => {
    const m = await member();
    const gestor = await as("gestor");
    const dani = await as("dani");
    const superadmin = await as("superadmin");
    await rejects(gestor.db.rpc("remove_member", { p_uid: m.id }), /No tienes permiso/);
    await rejects(dani.db.rpc("remove_member", { p_uid: m.id }), /No tienes permiso/);
    await rejects(m.own.rpc("remove_member", { p_uid: m.id }), /No tienes permiso/);
    await rejects(superadmin.db.rpc("remove_member", { p_uid: superadmin.id }), /ti mismo/);
    const p = ok(await admin.from("profiles").select("full_name, active").eq("id", m.id).single()) as { full_name: string; active: boolean };
    assert.equal(p.active, true, "nadie lo ha tocado");
    ok(await superadmin.db.rpc("remove_member", { p_uid: m.id })); // que no cuente en otras pruebas
  });

  test("borra sus datos personales y su acceso, y conserva lo que hizo", async () => {
    const m = await member();
    const superadmin = await as("superadmin");
    // Un cambio en su perfil deja en la auditoría su email y teléfono
    ok(await superadmin.db.from("profiles").update({ phone: "600333444" }).eq("id", m.id));

    ok(await superadmin.db.rpc("remove_member", { p_uid: m.id }));

    const p = ok(await admin.from("profiles").select("*").eq("id", m.id).single()) as Record<string, unknown>;
    assert.equal(p.full_name, "Antiguo miembro");
    assert.equal(p.email, null);
    assert.equal(p.phone, null);
    assert.equal(p.avatar_url, null);
    assert.equal(p.active, false);
    assert.equal(p.role, "player");
    assert.ok(p.removed_at, "queda la fecha de la baja");

    // Cuenta de acceso vacía: ni email real, ni datos, ni contraseña
    const { data: u } = await admin.auth.admin.getUserById(m.id);
    assert.equal(u.user?.email, `baja-${m.id}@baja.invalid`);
    assert.deepEqual(u.user?.user_metadata ?? {}, {});
    assert.ok(!u.user?.phone);
    const again = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    assert.ok((await again.auth.signInWithPassword({ email: m.email, password: PASSWORD })).error, "con su email ya no entra");
    // La sesión que tenía abierta se cierra al momento
    const alive = await m.own.rpc("session_alive");
    assert.ok(alive.error || alive.data === false, "su sesión abierta ya no vale");

    // Rastro personal fuera
    assert.equal((ok(await admin.from("push_subscriptions").select("id").eq("user_id", m.id)) as unknown[]).length, 0);
    assert.equal((ok(await admin.from("user_permissions").select("module").eq("user_id", m.id)) as unknown[]).length, 0);
    const log = ok(await admin.from("access_log").select("email, ip, user_agent").eq("user_id", m.id)) as Record<string, unknown>[];
    assert.ok(log.length > 0 && log.every((r) => r.email === null && r.ip === null && r.user_agent === null));
    const audit = ok(await admin.from("audit_log").select("action, old_data, new_data").eq("table_name", "profiles").eq("record_id", m.id)) as Record<string, unknown>[];
    const text = JSON.stringify(audit);
    assert.ok(!text.includes(m.email) && !text.includes("600111222") && !text.includes("600333444") && !text.includes(`Pepe ${m.tag}`), "la auditoría ya no guarda su nombre, email ni teléfono");
    assert.ok(audit.some((a) => a.action === "REMOVE_MEMBER"), "la baja queda apuntada");

    // Lo que hizo se conserva, a nombre de «Antiguo miembro»
    const b = ok(await admin.from("lottery_booklets").select("seller_id").eq("id", m.booklet).single()) as { seller_id: string };
    assert.equal(b.seller_id, m.id);
    const dir = ok(await superadmin.db.from("member_directory").select("full_name").eq("id", m.id).single()) as { full_name: string };
    assert.equal(dir.full_name, "Antiguo miembro");
    // La ficha de jugador sigue en la plantilla, sin su foto y sin enlace a la cuenta
    const pl = ok(await admin.from("players").select("user_id, photo_url").eq("id", m.player).single()) as { user_id: string | null; photo_url: string | null };
    assert.equal(pl.user_id, null);
    assert.equal(pl.photo_url, null);
  });

  test("no se puede volver a habilitar", async () => {
    const m = await member();
    const superadmin = await as("superadmin");
    ok(await superadmin.db.rpc("remove_member", { p_uid: m.id }));
    await rejects(superadmin.db.from("profiles").update({ active: true }).eq("id", m.id), /dado de baja/);
    await rejects(superadmin.db.from("profiles").update({ removed_at: null }).eq("id", m.id), /dado de baja/);
    // Repetir la baja no rompe nada
    ok(await superadmin.db.rpc("remove_member", { p_uid: m.id }));
  });
});
