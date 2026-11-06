/** Contraseña provisional fácil de dictar: sin letras ambiguas (0/O, 1/l). */
export function tempPassword() {
  const abc = "abcdefghjkmnpqrstuvwxyz";
  const pick = (s: string, n: number) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => s[x % s.length]).join("");
  return `Rayo-${pick(abc, 4)}-${pick("23456789", 4)}`;
}
