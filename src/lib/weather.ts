/**
 * El tiempo en Salamanca para la previa del partido (v3.18.0).
 * Previsión de Open-Meteo (gratis y sin clave). Si falla, la previa sale igual, sin el tiempo.
 */

/** Salamanca capital. */
export const SALAMANCA = { lat: 40.9701, lon: -5.6635 };

export type MatchWeather = {
  /** "2026-11-09T18:00": la hora de la previsión (la del pitido, redondeada). Sin hora del partido, null y se da el resumen del día. */
  hour: string | null;
  temp: number;
  /** Mínima y máxima del día (solo sin hora del partido). */
  min: number | null;
  max: number | null;
  /** Probabilidad de lluvia, en %. */
  rain: number;
  /** Viento, en km/h. */
  wind: number | null;
  code: number;
};

type Hourly = { time: string[]; temperature_2m: number[]; precipitation_probability: (number | null)[]; weather_code: number[]; wind_speed_10m: number[] };
type Daily = { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: (number | null)[]; weather_code: number[] };
export type OpenMeteo = { hourly?: Hourly; daily?: Daily };

/** Hora local redondeada a la hora en punto más cercana: "18:40" → "19:00", "23:45" → "23:00" (no salta de día). */
export function roundHour(kickoff: string) {
  const [h, m] = kickoff.slice(0, 5).split(":").map(Number);
  const r = Math.min(23, h + (m >= 30 ? 1 : 0));
  return `${String(r).padStart(2, "0")}:00`;
}

/** Saca de la respuesta de Open-Meteo el tiempo a la hora del partido (o el del día si no hay hora). */
export function pickWeather(data: OpenMeteo, date: string, kickoff: string | null): MatchWeather | null {
  if (kickoff && data.hourly) {
    const hour = `${date}T${roundHour(kickoff)}`;
    const i = data.hourly.time.indexOf(hour);
    if (i >= 0 && data.hourly.temperature_2m[i] != null) {
      return {
        hour,
        temp: Math.round(data.hourly.temperature_2m[i]),
        min: null,
        max: null,
        rain: Math.round(data.hourly.precipitation_probability[i] ?? 0),
        wind: data.hourly.wind_speed_10m[i] != null ? Math.round(data.hourly.wind_speed_10m[i]) : null,
        code: data.hourly.weather_code[i] ?? 0,
      };
    }
  }
  if (data.daily) {
    const i = data.daily.time.indexOf(date);
    if (i >= 0 && data.daily.temperature_2m_max[i] != null) {
      const max = Math.round(data.daily.temperature_2m_max[i]);
      return {
        hour: null,
        temp: max,
        min: Math.round(data.daily.temperature_2m_min[i]),
        max,
        rain: Math.round(data.daily.precipitation_probability_max[i] ?? 0),
        wind: null,
        code: data.daily.weather_code[i] ?? 0,
      };
    }
  }
  return null;
}

/** Código WMO del tiempo → emoji y texto. */
export function weatherLabel(code: number): { icon: string; text: string } {
  if (code === 0) return { icon: "☀️", text: "Despejado" };
  if (code <= 2) return { icon: "🌤️", text: "Poco nuboso" };
  if (code === 3) return { icon: "☁️", text: "Nublado" };
  if (code === 45 || code === 48) return { icon: "🌫️", text: "Niebla" };
  if (code >= 51 && code <= 57) return { icon: "🌦️", text: "Llovizna" };
  if (code >= 61 && code <= 67) return { icon: "🌧️", text: code >= 65 ? "Lluvia fuerte" : "Lluvia" };
  if (code >= 71 && code <= 77) return { icon: "🌨️", text: "Nieve" };
  if (code >= 80 && code <= 82) return { icon: "🌦️", text: "Chubascos" };
  if (code === 85 || code === 86) return { icon: "🌨️", text: "Chubascos de nieve" };
  if (code >= 95) return { icon: "⛈️", text: "Tormenta" };
  return { icon: "🌡️", text: "Previsión" };
}

/**
 * El cielo que se enseña. El código del tiempo sale de un solo modelo y la probabilidad de lluvia de varios:
 * si el código dice lluvia pero la probabilidad es baja, mejor «Nublado» que contradecirse.
 */
export function skyOf(w: Pick<MatchWeather, "code" | "rain">) {
  const wet = (w.code >= 51 && w.code <= 67) || (w.code >= 80 && w.code <= 82);
  return wet && w.rain < 25 ? weatherLabel(3) : weatherLabel(w.code);
}

/** Un consejo corto para el vestuario según la lluvia, el frío y el viento. */
export function weatherTip(w: MatchWeather): string | null {
  if (w.code >= 71 && w.code <= 86 && !(w.code >= 80 && w.code <= 82)) return "Puede nevar: ropa de abrigo y ojo con el campo.";
  if (w.code >= 95) return "Posible tormenta: atentos a los avisos.";
  if (w.rain >= 60) return "Lo más probable es que llueva: chubasquero y ropa de repuesto para después.";
  if (w.rain >= 30) return "Puede caer algo: lleva chubasquero por si acaso.";
  if (w.temp <= 5) return "Hará frío: camiseta térmica y a calentar bien.";
  if (w.wind != null && w.wind >= 30) return "Hará viento: ojo con los balones largos.";
  if (w.temp >= 30) return "Hará calor: lleva agua de sobra.";
  return null;
}

/**
 * Previsión para el día y la hora del partido. Open-Meteo da 16 días, pero solo la pedimos en la víspera y el día.
 * Se guarda en caché media hora; si tarda o falla, devuelve null.
 */
export async function fetchMatchWeather(date: string, kickoff: string | null): Promise<MatchWeather | null> {
  const q = new URLSearchParams({
    latitude: String(SALAMANCA.lat),
    longitude: String(SALAMANCA.lon),
    hourly: "temperature_2m,precipitation_probability,weather_code,wind_speed_10m",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
    timezone: "Europe/Madrid",
    start_date: date,
    end_date: date,
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(3000),
    } as RequestInit);
    if (!res.ok) return null;
    return pickWeather((await res.json()) as OpenMeteo, date, kickoff);
  } catch {
    return null;
  }
}
