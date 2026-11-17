/**
 * 4.19.0 · Registro de fallos: qué se apunta y qué no.
 * Lógica pura (sin navegador) para poder probarla.
 */

export type ErrorKind = "pantalla" | "repintado" | "js";

/** Fallos de React al arrancar la página, que la repinta entera (el famoso 418 y sus primos). */
const HYDRATION = /Minified React error #(418|419|421|422|423|425)\b|hydrat/i;

/** Ruido que no es de la app o que ya se arregla solo (recargando con la versión nueva, al volver la cobertura). */
const NOISE = [
  /^Script error\.?$/i, // error de un script de otro sitio, sin datos
  /ResizeObserver loop/i,
  /chrome-extension:|moz-extension:|safari-(web-)?extension:/i,
  /Failed to find Server Action|ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i,
  /Failed to fetch|NetworkError|Load failed|network ?error|The network connection was lost|cancelad|cancelled|AbortError/i,
  /NEXT_REDIRECT|NEXT_NOT_FOUND/,
];

export function isNoise(message: string, source = ""): boolean {
  const m = message.trim();
  if (!m) return true;
  return NOISE.some((re) => re.test(m) || (source !== "" && re.test(source)));
}

/** Si es el repintado de React o un fallo normal de JavaScript. */
export function kindOf(message: string): Exclude<ErrorKind, "pantalla"> {
  return HYDRATION.test(message) ? "repintado" : "js";
}

/** El texto que se guarda: una línea, sin la dirección larga que añade React, como mucho 400 letras. */
export function cleanMessage(message: string): string {
  return message
    .replace(/;?\s*visit https:\/\/react\.dev\/errors\/\d+\S*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** La pantalla, con los identificadores cambiados por «…» para que el mismo fallo en dos fichas cuente junto. */
export function cleanPath(path: string): string {
  return (path.split(/[?#]/)[0] || "/").replace(UUID, "…").slice(0, 120);
}

/**
 * Lo que va en el <head>: escucha los fallos desde el primer momento y los guarda hasta que
 * ErrorReporter está listo (entonces se los pasa directamente).
 */
export const EARLY_ERROR_SCRIPT = `(function(){window.__rvErr=[];function p(m,s){m=String(m||"");if(!m)return;var e={message:m,source:String(s||"")};if(window.__rvErrOn)window.__rvErrOn(e);else if(window.__rvErr.length<10)window.__rvErr.push(e);}
addEventListener("error",function(e){var x=e.error;p(x&&x.message?(x.name&&x.name!=="Error"?x.name+": ":"")+x.message:e.message,e.filename);});
addEventListener("unhandledrejection",function(e){var r=e.reason;p(r&&r.message?r.message:r,"");});})();`;

export type ErrorRow = {
  day: string; user_id: string; sig: string; kind: ErrorKind; path: string; message: string;
  digest: string | null; version: string | null; device: string | null; hits: number; last_at: string;
};

export type ErrorGroup = {
  sig: string; kind: ErrorKind; path: string; message: string; digest: string | null;
  versions: string[]; people: string[]; hits: number; last_at: string;
};

/** Junta el mismo fallo de varias personas y días: primero los que acaban en «Algo ha fallado», luego los más recientes. */
export function groupErrors(rows: ErrorRow[]): ErrorGroup[] {
  const by = new Map<string, ErrorGroup>();
  for (const r of rows) {
    const g = by.get(r.sig) ?? { sig: r.sig, kind: r.kind, path: r.path, message: r.message, digest: r.digest, versions: [], people: [], hits: 0, last_at: r.last_at };
    g.hits += r.hits;
    if (!g.people.includes(r.user_id)) g.people.push(r.user_id);
    if (r.version && !g.versions.includes(r.version)) g.versions.push(r.version);
    if (r.last_at > g.last_at) { g.last_at = r.last_at; g.digest = r.digest ?? g.digest; }
    by.set(r.sig, g);
  }
  const rank: Record<ErrorKind, number> = { pantalla: 0, js: 1, repintado: 2 };
  return [...by.values()].sort((a, b) => rank[a.kind] - rank[b.kind] || b.last_at.localeCompare(a.last_at));
}

export const ERROR_KIND_LABEL: Record<ErrorKind, string> = {
  pantalla: "Salió «Algo ha fallado»",
  js: "Fallo sin pantalla de error",
  repintado: "Repintado al arrancar (418)",
};
