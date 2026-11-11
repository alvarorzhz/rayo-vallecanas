/**
 * Pruebas de lo que decide la sincronización con la liga sin tocar internet ni la base
 * de datos: cambio de competición, fin de liga, totales por competición, freno y reintentos.
 * Usan las páginas reales guardadas en fixtures/futormes.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCalendar, parseCompetitionMenu, parseCompetitionName, type LeagueRow } from "../league-parse.ts";
import {
  LEAGUE_DATA, NoRetry, findOurTeam, inBatches, leagueFinished, mergeLeagueStats, previewOf, suspiciousRead, teamKey, withRetry,
} from "../league-plan.ts";
import { changesText, leagueOver, nextLeagueText } from "../league-status.ts";

const page = (name: string) => readFileSync(new URL(`./fixtures/futormes/${name}.html`, import.meta.url), "utf8");
const RAYO = "176726";
const rows = parseCalendar(page("calendar"));
const teams = [...new Map(rows.flatMap((r) => [[r.homeId, r.homeName], [r.awayId, r.awayName]] as [string, string][]))].map(([id, name]) => ({ id, name }));
const league = { competitionName: parseCompetitionName(page("situation")), teams, rows };

describe("encontrar la liga nueva", () => {
  test("el menú de futormes da las demás competiciones, sin repetir y sin la miga de pan", () => {
    const menu = parseCompetitionMenu(page("situation"));
    assert.ok(menu.length >= 15, `solo ${menu.length} competiciones`);
    assert.equal(new Set(menu.map((c) => c.id)).size, menu.length);
    assert.deepEqual(menu.find((c) => c.id === "15868"), { id: "15868", label: "GRUPO I" });
    assert.deepEqual(menu.find((c) => c.id === "15869"), { id: "15869", label: "GRUPO II" });
    assert.ok(menu.every((c) => /^\d+$/.test(c.id) && c.label && !/situaci/i.test(c.label)));
    assert.deepEqual(parseCompetitionMenu("<html>sin menú</html>"), []);
  });

  test("nuestro equipo se reconoce por número, por nombre o por «Rayo Vallecañas»", () => {
    assert.equal(teamKey("  RAYO  VALLECAÑAS "), "rayo vallecanas");
    assert.equal(findOurTeam(teams, { id: RAYO }), RAYO);
    // En la liga nueva el número cambia: se le encuentra por el nombre con el que estaba apuntado
    const renumbered = teams.map((t) => ({ id: String(Number(t.id) + 5000), name: t.name }));
    assert.equal(findOurTeam(renumbered, { id: RAYO, name: "Rayo Vallecañas" }), String(Number(RAYO) + 5000));
    assert.equal(findOurTeam(renumbered, {}), String(Number(RAYO) + 5000));
    // Con patrocinador en el nombre también vale
    assert.equal(findOurTeam([{ id: "1", name: "BAR EL BARRIO-RAYO VALLECAÑAS" }, { id: "2", name: "OTRO CF" }], { name: "RAYO VALLECAÑAS" }), "1");
    // Si no está, o hay duda, no se elige a nadie: se pregunta
    assert.equal(findOurTeam([{ id: "2", name: "OTRO CF" }], { id: RAYO, name: "RAYO VALLECAÑAS" }), null);
    assert.equal(findOurTeam([{ id: "1", name: "RAYO VALLECAÑAS" }, { id: "2", name: "RAYO VALLECAÑAS B" }], {}), null);
  });

  test("vista previa: lo que se traería de la competición", () => {
    const pv = previewOf(league, "15868", RAYO, "2026-11-11");
    assert.equal(pv.name, "F7 - LIGA 4ª DIVISIÓN APERTURA | GRUPO I");
    assert.equal(pv.teamName, "RAYO VALLECAÑAS");
    assert.equal(pv.teams, 12);
    assert.equal(pv.matches, 11);
    assert.ok(pv.played > 0 && pv.played < pv.matches);
    assert.ok(pv.from! < pv.to!);
    assert.equal(pv.finished, false);
    assert.equal(previewOf(league, "15868", "999", "2026-11-11").matches, 0);
  });
});

describe("fin de la competición", () => {
  const ours = rows.filter((r) => r.homeId === RAYO || r.awayId === RAYO);
  const last = ours.map((r) => r.date).sort().at(-1)!;
  const allPlayed: LeagueRow[] = rows.map((r) => ({ ...r, status: "played", goalsHome: 1, goalsAway: 0 }));

  test("con partidos por jugar no ha terminado, aunque haya pasado la fecha", () => {
    assert.equal(leagueFinished(rows, RAYO, "2026-11-11"), false);
    assert.equal(leagueFinished(rows, RAYO, "2030-01-01"), false);
  });

  test("termina unos días después del último partido jugado", () => {
    assert.equal(leagueFinished(allPlayed, RAYO, last), false);
    assert.equal(leagueFinished(allPlayed, RAYO, "2030-01-01"), true);
  });

  test("un aplazado la mantiene abierta y un suspendido no", () => {
    const one = (status: LeagueRow["status"]) => allPlayed.map((r, i) => (i === allPlayed.findIndex((x) => x.homeId === RAYO) ? { ...r, status } : r));
    assert.equal(leagueFinished(one("postponed"), RAYO, "2030-01-01"), false);
    assert.equal(leagueFinished(one("cancelled"), RAYO, "2030-01-01"), true);
  });

  test("sin partidos nuestros no se da por terminada", () => {
    assert.equal(leagueFinished(allPlayed, "999", "2030-01-01"), false);
  });

  test("manda lo último que se sabe: sincronización o revisión semanal", () => {
    assert.equal(leagueOver(null), false);
    assert.equal(leagueOver({ at: "2026-12-01T10:00:00Z", finished: false }), false);
    assert.equal(leagueOver({ at: "2026-12-01T10:00:00Z", finished: false, health: { status: "ok", issues: [], at: "2027-01-18T07:00:00Z", finished: true } }), true);
    assert.equal(leagueOver({ at: "2027-01-20T10:00:00Z", finished: false, health: { status: "ok", issues: [], at: "2027-01-18T07:00:00Z", finished: true } }), false);
    // Una revisión antigua, de antes de esta versión, no dice nada
    assert.equal(leagueOver({ at: "2026-12-01T10:00:00Z", finished: true, health: { status: "ok", issues: [], at: "2026-12-07T07:00:00Z" } }), true);
  });
});

describe("totales de un jugador por competición", () => {
  const apertura = { apps: 9, goals: 4, conceded: 0, yellows: 2, reds: 0 };
  const nueva = { apps: 2, goals: 1, conceded: 0, yellows: 0, reds: 1 };

  test("empezar otra liga no borra la anterior: la temporada suma las dos", () => {
    const first = mergeLeagueStats(null, "15868", apertura);
    assert.deepEqual(first.total, apertura);
    const second = mergeLeagueStats(first.by, "16001", nueva);
    assert.deepEqual(second.by, { "15868": apertura, "16001": nueva });
    assert.deepEqual(second.total, { apps: 11, goals: 5, conceded: 0, yellows: 2, reds: 1 });
  });

  test("volver a leer la misma competición sustituye sus números, no los suma otra vez", () => {
    const a = mergeLeagueStats({ "15868": apertura, "16001": nueva }, "16001", { ...nueva, apps: 3, goals: 2 });
    assert.deepEqual(a.total, { apps: 12, goals: 6, conceded: 0, yellows: 2, reds: 1 });
    assert.deepEqual(mergeLeagueStats(a.by, "16001", { ...nueva, apps: 3, goals: 2 }).total, a.total);
  });

  test("datos raros guardados no rompen la suma", () => {
    const m = mergeLeagueStats({ "15868": { apps: 3, goals: -2 }, basura: apertura, "16000": null as never }, "16001", { ...nueva, goals: Number.NaN });
    assert.deepEqual(Object.keys(m.by).sort(), ["15868", "16001"]);
    assert.deepEqual(m.total, { apps: 5, goals: 0, conceded: 0, yellows: 0, reds: 1 });
  });
});

describe("freno de seguridad", () => {
  test("una lectura con bastantes menos partidos de los que había no se guarda", () => {
    assert.match(suspiciousRead({ stored: 11, read: 3 })!, /solo enseña 3 partidos nuestros.*ya tenía 11/);
    assert.match(suspiciousRead({ stored: 11, read: 1 })!, /1 partido nuestro /);
    assert.match(suspiciousRead({ stored: 11, read: 6 })!, /No se ha guardado nada/);
  });

  test("lo normal pasa: mismos partidos, alguno más o alguno menos", () => {
    assert.equal(suspiciousRead({ stored: 11, read: 11 }), null);
    assert.equal(suspiciousRead({ stored: 11, read: 13 }), null);
    assert.equal(suspiciousRead({ stored: 11, read: 7 }), null);
  });

  test("en la primera lectura de una competición no hay con qué comparar", () => {
    assert.equal(suspiciousRead({ stored: 0, read: 11 }), null);
    assert.equal(suspiciousRead({ stored: 3, read: 1 }), null);
  });
});

describe("reintentos", () => {
  const noWait = { sleep: async () => {} };

  test("si la web falla dos veces y a la tercera contesta, sigue", async () => {
    let calls = 0;
    const waits: number[] = [];
    const r = await withRetry(async () => { if (++calls < 3) throw new Error("503"); return "ok"; }, { wait: 100, sleep: async (ms) => { waits.push(ms); } });
    assert.equal(r, "ok");
    assert.equal(calls, 3);
    assert.deepEqual(waits, [100, 200]);
  });

  test("al tercer fallo se rinde con el último error", async () => {
    let calls = 0;
    await assert.rejects(withRetry(async () => { calls++; throw new Error(`fallo ${calls}`); }, noWait), /fallo 3/);
    assert.equal(calls, 3);
  });

  test("lo que no se arregla repitiendo no se repite", async () => {
    let calls = 0;
    await assert.rejects(withRetry(async () => { calls++; throw new NoRetry("404"); }, noWait), /404/);
    assert.equal(calls, 1);
  });

  test("las tandas respetan el orden y el tamaño", async () => {
    let running = 0, max = 0;
    const out = await inBatches([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      max = Math.max(max, ++running);
      await new Promise((ok) => setTimeout(ok, 2));
      running--;
      return n * 2;
    });
    assert.deepEqual(out, [2, 4, 6, 8, 10, 12, 14]);
    assert.equal(max, 3);
  });
});

describe("lo que se enseña en Partidos → Liga", () => {
  test("la explicación de los datos cubre todo lo que se trae", () => {
    assert.deepEqual(LEAGUE_DATA.map((d) => d.what), [
      "Competición", "Partidos del Rayo", "Rivales", "Clasificación", "Plantilla", "Totales de cada jugador", "Acta de un partido",
    ]);
    for (const d of LEAGUE_DATA) assert.ok(d.fields.length > 10 && d.page && d.saved.length > 10, d.what);
  });

  test("resumen de la última lectura", () => {
    assert.equal(changesText({}), "sin cambios");
    assert.equal(changesText({ matchesNew: 1, results: 2, playersNew: 0 }), "1 partido nuevo, 2 resultados");
    assert.equal(changesText({ matchesUpdated: 3, rivalsNew: 1, playersNew: 4 }), "3 partidos actualizados, 1 rival nuevo, 4 jugadores nuevos");
  });

  test("aviso de liga nueva", () => {
    const t = nextLeagueText("F7 - LIGA 3ª DIVISIÓN CLAUSURA | GRUPO II");
    assert.equal(t.title, "🏆 Hay liga nueva en futormes");
    assert.equal(t.body, "El Rayo aparece en «F7 - LIGA 3ª DIVISIÓN CLAUSURA | GRUPO II». Entra en Partidos → Liga para cambiarla.");
    assert.ok(nextLeagueText("x".repeat(300)).body.length < 180);
  });
});
