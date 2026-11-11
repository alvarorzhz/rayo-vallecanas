"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, BriefcaseBusiness, DatabaseBackup, Handshake, IdCard, ScrollText, Users } from "lucide-react";

const ICONS = { BriefcaseBusiness, Users, IdCard, BellRing, Handshake, ScrollText, DatabaseBackup };
export type AdminTab = { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean };

/** Pestañas de archivador del despacho: la activa sobresale y se une a la hoja. */
export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const path = usePathname();
  const nav = useRef<HTMLElement>(null);
  // En el móvil no caben todas: la pestaña abierta se desliza a la vista (sin mover la página)
  useEffect(() => {
    const box = nav.current;
    const on = box?.querySelector<HTMLElement>("[aria-current]");
    if (box && on) box.scrollTo({ left: on.offsetLeft - (box.clientWidth - on.offsetWidth) / 2, behavior: "smooth" });
  }, [path]);
  return (
    <nav ref={nav} aria-label="Gestión" className="-mx-4 mb-6 overflow-x-auto overflow-y-hidden overscroll-x-contain px-4 sm:mx-0 sm:px-0">
      <div className="folder-tabs flex w-max min-w-full items-end gap-1">
        {tabs.map((t) => {
          const Icon = ICONS[t.icon];
          const active = t.exact ? path === t.href : path === t.href || path.startsWith(t.href + "/");
          return (
            <Link key={t.href} href={t.href} prefetch
              aria-current={active ? "page" : undefined}
              className={`folder-tab flex items-center gap-1.5 whitespace-nowrap px-3 pb-2.5 pt-2 text-sm font-bold ${
                active ? "tab-on bg-negro text-white" : "bg-white text-negro/70 ring-1 ring-black/10 hover:text-rojo"
              }`}>
              <Icon size={16} className={active ? "text-dorado" : ""} /> {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
