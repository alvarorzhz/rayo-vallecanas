"use client";
import { startTransition, useActionState, useRef, useState, useTransition } from "react";
import { AlertTriangle, FileText, ImageIcon, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/shrink-image";
import { fecha } from "@/lib/format";
import { DOC_KINDS, DOC_KIND_LABEL, DOC_MAX_BYTES, DOC_MIME, DOC_REQUIRED, docExpiry, fileSize, type PlayerDocument } from "@/lib/squad";
import { FormMessage } from "@/components/form-message";
import type { ActionState } from "@/app/(app)/plantilla/actions";

const EXPIRY = {
  expired: { label: "Caducado", tone: "bg-rojo text-white" },
  soon: { label: "Caduca pronto", tone: "bg-amber-100 text-amber-800" },
  ok: { label: "En regla", tone: "bg-green-100 text-green-800" },
} as const;

/** Documentos privados de un jugador: lista, aviso de los que faltan y subida directa al bucket privado. */
export function PlayerDocs({
  playerId,
  docs,
  canUpload,
  deletable,
  save,
  remove,
}: {
  playerId: string;
  docs: PlayerDocument[];
  canUpload: boolean;
  deletable: string[];
  save: (s: ActionState, f: FormData) => Promise<ActionState>;
  remove: (id: string) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(save, undefined);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const form = useRef<HTMLFormElement>(null);
  const missing = DOC_REQUIRED.filter((k) => !docs.some((d) => d.kind === k && docExpiry(d.expires_on) !== "expired"));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    const fd = new FormData(e.currentTarget);
    const picked = fd.get("file");
    if (!(picked instanceof File) || !picked.size) return setError("Elige el archivo");
    if (!DOC_MIME.includes(picked.type)) return setError("Tiene que ser un PDF o una foto (JPG, PNG o WebP)");
    start(async () => {
      try {
        const file = await shrinkImage(picked);
        if (file.size > DOC_MAX_BYTES) throw new Error("El archivo pesa más de 5 MB");
        const ext = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type];
        const path = `${playerId}/${crypto.randomUUID()}.${ext}`;
        const { error: up } = await createClient().storage.from("player-docs").upload(path, file, { contentType: file.type });
        if (up) throw up;
        fd.delete("file");
        fd.set("file_path", path);
        fd.set("file_name", picked.name);
        fd.set("mime_type", file.type);
        fd.set("size_bytes", String(file.size));
        startTransition(() => formAction(fd));
        form.current?.reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo subir el archivo");
      }
    });
  }

  return (
    <div className="space-y-3">
      {missing.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          <AlertTriangle size={14} /> Falta:
          {missing.map((k) => <span key={k} className="rounded bg-white/70 px-1.5 py-0.5">{DOC_KIND_LABEL[k]}</span>)}
        </p>
      )}

      {docs.length > 0 ? (
        <ul className="divide-y divide-black/5">
          {docs.map((d, i) => {
            const exp = docExpiry(d.expires_on);
            return (
              <li key={d.id} className="anim-rise flex items-center gap-3 py-2.5" style={{ animationDelay: `${i * 50}ms` }}>
                <a href={`/api/plantilla/documentos/${d.id}`} target="_blank" rel="noopener"
                  className="group flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-negro text-dorado transition group-hover:rotate-[-6deg] group-hover:bg-rojo group-hover:text-white">
                    {d.mime_type === "application/pdf" ? <FileText size={18} /> : <ImageIcon size={18} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold group-hover:text-rojo">{d.title || DOC_KIND_LABEL[d.kind]}</span>
                    <span className="block truncate text-xs text-negro/50">
                      {d.title ? `${DOC_KIND_LABEL[d.kind]} · ` : ""}{fileSize(d.size_bytes)} · {fecha(d.created_at)}
                      {d.expires_on && ` · caduca el ${fecha(d.expires_on)}`}
                    </span>
                  </span>
                </a>
                {exp && exp !== "ok" && <span className={`badge shrink-0 ${EXPIRY[exp].tone}`}>{EXPIRY[exp].label}</span>}
                {deletable.includes(d.id) && (
                  <button type="button" aria-label="Borrar documento" className="shrink-0 rounded-lg p-1.5 text-negro/40 hover:bg-rojo/10 hover:text-rojo"
                    onClick={() => { if (confirm("¿Borrar este documento? No se puede deshacer.")) start(async () => { const r = await remove(d.id); if (r?.error) setError(r.error); }); }}>
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-negro/50">Aún no hay documentos.</p>
      )}

      {canUpload && (
        <details open={docs.length === 0 || undefined} className="rounded-xl bg-gris p-3">
          <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-bold text-rojo"><Upload size={15} /> Subir documento</summary>
          <form ref={form} onSubmit={onSubmit} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="doc-kind">Tipo</label>
              <select id="doc-kind" name="kind" defaultValue={missing[0] ?? "other"} className="input">
                {DOC_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="doc-exp">Caduca el</label>
              <input id="doc-exp" name="expires_on" type="date" className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="doc-title">Descripción (opcional)</label>
              <input id="doc-title" name="title" maxLength={80} placeholder="Por ejemplo: reconocimiento médico 2026" className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="doc-file">Archivo (PDF o foto, hasta 5 MB)</label>
              <input id="doc-file" name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className="input file:mr-3 file:rounded-lg file:border-0 file:bg-negro file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              {error ? <FormMessage state={{ error }} /> : <FormMessage state={state} />}
              <button type="submit" disabled={pending} className="btn-primary w-full">{pending ? "Subiendo…" : "Guardar documento"}</button>
            </div>
          </form>
        </details>
      )}
    </div>
  );
}
