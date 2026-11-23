import { test } from "node:test";
import assert from "node:assert/strict";
import { missingNumbers, normalizeSize, purchaseHref, repeatedNumbers, shortfall, sizeSummary, sortLots, tally } from "../material.ts";

const lot = (qty: number, condition: "new" | "used" | "broken", extra: { size?: string | null; number?: number | null; holder?: string | null } = {}) =>
  ({ qty, condition, size: extra.size ?? null, number: extra.number ?? null, holder_player_id: extra.holder ?? null });

test("cuenta piezas por estado, las útiles y las prestadas", () => {
  const t = tally([lot(8, "new"), lot(3, "used", { holder: "p1" }), lot(2, "broken")]);
  assert.deepEqual(t, { total: 13, new: 8, used: 3, broken: 2, usable: 11, lent: 3 });
  assert.deepEqual(tally([]), { total: 0, new: 0, used: 0, broken: 0, usable: 0, lent: 0 });
});

test("lo que falta solo cuenta con mínimo y con las piezas que sirven", () => {
  assert.equal(shortfall({ min_qty: 6 }, { usable: 4, total: 5 }), 2);
  assert.equal(shortfall({ min_qty: 6 }, { usable: 9, total: 9 }), 0);
  assert.equal(shortfall({ min_qty: null }, { usable: 0, total: 3 }), 0);
  // Todas rotas: falta todo el mínimo
  assert.equal(shortfall({ min_qty: 2 }, { usable: 0, total: 3 }), 2);
  // Sin contar todavía: no avisa
  assert.equal(shortfall({ min_qty: 6 }, { usable: 0, total: 0 }), 0);
});

test("tallas: se escriben como en la tienda y se ordenan de pequeña a grande", () => {
  assert.equal(normalizeSize(" m "), "M");
  assert.equal(normalizeSize("2xl"), "XXL");
  assert.equal(normalizeSize("xxxl"), "3XL");
  assert.equal(normalizeSize("42"), "42");
  assert.equal(normalizeSize(""), null);
  assert.deepEqual(sizeSummary([lot(2, "new", { size: "XL" }), lot(4, "used", { size: "M" }), lot(1, "broken", { size: "S" }), lot(1, "new", { size: "M" })]),
    [{ size: "M", qty: 5 }, { size: "XL", qty: 2 }]);
});

test("orden de las piezas: dorsal, talla y las rotas al final", () => {
  const sorted = sortLots([lot(1, "new", { number: 10 }), lot(5, "broken"), lot(1, "new", { number: 1 }), lot(5, "new", { size: "L" }), lot(5, "new", { size: "S" })]);
  assert.deepEqual(sorted.map((l) => l.number ?? `${l.size ?? "-"}${l.condition}`), [1, 10, "Snew", "Lnew", "-broken"]);
});

test("dorsales repetidos y dorsales de la plantilla que faltan", () => {
  const lots = [lot(1, "new", { number: 7 }), lot(1, "used", { number: 7 }), lot(1, "broken", { number: 9 }), lot(1, "new", { number: 1 })];
  assert.deepEqual(repeatedNumbers(lots), [7]);
  // El 9 solo está roto: cuenta como que falta
  assert.deepEqual(missingNumbers([1, 7, 9, 11, null, 11], lots), [9, 11]);
});

test("el enlace de compra lleva concepto y categoría para Finanzas", () => {
  const href = purchaseHref({ name: "Balones" }, 3);
  const u = new URL(href, "https://x.test");
  assert.equal(u.pathname, "/finanzas/nuevo");
  assert.equal(u.searchParams.get("tipo"), "gasto");
  assert.equal(u.searchParams.get("categoria"), "Material deportivo");
  assert.equal(u.searchParams.get("concepto"), "Compra de material: Balones (3)");
});
