"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Home, Ticket, ShoppingBag, Users, ScrollText, Wallet, Shirt, CalendarDays, LogOut, Settings, Newspaper } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { Avatar } from "@/components/avatar";
import { CrestEgg } from "@/components/easter-eggs";

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; soon?: boolean; mobile?: boolean; also?: string[] };

const ICONS = { Home, Ticket, ShoppingBag, Users, ScrollText, Wallet, Shirt, CalendarDays, Settings, Newspaper };

function isActive(path: string, href: string, also: string[] = []) {
  const under = (h: string) => path === h || path.startsWith(h + "/");
  return href === "/" ? path === "/" : under(href) || also.some(under);
}

export function Sidebar({ items, name, role, version, avatar }: { items: NavItem[]; name: string; role: string; version?: string; avatar?: string | null }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-negro text-white lg:flex">
      <Link href="/" className="franja relative flex items-center gap-3 overflow-hidden border-b border-white/10 px-5 py-6">
        <CrestEgg width={44} height={52} />
        <div className="relative leading-none">
          <div className="sport text-2xl font-black">Rayo</div>
          <div className="sport text-sm font-bold tracking-[0.2em] text-dorado">Vallecañas</div>
        </div>
      </Link>
      <nav aria-label="Menú principal" className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((it) => {
          const Icon = ICONS[it.icon];
          if (it.soon)
            return (
              <div key={it.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/30">
                <Icon size={18} /> {it.label}
                <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase">Pronto</span>
              </div>
            );
          const active = isActive(path, it.href, it.also);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              key={it.href}
              href={it.href}
              prefetch
              data-tour={it.href}
              className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-[15px] font-semibold transition ${
                active ? "bg-rojo text-white shadow-[0_6px_16px_-8px_rgba(210,13,23,0.9)]" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {active && <span aria-hidden className="absolute -right-2 top-0 h-full w-5 -skew-x-[20deg] bg-dorado/80" />}
              <Icon size={18} className="transition group-hover:scale-110" /> {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <Link href="/perfil" prefetch data-tour="/perfil" className="-m-1 flex items-center gap-3 rounded-xl p-1 hover:bg-white/10" title="Mi perfil">
          <Avatar name={name} url={avatar} size={40} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{name}</span>
            <span className="block text-xs text-dorado">{role}</span>
          </span>
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <form action={signOut}>
            <button className="flex items-center gap-2 text-xs text-white/60 hover:text-white">
              <LogOut size={14} /> Cerrar sesión
            </button>
          </form>
          {version && <Link href="/novedades" className="text-xs text-white/60 hover:text-dorado">v{version}</Link>}
        </div>
      </div>
    </aside>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  // Caben 6 botones: si sobran, se quitan los del medio y «Gestión» (el último) se queda siempre
  const all = items.filter((i) => !i.soon && i.mobile !== false);
  const visible = all.length > 6 ? [...all.slice(0, 5), all[all.length - 1]] : all;
  const activeIdx = visible.findIndex((it) => isActive(path, it.href, it.also));
  const ref = useRef<HTMLElement>(null);
  useAnchorToScreenBottom(ref);
  return (
    <nav
      ref={ref}
      aria-label="Menú principal"
      className="fixed inset-x-0 bottom-0 z-30 grid border-t border-white/10 bg-negro/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}
    >
      {/* Marcador rojo: se desliza de una pestaña a otra */}
      <span
        aria-hidden
        className={`nav-slider pointer-events-none absolute left-0 top-0 flex flex-col items-center ${activeIdx < 0 ? "opacity-0" : ""}`}
        style={{ width: `${100 / visible.length}%`, transform: `translateX(${Math.max(activeIdx, 0) * 100}%)` }}
      >
        <span className="h-[3px] w-10 -skew-x-[25deg] rounded-b bg-dorado" />
        <span className="mt-[7px] h-8 w-12 -skew-x-[10deg] rounded-xl bg-rojo shadow-[0_6px_18px_-4px_rgba(210,13,23,0.9)]" />
      </span>
      {visible.map((it) => {
        const Icon = ICONS[it.icon];
        const active = isActive(path, it.href, it.also);
        return (
          <Link
            key={it.href}
            href={it.href}
            prefetch
            data-tour={it.href}
            aria-current={active ? "page" : undefined}
            className={`nav-tab relative flex min-w-0 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-semibold transition-colors duration-200 ${active ? "text-white" : "text-white/50"}`}
          >
            <span className="nav-ico flex h-8 w-12 items-center justify-center">
              <Icon key={active ? "on" : "off"} size={20} className={active ? "nav-ico-on" : ""} />
            </span>
            <span className="max-w-full truncate px-1">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Campos donde se escribe con el teclado del móvil (no casillas ni botones). */
function isTyping(el: Element | null) {
  if (!el) return false;
  if ((el as HTMLElement).isContentEditable || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  return el instanceof HTMLInputElement && !/^(checkbox|radio|button|submit|reset|range|file|color|image)$/.test(el.type);
}

/**
 * Mantiene la barra inferior pegada al borde de abajo de la pantalla (v4.12.1).
 * En el iPhone (Safari y la app instalada) una barra «fixed» se puede quedar flotando más arriba:
 * con el teclado abierto, justo después de cerrarlo o mientras la barra de Safari se encoge.
 * Aquí se mide dónde termina de verdad lo visible (visualViewport) y se corrige el hueco.
 * Mientras se escribe con el teclado la barra se esconde, como en las apps nativas.
 */
function useAnchorToScreenBottom(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const nav = ref.current;
    const vv = window.visualViewport;
    if (!nav || !vv) return;
    let shift = 0;
    let raf = 0;
    const place = () => {
      raf = 0;
      const keyboard = isTyping(document.activeElement) && window.innerHeight - vv.height > 120;
      if (keyboard !== (nav.dataset.keyboard === "1")) nav.dataset.keyboard = keyboard ? "1" : "";
      // Con zoom de pellizco o con el teclado no se toca: la barra va escondida o sigue a la página
      let next = 0;
      if (!keyboard && vv.scale < 1.01) {
        const natural = nav.getBoundingClientRect().bottom - shift;
        const gap = Math.round(vv.offsetTop + vv.height - natural);
        if (Math.abs(gap) >= 1 && Math.abs(gap) < 400) next = gap;
      }
      if (next !== shift) {
        shift = next;
        nav.style.translate = shift ? `0 ${shift}px` : "";
      }
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(place); };
    // Al cerrar el teclado iOS tarda en recolocar lo fijo: se vuelve a medir cuando termina
    const settle = () => {
      schedule();
      setTimeout(schedule, 120);
      setTimeout(schedule, 400);
    };
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", settle);
    document.addEventListener("focusin", settle);
    document.addEventListener("focusout", settle);
    document.addEventListener("visibilitychange", settle);
    window.addEventListener("pageshow", settle);
    place();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", settle);
      document.removeEventListener("focusin", settle);
      document.removeEventListener("focusout", settle);
      document.removeEventListener("visibilitychange", settle);
      window.removeEventListener("pageshow", settle);
    };
  }, [ref]);
}
