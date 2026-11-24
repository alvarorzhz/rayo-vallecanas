/**
 * 4.30.4 · «Reparar la app»: borra el service worker y la caché de páginas del dispositivo y vuelve a abrir la app.
 * Es HTML suelto, sin React ni el resto de la app, para que funcione aunque la app no arranque.
 * No toca la sesión ni lo guardado en el móvil (borradores de La Voz, tutorial visto…).
 */
const HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#080808"><title>Reparando la app · Rayo Vallecañas</title>
<style>body{margin:0;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#080808;color:#fff;font:16px/1.4 system-ui,-apple-system,sans-serif;text-align:center;padding:24px;box-sizing:border-box}
img{width:96px;height:auto}h1{margin:0;font-size:24px}p{margin:0;max-width:340px;opacity:.75}a{color:#e8b923}</style></head>
<body><img src="/escudo.png" alt=""><h1 id="t">Reparando la app…</h1><p id="m">Un segundo: estamos limpiando lo que la app tenía guardado en este dispositivo.</p>
<script>(async function(){
try{if(navigator.serviceWorker){var r=await navigator.serviceWorker.getRegistrations();await Promise.all(r.map(function(x){return x.unregister()}));}}catch(e){}
try{if(window.caches){var k=await caches.keys();await Promise.all(k.map(function(x){return caches.delete(x)}));}}catch(e){}
try{sessionStorage.clear()}catch(e){}
document.getElementById("t").textContent="¡Listo!";
document.getElementById("m").innerHTML='Abriendo la app… Si no se abre sola, <a href="/">toca aquí</a>.';
setTimeout(function(){location.replace("/")},1200);
})();</script></body></html>`;

export function GET() {
  return new Response(HTML, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "clear-site-data": '"cache"' },
  });
}
