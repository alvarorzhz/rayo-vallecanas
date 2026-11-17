"use client";
import { useEffect, useState } from "react";
import { firstTime } from "./once";

const TICKS = 7;
const STEP = 110;

/**
 * 4.21.0 · Resultado final como videomarcador de paletas: la primera vez que se ve el resultado de un partido
 * (en Inicio o en su ficha) las cifras pasan hasta quedarse en la buena. Se pinta ya con el resultado, así que
 * sin JavaScript o con «reducir movimiento» se ve quieto y bien.
 */
export function FlipScore({ matchId, a, b, aClass = "", bClass = "", digitClass, dashClass }: {
  matchId: string; a: number; b: number; aClass?: string; bClass?: string; digitClass: string; dashClass: string;
}) {
  const [tick, setTick] = useState(TICKS);
  const [rolling, setRolling] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!firstTime(`flip:${matchId}`)) return;
    let k = 0;
    setRolling(true);
    setTick(0);
    const t = setInterval(() => {
      k += 1;
      setTick(k);
      if (k >= TICKS) clearInterval(t);
    }, STEP);
    return () => clearInterval(t);
  }, [matchId]);
  // Cuenta hacia atrás hasta el número bueno: (final + lo que falta) % 10
  const show = (n: number) => (tick >= TICKS ? n : (n + TICKS - tick) % 10);
  const digit = (n: number, extra: string) => (
    <span className={`flip-digit ${digitClass} ${extra}`}>
      <span key={tick} className={rolling ? "flip-face" : undefined}>{show(n)}</span>
    </span>
  );
  return (
    <>
      {digit(a, aClass)}
      <span className={dashClass}>-</span>
      {digit(b, bClass)}
    </>
  );
}
