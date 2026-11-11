import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuestionsPrompt, interviewNotes, interviewToBody, mergeAnswers, parseBody, parseQuestions, readQuestions, MAX_QUESTIONS, type PlayerFacts } from "../news.ts";

const player: PlayerFacts = { name: "Chino", position: "Delantero", number: 9, season: "2026/27", stats: { apps: 6, goals: 7, assists: 2, mvps: 2 } };

test("el prompt de preguntas solo lleva el apodo y pide el formato P:", () => {
  const p = buildQuestionsPrompt({ player, notes: "Pregúntale por el gol de chilena" });
  assert.match(p, /Chino, dorsal 9, delantero/);
  assert.match(p, /7 goles/);
  assert.match(p, /chilena/);
  assert.match(p, /empezando cada una por «P: »/);
});

test("las preguntas de la IA se leen con P:, con números, con guiones o una por línea", () => {
  assert.deepEqual(parseQuestions("Aquí van:\nP: ¿Cómo llegaste al Rayo?\nP: ¿Tu mejor gol?\n"), ["¿Cómo llegaste al Rayo?", "¿Tu mejor gol?"]);
  assert.deepEqual(parseQuestions("1. ¿Qué tal?\n2) **¿Y el equipo?**"), ["¿Qué tal?", "¿Y el equipo?"]);
  assert.deepEqual(parseQuestions("- ¿Uno?\n* ¿Dos?"), ["¿Uno?", "¿Dos?"]);
  assert.deepEqual(parseQuestions("¿Uno?\n¿Dos?"), ["¿Uno?", "¿Dos?"]);
  assert.deepEqual(parseQuestions("```\nP: ¿Uno?\nR: (respuesta)\n```"), ["¿Uno?"]);
  assert.equal(parseQuestions(Array.from({ length: 20 }, (_, i) => `P: ¿Pregunta ${i}?`).join("\n")).length, MAX_QUESTIONS);
});

test("las preguntas del editor se validan", () => {
  assert.deepEqual(readQuestions(JSON.stringify(["  ¿Qué tal?  ", "", "ok"])), { questions: ["¿Qué tal?"] });
  assert.equal(readQuestions("no es json").error, "No se han podido leer las preguntas");
  assert.equal(readQuestions("[]").error, "Escribe al menos una pregunta");
  assert.ok(readQuestions(JSON.stringify(Array.from({ length: 13 }, () => "¿Pregunta?"))).error);
});

test("al volver a mandarla se conservan las respuestas de las preguntas que no cambian", () => {
  const old = [{ q: "¿Qué tal?", a: "Bien" }, { q: "¿Tu ídolo?", a: null }];
  assert.deepEqual(mergeAnswers(["¿qué tal?", "¿Tu mejor gol?"], old), [{ q: "¿qué tal?", a: "Bien" }, { q: "¿Tu mejor gol?", a: null }]);
});

test("las respuestas se montan como P/R en el texto, en una sola línea cada una", () => {
  const body = interviewToBody([{ q: "¿Qué tal?", a: "Muy bien.\nCon ganas." }, { q: "¿Sin contestar?", a: null }, { q: "¿Tu ídolo?", a: "Raúl" }]);
  assert.equal(body, "P: ¿Qué tal?\n\nR: Muy bien. Con ganas.\n\nP: ¿Tu ídolo?\n\nR: Raúl");
  assert.deepEqual(parseBody(body).map((b) => b.t), ["q", "a", "q", "a"]);
  assert.match(interviewNotes([{ q: "¿Qué tal?", a: "Bien" }]), /RESPUESTAS DEL JUGADOR[\s\S]*R: Bien/);
  assert.equal(interviewNotes([{ q: "¿Qué tal?", a: null }]), "");
});
