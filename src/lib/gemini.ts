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

// Si Google retira un modelo, se prueba el siguiente. GEMINI_MODEL permite fijar otro desde Vercel sin tocar el código.
// En noviembre de 2026 Google ya no deja usar los 2.5 a claves nuevas: los actuales son 3.8 Flash y 3.5 Flash Lite.
const MODELS = () => [process.env.GEMINI_MODEL?.trim(), "gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-flash-lite-latest"].filter((m): m is string => !!m);
/** Que razone poco: es lo que más tarda y para una crónica no hace falta. Si un modelo no lo admite, se repite sin ello. */
const thinkingLow = (model: string) => (/^gemini-[3-9]/.test(model) ? { thinkingConfig: { thinkingLevel: "low" } } : {});
/** Tiempo total para todos los intentos: la función de Vercel no debe morir antes de contestar. */
const BUDGET_MS = 50_000;

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
  let kind: "key" | "busy" | "net" | "other" = "other";
  const attempts = [...new Set(MODELS())].flatMap((m) => [m, m]); // cada modelo, hasta dos veces si Google está saturado
  const plain = new Set<string>(); // modelos que no admiten thinkingLevel
  for (let i = 0; i < attempts.length; i++) {
    const model = attempts[i];
    const retry = i > 0 && attempts[i - 1] === model;
    const left = BUDGET_MS - (Date.now() - start);
    if (left < 5_000) break;
    let res: Response;
    try {
      res = await fetch(`${process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com"}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          // Google recomienda no tocar la temperatura en los Gemini 3 (con menos de 1 pueden repetirse)
          generationConfig: { ...(/^gemini-[3-9]/.test(model) ? {} : { temperature: opts.temperature ?? 0.8 }), maxOutputTokens: opts.maxTokens ?? 8192, ...(plain.has(model) ? {} : thinkingLow(model)) },
        }),
        signal: AbortSignal.timeout(left),
        cache: "no-store",
      });
    } catch (e) {
      const err = e as Error & { cause?: { code?: string; message?: string } };
      console.error(`[gemini] ${model}: ${err.name} ${err.message} ${err.cause?.code ?? ""} ${err.cause?.message ?? ""}`);
      if (err.name === "TimeoutError" || err.name === "AbortError") return { error: "La IA ha tardado demasiado en contestar. Prueba otra vez en un minuto." };
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
    if (res.status === 429) return { error: `Se ha llegado al límite gratis de la IA por ahora. Espera un minuto y vuelve a probar. (Detalle: ${detail})` };
    if (/location|region|country/i.test(detail) && !/API key/i.test(detail)) return { error: `Google no permite usar Gemini gratis desde aquí. (Detalle: ${detail})` };
    if (/API key|API_KEY/i.test(detail)) kind = "key";
    else if (res.status >= 500) kind = kind === "key" ? kind : "busy";
  }
  const head = kind === "key" ? "Google no acepta la clave de Gemini. Revisa GEMINI_API_KEY en Vercel y haz Redeploy."
    : kind === "busy" ? "La IA de Google está saturada ahora mismo. Prueba en un rato."
    : kind === "net" ? "No se ha podido conectar con la IA de Google. Prueba otra vez en un momento."
    : "La IA no ha podido redactarlo.";
  return { error: trail.length ? `${head} (Detalle: ${trail.join(" · ")})` : head };
}
