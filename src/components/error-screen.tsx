"use client";
import { useEffect, useState } from "react";
import { Home, RotateCcw } from "lucide-react";
import { TroubleScreen } from "@/components/trouble-screen";
import { reportAppError } from "@/components/error-reporter";

const KEY = "rv-error-recarga";

/** Fallos que se arreglan recargando: la app se actualizó mientras estaba abierta o se cortó la conexión. */
export function staleOrOffline(e: Error) {
  const m = `${e.name} ${e.message}`;
  return /Failed to find Server Action|ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Failed to fetch|NetworkError|Load failed|network/i.test(m);
}

/**
 * Pantalla de «algo se ha roto por dentro» con aire del club (en vez del «Application error» en blanco).
 * 4.32.3 · Mismo marco que la de «página que no existe» (components/trouble-screen.tsx) y botón a Inicio.
 * Si el fallo es de versión vieja, recarga sola una vez (lo que se estaba escribiendo en La Voz queda guardado en el móvil).
 */
export function ErrorScreen({ error, reset, full = false }: { error: Error & { digest?: string }; reset: () => void; full?: boolean }) {
  const [reloading, setReloading] = useState(false);
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  useEffect(() => {
    console.error(error);
    // 4.19.0 · Queda apuntado para el superadministrador (salvo versión vieja o sin cobertura, que se arreglan solos)
    if (!staleOrOffline(error) && !offline) reportAppError("pantalla", `${error.name && error.name !== "Error" ? error.name + ": " : ""}${error.message}`, error.digest);
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

  // <a> y no <Link>: tras un fallo, mejor cargar Inicio de cero que reutilizar lo que se ha roto
  const home = (
    <a href="/" className="btn-primary">
      <Home size={18} /> Volver a Inicio
    </a>
  );
  if (reloading) return <TroubleScreen full={full} tag="Cambio en el banquillo" title="Actualizando la app…">Hay una versión nueva. Un segundo.</TroubleScreen>;
  if (offline)
    return (
      <TroubleScreen
        full={full}
        tag="Sin cobertura"
        title="Sin conexión"
        actions={<button type="button" onClick={() => reset()} className="btn-primary"><RotateCcw size={18} /> Volver a intentar</button>}
      >
        Parece que no tienes cobertura. Cuando vuelva, dale a «Volver a intentar».
      </TroubleScreen>
    );
  return (
    <TroubleScreen
      full={full}
      tag="Lesión en el vestuario"
      title="Algo se ha roto por dentro"
      actions={
        <>
          {home}
          <button type="button" onClick={() => reset()} className="btn-ghost"><RotateCcw size={18} /> Volver a intentar</button>
        </>
      }
      footer={
        <>
          {/* 4.30.4 · Si se repite, limpiar lo guardado en el dispositivo suele arreglarlo */}
          <p><a href="/reparar" className="underline hover:text-dorado">¿Sigue pasando? Reparar la app</a></p>
          {error.digest && <p className="text-xs text-white/35">Código del fallo: {error.digest}</p>}
        </>
      }
    >
      No es culpa tuya y no has perdido nada de lo que estabas escribiendo. Vuelve a Inicio o inténtalo otra vez. Si se repite, cierra la app y ábrela de nuevo.
    </TroubleScreen>
  );
}
