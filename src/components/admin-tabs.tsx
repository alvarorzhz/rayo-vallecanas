"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, DatabaseBackup, IdCard, ScrollText, Users } from "lucide-react";

const ICONS = { Users, IdCard, BellRing, ScrollText, DatabaseBackup };
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
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition ${
                active ? "bg-negro text-white shadow" : "bg-white text-negro/70 ring-1 ring-black/10 hover:text-rojo"
              }`}>
              <Icon size={16} /> {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
