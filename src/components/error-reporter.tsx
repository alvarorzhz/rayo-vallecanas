"use client";
import { useEffect } from "react";
import { logAppErrorAction } from "@/app/account-actions";
import { cleanMessage, cleanPath, isNoise, kindOf, type ErrorKind } from "@/lib/error-log";
import { deviceKind } from "@/lib/usage";

type Buffered = { message: string; source: string };
declare global {
  interface Window { __rvErr?: Buffered[]; __rvVersion?: string; __rvErrOn?: (e: Buffered) => void }
}

const sent = new Set<string>();

/**
 * 4.19.0 · Apunta un fallo para el superadministrador (Gestión → Uso → Fallos).
 * El mismo fallo en la misma pantalla solo se manda una vez por cada vez que se abre la app.
 */
export function reportAppError(kind: ErrorKind, message: string, digest?: string) {
  if (typeof window === "undefined") return;
  const msg = cleanMessage(message);
  if (!msg) return;
  const path = cleanPath(location.pathname);
  const key = `${kind}|${path}|${msg}`;
  if (sent.has(key) || sent.size > 20) return;
  sent.add(key);
  logAppErrorAction({
    kind, path, message: msg, digest: digest ?? null,
    version: window.__rvVersion ?? null, device: deviceKind(navigator.userAgent, navigator.maxTouchPoints),
  }).catch(() => {});
}

function handle(e: Buffered) {
  if (isNoise(e.message, e.source)) return;
  reportAppError(kindOf(e.message), e.message);
}

/**
 * Recoge los fallos de JavaScript de la página. Los que pasan antes de que React arranque del todo
 * (como el 418, que salta justo al «hidratar») los guarda un trocito de código en el <head> y se mandan aquí.
 */
export function ErrorReporter({ version }: { version: string }) {
  useEffect(() => {
    window.__rvVersion = version;
    const early = window.__rvErr ?? [];
    window.__rvErr = [];
    window.__rvErrOn = handle;
    early.forEach(handle);
    return () => { window.__rvErrOn = undefined; };
  }, [version]);
  return null;
}
