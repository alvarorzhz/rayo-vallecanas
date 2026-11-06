"use client";
import { useEffect, useRef, useState } from "react";

/** Número que sube de 0 a su valor cuando aparece en pantalla (como un marcador). */
export function CountUp({ value, duration = 900, className = "" }: { value: number; duration?: number; className?: string }) {
  const [n, setN] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let started = false;
    const run = () => {
      if (started) return;
      started = true;
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    setN(0);
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); run(); } }, { threshold: 0.1 });
    io.observe(el);
    // Por si el navegador no avisa (pestaña en segundo plano...): nunca se queda en 0
    const safety = setTimeout(() => { started = true; io.disconnect(); cancelAnimationFrame(raf); setN(value); }, duration + 1600);
    return () => { io.disconnect(); cancelAnimationFrame(raf); clearTimeout(safety); if (!started) setN(value); };
  }, [value, duration]);
  return <span ref={ref} className={`tabular-nums ${className}`}>{n}</span>;
}
