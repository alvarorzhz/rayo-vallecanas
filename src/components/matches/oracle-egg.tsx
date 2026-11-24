"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Oracle } from "@/lib/nostradamus";
import { NOSTRA_EXACT } from "@/lib/nostradamus";

/*
 * 4.30.2 · Sorpresa de la porra (no sale en Novedades). Si has clavado el resultado, al entrar en Inicio
 * aparece una bola de cristal con tu foto encapuchada: «Lo sabías». Una vez por partido y dispositivo.
 * Para probar: ?oraculo=1 vuelve a enseñarla.
 */

const busy = () => !!(document.getElementById("rv-tour") || document.getElementById("whats-new-title") || document.getElementById("rv-fichaje")
  || document.getElementById("rv-gala") || document.getElementById("rv-noche") || document.getElementById("rv-avisos"));

export function OracleEgg({ oracle, name, photo }: { oracle: Oracle; name: string; photo: string | null }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const key = `rv-oraculo-${oracle.matchId}`;
    try {
      const force = new URLSearchParams(location.search).get("oraculo");
      if (!force && localStorage.getItem(key)) return;
    } catch {}
    let t: ReturnType<typeof setTimeout>;
    const go = () => {
      if (busy()) t = setTimeout(go, 1000);
      else {
        try {
          localStorage.setItem(key, "1");
        } catch {}
        setOpen(true);
      }
    };
    t = setTimeout(go, 1400);
    return () => clearTimeout(t);
  }, [oracle.matchId]);

  useEffect(() => {
    if (open) btn.current?.focus();
  }, [open]);

  if (!open) return null;
  const res = `${oracle.gf}-${oracle.ga}`;
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="rv-oraculo-titulo" id="rv-oraculo" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      className="oraculo-fondo fixed inset-0 z-[80] flex items-center justify-center overflow-hidden px-5">
      {Array.from({ length: 18 }, (_, i) => (
        <span key={i} aria-hidden className="oraculo-chispa absolute text-[10px] text-[#E9D8FF]"
          style={{ left: `${(i * 53) % 100}%`, top: `${(i * 29) % 100}%`, animationDelay: `${(i % 6) * 0.45}s` }}>✦</span>
      ))}
      <div className="relative w-full max-w-sm text-center text-white">
        <button onClick={() => setOpen(false)} aria-label="Cerrar" className="absolute -top-2 right-0 rounded-lg p-1 text-white/60 hover:text-white"><X size={20} /></button>

        {/* La bola, con tu foto encapuchada dentro, sobre su peana */}
        <div className="oraculo-bola relative mx-auto h-48 w-48 rounded-full">
          <div className="oraculo-niebla absolute inset-0 rounded-full" />
          <div className="oraculo-cara absolute left-1/2 top-1/2 -ml-12 -mt-12 h-24 w-24">
            <div className="h-full w-full overflow-hidden rounded-full ring-2 ring-[#E9D8FF]/70">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="sport flex h-full w-full items-center justify-center bg-[#3B1D6E] text-3xl font-black text-[#E9D8FF]">{initials}</div>
              )}
            </div>
            {/* Capucha de mago */}
            <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute -inset-[22%] h-[144%] w-[144%]">
              <path d="M50 2 C30 14 16 34 14 58 C13 74 18 88 24 96 C24 70 32 40 50 32 C68 40 76 70 76 96 C82 88 87 74 86 58 C84 34 70 14 50 2 Z" fill="#4B1F8F" />
              <path d="M50 2 C38 12 30 24 27 36 C36 30 44 28 50 32 C56 28 64 30 73 36 C70 24 62 12 50 2 Z" fill="#6A35C2" />
              <text x="50" y="22" textAnchor="middle" fontSize="11" fill="#F4D35E">✦</text>
            </svg>
          </div>
          <span aria-hidden className="absolute left-[22%] top-[14%] h-8 w-5 rotate-[30deg] rounded-full bg-white/35 blur-[2px]" />
        </div>
        <div aria-hidden className="mx-auto -mt-3 h-8 w-32 rounded-b-[40%] rounded-t-md bg-gradient-to-b from-[#C9A227] to-[#7A5A10] shadow-xl" />

        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.25em] text-[#E9D8FF]/70">La porra · resultado clavado</p>
        <h2 id="rv-oraculo-titulo" className="sport mt-1 text-4xl font-black text-[#F4D35E]">Lo sabías.</h2>
        <p className="mt-2 text-sm text-white/85">
          Dijiste <b>{res}</b>{oracle.rival ? <> contra {oracle.rival}</> : null} y fue <b>{res}</b>. Tres puntos en la porra y una pregunta: ¿qué números salen en la rifa?
        </p>
        <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-[#E9D8FF]">
          {oracle.nostradamus
            ? `Ya van ${oracle.count} clavados esta temporada. Durante una semana, aquí te llamamos Nostradamus. 🔮`
            : `Te ${NOSTRA_EXACT - oracle.count === 1 ? "falta uno" : `faltan ${NOSTRA_EXACT - oracle.count}`} para ganarte el mote de Nostradamus.`}
        </p>
        <button ref={btn} onClick={() => setOpen(false)} className="mt-5 rounded-xl bg-[#F4D35E] px-5 py-2.5 text-sm font-black text-[#2A0F55] shadow-lg active:scale-95">Lo veía venir</button>
      </div>
    </div>
  );
}
