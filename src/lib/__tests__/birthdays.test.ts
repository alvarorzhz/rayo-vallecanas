import { test } from "node:test";
import assert from "node:assert/strict";
import { birthdayIn, birthdays, whenLabel } from "../birthdays.ts";

test("quién cumple hoy y quién en los próximos días", () => {
  const rows = [
    { player_id: "hoy", month: 11, day: 14 },
    { player_id: "manana", month: 11, day: 15 },
    { player_id: "semana", month: 11, day: 20 },
    { player_id: "lejos", month: 12, day: 25 },
    { player_id: "ayer", month: 11, day: 13 },
  ];
  const b = birthdays(rows, "2026-11-14");
  assert.deepEqual(b.today.map((r) => r.player_id), ["hoy"]);
  assert.deepEqual(b.upcoming.map((r) => [r.player_id, r.inDays]), [["manana", 1], ["semana", 6]]);
});

test("a final de año mira el año siguiente", () => {
  const b = birthdays([{ player_id: "a", month: 1, day: 2 }], "2026-12-30");
  assert.deepEqual(b.upcoming.map((r) => [r.date, r.inDays]), [["2027-01-02", 3]]);
});

test("el 29 de febrero se celebra el 28 si el año no es bisiesto", () => {
  assert.equal(birthdayIn(2027, { month: 2, day: 29 }), "2027-02-28");
  assert.equal(birthdayIn(2028, { month: 2, day: 29 }), "2028-02-29");
  assert.equal(birthdays([{ player_id: "a", month: 2, day: 29 }], "2027-02-28").today.length, 1);
});

test("texto de cuándo", () => {
  assert.equal(whenLabel("2026-11-15", 1), "mañana");
  assert.equal(whenLabel("2026-11-21", 6), "el sábado");
  assert.equal(whenLabel("2026-11-22", 7), "el domingo 22");
});
