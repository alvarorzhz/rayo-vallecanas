import { CONDITIONS, CONDITION_BAR, CONDITION_LABEL, type Tally } from "@/lib/material";

/** Barra de estado de un artículo: verde las nuevas, dorado las usadas, rojo las rotas. */
export function StockBar({ t, className = "h-2" }: { t: Tally; className?: string }) {
  return (
    <div className={`stock-bar ${className}`} role="img"
      aria-label={CONDITIONS.filter((c) => t[c]).map((c) => `${t[c]} ${CONDITION_LABEL[c].toLowerCase()}${t[c] === 1 ? "" : "s"}`).join(", ") || "Sin piezas"}>
      {t.total > 0 && (
        <span className="stock-fill">
          {CONDITIONS.map((c) => t[c] > 0 && <span key={c} className={CONDITION_BAR[c]} style={{ width: `${(t[c] / t.total) * 100}%` }} />)}
        </span>
      )}
    </div>
  );
}

/** Leyenda corta debajo de la barra: «5 nuevas · 3 usadas · 1 rota». */
export function StockLegend({ t, female = true }: { t: Tally; female?: boolean }) {
  const word = { new: female ? "nueva" : "nuevo", used: female ? "usada" : "usado", broken: female ? "rota" : "roto" } as const;
  const dot = { new: "bg-green-600", used: "bg-dorado", broken: "bg-rojo" } as const;
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-negro/70">
      {CONDITIONS.filter((c) => t[c] > 0).map((c) => (
        <span key={c} className="inline-flex items-center gap-1">
          <span aria-hidden className={`h-2 w-2 rounded-full ${dot[c]}`} />
          <b className="tabular-nums">{t[c]}</b> {word[c]}{t[c] === 1 ? "" : "s"}
        </span>
      ))}
    </p>
  );
}
