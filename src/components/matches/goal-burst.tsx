"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CLUB_NAME } from "@/lib/matches";
import type { LiveScorer } from "@/lib/live-queries";

/**
 * 4.20.0 · Pantalla ¡GOOOL! cuando marca el Rayo en el acta en vivo: roja, a pantalla completa,
 * con el cromo de quien ha marcado. Vibra, dura 4 segundos y se cierra al tocarla.
 * El gol del rival es solo una tira gris arriba con el marcador.
 */
export type Burst = { us: boolean; minute: string | null; who: LiveScorer | null; home: number; away: number; homeName: string; awayName: string };

const SHOW_MS = 4000;
const STRIP_MS = 3500;

const ord = (n: number) => `${n}º`;

export function GoalBurst({ burst, onClose }: { burst: Burst; onClose: () => void }) {
  useEffect(() => {
    if (burst.us) {
      try { navigator.vibrate?.([180, 80, 180, 80, 400]); } catch { /* sin vibración */ }
    }
    const t = setTimeout(onClose, burst.us ? SHOW_MS : STRIP_MS);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [burst, onClose]);

  if (typeof document === "undefined") return null;

  if (!burst.us) {
    return createPortal(
      <button type="button" onClick={onClose} role="status" aria-live="polite"
        className="gb-strip fixed inset-x-0 top-0 z-[90] flex items-center justify-center gap-3 bg-neutral-700/95 px-4 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.625rem)] text-white shadow-lg">
        <span className="text-xs font-bold uppercase tracking-widest text-white/70">Gol del rival{burst.minute ? ` · ${burst.minute}` : ""}</span>
        <span className="sport truncate text-lg font-black italic uppercase">{burst.homeName} <span className="tabular-nums">{burst.home}-{burst.away}</span> {burst.awayName}</span>
      </button>,
      document.body,
    );
  }

  const w = burst.who;
  const sub = w
    ? [w.assist ? `Asistencia de ${w.assist}` : null, w.goalsToday > 1 ? `su ${ord(w.goalsToday)} gol hoy` : null].filter(Boolean).join(" · ")
    : "";
  return createPortal(
    <div role="alertdialog" aria-modal="true" aria-label={`¡Gol del Rayo! ${burst.homeName} ${burst.home}, ${burst.awayName} ${burst.away}`}
      onClick={onClose}
      className="gb-screen fixed inset-0 z-[90] flex cursor-pointer flex-col items-center overflow-hidden bg-rojo px-4 pt-[calc(env(safe-area-inset-top)+3.5rem)] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(255,255,255,0.25),transparent_55%)]" />
      <div aria-hidden className="gb-stripes pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(115deg,transparent_0_46px,rgba(0,0,0,0.12)_46px_92px)]" />
      <div aria-hidden className="gb-band pointer-events-none absolute -inset-x-10 bottom-[7%] h-24 -skew-y-[8deg] border-t-[6px] border-dorado bg-negro" />

      <p className="sport relative text-sm font-extrabold tracking-[0.3em]">{burst.minute ? `${burst.minute} · ` : ""}EN DIRECTO</p>
      <p className="gb-title sport relative mt-1 text-[clamp(4.5rem,26vw,8rem)] leading-[0.9] font-black italic tracking-tight [text-shadow:0_6px_0_#080808]">¡GOOOL!</p>

      {w && (
        <div className="gb-card relative mt-6 flex h-56 w-40 flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-800 to-negro p-3 shadow-[0_0_0_3px_#D5AF32,0_20px_40px_rgba(0,0,0,0.5)]">
          {w.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.photo} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
          ) : (
            <span aria-hidden className="sport absolute inset-x-0 top-8 text-center text-[7rem] leading-none font-black italic text-white/10">{w.name.charAt(0)}</span>
          )}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-negro via-negro/30 to-transparent" />
          {w.number != null && <p className="sport absolute left-3 top-2 text-4xl font-black italic text-dorado [text-shadow:0_2px_6px_rgba(0,0,0,0.6)]">{w.number}</p>}
          <p className="sport relative truncate text-center text-2xl font-black italic uppercase">{w.name}</p>
        </div>
      )}

      <div className="gb-score sport relative mt-8 flex max-w-full items-center gap-4 font-black italic">
        <span className="truncate text-xl uppercase">{burst.homeName}</span>
        <span className="shrink-0 text-6xl tabular-nums text-dorado">{burst.home}-{burst.away}</span>
        <span className="truncate text-xl uppercase">{burst.awayName}</span>
      </div>
      {sub && <p className="relative mt-1 text-sm text-white/85">{sub}</p>}
      <p className="relative mt-auto mb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-xs text-white/60">Toca para cerrar</p>
    </div>,
    document.body,
  );
}

/** Nombres para el marcador de la pantalla: el nuestro corto, el del rival como venga. */
export const OUR_SHORT = CLUB_NAME.split(" ")[0].toUpperCase();
