"use client";
import { useOptimistic, useTransition } from "react";
import { toggleWish } from "@/app/(app)/birthday-actions";
import { Jersey } from "@/components/squad/jersey";

export type BirthdayToday = {
  playerId: string;
  name: string;
  number: number | null;
  photo: string | null;
  gk: boolean;
  isMe: boolean;
  /** Quiénes le han felicitado (nombres de pila). */
  wishers: string[];
  wished: boolean;
};

const BALLOONS = [
  { left: "6%", color: "#D20D17", delay: "0s" },
  { left: "22%", color: "#D5AF32", delay: "2.2s" },
  { left: "78%", color: "#ffffff", delay: "1.1s" },
  { left: "92%", color: "#D20D17", delay: "3.4s" },
];

/** Tarjeta de Inicio el día del cumpleaños: felicitar con un toque y ver quién ya lo ha hecho. */
export function BirthdayCard({ b, year }: { b: BirthdayToday; year: number }) {
  const [pending, start] = useTransition();
  const [state, setState] = useOptimistic({ wished: b.wished, n: b.wishers.length }, (_, next: { wished: boolean; n: number }) => next);
  const others = b.wishers.length;
  const names = b.wishers.slice(0, 4).join(", ") + (others > 4 ? ` y ${others - 4} más` : "");
  return (
    <section aria-label={`Cumpleaños de ${b.name}`} className="relative mb-6 overflow-hidden rounded-2xl bg-negro p-4 text-white shadow-lg ring-1 ring-dorado/30">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(213,175,50,0.28),transparent_60%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {BALLOONS.map((x, i) => (
          <span key={i} className="bday-balloon" style={{ left: x.left, animationDelay: x.delay }}>
            <svg width="22" height="34" viewBox="0 0 22 34"><ellipse cx="11" cy="11" rx="10" ry="11" fill={x.color} opacity="0.85" /><path d="M11 22 q-2 5 1 12" stroke="#ffffff80" fill="none" /></svg>
          </span>
        ))}
      </div>
      <div className="relative flex items-center gap-4">
        <span className="relative shrink-0">
          {b.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.photo} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-dorado" />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-full bg-white/10 ring-2 ring-dorado"><Jersey number={b.number} goalkeeper={b.gk} size={40} /></span>
          )}
          <span aria-hidden className="absolute -right-1 -top-2 text-2xl">🎂</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="sport text-xs font-black tracking-[0.2em] text-dorado">{b.isMe ? "HOY ES TU DÍA" : "HOY ES SU CUMPLE"}</p>
          <p className="sport text-2xl font-black leading-tight">{b.isMe ? `¡Feliz cumpleaños, ${b.name}!` : `¡Felicidades, ${b.name}!`}</p>
          <p className="text-sm text-white/75">
            {b.isMe
              ? others ? `Te han felicitado ${others}: ${names}. ⚡` : "Todo el Rayo te desea un gran día. ⚡"
              : state.n ? `${state.n === 1 ? "Le ha felicitado" : "Le han felicitado"} ${state.n}${state.wished ? " (tú también)" : ""}.` : "Sé el primero en felicitarle."}
          </p>
        </div>
        {!b.isMe && (
          <button type="button" disabled={pending} aria-pressed={state.wished}
            onClick={() => start(async () => {
              setState({ wished: !state.wished, n: state.n + (state.wished ? -1 : 1) });
              await toggleWish(b.playerId, year);
            })}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm font-black transition active:scale-95 ${state.wished ? "bg-dorado text-negro" : "bg-rojo text-white hover:bg-rojo-oscuro"}`}>
            {state.wished ? "🎉 ¡Hecho!" : "🎉 Felicitar"}
          </button>
        )}
      </div>
    </section>
  );
}
