"use client";
import { useState, useTransition } from "react";
import { BellRing, MessageCircle } from "lucide-react";
import type { FeeReminderState } from "@/app/(app)/plantilla/cuotas/actions";

/** Botón «Recordar a los que deben»: aviso a quien lo tiene activado y WhatsApp ya escrito para el resto. */
export function FeeReminder({ action, owing }: { action: () => Promise<FeeReminderState>; owing: number }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<FeeReminderState>();
  return (
    <section className="card mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold">Recordar la cuota</h2>
          <p className="text-xs text-negro/65">Solo a los {owing} que deben, cada uno con lo que le falta. Ellos lo ven también en Mi perfil.</p>
        </div>
        <button type="button" className="btn-primary" disabled={pending} onClick={() => start(async () => setState(await action()))}>
          <BellRing size={16} /> {pending ? "Enviando…" : "Recordar a los que deben"}
        </button>
      </div>
      {state?.error && <p className="mt-3 text-sm font-semibold text-rojo">{state.error}</p>}
      {state?.ok && <p className="mt-3 text-sm font-semibold text-green-700">{state.ok}</p>}
      {state?.info && <p className="mt-3 text-sm font-semibold text-negro/70">{state.info}</p>}
      {!!state?.whatsapp?.length && (
        <div className="mt-3 rounded-xl bg-gris/60 p-3">
          <p className="mb-2 text-xs font-bold text-negro/70">Sin avisos activados: mándaselo por WhatsApp</p>
          <ul className="flex flex-wrap gap-2">
            {state.whatsapp.map((w) => (
              <li key={w.name}>
                {w.url ? (
                  <a href={w.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-sm font-semibold ring-1 ring-black/10 hover:text-green-700 hover:ring-green-600">
                    <MessageCircle size={15} className="text-green-600" /> {w.name} · {w.amount}
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-sm text-negro/60 ring-1 ring-black/10" title="No tiene teléfono en su ficha">
                    {w.name} · {w.amount} · sin teléfono
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
