"use client";
import { useEffect, useState } from "react";

/** Cuenta atrás hasta el partido: días, horas, minutos y segundos, como un videomarcador. */
export function Countdown({ to }: { to: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, target - (now ?? target));
  if (now != null && left === 0) return <p className="sport text-center text-lg font-black text-dorado">¡A jugar! ⚽</p>;
  const parts: [string, number][] = [
    ["días", Math.floor(left / 864e5)],
    ["h", Math.floor(left / 36e5) % 24],
    ["min", Math.floor(left / 6e4) % 60],
    ["seg", Math.floor(left / 1e3) % 60],
  ];
  return (
    <div className="flex justify-center gap-1.5" aria-label="Cuenta atrás para el partido" role="timer">
      {parts.map(([k, v]) => (
        <div key={k} className="min-w-12 rounded-lg bg-black/50 px-2 py-1 text-center ring-1 ring-white/10">
          <div className="sport text-2xl font-black leading-none tabular-nums text-dorado" suppressHydrationWarning>{now == null ? "–" : String(v).padStart(2, "0")}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">{k}</div>
        </div>
      ))}
    </div>
  );
}
