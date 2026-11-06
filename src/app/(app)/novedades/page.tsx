import { PageHeader } from "@/components/ui";
import { CHANGELOG } from "@/lib/changelog";
import { fecha } from "@/lib/format";

export const metadata = { title: "Novedades" };

export default function NovedadesPage() {
  return (
    <>
      <PageHeader title="Novedades" subtitle="Historial de versiones de la app" />
      <ol className="mx-auto max-w-2xl space-y-4">
        {CHANGELOG.map((r, i) => (
          <li key={r.version} className="card">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="flex items-center gap-2 font-bold">
                <span className={`badge font-mono ${i === 0 ? "bg-rojo text-white" : "bg-negro text-white"}`}>v{r.version}</span>
                {r.title}
              </h2>
              <span className="text-xs text-negro/65">{fecha(r.date)}{i === 0 ? " · versión actual" : ""}</span>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-negro/80">
              {r.changes.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </li>
        ))}
      </ol>
    </>
  );
}
