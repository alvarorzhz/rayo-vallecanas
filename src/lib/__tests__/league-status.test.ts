import { test } from "node:test";
import assert from "node:assert/strict";
import { alertText, currentProblem, problemSignature } from "../league-status.ts";

test("la firma no cambia si solo cambian los números", () => {
  assert.equal(
    problemSignature("partial", ["Plantilla: 2 de 19 fichas no se han podido descargar."]),
    problemSignature("partial", ["Plantilla: 3 de 20 fichas no se han podido descargar."]),
  );
  assert.notEqual(problemSignature("partial", ["A"]), problemSignature("failed", ["A"]));
  assert.notEqual(problemSignature("partial", ["A"]), problemSignature("partial", ["A", "B"]));
  assert.equal(problemSignature("partial", ["B", "A"]), problemSignature("partial", ["A", "B", "A"]));
});

test("texto del aviso", () => {
  assert.deepEqual(alertText("failed", ["La web de la liga no responde (503)"], "sync"), {
    title: "❌ Ha fallado la sincronización con la liga",
    body: "La web de la liga no responde (503). Mira Partidos → Liga.",
  });
  const partial = alertText("partial", ["Calendario: 1 de 66 partidos no se han podido leer.", "Otro", "Otro más"], "health");
  assert.equal(partial.title, "⚠️ La web de la liga ha cambiado");
  assert.equal(partial.body, "Calendario: 1 de 66 partidos no se han podido leer (y 2 avisos más). Mira Partidos → Liga.");
  assert.ok(alertText("partial", ["x".repeat(500)], "sync").body.length < 200);
});

test("problema que se enseña: manda lo más reciente", () => {
  assert.equal(currentProblem(null), null);
  assert.equal(currentProblem({ status: "ok", issues: [], at: "2026-11-08T10:00:00Z" }), null);

  const partial = currentProblem({ status: "partial", issues: ["A"], at: "2026-11-08T10:00:00Z" });
  assert.deepEqual(partial, { status: "partial", issues: ["A"], at: "2026-11-08T10:00:00Z", source: "sync" });

  // Falló después de una sincronización buena
  assert.equal(currentProblem({ status: "failed", issues: ["caída"], at: "2026-11-01T10:00:00Z", failedAt: "2026-11-08T10:00:00Z" })?.at, "2026-11-08T10:00:00Z");

  // La revisión semanal detecta un cambio después de la última sincronización
  const health = currentProblem({ status: "ok", issues: [], at: "2026-11-01T10:00:00Z", health: { status: "partial", issues: ["B"], at: "2026-11-09T07:00:00Z" } });
  assert.equal(health?.source, "health");

  // …y una sincronización buena posterior lo tapa
  assert.equal(currentProblem({ status: "ok", issues: [], at: "2026-11-09T09:00:00Z", health: { status: "partial", issues: ["B"], at: "2026-11-09T07:00:00Z" } }), null);
});
