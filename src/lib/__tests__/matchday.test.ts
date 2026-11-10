import { test } from "node:test";
import assert from "node:assert/strict";
import { matchdayPhase } from "../matchday.ts";

const played = (match_date: string, kickoff: string | null) => ({ match_date, kickoff, status: "played" as const });
// 2026-11-14 es sábado; en noviembre Madrid va a UTC+1
const at = (iso: string) => new Date(iso);

test("el post partido dura como mucho 24 horas después de acabar el partido", () => {
  const m = played("2026-11-14", "18:30:00"); // acaba sobre las 20:30 de Madrid (19:30 UTC)
  assert.equal(matchdayPhase(m, at("2026-11-14T21:00:00Z")), "final");
  assert.equal(matchdayPhase(m, at("2026-11-15T10:00:00Z")), "post");
  assert.equal(matchdayPhase(m, at("2026-11-15T19:29:00Z")), "post");
  assert.equal(matchdayPhase(m, at("2026-11-15T19:31:00Z")), null);
  assert.equal(matchdayPhase(m, at("2026-11-16T10:00:00Z")), null);
});

test("sin hora, el post partido se cuenta desde las 14:00 de Madrid", () => {
  const m = played("2026-11-14", null);
  assert.equal(matchdayPhase(m, at("2026-11-15T12:59:00Z")), "post");
  assert.equal(matchdayPhase(m, at("2026-11-15T13:01:00Z")), null);
});
