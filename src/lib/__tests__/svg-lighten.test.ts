import { test } from "node:test";
import assert from "node:assert/strict";
import { lighten } from "../svg-lighten.ts";

const svg = (mask: string, img: string) =>
  `<svg><defs><mask id="satori_om-id-1">${mask}</mask></defs><image ${img} href="data:x" clip-path="url(#satori_cp-id-1)" mask="url(#satori_om-id-1)"/></svg>`;

test("quita la máscara que es un rectángulo blanco del tamaño de la imagen", () => {
  const out = lighten(svg(`<rect x="164" y="1029" width="164" height="142" fill="#fff"/>`, `x="164" y="1028.93" width="164" height="142.13"`));
  assert.ok(!out.includes(' mask="'));
  assert.ok(out.includes('clip-path="url(#satori_cp-id-1)"'));
});

test("deja la máscara si recorta de verdad la imagen", () => {
  const out = lighten(svg(`<rect x="0" y="0" width="100" height="50" fill="#fff"/>`, `x="0" y="0" width="100" height="120"`));
  assert.ok(out.includes('mask="url(#satori_om-id-1)"'));
});

test("deja la máscara si no es un simple rectángulo blanco", () => {
  const out = lighten(svg(`<rect x="0" y="0" width="100" height="100" fill="url(#g)"/>`, `x="0" y="0" width="100" height="100"`));
  assert.ok(out.includes('mask="url(#satori_om-id-1)"'));
});
