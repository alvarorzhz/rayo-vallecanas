import { test } from "node:test";
import assert from "node:assert/strict";
import { accountBar, accountsTotals, sellerAccount } from "../lottery/accounts.ts";

const row = (sold: number, paid: number, handed: number) => ({ seller_id: "s", full_name: "Rubén", shares: 1, sold_cents: sold, paid_cents: paid, handed_cents: handed });

test("lo que debe un vendedor es lo cobrado menos lo entregado", () => {
  const a = sellerAccount(row(30000, 26000, 8000));
  assert.equal(a.owed, 18000);
  assert.equal(a.unpaid, 4000);
  assert.equal(a.state, "debe");
});

test("al día, sin ventas y entregado de más", () => {
  assert.equal(sellerAccount(row(20000, 20000, 20000)).state, "al-dia");
  assert.equal(sellerAccount(row(0, 0, 0)).state, "sin-ventas");
  const over = sellerAccount(row(10000, 5000, 7000));
  assert.equal(over.state, "de-mas");
  assert.equal(over.owed, 0);
  assert.equal(over.over, 2000);
});

test("Postgres devuelve los bigint como texto: se convierten", () => {
  const a = sellerAccount({ seller_id: "s", full_name: "x", shares: "3" as unknown as number, sold_cents: "1500" as unknown as number, paid_cents: "1500" as unknown as number, handed_cents: "500" as unknown as number });
  assert.equal(a.owed, 1000);
  assert.equal(a.shares, 3);
});

test("totales y barra", () => {
  const rows = [sellerAccount(row(30000, 26000, 8000)), sellerAccount(row(20000, 20000, 20000))];
  assert.deepEqual(accountsTotals(rows), { handed: 28000, owed: 18000, unpaid: 4000 });
  const b = accountBar(rows[0]);
  assert.ok(Math.abs(b.handed - 26.67) < 0.01);
  assert.equal(b.owed, 60);
});
