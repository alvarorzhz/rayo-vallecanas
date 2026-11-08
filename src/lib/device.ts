/** Dispositivo legible a partir del navegador (user agent): «iPhone · Safari», «Windows · Chrome»… */
export type Device = { kind: "mobile" | "tablet" | "desktop" | "unknown"; os: string; browser: string; label: string };

export function parseDevice(ua: string | null | undefined): Device {
  const s = ua ?? "";
  if (!s) return { kind: "unknown", os: "", browser: "", label: "Dispositivo desconocido" };

  let os = "";
  let kind: Device["kind"] = "desktop";
  if (/iPad/.test(s) || (/Macintosh/.test(s) && /Mobile\//.test(s))) { os = "iPad"; kind = "tablet"; }
  else if (/iPhone|iPod/.test(s)) { os = "iPhone"; kind = "mobile"; }
  else if (/Android/.test(s)) { os = "Android"; kind = /Mobile/.test(s) ? "mobile" : "tablet"; }
  else if (/Windows/.test(s)) os = "Windows";
  else if (/CrOS/.test(s)) os = "Chromebook";
  else if (/Mac OS X|Macintosh/.test(s)) os = "Mac";
  else if (/Linux/.test(s)) os = "Linux";
  else kind = "unknown";

  let browser = "";
  if (/EdgA?\/|EdgiOS\//.test(s)) browser = "Edge";
  else if (/SamsungBrowser\//.test(s)) browser = "Samsung Internet";
  else if (/OPR\/|Opera/.test(s)) browser = "Opera";
  else if (/FxiOS\/|Firefox\//.test(s)) browser = "Firefox";
  else if (/CriOS\/|Chrome\//.test(s)) browser = "Chrome";
  else if (/Safari\//.test(s)) browser = "Safari";
  else if (/node|undici|supabase/i.test(s)) browser = "Servidor";

  const label = [os, browser].filter(Boolean).join(" · ") || "Dispositivo desconocido";
  return { kind, os, browser, label };
}
