import Link from "next/link";
import { LogOut } from "lucide-react";
import { getSession } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/format";
import { BottomNav, Sidebar, type NavItem } from "@/components/nav";
import { signOut } from "@/app/login/actions";
import { Suspense } from "react";
import { WhatsNew } from "@/components/whats-new";
import { NavProgress } from "@/components/nav-progress";
import { APP_VERSION } from "@/lib/changelog";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const items: NavItem[] = [{ href: "/", label: "Inicio", icon: "Home" }];
  if (s.can("lottery_admin") || s.can("lottery_sell")) items.push({ href: "/loteria", label: "Lotería", icon: "Ticket" });
  if (s.can("lottery_sell", "create")) items.push({ href: "/mis-ventas", label: "Mis ventas", icon: "ShoppingBag" });
  if (s.can("users")) items.push({ href: "/admin/usuarios", label: "Usuarios", icon: "Users" });
  if (s.can("audit")) items.push({ href: "/admin/auditoria", label: "Auditoría", icon: "ScrollText", mobile: false });
  items.push(
    { href: "/finanzas", label: "Finanzas", icon: "Wallet", soon: true },
    { href: "/plantilla", label: "Plantilla", icon: "Shirt", soon: true },
    { href: "/partidos", label: "Partidos", icon: "CalendarDays", soon: true },
  );

  return (
    <div className="flex min-h-dvh">
      <Sidebar items={items} name={s.profile.full_name} role={ROLE_LABEL[s.profile.role] ?? s.profile.role} version={APP_VERSION} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="franja sticky top-0 z-20 flex items-center justify-between bg-negro px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white shadow-lg lg:hidden">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/escudo.png" alt="" width={32} height={38} className="drop-shadow" />
            <span className="sport truncate text-xl font-black">
              Rayo <span className="text-dorado">Vallecañas</span>
            </span>
          </Link>
          <form action={signOut}>
            <button aria-label="Cerrar sesión" className="relative rounded-lg bg-black/30 p-2 text-white/80 hover:text-white">
              <LogOut size={18} />
            </button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-10 lg:pt-8">
          <div className="page-enter">{children}</div>
          <footer className="mt-10 text-center text-xs text-negro/40 lg:hidden">
            <Link href="/novedades" className="hover:text-rojo">Rayo Vallecañas · v{APP_VERSION} · Novedades</Link>
          </footer>
        </main>
      </div>
      <BottomNav items={items} />
      <WhatsNew />
      <Suspense>
        <NavProgress />
      </Suspense>
    </div>
  );
}
