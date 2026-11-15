"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isStandalone } from "@/lib/push-client";
import { deviceKind, usageArea } from "@/lib/usage";

const last = new Map<string, number>();
let sentDevice = false;

/**
 * Uso de la app (4.16.0): al abrir una pantalla suma 1 a su contador del día.
 * Volver a la misma pantalla en menos de un minuto no cuenta otra vez.
 * Solo lo ve el superadministrador en Gestión → Uso.
 */
export function UsageTracker() {
  const path = usePathname();
  useEffect(() => {
    const area = usageArea(path);
    if (!area) return;
    if (Date.now() - (last.get(area) ?? 0) < 60_000) return;
    // Cuenta si se queda en la pantalla un momento (pasar de largo no es usarla)
    const t = setTimeout(() => {
      last.set(area, Date.now());
      // El dispositivo y si usa la app instalada, solo la primera vez en cada apertura de la app
      const extra = sentDevice ? {} : { p_device: deviceKind(navigator.userAgent, navigator.maxTouchPoints), p_installed: isStandalone() };
      sentDevice = true;
      createClient().rpc("track_usage", { p_area: area, ...extra }).then(() => {}, () => {});
    }, 800);
    return () => clearTimeout(t);
  }, [path]);
  return null;
}
