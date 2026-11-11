/**
 * v4.0.0 · La Voz del Rayo, el periódico del club.
 * Tipos, etiquetas, el formato del texto y el prompt para la IA (sin dependencias del servidor).
 */

export type NewsKind = "cronica" | "previa" | "entrevista" | "comunicado";
export type NewsStatus = "draft" | "published";

export type Article = {
  id: string;
  kind: NewsKind;
  title: string;
  kicker: string | null;
  summary: string | null;
  body: string;
  match_id: string | null;
  player_id: string | null;
  cover_url: string | null;
  cover_caption: string | null;
  byline: string;
  ai_notes: string | null;
  featured: boolean;
  status: NewsStatus;
  published_at: string | null;
  notified_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const NEWS_NAME = "La Voz del Rayo";

export const KINDS: { key: NewsKind; label: string; plural: string; hint: string; needs: "match" | "player" | null }[] = [
  { key: "cronica", label: "Crónica", plural: "Crónicas", hint: "Lo que pasó en el partido. La ficha técnica sale sola del acta.", needs: "match" },
  { key: "previa", label: "Previa", plural: "Previas", hint: "Cómo llegamos al próximo partido: rival, clasificación y convocatoria.", needs: "match" },
  { key: "entrevista", label: "Entrevista", plural: "Entrevistas", hint: "Preguntas y respuestas con un jugador de la plantilla.", needs: "player" },
  { key: "comunicado", label: "Comunicado oficial", plural: "Comunicados", hint: "Un anuncio oficial del club, firmado por la directiva.", needs: null },
];
export const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.key, k.label])) as Record<NewsKind, string>;
export const kindOf = (s?: string | null): NewsKind | null => KINDS.find((k) => k.key === s)?.key ?? null;
/** Firma por defecto de cada tipo. */
export const DEFAULT_BYLINE: Record<NewsKind, string> = {
  cronica: "Redacción",
  previa: "Redacción",
  entrevista: "Redacción",
  comunicado: "La directiva",
};

// ------------------------------------------------------------------ Texto
/**
 * El cuerpo se escribe como texto normal:
 * · Una línea en blanco separa párrafos.
 * · «## Ladillo» pone un subtítulo.
 * · «> Frase» la destaca como cita grande.
 * · «P: …» y «R: …» son pregunta y respuesta (entrevistas).
 * · **así** va en negrita.
 * · «![Pie de foto](https://…)» en su propia línea mete una foto.
 */
export type Block =
  | { t: "p"; text: string }
  | { t: "h"; text: string }
  | { t: "quote"; text: string }
  | { t: "q"; text: string }
  | { t: "a"; text: string }
  | { t: "img"; url: string; text: string };

export function parseBody(body: string): Block[] {
  const out: Block[] = [];
  const chunks = body.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    let para: string[] = [];
    const flush = () => {
      if (para.length) out.push({ t: "p", text: para.join(" ") });
      para = [];
    };
    for (const line of lines) {
      let m: RegExpMatchArray | null;
      if ((m = line.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/))) { flush(); out.push({ t: "img", url: m[2], text: m[1].trim() }); }
      else if ((m = line.match(/^#{1,3}\s+(.+)$/))) { flush(); out.push({ t: "h", text: m[1] }); }
      else if ((m = line.match(/^>\s*(.+)$/))) { flush(); out.push({ t: "quote", text: m[1].replace(/^[«"“]|[»"”]$/g, "") }); }
      else if ((m = line.match(/^(?:\*\*)?P(?:regunta)?\s*[:.\-–](?:\*\*)?\s*(.+)$/i))) { flush(); out.push({ t: "q", text: m[1] }); }
      else if ((m = line.match(/^(?:\*\*)?R(?:espuesta)?\s*[:.\-–](?:\*\*)?\s*(.+)$/i))) { flush(); out.push({ t: "a", text: m[1] }); }
      else para.push(line);
    }
    flush();
  }
  return out;
}

/** Trozos de una línea con su negrita (**así**). */
export function inline(text: string): { text: string; bold: boolean }[] {
  return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((s) => (s.startsWith("**") && s.endsWith("**") && s.length > 4 ? { text: s.slice(2, -2), bold: true } : { text: s, bold: false }));
}

/** Texto sin marcas (para avisos, resúmenes y tiempo de lectura). */
export const plainText = (body: string) =>
  parseBody(body).filter((b) => b.t !== "img").map((b) => b.text.replace(/\*\*/g, "")).join(" ").trim();

/** Fotos metidas en el texto. */
export const bodyImages = (body: string) => parseBody(body).flatMap((b) => (b.t === "img" ? [b.url] : []));

/** Línea que mete una foto en el texto. */
export const imageLine = (url: string, caption = "") => `![${caption.replace(/[[\]\n]/g, " ").trim()}](${url})`;

/** Minutos de lectura (200 palabras por minuto, como mínimo 1). */
export function readingMinutes(...texts: (string | null | undefined)[]) {
  const words = texts.filter(Boolean).join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Entradilla o, si no hay, el principio del texto. */
export function teaser(a: Pick<Article, "summary" | "body">, max = 160) {
  const t = (a.summary?.trim() || plainText(a.body)).replace(/\s+/g, " ");
  return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : t;
}

// ------------------------------------------------------------------ IA
/** Lo que sabe la app del partido. Los jugadores, siempre por su apodo (nombre de la camiseta). */
export type MatchFacts = {
  rival: string;
  home: boolean;
  date: string;            // «domingo, 15 de noviembre»
  competition: string;     // «Liga», «Copa»…
  round: string | null;
  venue: string | null;
  kickoff: string | null;
  played: boolean;
  goalsFor: number | null;
  goalsAgainst: number | null;
  scorers: { name: string; goals: number }[];
  ownGoals: number;        // goles en propia puerta del rival
  assists: { name: string; count: number }[];
  starters: string[];
  subs: string[];
  goalkeeper: string | null;
  cards: { name: string; yellows: number; red: boolean }[];
  mvp: string | null;
  usRank: { pos: number; points: number; total: number } | null;
  rivalRank: { pos: number; points: number; total: number } | null;
  callup: string[];        // convocados que van (previa)
  form: string | null;     // «VVEDV», del más antiguo al más reciente
};

export type PlayerFacts = {
  name: string;
  position: string;
  number: number | null;
  season: string;
  stats: { apps: number; goals: number; assists: number; mvps: number };
};

export type PromptInput = {
  kind: NewsKind;
  match?: MatchFacts | null;
  player?: PlayerFacts | null;
  notes?: string | null;
  club?: string;
};

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

/** Marcador escrito como en la prensa: local primero. */
export function scoreLine(m: Pick<MatchFacts, "home" | "rival" | "goalsFor" | "goalsAgainst">, club = "Rayo Vallecañas") {
  if (m.goalsFor == null || m.goalsAgainst == null) return m.home ? `${club} - ${m.rival}` : `${m.rival} - ${club}`;
  return m.home ? `${club} ${m.goalsFor}-${m.goalsAgainst} ${m.rival}` : `${m.rival} ${m.goalsAgainst}-${m.goalsFor} ${club}`;
}

function matchLines(m: MatchFacts, club: string): string[] {
  const l: string[] = [];
  l.push(`- Partido: ${m.home ? `${club} (local) contra ${m.rival}` : `${m.rival} (local) contra ${club} (visitante)`}.`);
  l.push(`- Competición: ${m.competition}${m.round ? `, ${m.round}` : ""}. Fútbol 7 amateur.`);
  l.push(`- Fecha: ${m.date}${m.kickoff ? ` a las ${m.kickoff}` : ""}${m.venue ? `, en ${m.venue}` : ""}.`);
  if (m.played && m.goalsFor != null && m.goalsAgainst != null) {
    const res = m.goalsFor > m.goalsAgainst ? "victoria" : m.goalsFor < m.goalsAgainst ? "derrota" : "empate";
    l.push(`- Resultado final: ${scoreLine(m, club)} (${res} del ${club}).`);
    const goals = m.scorers.map((s) => (s.goals > 1 ? `${s.name} (${s.goals})` : s.name));
    if (m.ownGoals) goals.push(m.ownGoals > 1 ? `${m.ownGoals} en propia puerta del rival` : "uno en propia puerta del rival");
    if (goals.length) l.push(`- Goles del ${club}: ${list(goals)}.`);
    else if (m.goalsFor > 0) l.push(`- Goleadores del ${club}: sin apuntar.`);
    if (m.assists.length) l.push(`- Asistencias: ${list(m.assists.map((a) => (a.count > 1 ? `${a.name} (${a.count})` : a.name)))}.`);
    if (m.starters.length) l.push(`- Titulares: ${list(m.starters)}.`);
    if (m.subs.length) l.push(`- Entraron desde el banquillo: ${list(m.subs)}.`);
    if (m.goalkeeper) l.push(`- Portero: ${m.goalkeeper}.`);
    const cards = m.cards.map((c) => `${c.name} (${c.red ? "roja" : c.yellows > 1 ? `${c.yellows} amarillas` : "amarilla"})`);
    if (cards.length) l.push(`- Tarjetas: ${list(cards)}.`);
    if (m.mvp) l.push(`- MVP del partido (votado por el propio equipo): ${m.mvp}.`);
  } else {
    if (m.callup.length) l.push(`- Convocados que han confirmado: ${list(m.callup)}.`);
  }
  if (m.usRank) l.push(`- Clasificación del ${club}: ${m.usRank.pos}º de ${m.usRank.total} con ${m.usRank.points} puntos.`);
  if (m.rivalRank) l.push(`- Clasificación del ${m.rival}: ${m.rivalRank.pos}º con ${m.rivalRank.points} puntos.`);
  if (m.form) l.push(`- Últimos resultados del ${club} (del más antiguo al más reciente, V=victoria, E=empate, D=derrota): ${m.form}.`);
  return l;
}

const TASK: Record<NewsKind, string> = {
  cronica: "Escribe la crónica del partido para el periódico del club.",
  previa: "Escribe la previa del próximo partido para el periódico del club.",
  entrevista: "Prepara una entrevista con un jugador para el periódico del club. Si en mis notas hay respuestas del jugador, úsalas tal cual (puedes pulir la redacción, sin cambiar el sentido). Si no las hay, propón entre 6 y 8 preguntas y deja cada respuesta como «R: (respuesta del jugador)».",
  comunicado: "Redacta un comunicado oficial del club a partir de mis notas.",
};
const TONE: Record<NewsKind, string> = {
  cronica: "Tono de prensa deportiva local: cercano, con emoción y algo de épica de barrio, pero creíble. Entre 250 y 450 palabras.",
  previa: "Tono de prensa deportiva local, con ganas de partido. Entre 180 y 320 palabras.",
  entrevista: "Tono cercano y con humor sano. Una introducción corta de 2 o 3 frases y después las preguntas y respuestas.",
  comunicado: "Tono institucional, claro y breve (entre 80 y 200 palabras). Sin adornos ni emojis.",
};

/** Prompt listo para pegar en ChatGPT, Gemini o Claude. Solo lleva apodos, nunca nombres completos ni datos personales. */
export function buildPrompt({ kind, match, player, notes, club = "Rayo Vallecañas" }: PromptInput): string {
  const l: string[] = [];
  l.push(`Eres el redactor de «${NEWS_NAME}», el periódico del ${club}, un equipo amateur de fútbol 7 de Salamanca (colores rojo, negro y dorado).`);
  l.push(TASK[kind]);
  l.push("");
  if (match) {
    l.push("DATOS DEL PARTIDO (son los únicos datos reales: no inventes otros):");
    l.push(...matchLines(match, club));
    l.push("");
  }
  if (player) {
    l.push("EL ENTREVISTADO:");
    l.push(`- ${player.name}${player.number != null ? `, dorsal ${player.number}` : ""}, ${player.position.toLowerCase()}.`);
    const s = player.stats;
    l.push(`- Temporada ${player.season}: ${s.apps} partidos, ${s.goals} goles, ${s.assists} asistencias, ${s.mvps} veces MVP.`);
    l.push("");
  }
  const n = notes?.trim();
  if (n) {
    l.push("MIS NOTAS (lo que vimos y lo que quiero contar; tienen prioridad):");
    l.push(n);
    l.push("");
  } else if (kind === "comunicado") {
    l.push("MIS NOTAS: (escribe aquí qué quiere comunicar el club)");
    l.push("");
  }
  l.push("REGLAS:");
  l.push(`- ${TONE[kind]}`);
  l.push("- No inventes minutos, jugadas, lesiones, declaraciones ni nombres que no estén arriba. Si falta algo, no lo cuentes.");
  l.push("- Nombra a los jugadores solo por el nombre que aparece arriba (es su apodo).");
  l.push("- En español de España. Sin emojis ni hashtags.");
  l.push("");
  l.push("DEVUELVE EXACTAMENTE ESTE FORMATO, sin nada antes ni después:");
  l.push("ANTETÍTULO: (2 a 5 palabras)");
  l.push("TITULAR: (como mucho 12 palabras)");
  l.push("ENTRADILLA: (una o dos frases que resuman la noticia)");
  l.push("CUERPO:");
  l.push(kind === "entrevista"
    ? "(introducción y después cada pregunta en una línea que empiece por «P: » y su respuesta en otra que empiece por «R: »)"
    : "(párrafos separados por una línea en blanco; si quieres un subtítulo, una línea que empiece por «## »; para destacar una frase, una línea que empiece por «> »)");
  return l.join("\n");
}

/** Lee la respuesta de la IA (con o sin negritas, mayúsculas o tildes) y la reparte por los campos. */
export function parseAiReply(raw: string): { kicker?: string; title?: string; summary?: string; body?: string } | null {
  const text = raw.replace(/\r\n?/g, "\n").replace(/^```\w*\n?|```\s*$/g, "").trim();
  if (!text) return null;
  const label = (k: string) => new RegExp(`^\\s*(?:[*_#>\\s]*)${k}(?:[*_\\s]*)[:：](?:[*_]*)\\s*(.*)$`, "i");
  const KEYS: [keyof NonNullable<ReturnType<typeof parseAiReply>>, string][] = [
    ["kicker", "ANTET[IÍ]TULO"], ["title", "TITULAR"], ["summary", "ENTRADILLA"], ["body", "CUERPO"],
  ];
  const out: Record<string, string[]> = {};
  let cur: string | null = null;
  for (const line of text.split("\n")) {
    const hit = KEYS.find(([, k]) => label(k).test(line));
    if (hit) {
      cur = hit[0];
      out[cur] = [line.match(label(hit[1]))![1]];
    } else if (cur) out[cur].push(line);
  }
  const clean = (s?: string[]) => s?.join("\n").replace(/^\s*\(|\)\s*$/g, "").trim().replace(/^\*\*([\s\S]+)\*\*$/, "$1").trim() || undefined;
  const res = { kicker: clean(out.kicker), title: clean(out.title), summary: clean(out.summary), body: out.body ? out.body.join("\n").trim() || undefined : undefined };
  // Sin el formato pedido: todo el texto va al cuerpo
  if (!res.title && !res.body) return { body: text };
  if (res.title) res.title = res.title.replace(/\.$/, "").replace(/^[«"“]|[»"”]$/g, "").trim();
  return res;
}

/** Horas que una pieza destacada abre Inicio como la portada del periódico. */
export const FEATURED_HOURS = 72;
export const isFeaturedNow = (a: Pick<Article, "featured" | "status" | "published_at">, now = new Date()) =>
  a.featured && a.status === "published" && !!a.published_at && now.getTime() - new Date(a.published_at).getTime() < FEATURED_HOURS * 3_600_000;

// ------------------------------------------------------------------ Validación
export type ArticleDraft = {
  kind: NewsKind;
  title: string;
  kicker: string | null;
  summary: string | null;
  body: string;
  match_id: string | null;
  player_id: string | null;
  cover_caption: string | null;
  byline: string;
  ai_notes: string | null;
  featured: boolean;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const uuidOrNull = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

/** Comprueba lo que llega del formulario. `publish`: además exige lo necesario para publicar. */
export function readDraft(f: { get: (k: string) => unknown }, publish: boolean): { draft?: ArticleDraft; error?: string } {
  const kind = kindOf(str(f.get("kind"), 20));
  if (!kind) return { error: "Elige el tipo de pieza" };
  const title = str(f.get("title"), 140);
  if (title.length < 3) return { error: "Escribe el titular" };
  const meta = KINDS.find((k) => k.key === kind)!;
  const match_id = meta.needs === "match" ? uuidOrNull(f.get("match_id")) : null;
  const player_id = meta.needs === "player" ? uuidOrNull(f.get("player_id")) : null;
  const body = str(f.get("body"), 30000);
  if (publish) {
    if (meta.needs === "match" && !match_id) return { error: `Elige el partido de la ${meta.label.toLowerCase()}` };
    if (meta.needs === "player" && !player_id) return { error: "Elige al jugador entrevistado" };
    if (body.length < 40) return { error: "El texto es demasiado corto para publicarlo" };
  }
  return {
    draft: {
      kind,
      title,
      kicker: str(f.get("kicker"), 60) || null,
      summary: str(f.get("summary"), 500) || null,
      body,
      match_id,
      player_id,
      cover_caption: str(f.get("cover_caption"), 140) || null,
      byline: str(f.get("byline"), 60).length >= 2 ? str(f.get("byline"), 60) : DEFAULT_BYLINE[kind],
      ai_notes: str(f.get("ai_notes"), 3000) || null,
      featured: f.get("featured") === "on",
    },
  };
}

