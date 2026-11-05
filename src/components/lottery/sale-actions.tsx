"use client";
import { useActionState, useState } from "react";
import { FileDown, Mail, MessageCircle } from "lucide-react";
import type { ActionState } from "@/app/(app)/loteria/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

type A = (s: ActionState, f: FormData) => Promise<ActionState>;

export function PaymentForm({ action, pendingCents, canRefund }: { action: A; pendingCents: number; canRefund: boolean }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="amount">Importe (€)</label>
          <input id="amount" name="amount" inputMode="decimal" required className="input"
            defaultValue={pendingCents > 0 ? (pendingCents / 100).toFixed(2).replace(".", ",") : ""} />
        </div>
        <div>
          <label className="label" htmlFor="method">Forma</label>
          <select id="method" name="method" className="input" defaultValue="cash">
            <option value="cash">Efectivo</option>
            <option value="bizum">Bizum</option>
            <option value="transfer">Transferencia</option>
            <option value="card">Tarjeta</option>
            <option value="other">Otro</option>
          </select>
        </div>
      </div>
      {canRefund && (
        <select name="kind" className="input" defaultValue="payment" aria-label="Tipo de apunte">
          <option value="payment">Cobro</option>
          <option value="refund">Devolución / corrección negativa</option>
        </select>
      )}
      <input name="notes" className="input" placeholder="Nota (opcional)" />
      <FormMessage state={state} />
      <SubmitButton className="btn-dark w-full">Registrar cobro</SubmitButton>
    </form>
  );
}

export function CancelForm({ action }: { action: A }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3"
      onSubmit={(e) => { if (!confirm("¿Anular esta venta? Quedará registrado en la auditoría.")) e.preventDefault(); }}>
      <input name="reason" required className="input" placeholder="Motivo de la anulación" />
      <select name="release" className="input" defaultValue="release" aria-label="Qué hacer con las participaciones">
        <option value="release">Liberar las participaciones (vuelven a estar disponibles)</option>
        <option value="void">Anular las participaciones (papeleta extraviada o rota)</option>
      </select>
      <FormMessage state={state} />
      <SubmitButton className="btn w-full bg-white text-rojo ring-1 ring-rojo hover:bg-rojo/5">Anular venta</SubmitButton>
    </form>
  );
}

export function SendReceipt({
  email,
  whatsappApi,
  whatsappManual,
  hasEmail,
  hasPhone,
  emailEnabled,
  pdfUrl,
}: {
  email: A;
  whatsappApi?: A;
  whatsappManual: () => Promise<{ url?: string; error?: string }>;
  hasEmail: boolean;
  hasPhone: boolean;
  emailEnabled: boolean;
  pdfUrl: string;
}) {
  const [emailState, emailAction] = useActionState(email, undefined);
  const [waState, waAction] = useActionState(whatsappApi ?? (async () => undefined), undefined);
  const [manualError, setManualError] = useState("");
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <form action={emailAction}>
          <SubmitButton className="btn-ghost w-full" pendingText="Enviando…" disabled={!emailEnabled || !hasEmail}>
            <Mail size={16} /> Enviar por email{!emailEnabled && <span className="ml-1 rounded bg-negro/10 px-1.5 py-0.5 text-[10px] uppercase">Pronto</span>}
          </SubmitButton>
        </form>
        {whatsappApi ? (
          <form action={waAction}>
            <SubmitButton className="btn-ghost w-full" pendingText="Enviando…" disabled={!hasPhone}>
              <MessageCircle size={16} /> Enviar por WhatsApp
            </SubmitButton>
          </form>
        ) : (
          <form
            action={async () => {
              const r = await whatsappManual();
              if (r.url) window.location.href = r.url;
              else setManualError(r.error ?? "No se pudo abrir WhatsApp");
            }}
          >
            <SubmitButton className="btn-ghost w-full" pendingText="Abriendo…" disabled={!hasPhone}>
              <MessageCircle size={16} /> Abrir en WhatsApp
            </SubmitButton>
          </form>
        )}
      </div>
      <a href={pdfUrl} target="_blank" rel="noopener" className="btn-ghost w-full">
        <FileDown size={16} /> Descargar justificante (PDF)
      </a>
      <FormMessage state={emailState} />
      <FormMessage state={waState} />
      {manualError && <FormMessage state={{ error: manualError }} />}
    </div>
  );
}
