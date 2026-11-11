"use client";
import { useEffect, useRef } from "react";

/** Una línea roja y dorada arriba del todo que avanza según se lee la noticia. */
export function ReadBar({ target }: { target: string }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = document.getElementById(target);
    if (!el || !bar.current) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const total = Math.max(1, r.height - window.innerHeight * 0.6);
      const p = Math.min(1, Math.max(0, -r.top / total));
      bar.current?.style.setProperty("--read", p.toFixed(3));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [target]);
  return <div ref={bar} aria-hidden className="read-bar" />;
}
