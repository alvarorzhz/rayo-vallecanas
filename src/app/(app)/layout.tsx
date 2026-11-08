import Link from "next/link";
import { LogOut } from "lucide-react";
import { getSession } from "@/lib/session";
import { Avatar } from "@/components/avatar";
import { PushPrompt } from "@/components/push-prompt";
import { BottomNav, Sidebar, type NavItem } from "@/components/nav";
import { CrestEgg } from "@/components/easter-eggs";
import { signOut } from "@/app/login/actions";
import { Suspense } from "react";
import { WhatsNew } from "@/components/whats-new";
import { NavProgress } from "@/components/nav-progress";
import { RefreshOnVisit } from "@/components/refresh-on-visit";
import { APP_VERSION } from "@/lib/changelog";
import { Tour } from "@/components/tour";
import { EasterEggs } from "@/components/easter-eggs";
import { buildTour, TOUR_VERSION } from "@/lib/tour";
import { createClient } from "@/lib/supabase/server";
import { fetchTodayMatch } from "@/lib/match-queries";
import { TodayStrip } from "@/components/matches/matchday-fx";
import { CLUB_SHORT, hhmm, rivalShort } from "@/lib/matches";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const items: NavItem[] = [{ href: "/", label: "Inicio", icon: "Home" }];
  if (s.can("matches")) items.push({ href: "/partidos", label: "Partidos", icon: "CalendarDays" });
  if (s.can("squad")) items.push({ href: "/plantilla", label: "Plantilla", icon: "Shirt" });
  // «Mis ventas» va dentro de Sorteos para no cargar la barra de abajo
  if (s.can("lottery_admin") || s.can("lottery_sell")) items.push({ href: "/loteria", label: "Sorteos", icon: "Ticket", also: ["/mis-ventas"] });
  if (s.can("finances")) items.push({ href: "/finanzas", label: "Finanzas", icon: "Wallet" });
  // Panel de gestión: usuarios, perfiles, avisos, auditoría y copias de seguridad
  if (s.can("users") || s.can("lottery_admin", "update") || s.can("sponsors") || s.profile.role === "superadmin")
    items.push({ href: "/admin", label: "Gestión", icon: "Settings" });

  // Especial Matchday: el día del partido, una tira «Hoy jugamos» arriba en todas las páginas
  const today = s.can("matches") ? await fetchTodayMatch(await createClient()) : null;
  const strip = today && {
    id: today.id,
    time: hhmm(today.kickoff),
    label: today.is_home ? `Rayo vs ${today.rival.name}` : `${today.rival.name} vs Rayo`,
    final: today.status === "played" && today.goals_for != null
      ? (today.is_home ? `${CLUB_SHORT} ${today.goals_for}-${today.goals_against} ${rivalShort(today.rival)}` : `${rivalShort(today.rival)} ${today.goals_against}-${today.goals_for} ${CLUB_SHORT}`)
      : null,
  };

  return (
    <div className="flex min-h-dvh">
      <a href="#contenido" className="sr-only z-50 rounded-xl bg-rojo px-4 py-2 font-bold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Saltar al contenido</a>
      <Sidebar items={items} name={s.profile.full_name} role={s.profile.role_label} version={APP_VERSION} avatar={s.profile.avatar_url} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="franja sticky top-0 z-20 flex items-center justify-between bg-negro px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white shadow-lg lg:hidden">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <CrestEgg width={32} height={38} />
            <span className="sport truncate text-xl font-black">
              Rayo <span className="text-dorado">Vallecañas</span>
            </span>
          </Link>
          <div className="relative flex shrink-0 items-center gap-2">
            <Link href="/perfil" prefetch aria-label="Mi perfil" data-tour="/perfil">
              <Avatar name={s.profile.full_name} url={s.profile.avatar_url} size={34} />
            </Link>
            <form action={signOut}>
              <button aria-label="Cerrar sesión" className="rounded-lg bg-black/30 p-2 text-white/80 hover:text-white">
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </header>
        {strip && <TodayStrip match={strip} />}
        <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 outline-none px-4 pb-28 pt-5 sm:px-6 lg:pb-10 lg:pt-8">
          <div className="page-enter">{children}</div>
          <footer className="mt-10 text-center text-xs text-negro/60">
            <Link href="/novedades" className="hover:text-rojo lg:hidden">Rayo Vallecañas · v{APP_VERSION} · Novedades · </Link>
            <Link href="/privacidad" className="hover:text-rojo">Protección de datos</Link>
          </footer>
        </main>
      </div>
      <BottomNav items={items} />
      {/* El tutorial de bienvenida ya enseña la app: las novedades salen a partir de la siguiente versión */}
      <WhatsNew skip={s.tutorialSeen < TOUR_VERSION} />
      <Tour steps={buildTour(s)} version={TOUR_VERSION} seen={s.tutorialSeen} />
      <PushPrompt />
      <EasterEggs />
      <Suspense>
        <NavProgress />
        <RefreshOnVisit />
      </Suspense>
    </div>
  );
}
