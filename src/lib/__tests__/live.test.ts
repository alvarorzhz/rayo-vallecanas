import { test } from "node:test";
import assert from "node:assert/strict";
import { clockLabel, draftFromLive, liveClock, liveScore, type LiveEvent } from "../live.ts";

let t = 0;
const ev = (kind: LiveEvent["kind"], player_id: string | null = null, extra: Partial<LiveEvent> = {}): LiveEvent => ({
  id: `e${t}`, match_id: "m", kind, player_id, assist_id: null, own_goal: false, half: 1, minute: 3,
  created_at: `2026-11-14T10:${String(t++).padStart(2, "0")}:00Z`, ...extra,
});
const app = (o: Partial<{ started: boolean; goalkeeper: boolean }> = {}) => ({ started: false, goalkeeper: false, conceded: 0, yellows: 0, red: false, ...o });

test("marcador según lo apuntado", () => {
  assert.deepEqual(liveScore([ev("goal", "a"), ev("goal_against"), ev("goal", "b"), ev("yellow", "a")]), { gf: 2, ga: 1 });
});

test("minuto de cada parte", () => {
  const start = "2026-11-14T10:00:00Z";
  assert.equal(liveClock({ live_started_at: null }), null);
  assert.deepEqual(liveClock({ live_started_at: start }, new Date("2026-11-14T10:12:30Z")), { half: 1, minute: 13 });
  assert.deepEqual(liveClock({ live_started_at: start, live_second_at: "2026-11-14T10:40:00Z" }, new Date("2026-11-14T10:45:10Z")), { half: 2, minute: 6 });
  assert.equal(clockLabel({ half: 2, minute: 6 }), "6' 2ª");
  assert.equal(clockLabel({ half: 1, minute: 13 }), "13'");
});

test("el acta sale rellena: convocados, tarjetas, goles con asistencia y encajados del portero", () => {
  const pool = new Set(["gk", "a", "b", "c"]);
  const base = { gk: app({ started: true, goalkeeper: true }), a: app({ started: true }), b: app() };
  const events = [
    ev("goal", "a", { assist_id: "b" }),
    ev("yellow", "b"),
    ev("goal_against"),
    ev("goal", null, { own_goal: true }),
    ev("goal", "c"), // no estaba en la convocatoria: entra en el acta
    ev("yellow", "b"),
    ev("goal_against"),
  ];
  const d = draftFromLive(events, base, pool, 2);
  assert.deepEqual(Object.keys(d.apps).sort(), ["a", "b", "c", "gk"]);
  assert.equal(d.apps.gk.conceded, 2);
  assert.equal(d.apps.b.yellows, 2);
  assert.equal(d.apps.b.red, true);
  assert.deepEqual(d.goals, [{ scorer: "a", assist: "b" }, { scorer: "own", assist: "" }, { scorer: "c", assist: "" }]);
});

test("un jugador que ya no está en la plantilla no entra", () => {
  const d = draftFromLive([ev("goal", "x")], {}, new Set(["a"]), 0);
  assert.deepEqual(d.apps, {});
  assert.deepEqual(d.goals, [{ scorer: "", assist: "" }]);
});
