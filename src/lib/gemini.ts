import "server-only";

/**
 * Redacción con la IA gratuita de Google (Gemini, plan gratis de AI Studio).
 * La clave va en Vercel como GEMINI_API_KEY y nunca sale del servidor.
 * Solo se le mandan apodos, datos del partido y las notas de la redacción.
 */
/** La clave tal cual se pegó en Vercel, sin espacios, comillas ni caracteres invisibles que rompen la petición. */
export const cleanKey = (raw: string | undefined) => (raw ?? "").replace(/[^A-Za-z0-9_\-]/g, "");
export const geminiConfigured = () => cleanKey(process.env.GEMINI_API_KEY).length > 0;

// Si Google retira un modelo, se prueba el siguiente. GEMINI_MODEL permite fijar otro desde Vercel.
// Primero los «flash» sin pensar en voz alta: son los más rápidos y sobran para una crónica.
const MODELS = () => [process.env.GEMINI_MODEL?.trim(), "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"].filter((m): m is string => !!m);
/** Los 2.5 aceptan apagar el «razonamiento», que es lo que más tarda. A los demás no se les toca. */
const thinkingOff = (model: string) => (/^gemini-2\.5-flash/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {});
/** Tiempo total para todos los intentos: la función de Vercel no debe morir antes de contestar. */
const BUDGET_MS = 50_000;

export type GeminiResult = { text: string; error?: undefined } | { text?: undefined; error: string };

export async function askGemini(prompt: string, opts: { temperature?: number; maxTokens?: number } = {}): Promise<GeminiResult> {
  const key = cleanKey(process.env.GEMINI_API_KEY);
  if (!key) return { error: "Falta la clave de Gemini en Vercel (GEMINI_API_KEY). Mientras, usa «Copiar instrucciones para la IA»." };
  let last = "La IA no ha contestado. Prueba otra vez en un momento.";
  const start = Date.now();
  for (const model of [...new Set(MODELS())]) {
    const left = BUDGET_MS - (Date.now() - start);
    if (left < 5_000) break;
    let res: Response;
    try {
      res = await fetch(`${process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com"}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: opts.temperature ?? 0.8, maxOutputTokens: opts.maxTokens ?? 8192, ...thinkingOff(model) },
        }),
        signal: AbortSignal.timeout(left),
        cache: "no-store",
      });
    } catch (e) {
      const err = e as Error & { cause?: { code?: string; message?: string } };
      console.error(`[gemini] ${model}: ${err.name} ${err.message} ${err.cause?.code ?? ""} ${err.cause?.message ?? ""}`);
      if (err.name === "TimeoutError" || err.name === "AbortError") return { error: "La IA ha tardado demasiado en contestar. Prueba otra vez en un minuto." };
      last = "No se ha podido conectar con la IA de Google. Prueba otra vez en un momento.";
      continue;
    }
    if (!res.ok) console.error(`[gemini] ${model}: HTTP ${res.status}`);
    // Modelo retirado o inexistente: el siguiente
    if (res.status === 404) continue;
    if (res.status === 429) return { error: "Se ha llegado al límite gratis de la IA por ahora. Espera un minuto y vuelve a probar." };
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      const body = await res.text().catch(() => "");
      console.error(`[gemini] ${model}: ${body.slice(0, 300)}`);
      if (/thinking/i.test(body)) continue;
      if (/API key|API_KEY|permission|PERMISSION/i.test(body)) return { error: "Google no acepta la clave de Gemini. Revisa GEMINI_API_KEY en Vercel y haz Redeploy." };
      if (/location|region|country/i.test(body)) return { error: "Google no permite usar Gemini gratis desde esta región." };
      last = "La IA no ha aceptado la petición. Prueba otra vez.";
      continue;
    }
    if (!res.ok) {
      last = "La IA no está disponible ahora mismo. Prueba en un rato.";
      continue;
    }
    const data = (await res.json().catch(() => null)) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    } | null;
    if (data?.promptFeedback?.blockReason) return { error: "La IA no ha querido redactar esto. Cambia un poco las notas y prueba otra vez." };
    const text = (data?.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("").trim();
    if (text) return { text };
    last = "La IA ha devuelto una respuesta vacía. Prueba otra vez.";
  }
  return { error: last };
}
