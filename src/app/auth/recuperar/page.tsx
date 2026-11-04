"use client";
import Link from "next/link";
import { useActionState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { requestReset } from "@/app/login/actions";

export default function RecoverPage() {
  const [state, action] = useActionState(requestReset, undefined);
  return (
    <AuthShell title="Recuperar acceso" subtitle="Te enviaremos un enlace por email">
      <form action={action} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input" autoComplete="email" />
        </div>
        <FormMessage state={state} />
        <SubmitButton pendingText="Enviando…">Enviar enlace</SubmitButton>
        <Link href="/login" className="block text-center text-sm text-negro/60 hover:text-rojo">Volver</Link>
      </form>
    </AuthShell>
  );
}
