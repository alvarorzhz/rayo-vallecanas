"use client";
import { useState } from "react";

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const short = (c: number) => {
  const v = Math.abs(c / 100);
  return v >= 1000 ? `${(c / 100000).toFixed(1).replace(".", ",")} mil €` : eur.format(c / 100);
};

/** Escala "bonita" para el eje: 0, 50, 100… */
function niceMax(v: number) {
  if (v <= 0) return 10000;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= v) return m * exp;
  return 10 * exp;
}

export type MonthPoint = { label: string; long: string; income: number; expense: number; balance: number | null };

/**
 * Ingresos (hacia arriba, verde) y gastos (hacia abajo, rojo) por mes, sobre un mismo eje en euros.
 * La dirección de la barra distingue el tipo además del color.
 */
export function MonthlyBars({ data }: { data: MonthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 260, L = 56, R = 8, T = 12, B = 28;
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.income, d.expense)), 1));
  const plotH = H - T - B;
  const zero = T + plotH / 2;
  const y = (c: number) => (c / max) * (plotH / 2);
  const step = (W - L - R) / data.length;
  const bw = Math.min(26, step * 0.5);
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-negro/70">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-green-600" /> Ingresos (hacia arriba)</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-rojo" /> Gastos (hacia abajo)</span>
      </div>
      <div className="-mx-1 overflow-x-auto px-1" tabIndex={0} role="region" aria-label="Gráfico (desliza para ver más)">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[600px]" role="img" aria-label="Ingresos y gastos por mes" onMouseLeave={() => setHover(null)}>
        {[-1, -0.5, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={zero - t * (plotH / 2)} y2={zero - t * (plotH / 2)} stroke="currentColor" className="text-black/[0.06]" />
            <text x={L - 6} y={zero - t * (plotH / 2) + 3} textAnchor="end" className="fill-negro/40 text-[10px]">{short(Math.abs(t) * max)}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={zero} y2={zero} stroke="currentColor" className="text-black/30" />
        <text x={L - 6} y={zero + 3} textAnchor="end" className="fill-negro/40 text-[10px]">0 €</text>
        {data.map((d, i) => {
          const cx = L + step * i + step / 2;
          const active = hover === null || hover === i;
          return (
            <g key={d.label} opacity={active ? 1 : 0.35}>
              {d.income > 0 && (
                <path d={barUp(cx - bw / 2, zero - 1, bw, Math.max(2, y(d.income)))} className="fill-green-600" />
              )}
              {d.expense > 0 && (
                <path d={barDown(cx - bw / 2, zero + 1, bw, Math.max(2, y(d.expense)))} className="fill-rojo" />
              )}
              <text x={cx} y={H - 8} textAnchor="middle" className="fill-negro/50 text-[10px] uppercase">{d.label}</text>
              <rect x={L + step * i} y={T} width={step} height={plotH} fill="transparent"
                onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
      </div>
      {h && (
        <div className="pointer-events-none absolute right-2 top-8 rounded-xl bg-negro px-3 py-2 text-xs text-white shadow-lg">
          <div className="mb-1 font-bold capitalize">{h.long}</div>
          <div className="flex justify-between gap-4"><span className="text-white/70">Ingresos</span><b className="tabular-nums">{eur2.format(h.income / 100)}</b></div>
          <div className="flex justify-between gap-4"><span className="text-white/70">Gastos</span><b className="tabular-nums">{eur2.format(h.expense / 100)}</b></div>
          <div className="flex justify-between gap-4 border-t border-white/20 pt-1"><span className="text-white/70">Resultado</span><b className="tabular-nums">{eur2.format((h.income - h.expense) / 100)}</b></div>
        </div>
      )}
    </div>
  );
}

/** Saldo al final de cada mes (una sola serie, un solo eje). */
export function BalanceLine({ data }: { data: MonthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = data.map((d, i) => ({ ...d, i })).filter((d) => d.balance !== null) as (MonthPoint & { i: number; balance: number })[];
  const W = 720, H = 180, L = 56, R = 8, T = 14, B = 28;
  const step = (W - L - R) / data.length;
  if (!pts.length) return <p className="text-sm text-negro/65">El saldo empieza a contar desde la fecha del saldo inicial.</p>;
  const vals = pts.map((p) => p.balance);
  const lo = Math.min(0, ...vals), hi = Math.max(...vals, 1);
  const top = niceMax(hi), bottom = lo < 0 ? -niceMax(-lo) : 0;
  const y = (c: number) => T + (1 - (c - bottom) / (top - bottom)) * (H - T - B);
  const x = (i: number) => L + step * i + step / 2;
  const path = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i)},${y(p.balance)}`).join(" ");
  const h = hover !== null ? pts.find((p) => p.i === hover) : null;

  return (
    <div className="relative">
      <div className="-mx-1 overflow-x-auto px-1" tabIndex={0} role="region" aria-label="Gráfico (desliza para ver más)">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[600px]" role="img" aria-label="Saldo a final de cada mes" onMouseLeave={() => setHover(null)}>
        {[bottom, (bottom + top) / 2, top].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="currentColor" className={v === 0 ? "text-black/30" : "text-black/[0.06]"} />
            <text x={L - 6} y={y(v) + 3} textAnchor="end" className="fill-negro/40 text-[10px]">{short(v)}</text>
          </g>
        ))}
        <path d={path} fill="none" strokeWidth={2} strokeLinejoin="round" className="stroke-negro" />
        {h && <line x1={x(h.i)} x2={x(h.i)} y1={T} y2={H - B} stroke="currentColor" className="text-black/20" strokeDasharray="3 3" />}
        {pts.map((p) => (
          <circle key={p.i} cx={x(p.i)} cy={y(p.balance)} r={hover === p.i ? 5 : 3.5} strokeWidth={2}
            className={`stroke-white ${p.balance < 0 ? "fill-rojo" : "fill-dorado"}`} />
        ))}
        {data.map((d, i) => (
          <g key={d.label}>
            <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-negro/50 text-[10px] uppercase">{d.label}</text>
            <rect x={L + step * i} y={T} width={step} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
          </g>
        ))}
      </svg>
      </div>
      {h && (
        <div className="pointer-events-none absolute right-2 top-2 rounded-xl bg-negro px-3 py-2 text-xs text-white shadow-lg">
          <div className="font-bold capitalize">Saldo a final de {h.long}</div>
          <b className="tabular-nums">{eur2.format(h.balance / 100)}</b>
        </div>
      )}
    </div>
  );
}

function barUp(x: number, base: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + w - r} Q${x + w},${base - h} ${x + w},${base - h + r} V${base} Z`;
}
function barDown(x: number, base: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${base} V${base + h - r} Q${x},${base + h} ${x + r},${base + h} H${x + w - r} Q${x + w},${base + h} ${x + w},${base + h - r} V${base} Z`;
}
