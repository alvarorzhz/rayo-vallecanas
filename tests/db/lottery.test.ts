/**
 * Sorteos contra la base de datos de verdad: asignación de números, ventas, cobros,
 * anulaciones, cuentas de los vendedores y el sorteo de la rifa.
 * Cada prueba crea su propio sorteo, así que da igual el orden y lo que ya haya.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { admin, as, ok, rejects, tag, type Who } from "./helpers.ts";

type Sale = { id: string; reference: string; quantity: number; total_cents: number; paid_cents: number; payment_status: string; buyer_id: string; seller_id: string };

const YEAR = new Date().getFullYear();

/** Crea un sorteo activo (como lo haría un gestor) y asigna vendedores. */
async function campaign(p: { shares?: number; mode?: "auto" | "manual" | "booklet"; kind?: "lottery" | "raffle"; price?: number; sellers?: Who[]; status?: string; prefix?: string } = {}) {
  const { db } = await as("gestor");
  // Prefijo propio en cada sorteo de prueba, para saber qué referencias le tocan
  const prefix = p.prefix ?? Math.random().toString(36).slice(2, 8).toUpperCase();
  const c = ok(await db.from("lottery_campaigns").insert({
    name: tag("Prueba"), year: YEAR, kind: p.kind ?? "lottery", lottery_number: p.kind === "raffle" ? null : "12345",
    price_cents: p.price ?? 500, total_shares: p.shares ?? 20, numbering_mode: p.mode ?? "auto", ref_prefix: prefix, status: p.status ?? "active",
  }).select("*").single()) as { id: string; year: number };
  for (const who of p.sellers ?? []) {
    const { id } = await as(who);
    ok(await db.from("lottery_campaign_sellers").insert({ campaign_id: c.id, user_id: id }));
  }
  return { ...c, prefix };
}

let phone = 600000000 + Math.floor(Math.random() * 9000000);
/** Registra una venta con la sesión de quien vende. */
function sell(who: Who, campaignId: string, quantity: number, extra: Record<string, unknown> = {}) {
  return as(who).then(({ db }) => db.rpc("lottery_register_sale", {
    p_campaign_id: campaignId, p_buyer_name: "Comprador de prueba", p_buyer_phone: String(phone++), p_buyer_email: null, p_quantity: quantity, ...extra,
  }));
}
const sale = async (...a: Parameters<typeof sell>) => ok(await sell(...a)) as Sale;

async function numbersOf(saleId: string) {
  const rows = ok(await admin.from("lottery_shares").select("share_number, status").eq("sale_id", saleId).order("share_number")) as { share_number: number; status: string }[];
  return rows.map((r) => r.share_number);
}
async function shareStatus(campaignId: string) {
  const rows = ok(await admin.from("lottery_shares").select("share_number, status, sale_id").eq("campaign_id", campaignId).order("share_number")) as { share_number: number; status: string; sale_id: string | null }[];
  return rows;
}

describe("asignación de números", () => {
  test("automática: da los primeros libres, seguidos, y cada venta lleva su referencia correlativa", async () => {
    const c = await campaign({ sellers: ["dani"] });
    const a = await sale("dani", c.id, 3);
    const b = await sale("dani", c.id, 2);
    assert.deepEqual(await numbersOf(a.id), [1, 2, 3]);
    assert.deepEqual(await numbersOf(b.id), [4, 5]);
    assert.equal(a.reference, `${c.prefix}-${YEAR}-0001`);
    assert.equal(b.reference, `${c.prefix}-${YEAR}-0002`);
    assert.equal(a.total_cents, 1500);
    assert.equal(a.payment_status, "pending");
  });

  test("no vende más números de los que quedan libres y no deja nada a medias", async () => {
    const c = await campaign({ shares: 5, sellers: ["dani"] });
    await sale("dani", c.id, 4);
    await rejects(sell("dani", c.id, 2), /No hay suficientes participaciones disponibles \(solicitadas 2, disponibles 1\)/);
    const rows = await shareStatus(c.id);
    assert.equal(rows.filter((r) => r.status === "sold").length, 4);
    assert.equal((ok(await admin.from("lottery_sales").select("id").eq("campaign_id", c.id)) as unknown[]).length, 1);
  });

  test("con muchas ventas a la vez nunca se repite un número", async () => {
    const c = await campaign({ shares: 30, sellers: ["dani", "javi"] });
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => sell(i % 2 ? "dani" : "javi", c.id, 3)));
    const done = results.filter((r) => !r.error).map((r) => r.data as Sale);
    // 30 números / 3 = 10 ventas; las otras 2 se quedan sin números
    assert.equal(done.length, 10);
    for (const r of results.filter((r) => r.error)) assert.match(r.error!.message, /No hay suficientes participaciones/);
    const rows = await shareStatus(c.id);
    assert.ok(rows.every((r) => r.status === "sold" && r.sale_id));
    const refs = new Set(done.map((s) => s.reference));
    assert.equal(refs.size, 10);
    const per = new Map<string, number>();
    for (const r of rows) per.set(r.sale_id!, (per.get(r.sale_id!) ?? 0) + 1);
    assert.ok([...per.values()].every((n) => n === 3));
  });

  test("a mano: vende justo los números elegidos y rechaza repetidos u ocupados", async () => {
    const c = await campaign({ mode: "manual", sellers: ["dani"] });
    const a = await sale("dani", c.id, 3, { p_share_numbers: [7, 13, 2] });
    assert.deepEqual(await numbersOf(a.id), [2, 7, 13]);
    await rejects(sell("dani", c.id, 2, { p_share_numbers: [4, 4] }), /repetidas/);
    await rejects(sell("dani", c.id, 2, { p_share_numbers: [4] }), /exactamente 2/);
    await rejects(sell("dani", c.id, 2, { p_share_numbers: [7, 8] }), /No hay suficientes participaciones/);
    await rejects(sell("dani", c.id, 1, { p_share_numbers: [21] }), /No hay suficientes participaciones/);
    assert.equal((await shareStatus(c.id)).filter((r) => r.status === "sold").length, 3);
  });

  test("talonarios: cada vendedor vende solo de su talonario y los talonarios no se pisan", async () => {
    const c = await campaign({ mode: "booklet", shares: 20 });
    const { db } = await as("gestor");
    const dani = await as("dani"), javi = await as("javi");
    ok(await db.from("lottery_booklets").insert({ campaign_id: c.id, seller_id: dani.id, from_number: 1, to_number: 5, label: "A" }));
    ok(await db.from("lottery_booklets").insert({ campaign_id: c.id, seller_id: javi.id, from_number: 11, to_number: 15, label: "B" }));
    await rejects(db.from("lottery_booklets").insert({ campaign_id: c.id, seller_id: javi.id, from_number: 5, to_number: 8, label: "C" }), /se solapa/);
    await rejects(db.from("lottery_booklets").insert({ campaign_id: c.id, seller_id: javi.id, from_number: 18, to_number: 25, label: "D" }), /supera el total/);
    const j = await sale("javi", c.id, 2);
    const d = await sale("dani", c.id, 4);
    assert.deepEqual(await numbersOf(j.id), [11, 12]);
    assert.deepEqual(await numbersOf(d.id), [1, 2, 3, 4]);
    await rejects(sell("dani", c.id, 2), /No hay suficientes participaciones disponibles \(solicitadas 2, disponibles 1\)/);
  });

  test("dos sorteos del mismo año con el mismo prefijo no se pisan las referencias (arreglado en 4.20.1)", async () => {
    const prefix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const a = await campaign({ prefix, sellers: ["dani"] });
    const b = await campaign({ prefix, sellers: ["dani"] });
    const a1 = await sale("dani", a.id, 1);
    const b1 = await sale("dani", b.id, 1); // antes: «duplicate key value violates unique constraint "lottery_sales_reference_key"»
    const a2 = await sale("dani", a.id, 1);
    const refs = [a1, b1, a2].map((s) => s.reference);
    assert.equal(new Set(refs).size, 3);
    assert.equal(a1.reference, `${prefix}-${YEAR}-0001`);
    assert.ok(refs.every((r) => r.startsWith(`${prefix}-${YEAR}-`)));
    // Y también con ventas a la vez en los dos sorteos
    const many = await Promise.all(Array.from({ length: 8 }, (_, i) => sell("dani", i % 2 ? a.id : b.id, 1)));
    for (const r of many) assert.equal(r.error, null, r.error?.message);
  });

  test("ampliar el sorteo añade números; reducirlo o cambiar el precio con ventas no se deja", async () => {
    const c = await campaign({ shares: 10, sellers: ["dani"] });
    const { db } = await as("gestor");
    ok(await db.from("lottery_campaigns").update({ total_shares: 15 }).eq("id", c.id));
    assert.equal((await shareStatus(c.id)).length, 15);
    await rejects(db.from("lottery_campaigns").update({ total_shares: 12 }).eq("id", c.id), /No se puede reducir/);
    await sale("dani", c.id, 1);
    await rejects(db.from("lottery_campaigns").update({ price_cents: 300 }).eq("id", c.id), /No se puede cambiar el precio/);
  });
});

describe("quién puede vender", () => {
  test("un jugador solo vende en los sorteos en que está apuntado y solo a su nombre", async () => {
    const c = await campaign({ sellers: ["dani"] });
    await rejects(sell("javi", c.id, 1), /No estás asignado como vendedor/);
    const javi = await as("javi");
    await rejects(sell("dani", c.id, 1, { p_seller_id: javi.id }), /Solo la directiva/);
    // La directiva sí puede apuntar una venta a nombre de un vendedor
    const s = await sale("gestor", c.id, 1, { p_seller_id: javi.id });
    assert.equal(s.seller_id, javi.id);
  });

  test("no se vende en un sorteo que no está activo, ni sin teléfono o correo del comprador", async () => {
    const draft = await campaign({ status: "draft", sellers: ["dani"] });
    await rejects(sell("dani", draft.id, 1), /no está activa/);
    const c = await campaign({ sellers: ["dani"] });
    await rejects(sell("dani", c.id, 1, { p_buyer_phone: " - " }), /teléfono o un correo/);
    await rejects(sell("dani", c.id, 1, { p_buyer_name: "  " }), /nombre del comprador/);
    await rejects(sell("dani", c.id, 0), /al menos 1/);
  });

  test("sin sesión no se puede vender", async () => {
    const c = await campaign();
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { error } = await anon.rpc("lottery_register_sale", { p_campaign_id: c.id, p_buyer_name: "X", p_buyer_phone: "600000000", p_buyer_email: null, p_quantity: 1 });
    assert.ok(error);
  });

  test("el mismo comprador (mismo teléfono) no se duplica", async () => {
    const c = await campaign({ sellers: ["dani"] });
    const a = await sale("dani", c.id, 1, { p_buyer_phone: "699 111 222" });
    const b = await sale("dani", c.id, 1, { p_buyer_phone: "699111222", p_buyer_name: "Nombre corregido" });
    assert.equal(a.buyer_id, b.buyer_id);
    const buyer = ok(await admin.from("buyers").select("full_name, phone").eq("id", a.buyer_id).single()) as { full_name: string; phone: string };
    assert.deepEqual(buyer, { full_name: "Nombre corregido", phone: "699111222" });
  });
});

describe("cobros", () => {
  test("el estado del pago sigue a lo cobrado: pendiente, a medias, pagado", async () => {
    const c = await campaign({ sellers: ["dani"] });
    const s = await sale("dani", c.id, 2, { p_paid_cents: 300 }); // 10 € en total
    assert.equal(s.paid_cents, 300);
    assert.equal(s.payment_status, "partial");
    const { db } = await as("dani");
    await rejects(db.rpc("lottery_add_payment", { p_sale_id: s.id, p_amount_cents: 800 }), /supera el importe pendiente \(700/);
    const paid = ok(await db.rpc("lottery_add_payment", { p_sale_id: s.id, p_amount_cents: 700, p_method: "bizum" })) as Sale;
    assert.equal(paid.paid_cents, 1000);
    assert.equal(paid.payment_status, "paid");
  });

  test("cobrar de más al vender se queda en el total", async () => {
    const c = await campaign({ sellers: ["dani"] });
    const s = await sale("dani", c.id, 1, { p_paid_cents: 9999 });
    assert.equal(s.paid_cents, 500);
    assert.equal(s.payment_status, "paid");
  });

  test("las devoluciones solo las apunta la directiva y nunca más de lo cobrado", async () => {
    const c = await campaign({ sellers: ["dani"] });
    const s = await sale("dani", c.id, 2, { p_paid_cents: 1000 });
    const dani = await as("dani"), gestor = await as("gestor");
    await rejects(dani.db.rpc("lottery_add_payment", { p_sale_id: s.id, p_amount_cents: -200 }), /Solo la directiva/);
    const back = ok(await gestor.db.rpc("lottery_add_payment", { p_sale_id: s.id, p_amount_cents: -400 })) as Sale;
    assert.equal(back.paid_cents, 600);
    assert.equal(back.payment_status, "partial");
    await rejects(gestor.db.rpc("lottery_add_payment", { p_sale_id: s.id, p_amount_cents: -700 }), /supera lo cobrado/);
  });

  test("un vendedor no cobra ventas de otro", async () => {
    const c = await campaign({ sellers: ["dani", "javi"] });
    const s = await sale("dani", c.id, 1);
    const { db } = await as("javi");
    await rejects(db.rpc("lottery_add_payment", { p_sale_id: s.id, p_amount_cents: 500 }), /No tienes permiso/);
  });

  test("los cobros no se cambian ni se borran, ni siquiera con la clave de servicio", async () => {
    const c = await campaign({ sellers: ["dani"] });
    const s = await sale("dani", c.id, 1, { p_paid_cents: 500 });
    const pay = ok(await admin.from("lottery_payments").select("id").eq("sale_id", s.id).single()) as { id: string };
    await rejects(admin.from("lottery_payments").update({ amount_cents: 1 }).eq("id", pay.id), /no se modifican ni se borran/);
    await rejects(admin.from("lottery_payments").delete().eq("id", pay.id), /no se modifican ni se borran/);
    await rejects(admin.from("lottery_sales").delete().eq("id", s.id), /no se modifican ni se borran/);
  });
});

describe("anular ventas", () => {
  test("al anular se liberan los números (o se anulan) y la venta deja de contar", async () => {
    const c = await campaign({ sellers: ["dani"] });
    const a = await sale("dani", c.id, 2, { p_paid_cents: 1000 });
    const b = await sale("dani", c.id, 2);
    const dani = await as("dani"), gestor = await as("gestor");
    await rejects(dani.db.rpc("lottery_cancel_sale", { p_sale_id: a.id, p_reason: "error" }), /Solo la directiva/);
    await rejects(gestor.db.rpc("lottery_cancel_sale", { p_sale_id: a.id, p_reason: " " }), /motivo/);
    const cancelled = ok(await gestor.db.rpc("lottery_cancel_sale", { p_sale_id: a.id, p_reason: "Se equivocó de número" })) as Sale;
    assert.equal(cancelled.payment_status, "cancelled");
    ok(await gestor.db.rpc("lottery_cancel_sale", { p_sale_id: b.id, p_reason: "Papeleta perdida", p_release: false }));
    await rejects(gestor.db.rpc("lottery_cancel_sale", { p_sale_id: a.id, p_reason: "otra vez" }), /ya estaba anulada/);

    const rows = await shareStatus(c.id);
    assert.deepEqual(rows.slice(0, 4).map((r) => r.status), ["available", "available", "voided", "voided"]);
    assert.ok(rows.every((r) => r.sale_id === null));
    // No se cobra en una venta anulada, pero sí se puede devolver lo cobrado
    await rejects(gestor.db.rpc("lottery_add_payment", { p_sale_id: a.id, p_amount_cents: 100 }), /anulada/);
    const refund = ok(await gestor.db.rpc("lottery_add_payment", { p_sale_id: a.id, p_amount_cents: -1000 })) as Sale;
    assert.equal(refund.paid_cents, 0);
    assert.equal(refund.payment_status, "cancelled");

    // Los números liberados vuelven a venderse; los anulados no
    const again = await sale("dani", c.id, 3);
    assert.deepEqual(await numbersOf(again.id), [1, 2, 5]);

    const summary = ok(await gestor.db.rpc("lottery_campaign_summary", { p_campaign_id: c.id })) as Record<string, number>;
    assert.equal(summary.sold, 3);
    assert.equal(summary.voided, 2);
    assert.equal(summary.sales_count, 1);
    assert.equal(summary.sold_cents, 1500);
    assert.equal(summary.paid_cents, 0);
  });
});

describe("cuentas de los vendedores", () => {
  type Account = { seller_id: string; shares: number; sold_cents: number; paid_cents: number; handed_cents: number };

  test("lo cobrado menos lo entregado; las entregas anuladas no cuentan", async () => {
    const c = await campaign({ sellers: ["dani", "javi"] });
    const dani = await as("dani"), javi = await as("javi"), gestor = await as("gestor");
    await sale("dani", c.id, 2, { p_paid_cents: 1000 });
    await sale("dani", c.id, 1);
    await sale("javi", c.id, 1, { p_paid_cents: 500 });

    const h1 = ok(await gestor.db.rpc("lottery_add_handover", { p_campaign_id: c.id, p_seller_id: dani.id, p_amount_cents: 600 })) as string;
    ok(await gestor.db.rpc("lottery_add_handover", { p_campaign_id: c.id, p_seller_id: dani.id, p_amount_cents: 200, p_method: "bizum" }));
    ok(await gestor.db.rpc("lottery_void_handover", { p_id: h1 }));

    const rows = ok(await gestor.db.rpc("lottery_seller_accounts", { p_campaign_id: c.id })) as Account[];
    const d = rows.find((r) => r.seller_id === dani.id)!;
    const j = rows.find((r) => r.seller_id === javi.id)!;
    assert.deepEqual([Number(d.shares), Number(d.sold_cents), Number(d.paid_cents), Number(d.handed_cents)], [3, 1500, 1000, 200]);
    assert.deepEqual([Number(j.shares), Number(j.paid_cents), Number(j.handed_cents)], [1, 500, 0]);
    // Primero quien más debe al club
    assert.equal(rows[0].seller_id, dani.id);

    // Cada vendedor ve solo su cuenta y no puede apuntar entregas
    const own = ok(await javi.db.rpc("lottery_seller_accounts", { p_campaign_id: c.id })) as Account[];
    assert.deepEqual(own.map((r) => r.seller_id), [javi.id]);
    await rejects(javi.db.rpc("lottery_add_handover", { p_campaign_id: c.id, p_seller_id: javi.id, p_amount_cents: 500 }), /No tienes permiso/);
    await rejects(gestor.db.rpc("lottery_add_handover", { p_campaign_id: c.id, p_seller_id: javi.id, p_amount_cents: 0 }), /mayor que cero/);
    await rejects(javi.db.from("lottery_handovers").insert({ campaign_id: c.id, seller_id: javi.id, amount_cents: 100 }), /permission denied|row-level/);
  });

  test("una venta anulada no cuenta en la cuenta del vendedor", async () => {
    const c = await campaign({ sellers: ["dani"] });
    const dani = await as("dani"), gestor = await as("gestor");
    const s = await sale("dani", c.id, 2, { p_paid_cents: 1000 });
    ok(await gestor.db.rpc("lottery_cancel_sale", { p_sale_id: s.id, p_reason: "prueba" }));
    const rows = ok(await gestor.db.rpc("lottery_seller_accounts", { p_campaign_id: c.id })) as Account[];
    const d = rows.find((r) => r.seller_id === dani.id)!;
    assert.deepEqual([Number(d.shares), Number(d.paid_cents)], [0, 0]);
  });
});

describe("sorteo de la rifa", () => {
  test("al azar sale siempre un número vendido, una sola vez, y ya no se puede cambiar", async () => {
    const c = await campaign({ kind: "raffle", shares: 50, sellers: ["dani"] });
    await sale("dani", c.id, 3);
    const { db } = await as("gestor");
    ok(await db.from("lottery_campaigns").update({ status: "closed" }).eq("id", c.id));
    const [win] = ok(await db.rpc("lottery_draw_winner", { p_campaign_id: c.id })) as { winning_number: number; reference: string }[];
    assert.ok([1, 2, 3].includes(win.winning_number), `ha salido el ${win.winning_number}, que no está vendido`);
    assert.equal(win.reference, `${c.prefix}-${YEAR}-0001`);
    await rejects(db.rpc("lottery_draw_winner", { p_campaign_id: c.id }), /ya tiene número ganador/);
    await rejects(db.from("lottery_campaigns").update({ status: "closed" }).eq("id", c.id), /ya está sorteada/);
    await rejects(admin.from("lottery_campaigns").update({ winning_number: 40 }).eq("id", c.id), /ya está sorteada/);
    const events = ok(await admin.from("lottery_raffle_events").select("kind, winning_number, draw_mode").eq("campaign_id", c.id).order("id")) as { kind: string; winning_number: number | null; draw_mode: string | null }[];
    assert.deepEqual(events.map((e) => e.kind), ["closed", "drawn"]);
    assert.equal(events[1].winning_number, win.winning_number);
    assert.equal(events[1].draw_mode, "random");
  });

  test("con número a mano (bola externa) acepta uno del rango aunque no esté vendido", async () => {
    const c = await campaign({ kind: "raffle", shares: 50, sellers: ["dani"] });
    await sale("dani", c.id, 1);
    const { db } = await as("gestor");
    ok(await db.from("lottery_campaigns").update({ status: "closed" }).eq("id", c.id));
    await rejects(db.rpc("lottery_draw_winner", { p_campaign_id: c.id, p_number: 51 }), /entre 1 y 50/);
    const [win] = ok(await db.rpc("lottery_draw_winner", { p_campaign_id: c.id, p_number: 40 })) as { winning_number: number; reference: string | null }[];
    assert.equal(win.winning_number, 40);
    assert.equal(win.reference, null);
  });

  test("sin números vendidos no hay sorteo, la lotería no se sortea aquí y un jugador no puede sortear", async () => {
    const raffle = await campaign({ kind: "raffle", shares: 10, sellers: ["dani"] });
    const lottery = await campaign();
    const gestor = await as("gestor"), dani = await as("dani");
    ok(await gestor.db.from("lottery_campaigns").update({ status: "closed" }).eq("id", raffle.id));
    await rejects(gestor.db.rpc("lottery_draw_winner", { p_campaign_id: raffle.id }), /No hay números vendidos/);
    await rejects(gestor.db.rpc("lottery_draw_winner", { p_campaign_id: lottery.id }), /solo existe para rifas/);
    ok(await gestor.db.from("lottery_campaigns").update({ status: "active" }).eq("id", raffle.id));
    await sale("dani", raffle.id, 1);
    ok(await gestor.db.from("lottery_campaigns").update({ status: "closed" }).eq("id", raffle.id));
    await rejects(dani.db.rpc("lottery_draw_winner", { p_campaign_id: raffle.id }), /No tienes permiso/);
  });

  test("4.30.6 · con las ventas abiertas no se sortea: primero hay que cerrarlas", async () => {
    const c = await campaign({ kind: "raffle", shares: 20, sellers: ["dani"] });
    await sale("dani", c.id, 2);
    const { db } = await as("gestor");
    await rejects(db.rpc("lottery_draw_winner", { p_campaign_id: c.id }), /Cierra las ventas antes de sortear/);
    await rejects(db.rpc("lottery_draw_winner", { p_campaign_id: c.id, p_number: 5 }), /Cierra las ventas antes de sortear/);
    const events = ok(await admin.from("lottery_raffle_events").select("kind").eq("campaign_id", c.id)) as { kind: string }[];
    assert.equal(events.length, 0, "no debe quedar nada en el acta");
  });

  test("4.30.6 · se ven los números vendidos sin cobrar (aviso antes de sortear)", async () => {
    const c = await campaign({ kind: "raffle", shares: 20, sellers: ["dani"] });
    const paid = await sale("dani", c.id, 2, { p_paid_cents: 99999 });
    const half = await sale("dani", c.id, 1, { p_paid_cents: 1 });
    const none = await sale("dani", c.id, 2);
    assert.equal(paid.payment_status, "paid");
    const { db } = await as("gestor");
    const rows = ok(await db.from("lottery_shares").select("share_number, sale:lottery_sales!inner(payment_status)")
      .eq("campaign_id", c.id).eq("status", "sold").neq("sale.payment_status", "paid").order("share_number")) as { share_number: number }[];
    const expected = [...(await numbersOf(half.id)), ...(await numbersOf(none.id))].sort((a, b) => a - b);
    assert.deepEqual(rows.map((r) => r.share_number), expected);
  });
});
