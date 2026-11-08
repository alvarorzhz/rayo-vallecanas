import Link from "next/link";
import { AlertTriangle, ShieldCheck, XCircle } from "lucide-react";
import { fecha } from "@/lib/format";
import { currentProblem, type StoredSummary } from "@/lib/league-status";

const sourceLabel = { sync: "Sincronización", health: "Revisión semanal" } as const;

/** Aviso fijo cuando la última sincronización (o la revisión semanal) no fue bien. */
export function LeagueProblem({ summary, compact = false }: { summary: StoredSummary; compact?: boolean }) {
  const p = currentProblem(summary);
  if (!p) return null;
  const failed = p.status === "failed";
  const Icon = failed ? XCircle : AlertTriangle;
  const tone = failed ? "bg-rojo/10 ring-rojo/30 text-rojo" : "bg-dorado/15 ring-dorado/50 text-negro";
  const head = failed
    ? p.source === "health" ? "La web de la liga no se puede leer" : "La última sincronización ha fallado"
    : p.source === "health" ? "La web de la liga ha cambiado" : "La última sincronización quedó incompleta";

  if (compact)
    return (
      <Link href="/partidos/liga" role="alert" className={`mb-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${tone} hover:ring-2`}>
        <Icon size={16} className="shrink-0" /> <span>{head}{p.issues.length ? ` · ${p.issues.length} ${p.issues.length === 1 ? "incidencia" : "incidencias"}` : ""}. Ver detalles →</span>
      </Link>
    );

  return (
    <section role="alert" className={`rounded-2xl p-4 ring-1 ${tone}`}>
      <div className="flex items-start gap-3">
        <Icon size={22} className="mt-0.5 shrink-0" />
        <div className="min-w-0 space-y-2">
          <p className="font-black">{head}</p>
          <p className="text-xs text-negro/65">{sourceLabel[p.source]}{p.at ? ` · ${fecha(p.at, true)}` : ""}</p>
          {!!p.issues.length && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-negro/80">
              {p.issues.slice(0, 8).map((i, k) => <li key={k} className="break-words">{i}</li>)}
              {p.issues.length > 8 && <li>Y {p.issues.length - 8} más.</li>}
            </ul>
          )}
          <p className="text-xs text-negro/65">
            {failed
              ? "No se ha guardado nada nuevo. Vuelve a intentarlo en un rato; si sigue fallando, la liga ha cambiado su web y hay que adaptar la app."
              : "Lo que sí se pudo leer está guardado. Si se repite, la liga ha cambiado algo en su web y hay que adaptar la app."}
            {" "}Los gestores reciben este aviso en el móvil.
          </p>
        </div>
      </div>
    </section>
  );
}

/** Línea verde con la última revisión buena. */
export function LeagueHealthy({ summary }: { summary: StoredSummary }) {
  if (!summary || currentProblem(summary)) return null;
  const at = [summary.at, summary.health?.at].filter(Boolean).sort().at(-1);
  if (!at) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-green-800">
      <ShieldCheck size={14} /> La web de la liga se lee bien (comprobado el {fecha(at, true)}).
    </p>
  );
}
