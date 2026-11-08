// Descarga de nuevo las páginas de la liga que usan las pruebas y las deja recortadas
// y sin nombres de personas en src/lib/__tests__/fixtures/futormes.
//   node scripts/futormes-fixtures.mjs [competición] [equipo] [jugador] [partido]
// Por defecto: Apertura 2026/27 (15868), Rayo Vallecañas (176726), un jugador y el Rayo 7-10 Birrarreal.
// Si cambian las páginas, revisa los números esperados en league-parse.test.ts.
import fs from "node:fs";
import path from "node:path";

const [competition = "15868", team = "176726", player = "2825935", match = "1371211"] = process.argv.slice(2);
const out = path.resolve(import.meta.dirname, "../src/lib/__tests__/fixtures/futormes");
const jar = new Map();
async function get(p) {
  const res = await fetch(`https://www.futormes.com/mod/soccer/${p}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RayoVallecanasApp/fixtures)", Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
  });
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
  if (!res.ok) throw new Error(`${p}: ${res.status}`);
  return res.text();
}

const raw = {};
raw.situation = await get(`situation.aspx?itm=${competition}`);
raw.calendar = await get("calendar.aspx");
raw.table = await get("table.aspx");
raw.team = await get(`team.aspx?itm=${team}`);
raw.player = await get(`player.aspx?itm=${player}`);
raw.match = await get(`match.aspx?itm=${match}`);

// Nombres de personas: jugadores y técnicos
const names = new Set();
for (const h of Object.values(raw)) {
  for (const m of h.matchAll(/title="([^"]+)" href="(?:player|technician)\.aspx/g)) names.add(m[1]);
  for (const m of h.matchAll(/href="(?:player|technician)\.aspx\?itm=\d+"[^>]*>([^<]+)</g)) names.add(m[1].trim());
  for (const m of h.matchAll(/_lbl(?:ToolTip|JugadorInfo)Nombre"[^>]*>([^<]+)</g)) names.add(m[1].trim());
}
const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const alias = (i) => `Jugador ${letters[i % 26]}${letters[Math.floor(i / 26) % 26]} Ejemplo Prueba`;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const byKey = new Map();
for (const n of [...names].filter((n) => n.length > 3).sort((a, b) => b.length - a.length)) {
  const k = n.toLowerCase();
  if (!byKey.has(k)) byKey.set(k, alias(byKey.size));
}

fs.mkdirSync(out, { recursive: true });
for (const [f, h0] of Object.entries(raw)) {
  let h = h0
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<input[^>]*type="hidden"[^>]*\/?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<link[^>]*>/gi, "")
    .replace(/\/storage\/soccer\/players\/\d+\.(jpg|png)/g, "/images/shared/nophoto.png")
    .replace(/(Entrenador:)\s*[^<"]+/g, "$1 Entrenador Ejemplo")
    .replace(/(lblFechaNacimiento"[^>]*>)[^<]*/g, "$1 1 de enero de 2000")
    .replace(/(lblToolTipJugadorInfo(?:Edad|Altura|Peso)"[^>]*>)[^<]*/g, "$1-");
  for (const [k, a] of byKey) h = h.replace(new RegExp(esc(k), "gi"), (m) => (m === m.toUpperCase() ? a.toUpperCase() : a));
  h = h.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
  fs.writeFileSync(path.join(out, `${f}.html`), h);
}
console.log(`Guardadas ${Object.keys(raw).length} páginas en ${out} (${byKey.size} nombres cambiados).`);
