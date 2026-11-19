import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deltaLabel, leagueForecast, matchOdds, oddsFor, pct, poisson, rng } from "../league-forecast.ts";
import { parseCalendar, parseTable } from "../league-parse.ts";
import type { LeagueRow, StandingRow } from "../league-parse.ts";

const page = (name: string) => readFileSync(new URL(`./fixtures/futormes/${name}.html`, import.meta.url), "utf8");
const rows = parseTable(page("table")).map((r) => ({ ...r, form: [] })) as StandingRow[];
const calendar = parseCalendar(page("calendar"));
const US = "176726";

test("el azar con semilla repite y el Poisson da la media que toca", () => {
  const a = rng(42), b = rng(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
  const r = rng(7);
  let sum = 0;
  for (let i = 0; i < 20000; i++) sum += poisson(3.5, r);
  assert.ok(Math.abs(sum / 20000 - 3.5) < 0.08);
});

test("victoria, empate y derrota suman 1 y el que más marca es favorito", () => {
  const o = matchOdds(4, 1.5);
  assert.ok(Math.abs(o.win + o.draw + o.loss - 1) < 1e-9);
  assert.ok(o.win > 0.7 && o.loss < 0.15);
  const even = matchOdds(3, 3);
  assert.ok(Math.abs(even.win - even.loss) < 1e-9);
});

test("la previsión con la liga de verdad: probabilidades que cuadran y siempre lo mismo", () => {
  const f = leagueForecast(rows, calendar, US, 4000)!;
  assert.ok(f);
  assert.equal(f.teams, 12);
  assert.equal(f.upN, 6);
  assert.equal(f.downN, 6);
  assert.ok(Math.abs(f.pUp + f.pMid + f.pDown - 1) < 1e-9);
  assert.ok(Math.abs(f.posDist.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(f.next && f.next.home === false, "el próximo es fuera, contra Alfaro");
  assert.equal(f.next!.oppId, "177139");
  assert.ok(Math.abs(f.next!.win + f.next!.draw + f.next!.loss - 1) < 1e-9);
  // Ganar ayuda más que perder
  assert.ok(f.next!.ifWin >= f.next!.ifLoss);
  // Mismos datos, mismos números
  assert.deepEqual(leagueForecast(rows, calendar, US, 4000), f);
  assert.equal(f.lastGame?.round, "Jornada 4");
  assert.equal(typeof f.delta, "number");
});

test("el líder tiene casi seguro el ascenso y el colista casi seguro el descenso", () => {
  const top = leagueForecast(rows, calendar, "176715", 4000)!;
  const last = leagueForecast(rows, calendar, "177139", 4000)!;
  assert.ok(top.pUp > 0.9 && top.pFirst > 0.3);
  assert.ok(last.pDown > 0.95);
  assert.equal(top.likelyPos, 1);
  assert.equal(last.likelyPos, 12);
});

test("sin partidos pendientes, sin calendario o sin nosotros en la tabla no hay previsión", () => {
  const done: LeagueRow[] = calendar.map((r) => ({ ...r, status: "played", goalsHome: r.goalsHome ?? 1, goalsAway: r.goalsAway ?? 1 }));
  assert.equal(leagueForecast(rows, done, US, 100), null);
  assert.equal(leagueForecast(rows, [], US, 100), null);
  assert.equal(leagueForecast(rows, calendar, "999", 100), null);
});

test("si ya es seguro o imposible lo dice en vez de inventar", () => {
  // Una liga de 4 con 1 jornada pendiente: el primero ya no puede bajar del 2º
  const r = (pos: number, id: string, points: number): StandingRow => ({ pos, teamId: id, name: id, played: 5, won: 0, drawn: 0, lost: 0, gf: 10, ga: 10, gd: 0, penalty: 0, points, move: 0, zone: null, form: [] });
  const table = [r(1, "a", 15), r(2, "b", 9), r(3, "c", 3), r(4, "d", 0)];
  const g = (h: string, a: string, status: LeagueRow["status"]): LeagueRow => ({ extId: h + a, round: "J6", date: "2026-12-01", time: null, venue: null, address: null, homeId: h, homeName: h, awayId: a, awayName: a, goalsHome: null, goalsAway: null, status });
  const f = leagueForecast(table, [g("a", "c", "scheduled"), g("b", "d", "scheduled")], "a", 500)!;
  // Con 4 equipos suben 3 (como mucho n-1) y el líder lo tiene hecho
  assert.equal(f.upSure, true);
  assert.equal(pct(f.pUp, f.upSure, f.upGone), "100 %");
});

test("los porcentajes no dicen 0 ni 100 si aún no es seguro", () => {
  assert.equal(pct(0.634), "63 %");
  assert.equal(pct(0.999), ">99 %");
  assert.equal(pct(0.001), "<1 %");
  assert.equal(pct(0.5, false, true), "0 %");
  assert.deepEqual(deltaLabel(12), { text: "▲12", up: true });
  assert.deepEqual(deltaLabel(-5), { text: "▼5", up: false });
  assert.equal(deltaLabel(0), null);
  assert.equal(deltaLabel(null), null);
});

test("las probabilidades de un partido se buscan por rival (y fecha)", () => {
  const f = leagueForecast(rows, calendar, US, 1000)!;
  assert.equal(oddsFor(f, "177139")?.oppId, "177139");
  assert.equal(oddsFor(f, "177139"), f.next);
  const later = f.fixtures[1];
  assert.equal(oddsFor(f, later.oppId, later.date)?.date, later.date);
  assert.equal(oddsFor(f, "nadie"), null);
  assert.equal(oddsFor(null, "177139"), null);
});
