"use client";
import { useActionState, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage as shrink } from "@/lib/shrink-image";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { PAYMENT_METHOD_LABEL } from "@/lib/format";
import { KIND_SLUG, type Category, type FinanceKind, type Movement } from "@/lib/finance";
import type { ActionState } from "@/app/(app)/finanzas/actions";

const eurosInput = (c?: number | null) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");

export function MovementForm({
  kind,
  categories,
  action,
  movement,
  today,
}: {
  kind: FinanceKind;
  categories: Category[];
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  movement?: Movement;
  today: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [file, setFile] = useState<{ path: string; name: string } | null>(
    movement?.attachment_path ? { path: movement.attachment_path, name: movement.attachment_name ?? "justificante" } : null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const income = kind === "income";
  const options = categories.filter((c) => c.kind === kind && (c.active || c.id === movement?.category_id));

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setUploadError(undefined);
    setUploading(true);
    try {
      const f = await shrink(picked);
      if (f.size > 5 * 1024 * 1024) throw new Error("El archivo pesa más de 5 MB");
      const safe = f.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80) || "justificante";
      const path = `${crypto.randomUUID()}/${safe}`;
      const { error } = await createClient().storage.from("finance-docs").upload(path, f, { contentType: f.type || undefined });
      if (error) throw error;
      setFile({ path, name: picked.name });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "No se pudo subir el archivo");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="kind" value={KIND_SLUG[kind]} />
      <input type="hidden" name="attachment_path" value={file?.path ?? ""} />
      <input type="hidden" name="attachment_name" value={file?.name ?? ""} />
      <section className="card grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="amount">Importe (€)</label>
          <input id="amount" name="amount" required inputMode="decimal" autoFocus={!movement} placeholder="0,00"
            defaultValue={eurosInput(movement?.amount_cents)}
            className={`input text-center text-3xl font-black tabular-nums ${income ? "text-green-700" : "text-rojo"}`} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="concept">Concepto</label>
          <input id="concept" name="concept" required maxLength={200} className="input" defaultValue={movement?.concept}
            placeholder={income ? "Ej.: Cuota de octubre de Juan" : "Ej.: Arbitraje jornada 5"} />
        </div>
        <div>
          <label className="label" htmlFor="category_id">Categoría</label>
          <select id="category_id" name="category_id" required className="input" defaultValue={movement?.category_id ?? ""}>
            <option value="" disabled>Elige…</option>
            {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="op_date">Fecha</label>
          <input id="op_date" name="op_date" type="date" required className="input" defaultValue={movement?.op_date ?? today} />
        </div>
        <div>
          <label className="label" htmlFor="method">{income ? "Método de cobro" : "Método de pago"}</label>
          <select id="method" name="method" className="input" defaultValue={movement?.method ?? "cash"}>
            {Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="counterparty">{income ? "Persona o entidad" : "Proveedor o destinatario"} <span className="font-normal text-negro/40">(opcional)</span></label>
          <input id="counterparty" name="counterparty" className="input" defaultValue={movement?.counterparty ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="notes">Observaciones <span className="font-normal text-negro/40">(opcional)</span></label>
          <textarea id="notes" name="notes" rows={2} className="input" defaultValue={movement?.notes ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <span className="label">{income ? "Justificante" : "Factura o justificante"} <span className="font-normal text-negro/40">(opcional, foto o PDF)</span></span>
          {file ? (
            <div className="flex items-center gap-2 rounded-xl bg-gris px-3 py-2 text-sm">
              <Paperclip size={16} className="shrink-0 text-negro/50" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} className="rounded p-1 text-negro/50 hover:text-rojo" aria-label="Quitar justificante">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button type="button" className="btn-ghost w-full" disabled={uploading} onClick={() => input.current?.click()}>
              <Paperclip size={16} /> {uploading ? "Subiendo…" : "Adjuntar foto o PDF"}
            </button>
          )}
          <input ref={input} type="file" accept="image/*,application/pdf" className="hidden" onChange={onPick} />
          {uploadError && <p className="mt-1 text-sm text-rojo">{uploadError}</p>}
        </div>
      </section>
      <FormMessage state={state} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {!movement && (
          <SubmitButton name="again" value="1" className="btn-ghost" disabled={uploading}>Guardar y apuntar otro</SubmitButton>
        )}
        <SubmitButton className="btn-primary" disabled={uploading}>{movement ? "Guardar cambios" : income ? "Guardar ingreso" : "Guardar gasto"}</SubmitButton>
      </div>
    </form>
  );
}
