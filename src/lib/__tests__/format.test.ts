import { test } from "node:test";
import assert from "node:assert/strict";
import { euros, fecha, fechaLarga, parseEuros, parseRanges, phoneE164, ranges } from "../format.ts";

const plain = (s: string) => s.replace(/\s/g, " ");

test("los importes se escriben en euros y se leen con coma o con punto", () => {
  assert.equal(plain(euros(1250)), "12,50 €");
  assert.equal(plain(euros(null)), "0,00 €");
  assert.equal(parseEuros("12,50"), 1250);
  assert.equal(parseEuros("12.5"), 1250);
  assert.equal(parseEuros(" 1 200 € "), 120000);
  assert.equal(parseEuros(""), 0);
  assert.equal(parseEuros(null), 0);
  // Los céntimos no se pierden por el redondeo de los decimales
  assert.equal(parseEuros("0,29"), 29);
  assert.equal(parseEuros("19,99"), 1999);
});

test("un importe negativo o que no es un número se rechaza", () => {
  assert.throws(() => parseEuros("-5"), /no válido/);
  assert.throws(() => parseEuros("doce"), /no válido/);
  assert.throws(() => parseEuros("1,2,3"), /no válido/);
});

test("los números de las participaciones se agrupan en rangos y se vuelven a leer", () => {
  assert.equal(ranges([1, 2, 3, 7, 9, 10]), "1-3, 7, 9-10");
  assert.equal(ranges([10, 1, 2]), "1-2, 10");
  assert.equal(ranges([]), "");
  assert.deepEqual(parseRanges("1-3, 7"), [1, 2, 3, 7]);
  assert.deepEqual(parseRanges("7;1-3 2"), [1, 2, 3, 7]);
  assert.deepEqual(parseRanges(ranges([4, 5, 6, 20, 22])), [4, 5, 6, 20, 22]);
  assert.throws(() => parseRanges("3-1"), /Rango no válido/);
  assert.throws(() => parseRanges("1-a"), /Formato no válido/);
  assert.throws(() => parseRanges("1-20000"), /Rango no válido/);
});

test("los teléfonos se dejan listos para WhatsApp", () => {
  assert.equal(phoneE164("600 123 456"), "34600123456");
  assert.equal(phoneE164("+34 600-123-456"), "34600123456");
  assert.equal(phoneE164("0034600123456"), "34600123456");
  assert.equal(phoneE164("923 12 34 56"), "34923123456");
  assert.equal(phoneE164("12345"), null);
  assert.equal(phoneE164(""), null);
  assert.equal(phoneE164(null), null);
});

test("las fechas salen en español y en la hora de Madrid", () => {
  assert.equal(fechaLarga("2026-12-22"), "martes, 22 de diciembre de 2026");
  assert.equal(fechaLarga(null), "");
  assert.equal(fecha(null), "—");
  // Las 23:30 UTC del día 14 ya son el día 15 en Madrid
  assert.match(fecha("2026-11-14T23:30:00Z"), /^15 nov 2026$/);
  assert.match(fecha("2026-11-14T18:30:00Z", true), /14 nov 2026.*19:30/);
});
