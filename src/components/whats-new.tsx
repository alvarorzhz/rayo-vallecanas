"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { CHANGELOG, APP_VERSION } from "@/lib/changelog";

const KEY = "rv-version-vista";

/** Muestra las novedades una vez cuando la app se actualiza a una versión nueva. */
export function WhatsNew() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== APP_VERSION) setOpen(true);
    } catch {}
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  function close() {
    setOpen(false);
    try {
      localStorage.setItem(KEY, APP_VERSION);
    } catch {}
  }
  if (!open) return null;
  const r = CHANGELOG[0];
  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="whats-new-title">
      <div className="max-h-[85dvh] w-full max-w-md animate-pop overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-rojo">
              <Sparkles size={14} /> APP ACTUALIZADA
            </div>
            <h2 id="whats-new-title" className="text-xl font-black">Versión {r.version} · {r.title}</h2>
          </div>
          <button onClick={close} aria-label="Cerrar" className="rounded-lg p-1 text-negro/65 hover:text-negro"><X size={20} /></button>
        </div>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-negro/80">
          {r.changes.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <div className="flex gap-2">
          <Link href="/novedades" onClick={close} className="btn-ghost flex-1">Ver historial</Link>
          <button onClick={close} className="btn-primary flex-1">Entendido</button>
        </div>
      </div>
    </div>
  );
}
