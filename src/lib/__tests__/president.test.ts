import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPressPrompt, envelope, parsePress, pressCues, rateOf, readCues, sentenceCues, speakableText, speechScript, splitSentences, wavFile, PRESS_MAX } from "../president.ts";
import type { MatchFacts } from "../news.ts";

const facts: MatchFacts = {
  rival: "Alfareros", home: true, date: "domingo, 22 de noviembre", competition: "Liga", round: "Jornada 8", venue: null, kickoff: "18:30",
  played: true, goalsFor: 3, goalsAgainst: 1, scorers: [{ name: "Fuentes", goals: 2 }, { name: "Dani", goals: 1 }], ownGoals: 0,
  assists: [], starters: [], subs: [], goalkeeper: null, cards: [], mvp: "Dani", usRank: { pos: 4, points: 16, total: 12 }, rivalRank: null,
  callup: [], form: null,
};

test("el prompt lleva los datos del acta, el personaje y las reglas de respeto", () => {
  const p = buildPressPrompt(facts);
  assert.match(p, /Don Rayo/);
  assert.match(p, /Rayo Vallecañas 3-1 Alfareros/);
  assert.match(p, /Fuentes \(2\) y Dani/);
  assert.match(p, /MVP del partido.*Dani/);
  assert.match(p, /4º de 12/);
  assert.match(p, /sin insultar/);
});

test("limpia la respuesta de la IA: etiquetas, comillas, acotaciones y saltos", () => {
  assert.equal(parsePress("**Don Rayo:** «¡Buenas noches! (se ríe) Tres a uno.\n\nY a por más.»"), "¡Buenas noches! Tres a uno. Y a por más.");
  assert.equal(parsePress("[pausa] Hola"), null);
  const long = parsePress(`${"Frase muy larga del presidente. ".repeat(40)}`)!;
  assert.ok(long.length <= PRESS_MAX && long.endsWith("."));
});

test("frases para los subtítulos: las muy cortas se juntan", () => {
  assert.deepEqual(splitSentences("¡Buenas noches, señores de la prensa! Tres a uno. Y porque el árbitro pitó el final, seguimos marcando."), [
    "¡Buenas noches, señores de la prensa! Tres a uno.", "Y porque el árbitro pitó el final, seguimos marcando.",
  ]);
  assert.deepEqual(splitSentences("Hola."), ["Hola."]);
  assert.deepEqual(splitSentences("Hola. Buenas noches, señores de la prensa."), ["Hola. Buenas noches, señores de la prensa."]);
});

test("la voz no deletrea siglas ni marcadores", () => {
  assert.equal(speakableText("Dani, el MVP, y un 3-1"), "Dani, el eme uve pe, y un 3 a 1");
  const s = speechScript("¡Buenas noches, señores de la prensa! Dani, el MVP, ha estado enorme.");
  assert.match(s, /#### TRANSCRIPCIÓN\n¡Buenas noches, señores de la prensa!\nDani, el eme uve pe, ha estado enorme\./);
});

/** Audio de prueba: tramos de «voz» (un tono) separados por silencios. */
function fakeVoice(parts: [voice: number, silence: number][], rate = 1000) {
  const out: number[] = [];
  for (const [v, s] of parts) {
    for (let i = 0; i < v * rate; i++) out.push(Math.round(Math.sin(i / 3) * 12000));
    for (let i = 0; i < s * rate; i++) out.push(0);
  }
  return new Int16Array(out);
}

test("la boca se abre con la voz y se cierra en los silencios", () => {
  const env = envelope(fakeVoice([[1, 1]]), 1000);
  assert.equal(env.length, 50);
  assert.ok(env.slice(2, 22).every((v) => v >= 8));
  assert.ok(env.slice(28).every((v) => v === 0));
});

test("cada frase cae en su tramo de voz, cortando por los silencios más largos", () => {
  const pcm = fakeVoice([[0, 0.4], [1.2, 0.5], [2, 0.25], [1, 0.6], [1.5, 0.3]]);
  const env = envelope(pcm, 1000);
  const cues = sentenceCues(env, ["Una frase.", "Otra frase.", "La última."]);
  assert.equal(cues.length, 3);
  assert.ok(Math.abs(cues[0].start - 0.4) < 0.1, `empieza ${cues[0].start}`);
  assert.ok(Math.abs(cues[0].end - 1.6) < 0.1);
  // El silencio corto (0,25 s) no corta: la segunda frase dura hasta el de 0,6 s
  assert.ok(Math.abs(cues[1].start - 2.1) < 0.1);
  assert.ok(Math.abs(cues[1].end - 5.35) < 0.1, `acaba ${cues[1].end}`);
  assert.ok(Math.abs(cues[2].end - 7.45) < 0.1);
});

test("sin silencios suficientes, se reparte por letras", () => {
  const env = envelope(fakeVoice([[3, 0]]), 1000);
  const cues = sentenceCues(env, ["Corta.", "Una frase bastante más larga."]);
  assert.ok(cues[0].end - cues[0].start < cues[1].end - cues[1].start);
});

test("lo guardado se lee solo si cuadra con el texto", () => {
  const c = pressCues(fakeVoice([[1, 0.5], [1, 0.2]]), 1000, "Primera frase larga. Segunda frase larga.");
  assert.equal(c.cues.length, 2);
  assert.equal(c.duration, 2.7);
  assert.deepEqual(readCues(JSON.parse(JSON.stringify(c)), 2), c);
  assert.equal(readCues(c, 3), null);
  assert.equal(readCues({ env: "x", cues: [], duration: 1 }, 0), null);
  assert.equal(readCues(null, 1), null);
});

test("el WAV lleva su cabecera y la frecuencia de Gemini", () => {
  const w = wavFile(new Uint8Array([1, 2, 3, 4]), 24000);
  assert.equal(new TextDecoder().decode(w.slice(0, 4)), "RIFF");
  assert.equal(new DataView(w.buffer).getUint32(24, true), 24000);
  assert.equal(w.length, 48);
  assert.equal(rateOf("audio/L16;codec=pcm;rate=24000"), 24000);
  assert.equal(rateOf("audio/l16; rate=16000; channels=1"), 16000);
  assert.equal(rateOf(undefined), 24000);
});
