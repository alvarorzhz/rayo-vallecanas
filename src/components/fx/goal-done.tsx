"use client";
import { useEffect, useRef, useState } from "react";
import { firstTime } from "./once";

/**
 * 4.21.0 · Objetivo de temporada cumplido: barra llena con franjas de césped y banderín de córner.
 * La primera vez que se ve cumplido en este dispositivo, la barra termina de llenarse, se clava el banderín
 * y pasa un brillo dorado por la tarjeta (la tarjeta es el elemento padre, con position relative).
 */
export function GoalDone({ id }: { id: string }) {
  const [play, setPlay] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Sale cuando la tarjeta está a la vista, no mientras está más abajo en la página
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      if (firstTime(`goal:${id}`)) setPlay(true);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [id]);
  return (
    <div ref={ref} aria-hidden className={`goal-done ${play ? "is-playing" : ""}`}>
      <span className="goal-done-shine" />
      <div className="mt-2 flex items-center gap-2">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/5">
          <div className="goal-done-fill h-full rounded-full" />
        </div>
        <span className="goal-done-flag"><i /><b /></span>
      </div>
    </div>
  );
}
