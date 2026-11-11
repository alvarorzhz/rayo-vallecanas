import { test } from "node:test";
import assert from "node:assert/strict";
import { isNewsSlug, newsSlug, bodyImages, buildPrompt, imageLine, inline, isFeaturedNow, plainText, parseAiReply, parseBody, readDraft, readingMinutes, scoreLine, teaser, type MatchFacts } from "../news.ts";

const facts: MatchFacts = {
  rival: "CD Tejares", home: false, date: "domingo, 15 de noviembre", competition: "Liga", round: "Jornada 6", venue: "La Aldehuela A1", kickoff: "11:00",
  played: true, goalsFor: 3, goalsAgainst: 1, scorers: [{ name: "Chino", goals: 2 }, { name: "Peque", goals: 1 }], ownGoals: 0,
  assists: [{ name: "Rubio", count: 2 }], starters: ["Gato", "Rubio", "Chino", "Peque", "Toro", "Nano", "Pirri"], subs: ["Kike"], goalkeeper: "Gato",
  cards: [{ name: "Toro", yellows: 1, red: false }], mvp: "Chino", usRank: { pos: 3, points: 13, total: 10 }, rivalRank: { pos: 5, points: 9, total: 10 },
  callup: [], form: "VEDVV",
};

test("el cuerpo se parte en párrafos, ladillos, citas y preguntas", () => {
  const b = parseBody("Primer párrafo\nsigue aquí.\n\n## El segundo tiempo\n> «Lo dimos todo»\n\nP: ¿Cómo estás?\nR: Muy bien, **gracias**.");
  assert.deepEqual(b.map((x) => x.t), ["p", "h", "quote", "q", "a"]);
  assert.equal(b[0].text, "Primer párrafo sigue aquí.");
  assert.equal(b[2].text, "Lo dimos todo");
  assert.deepEqual(inline(b[4].text), [{ text: "Muy bien, ", bold: false }, { text: "gracias", bold: true }, { text: ".", bold: false }]);
});

test("las fotos del texto van en su propia línea y no cuentan como texto", () => {
  const body = "Empezó lloviendo.\n![El once inicial](https://x.supabase.co/storage/v1/object/public/news-photos/a/1.jpg)\nY acabó saliendo el sol.";
  const b = parseBody(body);
  assert.deepEqual(b.map((x) => x.t), ["p", "img", "p"]);
  assert.equal(b[1].text, "El once inicial");
  assert.equal(plainText(body), "Empezó lloviendo. Y acabó saliendo el sol.");
  assert.deepEqual(bodyImages(body), ["https://x.supabase.co/storage/v1/object/public/news-photos/a/1.jpg"]);
  assert.equal(imageLine("https://a/b.jpg", "Gol [de] Chino"), "![Gol  de  Chino](https://a/b.jpg)");
  // Solo direcciones seguras
  assert.equal(parseBody("![x](javascript:alert(1))")[0].t, "p");
});

test("una pieza destacada abre Inicio durante tres días", () => {
  const now = new Date("2026-11-15T12:00:00Z");
  assert.equal(isFeaturedNow({ featured: true, status: "published", published_at: "2026-11-13T12:00:01Z" }, now), true);
  assert.equal(isFeaturedNow({ featured: true, status: "published", published_at: "2026-11-12T11:00:00Z" }, now), false);
  assert.equal(isFeaturedNow({ featured: true, status: "draft", published_at: null }, now), false);
  assert.equal(isFeaturedNow({ featured: false, status: "published", published_at: "2026-11-15T10:00:00Z" }, now), false);
});

test("el marcador pone primero al local", () => {
  assert.equal(scoreLine(facts), "CD Tejares 1-3 Rayo Vallecañas");
  assert.equal(scoreLine({ ...facts, home: true }), "Rayo Vallecañas 3-1 CD Tejares");
});

test("el prompt de la crónica lleva los datos del acta, las notas y el formato de respuesta", () => {
  const p = buildPrompt({ kind: "cronica", match: facts, notes: "Llovía muchísimo." });
  assert.match(p, /CD Tejares 1-3 Rayo Vallecañas \(victoria del Rayo Vallecañas\)/);
  assert.match(p, /Goles del Rayo Vallecañas: Chino \(2\) y Peque\./);
  assert.match(p, /MVP del partido \(votado por el propio equipo\): Chino/);
  assert.match(p, /Llovía muchísimo\./);
  assert.match(p, /TITULAR:/);
  assert.match(p, /No inventes/);
});

test("el prompt de la previa no habla de resultado", () => {
  const p = buildPrompt({ kind: "previa", match: { ...facts, played: false, goalsFor: null, goalsAgainst: null, callup: ["Gato", "Chino"] } });
  assert.doesNotMatch(p, /Resultado final/);
  assert.match(p, /Convocados que han confirmado: Gato y Chino/);
});

test("la respuesta de la IA se reparte por los campos, aunque venga con negritas", () => {
  const r = parseAiReply("**ANTETÍTULO:** Jornada 6\n**TITULAR:** «El Rayo asalta Tejares».\n**ENTRADILLA:** Chino firmó un doblete.\n**CUERPO:**\nPárrafo uno.\n\nPárrafo dos.");
  assert.deepEqual(r, { kicker: "Jornada 6", title: "El Rayo asalta Tejares", summary: "Chino firmó un doblete.", body: "Párrafo uno.\n\nPárrafo dos." });
  assert.deepEqual(parseAiReply("Un texto sin formato."), { body: "Un texto sin formato." });
  assert.equal(parseAiReply("   "), null);
});

test("el formulario exige partido, jugador y texto solo para publicar", () => {
  const f = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
  assert.equal(readDraft(f({ kind: "cronica", title: "Hola" }), false).error, undefined);
  assert.match(readDraft(f({ kind: "cronica", title: "Hola" }), true).error!, /partido/);
  assert.match(readDraft(f({ kind: "entrevista", title: "Hola" }), true).error!, /jugador/);
  assert.match(readDraft(f({ kind: "comunicado", title: "Hola", body: "corto" }), true).error!, /corto/);
  const ok = readDraft(f({ kind: "comunicado", title: "Nueva equipación", body: "x".repeat(50), match_id: "6f2c1d3e-1111-4222-8333-444455556666" }), true);
  assert.equal(ok.draft!.match_id, null);
  assert.equal(ok.draft!.byline, "La directiva");
  assert.equal(readDraft(f({ kind: "otra", title: "Hola" }), false).error, "Elige el tipo de pieza");
});

test("tiempo de lectura y entradilla de repuesto", () => {
  assert.equal(readingMinutes("uno dos"), 1);
  assert.equal(readingMinutes("a ".repeat(1000)), 5);
  assert.equal(teaser({ summary: null, body: "## Ladillo\n\nTexto **largo** de verdad." }, 12), "Ladillo…");
});

test("el enlace público sale del titular, sin tildes ni símbolos", () => {
  assert.equal(newsSlug("El Rayo remonta bajo el diluvio", "X7K2"), "el-rayo-remonta-bajo-el-diluvio-x7k2");
  assert.equal(newsSlug("Dani: «Este vestuario es una familia»", "a1b2"), "dani-este-vestuario-es-una-familia-a1b2");
  assert.equal(newsSlug("Año nuevo, ¡cañonazo!", "zz"), "ano-nuevo-canonazo-zz");
  assert.equal(newsSlug("¡¡!!", "q1"), "noticia-q1");
  assert.ok(newsSlug("x".repeat(200), "abcd").length <= 80);
  assert.ok(isNewsSlug(newsSlug("Nueva equipación para la temporada", "k9")));
  assert.equal(isNewsSlug("../admin"), false);
});
