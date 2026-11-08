import { test } from "node:test";
import assert from "node:assert/strict";
import { changedFields, collectIds, formatValue, madridDayRange, recordSummary, snapshotFields } from "../audit.ts";
import { parseDevice } from "../device.ts";

const U = "11111111-2222-3333-4444-555555555555";

test("una modificación enseña solo los campos que cambian, con antes y ahora legibles", () => {
  const c = changedFields({
    table_name: "lottery_sales",
    old_data: { id: "x", total_cents: 1000, payment_status: "pending", seller_id: U, updated_at: "2026-11-01T10:00:00Z", notes: null },
    new_data: { id: "x", total_cents: 1250, payment_status: "paid", seller_id: U, updated_at: "2026-11-02T10:00:00Z", notes: "Bizum" },
  });
  assert.deepEqual(c.map((x) => x.key), ["total_cents", "payment_status", "notes"]);
  assert.equal(c[0].label, "Total");
  assert.match(c[0].before, /10,00\s€/);
  assert.match(c[0].after, /12,50\s€/);
  assert.equal(c[1].after, "Pagado");
  assert.equal(c[2].before, "—");
});

test("los valores se traducen según el campo y la tabla", () => {
  assert.equal(formatValue("active", false), "No");
  assert.equal(formatValue("status", "drawn", new Map(), "lottery_campaigns"), "Sorteada");
  assert.equal(formatValue("status", "played", new Map(), "matches"), "Finalizado");
  assert.equal(formatValue("role", "admin"), "Gestor");
  assert.equal(formatValue("player_id", U, new Map([[U, "Pepe"]])), "Pepe");
  assert.equal(formatValue("player_id", U), "#11111111");
  assert.match(formatValue("match_date", "2026-11-08"), /8 nov 2026/);
  assert.match(formatValue("paid_at", "2026-11-08T21:30:00+00:00"), /8 nov 2026.*22:30/);
  assert.equal(formatValue("candidates", [U], new Map([[U, "Pepe"]])), "Pepe");
});

test("altas y borrados: lista de datos sin vacíos ni campos internos", () => {
  const f = snapshotFields({ id: "x", name: "Bar El Barrio", tier: "main", notes: null, updated_at: "2026-01-01" }, "sponsors");
  assert.deepEqual(f.map((x) => [x.label, x.value]), [["Nombre", "Bar El Barrio"], ["Categoría", "Principal"]]);
});

test("resumen del registro y recogida de ids", () => {
  assert.equal(recordSummary({ table_name: "players", old_data: null, new_data: { first_name: "Ana", last_name: "Ruiz" } }), "Ana Ruiz");
  assert.equal(recordSummary({ table_name: "squad_members", old_data: null, new_data: { player_id: U } }, new Map([[U, "Pepe"]])), "Pepe");
  assert.deepEqual(collectIds([{ user_id: U, old_data: { id: "aaaaaaaa-2222-3333-4444-555555555555" }, new_data: { tie_ids: [U] } }]), [U]);
});

test("días de los filtros en hora de Madrid (invierno y verano)", () => {
  assert.equal(madridDayRange("2026-11-08", "start"), "2026-11-07T23:00:00.000Z");
  assert.equal(madridDayRange("2026-07-01", "end"), "2026-07-01T21:59:59.999Z");
  assert.equal(madridDayRange("ayer", "start"), null);
});

test("dispositivo legible a partir del navegador", () => {
  assert.equal(parseDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1").label, "iPhone · Safari");
  const a = parseDevice("Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36");
  assert.equal(a.label, "Android · Chrome");
  assert.equal(a.kind, "mobile");
  assert.equal(parseDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0").label, "Windows · Edge");
  assert.equal(parseDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15").label, "Mac · Safari");
  assert.equal(parseDevice(null).label, "Dispositivo desconocido");
});
