"use client";
import { createPortal } from "react-dom";
import { Jersey } from "@/components/squad/jersey";

export type CardFlashInfo = { kind: "yellow" | "red"; name: string; number: number | null; gk: boolean; note: string | null; key: number };

/**
 * 4.21.0 · Acta en vivo: al apuntar una tarjeta, sube desde abajo como si la sacara el árbitro, con el jugador
 * y, si toca, lo que supone (expulsión o ciclo cumplido). Se va sola; tocarla la cierra antes.
 */
export function CardFlash({ info, onDone }: { info: CardFlashInfo; onDone: () => void }) {
  const red = info.kind === "red";
  return createPortal(
    <div role="status" aria-live="polite" className="card-flash fixed inset-x-0 bottom-0 z-[85] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:pb-10"
      onClick={onDone} onAnimationEnd={(e) => { if (e.animationName === "cf-out") onDone(); }}>
      <div className="flex items-center gap-3 rounded-2xl bg-negro py-3 pl-3 pr-4 text-white shadow-2xl ring-1 ring-white/10">
        <span aria-hidden className={`card-flash-card block h-16 w-11 shrink-0 rounded-md shadow-lg ${red ? "bg-rojo" : "bg-amber-400"}`} />
        <div className="min-w-0">
          <p className="sport text-xl font-black uppercase leading-none">{red ? "Roja" : "Amarilla"}</p>
          <p className="mt-1 flex items-center gap-1.5 font-bold"><Jersey number={info.number} goalkeeper={info.gk} size={22} /> <span className="truncate">{info.name}</span></p>
          {info.note && <p className={`mt-1 text-xs font-bold ${red || info.note.startsWith("Ciclo") || info.note.startsWith("Segunda") ? "text-dorado" : "text-white/70"}`}>{info.note}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
