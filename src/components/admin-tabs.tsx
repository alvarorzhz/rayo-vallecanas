"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, DatabaseBackup, Handshake, IdCard, ScrollText, Users } from "lucide-react";

const ICONS = { Users, IdCard, BellRing, Handshake, ScrollText, DatabaseBackup };
export type AdminTab = { href: string; label: string; icon: keyof typeof ICONS };

export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Gestión" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max gap-2">
        {tabs.map((t) => {
          const Icon = ICONS[t.icon];
          const active = path === t.href || path.startsWith(t.href + "/");
          return (
            <Link key={t.href} href={t.href} prefetch
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition active:scale-95 ${
                active ? "tab-on bg-negro text-white shadow-[0_8px_18px_-10px_rgba(0,0,0,0.8)]" : "bg-white text-negro/70 ring-1 ring-black/10 hover:text-rojo hover:ring-rojo/30"
              }`}>
              <Icon size={16} className={active ? "text-dorado" : ""} /> {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
