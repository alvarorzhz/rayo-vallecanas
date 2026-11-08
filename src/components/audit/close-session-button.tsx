"use client";
import { useActionState } from "react";
import { closeSession, type CloseState } from "@/app/(app)/admin/auditoria/actions";
import { SubmitButton } from "@/components/submit-button";

export function CloseSessionButton({ id, who }: { id: string; who: string }) {
  const [state, action] = useActionState<CloseState, FormData>(closeSession, undefined);
  if (state?.ok) return <span className="text-xs font-bold text-green-700">{state.ok}</span>;
  return (
    <form action={action} className="flex flex-col items-end gap-1"
      onSubmit={(e) => { if (!confirm(`¿Cerrar esta sesión de ${who}? Tendrá que volver a entrar con su email y contraseña en ese dispositivo.`)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="btn-ghost !px-3 !py-1.5 text-xs" pendingText="Cerrando…">Cerrar sesión</SubmitButton>
      {state?.error && <span className="text-xs text-rojo">{state.error}</span>}
    </form>
  );
}
