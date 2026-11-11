"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";

/** Comparte la noticia (menú del móvil) o copia el enlace. */
export function ShareButton({ title }: { title: string }) {
  const [done, setDone] = useState(false);
  const share = async () => {
    const url = location.href.split("?")[0];
    try {
      if (navigator.share) await navigator.share({ title, text: `${title} · La Voz del Rayo`, url });
      else {
        await navigator.clipboard.writeText(`${title}\n${url}`);
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
