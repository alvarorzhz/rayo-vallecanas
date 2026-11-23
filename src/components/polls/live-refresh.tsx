"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

let last = 0;

/**
 * Votación en directo: mientras la pantalla está a la vista, pide los votos nuevos cada 15 s.
 * Si hay varias tarjetas en directo, se refresca una sola vez (comparten la hora del último refresco).
 */
export function LiveRefresh({ every = 15_000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== "visible" || Date.now() - last < every - 500) return;
      last = Date.now();
      router.refresh();
    }, every);
    return () => clearInterval(id);
  }, [router, every]);
  return null;
}
