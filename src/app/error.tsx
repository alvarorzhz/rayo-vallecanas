"use client";
import { ErrorScreen } from "@/components/error-screen";

/** 4.32.3 · Fallos fuera de la app con sesión (login, rifa y noticias públicas): misma pantalla, a pantalla completa. */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} full />;
}
