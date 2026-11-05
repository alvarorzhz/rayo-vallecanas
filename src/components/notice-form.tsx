"use client";
import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

type S = { error?: string; ok?: string } | undefined;

export function NoticeForm({ action }: { action: (s: S, f: FormData) => Promise<S> }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="to">¿A quién?</label>
        <select id="to" name="to" className="input" defaultValue="all">
          <option value="all">A todo el equipo</option>
          <option value="player">Solo a los jugadores</option>
          <option value="admin">Solo a los gestores</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="title">Título</label>
        <input id="title" name="title" required maxLength={60} className="input" placeholder="Ej.: Entrenamiento cambiado" />
      </div>
      <div>
        <label className="label" htmlFor="body">Mensaje</label>
        <textarea id="body" name="body" required maxLength={240} rows={3} className="input" placeholder="Ej.: El jueves entrenamos a las 20:30 en el campo 2." />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full sm:w-auto" pendingText="Enviando…">Enviar aviso</SubmitButton>
    </form>
  );
}
