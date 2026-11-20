/**
 * 4.27.0 · Don Rayo, el presidente del club (un personaje de broma de La Voz del Rayo).
 * Después de cada partido da una rueda de prensa de 4 o 5 frases dentro de la crónica: el resultado,
 * los goleadores (solo apodos), el MVP y la posición, y pica al rival sin faltar.
 * Aquí va lo que no depende del servidor (con pruebas): el prompt del texto, el guion para la voz,
 * cómo se lee la respuesta de la IA y cómo se sacan de la voz la boca y los subtítulos.
 */
import { matchLines, type MatchFacts } from "./news.ts";

export const PRESIDENT = "Don Rayo";
/** Como mucho, lo que cabe en ~35 s de voz. */
export const PRESS_MAX = 700;
/** Fotogramas por segundo de la boca. */
export const ENV_FPS = 25;

/** Lo que se guarda junto al audio para animarlo sin descargar nada más. */
export type PressCues = {
  /** Abertura de la boca de 0 a 9, un carácter por fotograma (25 por segundo). */
  env: string;
  /** Cuándo empieza y acaba cada frase (segundos), en el mismo orden que el texto. */
  cues: { start: number; end: number }[];
  /** Duración total del audio, en segundos. */
  duration: number;
};

/** Las instrucciones para que la IA escriba la rueda de prensa. Solo apodos y datos del acta. */
export function buildPressPrompt(m: MatchFacts, club = "Rayo Vallecañas"): string {
  const l: string[] = [];
  l.push(`Eres ${PRESIDENT}, el presidente del ${club}, un equipo amateur de fútbol 7 de Salamanca (colores rojo, negro y dorado).`);
  l.push("Eres un presidente de los de antes: unos setenta años, castizo, chulesco y vacilón, orgulloso de su equipo hasta la fanfarronería, con mucha retranca y la lengua muy suelta. Te encanta provocar y que se hable de ti en el barrio.");
  l.push("Acaba de terminar el partido y das una rueda de prensa muy corta, con ganas de liarla.");
  l.push("");
  l.push("DATOS DEL PARTIDO (son los únicos datos reales: no inventes otros):");
  l.push(...matchLines(m, club));
  l.push("");
  l.push("REGLAS:");
  l.push("- Entre 4 y 5 frases cortas, como mucho 80 palabras en total. Se va a leer en voz alta.");
  l.push("- Empieza saludando a la prensa con chulería. Di el resultado y nombra a los goleadores y al MVP si los hay, y la posición en la liga si la hay.");
  l.push("- Sé picantón y provocativo: cada frase lleva su pulla o su fanfarronada. Vacila al rival con retintín y doble sentido (que si corrieron mucho pero detrás del balón, que vuelvan cuando aprendan, que les mandas el vídeo para que estudien), y reta a los de arriba de la tabla o al rival a la revancha.");
  l.push("- Si se gana, fanfarronea sin freno; si se empata o se pierde, no reconozcas nada: excusas exageradas y absurdas (el césped, la luna, el bocadillo del descanso) y amenaza con la venganza en el próximo partido. Nunca le eches la culpa a nadie del equipo.");
  l.push("- Puedes vacilar con cariño a algún jugador propio por el nombre de arriba (que le vas a tener que subir el sueldo, que no le pagas), siempre en broma sana.");
  l.push("- Provocar no es faltar: sin insultar, sin tacos, sin burlarte del físico, el origen o la vida de nadie, sin nombrar a jugadores del rival y sin acusar al árbitro de tramposo (como mucho, que estaba miope).");
  l.push("- Nombra a los jugadores solo por el nombre que aparece arriba (es su apodo). No inventes jugadas, minutos ni nombres.");
  l.push("- En español de España. Sin emojis, sin hashtags, sin comillas y sin acotaciones. Los números del marcador, en letra («tres a uno»).");
  l.push("");
  l.push("DEVUELVE SOLO LO QUE DICE, en un único párrafo, sin nada antes ni después.");
  return l.join("\n");
}

/** Limpia lo que devuelve la IA: sin comillas, etiquetas, acotaciones ni saltos de línea, y con tope. */
export function parsePress(raw: string): string | null {
  let t = raw.replace(/\r\n?/g, "\n").replace(/^```\w*\n?|```\s*$/g, "").trim();
  t = t.replace(/^\s*(?:\*\*)?(?:don rayo|presidente|rueda de prensa)(?:\*\*)?\s*[:：]\s*/i, "");
  t = t.replace(/\[[^\]]*\]|\((?:[^)]*?(?:pausa|r[ií]e|tose|carraspea|sonr[ií]e|golpe)[^)]*)\)/gi, "");
  t = t.replace(/[*_#>]+/g, "").replace(/^[«"“'\s]+|[»"”'\s]+$/g, "").replace(/\s+/g, " ").trim();
  if (t.length < 20) return null;
  if (t.length > PRESS_MAX) {
    const cut = t.slice(0, PRESS_MAX);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    t = end > 80 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…";
  }
  return t;
}

/** Corta el texto en frases (para los subtítulos). Las muy cortas van con la anterior (la primera, con la siguiente). */
export function splitSentences(text: string): string[] {
  const raw = (text.replace(/\s+/g, " ").trim().match(/[^.!?…]+(?:[.!?…]+[»"”]?|$)/g) ?? []).map((x) => x.trim()).filter(Boolean);
  const out: string[] = [];
  for (const r of raw) {
    const last = out.length - 1;
    if (last >= 0 && (r.length < 20 || out[last].length < 20)) out[last] += ` ${r}`;
    else out.push(r);
  }
  return out;
}

/** El guion para la voz de Gemini: quién habla, cómo y, al final, lo que dice. */
export function speechScript(text: string): string {
  return [
    `# PERFIL DE AUDIO: ${PRESIDENT}, presidente de un club de fútbol 7 de barrio, setenta años.`,
    "## ESCENA: sala de prensa justo después del partido, flashes de cámaras.",
    "### NOTAS DE DIRECCIÓN",
    "Acento: español de España, castizo.",
    "Estilo: voz grave y chulesca de presidente fanfarrón, vacilona y provocadora, con retintín y una sonrisa pícara; remarca las pullas y deja una pausa breve antes de cada remate.",
    "Ritmo: animado, con aplomo de quien sabe que tiene razón.",
    "",
    "#### TRANSCRIPCIÓN",
    ...splitSentences(speakableText(text)),
  ].join("\n");
}

/** Lo que la voz pronunciaría mal: siglas y marcadores con cifras. */
export function speakableText(text: string): string {
  return text
    .replace(/\bMVP\b/g, "eme uve pe")
    .replace(/\b(\d{1,2})\s*-\s*(\d{1,2})\b/g, (_, a: string, b: string) => `${a} a ${b}`);
}

/** Abertura de la boca por fotograma, de 0 a 9, a partir del audio (PCM de 16 bits, un canal). */
export function envelope(pcm: Int16Array, sampleRate: number, fps = ENV_FPS): number[] {
  const per = Math.max(1, Math.round(sampleRate / fps));
  const rms: number[] = [];
  for (let i = 0; i < pcm.length; i += per) {
    let sum = 0;
    const end = Math.min(pcm.length, i + per);
    for (let j = i; j < end; j++) sum += pcm[j] * pcm[j];
    rms.push(Math.sqrt(sum / (end - i)));
  }
  const loud = rms.filter((x) => x > 0).sort((a, b) => a - b);
  const ref = loud.length ? loud[Math.min(loud.length - 1, Math.floor(loud.length * 0.95))] : 1;
  return rms.map((x) => Math.max(0, Math.min(9, Math.round((x / (ref || 1)) * 9))));
}

/**
 * Cuándo dice cada frase: se buscan los silencios del audio y se reparten las frases en los más largos,
 * en orden. Si hay menos silencios que frases, el resto se reparte por número de letras.
 */
export function sentenceCues(env: number[], sentences: string[], fps = ENV_FPS): PressCues["cues"] {
  const n = sentences.length;
  const duration = env.length / fps;
  if (!n) return [];
  const first = env.findIndex((v) => v > 1);
  let last = env.length - 1;
  while (last > 0 && env[last] <= 1) last--;
  const s0 = Math.max(0, first) / fps;
  const s1 = (last + 1) / fps;
  // Huecos de al menos 0,2 s
  const gaps: { at: number; len: number; from: number; to: number }[] = [];
  let run = -1;
  for (let i = Math.max(0, first); i <= last; i++) {
    if (env[i] <= 1) { if (run < 0) run = i; }
    else if (run >= 0) {
      if (i - run >= 5) gaps.push({ at: (run + i) / 2 / fps, len: i - run, from: run / fps, to: i / fps });
      run = -1;
    }
  }
  const chosen = [...gaps].sort((a, b) => b.len - a.len).slice(0, n - 1).sort((a, b) => a.at - b.at);
  if (chosen.length === n - 1) {
    return sentences.map((_, i) => ({
      start: round(i === 0 ? s0 : chosen[i - 1].to),
      end: round(i === n - 1 ? s1 : chosen[i].from),
    }));
  }
  // Sin silencios suficientes: por letras entre el primer y el último sonido
  const total = sentences.reduce((a, s) => a + s.length, 0) || 1;
  let t = s0;
  return sentences.map((s) => {
    const len = ((s1 - s0) * s.length) / total;
    const c = { start: round(t), end: round(Math.min(duration, t + len)) };
    t += len;
    return c;
  });
}

const round = (x: number) => Math.round(x * 100) / 100;

/** Todo lo que necesita la animación, listo para guardar. */
export function pressCues(pcm: Int16Array, sampleRate: number, text: string): PressCues {
  const env = envelope(pcm, sampleRate);
  return { env: env.join(""), cues: sentenceCues(env, splitSentences(text)), duration: round(pcm.length / sampleRate) };
}

/** Lee lo guardado (puede venir de otra versión o a medias). */
export function readCues(raw: unknown, sentences: number): PressCues | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<PressCues>;
  if (typeof r.env !== "string" || !/^[0-9]*$/.test(r.env) || typeof r.duration !== "number" || !Array.isArray(r.cues)) return null;
  const cues = r.cues.filter((c) => c && typeof c.start === "number" && typeof c.end === "number");
  return cues.length === sentences ? { env: r.env, cues, duration: r.duration } : null;
}

/** Un WAV (PCM de 16 bits, un canal) a partir de las muestras crudas que devuelve Gemini. */
export function wavFile(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const out = new Uint8Array(44 + pcm.length);
  const v = new DataView(out.buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
  str(0, "RIFF"); v.setUint32(4, 36 + pcm.length, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

/** La frecuencia de muestreo que indica Gemini en el tipo («audio/L16;codec=pcm;rate=24000»). */
export function rateOf(mime: string | undefined): number {
  const m = /rate=(\d{4,6})/i.exec(mime ?? "");
  return m ? Number(m[1]) : 24000;
}
