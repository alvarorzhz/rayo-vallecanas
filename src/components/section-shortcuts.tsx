import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * 4.31.2 · Accesos de la cabecera de una pestaña (Partidos, Plantilla): el mismo bloque en todas,
 * como mucho 4 baldosas iguales en una fila, con el icono rojo en su cuadrado y la etiqueta debajo.
 * Una baldosa con `menu` abre un desplegable en vez de ir a una página (por ejemplo, Exportar).
 */
export type Shortcut = {
  href?: string;
  icon: LucideIcon;
  label: string;
  /** Número en la esquina (por ejemplo, documentos que caducan). */
  badge?: number;
  /** Contenido del desplegable: sustituye al enlace. */
  menu?: React.ReactNode;
  show?: boolean;
};

export const SHORTCUTS_MAX = 4;

const TILE =
  "group relative flex h-full flex-col items-center justify-center gap-1.5 rounded-2xl bg-white px-0.5 py-2.5 text-center text-[11.5px] font-bold leading-tight max-[380px]:text-[10px] max-[380px]:tracking-tight shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-rojo/40 active:scale-[0.97] sm:text-xs";

function Inner({ icon: Icon, label, badge }: Shortcut) {
  return (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rojo/10 text-rojo transition group-hover:bg-rojo group-hover:text-white">
        <Icon size={20} />
      </span>
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-black text-white ring-2 ring-gris">{badge}</span>
      )}
    </>
  );
}

export function SectionShortcuts({ label, items }: { label: string; items: Shortcut[] }) {
  const shown = items.filter((x) => x.show !== false).slice(0, SHORTCUTS_MAX);
  if (!shown.length) return null;
  return (
    // relative z-20: los hijos de la página animan con transform y el desplegable quedaría detrás de lo siguiente
    <nav aria-label={label} className="relative z-20 mb-6 grid grid-cols-4 gap-2 sm:max-w-lg sm:gap-3">
      {shown.map((x) =>
        x.menu ? (
          <details key={x.label} className="relative open:z-50">
            <summary className={`${TILE} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}><Inner {...x} /></summary>
            <div className="anim-rise absolute right-0 top-full z-40 mt-2 w-64 space-y-1 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/10">{x.menu}</div>
          </details>
        ) : (
          <Link key={x.label} href={x.href!} prefetch className={TILE}><Inner {...x} /></Link>
        ),
      )}
    </nav>
  );
}
