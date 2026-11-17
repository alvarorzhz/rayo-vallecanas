/**
 * Finanzas contra la base de datos de verdad: saldo, anulaciones, lo que no se puede tocar,
 * quién lo ve y el paso de la recaudación de un sorteo a Finanzas.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { admin, as, ok, rejects, tag } from "./helpers.ts";

type Summary = { opening_cents: number; balance_cents: number; income_cents: number; expense_cents: number; count: number };

async function category(kind: "income" | "expense", name: string) {
  return (ok(await admin.from("finance_categories").select("id").eq("kind", kind).eq("name", name).single()) as { id: string }).id;
}

const madridToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

/** Apunta un movimiento como lo hace la app (con la sesión de quien lo apunta). */
async function movement(p: { kind: "income" | "expense"; amount: number; category: string; date?: string; concept?: string }) {
  const { db, id } = await as("gestor");
  return ok(await db.from("finance_movements").insert({
    kind: p.kind, amount_cents: p.amount, category_id: p.category, op_date: p.date ?? madridToday(), concept: p.concept ?? tag("Prueba"), created_by: id,
  }).select("id, season").single()) as { id: string; season: string };
}

async function summary(from?: string, to?: string) {
  const { db } = await as("gestor");
  return ok(await db.rpc("finance_summary", { p_from: from ?? null, p_to: to ?? null })) as Summary;
}

describe("saldo y movimientos", () => {
  test("el saldo suma ingresos y resta gastos; lo anulado deja de contar", async () => {
    const income = await category("income", "Cuotas de jugadores");
    const expense = await category("expense", "Arbitrajes");
    const before = await summary();
    await movement({ kind: "income", amount: 12000, category: income });
    const ref = await movement({ kind: "expense", amount: 4550, category: expense });
    const mid = await summary();
    assert.equal(mid.balance_cents - before.balance_cents, 12000 - 4550);
    assert.equal(mid.income_cents - before.income_cents, 12000);
    assert.equal(mid.expense_cents - before.expense_cents, 4550);
    assert.equal(mid.count - before.count, 2);

    const { db } = await as("gestor");
    await rejects(db.rpc("finance_void_movement", { p_id: ref.id, p_reason: "  " }), /motivo/);
    ok(await db.rpc("finance_void_movement", { p_id: ref.id, p_reason: "Apuntado dos veces" }));
    await rejects(db.rpc("finance_void_movement", { p_id: ref.id, p_reason: "otra vez" }), /ya estaba anulado/);
    const after = await summary();
    assert.equal(after.balance_cents - before.balance_cents, 12000);
    assert.equal(after.count - before.count, 1);
  });

  test("lo anterior al saldo inicial no cambia el saldo, pero sí sale en los totales de su periodo", async () => {
    const income = await category("income", "Otros ingresos");
    const settings = ok(await admin.from("finance_settings").select("opening_date").eq("id", 1).single()) as { opening_date: string };
    const d = new Date(`${settings.opening_date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    const day = d.toISOString().slice(0, 10);
    const before = await summary();
    const beforeDay = await summary(day, day);
    await movement({ kind: "income", amount: 777, category: income, date: day });
    const after = await summary();
    const afterDay = await summary(day, day);
    assert.equal(after.balance_cents, before.balance_cents);
    assert.equal(afterDay.income_cents - beforeDay.income_cents, 777);
  });

  test("cada movimiento cae en su temporada (de septiembre a agosto)", async () => {
    const income = await category("income", "Otros ingresos");
    assert.equal((await movement({ kind: "income", amount: 100, category: income, date: "2026-08-31" })).season, "2025/26");
    assert.equal((await movement({ kind: "income", amount: 100, category: income, date: "2026-09-01" })).season, "2026/27");
    assert.equal((await movement({ kind: "income", amount: 100, category: income, date: "2027-01-15" })).season, "2026/27");
  });

  test("la categoría tiene que ser del mismo tipo que el movimiento", async () => {
    const { db, id } = await as("gestor");
    const expense = await category("expense", "Equipaciones");
    await rejects(db.from("finance_movements").insert({ kind: "income", amount_cents: 100, category_id: expense, concept: "X", created_by: id }), /no corresponde a un ingreso/);
    const income = await category("income", "Premios");
    await rejects(db.from("finance_movements").insert({ kind: "income", amount_cents: 0, category_id: income, concept: "X", created_by: id }), /amount_cents_check/);
  });

  test("los movimientos no se borran; uno anulado no se toca; para anular hay que usar Anular", async () => {
    const income = await category("income", "Colaboraciones");
    const m = await movement({ kind: "income", amount: 2500, category: income });
    const { db, id } = await as("gestor");
    // Corregir el concepto o el importe sí se puede
    ok(await db.from("finance_movements").update({ concept: "Concepto corregido", amount_cents: 2600 }).eq("id", m.id));
    await rejects(db.from("finance_movements").update({ kind: "expense" }).eq("id", m.id), /categoría no corresponde|no se puede cambiar/);
    await rejects(db.from("finance_movements").update({ voided_at: new Date().toISOString(), voided_by: id, void_reason: "x" }).eq("id", m.id), /usa la opción Anular/);
    await rejects(admin.from("finance_movements").delete().eq("id", m.id), /no se modifican ni se borran/);
    ok(await db.rpc("finance_void_movement", { p_id: m.id, p_reason: "prueba" }));
    await rejects(db.from("finance_movements").update({ concept: "Otra cosa" }).eq("id", m.id), /anulado no se puede modificar/);
  });
});

describe("quién ve las cuentas", () => {
  test("un jugador no ve ningún movimiento ni el saldo, aunque se le dé permiso a mano", async () => {
    const dani = await as("dani");
    const rows = ok(await dani.db.from("finance_movements").select("id").limit(5)) as unknown[];
    assert.equal(rows.length, 0);
    await rejects(dani.db.rpc("finance_summary", {}), /No tienes permiso/);
    // Permiso personal de Finanzas a un jugador: la base de datos lo sigue bloqueando
    ok(await admin.from("user_permissions").upsert({ user_id: dani.id, module: "finances", can_read: true, can_create: true, can_update: true, can_delete: true }));
    try {
      assert.equal((ok(await dani.db.from("finance_movements").select("id").limit(5)) as unknown[]).length, 0);
      await rejects(dani.db.rpc("finance_summary", {}), /No tienes permiso/);
      const income = await category("income", "Otros ingresos");
      await rejects(dani.db.from("finance_movements").insert({ kind: "income", amount_cents: 100, category_id: income, concept: "X", created_by: dani.id }), /row-level security/);
    } finally {
      ok(await admin.from("user_permissions").delete().eq("user_id", dani.id).eq("module", "finances"));
    }
  });

  test("nadie apunta un movimiento a nombre de otro", async () => {
    const gestor = await as("gestor"), boss = await as("superadmin");
    const income = await category("income", "Otros ingresos");
    await rejects(gestor.db.from("finance_movements").insert({ kind: "income", amount_cents: 100, category_id: income, concept: "X", created_by: boss.id }), /row-level security/);
  });
});

describe("pasar un sorteo a Finanzas", () => {
  async function raffleWithSales() {
    const gestor = await as("gestor"), dani = await as("dani");
    const c = ok(await gestor.db.from("lottery_campaigns").insert({
      name: tag("Rifa Finanzas"), year: new Date().getFullYear(), kind: "raffle", price_cents: 200, total_shares: 50, status: "active",
      ref_prefix: Math.random().toString(36).slice(2, 8).toUpperCase(),
    }).select("id, name").single()) as { id: string; name: string };
    ok(await gestor.db.from("lottery_campaign_sellers").insert({ campaign_id: c.id, user_id: dani.id }));
    const s = ok(await dani.db.rpc("lottery_register_sale", { p_campaign_id: c.id, p_buyer_name: "Comprador", p_buyer_phone: "611222333", p_buyer_email: null, p_quantity: 5, p_paid_cents: 1000 })) as { id: string };
    return { c, saleId: s.id, gestor, dani };
  }
  const movementsOf = async (campaignId: string) =>
    ok(await admin.from("finance_movements").select("id, kind, amount_cents, voided_at").eq("campaign_id", campaignId).order("created_at")) as { id: string; kind: string; amount_cents: number; voided_at: string | null }[];

  test("pasa solo lo que falta, una vez, y las devoluciones salen como gasto", async () => {
    const { c, saleId, gestor, dani } = await raffleWithSales();
    ok(await gestor.db.rpc("finance_import_campaign", { p_campaign_id: c.id }));
    await rejects(gestor.db.rpc("finance_import_campaign", { p_campaign_id: c.id }), /ya está en Finanzas/);

    // Se cobra algo más (otra venta) y se pasa solo la diferencia
    ok(await dani.db.rpc("lottery_register_sale", { p_campaign_id: c.id, p_buyer_name: "Otro", p_buyer_phone: "611222444", p_buyer_email: null, p_quantity: 2, p_paid_cents: 400 }));
    ok(await gestor.db.rpc("finance_import_campaign", { p_campaign_id: c.id }));
    // Se devuelve dinero: lo pasado a Finanzas supera lo cobrado → gasto por la diferencia
    ok(await gestor.db.rpc("lottery_add_payment", { p_sale_id: saleId, p_amount_cents: -600 }));
    ok(await gestor.db.rpc("finance_import_campaign", { p_campaign_id: c.id }));

    const rows = await movementsOf(c.id);
    assert.deepEqual(rows.map((r) => [r.kind, r.amount_cents]), [["income", 1000], ["income", 400], ["expense", 600]]);
    const status = ok(await gestor.db.rpc("finance_campaign_status", { p_campaign_id: c.id })) as { paid_cents: number; transferred_cents: number };
    assert.equal(status.paid_cents, 800);
    assert.equal(status.transferred_cents, 800);

    // Si se anula lo pasado, se puede volver a pasar
    ok(await gestor.db.rpc("finance_void_movement", { p_id: rows[2].id, p_reason: "prueba" }));
    ok(await gestor.db.rpc("finance_import_campaign", { p_campaign_id: c.id }));
    assert.equal((await movementsOf(c.id)).filter((r) => !r.voided_at).length, 3);

    // Un jugador no puede pasar nada a Finanzas
    await rejects(dani.db.rpc("finance_import_campaign", { p_campaign_id: c.id }), /No tienes permiso/);
  });

  test("al eliminar un sorteo ya pasado a Finanzas, los movimientos se quedan (sin enlace)", async () => {
    const { c, gestor } = await raffleWithSales();
    const movId = ok(await gestor.db.rpc("finance_import_campaign", { p_campaign_id: c.id })) as string;
    const boss = await as("superadmin");
    ok(await boss.db.rpc("lottery_delete_campaign", { p_campaign_id: c.id, p_confirm_name: c.name }));
    const m = ok(await admin.from("finance_movements").select("campaign_id, amount_cents, voided_at, season").eq("id", movId).single()) as { campaign_id: string | null; amount_cents: number; voided_at: string | null; season: string };
    assert.equal(m.campaign_id, null);
    assert.equal(m.amount_cents, 1000);
    assert.equal(m.voided_at, null);
    assert.ok(m.season);
  });
});
