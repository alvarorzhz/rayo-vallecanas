"use client";
import "./globals.css";
import { ErrorScreen } from "@/components/error-screen";

/** Último recurso: si falla hasta la estructura de la app, al menos una pantalla del club con «Volver a intentar». */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body className="antialiased">
        <ErrorScreen error={error} reset={reset} full />
      </body>
    </html>
  );
}
