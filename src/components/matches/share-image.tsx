"use client";
import { useState } from "react";
import { ImageDown } from "lucide-react";

/** Comparte la imagen del resultado (en el móvil abre el menú de compartir; si no, la descarga). */
export function ShareImageButton({ url, name }: { url: string; name: string }) {
  const [busy, setBusy] = useState(false);
  async function share() {
    setBusy(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] }).catch(() => {});
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }
    } catch {
      window.open(url, "_blank");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" onClick={share} disabled={busy} className="btn-ghost px-3 py-1.5 text-sm">
      <ImageDown size={15} className="text-rojo" /> {busy ? "Preparando…" : "Imagen"}
    </button>
  );
}
