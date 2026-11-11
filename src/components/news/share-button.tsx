"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";

/** Comparte la noticia (menú del móvil) o copia el enlace. Con `url`, comparte esa dirección (la pública). */
export function ShareButton({ title, url }: { title: string; url?: string }) {
  const [done, setDone] = useState(false);
  const share = async () => {
    const link = url ? new URL(url, location.origin).href : location.href.split("?")[0];
    try {
      if (navigator.share) await navigator.share({ title, text: `${title} · La Voz del Rayo`, url: link });
      else {
        await navigator.clipboard.writeText(`${title}\n${link}`);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }
    } catch {
      // cancelado
    }
  };
  return (
    <button type="button" onClick={share} className="btn-ghost !px-3 !py-1.5 text-xs">
      <Share2 size={14} /> {done ? "Enlace copiado" : "Compartir"}
    </button>
  );
}
