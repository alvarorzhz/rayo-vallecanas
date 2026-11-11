import Link from "next/link";
import { NEWS_NAME } from "@/lib/news";

/** Noticias públicas de La Voz del Rayo: se leen sin registrarse. */
export default function PublicNewsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gris">
      <header className="franja bg-negro px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white">
        <div className="relative mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link href="/noticias" className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/escudo.png" alt="Escudo del Rayo Vallecañas" width={32} height={38} className="shrink-0 drop-shadow" />
            <span className="sport truncate text-xl font-black">Rayo <span className="text-dorado">Vallecañas</span></span>
          </Link>
          <Link href="/login" className="shrink-0 rounded-lg bg-black/30 px-3 py-1.5 text-xs font-bold text-white/85 hover:text-dorado">Soy del equipo</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-5 sm:px-6 sm:pt-8">{children}</main>
      <footer className="pb-8 text-center text-xs text-negro/60">
        {NEWS_NAME} · el periódico del Rayo Vallecañas, equipo de fútbol 7 de Salamanca · <Link href="/privacidad" className="hover:text-rojo">Protección de datos</Link>
      </footer>
    </div>
  );
}
