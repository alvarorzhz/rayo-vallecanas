"use client";
import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

const KEY = "rv-error-recarga";

/** Fallos que se arreglan recargando: la app se actualizó mientras estaba abierta o se cortó la conexión. */
export function staleOrOffline(e: Error) {
  const m = `${e.name} ${e.message}`;
  return /Failed to find Server Action|ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Failed to fetch|NetworkError|Load failed|network/i.test(m);
}

/**
 * Pantalla de «algo ha fallado» con aire del club (en vez del «Application error» en blanco).
 * Si el fallo es de versión vieja, recarga sola una vez (lo que se estaba escribiendo en La Voz queda guardado en el móvil).
 */
export function ErrorScreen({ error, reset, full = false }: { error: Error & { digest?: string }; reset: () => void; full?: boolean }) {
  const [reloading, setReloading] = useState(false);
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  useEffect(() => {
    console.error(error);
    if (!staleOrOffline(error) || offline) return;
    try {
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last < 30_000) return; // ya se recargó hace nada: no entrar en bucle
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
      return;
    }
    setReloading(true);
    window.location.reload();
  }, [error, offline]);

  return (
    <div className={`flex flex-col items-center justify-center px-6 text-center ${full ? "min-h-dvh bg-[#f7f7f4]" : "min-h-[60dvh]"}`}>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rojo text-2xl text-white shadow-lg">⚡</span>
      <h1 className="sport mt-4 text-2xl font-black text-negro">{reloading ? "Actualizando la app…" : offline ? "Sin conexión" : "Algo ha fallado"}</h1>
      <p className="mt-2 max-w-sm text-sm text-negro/70">
        {reloading
          ? "Hay una versión nueva. Un segundo."
          : offline
            ? "Parece que no tienes cobertura. Cuando vuelva, dale a «Volver a intentar»."
            : "No has perdido nada de lo que estabas escribiendo. Dale a «Volver a intentar» y, si vuelve a pasar, cierra la app y ábrela otra vez."}
      </p>
      {!reloading && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => reset()} className="btn-primary"><RotateCcw size={18} /> Volver a intentar</button>
          <button type="button" onClick={() => window.location.assign("/")} className="btn-ghost">Ir a Inicio</button>
        </div>
      )}
      {error.digest && <p className="mt-6 text-xs text-negro/40">Código del fallo: {error.digest}</p>}
    </div>
  );
}
