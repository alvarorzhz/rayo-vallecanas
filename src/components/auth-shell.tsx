import Image from "next/image";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-negro px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[36rem] w-[36rem] rotate-12 bg-rojo/25 blur-3xl"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/escudo.png" alt="Escudo del Rayo Vallecañas" width={120} height={142} priority />
          <h1 className="mt-4 text-2xl font-black tracking-tight text-white">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-dorado">{subtitle}</p>}
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-xl">{children}</div>
        <p className="mt-6 text-center text-xs text-white/40">⚡ Un equipo. Una plataforma. Todo bajo control.</p>
      </div>
    </main>
  );
}
