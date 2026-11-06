/** Solo rutas internas: evita que un enlace de inicio de sesión lleve a otra web ("//web.com", "/\web.com"...). */
export function safeNext(value: unknown, fallback = "/"): string {
  const s = String(value ?? "");
  return /^\/(?![/\\])[^\s\\]*$/.test(s) ? s : fallback;
}
