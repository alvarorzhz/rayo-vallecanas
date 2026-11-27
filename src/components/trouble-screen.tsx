/**
 * 4.32.3 · Marco común de las pantallas «algo va mal» (fallo, página que no existe, versión nueva, sin conexión):
 * tarjeta negra con la franja del Rayo, los focos y el escudo. Sin datos ni hooks, así sirve igual dentro de la app
 * (con su barra) que a pantalla completa cuando ha fallado hasta la estructura.
 */
export function TroubleScreen({
  tag,
  title,
  children,
  actions,
  footer,
  full = false,
}: {
  /** Letrero dorado encima del título (p. ej. «Fuera de juego»). */
  tag: string;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  /** Pantalla completa (sin la barra de la app): fondo negro de borde a borde. */
  full?: boolean;
}) {
  const card = (
    <section
      role="alert"
      className="trouble-card relative w-full max-w-md overflow-hidden rounded-3xl bg-negro px-6 pt-8 pb-7 text-center text-white shadow-2xl ring-1 ring-white/10"
    >
      <div aria-hidden className="auth-franja pointer-events-none absolute inset-0 franja opacity-60" />
      <div aria-hidden className="md-light md-light-l" />
      <div aria-hidden className="md-light md-light-r" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.10),transparent_60%)]" />
      <div className="relative">
        {/* <img> y no next/image: si ha fallado la app, cuantas menos piezas dependan de ella, mejor */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/escudo.png" alt="Escudo del Rayo Vallecañas" width={88} height={104} className="auth-crest mx-auto drop-shadow-2xl" />
        <p className="sport mt-4 text-sm font-bold tracking-[0.15em] text-dorado">{tag}</p>
        <h1 className="sport mt-1 text-3xl leading-tight font-black">{title}</h1>
        {children && <div className="mx-auto mt-3 max-w-sm text-[15px] text-white/75">{children}</div>}
        {actions && <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>}
        {footer && <div className="mt-5 space-y-2 text-sm text-white/55">{footer}</div>}
      </div>
    </section>
  );
  if (!full) return <div className="flex min-h-[65dvh] items-center justify-center py-6">{card}</div>;
  return <main className="flex min-h-dvh items-center justify-center bg-negro px-4 py-10">{card}</main>;
}
