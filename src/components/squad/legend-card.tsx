"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Jersey } from "@/components/squad/jersey";

export type LegendData = {
  name: string;
  number: number | null;
  position: string;
  photo: string | null;
  goalkeeper: boolean;
  stats: { short: string; long: string }[];
};

const HOLD_MS = 3000;
const CHARGE_AFTER = 700;
const SHAPE = "polygon(12% 0, 88% 0, 100% 7%, 100% 89%, 50% 100%, 0 89%, 0 7%)";

type DOE = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };

/**
 * Cromo enlazado a la ficha. Sorpresa escondida (no sale en Novedades): si se mantiene
 * pulsado 3 segundos se da la vuelta y aparece su versión Leyenda, holográfica y con media 99.
 */
export function LegendCard({ href, legend, className, style, children }: {
  href: string; legend: LegendData; className?: string; style?: React.CSSProperties; children: React.ReactNode;
}) {
  const [on, setOn] = useState(false);
  const [shown, setShown] = useState(false); // la cara Leyenda se monta la primera vez
  const [charging, setCharging] = useState(false);
  const [burst, setBurst] = useState(0);
  const [tilting, setTilting] = useState(false);
  const flipper = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const start = useRef<{ x: number; y: number } | null>(null);
  const skipClick = useRef(false);
  const justFlipped = useRef(false);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    start.current = null;
    setCharging(false);
  };
  useEffect(() => clear, []);

  function setTilt(x: number, y: number) {
    // x, y entre 0 y 1
    const el = flipper.current;
    if (!el) return;
    el.style.setProperty("--rx", `${(x - 0.5) * -24}deg`);
    el.style.setProperty("--ry", `${(y - 0.5) * 18}deg`);
    el.style.setProperty("--mx", String(x));
    el.style.setProperty("--my", String(y));
  }

  // Al inclinar el móvil se mueve el brillo
  useEffect(() => {
    if (!on) return;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      const clamp = (v: number) => Math.max(0, Math.min(1, v));
      setTilting(true);
      setTilt(clamp(0.5 + e.gamma / 50), clamp(0.5 + (e.beta - 40) / 50));
    };
    window.addEventListener("deviceorientation", onTilt);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOn(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("deviceorientation", onTilt);
      window.removeEventListener("keydown", onKey);
    };
  }, [on]);

  function onPointerDown(e: React.PointerEvent) {
    if (on || e.button !== 0) return;
    clear();
    start.current = { x: e.clientX, y: e.clientY };
    timers.current.push(setTimeout(() => setCharging(true), CHARGE_AFTER));
    timers.current.push(setTimeout(() => {
      clear();
      skipClick.current = true;
      justFlipped.current = true;
      setShown(true);
      setOn(true);
      setBurst((b) => b + 1);
      try {
        navigator.vibrate?.([30, 50, 90]);
      } catch {}
    }, HOLD_MS));
  }

  function onPointerMove(e: React.PointerEvent) {
    if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 12) clear();
    if (on) {
      const r = e.currentTarget.getBoundingClientRect();
      setTilting(true);
      setTilt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    }
  }

  function onPointerUp() {
    clear();
    // En iPhone el permiso para leer la inclinación se pide con un gesto
    if (justFlipped.current) {
      justFlipped.current = false;
      const D = typeof DeviceOrientationEvent !== "undefined" ? (DeviceOrientationEvent as DOE) : null;
      D?.requestPermission?.().catch(() => {});
    }
  }

  function onClick(e: React.MouseEvent) {
    if (skipClick.current) {
      skipClick.current = false;
      e.preventDefault();
      return;
    }
    // Con la cara Leyenda, un toque la vuelve a girar
    if (on) {
      e.preventDefault();
      setOn(false);
      setTilting(false);
      setTilt(0.5, 0.5);
    }
  }

  return (
    <Link href={href} prefetch style={style} draggable={false}
      aria-label={on ? `${legend.name}, cromo Leyenda. Toca para darle la vuelta` : undefined}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={clear}
      onPointerLeave={() => { if (start.current) clear(); if (on) { setTilting(false); setTilt(0.5, 0.5); } }}
      onContextMenu={(e) => { if (start.current || on) e.preventDefault(); }}
      onClick={onClick}
      className={`lg-card lg-scene relative ${className ?? ""}`}>
      <div className={charging ? "lg-charging" : ""}>
        <div ref={flipper} className={`lg-flipper ${on ? "lg-on" : ""} ${tilting ? "lg-tilting" : ""}`}>
          <div className="lg-front">{children}</div>
          {shown && <div className="lg-back" aria-hidden={!on}><LegendFace d={legend} /></div>}
        </div>
      </div>
      {burst > 0 && (
        <span key={burst} aria-hidden className="lg-burst pointer-events-none absolute inset-0">
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} style={{ ["--a" as string]: `${i * 30}deg`, background: i % 3 ? undefined : "#fff" }} />
          ))}
        </span>
      )}
    </Link>
  );
}

/** Cara Leyenda: negro y oro holográfico, media 99 en todo. */
function LegendFace({ d }: { d: LegendData }) {
  return (
    <div className="relative w-full" style={{ aspectRatio: "0.72" }}>
      <div className="absolute inset-0 bg-[linear-gradient(160deg,#fff3c4,#D5AF32_45%,#7a5a08)]" style={{ clipPath: SHAPE }} />
      <div className="absolute inset-[3px] overflow-hidden bg-[radial-gradient(circle_at_50%_25%,#3a2c06_0%,#141005_55%,#080808_100%)]" style={{ clipPath: SHAPE }}>
        {/* Rayos de fondo */}
        <span aria-hidden className="absolute inset-0 bg-[repeating-conic-gradient(from_0deg_at_50%_30%,rgba(213,175,50,0.16)_0deg_6deg,transparent_6deg_18deg)]" />
        <span aria-hidden className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0_68%,rgba(213,175,50,0.85)_68%_76%,rgba(255,246,208,0.9)_76%_77.5%,transparent_77.5%)] [mask-image:linear-gradient(to_bottom,black_0%,black_45%,transparent_58%)]" />

        <div className="absolute left-[8%] top-[8%] z-10 flex flex-col items-center leading-none text-dorado">
          <span className="sport text-[1.6rem] font-black drop-shadow-[0_2px_0_#000] sm:text-3xl">99</span>
          <span className="sport mt-0.5 text-[10px] font-black sm:text-[11px]">{d.position}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/escudo.png" alt="" className="mt-1 w-[18px] drop-shadow sm:w-5" />
        </div>
        <div className="absolute right-[7%] top-[9%] z-10 rotate-6 rounded bg-dorado px-1 text-[9px] font-black uppercase tracking-wider text-negro shadow sm:text-[10px]">⚡ Leyenda</div>

        <div className={`absolute top-[5%] flex h-[53%] items-end justify-center ${d.photo ? "left-[24%] right-[7%]" : "inset-x-0"}`}>
          {d.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.photo} alt="" className="h-full w-full object-cover object-top [filter:sepia(0.35)_saturate(1.2)_contrast(1.05)] [mask-image:linear-gradient(to_bottom,black_70%,transparent)]" />
          ) : (
            <span className="mb-[6%] drop-shadow-[0_0_14px_rgba(213,175,50,0.6)]"><Jersey number={d.number} goalkeeper size={74} /></span>
          )}
        </div>

        <div className="absolute inset-x-[6%] top-[57%] text-center text-dorado">
          <div className="sport truncate text-[0.95rem] font-black leading-none sm:text-lg">{d.name}</div>
          <div className="mx-auto mt-[3%] h-px w-[80%] bg-dorado/40" />
        </div>
        <div className="absolute inset-x-[14%] top-[66%] grid grid-cols-2 gap-x-2 text-[#f6e7b0]">
          {[d.stats.slice(0, 3), d.stats.slice(3)].map((col, i) => (
            <div key={i} className={i === 0 ? "border-r border-dorado/30 pr-[6%]" : "pl-[2%]"}>
              {col.map((s) => (
                <div key={s.short} className="flex items-baseline justify-center gap-1 leading-tight" title={s.long}>
                  <span className="sport text-[0.8rem] font-black tabular-nums sm:text-sm">99</span>
                  <span className="text-[9px] font-bold opacity-75 sm:text-[10px]">{s.short}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        {/* Brillo holográfico: se mueve solo y con el dedo o al inclinar el móvil */}
        <span aria-hidden className="lg-holo absolute inset-0" />
      </div>
    </div>
  );
}
