"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Cuenta atrás grande del Matchday: cada cifra cae como en un videomarcador al cambiar. */
export function MatchdayCountdown({ to }: { to: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, target - (now ?? target));
  if (now != null && left === 0)
    return <p className="sport md-kickoff text-center text-3xl font-black text-dorado sm:text-4xl">¡Rueda el balón! ⚽</p>;
  const days = Math.floor(left / 864e5);
  const parts: [string, number][] = [
    ...(days > 0 ? [["días", days] as [string, number]] : []),
    ["horas", Math.floor(left / 36e5) % 24],
    ["min", Math.floor(left / 6e4) % 60],
    ["seg", Math.floor(left / 1e3) % 60],
  ];
  return (
    <div className="flex items-end justify-center gap-1.5 sm:gap-2.5" role="timer" aria-label="Cuenta atrás para el pitido inicial">
      {parts.map(([k, v], i) => (
        <div key={k} className="flex items-end gap-1.5 sm:gap-2.5">
          {i > 0 && <span aria-hidden className="sport pb-6 text-2xl font-black text-white/30 sm:text-4xl">:</span>}
          <div className="text-center">
            <div className="relative h-14 w-14 overflow-hidden rounded-xl bg-black/60 ring-1 ring-dorado/30 sm:h-20 sm:w-20">
              <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
              <span key={now == null ? "x" : v} className="md-tick sport absolute inset-0 flex items-center justify-center text-3xl font-black tabular-nums text-dorado sm:text-5xl" suppressHydrationWarning>
                {now == null ? "–" : String(v).padStart(2, "0")}
              </span>
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/70 sm:text-xs">{k}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Pseudoaleatorio estable (mismo resultado en cada render, sin Math.random)
const rnd = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const COLORS = ["#D20D17", "#D5AF32", "#FFFFFF", "#D20D17", "#D5AF32"];

/** Confeti rojo, dorado y blanco para celebrar una victoria. Cae dos veces y se va. */
export function Confetti({ pieces = 56 }: { pieces?: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    // Espera a que se cierre el tutorial de bienvenida si está abierto
    let t: ReturnType<typeof setTimeout>;
    const go = () => {
      if (document.getElementById("rv-tour")) t = setTimeout(go, 800);
      else setOn(true);
    };
    t = setTimeout(go, 500);
    return () => clearTimeout(t);
  }, []);
  if (!on) return null;
  return (
    <div aria-hidden className="md-confetti pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {Array.from({ length: pieces }, (_, i) => (
        <span key={i} style={{
          left: `${rnd(i, 1) * 100}%`,
          background: COLORS[i % COLORS.length],
          width: `${6 + rnd(i, 2) * 6}px`,
          height: `${10 + rnd(i, 3) * 8}px`,
          borderRadius: i % 4 === 0 ? "50%" : "2px",
          animationDelay: `${rnd(i, 4) * 1.6}s`,
          animationDuration: `${2.6 + rnd(i, 5) * 1.8}s`,
          ["--sway" as string]: `${(rnd(i, 6) - 0.5) * 160}px`,
          ["--spin" as string]: `${(rnd(i, 7) > 0.5 ? 1 : -1) * (360 + rnd(i, 8) * 540)}deg`,
        }} />
      ))}
    </div>
  );
}

type Today = { id: string; time: string | null; label: string; final: string | null };

/** Tira «Hoy jugamos» arriba en todas las páginas menos Inicio (allí está la portada). */
export function TodayStrip({ match }: { match: Today }) {
  const path = usePathname();
  if (path === "/") return null;
  return (
    <Link href={`/partidos/${match.id}`} prefetch={false}
      className="md-strip franja group relative flex items-center justify-center gap-2 overflow-hidden bg-rojo px-4 py-1.5 text-white">
      <span aria-hidden className="md-strip-shine" />
      <span className="sport relative flex min-w-0 items-center gap-2 text-sm font-black tracking-wide">
        {match.final ? (
          <><span className="rounded bg-negro px-1.5 text-dorado">Final</span> <span className="truncate">{match.final}</span></>
        ) : (
          <><span className="md-live-dot" aria-hidden /> <span className="text-dorado">Hoy jugamos</span> <span className="truncate">· {match.time ? `${match.time} · ` : ""}{match.label}</span></>
        )}
        <span aria-hidden className="transition group-hover:translate-x-0.5">→</span>
      </span>
    </Link>
  );
}
