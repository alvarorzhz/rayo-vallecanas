"use client";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Copy, Globe, Lock, MessageCircle } from "lucide-react";
import { FormMessage } from "@/components/form-message";
import type { NewsState } from "@/app/(app)/la-voz/actions";

const noop = () => () => {};

/** Página pública de la noticia: el superadministrador la enciende o la apaga; todos ven el enlace si está encendida. */
export function PublicPanel({ title, slug, canToggle, toggle }: {
  title: string;
  slug: string | null;
  canToggle: boolean;
  toggle?: (on: boolean) => Promise<NewsState & { slug?: string | null }>;
}) {
  const [current, setCurrent] = useState(slug);
  const [msg, setMsg] = useState<NewsState>();
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  // El dominio se lee solo en el navegador (en el servidor va vacío) para no descuadrar la hidratación
  const origin = useSyncExternalStore(noop, () => location.origin, () => "");
  const link = current ? `${origin}/noticias/${current}` : null;

  const flip = (on: boolean) =>
    start(async () => {
      const r = await toggle?.(on);
      if (!r) return;
      setMsg(r);
      if (!r.error) setCurrent(on ? r.slug ?? null : null);
    });
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // sin portapapeles
    }
  };

  return (
    <section aria-label="Página pública" className={`mx-auto mt-5 max-w-3xl rounded-2xl p-4 shadow-sm ring-1 ${current ? "bg-negro text-white ring-negro" : "bg-white ring-black/5"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${current ? "bg-dorado text-negro" : "bg-gris text-negro/60"}`}>
          {current ? <Globe size={18} /> : <Lock size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{current ? "Pública: la puede leer cualquiera con el enlace" : "Solo para el equipo"}</p>
          <p className={`text-xs ${current ? "text-white/65" : "text-negro/60"}`}>
            {current ? "Sin registrarse. Los jugadores salen solo por su apodo." : canToggle ? "Hazla pública para compartirla fuera del equipo (redes, WhatsApp, familia)." : ""}
          </p>
        </div>
        {canToggle && (
          <button type="button" disabled={pending} onClick={() => flip(!current)} className={current ? "btn-ghost !py-2 text-sm" : "btn-primary !py-2 text-sm"}>
            {pending ? "Un momento…" : current ? "Dejar de compartir" : "Hacer pública"}
          </button>
        )}
      </div>
      {link && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="min-w-0 basis-full truncate rounded-lg bg-white/10 px-3 py-2 text-xs sm:basis-0 sm:flex-1">{link}</code>
          <button type="button" onClick={copy} className="btn !bg-white !py-2 text-sm text-negro"><Copy size={15} /> {copied ? "Copiado" : "Copiar"}</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(`🗞️ ${title}\n${link}`)}`} target="_blank" rel="noopener noreferrer" className="btn !bg-[#25D366] !py-2 text-sm text-white">
            <MessageCircle size={15} /> WhatsApp
          </a>
        </div>
      )}
      <div className="mt-2"><FormMessage state={msg} /></div>
    </section>
  );
}
