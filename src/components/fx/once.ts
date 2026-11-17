/** 4.21.0 · Animaciones que solo salen una vez por dispositivo: true la primera vez que se pide esa clave. */
export function firstTime(key: string): boolean {
  try {
    const k = `rv-once:${key}`;
    if (localStorage.getItem(k)) return false;
    localStorage.setItem(k, "1");
    return true;
  } catch {
    return false;
  }
}
