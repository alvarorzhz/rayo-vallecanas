"use client";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const seen = new Map<string, number>();
let lastRefresh = Date.now();

/**
 * Las pantallas se guardan en memoria para abrirse al instante. Al volver a una
 * pantalla ya vista, o al volver a la app tras un rato, se piden los datos nuevos
 * en segundo plano sin bloquear la pantalla.
 */
export function RefreshOnVisit() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const key = `${pathname}?${search}`;

  useEffect(() => {
    const prev = seen.get(key);
    seen.set(key, Date.now());
    if (prev && Date.now() - prev > 3000) {
      lastRefresh = Date.now();
      router.refresh();
    }
  }, [key, router]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh > 30000) {
        lastRefresh = Date.now();
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  return null;
}
