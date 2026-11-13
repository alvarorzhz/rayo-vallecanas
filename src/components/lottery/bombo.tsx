"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Trophy, X } from "lucide-react";
import { Confetti } from "@/components/matches/matchday-fx";

/** Momentos del bombo (ms desde que empieza). */
const T_DROP = 2600;   // deja de girar y cae la bola
const T_OPEN = 3700;   // la bola se abre y bailan los números
const T_DONE = 5000;   // número ganador

/** Marca de «acabo de sortear»: la pone el botón y la lee el recuadro del ganador al cargar. */
export const bomboFlag = (campaignId: string) => `rv-bombo:${campaignId}`;

// Pseudoaleatorio estable (mismo dibujo en servidor y cliente)
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

type Props = { number: number; total: number; buyer: string | null; seller: string | null; campaign: string };

/**
 * El bombo de la rifa: gira con las bolas dentro, se para, cae la bola
 * y los números bailan hasta quedarse en el ganador. Se salta tocando la pantalla.
 */
function BomboShow({ number, total, buyer, seller, campaign, onClose }: Props & { onClose: () => void }) {
  const [phase, setPhase] = useState<"spin" | "drop" | "open" | "done">("spin");
  const [shown, setShown] = useState<number>(number);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mainBtn = useRef<HTMLButtonElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const width = String(total).length;

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setPhase("done"); return; }
    const at = (ms: number, f: () => void) => timers.current.push(setTimeout(f, ms));
    at(T_DROP, () => setPhase("drop"));
    at(T_OPEN, () => setPhase("open"));
    // Los números bailan cada vez más despacio hasta el ganador
    let t = T_OPEN;
    for (let i = 0; i < 14; i++) {
      t += 40 + i * 8;
      at(t, () => setShown(1 + Math.floor(Math.random() * total)));
    }
    at(T_DONE, () => { setShown(number); setPhase("done"); });
    return clear;
  }, [number, total]);

  useEffect(() => { (phase === "done" ? mainBtn.current : stage.current)?.focus({ preventScroll: true }); }, [phase]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const skip = useCallback(() => { if (phase !== "done") { clear(); setShown(number); setPhase("done"); } }, [phase, number]);
  const pad = (n: number) => String(n).padStart(width, "0");
  const spinning = phase === "spin";
  const ballOut = phase !== "spin";

  // En el body: dentro de la página quedaría por debajo de la barra (cada sección tiene su propio apilado)
  return createPortal(
    <div ref={stage} tabIndex={-1} id="rv-bombo" role="dialog" aria-modal="true" aria-labelledby="bombo-title"
      className="fc-stage fixed inset-0 z-[70] flex flex-col overflow-hidden text-white outline-none" onClick={skip}>
      <div aria-hidden className="fc-bg absolute inset-0" />
      <span aria-hidden className="md-light md-light-l" />
      <span aria-hidden className="md-light md-light-r" />

      <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Cerrar el sorteo"
        className="absolute right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 rounded-full bg-black/40 p-2 text-white/75 ring-1 ring-white/15 hover:text-white">
        <X size={20} />
      </button>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <p className="fc-kicker text-xs font-bold uppercase tracking-[0.4em] text-dorado">Sorteo en directo</p>
        <p className="sport mt-1 max-w-sm truncate text-center text-2xl font-black">{campaign}</p>

        {/* El bombo con su soporte */}
        <div className="relative mt-6 h-[19rem] w-64">
          <div className={`bb-cage absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 rounded-full transition-opacity duration-700 ${spinning ? "bb-spin" : "bb-stop"} ${phase === "open" || phase === "done" ? "opacity-40" : ""}`}>
            {/* Varillas */}
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} aria-hidden className="absolute left-1/2 top-0 h-full w-[2px] bg-dorado/45" style={{ transform: `translateX(-50%) rotate(${i * 22.5}deg)` }} />
            ))}
            {/* Bolas dentro */}
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} aria-hidden
                className={`bb-ball absolute grid h-8 w-8 place-items-center rounded-full text-[10px] font-black text-negro ${spinning ? "bb-jump" : ""}`}
                style={{
                  left: `${22 + rnd(i, 1) * 52}%`, top: `${30 + rnd(i, 2) * 45}%`,
                  animationDelay: `${-rnd(i, 3) * 0.8}s`, animationDuration: `${0.45 + rnd(i, 4) * 0.4}s`,
                  ["--dx" as string]: `${(rnd(i, 5) - 0.5) * 70}px`, ["--dy" as string]: `${-30 - rnd(i, 6) * 55}px`,
                }}>
                {1 + Math.floor(rnd(i, 7) * total)}
              </span>
            ))}
            <span aria-hidden className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.35),transparent_45%)]" />
          </div>
          {/* Eje y patas */}
          <span aria-hidden className="absolute left-1/2 top-[6.6rem] h-5 w-5 -translate-x-1/2 rounded-full bg-dorado ring-4 ring-negro" />
          <span aria-hidden className="absolute bottom-0 left-6 h-24 w-3 origin-bottom rotate-[18deg] rounded bg-gradient-to-b from-dorado to-[#8a6a12]" />
          <span aria-hidden className="absolute bottom-0 right-6 h-24 w-3 origin-bottom -rotate-[18deg] rounded bg-gradient-to-b from-dorado to-[#8a6a12]" />
          {/* Rampa de salida */}
          <span aria-hidden className="absolute left-1/2 top-[13.6rem] h-3 w-24 -translate-x-[10%] rotate-[14deg] rounded-full bg-white/15" />

          {/* La bola ganadora */}
          {ballOut && (
            <div className={`bb-winner absolute left-1/2 top-[11rem] z-10 -translate-x-1/2 ${phase === "drop" ? "bb-fall" : "bb-big"}`}>
              <div className="relative grid h-32 w-32 place-items-center overflow-hidden rounded-full bg-white text-negro ring-4 ring-dorado">
                <span aria-hidden className="absolute inset-x-0 top-1/2 h-9 -translate-y-1/2 bg-rojo" />
                <span aria-hidden className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.9),transparent_40%)]" />
                <span className={`sport relative rounded-full bg-white px-2 font-mono text-4xl font-black tabular-nums ${phase === "done" ? "bb-pop" : ""}`}>
                  {phase === "drop" ? "?" : pad(shown)}
                </span>
              </div>
              {phase === "done" && <span aria-hidden className="fc-ring absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full" />}
            </div>
          )}
        </div>

        {phase === "done" ? (
          <div className="mt-2 w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
            <p className="fc-up text-xs font-bold uppercase tracking-[0.35em] text-dorado">Número ganador</p>
            <h2 id="bombo-title" className="fc-up sport mt-1 text-6xl font-black leading-none" style={{ animationDelay: "100ms" }}>{pad(number)}</h2>
            <p className="fc-up mt-2 text-lg font-bold" style={{ animationDelay: "200ms" }}>
              {buyer ? <>Le ha tocado a <span className="text-dorado">{buyer}</span></> : "Ese número no se vendió"}
            </p>
            {buyer && seller && <p className="fc-up text-sm text-white/70" style={{ animationDelay: "260ms" }}>Lo vendió {seller}</p>}
            <button ref={mainBtn} type="button" onClick={onClose} className="fc-up btn-primary mt-5 w-full" style={{ animationDelay: "380ms" }}>
              <Trophy size={16} /> {buyer ? "¡Enhorabuena!" : "Cerrar"}
            </button>
          </div>
        ) : (
          <p className="absolute bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] text-xs font-semibold text-white/60">Toca para saltar</p>
        )}
      </div>

      {phase === "done" && <div aria-hidden className="egg-flash pointer-events-none absolute inset-0 z-20" />}
      {phase === "done" && buyer && <Confetti pieces={70} />}
    </div>,
    document.body,
  );
}

/**
 * Recuadro del ganador: botón «Ver el bombo» para repetirlo (o grabarlo y enseñarlo)
 * y, justo después de sortear al azar, el bombo arranca solo.
 */
export function BomboReplay({ campaignId, ...props }: Props & { campaignId: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(bomboFlag(campaignId))) {
        sessionStorage.removeItem(bomboFlag(campaignId));
        setOpen(true);
      }
    } catch {}
  }, [campaignId]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-dark"><Sparkles size={16} /> Ver el bombo</button>
      {open && <BomboShow {...props} onClose={() => setOpen(false)} />}
    </>
  );
}
