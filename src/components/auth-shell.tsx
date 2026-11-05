import Image from "next/image";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-negro px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 franja opacity-90" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_60%)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/escudo.png" alt="Escudo del Rayo Vallecañas" width={120} height={142} priority className="animate-pop drop-shadow-2xl" />
          <h1 className="sport mt-4 text-4xl font-black text-white">{title}</h1>
          {subtitle && <p className="sport mt-1 text-sm font-bold tracking-[0.15em] text-dorado">{subtitle}</p>}
        </div>
        <div className="animate-fade-up rounded-2xl bg-white p-6 shadow-2xl">{children}</div>
        <p className="mt-6 text-center text-xs text-white/40">⚡ Un equipo. Una plataforma. Todo bajo control.</p>
      </div>
    </main>
  );
}
