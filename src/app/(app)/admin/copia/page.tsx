import { redirect } from "next/navigation";
import { Archive, CalendarClock, Download, FileJson, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { BACKUP_KEEP, listBackups } from "@/lib/backup";
import { fecha } from "@/lib/format";
import { BackupNow } from "@/components/backup-now";
import { backupNow } from "./actions";

const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export const metadata = { title: "Copia de seguridad" };

export default async function BackupPage() {
  const s = await getSession();
  if (s.profile.role !== "superadmin") redirect("/?error=permiso");
  const saved = await listBackups().catch(() => []);
  const blob = !!process.env.BLOB_READ_WRITE_TOKEN;
  return (
    <>
      <PageHeader title="Copia de seguridad" subtitle="Descarga todos los datos de la app para guardarlos a buen recaudo." />
      {/* Archivador del despacho: un cajón por cada copia */}
      <div className="cabinet grid gap-3 rounded-3xl p-3 shadow-xl sm:p-4 lg:grid-cols-2">
        <section className="drawer card space-y-3 rounded-xl pt-0 sm:pt-0">
          <div aria-hidden className="flex flex-col items-center gap-2">
            <span className="drawer-handle" />
            <span className="drawer-label rounded px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.25em] text-negro/70">Cajón 1 · Para consultar</span>
          </div>
          <h2 className="flex items-center gap-2 font-bold"><Download size={18} className="text-rojo" /> Excel (para consultar)</h2>
          <p className="text-sm text-negro/60">
            Un Excel con una hoja por cada tipo de dato: usuarios, sorteos, finanzas, plantilla, partidos, patrocinadores, votaciones, La Voz y auditoría.
          </p>
          <a href="/api/admin/backup?formato=xlsx" className="btn-primary w-full sm:w-auto"><Download size={16} /> Descargar Excel</a>
        </section>
        <section className="drawer card space-y-3 rounded-xl pt-0 sm:pt-0">
          <div aria-hidden className="flex flex-col items-center gap-2">
            <span className="drawer-handle" />
            <span className="drawer-label rounded px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.25em] text-negro/70">Cajón 2 · Para restaurar</span>
          </div>
          <h2 className="flex items-center gap-2 font-bold"><FileJson size={18} className="text-rojo" /> Archivo completo (para restaurar)</h2>
          <p className="text-sm text-negro/60">
            Los mismos datos en un único archivo (.json) con el formato exacto de la base de datos. Es el que sirve para recuperar la
            app si algún día hiciera falta.
          </p>
          <a href="/api/admin/backup?formato=json" className="btn-dark w-full sm:w-auto"><FileJson size={16} /> Descargar archivo</a>
        </section>
      </div>
      <section className="card mt-6 space-y-3" id="automaticas">
        <h2 className="flex items-center gap-2 font-bold"><CalendarClock size={18} className="text-rojo" /> Copias automáticas</h2>
        <p className="text-sm text-negro/65">
          Cada lunes de madrugada la app hace sola una copia completa: todos los datos y también las fotos, escudos, justificantes y
          documentos. Se guardan las {BACKUP_KEEP} últimas {blob ? <>en <b>Vercel Blob</b>, fuera de Supabase</> : <>en un cajón privado de Supabase</>}. Si una falla, te llega un aviso.
        </p>
        {saved.length ? (
          <ul className="divide-y divide-black/5">
            {saved.map((b) => (
              <li key={b.where + b.name} className="flex items-center gap-3 py-2">
                <Archive size={18} className="shrink-0 text-negro/50" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{fecha(b.at, true)}</span>
                  <span className="block text-xs text-negro/60">{size(b.size)} · {b.where === "blob" ? "Vercel Blob" : "Supabase"}</span>
                </span>
                <a href={`/api/admin/backup/guardadas?nombre=${encodeURIComponent(b.name)}&donde=${b.where}`} className="btn-ghost px-3 py-1.5 text-sm"><Download size={15} /> Descargar</a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-gris/60 px-3 py-2 text-sm text-negro/65">Todavía no hay ninguna. La primera se hará el próximo lunes, o ahora mismo con el botón.</p>
        )}
        <BackupNow action={backupNow} />
      </section>
      <section className="mt-6 flex gap-3 rounded-2xl bg-dorado/15 p-4 text-sm text-negro/80">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-dorado" />
        <div className="space-y-1">
          <p><b>Recomendación:</b> además de las automáticas, descarga una copia de vez en cuando y guárdala en un sitio seguro
            (por ejemplo, en Google Drive), porque contienen datos personales.</p>
          <p>Cada descarga queda anotada en la auditoría. Las descargas de arriba (Excel y archivo) no llevan las fotos; las automáticas, sí.</p>
        </div>
      </section>
    </>
  );
}
