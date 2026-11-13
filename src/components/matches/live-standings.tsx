"use client";
import { useCallback, useEffect, useRef } from "react";
import { Play } from "lucide-react";

const KEY = "rv-tabla-vista";

/**
 * Clasificación viva: la primera vez que se ve una jornada nueva, las filas salen
 * en el puesto que tenían antes y se recolocan solas (las que suben en verde, las
 * que bajan en rojo). `target`: id de la tabla. `round`: marca de la jornada.
 */
export function LiveStandings({ target, round }: { target: string; round: string }) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const play = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const table = document.getElementById(target);
    if (!table) return;
    const rows = [...table.querySelectorAll<HTMLTableRowElement>("tbody tr[data-move]")];
    if (!rows.some((r) => Number(r.dataset.move))) return;
    const h = rows[0].getBoundingClientRect().height;
    table.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    // 1 · Cada fila, en su puesto de antes (subir n puestos = antes estaba n filas más abajo)
    for (const r of rows) {
      const m = Number(r.dataset.move) || 0;
      r.classList.remove("tl-up", "tl-down");
      r.style.animation = "none";
      r.style.transition = "none";
      r.style.transform = m ? `translateY(${m * h}px)` : "";
      r.style.position = "relative";
      r.style.zIndex = m > 0 ? "2" : m < 0 ? "1" : "";
    }
    void table.offsetHeight;
    // 2 · Y se recolocan, primero las que más se mueven
    const order = [...rows].sort((a, b) => Math.abs(Number(b.dataset.move)) - Math.abs(Number(a.dataset.move)));
    order.forEach((r, i) => {
      const m = Number(r.dataset.move) || 0;
      if (!m) return;
      timers.current.push(setTimeout(() => {
        r.style.transition = "transform 0.9s cubic-bezier(0.34, 1.3, 0.64, 1)";
        r.style.transform = "";
        r.classList.add(m > 0 ? "tl-up" : "tl-down");
      }, 500 + i * 140));
    });
    timers.current.push(setTimeout(() => {
      for (const r of rows) { r.style.zIndex = ""; r.style.transition = ""; }
    }, 500 + order.length * 140 + 1000));
  }, [target]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let last = "";
    try { last = localStorage.getItem(KEY) ?? ""; } catch {}
    if (last === round) return;
    try { localStorage.setItem(KEY, round); } catch {}
    const t = setTimeout(play, 350);
    return () => { clearTimeout(t); timers.current.forEach(clearTimeout); };
  }, [round, play]);

  return (
    <button type="button" onClick={play} className="inline-flex items-center gap-1 font-semibold text-rojo hover:underline">
      <Play size={12} className="fill-rojo" /> Ver cómo se movió
    </button>
  );
}
