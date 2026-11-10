import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileText, FolderLock, ImageIcon } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { fecha } from "@/lib/format";
import { fetchRoster } from "@/lib/squad-queries";
import { DOC_KINDS, DOC_KIND_LABEL, DOC_REQUIRED, docExpiry, lineOf, seasonSlug, shirtName, fullName, type PlayerDocument } from "@/lib/squad";
import { Empty, PageHeader } from "@/components/ui";
import { Jersey } from "@/components/squad/jersey";

export const metadata = { title: "Documentos de la plantilla" };

const TONE = { expired: "bg-rojo text-white", soon: "bg-amber-100 text-amber-800", ok: "bg-green-100 text-green-800" } as const;

export default async function DocsPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const sp = await searchParams;
  await requirePerm("squad_private", "read");
  const supabase = await createClient();
  const season = seasonOf();
  const [roster, { data }] = await Promise.all([
    fetchRoster(supabase, season),
    supabase.from("player_documents").select("*").order("created_at", { ascending: false }).returns<PlayerDocument[]>(),
  ]);
  const docs = data ?? [];
  const squad = roster.filter((r) => r.status !== "left");
  const byPlayer = new Map<string, PlayerDocument[]>();
  for (const d of docs) byPlayer.set(d.player_id, [...(byPlayer.get(d.player_id) ?? []), d]);
  const valid = (list: PlayerDocument[], k: string) => list.some((d) => d.kind === k && docExpiry(d.expires_on) !== "expired");
  const filter = sp.filtro === "faltan" || sp.filtro === "caducan" ? sp.filtro : "todos";

  const rows = squad.map((r) => {
    const list = byPlayer.get(r.player_id) ?? [];
    const missing = DOC_REQUIRED.filter((k) => !valid(list, k));
    const warn = list.filter((d) => ["expired", "soon"].includes(docExpiry(d.expires_on) ?? ""));
    return { r, list, missing, warn };
  });
  const shown = rows.filter((x) => (filter === "faltan" ? x.missing.length > 0 : filter === "caducan" ? x.warn.length > 0 : true));
  const complete = rows.filter((x) => !x.missing.length).length;
  const pct = rows.length ? Math.round((complete / rows.length) * 100) : 0;

  return (
    <>
      <PageHeader title="Documentos" subtitle={<>Papeles de la plantilla <b>{season}</b>: DNI, ficha federativa, certificado médico… Privado: solo gestores con permiso de datos personales.</>}
        back={{ href: "/plantilla", label: "Plantilla" }} />

      <section className="franja relative mb-6 overflow-hidden rounded-3xl bg-negro p-5 text-white shadow-xl sm:p-6">
        <div className="relative grid grid-cols-3 gap-4">
          {[
            ["Al día", `${complete}/${rows.length}`],
            ["Les falta algo", rows.filter((x) => x.missing.length).length],
            ["Caducan o caducados", rows.reduce((a, x) => a + x.warn.length, 0)],
          ].map(([k, v], i) => (
            <div key={String(k)} className="anim-score" style={{ animationDelay: `${i * 90}ms` }}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">{k}</div>
              <div className="sport text-3xl font-black leading-none sm:text-5xl">{v}</div>
            </div>
          ))}
        </div>
        <div className="relative mt-5 h-3 overflow-hidden rounded-full bg-white/10">
          <div className="anim-fill h-full rounded-full bg-dorado" style={{ width: `${pct}%` }} />
        </div>
        <p className="relative mt-2 text-xs text-white/70">Se consideran necesarios: {DOC_REQUIRED.map((k) => DOC_KIND_LABEL[k]).join(", ")}.</p>
      </section>

      <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none]">
        {([["todos", "Todos"], ["faltan", "Les falta algo"], ["caducan", "Caducan pronto"]] as const).map(([k, label]) => (
          <Link key={k} href={k === "todos" ? "/plantilla/documentos" : `/plantilla/documentos?filtro=${k}`} prefetch
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold transition ${filter === k ? "tab-on bg-negro text-white" : "bg-white text-negro/70 ring-1 ring-black/10 hover:ring-negro/30"}`}>{label}</Link>
        ))}
      </div>

      {!squad.length ? (
        <Empty>No hay plantilla en {season}.</Empty>
      ) : !shown.length ? (
        <Empty>¡Todo en regla en este filtro!</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map(({ r, list, missing, warn }, i) => (
            <li key={r.id} className="anim-rise card p-3 sm:p-4" style={{ animationDelay: `${Math.min(i, 20) * 35}ms` }}>
              <Link href={`/plantilla/${r.player_id}?temporada=${seasonSlug(season)}`} className="group mb-2 flex items-center gap-3">
                <span className="shrink-0 transition group-hover:-rotate-6"><Jersey number={r.number} goalkeeper={lineOf(r.position) === "GK"} size={38} /></span>
                <span className="min-w-0 flex-1">
                  <span className="sport block truncate text-lg font-black leading-tight group-hover:text-rojo">{shirtName(r.player)}</span>
                  <span className="block truncate text-xs text-negro/65">{fullName(r.player)} · {list.length} {list.length === 1 ? "documento" : "documentos"}</span>
                </span>
                {missing.length === 0 && warn.length === 0 ? <CheckCircle2 size={22} className="shrink-0 text-green-600" /> : <AlertTriangle size={20} className="shrink-0 text-amber-500" />}
              </Link>
              <div className="flex flex-wrap gap-1.5">
                {DOC_KINDS.filter((k) => DOC_REQUIRED.includes(k.key) || list.some((d) => d.kind === k.key)).map((k) => {
                  const d = list.find((x) => x.kind === k.key && docExpiry(x.expires_on) !== "expired") ?? list.find((x) => x.kind === k.key);
                  const exp = d ? docExpiry(d.expires_on) : null;
                  return d ? (
                    <a key={k.key} href={`/api/plantilla/documentos/${d.id}`} target="_blank" rel="noopener"
                      title={d.expires_on ? `Caduca el ${fecha(d.expires_on)}` : d.file_name}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition hover:-translate-y-0.5 ${exp ? TONE[exp] : "bg-green-100 text-green-800"}`}>
                      {d.mime_type === "application/pdf" ? <FileText size={12} /> : <ImageIcon size={12} />} {k.short}
                      {exp === "expired" && " · caducado"}{exp === "soon" && ` · ${fecha(d.expires_on)}`}
                    </a>
                  ) : (
                    <span key={k.key} className="rounded-lg border border-dashed border-rojo/40 px-2 py-1 text-xs font-bold text-rojo">Falta {k.short}</span>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-negro/65"><FolderLock size={14} /> Cada jugador también puede subir sus documentos desde su ficha.</p>
    </>
  );
}
