import Image from "next/image";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-negro px-4 py-10">
      <div aria-hidden className="auth-franja pointer-events-none absolute inset-0 franja opacity-90" />
      <div aria-hidden className="md-light md-light-l" />
      <div aria-hidden className="md-light md-light-r" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_60%)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/escudo.png" alt="Escudo del Rayo Vallecañas" width={120} height={142} priority className="auth-crest drop-shadow-2xl" />
          <h1 className="sport mt-4 text-4xl font-black text-white">{title}</h1>
          {subtitle && <p className="sport mt-1 text-sm font-bold tracking-[0.15em] text-dorado">{subtitle}</p>}
        </div>
        <div className="auth-card rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-white/20">{children}</div>
        <p className="mt-6 text-center text-xs text-white/40">⚡ Un equipo. Una plataforma. Todo bajo control.</p>
        <p className="mt-2 text-center text-xs"><a href="/privacidad" className="text-white/50 underline hover:text-dorado">Protección de datos</a></p>
      </div>
    </main>
  );
}
