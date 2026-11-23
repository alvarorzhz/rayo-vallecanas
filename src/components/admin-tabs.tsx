"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Una página dentro de un cajón del despacho. `prefix`: también cuenta lo que cuelga de ella (Auditoría → Accesos, Sesiones). */
export type DeskPage = { href: string; label: string; prefix?: boolean };
/** Cajón del despacho: una o varias páginas que se eligen con un selector. */
export type DeskDrawer = { key: string; pages: DeskPage[] };

const isOn = (path: string, p: DeskPage) => path === p.href || (!!p.prefix && path.startsWith(p.href + "/"));

/**
 * 4.30.0 · Sin tira de pestañas: en la portada de cada cajón sale «← Despacho» para volver a la mesa y,
 * si el cajón tiene varias páginas (Equipo, Control), un selector para pasar de una a otra.
 * En la mesa y en las fichas de detalle (que ya llevan su propio «←») no sale nada.
 */
export function DeskNav({ drawers }: { drawers: DeskDrawer[] }) {
  const path = usePathname();
  const drawer = drawers.find((d) => d.pages.some((p) => isOn(path, p)));
  if (!drawer) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-3">
      <Link href="/admin" prefetch
        className="group inline-flex items-center gap-1.5 rounded-full bg-white py-1 pl-2 pr-3 text-[13px] font-bold text-negro/70 ring-1 ring-black/10 transition hover:text-rojo hover:ring-rojo/40 active:scale-95">
        <span aria-hidden className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span> Despacho
      </Link>
      {drawer.pages.length > 1 && (
        <nav aria-label="Apartados" className="flex w-full gap-1 rounded-xl bg-black/5 p-1 sm:w-max">
          {drawer.pages.map((p) => {
            const on = isOn(path, p);
            return (
              <Link key={p.href} href={p.href} prefetch replace scroll={false} aria-current={on ? "page" : undefined}
                className={`flex-1 whitespace-nowrap rounded-lg px-4 py-1.5 text-center text-sm font-bold transition sm:flex-none ${
                  on ? "tab-on bg-negro text-white shadow" : "text-negro/65 hover:text-rojo"
                }`}>
                {p.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
