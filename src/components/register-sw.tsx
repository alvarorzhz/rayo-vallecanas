"use client";
import { useEffect } from "react";

declare global {
  interface Window { __rvReady?: boolean }
}

export function RegisterSW() {
  useEffect(() => {
    // 4.30.4 · La app ya ha arrancado: el vigía de arranque (STUCK_SCRIPT) no tiene que avisar
    window.__rvReady = true;
    document.getElementById("rv-atasco")?.remove();
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
