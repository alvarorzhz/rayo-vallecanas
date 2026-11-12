import { PageHeader } from "@/components/ui";
import { CHANGELOG } from "@/lib/changelog";
import { fecha } from "@/lib/format";

export const metadata = { title: "Novedades" };

export default function NovedadesPage() {
  return (
    <>
      <PageHeader title="Novedades" subtitle="Historial de versiones de la app" />
      <ol className="relative mx-auto max-w-2xl space-y-4 pl-6 before:absolute before:bottom-4 before:left-[7px] before:top-4 before:w-0.5 before:bg-black/10 sm:pl-8">
        {CHANGELOG.map((r, i) => (
          <li key={r.version} className="relative">
            {/* Punto de la línea del tiempo: rojo y latiendo en la versión actual */}
            <span aria-hidden className={`absolute -left-6 top-5 h-4 w-4 rounded-full ring-4 ring-gris sm:-left-8 ${i === 0 ? "bg-rojo" : "bg-negro/25"}`}>
              {i === 0 && <span className="absolute inset-0 animate-ping rounded-full bg-rojo/60" />}
            </span>
            <div className={`card reveal ${i === 0 ? "ring-2 ring-rojo/30" : ""}`}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="flex items-center gap-2 font-bold">
                  <span className={`badge shrink-0 -skew-x-[10deg] px-2.5 font-mono not-italic ${i === 0 ? "bg-rojo text-white" : "bg-negro text-white"}`}>v{r.version}</span>
                  {r.title}
                </h2>
                <span className="text-xs text-negro/65">{fecha(r.date)}{i === 0 ? " · versión actual" : ""}</span>
              </div>
              <ul className="space-y-1.5 text-sm text-negro/80">
                {r.changes.map((c) => (
                  <li key={c} className="relative pl-4 before:absolute before:left-0 before:top-[0.55em] before:h-1.5 before:w-2 before:-skew-x-[25deg] before:bg-rojo/70">{c}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
