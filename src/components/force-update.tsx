"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { needsReload } from "@/lib/app-settings";

const KEY = "rv_reload_seen";
const EVERY = 15_000;

/** Borra las cachés de la app y recarga con la última versión. */
async function hardReload() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
    if ("caches" in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  } catch { /* recarga igualmente */ }
  location.reload();
}

/** Guarda la marca vista y dice si hay que recargar. Sin almacenamiento, nunca (mejor que recargar en bucle). */
function check(reloadAt: string | null): boolean {
  try {
    const seen = localStorage.getItem(KEY);
    localStorage.setItem(KEY, reloadAt ?? "0");
    return needsReload(seen, reloadAt);
  } catch {
    return false;
  }
}

/**
 * 4.31.0 · Los mandos llegan a cada móvil sin esperar:
 * · «Forzar actualización»: si la marca es nueva para este móvil, se recarga con la última versión.
 * · Cualquier otro cambio (mensaje fijo, apartados apagados…): se refresca la pantalla por detrás.
 * Se mira al abrir la app, al cambiar de pantalla y al volver a la app (como mucho cada 15 s).
 */
export function ForceUpdate({ reloadAt, stamp }: { reloadAt: string | null; stamp: string | null }) {
  const router = useRouter();
  const path = usePathname();
  // En Mandos (donde se pulsa el botón) solo se apunta la marca: quien lo pulsa ve el «Hecho» sin que se le recargue
  const here = path === "/admin/mandos";
  const last = useRef(Date.now());
  const stampRef = useRef(stamp);
  useEffect(() => { stampRef.current = stamp; }, [stamp]);

  useEffect(() => {
    if (check(reloadAt) && !here) void hardReload();
  }, [reloadAt, here]);

  useEffect(() => {
    const look = async () => {
      if (Date.now() - last.current < EVERY) return;
      last.current = Date.now();
      try {
        const r = await fetch("/api/app-status", { cache: "no-store" });
        if (!r.ok) return;
        const st = (await r.json()) as { reload_at: string | null; updated_at: string | null };
        if (check(st.reload_at) && location.pathname !== "/admin/mandos") return void hardReload();
        const t = (x: string | null) => (x ? new Date(x).getTime() : 0);
        if (st.updated_at && t(st.updated_at) !== t(stampRef.current)) router.refresh();
      } catch { /* sin conexión: ya mirará en la siguiente */ }
    };
    void look();
    const onVisible = () => { if (document.visibilityState === "visible") void look(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [path, router]);
  return null;
}
