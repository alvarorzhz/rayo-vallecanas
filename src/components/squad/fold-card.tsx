import { ChevronDown } from "lucide-react";

/** Apartado plegable de la ficha del jugador: entra cerrado y se abre tocando la cabecera. */
export function FoldCard({ title, meta, open, className = "", children }: {
  title: React.ReactNode; meta?: React.ReactNode; open?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <details className={`card group ${className}`} open={open || undefined}>
      <summary className="-m-1 flex cursor-pointer list-none items-center gap-2 rounded-xl p-1 select-none [&::-webkit-details-marker]:hidden">
        <h2 className="flex min-w-0 flex-1 items-center gap-2">{title}</h2>
        {meta && <span className="shrink-0">{meta}</span>}
        <ChevronDown aria-hidden size={20} className="shrink-0 text-negro/40 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
