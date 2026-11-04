"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Ticket, ShoppingBag, Users, ScrollText, Wallet, Shirt, CalendarDays, LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; soon?: boolean; mobile?: boolean };

const ICONS = { Home, Ticket, ShoppingBag, Users, ScrollText, Wallet, Shirt, CalendarDays };

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

export function Sidebar({ items, name, role }: { items: NavItem[]; name: string; role: string }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-negro text-white lg:flex">
      <Link href="/" className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/escudo.png" alt="" width={40} height={47} />
        <div className="leading-tight">
          <div className="font-black tracking-tight">RAYO</div>
          <div className="text-xs font-semibold tracking-widest text-dorado">VALLECAÑAS</div>
        </div>
      </Link>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((it) => {
          const Icon = ICONS[it.icon];
          if (it.soon)
            return (
              <div key={it.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/30">
                <Icon size={18} /> {it.label}
                <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase">Pronto</span>
              </div>
            );
          const active = isActive(path, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active ? "bg-rojo text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={18} /> {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="truncate text-sm font-semibold">{name}</div>
        <div className="text-xs text-dorado">{role}</div>
        <form action={signOut} className="mt-3">
          <button className="flex items-center gap-2 text-xs text-white/60 hover:text-white">
            <LogOut size={14} /> Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const visible = items.filter((i) => !i.soon && i.mobile !== false).slice(0, 5);
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid border-t border-white/10 bg-negro pb-[env(safe-area-inset-bottom)] lg:hidden"
      style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}
    >
      {visible.map((it) => {
        const Icon = ICONS[it.icon];
        const active = isActive(path, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${active ? "text-white" : "text-white/50"}`}
          >
            <span className={`rounded-full px-3 py-0.5 ${active ? "bg-rojo" : ""}`}>
              <Icon size={20} />
            </span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
