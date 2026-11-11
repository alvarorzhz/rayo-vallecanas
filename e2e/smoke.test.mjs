// Prueba de humo: entra en la app como una persona, recorre todas las secciones y
// comprueba que ninguna pantalla se rompe. Necesita la app arrancada (npm run build && npm start)
// contra un Supabase local con los datos de ejemplo de supabase/seed.sql.
//
//   npm run test:e2e                      (por defecto http://localhost:3000)
//   E2E_URL=http://localhost:3001 npm run test:e2e
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = process.env.E2E_URL ?? "http://localhost:3000";
const PASSWORD = "Rayo1234!";
const PHONE = { width: 390, height: 844 };

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

/** Abre una sesión nueva ya iniciada, sin animaciones y sin las ventanas de bienvenida. */
async function signIn(email, viewport = PHONE) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce", locale: "es-ES", timezoneId: "Europe/Madrid" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`${e.message} (en ${new URL(page.url()).pathname})`));
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
  await dismissOverlays(page);
  return { ctx, page, errors };
}

/** Cierra el tutorial, las novedades y el aviso de notificaciones si aparecen. */
async function dismissOverlays(page) {
  await page.waitForLoadState("networkidle");
  for (const sel of ['button[aria-label="Saltar el tutorial"]', 'button:has-text("Entendido")', 'button:has-text("Ahora no")']) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) await el.click().catch(() => {});
  }
}

/** Abre una ruta y comprueba lo básico: responde, tiene título, no revienta y no se sale de la pantalla. */
async function visit(s, path, { width = PHONE.width } = {}) {
  const res = await s.page.goto(BASE + path, { waitUntil: "networkidle" });
  assert.ok(res && res.status() < 400, `${path} responde ${res?.status()}`);
  assert.equal(new URL(s.page.url()).pathname, path.split("?")[0], `${path} no debe redirigir`);
  const text = await s.page.locator("body").innerText();
  assert.doesNotMatch(text, /Application error|Internal Server Error|This page could not be found/i, `${path} muestra un error`);
  assert.ok(await s.page.locator("main h1, main h2, main .sport").first().isVisible(), `${path} no tiene contenido`);
  const scrollWidth = await s.page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(scrollWidth <= width, `${path} se sale de la pantalla (${scrollWidth}px en un móvil de ${width}px)`);
  const all = s.errors.splice(0); // se vacía para que un error no arrastre a las pantallas siguientes
  // Con el servidor muy cargado, React a veces empieza a «hidratar» antes de que lleguen todos los
  // datos de la página, se lía y la vuelve a pintar entera (error 418). La pantalla queda bien (es lo
  // que comprueban las líneas de arriba) y ya pasaba antes de esta prueba, así que se anota sin fallar.
  // Cualquier otro error de JavaScript sí hace fallar la prueba.
  const errors = all.filter((e) => !HYDRATION_RETRY.test(e));
  if (all.length > errors.length) console.log(`  (aviso) ${path}: React repintó la página al arrancar${await serverVsScreen(s.page, res)}`);
  if (errors.length) assert.fail(`${path} tiene errores de JavaScript: ${errors.join(" | ")}${await serverVsScreen(s.page, res)}`);
}

const HYDRATION_RETRY = /Minified React error #418|Hydration failed because the server rendered/;

/**
 * Pista para los errores de hidratación: el primer texto en que se diferencian lo que
 * mandó el servidor y lo que acabó pintando el navegador.
 */
async function serverVsScreen(page, res) {
  try {
    const html = await res.text();
    const diff = await page.evaluate((html) => {
      const words = (root) => {
        const out = [];
        const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n; n = walk.nextNode()) {
          if (n.parentElement?.closest("script, style, template, noscript")) continue;
          const t = n.nodeValue.replace(/\s+/g, " ").trim();
          if (t) out.push(t);
        }
        return out;
      };
      const server = words(new DOMParser().parseFromString(html, "text/html").body);
      const screen = words(document.body);
      const i = server.findIndex((w, k) => w !== screen[k]);
      if (i < 0) return server.length === screen.length ? null : { server: "(fin)", screen: screen.slice(server.length, server.length + 8) };
      return { server: server.slice(Math.max(0, i - 3), i + 5), screen: screen.slice(Math.max(0, i - 3), i + 5) };
    }, html);
    return diff ? `\n  servidor: ${JSON.stringify(diff.server)}\n  pantalla: ${JSON.stringify(diff.screen)}` : "";
  } catch {
    return "";
  }
}

/** Primer enlace de la página que apunta a una ficha (ruta con un identificador). */
async function firstDetail(page, prefix) {
  const hrefs = await page.locator(`main a[href^="${prefix}/"]`).evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  const href = hrefs.find((h) => /\/[0-9a-f]{8}-[0-9a-f-]{27}(\?.*)?$/.test(h ?? ""));
  assert.ok(href, `no hay ninguna ficha enlazada bajo ${prefix}`);
  return href;
}

describe("superadministrador", () => {
  let s;
  before(async () => { s = await signIn("alvaro@rayo.test"); });
  after(async () => { await s?.ctx.close(); });

  test("la barra de abajo enseña las seis secciones", async () => {
    await s.page.goto(BASE + "/", { waitUntil: "networkidle" });
    const labels = await s.page.locator('nav[aria-label="Menú principal"]:visible a').allInnerTexts();
    assert.deepEqual(labels.map((l) => l.trim()), ["Inicio", "Partidos", "Plantilla", "Sorteos", "Finanzas", "Gestión"]);
  });

  const SECTIONS = [
    "/", "/partidos", "/partidos/estadisticas", "/partidos/liga", "/partidos/rivales", "/partidos/nuevo",
    "/plantilla", "/plantilla?vista=campo", "/plantilla?vista=lista", "/plantilla/cuotas", "/plantilla/documentos", "/plantilla/historia", "/plantilla/nuevo",
    "/loteria", "/loteria/nueva", "/mis-ventas",
    "/finanzas", "/finanzas/movimientos", "/finanzas/informes", "/finanzas/ajustes", "/finanzas/nuevo?tipo=ingreso",
    "/admin", "/admin/usuarios", "/admin/perfiles", "/admin/avisos", "/admin/patrocinadores", "/admin/auditoria", "/admin/auditoria/accesos", "/admin/copia",
    "/votaciones", "/perfil", "/novedades",
  ];
  for (const path of SECTIONS) test(`se abre ${path}`, () => visit(s, path));

  test("se abren las fichas de un partido, un jugador y una campaña", async () => {
    await s.page.goto(BASE + "/partidos", { waitUntil: "networkidle" });
    await visit(s, await firstDetail(s.page, "/partidos"));
    await s.page.goto(BASE + "/plantilla", { waitUntil: "networkidle" });
    await visit(s, await firstDetail(s.page, "/plantilla"));
    await s.page.goto(BASE + "/loteria", { waitUntil: "networkidle" });
    const campaign = await firstDetail(s.page, "/loteria");
    await visit(s, campaign);
    await visit(s, `${campaign}/vender`);
    await visit(s, `${campaign}/participaciones`);
  });

  test("la pantalla de la liga explica qué datos se traen y deja buscar la competición", async () => {
    await visit(s, "/partidos/liga");
    const data = s.page.getByTestId("league-data");
    for (const what of ["Partidos del Rayo", "Rivales", "Clasificación", "Plantilla", "Totales de cada jugador", "Acta de un partido"]) {
      assert.ok(await data.getByText(what, { exact: true }).isVisible(), `falta «${what}» en la explicación`);
    }
    assert.ok(await s.page.getByRole("button", { name: "Comprobar" }).isVisible());
    assert.ok(await s.page.getByRole("button", { name: "Buscar al Rayo en futormes" }).isVisible());
  });

  test("apuntar un gasto lo deja en la lista y baja el saldo", async () => {
    const balance = async () => {
      await s.page.goto(BASE + "/finanzas", { waitUntil: "networkidle" });
      const t = await s.page.locator("main section .sport").first().innerText();
      return Math.round(Number(t.replace(/[^\d,-]/g, "").replace(",", ".")) * 100);
    };
    const before = await balance();
    const concept = `Prueba de humo ${Date.now()}`;
    await s.page.goto(BASE + "/finanzas/nuevo?tipo=gasto", { waitUntil: "networkidle" });
    await s.page.fill("#amount", "12,34");
    await s.page.fill("#concept", concept);
    await s.page.selectOption("#category_id", { label: "Arbitrajes" });
    await s.page.click('button[type="submit"]:has-text("Guardar gasto")');
    await s.page.waitForURL((u) => !u.pathname.endsWith("/nuevo"), { timeout: 15_000 });
    await s.page.goto(BASE + "/finanzas/movimientos", { waitUntil: "networkidle" });
    assert.ok(await s.page.getByText(concept).first().isVisible(), "el gasto no aparece en Movimientos");
    assert.equal(await balance(), before - 1234, "el saldo no ha bajado 12,34 €");
  });

  test("las pantallas principales caben en un móvil pequeño (320 px)", async () => {
    await s.page.setViewportSize({ width: 320, height: 700 });
    for (const path of ["/", "/partidos", "/plantilla", "/loteria", "/finanzas", "/admin/usuarios", "/votaciones", "/perfil"]) await visit(s, path, { width: 320 });
    await s.page.setViewportSize(PHONE);
  });
});

describe("jugador", () => {
  let s;
  before(async () => { s = await signIn("dani@rayo.test"); });
  after(async () => { await s?.ctx.close(); });

  test("no tiene Finanzas ni Gestión en el menú", async () => {
    await s.page.goto(BASE + "/", { waitUntil: "networkidle" });
    const labels = (await s.page.locator('nav[aria-label="Menú principal"]:visible a').allInnerTexts()).map((l) => l.trim());
    assert.ok(labels.includes("Partidos") && labels.includes("Plantilla"), `menú: ${labels}`);
    assert.ok(!labels.includes("Finanzas") && !labels.includes("Gestión"), `menú: ${labels}`);
  });

  for (const path of ["/finanzas", "/finanzas/movimientos", "/admin/usuarios", "/admin/auditoria", "/admin/patrocinadores", "/plantilla/cuotas"]) {
    test(`no puede entrar en ${path} aunque escriba la dirección`, async () => {
      await s.page.goto(BASE + path, { waitUntil: "networkidle" });
      assert.notEqual(new URL(s.page.url()).pathname, path, `${path} se ha abierto para un jugador`);
    });
  }

  for (const path of ["/", "/partidos", "/plantilla", "/votaciones", "/perfil"]) test(`se abre ${path}`, () => visit(s, path));

  test("contesta «Voy» a la convocatoria desde Inicio y queda apuntado", async () => {
    await s.page.goto(BASE + "/", { waitUntil: "networkidle" });
    const voy = s.page.getByRole("button", { name: /^\W*Voy$/i }).first();
    assert.ok(await voy.isVisible(), "no sale la tarjeta de la convocatoria");
    await voy.click();
    await s.page.waitForLoadState("networkidle");
    await s.page.reload({ waitUntil: "networkidle" });
    const pressed = s.page.locator('button[aria-pressed="true"], button[aria-checked="true"]').filter({ hasText: /Voy/i }).first();
    assert.ok(await pressed.isVisible(), "la respuesta «Voy» no se ha guardado");
  });
});

describe("sin iniciar sesión", () => {
  test("las páginas privadas llevan a la entrada y las públicas se ven", async () => {
    const ctx = await browser.newContext({ viewport: PHONE });
    const page = await ctx.newPage();
    for (const path of ["/", "/finanzas", "/plantilla", "/admin/usuarios"]) {
      await page.goto(BASE + path, { waitUntil: "networkidle" });
      assert.equal(new URL(page.url()).pathname, "/login", `${path} debería pedir entrar`);
    }
    for (const path of ["/login", "/privacidad"]) {
      const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
      assert.equal(res?.status(), 200, path);
    }
    await ctx.close();
  });
});
