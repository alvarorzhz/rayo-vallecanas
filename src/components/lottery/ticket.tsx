/**
 * Piezas del «boleto» de Sorteos (el mismo dibujo que las campañas de la lista): la matriz negra
 * con la franja y la línea de corte con sus dos muescas.
 */

/** Línea de corte del boleto. `notch` es el color del fondo que asoma por las muescas. */
export function TicketCut({ notch = "bg-gris" }: { notch?: string }) {
  return (
    <div aria-hidden className="relative h-0 border-t-2 border-dashed border-black/15">
      <span className={`absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full ${notch} ring-1 ring-inset ring-black/[0.06]`} />
      <span className={`absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full ${notch} ring-1 ring-inset ring-black/[0.06]`} />
    </div>
  );
}

/** Matriz negra del boleto: una línea dorada arriba, el título y lo que se le pase debajo. */
export function TicketHead({ eyebrow, title, sub, aside, children }: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  aside?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden bg-negro p-4 text-white sm:p-5">
      <div aria-hidden className="franja pointer-events-none absolute inset-0 opacity-80" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-dorado">{eyebrow}</div>
          <div className="sport mt-0.5 truncate text-2xl leading-tight font-black">{title}</div>
          {sub && <div className="truncate text-xs text-white/60">{sub}</div>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {children && <div className="relative mt-3">{children}</div>}
    </div>
  );
}

/** Recuadro discontinuo dorado con una etiqueta y un número grande (como el «NÚMERO» de la lista). */
export function TicketNumber({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`inline-flex max-w-full items-baseline gap-2 rounded-lg border border-dashed border-dorado/60 bg-black/50 px-3 py-1.5 ${className}`}>
      <span className="shrink-0 text-[10px] font-bold tracking-widest text-dorado">{label}</span>
      <span className="min-w-0 font-mono text-2xl leading-none font-black break-words">{children}</span>
    </div>
  );
}

/** Tarjeta blanca con la sombra de los boletos. */
export const TICKET_CARD = "overflow-hidden rounded-2xl bg-white shadow-[0_1px_1px_rgba(0,0,0,0.03),0_10px_30px_-14px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06]";
