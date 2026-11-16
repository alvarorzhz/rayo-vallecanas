/**
 * 4.19.0 · Pantallas de carga: en cuanto se toca una pestaña sale la silueta de la página
 * (con el brillo que pasa por encima) mientras llegan los datos. Antes no salía nada hasta tenerlo todo.
 */

function Bone({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

/** Cabecera con las rayitas del club y el título en gris. */
function Header({ actions = false }: { actions?: boolean }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-3">
      <div>
        <div aria-hidden className="mb-2 flex gap-1">
          <span className="h-1.5 w-10 -skew-x-[25deg] bg-rojo/50" />
          <span className="h-1.5 w-3 -skew-x-[25deg] bg-dorado/60" />
        </div>
        <Bone className="h-8 w-44" />
        <Bone className="mt-2 h-4 w-56" />
      </div>
      {actions && <Bone className="h-10 w-28" />}
    </div>
  );
}

/** Bloque negro con la franja (portada del partido, saldo…). */
function DarkBlock({ className = "h-44" }: { className?: string }) {
  return (
    <div className={`franja relative overflow-hidden rounded-3xl bg-negro ${className}`}>
      <div className="skeleton-dark absolute inset-0" />
      <div className="absolute inset-x-5 bottom-5 space-y-2">
        <div className="h-4 w-1/3 rounded-lg bg-white/10" />
        <div className="h-7 w-2/3 rounded-lg bg-white/15" />
      </div>
    </div>
  );
}

function Rows({ n = 4 }: { n?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/5">
          <Bone className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Bone className="h-4 w-3/5" />
            <Bone className="h-3 w-2/5" />
          </div>
          <Bone className="h-6 w-14" />
        </div>
      ))}
    </div>
  );
}

function Wrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="skeleton-in">
      <span className="sr-only">Cargando {label}…</span>
      {children}
    </div>
  );
}

export type SkeletonKind = "inicio" | "lista" | "cromos" | "panel" | "periodico" | "ficha";

/** La silueta de cada tipo de página. */
export function PageSkeleton({ kind = "lista", label = "la página" }: { kind?: SkeletonKind; label?: string }) {
  if (kind === "inicio")
    return (
      <Wrap label="Inicio">
        <Bone className="mb-3 h-5 w-40" />
        <DarkBlock className="h-56" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Bone className="h-28 rounded-2xl" />
          <Bone className="h-28 rounded-2xl" />
        </div>
        <div className="mt-5"><Rows n={2} /></div>
      </Wrap>
    );
  if (kind === "cromos")
    return (
      <Wrap label={label}>
        <Header actions />
        <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => <Bone key={i} className={`h-16 rounded-2xl ${i > 2 ? "hidden sm:block" : ""}`} />)}
        </div>
        <Bone className="mb-3 h-5 w-28" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton-dark relative aspect-[63/88] overflow-hidden rounded-2xl bg-negro ring-1 ring-dorado/30">
              <div className="absolute left-3 top-3 h-6 w-7 rounded bg-dorado/25" />
              <div className="absolute inset-x-3 bottom-3 h-5 rounded bg-white/10" />
            </div>
          ))}
        </div>
      </Wrap>
    );
  if (kind === "panel")
    return (
      <Wrap label={label}>
        <Header actions />
        <DarkBlock className="h-36" />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Bone key={i} className="h-20 rounded-2xl" />)}
        </div>
        <div className="mt-5"><Rows n={3} /></div>
      </Wrap>
    );
  if (kind === "periodico")
    return (
      <Wrap label="La Voz del Rayo">
        <div className="paper rounded-2xl p-4 ring-1 ring-black/10">
          <Bone className="mx-auto h-9 w-3/4" />
          <div className="my-3 h-px bg-black/15" />
          <Bone className="aspect-[16/9] w-full rounded-lg" />
          <Bone className="mt-3 h-6 w-5/6" />
          <Bone className="mt-2 h-4 w-full" />
          <Bone className="mt-1.5 h-4 w-2/3" />
        </div>
      </Wrap>
    );
  if (kind === "ficha")
    return (
      <Wrap label={label}>
        <Bone className="mb-4 h-7 w-24 rounded-full" />
        <DarkBlock className="h-64" />
        <div className="mt-5 grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }, (_, i) => <Bone key={i} className="h-20 rounded-2xl" />)}
        </div>
        <div className="mt-5"><Rows n={2} /></div>
      </Wrap>
    );
  return (
    <Wrap label={label}>
      <Header />
      <Rows n={5} />
    </Wrap>
  );
}
