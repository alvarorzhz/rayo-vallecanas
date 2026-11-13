"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Star, X } from "lucide-react";
import { FutCard } from "@/components/squad/player-card";
import { Confetti } from "@/components/matches/matchday-fx";
import { shirtName, type RosterEntry } from "@/lib/squad";
import { votesLabel } from "@/lib/mvp";

const KEY = "rv-mvp-gala";
/** Momentos de la gala (ms). */
const T_OPEN = 1700;   // se rompe el lacre y se abre la solapa
const T_RISE = 2300;   // sale el cromo
const T_DONE = 3500;   // el ganador, con confeti

type Props = { entry: RosterEntry; votes: number; picked: boolean; rival: string; me: string };

/**
 * Gala del MVP: un sobre dorado lacrado con el escudo, se abre y sale el cromo
 * del ganador. Se salta tocando la pantalla.
 */
function GalaShow({ entry, votes, picked, rival, me, onClose }: Props & { onClose: () => void }) {
  const [phase, setPhase] = useState<"sealed" | "open" | "rise" | "done">("sealed");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mainBtn = useRef<HTMLButtonElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setPhase("done"); return; }
    const at = (ms: number, f: () => void) => timers.current.push(setTimeout(f, ms));
    at(T_OPEN, () => setPhase("open"));
    at(T_RISE, () => setPhase("rise"));
    at(T_DONE, () => setPhase("done"));
    return clear;
  }, []);
  useEffect(() => { (phase === "done" ? mainBtn.current : stage.current)?.focus({ preventScroll: true }); }, [phase]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const skip = useCallback(() => { if (phase !== "done") { clear(); setPhase("done"); } }, [phase]);

  const isMe = !!entry.player.user_id && entry.player.user_id === me;
  const opened = phase !== "sealed";
  const out = phase === "rise" || phase === "done";

  // En el body: dentro de la página quedaría por debajo de la barra (cada sección tiene su propio apilado)
  return createPortal(
    <div ref={stage} tabIndex={-1} id="rv-gala" role="dialog" aria-modal="true" aria-labelledby="gala-title"
      className="fc-stage fixed inset-0 z-[70] flex flex-col overflow-hidden text-white outline-none" onClick={skip}>
      <div aria-hidden className="fc-bg absolute inset-0" />
      <span aria-hidden className="md-light md-light-l" />
      <span aria-hidden className="md-light md-light-r" />
      <span aria-hidden className="gala-carpet absolute inset-x-0 bottom-0 h-1/3" />

      <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Cerrar la gala"
        className="absolute right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 rounded-full bg-black/40 p-2 text-white/75 ring-1 ring-white/15 hover:text-white">
        <X size={20} />
      </button>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <p className="fc-kicker text-xs font-bold uppercase tracking-[0.4em] text-dorado">Gala del MVP</p>
        <p className="sport mt-1 text-center text-2xl font-black">{rival}</p>
        <p className={`mt-1 text-sm text-white/70 transition-opacity ${out ? "opacity-0" : ""}`}>Y el mejor del partido es…</p>

        <div className="relative mt-4 h-[22rem] w-64 sm:w-72">
          {out && <span aria-hidden className="fc-rays absolute left-1/2 top-[40%] h-[120%] w-[170%] -translate-x-1/2 -translate-y-1/2" />}

          {/* El cromo, que sale del sobre */}
          <div className={`absolute inset-x-6 top-10 z-10 ${out ? "gala-rise" : "translate-y-20 opacity-0"} ${phase === "done" ? "fc-glow" : ""}`}>
            <div className="drop-shadow-[0_22px_30px_rgba(0,0,0,0.7)]"><FutCard entry={entry} size="lg" form /></div>
          </div>

          {/* El sobre */}
          <div className={`gala-env absolute inset-x-0 bottom-0 h-40 ${out ? "gala-env-down" : "gala-float"}`}>
            {/* Interior y solapa */}
            <div aria-hidden className="absolute inset-0 rounded-md bg-[linear-gradient(160deg,#6b5310,#2a2005)]" />
            <div aria-hidden className={`gala-flap absolute inset-x-0 top-0 h-24 origin-top ${opened ? "gala-flap-open" : ""}`}
              style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)" }} />
            {/* Frente del sobre (tapa el cromo hasta que sube) */}
            <div aria-hidden className="absolute inset-0 z-20 rounded-md bg-[linear-gradient(160deg,#fbeaa6_0%,#e3c255_40%,#b8901f_100%)] shadow-2xl"
              style={{ clipPath: "polygon(0 0, 50% 55%, 100% 0, 100% 100%, 0 100%)" }}>
              <span className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0_60%,rgba(210,13,23,0.85)_60%_70%,rgba(8,8,8,0.8)_70%_72%,transparent_72%)]" />
              <span className="sport absolute bottom-3 left-4 text-sm font-black tracking-[0.25em] text-negro/80">MVP</span>
            </div>
            {/* Lacre con el escudo */}
            {!opened && (
              <span aria-hidden className="gala-seal absolute left-1/2 top-[45%] z-30 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-rojo ring-4 ring-rojo-oscuro">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/escudo.png" alt="" className="w-8" />
              </span>
            )}
            {phase === "open" && <span aria-hidden className="fc-ring absolute left-1/2 top-[45%] z-30 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full" />}
          </div>
        </div>

        {phase === "done" ? (
          <div className="mt-1 w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
            <p className="fc-up flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-[0.35em] text-dorado"><Star size={13} className="fill-dorado" /> {isMe ? "¡Eres tú!" : "MVP del partido"}</p>
            <h2 id="gala-title" className="fc-up sport mt-1 text-5xl font-black leading-[0.9]" style={{ animationDelay: "100ms" }}>
              {entry.number != null && <span className="mr-2 text-dorado">{entry.number}</span>}{shirtName(entry.player)}
            </h2>
            <p className="fc-up mt-1 text-sm text-white/70" style={{ animationDelay: "180ms" }}>{picked ? "Lo eligió un gestor tras el empate" : `Elegido por el equipo con ${votesLabel(votes)}`}</p>
            <button ref={mainBtn} type="button" onClick={onClose} className="fc-up btn-primary mt-5 w-full" style={{ animationDelay: "300ms" }}>¡Aúpa Rayo!</button>
          </div>
        ) : (
          <p className="absolute bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] text-xs font-semibold text-white/60">Toca para saltar</p>
        )}
      </div>

      {phase === "done" && <div aria-hidden className="egg-flash pointer-events-none absolute inset-0 z-20" />}
      {phase === "done" && <Confetti pieces={70} />}
    </div>,
    document.body,
  );
}

const seen = (me: string): string[] => { try { return JSON.parse(localStorage.getItem(`${KEY}:${me}`) ?? "[]"); } catch { return []; } };
const markSeen = (me: string, id: string) => {
  try { localStorage.setItem(`${KEY}:${me}`, JSON.stringify([id, ...seen(me).filter((x) => x !== id)].slice(0, 20))); } catch {}
};

/**
 * La gala del MVP. `auto`: sale sola la primera vez que se entra tras el recuento (una vez por partido
 * y persona, también si se ve desde Inicio). `button`: botón «Ver la gala» para repetirla.
 */
export function MvpGala({ matchId, auto, button = true, dark = false, ...props }: Props & { matchId: string; auto: boolean; button?: boolean; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!auto || seen(props.me).includes(matchId)) return;
    // Espera a que no haya otra ventana encima (tutorial, novedades, fichajes, avisos)
    let t: ReturnType<typeof setTimeout>;
    const go = () => {
      if (document.querySelector("#rv-tour, #whats-new-title, #rv-fichaje, #rv-avisos, #rv-bombo, [role=dialog][aria-modal=true]")) t = setTimeout(go, 900);
      else { markSeen(props.me, matchId); setOpen(true); }
    };
    t = setTimeout(go, 900);
    return () => clearTimeout(t);
  }, [auto, matchId, props.me]);
  const close = useCallback(() => { markSeen(props.me, matchId); setOpen(false); }, [props.me, matchId]);
  return (
    <>
      {button && (
        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
          className={`btn shrink-0 !px-3 !py-1.5 text-xs ${dark ? "bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20" : "btn-dark"}`}>
          <Sparkles size={14} /> Ver la gala
        </button>
      )}
      {open && <GalaShow {...props} onClose={close} />}
    </>
  );
}
