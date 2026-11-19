import "server-only";

/**
 * Redacción con la IA gratuita de Google (Gemini, plan gratis de AI Studio).
 * La clave va en Vercel como GEMINI_API_KEY y nunca sale del servidor.
 * Solo se le mandan apodos, datos del partido y las notas de la redacción.
 */
/**
 * La clave tal cual se pegó en Vercel, sin espacios, saltos de línea, caracteres invisibles ni comillas alrededor.
 * Se respeta todo lo demás: las claves nuevas de Google llevan puntos u otros signos (p. ej. «AQ.…»).
 */
export const cleanKey = (raw: string | undefined) => (raw ?? "").replace(/[^\x21-\x7e]/g, "").replace(/^["'`]+|["'`]+$/g, "");
export const geminiConfigured = () => cleanKey(process.env.GEMINI_API_KEY).length > 0;

// Si Google retira un modelo, se prueba el siguiente. GEMINI_MODEL permite añadir otro desde Vercel sin tocar el código.
// Revisado el 14-11-2026 con una clave gratis real y la lista de Google (aistudio.google.com/docs/models):
//  · 3.5 Flash Lite, 3.1 Flash Lite y flash-lite-latest contestan una crónica en 2-3 s.
//  · Gemini 4 Hydrogen (salió el 12-11-2026) escribe bien pero tarda ~18 s razonando: reserva.
//  · 3.8 Flash y flash-latest, en el plan gratis, dan «high demand» (503) o no contestan en 90 s: última reserva.
// Por eso el primero es siempre un «lite», aunque GEMINI_MODEL apunte a uno de los lentos.
export const MODELS = () => [
  "gemini-3.5-flash-lite",
  process.env.GEMINI_MODEL?.trim(),
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-4-hydrogen",
  "gemini-3.8-flash",
].filter((m): m is string => !!m);
/**
 * Que razone poco: es lo que más tarda y para una crónica no hace falta. Los «lite» admiten «minimal»; el resto
 * (Gemini 4 y 3.8 Flash) no, así que «low». Si un modelo no admite el ajuste, se repite sin él.
 */
export const thinkingLow = (model: string) => (/^gemini-([3-9]|flash)/.test(model) ? { thinkingConfig: { thinkingLevel: /lite/.test(model) ? "minimal" : "low" } } : {});
/**
 * Tiempo total para todos los intentos. Antes eran 100 s y la función de Vercel podía morir antes de contestar (el móvil
 * solo veía «no ha contestado a tiempo»). Con 50 s cabe incluso en el límite de 60 s y siempre llega el motivo real.
 */
const BUDGET_MS = 50_000;
/** Lo que se espera a cada modelo: un borrador tarda segundos; si uno va lento, se pasa al siguiente. */
const PER_TRY_MS = 20_000;

export type GeminiResult = { text: string; error?: undefined } | { text?: undefined; error: string };

/** Lo que contesta Google cuando falla, en corto: «503 UNAVAILABLE The model is overloaded». */
async function why(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  try {
    const e = (JSON.parse(body) as { error?: { status?: string; message?: string } }).error;
    return `${res.status} ${e?.status ?? ""} ${(e?.message ?? "").slice(0, 140)}`.replace(/\s+/g, " ").trim();
  } catch {
    return `${res.status} ${body.slice(0, 140)}`.replace(/\s+/g, " ").trim();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function askGemini(prompt: string, opts: { temperature?: number; maxTokens?: number } = {}): Promise<GeminiResult> {
  const key = cleanKey(process.env.GEMINI_API_KEY);
  if (!key) return { error: "Falta la clave de Gemini en Vercel (GEMINI_API_KEY). Mientras, usa «Copiar instrucciones para la IA»." };
  const start = Date.now();
  // Lo que ha contestado cada modelo, para el aviso y para los logs de Vercel
  const trail: string[] = [];
  let kind: "key" | "quota" | "busy" | "slow" | "net" | "other" = "other";
  const attempts = [...new Set(MODELS())].flatMap((m) => [m, m]); // cada modelo, hasta dos veces si Google está saturado
  const plain = new Set<string>(); // modelos que no admiten thinkingLevel
  for (let i = 0; i < attempts.length; i++) {
    const model = attempts[i];
    const retry = i > 0 && attempts[i - 1] === model;
    const left = BUDGET_MS - (Date.now() - start);
    if (left < 8_000) break;
    let res: Response;
    try {
      res = await fetch(`${process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com"}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          // Google recomienda no tocar la temperatura en los Gemini 3 (con menos de 1 pueden repetirse)
          generationConfig: { ...(/^gemini-[3-9]/.test(model) ? {} : { temperature: opts.temperature ?? 0.8 }), maxOutputTokens: opts.maxTokens ?? 4096, ...(plain.has(model) ? {} : thinkingLow(model)) },
        }),
        signal: AbortSignal.timeout(Math.min(left, PER_TRY_MS)),
        cache: "no-store",
      });
    } catch (e) {
      const err = e as Error & { cause?: { code?: string; message?: string } };
      console.error(`[gemini] ${model}: ${err.name} ${err.message} ${err.cause?.code ?? ""} ${err.cause?.message ?? ""}`);
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        trail.push(`${model}: sin respuesta en ${Math.round(Math.min(left, PER_TRY_MS) / 1000)} s`);
        kind = kind === "key" ? kind : "slow";
        if (!retry) i++; // lento: mejor otro modelo que repetir este
        continue;
      }
      trail.push(`${model}: sin conexión (${err.cause?.code ?? err.name})`);
      kind = "net";
      if (!retry) i++; // sin conexión no merece la pena repetir el mismo modelo
      continue;
    }
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
        promptFeedback?: { blockReason?: string };
      } | null;
      if (data?.promptFeedback?.blockReason) return { error: "La IA no ha querido redactar esto. Cambia un poco las notas y prueba otra vez." };
      const text = (data?.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("").trim();
      if (text) return { text };
      trail.push(`${model}: respuesta vacía (${data?.candidates?.[0]?.finishReason ?? "?"})`);
      if (!retry) i++;
      continue;
    }
    const detail = await why(res);
    console.error(`[gemini] ${model}: ${detail}`);
    // No admite el ajuste de razonamiento: se repite el mismo modelo sin él
    if (res.status === 400 && /thinking/i.test(detail) && !plain.has(model)) {
      plain.add(model);
      if (retry) attempts.splice(i + 1, 0, model);
      continue;
    }
    trail.push(`${model}: ${detail}`);
    // Saturado o fallo momentáneo de Google: se repite una vez tras una pausa corta
    if ((res.status === 500 || res.status === 503) && !retry) {
      kind = kind === "key" ? kind : "busy";
      await sleep(1500);
      continue;
    }
    if (!retry) i++; // cualquier otro error no se arregla repitiendo
    // El límite gratis va por modelo: si uno lo ha gastado, el siguiente puede tener hueco
    if (res.status === 429) {
      if (kind !== "key") kind = "quota";
      continue;
    }
    if (/location|region|country/i.test(detail) && !/API key/i.test(detail)) return { error: `Google no permite usar Gemini gratis desde aquí. (Detalle: ${detail})` };
    if (res.status === 401 || /API key (not valid|expired)|API_KEY_INVALID/i.test(detail)) {
      kind = "key";
      break; // la clave es la misma para todos los modelos: no merece la pena seguir probando
    }
    if (/API key|API_KEY/i.test(detail)) kind = "key";
    else if (res.status >= 500) kind = kind === "key" ? kind : "busy";
  }
  const head = kind === "key" ? "Google no acepta la clave de Gemini. Revisa GEMINI_API_KEY en Vercel y haz Redeploy."
    : kind === "quota" ? "Se ha llegado al límite gratis de la IA por ahora. Espera un minuto y vuelve a probar."
    : kind === "busy" ? "La IA de Google está saturada ahora mismo. Prueba en un rato."
    : kind === "slow" ? "La IA ha tardado demasiado en contestar. Prueba otra vez en un minuto."
    : kind === "net" ? "No se ha podido conectar con la IA de Google. Prueba otra vez en un momento."
    : "La IA no ha podido redactarlo.";
  return { error: trail.length ? `${head} (Detalle: ${trail.join(" · ")})` : head };
}

// ------------------------------------------------------------------ Voz (4.27.0, Don Rayo)
/**
 * Voces de Gemini (plan gratis, en pruebas). Probado el 19-11-2026 con una clave gratis real:
 *  · 3.1 Flash TTS hace caso a las notas de dirección del guion y da ~26 s de voz en ~10 s.
 *  · 3.8 Flash TTS lee en voz alta también las instrucciones: no sirve con este guion.
 * El plan gratis da pocas voces al día (unas 15): se crea una vez por rueda de prensa y se guarda.
 */
export const TTS_MODELS = () => ["gemini-3.1-flash-tts-preview", process.env.GEMINI_TTS_MODEL?.trim(), "gemini-2.5-flash-preview-tts"].filter((m): m is string => !!m);
/** Voz grave y con poso (la del vídeo de ejemplo que eligió Alvaro). */
export const TTS_VOICE = "Algenib";

export type SpeechResult = { pcm: Uint8Array; mime: string; error?: undefined } | { pcm?: undefined; error: string };

export async function speakWithGemini(script: string): Promise<SpeechResult> {
  const key = cleanKey(process.env.GEMINI_API_KEY);
  if (!key) return { error: "Falta la clave de Gemini en Vercel (GEMINI_API_KEY)." };
  const start = Date.now();
  const trail: string[] = [];
  let quota = false;
  for (const model of [...new Set(TTS_MODELS())]) {
    const left = 50_000 - (Date.now() - start);
    if (left < 10_000) break;
    try {
      const res = await fetch(`${process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com"}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: script }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } } },
        }),
        signal: AbortSignal.timeout(Math.min(left, 40_000)),
        cache: "no-store",
      });
      if (!res.ok) {
        const detail = await why(res);
        console.error(`[gemini-tts] ${model}: ${detail}`);
        trail.push(`${model}: ${detail}`);
        if (res.status === 429) quota = true;
        if (res.status === 401 || /API key (not valid|expired)|API_KEY_INVALID/i.test(detail)) return { error: "Google no acepta la clave de Gemini. Revisa GEMINI_API_KEY en Vercel." };
        continue;
      }
      const data = (await res.json().catch(() => null)) as { candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[] } | null;
      const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
      if (part?.data) return { pcm: new Uint8Array(Buffer.from(part.data, "base64")), mime: part.mimeType ?? "audio/L16;rate=24000" };
      trail.push(`${model}: sin audio`);
    } catch (e) {
      const err = e as Error;
      console.error(`[gemini-tts] ${model}: ${err.name} ${err.message}`);
      trail.push(`${model}: ${err.name === "TimeoutError" ? "sin respuesta a tiempo" : "sin conexión"}`);
    }
  }
  const head = quota ? "Se han gastado las voces gratis de hoy. Mañana se puede volver a crear; mientras, Don Rayo habla con la voz del móvil." : "No se ha podido crear la voz de Don Rayo. Mientras, habla con la voz del móvil.";
  return { error: trail.length ? `${head} (Detalle: ${trail.join(" · ")})` : head };
}
