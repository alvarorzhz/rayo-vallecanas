import { History, ListChecks } from "lucide-react";
import { Empty } from "@/components/ui";
import { AREA_LABEL, HOW_LABEL, NOTICE_CATALOG, areaOf, type NoticeArea } from "@/lib/notifications";
import { fecha } from "@/lib/format";

export type LogRow = { id: number; title: string; body: string | null; url: string | null; tag: string | null; people: number; devices: number; created_at: string };

const HOW_TONE = { auto: "bg-emerald-100 text-emerald-800", manual: "bg-negro text-white", opt: "bg-dorado/25 text-negro" };

/** Últimos avisos que han salido al móvil (registro push_log), clavados en el tablón de corcho. */
export function NoticeHistory({ rows }: { rows: LogRow[] }) {
  const recent = rows;
  return (
      <section className="mt-8 space-y-3" aria-labelledby="ultimos">
        <h2 id="ultimos" className="flex items-center gap-2 text-lg font-black"><History size={18} className="text-rojo" /> Últimos avisos enviados</h2>
        {recent.length ? (
          <div className="corkboard rounded-2xl p-4 pt-6 sm:p-6 sm:pt-7">
            <ul className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
              {recent.map((r) => (
                <li key={r.id} className="cork-note flex flex-col gap-2 rounded-md bg-white p-3 pt-4">
                  <span aria-hidden className="cork-pin" />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <b className="text-sm">{r.title}</b>
                    <span className="badge bg-gris text-negro/70">{AREA_LABEL[areaOf(r.url, r.tag)]}</span>
                  </div>
                  {r.body && <p className="line-clamp-2 text-sm text-negro/70">{r.body}</p>}
                  <div className="mt-auto flex flex-wrap justify-between gap-x-3 border-t border-dashed border-black/10 pt-1.5 text-xs text-negro/60">
                    <span className="font-semibold text-negro/80">{fecha(r.created_at, true)}</span>
                    <span>{r.people} {r.people === 1 ? "persona" : "personas"} · {r.devices} {r.devices === 1 ? "dispositivo" : "dispositivos"}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Empty>Todavía no se ha apuntado ningún aviso. A partir de ahora, aquí verás cada aviso que salga, automático o manual.</Empty>
        )}
      </section>
  );
}

/** Todos los avisos que puede mandar la app: cuándo salen y a quién. */
export function NoticeCatalog() {
  const areas = (Object.keys(AREA_LABEL) as NoticeArea[]).filter((a) => NOTICE_CATALOG.some((n) => n.area === a));
  return (
      <section className="mt-8 space-y-4" aria-labelledby="catalogo">
        <div>
          <h2 id="catalogo" className="flex items-center gap-2 text-lg font-black"><ListChecks size={18} className="text-rojo" /> Qué avisos manda la app</h2>
          <p className="text-sm text-negro/60">Solo llegan a quien tiene los avisos activados en su móvil u ordenador.</p>
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {areas.map((a) => (
            <div key={a} className="card space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-negro/65">{AREA_LABEL[a]}</h3>
              <ul className="space-y-2.5">
                {NOTICE_CATALOG.filter((n) => n.area === a).map((n) => (
                  <li key={n.title} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2"><b>{n.title}</b><span className={`badge ${HOW_TONE[n.how]}`}>{HOW_LABEL[n.how]}</span></div>
                    <p className="text-negro/70">{n.when} <span className="text-negro/60">Le llega a: {n.who.charAt(0).toLowerCase() + n.who.slice(1)}</span></p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
  );
}
