import { test } from "node:test";
import assert from "node:assert/strict";
import { money, shownStatus, splitInstallments, type Agreement } from "../sponsors.ts";

test("los plazos reparten el importe y caen el mismo día de cada mes", () => {
  assert.deepEqual(splitInstallments(100_00, 3, "2026-09-30"), [
    { due_on: "2026-09-30", amount_cents: 33_34 },
    { due_on: "2026-10-30", amount_cents: 33_33 },
    { due_on: "2026-11-30", amount_cents: 33_33 },
  ]);
  // 31 de enero → 28 de febrero; y pasa de año
  assert.deepEqual(splitInstallments(200_00, 2, "2026-12-31").map((p) => p.due_on), ["2026-12-31", "2027-01-31"]);
  assert.equal(splitInstallments(300_00, 2, "2027-01-31")[1].due_on, "2027-02-28");
  assert.equal(splitInstallments(50_00, 1, "2026-10-01").length, 1);
});

const base: Agreement = {
  id: "a", sponsor_id: "s", season: "2026/27", kind: "money", amount_cents: 400_00, in_kind: null, in_kind_value_cents: null,
  benefits: null, status: "signed", starts_on: null, ends_on: "2027-06-30", contract_path: null, contract_name: null, notes: null,
  installments: [
    { id: "1", agreement_id: "a", due_on: "2026-10-01", amount_cents: 200_00, payment: { installment_id: "1", movement_id: "m", op_date: "2026-10-02", amount_cents: 200_00, method: "bizum" } },
    { id: "2", agreement_id: "a", due_on: "2027-01-01", amount_cents: 200_00, payment: null },
  ],
};

test("cobrado, pendiente, plazos vencidos y estado", () => {
  const m = money(base, "2027-02-01");
  assert.equal(m.paid, 200_00);
  assert.equal(m.pending, 200_00);
  assert.equal(m.overdue.length, 1);
  assert.equal(shownStatus(base, "2027-02-01"), "signed");
  const paid = { ...base, installments: base.installments.map((i) => ({ ...i, payment: i.payment ?? { ...base.installments[0].payment!, installment_id: i.id } })) };
  assert.equal(shownStatus(paid, "2027-02-01"), "paid");
  assert.equal(shownStatus(paid, "2027-07-01"), "expired");
  assert.equal(shownStatus({ ...base, status: "negotiating" }, "2027-02-01"), "negotiating");
  assert.equal(money({ ...base, kind: "in_kind" }, "2027-02-01").total, 0);
});
