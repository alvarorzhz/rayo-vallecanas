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

/**
 * 4.30.4 · Vigía de arranque (va en el <head>, sin depender de React ni de los estilos).
 * Si a los 15 s la app no ha arrancado (window.__rvReady lo pone RegisterSW), deja apuntado el atasco
 * y ofrece «Volver a intentar» y «Reparar la app» en vez de dejar a la persona mirando una pantalla quieta.
 */
export const STUCK_SCRIPT = `(function(){setTimeout(function(){if(window.__rvReady||document.getElementById("rv-atasco"))return;
try{var er=(window.__rvErr||[]).slice(0,3).map(function(e){return e.message}).join(" | ");navigator.sendBeacon&&navigator.sendBeacon("/api/fallo-carga",new Blob([JSON.stringify({path:location.pathname,errors:er,online:navigator.onLine})],{type:"application/json"}));}catch(e){}
var d=document.createElement("div");d.id="rv-atasco";d.setAttribute("role","alert");
d.setAttribute("style","position:fixed;left:12px;right:12px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:2147483647;background:#080808;color:#fff;border-radius:16px;padding:16px;font:15px/1.35 system-ui,-apple-system,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.4);max-width:420px;margin:0 auto");
var b="display:inline-block;margin:10px 8px 0 0;padding:9px 14px;border-radius:10px;font-weight:700;text-decoration:none;";
d.innerHTML='<b style="display:block;font-size:16px">La app está tardando en cargar</b><span style="opacity:.75">Suele ser la cobertura. Si vuelve a pasar, repárala: no se borra nada tuyo.</span><br><a href="" style="'+b+'background:#d6001c;color:#fff">Volver a intentar</a><a href="/reparar" style="'+b+'background:#fff;color:#080808">Reparar la app</a>';
(document.body||document.documentElement).appendChild(d);},15000);})();`;
