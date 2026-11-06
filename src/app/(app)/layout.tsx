import Link from "next/link";
import { LogOut } from "lucide-react";
import { getSession } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { PushPrompt } from "@/components/push-prompt";
import { BottomNav, Sidebar, type NavItem } from "@/components/nav";
import { signOut } from "@/app/login/actions";
import { Suspense } from "react";
import { WhatsNew } from "@/components/whats-new";
import { NavProgress } from "@/components/nav-progress";
import { RefreshOnVisit } from "@/components/refresh-on-visit";
import { APP_VERSION } from "@/lib/changelog";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const items: NavItem[] = [{ href: "/", label: "Inicio", icon: "Home" }];
  if (s.can("matches")) items.push({ href: "/partidos", label: "Partidos", icon: "CalendarDays" });
  if (s.can("squad")) items.push({ href: "/plantilla", label: "Plantilla", icon: "Shirt" });
  if (s.can("lottery_admin") || s.can("lottery_sell")) items.push({ href: "/loteria", label: "Sorteos", icon: "Ticket" });
  if (s.can("lottery_sell", "create")) items.push({ href: "/mis-ventas", label: "Mis ventas", icon: "ShoppingBag" });
  if (s.can("finances")) items.push({ href: "/finanzas", label: "Finanzas", icon: "Wallet" });
  // Panel de gestión: usuarios, perfiles, avisos, auditoría y copias de seguridad
  if (s.can("users") || s.can("lottery_admin", "update") || s.profile.role === "superadmin")
    items.push({ href: "/admin", label: "Gestión", icon: "Settings" });

  return (
    <div className="flex min-h-dvh">
      <a href="#contenido" className="sr-only z-50 rounded-xl bg-rojo px-4 py-2 font-bold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Saltar al contenido</a>
      <Sidebar items={items} name={s.profile.full_name} role={ROLE_LABEL[s.profile.role] ?? s.profile.role} version={APP_VERSION} avatar={s.profile.avatar_url} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="franja sticky top-0 z-20 flex items-center justify-between bg-negro px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white shadow-lg lg:hidden">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/escudo.png" alt="" width={32} height={38} className="drop-shadow" />
            <span className="sport truncate text-xl font-black">
              Rayo <span className="text-dorado">Vallecañas</span>
            </span>
          </Link>
          <div className="relative flex shrink-0 items-center gap-2">
            <Link href="/perfil" prefetch aria-label="Mi perfil">
              <Avatar name={s.profile.full_name} url={s.profile.avatar_url} size={34} />
            </Link>
            <form action={signOut}>
              <button aria-label="Cerrar sesión" className="rounded-lg bg-black/30 p-2 text-white/80 hover:text-white">
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </header>
        <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 outline-none px-4 pb-28 pt-5 sm:px-6 lg:pb-10 lg:pt-8">
          <div className="page-enter">{children}</div>
          <footer className="mt-10 text-center text-xs text-negro/60">
            <Link href="/novedades" className="hover:text-rojo lg:hidden">Rayo Vallecañas · v{APP_VERSION} · Novedades · </Link>
            <Link href="/privacidad" className="hover:text-rojo">Protección de datos</Link>
          </footer>
        </main>
      </div>
      <BottomNav items={items} />
      <WhatsNew />
      <PushPrompt />
      <Suspense>
        <NavProgress />
        <RefreshOnVisit />
      </Suspense>
    </div>
  );
}
