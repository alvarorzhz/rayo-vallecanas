import { test } from "node:test";
import assert from "node:assert/strict";
import { presetKeeper, type ReportDraft } from "../reports.ts";

const app = (o = {}) => ({ started: false, goalkeeper: false, conceded: 0, yellows: 0, red: false, ...o });
const pos = new Map([["gk", "POR"], ["gk2", "POR"], ["df", "DFC"]]);

test("marca al único portero que jugó como titular y portero, con lo encajado", () => {
  const d: ReportDraft = { apps: { gk: app(), df: app() }, goals: [] };
  const r = presetKeeper(d, pos, 2);
  assert.deepEqual(r.apps.gk, app({ started: true, goalkeeper: true, conceded: 2 }));
  assert.deepEqual(r.apps.df, app());
});

test("no toca nada si ya hay portero, si hay dos o si no hay ninguno", () => {
  const ya: ReportDraft = { apps: { gk: app(), df: app({ goalkeeper: true }) }, goals: [] };
  assert.equal(presetKeeper(ya, pos, 1), ya);
  const dos: ReportDraft = { apps: { gk: app(), gk2: app() }, goals: [] };
  assert.equal(presetKeeper(dos, pos, 1), dos);
  const nadie: ReportDraft = { apps: { df: app() }, goals: [] };
  assert.equal(presetKeeper(nadie, pos, 1), nadie);
});
