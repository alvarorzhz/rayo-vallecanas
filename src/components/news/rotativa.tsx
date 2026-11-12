"use client";

import { useLayoutEffect, useRef } from "react";

const KEY = "rv-voz-rotativa";

/**
 * La portada llega girando, como en las películas, y se estampa. La vuelta completa sale una vez por sesión;
 * las siguientes veces la portada solo se «imprime». Cambiar de sección no la repite (el elemento no se vuelve a montar).
 */
export function Rotativa({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
      sessionStorage.setItem(KEY, "1");
    } catch {}
    // Si la vuelta ya está en marcha (página recién cargada), se deja terminar
    const running = el.getAnimations?.().some((a) => Number(a.currentTime ?? 0) > 80);
    if (seen && !running) el.classList.add("rotativa-quick");
  }, []);
  return <div ref={ref} className={`rotativa ${className}`}>{children}</div>;
}
