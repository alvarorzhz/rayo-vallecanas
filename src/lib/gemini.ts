import "server-only";

/**
 * Redacción con la IA gratuita de Google (Gemini, plan gratis de AI Studio).
 * La clave va en Vercel como GEMINI_API_KEY y nunca sale del servidor.
 * Solo se le mandan apodos, datos del partido y las notas de la redacción.
 */
export const geminiConfigured = () => Boolean(process.env.GEMINI_API_KEY?.trim());

// Si Google retira un modelo, se prueba el siguiente. GEMINI_MODEL permite fijar otro desde Vercel.
const MODELS = () => [process.env.GEMINI_MODEL?.trim(), "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"].filter((m): m is string => !!m);

export type GeminiResult = { text: string; error?: undefined } | { text?: undefined; error: string };

export async function askGemini(prompt: string, opts: { temperature?: number; maxTokens?: number } = {}): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return { error: "Falta la clave de Gemini en Vercel (GEMINI_API_KEY). Mientras, usa «Copiar instrucciones para la IA»." };
  let last = "La IA no ha contestado. Prueba otra vez en un momento.";
  for (const model of [...new Set(MODELS())]) {
    let res: Response;
    try {
      res = await fetch(`${process.env.GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com"}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: opts.temperature ?? 0.8, maxOutputTokens: opts.maxTokens ?? 8192 },
        }),
        signal: AbortSignal.timeout(55_000),
        cache: "no-store",
      });
    } catch {
      last = "La IA ha tardado demasiado en contestar. Prueba otra vez.";
      continue;
    }
    // Modelo retirado o inexistente: el siguiente
    if (res.status === 404) continue;
    if (res.status === 429) return { error: "Se ha llegado al límite gratis de la IA por ahora. Espera un minuto y vuelve a probar." };
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      const body = await res.text().catch(() => "");
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
