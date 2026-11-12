import { test } from "node:test";
import assert from "node:assert/strict";
import { ageOf, docExpiry, feeOf, feeStatus, fileSize, fullName, lineOf, nextSeason, prevSeason, ratio, seasonFromSlug, seasonSlug, shirtName, sortRoster, orderRoster, orderFromSlug, groupByLine, type Player } from "../squad.ts";

const player = (first_name: string, last_name: string, nickname: string | null = null) => ({ first_name, last_name, nickname }) as Player;

test("el nombre de la camiseta es el apodo o el primer apellido", () => {
  assert.equal(shirtName(player("Dani", "García López", "Dani")), "Dani");
  assert.equal(shirtName(player("Carlos", "Castro Ruiz")), "Castro");
  assert.equal(shirtName(player("Lucho", "")), "Lucho");
  assert.equal(shirtName(player("Iván", "Navarro", "  ")), "Navarro");
  assert.equal(fullName(player("Lucho", "")), "Lucho");
});

test("la edad cuenta si ya ha cumplido años", () => {
  const on = new Date(2026, 10, 14);
  assert.equal(ageOf("1990-11-14", on), 36);
  assert.equal(ageOf("1990-11-15", on), 35);
  assert.equal(ageOf("1990-01-01", on), 36);
  assert.equal(ageOf(null, on), null);
});

test("la plantilla se ordena de portero a delantero y luego por dorsal", () => {
  const row = (position: string, number: number | null, last: string) => ({ position, number, player: player("X", last) });
  const out = sortRoster([row("DC", 9, "Fuentes"), row("MCD", 6, "Herrero"), row("POR", 1, "Sanz"), row("DFC", null, "Zeta"), row("DFC", 4, "Castro"), row("DFC", null, "Alba")]);
  assert.deepEqual(out.map((r) => r.player.last_name), ["Sanz", "Castro", "Alba", "Zeta", "Herrero", "Fuentes"]);
  assert.equal(lineOf("POR"), "GK");
  assert.equal(lineOf("XXX"), "MID");
});

test("las temporadas avanzan y retroceden, también al cambiar de siglo", () => {
  assert.equal(nextSeason("2026/27"), "2027/28");
  assert.equal(prevSeason("2026/27"), "2025/26");
  assert.equal(nextSeason("2098/99"), "2099/00");
  assert.equal(prevSeason(nextSeason("2026/27")), "2026/27");
  assert.equal(seasonSlug("2026/27"), "2026-27");
  assert.equal(seasonFromSlug("2026-27"), "2026/27");
  assert.equal(seasonFromSlug("2026/27"), null);
  assert.equal(seasonFromSlug(null), null);
});

test("la cuota de un jugador es la suya propia o la general", () => {
  const plan = { season: "2026/27", amount_cents: 12000, due_on: null, notes: null };
  const special = { season: "2026/27", player_id: "p", amount_cents: 6000, reason: "Media temporada" };
  const exempt = { ...special, amount_cents: 0 };
  assert.equal(feeOf(plan, null), 12000);
  assert.equal(feeOf(plan, special), 6000);
  assert.equal(feeOf(plan, exempt), 0);
  assert.equal(feeOf(null, undefined), null);
});

test("el estado de la cuota según lo pagado", () => {
  assert.equal(feeStatus(12000, 0), "pending");
  assert.equal(feeStatus(12000, 5000), "partial");
  assert.equal(feeStatus(12000, 12000), "paid");
  assert.equal(feeStatus(12000, 15000), "paid");
  assert.equal(feeStatus(0, 0), "exempt");
  assert.equal(feeStatus(null, 0), "none");
  assert.equal(feeStatus(null, 3000), "paid");
});

test("los documentos avisan cuando vencen o están a punto", () => {
  assert.equal(docExpiry(null, "2026-11-10"), null);
  assert.equal(docExpiry("2026-11-09", "2026-11-10"), "expired");
  assert.equal(docExpiry("2026-11-10", "2026-11-10"), "soon");
  assert.equal(docExpiry("2026-12-10", "2026-11-10"), "soon");
  assert.equal(docExpiry("2026-12-11", "2026-11-10"), "ok");
});

test("tamaños de archivo y medias legibles", () => {
  assert.equal(fileSize(100), "1 KB");
  assert.equal(fileSize(250 * 1024), "250 KB");
  assert.equal(fileSize(1.5 * 1024 * 1024), "1,5 MB");
  assert.equal(ratio(9, 4), "2,25");
  assert.equal(ratio(3, 0), "–");
});

const row = (nick: string, position: string, number: number | null, goals = 0, assists = 0, apps = 0) =>
  ({ position, number, goals, assists, apps, player: player(nick, "X", nick) });
const roster = [row("Lucho", "DC", 10, 8, 3, 13), row("Martín", "POR", 1, 0, 0, 13), row("Pérez", "LD", 2, 0, 1, 10), row("Fuentes", "DC", 9, 10, 1, 10), row("Sin", "MCO", null, 0, 0, 2)];
const names = (rows: { player: Player }[]) => rows.map((r) => r.player.nickname);

test("orden de los cromos de la plantilla", () => {
  assert.deepEqual(names(orderRoster(roster, "lineas")), ["Martín", "Pérez", "Sin", "Fuentes", "Lucho"]);
  assert.deepEqual(names(orderRoster(roster, "dorsal")), ["Martín", "Pérez", "Fuentes", "Lucho", "Sin"]);
  assert.deepEqual(names(orderRoster(roster, "goles")), ["Fuentes", "Lucho", "Pérez", "Martín", "Sin"]);
  // Empate a 13 partidos: desempata por goles
  assert.deepEqual(names(orderRoster(roster, "partidos")), ["Lucho", "Martín", "Fuentes", "Pérez", "Sin"]);
  assert.equal(orderFromSlug("goles"), "goles");
  assert.equal(orderFromSlug("raro"), "lineas");
  assert.equal(orderFromSlug(undefined), "lineas");
});

test("la plantilla por líneas no enseña líneas vacías", () => {
  const g = groupByLine(roster);
  assert.deepEqual(g.map((x) => [x.line.key, names(x.rows)]), [["GK", ["Martín"]], ["DEF", ["Pérez"]], ["MID", ["Sin"]], ["FWD", ["Fuentes", "Lucho"]]]);
  assert.deepEqual(groupByLine([row("A", "DC", 9)]).map((x) => x.line.key), ["FWD"]);
});
