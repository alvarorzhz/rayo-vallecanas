"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ImageDown, Share2, X } from "lucide-react";

type Format = "post" | "story";
type Ready = { file: File; src: string; format: Format };

/** Lo que dura guardada una imagen ya preparada (si alguien dice «Voy» entretanto, sale en la siguiente). */
const FRESH_MS = 60_000;

/** iPhone o iPad (el iPad se presenta como un Mac con pantalla táctil). */
const isApple = () => typeof navigator !== "undefined" && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

const FORMATS: { key: Format; label: string }[] = [
  { key: "post", label: "Publicación" },
  { key: "story", label: "Historia" },
];

/**
 * Prepara una imagen para compartir y la enseña en grande, con «Compartir» y «Descargar».
 * Antes se abría el menú de compartir directamente al acabar de prepararla, pero si tardaba unos
 * segundos el móvil ya no lo permitía (hace falta un toque reciente) y no salía nada (v3.20.1).
 * Dos formatos (v3.22.0): publicación (4:5) e historia (9:16, para estados de WhatsApp e historias).
 * Desde la 4.18.3, en cuanto está lista una se prepara la otra de fondo, así cambiar de formato es
 * al momento, y cada una se guarda un minuto por si se vuelve a abrir.
 */
function useShareImage(url: string, name: string, title: string) {
  const [busy, setBusy] = useState<Format | null>(null);
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState(false);
  // Imágenes ya preparadas (o en camino), por formato
  const cache = useRef(new Map<Format, { at: number; p: Promise<Ready> }>());

  useEffect(() => {
    const c = cache.current;
    return () => c.forEach(({ p }) => p.then((r) => URL.revokeObjectURL(r.src), () => {}));
  }, []);
  useEffect(() => {
    if (!ready) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setReady(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready]);

  function load(format: Format): Promise<Ready> {
    const hit = cache.current.get(format);
    if (hit && Date.now() - hit.at < FRESH_MS) return hit.p;
    if (hit) hit.p.then((r) => URL.revokeObjectURL(r.src), () => {});
    const p = (async () => {
      const res = await fetch(format === "story" ? `${url}?formato=historia` : url, { cache: "no-store" });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/")) throw new Error();
      const blob = await res.blob();
      if (!blob.size) throw new Error();
      const file = fileName(name, format, type);
      return { file: new File([blob], file, { type: blob.type || type }), src: URL.createObjectURL(blob), format };
    })();
    cache.current.set(format, { at: Date.now(), p });
    p.catch(() => cache.current.get(format)?.p === p && cache.current.delete(format));
    return p;
  }

  async function prepare(format: Format = "post") {
    setBusy(format);
    setError(false);
    try {
      const r = await load(format);
      setReady(r);
      // La otra, de fondo, para que el cambio de formato sea al momento
      load(format === "post" ? "story" : "post").catch(() => {});
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  // Descargar: en Android y en el ordenador se guarda directamente (en el móvil sale en la galería,
  // en «Descargas»). En iPhone una página web no puede meter nada en Fotos por su cuenta: lo más
  // directo es el menú de compartir con la imagen, donde «Guardar imagen» la manda a Fotos (4.18.3).
  function saveFile() {
    if (!ready) return;
    const a = document.createElement("a");
    a.href = ready.src;
    a.download = ready.file.name;
    a.click();
  }

  async function share() {
    if (!ready) return;
    if (navigator.canShare?.({ files: [ready.file] })) {
      try {
        await navigator.share({ files: [ready.file] });
      } catch (e) {
        // Cancelar el menú no es un error; si el móvil no deja compartir, se descarga
        if ((e as Error)?.name !== "AbortError") saveFile();
      }
    } else {
      saveFile();
    }
  }

  const canShare = typeof navigator !== "undefined" && !!navigator.canShare && !!ready && navigator.canShare({ files: [ready.file] });
  const apple = isApple();

  // En un portal: dentro de la portada animada «fixed» no cubriría la pantalla
  const modal = ready && createPortal(
    <div className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title} onClick={() => setReady(null)}>
      <div className="w-full max-w-sm animate-pop space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex rounded-full bg-white/15 p-1" role="tablist" aria-label="Formato">
            {FORMATS.map((f) => (
              <button key={f.key} type="button" role="tab" aria-selected={ready.format === f.key} disabled={!!busy}
                onClick={() => ready.format !== f.key && prepare(f.key)}
                className={`rounded-full px-3 py-1 text-sm font-semibold transition ${ready.format === f.key ? "bg-white text-negro" : "text-white hover:bg-white/10"}`}>
                {busy === f.key ? "Preparando…" : f.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setReady(null)} aria-label="Cerrar" className="rounded-full bg-white/15 p-1.5 text-white hover:bg-white/25"><X size={20} /></button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ready.src} alt={title} className={`max-h-[68dvh] w-full rounded-2xl object-contain shadow-xl transition-opacity ${busy ? "opacity-50" : ""}`} />
        {error && <p className="text-center text-sm text-white/80">No se ha podido preparar. Prueba otra vez.</p>}
        {apple && canShare ? (
          <>
            <button type="button" onClick={share} className="btn-primary w-full"><Download size={16} /> Guardar o compartir</button>
            <p className="text-center text-xs text-white/75">Toca «Guardar imagen» y va directa a Fotos.</p>
          </>
        ) : (
          <div className="flex gap-2">
            {canShare && <button type="button" onClick={share} className="btn-ghost flex-1 bg-white"><Share2 size={16} /> Compartir</button>}
            <button type="button" onClick={saveFile} className="btn-primary flex-1"><Download size={16} /> Descargar</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );

  return { busy, ready, error, prepare, modal };
}

/** Botón «Imagen» (atajo del resultado en el acta y en Inicio). */
export function ShareImageButton({ url, name, title = "Imagen del resultado" }: { url: string; name: string; title?: string }) {
  const { busy, ready, error, prepare, modal } = useShareImage(url, name, title);
  return (
    <>
      <button type="button" onClick={() => prepare()} disabled={!!busy} className="btn-ghost px-3 py-1.5 text-sm">
        <ImageDown size={15} className="text-rojo" /> {busy && !ready ? "Preparando…" : error && !ready ? "Reintentar imagen" : "Imagen"}
      </button>
      {modal}
    </>
  );
}

/**
 * Tarjeta del apartado «Imágenes para compartir» de la ficha del partido (v4.4.0): un póster en
 * miniatura dibujado con CSS (no se genera la imagen hasta que se pide) y los dos formatos.
 */
export function ShareImageTile({ url, name, title, hint, word, glow }: { url: string; name: string; title: string; hint: string; word: string; glow: "oro" | "rojo" }) {
  const { busy, ready, error, prepare, modal } = useShareImage(url, name, title);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white p-2.5">
      <button type="button" onClick={() => prepare("post")} disabled={!!busy} aria-label={`Ver ${title.toLowerCase()}`}
        className={`share-thumb share-thumb-${glow} relative grid aspect-[4/5] w-16 shrink-0 place-items-center overflow-hidden rounded-lg text-white`}>
        <span className="sport relative px-0.5 text-center text-[0.6rem] font-black leading-none">{word}</span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-tight">{title}</p>
        <p className="text-xs text-negro/65">{error && !ready ? "No se ha podido preparar. Prueba otra vez." : hint}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {FORMATS.map((f) => (
            <button key={f.key} type="button" onClick={() => prepare(f.key)} disabled={!!busy} className="btn-ghost px-2.5 py-1 text-xs">
              <ImageDown size={13} className="text-rojo" /> {busy === f.key && !ready ? "Preparando…" : f.label}
            </button>
          ))}
        </div>
      </div>
      {modal}
    </div>
  );
}

/** «resultado-2026-11-07.png» → «resultado-2026-11-07.jpg» o «resultado-2026-11-07-historia.jpg». */
function fileName(base: string, format: Format, type: string) {
  const ext = type.includes("jpeg") ? "jpg" : type.includes("png") ? "png" : "img";
  return `${base.replace(/\.\w+$/, "")}${format === "story" ? "-historia" : ""}.${ext}`;
}
