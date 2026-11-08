"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ImageDown, Share2, X } from "lucide-react";

type Ready = { file: File; src: string };

/**
 * Imagen del resultado: al pulsar se prepara y se enseña en grande, con «Compartir» y «Descargar».
 * Antes se abría el menú de compartir directamente al acabar de prepararla, pero si tardaba unos
 * segundos el móvil ya no lo permitía (hace falta un toque reciente) y no salía nada (v3.20.1).
 */
export function ShareImageButton({ url, name }: { url: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => () => { if (ready) URL.revokeObjectURL(ready.src); }, [ready]);
  useEffect(() => {
    if (!ready) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setReady(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready]);

  async function prepare() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) throw new Error();
      const blob = await res.blob();
      if (!blob.size) throw new Error();
      setReady({ file: new File([blob], name, { type: "image/png" }), src: URL.createObjectURL(blob) });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!ready) return;
    const a = document.createElement("a");
    a.href = ready.src;
    a.download = name;
    a.click();
  }

  async function share() {
    if (!ready) return;
    if (navigator.canShare?.({ files: [ready.file] })) {
      try {
        await navigator.share({ files: [ready.file] });
      } catch (e) {
        // Cancelar el menú no es un error; si el móvil no deja compartir, se descarga
        if ((e as Error)?.name !== "AbortError") download();
      }
    } else {
      download();
    }
  }

  const canShare = typeof navigator !== "undefined" && !!navigator.canShare && !!ready && navigator.canShare({ files: [ready.file] });

  return (
    <>
      <button type="button" onClick={prepare} disabled={busy} className="btn-ghost px-3 py-1.5 text-sm">
        <ImageDown size={15} className="text-rojo" /> {busy ? "Preparando…" : error ? "Reintentar imagen" : "Imagen"}
      </button>
      {/* En un portal: dentro de la portada animada «fixed» no cubriría la pantalla */}
      {ready && createPortal(
        <div className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Imagen del resultado" onClick={() => setReady(null)}>
          <div className="w-full max-w-sm animate-pop space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end">
              <button type="button" onClick={() => setReady(null)} aria-label="Cerrar" className="rounded-full bg-white/15 p-1.5 text-white hover:bg-white/25"><X size={20} /></button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ready.src} alt="Imagen del resultado" className="max-h-[68dvh] w-full rounded-2xl object-contain shadow-xl" />
            <div className="flex gap-2">
              {canShare && <button type="button" onClick={share} className="btn-primary flex-1"><Share2 size={16} /> Compartir</button>}
              <button type="button" onClick={download} className={`${canShare ? "btn-ghost bg-white" : "btn-primary"} flex-1`}><Download size={16} /> Descargar</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
