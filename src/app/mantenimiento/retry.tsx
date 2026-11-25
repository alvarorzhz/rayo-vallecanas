"use client";
import { useEffect } from "react";

/** Mira cada minuto si ya se ha quitado el mantenimiento (la página manda a Inicio sola). */
export function RetrySoon() {
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") location.reload(); }, 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <button type="button" onClick={() => location.reload()} className="btn-primary w-full">Volver a intentar</button>
      <p className="text-xs text-negro/50">Esta pantalla se comprueba sola cada minuto.</p>
    </>
  );
}
