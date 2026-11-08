/**
 * Prueba contra la web de verdad de la liga. No se lanza con `npm test` (depende de
 * internet y de que la liga esté en marcha): `npm run test:live`.
 * Comprueba que las páginas de hoy se siguen entendiendo igual que las guardadas.
 *   LEAGUE_COMPETITION=15868 LEAGUE_TEAM=176726 (por defecto, la Apertura 2026/27)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectCalendar, inspectPlayer, inspectSheet, inspectTable, inspectTeam, parseCompetitionName } from "../league-parse.ts";

const live = process.env.LEAGUE_LIVE === "1";
const competition = process.env.LEAGUE_COMPETITION ?? "15868";
const team = process.env.LEAGUE_TEAM ?? "176726";

async function session() {
  const jar = new Map<string, string>();
  const get = async (path: string) => {
    const res = await fetch(`https://www.futormes.com/mod/soccer/${path}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RayoVallecanasApp/tests)", Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
      signal: AbortSignal.timeout(30000),
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    assert.ok(res.ok, `${path} responde ${res.status}`);
    return res.text();
  };
  return { get, situation: await get(`situation.aspx?itm=${competition}`) };
}

test("la web de la liga se sigue entendiendo", { skip: !live && "solo con npm run test:live" }, async () => {
  const s = await session();
  assert.ok(parseCompetitionName(s.situation), "nombre de la competición");

  const cal = inspectCalendar(await s.get("calendar.aspx"));
  assert.deepEqual(cal.issues, [], "calendario");
  assert.ok(cal.items.length > 0);
  const ours = cal.items.filter((r) => r.homeId === team || r.awayId === team);
  assert.ok(ours.length > 0, "nuestro equipo en el calendario");

  const table = inspectTable(await s.get("table.aspx"));
  assert.deepEqual(table.issues, [], "clasificación");
  assert.ok(table.items.some((r) => r.teamId === team));

  const roster = inspectTeam(await s.get(`team.aspx?itm=${team}`));
  assert.deepEqual(roster.issues, [], "plantilla");
  const p = inspectPlayer(roster.items[0], await s.get(`player.aspx?itm=${roster.items[0]}`));
  assert.deepEqual(p.issues, [], "ficha de jugador");

  const last = ours.filter((r) => r.status === "played").at(-1);
  if (last) {
    const home = last.homeId === team;
    const sheet = inspectSheet(await s.get(`match.aspx?itm=${last.extId}`), home ? "L" : "V");
    assert.deepEqual(sheet.issues, [], "ficha del partido");
    // Si la liga apunta los goleadores, tienen que sumar nuestro resultado
    const goals = sheet.items.reduce((n, r) => n + r.goals, 0);
    if (goals) assert.equal(goals, home ? last.goalsHome : last.goalsAway, "goles de la ficha");
  }
});
